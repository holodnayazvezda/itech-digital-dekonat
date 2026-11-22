import io
import json
from uuid import uuid4

import pytest

from server.assistant import conversations as irishka
from server.infrastructure.ai.provider import OpenAICompatible, ProviderError, configured_provider
from server.tests.test_api import client, login


def call(client, auth, method, params=None, **headers):
    return client.post(
        "/api/campus/mcp",
        headers={**auth, **headers},
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params or {},
        },
    )


def test_mcp_http_auth_negotiation_origin_and_scoped_tools(client, monkeypatch):
    student, office = login(client, "student"), login(client, "office")
    assert call(client, {}, "tools/list").status_code == 401
    assert call(client, student, "initialize", Origin="https://unknown.test").status_code == 403
    monkeypatch.setenv("CAMPUS_MCP_ORIGINS", "https://trusted.test")
    handshake = call(
        client,
        student,
        "initialize",
        {"protocolVersion": "2025-06-18"},
        Origin="https://trusted.test",
    )
    assert handshake.json()["result"]["protocolVersion"] == "2025-06-18"
    assert (
        call(client, student, "ping", **{"MCP-Protocol-Version": "2024-01-01"}).status_code == 400
    )
    assert client.get("/api/campus/mcp", headers=student).status_code == 405
    invalid_json = client.post("/api/campus/mcp", headers=student, content="{")
    assert invalid_json.status_code == 400 and invalid_json.json()["error"]["code"] == -32700
    invalid_request = client.post("/api/campus/mcp", headers=student, json=[])
    assert invalid_request.json()["error"]["code"] == -32600
    assert (
        client.post(
            "/api/campus/mcp",
            headers=student,
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
        ).status_code
        == 202
    )
    student_tools = call(client, student, "tools/list").json()["result"]["tools"]
    office_tools = call(client, office, "tools/list").json()["result"]["tools"]
    student_names = {tool["name"] for tool in student_tools}
    office_names = {tool["name"] for tool in office_tools}
    assert "campus_office_tasks" in office_names - student_names
    assert "campus_grades" in student_names - office_names
    assert all(tool["annotations"]["readOnlyHint"] for tool in student_tools + office_tools)
    denied = call(client, student, "tools/call", {"name": "campus_office_tasks"}).json()
    assert denied["result"]["isError"]
    denied = call(
        client, student, "tools/call", {"name": "campus_schedule", "arguments": {"owner": "friend"}}
    ).json()
    assert denied["result"]["isError"]


def test_campus_search_reuses_fuzzy_and_alias_rules(client):
    student = login(client, "student")
    found = call(
        client,
        student,
        "tools/call",
        {"name": "campus_search", "arguments": {"query": "Маша", "category": "people"}},
    )
    people = found.json()["result"]["structuredContent"]["matches"]
    assert people and all("Мария" in p["name"] for p in people)
    found = call(
        client,
        student,
        "tools/call",
        {"name": "campus_search", "arguments": {"query": "Б108", "category": "rooms"}},
    )
    assert found.json()["result"]["structuredContent"]["matches"][0]["id"] == "Б-108"


class ToolCallingProvider:
    def __init__(self):
        self.count = 0

    def complete(self, messages, tools, timeout):
        assert timeout > 0
        self.count += 1
        if self.count == 1:
            names = {tool["function"]["name"] for tool in tools}
            assert "campus_search" in names
            assert "campus_office_tasks" not in names
            return {
                "tool_calls": [
                    {
                        "type": "function",
                        "id": "read-1",
                        "function": {
                            "name": "campus_schedule",
                            "arguments": '{"start":"2026-11-20","end":"2026-11-20"}',
                        },
                    }
                ]
            }
        lesson_result = json.loads(messages[-1]["content"])
        assert lesson_result["lessons"]
        return {"content": "Расписание получено."}


