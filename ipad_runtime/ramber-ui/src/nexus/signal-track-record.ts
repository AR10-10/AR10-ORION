// signal-track-record.ts — Autonomy order: the first HONEST accuracy metric
// of the organism. Every Trade Plan the brain forms is tracked against the
// REAL price that follows: which level was touched first — target or stop?
//
// v2 (Diretriz Complementar — Nexus Predictive Engine, §2/§4): a plan now
// carries up to MAX_TARGETS real targets (trade-plan.ts). Tracking a single
// "first touch of either level" no longer describes the real lifecycle —
// price can prove target 1, then target 2, then stop out before target 3.
// The ladder this file tracks is the same mechanical convention real desks
// use, expressed honestly (never auto-applied — this is a READ_ONLY
// terminal, "suggested" means displayed, never an order placed):
//   - While NO real target has been touched yet, the plan resolves STOP_HIT
//     against the ORIGINAL stop — a genuine loss.
//   - The instant a real target is touched, the plan does NOT close: it
//     keeps tracking toward the NEXT real target (if any), and the
//     effective stop for everything from here on ratchets forward —
//     entry price (break-even) after the 1st real target, then the
//     PREVIOUS target's price after each subsequent one (§18 "trailing
//     stop além do break-even": locks in the gain already validated,
//     never gives it all back). `breakEvenSuggested` on the active plan
//     reflects that the stop has moved off its original risk (§4
//     "Break-even sugerido"); the exact level is
//     `effectiveStopForTargetsHit()` in trade-plan.ts — single real
//     source, also consumed by the chart's hit-boost effect.
//   - If every real target in the plan is eventually touched, in order,
//     the plan resolves TARGET_HIT (full read).
//   - If price returns to the current ratcheted stop (or beyond) after
//     banking >=1 real target but before the final one, the plan resolves
//     PARTIAL_HIT — a validated read that didn't run its full course,
//     honestly distinct from both a full win and a clean loss (never
//     counted as a stop).
//
// Methodology (extends the v1 first-touch evaluation, stated openly):
//   - A plan is OPEN from the moment it forms. Each tick is checked against
//     the CURRENT effective stop and the NEXT unproven real target only.
//     If a single tick satisfies both simultaneously (a gap through the
//     whole bracket), the CONSERVATIVE reading wins: the stop/break-even —
//     the record must never flatter itself.
//   - A materially different plan (direction, entry, stop, or any ALREADY
//     PROVEN target changed) REPLACES the open one. Replaced plans are
//     counted separately — never as a win, never as a loss (they were
//     advisory readings superseded by structure, not resolved trades). Re-
//     derivations with identical numbers are the SAME plan (the engine
//     recomputes per tick; identity is by values).
//   - Ordem "Recálculo Vivo do Trade Plan" §7/§24 (achado real: buildTradePlan
//     re-deriva TODO o plano do zero a cada ciclo estrutural — antes desta
//     correção, qualquer mudança em QUALQUER alvo, mesmo um TP2/TP3 ainda
//     não tocado, contava como REPLACED e zerava targetsHit/openedAt/
//     breakEvenSuggested, mesmo segundos depois de um TP1 real ter sido
//     provado). Quando pelo menos 1 alvo real já foi provado
//     (targetsHit > 0) E direção/entry/stop/todo alvo JÁ PROVADO continuam
//     idênticos, uma mudança que só afeta os alvos SEGUINTES é REAVALIAÇÃO
//     do mesmo plano (isTargetRefinement abaixo) — "TP2 mantido/ajustado
//     somente se os motores justificarem" é exatamente essa fresta: nem
//     ignorar a estrutura nova (ficaria com um TP2 morto) nem descartar o
//     progresso real já provado (contaria um TP1 real como se nunca tivesse
//     acontecido). Zero motor novo: mesmos dados, mesmo buildTradePlan —
//     só a CLASSIFICAÇÃO da transição fica mais precisa.
//   - hitRate = (targetHits + partialHits) / (targetHits + partialHits +
//     stopHits): reaching at least one real target validates the
//     structural read even if the ladder didn't complete; a clean stop
//     with ZERO targets touched is the only genuine miss. null until at
//     least one plan actually resolves (never a fabricated 0% or 100%).
//
// Pure functions of (state, input, now) — zero I/O, zero clock of their
// own. Functions return the ORIGINAL state reference when nothing changed,
// so a store write with an unchanged state never notifies the organism.
import type { TradePlan } from "./trade-plan";
import { effectiveStopForTargetsHit } from "./trade-plan";

