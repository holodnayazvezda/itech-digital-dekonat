import asyncio
import base64
import json
import sqlite3
import time

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from fastapi.testclient import TestClient

from server import auth, communication_routes, main, push, store


def test_existing_endpoint_survives_migration_and_another_cabinet(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DB", tmp_path / "notifications.sqlite")
    monkeypatch.setattr(auth, "PRODUCTION", False)
    endpoint = "https://push.services.mozilla.com/test-device"
    key = ec.generate_private_key(ec.SECP256R1()).public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    subscription = {"endpoint": endpoint, "keys": {"p256dh": base64.urlsafe_b64encode(key).decode().rstrip("="), "auth": "B" * 22}}
    with sqlite3.connect(tmp_path / "old.sqlite") as con:
        con.execute("CREATE TABLE subscriptions(endpoint TEXT PRIMARY KEY,owner TEXT,value TEXT)")
        con.execute("INSERT INTO subscriptions VALUES(?,?,?)", (endpoint, "student", json.dumps(subscription)))

    db_key = store.database.key_file(store.DB)
    store.database.generate_key(db_key)
    store.database.export(tmp_path / "old.sqlite", store.DB, db_key)
    sent = []
    monkeypatch.setattr(push, "webpush", lambda sub, data, **kwargs: sent.append(json.loads(data)))
    with TestClient(main.app) as client:
        def headers(user):
            return {"Authorization": "Bearer " + client.post("/api/campus/login", json={"role": user, "password": "CampusDemo2026!"}).json()["token"]}

        student, office = headers("student"), headers("office")
        assert client.get("/api/campus/notes/events?after=0").status_code == 401
        rejected = subscription | {"keys": subscription["keys"] | {"p256dh": "A" * 87}}
        assert client.post("/api/campus/subscribe", headers=student, json={"subscription": rejected}).status_code == 400
        for cabinet in (office, student, office):
            assert client.post("/api/campus/subscribe", headers=cabinet, json={"subscription": subscription}).is_success
        assert client.post("/api/campus/unsubscribe", headers=office, json={"endpoint": endpoint}).is_success
        with store.connect() as con:
            assert [row["owner"] for row in con.execute("SELECT owner FROM subscriptions")] == ["student"]
        booking = client.post("/api/campus/request", headers=student, json={
            "kind": "booking", "short": "Б-108", "date": "2026-11-27", "time": "19:00", "end": "20:00",
        }).json()
        assert client.post("/api/campus/decision", headers=office, json={"id": booking["id"], "status": "approved"}).is_success
        note = next(item for item in client.get("/api/campus/state", headers=student).json()["notes"] if item["ref"] == booking["id"])
        assert [(data["id"], data["owner"], data["title"]) for data in sent if data["title"] == "Бронь одобрена"] == [(note["id"], "student", note["title"])]

        async def replay():
            # Another recipient's event between the cursor and the student's event stays private.
            with store.connect(True) as con:
                cursor = store.note(con, "student", "Прочитано", "")
                store.note(con, "office", "Входящее для офиса", "")
                latest = store.note(con, "student", "Новое для студента", "")
            claims = {"exp": time.time() + 60, "sub": "student", "jti": "test-session"}
            response = await communication_routes.note_events(cursor, claims)
            stream = response.body_iterator
            assert await anext(stream) == ": connected\n\n"
            event = await anext(stream)
            assert json.loads(event.split("data: ")[1]) == {"id": latest, "owner": "student", "title": "Новое для студента"}
            await stream.aclose()

        asyncio.run(replay())
