from __future__ import annotations


def macro_trend_state() -> dict[str, float | str]:
    return {
        "module": "cortex_rnn_backbone",
        "trend": "stable_watch",
        "hidden_state_pulse": 0.58,
        "confidence": 0.64,
    }
