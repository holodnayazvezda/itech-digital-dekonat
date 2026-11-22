"""Canonical resource paths, independent of the working directory."""

from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parents[1]
ASSETS = SERVER_ROOT / "assets"
STATIC = SERVER_ROOT / "static"
CLIENT_DIST = SERVER_ROOT.parent / "client" / "dist"
