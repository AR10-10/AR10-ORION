from __future__ import annotations


def prepared_feed() -> dict[str, str | bool]:
    return {"name": "Binance Public", "enabled": False, "mode": "READ_ONLY"}
