import json
from datetime import date

import pytest

from server.assistant_tools import CampusTools, ToolError, blocks_for_tool, requested_place, requested_route
from server.store import DATA, connect, now, put
from server.teaching import personal_schedule
from server.tests.test_assistant_integration import call
from server.tests.test_api import client, login


def test_route_uses_real_atlas_ids_and_an_entrance_default():
    tools = CampusTools("student", date(2026, 11, 20), personal_schedule)
    route, actions = tools.run("campus_route", requested_route("Как пройти в аудиторию Б-412?"))
    assert actions == ["navigator"]
    assert route["from"]["id"] == "main-1-7"
    assert route["to"]["id"] == "main-4-2"
    assert route["to"]["floorId"] == "4"
    assert blocks_for_tool("campus_route", route) == [{"type": "route", **route}]
    place, actions = tools.run("campus_place", requested_place("Покажи на карте аудиторию Б-412"))
    assert actions == ["navigator"]
    assert blocks_for_tool("campus_place", place) == [{"type": "place", "place": route["to"]}]
    assert requested_place("Найди Машу") is None

    route, _ = tools.run("campus_route", requested_route("Построй маршрут от входа в корпус А до Б-412"))
    assert route["from"]["id"] == "modern-1-7"
    assert route["to"]["id"] == "main-4-2"
    with pytest.raises(ToolError, match="Уточните корпус"):
        tools.run("campus_route", {"to": "412"})
    with pytest.raises(ToolError, match="не найдена"):
        tools.run("campus_route", {"to": "Б-999"})


def test_schedule_and_search_cards_use_scoped_lesson_and_portal_ids(client):
    day = date(2026, 11, 20)
    tools = CampusTools("student", day, personal_schedule)
    schedule, _ = tools.run("campus_schedule", {"start": day, "end": day})
    block = blocks_for_tool("campus_schedule", schedule)[0]
    assert block["start"] == block["end"] == "2026-11-20"
    assert block["total"] == len(block["lessons"]) == 3
    assert {lesson["group"] for lesson in block["lessons"]} == {"АД-21"}
    assert block["lessons"][0]["building"]["short"] == "корп. B"
    assert json.dumps(block)

    people, _ = tools.run("campus_search", {"query": "Машу", "category": "people"})
    assert people["matches"] and all("Мария" in match["name"] for match in people["matches"])

    place, _ = tools.run("campus_search", {"query": "B-412", "category": "rooms"})
    assert place["matches"][0]["id"] == "Б-412"
    assert blocks_for_tool("campus_search", place) == [{"type": "place", "place": place["place"]}]

    for category, lookup, expected in [
        ("subjects", "Анализ данных", {"date": "2026-11-20", "lessonId": "2026-11-20-data"}),
        ("services", "Навигатор", {"serviceView": "navigator"}),
        ("services", "Справка об обучении", {"serviceView": "service-request"}),
    ]:
        result, _ = tools.run("campus_search", {"query": lookup, "category": category})
        match = blocks_for_tool("campus_search", result)[0]["matches"][0]
        assert match["category"] == category
        assert {key: match[key] for key in expected} == expected


