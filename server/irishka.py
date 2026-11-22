"""Private chat history, model integration and a local fallback navigator."""
import json
import logging
import re
from contextlib import closing
from datetime import date, datetime, timedelta
from typing import Annotated
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from anyio import CancelScope, to_thread
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import Field
from starlette.concurrency import iterate_in_threadpool

from .assistant_agent import model_events
from .assistant_provider import ProviderError, configured_provider
from .assistant_sports import requested_sport
from .assistant_titles import chat_title
from .assistant_tools import LINKS, CampusTools, Search, ToolError, blocks_for_tool, schedule_block
from .campus_routes import requested_place, requested_route
from .campus_search import normalize
from .auth import User
from .models import Input, Text
from .store import DATA, PEOPLE, connect, now, records

logger = logging.getLogger(__name__)
MONTHS = ("января", "февраля", "марта", "апреля", "мая", "июня",
          "июля", "августа", "сентября", "октября", "ноября", "декабря")
TEACHER_QUESTION = re.compile(
    r"(?:кто(?:\s+у\s+(?:меня|нас))?\s+(?:(?:ее|его|их)\s+)?(?:ведет|ведут|вел[аи]?|будет\s+вести|преподает|читает\s+лекции)\b"
    r"|(?:кто|как зовут|назови)(?:\s+у\s+(?:меня|нас))?\s+(?:препод\w*|лектор\w*)\b"
    r"|(?:найди|покажи)\s+(?:препод\w*|лектор\w*)\b(?=\s+(?:по|предмета|дисциплины)\s+))\s*(.*)"
)
RELATIVE_DATE = {"сегодня": 0, "завтра": 1, "послезавтра": 2}
WEEKDAYS = {"понедельник": 0, "вторник": 1, "среду": 2, "четверг": 3, "пятницу": 4, "субботу": 5, "воскресенье": 6}
WORD_WEEKDAY = re.compile(rf"\b(?:в|во)\s+(следующ\w+\s+)?({'|'.join(WEEKDAYS)})\b")
WORD_DATE = re.compile(rf"\b(?:(?:на|в)\s+)?(\d{{1,2}})\s+({'|'.join(MONTHS)})(?:\s+(\d{{4}})(?:\s+года)?)?\b")


class ChatTitle(Input):
    title: Text = Field(max_length=80, description="Новое название личного чата")


class ChatMessage(Input):
    text: Text = Field(max_length=4000, description="Сообщение пользователя")
    request_id: UUID = Field(description="Идентификатор отправки для защиты от дублей при повторе")
    context_date: date | None = Field(None, description="Демонстрационный день кабинета; по умолчанию сегодня по Москве")


def owned(con, user, chat_id):
    chat = con.execute("SELECT id,owner,title,created,updated FROM irishka_chats WHERE id=? AND owner=?", (str(chat_id), user)).fetchone()
    if chat is None:
        raise HTTPException(404, "Чат не найден")
    return dict(chat)


def conversation(con, user, chat_id):
    chat = owned(con, user, chat_id)
    messages = []
    for turn in con.execute("SELECT * FROM irishka_turns WHERE chat_id=? ORDER BY rowid", (str(chat_id),)):
        messages.extend([
            {"id": turn["id"] + "-user", "role": "user", "text": turn["body"], "created": turn["created"]},
            {"id": turn["id"] + "-assistant", "role": "assistant", **json.loads(turn["reply"]), "created": turn["created"]},
        ])
    return {**chat, "messages": messages}


