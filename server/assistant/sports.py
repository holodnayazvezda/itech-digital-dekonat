"""Read-only sports suggestions for Tinki and the campus assistant tools."""

import re
from datetime import date as CalendarDate
from datetime import datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field

from server.application.search import normalize
from server.contracts.models import Input, Text
from server.application.sports import SPORTS, SPORTS_END, SPORTS_START, booking_availability
from server.infrastructure.persistence.store import DATA, connect, records

MOSCOW = ZoneInfo("Europe/Moscow")
SPORT_ALIASES = {
    "strength": ("качалка", "силовую", "силовые", "тренажерный зал", "тренажерном зале"),
    "functional": ("функциональную", "функциональная"),
    "yoga": ("йогу", "йоге"),
    "stretching": ("растяжка", "растяжку"),
    "aerobics": ("аэробику",),
    "zumba": ("зумбу",),
    "dance": ("танцевать",),
    "wrestling": ("борьбу",),
    "tabletennis": ("пинг понг",),
    "swimming": ("поплавать", "плавать", "бассейн", "бассейне"),
    "aqua": ("аквааэробику",),
    "athletics": ("легкую атлетику",),
    "climbing": ("скалодром", "скалодроме"),
}
GYM = {"id": "gym", "name": "Спортзал", "short": DATA["gym"]["short"], "venue": DATA["gym"]["name"]}
SPORT_CUE = r"\b(?:спорт(?:а|ом|е)?|спортзал\w*|трениров\w*|спортивн\w+\s+(?:секц|занят|зал)\w*)\b"
UPCOMING_CUE = (
    r"\b(?:мои|моя|мою|мое|мой|моим)\s+(?:спортивн\w*\s+)?(?:трениров\w*|запис\w*|заявк\w*)"
    r"|\b(?:я\s+записан|у\s+меня\s+запланир|уже\s+записан)\w*"
)
FIND_CUE = r"\b(?:запиш\w*|запис\w*|хочу|свобод\w*|ближайш\w*|покаж\w*|открой\w*|когда|есть|найди|подбери|расписан\w*)\b"
SPORT_PERIODS = {"morning": (0, 720), "afternoon": (720, 1020), "evening": (1020, 1440)}


class SportSessions(Input):
    sport: Text | None = Field(
        None,
        max_length=100,
        description="Название или ID вида спорта. Без вида спорта показать разные секции.",
    )
    date: CalendarDate | None = Field(
        None, description="Конкретная дата по Москве. По умолчанию ближайшие дни."
    )
    period: Literal["morning", "afternoon", "evening"] | None = Field(
        None, description="Время дня, если указано пользователем."
    )
    scope: Literal["all", "available", "upcoming"] = "all"


def _find_sport(text):
    query = f" {normalize(text)} "
    ranked = (
        (len(label), sport)
        for sport_id, sport in SPORTS.items()
        for label in map(normalize, (sport_id, sport["name"], *SPORT_ALIASES.get(sport_id, ())))
        if f" {label} " in query
    )
    best = max(ranked, key=lambda match: match[0], default=None)
    return best[1] if best else None


def requested_sport(text, day):
    query = normalize(text)
    sport = _find_sport(query)
    if not re.search(SPORT_CUE, query) and (
        sport is None or not (re.search(FIND_CUE, query) or query == normalize(sport["name"]))
    ):
        return None
    parameters = {"scope": "upcoming" if re.search(UPCOMING_CUE, query) else "available"}
    if sport:
        parameters["sport"] = sport["id"]
    elif parameters["scope"] == "upcoming" and re.search(r"\bспортзал\w*\b", query):
        parameters["sport"] = GYM["id"]
    if explicit := re.search(r"\b\d{4}-\d{2}-\d{2}\b", text):
        try:
            parameters["date"] = CalendarDate.fromisoformat(explicit[0])
        except ValueError:
            pass
    elif "сегодня" in query:
        parameters["date"] = day
    elif "завтра" in query and day < CalendarDate.max:
        parameters["date"] = day + timedelta(days=1)
    for period, pattern in (
        ("morning", r"\bутром?\b"),
        ("afternoon", r"\bднем\b"),
        ("evening", r"\bвечером?\b"),
    ):
        if re.search(pattern, query):
            parameters["period"] = period
            break
    return parameters


def _clock(minutes):
    return f"{minutes // 60:02}:{minutes % 60:02}"


def _record_session(record, sport):
    return {
        **{field: record[field] for field in ("id", "date", "time", "end", "status")},
        "sport": sport["id"],
        "name": sport["name"],
        "short": sport["short"],
        "venue": sport["venue"],
    }


def sport_sessions(owner, day, parameters):
    data = {"sessions": [], "upcoming": []}
    selected = None
    if parameters.sport:
        selected = (
            GYM
            if normalize(parameters.sport) in {"gym", "спортзал"}
            else _find_sport(parameters.sport)
        )
    if parameters.sport and not selected:
        return data
    if day > SPORTS_END:
        return data
    now = datetime.now(MOSCOW)
    check_time = now.strftime("%H:%M") if now.date() == day else "00:00"
    with connect() as con:
        history = [row for row in records(con) if row["kind"] == "booking"]
    if parameters.scope != "available":
        upcoming = []
        for row in history:
            sport = SPORTS.get(row.get("sport"))
            if sport is None and row.get("short") == GYM["short"]:
                sport = GYM
            if (
                sport is not None
                and (selected is None or selected["id"] == sport["id"])
                and row["owner"] == owner
                and row["status"] in {"pending", "approved"}
                and (row["date"], row["time"]) >= (day.isoformat(), check_time)
                and (parameters.date is None or row["date"] == parameters.date.isoformat())
            ):
                upcoming.append(_record_session(row, sport))
        data["upcoming"] = sorted(upcoming, key=lambda row: (row["date"], row["time"]))[:5]
    if (
        parameters.scope == "upcoming"
        or selected is GYM
        or (parameters.date and parameters.date < day)
    ):
        return data

    start = max(parameters.date or day, SPORTS_START)
    end = min(parameters.date or (start + timedelta(days=6)), SPORTS_END)
    directions = [selected] if selected else list(SPORTS.values())
    earliest, latest = SPORT_PERIODS.get(parameters.period, (0, 1440))
    slots = []
    for delta in range((end - start).days + 1):
        scheduled = start + timedelta(days=delta)
        for sport in directions:
            if scheduled.isoweekday() not in sport["weekdays"]:
                continue
            for minutes in sport["starts"]:
                clock = _clock(minutes)
                if not earliest <= minutes < latest or (scheduled == day and clock < check_time):
                    continue
                slot = {
                    "date": scheduled.isoformat(),
                    "time": clock,
                    "end": _clock(minutes + sport["duration"]),
                    "sport": sport["id"],
                    "short": sport["short"],
                    "name": sport["name"],
                    "venue": sport["venue"],
                    "capacity": sport["capacity"],
                }
                available, conflicting = booking_availability(
                    {**slot, "owner": owner}, sport, history
                )
                if available and not conflicting:
                    slots.append({**slot, "available": available})
    slots.sort(key=lambda slot: (slot["date"], slot["time"], slot["name"]))
    if selected is None and parameters.date is None:
        by_sport = {}
        for slot in slots:
            by_sport.setdefault(slot["sport"], slot)
        slots = list(by_sport.values())
    data["sessions"] = slots[:8]
    return data
