"""Profile and network credential changes, independent of HTTP."""

from server.infrastructure.persistence.store import connect
from server.infrastructure.security import wifi
from server.core.errors import fail
from server.core.uploads import decode_upload


def reset_network_password(user, cipher):
    with connect(True) as con:
        if not wifi.reset(con, user, cipher):
            fail("Сервис недоступен", 403)


def set_avatar(user, image):
    prefix = "data:image/png;base64,"
    if not image.startswith(prefix):
        fail("Требуется PNG")
    decode_upload(image[len(prefix) :], "image/png")
    with connect(True) as con:
        con.execute("INSERT OR REPLACE INTO avatars VALUES(?,?)", (user, image))