def teacher_question(text, day):
    on_date = None
    if match := re.search(r"\b(?:(?:на|в)\s+)?(\d{4}-\d{2}-\d{2})\b", text, re.IGNORECASE):
        try:
            on_date = date.fromisoformat(match[1])
        except ValueError:
            pass
        text = text[:match.start()] + " " + text[match.end():]
    query = normalize(text)
    if match := WORD_DATE.search(query):
        try:
            year = int(match[3]) if match[3] else day.year
            on_date = date(year, MONTHS.index(match[2]) + 1, int(match[1]))
        except ValueError:
            pass
        query = query[:match.start()] + " " + query[match.end():]
    if match := re.search(r"\b(?:(?:на|в)\s+)?(сегодня|завтра|послезавтра)\b", query):
        offset = RELATIVE_DATE[match[1]]
        if (date.max - day).days >= offset:
            on_date = day + timedelta(days=offset)
        query = query[:match.start()] + " " + query[match.end():]
    if match := WORD_WEEKDAY.search(query):
        if on_date is None:
            weekday = WEEKDAYS[match[2]]
            offset = (7 + weekday - day.weekday()) if match[1] else (weekday - day.weekday()) % 7
            if (date.max - day).days >= offset:
                on_date = day + timedelta(days=offset)
        query = query[:match.start()] + " " + query[match.end():]
    query = " ".join(query.split())
    query = re.sub(r"^(?:подскажи|скажи)\s+", "", query)
    if match := TEACHER_QUESTION.fullmatch(query):
        subject = match[1]
    elif match := re.fullmatch(r"(.{1,120})\s+кто\s+(?:(?:ее|его)\s+)?(?:ведет|преподает)", query):
        subject = match[1]
    else:
        return None
    subject = re.sub(r"^(?:у\s+(?:меня|нас)\s+)?(?:(?:пары|занятия|лекции|семинары)\s+)?(?:по\s+)?(?:(?:предмет\w*|дисциплин\w*)\s+)?", "", subject)
    subject = re.sub(r"\s+(?:(?:у\s+(?:меня|нас))|(?:пожалуйста)|(?:на|в))$", "", subject).strip()
    if subject in {"ее", "его", "их", "этот предмет", "предмет", "эту дисциплину", "дисциплину", "курс"}:
        subject = ""
    return subject[:120], on_date


def teacher_description(match, on_date, day):
    teachers = match.get("teachers", [])
    if not teachers and (teacher := match.get("teacher")):
        teachers = [{"name": teacher}]
    if not teachers:
        return f"У предмета «{match['name']}» преподаватель в расписании не указан."
    names = ", ".join(f"**{row['name']}**" for row in teachers)
    verb = "ведёт" if len(teachers) == 1 else "ведут"
    answer = f"Предмет «{match['name']}» {verb} {names}."
    if on_date and match.get("cancelled"):
        return f"{answer} Занятие на эту дату отменено."
    if not match.get("cancelled") and match.get("date") and match.get("time") and match.get("end"):
        lesson_date = date.fromisoformat(match["date"])
        if on_date or lesson_date >= day:
            prefix = "Занятие" if on_date else "Ближайшее занятие"
            answer += f" {prefix} **{lesson_date.day} {MONTHS[lesson_date.month - 1]}, {match['time']}–{match['end']}**."
            if match.get("room"):
                answer += f" Аудитория **{match['room']}**."
            if len(teachers) > 1 and match.get("teacher"):
                answer += f" Это занятие ведёт **{match['teacher']}**."
    return answer


def navigator_reply(text, *actions, blocks=None):
    return {
        "text": text,
        "actions": [{"label": label, "action": action} for label, action in actions],
        "mode": "navigator",
        "blocks": blocks or [],
    }


def subject_teacher_answer(tools, question, recent_subject):
    subject, on_date = question
    subject = subject or recent_subject
    if not subject:
        return navigator_reply("Уточните название предмета, и я посмотрю, кто его ведёт.")
    parameters = {"query": subject, "category": "subjects"}
    if on_date:
        parameters["date"] = on_date
    data, actions = tools.run("campus_search", parameters)
    matches = data["matches"]
    if not matches:
        summary = (
            "На выбранную дату в вашем расписании нет занятий по этому предмету."
            if on_date else "В вашем расписании не нашёл этот предмет. Проверьте его название."
        )
        return navigator_reply(summary, (LINKS["schedule"], "schedule"))
    exact = [match for match in matches if normalize(match["name"]) == normalize(subject)]
    if exact:
        matches = exact
    summary = "\n\n".join(teacher_description(match, on_date, tools.day) for match in matches)
    links = ((LINKS[link], link) for link in actions)
    return navigator_reply(summary, *links, blocks=blocks_for_tool("campus_search", {**data, "matches": matches}))


