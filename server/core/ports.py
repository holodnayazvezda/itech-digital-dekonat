"""Small external-effect contracts used by application services."""

from typing import Any, Callable, Protocol


class TaskScheduler(Protocol):
    def add_task(self, function: Callable[..., Any], *args: Any, **kwargs: Any) -> None: ...
