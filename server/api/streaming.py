"""NDJSON transport; a disconnected client must not interrupt durable completion."""

import json
from anyio import CancelScope, to_thread
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from starlette.concurrency import iterate_in_threadpool
from server.core.errors import ApplicationError


class ChatStream(StreamingResponse):
    def __init__(self, events):
        self.events = events
        super().__init__(
            self.lines(),
            media_type="application/x-ndjson",
            headers={"Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no"},
        )

    async def lines(self):
        try:
            async for event in iterate_in_threadpool(self.events):
                yield json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n"
        except (HTTPException, ApplicationError) as error:
            yield json.dumps({"type": "error", "message": error.detail}, ensure_ascii=False) + "\n"

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            with CancelScope(shield=True):
                await to_thread.run_sync(self.finish)

    def finish(self):
        try:
            for _ in self.events:
                pass
        except (HTTPException, ApplicationError):
            return
