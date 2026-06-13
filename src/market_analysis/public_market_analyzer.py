from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import median, mean
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


SUPPORTED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]
SUPPORTED_INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "4h"]
SUPPORTED_PRESSURE_WINDOWS = [5, 15, 30, 60, 120]
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL_SECONDS = 20


@dataclass(frozen=True)
class Candle:
    open_time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


def _ema(values: list[float], period: int) -> float:
    if not values:
        return 0.0
    k = 2 / (period + 1)
    ema = values[0]
    for value in values[1:]:
        ema = value * k + ema * (1 - k)
    return ema


def _rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) <= period:
        return 50.0
    gains: list[float] = []
    losses: list[float] = []
    for prev, current in zip(closes[-period - 1 : -1], closes[-period:]):
        delta = current - prev
        gains.append(max(delta, 0.0))
        losses.append(abs(min(delta, 0.0)))
    avg_gain = mean(gains) if gains else 0.0
    avg_loss = mean(losses) if losses else 0.0
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _atr(candles: list[Candle], period: int = 14) -> float:
    if len(candles) < 2:
        return 0.0
    true_ranges: list[float] = []
    for prev, current in zip(candles[-period - 1 : -1], candles[-period:]):
        true_ranges.append(
            max(
                current.high - current.low,
                abs(current.high - prev.close),
                abs(current.low - prev.close),
            )
        )
    return mean(true_ranges) if true_ranges else 0.0


def _fetch_binance_klines(symbol: str, interval: str, limit: int = 120) -> list[Candle]:
    query = urlencode({"symbol": symbol, "interval": interval, "limit": limit})
    url = f"https://api.binance.com/api/v3/klines?{query}"
    req = Request(url, headers={"User-Agent": "AR10-Orion-ReadOnly/0.3"})
    with urlopen(req, timeout=8) as response:
        raw = json.loads(response.read().decode("utf-8"))
    return [
        Candle(
            open_time=int(item[0]),
            open=float(item[1]),
            high=float(item[2]),
            low=float(item[3]),
            close=float(item[4]),
            volume=float(item[5]),
        )
        for item in raw
    ]


def _fetch_json(url: str) -> Any:
    req = Request(url, headers={"User-Agent": "AR10-Orion-ReadOnly/0.4"})
    with urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def _okx_symbol(symbol: str) -> str:
    return f"{symbol[:-4]}-USDT-SWAP"


def _mexc_symbol(symbol: str) -> str:
    return f"{symbol[:-4]}_USDT"


def _source_consensus(symbol: str, fallback_price: float) -> dict[str, Any]:
    probes = [
        (
            "BINANCE_SPOT",
            f"https://api.binance.com/api/v3/ticker/price?{urlencode({'symbol': symbol})}",
            lambda data: float(data["price"]),
        ),
        (
            "BYBIT_LINEAR",
            f"https://api.bybit.com/v5/market/tickers?{urlencode({'category': 'linear', 'symbol': symbol})}",
            lambda data: float(data["result"]["list"][0]["lastPrice"]),
        ),
        (
            "OKX_SWAP",
            f"https://www.okx.com/api/v5/market/ticker?{urlencode({'instId': _okx_symbol(symbol)})}",
            lambda data: float(data["data"][0]["last"]),
        ),
        (
            "MEXC_USDT_PERPETUAL",
            f"https://contract.mexc.com/api/v1/contract/ticker?{urlencode({'symbol': _mexc_symbol(symbol)})}",
            lambda data: float(data["data"]["lastPrice"]),
        ),
    ]
    lanes: list[dict[str, Any]] = []
    prices: list[float] = []
    for name, url, extractor in probes:
        try:
            price = extractor(_fetch_json(url))
            prices.append(price)
            lanes.append({"name": name, "status": "FRESH", "price": round(price, 6), "quality": 1.0})
        except Exception as exc:
            lanes.append({"name": name, "status": f"OFFLINE:{type(exc).__name__}", "price": None, "quality": 0.0})
    active_prices = prices or [fallback_price]
    consensus = mean(active_prices)
    divergence_bps = max(abs(price - consensus) / consensus * 10000 for price in active_prices) if consensus else 0.0
    return {
        "active_lanes": len(prices),
        "total_lanes": len(probes),
        "consensus_price": round(consensus, 6),
        "max_divergence_bps": round(divergence_bps, 3),
        "lanes": lanes,
    }


