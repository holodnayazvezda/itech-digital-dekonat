"""Register the public API without creating an ASGI application."""

from server.api.routes.cabinet import api, health_router, schedule
from server.api.routes.requests import router as requests
from server.api.routes.communication import router as communication
from server.api.routes.office import router as office, list_tasks
from server.api.routes.assistant import create_router as conversations
from server.api.routes.assistant_mcp import create_router as mcp

api.include_router(requests)
api.include_router(communication)
api.include_router(office)
api.include_router(conversations(schedule, list_tasks))
api.include_router(mcp(schedule, list_tasks))
