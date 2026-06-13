from __future__ import annotations


def cortisol_state(drawdown: float = 0.0, feed_drift: float = 0.18) -> dict[str, float | str]:
    cortisol = min(1.0, max(0.0, drawdown * 2.2 + feed_drift * 0.9))
    return {
        "module": "amygdala_stress",
        "state": "blocked_safe" if cortisol >= 0.66 else "watch",
        "cortisol": round(cortisol, 3),
        "drawdown_input": round(drawdown, 3),
        "feed_drift_input": round(feed_drift, 3),
    }
