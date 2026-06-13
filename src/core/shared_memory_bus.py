from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any


@dataclass
class SharedMemoryBus:
    """Small in-process bus used by the v1 cockpit before real IPC is enabled."""

    _topics: dict[str, Any] = field(default_factory=dict)
    _lock: Lock = field(default_factory=Lock)

    def publish(self, topic: str, payload: Any) -> None:
        with self._lock:
            self._topics[topic] = {
                "topic": topic,
                "payload": payload,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._topics)


BUS = SharedMemoryBus()
