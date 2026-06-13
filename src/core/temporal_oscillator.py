from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class TemporalOscillator:
    base_hz: float = 1.0

    def current_rate(self, now: datetime | None = None, volatility: float = 0.35) -> dict[str, float | str]:
        now = now or datetime.now()
        hour = now.hour
        session_bias = 1.25 if 9 <= hour <= 18 else 0.72
        rate = round(max(0.2, min(5.0, self.base_hz * session_bias * (1.0 + volatility))), 3)
        return {
            "clock": now.isoformat(timespec="seconds"),
            "rate_hz": rate,
            "session_bias": round(session_bias, 3),
            "volatility_input": round(volatility, 3),
        }
