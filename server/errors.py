"""Shared API error responses."""

from typing import NoReturn

from fastapi import HTTPException

from .models import Error

ERROR_RESPONSES = {
    s: {"model": Error, "description": d}
    for s, d in {
        400: "Ошибка предметной области",
        401: "Требуется действительный JWT",
        403: "Недостаточно прав",
        404: "Ресурс недоступен",
        409: "Конфликт состояния или занятости",
        410: "Срок скачивания истёк",
        413: "Превышен размер",
        422: "Нарушен контракт запроса",
        429: "Слишком много попыток входа",
    }.items()
}


def error_responses(*status_codes: int) -> dict:
    return {code: ERROR_RESPONSES[code] for code in status_codes}


def fail(message: str, status: int = 400) -> NoReturn:
    raise HTTPException(status, message)