def answer(user, text, day, schedule, office_tasks=None):
    query = text.lower().replace("ё", "е")
    tools = CampusTools(user, day, schedule, office_tasks)
    if office_tasks is not None and tools.role == "office" and any(word in query for word in ("задач", "todo", "to-do")):
        tasks, _ = tools.run("campus_office_tasks", {})
        pending = [row for row in tasks["tasks"] if not row["complete"]]
        lines = [f"• {row['title']}" + (f" · до {row['due']}" if row.get("due") else "") for row in pending]
        return navigator_reply("Открытые задачи деканата:\n" + "\n".join(lines) if lines else "В списке нет открытых задач.", ("Задачи деканата", "office-tasks"))
    if (user == "office" or tools.role == "teacher") and any(word in query for word in ("отмен", "перенес", "перенос", "отправ")) and any(word in query for word in ("пар", "занят", "домаш")):
        return navigator_reply("Откройте нужную пару в расписании. В её карточке доступны отмена, перенос и отправка домашнего задания группе.", ("Открыть расписание", "schedule"))
    if any(word in query for word in ("домашк", "домашн")) or re.search(r"\bдз\b", query):
        notes, _ = tools.run("campus_notifications", {"category": "homework"})
        homework = notes["notes"]
        if homework:
            return navigator_reply("\n\n".join(f"{row['title']}\n{row['body']}" for row in homework), ("Уведомления", "notices"))
        return navigator_reply("В последних уведомлениях нет домашнего задания. Все сообщения можно открыть в уведомлениях.", ("Уведомления", "notices"))
    route = requested_route(text)
    point = requested_place(text) if route is None else None
    if route or point:
        tool = "campus_route" if route else "campus_place"
        try:
            data, actions = tools.run(tool, route or point)
        except ToolError as error:
            return navigator_reply(str(error), (LINKS["navigator"], "navigator"))
        if route:
            summary = "Подготовил маршрут по кампусу."
        else:
            location = data["place"].get("code") or data["place"]["name"]
            summary = f"Отметил **{location}** на карте."
        if session := data.get("session"):
            summary += f"\n\nБлижайшая тренировка: **{session['name']}** · {session['date']} в {session['time']}."
            if session["status"] == "pending":
                summary += " Заявка ждёт подтверждения."
        return navigator_reply(summary, *((LINKS[link], link) for link in actions), blocks=blocks_for_tool(tool, data))
    if "campus_sports" in tools.names and (parameters := requested_sport(text, day)):
        data, actions = tools.run("campus_sports", parameters)
        if data["sessions"]:
            summary = "Выберите удобное время и нажмите «Записаться». Заявку подтвердит деканат."
        elif data["upcoming"]:
            summary = "Вот ваши ближайшие тренировки и статусы записи."
        elif parameters["scope"] == "upcoming":
            summary = "У вас пока нет ближайших записей на спорт."
        else:
            summary = "На этот период свободных тренировок нет. Попробуйте другую дату или секцию."
        return navigator_reply(summary, *((LINKS[link], link) for link in actions), blocks=blocks_for_tool("campus_sports", data))
    download = any(word in query for word in ("скача", "pdf", "готовый", "готовую"))
    requests_documents = any(word in query for word in ("справк", "документ", "выписк"))
    if "campus_documents" in tools.names and (
        (requests_documents and "статус" not in query)
        or (download and "расписан" not in query and "статус" not in query)
    ):
        if re.search(r"справк\w*\s+об\s+обучении", query):
            document = "Справка об обучении"
        elif "выписк" in query and "зачет" in query:
            document = "Выписка из зачётной книжки"
        else:
            document = next((
                service["name"] for service in DATA["services"]
                if service["name"].lower().replace("ё", "е") in query
            ), None)
        parameters = {"scope": "downloads" if download else "all"}
        if document:
            parameters["query"] = document
        data, actions = tools.run("campus_documents", parameters)
        if download:
            summary = "Вот доступные электронные документы." if data["downloads"] else "Готовых документов для скачивания пока нет."
        elif data["forms"] or data["downloads"]:
            summary = "Откройте нужную форму или скачайте готовый документ."
        else:
            summary = "По этому запросу нет доступных форм и готовых документов."
        return navigator_reply(summary, *((LINKS[link], link) for link in actions), blocks=blocks_for_tool("campus_documents", data))
    if match := re.fullmatch(r"(?:найди(?:те)?|поиск|где(?: находится)?)\s+(.{1,120})", text.strip().rstrip(" ?!."), re.IGNORECASE):
        search_query = match[1]
        category = "all"
        for option, nouns in (
            ("rooms", "аудиторию|кабинет"),
            ("people", "человека|студента|преподавателя"),
            ("subjects", "предмет|дисциплину"),
            ("services", "услугу|сервис"),
        ):
            if target := re.fullmatch(rf"(?:{nouns})\s+(.+)", search_query, re.IGNORECASE):
                search_query, category = target[1], option
                break
        data, actions = tools.run("campus_search", {"query": search_query, "category": category})
        matches = data["matches"]
        if not matches:
            return navigator_reply("По этому запросу ничего нет. Попробуйте имя, код аудитории или название услуги.")
        summary = f"Нашёл: **{matches[0]['name']}**." if len(matches) == 1 else "Вот что нашлось в кампусе."
        return navigator_reply(summary, *((LINKS[link], link) for link in actions), blocks=blocks_for_tool("campus_search", data))
    if user == "office" and any(word in query for word in ("обращен", "очеред", "заявк")):
        queue, _ = tools.run("campus_office_queue", {})
        return navigator_reply(f"В очереди деканата {queue['total']} заявок. Откройте обращения, чтобы проверить детали и принять решение.", ("Обращения студентов", "queue"))
    if any(word in query for word in ("расписан", "пары", "занятия", "сегодня", "завтра", "недел")):
        if "завтра" in query:
            start = end = day + timedelta(days=1) if day < date.max else day
        elif "сегодня" in query:
            start = end = day
        else:
            start = day - timedelta(days=day.weekday())
            end = start + timedelta(days=min(6, (date.max - start).days))
        lessons = schedule(user, start=start, end=end)
        summary = f"Расписание за {start:%d.%m}–{end:%d.%m.%Y} по московскому времени."
        if not lessons:
            summary = "В расписании кабинета на этот период занятий нет."
        summary += f"\n\nВыбранный день: **{day:%d.%m.%Y}**."
        return navigator_reply(summary, ("Открыть расписание", "schedule"), blocks=[schedule_block(start, end, lessons[:60], len(lessons))])
    if any(word in query for word in ("оценк", "учеб", "успеваем", "сесси", "зачет", "балл")) and "справк" not in query:
        grades = DATA["grades"].get(user, [])
        lines = [f"{g['name']} — {g.get('grade') or 'Пока без оценки'}. {g.get('summary', '')}" for g in grades]
        return navigator_reply("Вот что сейчас в вашей зачётке:\n\n" + "\n\n".join(lines) if lines else "В этом кабинете личной студенческой зачётки нет.", ("Открыть учёбу", "study"))
    if any(word in query for word in ("уведом", "нового", "объявлен", "новост")):
        with connect() as con:
            notes = con.execute("SELECT title,body FROM inbox_notes WHERE owner=? ORDER BY id DESC LIMIT 5", (user,)).fetchall()
        return navigator_reply("Последние уведомления:\n\n" + "\n\n".join(f"{n['title']}\n{n['body']}" for n in notes) if notes else "Новых уведомлений в вашем кабинете нет.", ("Все уведомления", "notices"))
    if any(word in query for word in ("статус", "мои заявки", "мои обращен")):
        with connect() as con:
            own = [r for r in records(con) if r["owner"] == user]
        labels = {"pending":"На рассмотрении", "approved":"Одобрена", "rejected":"Отклонена", "cancelled":"Отменена", "clarification":"Нужно уточнение"}
        return navigator_reply("Ваши последние заявки:\n\n" + "\n".join(f"{r['name']} — {labels.get(r['status'], r['status'])}" for r in own[:8]) if own else "У вас пока нет заявок. Могу помочь найти нужную услугу.", ("Мои заявки", "booked"))
    if any(word in query for word in ("брон", "помещен", "аудитор", "коворкинг")):
        return navigator_reply("Для бронирования выберите помещение, дату и свободный интервал. Затем проверьте заявку и отправьте её на согласование. Статус сохранится в разделе «Мои заявки».\n\nЯ открою подбор помещений; сама бронь появится только после вашей отправки.", ("Найти помещение", "spaces"), ("Мои заявки", "booked"))
    if any(word in query for word in ("справк", "заявлен", "документ")):
        return navigator_reply("Справку об обучении можно заказать через каталог услуг: выберите справку, укажите место предоставления и формат, затем проверьте и отправьте заявку. После согласования электронную справку можно скачать в PDF.\n\nЕсли нужна другая справка или заявление, в каталоге доступны все формы.", ("Открыть документы", "docs"), ("Мои заявки", "booked"))
    if query.strip(" !.,?") in ("привет", "здравствуй", "здравствуйте"):
        return navigator_reply(f"Привет, {PEOPLE[user]['name'].split()[1]}! Помогу разобраться с расписанием, оценками, уведомлениями, справками и бронированием. С чего начнём?", ("Расписание", "schedule"), ("Услуги", "services"))
    return navigator_reply("Могу показать расписание, домашние задания, оценки и статус заявки. Для поиска напишите, например, «Найди Б-108».", ("Расписание", "schedule"), ("Учёба", "study"), ("Все услуги", "services"))


