from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from server.security import auth
from server.application import communication as communication_routes
from server import main
from server.infrastructure.persistence import store
from server.application import teaching


@pytest.fixture
def campus(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DB", tmp_path / "chat.sqlite")
    monkeypatch.setattr(auth, "PRODUCTION", False)
    monkeypatch.setenv("CAMPUS_MODE", "demo")
    monkeypatch.delenv("CAMPUS_JWT_SECRET", raising=False)
    monkeypatch.setitem(
        store.DATA, "teachingGroups", {"teacher": ["ТСТ-1"], "dean-data": ["ТСТ-2"]}
    )
    for user in ["student", "friend"]:
        monkeypatch.setitem(store.PEOPLE, user, {**store.PEOPLE[user], "unit": "ТСТ-1"})
    teaching.teaching_rosters.cache_clear()
    with TestClient(main.app) as client:
        yield client
    teaching.teaching_rosters.cache_clear()


def access(campus, owner):
    response = campus.post(
        "/api/campus/login", json={"role": owner, "password": "CampusDemo2026!"}
    ).json()
    return {"Authorization": "Bearer " + response["token"]}


def test_group_delivery_is_personal_atomic_and_retry_safe(campus):
    teacher = access(campus, "teacher")
    group = "ТСТ-1"
    body = "Перенос консультации на 15:00"
    payload = {"group": group, "body": body, "requestId": str(uuid4())}
    profile = "/api/campus/state"
    route = "/api/campus/group-message"
    assert campus.get(profile, headers=teacher).json()["teachingGroups"] == [
        {"group": group, "recipients": 2}
    ]

    def send():
        return campus.post(route, headers=teacher, json=payload)

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: send(), range(2)))
    assert [r.status_code for r in results] == [200, 200]
    assert (
        results[0].json()
        == results[1].json()
        == {"group": group, "recipients": 2, "requestId": payload["requestId"]}
    )
    assert (
        campus.post(route, headers=teacher, json={**payload, "body": "Другой текст"}).status_code
        == 409
    )
    assert (
        campus.post(
            route, headers=teacher, json={**payload, "group": "ТСТ-2", "requestId": str(uuid4())}
        ).status_code
        == 403
    )
    assert campus.post(route, headers=access(campus, "student"), json=payload).status_code == 403
    assert campus.post(route, headers=access(campus, "dean-data"), json=payload).status_code == 403

    sender_state = campus.get(profile, headers=teacher).json()
    assert sorted(m["recipient"] for m in sender_state["messages"] if m["body"] == body) == [
        "friend",
        "student",
    ]
    for recipient in ["friend", "student"]:
        state = campus.get(profile, headers=access(campus, recipient)).json()
        own_messages = [m for m in state["messages"] if m["body"] == body]
        assert len(own_messages) == 1 and own_messages[0]["recipient"] == recipient
        assert [n["ref"] for n in state["notes"] if n["body"] == body] == ["chat:teacher"]
    outside = campus.get(profile, headers=access(campus, "office")).json()
    assert all(m["body"] != body for m in outside["messages"])
    assert all(n["body"] != body for n in outside["notes"])

    reply = {"to": "teacher", "body": "Буду на консультации"}
    assert campus.post(
        "/api/campus/message", headers=access(campus, "student"), json=reply
    ).is_success
    other = campus.get(profile, headers=access(campus, "friend")).json()
    assert all(m["body"] != reply["body"] for m in other["messages"])


def test_delivery_rollback_on_partial_write(campus, monkeypatch):
    teacher = access(campus, "teacher")
    original = communication_routes.store_message

    def interrupt(con, sender, to, body, title):
        if to == "friend":
            raise RuntimeError("test failure during group delivery")
        return original(con, sender, to, body, title)

    monkeypatch.setattr(communication_routes, "store_message", interrupt)
    payload = {"group": "ТСТ-1", "body": "Разбор задачи", "requestId": str(uuid4())}
    with pytest.raises(RuntimeError, match="during group delivery"):
        campus.post("/api/campus/group-message", headers=teacher, json=payload)
    with store.connect() as con:
        assert (
            con.execute(
                "SELECT count(*) FROM messages WHERE body=?", (payload["body"],)
            ).fetchone()[0]
            == 0
        )
        assert (
            con.execute("SELECT count(*) FROM notes WHERE body=?", (payload["body"],)).fetchone()[0]
            == 0
        )
        assert con.execute("SELECT count(*) FROM group_dispatches").fetchone()[0] == 0