export const TRACK_RECORD_CONTRACT_VERSION = 2 as const;

export type TrackedPlanStatus = "OPEN" | "TARGET_HIT" | "PARTIAL_HIT" | "STOP_HIT" | "REPLACED";

// Cockpit de Leitura §11 ("ETA previsto / ETA realizado" + contexto):
// fotografia REAL do momento em que o plano abriu — carimbada UMA vez
// (stampOpenContext), nunca reescrita (a memória "não deve alterar
// retroativamente os dados históricos"). O ETA REALIZADO nunca é
// armazenado à parte: é derivável de resolvedAt − openedAt, que já são
// fatos registrados — armazenar de novo seria uma segunda fonte.
export interface PlanOpenContext {
  etaMsAtOpen: number | null; // ETA provável do PRÓXIMO alvo na abertura
  etaMsMinAtOpen: number | null; // piso da faixa (modelo ER=1) na abertura
  vwapState: "BULLISH" | "BEARISH" | "NEUTRAL" | null;
  nexusLineState: "BULLISH" | "BEARISH" | "NEUTRAL" | null;
  score: number | null; // Institutional Score na abertura
  // Entrega 42 (Profitability Engine): rótulo REAL de engine.marketRegime.
  // regime (market-regime/regime-engine.js, ADX/Bollinger) na abertura —
  // mesmo motor já usado pelo header/Relevance Engine, zero classificador
  // novo. Opcional (registros antigos persistidos nunca tiveram este
  // campo) — expectancy estratificada por regime simplesmente exclui
  // trades sem este dado, nunca inventa um regime retroativo.
  regime?: string | null;
}

export interface TrackedPlan {
  plan: TradePlan;
  openedAt: number;
  status: TrackedPlanStatus;
  resolvedAt: number | null;
  // Price that resolved the plan (real tick), null while OPEN/REPLACED.
  resolvedPrice: number | null;
  // v2: how many of plan.targets were touched, in order, so far (0 while no
  // real target has been proven yet). Drives which target/stop the NEXT
  // tick is checked against.
  targetsHit: number;
  // v2: true once targetsHit >= 1 AND a real target still remains — the
  // mechanical break-even convention (§4). Always false once the plan is
  // fully resolved or before the first real target is touched.
  breakEvenSuggested: boolean;
  // §11: presente só quando o carimbo real aconteceu (campo opcional —
  // registros antigos persistidos continuam válidos no rehydrate v2).
  contextAtOpen?: PlanOpenContext;
}

export interface TrackRecordState {
  contractVersion: typeof TRACK_RECORD_CONTRACT_VERSION;
  active: TrackedPlan | null;
  // Resolved/replaced plans, newest last, ring-capped.
  history: TrackedPlan[];
  targetHits: number; // every real target in the plan was touched, in order
  partialHits: number; // v2: >=1 real target touched, then stopped at break-even/beyond
  stopHits: number; // ZERO real targets touched before the original stop — a genuine loss
  replaced: number;
}

export const TRACK_RECORD_HISTORY_CAP = 100;

export const EMPTY_TRACK_RECORD: TrackRecordState = {
  contractVersion: TRACK_RECORD_CONTRACT_VERSION,
  active: null,
  history: [],
  targetHits: 0,
  partialHits: 0,
  stopHits: 0,
  replaced: 0,
};

