"""Enforce the JSON size limit for both known-length and chunked ASGI requests."""

from threading import Lock
from time import monotonic

from starlette.responses import JSONResponse


class BodyLimit:
    def __init__(self, app, limit=2_900_000):
        self.app = app
        self.limit = limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            chunk = await receive()
            if chunk["type"] == "http.disconnect":
                return
            body.extend(chunk.get("body", b""))
            if len(body) > self.limit:
                return await JSONResponse(
                    {"error": "Тело запроса превышает 2 900 000 байт"}, 413
                )(scope, receive, send)
            if not chunk.get("more_body"):
                break
        buffered = True

        async def replay():
            nonlocal buffered
            if buffered:
                buffered = False
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


class LoginLimit:
    """Fixed windows, bounded source table and process-local accounting."""

    def __init__(self, attempts=20, window=60, capacity=4096):
        self.attempts = attempts
        self.window = window
        self.capacity = capacity
        self.epoch = -1
        self.counts = {}
        self.lock = Lock()

    def retry_after(self, peer):
        now = int(monotonic())
        epoch = now // self.window
        with self.lock:
            if epoch != self.epoch:
                self.counts.clear()
                self.epoch = epoch
            count = self.counts.get(peer, 0)
            if count >= self.attempts or (count == 0 and len(self.counts) >= self.capacity):
                return self.window - now % self.window
            self.counts[peer] = count + 1
            return 0
