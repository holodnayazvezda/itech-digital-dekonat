"""Role-scoped publication of schedule changes and homework."""

from uuid import uuid4

from server.tests.test_api import client, login

BASE = "/api/campus/"
LESSON = "2026-11-20-data"


def schedule(client, headers, day="2026-11-20"):
    response = client.get(f"{BASE}schedule?start={day}&end={day}", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def state(client, headers):
    return client.get(BASE + "state", headers=headers).json()


def post(client, headers, action, **fields):
    data = {"lessonId": LESSON, "requestId": str(uuid4()), "body": "Задание для группы", **fields}
    return client.post(BASE + "teaching/lesson/" + action, headers=headers, json=data)


def test_teacher_homework_visible_only_to_group_and_retry_is_idempotent(client):
    teacher, student, friend = (login(client, who) for who in ("teacher", "student", "friend"))
    original = next(row for row in schedule(client, teacher) if row["id"] == LESSON)
    assert original["canManage"] and original["revision"] == 0
    request_id = str(uuid4())
    response = post(client, teacher, "homework", requestId=request_id)
    assert response.status_code == 200 and response.json()["recipients"] > 0, response.text
    assert post(client, teacher, "homework", requestId=request_id).json() == response.json()
    assert post(client, teacher, "homework", requestId=request_id, body="Другое задание").status_code == 409
    matches = [row for row in state(client, student)["notes"] if row["ref"] == "lesson:" + LESSON]
    assert len(matches) == 1
    assert "Задание для группы" in matches[0]["body"]
    assert not any(row["ref"] == "lesson:" + LESSON for row in state(client, friend)["notes"])
    assert post(client, student, "cancel").status_code == 403
    other_lesson = next(row for row in schedule(client, student) if row["id"] != LESSON)
    assert post(client, teacher, "cancel", lessonId=other_lesson["id"]).status_code == 403


def test_reschedule_updates_teacher_students_and_room_booking(client):
    teacher, student = (login(client, who) for who in ("teacher", "student"))
    response = post(client, teacher, "reschedule", room="Н-205", date="2026-11-22", time="13:15", revision=0)
    assert response.status_code == 200, response.text
    lesson = response.json()["lesson"]
    assert lesson["changed"] and lesson["end"] == "14:45"
    assert lesson["previous"] == {"room": "Б-412", "date": "2026-11-20", "time": "10:00", "end": "11:30"}
    assert not any(row["id"] == LESSON for row in schedule(client, student))
    for headers in (teacher, student):
        moved = next(row for row in schedule(client, headers, "2026-11-22") if row["id"] == LESSON)
        assert (moved["room"], moved["time"], moved["end"]) == ("Н-205", "13:15", "14:45")
    new = client.post(BASE + "request", headers=student, json={
        "kind": "booking", "short": "Н-205", "date": "2026-11-22", "time": "13:30", "end": "14:00",
    })
    assert new.status_code == 409
    old = client.post(BASE + "request", headers=student, json={
        "kind": "booking", "short": "Б-412", "date": "2026-11-20", "time": "10:00", "end": "11:30",
    })
    assert old.status_code == 200, old.text
    assert post(client, teacher, "cancel", revision=0).status_code == 409
    notes = state(client, student)
    assert notes["scheduleRevision"] == 1 and len(notes["lessonChanges"]) == 1
    assert any("Было:" in note["body"] and "Стало:" in note["body"] for note in notes["notes"] if note["ref"] == "lesson:" + LESSON)


def test_office_cancel_and_conflicting_move(client):
    office, teacher, student = (login(client, who) for who in ("office", "teacher", "student"))
    assert len(schedule(client, office)) > len(schedule(client, teacher))
    conflict = post(client, teacher, "reschedule", room="Б-240", date="2026-11-20", time="16:00")
    assert conflict.status_code == 409, conflict.text
    result = post(client, office, "cancel", revision=0, body="Преподаватель отсутствует")
    assert result.status_code == 200, result.text
    assert result.json()["lesson"]["cancelled"]
    assert next(row for row in schedule(client, student) if row["id"] == LESSON)["cancelled"]
    assert any(note["title"].startswith("Отмена") and note["ref"] == "lesson:" + LESSON for note in state(client, teacher)["notes"])
    assert post(client, office, "cancel").status_code == 409
