from __future__ import annotations

from ui_cockpit.dashboard_render import telemetry


def test_telemetry_shape() -> None:
    data = telemetry()
    assert data["guardrails"]["mode"] == "READ_ONLY"
    assert len(data["feeds"]["items"]) >= 5
    assert data["brain"]["plasticity"]["mode"] == "adaptive_shadow"
    assert all(gateway["execution_enabled"] is False for gateway in data["gateways"])