def _fallback_candles(symbol: str, interval: str) -> list[Candle]:
    base = {"BTCUSDT": 104000, "ETHUSDT": 3600, "SOLUSDT": 155, "BNBUSDT": 675, "XRPUSDT": 2.2}.get(symbol, 100.0)
    now_ms = int(time.time() * 1000)
    candles: list[Candle] = []
    for idx in range(120):
        wave = math.sin(idx / 7.0) * 0.012 + math.cos(idx / 13.0) * 0.008
        drift = (idx - 60) * 0.00012
        close = base * (1 + wave + drift)
        open_price = close * (1 - math.sin(idx / 5.0) * 0.002)
        high = max(open_price, close) * 1.004
        low = min(open_price, close) * 0.996
        volume = 1000 + abs(math.sin(idx / 9.0)) * 700
        candles.append(Candle(now_ms - (120 - idx) * 60_000, open_price, high, low, close, volume))
    return candles


def _interval_minutes(interval: str) -> int:
    if interval.endswith("m"):
        return int(interval[:-1])
    if interval.endswith("h"):
        return int(interval[:-1]) * 60
    return 15


def _nearest_levels(candles: list[Candle], price: float) -> tuple[float, float]:
    recent = candles[-72:] if len(candles) >= 72 else candles
    lows = sorted({round(c.low, 8) for c in recent if c.low <= price}, reverse=True)
    highs = sorted({round(c.high, 8) for c in recent if c.high >= price})
    support = lows[0] if lows else min(c.low for c in recent)
    resistance = highs[0] if highs else max(c.high for c in recent)
    return support, resistance


def _vwap(candles: list[Candle]) -> float:
    volume_sum = sum(c.volume for c in candles)
    if volume_sum <= 0:
        return mean([c.close for c in candles])
    return sum(((c.high + c.low + c.close) / 3) * c.volume for c in candles) / volume_sum


def _pivots(candles: list[Candle]) -> dict[str, Any]:
    tops: list[dict[str, Any]] = []
    bottoms: list[dict[str, Any]] = []
    for idx in range(2, len(candles) - 2):
        window = candles[idx - 2 : idx + 3]
        current = candles[idx]
        if current.high == max(c.high for c in window):
            tops.append({"time": current.open_time, "price": round(current.high, 6)})
        if current.low == min(c.low for c in window):
            bottoms.append({"time": current.open_time, "price": round(current.low, 6)})
    return {
        "last_top": tops[-1] if tops else None,
        "last_bottom": bottoms[-1] if bottoms else None,
        "top_count": len(tops),
        "bottom_count": len(bottoms),
    }


def _pressure_state(candles: list[Candle], interval: str, pressure_minutes: int, atr: float) -> dict[str, Any]:
    candle_minutes = max(1, _interval_minutes(interval))
    count = max(3, min(len(candles), math.ceil(pressure_minutes / candle_minutes)))
    recent = candles[-count:]
    signed_flow = 0.0
    total_volume = 0.0
    for candle in recent:
        spread = max(candle.high - candle.low, candle.close * 0.0001)
        body = (candle.close - candle.open) / spread
        close_position = ((candle.close - candle.low) / spread) - 0.5
        signed_flow += candle.volume * (body * 0.7 + close_position * 0.3)
        total_volume += candle.volume
    flow_component = signed_flow / total_volume if total_volume else 0.0
    price_delta = recent[-1].close - recent[0].open
    momentum_component = price_delta / max(atr * 2.0, recent[-1].close * 0.001)
    normalized = math.tanh(flow_component * 2.5 + momentum_component * 0.8)
    long_pressure = (normalized + 1) / 2
    short_pressure = 1 - long_pressure
    if long_pressure >= 0.58:
        bias = "PRESSAO_COMPRADORA"
    elif short_pressure >= 0.58:
        bias = "PRESSAO_VENDEDORA"
    else:
        bias = "PRESSAO_NEUTRA"
    return {
        "window_minutes": pressure_minutes,
        "candles_used": count,
        "long": round(long_pressure, 3),
        "short": round(short_pressure, 3),
        "bias": bias,
        "score": round(abs(long_pressure - short_pressure), 3),
    }


