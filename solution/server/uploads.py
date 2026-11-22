"""Shared decoding for avatars and request attachments."""

import base64
import binascii

from .errors import fail

SIGNATURES = {
    "application/pdf": b"%PDF-",
    "image/png": bytes.fromhex("89504e470d0a1a0a"),
    "image/jpeg": bytes.fromhex("ffd8ff"),
}


def decode_upload(content: str, mime: str) -> bytes:
    try:
        blob = base64.b64decode(content, validate=True)
    except (ValueError, binascii.Error):
        fail("Некорректный Base64")
    if len(blob) > 2 * 1024 * 1024:
        fail("Допустимо до 2 МиБ", 413)
    signature = SIGNATURES.get(mime)
    if signature is None or not blob.startswith(signature):
        fail("Содержимое не соответствует указанному формату")
    return blob
