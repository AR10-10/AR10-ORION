// trade-plan.ts — Signal Precision order (phase 4): when the Multi-Agent
// Council reads LONG or SHORT, derive an actionable plan from REAL market
// structure only — entry zone, protective stop and target(s), with the
// resulting risk/reward ratio(s). Advisory output for a read-only terminal:
// it never routes an order anywhere.
//
// Honesty rules (all fail-closed, locked by tests):
//   - No plan without a directional stance: NEUTRAL/ABSTAIN/riskGated → null.
//   - Every price in the plan is a REAL level another engine already mapped
//     (Order Blocks, Fair Value Gaps, S1/R1, liquidity pools, Fibonacci
//     confluence, Volume Profile POC/HVN). Nothing is projected/invented.
//   - Entry = the nearest supportive structure on the pullback side of the
//     current price (demand below for LONG, supply above for SHORT).
//     Liquidity pools (EQH/EQL) are deliberately NOT entry basis — resting
//     stops are a magnet/sweep risk, not support — but they ARE valid
//     targets (price is drawn to resting liquidity).
//   - Stop = the next real level beyond the entry (structure invalidation).
//     No real level beyond the entry → no coherent invalidation → no plan.
//   - Targets = up to 3 real opposing levels, nearest first (v2, Diretriz
//     Complementar — Nexus Predictive Engine, §2). None mapped → no plan.
//     1 or 2 real levels → a shorter, still honest, `targets` array — never
//     a fabricated 2nd/3rd target when structure doesn't offer one.
//   - Pure function of its inputs: same inputs, same plan, zero I/O.
export const TRADE_PLAN_CONTRACT_VERSION = 2 as const;

// Diretriz Complementar §2 asks for "Alvo 1/2/3" — three is the real ceiling
// this repo's structural engines can honestly support without inventing
// projected levels beyond what's actually mapped.
export const MAX_TARGETS = 3;

export interface TradePlanZone {
  low: number;
  high: number;
  basis: string; // real source kind (e.g. OB_BULLISH, FVG_BEARISH, SR_SUPPORT_1, FIB_61.8, VP_POC)
}

export interface TradePlanLevel {
  price: number;
  basis: string;
}

export interface TradePlan {
  contractVersion: typeof TRADE_PLAN_CONTRACT_VERSION;
  direction: "LONG" | "SHORT";
  entry: TradePlanZone;
  stop: TradePlanLevel;
  // v2: up to MAX_TARGETS real opposing levels, nearest-to-price first —
  // targets[0] is the former single `target`. Length is always >= 1 (a
  // plan requires at least one real target to exist at all) and never
  // exceeds the count of real distinct opposing levels actually mapped.
  targets: TradePlanLevel[];
  // riskRewardRatios[i] mirrors targets[i]: (target − entry midpoint) /
  // (entry midpoint − stop), mirrored for SHORT. null when the geometry
  // degenerates (zero-risk entry) — never Infinity.
  riskRewardRatios: (number | null)[];
  computedAt: number;
}

export interface TradePlanStructureZone {
  low: number;
  high: number;
  kind: string; // OB_BULLISH | OB_BEARISH | FVG_BULLISH | FVG_BEARISH
}

export interface TradePlanLevelInput {
  price: number;
  // SR_SUPPORT_1 | SR_RESISTANCE_1 | EQH | EQL | FIB_* | VP_POC | VP_HVN
  kind: string;
}

export interface TradePlanInputs {
  stance: "LONG" | "SHORT" | "NEUTRAL" | "ABSTAIN" | null;
  riskGated: boolean;
  price: number | null;
  zones: TradePlanStructureZone[];
  levels: TradePlanLevelInput[];
}

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Entry basis whitelist per direction: acceptance/defense structures only.
const LONG_ENTRY_KINDS = /^(OB_BULLISH|FVG_BULLISH|SR_SUPPORT_1|FIB_|VP_POC$|VP_HVN$)/;
const SHORT_ENTRY_KINDS = /^(OB_BEARISH|FVG_BEARISH|SR_RESISTANCE_1|FIB_|VP_POC$|VP_HVN$)/;
// Target basis: any real opposing level, INCLUDING resting liquidity (EQH/EQL).
const LONG_TARGET_KINDS = /^(SR_RESISTANCE_1|EQH|FIB_|VP_POC$|VP_HVN$)/;
const SHORT_TARGET_KINDS = /^(SR_SUPPORT_1|EQL|FIB_|VP_POC$|VP_HVN$)/;

