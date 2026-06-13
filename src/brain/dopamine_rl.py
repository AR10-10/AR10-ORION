from __future__ import annotations


def reward_shadow_state(win_rate: float = 0.61, error_rate: float = 0.21) -> dict[str, float | str]:
    dopamine = max(0.0, min(1.0, win_rate - (error_rate * 0.35)))
    return {
        "module": "dopamine_rl",
        "mode": "shadow_reward_learning",
        "dopamine": round(dopamine, 3),
        "win_rate_input": round(win_rate, 3),
        "error_rate_input": round(error_rate, 3),
    }
