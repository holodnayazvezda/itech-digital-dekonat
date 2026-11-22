"""FastAPI HTTP interface for the isolated campus service."""

import os
import time
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import (
    APIRouter,
    BackgroundTasks,
    FastAPI,
    HTTPException,
    Query,
    Request,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import auth, push, clock
from . import models as m
from . import wifi as wifi_store
from .assistant_mcp import create_router as assistant_mcp_router
from .auth import Claims, User
from .communication_routes import router as communication_router
from .errors import error_responses, fail
from .housing import housing_account
from .irishka import create_router as irishka_router
from .limits import BodyLimit, LoginLimit
from .office_tasks import list_tasks as list_office_tasks
from .office_tasks import router as office_tasks_router
from .request_routes import router as request_router
from .store import ASSETS, DATA, PEOPLE, connect, initialize, note, records
from .teaching import (
    apply_lesson_action,
    lesson_changes,
    personal_schedule,
    schedule_revision,
    teaching_rosters,
)
from .uploads import decode_upload


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
    title="Атлас кампуса · API цифрового деканата",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    description="Выполните **POST /api/campus/login**, скопируйте поле **token**, нажмите **Authorize** и вставьте JWT целиком. Префикс Bearer добавляется автоматически. Данные демонстрационные. Даты занятий и бронирования указаны по Москве, время событий журнала — Unix в миллисекундах.",
    openapi_tags=[{"name": k, "description": v} for k, v in tags.items()],
)
app.add_middleware(BodyLimit)
origins = [
    origin.strip()
    for origin in os.getenv("CAMPUS_CORS_ORIGINS", "").split(",")
    if origin.strip()
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
        title="Атлас кампуса · Swagger UI",
        swagger_js_url="/docs/assets/swagger-ui-bundle.js",
        swagger_css_url="/docs/assets/swagger-ui.css",
        swagger_favicon_url="/docs/assets/favicon-32x32.png",
        swagger_ui_parameters={
            "displayRequestDuration": True,
            "defaultModelsExpandDepth": 0,
            "validatorUrl": None,
        },
    )


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse(
        {"error": exc.detail}, status_code=exc.status_code, headers=exc.headers
    )


@app.exception_handler(RequestValidationError)
async def bad_input(request, exc):
    issue = exc.errors()[0]
    return JSONResponse(
        {
            "error": "Проверьте поле "
            + ".".join(map(str, issue["loc"][1:]))
            + " · "
            + issue["msg"]
        },
        422,
    )


@app.middleware("http")
async def cache_policy(request, call_next):
    if auth.PRODUCTION and request.url.path.startswith("/api/") and request.url.scheme != "https":
        return JSONResponse({"error": "Для доступа к API требуется HTTPS"}, 400,
                            headers={"Cache-Control": "no-store"})
    response = await call_next(request)
    if auth.PRODUCTION and request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
    return response


api = APIRouter(prefix="/api/campus")


@app.get(
    "/health",
    tags=["Сеанс"],
    summary="Проверить готовность API и SQLite",
    response_model=m.Ok,
)
def health():
    """Проверяет доступность хранилища для чтения."""
    with connect() as con:
        con.execute("SELECT count(*) FROM settings").fetchone()
    return m.Ok()


@api.get("/clock", tags=["Сеанс"], summary="Получить текущую дату и время сервера", response_model=m.ServerClock)
def server_clock():
    """Единое время кабинета в часовом поясе Europe/Moscow. Доступно до входа."""
    return clock.snapshot()


@api.post(
    "/login",
    tags=["Сеанс"],
    summary="Получить JWT",
    response_model=m.Token,
    responses=error_responses(401, 422, 429, 413),
)
def login(data: m.Login, request: Request):
    """Передайте логин в поле role и пароль. В demo используются опубликованные тестовые доступы. Роль и доступ к данным определяются по идентификатору на сервере."""
    if auth.PRODUCTION:
        delay = request.app.state.login_limit.retry_after(request.client.host if request.client else "unknown")
        if delay:
            raise HTTPException(429, "Повторите вход позднее", headers={"Retry-After": str(delay)})
    return auth.issue(request.app, data)


