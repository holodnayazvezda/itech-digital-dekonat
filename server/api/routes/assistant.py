from fastapi import APIRouter
from fastapi import HTTPException
from fastapi import Query
from fastapi.responses import StreamingResponse
from typing import Annotated
from uuid import UUID
from uuid import uuid4
from server.security.auth import User
from server.assistant.tools import Search
from datetime import datetime
from zoneinfo import ZoneInfo
from contextlib import closing
from server.assistant import conversations
from server.api.streaming import ChatStream


def create_router(schedule, office_tasks=None):
    router = APIRouter(
        prefix="/irishka",
        tags=["Кабинет"],
        responses={401: {"description": "Нужен JWT"}, 404: {"description": "Чат недоступен"}},
    )

    @router.get("/search", summary="Поиск Тинки по кампусу")
    def search(user: User, data: Annotated[Search, Query()]):
        """Ищет людей, аудитории, услуги и предметы своего расписания. Понимает краткие формы имён."""
        day = datetime.now(ZoneInfo("Europe/Moscow")).date()
        result, _ = conversations.CampusTools(user, day, schedule, office_tasks).run(
            "campus_search", data.model_dump()
        )
        return result

    @router.get("/chats", summary="Получить свои чаты Тинки")
    def chats(user: User):
        """Личные диалоги текущего участника, новые сверху, без чужих сообщений."""
        with conversations.connect() as con:
            return [
                dict(row)
                for row in con.execute(
                    "SELECT id,title,created,updated FROM irishka_chats WHERE owner=? ORDER BY updated DESC,rowid DESC",
                    (user,),
                )
            ]

    @router.post("/chats", summary="Создать личный чат Тинки")
    def create(user: User):
        """Создаёт пустой диалог; название обновляется после первого сообщения."""
        with conversations.connect(True) as con:
            if (
                con.execute("SELECT count(*) FROM irishka_chats WHERE owner=?", (user,)).fetchone()[
                    0
                ]
                >= 100
            ):
                raise HTTPException(409, "Достигнут лимит 100 чатов. Удалите ненужный чат.")
            chat_id, timestamp = (str(uuid4()), conversations.now())
            con.execute(
                "INSERT INTO irishka_chats(id,owner,title,created,updated) VALUES(?,?,?,?,?)",
                (chat_id, user, "Новый чат", timestamp, timestamp),
            )
            return conversations.conversation(con, user, chat_id)

    @router.get("/chats/{chat_id}", summary="Открыть свой диалог Тинки")
    def read(chat_id: UUID, user: User):
        """Возвращает все сообщения личного диалога; чужой идентификатор даёт 404."""
        with conversations.connect() as con:
            return conversations.conversation(con, user, chat_id)

    @router.post("/chats/{chat_id}/rename", summary="Переименовать свой чат Тинки")
    def rename(chat_id: UUID, data: conversations.ChatTitle, user: User):
        """Меняет название только собственного диалога."""
        with conversations.connect(True) as con:
            conversations.owned(con, user, chat_id)
            con.execute(
                "UPDATE irishka_chats SET title=?, title_custom=1 WHERE id=?",
                (data.title, str(chat_id)),
            )
            return conversations.conversation(con, user, chat_id)

    @router.post("/chats/{chat_id}/delete", summary="Удалить свой чат Тинки")
    def delete(chat_id: UUID, user: User):
        """Удаляет личный диалог и сообщения без возможности восстановления в интерфейсе."""
        with conversations.connect(True) as con:
            conversations.owned(con, user, chat_id)
            con.execute("DELETE FROM irishka_turns WHERE chat_id=?", (str(chat_id),))
            con.execute("DELETE FROM irishka_chats WHERE id=?", (str(chat_id),))
        return {"ok": True}

    @router.post("/chats/{chat_id}/messages", summary="Написать Тинки")
    def message(chat_id: UUID, data: conversations.ChatMessage, user: User):
        """Сохраняет сообщение и возвращает диалог с завершённым ответом Тинки."""
        with closing(
            conversations.turn_events(user, chat_id, data, schedule, office_tasks, stream=False)
        ) as events:
            return next((event["chat"] for event in events if event["type"] == "done"))

    @router.post(
        "/chats/{chat_id}/messages/stream",
        summary="Написать Тинки с потоковым ответом",
        response_class=StreamingResponse,
        responses={200: {"content": {"application/x-ndjson": {"schema": {"type": "string"}}}}},
    )
    def stream_message(chat_id: UUID, data: conversations.ChatMessage, user: User):
        """Возвращает статус и текст в NDJSON, затем карточки и сохранённый чат. Reset очищает незавершённый текст."""
        prepared = conversations.prepare_turn(user, chat_id, data)
        return ChatStream(
            conversations.turn_events(
                user, chat_id, data, schedule, office_tasks, stream=True, prepared=prepared
            )
        )

    return router