def _level_package(candles: list[Candle], price: float, support: float, resistance: float, atr: float, pressure_minutes: int, interval: str) -> dict[str, Any]:
    recent = candles[-72:] if len(candles) >= 72 else candles
    pressure_count = max(3, min(len(candles), math.ceil(pressure_minutes / max(1, _interval_minutes(interval)))))
    pressure_candles = candles[-pressure_count:]
    zone_width = max(atr * 0.22, price * 0.0008)
    accumulation_mid = _vwap(pressure_candles)
    accumulation_width = max(atr * 0.45, price * 0.0012)
    touch_band = max(atr * 0.18, price * 0.0006)
    top_touches = sum(1 for c in recent if abs(c.high - resistance) <= touch_band)
    bottom_touches = sum(1 for c in recent if abs(c.low - support) <= touch_band)
    near_resistance = abs(resistance - price) <= touch_band
    near_support = abs(price - support) <= touch_band
    pivot_info = _pivots(recent)
    if near_resistance:
        structure = "TOPO_TESTANDO_RESISTENCIA"
    elif near_support:
        structure = "FUNDO_DEFENDENDO_SUPORTE"
    elif support < price < resistance and (resistance - support) <= max(atr * 3.2, price * 0.01):
        structure = "ACUMULACAO_ESTREITA"
    else:
        structure = "RANGE_OPERACIONAL"
    return {
        "support": round(support, 6),
        "resistance": round(resistance, 6),
        "support_zone": [round(support - zone_width, 6), round(support + zone_width, 6)],
        "resistance_zone": [round(resistance - zone_width, 6), round(resistance + zone_width, 6)],
        "accumulation_zone": [round(accumulation_mid - accumulation_width, 6), round(accumulation_mid + accumulation_width, 6)],
        "top_touches": top_touches,
        "bottom_touches": bottom_touches,
        "near_resistance": near_resistance,
        "near_support": near_support,
        "structure": structure,
        "pivots": pivot_info,
    }


def _classify(
    price: float,
    support: float,
    resistance: float,
    ema_fast: float,
    ema_slow: float,
    rsi: float,
    volume_ratio: float,
) -> tuple[str, float, str]:
    trend_score = 0
    trend_score += 1 if ema_fast > ema_slow else -1
    trend_score += 1 if price > ema_fast else -1
    trend_score += 1 if 48 <= rsi <= 68 else -1 if rsi > 76 or rsi < 28 else 0
    trend_score += 1 if volume_ratio >= 0.92 else 0

    range_size = max(resistance - support, price * 0.001)
    resistance_distance = (resistance - price) / range_size
    support_distance = (price - support) / range_size
    if resistance_distance < 0.14 and trend_score > 0:
        return "AGUARDAR_ROMPIMENTO", 0.58, "Preco muito perto da resistencia; melhor esperar confirmacao."
    if support_distance < 0.14 and trend_score < 0:
        return "AGUARDAR_PERDA", 0.58, "Preco muito perto do suporte; venda so com perda confirmada."
    if trend_score >= 2:
        return "LONG_PREFERENCIAL", min(0.86, 0.56 + trend_score * 0.08), "Tendencia e momentum favorecem compra controlada."
    if trend_score <= -2:
        return "SHORT_PREFERENCIAL", min(0.86, 0.56 + abs(trend_score) * 0.08), "Tendencia e momentum favorecem venda controlada."
    return "NEUTRO", 0.50, "Mercado sem vantagem clara; leitura pede paciencia."


