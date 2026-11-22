import re
import unicodedata

from .sports import SPORTS

MAX_TITLE_LENGTH = 56
DEFAULT_TITLE = "Новый чат"
ROOM_CODE = re.compile(r"\b[АБВНABHN][\s\-‐‑–—]*\d{2,4}\b", re.IGNORECASE)
ROUTE_WORDS = re.compile(r"\b(?:маршрут\w*|как\s+(?:мне\s+)?(?:пройти|дойти|добраться|попасть))\b")
GYM_WORDS = re.compile(r"\b(?:спортзал\w*|(?:спортивн|тренажерн)\w*\s+зал\w*)\b")
SPORT_WORDS = re.compile(r"\b(?:спорт\w*|тренировк\w*|секци\w*)\b")
BOOK_WORDS = re.compile(r"\b(?:запиш\w*|запис\w*|заброниру\w*|брон\w*|хочу)\b")
TEACHER_WORDS = re.compile(r"\b(?:преподавател\w*|лектор\w*|кто\b.{0,40}\b(?:ведет|ведут|преподает|преподают))\b")
SCHEDULE_WORDS = re.compile(r"\b(?:расписани\w*|пар(?:а|ы|е|у|ам)?|заняти\w*|лекци\w*)\b")
DOCUMENT_WORDS = re.compile(r"\b(?:справк\w*|документ\w*|выписк\w*|pdf)\b")
SENSITIVE_WORDS = re.compile(
    r"\b(?:парол\w*|токен\w*|password|bearer|снилс|паспорт\w*|api\s+key|ключ\s+(?:api|апи|glm)|"
    r"pin\s+код|пин\s+код)\b"
)
REDACTED = re.compile(
    r"(?i)(?:\b(?:https?://|www\.)[^\s<>]+|(?<!\w)(?:~?/)(?:[^\s/]+/)+[^\s]+|"
    r"\b[\w.+-]+@[\w.-]+\.[a-zа-я]{2,}\b|\b[a-z0-9_-]{18,}\.[a-z0-9_-]{8,}\b|"
    r"\b[a-z0-9_-]{28,}\b|(?:\+\d\s*)?\b(?:\d[() .-]*){10,15}\b)"
)
SUBJECT_TOPICS = (
    (r"\bматематик\w*\b", "математике"),
    (r"\bстатистик\w*\b", "статистике"),
    (r"\bиностранн\w*\s+язык\w*\b", "иностранному языку"),
    (r"\bанализ\w*\s+данн\w*\b", "анализу данных"),
)
SPORT_CASES = {"athletics": "лёгкую атлетику", "aqua": "аквааэробику", "dance": "танцы"}


def _words(text):
    return " ".join(re.findall(r"[^\W_]+", text.lower().replace("ё", "е")))


def _room_code(value):
    if not isinstance(value, str) or not ROOM_CODE.fullmatch(value):
        return ""
    number = re.search(r"\d+", value)[0]
    letter = value[0].upper().translate(str.maketrans("ABHNВА", "НБННБН"))
    return f"{letter}-{number}"


def _clean_source(text):
    source = unicodedata.normalize("NFKC", text)
    source = "".join(char for char in source if char.isspace() or not unicodedata.category(char).startswith("C"))
    source = REDACTED.sub(" ", source)
    return [line.strip() for line in source.splitlines() if line.strip()]


def _block_data(reply):
    blocks = reply.get("blocks") if isinstance(reply, dict) else None
    if not isinstance(blocks, list):
        return {}
    return {
        block["type"]: block
        for block in blocks
        if isinstance(block, dict) and isinstance(block.get("type"), str)
    }


def _caption_room(query, block):
    point = block.get("to") or block.get("place") or {}
    if code := _room_code(point.get("code")):
        return code
    for code in reversed(ROOM_CODE.findall(query)):
        if formatted := _room_code(code):
            return formatted
    return ""


def _sport_for_title(query, block):
    matches = []
    for key, item in SPORTS.items():
        label = _words(item["name"])
        accusative = SPORT_CASES.get(key, re.sub(r"а$", "у", item["name"].lower()))
        if any(f" {value} " in f" {query} " for value in (label, _words(accusative))):
            matches.append((len(label), accusative))
    if matches:
        return max(matches)[1]
    sessions = block.get("sessions", [])
    keys = {item.get("sport") for item in sessions if isinstance(item, dict)}
    if len(keys) == 1 and (sport := next(iter(keys))) in SPORTS and not SPORT_WORDS.search(query):
        label = SPORTS[sport]["name"].lower()
        return SPORT_CASES.get(sport, re.sub(r"а$", "у", label))
    return ""


