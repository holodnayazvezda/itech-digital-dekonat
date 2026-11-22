import asyncio
import io
import json
from uuid import uuid4

import pytest
from starlette.requests import ClientDisconnect

from server import irishka
from server.assistant_provider import OpenAICompatible, ProviderError
from server.tests.test_api import client, login


def sse(*deltas):
    events = [b": keep-alive\r\n\r\n"]
    for delta in deltas:
        packet = json.dumps({"choices": [{"index": 0, "delta": delta}]}, ensure_ascii=False)
        events.append(f"data: {packet}\r\n\r\n".encode())
    events.append(b"data: [DONE]\r\n\r\n")
    return io.BytesIO(b"".join(events))


def turn(text):
    return {"text": text, "request_id": str(uuid4()), "context_date": "2026-11-20"}


def test_stream_calls_scoped_tools_and_persists_authoritative_blocks(client, monkeypatch):
    provider = OpenAICompatible("https://api.z.ai/api/paas/v4", "glm-4.7", "dummy-key-for-test")

    class Proxy:
        rounds = 0

        def open(self, request, timeout):
            assert timeout > 0
            payload = json.loads(request.data)
            assert payload["stream"] is True and payload["max_tokens"] > 0
            assert request.get_header("Accept") == "text/event-stream"
            self.rounds += 1
            if self.rounds == 1:
                assert "campus_schedule" in {tool["function"]["name"] for tool in payload["tools"]}
                return sse(
                    {"reasoning_content": "hidden reasoning"},
                    {"tool_calls": [{"index": 0, "id": "campus-1", "function": {
                        "name": "campus_schedule", "arguments": '{"start":"2026-',
                    }}]},
                    {"tool_calls": [{"index": 0, "function": {"arguments": '11-20","end":"2026-11-20"}'}}]},
                )
            if self.rounds == 2:
                result = payload["messages"][-1]
                assert result["role"] == "tool" and result["tool_call_id"] == "campus-1"
                assert json.loads(result["content"])["lessons"]
                return sse({"content": "Вот **"}, {"content": "расписание**."})
            pytest.fail("Повтор не должен снова обращаться к модели")

    provider.http = Proxy()
    monkeypatch.setattr(irishka, "configured_provider", lambda: (provider, 3))
    auth, friend = login(client, "student"), login(client, "friend")
    chat = client.post("/api/campus/irishka/chats", headers=auth).json()
    base = f"/api/campus/irishka/chats/{chat['id']}"
    route = f"{base}/messages/stream"
    request = turn("Покажи расписание на сегодня")

    assert client.post(route, headers=friend, json=request).status_code == 404
    response = client.post(route, headers=auth, json=request)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/x-ndjson"
    assert "hidden reasoning" not in response.text
    events = list(map(json.loads, response.text.splitlines()))
    assert [event["type"] for event in events] == ["status", "status", "status", "delta", "delta", "blocks", "done"]
    assert [event["state"] for event in events if event["type"] == "status"] == ["thinking", "tools", "answering"]
    result = events[-1]["chat"]
    reply = result["messages"][-1]
    assert reply["mode"] == "model" and reply["text"] == "Вот **расписание**."
    block = reply["blocks"][0]
    assert block == events[-2]["blocks"][0]
    assert block["type"] == "schedule" and block["start"] == "2026-11-20" and block["lessons"]
    assert client.get(base, headers=auth).json() == result
    assert client.post(route, headers=auth, json=request).json() == {"type": "done", "chat": result}
    assert client.post(route, headers=auth, json={**request, "text": "Иной текст"}).status_code == 409


def test_stream_replaces_an_interrupted_draft(client, monkeypatch):
    class Unavailable:
        def stream(self, messages, tools, timeout):
            yield {"content": "Незаконченный ответ"}
            raise ProviderError("обрыв потока")

    monkeypatch.setattr(irishka, "configured_provider", lambda: (Unavailable(), 2))
    auth = login(client, "student")
    chat = client.post("/api/campus/irishka/chats", headers=auth).json()
    base = f"/api/campus/irishka/chats/{chat['id']}"
    response = client.post(f"{base}/messages/stream", headers=auth, json=turn("Найди Б-108"))
    events = list(map(json.loads, response.text.splitlines()))
    assert events[2]["text"] == "Незаконченный ответ"
    assert events[3]["type"] == "reset"
    reply = events[-1]["chat"]["messages"][-1]
    assert reply["mode"] == "navigator" and "Незаконченный ответ" not in reply["text"]
    assert client.get(base, headers=auth).json()["messages"][-1] == reply


