// microstructure-snapshot.ts — Ordem A2.1 (MICROSTRUCTURE EVENT ENGINE),
// escopo confirmado pelo Operador via AskUserQuestion: "Consolidar sob 1
// contrato tipado", não um motor novo do zero.
//
// AUDITORIA REAL FEITA ANTES DE ESCREVER UMA LINHA (Ordem A2.1 §2/§29,
// "testar duplicação antes de criar"): este projeto já calcula quase tudo
// que a Ordem pede, em 4 sistemas reais e testados, espalhados sem um
// contrato único:
//   - src/orderflow/signal-engine.js → OFI/Absorption/Exhaustion/CVD,
//     sobre ticks de trade REAIS (poller público MEXC).
//   - nexus/trap-detection.ts        → Sweep (EQH/EQL realmente varrido)
//     + Absorção corroborada, escada de confiança real.
//   - nexus/order-book-depth.ts      → imbalance/bidAskRatio/walls, sobre
//     o depth10@100ms REAL (Binance Futures).
//   - nexus/l2-history.ts            → histórico L2 real (ring 2s/6min).
// Este arquivo não recalcula nenhum desses números — só ORGANIZA os 4 sob
// um schema tipado único (Ordem A2.1 §3/§17) e rotula QUALIDADE (§12).
// Zero segunda matemática (Regra de Ouro 4), exceto Event Intensity
// abaixo, que é uma agregação nova mas deliberadamente simples.
//
// DOIS GAPS REAIS, registrados aqui e no relatório da PR — nunca
// escondidos nem preenchidos com dado fabricado (Regra de Ouro 1/3):
//
//   GAP 1 — Sem livro de ofertas incremental. O único book real deste
//   projeto é depth10@100ms: um SNAPSHOT periódico de 10 níveis, sem
//   sequence/update ID (`U`/`u` do stream DIFF real da Binance, que este
//   projeto não assina). Por isso: (a) INVALID_SEQUENCE/
//   RECONCILIATION_REQUIRED (Ordem §12) nunca aparecem no union de
//   qualidade abaixo — não são prováveis com o dado real disponível,
//   declará-las possíveis seria fingir uma garantia que não existe; (b)
//   REPLENISHMENT (Ordem §8) não é implementado nesta rodada — um
//   detector real exigiria inventar matemática nova sobre uma amostra
//   grossa (2s), o que o escopo "consolidar" desta rodada não pediu.
//
//   GAP 2 — Evidence Graph e Five Pillars (Ordem §18/§19) não existem
//   como código real neste projeto (só citados em
//   SYSTEM_HANDBOOK.md/comentários — ver trade-plan-view.ts). Este módulo
//   prepara o dado (o próprio MicrostructureSnapshot) pronto para quando
//   esses sistemas existirem; não os constrói agora.
//
// LEI 24 / Ordem A2.1 §20: display-only / evidência pura. Nenhuma função
// aqui devolve LONG/SHORT/ENTRY/TARGET/STOP, e nenhuma decide nada — só
// organiza e rotula o que os 4 sistemas reais já decidiram/mediram.
import type { Exchange, L2Snapshot } from "./types";
import type { OrderflowSignal } from "../engine-bridge";
import type { TrapSignal } from "./trap-detection";
import { computeBidAskRatio, computeImbalance, detectWalls, WALL_VOLUME_MULTIPLIER } from "./order-book-depth";

export const MICROSTRUCTURE_SNAPSHOT_CONTRACT_VERSION = 1 as const;

/** Ordem A2.1 §12 — qualidade real do dado, nunca uma estimativa
 *  silenciosa. Union DELIBERADAMENTE menor que o texto da Ordem: só os 4
 *  estados que este projeto pode honestamente provar com o dado real que
 *  tem (ver GAP 1 no header). */
export type MicrostructureDataQuality = "VALID" | "PARTIAL" | "STALE" | "INSUFFICIENT_DATA";

/** Um book real mais velho que isto é tratado como STALE — 20x a cadência
 *  real do próprio stream (depth10@100ms). Convenção declarada (mesmo
 *  espírito de WALL_VOLUME_MULTIPLIER em order-book-depth.ts): DIFERENTE
 *  do FRESHNESS_THRESHOLD_MS de health-monitor.ts (60s) de propósito — 60s
 *  foi calibrado para o poll REST de 30s do candle, uma cadência 300x mais
 *  lenta que este WS; reaproveitar aquele número aqui deixaria uma queda
 *  de conexão de book passar por "fresco" por quase 1 minuto. */
export const DEPTH_STALE_THRESHOLD_MS = 2_000;

export interface DepthEvidence {
  quality: MicrostructureDataQuality;
  updatedAt: number | null;
  /** (bidVol - askVol) / (bidVol + askVol) — passthrough real de order-book-depth.ts. */
  imbalance: number | null;
  bidAskRatio: number | null;
  bidWalls: boolean[];
  askWalls: boolean[];
}

/** Passthrough puro: zero recálculo, só organiza os 3 números reais que
 *  order-book-depth.ts já expõe + rotula qualidade pela idade real do book. */
