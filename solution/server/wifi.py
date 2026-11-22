"""Store revealable demonstration Wi-Fi credentials encrypted at rest."""

import os
import secrets
from contextlib import closing
import tempfile
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from . import store


def new_password():
    return "campus-" + secrets.token_hex(8)


def initialize():
    key_path = Path(os.getenv("CAMPUS_WIFI_KEY_FILE") or str(store.DB) + ".wifi-key")
    with store.connect(True) as con:
        legacy = any(r["name"] == "password" for r in con.execute("PRAGMA table_info(demo_wifi)"))
        sample = None if legacy else con.execute("SELECT ciphertext FROM demo_wifi LIMIT 1").fetchone()
        try:
            key = key_path.read_bytes()
        except FileNotFoundError:
            if sample:
                raise RuntimeError("Восстановите ключ Wi-Fi из резервной копии")
            key = Fernet.generate_key()
            # Publish a complete, private key before writing credentials. SQLite's
            # write transaction serializes initialisation for this database.
            with tempfile.NamedTemporaryFile(dir=key_path.parent, delete_on_close=False) as output:
                output.write(key)
                output.flush()
                os.fsync(output.fileno())
                output.close()
                try:
                    os.link(output.name, key_path)
                except FileExistsError:
                    key = key_path.read_bytes()
        cipher = Fernet(key)
        if sample:
            try:
                cipher.decrypt(sample[0])
            except InvalidToken as error:
                raise RuntimeError("Ключ Wi-Fi не соответствует сохранённым реквизитам") from error
        if legacy:
            con.execute("PRAGMA secure_delete=ON")
            con.execute("ALTER TABLE demo_wifi RENAME TO legacy_wifi")
            con.execute("CREATE TABLE demo_wifi(owner TEXT PRIMARY KEY, ciphertext BLOB NOT NULL, ready INTEGER NOT NULL)")
            con.executemany(
                "INSERT INTO demo_wifi VALUES(?,?,?)",
                ((owner, cipher.encrypt(password.encode()), ready)
                 for owner, password, ready in con.execute("SELECT owner,password,ready FROM legacy_wifi")),
            )
            con.execute("DROP TABLE legacy_wifi")
        existing = {row[0] for row in con.execute("SELECT owner FROM demo_wifi")}
        con.executemany(
            "INSERT INTO demo_wifi VALUES(?,?,0)",
            ((owner, cipher.encrypt(new_password().encode())) for owner, person in store.PEOPLE.items()
             if owner not in existing and person["role"] in {"student", "teacher"}),
        )
    if legacy:
        with closing(store.open_connection()) as con:
            con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    return cipher


def read(con, owner, cipher):
    row = con.execute("SELECT ciphertext,ready FROM demo_wifi WHERE owner=?", (owner,)).fetchone()
    if row:
        return {"password": cipher.decrypt(row["ciphertext"]).decode(), "ready": row["ready"]}


def reset(con, owner, cipher):
    return con.execute(
        "UPDATE demo_wifi SET ciphertext=?,ready=? WHERE owner=?",
        (cipher.encrypt(new_password().encode()), store.now() + 300_000, owner),
    ).rowcount
