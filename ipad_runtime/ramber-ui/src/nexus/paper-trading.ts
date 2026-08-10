// paper-trading.ts — v16.0 PRO MAX §9.1/§9.4 ("Paper Trading / Simulação"),
// escopo decidido pelo Operador (AskUserQuestion, resposta explícita): SÓ
// painel manual, ZERO automação. Fechamento de posição e "ativação" de
// trailing stop NUNCA acontecem sozinhos — toda função de transição aqui
// só deve ser chamada pela UI em resposta a um clique real do Operador
// (nunca a partir de um useEffect de preço). Isso distingue esta posição
// simulada de signal-track-record.ts, que JÁ resolve automaticamente
// contra o preço — mas aquilo é um scorecard retrospectivo de precisão do
// Core Engine (propósito: "o motor acertou?"), nunca uma posição com P&L
// em dinheiro. Aqui não há resolução automática nenhuma, só leitura viva
// + ação manual (propósito: "e se eu tivesse entrado?").
//
// READ_ONLY / FAIL_CLOSED (CLAUDE.md): nunca toca em exchange real, nunca
// guarda credencial, nunca envia ordem — é aritmética local sobre um
// preço já lido pelo terminal e um tamanho nocional em USDT que o
// Operador digita. Nenhum "score"/"confiança" aparece aqui: P&L é
// medição real de variação de preço, nunca uma probabilidade.
//
// Pure functions of (state, input, now) — zero I/O, zero relógio próprio.
import type { TradePlan } from "./trade-plan";

export const PAPER_TRADING_CONTRACT_VERSION = 1 as const;

export type PaperCloseReason = "MANUAL" | "TARGET" | "STOP";

export interface SimulatedPosition {
  plan: TradePlan; // snapshot congelado no instante da abertura — nunca reavaliado ao vivo
  direction: "LONG" | "SHORT";
  entryPrice: number; // midpoint da zona de entrada do plano, no instante da abertura
  sizeUsdt: number; // nocional em USDT digitado pelo Operador — sempre > 0
  openedAt: number;
  closedAt: number | null;
  closedPrice: number | null;
  closeReason: PaperCloseReason | null;
  realizedPnl: number | null; // só definido depois de fechada
}

export interface PaperTradingState {
  contractVersion: typeof PAPER_TRADING_CONTRACT_VERSION;
  position: SimulatedPosition | null; // no máximo 1 posição aberta por vez (MVP manual)
  history: SimulatedPosition[]; // fechadas, mais recente por último, ring-capped
}

export const PAPER_TRADING_HISTORY_CAP = 100;

export const EMPTY_PAPER_TRADING_STATE: PaperTradingState = {
  contractVersion: PAPER_TRADING_CONTRACT_VERSION,
  position: null,
  history: [],
};

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function pushHistory(history: SimulatedPosition[], entry: SimulatedPosition): SimulatedPosition[] {
  const next = [...history, entry];
  return next.length > PAPER_TRADING_HISTORY_CAP ? next.slice(next.length - PAPER_TRADING_HISTORY_CAP) : next;
}

/** Abre uma posição simulada a partir de um Trade Plan real e um tamanho
 *  nocional em USDT digitado pelo Operador. Fail-closed: sem plano, size
 *  inválido (<=0, não finito) ou já existe posição aberta => devolve o
 *  estado ORIGINAL sem mudança — esta função nunca substitui
 *  silenciosamente uma posição em aberto; a UI decide se avisa o
 *  Operador que precisa fechar a atual primeiro. */
export function openPaperPosition(
  state: PaperTradingState,
  plan: TradePlan | null,
  sizeUsdt: number,
  now: number,
): PaperTradingState {
  if (state.position !== null) return state;
  if (!plan || !fin(sizeUsdt) || sizeUsdt <= 0) return state;
  const entryPrice = (plan.entry.low + plan.entry.high) / 2;
  if (!fin(entryPrice)) return state;
  return {
    ...state,
    position: {
      plan,
      direction: plan.direction,
      entryPrice,
      sizeUsdt,
      openedAt: now,
      closedAt: null,
      closedPrice: null,
      closeReason: null,
      realizedPnl: null,
    },
  };
}

function signedPctMove(position: SimulatedPosition, currentPrice: number): number {
  const pct = (currentPrice - position.entryPrice) / position.entryPrice;
  return position.direction === "LONG" ? pct : -pct;
}

