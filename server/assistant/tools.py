"""The least-privilege read tools shared by Tinki and its MCP endpoint."""

import json
from datetime import date as CalendarDate, timedelta
from typing import Literal

from pydantic import Field, ValidationError

from server.assistant.sports import SportSessions, sport_sessions
from server.application.navigation import (
    RouteLookupError,
    is_room_lookup,
    is_sport_booking_destination,
    place_endpoint,
    requested_place,
    requested_route,
    route_endpoints,
)
from server.application.search import campus_search, search_score
from server.contracts.models import Input, Text
from server.application.requests import owns_electronic_document
from server.application.sports import SPORTS
from server.infrastructure.persistence.store import DATA, PEOPLE, connect, now, records
from server.application.teaching import SEMESTER_END, SEMESTER_START


class Search(Input):
    query: Text = Field(
        max_length=120, description="Имя, номер кабинета, предмет или название услуги"
    )
    category: Literal["all", "people", "rooms", "services", "subjects"] = "all"
    date: CalendarDate | None = Field(
        None, description="Дата занятия, если указана. Без даты предметы ищутся в текущем семестре."
    )


class Schedule(Input):
    start: CalendarDate | None = None
    end: CalendarDate | None = None


class Place(Input):
    query: Text = Field(max_length=120, description="Код аудитории или название места на карте")
    sport: Text | None = Field(
        None,
        max_length=80,
        description="Вид спорта, если ищем место собственной записи на тренировку",
    )


class Route(Input):
    origin: Text | None = Field(
        None,
        alias="from",
        max_length=120,
        description="Код или имя начальной точки. По умолчанию вход в корпус назначения.",
    )
    to: Text = Field(
        max_length=120, description="Код аудитории, название места на карте или «моя тренировка»"
    )
    sport: Text | None = Field(
        None,
        max_length=80,
        description="Вид спорта, если строим маршрут до собственной записи на тренировку",
    )


class Documents(Input):
    query: Text | None = Field(
        None,
        max_length=120,
        description="Название документа или заявления без глаголов. Если не указано, показать доступные документы.",
    )
    scope: Literal["all", "forms", "downloads"] = "all"


class Notifications(Input):
    category: Literal["all", "homework"] = "all"


TOOL_SPECS = {
    "campus_search": (
        "Поиск людей, аудиторий, услуг и предметов. Для вопроса о преподавателе предмета выбери category=subjects и передай название предмета. Можно уточнить дату. Для точной аудитории на карте используй campus_place.",
        Search,
        None,
    ),
    "campus_schedule": (
        "Расписание кабинета. Максимум 14 дней включительно. По умолчанию ближайшие семь дней.",
        Schedule,
        "schedule",
    ),
    "campus_place": (
        "Показать точное место на карте кампуса по коду или названию. Для своей записи на спорт передай query: «моя тренировка».",
        Place,
        "navigator",
    ),
    "campus_route": (
        "Построить маршрут между точками по карте кампуса. Передавай точные коды, например Б-412 и Н-318. Начало по умолчанию — вход в корпус назначения. Для своей записи на спорт передай to: «моя тренировка».",
        Route,
        "navigator",
    ),
    "campus_sports": (
        "Показать доступные тренировки или свои записи на спорт. Для существующих записей передай scope=upcoming. Запись подтверждается пользователем в карточке.",
        SportSessions,
        "sports",
    ),
    "campus_documents": (
        "Формы каталога и личные готовые PDF, доступные для скачивания. Для скачивания используй scope=downloads, для заказа формы scope=forms.",
        Documents,
        None,
    ),
    "campus_notifications": (
        "Последние личные уведомления, в том числе домашние задания и переносы. Для домашних заданий передай category=homework.",
        Notifications,
        "notices",
    ),
    "campus_my_requests": (
        "Последние статусы собственных заявок, без вложений и полей формы.",
        Input,
        "booked",
    ),
    "campus_grades": ("Личная зачётка студента.", Input, "study"),
    "campus_office_queue": (
        "Заявки к рассмотрению в деканате, без полей форм или вложений.",
        Input,
        "queue",
    ),
    "campus_office_tasks": ("Список задач рабочего стола деканата.", Input, "office-tasks"),
}

