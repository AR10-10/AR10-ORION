from __future__ import annotations


def prepared_feed() -> dict[str, str | bool]:
    return {"name": "On-Chain Data", "enabled": False, "mode": "READ_ONLY"}
