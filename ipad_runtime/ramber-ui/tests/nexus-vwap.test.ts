// nexus-vwap.test.ts — Research-driven precision order: locks the honest
// VWAP math (session-anchored to UTC day, real typical-price × real
// volume, fail-closed on bad/missing volume). Pure logic, no DOM/canvas.
import { describe, it, expect } from 'vitest';
import { computeSessionVwapSeries, latestVwap, type VwapCandle } from '../src/nexus/vwap';

const DAY = 86400;
const dayStart = 20 * DAY; // an arbitrary UTC day boundary, far from epoch edge cases

const candle = (offsetSec: number, high: number, low: number, close: number, volume: number): VwapCandle => ({
  time: dayStart + offsetSec,
  high,
  low,
  close,
  volume,
});

describe('computeSessionVwapSeries: real math, UTC-day anchored', () => {
  it('empty input returns an empty series (fail-closed, never a fabricated line)', () => {
    expect(computeSessionVwapSeries([])).toEqual([]);
  });

  it('a single candle: VWAP equals its own typical price (H+L+C)/3', () => {
    const c = candle(0, 110, 90, 100, 50);
    const series = computeSessionVwapSeries([c]);
    expect(series).toHaveLength(1);
    expect(series[0].value).toBeCloseTo((110 + 90 + 100) / 3, 8);
    expect(series[0].time).toBe(c.time);
  });

  it('cumulative volume-weighted average across candles matches hand-computed real math', () => {
    // typical prices: 100, 200 — weights 10 and 30.
    const c1 = candle(0, 100, 100, 100, 10);
    const c2 = candle(900, 200, 200, 200, 30);
    const series = computeSessionVwapSeries([c1, c2]);
    expect(series).toHaveLength(2);
    expect(series[0].value).toBeCloseTo(100, 8);
    const expectedCumulative = (100 * 10 + 200 * 30) / (10 + 30); // 175
    expect(series[1].value).toBeCloseTo(expectedCumulative, 8);
  });

  it('candles from a PRIOR UTC day never bleed into the current session (real reset, not a rolling window)', () => {
    const yesterday = candle(-DAY + 100, 1000, 1000, 1000, 999); // huge weight, wrong day
    const today = candle(0, 100, 100, 100, 10);
    const series = computeSessionVwapSeries([yesterday, today]);
    expect(series).toHaveLength(1); // yesterday's candle is excluded entirely
    expect(series[0].value).toBeCloseTo(100, 8);
  });

  it('a candle with zero or negative volume is skipped — never divides by zero, never fabricates a weight', () => {
    const zero = candle(0, 100, 100, 100, 0);
    const negative = candle(900, 100, 100, 100, -5);
    const real = candle(1800, 100, 100, 100, 10);
    const series = computeSessionVwapSeries([zero, negative, real]);
    expect(series).toHaveLength(1);
    expect(series[0].time).toBe(real.time);
  });

  it('a candle with non-finite OHLC is skipped (fail-closed on corrupt data)', () => {
    const bad = candle(0, NaN, 100, 100, 10);
    const real = candle(900, 100, 100, 100, 10);
    const series = computeSessionVwapSeries([bad, real]);
    expect(series).toHaveLength(1);
    expect(series[0].time).toBe(real.time);
  });

  it('a candle with undefined volume (optional field, e.g. a caller without volume data) is skipped, not coerced to 0', () => {
    const noVolume: VwapCandle = { time: dayStart, high: 100, low: 100, close: 100 };
    const real = candle(900, 100, 100, 100, 10);
    const series = computeSessionVwapSeries([noVolume, real]);
    expect(series).toHaveLength(1);
    expect(series[0].time).toBe(real.time);
  });
});

describe('latestVwap: the current (last) point only', () => {
  it('returns null for an empty series — never a fabricated 0 or last-known-stale value', () => {
    expect(latestVwap([])).toBeNull();
  });

  it('returns the value of the last point', () => {
    const series = computeSessionVwapSeries([candle(0, 100, 100, 100, 10), candle(900, 200, 200, 200, 10)]);
    expect(latestVwap(series)).toBeCloseTo(150, 8);
  });
});
