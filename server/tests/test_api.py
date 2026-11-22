import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from server.security import auth
from server import main
from server.infrastructure.persistence import store
from server.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DB", tmp_path / "test.sqlite")
    monkeypatch.setattr(auth, "PRODUCTION", False)
    monkeypatch.setenv("CAMPUS_MODE", "demo")
    monkeypatch.delenv("CAMPUS_JWT_SECRET", raising=False)
    with TestClient(app, base_url="https://testserver") as c:
        yield c


def login(c, name):
    return {
        "Authorization": "Bearer "
        + c.post("/api/campus/login", json={"role": name, "password": demo_password(name)}).json()[
            "token"
        ]
    }


def test_swagger_and_access_tokens(client):
    spec = client.get("/openapi.json").json()
    scheme = spec["components"]["securitySchemes"]["CampusJWT"]
    assert (scheme["type"], scheme["scheme"], scheme["bearerFormat"]) == (
        "http",
        "bearer",
        "JWT",
    )
    for path, methods in spec["paths"].items():
        for op in methods.values():
            assert op["tags"] and op["summary"] and op["description"] and op["responses"]["200"]
            if path not in {"/health", "/api/campus/login", "/api/campus/clock"}:
                assert op["security"] == [{"CampusJWT": []}]
                assert "401" in op["responses"]
    assert client.get("/docs/assets/swagger-ui-bundle.js").status_code == 200
    path = "/api/campus/state"
    assert client.get(path).status_code == 401
    h = login(client, "student")
    state = client.get(path, headers=h).json()
    assert state["owner"] == "student" and state["grades"][0]["points"]
    assert all(r["owner"] == "student" for r in state["records"])
    assert client.get(path, headers=login(client, "friend")).json()["grades"] != state["grades"]
    assert client.get(path, headers=login(client, "teacher")).json()["grades"] == []
    claims = jwt.decode(h["Authorization"][7:], options={"verify_signature": False})
    for patch, key in [
        ({"exp": int(time.time()) - 1}, app.state.secret),
        ({"aud": "other"}, app.state.secret),
        ({"sub": "office"}, "not-the-real-signing-key-at-least-32-bytes"),
    ]:
        invalid = jwt.encode(claims | patch, key, algorithm="HS256")
        assert client.get(path, headers={"Authorization": "Bearer " + invalid}).status_code == 401
    assert client.post("/api/campus/logout", headers=h).is_success
    assert client.get(path, headers=h).status_code == 401


def test_document_flow(client):
    s = login(client, "student")
    f = login(client, "friend")
    o = login(client, "office")

    def post(action, h, data):
        return client.post("/api/campus/" + action, headers=h, json=data)

    data = dict(
        kind="document",
        name="Справка об обучении",
        format="Электронная",
        values={"destination": "Библиотека"},
        attachment={
            "mime": "application/pdf",
            "name": "пример.pdf",
            "base64": "JVBERi0xLjQ=",
        },
    )
    id = post("request", s, data).json()["id"]
    assert post("decision", f, dict(id=id, status="approved")).status_code == 403
    assert client.get("/api/campus/attachment/" + id, headers=f).status_code == 404
    assert client.get("/api/campus/attachment/" + id, headers=o).content.startswith(b"%PDF-")
    assert post("clarify", o, dict(id=id, body="Уточните адрес")).is_success
    assert post("supplement", f, dict(id=id, body="Тест")).status_code == 403
    updated = {"name": "исправление.pdf", "mime": "application/pdf", "base64": "JVBERi1yZXZpc2Vk"}
    assert (
        post(
            "supplement",
            s,
            dict(id=id, body="Центральная библиотека", attachment=updated | {"base64": "ошибка"}),
        ).status_code
        == 400
    )
    assert post(
        "supplement", s, dict(id=id, body="Центральная библиотека", attachment=updated)
    ).is_success
    assert client.get("/api/campus/attachment/" + id, headers=o).content == b"%PDF-revised"
    assert post("decision", o, dict(id=id, status="approved")).is_success
    assert client.get("/api/campus/file/" + id, headers=s).content.startswith(b"%PDF-")
    assert client.get("/api/campus/file/" + id, headers=f).status_code == 404
    from server.application.requests import find

    with store.connect(True) as con:
        r = find(con, id)
        r["expires"] = store.now() - 1
        store.put(con, r)
    assert client.get("/api/campus/file/" + id, headers=s).status_code == 410


