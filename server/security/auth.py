from server.core.paths import ASSETS
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from pathlib import Path
from threading import BoundedSemaphore
from typing import Annotated
from uuid import uuid4

import jwt
from cryptography.exceptions import InvalidKey
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from server.infrastructure.persistence.store import PEOPLE, connect

scheme = HTTPBearer(
    scheme_name="CampusJWT",
    bearerFormat="JWT",
    auto_error=False,
    description="Вставьте только значение token из POST /api/campus/login. Swagger сам добавит Bearer.",
)
TTL = 8 * 3600
ISS = "campus-atlas"
AUD = "campus-api"
PRODUCTION = os.getenv("CAMPUS_MODE", "demo") == "production"


def configuration():
    mode = os.getenv("CAMPUS_MODE", "demo")
    if mode not in {"demo", "production"}:
        raise RuntimeError("CAMPUS_MODE: demo или production")
    secret = os.getenv("CAMPUS_JWT_SECRET", "")
    if secret and len(secret.encode()) < 32:
        raise RuntimeError("CAMPUS_JWT_SECRET должен содержать минимум 32 байта")
    if PRODUCTION:
        if not secret:
            raise RuntimeError("Укажите CAMPUS_JWT_SECRET")
        credentials = json.loads(Path(os.environ["CAMPUS_ACCOUNTS_FILE"]).read_text())
        credentials.pop("rector", None)  # Retired profile in older account files.
        if not credentials or any(
            k not in PEOPLE or not valid_hash(v) for k, v in credentials.items()
        ):
            raise RuntimeError("Некорректный файл учётных записей")
    else:
        demo = json.loads((ASSETS / "demo-access.json").read_text())
        hashed = password_hash(demo["password"])
        credentials = dict.fromkeys(PEOPLE, hashed)
    with connect() as con:
        return secret or con.execute(
            "SELECT value FROM settings WHERE name='demo_signing_key'"
        ).fetchone()[0], credentials


def valid_hash(s):
    return isinstance(s, str) and bool(
        re.fullmatch(r"\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}", s)
        or re.fullmatch(r"[a-fA-F0-9]{32}:[a-fA-F0-9]{128}", s)
    )


def password_hash(password):
    kdf = Argon2id(
        salt=secrets.token_bytes(16), length=32, iterations=3, lanes=1, memory_cost=65536
    )
    return kdf.derive_phc_encoded(password.encode())


def verify_password(password, saved):
    if saved.startswith("$argon2id$"):
        try:
            Argon2id.verify_phc_encoded(password.encode(), saved)
            return True
        except (ValueError, InvalidKey):
            return False
    salt, digest = saved.split(":")
    candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return hmac.compare_digest(candidate, bytes.fromhex(digest))


# Bound memory used by concurrent password checks (64 MiB per Argon2id call).
password_slots = BoundedSemaphore(2)
dummy_hash = password_hash(secrets.token_hex(32))


def issue(app, login):
    saved = app.state.accounts.get(login.role)
    if not password_slots.acquire(blocking=False):
        raise HTTPException(429, "Повторите вход позднее", headers={"Retry-After": "2"})
    try:
        valid = verify_password(login.password or "", saved or dummy_hash)
    finally:
        password_slots.release()
    if not valid or not saved:
        raise HTTPException(401, "Неверный кабинет или пароль")
    if login.role not in PEOPLE:
        raise HTTPException(401, "Неверный кабинет или пароль")
    now = int(time.time())
    payload = dict(sub=login.role, iss=ISS, aud=AUD, iat=now, exp=now + TTL, jti=str(uuid4()))
    return dict(token=jwt.encode(payload, app.state.secret, algorithm="HS256"), expires_in=TTL)


def identity(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(scheme)):
    try:
        if not credentials:
            raise ValueError()
        claims = jwt.decode(
            credentials.credentials,
            request.app.state.secret,
            algorithms=["HS256"],
            issuer=ISS,
            audience=AUD,
            options={"require": ["sub", "iat", "exp", "iss", "aud", "jti"]},
        )
        with connect() as con:
            revoked = con.execute("SELECT 1 FROM revoked WHERE jti=?", (claims["jti"],)).fetchone()
        if (
            revoked
            or claims["sub"] not in PEOPLE
            or (PRODUCTION and claims["sub"] not in request.app.state.accounts)
        ):
            raise ValueError()
        return claims
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            401, "Войдите в кабинет повторно", headers={"WWW-Authenticate": "Bearer"}
        )


def owner(claims: dict = Depends(identity)):
    return claims["sub"]


Claims = Annotated[dict, Depends(identity)]
User = Annotated[str, Depends(owner)]
