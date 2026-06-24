#!/usr/bin/env python3
"""Generates the local BTC/USDT replay dataset for the iPad Runtime.

This is a SYNTHETIC, deterministic, offline dataset (seeded random walk).
It does not call any exchange, API, or network endpoint, and it is not a
live or historical feed from MEXC/Binance/etc. It exists purely so the
Replay BTC/USDT feature can demonstrate the WASM analytics engine and the
Web Worker pipeline fully offline, with zero network dependency and zero
"live trading" surface.

Run: python3 tools/generate_replay.py
Output: data/btcusdt_replay.json
"""
import json
import math
import os
import random

SEED = 100100100
N_CANDLES = 720  # 12h of 1-minute synthetic candles
START_PRICE = 67000.00
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "btcusdt_replay.json")


def generate(seed: int, n: int, start_price: float):
    rng = random.Random(seed)
    candles = []
    price = start_price
    t0 = 1700000000  # arbitrary fixed epoch anchor (not "now" — avoids implying live data)
    for i in range(n):
        drift = math.sin(i / 47.0) * 6.0  # slow synthetic cycle, purely cosmetic
        shock = rng.gauss(0, 35)
        open_p = price
        close_p = max(1.0, open_p + drift + shock)
        high_p = max(open_p, close_p) + abs(rng.gauss(0, 12))
        low_p = min(open_p, close_p) - abs(rng.gauss(0, 12))
        volume = abs(rng.gauss(18, 6))
        candles.append({
            "t": t0 + i * 60,
            "o": round(open_p, 2),
            "h": round(high_p, 2),
            "l": round(low_p, 2),
            "c": round(close_p, 2),
            "v": round(volume, 4),
        })
        price = close_p
    return candles


def main():
    candles = generate(SEED, N_CANDLES, START_PRICE)
    payload = {
        "dataset": "btcusdt_replay",
        "kind": "SYNTHETIC_OFFLINE_SAMPLE",
        "source": "local-generator (tools/generate_replay.py)",
        "live": False,
        "exchange_connection": "NONE",
        "warning": "Dados sinteticos gerados localmente para demonstracao offline. NAO e feed ao vivo, NAO vem de MEXC/Binance/corretora alguma, NAO deve ser usado para decisao real de mercado.",
        "seed": SEED,
        "symbol": "BTCUSDT",
        "interval": "1m",
        "count": len(candles),
        "candles": candles,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"wrote {OUT_PATH} ({len(candles)} candles, {os.path.getsize(OUT_PATH)} bytes)")


if __name__ == "__main__":
    main()