def test_stream_keeps_finishing_after_disconnect():
    persisted = []
    sent = []

    def events():
        yield {"type": "status", "state": "thinking"}
        yield {"type": "delta", "text": "Ответ"}
        persisted.append(True)
        yield {"type": "done", "chat": {}}

    async def receive():
        pytest.fail("В ASGI 2.4 закрытие обнаруживает send")

    async def send(message):
        sent.append(message)
        if message["type"] == "http.response.body":
            raise OSError("closed")

    response = irishka.ChatStream(events())
    with pytest.raises(ClientDisconnect):
        asyncio.run(response({"type": "http", "asgi": {"spec_version": "2.4"}}, receive, send))
    assert persisted and len(sent) == 2


def test_stream_protects_a_credential_split_across_deltas():
    provider = OpenAICompatible("http://localhost:8001/v1", "test", "secret-example")

    class Proxy:
        def open(self, request, timeout):
            return sse({"content": "Тест secret-"}, {"content": "example конец"})

    provider.http = Proxy()
    stream = provider.stream([], [], 2)
    assert next(stream) == {"content": "Тест "}
    with pytest.raises(ProviderError):
        next(stream)


def test_navigator_fallback_creates_search_route_and_document_blocks(client, monkeypatch):
    monkeypatch.setattr(irishka, "configured_provider", lambda: None)
    auth = login(client, "student")
    chat = client.post("/api/campus/irishka/chats", headers=auth).json()
    endpoint = f"/api/campus/irishka/chats/{chat['id']}/messages/stream"

    def block(text):
        response = client.post(endpoint, headers=auth, json=turn(text))
        assert response.status_code == 200
        events = list(map(json.loads, response.text.splitlines()))
        message = events[-1]["chat"]["messages"][-1]
        assert message["mode"] == "navigator"
        return message["blocks"][0]

    people = block("Найди Машу")
    assert people["type"] == "search" and any("Мария" in match["name"] for match in people["matches"])
    room = block("Найди аудиторию Б-108")
    assert room["type"] == "place" and room["place"]["code"] == "Б-108"
    path = block("Построй маршрут от Б-108 до Б-412")
    assert path["type"] == "route" and path["from"]["id"] != path["to"]["id"]
    documents = block("Открой форму справки об обучении")
    assert documents["type"] == "documents" and documents["forms"][0]["name"] == "Справка об обучении"


def test_sports_chat_suggests_real_slots_books_explicitly_and_finds_own_route(client, monkeypatch):
    from server.sports import SPORTS

    monkeypatch.setattr(irishka, "configured_provider", lambda: None)
    monkeypatch.setitem(SPORTS["strength"], "capacity", 1)
    auth, friend, office = (login(client, name) for name in ("student", "friend", "office"))

    def assistant(headers, prompt):
        chat = client.post("/api/campus/irishka/chats", headers=headers).json()
        endpoint = f"/api/campus/irishka/chats/{chat['id']}/messages/stream"
        response = client.post(endpoint, headers=headers, json=turn(prompt))
        assert response.status_code == 200
        return json.loads(response.text.splitlines()[-1])["chat"]["messages"][-1]

    state = "/api/campus/state"
    before = client.get(state, headers=auth).json()["records"]
    offer = assistant(auth, "Запиши меня на силовую тренировку 2026-11-23")
    assert client.get(state, headers=auth).json()["records"] == before
    block = offer["blocks"][0]
    assert block["type"] == "sports" and len(block["sessions"]) == 2 and not block["upcoming"]
    slot = block["sessions"][0]
    assert (slot["name"], slot["venue"], slot["date"], slot["time"], slot["available"]) == (
        "Силовые тренировки", "Тренажёрный зал", "2026-11-23", "09:00", 1,
    )
    selection = {key: slot[key] for key in ("sport", "short", "date", "time", "end")}
    enrolled = client.post("/api/campus/request", headers=auth, json={"kind": "booking", **selection})
    assert enrolled.is_success and enrolled.json()["record"]["status"] == "pending"
    own = enrolled.json()["record"]
    assert client.post("/api/campus/request", headers=auth, json={"kind": "booking", **selection}).status_code == 409

    current = assistant(auth, "Покажи мои тренировки")["blocks"][0]
    assert [session["id"] for session in current["upcoming"]] == [own["id"]]
    assert current["upcoming"][0]["status"] == "pending"
    assert not assistant(friend, "Покажи мои тренировки")["blocks"][0]["upcoming"]
    routable = assistant(auth, "Построй маршрут на мою тренировку")
    assert "ждёт подтверждения" in routable["text"]
    assert routable["blocks"][0]["type"] == "route" and routable["blocks"][0]["to"]["code"] == "Н-101"
    assert not assistant(friend, "Построй маршрут на мою тренировку")["blocks"]

    assert client.post("/api/campus/decision", headers=office, json={"id": own["id"], "status": "approved"}).is_success
    available = assistant(friend, "Хочу на силовую тренировку 2026-11-23")["blocks"][0]["sessions"]
    assert [session["time"] for session in available] == ["11:00"]


