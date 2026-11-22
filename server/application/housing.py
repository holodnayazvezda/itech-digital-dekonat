"""Owner-scoped residence data for the demonstration semester."""

from server.infrastructure.persistence.store import DATA

MOVE_IN = "Заселение в общежитие"


def active_application(owner, requests):
    return next(
        (
            r
            for r in requests
            if r["owner"] == owner
            and r["name"] == MOVE_IN
            and r["status"] in {"pending", "clarification", "approved"}
        ),
        None,
    )


def housing_account(owner, requests):
    if owner in DATA["housing"]:
        return DATA["housing"][owner]
    # A resident approved through the office starts with an empty ledger.
    for r in requests:
        if r["owner"] == owner and r["name"] == MOVE_IN and r["status"] == "approved":
            return {
                "building": r["details"]["Общежитие"],
                "room": None,
                "start": r["details"]["Дата начала"],
                "charges": [],
            }
    return None
