import json
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from server.security import auth
from server.assistant import conversations as irishka
from server.infrastructure.persistence import store
from server.main import app
from server.tests.test_api import client, login


def turn(text, request_id=None):
    return {"text": text, "request_id": str(request_id or uuid4()), "context_date": "2026-11-20"}


def test_chat_history_private_persistent_and_idempotent(client):
    student, friend = login(client, "student"), login(client, "friend")
    base = "/api/campus/irishka/chats"
    assert client.get(base).status_code == 401
    chat = client.post(base, headers=student, json={}).json()
    path = base + "/" + chat["id"]
    assert client.get(base, headers=friend).json() == []
    assert client.get(path, headers=friend).status_code == 404
    data = turn("Расписание на неделю")
    sent = client.post(path + "/messages", headers=student, json=data)
    assert sent.is_success, sent.text
    messages = sent.json()["messages"]
    assert [m["role"] for m in messages] == ["user", "assistant"]
    assert "20.11.2026" in messages[1]["text"]
    assert "Лесова" in messages[1]["text"] or "Расписание за" in messages[1]["text"]
    assert messages[1]["actions"][0]["action"] == "schedule"
    assert (
        client.post(path + "/messages", headers=student, json=data).json()["messages"] == messages
    )
    assert (
        client.post(
            path + "/messages", headers=student, json={**data, "text": "Подмена"}
        ).status_code
        == 409
    )
    assert client.get(path, headers=student).json()["messages"] == messages
    for endpoint, payload in [
        ("/messages", turn("Привет")),
        ("/rename", {"title": "Чужой"}),
        ("/delete", {}),
    ]:
        assert client.post(path + endpoint, headers=friend, json=payload).status_code == 404
    assert (
        client.post(path + "/rename", headers=student, json={"title": "Моя неделя"}).json()["title"]
        == "Моя неделя"
    )
    assert client.get(base, headers=student).json()[0]["title"] == "Моя неделя"
    assert client.post(path + "/delete", headers=student, json={}).is_success
    assert client.get(path, headers=student).status_code == 404
    assert client.get(base, headers=student).json() == []


def test_chat_validation_and_read_only_replies(client):
    h = login(client, "student")
    base = "/api/campus/irishka/chats"
    chat_id = client.post(base, headers=h, json={}).json()["id"]
    path = base + "/" + chat_id + "/messages"
    for text in ("", "   ", "x" * 4001):
        assert client.post(path, headers=h, json=turn(text)).status_code == 422
    assert (
        client.post(path, headers=h, json={**turn("Привет"), "owner": "friend"}).status_code == 422
    )
    before = client.get("/api/campus/state", headers=h).json()["records"]
    for text, action in [
        ("Как заказать справку?", "docs"),
        ("Забронировать помещение", "spaces"),
        ("Мои оценки", "study"),
        ("Покажи уведомления", "notices"),
        ("Мои заявки", "booked"),
        ("Что ты умеешь?", "schedule"),
    ]:
        response = client.post(path, headers=h, json=turn(text)).json()
        reply = response["messages"][-1]
        assert reply["mode"] == "navigator" and reply["text"]
        assert action in [a["action"] for a in reply["actions"]]
    assert client.get("/api/campus/state", headers=h).json()["records"] == before


CHATS_PATH = "/api/campus/irishka/chats"
ROUTE_PROMPT = "Подскажи, пожалуйста, как пройти от Б-108 до Б-412?"
ROUTE_TITLE = "Маршрут до Б-412"


def test_new_chat_gets_a_short_title_once_at_the_end_of_the_first_stream(client, monkeypatch):
    monkeypatch.setattr(irishka, "configured_provider", lambda: None)
    headers = login(client, "student")
    chat = client.post(CHATS_PATH, headers=headers, json={}).json()
    assert chat["title"] == "Новый чат"
    path = f"{CHATS_PATH}/{chat['id']}"
    first = turn(ROUTE_PROMPT)
    response = client.post(f"{path}/messages/stream", headers=headers, json=first)
    assert response.is_success, response.text
    done = json.loads(response.text.splitlines()[-1])
    assert done["type"] == "done" and done["chat"]["title"] == ROUTE_TITLE
    assert done["chat"]["messages"][0]["text"] == ROUTE_PROMPT
    assert client.get(CHATS_PATH, headers=headers).json()[0]["title"] == ROUTE_TITLE

    later = client.post(
        f"{path}/messages", headers=headers, json=turn("Расписание на неделю")
    ).json()
    assert later["title"] == ROUTE_TITLE
    assert client.post(f"{path}/messages", headers=headers, json=first).json() == later
    assert client.get(path, headers=headers).json() == later


@pytest.mark.parametrize("title", ["Моя первая встреча", "Новый чат"])
def test_early_manual_rename_is_kept_even_if_it_equals_default(client, monkeypatch, title):
    monkeypatch.setattr(irishka, "configured_provider", lambda: None)
    headers = login(client, "student")
    chat = client.post(CHATS_PATH, headers=headers, json={}).json()
    path = f"{CHATS_PATH}/{chat['id']}"
    assert (
        client.post(f"{path}/rename", headers=headers, json={"title": title}).json()["title"]
        == title
    )
    response = client.post(f"{path}/messages", headers=headers, json=turn(ROUTE_PROMPT))
    assert response.is_success, response.text
    assert response.json()["title"] == title
    assert client.get(path, headers=headers).json()["title"] == title