def test_sport_tool_builds_card_with_the_model_and_limits_account_scope(client, monkeypatch):
    class Provider:
        def stream(self, messages, tools, timeout):
            names = {tool["function"]["name"] for tool in tools}
            assert "campus_sports" in names
            assert not any("book" in name or "enroll" in name for name in names)
            if messages[-1]["role"] != "tool":
                yield {"tool_calls": [{"id": "sports-1", "function": {
                    "name": "campus_sports", "arguments": '{"sport":"футбол","scope":"available"}',
                }}]}
            else:
                slots = json.loads(messages[-1]["content"])["sessions"]
                assert slots and all(slot["sport"] == "football" for slot in slots)
                yield {"content": "Выберите время."}

    monkeypatch.setattr(irishka, "configured_provider", lambda: (Provider(), 2))
    auth = login(client, "student")
    chat = client.post("/api/campus/irishka/chats", headers=auth).json()
    endpoint = f"/api/campus/irishka/chats/{chat['id']}/messages/stream"
    response = client.post(endpoint, headers=auth, json=turn("Хочу на футбол"))
    reply = json.loads(response.text.splitlines()[-1])["chat"]["messages"][-1]
    assert reply["mode"] == "model" and reply["blocks"][0]["type"] == "sports"


def test_following_a_subject_lookup_answers_who_teaches_and_puts_card_after_text(client, monkeypatch):
    monkeypatch.setattr(irishka, "configured_provider", lambda: None)
    auth = login(client, "student")
    chat = client.post("/api/campus/irishka/chats", headers=auth).json()
    base = f"/api/campus/irishka/chats/{chat['id']}"

    def send(prompt):
        response = client.post(f"{base}/messages/stream", headers=auth, json=turn(prompt))
        assert response.is_success, response.text
        return list(map(json.loads, response.text.splitlines()))

    prior = send("Найди предмет статистику")
    assert prior[-2]["blocks"][0]["matches"][0]["name"] == "Статистика"
    def unexpected_provider():
        pytest.fail("Для вопроса о преподавателе есть точные данные расписания")

    monkeypatch.setattr(irishka, "configured_provider", unexpected_provider)
    for prompt in (
        "Кто её ведёт?", "Кто ведёт статистику?", "Кто преподаватель по статистике 23 ноября?",
        "Кто ведёт статистику в понедельник?",
    ):
        events = send(prompt)
        kinds = [event["type"] for event in events]
        assert kinds.count("blocks") == 1 and kinds[-3:] == ["delta", "blocks", "done"]
        reply = events[-1]["chat"]["messages"][-1]
        assert reply["mode"] == "navigator"
        assert "**Лесова Вера Андреевна**" in reply["text"] and "**Б-205**" in reply["text"]
        assert "23 ноября" in reply["text"]
        match = reply["blocks"][0]["matches"][0]
        assert match["lessonId"] == "2026-11-23-stats"
        assert match["teachers"] == [{"name": "Лесова Вера Андреевна", "id": "teacher"}]
    missed = send("Кто ведёт статистику 2026-11-22?")[-1]["chat"]["messages"][-1]
    assert "На выбранную дату" in missed["text"] and not missed["blocks"]
    assert client.get(base, headers=auth).json()["messages"][-1] == missed
    monkeypatch.setattr(irishka, "configured_provider", lambda: None)
    person = send("Найди преподавателя Лесову")[-1]["chat"]["messages"][-1]
    assert any(match["id"] == "teacher" for match in person["blocks"][0]["matches"])


def test_model_receives_authoritative_teacher_before_streaming_an_explanation(client, monkeypatch):
    class Provider:
        def stream(self, messages, tools, timeout):
            if messages[-1]["role"] != "tool":
                assert "кто ведёт предмет" in messages[0]["content"]
                yield {"tool_calls": [{"id": "subject-1", "function": {
                    "name": "campus_search", "arguments": '{"category":"subjects","query":"статистику"}',
                }}]}
                return
            found = json.loads(messages[-1]["content"])["matches"][0]
            assert found["teachers"][0]["name"] == "Лесова Вера Андреевна"
            assert found["room"] == "Б-205"
            yield {"content": "Статистику ведёт "}
            yield {"content": "**Лесова Вера Андреевна**."}

    monkeypatch.setattr(irishka, "configured_provider", lambda: (Provider(), 2))
    auth = login(client, "student")
    chat = client.post("/api/campus/irishka/chats", headers=auth).json()
    endpoint = f"/api/campus/irishka/chats/{chat['id']}/messages/stream"
    response = client.post(endpoint, headers=auth, json=turn("Уточни, пожалуйста, имя преподавателя статистики."))
    events = list(map(json.loads, response.text.splitlines()))
    assert [event["type"] for event in events][-4:] == ["delta", "delta", "blocks", "done"]
    reply = events[-1]["chat"]["messages"][-1]
    assert reply["mode"] == "model" and "Лесова Вера Андреевна" in reply["text"]
    assert reply["blocks"] == events[-2]["blocks"]
