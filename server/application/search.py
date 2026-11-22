from server.core.paths import ASSETS

"""Account-scoped lexical search aligned with the browser search rules."""
import json
import re
from collections import defaultdict
from pathlib import Path

from server.infrastructure.persistence.store import DATA, PEOPLE

NAME_GROUPS = tuple(
    frozenset(group.split())
    for group in json.loads((ASSETS / "search-names.json").read_text(encoding="utf-8"))
)
TEACHER_IDS = {person["name"]: key for key, person in PEOPLE.items() if person["role"] == "teacher"}
MAX_SUBJECT_TEACHERS = 12
SUBJECT_CASE_ENDINGS = (
    "ыми",
    "ими",
    "ому",
    "ему",
    "ого",
    "его",
    "ами",
    "ями",
    "ая",
    "яя",
    "ое",
    "ее",
    "ые",
    "ие",
    "ый",
    "ий",
    "ой",
    "ых",
    "их",
    "ам",
    "ям",
    "ах",
    "ях",
    "ом",
    "ем",
    "ую",
    "юю",
    "ов",
    "ев",
    "ей",
    "а",
    "я",
    "ы",
    "и",
    "е",
    "о",
    "у",
    "ю",
)


def normalize(value):
    return re.sub(r"[\W_]+", " ", (value or "").lower().replace("ё", "е")).strip()


def one_edit(first, second):
    if abs(len(first) - len(second)) > 1:
        return False
    if len(first) > len(second):
        first, second = second, first
    if len(first) == len(second):
        return sum(a != b for a, b in zip(first, second)) <= 1
    for i, (a, b) in enumerate(zip(first, second)):
        if a != b:
            return first[i:] == second[i + 1 :]
    return True


def search_score(query, value, names=False):
    query, value = normalize(query), normalize(value)
    if not query:
        return 0
    if query == value:
        return 120
    if query in value:
        return 100
    words = value.split()
    scores = []
    for token in query.split():
        variants = {token}
        if names:
            for group in NAME_GROUPS:
                if token in group:
                    variants.update(group)
        if variants.intersection(words):
            scores.append(90)
        elif any(word.startswith(tuple(variants)) for word in words):
            scores.append(80)
        elif len(token) >= 4 and any(one_edit(word, token) for word in words):
            scores.append(55)
        else:
            return 0
    return sum(scores) / len(scores)


def room_code(value):
    return normalize(value).replace(" ", "").translate(str.maketrans("hbnaва", "нбннбн"))


def _subject_stems(value):
    return tuple(
        next(
            (
                word[: -len(ending)]
                for ending in SUBJECT_CASE_ENDINGS
                if word.endswith(ending) and len(word) - len(ending) >= 3
            ),
            word,
        )
        for word in normalize(value).split()
    )


def _subject_score(query, title):
    source, target = _subject_stems(query), _subject_stems(title)
    if source and source == target:
        return 110
    if source and set(source).issubset(target):
        return 85
    return 0


def _service_matches(role):
    sections = [
        ("booked", "Мои заявки", "Заявки и решения деканата"),
        (
            "finance",
            "Заработная плата" if role == "teacher" else "Стипендия",
            "Начисления и график выплат",
        ),
        ("wifi", "Wi-Fi кампуса", "Подключение к сети кампуса"),
        ("navigator", "Навигатор", "Карта, корпуса и маршруты"),
        ("directory", "Люди", "Студенты, преподаватели и сотрудники"),
        ("dorm", "Общежития", "Проживание, оплата и контакты"),
    ]
    if role in {"student", "teacher"}:
        sections += [
            ("spaces", "Бронирование помещений", "Аудитории и коворкинги"),
            ("sports", "Спорт", "Расписание и запись в спортзал"),
        ]
    if role == "student":
        sections += [
            ("docs", "Документы и заявления", "Каталог услуг студенческого офиса"),
            ("electives", "Выбор дисциплин", "Курсы на следующий семестр"),
        ]
    for view, name, detail in sections:
        yield view, name, detail, detail, {"serviceView": view}
    if role == "student":
        for service in DATA["services"]:
            yield (
                service["name"],
                service["name"],
                "Справка" if service["certificate"] else "Заявление",
                "",
                {"serviceView": "service-request"},
            )


def _subject_matches(lessons, day):
    subjects = defaultdict(list)
    for lesson in lessons:
        subjects[lesson["name"]].append(lesson)

    for name, rows in subjects.items():
        active = [lesson for lesson in rows if not lesson.get("cancelled")]
        relevant = active or rows
        anchor = day or relevant[0]["date"]
        example = min(
            relevant,
            key=lambda lesson: (
                lesson["date"] < anchor,
                abs((lesson["date"] - anchor).days),
                lesson["time"],
            ),
        )
        teacher = example["teacher"]
        names = dict.fromkeys([teacher, *(lesson["teacher"] for lesson in relevant)])
        teachers = [
            {"name": person, "id": TEACHER_IDS.get(person)}
            for person in list(names)[:MAX_SUBJECT_TEACHERS]
        ]
        data = {
            **{
                field: example[field]
                for field in ("teacher", "room", "group", "time", "end", "floor")
            },
            "teacherId": TEACHER_IDS.get(teacher),
            "teachers": teachers,
            "teacherTotal": len(names),
            "date": example["date"].isoformat(),
            "lessonId": example["id"],
            "cancelled": bool(example.get("cancelled")),
            "changed": bool(example.get("changed")),
        }
        if building := example.get("building"):
            data["building"] = {
                field: building[field]
                for field in ("name", "short", "address")
                if field in building
            }
        yield name, name, example["type"], " ".join(names), data


def _person_matches():
    return (
        (
            key,
            person["name"],
            person.get("title") or person["unit"],
            person.get("number", ""),
            {"role": person["role"], "unit": person["unit"]},
        )
        for key, person in PEOPLE.items()
    )


def _room_matches():
    for room in DATA["rooms"]:
        building = {
            field: room["building"][field]
            for field in ("name", "short", "address")
            if field in room["building"]
        }
        detail = f"{building['name']} · {room['floorName']}"
        data = {
            "room": room["short"],
            "building": building,
            "floor": room["floor"],
            "floorName": room["floorName"],
            "kind": room["kind"],
            "capacity": room["capacity"],
        }
        if equipment := room.get("meta", "").partition(" · ")[2]:
            data["equipment"] = equipment
        yield room["short"], room["name"], detail, room["short"], data


def campus_search(query, category, lessons, role, day=None):
    sources = {
        "people": _person_matches(),
        "rooms": _room_matches(),
        "services": _service_matches(role),
        "subjects": _subject_matches(lessons, day),
    }
    result = []
    for name, items in sources.items():
        if category not in ("all", name):
            continue
        ranked = []
        for key, label, detail, extra, metadata in items:
            score = max(
                search_score(query, label, names=name == "people"),
                search_score(query, f"{label} {extra}", names=name == "people"),
            )
            if name == "subjects":
                score = max(score, _subject_score(query, label))
            if name == "rooms" and room_code(query) == room_code(extra):
                score = 130
            if score:
                ranked.append(
                    (
                        score,
                        label,
                        {"category": name, "id": key, "name": label, "detail": detail, **metadata},
                    )
                )
        result.extend(row[2] for row in sorted(ranked, key=lambda row: (-row[0], row[1]))[:4])
    return {"matches": result}