def create_router(schedule, office_tasks=None):
    router = APIRouter(prefix="/irishka", tags=["Кабинет"], responses={401: {"description": "Нужен JWT"}, 404: {"description": "Чат недоступен"}})

    @router.get("/search", summary="Поиск Тинки по кампусу")
    def search(user: User, data: Annotated[Search, Query()]):
        """Ищет людей, аудитории, услуги и предметы своего расписания. Понимает краткие формы имён."""
        day = datetime.now(ZoneInfo("Europe/Moscow")).date()
        result, _ = CampusTools(user, day, schedule, office_tasks).run("campus_search", data.model_dump())
        return result

    @router.get("/chats", summary="Получить свои чаты Тинки")
    def chats(user: User):
        """Личные диалоги текущего участника, новые сверху, без чужих сообщений."""
        with connect() as con:
            return [dict(row) for row in con.execute("SELECT id,title,created,updated FROM irishka_chats WHERE owner=? ORDER BY updated DESC,rowid DESC", (user,))]

    @router.post("/chats", summary="Создать личный чат Тинки")
    def create(user: User):
        """Создаёт пустой диалог; название обновляется после первого сообщения."""
        with connect(True) as con:
            if con.execute("SELECT count(*) FROM irishka_chats WHERE owner=?", (user,)).fetchone()[0] >= 100:
                raise HTTPException(409, "Достигнут лимит 100 чатов. Удалите ненужный чат.")
            chat_id, timestamp = str(uuid4()), now()
            con.execute(
                "INSERT INTO irishka_chats(id,owner,title,created,updated) VALUES(?,?,?,?,?)",
                (chat_id, user, "Новый чат", timestamp, timestamp),
            )
            return conversation(con, user, chat_id)

    @router.get("/chats/{chat_id}", summary="Открыть свой диалог Тинки")
    def read(chat_id: UUID, user: User):
        """Возвращает все сообщения личного диалога; чужой идентификатор даёт 404."""
        with connect() as con:
            return conversation(con, user, chat_id)

    @router.post("/chats/{chat_id}/rename", summary="Переименовать свой чат Тинки")
    def rename(chat_id: UUID, data: ChatTitle, user: User):
        """Меняет название только собственного диалога."""
        with connect(True) as con:
            owned(con, user, chat_id)
            con.execute("UPDATE irishka_chats SET title=?, title_custom=1 WHERE id=?", (data.title, str(chat_id)))
            return conversation(con, user, chat_id)

    @router.post("/chats/{chat_id}/delete", summary="Удалить свой чат Тинки")
    def delete(chat_id: UUID, user: User):
        """Удаляет личный диалог и сообщения без возможности восстановления в интерфейсе."""
        with connect(True) as con:
            owned(con, user, chat_id)
            con.execute("DELETE FROM irishka_turns WHERE chat_id=?", (str(chat_id),))
            con.execute("DELETE FROM irishka_chats WHERE id=?", (str(chat_id),))
        return {"ok": True}

    @router.post("/chats/{chat_id}/messages", summary="Написать Тинки")
    def message(chat_id: UUID, data: ChatMessage, user: User):
        """Сохраняет сообщение и возвращает диалог с завершённым ответом Тинки."""
        with closing(turn_events(user, chat_id, data, schedule, office_tasks, stream=False)) as events:
            return next(event["chat"] for event in events if event["type"] == "done")

    @router.post(
        "/chats/{chat_id}/messages/stream",
        summary="Написать Тинки с потоковым ответом",
        response_class=StreamingResponse,
        responses={200: {"content": {"application/x-ndjson": {"schema": {"type": "string"}}}}},
    )
    def stream_message(chat_id: UUID, data: ChatMessage, user: User):
        """Возвращает статус и текст в NDJSON, затем карточки и сохранённый чат. Reset очищает незавершённый текст."""
        prepared = prepare_turn(user, chat_id, data)
        return ChatStream(turn_events(user, chat_id, data, schedule, office_tasks, stream=True, prepared=prepared))

    return router


