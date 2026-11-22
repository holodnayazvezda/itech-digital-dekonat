import io
import json
import os
import subprocess
import sys
from urllib.error import HTTPError

import pytest

from server.mcp import Bridge, tool_catalog
from server.tests.test_api import client, login


class APITransport:
    def __init__(self, client):
        self.client = client
        self.requests = []

    def open(self, request, timeout):
        self.requests.append(request)
        response = self.client.request(request.method, request.full_url.replace("http://localhost:8000", ""),
                                       content=request.data, headers=dict(request.header_items()))
        if response.status_code >= 400:
            raise HTTPError(request.full_url, response.status_code, "", response.headers, io.BytesIO(response.content))
        from email.message import Message
        headers = Message()
        headers["Content-Type"] = response.headers["content-type"]
        result = io.BytesIO(response.content)
        result.headers = headers
        return result


def bridge(client, role):
    token = login(client, role)["Authorization"][7:]
    result = Bridge("http://localhost:8000", token)
    result.http = APITransport(client)
    return result


def value(result):
    assert not result.get("isError"), result
    return json.loads(result["content"][0]["text"])


def test_all_api_operations_have_tools(client):
    tools = tool_catalog()
    paths = {entry[2] for entry in tools.values()}
    expected = set(client.get("/openapi.json").json()["paths"])
    assert paths == expected - {"/api/campus/login", "/api/campus/notes/events"}
    assert "campus_notifications" in tools
    operations = {(method.upper(), path) for path, methods in client.get("/openapi.json").json()["paths"].items() for method in methods}
    assert {(entry[1], entry[2]) for entry in tools.values()} == operations - {("POST", "/api/campus/login"), ("GET", "/api/campus/notes/events")}
    assert len(tools) == len(operations) - 1
    assert "$ref" not in json.dumps([entry[0] for entry in tools.values()])


def test_fixed_identity_and_api_permissions(client):
    student, friend, office = [bridge(client, role) for role in ("student", "friend", "office")]
    assert value(student.call("campus_state", {}))["owner"] == "student"
    results = value(student.call("campus_irishka_search", {"query": {"query": "Маша", "category": "people"}}))
    assert "Мария" in results["matches"][0]["name"]
    assert value(friend.call("campus_state", {}))["owner"] == "friend"
    assert value(student.call("campus_notifications", {})) == value(student.call("campus_state", {}))["notes"]
    with pytest.raises(ValueError):
        student.call("campus_state", {"token": office.token})
    with pytest.raises(ValueError):
        student.call("campus_login", {"body": {"role": "office"}})
    with pytest.raises(ValueError):
        student.call("campus_file_id", {"path": {"id": ".."}})
    data = {"kind": "document", "name": "Справка об обучении", "format": "Электронная", "values": {"destination": "Библиотека"}}
    record = value(student.call("campus_request", {"body": data}))
    args = {"body": {"id": record["id"], "status": "approved"}}
    assert friend.call("campus_decision", args)["isError"]
    value(office.call("campus_decision", args))
    file_args = {"path": {"id": record["id"]}}
    assert friend.call("campus_file_id", file_args)["isError"]
    pdf = student.call("campus_file_id", file_args)["content"][0]["resource"]
    assert pdf["mimeType"] == "application/pdf" and pdf["blob"].startswith("JVBER")
    value(student.call("campus_logout", {}))
    assert student.call("campus_state", {})["isError"]


def test_stdio_handshake_list_and_errors():
    messages = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-11-25"}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "unknown"}},
        {"jsonrpc": "2.0", "id": 4, "method": "ping"},
    ]
    result = subprocess.run([sys.executable, "-m", "server.mcp"], input="\n".join(map(json.dumps, messages)) + "\n", text=True, capture_output=True,
                            env={**os.environ, "CAMPUS_MCP_TOKEN": "test-token"}, check=True)
    replies = [json.loads(line) for line in result.stdout.splitlines()]
    assert len(replies) == 4
    assert replies[0]["result"]["protocolVersion"] == "2025-11-25"
    assert len(replies[1]["result"]["tools"]) == len(tool_catalog())
    assert replies[2]["result"]["isError"]
    assert replies[3]["result"] == {}


@pytest.mark.parametrize("origin", ["http://example.org", "https://user:pass@example.org", "https://example.org/api", "https://example.org?token=x"])
def test_unsafe_origin_rejected(origin):
    with pytest.raises(ValueError):
        Bridge(origin, "test-token")
