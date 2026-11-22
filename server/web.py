"""Serve the production Vite build and the campus API from one origin."""

from pathlib import Path

from fastapi import HTTPException
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StaticHTTPException

from .main import app

DIST = Path(__file__).resolve().parent.parent / "client" / "dist"


class CampusFrontend(StaticFiles):
    async def get_response(self, path, scope):
        try:
            response = await super().get_response(path, scope)
        except StaticHTTPException as error:
            if error.status_code != 404:
                raise
        else:
            if response.status_code != 404:
                if path.startswith("assets/"):
                    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
                elif path in {".", "index.html"}:
                    response.headers["Cache-Control"] = "no-cache"
                return response

        headers = dict(scope["headers"])
        is_navigation = b"text/html" in headers.get(b"accept", b"")
        first_segment = path.split("/", 1)[0]
        reserved = {"api", "assets", "docs", "health", "models", "onnx", "licenses"}
        if is_navigation and first_segment not in reserved and not Path(path).suffix:
            return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})
        raise HTTPException(404, "Ресурс не найден")


# Route registration order keeps API endpoints, its docs and health independent.
app.mount("/", CampusFrontend(directory=DIST, html=True), name="campus-web")
