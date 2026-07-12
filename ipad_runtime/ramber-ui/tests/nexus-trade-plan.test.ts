// nexus-trade-plan.test.ts — Signal Precision order (phase 4): locks the
// Trade Plan engine's fail-closed rules and structure-only geometry. Pure
// logic, no network, no store.
import { describe, it, expect } from 'vitest';
import { buildTradePlan, TRADE_PLAN_CONTRACT_VERSION, type TradePlanInputs } from '../src/nexus/trade-plan';

const BASE: TradePlanInputs = {
  stance: 'LONG',
  riskGated: false,
  price: 50_000,
  zones: [
    { low: 49_200, high: 49_500, kind: 'OB_BULLISH' },   // demand below price
    { low: 51_500, high: 51_800, kind: 'OB_BEARISH' },   // supply above price
  ],
  levels: [
    { price: 48_800, kind: 'SR_SUPPORT_1' },
    { price: 51_000, kind: 'SR_RESISTANCE_1' },
    { price: 52_200, kind: 'EQH' },
    { price: 47_900, kind: 'EQL' },
  ],
};

describe('buildTradePlan: fail-closed guards — no stance/no structure means NO plan, never a guess', () => {
  it('NEUTRAL, ABSTAIN and null stances never produce a plan', () => {
    expect(buildTradePlan({ ...BASE, stance: 'NEUTRAL' })).toBeNull();
    expect(buildTradePlan({ ...BASE, stance: 'ABSTAIN' })).toBeNull();
    expect(buildTradePlan({ ...BASE, stance: null })).toBeNull();
  });

  it('risk gate locked (council fail-closed) never produces a plan, even with a directional stance', () => {
    expect(buildTradePlan({ ...BASE, riskGated: true })).toBeNull();
  });

  it('no real price (null/NaN) never produces a plan', () => {
    expect(buildTradePlan({ ...BASE, price: null })).toBeNull();
    expect(buildTradePlan({ ...BASE, price: NaN })).toBeNull();
  });

  it('no supportive structure on the entry side => null (never an invented entry)', () => {
    expect(buildTradePlan({ ...BASE, zones: [], levels: BASE.levels.filter((l) => l.price > 50_000) })).toBeNull();
  });

  it('no real level beyond the entry (no coherent invalidation) => null', () => {
    expect(buildTradePlan({
      ...BASE,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
      levels: [{ price: 51_000, kind: 'SR_RESISTANCE_1' }], // nothing below the entry
    })).toBeNull();
  });

  it('no opposing real level (no target) => null', () => {
    expect(buildTradePlan({
      ...BASE,
      levels: BASE.levels.filter((l) => l.price < 50_000), // nothing above for a LONG
    })).toBeNull();
  });
});

describe('buildTradePlan: LONG geometry — every price is a real mapped level', () => {
  it('entry = nearest demand below price; stop = next real level beyond entry; target = nearest opposing level; R:R exact', () => {
    const plan = buildTradePlan(BASE, 1_000)!;
    expect(plan).not.toBeNull();
    expect(plan.contractVersion).toBe(TRADE_PLAN_CONTRACT_VERSION);
    expect(plan.direction).toBe('LONG');
    expect(plan.entry).toEqual({ low: 49_200, high: 49_500, basis: 'OB_BULLISH' });
    expect(plan.stop).toEqual({ price: 48_800, basis: 'SR_SUPPORT_1' }); // nearest real level below entry.low
    expect(plan.target).toEqual({ price: 51_000, basis: 'SR_RESISTANCE_1' }); // nearest above price
    const entryMid = (49_200 + 49_500) / 2;
    expect(plan.riskRewardRatio).toBeCloseTo((51_000 - entryMid) / (entryMid - 48_800), 10);
    expect(plan.computedAt).toBe(1_000);
  });

  it('liquidity pools are NEVER entry basis (sweep magnets), but ARE valid targets', () => {
    const plan = buildTradePlan({
      ...BASE,
      zones: [],
      levels: [
        { price: 49_700, kind: 'EQL' },           // liquidity below — must NOT become the entry
        { price: 49_400, kind: 'SR_SUPPORT_1' },  // real support — the honest entry
        { price: 48_900, kind: 'FIB_61.8' },      // invalidation anchor below
        { price: 52_200, kind: 'EQH' },           // resting liquidity above — valid target
      ],
    })!;
    expect(plan.entry.basis).toBe('SR_SUPPORT_1');
    expect(plan.target).toEqual({ price: 52_200, basis: 'EQH' });
  });

  it('deterministic: same inputs always produce the same plan', () => {
    expect(buildTradePlan(BASE, 5)).toEqual(buildTradePlan(BASE, 5));
  });
});

describe('buildTradePlan: SHORT geometry — exact mirror of LONG', () => {
  const SHORT: TradePlanInputs = { ...BASE, stance: 'SHORT' };

  it('entry = nearest supply above price; stop = next real level above entry; target = nearest level below', () => {
    const plan = buildTradePlan(SHORT, 2_000)!;
    expect(plan).not.toBeNull();
    expect(plan.direction).toBe('SHORT');
    // Nearest supply above 50,000 is R1 @ 51,000 (nearer than the OB at
    // 51,500-51,800) — zero-width entry zone from a real level.
    expect(plan.entry).toEqual({ low: 51_000, high: 51_000, basis: 'SR_RESISTANCE_1' });
    // Next real anchor above the entry is the bearish OB's far edge (51,800).
    expect(plan.stop).toEqual({ price: 51_800, basis: 'OB_BEARISH' });
    // Nearest real level below price is S1 @ 48,800 (not the deeper EQL).
    expect(plan.target).toEqual({ price: 48_800, basis: 'SR_SUPPORT_1' });
    const entryMid = 51_000;
    expect(plan.riskRewardRatio).toBeCloseTo((entryMid - 48_800) / (51_800 - entryMid), 10);
  });

  it('SR_RESISTANCE_1 above price works as a zero-width entry zone for SHORT', () => {
    const plan = buildTradePlan({
      ...SHORT,
      zones: [],
      levels: [
        { price: 50_600, kind: 'SR_RESISTANCE_1' },
        { price: 51_400, kind: 'FIB_78.6' }, // invalidation above
        { price: 49_000, kind: 'SR_SUPPORT_1' }, // target below
      ],
    })!;
    expect(plan.entry).toEqual({ low: 50_600, high: 50_600, basis: 'SR_RESISTANCE_1' });
    expect(plan.stop.price).toBe(51_400);
    expect(plan.target.price).toBe(49_000);
    expect(plan.riskRewardRatio).toBeGreaterThan(0);
  });
});