export function composeDepthEvidence(book: L2Snapshot | null | undefined, now: number): DepthEvidence | null {
  if (!book) return null;
  const bids = book.bids ?? [];
  const asks = book.asks ?? [];
  if (bids.length === 0 && asks.length === 0) return null;
  const ageMs = Number.isFinite(book.updatedAt) ? now - book.updatedAt : Infinity;
  const quality: MicrostructureDataQuality = ageMs > DEPTH_STALE_THRESHOLD_MS ? "STALE" : "VALID";
  return {
    quality,
    updatedAt: Number.isFinite(book.updatedAt) ? book.updatedAt : null,
    imbalance: computeImbalance(bids, asks),
    bidAskRatio: computeBidAskRatio(bids, asks),
    bidWalls: detectWalls(bids, WALL_VOLUME_MULTIPLIER),
    askWalls: detectWalls(asks, WALL_VOLUME_MULTIPLIER),
  };
}

/** Ordem A2.1 §7 — "separar ABSORPTION_OBSERVED de ABSORPTION_CONFIRMED
 *  quando a confirmação exigir informação posterior". trap-detection.ts
 *  já implementa exatamente essa distinção em substância (escada de
 *  confiança por corroboração), só sem este vocabulário — formalizado
 *  aqui como leitura, zero recálculo:
 *    NONE       — nenhum sinal real de absorção na amostra.
 *    OBSERVED   — sinal cru de ABSORPTION existe (signal-engine.js), mas
 *                 sem corroboração adicional ainda (trap-detection.ts não
 *                 promoveu pra ABSORCAO_ANOMALA).
 *    CONFIRMED  — trap-detection.ts já corroborou (2+ sinais reais na
 *                 mesma janela, TrapKind ABSORCAO_ANOMALA) — a mesma barra
 *                 que o motor real já usa, nunca uma segunda. */
export type AbsorptionState = "NONE" | "ABSORPTION_OBSERVED" | "ABSORPTION_CONFIRMED";

export function classifyAbsorptionState(
  orderflowSignals: readonly OrderflowSignal[],
  trapSignals: readonly TrapSignal[],
): AbsorptionState {
  if (trapSignals.some((t) => t.kind === "ABSORCAO_ANOMALA")) return "ABSORPTION_CONFIRMED";
  if (orderflowSignals.some((s) => s.type === "ABSORPTION")) return "ABSORPTION_OBSERVED";
  return "NONE";
}

export interface TradeFlowEvidence {
  quality: MicrostructureDataQuality;
  /** CVD da sessão (signal-engine.js) — nunca "24h", ver header do motor. */
  cvd: number | null;
  latestOfi: OrderflowSignal | null;
  absorptionState: AbsorptionState;
  ofiCount: number;
  absorptionCount: number;
  exhaustionCount: number;
}

export function composeTradeFlowEvidence(
  orderflowSignals: readonly OrderflowSignal[],
  trapSignals: readonly TrapSignal[],
  cvd: number | null,
): TradeFlowEvidence | null {
  if (cvd === null && orderflowSignals.length === 0) return null;
  const ofiCount = orderflowSignals.filter((s) => s.type === "OFI").length;
  const absorptionCount = orderflowSignals.filter((s) => s.type === "ABSORPTION").length;
  const exhaustionCount = orderflowSignals.filter((s) => s.type === "EXHAUSTION").length;
  const latestOfi = orderflowSignals.find((s) => s.type === "OFI") ?? null;
  return {
    // PARTIAL quando só CVD chegou (trade acumulado) mas ainda nenhum
    // Signal discreto foi emitido — estado real de "poucos ticks até
    // agora", não um defeito.
    quality: orderflowSignals.length === 0 ? "PARTIAL" : "VALID",
    cvd,
    latestOfi,
    absorptionState: classifyAbsorptionState(orderflowSignals, trapSignals),
    ofiCount,
    absorptionCount,
    exhaustionCount,
  };
}

/** Ordem A2.1 §9 — "intensidade ≠ direção". Contagem real de eventos
 *  (sinais de order flow + traps corroborados) numa janela deslizante —
 *  nunca combinada com sinal/lado pra virar direção. */
export type EventIntensityLevel = "LOW" | "MEDIUM" | "HIGH";

export interface EventIntensityReading {
  level: EventIntensityLevel;
  eventCount: number;
  windowMs: number;
}

/** 60s: mesma ordem de grandeza da janela de corroboração real de
 *  trap-detection.ts (3 ciclos do poller de 4s + folga) multiplicada por
 *  ~5 — agregada o bastante pra não oscilar sinal-a-sinal, curta o
 *  bastante pra descrever "agora", não "a sessão inteira". */
export const EVENT_INTENSITY_WINDOW_MS = 60_000;

/** Convenção DECLARADA, não medida/calibrada contra tráfego real (mesma
 *  honestidade já registrada para exhaustion.reversalConfirmation em
 *  signal-engine.js: "não há dado real de estatística de tick nesta base
 *  pra julgar se está calibrado — registrado honestamente, não
 *  inventado como se fosse medido"). Ajustável aqui quando houver
 *  telemetria real de produção pra calibrar. */
