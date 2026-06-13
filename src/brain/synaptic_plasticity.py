from __future__ import annotations


def fusion_state(hidden_pulse: float, memory_match: float, cortisol: float) -> dict[str, float | str]:
    alpha = max(0.05, 1.0 - cortisol)
    fused = hidden_pulse + ((memory_match / 100.0) - 0.5) * alpha
    return {
        "module": "synaptic_plasticity",
        "alpha": round(alpha, 3),
        "fused_signal": round(max(0.0, min(1.0, fused)), 3),
        "mode": "adaptive_shadow",
    }
