from __future__ import annotations


def risk_limiter(cortisol: float) -> dict[str, float | str]:
    multiplier = max(0.0, min(1.0, 1.0 - cortisol))
    return {"skill": "risk_mitigation", "allowed_size_multiplier": round(multiplier, 3), "mode": "blocked_execution"}