def test_request_retry_is_atomic_and_scoped_to_the_applicant(client):
    student = login(client, "student")
    other = login(client, "friend")
    data = dict(
        kind="document",
        name="Справка об обучении",
        format="Электронная",
        values={"destination": "Учебная библиотека"},
        requestId=str(uuid4()),
    )

    def submit(headers, body):
        return client.post("/api/campus/request", headers=headers, json=body)

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: submit(student, data), range(2)))
    assert all(response.is_success for response in responses)
    first, duplicate = (response.json()["id"] for response in responses)
    assert first == duplicate
    assert submit(student, data | {"comment": "Другая заявка"}).status_code == 409
    assert submit(other, data).json()["id"] != first
    with store.connect() as con:
        assert (
            con.execute(
                "SELECT count(*) FROM notes WHERE owner='office' AND ref=?", (first,)
            ).fetchone()[0]
            == 1
        )


def test_booking_contention(client):
    s, f, o = (login(client, id) for id in ("student", "friend", "office"))
    data = dict(kind="booking", date="2026-11-20", short="Б-108", time="12:00", end="16:00")
    ids = [client.post("/api/campus/request", headers=h, json=data).json()["id"] for h in [s, f]]

    def approve(id):
        return client.post(
            "/api/campus/decision", headers=o, json=dict(id=id, status="approved")
        ).status_code

    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(approve, ids)) == [200, 409]
    assert (
        client.post("/api/campus/request", headers=s, json=data | {"time": "11:30"}).status_code
        == 400
    )


def test_office_work_list_persists_and_keeps_requests_linked(client):
    student, teacher, office = (login(client, role) for role in ("student", "teacher", "office"))
    path = "/api/campus/office/tasks"
    for outsider in (student, teacher):
        assert client.get(path, headers=outsider).status_code == 403
        assert client.post(path, headers=outsider, json={"title": "Недоступно"}).status_code == 403
    assert client.post(path, headers=office, json={"title": "  "}).status_code == 422
    assert (
        client.post(
            path, headers=office, json={"title": "Проверить", "request_id": "missing"}
        ).status_code
        == 404
    )

    created = client.post(
        path,
        headers=office,
        json={
            "title": "Проверить справку",
            "body": "Сверить дату",
            "request_id": "paper",
            "due": "2026-11-23",
        },
    )
    assert created.status_code == 200
    task = created.json()
    assert task["request_id"] == "paper" and task["complete"] is False
    assert client.get(path, headers=office).json() == [task]
    status = f"{path}/{task['id']}/status"
    assert client.post(status, headers=teacher, json={"complete": True}).status_code == 403
    finished = client.post(status, headers=office, json={"complete": True}).json()
    assert finished["complete"] is True
    assert client.post(status, headers=office, json={"complete": True}).json() == finished
    assert client.post(status, headers=office, json={"complete": False}).json()["complete"] is False


def test_electives(client):
    def choose(h, course, previous):
        return client.post(
            "/api/campus/choose-elective",
            headers=h,
            json=dict(course=course, previous=previous, juryPreview=True),
        ).status_code

    s, f = login(client, "student"), login(client, "friend")
    assert choose(s, "research", "") == 200
    assert choose(s, "research", "") == 200
    assert choose(f, "research", "") == 409
    assert choose(s, "viz", "research") == 200
    assert choose(f, "research", "") == 200


