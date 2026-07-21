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
  // Diretriz de Evolução Integral (Omega Core, rodada 2) §5/§6 — "até onde
  // existe espaço real para o preço se mover antes de encontrar uma
  // barreira relevante?": contagem de zonas estruturais REAIS (Order
  // Blocks/FVGs — inputs.zones, nunca cruzadas contra alvos antes desta
  // evolução) que ficam entre a entrada e ESTE alvo. Só em targets[i]
  // (undefined em stop, onde o conceito não se aplica). Nunca invalida o
  // alvo nem altera preço/R:R — é uma anotação honesta a mais, igual ao
  // R:R abaixo do piso: o Operador decide o que fazer com a informação.
  obstacleCount?: number;
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
  // Evolução Profunda §6/§13-G: a level whose R:R would be non-positive
  // (broken geometry) is filtered out BEFORE this array is built — a
  // target only ever appears here already validated.
  targets: TradePlanLevel[];
  // riskRewardRatios[i] mirrors targets[i]: (target − entry midpoint) /
  // (entry midpoint − stop), mirrored for SHORT. Always a real positive
  // number by construction now — a target with non-positive reward never
  // reaches this array (see targets above); the type stays nullable only
  // so older persisted/replayed plans (contractVersion < this change)
  // still type-check without a migration.
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

// Diretriz de Evolução Integral (Omega Core, rodada 2) §5/§6 — zonas
// estruturais REAIS (inputs.zones — Order Blocks/FVGs, qualquer kind, nunca
// só as elegíveis como entrada) cujo intervalo [low,high] cruza o caminho
// entre a entrada e o alvo. A própria zona de entrada nunca conta (é de
// onde se está saindo, não uma barreira à frente). Não é o mesmo dado que
// "targets" (que só vem de inputs.levels — S/R, EQH/EQL, Fib, VP) nem
// duplica seleção nenhuma: zonas nunca competiam por uma vaga de alvo,
// isto só soma uma leitura honesta a mais sobre o MESMO plano já real.
//
// Exportada (Diretriz Restauração/Inteligência Visual §6, "risco visual...
// obstáculo estrutural"): countObstacleZones abaixo só precisava do
// TAMANHO da lista; o gráfico (App.tsx) precisa da lista em si, para
// destacar EXATAMENTE essas zonas — já desenhadas pelo LiquidityZonesPlugin
// — com uma borda de ênfase. Mesma função, dois consumidores, zero cálculo
// duplicado.
export function obstacleZonesInPath(
  zones: TradePlanStructureZone[],
  entry: TradePlanZone,
  targetPrice: number,
  long: boolean,
): TradePlanStructureZone[] {
  const entryMid = (entry.low + entry.high) / 2;
  return zones.filter((z) => {
    if (!fin(z.low) || !fin(z.high) || z.low > z.high) return false;
    if (z.low === entry.low && z.high === entry.high) return false; // a própria zona de entrada nunca é obstáculo do próprio plano
    return long ? z.high > entryMid && z.low < targetPrice : z.low < entryMid && z.high > targetPrice;
  });
}

function countObstacleZones(
  zones: TradePlanStructureZone[],
  entry: TradePlanZone,
  targetPrice: number,
  long: boolean,
): number {
  return obstacleZonesInPath(zones, entry, targetPrice, long).length;
}

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

  const entryMid = (entry.low + entry.high) / 2;
  const risk = long ? entryMid - stop.price : stop.price - entryMid;
  // Evolução Profunda §6/§13-G ("TP INVÁLIDO: Rejeitar plano"): um alvo cuja
  // recompensa real, relativa à entrada, é <= 0 não é um alvo válido — é
  // geometria quebrada (o mesmo "degenera" que a doc do contrato já
  // descrevia para risk<=0). Antes, esse alvo ainda ENTRAVA no plano com
  // R:R em branco, podendo ocupar uma vaga de MAX_TARGETS que um alvo real
  // mereceria; agora é filtrado ANTES do cap, nunca depois — o alvo
  // inválido nunca fica visível com preço real e R:R ausente, como se
  // fosse só um dado incompleto.
  const targets: TradePlanLevel[] = [];
  const riskRewardRatios: number[] = [];
  const seenPrices = new Set<number>();
  for (const t of sortedTargets) {
    if (seenPrices.has(t.price)) continue;
    seenPrices.add(t.price);
    const reward = long ? t.price - entryMid : entryMid - t.price;
    if (!(risk > 0 && reward > 0)) continue;
    targets.push({ price: t.price, basis: t.kind, obstacleCount: countObstacleZones(inputs.zones, entry, t.price, long) });
    riskRewardRatios.push(reward / risk);
    if (targets.length === MAX_TARGETS) break;
  }
  if (targets.length === 0) return null; // nenhum alvo real com recompensa válida — mesma honestidade de "sem alvo"

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

// Diretriz Complementar §18 ("trailing stop além do break-even"): achado
// real de auditoria — signal-track-record.ts e o efeito de hit-boost do
// gráfico (EnhancedChart_110_Percent.tsx) calculavam esta MESMA conta
// (stop original / break-even) de forma duplicada e independente. Extraída
// aqui como fonte única, e estendida: enquanto nenhum alvo real foi
// provado, o stop é o original; a partir do 1º alvo provado, break-even
// (entrada); a partir do 2º, o stop "trilha" para o alvo anterior — a
// mesma convenção mecânica real de mesa de travar o lucro já validado a
// cada novo alvo, nunca uma ordem real (READ_ONLY: isto é o que o
// terminal SUGERE exibir, nunca o que ele executa).
export function effectiveStopForTargetsHit(plan: TradePlan, targetsHit: number): number {
  if (targetsHit <= 0) return plan.stop.price;
  const entryMid = (plan.entry.low + plan.entry.high) / 2;
  if (targetsHit === 1) return entryMid;
  return plan.targets[targetsHit - 2].price;
}
