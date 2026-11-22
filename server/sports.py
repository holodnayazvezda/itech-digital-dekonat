"""Sports catalogue and booking capacity rules shared by the cabinet and Tinki."""
import json
from datetime import date
from pathlib import Path

from fastapi import HTTPException

SPORTS = {
    sport["id"]: sport
    for sport in json.loads((Path(__file__).parent / "assets" / "sports.json").read_text())
}
SPORTS_START = date(2026, 11, 20)
SPORTS_END = date(2026, 12, 28)


def booking_availability(record, sport, history):
    conflicting = False
    used = 0
    for other in history:
        if (
            other["kind"] != "booking"
            or other["id"] == record.get("id")
            or other.get("date") != record["date"]
            or other.get("time", "") >= record["end"]
            or other.get("end", "") <= record["time"]
        ):
            continue
        if other["owner"] == record["owner"] and other["status"] in {"pending", "approved"}:
            conflicting = True
        if other.get("short") == sport["short"] and other["status"] == "approved":
            used += 1
    return max(0, sport["capacity"] - used), conflicting


def check_booking(record, history):
    sport = SPORTS.get(record.get("sport"))
    if not sport or record["short"] != sport["short"]:
        raise HTTPException(400, "Выберите вид спорта из каталога")
    day = date.fromisoformat(record["date"])

    def minutes(clock):
        hour, minute = map(int, clock.split(":"))
        return hour * 60 + minute

    start, end = minutes(record["time"]), minutes(record["end"])
    if (
        not SPORTS_START <= day <= SPORTS_END
        or day.isoweekday() not in sport["weekdays"]
        or start not in sport["starts"]
        or end - start != sport["duration"]
    ):
        raise HTTPException(400, "Выберите дату и время из расписания секции")
    available, conflicting = booking_availability(record, sport, history)
    if conflicting:
        raise HTTPException(409, "У вас уже есть заявка на это время")
    if not available:
        raise HTTPException(409, "На выбранное занятие мест не осталось")
    return sport