def test_elective_dates_and_jury_switch(client, monkeypatch):
    from server.application import academics

    window = academics.elective_window
    assert window(date(2026, 11, 30))["phase"] == "upcoming"
    assert window(date(2026, 12, 1))["phase"] == "open"
    assert window(date(2026, 12, 7))["phase"] == "open"
    assert window(date(2026, 12, 8))["phase"] == "closed"
    headers = login(client, "student")
    url = "/api/campus/choose-elective"
    choice = {"course": "viz", "previous": ""}
    monkeypatch.setattr(academics, "elective_window", lambda: window(date(2026, 11, 20)))
    monkeypatch.setenv("CAMPUS_JURY_PREVIEW", "1")
    assert client.post(url, headers=headers, json=choice).status_code == 403
    monkeypatch.setenv("CAMPUS_JURY_PREVIEW", "0")
    assert client.post(url, headers=headers, json=choice | {"juryPreview": True}).status_code == 403
    monkeypatch.setattr(academics, "elective_window", lambda: window(date(2026, 12, 7)))
    assert client.post(url, headers=headers, json=choice).status_code == 200
    assert client.get("/api/campus/state", headers=headers).json()["electives"]["selected"] == "viz"


def test_password_mode(client, monkeypatch):
    monkeypatch.setattr(auth, "PRODUCTION", True)
    monkeypatch.setattr(
        app.state, "accounts", {"friend": auth.password_hash("demo-test-only-password")}
    )
    for role, password, status in [
        ("friend", None, 401),
        ("student", "demo-test-only-password", 401),
        ("friend", "wrong", 401),
        ("friend", "demo-test-only-password", 200),
    ]:
        assert (
            client.post("/api/campus/login", json={"role": role, "password": password}).status_code
            == status
        )


def test_week_and_role_specific_schedule(client):
    def get(who, query=""):
        return client.get("/api/campus/schedule" + query, headers=login(client, who)).json()

    week = get("student")
    assert {r["date"] for r in week} == {f"2026-11-{i}" for i in range(16, 22)}
    assert all(r["group"] == "АД-32" for r in get("friend"))
    assert {r["group"] for r in get("teacher")} == {"АД-21", "АД-32"}
    assert (
        client.post(
            "/api/campus/login", json={"role": "rector", "password": "invalid"}
        ).status_code
        == 401
    )
    assert {x["type"] for x in get("dean-data")} == {"Семинар", "Мероприятие"}
    assert any(r["type"] == "Экзамен" for r in get("student", "?start=2026-11-24&end=2026-11-24"))


