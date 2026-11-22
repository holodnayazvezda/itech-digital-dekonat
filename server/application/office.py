from uuid import uuid4

from server.core.errors import ApplicationError


from server.infrastructure.persistence.store import connect, now


def list_tasks(user):
    """Возвращает общие задачи сотрудников деканата в порядке срочности."""
    with connect() as con:
        return [
            dict(row)
            for row in con.execute(
                "SELECT * FROM office_tasks\n               ORDER BY complete, due IS NULL, due, created DESC, id"
            )
        ]


def create_task(data, user):
    """Добавляет задачу и проверяет существование связанной заявки."""
    task = data.model_dump(mode="json")
    timestamp = now()
    task.update(id=uuid4().hex, complete=False, created=timestamp, updated=timestamp)
    with connect(True) as con:
        if data.request_id and (
            not con.execute("SELECT 1 FROM records WHERE id=?", (data.request_id,)).fetchone()
        ):
            raise ApplicationError(404, "Связанная заявка не найдена")
        con.execute(
            "INSERT INTO office_tasks(id,title,body,due,request_id,complete,created,updated)\n               VALUES(:id,:title,:body,:due,:request_id,:complete,:created,:updated)",
            task,
        )
    return task


def set_status(task_id, data, user):
    """Завершает задачу или возвращает её в работу."""
    with connect(True) as con:
        record = con.execute("SELECT * FROM office_tasks WHERE id=?", (task_id,)).fetchone()
        if not record:
            raise ApplicationError(404, "Задача не найдена")
        task = dict(record)
        if task["complete"] != data.complete:
            task.update(complete=data.complete, updated=now())
            con.execute(
                "UPDATE office_tasks SET complete=?, updated=? WHERE id=?",
                (task["complete"], task["updated"], task_id),
            )
    return task
