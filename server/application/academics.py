import os
from datetime import date, datetime
from zoneinfo import ZoneInfo
from server.security import auth
from server.contracts import models as m
from server.security.auth import User
from server.core.errors import fail
from server.infrastructure.persistence.store import DATA, PEOPLE, connect, note


def elective_window(today: date | None = None):
    opens, closes = date(2026, 12, 1), date(2026, 12, 7)
    today = today or datetime.now(ZoneInfo("Europe/Moscow")).date()
    phase = "upcoming" if today < opens else "closed" if today > closes else "open"
    return dict(
        opens=opens,
        closes=closes,
        phase=phase,
        juryAvailable=os.getenv("CAMPUS_JURY_PREVIEW", "0" if auth.PRODUCTION else "1") == "1",
    )


def elective_state(con, user):
    selected = con.execute(
        "SELECT course FROM elective_selections WHERE owner=?", (user,)
    ).fetchone()
    counts = dict(con.execute("SELECT course,count(*) FROM elective_selections GROUP BY course"))
    return dict(
        **elective_window(),
        selected=selected[0] if selected else "",
        remaining={
            e["id"]: e["availableAtOpening"] - counts.get(e["id"], 0) for e in DATA["electives"]
        },
    )


def choose_elective(data: m.ElectiveChoice, user: User):
    """Выбор доступен в период записи по Москве. Вне периода демонстрационный режим требует разрешённый juryPreview. Один выбор на студента. При конкуренции за последнее место или изменившемся выборе возвращает 409."""
    note_id = None
    if PEOPLE[user]["role"] != "student":
        fail("Только для студентов", 403)
    with connect(True) as con:
        current = elective_state(con, user)
        if current["phase"] != "open" and (not (current["juryAvailable"] and data.juryPreview)):
            fail("Сейчас выбор дисциплин закрыт", 403)
        if data.course not in current["remaining"]:
            fail("Выберите дисциплину")
        if current["selected"] != data.course:
            if current["selected"] != data.previous or current["remaining"][data.course] <= 0:
                fail("Выбор или число мест изменились", 409)
            con.execute(
                "INSERT OR REPLACE INTO elective_selections VALUES(?,?)", (user, data.course)
            )
            name = next((e["name"] for e in DATA["electives"] if e["id"] == data.course))
            note_id = note(
                con,
                user,
                "Дисциплина добавлена в учебный план",
                name + " · 4 семестр · 5 з. е.",
                2,
                "electives",
            )
            pass
    return note_id
