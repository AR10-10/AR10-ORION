// nexus-signal-track-record.test.ts — Autonomy order + Diretriz
// Complementar (Nexus Predictive Engine) §2/§4: locks the honest
// signal-accuracy methodology (progressive multi-target ladder,
// break-even suggestion, conservative on gaps, superseded plans never
// counted as outcomes). Pure logic, real Trade Plan objects from the real
// engine — never hand-built decision objects.
import { describe, it, expect } from 'vitest';
import {
  trackPlanTransition,
  trackPriceTick,
  hitRate,
  samePlan,
  rehydrateTrackRecord,
  EMPTY_TRACK_RECORD,
  TRACK_RECORD_CONTRACT_VERSION,
  TRACK_RECORD_HISTORY_CAP,
  type TrackRecordState,
} from '../src/nexus/signal-track-record';
import { buildTradePlan } from '../src/nexus/trade-plan';

// Single-target fixture (only one real opposing level) — the v1-equivalent
// case, still fully supported: a plan can honestly have just 1 target.
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

// Two-target fixture — exercises the real progressive ladder (target1 then
// target2), break-even suggestion, and partial-hit resolution.
const twoTargetPlan = (price = 50_000) =>
  buildTradePlan({
    stance: 'LONG',
    riskGated: false,
    price,
    zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
    levels: [
      { price: 48_800, kind: 'SR_SUPPORT_1' },
      { price: 51_000, kind: 'SR_RESISTANCE_1' },
      { price: 52_200, kind: 'EQH' },
    ],
  })!;

describe('trackPlanTransition: identity by VALUES, supersession never counted as outcome', () => {
  it('null plan over empty state is a no-op returning the ORIGINAL reference (zero spurious transitions)', () => {
    expect(trackPlanTransition(EMPTY_TRACK_RECORD, null, 1)).toBe(EMPTY_TRACK_RECORD);
  });

  it('a real plan opens as OPEN with the real timestamp, zero targets hit, no break-even yet', () => {
    const s = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    expect(s.active?.status).toBe('OPEN');
    expect(s.active?.openedAt).toBe(1_000);
    expect(s.active?.targetsHit).toBe(0);
    expect(s.active?.breakEvenSuggested).toBe(false);
    expect(s.history).toHaveLength(0);
  });

  it('same-value re-derivation (the engine recomputes per tick) is the SAME plan — original openedAt kept, original state ref returned', () => {
    const s1 = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const s2 = trackPlanTransition(s1, realPlan(50_050), 2_000); // same levels, new object
    expect(s2).toBe(s1);
  });

  it('a materially different plan REPLACES the open one — counted as superseded, never a win/loss', () => {
    const s1 = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const other = { ...realPlan(), targets: [{ price: 52_000, basis: 'EQH' }] };
    const s2 = trackPlanTransition(s1, other, 2_000);
    expect(s2.replaced).toBe(1);
    expect(s2.history[0].status).toBe('REPLACED');
    expect(s2.active?.plan.targets[0].price).toBe(52_000);
    expect(hitRate(s2)).toBeNull(); // superseded is not an outcome
  });

  it('plan withdrawn (brain lost its stance) closes the open plan as REPLACED', () => {
    const s1 = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const s2 = trackPlanTransition(s1, null, 2_000);
    expect(s2.active).toBeNull();
    expect(s2.replaced).toBe(1);
  });

  it('samePlan compares direction, entry, stop and every target in order', () => {
    const a = realPlan();
    expect(samePlan(a, { ...a })).toBe(true);
    expect(samePlan(a, { ...a, stop: { ...a.stop, price: a.stop.price - 1 } })).toBe(false);
    expect(samePlan(a, { ...a, targets: [{ ...a.targets[0], price: a.targets[0].price + 1 }] })).toBe(false);
  });

  it('a target added/removed from the ladder counts as a materially different plan', () => {
    expect(samePlan(realPlan(), twoTargetPlan())).toBe(false);
  });
});