LINKS = {
    "schedule": "Расписание",
    "notices": "Уведомления",
    "booked": "Мои заявки",
    "study": "Зачётка",
    "queue": "Очередь деканата",
    "spaces": "Бронирование помещений",
    "docs": "Документы и заявления",
    "services": "Сервисы",
    "office-tasks": "Задачи деканата",
    "navigator": "Навигатор",
    "directory": "Люди",
    "sports": "Спорт",
}


class ToolError(Exception):
    pass


def schedule_block(start, end, lessons, total=None):
    return {
        "type": "schedule",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total": len(lessons) if total is None else total,
        "lessons": [
            {
                **{
                    key: lesson[key]
                    for key in ("id", "time", "end", "name", "type", "teacher", "room", "group")
                },
                **(
                    {"building": {"short": lesson["building"]["short"]}}
                    if lesson.get("building")
                    else {}
                ),
                "date": lesson["date"].isoformat(),
                "cancelled": bool(lesson.get("cancelled")),
                "changed": bool(lesson.get("changed")),
            }
            for lesson in lessons[:60]
        ],
    }


def blocks_for_tool(name, data):
    if name == "campus_schedule":
        return [schedule_block(data["start"], data["end"], data["lessons"], data["total"])]
    if name == "campus_route":
        return [{"type": "route", "from": data["from"], "to": data["to"]}]
    if name in {"campus_place", "campus_search"} and data.get("place"):
        return [{"type": "place", "place": data["place"]}]
    if name == "campus_search" and data["matches"]:
        return [{"type": "search", "matches": data["matches"]}]
    if name == "campus_documents":
        return [{"type": "documents", "forms": data["forms"], "downloads": data["downloads"]}]
    if name == "campus_sports":
        return [{"type": "sports", **data}]
    return []


def _document_matches(owner, query, scope):
    def matching(items, keys):
        scored = ((search_score(query, item["name"]) if query else 1, item) for item in items)
        ordered = sorted((pair for pair in scored if pair[0]), key=lambda pair: -pair[0])
        if ordered and ordered[0][0] == 120:
            ordered = [pair for pair in ordered if pair[0] == 120]
        return [{key: item[key] for key in keys} for _, item in ordered[:6]]

    forms = (
        matching(DATA["services"], ("name", "group", "certificate")) if scope != "downloads" else []
    )
    downloads = []
    if scope != "forms":
        with connect() as con:
            rows = con.execute(
                "SELECT body FROM records WHERE owner=? AND kind='document' ORDER BY rowid DESC",
                (owner,),
            ).fetchall()
        timestamp = now()
        available = (
            record
            for row in rows
            if owns_electronic_document(record := json.loads(row[0]), owner)
            and timestamp < record.get("expires", 0)
        )
        downloads = matching(available, ("id", "name", "expires"))
    return {"forms": forms, "downloads": downloads}


