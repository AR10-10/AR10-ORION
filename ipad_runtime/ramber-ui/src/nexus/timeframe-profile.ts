// timeframe-profile.ts — Diretriz Complementar (Evolução da Inteligência
// Operacional §7, "Inteligência Temporal"): vocabulário real de contexto
// para cada um dos 14 timeframes reais já aceitos (nexus/types.ts's
// Timeframe, mesma lista de App.tsx's CHART_TIMEFRAMES).
//
// HONESTIDADE: isto é rótulo/contexto de apresentação, nunca uma medição
// (mesma natureza dos limiares 70/30 do RSI ou de TIMEFRAME_MS's "1M =
// 30 dias" em aura-lifecycle.ts) — nenhum destes rótulos afirma "operações
// neste prazo REALMENTE duram X" (este repositório não tem backtest real
// que sustente essa afirmação, Regra de Ouro 2). "etaHorizon" é só a
// ORDEM DE GRANDEZA esperada para dar contexto ao operador sobre o próprio
// ETA dinâmico real (eta-engine.ts) — nunca substitui o ETA real, nunca é
// usado como insumo dele.
//
// O Trade Plan já recalcula integralmente ao trocar de timeframe (achado
// real de auditoria: S/R, estrutura, e o próprio TradePlan já são
// timeframe-aware desde tarefas anteriores — nenhum código novo
// necessário para essa parte do pedido, só esta camada de vocabulário).
import type { Timeframe } from "./types";

export interface TimeframeProfile {
  style: string; // rótulo real do estilo de operação para este prazo
  etaHorizon: string; // ordem de grandeza esperada do ETA — contexto, nunca medição
}

export const TIMEFRAME_PROFILES: Record<Timeframe, TimeframeProfile> = {
  "1m": { style: "Trade Extremamente Curto", etaHorizon: "minutos" },
  "3m": { style: "Scalp", etaHorizon: "minutos" },
  "5m": { style: "Scalp", etaHorizon: "minutos a horas" },
  "15m": { style: "Intraday", etaHorizon: "minutos a horas" },
  "30m": { style: "Intraday", etaHorizon: "horas" },
  "1h": { style: "Swing Trade", etaHorizon: "horas" },
  "2h": { style: "Swing Trade", etaHorizon: "horas a dias" },
  "4h": { style: "Swing Prolongado", etaHorizon: "dias" },
  "6h": { style: "Swing Prolongado", etaHorizon: "dias" },
  "8h": { style: "Swing Prolongado", etaHorizon: "dias" },
  "12h": { style: "Posicional", etaHorizon: "dias a semanas" },
  "1d": { style: "Posicional", etaHorizon: "dias a semanas" },
  "1w": { style: "Macroestrutura", etaHorizon: "semanas a meses" },
  "1M": { style: "Visão Institucional de Longo Prazo", etaHorizon: "meses" },
};

/** Perfil real do timeframe informado. null honesto para qualquer string
 *  fora dos 14 timeframes reais aceitos — nunca um perfil fabricado para
 *  um prazo que este sistema não opera. */
export function timeframeProfile(tf: string): TimeframeProfile | null {
  return (TIMEFRAME_PROFILES as Record<string, TimeframeProfile>)[tf] ?? null;
}
