"""Published lesson changes and group notifications."""

import json
from datetime import date, timedelta
from functools import lru_cache

from .errors import fail
from .store import DATA, PEOPLE, connect, note, now, records

SEMESTER_START = date(2026, 9, 1)
SEMESTER_END = date(2026, 12, 28)
ROOMS = {room["short"]: room for room in DATA["rooms"]}


def base_lessons(day):
    key = day.isoformat()
    for lesson in DATA["exceptions"].get(key, DATA["week"][day.weekday()]):
        yield dict(lesson, id=key + lesson["suffix"], date=key)


def lesson_changes(con):
    return {
        row["lesson_id"]: {"original": json.loads(row["original"]), "lesson": json.loads(row["updated"])}
        for row in con.execute("SELECT lesson_id, original, updated FROM lesson_overrides ORDER BY revision")
    }


def schedule_revision(con):
    return con.execute("SELECT COALESCE(MAX(revision), 0) FROM lesson_overrides").fetchone()[0]


@lru_cache(maxsize=1024)
def teaching_rosters(user):
    if PEOPLE[user]["role"] != "teacher":
        return {}
    if "teachingGroups" in DATA:
        assigned = DATA["teachingGroups"].get(user, [])
    else:
        assigned = {
            lesson["group"] for day in [*DATA["week"], *DATA["exceptions"].values()]
            for lesson in day if lesson["teacher"] == PEOPLE[user]["name"]
        }
    rosters = {code: [] for code in assigned}
    for student, person in PEOPLE.items():
        if person["role"] == "student" and person["unit"] in rosters:
            rosters[person["unit"]].append(student)
    return rosters


def can_manage(user, lesson):
    person = PEOPLE[user]
    if person["role"] == "office":
        return True
    return person["role"] == "teacher" and person["name"] == lesson["teacher"]


def effective_lessons(day, changes):
    key = day.isoformat()
    yield from (lesson for lesson in base_lessons(day) if lesson["id"] not in changes)
    yield from (c["lesson"] for c in changes.values() if c["lesson"]["date"] == key)


def personal_schedule(user, start, end):
    with connect() as con:
        changes = lesson_changes(con)
    person = PEOPLE[user]
    day = max(start, SEMESTER_START)
    rows = []
    while day <= min(end, SEMESTER_END):
        for lesson in effective_lessons(day, changes):
            if can_manage(user, lesson) or person["role"] == "student" and lesson["group"] == person["unit"]:
                rows.append(dict(lesson, date=day, canManage=can_manage(user, lesson)))
        day += timedelta(days=1)
    return sorted(rows, key=lambda row: (row["date"], row["time"], row["name"], row["id"]))


def effective_activities(con, day, changes=None):
    """Keep non-lesson occupancy (e.g. project workshops) from the room catalog."""
    key = day.isoformat()
    if changes is None:
        changes = lesson_changes(con)
    activities = [tuple(row) for row in DATA["activities"].get(key, [])]
    if key not in DATA["activities"]:
        activities = [(row["room"], row["time"], row["end"]) for row in base_lessons(day)]
    for change in changes.values():
        original, lesson = change["original"], change["lesson"]
        if original["date"] == key:
            slot = (original["room"], original["time"], original["end"])
            if slot in activities:
                activities.remove(slot)
        if lesson["date"] == key and not lesson.get("cancelled"):
            activities.append((lesson["room"], lesson["time"], lesson["end"]))
    return activities


def _find_lesson(lesson_id):
    try:
        original_day = date.fromisoformat(lesson_id[:10])
    except ValueError:
        fail("Занятие не найдено", 404)
    if SEMESTER_START <= original_day <= SEMESTER_END:
        for lesson in base_lessons(original_day):
            if lesson["id"] == lesson_id:
                return lesson
    fail("Занятие не найдено", 404)


def _slot(lesson):
    return {field: lesson[field] for field in ("date", "time", "end", "room")}


def _minutes(value):
    hours, minutes = map(int, value.split(":"))
    return hours * 60 + minutes


def _intersects(time, end, other_time, other_end):
    return time < other_end and end > other_time


