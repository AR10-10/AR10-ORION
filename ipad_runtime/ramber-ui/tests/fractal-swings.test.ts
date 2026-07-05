// fractal-swings.test.ts — permanent regression suite for the shared
// swing-detection primitive used by support-resistance-engine.js,
// market-structure-engine.js and fvg-order-block-engine.js.
//
// Imports the REAL module by its real relative path (same path
// engine-bridge.ts itself uses) — never a copy, never a mock of the
// engine. This reconstructs, as a versioned test, the ad-hoc verification
// done when findSwings()/FRACTAL_K were extracted from 3 triplicated
// copies (Auditoria Mestra 360°, secao 7).
import { describe, it, expect } from 'vitest';
import { FRACTAL_K, findSwings } from '../../src/research/engines/fractal-swings.js';

type Candle = { h?: number; l?: number; high?: number; low?: number };

function flat(n: number, price: number): Candle[] {
  return Array.from({ length: n }, () => ({ h: price, l: price }));
}

describe('fractal-swings: FRACTAL_K', () => {
  it('is 2 (K candles of confirmation on each side)', () => {
    expect(FRACTAL_K).toBe(2);
  });
});

describe('fractal-swings: findSwings — confirmed local high/low', () => {
  it('confirms a local high strictly greater than K candles on each side', () => {
    const candles = flat(11, 100);
    candles[5].h = 150; // strictly above every neighbor within FRACTAL_K=2
    const swings = findSwings(candles, FRACTAL_K, true);
    expect(swings).toEqual([{ index: 5, price: 150 }]);
  });

  it('confirms a local low strictly lower than K candles on each side', () => {
    const candles = flat(11, 100);
    candles[5].l = 50;
    const swings = findSwings(candles, FRACTAL_K, false);
    expect(swings).toEqual([{ index: 5, price: 50 }]);
  });

  it('does NOT confirm a "high" that ties a neighbor (must be strictly greater)', () => {
    const candles = flat(11, 100);
    candles[5].h = 150;
    candles[4].h = 150; // tie inside the confirmation window
    const swings = findSwings(candles, FRACTAL_K, true);
    expect(swings).toEqual([]);
  });

  it('returns empty on a monotonic run (no reversal, nothing to confirm)', () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({ h: 100 + i, l: 100 + i - 1 }));
    expect(findSwings(candles, FRACTAL_K, true)).toEqual([]);
    expect(findSwings(candles, FRACTAL_K, false)).toEqual([]);
  });

  it('never confirms within K candles of either edge (no full window to check)', () => {
    const candles = flat(5, 100);
    candles[0].h = 999; // would be a swing if edges were checked, but i must be in [K, length-K-1]
    candles[4].h = 999;
    expect(findSwings(candles, FRACTAL_K, true)).toEqual([]);
  });

  it('treats a non-finite neighbor as disqualifying (never confirms against missing data)', () => {
    const candles = flat(11, 100);
    candles[5].h = 150;
    candles[4].h = undefined as unknown as number; // non-finite neighbor inside the window
    expect(findSwings(candles, FRACTAL_K, true)).toEqual([]);
  });
});

describe('fractal-swings: findSwings — {h,l} vs {high,low} shape parity', () => {
  it('produces identical output regardless of which field name is populated', () => {
    const short: Candle[] = flat(11, 100);
    short[5] = { h: 150, l: 100 };
    const long: Candle[] = Array.from({ length: 11 }, () => ({ high: 100, low: 100 }));
    long[5] = { high: 150, low: 100 };

    expect(findSwings(short, FRACTAL_K, true)).toEqual(findSwings(long, FRACTAL_K, true));
    expect(findSwings(short, FRACTAL_K, false)).toEqual(findSwings(long, FRACTAL_K, false));
  });
});

describe('fractal-swings: findSwings — multiple confirmed swings, order preserved', () => {
  it('returns swings in candle order (oldest to newest), not sorted by price', () => {
    // Triangle wave: confirmed highs at 5 and 15, confirmed low at 10.
    const n = 21;
    const candles: Candle[] = Array.from({ length: n }, (_, i) => {
      const dist5 = Math.abs(i - 5);
      const dist15 = Math.abs(i - 15);
      const near5 = Math.max(0, 3 - dist5);
      const near15 = Math.max(0, 3 - dist15);
      return { h: 100 + near5 * 10 + near15 * 10, l: 100 - near5 * 5 - near15 * 5 };
    });
    const highs = findSwings(candles, FRACTAL_K, true);
    expect(highs.map((s) => s.index)).toEqual([5, 15]);
  });
});
