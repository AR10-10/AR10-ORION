// orderflow-history.ts — V-MAX Fase 1.2: histórico real do Order Flow
// (CVD ao longo do tempo + trades grandes reais) para o
// OrderFlowHeatmapPlugin desenhar a "bolha" e a linha de CVD do Blueprint
// (§3.1) — nenhum dos dois existia como SÉRIE até aqui: App.tsx só
// guardava o CVD como um escalar (o valor atual), e os ticks individuais
// do poller real do MEXC nunca saíam de dentro do worker (engine-bridge.ts
// já foi estendido para expor onTrades com os MESMOS ticks reais que o
// worker já recebe, zero sonda de rede nova).
//
// "Trade grande" (bolha) nunca é um limiar fixo — seria um número
// inventado que a Regra de Ouro 1 proíbe. É calculado como um percentil
// real da distribuição de volumes efetivamente observada nos últimos
// trades reais (amostra deslizante). Sem amostra suficiente ainda,
// honestamente nenhum trade é marcado como grande — nunca um palpite
// antes de dado real suficiente.
import { realPercentile } from "./percentile";

export interface OrderflowTrade {
  time: number; // ms real (Tick.timestamp)
  price: number;
  volume: number;
  side: "BUY" | "SELL";
}

export interface OrderflowHistoryEntry {
  time: number; // ms real
  cvd: number;
  largeTrades: OrderflowTrade[];
}

// ~8 minutos reais de histórico no cadência real do poller MEXC (4s/ciclo,
// mesma cadência já em produção — engine-bridge.ts's startMexcOrderflowFeed).
export const ORDERFLOW_HISTORY_CAPACITY = 120;

const LARGE_TRADE_PERCENTILE = 0.9; // top 10% por tamanho DENTRO da amostra real recente.
const VOLUME_SAMPLE_WINDOW = 200; // últimos N volumes reais usados para calcular o percentil.
const MIN_SAMPLE_FOR_THRESHOLD = 20; // amostra curta demais → nenhum trade marcado, nunca um chute.

export interface OrderflowThresholdState {
  recentVolumes: number[];
}

export const EMPTY_THRESHOLD_STATE: OrderflowThresholdState = { recentVolumes: [] };

/** Percentil real (não interpolado — o valor real mais próximo da amostra,
 *  nunca um número sintetizado entre dois pontos reais) da amostra de
 *  volumes observados. null com amostra curta demais. Fórmula compartilhada
 *  com volume-profile.ts via percentile.ts (achado real de auditoria, FASE
 *  Ω Priority 3 — as duas reimplementavam a mesma conta separadamente). */
export function computeLargeTradeThreshold(recentVolumes: number[]): number | null {
  if (recentVolumes.length < MIN_SAMPLE_FOR_THRESHOLD) return null;
  const sorted = [...recentVolumes].sort((a, b) => a - b);
  return realPercentile(sorted, LARGE_TRADE_PERCENTILE);
}

/** Função pura: dado o estado real anterior da amostra + um lote real novo
 *  de trades (mesmo ciclo de poll), devolve quais deste lote são "grandes"
 *  pelo limiar calculado ANTES deste lote (um trade nunca influencia o
 *  próprio julgamento de significância) e o próximo estado da amostra. */
export function ingestTradesForLargeDetection(
  state: OrderflowThresholdState,
  trades: OrderflowTrade[],
): { large: OrderflowTrade[]; nextState: OrderflowThresholdState } {
  const threshold = computeLargeTradeThreshold(state.recentVolumes);
  const large = threshold === null ? [] : trades.filter((t) => t.volume >= threshold);
  const merged = [...state.recentVolumes, ...trades.map((t) => t.volume)];
  const recentVolumes = merged.length > VOLUME_SAMPLE_WINDOW ? merged.slice(merged.length - VOLUME_SAMPLE_WINDOW) : merged;
  return { large, nextState: { recentVolumes } };
}

