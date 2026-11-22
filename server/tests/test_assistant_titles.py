import pytest

from server.assistant.titles import MAX_TITLE_LENGTH, chat_title


@pytest.mark.parametrize(
    ("prompt", "title"),
    [
        ("Запиши меня, пожалуйста, на футбол завтра", "Запись на футбол"),
        ("Как пройти до спортзала?", "Маршрут до спортзала"),
        ("как найти спортзал?", "Маршрут до спортзала"),
        ("Покажи, какие у меня занятия по математике", "Расписание по математике"),
        ("когда у меня математика?", "Расписание по математике"),
        ("Расскажи, как заказать справку об обучении", "Заказ справки"),
        ("Хочу записаться на спорт", "Запись на спорт"),
        ("Можешь показать мои пары на эту неделю?", "Расписание на неделю"),
        ("Как пройти от спортзала до Б‑412?", "Маршрут до Б-412"),
        ("Кто ведёт статистику у меня на этой неделе?", "Преподаватель по статистике"),
    ],
)
def test_titles_capture_topic_without_reply(prompt, title):
    assert chat_title(prompt) == title


def test_title_uses_typed_reply_metadata_without_reply_text():
    assert (
        chat_title(
            "как найти спортзал?",
            {
                "blocks": [
                    {"type": "place", "place": {"name": "Спортзал", "code": "Н-101"}},
                ]
            },
        )
        == "Маршрут до спортзала"
    )
    assert (
        chat_title(
            "когда у меня математика?",
            {
                "blocks": [
                    {"type": "search", "matches": [{"category": "subjects", "name": "Математика"}]},
                ]
            },
        )
        == "Расписание по математике"
    )
    assert (
        chat_title(
            "Как сюда пройти?",
            {
                "blocks": [
                    {"type": "route", "from": {"code": "Б-108"}, "to": {"code": "Б-412"}},
                ]
            },
        )
        == "Маршрут до Б-412"
    )
    assert (
        chat_title(
            "Кто ведёт этот предмет?",
            {
                "blocks": [
                    {"type": "search", "matches": [{"category": "subjects", "name": "Статистика"}]},
                ]
            },
        )
        == "Преподаватель по статистике"
    )
    assert (
        chat_title(
            "Когда можно записаться?",
            {
                "blocks": [
                    {"type": "sports", "sessions": [{"sport": "football"}]},
                ]
            },
        )
        == "Запись на футбол"
    )
    assert chat_title("Добрый вечер", {"text": "Мой пароль"}) == "Добрый вечер"


def test_titles_are_short_and_exclude_links_credentials_and_multiline_notes():
    assert chat_title("https://private.example/abc?token=secret") == "Новый чат"
    assert chat_title("Мой пароль super-secret\nПожалуйста, помоги") == "Доступ к кабинету"
    assert chat_title("Пожалуйста, правила практики\nИван Иванович Иванов") == "Правила практики"
    assert chat_title("Экзамен", {"blocks": 3}) == "Экзамен"
    assert "student@" not in chat_title("student@example.com для связи с факультетом")
    title = chat_title("Обсуждение порядка проведения общего собрания участников проекта")
    assert title.endswith("…")
    assert len(title) <= MAX_TITLE_LENGTH
