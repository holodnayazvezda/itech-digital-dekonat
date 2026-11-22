"""SQLCipher connections and non-destructive database migration / backup."""
import argparse
from contextlib import closing
import os
from pathlib import Path
import re
import secrets
import tempfile

from sqlcipher3 import dbapi2 as sql


DEFAULT_DB = Path.home() / ".local" / "share" / "campus-atlas" / "demo.sqlite"
DEFAULT_KEY_DIR = Path.home() / ".config" / "campus-atlas" / "keys"


def key_file(database):
    configured = os.getenv("CAMPUS_DB_KEY_FILE")
    if configured:
        return Path(configured)
    if os.getenv("CAMPUS_MODE") == "production":
        raise RuntimeError("Укажите CAMPUS_DB_KEY_FILE вне каталога базы")
    if database == DEFAULT_DB:
        return DEFAULT_KEY_DIR / "demo.db-key"
    return Path(str(database) + ".db-key")


def read_key(path):
    try:
        with path.open("rb") as f:
            if os.name == "posix" and os.fstat(f.fileno()).st_mode & 0o077:
                raise RuntimeError("Закройте доступ других пользователей к ключу SQLCipher (режим 0600 или 0400)")
            key = f.read(68).strip()
            if f.read(1):
                raise RuntimeError("Некорректный файл ключа SQLCipher")
    except FileNotFoundError as exc:
        raise RuntimeError("Не найден ключ SQLCipher. Восстановите исходный ключ базы.") from exc
    if not re.fullmatch(b"[a-fA-F0-9]{64}", key):
        raise RuntimeError("Ключ SQLCipher должен содержать 64 шестнадцатеричных символа")
    return b"x'" + key + b"'"


def generate_key(path):
    # Publish only complete keys. An existing key is never overwritten.
    with tempfile.NamedTemporaryFile(dir=path.parent, delete_on_close=False) as temp:
        temp.write(secrets.token_hex(32).encode() + b"\n")
        temp.flush()
        os.fsync(temp.fileno())
        temp.close()
        os.link(temp.name, path)


def plaintext(database):
    if not database.exists():
        return False
    with database.open("rb") as f:
        return f.read(16) == b"SQLite format 3\x00"


def prepare(database):
    if plaintext(database):
        raise RuntimeError("Обнаружена незашифрованная SQLite. Перенесите её командой python -m server.database migrate.")
    path = key_file(database)
    if not path.exists() and not database.exists() and os.getenv("CAMPUS_MODE") != "production":
        if path.parent == DEFAULT_KEY_DIR:
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        try:
            generate_key(path)
        except FileExistsError:
            pass
    read_key(path)


def open_database(database, key_path, *, readonly=False):
    key = read_key(key_path)
    con = sql.connect(database.resolve().as_uri() + ("?mode=ro" if readonly else ""), uri=True, timeout=10)
    try:
        con.set_key(key)
        con.execute("PRAGMA temp_store=MEMORY")
        con.execute("SELECT count(*) FROM sqlite_master").fetchone()
        con.row_factory = sql.Row
        return con
    except sql.DatabaseError as exc:
        con.close()
        raise RuntimeError("Не удалось открыть базу SQLCipher. Проверьте ключ и целостность файла.") from exc


def export(source, destination, destination_key, source_key=None):
    if not source.is_file() or destination.exists() or source.resolve() == destination.resolve():
        raise ValueError("Укажите существующую исходную базу и новый файл назначения")
    key = read_key(destination_key)
    with tempfile.TemporaryDirectory(dir=destination.parent) as work:
        target = Path(work) / "encrypted.sqlite"
        if source_key is None:
            if not plaintext(source):
                raise ValueError("Для зашифрованного источника используйте backup")
            db = sql.connect(source.resolve().as_uri() + "?mode=ro", uri=True, timeout=10)
        else:
            db = open_database(source, source_key, readonly=True)
        with closing(db):
            db.execute("PRAGMA temp_store=MEMORY")
            db.execute("ATTACH DATABASE ? AS encrypted KEY ?", (str(target), key.decode("ascii")))
            db.execute("BEGIN")
            db.execute("SELECT sqlcipher_export('encrypted')").fetchone()
            version = db.execute("PRAGMA main.user_version").fetchone()[0]
            db.execute(f"PRAGMA encrypted.user_version={version:d}")
            db.commit()
            db.execute("DETACH DATABASE encrypted")
        with closing(open_database(target, destination_key, readonly=True)) as verified:
            if verified.execute("PRAGMA cipher_integrity_check").fetchall() or verified.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("Копия не прошла проверку целостности")
        target.chmod(0o600)
        os.link(target, destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("keygen").add_argument("key", type=Path)
    for name in ("migrate", "backup"):
        command = commands.add_parser(name)
        command.add_argument("source", type=Path)
        command.add_argument("destination", type=Path)
        command.add_argument("--key", type=Path, required=True, help="Файл ключа результата")
        if name == "backup":
            command.add_argument("--source-key", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "keygen":
        generate_key(args.key)
    else:
        export(args.source, args.destination, args.key, getattr(args, "source_key", None))


if __name__ == "__main__":
    main()