/** Ring real do histórico (CVD + trades grandes por ciclo de poll) — mesmo
 *  padrão de teto de l2-history.ts, nunca acumula sem limite. */
export function pushOrderflowHistory(
  ring: OrderflowHistoryEntry[],
  entry: OrderflowHistoryEntry,
  capacity: number = ORDERFLOW_HISTORY_CAPACITY,
): OrderflowHistoryEntry[] {
  const next = ring.length === 0 ? [entry] : [...ring, entry];
  return next.length > capacity ? next.slice(next.length - capacity) : next;
}

// Diretriz Complementar §18 ("tendência de força do fluxo"): não existia,
// em todo o codebase, nenhuma redução real da série de CVD já retida
// (acima) numa TENDÊNCIA — só leituras instantâneas/percentis (achado real
// de auditoria). Isto NÃO é uma segunda medida de CVD: consome a mesma
// série já real que o heatmap consome, e não fabrica nenhum ponto novo.
export type OrderflowTrend = "FORTALECENDO" | "ENFRAQUECENDO" | "ESTAVEL";

export interface OrderflowTrendReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  trend: OrderflowTrend | null;
  // CVD líquido por ciclo de poll em cada metade real da janela — a base
  // verificável exposta para a UI, nunca recalculada por ela.
  recentSlope: number | null;
  priorSlope: number | null;
  computedAt: number;
}

// Precisa de janela real dos dois lados (nunca uma tendência de 2 pontos) —
// parâmetro documentado, não uma medição.
const MIN_ENTRIES_FOR_TREND = 10;
// Zona-morta real (Regra de Ouro 1): a diferença entre as duas metades
// precisa superar uma fração real da amplitude de CVD OBSERVADA nesta
// própria janela para virar "mudança de tendência" — nunca um limiar de
// CVD absoluto inventado (o CVD não tem uma escala universal entre
// símbolos/timeframes). Mesma natureza dos limiares 70/30 do RSI.
const TREND_DEADBAND_FRACTION = 0.05;

function insufficientTrend(reason: string, computedAt: number): OrderflowTrendReading {
  return { status: "DADOS_INSUFICIENTES", reason, trend: null, recentSlope: null, priorSlope: null, computedAt };
}

/** Tendência real de força do fluxo: compara a inclinação líquida do CVD
 *  (Δcvd médio por ciclo de poll) entre a metade mais RECENTE e a metade
 *  ANTERIOR da janela retida. FORTALECENDO = a pressão compradora líquida
 *  está acelerando (ou a vendedora está perdendo força); ENFRAQUECENDO = o
 *  oposto; ESTAVEL = a diferença não supera a zona-morta real. Nunca uma
 *  "probabilidade" (Regra de Ouro 2) — é uma leitura de inclinação real de
 *  uma série já real. */
export function computeOrderflowTrend(history: OrderflowHistoryEntry[], now: number = Date.now()): OrderflowTrendReading {
  if (!Array.isArray(history) || history.length < MIN_ENTRIES_FOR_TREND) {
    return insufficientTrend("historico_real_insuficiente_para_tendencia", now);
  }
  const mid = Math.floor(history.length / 2);
  const priorSlope = (history[mid - 1].cvd - history[0].cvd) / mid;
  const recentSlope = (history[history.length - 1].cvd - history[mid].cvd) / (history.length - 1 - mid);
  const delta = recentSlope - priorSlope;

  const cvdValues = history.map((h) => h.cvd);
  const totalRange = Math.max(...cvdValues) - Math.min(...cvdValues);
  const deadband = totalRange * TREND_DEADBAND_FRACTION;

  const trend: OrderflowTrend = Math.abs(delta) <= deadband ? "ESTAVEL" : delta > 0 ? "FORTALECENDO" : "ENFRAQUECENDO";
  return { status: "OK", reason: null, trend, recentSlope, priorSlope, computedAt: now };
}