def test_configured_chat_calls_real_scoped_tool_and_does_not_repeat(client, monkeypatch):
    provider = ToolCallingProvider()
    monkeypatch.setattr(irishka, "configured_provider", lambda: (provider, 2))
    auth = login(client, "student")
    base = "/api/campus/irishka/chats"
    chat = client.post(base, headers=auth).json()
    request = {"text": "Покажи пары", "request_id": str(uuid4()), "context_date": "2026-11-20"}
    endpoint = f"{base}/{chat['id']}/messages"
    response = client.post(endpoint, headers=auth, json=request)
    assert response.is_success, response.text
    last = response.json()["messages"][-1]
    assert last["mode"] == "model" and last["actions"][0]["action"] == "schedule"
    assert client.post(endpoint, headers=auth, json=request).json() == response.json()
    assert provider.count == 2


def test_teacher_homework_and_office_tasks_reach_only_authorized_mcp_clients(client):
    teacher, student, friend, office = (
        login(client, user) for user in ("teacher", "student", "friend", "office")
    )
    homework = "Прочитайте раздел о проверке гипотез"
    publication = client.post(
        "/api/campus/teaching/lesson/homework",
        headers=teacher,
        json={
            "lessonId": "2026-11-20-data",
            "requestId": str(uuid4()),
            "body": homework,
        },
    )
    assert publication.is_success, publication.text
    request = {"name": "campus_notifications", "arguments": {"category": "homework"}}
    student_notes = call(client, student, "tools/call", request).json()["result"][
        "structuredContent"
    ]["notes"]
    assert any(
        homework in note["body"] and note["ref"] == "lesson:2026-11-20-data"
        for note in student_notes
    )
    friend_notes = call(client, friend, "tools/call", request).json()["result"][
        "structuredContent"
    ]["notes"]
    assert not any(homework in note["body"] for note in friend_notes)

    saved = client.post(
        "/api/campus/office/tasks", headers=office, json={"title": "Проверить академический отпуск"}
    )
    assert saved.is_success, saved.text
    tasks = call(client, office, "tools/call", {"name": "campus_office_tasks"}).json()["result"][
        "structuredContent"
    ]["tasks"]
    assert saved.json()["id"] in {task["id"] for task in tasks}


def test_fallback_after_provider_timeout(client, monkeypatch):
    class Unavailable:
        def complete(self, messages, tools, timeout):
            raise ProviderError("unavailable")

    monkeypatch.setattr(irishka, "configured_provider", lambda: (Unavailable(), 2))
    auth = login(client, "student")
    base = "/api/campus/irishka/chats"
    chat = client.post(base, headers=auth).json()
    response = client.post(
        f"{base}/{chat['id']}/messages",
        headers=auth,
        json={
            "text": "Найди Б-108",
            "request_id": str(uuid4()),
            "context_date": "2026-11-20",
        },
    )
    last = response.json()["messages"][-1]
    assert last["mode"] == "navigator" and "Б-108" in last["text"]


def test_compatible_transport_and_key_file(monkeypatch, tmp_path):
    path = tmp_path / "key"
    path.write_text("local-only-demo-key\n")
    monkeypatch.setenv("CAMPUS_AI_API_KEY_FILE", str(path))
    monkeypatch.setenv("CAMPUS_AI_BASE_URL", "http://127.0.0.1:8643/v1")
    monkeypatch.setenv("CAMPUS_AI_MODEL", "test-model")
    provider, timeout = configured_provider()

    class Proxy:
        def open(self, request, timeout):
            assert request.full_url == "http://127.0.0.1:8643/v1/chat/completions"
            assert request.get_header("Authorization") == "Bearer local-only-demo-key"
            data = json.loads(request.data)
            assert data["model"] == "test-model" and not data["stream"]
            return io.BytesIO(b'{"choices":[{"message":{"content":"response"}}]}')

    provider.http = Proxy()
    assert (
        provider.complete([{"role": "user", "content": "hi"}], [], timeout)["content"] == "response"
    )
    with pytest.raises(ProviderError):
        OpenAICompatible("http://not-local.test/v1", "test-model", "fake")
