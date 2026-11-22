import base64
import json
import logging
import os
import re
from urllib.parse import urlsplit

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
)
from pywebpush import WebPushException, webpush
from requests.exceptions import RequestException

from .errors import fail
from .store import connect


def keys(con):
    stored = con.execute("SELECT value FROM push_keys WHERE id=1").fetchone()
    if stored:
        return json.loads(stored[0])
    key = ec.generate_private_key(ec.SECP256R1())

    def encode(b):
        return base64.urlsafe_b64encode(b).decode().rstrip("=")

    pair = dict(
        publicKey=encode(
            key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        ),
        privateKey=encode(key.private_numbers().private_value.to_bytes(32, "big")),
    )
    con.execute("INSERT INTO push_keys VALUES(1,?)", (json.dumps(pair),))
    return pair


def subscribe(con, user, s):
    try:
        url = urlsplit(s.endpoint)
        public_key = base64.urlsafe_b64decode(s.keys.p256dh.rstrip("=") + "=")
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), public_key)
    except ValueError:
        fail("Проверьте адрес службы и ключ браузерной подписки")
    valid = re.fullmatch(
        r"(fcm\.googleapis\.com|([a-z0-9-]+\.)*(push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com))",
        url.netloc,
    )
    if url.scheme != "https" or not valid:
        fail("Неподдерживаемая служба Web Push")
    con.execute(
        "INSERT OR REPLACE INTO subscriptions VALUES(?,?,?)",
        (s.endpoint, user, s.model_dump_json(exclude_none=True)),
    )


def deliver(note_id):
    with connect(True) as con:
        notification = con.execute("SELECT owner,title FROM inbox_notes WHERE id=?", (note_id,)).fetchone()
        if not notification:
            return
        user, title = notification
        subscriptions = list(
            con.execute("SELECT value FROM subscriptions WHERE owner=?", (user,))
        )
        if not subscriptions:
            return
        raw = keys(con)["privateKey"]
    for row in subscriptions:
        sub = json.loads(row[0])
        try:
            webpush(
                sub,
                json.dumps(
                    dict(
                        id=note_id, owner=user, title=title,
                        body="Откройте цифровой деканат, чтобы прочитать уведомление.",
                    )
                ),
                vapid_private_key=raw,
                vapid_claims={
                    "sub": os.getenv(
                        "CAMPUS_VAPID_SUBJECT", "mailto:campus-demo@example.org"
                    )
                },
                ttl=86400,
                timeout=7.5,
            )
        except (WebPushException, RequestException, ValueError) as exc:
            if getattr(exc, "response", None) is not None and exc.response.status_code in (404, 410):
                with connect(True) as con:
                    con.execute(
                        "DELETE FROM subscriptions WHERE endpoint=? AND owner=? AND value=?",
                        (sub["endpoint"], user, row[0]),
                    )
            else:
                logging.getLogger(__name__).warning(
                    "Web Push delivery failed: notice=%s provider=%s status=%s error=%s",
                    note_id, urlsplit(sub["endpoint"]).hostname,
                    getattr(getattr(exc, "response", None), "status_code", None), type(exc).__name__,
                )