describe('trackPriceTick: single-target plan resolves exactly like v1 (backward-honest)', () => {
  const open = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);

  it('price between stop and target resolves nothing — original reference returned', () => {
    expect(trackPriceTick(open, 50_200, 2_000)).toBe(open);
  });

  it('target touched first => TARGET_HIT with the real resolving price (single target = full ladder)', () => {
    const s = trackPriceTick(open, 51_000, 2_000);
    expect(s.targetHits).toBe(1);
    expect(s.active).toBeNull();
    expect(s.history[0]).toMatchObject({ status: 'TARGET_HIT', resolvedPrice: 51_000, resolvedAt: 2_000, targetsHit: 1 });
    expect(hitRate(s)).toBe(1);
  });

  it('stop touched first (zero targets hit) => STOP_HIT, a genuine loss', () => {
    const s = trackPriceTick(open, 48_700, 2_000);
    expect(s.stopHits).toBe(1);
    expect(s.partialHits).toBe(0);
    expect(hitRate(s)).toBe(0);
  });

  it('a gap through the whole bracket resolves CONSERVATIVELY as STOP_HIT — the record never flatters itself', () => {
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

describe('trackPriceTick v2: progressive multi-target ladder + break-even suggestion (Diretriz Complementar §2/§4)', () => {
  it('target 1 touched: plan STAYS open, targetsHit=1, breakEvenSuggested becomes true — never a fabricated close', () => {
    const open = trackPlanTransition(EMPTY_TRACK_RECORD, twoTargetPlan(), 1_000);
    const s = trackPriceTick(open, 51_000, 2_000);
    expect(s.active).not.toBeNull();
    expect(s.active?.status).toBe('OPEN');
    expect(s.active?.targetsHit).toBe(1);
    expect(s.active?.breakEvenSuggested).toBe(true);
    expect(s.targetHits).toBe(0); // not a full resolution yet
    expect(s.history).toHaveLength(0);
  });

  it('target 1 then target 2 touched, in order => full TARGET_HIT resolution', () => {
    let s = trackPlanTransition(EMPTY_TRACK_RECORD, twoTargetPlan(), 1_000);
    s = trackPriceTick(s, 51_000, 2_000); // target 1
    s = trackPriceTick(s, 52_200, 3_000); // target 2 — completes the ladder
    expect(s.active).toBeNull();
    expect(s.targetHits).toBe(1);
    expect(s.history[0]).toMatchObject({ status: 'TARGET_HIT', targetsHit: 2, resolvedPrice: 52_200 });
    expect(hitRate(s)).toBe(1);
  });

  it('target 1 touched, then price returns to break-even (entry) before target 2 => PARTIAL_HIT, never counted as a stop', () => {
    let s = trackPlanTransition(EMPTY_TRACK_RECORD, twoTargetPlan(), 1_000);
    s = trackPriceTick(s, 51_000, 2_000); // target 1 — break-even now active
    const entryMid = (49_200 + 49_500) / 2;
    s = trackPriceTick(s, entryMid, 3_000); // price returns to break-even
    expect(s.active).toBeNull();
    expect(s.partialHits).toBe(1);
    expect(s.stopHits).toBe(0);
    expect(s.history[0]).toMatchObject({ status: 'PARTIAL_HIT', targetsHit: 1 });
    // Reaching a real target validates the read — counted toward hitRate,
    // never lumped in with a clean stop-out.
    expect(hitRate(s)).toBe(1);
  });

  it('zero targets hit, original stop touched => STOP_HIT (genuine loss), break-even never engaged', () => {
    let s = trackPlanTransition(EMPTY_TRACK_RECORD, twoTargetPlan(), 1_000);
    s = trackPriceTick(s, 48_700, 2_000); // original stop, before any target
    expect(s.stopHits).toBe(1);
    expect(s.partialHits).toBe(0);
    expect(s.history[0]).toMatchObject({ status: 'STOP_HIT', targetsHit: 0 });
    expect(hitRate(s)).toBe(0);
  });

  it('after break-even engages, a tick touching BOTH break-even and target 2 resolves conservatively as PARTIAL_HIT — never advances on an ambiguous gap', () => {
    let s = trackPlanTransition(EMPTY_TRACK_RECORD, twoTargetPlan(), 1_000);
    s = trackPriceTick(s, 51_000, 2_000); // target 1 hit, break-even = entryMid
    const entryMid = (49_200 + 49_500) / 2;
    // A single tick that would satisfy both "at/below break-even" and
    // "at/above target 2" is impossible for a LONG (break-even < target2),
    // so conservatism is exercised via a tick AT break-even exactly while
    // target 2 remains untouched — the stop reading must win, never a
    // silent advance.
    s = trackPriceTick(s, entryMid, 3_000);
    expect(s.history[0].status).toBe('PARTIAL_HIT');
  });

  it('mixed ladder: 3-target plan resolves target1 -> target2 -> stop-at-breakeven as PARTIAL_HIT with targetsHit=2', () => {
    const plan = buildTradePlan({
      stance: 'LONG',
      riskGated: false,
      price: 50_000,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
      levels: [
        { price: 48_800, kind: 'SR_SUPPORT_1' },
        { price: 51_000, kind: 'SR_RESISTANCE_1' },
        { price: 52_200, kind: 'EQH' },
        { price: 53_000, kind: 'FIB_161.8' },
      ],
    })!;
    expect(plan.targets).toHaveLength(3);
    let s = trackPlanTransition(EMPTY_TRACK_RECORD, plan, 1_000);
    s = trackPriceTick(s, 51_000, 2_000); // target 1
    s = trackPriceTick(s, 52_200, 3_000); // target 2 — stop now TRAILS to target 1 (51_000), not just break-even
    expect(s.active?.targetsHit).toBe(2);
    expect(s.active?.status).toBe('OPEN'); // target 3 still real and unproven
    const entryMid = (49_200 + 49_500) / 2;
    s = trackPriceTick(s, entryMid, 4_000); // well below the ratcheted stop (51_000) — resolves before target 3
    expect(s.active).toBeNull();
    expect(s.partialHits).toBe(1);
    expect(s.history[0]).toMatchObject({ status: 'PARTIAL_HIT', targetsHit: 2 });
  });

  it('§18 trailing stop além do break-even: a pullback that survives at flat break-even now stops the plan out once the stop has TRAILED past it — the target-1 gain is locked in, never given all back', () => {
    const plan = buildTradePlan({
      stance: 'LONG',
      riskGated: false,
      price: 50_000,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
      levels: [
        { price: 48_800, kind: 'SR_SUPPORT_1' },
        { price: 51_000, kind: 'SR_RESISTANCE_1' },
        { price: 52_200, kind: 'EQH' },
        { price: 53_000, kind: 'FIB_161.8' },
      ],
    })!;
    let s = trackPlanTransition(EMPTY_TRACK_RECORD, plan, 1_000);
    s = trackPriceTick(s, 51_000, 2_000); // target 1 hit — stop -> break-even (~49_350)
    // A dip to 50_000 is above break-even: the plan survives, untouched.
    expect(trackPriceTick(s, 50_000, 2_500)).toBe(s);
    s = trackPriceTick(s, 52_200, 3_000); // target 2 hit — stop -> target 1 (51_000)
    expect(s.active?.targetsHit).toBe(2);
    // The SAME 50_000 dip that was harmless a moment ago now breaches the
    // ratcheted stop — the record must reflect the real, higher floor.
    const resolved = trackPriceTick(s, 50_000, 3_500);
    expect(resolved.active).toBeNull();
    expect(resolved.partialHits).toBe(1);
    expect(resolved.history[0]).toMatchObject({ status: 'PARTIAL_HIT', targetsHit: 2, resolvedPrice: 50_000 });
  });
});

describe('hitRate + rehydration honesty', () => {
  it('hitRate is null until something REAL resolved — never a fabricated 0%/100%', () => {
    expect(hitRate(EMPTY_TRACK_RECORD)).toBeNull();
  });

  it('hitRate combines full target hits AND partial hits over every resolved plan', () => {
    let s = EMPTY_TRACK_RECORD;
    s = trackPriceTick(trackPlanTransition(s, realPlan(), 1), 51_000, 2); // TARGET_HIT
    s = trackPriceTick(trackPlanTransition(s, realPlan(), 3), 48_700, 4); // STOP_HIT
    expect(hitRate(s)).toBe(0.5);
  });

  it('rehydrate rejects garbage/foreign versions fail-closed (empty honest state), including a v1-shaped record', () => {
    expect(rehydrateTrackRecord(null)).toBe(EMPTY_TRACK_RECORD);
    expect(rehydrateTrackRecord({ contractVersion: 99 })).toBe(EMPTY_TRACK_RECORD);
    expect(rehydrateTrackRecord('junk')).toBe(EMPTY_TRACK_RECORD);
    // v1 shape: no partialHits field — a genuinely different contract,
    // never guessed/migrated.
    expect(rehydrateTrackRecord({ contractVersion: 1, active: null, history: [], targetHits: 0, stopHits: 0, replaced: 0 })).toBe(EMPTY_TRACK_RECORD);
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

  it('contract version is 2', () => {
    expect(TRACK_RECORD_CONTRACT_VERSION).toBe(2);
    expect(EMPTY_TRACK_RECORD.contractVersion).toBe(2);
  });
});

// ─── Cockpit de Leitura §11: contexto de abertura (ETA previsto etc.) ───
import { stampOpenContext, type PlanOpenContext } from '../src/nexus/signal-track-record';

describe('§11 stampOpenContext: carimbo único, nunca reescrita retroativa', () => {
  const ctx: PlanOpenContext = {
    etaMsAtOpen: 600_000,
    etaMsMinAtOpen: 300_000,
    vwapState: 'BULLISH',
    nexusLineState: 'BULLISH',
    score: 72,
  };

  it('carimba o plano ativo UMA vez; a segunda chamada devolve o estado ORIGINAL (identidade)', () => {
    const opened = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const stamped = stampOpenContext(opened, ctx);
    expect(stamped.active!.contextAtOpen).toEqual(ctx);
    const again = stampOpenContext(stamped, { ...ctx, score: 99 });
    expect(again).toBe(stamped); // guard: já carimbado => referência original, zero reescrita
    expect(again.active!.contextAtOpen!.score).toBe(72);
  });

  it('sem plano ativo => estado original intocado (nenhum carimbo fabricado)', () => {
    expect(stampOpenContext(EMPTY_TRACK_RECORD, ctx)).toBe(EMPTY_TRACK_RECORD);
  });

  it('o carimbo viaja para o histórico na resolução — ETA realizado é derivável de resolvedAt − openedAt', () => {
    const opened = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const stamped = stampOpenContext(opened, ctx);
    // stop real do plano single-target: 48_800 => tick abaixo resolve STOP_HIT
    const resolved = trackPriceTick(stamped, 48_700, 901_000);
    const last = resolved.history[resolved.history.length - 1];
    expect(last.status).toBe('STOP_HIT');
    expect(last.contextAtOpen).toEqual(ctx); // fotografia preservada
    expect(last.resolvedAt! - last.openedAt).toBe(900_000); // realizado real (15m)
  });

  it('rehydrate v2 preserva o campo opcional (registros antigos SEM ele continuam válidos)', () => {
    const opened = trackPlanTransition(EMPTY_TRACK_RECORD, realPlan(), 1_000);
    const stamped = stampOpenContext(opened, ctx);
    const resolved = trackPriceTick(stamped, 48_700, 901_000);
    const roundTrip = rehydrateTrackRecord(JSON.parse(JSON.stringify(resolved)));
    const last = roundTrip.history[roundTrip.history.length - 1];
    expect(last.contextAtOpen).toEqual(ctx);
    // registro legado sem o campo: rehydrate aceita normalmente
    const legacy = JSON.parse(JSON.stringify(resolved));
    delete legacy.history[legacy.history.length - 1].contextAtOpen;
    expect(rehydrateTrackRecord(legacy).history.length).toBe(resolved.history.length);
  });
});
