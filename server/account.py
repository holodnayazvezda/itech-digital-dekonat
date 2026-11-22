"""Generate or replace one account in a production password-hash file."""

import argparse
import json
import os
import tempfile
from getpass import getpass
from pathlib import Path

from .auth import password_hash
from .store import PEOPLE


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument("identity", choices=PEOPLE)
    args = parser.parse_args()
    password = getpass("Новый пароль: ")
    if not 12 <= len(password) <= 1024 or password != getpass("Повторите пароль: "):
        parser.error("Нужны совпадающие пароли длиной от 12 до 1024 символов")
    accounts = json.loads(args.file.read_text()) if args.file.exists() else {}
    accounts[args.identity] = password_hash(password)
    with tempfile.NamedTemporaryFile("w", dir=args.file.parent, delete=False) as f:
        json.dump(accounts, f)
    os.replace(f.name, args.file)


if __name__ == "__main__":
    main()
