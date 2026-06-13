from __future__ import annotations


def prepared_feed() -> dict[str, str | bool]:
    return {"name": "TradingView", "enabled": False, "mode": "READ_ONLY"}
