from server.application.session import revoke_session
from server.application.profile import reset_network_password, set_avatar
from datetime import date
from typing import Annotated, Literal
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from server.security import auth
from server.infrastructure.notifications import push
from server.core import clock
from server.contracts import models as m
from server.security.auth import Claims, User
from server.core.errors import error_responses, fail
from server.infrastructure.persistence.store import connect
from server.application.teaching import apply_lesson_action, personal_schedule

api = APIRouter(prefix="/api/campus")
health_router = APIRouter()


@health_router.get(
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


@api.get(
    "/clock",
    tags=["Сеанс"],
    summary="Получить текущую дату и время сервера",
    response_model=m.ServerClock,
)
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
        delay = request.app.state.login_limit.retry_after(
            request.client.host if request.client else "unknown"
        )
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
    revoke_session(claims)
    return m.Ok()


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
    return cabinet_snapshot(user, request.app.state.wifi_cipher)


@api.get(
    "/schedule",
    tags=["Кабинет"],
    summary="Получить личное расписание за период",
    response_model=list[m.Lesson],
    responses=error_responses(400, 401, 422),
)
def schedule(
    user: User,
    start: Annotated[date, Query(description="Первая дата включительно")] = date(2026, 11, 16),
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
def manage_lesson(
    action: Literal["cancel", "reschedule", "homework"],
    data: m.LessonAction,
    user: User,
    background: BackgroundTasks,
):
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
    note_id = choose_elective(data, user)
    if note_id is not None:
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
    reset_network_password(user, request.app.state.wifi_cipher)
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
    set_avatar(user, data.image)
    return m.Ok()


from server.application.cabinet import cabinet_snapshot
from server.application.academics import choose_elective
