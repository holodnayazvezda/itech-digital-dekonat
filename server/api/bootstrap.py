from server.core.errors import ApplicationError

"""FastAPI HTTP interface for the isolated campus service."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from server.security import auth
from server.infrastructure.security import wifi as wifi_store
from server.core.limits import BodyLimit, LoginLimit
from server.infrastructure.persistence.store import ASSETS, initialize


@asynccontextmanager
async def lifespan(app):
    initialize()
    app.state.secret, app.state.accounts = auth.configuration()
    app.state.login_limit = LoginLimit()
    app.state.wifi_cipher = wifi_store.initialize()
    yield


tags = {
    "Сеанс": "Вход, проверка доступности и выход.",
    "Кабинет": "Личное состояние и услуги.",
    "Обращения": "Заявки, бронирование, решения и файлы.",
    "Связь": "Сообщения, письма и подписки Web Push.",
}
app = FastAPI(
    title="Цифровой деканат iTech · API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    description="Выполните **POST /api/campus/login**, скопируйте поле **token**, нажмите **Authorize** и вставьте JWT целиком. Префикс Bearer добавляется автоматически. Данные демонстрационные. Даты занятий и бронирования указаны по Москве, время событий журнала — Unix в миллисекундах.",
    openapi_tags=[{"name": k, "description": v} for k, v in tags.items()],
)
app.add_middleware(BodyLimit)
origins = [
    origin.strip() for origin in os.getenv("CAMPUS_CORS_ORIGINS", "").split(",") if origin.strip()
]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
app.mount(
    "/docs/assets",
    StaticFiles(directory=ASSETS.parent / "static" / "swagger"),
    name="swagger-assets",
)


@app.get("/docs", include_in_schema=False, response_class=HTMLResponse)
def swagger():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="Цифровой деканат iTech · Swagger UI",
        swagger_js_url="/docs/assets/swagger-ui-bundle.js",
        swagger_css_url="/docs/assets/swagger-ui.css",
        swagger_favicon_url="/docs/assets/favicon-32x32.png",
        swagger_ui_parameters={
            "displayRequestDuration": True,
            "defaultModelsExpandDepth": 0,
            "validatorUrl": None,
        },
    )


@app.exception_handler(ApplicationError)
@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def bad_input(request, exc):
    issue = exc.errors()[0]
    return JSONResponse(
        {"error": "Проверьте поле " + ".".join(map(str, issue["loc"][1:])) + " · " + issue["msg"]},
        422,
    )


@app.middleware("http")
async def cache_policy(request, call_next):
    if auth.PRODUCTION and request.url.path.startswith("/api/") and request.url.scheme != "https":
        return JSONResponse(
            {"error": "Для доступа к API требуется HTTPS"},
            400,
            headers={"Cache-Control": "no-store"},
        )
    response = await call_next(request)
    if auth.PRODUCTION and request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
    return response


from server.api.router import api, health_router

app.include_router(health_router)
app.include_router(api)
