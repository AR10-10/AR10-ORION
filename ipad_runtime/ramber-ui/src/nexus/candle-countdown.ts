// candle-countdown.ts — pedido direto do Operador: o painel do gráfico
// não mostrava quanto tempo falta pra vela ATUAL (a que ainda está se
// formando) fechar — um dos recursos padrão de qualquer terminal
// profissional (Binance, TradingView, Bybit todos mostram esse
// cronômetro). Motor puro: zero estado, zero rede, zero timer — só a
// aritmética real sobre o candle mais recente já carregado (mesmo
// chartData que o gráfico desenha) e o timeframe já selecionado.
//
// FONTE ÚNICA: TIMEFRAME_MS (nexus/aura-lifecycle.ts) — já é a duração
// real de barra por timeframe usada em 6+ lugares deste app (ETA Engine,
// Aura, Chart Integrity); nunca uma segunda tabela de durações.
//
// UNIDADE: `lastCandleTimeSec` é o `time` real de chartData, em SEGUNDOS
// Unix — mesma convenção documentada em engine-bridge.ts (getChartCandles,
// "V18 Sprint 1 Tarefa B": "o mesmo `t` que já vem da Binance").
//
// FAIL-CLOSED (Regra de Ouro 3): sem candle real ou timeframe desconhecido,
// devolve `null` — nunca uma contagem regressiva fabricada. Dado obsoleto
// (feed travado) já tem seu próprio aviso dedicado (DataFreshnessBanner);
// este módulo só reflete o que o candle real diz, nunca detecta staleness
// por conta própria — `msRemaining` clampado em 0 é a leitura honesta de
// "a vela real já devia ter fechado", não uma segunda função de alerta.
import { TIMEFRAME_MS } from "./aura-lifecycle";

export interface CandleCountdown {
  /** Sempre >= 0 — nunca negativo mesmo com feed atrasado. */
  msRemaining: number;
  /** "0:42" (timeframes <= 15m, contagem real de segundos) ou "1h 12m"/"12m" (timeframes maiores, onde segundos não ajudam a leitura). */
  label: string;
}

export function computeCandleCountdown(
  lastCandleTimeSec: number | null | undefined,
  timeframe: string | null | undefined,
  nowMs: number,
): CandleCountdown | null {
  if (typeof lastCandleTimeSec !== "number" || !Number.isFinite(lastCandleTimeSec)) return null;
  if (typeof timeframe !== "string" || timeframe.length === 0) return null;
  const barMs = TIMEFRAME_MS[timeframe];
  if (typeof barMs !== "number" || !Number.isFinite(barMs) || barMs <= 0) return null;

  const closeAtMs = lastCandleTimeSec * 1000 + barMs;
  const msRemaining = Math.max(0, closeAtMs - nowMs);
  return { msRemaining, label: formatCountdownLabel(msRemaining, barMs) };
}

function formatCountdownLabel(msRemaining: number, barMs: number): string {
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Timeframes curtos (<=15m): mm:ss real — é onde uma contagem regressiva
  // segundo a segundo importa de verdade (a vela pode fechar em instantes).
  if (barMs <= TIMEFRAME_MS["15m"]) {
    return `${totalMinutes}:${String(seconds).padStart(2, "0")}`;
  }
  // Timeframes longos: segundos deixam de importar pra leitura — horas+minutos.
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
