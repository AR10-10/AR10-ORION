from __future__ import annotations


def gateway_status() -> dict[str, bool | str]:
    return {
        "gateway": "MT5",
        "mode": "READ_ONLY",
        "connected": False,
        "execution_enabled": False,
        "reason": "Human gate required before any broker action.",
    }
