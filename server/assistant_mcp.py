"""Authenticated, stateless Streamable HTTP for Tinki's read tools."""
import json
import os
from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from .assistant_tools import CampusTools, ToolError
from .auth import User

PROTOCOL = "2025-11-25"
SUPPORTED = {"2025-03-26", "2025-06-18", PROTOCOL}


def _check_origin(request: Request):
    origin = request.headers.get("origin")
    if origin is None:
        return
    allowed = {item.strip().rstrip("/") for item in os.getenv("CAMPUS_MCP_ORIGINS", "").split(",") if item.strip()}
    if origin not in allowed:
        raise HTTPException(403, "Недоверенный Origin")


def _failure(request_id, code, message):
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


async def _read_message(request: Request):
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > 65536:
            return JSONResponse(_failure(None, -32600, "Request too large"), status_code=413)
        content.extend(chunk)
    try:
        return json.loads(content)
    except (ValueError, RecursionError):
        return JSONResponse(_failure(None, -32700, "Parse error"), status_code=400)


def dispatch(message, tools):
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return _failure(None, -32600, "Invalid Request")
    method = message.get("method")
    request_id = message.get("id")
    if "id" not in message and isinstance(method, str):
        return None
    if "id" in message and ("result" in message or "error" in message) and "method" not in message:
        return None
    if not isinstance(method, str) or type(request_id) not in (int, str):
        return _failure(None, -32600, "Invalid Request")
    params = message.get("params", {})
    if not isinstance(params, dict):
        return _failure(request_id, -32602, "Invalid params")
    if method == "initialize":
        requested = params.get("protocolVersion")
        version = requested if isinstance(requested, str) and requested in SUPPORTED else PROTOCOL
        result = {"protocolVersion": version, "serverInfo": {"name": "tinki-campus", "version": "1.1.0"},
                  "capabilities": {"tools": {"listChanged": False}}, "instructions": "Инструменты читают данные текущего кабинета. Изменения подтверждаются в приложении."}
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": tools.describe()}
    elif method == "tools/call":
        name, arguments = params.get("name"), params.get("arguments", {})
        if not isinstance(name, str) or not isinstance(arguments, dict):
            return _failure(request_id, -32602, "Invalid params")
        try:
            data, _ = tools.run(name, arguments)
            structured = jsonable_encoder(data)
            result = {"content": [{"type": "text", "text": json.dumps(structured, ensure_ascii=False)}],
                      "structuredContent": structured, "isError": False}
        except ToolError as error:
            result = {"isError": True, "content": [{"type": "text", "text": str(error)}]}
    else:
        return _failure(request_id, -32601, "Method not found")
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def create_router(schedule, office_tasks):
    router = APIRouter(prefix="/mcp", include_in_schema=False, dependencies=[Depends(_check_origin)])

    @router.post("")
    def rpc(request: Request, user: User, message: Annotated[object, Depends(_read_message)]):
        if isinstance(message, Response):
            return message
        if request.headers.get("mcp-protocol-version", "2025-03-26") not in SUPPORTED:
            raise HTTPException(400, "Версия MCP не поддерживается")
        tools = CampusTools(user, datetime.now(ZoneInfo("Europe/Moscow")).date(), schedule, office_tasks)
        result = dispatch(message, tools)
        if result is None:
            return Response(status_code=202)
        return JSONResponse(result)

    @router.get("")
    def get(user: User):
        # This endpoint only returns direct JSON responses to POST requests.
        return Response(status_code=405, headers={"Allow": "POST"})

    return router
