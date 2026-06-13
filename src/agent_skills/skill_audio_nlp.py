from __future__ import annotations


def audio_urgency() -> dict[str, float | str]:
    return {"skill": "audio_nlp", "urgency": 0.22, "source": "squawk_fed_prepared"}
