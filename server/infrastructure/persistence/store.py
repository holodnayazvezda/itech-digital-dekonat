import json
import os
import secrets
import tempfile
import time
from contextlib import closing, contextmanager
from pathlib import Path

from server.infrastructure.persistence import database
from server.assistant.titles import chat_title

from server.core.paths import ASSETS

DATA = json.loads((ASSETS / "campus.json").read_text())
PEOPLE = DATA["people"]
# Groups on the same course and programme share immutable transfer checklists in memory.
for identity, person in PEOPLE.items():
    if person["role"] == "student" and identity not in DATA["transfers"]:
        DATA["transfers"][identity] = DATA["transferTemplates"][person["program"]][
            str(person["course"])
        ]
DEMO_DB = database.DEFAULT_DB
LEGACY_DEMO_DB = Path(tempfile.gettempdir()) / "decanat-atlas-demo-v2.sqlite"
DB = Path(os.getenv("CAMPUS_DEMO_DB", str(DEMO_DB)))
from .schema import SCHEMA


def now():
    return time.time_ns() // 1_000_000


def open_connection():
    return database.open_database(DB, database.key_file(DB))


@contextmanager
def connect(write=False):
    con = open_connection()
    try:
        con.execute("BEGIN IMMEDIATE" if write else "BEGIN")
        yield con
        con.commit()
    finally:
        con.close()


def put(con, record):
    con.execute(
        "INSERT OR REPLACE INTO records VALUES(?,?,?,?)",
        (
            record["id"],
            record["owner"],
            record["kind"],
            json.dumps(record, ensure_ascii=False),
        ),
    )


def records(con):
    return [
        json.loads(row[0]) for row in con.execute("SELECT body FROM records ORDER BY rowid DESC")
    ]


def note(con, owner, title, body, priority=2, ref=""):
    return con.execute(
        "INSERT INTO notes(owner,title,body,priority,ref,created) VALUES(?,?,?,?,?,?)",
        (owner, title, body, priority, ref, now()),
    ).lastrowid


def migrate_chat_titles(con):
    if any(
        row["name"] == "title_custom" for row in con.execute("PRAGMA table_info(irishka_chats)")
    ):
        return
    con.execute("ALTER TABLE irishka_chats ADD COLUMN title_custom INTEGER NOT NULL DEFAULT 0")
    rows = con.execute("""
        SELECT chat.id, chat.title, first_turn.body, first_turn.reply
        FROM irishka_chats AS chat
        LEFT JOIN irishka_turns AS first_turn ON first_turn.rowid = (
            SELECT rowid FROM irishka_turns WHERE chat_id = chat.id ORDER BY rowid LIMIT 1
        )
    """).fetchall()
    for row in rows:
        if row["body"] is not None and row["title"] == row["body"][:60]:
            try:
                reply = json.loads(row["reply"])
            except (TypeError, ValueError):
                reply = None
            con.execute(
                "UPDATE irishka_chats SET title=? WHERE id=?",
                (chat_title(row["body"], reply), row["id"]),
            )
        elif row["title"] != "Новый чат" or row["body"] is not None:
            con.execute("UPDATE irishka_chats SET title_custom=1 WHERE id=?", (row["id"],))


def initialize():
    if os.getenv("CAMPUS_MODE") == "production" and not os.getenv("CAMPUS_DEMO_DB"):
        raise RuntimeError("Укажите постоянный путь CAMPUS_DEMO_DB для production")
    if DB == DEMO_DB and not DB.exists() and LEGACY_DEMO_DB.is_file():
        raise RuntimeError(
            f"Перенесите прежнюю базу {LEGACY_DEMO_DB} в {DB} по инструкции server/README.md"
        )
    DB.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    database.prepare(DB)
    with closing(open_connection()) as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.executescript(SCHEMA)
    with connect(True) as con:
        migrate_chat_titles(con)
        if not any(
            row["name"] == "owner" and row["pk"]
            for row in con.execute("PRAGMA table_info(subscriptions)")
        ):
            con.execute("ALTER TABLE subscriptions RENAME TO subscriptions_legacy")
            con.execute(
                "CREATE TABLE subscriptions(endpoint TEXT NOT NULL,owner TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(endpoint,owner))"
            )
            con.execute(
                "INSERT INTO subscriptions SELECT endpoint,owner,value FROM subscriptions_legacy"
            )
            con.execute("DROP TABLE subscriptions_legacy")
        con.execute("CREATE INDEX IF NOT EXISTS subscriptions_owner ON subscriptions(owner)")
        con.execute(
            "INSERT OR IGNORE INTO settings VALUES('demo_signing_key',?)",
            (secrets.token_urlsafe(48),),
        )
        if not con.execute("SELECT 1 FROM notes LIMIT 1").fetchone():
            if (
                os.getenv("CAMPUS_MODE", "demo") == "demo"
                and not con.execute("SELECT 1 FROM messages LIMIT 1").fetchone()
            ):
                started = now() - 3600_000
                con.executemany(
                    "INSERT INTO messages(sender,recipient,body,created) VALUES(?,?,?,?)",
                    [
                        (
                            "student",
                            "teacher",
                            "Вера Андреевна, можно принести на консультацию черновик проекта?",
                            started,
                        ),
                        (
                            "teacher",
                            "student",
                            "Да, возьмите таблицу с исходными данными. Разберём её вместе.",
                            started + 300_000,
                        ),
                        (
                            "friend",
                            "student",
                            "Я закончил свою часть презентации. Обсудим после пары?",
                            started + 600_000,
                        ),
                    ],
                )
            for id, name, fmt in [
                ("paper", "Справка об обучении", "Бумажная"),
                ("electronic", "Выписка из зачётной книжки", "Электронная"),
            ]:
                r = dict(
                    id=id,
                    owner="student",
                    kind="document",
                    name=name,
                    format=fmt,
                    status="approved",
                    created=now(),
                )
                if id == "electronic":
                    r["expires"] = now() + 86400000
                put(con, r)
                note(
                    con,
                    "student",
                    name + " готова",
                    "Заберите документ в Б-214 с 10:00 до 16:00."
                    if id == "paper"
                    else "Электронный экземпляр доступен в разделе документов.",
                    3,
                    id,
                )
            note(
                con,
                "student",
                "Экзамен 24 ноября",
                "История культуры, 10:00. Аудитория Б-240.",
            )
            note(
                con,
                "student",
                "О зимней аттестации",
                "Проверьте даты дисциплин в расписании и результаты в зачётной книжке.",
                1,
            )
            for owner, p in PEOPLE.items():
                if p["role"] == "teacher":
                    note(
                        con,
                        owner,
                        "Расписание консультаций",
                        "Проверьте расписание и личные сообщения студентов.",
                    )