def analyze_market(symbol: str = "BTCUSDT", interval: str = "15m", pressure_minutes: int = 30) -> dict[str, Any]:
    symbol = symbol.upper().strip()
    interval = interval.strip()
    pressure_minutes = min(SUPPORTED_PRESSURE_WINDOWS, key=lambda item: abs(item - int(pressure_minutes or 30)))
    if symbol not in SUPPORTED_SYMBOLS:
        symbol = "BTCUSDT"
    if interval not in SUPPORTED_INTERVALS:
        interval = "15m"

    cache_key = f"{symbol}:{interval}:{pressure_minutes}"
    cached = _CACHE.get(cache_key)
    if cached and time.time() - cached[0] < _TTL_SECONDS:
        return cached[1]

    source = "binance_public"
    try:
        candles = _fetch_binance_klines(symbol, interval)
    except Exception as exc:  # Public feeds can fail; cockpit must remain available.
        source = f"fallback_safe_fixture:{type(exc).__name__}"
        candles = _fallback_candles(symbol, interval)

    closes = [c.close for c in candles]
    price = closes[-1]
    ema_fast = _ema(closes[-40:], 20)
    ema_slow = _ema(closes[-80:], 50)
    rsi = _rsi(closes)
    atr = _atr(candles)
    support, resistance = _nearest_levels(candles, price)
    avg_volume = mean([c.volume for c in candles[-30:]])
    volume_ratio = candles[-1].volume / avg_volume if avg_volume else 1.0
    bias, confidence, narrative = _classify(price, support, resistance, ema_fast, ema_slow, rsi, volume_ratio)
    pressure = _pressure_state(candles, interval, pressure_minutes, atr)
    levels = _level_package(candles, price, support, resistance, atr, pressure_minutes, interval)
    source_consensus = _source_consensus(symbol, price)

    if bias == "LONG_PREFERENCIAL" and pressure["short"] >= 0.64:
        bias = "AGUARDAR_PULLBACK"
        confidence = min(confidence, 0.62)
        narrative = "Tendencia maior favorece compra, mas a pressao curta esta vendedora; aguardar pullback ou nova defesa."
    elif bias == "SHORT_PREFERENCIAL" and pressure["long"] >= 0.64:
        bias = "AGUARDAR_RETESTE"
        confidence = min(confidence, 0.62)
        narrative = "Tendencia maior favorece venda, mas a pressao curta esta compradora; aguardar reteste ou perda confirmada."

    if bias.startswith("LONG"):
        entry_zone = [support, price]
        target = resistance
        invalidation = max(0.0, support - atr * 0.65)
    elif bias.startswith("SHORT"):
        entry_zone = [price, resistance]
        target = support
        invalidation = resistance + atr * 0.65
    else:
        entry_zone = [support, resistance]
        target = resistance if price >= (support + resistance) / 2 else support
        invalidation = None

    if bias == "NEUTRO" and pressure["bias"] == "PRESSAO_COMPRADORA":
        narrative = "Pressao compradora aparece, mas sem confirmacao estrutural suficiente."
    elif bias == "NEUTRO" and pressure["bias"] == "PRESSAO_VENDEDORA":
        narrative = "Pressao vendedora aparece, mas sem confirmacao estrutural suficiente."

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "READ_ONLY_ANALYSIS",
        "symbol": symbol,
        "interval": interval,
        "source": source,
        "source_consensus": source_consensus,
        "price": round(price, 6),
        "bias": bias,
        "confidence": round(confidence, 3),
        "narrative": narrative,
        "levels": {
            **levels,
            "entry_zone": [round(entry_zone[0], 6), round(entry_zone[1], 6)],
            "target": round(target, 6),
            "technical_invalidation": None if invalidation is None else round(invalidation, 6),
        },
        "pressure": pressure,
        "signals": {
            "ema_20": round(ema_fast, 6),
            "ema_50": round(ema_slow, 6),
            "rsi_14": round(rsi, 3),
            "atr_14": round(atr, 6),
            "volume_ratio": round(volume_ratio, 3),
            "median_volume_30": round(median([c.volume for c in candles[-30:]]), 3),
        },
        "trade_card": {
            "title": f"{symbol} {interval} {bias.replace('_', ' ')}",
            "subtitle": narrative,
            "read_only": True,
            "snapshot_hint": "Use o botao Gerar Print para exportar este card no iPad.",
        },
        "candles": [
            {
                "time": c.open_time,
                "open": round(c.open, 6),
                "high": round(c.high, 6),
                "low": round(c.low, 6),
                "close": round(c.close, 6),
                "volume": round(c.volume, 3),
            }
            for c in candles[-60:]
        ],
    }
    _CACHE[cache_key] = (time.time(), payload)
    return payload
