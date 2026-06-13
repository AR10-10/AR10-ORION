from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


PUBLIC_FEEDS = [
    "Binance Public",
    "OKX Public",
    "Yahoo Finance",
    "TradingView",
    "Sentiment Feeds",
]


def public_feed_snapshot() -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    return [
        {"name": name, "mode": "READ_ONLY", "status": "prepared", "last_seen": now}
        for name in PUBLIC_FEEDS
    ]


def synchronize_timestamps(payloads: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "synchronized_at": datetime.now(timezone.utc).isoformat(),
        "count": len(payloads),
        "items": payloads,
    }
