import json
import re
from datetime import date
from hashlib import sha256
from io import BytesIO
from uuid import uuid4
from xml.sax.saxutils import escape

from reportlab.lib.styles import getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from server.core.errors import fail
from server.application.housing import MOVE_IN, active_application, housing_account
from server.contracts.models import Booking, Decision, Discussion, Supplement
from server.application.sports import SPORTS, check_booking
from server.infrastructure.persistence.store import ASSETS, DATA, PEOPLE, note, now, put, records
from server.application.teaching import effective_activities
from server.core.uploads import decode_upload


def find(con, id):
    row = con.execute("SELECT body FROM records WHERE id=?", (id,)).fetchone()
    if not row:
        fail("Обращение не найдено", 404)
    return json.loads(row[0])


def owns_electronic_document(record, owner):
    return (
        record["owner"] == owner
        and record["kind"] == "document"
        and record.get("format") == "Электронная"
        and record["status"] == "approved"
    )


def minutes(clock):
    h, m = map(int, clock.split(":"))
    return h * 60 + m


def check_room(con, r):
    if r.get("sport"):
        check_booking(r, records(con))
        return
    if r["date"] not in DATA["activities"] or not any(
        room["short"] == r["short"] for room in DATA["rooms"]
    ):
        fail("Помещение или дата больше недоступны для бронирования", 409)
    start, end = minutes(r["time"]), minutes(r["end"])
    if start < 540 or end > 1320 or not 30 <= end - start <= 240:
        fail("Доступно от 30 минут до четырёх часов в пределах 09:00–22:00")
    occupied = [
        other
        for other in records(con)
        if other.get("short") == r["short"]
        and other.get("date") == r["date"]
        and other["id"] != r["id"]
        and other["time"] < r["end"]
        and other["end"] > r["time"]
    ]
    if r["short"] == DATA["gym"]["short"]:
        if any(
            o["owner"] == r["owner"] and o["status"] in {"approved", "pending"} for o in occupied
        ):
            fail("У вас уже есть заявка на это время", 409)
        weekday = date.fromisoformat(r["date"]).weekday() < 5
        for t in range(start, end, 30):
            group = (11 if 1080 <= t < 1200 else 6 if 720 <= t < 900 else 0) if weekday else 0
            used = sum(
                o["status"] == "approved" and minutes(o["time"]) <= t < minutes(o["end"])
                for o in occupied
            )
            if group + used >= DATA["gym"]["capacity"]:
                fail("На выбранное время мест не осталось", 409)
    elif any(
        room == r["short"] and a < r["end"] and b > r["time"]
        for room, a, b in effective_activities(con, date.fromisoformat(r["date"]))
    ) or any(o["status"] == "approved" for o in occupied):
        fail("Помещение уже занято в это время", 409)
    if any(
        o["owner"] == r["owner"]
        and o["status"] == "pending"
        and o["time"] == r["time"]
        and o["end"] == r["end"]
        for o in occupied
    ):
        fail("Такая заявка уже рассматривается", 409)


def service_fields(service, values, owner):
    details = {}
    for f in service["fields"]:
        v = values.get(f["id"], "")
        kind = f["type"]
        options = DATA["transfers"][owner] if kind == "program" else f.get("options")
        valid = (
            bool(v)
            and len(v) <= (2000 if kind == "textarea" else 200)
            and (options is None or v in options)
        )
        if kind == "email":
            valid = valid and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", v)
        if kind == "tel":
            valid = valid and re.fullmatch(r"\+?[\d ()-]{7,25}", v)
        if kind == "date":
            try:
                valid = valid and date.fromisoformat(v).isoformat() == v
            except ValueError:
                valid = False
        if not valid:
            fail("Проверьте поле «" + f["label"] + "»")
        details[f["label"]] = v
    if values.get("end") and values.get("start", "") > values["end"]:
        fail("Дата окончания раньше даты начала")
    return details


def save_attachment(con, record, upload):
    name = re.sub(r"[\\/\r\n]", "_", upload.name)[:150]
    blob = decode_upload(upload.base64, upload.mime)
    con.execute(
        """INSERT INTO attachments(record_id,name,mime,content) VALUES(?,?,?,?)
           ON CONFLICT(record_id) DO UPDATE SET
           name=excluded.name, mime=excluded.mime, content=excluded.content""",
        (record["id"], name, upload.mime, blob),
    )
    record["attachment"] = name


