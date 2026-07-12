// vwap.ts — Volume-Weighted Average Price, the institutional standard
// intraday reference level. Research finding (Ordem: "faz umas pesquisa
// no X... o que está faltando mais ainda pra ele ficar mais preciso"):
// confluence-trading research consistently names VWAP as the single most
// referenced intraday level among institutional desks — this system had
// Order Blocks/FVG/Liquidity/S-R/Fibonacci/Volume Profile but no VWAP at
// all (confirmed by a full-codebase grep before writing this file).
//
// Session-anchored to the UTC calendar day: crypto has no exchange close
// to anchor a "session" to, so a UTC-day reset is the standard adaptation
// (matches how most crypto-native platforms compute it). Pure function,
// real math only — typical price (H+L+C)/3 weighted by real per-candle
// volume, cumulative from the start of the current UTC day. Zero mocks,
// zero new data source: every input is a candle this system already
// loads for the chart (chartData already carries real `volume` per
// candle, V-MAX Fase 1.3).
export interface VwapCandle {
  time: number; // Unix seconds real
  high: number;
  low: number;
  close: number;
  // Optional to match callers whose candle type declares volume as
  // possibly-absent (EnhancedChartCandle) — a missing volume is already
  // treated as an invalid candle below (Number.isFinite(undefined) is
  // false), never coerced to 0 or skipped silently in a way that would
  // change the cumulative average's meaning.
  volume?: number;
}

export interface VwapPoint {
  time: number;
  value: number;
}

const SECONDS_PER_DAY = 86400;

/**
 * Returns one VWAP point per valid candle within the current UTC day (the
 * day of the LAST candle in the array — the array is assumed sorted
 * ascending by time, same invariant as the rest of the chart pipeline).
 * A candle with non-finite OHLC/volume or zero/negative volume is
 * skipped (fail-closed: never lets a bad tick corrupt the cumulative
 * average). Empty input, or a day with no valid volume at all, returns
 * an empty series — never a fabricated flat line.
 */
export function computeSessionVwapSeries(candles: VwapCandle[]): VwapPoint[] {
  if (candles.length === 0) return [];
  const dayStart = Math.floor(candles[candles.length - 1].time / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  const points: VwapPoint[] = [];
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  for (const c of candles) {
    if (c.time < dayStart) continue;
    const validOhlc = Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close);
    const validVolume = Number.isFinite(c.volume) && c.volume > 0;
    if (!validOhlc || !validVolume) continue;
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumulativePriceVolume += typicalPrice * c.volume;
    cumulativeVolume += c.volume;
    points.push({ time: c.time, value: cumulativePriceVolume / cumulativeVolume });
  }
  return points;
}

/** The latest (current) VWAP value — the last point of the series, or null before any real volume has accumulated today. */
export function latestVwap(series: VwapPoint[]): number | null {
  return series.length > 0 ? series[series.length - 1].value : null;
}