def duplicate_turn(con, user, chat_id, data):
    previous = con.execute(
        "SELECT body FROM irishka_turns WHERE chat_id=? AND id=?", (str(chat_id), str(data.request_id))
    ).fetchone()
    if previous:
        if previous["body"] != data.text:
            raise HTTPException(409, "Идентификатор отправки уже использован")
        return conversation(con, user, chat_id)
    return None


def turn_count(con, chat_id):
    count = con.execute("SELECT count(*) FROM irishka_turns WHERE chat_id=?", (str(chat_id),)).fetchone()[0]
    if count >= 100:
        raise HTTPException(409, "В этом чате уже 100 сообщений. Создайте новый чат.")
    return count


def prepare_turn(user, chat_id, data):
    with connect() as con:
        owned(con, user, chat_id)
        previous = duplicate_turn(con, user, chat_id, data)
        if previous:
            return previous, [], None
        turn_count(con, chat_id)
        rows = con.execute(
            "SELECT body,reply FROM irishka_turns WHERE chat_id=? ORDER BY rowid DESC LIMIT 5", (str(chat_id),)
        ).fetchall()
    history = []
    recent_subject = None
    for turn in reversed(rows):
        reply = json.loads(turn["reply"])
        subjects = {
            match["name"] for block in reply.get("blocks", []) if block.get("type") == "search"
            for match in block.get("matches", []) if match.get("category") == "subjects"
        }
        recent_subject = next(iter(subjects)) if len(subjects) == 1 else None
        content = reply["text"][:3000]
        if recent_subject:
            content += f"\n\nПредмет в результатах: «{recent_subject}»."
        history.extend((
            {"role": "user", "content": turn["body"][:2000]},
            {"role": "assistant", "content": content},
        ))
    return None, history, recent_subject


