from __future__ import annotations


def decode_order_flow() -> dict[str, float | str]:
    return {"skill": "order_flow", "imbalance": 0.18, "cvd_bias": "neutral_positive"}