def test_concurrent_first_send_creates_one_turn_and_title(client, monkeypatch):
    both_model_calls = Barrier(2)

    class Provider:
        def complete(self, messages, tools, timeout):
            both_model_calls.wait(timeout=5)
            return {"content": "Вот ваше расписание."}

    monkeypatch.setattr(irishka, "configured_provider", lambda: (Provider(), 8))
    headers = login(client, "student")
    chat = client.post(CHATS_PATH, headers=headers, json={}).json()
    path = f"{CHATS_PATH}/{chat['id']}"
    request = turn("Покажи, пожалуйста, моё расписание на неделю")

    def send():
        response = client.post(f"{path}/messages", headers=headers, json=request)
        assert response.is_success, response.text
        return response.json()

    with ThreadPoolExecutor(max_workers=2) as jobs:
        first, second = [jobs.submit(send) for _ in range(2)]
        saved = first.result(timeout=10)
        assert saved == second.result(timeout=10)
    assert saved["title"] == "Расписание на неделю"
    assert [message["role"] for message in saved["messages"]] == ["user", "assistant"]
    assert client.get(path, headers=headers).json() == saved


def test_legacy_generated_title_upgrades_once_without_touching_manual_titles(tmp_path, monkeypatch):
    monkeypatch.setattr(irishka, "configured_provider", lambda: None)
    monkeypatch.setattr(auth, "PRODUCTION", False)
    monkeypatch.setenv("CAMPUS_MODE", "demo")
    monkeypatch.delenv("CAMPUS_DB_KEY_FILE", raising=False)
    monkeypatch.delenv("CAMPUS_JWT_SECRET", raising=False)
    monkeypatch.setattr(store, "DB", tmp_path / "legacy-chat.sqlite")
    store.database.prepare(store.DB)

    generated, manual, empty_manual, empty_default = [str(uuid4()) for _ in range(4)]
    older_prompt = ROUTE_PROMPT + " Напиши это коротко."
    saved_reply = json.dumps(
        {
            "text": "Подготовил маршрут.",
            "mode": "navigator",
            "actions": [{"label": "Навигатор", "action": "navigator"}],
            "blocks": [{"type": "route", "from": {"code": "Б-108"}, "to": {"code": "Б-412"}}],
        },
        ensure_ascii=False,
    )
    with closing(store.open_connection()) as con:
        con.executescript("""
            CREATE TABLE irishka_chats(id TEXT PRIMARY KEY, owner TEXT NOT NULL,
                title TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL);
            CREATE TABLE irishka_turns(id TEXT NOT NULL, chat_id TEXT NOT NULL, body TEXT NOT NULL,
                reply TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(chat_id, id));
        """)
        con.executemany(
            "INSERT INTO irishka_chats VALUES(?,?,?,?,?)",
            [
                (generated, "student", older_prompt[:60], 1, 10),
                (manual, "student", "Мой маршрут", 1, 11),
                (empty_manual, "student", "Семестр", 1, 12),
                (empty_default, "student", "Новый чат", 1, 13),
            ],
        )
        con.executemany(
            "INSERT INTO irishka_turns VALUES(?,?,?,?,?)",
            [
                (str(uuid4()), generated, older_prompt, saved_reply, 10),
                (str(uuid4()), manual, older_prompt, saved_reply, 11),
            ],
        )
        con.commit()

    with TestClient(app, base_url="https://testserver") as first_boot:
        headers = login(first_boot, "student")
        rows = first_boot.get(CHATS_PATH, headers=headers).json()
        assert [(row["id"], row["title"], row["updated"]) for row in rows] == [
            (empty_default, "Новый чат", 13),
            (empty_manual, "Семестр", 12),
            (manual, "Мой маршрут", 11),
            (generated, ROUTE_TITLE, 10),
        ]
        assert (
            first_boot.get(f"{CHATS_PATH}/{generated}", headers=headers).json()["messages"][0][
                "text"
            ]
            == older_prompt
        )
        assert (
            first_boot.post(
                f"{CHATS_PATH}/{empty_manual}/messages", headers=headers, json=turn(ROUTE_PROMPT)
            ).json()["title"]
            == "Семестр"
        )
        assert (
            first_boot.post(
                f"{CHATS_PATH}/{empty_default}/messages", headers=headers, json=turn(ROUTE_PROMPT)
            ).json()["title"]
            == ROUTE_TITLE
        )
        renamed = first_boot.post(
            f"{CHATS_PATH}/{generated}/rename", headers=headers, json={"title": older_prompt[:60]}
        )
        assert renamed.is_success and renamed.json()["title"] == older_prompt[:60]

    with TestClient(app, base_url="https://testserver") as second_boot:
        headers = login(second_boot, "student")
        rows = {
            row["id"]: row["title"] for row in second_boot.get(CHATS_PATH, headers=headers).json()
        }
        assert rows[generated] == older_prompt[:60]
        assert rows[manual] == "Мой маршрут" and rows[empty_manual] == "Семестр"
