from __future__ import annotations

from gateways import mexc_gateway, mt5_gateway


def test_gateways_are_read_only() -> None:
    assert mt5_gateway.gateway_status()["execution_enabled"] is False
    assert mexc_gateway.gateway_status()["execution_enabled"] is False
