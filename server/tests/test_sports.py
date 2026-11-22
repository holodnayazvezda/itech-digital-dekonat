from server.tests.test_api import client, login
from server.application.sports import SPORTS


def booking(**changes):
    return (
        dict(
            kind="booking",
            sport="strength",
            short="СП-01",
            date="2026-11-23",
            time="09:00",
            end="10:00",
        )
        | changes
    )


def test_sport_validation_persistence_and_private_history(client):
    student, other = login(client, "student"), login(client, "friend")
    for invalid in [
        booking(sport="invented"),
        booking(short="Н-101"),
        booking(date="2026-11-24"),
        booking(time="10:00", end="11:00"),
        booking(end="10:30"),
        booking(date="2027-01-04"),
    ]:
        assert client.post("/api/campus/request", headers=student, json=invalid).status_code == 400
    response = client.post("/api/campus/request", headers=student, json=booking())
    assert response.status_code == 200, response.text
    record_id = response.json()["id"]
    state = client.get("/api/campus/state", headers=student).json()
    record = next(r for r in state["records"] if r["id"] == record_id)
    assert record["sport"] == "strength" and record["name"] == "Силовые тренировки"
    assert record["details"]["Место"] == "Тренажёрный зал"
    assert all(
        r["id"] != record_id
        for r in client.get("/api/campus/state", headers=other).json()["records"]
    )
    assert client.post("/api/campus/request", headers=student, json=booking()).status_code == 409


def test_sport_capacity_is_rechecked_at_approval_and_cancel_frees_seat(client, monkeypatch):
    monkeypatch.setitem(SPORTS["strength"], "capacity", 1)
    student, other, office = (
        login(client, "student"),
        login(client, "friend"),
        login(client, "office"),
    )

    def create(headers):
        response = client.post("/api/campus/request", headers=headers, json=booking())
        assert response.status_code == 200, response.text
        return response.json()["id"]

    first, second = create(student), create(other)
    assert (
        client.post(
            "/api/campus/decision", headers=office, json=dict(id=first, status="approved")
        ).status_code
        == 200
    )
    full = client.post(
        "/api/campus/decision", headers=office, json=dict(id=second, status="approved")
    )
    assert full.status_code == 409, full.text
    state = client.get("/api/campus/state", headers=other).json()
    assert next(r for r in state["records"] if r["id"] == second)["status"] == "pending"
    assert any(
        r.get("sport") == "strength" and r["short"] == "СП-01" for r in state["reservations"]
    )
    response = client.post("/api/campus/cancel", headers=student, json={"id": first})
    assert response.status_code == 200, response.text
    assert (
        client.post(
            "/api/campus/decision", headers=office, json=dict(id=second, status="approved")
        ).status_code
        == 200
    )
