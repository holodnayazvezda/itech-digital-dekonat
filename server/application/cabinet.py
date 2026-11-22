from server.core import clock
from server.infrastructure.security import wifi as wifi_store
from server.security.auth import User
from server.application.housing import housing_account
from server.infrastructure.persistence.store import DATA, PEOPLE, connect, records
from server.application.teaching import lesson_changes, schedule_revision, teaching_rosters

from server.application.academics import elective_state


def cabinet_snapshot(user: str, wifi_cipher):
    """Возвращает свои заявки, выплаты, сведения о проживании и оплате общежития, сообщения и уведомления. Деканат видит общую очередь заявок. Подтверждённая занятость помещений и аватары доступны участникам."""
    with connect() as con:
        all_records = records(con)
        return dict(
            clock=clock.snapshot(),
            owner=user,
            scheduleRevision=schedule_revision(con),
            lessonChanges=[
                {**change, "lesson": {**change["lesson"], "changeReason": None}}
                for change in lesson_changes(con).values()
            ],
            grades=DATA["grades"].get(user, []),
            role=PEOPLE[user]["role"],
            records=[r for r in all_records if user == "office" or r["owner"] == user],
            notes=[
                dict(r)
                for r in con.execute(
                    """SELECT n.*, r.note_id IS NOT NULL AS read FROM inbox_notes n
                       LEFT JOIN note_reads r ON r.note_id=n.id
                       WHERE n.owner=? ORDER BY n.id DESC""",
                    (user,),
                )
            ],
            teachingGroups=[
                {"group": group, "recipients": len(members)}
                for group, members in sorted(teaching_rosters(user).items())
            ],
            messages=[
                dict(r)
                for r in con.execute(
                    "SELECT * FROM messages WHERE recipient=? OR sender=? ORDER BY id",
                    (user, user),
                )
                if r["sender"] in PEOPLE and r["recipient"] in PEOPLE
            ],
            reservations=[
                dict(
                    short=r["short"],
                    date=r["date"],
                    time=r["time"],
                    end=r["end"],
                    sport=r.get("sport"),
                    by="Занятое место"
                    if r.get("sport") or r["short"] == DATA["gym"]["short"]
                    else PEOPLE.get(r["owner"], {}).get("name", "Занятое помещение"),
                )
                for r in all_records
                if r["kind"] == "booking" and r["status"] == "approved"
            ],
            wifi=wifi_store.read(con, user, wifi_cipher),
            housing=housing_account(user, all_records),
            payments=DATA["payments"].get(user, {}),
            avatars=dict(con.execute("SELECT owner,data FROM avatars")),
            electives=elective_state(con, user) if PEOPLE[user]["role"] == "student" else None,
        )
