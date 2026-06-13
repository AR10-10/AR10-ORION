from __future__ import annotations


def prepared_feed() -> dict[str, str | bool]:
    return {"name": "Yahoo Finance", "enabled": False, "mode": "READ_ONLY"}