/** Variação percentual assinada do preço desde a entrada — positiva a
 *  favor da posição, negativa contra, independente do tamanho. null sem
 *  posição aberta ou preço não finito (nunca um zero fabricado). */
export function unrealizedPnlPct(position: SimulatedPosition | null, currentPrice: number): number | null {
  if (!position || !fin(currentPrice)) return null;
  return signedPctMove(position, currentPrice) * 100;
}

/** P&L não-realizado em USDT no preço ATUAL (signedPctMove × sizeUsdt).
 *  null sem posição aberta ou preço não finito. */
export function unrealizedPnl(position: SimulatedPosition | null, currentPrice: number): number | null {
  if (!position || !fin(currentPrice)) return null;
  return signedPctMove(position, currentPrice) * position.sizeUsdt;
}

/** Fecha a posição aberta no preço ATUAL — SEMPRE por ação explícita do
 *  Operador. `reason` documenta só o PORQUÊ do clique (qual botão foi
 *  pressionado), nunca implica automação: mesmo um "TARGET"/"STOP" aqui é
 *  o Operador reconhecendo que o nível foi tocado e escolhendo fechar —
 *  esta função nunca é chamada por conta própria a partir de um tick de
 *  preço. Sem posição aberta, ou preço não finito => estado ORIGINAL. */
export function closePaperPosition(
  state: PaperTradingState,
  currentPrice: number,
  now: number,
  reason: PaperCloseReason,
): PaperTradingState {
  if (!state.position || !fin(currentPrice)) return state;
  const closed: SimulatedPosition = {
    ...state.position,
    closedAt: now,
    closedPrice: currentPrice,
    closeReason: reason,
    realizedPnl: unrealizedPnl(state.position, currentPrice),
  };
  return { ...state, position: null, history: pushHistory(state.history, closed) };
}

export interface PaperPositionContext {
  distanceToStopPct: number | null;
  distanceToTarget1Pct: number | null;
  nearStop: boolean;
  nearTarget: boolean;
}

// Limiar puramente informativo (destaca visualmente "perto do alvo/stop"
// na UI) — nunca aciona fechamento nenhum sozinho.
export const PAPER_NEAR_THRESHOLD_PCT = 0.3;

/** Leitura de contexto só-informativa: distância real do preço atual até
 *  o stop do plano e até o 1º alvo (o mais próximo). Esta posição não tem
 *  ladder de alvos parciais — MVP manual, o Operador decide fechar tudo
 *  de uma vez, quando quiser. Nunca fecha nada por conta própria. */
export function paperPositionContext(position: SimulatedPosition | null, currentPrice: number): PaperPositionContext {
  if (!position || !fin(currentPrice)) {
    return { distanceToStopPct: null, distanceToTarget1Pct: null, nearStop: false, nearTarget: false };
  }
  const stopPrice = position.plan.stop.price;
  const target1 = position.plan.targets[0]?.price;
  const distanceToStopPct = fin(stopPrice) ? (Math.abs(currentPrice - stopPrice) / currentPrice) * 100 : null;
  const distanceToTarget1Pct = fin(target1) ? (Math.abs(currentPrice - (target1 as number)) / currentPrice) * 100 : null;
  return {
    distanceToStopPct,
    distanceToTarget1Pct,
    nearStop: distanceToStopPct !== null && distanceToStopPct <= PAPER_NEAR_THRESHOLD_PCT,
    nearTarget: distanceToTarget1Pct !== null && distanceToTarget1Pct <= PAPER_NEAR_THRESHOLD_PCT,
  };
}

/** Fail-closed rehydration: só aceita um estado estruturalmente válido da
 *  MESMA versão de contrato; qualquer outra coisa devolve o estado vazio
 *  honesto. Ao contrário de rehydrateTrackRecord (signal-track-record.ts),
 *  uma posição ABERTA sobrevive ao reload sem ser forçada a "fechada": não
 *  existe resolução automática aqui, então não há "caminho de preço não
 *  visto" a desconfiar — o painel volta a mostrar P&L ao vivo assim que o
 *  preço real voltar a fluir, e o Operador decide o que fazer. */
export function rehydratePaperTrading(raw: unknown): PaperTradingState {
  const r = raw as PaperTradingState | null | undefined;
  if (
    !r || typeof r !== "object" ||
    r.contractVersion !== PAPER_TRADING_CONTRACT_VERSION ||
    !Array.isArray(r.history) ||
    (r.position !== null && typeof r.position !== "object")
  ) {
    return EMPTY_PAPER_TRADING_STATE;
  }
  return r;
}