def save_turn(user, chat_id, data, reply):
    with connect(True) as con:
        owned(con, user, chat_id)
        previous = duplicate_turn(con, user, chat_id, data)
        if previous:
            return previous
        count = turn_count(con, chat_id)
        timestamp = now()
        con.execute("INSERT INTO irishka_turns VALUES(?,?,?,?,?)", (
            str(data.request_id), str(chat_id), data.text, json.dumps(reply, ensure_ascii=False), timestamp,
        ))
        con.execute("UPDATE irishka_chats SET updated=? WHERE id=?", (timestamp, str(chat_id)))
        if count == 0:
            con.execute(
                "UPDATE irishka_chats SET title=? WHERE id=? AND title_custom=0",
                (chat_title(data.text, reply), str(chat_id)),
            )
        return conversation(con, user, chat_id)


def reply_events(user, data, schedule, office_tasks, history, recent_subject, stream):
    day = data.context_date or datetime.now(ZoneInfo("Europe/Moscow")).date()
    tools = CampusTools(user, day, schedule, office_tasks)
    reply = None
    teacher_reply = None
    if question := teacher_question(data.text, day):
        teacher_reply = subject_teacher_answer(tools, question, recent_subject)
        if teacher_reply["blocks"] or question[1]:
            reply = teacher_reply
    partial_visible = False
    try:
        configuration = configured_provider() if reply is None else None
        if configuration:
            provider, timeout = configuration
            with closing(model_events(provider, timeout, tools, history, data.text, stream=stream)) as events:
                for event in events:
                    match event["type"]:
                        case "reply":
                            reply = event["reply"]
                        case "delta":
                            partial_visible = True
                        case "reset":
                            partial_visible = False
                    if stream and event["type"] != "reply":
                        yield event
    except ProviderError:
        logger.warning("Провайдер Тинки недоступен, использован навигатор")
    if reply is None:
        if stream and partial_visible:
            yield {"type": "reset"}
            partial_visible = False
        reply = teacher_reply or answer(user, data.text, day, schedule, office_tasks)
    if stream and not partial_visible:
        yield {"type": "status", "state": "answering"}
        yield {"type": "delta", "text": reply["text"]}
    yield {"type": "reply", "reply": reply}