def test_subject_search_exposes_teacher_location_and_scoped_semester(client, monkeypatch):
    tools = CampusTools("student", date(2026, 11, 22), personal_schedule)
    found, actions = tools.run("campus_search", {"query": "статистике", "category": "subjects"})
    assert actions == ["schedule"]
    statistic = found["matches"][0]
    assert {key: statistic[key] for key in ("name", "teacher", "teacherId", "room", "placeId", "date", "time", "group")} == {
        "name": "Статистика", "teacher": "Лесова Вера Андреевна", "teacherId": "teacher",
        "room": "Б-205", "placeId": "main-2-0", "date": "2026-11-23", "time": "10:40", "group": "АД-21",
    }
    assert statistic["teachers"] == [{"name": "Лесова Вера Андреевна", "id": "teacher"}]
    assert statistic["building"]["address"] == "Университетская аллея, 14"
    found, _ = tools.run("campus_search", {"query": "иностранному языку", "category": "subjects"})
    assert found["matches"][0]["name"] == "Иностранный язык"

    lesson = {**DATA["week"][0][0], "name": "История дипломатии", "suffix": "-history-example"}
    monkeypatch.setitem(DATA["exceptions"], "2026-09-01", [lesson])
    query = {"query": "История дипломатии", "category": "subjects"}
    found, _ = tools.run("campus_search", query)
    assert found["matches"][0]["date"] == "2026-09-01"
    other = CampusTools("friend", date(2026, 11, 22), personal_schedule)
    assert not other.run("campus_search", query)[0]["matches"]
    assert not tools.run("campus_search", {**query, "date": "2026-11-23"})[0]["matches"]

    place, _ = tools.run("campus_place", {"query": "Б-205"})
    assert {field: place["place"][field] for field in ("address", "capacity", "equipment")} == {
        "address": "Университетская аллея, 14", "capacity": 32, "equipment": "проектор",
    }


def test_document_cards_expose_only_own_live_pdf_and_catalog_form(client):
    student = login(client, "student")
    friend = login(client, "friend")
    teacher = login(client, "teacher")
    with connect(True) as con:
        put(con, {
            "id": "expired", "owner": "student", "kind": "document", "name": "Истекшая справка",
            "status": "approved", "format": "Электронная", "expires": now() - 1000,
        })
        put(con, {
            "id": "pending", "owner": "student", "kind": "document", "name": "Тестовая справка",
            "status": "pending", "format": "Электронная", "expires": now() + 10000,
        })

    request = {"name": "campus_documents", "arguments": {"scope": "downloads"}}
    data = call(client, student, "tools/call", request).json()["result"]["structuredContent"]
    assert [record["id"] for record in data["downloads"]] == ["electronic"]
    assert not data["forms"]
    assert blocks_for_tool("campus_documents", data)[0]["downloads"] == data["downloads"]
    assert client.get("/api/campus/file/electronic", headers=student).content.startswith(b"%PDF-")
    assert client.get("/api/campus/file/expired", headers=student).status_code == 410
    assert call(client, friend, "tools/call", request).json()["result"]["structuredContent"]["downloads"] == []
    assert call(client, teacher, "tools/call", request).json()["result"]["isError"]

    request["arguments"] = {"query": "Справка об обучении", "scope": "forms"}
    forms = call(client, student, "tools/call", request).json()["result"]["structuredContent"]["forms"]
    assert forms == [{"name": "Справка об обучении", "group": "digital", "certificate": True}]


def test_sport_route_uses_own_booking_and_does_not_guess_unmapped_venue(client):
    student = login(client, "student")
    booking = {"kind": "booking", "sport": "strength", "short": "СП-01",
               "date": "2026-11-23", "time": "09:00", "end": "10:00"}
    response = client.post("/api/campus/request", headers=student, json=booking)
    assert response.is_success, response.text
    assert client.post("/api/campus/request", headers=student, json={
        **booking, "sport": "yoga", "short": "СП-02", "time": "11:00", "end": "12:00",
    }).is_success

    day = date(2026, 11, 20)
    tools = CampusTools("student", day, personal_schedule)
    route, _ = tools.run("campus_route", requested_route("Как пройти на мою ближайшую тренировку?"))
    assert route["from"]["id"] == "modern-1-7"
    assert route["to"]["code"] == "Н-101"
    assert route["session"] == {"name": "Силовые тренировки", "date": "2026-11-23", "time": "09:00",
                                "status": "pending", "venue": "Тренажёрный зал"}
    place, _ = tools.run("campus_place", requested_place("Где моя тренировка?"))
    assert place["place"] == route["to"]
    with pytest.raises(ToolError, match="Студия движения"):
        tools.run("campus_route", {"to": "моя тренировка", "sport": "йога"})

    other = CampusTools("friend", day, personal_schedule)
    with pytest.raises(ToolError, match="у вас нет записи"):
        other.run("campus_route", {"to": "моя тренировка"})