def _subject_title(prefix, query, search):
    names = {
        match["name"] for match in search.get("matches", [])
        if isinstance(match, dict) and match.get("category") == "subjects" and isinstance(match.get("name"), str)
    }
    subject = next(iter(names)) if len(names) == 1 else ""
    for pattern, dative in SUBJECT_TOPICS:
        if re.search(pattern, query) or (subject and re.search(pattern, _words(subject))):
            return f"{prefix} по {dative}"
    return f"{prefix} · {subject}" if subject and not REDACTED.search(subject) else prefix


def _topic(source, query, blocks):
    route = blocks.get("route", {})
    place = blocks.get("place", {})
    if GYM_WORDS.search(query) and re.search(r"\bкак\s+(?:мне\s+)?найти\b", query):
        return "Маршрут до спортзала"
    if ROUTE_WORDS.search(query) or route:
        destination = re.split(r"\b(?:до|к)\s+", source, maxsplit=1, flags=re.IGNORECASE)[-1]
        point_name = (route.get("to") or {}).get("name", "")
        place_words = _words(point_name or destination)
        if GYM_WORDS.search(place_words):
            return "Маршрут до спортзала"
        if code := _caption_room(destination, route):
            return f"Маршрут до {code}"
        if re.search(r"\bдеканат\w*\b", place_words):
            return "Маршрут до деканата"
        return "Маршрут на тренировку" if SPORT_WORDS.search(query) else "Маршрут по кампусу"
    if place or (re.search(r"\b(?:где|на карте|найди|покажи)\b", query) and ROOM_CODE.search(source)):
        if code := _caption_room(source, place):
            return f"Аудитория {code}"
        return "Спортзал на карте" if GYM_WORDS.search(query) else "Место на карте"

    if DOCUMENT_WORDS.search(query) or "documents" in blocks:
        if re.search(r"\bскач\w*\b|\bpdf\b", query):
            return "Скачивание документа"
        return "Заказ справки" if "справк" in query else "Документы и заявления"
    if TEACHER_WORDS.search(query) and not re.search(r"\b(?:найди|открой)\b.*\bпрофил\w*\b", query):
        return _subject_title("Преподаватель", query, blocks.get("search", {}))
    sports = blocks.get("sports", {})
    sport_name = _sport_for_title(query, sports)
    if (BOOK_WORDS.search(query) and (sport_name or SPORT_WORDS.search(query))) or sports:
        if re.search(r"\bмои\s+(?:записи|тренировки|спортивные заявки)\b", query):
            return "Мои тренировки"
        return f"Запись на {sport_name or 'спорт'}"
    subject = _subject_title("Расписание", query, blocks.get("search", {}))
    asks_subject_time = subject != "Расписание" and re.search(r"\b(?:когда|во сколько)\b", query)
    if SCHEDULE_WORDS.search(query) or "schedule" in blocks or asks_subject_time:
        if subject != "Расписание":
            return subject
        for pattern, label in (
            (r"\bнедел\w*\b", "Расписание на неделю"),
            (r"\bпослезавтра\b", "Расписание на послезавтра"),
            (r"\bзавтра\b", "Расписание на завтра"),
            (r"\bсегодня\b", "Расписание на сегодня"),
        ):
            if re.search(pattern, query):
                return label
        return subject
    for pattern, label in (
        (r"\b(?:домашк\w*|домашн\w*\s+задани\w*|дз)\b", "Домашнее задание"),
        (r"\b(?:оценк\w*|зачетк\w*|успеваемост\w*)\b", "Оценки и зачётка"),
        (r"\b(?:статус\w*\s+заявк\w*|мои заявки)\b", "Мои заявки"),
        (r"\b(?:уведомлени\w*|новости кампуса)\b", "Уведомления"),
        (r"\b(?:брониров\w*|заброниру\w*|брон\w*)\b", "Бронирование помещения"),
    ):
        if re.search(pattern, query):
            return label
    return ""


def chat_title(text, reply=None):
    if not isinstance(text, str):
        return DEFAULT_TITLE
    lines = _clean_source(text)
    source = " ".join(lines)[:240]
    query = _words(source)
    if SENSITIVE_WORDS.search(_words(text)):
        return "Доступ к кабинету"
    caption = _topic(source, query, _block_data(reply))
    if not caption:
        caption = re.sub(
            r"^(?:(?:привет|здравствуйте|подскажи(?:те)?|пожалуйста|расскажи(?:те)?|покажи(?:те)?)\b[\s,!.:—-]*)+",
            "", lines[0] if lines else "", flags=re.IGNORECASE,
        ).strip(" \t\r\n.,?!;:–—-*#")
    if not any(char.isalpha() for char in caption):
        return DEFAULT_TITLE
    caption = " ".join(caption.split())
    caption = caption[0].upper() + caption[1:]
    if len(caption) > MAX_TITLE_LENGTH:
        prefix = caption[:MAX_TITLE_LENGTH - 1]
        caption = (prefix.rsplit(" ", 1)[0] if " " in prefix else prefix).rstrip(" .,;:–—-") + "…"
    return caption