def turn_events(user, chat_id, data, schedule, office_tasks, *, stream, prepared=None):
    previous, history, recent_subject = prepared if prepared is not None else prepare_turn(user, chat_id, data)
    if previous:
        yield {"type": "done", "chat": previous}
        return
    if stream:
        yield {"type": "status", "state": "thinking"}
    with closing(reply_events(user, data, schedule, office_tasks, history, recent_subject, stream)) as events:
        for event in events:
            if event["type"] != "reply":
                yield event
                continue
            chat = save_turn(user, chat_id, data, event["reply"])
            if stream:
                reply_id = f"{data.request_id}-assistant"
                saved_reply = next(message for message in chat["messages"] if message["id"] == reply_id)
                if blocks := saved_reply.get("blocks"):
                    yield {"type": "blocks", "blocks": blocks}
            yield {"type": "done", "chat": chat}
            return


class ChatStream(StreamingResponse):
    def __init__(self, events):
        self.events = events
        super().__init__(
            self.lines(), media_type="application/x-ndjson",
            headers={"Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no"},
        )

    async def lines(self):
        try:
            async for event in iterate_in_threadpool(self.events):
                yield json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n"
        except HTTPException as error:
            yield json.dumps({"type": "error", "message": error.detail}, ensure_ascii=False) + "\n"

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            with CancelScope(shield=True):
                await to_thread.run_sync(self.finish)

    def finish(self):
        try:
            for _ in self.events:
                pass
        except HTTPException:
            return
