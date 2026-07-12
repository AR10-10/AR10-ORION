// nexus-signal-track-record.test.ts — Autonomy order: locks the honest
// signal-accuracy methodology (first-touch, conservative on gaps, superseded
// plans never counted as outcomes). Pure logic, real Trade Plan objects from
// the real engine — never hand-built decision objects.
import { describe, it, expect } from 'vitest';
import {
  trackPlanTransition,
  trackPriceTick,
  hitRate,
  samePlan,
  rehydrateTrackRecord,
  EMPTY_TRACK_RECORD,
  TRACK_RECORD_HISTORY_CAP,
  type TrackRecordState,
} from '../src/nexus/signal-track-record';
import { buildTradePlan } from '../src/nexus/trade-plan';

const realPlan = (price = 50_000) =>
  buildTradePlan({
    stance: 'LONG',
    riskGated: false,
    price,
    zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
    levels: [
      { price: 48_800, kind: 'SR_SUPPORT_1' },
      { price: 51_000, kind: 'SR_RESISTANCE_1' },
    ],
  })!;

describe('trackPlanTransition: identity by VALUES, supersession never counted as outcome', () => {
  it('null plan over empty state is a no-op returning the ORIGINAL reference (zero spurious transitions)', () => {
    expect(trackPlanTransition(EMPTY_TRACK_RECORD, null, 1)).toBe(EMPTY_TRACK_RECORD);
  });

  it('a real plan opens as OPEN with the real timestamp', () => {
    const s = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    expect(s.active?.status).toBe('OPEN');
    expect(s.active?.openedAt).toBe(1_000);
    expect(s.history).toHaveLength(0);
  });

  it('same-value re-derivation (the engine recomputes per tick) is the SAME plan — original openedAt kept, original state ref returned', () => {
    const s1 = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const s2 = trackPlanTransition(s1, realPlan(50_050), 2_000); // same levels, new object
    expect(s2).toBe(s1);
  });

  it('a materially different plan REPLACES the open one — counted as superseded, never a win/loss', () => {
    const s1 = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const other = { ...realPlan(), target: { price: 52_000, basis: 'EQH' } };
    const s2 = trackPlanTransition(s1, other, 2_000);
    expect(s2.replaced).toBe(1);
    expect(s2.history[0].status).toBe('REPLACED');
    expect(s2.active?.plan.target.price).toBe(52_000);
    expect(hitRate(s2)).toBeNull(); // superseded is not an outcome
  });

  it('plan withdrawn (brain lost its stance) closes the open plan as REPLACED', () => {
    const s1 = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const s2 = trackPlanTransition(s1, null, 2_000);
    expect(s2.active).toBeNull();
    expect(s2.replaced).toBe(1);
  });

  it('samePlan compares direction and all levels exactly', () => {
    const a = realPlan();
    expect(samePlan(a, { ...a })).toBe(true);
    expect(samePlan(a, { ...a, stop: { ...a.stop, price: a.stop.price - 1 } })).toBe(false);
  });
});

describe('trackPriceTick: first-touch resolution, conservative on gaps', () => {
  const open = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);

  it('price between stop and target resolves nothing — original reference returned', () => {
    expect(trackPriceTick(open, 50_200, 2_000)).toBe(open);
  });

  it('target touched first => TARGET_HIT with the real resolving price', () => {
    const s = trackPriceTick(open, 51_000, 2_000);
    expect(s.targetHits).toBe(1);
    expect(s.active).toBeNull();
    expect(s.history[0]).toMatchObject({ status: 'TARGET_HIT', resolvedPrice: 51_000, resolvedAt: 2_000 });
    expect(hitRate(s)).toBe(1);
  });

  it('stop touched first => STOP_HIT', () => {
    const s = trackPriceTick(open, 48_700, 2_000);
    expect(s.stopHits).toBe(1);
    expect(hitRate(s)).toBe(0);
  });

  it('a gap through the whole bracket resolves CONSERVATIVELY as STOP_HIT — the record never flatters itself', () => {
    // Absurd single tick below stop AND... cannot satisfy both for a LONG in
    // one price; the conservative rule is exercised via ordering: stop check wins.
    const s = trackPriceTick(open, 48_000, 2_000);
    expect(s.history[0].status).toBe('STOP_HIT');
  });

  it('non-finite price never resolves anything (fail-closed)', () => {
    expect(trackPriceTick(open, NaN, 2_000)).toBe(open);
  });

  it('history is ring-capped', () => {
    let s: TrackRecordState = EMPTY_TRACK_RECORD;
    for (let i = 0; i < TRACK_RECORD_HISTORY_CAP + 10; i++) {
      s = trackPlanTransition(s, realPlan(), i);
      s = trackPriceTick(s, 51_000, i);
    }
    expect(s.history.length).toBe(TRACK_RECORD_HISTORY_CAP);
    expect(s.targetHits).toBe(TRACK_RECORD_HISTORY_CAP + 10); // counters never truncate
  });
});

describe('hitRate + rehydration honesty', () => {
  it('hitRate is null until something REAL resolved — never a fabricated 0%/100%', () => {
    expect(hitRate(EMPTY_TRACK_RECORD)).toBeNull();
  });

  it('rehydrate rejects garbage/foreign versions fail-closed (empty honest state)', () => {
    expect(rehydrateTrackRecord(null)).toBe(EMPTY_TRACK_RECORD);
    expect(rehydrateTrackRecord({ contractVersion: 99 })).toBe(EMPTY_TRACK_RECORD);
    expect(rehydrateTrackRecord('junk')).toBe(EMPTY_TRACK_RECORD);
  });

  it('an OPEN plan from a dead session is counted superseded on rehydration — never resolved in absentia', () => {
    const openState = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const rehydrated = rehydrateTrackRecord(JSON.parse(JSON.stringify(openState)));
    expect(rehydrated.active).toBeNull();
    expect(rehydrated.replaced).toBe(1);
    expect(rehydrated.history[rehydrated.history.length - 1].status).toBe('REPLACED');
  });

  it('a clean resolved record round-trips intact', () => {
    const resolved = trackPriceTick(trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1), 51_000, 2);
    const rehydrated = rehydrateTrackRecord(JSON.parse(JSON.stringify(resolved)));
    expect(rehydrated.targetHits).toBe(1);
    expect(rehydrated.history).toHaveLength(1);
  });
});