/** Value identity: the engine re-derives the plan on every price tick, so
 *  object references change constantly — two plans are the SAME advisory
 *  reading when direction, entry, stop and every target (in order) match
 *  exactly. */
export function samePlan(a: TradePlan, b: TradePlan): boolean {
  return (
    a.direction === b.direction &&
    a.entry.low === b.entry.low &&
    a.entry.high === b.entry.high &&
    a.stop.price === b.stop.price &&
    a.targets.length === b.targets.length &&
    a.targets.every((t, i) => t.price === b.targets[i].price)
  );
}

function pushHistory(history: TrackedPlan[], entry: TrackedPlan): TrackedPlan[] {
  const next = [...history, entry];
  return next.length > TRACK_RECORD_HISTORY_CAP ? next.slice(next.length - TRACK_RECORD_HISTORY_CAP) : next;
}

/** Ordem "Recálculo Vivo do Trade Plan" §7/§24: true quando `next` é a
 *  MESMA leitura de `prev` reavaliada pela estrutura fresca — direção,
 *  entry, stop e todo alvo já PROVADO (índices 0..targetsHit-1) idênticos,
 *  só os alvos AINDA NÃO tocados podem ter mudado de preço/base real. Só
 *  chamada quando targetsHit > 0 (§7: "quando um alvo for atingido" é o
 *  próprio gatilho da Ordem — antes do 1º alvo real, qualquer mudança
 *  continua sendo um sinal genuinamente novo, comportamento intocado).
 *  `next.targets.length < targetsHit` (a estrutura fresca não tem mais os
 *  níveis já tocados) nunca reivindica continuidade — cai no REPLACED de
 *  sempre, a mesma honestidade de "não fingir que sei o que não sei". */
export function isTargetRefinement(prev: TradePlan, next: TradePlan, targetsHit: number): boolean {
  if (targetsHit <= 0) return false;
  if (prev.direction !== next.direction) return false;
  if (prev.entry.low !== next.entry.low || prev.entry.high !== next.entry.high) return false;
  if (prev.stop.price !== next.stop.price) return false;
  if (next.targets.length < targetsHit) return false;
  for (let i = 0; i < targetsHit; i++) {
    if (prev.targets[i].price !== next.targets[i].price) return false;
  }
  return true;
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
    return { ...state, active: { plan, openedAt: now, status: "OPEN", resolvedAt: null, resolvedPrice: null, targetsHit: 0, breakEvenSuggested: false } };
  }
  if (samePlan(state.active.plan, plan)) return state; // same advisory reading — keep original openedAt/progress
  // Ordem "Recálculo Vivo do Trade Plan" §7/§24: reavaliação do MESMO
  // plano (alvo já provado intocado, só os seguintes mudaram) — preserva
  // openedAt/targetsHit/breakEvenSuggested/contextAtOpen reais, troca só o
  // plano (o alvo seguinte que trackPriceTick lê passa a ser o refinado).
  // Nunca conta como REPLACED: nenhum progresso real foi perdido.
  if (isTargetRefinement(state.active.plan, plan, state.active.targetsHit)) {
    return { ...state, active: { ...state.active, plan } };
  }
  return {
    ...state,
    active: { plan, openedAt: now, status: "OPEN", resolvedAt: null, resolvedPrice: null, targetsHit: 0, breakEvenSuggested: false },
    history: pushHistory(state.history, { ...state.active, status: "REPLACED", resolvedAt: now, resolvedPrice: null }),
    replaced: state.replaced + 1,
  };
}

/** §11: carimba o contexto de abertura no plano ATIVO — uma única vez.
 *  Sem plano ativo, ou já carimbado, devolve o estado ORIGINAL (nenhuma
 *  transição, nenhum evento, nunca uma reescrita retroativa). Chamado
 *  pelo App no primeiro ciclo em que as leituras do plano recém-aberto
 *  existem (o etaReading daquele render já é o do plano novo). */
