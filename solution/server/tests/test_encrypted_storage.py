import hashlib
import sqlite3
from contextlib import closing

import pytest

from server import auth, database, store


def test_encrypted_pages_wal_and_copy_with_new_key(tmp_path, monkeypatch):
    path = tmp_path / "campus.sqlite"
    monkeypatch.setattr(store, "DB", path)
    store.initialize()
    key = database.key_file(path)
    marker = "Тестовое личное сообщение 0617"
    with closing(store.open_connection()) as writer:
        writer.execute("INSERT INTO messages(sender,recipient,body,created) VALUES('student','teacher',?,1)", (marker,))
        writer.commit()
        for file in [path, tmp_path / "campus.sqlite-wal"]:
            assert file.stat().st_size > 0
            assert marker.encode() not in file.read_bytes()
        with closing(sqlite3.connect(path)) as plain, pytest.raises(sqlite3.DatabaseError):
            plain.execute("SELECT * FROM messages").fetchall()

        other_key = tmp_path / "backup.key"
        database.generate_key(other_key)
        copy = tmp_path / "backup.sqlite"
        database.export(path, copy, other_key, source_key=key)
        with closing(database.open_database(copy, other_key, readonly=True)) as reader:
            assert reader.execute("SELECT count(*) FROM messages WHERE body=?", (marker,)).fetchone()[0] == 1
        with pytest.raises(RuntimeError):
            database.open_database(copy, key)
        with pytest.raises(ValueError):
            database.export(path, copy, other_key, source_key=key)
    key.unlink()
    with pytest.raises(RuntimeError, match="Восстановите"):
        store.initialize()
    assert not key.exists()


def test_plaintext_requires_explicit_migration(tmp_path, monkeypatch):
    path = tmp_path / "old.sqlite"
    with closing(sqlite3.connect(path)) as conn:
        conn.execute("CREATE TABLE source(id INTEGER PRIMARY KEY, data BLOB)")
        conn.execute("INSERT INTO source VALUES(7, x'010203')")
        conn.commit()
    monkeypatch.setattr(store, "DB", path)
    with pytest.raises(RuntimeError, match="migrate"):
        store.initialize()
    key = tmp_path / "key"
    database.generate_key(key)
    new = tmp_path / "new.sqlite"
    database.export(path, new, key)
    with closing(database.open_database(new, key)) as con:
        assert tuple(con.execute("SELECT * FROM source").fetchone()) == (7, bytes([1, 2, 3]))
    assert database.plaintext(path) and not database.plaintext(new)


def test_password_formats_and_login_limits(monkeypatch):
    from server.limits import LoginLimit

    password = "fixture-password"
    encoded = auth.password_hash(password)
    assert encoded.startswith("$argon2id$") and auth.valid_hash(encoded)
    salt = bytes(range(16))
    legacy = salt.hex() + ":" + hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1).hex()
    for saved in [encoded, legacy]:
        assert auth.verify_password(password, saved)
        assert not auth.verify_password("incorrect", saved)
    monkeypatch.setattr("server.limits.monotonic", lambda: 120)
    gate = LoginLimit(attempts=2, capacity=2)
    assert gate.retry_after("host-a") == gate.retry_after("host-a") == 0
    assert gate.retry_after("host-a") > 0
    assert gate.retry_after("host-b") == 0
    assert gate.retry_after("host-c") > 0