class CampusTools:
    def __init__(self, owner, day, schedule, office_tasks=None):
        self.owner, self.day, self.schedule = owner, day, schedule
        self.office_tasks = office_tasks
        self.role = PEOPLE[owner]["role"]
        self.names = [
            "campus_search",
            "campus_schedule",
            "campus_place",
            "campus_route",
            "campus_notifications",
            "campus_my_requests",
        ]
        if self.role == "student":
            self.names += ["campus_grades", "campus_documents"]
        if self.role in {"student", "teacher"}:
            self.names.append("campus_sports")
        if owner == "office":
            self.names.append("campus_office_queue")
        if self.role == "office" and office_tasks is not None:
            self.names.append("campus_office_tasks")

    def describe(self):
        return [
            dict(
                name=name,
                description=TOOL_SPECS[name][0],
                inputSchema=TOOL_SPECS[name][1].model_json_schema(),
                annotations={
                    "readOnlyHint": True,
                    "destructiveHint": False,
                    "openWorldHint": False,
                },
            )
            for name in self.names
        ]

    def run(self, name, arguments):
        if name not in self.names:
            raise ToolError("Инструмент недоступен в этом кабинете")
        try:
            parameters = TOOL_SPECS[name][1].model_validate(arguments)
        except ValidationError as error:
            raise ToolError("Проверьте аргументы инструмента") from error
        action = TOOL_SPECS[name][2]
        if name == "campus_search":
            if parameters.category in {"all", "rooms"} and is_room_lookup(parameters.query):
                try:
                    place = place_endpoint(parameters.query)
                except RouteLookupError:
                    pass
                else:
                    return {
                        **campus_search(parameters.query, "rooms", [], self.role),
                        "place": place,
                    }, ["navigator"]
            lessons = []
            if parameters.category in ("subjects", "all"):
                start = parameters.date or SEMESTER_START
                end = parameters.date or SEMESTER_END
                lessons = self.schedule(self.owner, start=start, end=end)
            data = campus_search(
                parameters.query,
                parameters.category,
                lessons,
                self.role,
                parameters.date or self.day,
            )
            for match in data["matches"]:
                if match["category"] == "subjects":
                    try:
                        match["placeId"] = place_endpoint(match["room"])["id"]
                    except RouteLookupError:
                        pass
            categories = {row["category"] for row in data["matches"]}
            actions = [
                link
                for category, link in (
                    ("rooms", "navigator"),
                    ("services", "services"),
                    ("subjects", "schedule"),
                    ("people", "directory"),
                )
                if category in categories
            ]
            return data, actions
        if name == "campus_schedule":
            start = parameters.start or self.day
            if not SEMESTER_START <= start <= SEMESTER_END:
                raise ToolError("Расписание доступно с 1 сентября по 28 декабря 2026 года")
            end = parameters.end or start + timedelta(days=6)
            if not 0 <= (end - start).days < 14:
                raise ToolError("Укажите диапазон от 1 до 14 дней")
            rows = self.schedule(self.owner, start=start, end=end)
            return {"start": start, "end": end, "lessons": rows[:60], "total": len(rows)}, [action]
        if name in {"campus_place", "campus_route"}:
            return self._navigation(name, parameters), [action]
        if name == "campus_sports":
            return sport_sessions(self.owner, self.day, parameters), [action]
        if name == "campus_documents":
            data = _document_matches(self.owner, parameters.query, parameters.scope)
            actions = [
                link for key, link in (("forms", "docs"), ("downloads", "booked")) if data[key]
            ]
            return data, actions
        if name == "campus_notifications":
            with connect() as con:
                rows = con.execute(
                    """SELECT id,title,substr(body,1,1200) AS body,created,ref
                       FROM inbox_notes WHERE owner=? AND (?='all' OR title LIKE 'Домашнее задание%')
                       ORDER BY id DESC LIMIT 8""",
                    (self.owner, parameters.category),
                ).fetchall()
            return {"notes": [dict(row) for row in rows]}, [action]
        if name == "campus_grades":
            return {"grades": DATA["grades"].get(self.owner, [])[:20]}, [action]
        if name == "campus_office_tasks":
            rows = self.office_tasks(self.owner)
            return {"tasks": rows[:20]}, [action]
        with connect() as con:
            source = records(con)
        if name == "campus_office_queue":
            rows = [r for r in source if r["status"] in {"pending", "clarification"}]
        else:
            rows = [r for r in source if r["owner"] == self.owner]
        return {
            "requests": [
                {key: row[key] for key in ("id", "name", "status", "kind") if key in row}
                for row in rows[:12]
            ],
            "total": len(rows),
        }, [action]

    def _navigation(self, name, parameters):
        is_route = name == "campus_route"
        target = parameters.to if is_route else parameters.query
        session = None
        if is_sport_booking_destination(target):
            if "campus_sports" not in self.names:
                raise ToolError("Записи на спорт недоступны в этом кабинете.")
            upcoming = sport_sessions(
                self.owner, self.day, SportSessions(scope="upcoming", sport=parameters.sport)
            )["upcoming"]
            if not upcoming:
                raise ToolError("На ближайшие дни у вас нет записи на тренировку.")
            session = upcoming[0]
            if session["short"] == DATA["gym"]["short"]:
                target = session["short"]
            else:
                activity = SPORTS.get(session["sport"], {})
                target = activity.get("mapRoom") or session["venue"]
            try:
                target = place_endpoint(target)["id"]
            except RouteLookupError as error:
                raise ToolError(
                    f"Место вашей тренировки — {session['venue']}. Этого места пока нет на карте кампуса."
                ) from error
        try:
            data = (
                route_endpoints(target, parameters.origin)
                if is_route
                else {"place": place_endpoint(target)}
            )
        except RouteLookupError as error:
            raise ToolError(str(error)) from error
        if session:
            data["session"] = {
                key: session[key] for key in ("name", "date", "time", "status", "venue")
            }
        return data
