from datetime import datetime
from zoneinfo import ZoneInfo

TIMEZONE = "Europe/Moscow"


def now():
    return datetime.now(ZoneInfo(TIMEZONE))


def snapshot():
    current = now()
    return {"now": current.isoformat(), "date": current.date().isoformat(), "timezone": TIMEZONE}
