// nexus-trade-plan.test.ts — Signal Precision order (phase 4) + Diretriz
// Complementar (Nexus Predictive Engine) §2 v2 multi-target extension:
// locks the Trade Plan engine's fail-closed rules and structure-only
// geometry, including up to MAX_TARGETS real opposing levels. Pure logic,
// no network, no store.
import { describe, it, expect } from 'vitest';
import { buildTradePlan, effectiveStopForTargetsHit, TRADE_PLAN_CONTRACT_VERSION, MAX_TARGETS, type TradePlanInputs } from '../src/nexus/trade-plan';

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
  it('entry = nearest demand below price; stop = next real level beyond entry; targets = every real opposing level, nearest first; R:R exact per target', () => {
    const plan = buildTradePlan(BASE, 1_000)!;
    expect(plan).not.toBeNull();
    expect(plan.contractVersion).toBe(TRADE_PLAN_CONTRACT_VERSION);
    expect(plan.direction).toBe('LONG');
    expect(plan.entry).toEqual({ low: 49_200, high: 49_500, basis: 'OB_BULLISH' });
    expect(plan.stop).toEqual({ price: 48_800, basis: 'SR_SUPPORT_1' }); // nearest real level below entry.low
    // Two real opposing levels exist above price (51,000 and 52,200) —
    // both become real targets, nearest first, never truncated to one.
    expect(plan.targets).toEqual([
      { price: 51_000, basis: 'SR_RESISTANCE_1' },
      { price: 52_200, basis: 'EQH' },
    ]);
    const entryMid = (49_200 + 49_500) / 2;
    expect(plan.riskRewardRatios).toHaveLength(2);
    expect(plan.riskRewardRatios[0]).toBeCloseTo((51_000 - entryMid) / (entryMid - 48_800), 10);
    expect(plan.riskRewardRatios[1]).toBeCloseTo((52_200 - entryMid) / (entryMid - 48_800), 10);
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
    expect(plan.targets).toEqual([{ price: 52_200, basis: 'EQH' }]);
  });

  it('deterministic: same inputs always produce the same plan', () => {
    expect(buildTradePlan(BASE, 5)).toEqual(buildTradePlan(BASE, 5));
  });
});

describe('buildTradePlan v2 (Diretriz Complementar §2): multi-target ceiling and honesty', () => {
  it('caps at MAX_TARGETS (3) even with more real opposing levels mapped — never fabricates a 4th', () => {
    const plan = buildTradePlan({
      ...BASE,
      levels: [
        ...BASE.levels,
        { price: 53_000, kind: 'FIB_161.8' },
        { price: 54_000, kind: 'VP_HVN' },
      ],
    })!;
    expect(plan.targets).toHaveLength(MAX_TARGETS);
    expect(plan.targets.map((t) => t.price)).toEqual([51_000, 52_200, 53_000]); // nearest 3, sorted
    expect(plan.riskRewardRatios).toHaveLength(MAX_TARGETS);
  });

  it('honest shortfall: only 1 real opposing level mapped => targets has length 1, never a fabricated 2nd/3rd', () => {
    const plan = buildTradePlan({
      ...BASE,
      levels: BASE.levels.filter((l) => l.price !== 52_200), // remove the 2nd LONG target candidate
    })!;
    expect(plan.targets).toEqual([{ price: 51_000, basis: 'SR_RESISTANCE_1' }]);
  });

  it('two real sources mapping the EXACT same price count as ONE target, never a duplicate', () => {
    const plan = buildTradePlan({
      ...BASE,
      levels: [
        ...BASE.levels,
        { price: 51_000, kind: 'FIB_61.8' }, // same price as the existing SR_RESISTANCE_1 target
      ],
    })!;
    const prices = plan.targets.map((t) => t.price);
    expect(prices.filter((p) => p === 51_000)).toHaveLength(1);
  });
});

describe('buildTradePlan: SHORT geometry — exact mirror of LONG', () => {
  const SHORT: TradePlanInputs = { ...BASE, stance: 'SHORT' };

  it('entry = nearest supply above price; stop = next real level above entry; targets = real levels below, nearest first', () => {
    const plan = buildTradePlan(SHORT, 2_000)!;
    expect(plan).not.toBeNull();
    expect(plan.direction).toBe('SHORT');
    // Nearest supply above 50,000 is R1 @ 51,000 (nearer than the OB at
    // 51,500-51,800) — zero-width entry zone from a real level.
    expect(plan.entry).toEqual({ low: 51_000, high: 51_000, basis: 'SR_RESISTANCE_1' });
    // Next real anchor above the entry is the bearish OB's far edge (51,800).
    expect(plan.stop).toEqual({ price: 51_800, basis: 'OB_BEARISH' });
    // Two real levels below price: S1 @ 48,800 (nearer) and EQL @ 47,900.
    expect(plan.targets).toEqual([
      { price: 48_800, basis: 'SR_SUPPORT_1' },
      { price: 47_900, basis: 'EQL' },
    ]);
    const entryMid = 51_000;
    expect(plan.riskRewardRatios[0]).toBeCloseTo((entryMid - 48_800) / (51_800 - entryMid), 10);
    expect(plan.riskRewardRatios[1]).toBeCloseTo((entryMid - 47_900) / (51_800 - entryMid), 10);
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
    expect(plan.targets[0].price).toBe(49_000);
    expect(plan.riskRewardRatios[0]).toBeGreaterThan(0);
  });
});

describe('effectiveStopForTargetsHit: single real source for the trailing-stop ratchet (Diretriz Complementar §18)', () => {
  const plan = buildTradePlan({
    ...BASE,
    zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
  })!; // LONG, entry 49_200-49_500, stop 48_800, targets [51_000, 52_200]
  const entryMid = (49_200 + 49_500) / 2;

  it('no real target proven yet: the ORIGINAL structural stop, untouched', () => {
    expect(effectiveStopForTargetsHit(plan, 0)).toBe(plan.stop.price);
  });

  it('1 real target proven: break-even (entry midpoint) — same convention as before', () => {
    expect(effectiveStopForTargetsHit(plan, 1)).toBe(entryMid);
  });

  it('2+ real targets proven: the stop TRAILS to the PREVIOUS target — locks in gain already validated, never just flat break-even', () => {
    expect(effectiveStopForTargetsHit(plan, 2)).toBe(plan.targets[0].price);
  });

  it('a 3-target ladder trails one more rung: 3 proven => stop at target 2 (index 1)', () => {
    const threeTargetPlan = buildTradePlan({
      ...BASE,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
      levels: [...BASE.levels, { price: 53_000, kind: 'FIB_161.8' }],
    })!;
    expect(threeTargetPlan.targets).toHaveLength(3);
    expect(effectiveStopForTargetsHit(threeTargetPlan, 3)).toBe(threeTargetPlan.targets[1].price);
  });

  it('a negative targetsHit is treated the same as zero — never an out-of-bounds read', () => {
    expect(effectiveStopForTargetsHit(plan, -1)).toBe(plan.stop.price);
  });
});