export function stampOpenContext(state: TrackRecordState, ctx: PlanOpenContext): TrackRecordState {
  if (!state.active || state.active.contextAtOpen !== undefined) return state;
  return { ...state, active: { ...state.active, contextAtOpen: ctx } };
}

/** Real price tick vs the open plan's CURRENT rung of the target ladder and
 *  its CURRENT effective stop (original, or break-even once >=1 real
 *  target has been proven). Conservative on a bracket gap: the stop/break-
 *  even reading wins. Returns the ORIGINAL state when nothing resolves. */
export function trackPriceTick(state: TrackRecordState, price: number, now: number): TrackRecordState {
  const active = state.active;
  if (!active || !Number.isFinite(price)) return state;
  const plan = active.plan;
  const long = plan.direction === "LONG";
  const targetsHit = active.targetsHit;
  const totalTargets = plan.targets.length;

  const effectiveStopPrice = effectiveStopForTargetsHit(plan, targetsHit);
  const stopTouched = long ? price <= effectiveStopPrice : price >= effectiveStopPrice;

  const nextTarget = plan.targets[targetsHit] ?? null;
  const targetTouched = nextTarget !== null && (long ? price >= nextTarget.price : price <= nextTarget.price);

  if (!stopTouched && !targetTouched) return state;

  // Conservative: on any ambiguity (both touched in the same tick), the
  // stop/break-even reading wins — never advance the ladder on a gap that
  // could equally have stopped the plan out.
  if (stopTouched) {
    const status: TrackedPlanStatus = targetsHit > 0 ? "PARTIAL_HIT" : "STOP_HIT";
    return {
      ...state,
      active: null,
      history: pushHistory(state.history, { ...active, status, resolvedAt: now, resolvedPrice: price, targetsHit, breakEvenSuggested: false }),
      partialHits: state.partialHits + (status === "PARTIAL_HIT" ? 1 : 0),
      stopHits: state.stopHits + (status === "STOP_HIT" ? 1 : 0),
    };
  }

  const newTargetsHit = targetsHit + 1;
  if (newTargetsHit >= totalTargets) {
    // Every real target in the ladder proven — full resolution.
    return {
      ...state,
      active: null,
      history: pushHistory(state.history, { ...active, status: "TARGET_HIT", resolvedAt: now, resolvedPrice: price, targetsHit: newTargetsHit, breakEvenSuggested: false }),
      targetHits: state.targetHits + 1,
    };
  }
  // Partial progress — the plan stays OPEN, now tracking toward the next
  // real target with the stop moved to break-even.
  return {
    ...state,
    active: { ...active, targetsHit: newTargetsHit, breakEvenSuggested: true },
  };
}

/** (targetHits + partialHits) / resolved — null until something REAL
 *  resolved. Reaching >=1 real target validates the structural read even
 *  when the ladder didn't complete; only a clean stop with zero targets
 *  touched counts as a genuine miss. */
export function hitRate(state: TrackRecordState): number | null {
  const resolved = state.targetHits + state.partialHits + state.stopHits;
  return resolved === 0 ? null : (state.targetHits + state.partialHits) / resolved;
}

/** Fail-closed rehydration: accepts only a structurally valid persisted
 *  state of the SAME contract version; anything else yields the empty
 *  honest state (never a partially-trusted record). A v1 record (single
 *  `target`, no `partialHits`) is a genuinely different shape — it is
 *  NOT migrated (that would require guessing at targets 2/3 that were
 *  never real for that plan) — it fails closed to empty, same as any
 *  other foreign/invalid version. */
export function rehydrateTrackRecord(raw: unknown): TrackRecordState {
  const r = raw as TrackRecordState | null | undefined;
  if (
    !r || typeof r !== "object" ||
    r.contractVersion !== TRACK_RECORD_CONTRACT_VERSION ||
    !Array.isArray(r.history) ||
    typeof r.targetHits !== "number" || typeof r.partialHits !== "number" ||
    typeof r.stopHits !== "number" || typeof r.replaced !== "number"
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