def _reschedule(con, original, current, data, changes, revision):
    room = ROOMS.get(data.room)
    if not data.date or not data.time or not room or room["kind"] != "Аудитория":
        fail("Укажите дату, время и учебную аудиторию")
    if not SEMESTER_START <= data.date <= SEMESTER_END:
        fail("Выберите дату в пределах учебного семестра")
    start = _minutes(data.time)
    end_minutes = start + _minutes(original["end"]) - _minutes(original["time"])
    if start < 540 or end_minutes > 1320:
        fail("Занятие должно проходить в пределах 09:00–22:00")
    end = f"{end_minutes // 60:02d}:{end_minutes % 60:02d}"
    day = data.date.isoformat()
    if (day, data.time, data.room) == (current["date"], current["time"], current["room"]):
        fail("Укажите другое время, дату или аудиторию")

    for lesson in effective_lessons(data.date, changes):
        if lesson["id"] == original["id"] or lesson.get("cancelled") or not _intersects(data.time, end, lesson["time"], lesson["end"]):
            continue
        if data.room == lesson["room"]:
            fail("В аудитории уже проходит занятие", 409)
        if current["group"] == lesson["group"]:
            fail("У группы уже есть занятие в это время", 409)
        if current["teacher"] == lesson["teacher"]:
            fail("У преподавателя уже есть занятие в это время", 409)

    occupancy = effective_activities(con, data.date, changes)
    if day == current["date"]:
        old_slot = (current["room"], current["time"], current["end"])
        if old_slot in occupancy:
            occupancy.remove(old_slot)
    if any(code == data.room and _intersects(data.time, end, a, b) for code, a, b in occupancy):
        fail("Аудитория занята", 409)
    if any(
        record["kind"] == "booking"
        and record["status"] == "approved"
        and record.get("short") == data.room
        and record.get("date") == day
        and _intersects(data.time, end, record["time"], record["end"])
        for record in records(con)
    ):
        fail("Аудитория уже забронирована", 409)
    group_size = sum(p["role"] == "student" and p["unit"] == current["group"] for p in PEOPLE.values())
    if group_size > room["capacity"]:
        fail("В аудитории недостаточно мест для группы", 409)
    return dict(
        current, date=day, time=data.time, end=end, room=data.room,
        building=room["building"], floor=room["floor"], revision=revision,
        changed=True, previous=_slot(current), changeReason=data.body,
    )


def apply_lesson_action(user, action, data):
    if PEOPLE[user]["role"] not in {"teacher", "office"}:
        fail("Действие доступно преподавателю или деканату", 403)
    original = _find_lesson(data.lessonId)
    if not can_manage(user, original):
        fail("Это занятие ведёт другой преподаватель", 403)
    payload = json.dumps([action, data.model_dump(mode="json")], sort_keys=True, ensure_ascii=False)
    request_id = str(data.requestId)
    with connect(True) as con:
        previous = con.execute(
            "SELECT payload,response FROM lesson_actions WHERE actor=? AND request_id=?",
            (user, request_id),
        ).fetchone()
        if previous:
            if previous["payload"] != payload:
                fail("Этот идентификатор уже использован для другого действия", 409)
            return json.loads(previous["response"]), []

        changes = lesson_changes(con)
        current = changes.get(original["id"], {}).get("lesson", original)
        if current.get("cancelled"):
            fail("Занятие уже отменено", 409)
        if data.revision is not None and data.revision != current.get("revision", 0):
            fail("Расписание изменилось. Откройте занятие заново", 409)
        revision = schedule_revision(con)
        if action == "reschedule":
            revision += 1
            updated = _reschedule(con, original, current, data, changes, revision)
            title = f"Перенос · {current['name']}"
            body = f"Было: {_description(current)}\nСтало: {_description(updated)}\n\n{data.body}"
        elif action == "cancel":
            revision += 1
            updated = dict(current, cancelled=True, revision=revision, changeReason=data.body)
            title = f"Отмена · {current['name']}"
            body = f"{_description(current)}\n\n{data.body}"
        else:
            updated = current
            title = f"Домашнее задание · {current['name']}"
            body = f"{PEOPLE[user]['name']} · группа {current['group']}\n\n{data.body}"

        if action != "homework":
            con.execute(
                """INSERT INTO lesson_overrides (lesson_id, revision, original, updated) VALUES (?, ?, ?, ?)
                   ON CONFLICT(lesson_id) DO UPDATE SET revision=excluded.revision, updated=excluded.updated""",
                (original["id"], revision, json.dumps(_slot(original), ensure_ascii=False), json.dumps(updated, ensure_ascii=False)),
            )
        recipients = {
            key for key, person in PEOPLE.items()
            if person["role"] == "student" and person["unit"] == current["group"]
        }
        if action != "homework":
            recipients.update(key for key, person in PEOPLE.items() if person["role"] == "teacher" and person["name"] == current["teacher"])
        recipients.discard(user)
        note_ids = [
            note(con, recipient, title, body, 2 if action == "homework" else 4, "lesson:" + original["id"])
            for recipient in sorted(recipients)
        ]
        response = {"lesson": dict(updated, canManage=True), "recipients": len(recipients), "revision": revision}
        con.execute(
            "INSERT INTO lesson_actions VALUES (?, ?, ?, ?, ?)",
            (user, request_id, payload, json.dumps(response, ensure_ascii=False), now()),
        )
    return response, note_ids


def _description(lesson):
    day = date.fromisoformat(lesson["date"]).strftime("%d.%m.%Y")
    return f"{day}, {lesson['time']}–{lesson['end']}, {lesson['room']}"