@api.post(
    "/logout",
    tags=["Сеанс"],
    summary="Отозвать текущий JWT",
    response_model=m.Ok,
    responses=error_responses(401, 413),
)
def logout(claims: Claims):
    """Завершает только текущую сессию. Следующий запрос с тем же JWT получит 401."""
    with connect(True) as con:
        con.execute("DELETE FROM revoked WHERE exp<=?", (int(time.time()),))
        con.execute(
            "INSERT OR IGNORE INTO revoked VALUES(?,?)", (claims["jti"], claims["exp"])
        )
    return m.Ok()


def elective_window(today: date | None = None):
    opens, closes = date(2026, 12, 1), date(2026, 12, 7)
    today = today or datetime.now(ZoneInfo("Europe/Moscow")).date()
    phase = "upcoming" if today < opens else "closed" if today > closes else "open"
    return dict(
        opens=opens,
        closes=closes,
        phase=phase,
        juryAvailable=os.getenv("CAMPUS_JURY_PREVIEW", "0" if auth.PRODUCTION else "1")
        == "1",
    )


def elective_state(con, user):
    selected = con.execute(
        "SELECT course FROM elective_selections WHERE owner=?", (user,)
    ).fetchone()
    counts = dict(
        con.execute("SELECT course,count(*) FROM elective_selections GROUP BY course")
    )
    return dict(
        **elective_window(),
        selected=selected[0] if selected else "",
        remaining={
            e["id"]: e["availableAtOpening"] - counts.get(e["id"], 0)
            for e in DATA["electives"]
        },
    )


@api.get(
    "/state",
    tags=["Кабинет"],
    summary="Открыть личный кабинет",
    response_model=m.State,
    response_model_exclude_unset=True,
    responses=error_responses(401),
)
def state(user: User, request: Request):
    """Возвращает свои заявки, выплаты, сведения о проживании и оплате общежития, сообщения и уведомления. Деканат видит общую очередь заявок. Подтверждённая занятость помещений и аватары доступны участникам."""
    with connect() as con:
        all_records = records(con)
        return dict(
            clock=clock.snapshot(),
            owner=user,
            scheduleRevision=schedule_revision(con),
            lessonChanges=[
                {**change, "lesson": {**change["lesson"], "changeReason": None}}
                for change in lesson_changes(con).values()
            ],
            grades=DATA["grades"].get(user, []),
            role=PEOPLE[user]["role"],
            records=[r for r in all_records if user == "office" or r["owner"] == user],
            notes=[
                dict(r)
                for r in con.execute(
                    """SELECT n.*, r.note_id IS NOT NULL AS read FROM inbox_notes n
                       LEFT JOIN note_reads r ON r.note_id=n.id
                       WHERE n.owner=? ORDER BY n.id DESC""", (user,)
                )
            ],
            teachingGroups=[
                {"group": group, "recipients": len(members)}
                for group, members in sorted(teaching_rosters(user).items())
            ],
            messages=[
                dict(r)
                for r in con.execute(
                    "SELECT * FROM messages WHERE recipient=? OR sender=? ORDER BY id",
                    (user, user),
                )
                if r["sender"] in PEOPLE and r["recipient"] in PEOPLE
            ],
            reservations=[
                dict(
                    short=r["short"],
                    date=r["date"],
                    time=r["time"],
                    end=r["end"],
                    sport=r.get("sport"),
                    by="Занятое место"
                    if r.get("sport") or r["short"] == DATA["gym"]["short"]
                    else PEOPLE.get(r["owner"], {}).get("name", "Занятое помещение"),
                )
                for r in all_records
                if r["kind"] == "booking" and r["status"] == "approved"
            ],
            wifi=wifi_store.read(con, user, request.app.state.wifi_cipher),
            housing=housing_account(user, all_records),
            payments=DATA["payments"].get(user, {}),
            avatars=dict(con.execute("SELECT owner,data FROM avatars")),
            electives=elective_state(con, user)
            if PEOPLE[user]["role"] == "student"
            else None,
        )


