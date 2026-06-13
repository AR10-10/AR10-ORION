from __future__ import annotations


def episodic_matches() -> list[dict[str, float | str]]:
    return [
        {"scenario": "AR10 price truth guardrail", "reuse": "risk_guard", "match_pct": 88.0},
        {"scenario": "Omega event bus multiscale", "reuse": "market_microstructure", "match_pct": 84.0},
        {"scenario": "Omega living brain shadow", "reuse": "runtime_governance", "match_pct": 81.0},
        {"scenario": "AR10 panel real data only", "reuse": "operator_cockpit", "match_pct": 79.0},
    ]