export function buildTradePlan(inputs: TradePlanInputs, computedAt: number = Date.now()): TradePlan | null {
  const { stance, riskGated, price } = inputs;
  if (riskGated) return null; // council locked fail-closed — never plan through a risk gate
  if (stance !== "LONG" && stance !== "SHORT") return null;
  if (!fin(price)) return null;

  const long = stance === "LONG";
  const entryKinds = long ? LONG_ENTRY_KINDS : SHORT_ENTRY_KINDS;
  const targetKinds = long ? LONG_TARGET_KINDS : SHORT_TARGET_KINDS;

  // Candidate entries: real area structures + real levels as zero-width
  // zones, all on the pullback side of price.
  const candidates: TradePlanZone[] = [];
  for (const z of inputs.zones) {
    if (!fin(z.low) || !fin(z.high) || z.low > z.high || !entryKinds.test(z.kind)) continue;
    if (long ? z.high <= price : z.low >= price) candidates.push({ low: z.low, high: z.high, basis: z.kind });
  }
  for (const l of inputs.levels) {
    if (!fin(l.price) || !entryKinds.test(l.kind)) continue;
    if (long ? l.price < price : l.price > price) candidates.push({ low: l.price, high: l.price, basis: l.kind });
  }
  if (candidates.length === 0) return null;
  // Nearest structure to price on the entry side.
  const entry = candidates.reduce((best, c) =>
    (long ? c.high > best.high : c.low < best.low) ? c : best,
  );

  // Stop: next REAL level beyond the entry (structure invalidation). All
  // level inputs and zone far-edges qualify as invalidation anchors.
  const invalidationAnchors: TradePlanLevelInput[] = [
    ...inputs.levels.filter((l) => fin(l.price)),
    ...inputs.zones.filter((z) => fin(z.low) && fin(z.high)).map((z) => ({ price: long ? z.low : z.high, kind: z.kind })),
  ];
  const beyondEntry = invalidationAnchors.filter((l) => (long ? l.price < entry.low : l.price > entry.high));
  if (beyondEntry.length === 0) return null; // no real invalidation level → no plan
  const stopAnchor = beyondEntry.reduce((best, l) =>
    (long ? l.price > best.price : l.price < best.price) ? l : best,
  );
  const stop: TradePlanLevel = { price: stopAnchor.price, basis: stopAnchor.kind };

  // Targets (v2): every real opposing level (resting liquidity included),
  // nearest-to-price first, deduped by exact price (two sources mapping the
  // SAME real level don't count as two targets), capped at MAX_TARGETS —
  // never a projected 2nd/3rd level invented beyond what structure offers.
  const targetCandidates = inputs.levels.filter(
    (l) => fin(l.price) && targetKinds.test(l.kind) && (long ? l.price > price : l.price < price),
  );
  if (targetCandidates.length === 0) return null;
  const sortedTargets = [...targetCandidates].sort((a, b) => (long ? a.price - b.price : b.price - a.price));
  const targets: TradePlanLevel[] = [];
  const seenPrices = new Set<number>();
  for (const t of sortedTargets) {
    if (seenPrices.has(t.price)) continue;
    seenPrices.add(t.price);
    targets.push({ price: t.price, basis: t.kind });
    if (targets.length === MAX_TARGETS) break;
  }

  const entryMid = (entry.low + entry.high) / 2;
  const risk = long ? entryMid - stop.price : stop.price - entryMid;
  const riskRewardRatios = targets.map((t) => {
    const reward = long ? t.price - entryMid : entryMid - t.price;
    return risk > 0 && reward > 0 ? reward / risk : null;
  });

  return {
    contractVersion: TRADE_PLAN_CONTRACT_VERSION,
    direction: stance,
    entry,
    stop,
    targets,
    riskRewardRatios,
    computedAt,
  };
}
