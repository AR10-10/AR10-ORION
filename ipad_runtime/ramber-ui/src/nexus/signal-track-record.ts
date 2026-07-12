// signal-track-record.ts — Autonomy order: the first HONEST accuracy metric
// of the organism. Every Trade Plan the brain forms is tracked against the
// REAL price that follows: which level was touched first — target or stop?
//
// Methodology (standard first-touch evaluation, stated openly):
//   - A plan is OPEN from the moment it forms. It resolves TARGET_HIT when
//     the live price touches the target before the stop, STOP_HIT when the
//     stop is touched first. If a single tick satisfies both (a gap through
//     the whole bracket), the CONSERVATIVE reading wins: STOP_HIT — the
//     record must never flatter itself.
//   - A materially different plan (direction or any level changed) REPLACES
//     the open one. Replaced plans are counted separately — never as a win,
//     never as a loss (they were advisory readings superseded by structure,
//     not resolved trades). Re-derivations with identical numbers are the
//     SAME plan (the engine recomputes per tick; identity is by values).
//   - hitRate = targetHits / (targetHits + stopHits); null until at least
//     one plan actually resolves (never a fabricated 0% or 100%).
//
// Pure functions of (state, input, now) — zero I/O, zero clock of their
// own. Functions return the ORIGINAL state reference when nothing changed,
// so a store write with an unchanged state never notifies the organism.
import type { TradePlan } from "./trade-plan";

export const TRACK_RECORD_CONTRACT_VERSION = 1 as const;

export type TrackedPlanStatus = "OPEN" | "TARGET_HIT" | "STOP_HIT" | "REPLACED";

export interface TrackedPlan {
  plan: TradePlan;
  openedAt: number;
  status: TrackedPlanStatus;
  resolvedAt: number | null;
  // Price that resolved the plan (real tick), null while OPEN/REPLACED.
  resolvedPrice: number | null;
}

export interface TrackRecordState {
  contractVersion: typeof TRACK_RECORD_CONTRACT_VERSION;
  active: TrackedPlan | null;
  // Resolved/replaced plans, newest last, ring-capped.
  history: TrackedPlan[];
  targetHits: number;
  stopHits: number;
  replaced: number;
}

export const TRACK_RECORD_HISTORY_CAP = 100;

export const EMPTY_TRACK_RECORD: TrackRecordState = {
  contractVersion: TRACK_RECORD_CONTRACT_VERSION,
  active: null,
  history: [],
  targetHits: 0,
  stopHits: 0,
  replaced: 0,
};

/** Value identity: the engine re-derives the plan on every price tick, so
 *  object references change constantly — two plans are the SAME advisory
 *  reading when direction and all levels match exactly. */
export function samePlan(a: TradePlan, b: TradePlan): boolean {
  return (
    a.direction === b.direction &&
    a.entry.low === b.entry.low &&
    a.entry.high === b.entry.high &&
    a.stop.price === b.stop.price &&
    a.target.price === b.target.price
  );
}

function pushHistory(history: TrackedPlan[], entry: TrackedPlan): TrackedPlan[] {
  const next = [...history, entry];
  return next.length > TRACK_RECORD_HISTORY_CAP ? next.slice(next.length - TRACK_RECORD_HISTORY_CAP) : next;
}

/** Plan slice changed (or re-derived). Opens/replaces/closes the active
 *  tracked plan accordingly. Same-value re-derivations return the ORIGINAL
 *  state (no transition, no event). */
export function trackPlanTransition(state: TrackRecordState, plan: TradePlan | null, now: number): TrackRecordState {
  if (plan === null) {
    if (state.active === null) return state; // nothing tracked, nothing changed
    // The brain withdrew the plan (stance lost / risk gate) — the open plan
    // was superseded, not resolved.
    return {
      ...state,
      active: null,
      history: pushHistory(state.history, { ...state.active, status: "REPLACED", resolvedAt: now, resolvedPrice: null }),
      replaced: state.replaced + 1,
    };
  }
  if (state.active === null) {
    return { ...state, active: { plan, openedAt: now, status: "OPEN", resolvedAt: null, resolvedPrice: null } };
  }
  if (samePlan(state.active.plan, plan)) return state; // same advisory reading — keep original openedAt
  return {
    ...state,
    active: { plan, openedAt: now, status: "OPEN", resolvedAt: null, resolvedPrice: null },
    history: pushHistory(state.history, { ...state.active, status: "REPLACED", resolvedAt: now, resolvedPrice: null }),
    replaced: state.replaced + 1,
  };
}

/** Real price tick vs the open plan. Conservative on a bracket gap:
 *  STOP_HIT wins. Returns the ORIGINAL state when nothing resolves. */
export function trackPriceTick(state: TrackRecordState, price: number, now: number): TrackRecordState {
  const active = state.active;
  if (!active || !Number.isFinite(price)) return state;
  const long = active.plan.direction === "LONG";
  const stopTouched = long ? price <= active.plan.stop.price : price >= active.plan.stop.price;
  const targetTouched = long ? price >= active.plan.target.price : price <= active.plan.target.price;
  if (!stopTouched && !targetTouched) return state;
  const status: TrackedPlanStatus = stopTouched ? "STOP_HIT" : "TARGET_HIT"; // conservative: stop wins a gap
  return {
    ...state,
    active: null,
    history: pushHistory(state.history, { ...active, status, resolvedAt: now, resolvedPrice: price }),
    targetHits: state.targetHits + (status === "TARGET_HIT" ? 1 : 0),
    stopHits: state.stopHits + (status === "STOP_HIT" ? 1 : 0),
  };
}

/** targetHits / resolved — null until something REAL resolved. */
export function hitRate(state: TrackRecordState): number | null {
  const resolved = state.targetHits + state.stopHits;
  return resolved === 0 ? null : state.targetHits / resolved;
}

/** Fail-closed rehydration: accepts only a structurally valid persisted
 *  state of the SAME contract version; anything else yields the empty
 *  honest state (never a partially-trusted record). */
export function rehydrateTrackRecord(raw: unknown): TrackRecordState {
  const r = raw as TrackRecordState | null | undefined;
  if (
    !r || typeof r !== "object" ||
    r.contractVersion !== TRACK_RECORD_CONTRACT_VERSION ||
    !Array.isArray(r.history) ||
    typeof r.targetHits !== "number" || typeof r.stopHits !== "number" || typeof r.replaced !== "number"
  ) {
    return EMPTY_TRACK_RECORD;
  }
  // An active plan from a previous session cannot be evaluated honestly
  // (the price path while the app was closed is unknown) — it is counted
  // as REPLACED, never resolved in absentia.
  if (r.active) {
    return {
      ...r,
      active: null,
      history: pushHistory(r.history, { ...r.active, status: "REPLACED", resolvedAt: null, resolvedPrice: null }),
      replaced: r.replaced + 1,
    };
  }
  return { ...r, active: null };
}