export const EVENT_INTENSITY_MEDIUM_MIN = 3;
export const EVENT_INTENSITY_HIGH_MIN = 7;

export function computeEventIntensity(
  orderflowSignals: readonly OrderflowSignal[],
  trapSignals: readonly TrapSignal[],
  now: number,
  windowMs: number = EVENT_INTENSITY_WINDOW_MS,
): EventIntensityReading {
  const cutoff = now - windowMs;
  const recentSignals = orderflowSignals.filter((s) => s.timestamp >= cutoff).length;
  const recentTraps = trapSignals.filter((t) => t.at >= cutoff).length;
  const eventCount = recentSignals + recentTraps;
  const level: EventIntensityLevel =
    eventCount >= EVENT_INTENSITY_HIGH_MIN ? "HIGH" : eventCount >= EVENT_INTENSITY_MEDIUM_MIN ? "MEDIUM" : "LOW";
  return { level, eventCount, windowMs };
}

export interface MicrostructureSnapshot {
  contractVersion: typeof MICROSTRUCTURE_SNAPSHOT_CONTRACT_VERSION;
  computedAt: number;
  /** Pior qualidade entre tradeFlow/depth — leitura rápida; o detalhe real
   *  por fonte continua em cada slice abaixo (Ordem §12: "cada resultado",
   *  não um único veredito global escondendo o resto). */
  quality: MicrostructureDataQuality;
  tradeFlow: TradeFlowEvidence | null;
  /** Ordem A2.1 §16: nunca misturar books de venues diferentes — cada
   *  exchange isolada na própria chave, igual a `orderBooks`/`l2History`
   *  na store (mesmo contrato, nunca uma segunda forma). */
  depth: Partial<Record<Exchange, DepthEvidence | null>>;
  /** Passthrough real de trap-detection.ts — sweep nunca é bullish/bearish
   *  por si só (Ordem §6), só o evento real + a corroboração já anexada.
   *  Mutável (não `readonly`) só para casar com o Draft<T> real do Immer
   *  que a store (Zustand+Immer) exige em `set((s) => {...})` — nunca
   *  mutado de fato por nenhuma função deste arquivo. */
  sweep: TrapSignal[];
  eventIntensity: EventIntensityReading;
}

const QUALITY_RANK: Record<MicrostructureDataQuality, number> = {
  INSUFFICIENT_DATA: 0,
  STALE: 1,
  PARTIAL: 2,
  VALID: 3,
};

function worstQuality(qualities: MicrostructureDataQuality[]): MicrostructureDataQuality {
  if (qualities.length === 0) return "INSUFFICIENT_DATA";
  return qualities.reduce((worst, q) => (QUALITY_RANK[q] < QUALITY_RANK[worst] ? q : worst));
}

export interface MicrostructureSnapshotInputs {
  orderflowSignals: readonly OrderflowSignal[];
  trapSignals: readonly TrapSignal[];
  cvd: number | null;
  /** Mesma forma de `orderBooks` na store — um book real por exchange que
   *  de fato tem conector de depth (hoje: Binance). */
  orderBooks: Partial<Record<Exchange, L2Snapshot | null | undefined>>;
  now?: number;
}

/**
 * Compositor puro: zero I/O, zero cálculo novo além de Event Intensity
 * (documentado acima). Mesma entrada, mesma saída — cada campo é um
 * passthrough real de um dos 4 sistemas já reais, ou uma agregação leve
 * e explícita sobre eles.
 */
export function composeMicrostructureSnapshot(inputs: MicrostructureSnapshotInputs): MicrostructureSnapshot {
  const now = inputs.now ?? Date.now();
  const tradeFlow = composeTradeFlowEvidence(inputs.orderflowSignals, inputs.trapSignals, inputs.cvd);

  const depth: Partial<Record<Exchange, DepthEvidence | null>> = {};
  for (const [exchange, book] of Object.entries(inputs.orderBooks) as [Exchange, L2Snapshot | null | undefined][]) {
    depth[exchange] = composeDepthEvidence(book, now);
  }

  const qualities: MicrostructureDataQuality[] = [];
  if (tradeFlow) qualities.push(tradeFlow.quality);
  for (const d of Object.values(depth)) if (d) qualities.push(d.quality);

  return {
    contractVersion: MICROSTRUCTURE_SNAPSHOT_CONTRACT_VERSION,
    computedAt: now,
    quality: qualities.length === 0 ? "INSUFFICIENT_DATA" : worstQuality(qualities),
    tradeFlow,
    depth,
    // Cópia rasa (não a mesma referência de inputs.trapSignals): só pra
    // casar com o Draft<T> mutável que a store (Zustand+Immer) exige —
    // mesmo conteúdo real, nunca um segundo cálculo.
    sweep: [...inputs.trapSignals],
    eventIntensity: computeEventIntensity(inputs.orderflowSignals, inputs.trapSignals, now),
  };
}
