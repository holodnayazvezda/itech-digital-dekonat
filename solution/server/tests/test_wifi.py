import sqlite3

import pytest
from fastapi.testclient import TestClient

from server import auth, main, store


def test_wifi_migration_reset_and_recovery(tmp_path, monkeypatch):
    db = tmp_path / "legacy.sqlite"
    key = tmp_path / "private-wifi-key"
    monkeypatch.setattr(store, "DB", db)
    monkeypatch.setattr(auth, "PRODUCTION", False)
    monkeypatch.setenv("CAMPUS_WIFI_KEY_FILE", str(key))
    original = "old-demo-wifi-password"
    ready = 1234
    with sqlite3.connect(tmp_path / "old.sqlite") as con:
        con.execute("CREATE TABLE demo_wifi(owner TEXT PRIMARY KEY,password TEXT NOT NULL,ready INTEGER NOT NULL)")
        con.execute("INSERT INTO demo_wifi VALUES('student',?,?)", (original, ready))
    db_key = tmp_path / "database.key"
    store.database.generate_key(db_key)
    monkeypatch.setenv("CAMPUS_DB_KEY_FILE", str(db_key))
    store.database.export(tmp_path / "old.sqlite", db, db_key)
    with TestClient(main.app) as client:
        jwt = client.post("/api/campus/login", json={"role": "student", "password": "CampusDemo2026!"}).json()["token"]
        headers = {"Authorization": "Bearer " + jwt}
        state = "/api/campus/state"
        assert client.get(state, headers=headers).json()["wifi"] == {"password": original, "ready": ready}
        before = store.now()
        assert client.post("/api/campus/reset-wifi", headers=headers).is_success
        current = client.get(state, headers=headers).json()["wifi"]
        assert current["password"] != original
        assert before + 300_000 <= current["ready"] <= store.now() + 300_000
        office = client.post("/api/campus/login", json={"role": "office", "password": "CampusDemo2026!"}).json()["token"]
        assert client.post("/api/campus/reset-wifi", headers={"Authorization": "Bearer " + office}).status_code == 403

    with TestClient(main.app) as client:
        assert client.get(state, headers=headers).json()["wifi"] == current
    with store.connect() as con:
        assert {col[1] for col in con.execute("PRAGMA table_info(demo_wifi)")} == {"owner", "ciphertext", "ready"}
        value, = con.execute("SELECT ciphertext FROM demo_wifi WHERE owner='student'").fetchone()
        assert current["password"].encode() not in value
    for file in tmp_path.glob("legacy.sqlite*"):
        contents = file.read_bytes()
        assert original.encode() not in contents and current["password"].encode() not in contents
        assert key.read_bytes() not in contents
    assert key.stat().st_mode & 0o077 == 0
    key.unlink()
    with pytest.raises(RuntimeError, match="Восстановите ключ Wi-Fi"):
        with TestClient(main.app):
            pass
    assert not key.exists()