def create(con, user, data):
    role = PEOPLE[user]["role"]
    if role not in {"student", "teacher"}:
        fail("Услуга недоступна", 403)
    payload = data.model_dump(mode="json", exclude={"requestId"})
    if data.requestId is not None:
        request_id = str(data.requestId)
        fingerprint = sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        submitted = con.execute(
            "SELECT fingerprint, record_id FROM request_submissions WHERE owner=? AND request_id=?",
            (user, request_id),
        ).fetchone()
        if submitted:
            if fingerprint != submitted["fingerprint"]:
                fail("Ключ отправки уже использован для другой заявки", 409)
            return find(con, submitted["record_id"]), None
    r = dict(id=str(uuid4()), owner=user, kind=data.kind, status="pending", created=now())
    if isinstance(data, Booking) and data.sport:
        sport = SPORTS.get(data.sport)
        if not sport:
            fail("Выберите вид спорта из каталога")
        r.update(
            **payload,
            name=sport["name"],
            building=dict(
                name="Спортивный центр",
                short="спортцентр",
                image="services/sports.png",
                alt="Спортивные занятия",
            ),
            details={
                "Вид спорта": sport["name"],
                "Место": sport["venue"],
                "Длительность": str(sport["duration"]) + " минут",
            },
        )
        check_room(con, r)
    elif isinstance(data, Booking):
        room = next((o for o in DATA["rooms"] if o["short"] == data.short), None)
        if not room or data.date.isoformat() not in DATA["activities"]:
            fail("Проверьте корпус и дату")
        r.update(
            name="Место в спортзале " + room["short"]
            if room["kind"] == "Спортзал"
            else room["name"],
            building=room["building"],
            **payload,
        )
        check_room(con, r)
    else:
        if role != "student":
            fail("Услуга доступна студентам", 403)
        service = next((s for s in DATA["services"] if s["name"] == data.name), None)
        if not service:
            fail("Выберите услугу из каталога")
        if data.name == MOVE_IN:
            history = records(con)
            if housing_account(user, history):
                fail("Место в общежитии уже предоставлено", 409)
            if active_application(user, history):
                fail("Заявка на заселение уже подана", 409)
        if service["certificate"] and data.format not in {"Электронная", "Бумажная"}:
            fail("Выберите формат справки")
        r.update(
            name=data.name,
            format=data.format if service["certificate"] else "Заявление",
            comment=data.comment,
            details=service_fields(service, data.values, user),
        )
        if any(f["id"] == "program" for f in service["fields"]):
            r["requirements"] = DATA["transfers"][user][data.values["program"]]
        if a := data.attachment:
            save_attachment(con, r, a)
    put(con, r)
    if data.requestId is not None:
        con.execute(
            "INSERT INTO request_submissions VALUES(?,?,?,?)",
            (user, request_id, fingerprint, r["id"]),
        )
    note_id = note(
        con,
        "office",
        "Новое обращение",
        PEOPLE[user]["name"] + " · " + r["name"],
        2,
        r["id"],
    )
    return r, note_id


def apply_decision(con, data: Decision) -> int:
    record = find(con, data.id)
    if record["status"] != "pending":
        fail("Заявка уже обработана", 409)

    approved = data.status == "approved"
    is_booking = record["kind"] == "booking"
    if approved and is_booking:
        check_room(con, record)
    record.update(status=data.status, reason=data.reason)
    if approved and record.get("format") == "Электронная":
        record["expires"] = now() + 86400000

    if is_booking:
        title = "Бронь одобрена" if approved else "Бронь отклонена"
    else:
        title = "Обращение одобрено" if approved else "Обращение отклонено"
    put(con, record)
    return note(con, record["owner"], title, record["name"] + " " + data.reason, 4, record["id"])


def cancel_booking(con, user: str, record_id: str) -> None:
    record = find(con, record_id)
    if record["owner"] != user or record["kind"] != "booking":
        fail("Отмена недоступна", 403)
    if record["status"] not in {"pending", "approved"}:
        fail("Статус изменился", 409)
    record["status"] = "cancelled"
    put(con, record)


def discuss(con, user: str, data: Discussion | Supplement, *, asking: bool) -> int:
    record = find(con, data.id)
    if record["kind"] != "document":
        fail("Обращение не найдено", 404)
    if user != ("office" if asking else record["owner"]):
        fail("Нет доступа", 403)
    if record["status"] != ("pending" if asking else "clarification"):
        fail("Статус изменился", 409)
    record["status"] = "clarification" if asking else "pending"
    if not asking and isinstance(data, Supplement) and data.attachment:
        save_attachment(con, record, data.attachment)
    record.setdefault("discussion", []).append(dict(sender=user, body=data.body, created=now()))
    put(con, record)
    recipient = record["owner"] if asking else "office"
    title = "Нужны сведения по заявке" if asking else "Студент дополнил обращение"
    return note(con, recipient, title, record["name"] + " · " + data.body, 4, record["id"])


def pdf(record):
    pdfmetrics.registerFont(TTFont("DejaVu", str(ASSETS / "DejaVuSans.ttf")))
    output = BytesIO()
    doc = SimpleDocTemplate(output)
    styles = getSampleStyleSheet()
    lines = []

    def line(value, style="BodyText"):
        styles[style].fontName = "DejaVu"
        lines.extend([Paragraph(escape(value), styles[style]), Spacer(1, 12)])

    line("ЦИФРОВОЙ ДЕКАНАТ · УЧЕБНЫЙ ОБРАЗЕЦ")
    line(record["name"], "Title")
    person = PEOPLE[record["owner"]]
    line("Получатель: " + person["name"])
    line("Электронный экземпляр № " + record["id"][:8])
    line(person["program"] + " · " + person["unit"])
    if record["name"] == "Выписка из зачётной книжки":
        grades = DATA["grades"].get(record["owner"], [])
        if not grades:
            line("В зачётной книжке пока нет записей.")
        for grade in grades:
            line(f"{grade['name']} — {grade['grade']}. {grade['summary']}")
    for label, value in record.get("details", {}).items():
        line(label + " · " + value)
    line("Демонстрационный документ. Сведения вымышлены.")
    doc.build(lines)
    return output.getvalue()
