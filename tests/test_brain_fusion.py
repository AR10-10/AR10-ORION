from __future__ import annotations

from brain.synaptic_plasticity import fusion_state


def test_fusion_contract() -> None:
    state = fusion_state(hidden_pulse=0.58, memory_match=88.0, cortisol=0.2)
    assert state["mode"] == "adaptive_shadow"
    assert 0.0 <= state["fused_signal"] <= 1.0
    assert state["alpha"] < 1.0
