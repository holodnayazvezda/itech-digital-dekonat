"""Shared work list for the dean's office."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints

from server.security.auth import owner
from server.infrastructure.persistence.store import PEOPLE

router = APIRouter(
    prefix="/office/tasks",
    tags=["Задачи деканата"],
    responses={
        401: {"description": "Требуется действительный JWT"},
        403: {"description": "Только сотрудник деканата"},
    },
)


def office_member(identity: Annotated[str, Depends(owner)]):
    if PEOPLE[identity]["role"] != "office":
        raise HTTPException(403, "Задачи доступны сотрудникам деканата")
    return identity


OfficeMember = Annotated[str, Depends(office_member)]


class TaskInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=140)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""
    due: date | None = None
    request_id: Annotated[str, StringConstraints(min_length=1, max_length=80)] | None = None


class TaskStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    complete: bool


class Task(TaskInput):
    id: str
    complete: bool
    created: int
    updated: int


@router.get("", response_model=list[Task])
def list_tasks(user: OfficeMember):
    """Возвращает общие задачи сотрудников деканата в порядке срочности."""
    return service.list_tasks(user=user)


@router.post("", response_model=Task)
def create_task(data: TaskInput, user: OfficeMember):
    """Добавляет задачу и проверяет существование связанной заявки."""
    return service.create_task(data=data, user=user)


@router.post("/{task_id}/status", response_model=Task)
def set_status(task_id: str, data: TaskStatus, user: OfficeMember):
    """Завершает задачу или возвращает её в работу."""
    return service.set_status(task_id=task_id, data=data, user=user)


from server.application import office as service
