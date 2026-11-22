"""HTTP endpoints for messages, notifications, and browser subscriptions."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Path, Query
from fastapi.responses import StreamingResponse

from server.contracts import models as m
from server.security.auth import Claims, User
from server.core.errors import error_responses

router = APIRouter()


@router.post(
    "/message",
    tags=["Связь"],
    summary="Написать участнику университета",
    response_model=m.Ok,
    responses=error_responses(400, 401, 422, 413),
)
def message(data: m.MessageIn, user: User, background: BackgroundTasks):
    """Диалог доступен отправителю и получателю. Уведомление содержит ссылку на диалог."""
    return service.message(data=data, user=user, background=background)


@router.post(
    "/group-message",
    tags=["Связь"],
    summary="Написать каждому студенту своей группы",
    response_model=m.GroupDelivery,
    responses=error_responses(400, 401, 403, 409, 422, 413),
)
def group_message(data: m.GroupMessage, user: User, background: BackgroundTasks):
    """Получателей определяет сервер по закреплённым группам преподавателя и составу группы.
    Каждая копия появляется в личном диалоге и создаёт уведомление адресату.
    Все копии записываются в одной транзакции. Повтор того же requestId возвращает прежний результат."""
    return service.group_message(data=data, user=user, background=background)


@router.post(
    "/letter",
    tags=["Связь"],
    summary="Отправить письмо от деканата",
    response_model=m.Ok,
    responses=error_responses(400, 401, 403, 422, 413),
)
def letter(data: m.Letter, user: User, background: BackgroundTasks):
    """Письмо появится в уведомлениях адресата с полным текстом."""
    return service.letter(data=data, user=user, background=background)


@router.post(
    "/notes/clear",
    tags=["Связь"],
    summary="Очистить свои входящие уведомления",
    response_model=m.Ok,
    responses=error_responses(401, 404, 422, 413),
)
def clear_notes(user: User, data: m.ClearNotes):
    """Скрывает письма получателя до указанного уведомления включительно на всех его устройствах. Более новые письма сохраняются. Запрос можно повторить."""
    return service.clear_notes(user=user, data=data)


@router.get(
    "/notes/events",
    tags=["Связь"],
    summary="Получать новые личные уведомления",
    description="Поток Server-Sent Events для открытого кабинета. Передайте последний ID в after и JWT в заголовке Authorization. В поле data приходят id, owner и title. При завершении потока переподключитесь с последним ID.",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "События после указанного ID в порядке регистрации",
            "content": {"text/event-stream": {"schema": {"type": "string"}}},
        }
    }
    | error_responses(401, 422),
)
async def note_events(
    after: Annotated[
        int, Query(ge=0, le=2**63 - 1, description="Последний полученный ID уведомления")
    ],
    claims: Claims,
):
    return StreamingResponse(
        await service.note_events(after=after, claims=claims),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/notes/{note_id}/read",
    tags=["Связь"],
    summary="Отметить своё уведомление прочитанным",
    response_model=m.Ok,
    responses=error_responses(401, 404, 422, 413),
)
def read_note(
    user: User,
    note_id: Annotated[int, Path(gt=0, le=2**63 - 1, description="Номер уведомления")],
):
    """Сохраняет отметку чтения на всех устройствах владельца. Повторное открытие безопасно."""
    return service.read_note(user=user, note_id=note_id)


@router.get(
    "/push-key",
    tags=["Связь"],
    summary="Получить открытый VAPID-ключ",
    response_model=m.PublicKey,
    responses=error_responses(401),
)
def push_key(user: User):
    """Ключ для подписки браузера через PushManager."""
    return service.push_key(user=user)


@router.post(
    "/subscribe",
    tags=["Связь"],
    summary="Привязать подписку браузера",
    response_model=m.Ok,
    responses=error_responses(400, 401, 422, 413),
)
def subscribe(data: m.Subscribe, user: User):
    """Принимает JSON браузерной подписки поддерживаемого провайдера Web Push."""
    return service.subscribe(data=data, user=user)


@router.post(
    "/unsubscribe",
    tags=["Связь"],
    summary="Отключить уведомления на устройстве",
    response_model=m.Ok,
    responses=error_responses(401, 422, 413),
)
def unsubscribe(data: m.Unsubscribe, user: User):
    """Отключает только подписку текущего пользователя с указанным endpoint."""
    return service.unsubscribe(data=data, user=user)


from server.application import communication as service
