"""Shared work list for the dean's office."""

from datetime import date
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints

from .auth import owner
from .store import PEOPLE, connect, now

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
    with connect() as con:
        return [dict(row) for row in con.execute(
            """SELECT * FROM office_tasks
               ORDER BY complete, due IS NULL, due, created DESC, id"""
        )]


@router.post("", response_model=Task)
def create_task(data: TaskInput, user: OfficeMember):
    """Добавляет задачу и проверяет существование связанной заявки."""
    task = data.model_dump(mode="json")
    timestamp = now()
    task.update(id=uuid4().hex, complete=False, created=timestamp, updated=timestamp)
    with connect(True) as con:
        if data.request_id and not con.execute(
            "SELECT 1 FROM records WHERE id=?", (data.request_id,)
        ).fetchone():
            raise HTTPException(404, "Связанная заявка не найдена")
        con.execute(
            """INSERT INTO office_tasks(id,title,body,due,request_id,complete,created,updated)
               VALUES(:id,:title,:body,:due,:request_id,:complete,:created,:updated)""",
            task,
        )
    return task


@router.post("/{task_id}/status", response_model=Task)
def set_status(task_id: str, data: TaskStatus, user: OfficeMember):
    """Завершает задачу или возвращает её в работу."""
    with connect(True) as con:
        record = con.execute("SELECT * FROM office_tasks WHERE id=?", (task_id,)).fetchone()
        if not record:
            raise HTTPException(404, "Задача не найдена")
        task = dict(record)
        if task["complete"] != data.complete:
            task.update(complete=data.complete, updated=now())
            con.execute(
                "UPDATE office_tasks SET complete=?, updated=? WHERE id=?",
                (task["complete"], task["updated"], task_id),
            )
    return task