def test_body_limit_covers_streams(client):
    def body():
        for _ in range(30):
            yield b"a" * 100000

    response = client.post(
        "/api/campus/login",
        content=body(),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert "error" in response.json()


def test_password_config_loads_generated_account(tmp_path, monkeypatch):
    import json

    monkeypatch.setattr(store, "DB", tmp_path / "production.sqlite")
    monkeypatch.setattr(auth, "PRODUCTION", True)
    monkeypatch.setenv("CAMPUS_MODE", "production")
    monkeypatch.setenv("CAMPUS_DEMO_DB", str(store.DB))
    monkeypatch.setenv("CAMPUS_JWT_SECRET", "a" * 48)
    db_key = tmp_path / "database.key"
    store.database.generate_key(db_key)
    monkeypatch.setenv("CAMPUS_DB_KEY_FILE", str(db_key))
    accounts = tmp_path / "accounts.json"
    accounts.write_text(json.dumps({"friend": auth.password_hash("fixture-password")}))
    monkeypatch.setenv("CAMPUS_ACCOUNTS_FILE", str(accounts))
    with TestClient(app, base_url="https://testserver") as c:
        assert (
            c.post(
                "/api/campus/login",
                json={"role": "friend", "password": "fixture-password"},
            ).status_code
            == 200
        )


def test_notification_delivery_and_account_read_state(client, monkeypatch):
    delivered = []

    def observe_delivery(note_id):
        with store.connect() as con:
            delivered.append(
                tuple(
                    con.execute(
                        "SELECT id,owner,title FROM notes WHERE id=?", (note_id,)
                    ).fetchone()
                )
            )

    monkeypatch.setattr(
        __import__("server.infrastructure.notifications.push", fromlist=["deliver"]),
        "deliver",
        observe_delivery,
    )
    student = login(client, "student")
    other_device = login(client, "student")
    other_user = login(client, "friend")
    office = login(client, "office")
    msg = dict(to="student", subject="Ответ деканата", body="Документ готов к выдаче.")
    assert client.post("/api/campus/letter", headers=office, json=msg).is_success

    def notes(headers):
        return client.get("/api/campus/state", headers=headers).json()["notes"]

    note = notes(student)[0]
    assert delivered == [(note["id"], "student", msg["subject"])]
    assert note["read"] is False
    path = f"/api/campus/notes/{note['id']}/read"
    assert client.post(path, headers=other_user).status_code == 404
    assert client.post(path, headers=student).is_success
    assert client.post(path, headers=other_device).is_success
    assert notes(other_device)[0]["read"] is True
    assert all(n["id"] != note["id"] for n in notes(other_user))


def test_clear_inbox_preserves_later_letters_and_other_owners(client):
    student, friend = login(client, "student"), login(client, "friend")
    with store.connect(True) as con:
        seen = store.note(con, "student", "Первое", "Текст")
        recent = store.note(con, "student", "Новое", "Текст")
        other = store.note(con, "friend", "Личное", "Текст")
    path = "/api/campus/notes/clear"
    assert client.post(path, headers=student, json={"through_id": other}).status_code == 404
    for _ in range(2):
        assert client.post(path, headers=student, json={"through_id": seen}).is_success
    state = "/api/campus/state"
    assert [n["id"] for n in client.get(state, headers=student).json()["notes"]] == [recent]
    assert other in [n["id"] for n in client.get(state, headers=friend).json()["notes"]]
    assert client.post(path, headers=student, json={"through_id": recent}).is_success
    assert client.post(path, headers=student, json={"through_id": seen}).is_success
    store.initialize()
    assert client.get(state, headers=student).json()["notes"] == []


def test_transfer_uses_normalized_program_for_checklist(client):
    student = login(client, "student")
    programs = store.DATA["transfers"]["student"]
    target = next(iter(programs))
    response = client.post(
        "/api/campus/request",
        headers=student,
        json={
            "kind": "document",
            "name": "Перевод на другую программу",
            "values": {
                "program": f"  {target} ",
                "reason": "Мой профиль",
                "email": "demo@example.org",
            },
        },
    )
    assert response.status_code == 200
    record = response.json()["record"]
    assert record["details"]["Новая программа"] == target
    assert record["requirements"] == programs[target]


def test_persisted_bookings_survive_directory_and_catalog_changes(client, monkeypatch):
    student, office = login(client, "student"), login(client, "office")
    booking = {
        "kind": "booking",
        "date": "2026-11-20",
        "short": "Б-108",
        "time": "20:00",
        "end": "21:00",
    }
    pending = client.post("/api/campus/request", headers=student, json=booking).json()["record"]
    with store.connect(True) as con:
        store.put(
            con,
            pending
            | {
                "id": "old-termed-user",
                "owner": "retired",
                "status": "approved",
                "time": "12:00",
                "end": "12:30",
            },
        )
    monkeypatch.setitem(
        store.DATA, "rooms", [r for r in store.DATA["rooms"] if r["short"] != booking["short"]]
    )
    response = client.post(
        "/api/campus/decision", headers=office, json={"id": pending["id"], "status": "approved"}
    )
    assert response.status_code == 409
    state = client.get("/api/campus/state", headers=student).json()
    assert state["reservations"][0]["by"] == "Занятое помещение"
    assert next(r for r in state["records"] if r["id"] == pending["id"])["status"] == "pending"


def test_residence_assignment_and_private_charges(client):
    path = "/api/campus/"
    student, friend, office = (login(client, user) for user in ("student", "friend", "office"))

    def account(headers):
        return client.get(path + "state", headers=headers).json()["housing"]

    assert sum(c["amount"] - c["paid"] for c in account(student)["charges"]) == 1400
    assert account(friend) is None and account(office) is None
    form = dict(
        kind="document",
        name="Заселение в общежитие",
        values={
            "residence": "Дом студентов · Парковый",
            "start": "2026-11-21",
            "phone": "+79990000000",
        },
    )
    assert client.post(path + "request", headers=student, json=form).status_code == 409
    record = client.post(path + "request", headers=friend, json=form).json()
    assert client.post(path + "request", headers=friend, json=form).status_code == 409
    assert client.post(
        path + "clarify", headers=office, json=dict(id=record["id"], body="Уточните дату")
    ).is_success
    assert client.post(path + "request", headers=friend, json=form).status_code == 409
    assert client.post(
        path + "supplement", headers=friend, json=dict(id=record["id"], body="21 ноября")
    ).is_success
    assert client.post(path + "request", headers=friend, json=form).status_code == 409
    assert client.post(
        path + "decision", headers=office, json=dict(id=record["id"], status="approved")
    ).is_success
    assert account(friend) == dict(
        building=form["values"]["residence"], room=None, start="2026-11-21", charges=[]
    )
    assert client.post(path + "request", headers=friend, json=form).status_code == 409


def test_production_transport_and_throttle(client, monkeypatch):
    from server.core.limits import LoginLimit

    monkeypatch.setattr(auth, "PRODUCTION", True)
    monkeypatch.setattr(app.state, "login_limit", LoginLimit(attempts=1))
    monkeypatch.setattr("server.core.limits.monotonic", lambda: 125)
    login_path = "/api/campus/login"
    data = {"role": "friend", "password": "fixture"}
    assert client.post("http://testserver" + login_path, json=data).status_code == 400
    assert client.post(login_path, json=data).status_code == 401
    limited = client.post(login_path, json=data)
    assert limited.status_code == 429 and int(limited.headers["Retry-After"]) == 55
    assert limited.headers["Strict-Transport-Security"].startswith("max-age=")


def test_demo_login_requires_password(client):
    for secret in (None, "", "incorrect"):
        response = client.post("/api/campus/login", json={"role": "student", "password": secret})
        assert response.status_code == 401
    assert client.post(
        "/api/campus/login", json={"role": "student", "password": "ArinaStudy2026!"}
    ).is_success


def test_server_clock_is_public_and_matches_state(client, monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo
    from server.core import clock

    instant = datetime(2026, 11, 23, 0, 1, tzinfo=ZoneInfo("Europe/Moscow"))
    monkeypatch.setattr(clock, "now", lambda: instant)
    expected = {"now": instant.isoformat(), "date": "2026-11-23", "timezone": "Europe/Moscow"}
    assert client.get("/api/campus/clock").json() == expected
    assert (
        client.get("/api/campus/state", headers=login(client, "student")).json()["clock"]
        == expected
    )
    assert client.get("/api/campus/clock").headers["cache-control"] == "no-store"


def demo_password(identity):
    import json
    from pathlib import Path
    accounts = json.loads((Path(__file__).parents[1] / "assets/demo-access.json").read_text())["accounts"]
    return next((a["password"] for a in accounts if a["id"] == identity), "invalid")


def test_demo_passwords_are_individual(client):
    identities = ["student", "friend", "teacher", "dean-data", "office"]
    passwords = [demo_password(identity) for identity in identities]
    assert len(set(passwords)) == len(identities)
    for index, identity in enumerate(identities):
        assert client.post("/api/campus/login", json={"role": identity, "password": passwords[index]}).status_code == 200
        assert client.post("/api/campus/login", json={"role": identity, "password": passwords[(index + 1) % len(passwords)]}).status_code == 401
