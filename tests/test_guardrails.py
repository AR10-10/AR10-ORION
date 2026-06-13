from __future__ import annotations

from ui_cockpit.dashboard_render import guardrails


def test_guardrails_block_execution() -> None:
    state = guardrails()
    assert state["mode"] == "READ_ONLY"
    assert state["real_orders_enabled"] is False
    assert state["live_enabled"] is False
    assert state["demo_orders_enabled"] is False
    assert state["broker_actions"] == "blocked"
