"""HTTP endpoints for applications, bookings, and downloadable documents."""

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Body, Path, Response

from . import models as m
from . import push, requests
from .auth import User
from .errors import error_responses, fail
from .store import DATA, connect, now

router = APIRouter()
RequestId = Annotated[str, Path(description="Идентификатор заявки из records")]


@router.get(
    "/catalog",
    tags=["Обращения"],
    summary="Получить каталог и поля форм",
    response_model=list[m.Service],
    response_model_exclude_none=True,
    responses=error_responses(401),
)
def catalog(user: User):
    """Для каждого вида заявления перечислены обязательные поля. Для перевода варианты программ зависят от студента."""
    return [
        {
            **s,
            "fields": [
                {**f, "options": list(DATA["transfers"].get(user, {}))}
                if f["type"] == "program"
                else f
                for f in s["fields"]
            ],
        }
        for s in DATA["services"]
    ]


@router.post(
    "/request",
    tags=["Обращения"],
    summary="Подать заявление или запросить бронь",
    response_model=m.CreatedRecord,
    response_model_exclude_unset=True,
    responses=error_responses(400, 401, 403, 409, 413, 422),
)
def submit(
    user: User,
    background: BackgroundTasks,
    data: Annotated[
        m.Booking | m.Document,
        Body(
            discriminator="kind",
            openapi_examples={
                "document": {
                    "summary": "Электронная справка",
                    "value": {
                        "kind": "document",
                        "name": "Справка об обучении",
                        "format": "Электронная",
                        "values": {"destination": "По месту требования"},
                    },
                },
                "booking": {
                    "summary": "Час в переговорной",
                    "value": {
                        "kind": "booking",
                        "short": "Б-108",
                        "date": "2026-11-20",
                        "time": "14:00",
                        "end": "15:00",
                    },
                },
            },
        ),
    ],
):
    """Создаёт заявку на согласование деканатом. Повторное заселение при действующей заявке или предоставленном месте возвращает 409. Бронь длится от 30 минут до 4 часов с шагом 30 минут. Совпадение с личной парой допускается, занятость самого помещения проверяется."""
    with connect(True) as con:
        record, note_id = requests.create(con, user, data)
    if note_id is not None:
        background.add_task(push.deliver, note_id)
    return {"id": record["id"], "record": record}


@router.post(
    "/decision",
    tags=["Обращения"],
    summary="Одобрить или отклонить заявку",
    response_model=m.Ok,
    responses=error_responses(400, 401, 403, 404, 409, 422, 413),
)
def decision(data: m.Decision, user: User, background: BackgroundTasks):
    """Только деканат. Повторно проверяет занятость помещения и фиксирует решение с уведомлением в одной транзакции."""
    if user != "office":
        fail("Решение принимает деканат", 403)
    with connect(True) as con:
        note_id = requests.apply_decision(con, data)
    background.add_task(push.deliver, note_id)
    return m.Ok()


@router.post(
    "/cancel",
    tags=["Обращения"],
    summary="Отменить свою бронь",
    response_model=m.Ok,
    responses=error_responses(401, 403, 404, 409, 422, 413),
)
def cancel(data: m.RecordId, user: User):
    """Отменяет ожидающую или подтверждённую собственную бронь. Освобождённый интервал сразу доступен для выбора."""
    with connect(True) as con:
        requests.cancel_booking(con, user, data.id)
    return m.Ok()


@router.post(
    "/clarify",
    tags=["Обращения"],
    summary="Запросить уточнение",
    response_model=m.Ok,
    responses=error_responses(401, 403, 404, 409, 422, 413),
)
def clarify(data: m.Discussion, user: User, background: BackgroundTasks):
    """Сотрудник деканата возвращает документ заявителю с вопросом."""
    with connect(True) as con:
        note_id = requests.discuss(con, user, data, asking=True)
    background.add_task(push.deliver, note_id)
    return m.Ok()


@router.post(
    "/supplement",
    tags=["Обращения"],
    summary="Дополнить свою заявку",
    response_model=m.Ok,
    responses=error_responses(401, 403, 404, 409, 422, 413),
)
def supplement(data: m.Supplement, user: User, background: BackgroundTasks):
    """Заявитель отвечает на запрос уточнения. Документ возвращается на рассмотрение."""
    with connect(True) as con:
        note_id = requests.discuss(con, user, data, asking=False)
    background.add_task(push.deliver, note_id)
    return m.Ok()


def binary(*types):
    return {
        200: {
            "description": "Скачиваемый файл",
            "content": {
                t: {"schema": {"type": "string", "format": "binary"}} for t in types
            },
        }
    }


@router.get(
    "/attachment/{id}",
    tags=["Обращения"],
    summary="Скачать исходное вложение",
    response_class=Response,
    responses=binary("image/png", "image/jpeg", "application/pdf") | error_responses(401, 404, 422),
)
def attachment(id: RequestId, user: User):
    """Скачивание доступно заявителю и деканату."""
    with connect() as con:
        r = requests.find(con, id)
        if user not in {r["owner"], "office"}:
            fail("Вложение не найдено", 404)
        f = con.execute("SELECT * FROM attachments WHERE record_id=?", (id,)).fetchone()
        if not f:
            fail("Вложение не найдено", 404)
        return Response(
            bytes(f["content"]),
            media_type=f["mime"],
            headers={
                "Content-Disposition": "attachment; filename*=UTF-8''"
                + quote(f["name"], safe="")
            },
        )


@router.get(
    "/file/{id}",
    tags=["Обращения"],
    summary="Скачать готовую справку PDF",
    response_class=Response,
    responses=binary("application/pdf") | error_responses(401, 404, 410, 422),
)
def file(id: RequestId, user: User):
    """Только для владельца одобренной электронной справки, в течение 24 часов после решения."""
    with connect() as con:
        r = requests.find(con, id)
    if not requests.owns_electronic_document(r, user):
        fail("Документ не найден", 404)
    if now() >= r.get("expires", 0):
        fail("Срок ссылки истёк", 410)
    return Response(
        requests.pdf(r),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="campus-document.pdf"'},
    )
