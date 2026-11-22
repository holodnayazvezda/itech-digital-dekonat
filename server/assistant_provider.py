"""Configurable model transport for Tinki. Credentials live on the server."""
import json
import os
import time
from http.client import HTTPException as HTTPProtocolError
from pathlib import Path
from threading import BoundedSemaphore
from typing import Protocol
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


MAX_RESPONSE_BYTES = 262144


class ProviderError(Exception):
    pass


class ModelTransport(Protocol):
    def complete(self, messages: list[dict], tools: list[dict], timeout: float) -> dict: ...


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class OpenAICompatible:
    def __init__(self, base_url, model, token):
        url = urlsplit(base_url)
        if (not url.hostname or url.username or url.password or url.query or url.fragment
            or url.scheme not in {"https", "http"}
            or (url.scheme == "http" and url.hostname not in {"localhost", "127.0.0.1", "::1"})
            or not model or not token or any(c in token for c in "\r\n")):
            raise ProviderError("Некорректная конфигурация провайдера Тинки")
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.model, self._token = model, token
        self.max_tokens_field = "max_tokens" if url.hostname == "api.z.ai" else "max_completion_tokens"
        self.http = build_opener(_NoRedirect())

    def _request(self, messages, tools, stream):
        payload = {"model": self.model, "messages": messages, "stream": stream, self.max_tokens_field: 1000}
        if tools:
            payload["tools"] = tools
        return Request(self.url, data=json.dumps(payload, ensure_ascii=False).encode(), headers={
            "Authorization": f"Bearer {self._token}", "Content-Type": "application/json",
            "Accept": "text/event-stream" if stream else "application/json",
        }, method="POST")

    def complete(self, messages, tools, timeout):
        try:
            with self.http.open(self._request(messages, tools, False), timeout=timeout) as response:
                content = response.read(MAX_RESPONSE_BYTES + 1)
            if len(content) > MAX_RESPONSE_BYTES:
                raise ProviderError("Ответ провайдера слишком большой")
            if self._token in content.decode("utf-8"):
                raise ProviderError("Некорректный ответ провайдера")
            message = json.loads(content)["choices"][0]["message"]
            if not isinstance(message, dict):
                raise ProviderError("Некорректный ответ провайдера")
            return message
        except (OSError, HTTPProtocolError, ValueError, KeyError, TypeError, IndexError, RecursionError) as error:
            raise ProviderError("Провайдер Тинки недоступен") from error

    def stream(self, messages, tools, timeout):
        deadline = time.monotonic() + timeout
        pending = ""
        try:
            with self.http.open(self._request(messages, tools, True), timeout=timeout) as response:
                for payload in _event_data(response, deadline):
                    if self._token in payload:
                        raise ProviderError("Некорректный ответ провайдера")
                    packet = json.loads(payload)
                    if "error" in packet:
                        raise ProviderError("Провайдер Тинки недоступен")
                    choices = packet.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    if delta.get("tool_calls"):
                        yield {"tool_calls": delta["tool_calls"]}
                    if isinstance(delta.get("content"), str) and delta["content"]:
                        pending += delta["content"]
                        if self._token in pending:
                            raise ProviderError("Некорректный ответ провайдера")
                        retained = next((
                            length for length in range(min(len(pending), len(self._token) - 1), 0, -1)
                            if pending.endswith(self._token[:length])
                        ), 0)
                        visible, pending = pending[:len(pending) - retained], pending[len(pending) - retained:]
                        if visible:
                            yield {"content": visible}
                if pending:
                    yield {"content": pending}
        except (OSError, HTTPProtocolError, ValueError, KeyError, TypeError, IndexError, AttributeError, RecursionError) as error:
            raise ProviderError("Провайдер Тинки недоступен") from error


def _event_data(response, deadline):
    size = 0
    data = []
    while not response.closed:
        remaining_time(deadline)
        line = response.readline(MAX_RESPONSE_BYTES + 1 - size)
        if not line:
            break
        size += len(line)
        if size > MAX_RESPONSE_BYTES:
            raise ProviderError("Ответ провайдера слишком большой")
        line = line.rstrip(b"\r\n")
        if line.startswith(b"data:"):
            data.append(line[5:].removeprefix(b" "))
        elif not line and data:
            packet = b"\n".join(data).decode("utf-8")
            if packet == "[DONE]":
                return
            yield packet
            data.clear()
    if data == [b"[DONE]"]:
        return
    raise ProviderError("Ответ провайдера оборвался")


def configured_provider():
    base_url = os.getenv("CAMPUS_AI_BASE_URL", "").strip()
    model = os.getenv("CAMPUS_AI_MODEL", "").strip()
    if not base_url and not model:
        return None
    keyfile = os.getenv("CAMPUS_AI_API_KEY_FILE", "")
    try:
        token = (Path(keyfile).read_text(encoding="utf-8") if keyfile else os.getenv("CAMPUS_AI_API_KEY", "")).strip()
        timeout = float(os.getenv("CAMPUS_AI_TIMEOUT", "12"))
        if not 1 <= timeout <= 45:
            raise ValueError()
        return OpenAICompatible(base_url, model, token), timeout
    except (OSError, ValueError) as error:
        raise ProviderError("Некорректная конфигурация провайдера Тинки") from error


# Protect the web worker pool when a configured upstream is slow.
MODEL_SLOTS = BoundedSemaphore(4)


def remaining_time(deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise ProviderError("Истекло время ответа Тинки")
    return remaining
