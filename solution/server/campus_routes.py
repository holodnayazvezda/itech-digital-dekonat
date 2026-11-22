import json
import re
from functools import lru_cache
from pathlib import Path

from .campus_search import normalize, room_code
from .store import DATA

ROOM_DATA = {room["short"]: room for room in DATA["rooms"]}
BUILDING_ADDRESSES = {
    room["building"]["name"]: room["building"]["address"]
    for room in DATA["rooms"] if room["building"].get("address")
}


class RouteLookupError(ValueError):
    pass


@lru_cache(maxsize=1)
def _atlas():
    root = Path(__file__).resolve().parent
    for directory in ("assets",):
        try:
            with (root / directory / "campus-map.json").open(encoding="utf-8") as file:
                return json.load(file)["buildings"]
        except FileNotFoundError:
            continue
        except (OSError, ValueError, KeyError) as error:
            raise RouteLookupError("Карта кампуса временно недоступна.") from error
    raise RouteLookupError("Карта кампуса временно недоступна.")


def _room_number(value):
    code = re.sub(r"\s+", "", normalize(value))
    if re.fullmatch(r"[абвнabhn]?\d{2,4}", code):
        return room_code(code)
    return ""


def _query_room_number(value):
    return _room_number(re.sub(r"^(?:аудитор\w*|кабинет\w*|ауд)\s+", "", normalize(value)))


def is_room_lookup(value):
    return bool(_query_room_number(value))


def is_sport_booking_destination(value):
    return bool(re.fullmatch(
        r"(?:(?:мо[яюей]|сво[яюей]|то[йю]|ближайш\w*|следующ\w*)\s+){0,2}"
        r"(?:спортивн\w*\s+)?(?:тренировк\w*|запись\s+на\s+спорт)"
        r"(?:\s+(?:на\s+)?которую\s+(?:я\s+)?(?:записал\w*|забронировал\w*))?",
        normalize(value),
    ))


def _entries(buildings):
    return [(building, floor, place) for building in buildings for floor in building["floors"]
            for place in floor["places"] if place.get("node")]


def _entrance(entries, building):
    return next((entry for entry in entries if entry[0] is building and entry[2]["kind"] == "entrance"), None)


def _building_name(value):
    name = re.sub(r"^вход\w*(?:\s+в)?\s+", "", normalize(value))
    name = re.sub(r"^корпус[ае]\s+", "корпус ", name)
    return re.sub(r"^корпус\s+([вbаa])$", lambda match: "корпус " + match[1].translate(str.maketrans("вba", "бба")), name)


def _resolve(entries, value):
    text = normalize(value)
    number = _query_room_number(text)
    text = {
        "деканата": "деканат", "студенческого офиса": "студенческий офис",
        "спортзала": "спортзал", "спортивный зал": "спортзал",
        "тренажерный зал": "спортзал", "тренажерного зала": "спортзал",
    }.get(text, text)
    if number:
        matches = []
        for entry in entries:
            place = entry[2]
            codes = [code for label in [place.get("code"), *place.get("aliases", [])] if (code := _room_number(label))]
            if number in codes or number.isdigit() and any(code[1:] == number for code in codes):
                matches.append(entry)
    else:
        matches = [entry for entry in entries if text in {
            normalize(label) for label in (entry[2]["id"], entry[2]["name"], entry[2].get("label"), *entry[2].get("aliases", []))
        }]
        if not matches:
            matches = [entry for entry in entries if entry[2]["kind"] == "entrance" and _building_name(text) in {
                _building_name(label) for label in (entry[0]["name"], *entry[0].get("aliases", []))
            }]
    if len(matches) > 1:
        raise RouteLookupError(f"Уточните корпус или номер для точки «{value}».")
    if not matches:
        raise RouteLookupError(f"Точка «{value}» не найдена на карте кампуса.")
    return matches[0]


def _endpoint(entry):
    building, floor, place = entry
    room = ROOM_DATA.get(place.get("code"), {})
    data = {
        "id": place["id"], "name": place["name"], "code": place.get("code"),
        "buildingId": building["id"], "building": building["name"],
        "floorId": floor["id"], "floor": floor["name"],
    }
    public_fields = {
        "address": building.get("address") or BUILDING_ADDRESSES.get(building["name"]),
        "capacity": room.get("capacity", place.get("seats")),
        "equipment": place.get("equipment") or room.get("meta", "").partition(" · ")[2],
    }
    data.update({field: value for field, value in public_fields.items() if value is not None and value != ""})
    return data


def place_endpoint(value):
    return _endpoint(_resolve(_entries(_atlas()), value))


def route_endpoints(destination, origin=None):
    entries = _entries(_atlas())
    target = _resolve(entries, destination)
    start = _resolve(entries, origin) if origin else _entrance(entries, target[0])
    if not start:
        raise RouteLookupError("Укажите начальную точку, для этого корпуса нет входа на карте.")
    if start[2]["id"] == target[2]["id"]:
        raise RouteLookupError("Укажите разные начальную и конечную точки.")
    return {"from": _endpoint(start), "to": _endpoint(target)}


def requested_route(text):
    phrase = re.sub(r"\s+на\s+карте(?:\s+кампуса)?(?=\s|$)", "", text.strip().rstrip(" ?!."), flags=re.IGNORECASE)
    expression = re.fullmatch(
        r"(?:(?:(?:постро(?:й\w*|ить)|покажи\w*|проложи\w*)\s+(?:мне\s+)?)?маршрут|"
        r"как\s+(?:мне\s+)?(?:пройти|дойти|добраться|попасть))\s+(.+)",
        phrase,
        re.IGNORECASE,
    )
    if not expression:
        return None
    locations = expression[1]
    for separator in ("до|к", "в|на"):
        if pair := re.fullmatch(rf"(?:от|из)\s+(.+?)\s+(?:{separator})\s+(.+)", locations, re.IGNORECASE):
            return {"from": pair[1], "to": pair[2]}
    return {"to": re.sub(r"^(?:до|к|в|на)\s+", "", locations, flags=re.IGNORECASE)}


def requested_place(text):
    value, described = re.subn(
        r"^(?:(?:где(?:\s+находится)?|как\s+найти|покажи\w*|найди\w*)(?:\s+мне)?\s+(?:где\s+)?)",
        "",
        text.strip().rstrip(" ?!."),
        flags=re.IGNORECASE,
    )
    target, explicit_map = re.subn(
        r"^на\s+карте(?:\s+кампуса)?\s+|\s+на\s+карте(?:\s+кампуса)?$",
        "",
        value,
        flags=re.IGNORECASE,
    )
    if not 1 <= len(target) <= 120:
        return None
    if explicit_map or is_room_lookup(target) or described and is_sport_booking_destination(target) or re.fullmatch(
        r"(?:спортзал\w*|(?:спортивный|тренажерный) зал|деканат\w*|студенчески\w* офис\w*|(?:вход\s+(?:в\s+)?)?корпус\w*\s+[абвab])",
        normalize(target),
    ):
        return {"query": target}
    return None
