from server.core.ports import TaskScheduler
import asyncio
import json
import time
from server.contracts import models as m
from server.infrastructure.notifications import push
from server.core.errors import fail
from server.infrastructure.persistence.store import PEOPLE, connect, note, now
from server.application.teaching import teaching_rosters


def check_recipient(user, to):
    if to == user or to not in PEOPLE:
        fail("Выберите получателя")


def store_message(con, sender, to, body, title):
    con.execute(
        "INSERT INTO messages(sender,recipient,body,created) VALUES(?,?,?,?)",
        (sender, to, body, now()),
    )
    return note(con, to, title, body, 2, "chat:" + sender)


def message(data, user, background: TaskScheduler):
    """Диалог доступен отправителю и получателю. Уведомление содержит ссылку на диалог."""
    check_recipient(user, data.to)
    title = "Сообщение · " + PEOPLE[user]["name"]
    with connect(True) as con:
        note_id = store_message(con, user, data.to, data.body, title)
    background.add_task(push.deliver, note_id)
    return m.Ok()


def group_message(data, user, background: TaskScheduler):
    """Получателей определяет сервер по закреплённым группам преподавателя и составу группы.
    Каждая копия появляется в личном диалоге и создаёт уведомление адресату.
    Все копии записываются в одной транзакции. Повтор того же requestId возвращает прежний результат."""
    if PEOPLE[user]["role"] != "teacher":
        fail("Рассылка доступна преподавателям", 403)
    request_id = str(data.requestId)
    with connect(True) as con:
        previous = con.execute(
            "SELECT group_code,body,recipients FROM group_dispatches WHERE sender=? AND request_id=?",
            (user, request_id),
        ).fetchone()
        if previous:
            if previous["group_code"] != data.group or previous["body"] != data.body:
                fail("Этот идентификатор уже относится к другой рассылке", 409)
            return m.GroupDelivery(
                requestId=data.requestId, group=data.group, recipients=previous["recipients"]
            )
        members = teaching_rosters(user).get(data.group)
        if members is None:
            fail("Эта группа не закреплена за вами", 403)
        if not members:
            fail("В выбранной группе пока нет студентов")
        title = f"Сообщение группе {data.group} · {PEOPLE[user]['name']}"
        notes = [store_message(con, user, student, data.body, title) for student in members]
        con.execute(
            "INSERT INTO group_dispatches(sender,request_id,group_code,body,recipients) VALUES(?,?,?,?,?)",
            (user, request_id, data.group, data.body, len(members)),
        )
    for note_id in notes:
        background.add_task(push.deliver, note_id)
    return m.GroupDelivery(requestId=data.requestId, group=data.group, recipients=len(members))


def letter(data, user, background: TaskScheduler):
    """Письмо появится в уведомлениях адресата с полным текстом."""
    if user != "office":
        fail("Отправитель — деканат", 403)
    check_recipient(user, data.to)
    with connect(True) as con:
        note_id = note(con, data.to, data.subject, data.body, 3)
    background.add_task(push.deliver, note_id)
    return m.Ok()


def clear_notes(user, data):
    """Скрывает письма получателя до указанного уведомления включительно на всех его устройствах. Более новые письма сохраняются. Запрос можно повторить."""
    with connect(True) as con:
        exists = con.execute(
            "SELECT 1 FROM notes WHERE owner=? AND id=?", (user, data.through_id)
        ).fetchone()
        if not exists:
            fail("Уведомление не найдено", 404)
        con.execute(
            "INSERT INTO inbox_cleared(owner, through_id) VALUES(?, ?)\n               ON CONFLICT(owner) DO UPDATE SET through_id=MAX(through_id, excluded.through_id)",
            (user, data.through_id),
        )
    return m.Ok()


async def note_events(after, claims):

    def batch(cursor):
        with connect() as con:
            if (
                time.time() >= claims["exp"]
                or con.execute("SELECT 1 FROM revoked WHERE jti=?", (claims["jti"],)).fetchone()
            ):
                return None
            return con.execute(
                "SELECT id,owner,title FROM inbox_notes WHERE owner=? AND id>? ORDER BY id LIMIT 64",
                (claims["sub"], cursor),
            ).fetchall()

    async def events():
        cursor = after
        yield ": connected\n\n"
        for tick in range(90):
            rows = await asyncio.to_thread(batch, cursor)
            if rows is None:
                break
            for row in rows:
                cursor = row["id"]
                yield f"id: {cursor}\ndata: {json.dumps(dict(row), ensure_ascii=False)}\n\n"
            if tick and tick % 15 == 0:
                yield ": heartbeat\n\n"
            await asyncio.sleep(0.75)

    return events()


def read_note(user, note_id):
    """Сохраняет отметку чтения на всех устройствах владельца. Повторное открытие безопасно."""
    with connect(True) as con:
        exists = con.execute(
            "SELECT 1 FROM inbox_notes WHERE id=? AND owner=?", (note_id, user)
        ).fetchone()
        if not exists:
            fail("Уведомление не найдено", 404)
        con.execute("INSERT OR IGNORE INTO note_reads(note_id) VALUES(?)", (note_id,))
    return m.Ok()


def push_key(user):
    """Ключ для подписки браузера через PushManager."""
    with connect(True) as con:
        return dict(key=push.keys(con)["publicKey"])


def subscribe(data, user):
    """Принимает JSON браузерной подписки поддерживаемого провайдера Web Push."""
    with connect(True) as con:
        push.subscribe(con, user, data.subscription)
    return m.Ok()


def unsubscribe(data, user):
    """Отключает только подписку текущего пользователя с указанным endpoint."""
    with connect(True) as con:
        con.execute("DELETE FROM subscriptions WHERE endpoint=? AND owner=?", (data.endpoint, user))
    return m.Ok()
