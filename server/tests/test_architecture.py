"""Guard architectural boundaries rather than file-count or naming conventions."""

import ast
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1]


def test_application_and_assistant_have_no_http_framework_or_api_dependencies():
    for directory in ("application", "assistant"):
        for path in (SERVER / directory).glob("*.py"):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                modules = (
                    [node.module or ""]
                    if isinstance(node, ast.ImportFrom)
                    else [alias.name for alias in node.names]
                    if isinstance(node, ast.Import)
                    else []
                )
                for module in modules:
                    assert not module.startswith(("fastapi", "starlette", "server.api")), (
                        path,
                        module,
                    )


def test_infrastructure_does_not_import_http_routes():
    for path in (SERVER / "infrastructure").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom):
                assert not (node.module or "").startswith("server.api"), path
