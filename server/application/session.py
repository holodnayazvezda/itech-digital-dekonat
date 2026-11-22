"""Session lifecycle use cases."""

import time
from server.infrastructure.persistence.store import connect


def revoke_session(claims):
    with connect(True) as con:
        con.execute("DELETE FROM revoked WHERE exp<=?", (int(time.time()),))
        con.execute("INSERT OR IGNORE INTO revoked VALUES(?,?)", (claims["jti"], claims["exp"]))
