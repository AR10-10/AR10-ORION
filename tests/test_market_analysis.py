from __future__ import annotations

from market_analysis.public_market_analyzer import analyze_market


def test_market_analysis_contract() -> None:
    data = analyze_market(symbol="BTCUSDT", interval="15m")
    assert data["mode"] == "READ_ONLY_ANALYSIS"
    assert data["symbol"] == "BTCUSDT"
    assert data["bias"] in {
        "LONG_PREFERENCIAL",
        "SHORT_PREFERENCIAL",
        "AGUARDAR_ROMPIMENTO",
        "AGUARDAR_PERDA",
        "AGUARDAR_PULLBACK",
        "AGUARDAR_RETESTE",
        "NEUTRO",
    }
    assert data["levels"]["support"] <= data["price"] <= data["levels"]["resistance"]
    assert len(data["candles"]) <= 60
