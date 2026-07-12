// trade-plan.ts — Signal Precision order (phase 4): when the Multi-Agent
// Council reads LONG or SHORT, derive an actionable plan from REAL market
// structure only — entry zone, protective stop and target, with the
// resulting risk/reward ratio. Advisory output for a read-only terminal:
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
//   - Target = the nearest opposing real level. None mapped → no plan.
//   - Pure function of its inputs: same inputs, same plan, zero I/O.
export const TRADE_PLAN_CONTRACT_VERSION = 1 as const;

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
  target: TradePlanLevel;
  // (target − entry midpoint) / (entry midpoint − stop), mirrored for SHORT.
  // null when the geometry degenerates (zero-risk entry) — never Infinity.
  riskRewardRatio: number | null;
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

  // Target: nearest opposing real level (resting liquidity included).
  const targets = inputs.levels.filter((l) => fin(l.price) && targetKinds.test(l.kind) && (long ? l.price > price : l.price < price));
  if (targets.length === 0) return null;
  const targetAnchor = targets.reduce((best, l) =>
    (long ? l.price < best.price : l.price > best.price) ? l : best,
  );
  const target: TradePlanLevel = { price: targetAnchor.price, basis: targetAnchor.kind };

  const entryMid = (entry.low + entry.high) / 2;
  const risk = long ? entryMid - stop.price : stop.price - entryMid;
  const reward = long ? target.price - entryMid : entryMid - target.price;
  const riskRewardRatio = risk > 0 && reward > 0 ? reward / risk : null;

  return {
    contractVersion: TRADE_PLAN_CONTRACT_VERSION,
    direction: stance,
    entry,
    stop,
    target,
    riskRewardRatio,
    computedAt,
  };
}