@api.get(
    "/schedule",
    tags=["Кабинет"],
    summary="Получить личное расписание за период",
    response_model=list[m.Lesson],
    responses=error_responses(400, 401, 422),
)
def schedule(
    user: User,
    start: Annotated[date, Query(description="Первая дата включительно")] = date(
        2026, 11, 16
    ),
    end: Annotated[
        date | None,
        Query(description="Последняя дата включительно, по умолчанию седьмой день"),
    ] = None,
):
    """По умолчанию выдаёт всю демонстрационную неделю с понедельника по воскресенье. Студент видит пары своей группы, преподаватель — свои занятия. Брони приходят отдельно в state. Семестр длится с 01.09 по 28.12.2026."""
    if end is None:
        end = date.fromordinal(min(date.max.toordinal(), start.toordinal() + 6))
    if start > end:
        fail("Дата окончания раньше даты начала")
    return personal_schedule(user, start, end)


@api.post(
    "/teaching/lesson/{action}",
    tags=["Кабинет"],
    summary="Опубликовать отмену, перенос или домашнее задание",
    response_model=m.LessonActionResult,
    responses=error_responses(400, 401, 403, 404, 409, 422, 413),
)
def manage_lesson(action: Literal["cancel", "reschedule", "homework"], data: m.LessonAction, user: User, background: BackgroundTasks):
    """Преподаватель управляет своими занятиями, деканат — общим расписанием."""
    result, note_ids = apply_lesson_action(user, action, data)
    for note_id in note_ids:
        background.add_task(push.deliver, note_id)
    return result


@api.post(
    "/choose-elective",
    tags=["Кабинет"],
    summary="Выбрать электив",
    response_model=m.Ok,
    responses=error_responses(400, 401, 403, 409, 422, 413),
)
def elective(data: m.ElectiveChoice, user: User, background: BackgroundTasks):
    """Выбор доступен в период записи по Москве. Вне периода демонстрационный режим требует разрешённый juryPreview. Один выбор на студента. При конкуренции за последнее место или изменившемся выборе возвращает 409."""
    if PEOPLE[user]["role"] != "student":
        fail("Только для студентов", 403)
    with connect(True) as con:
        current = elective_state(con, user)
        if current["phase"] != "open" and not (
            current["juryAvailable"] and data.juryPreview
        ):
            fail("Сейчас выбор дисциплин закрыт", 403)
        if data.course not in current["remaining"]:
            fail("Выберите дисциплину")
        if current["selected"] != data.course:
            if (
                current["selected"] != data.previous
                or current["remaining"][data.course] <= 0
            ):
                fail("Выбор или число мест изменились", 409)
            con.execute(
                "INSERT OR REPLACE INTO elective_selections VALUES(?,?)",
                (user, data.course),
            )
            name = next(e["name"] for e in DATA["electives"] if e["id"] == data.course)
            note_id = note(
                con,
                user,
                "Дисциплина добавлена в учебный план",
                name + " · 4 семестр · 5 з. е.",
                2,
                "electives",
            )
            background.add_task(push.deliver, note_id)
    return m.Ok()


@api.post(
    "/reset-wifi",
    tags=["Кабинет"],
    summary="Обновить учебный пароль Wi-Fi",
    response_model=m.Ok,
    responses=error_responses(401, 403, 413),
)
def wifi(user: User, request: Request):
    """Обновляет демонстрационный пароль. Новый пароль и момент активации через пять минут доступны в state."""
    with connect(True) as con:
        if not wifi_store.reset(con, user, request.app.state.wifi_cipher):
            fail("Сервис недоступен", 403)
    return m.Ok()


@api.post(
    "/avatar",
    tags=["Кабинет"],
    summary="Изменить свой аватар",
    response_model=m.Ok,
    responses=error_responses(400, 401, 413, 422),
)
def avatar(data: m.Avatar, user: User):
    """Сохраняет доступную в справочнике фотографию. Клиент передаёт PNG data URL."""
    prefix = "data:image/png;base64,"
    if not data.image.startswith(prefix):
        fail("Требуется PNG")
    decode_upload(data.image[len(prefix) :], "image/png")
    with connect(True) as con:
        con.execute("INSERT OR REPLACE INTO avatars VALUES(?,?)", (user, data.image))
    return m.Ok()


api.include_router(request_router)
api.include_router(communication_router)
api.include_router(irishka_router(schedule, list_office_tasks))
api.include_router(assistant_mcp_router(schedule, list_office_tasks))
api.include_router(office_tasks_router)
app.include_router(api)
