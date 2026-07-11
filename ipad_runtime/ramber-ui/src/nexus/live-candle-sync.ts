// live-candle-sync.ts — Correção de latência (Ordem "Sincronização em Tempo
// Real"): elimina o atraso perceptível entre o preço da barra superior
// (WebSocket, quase instantâneo) e a vela do gráfico (hoje só resincroniza
// via REST a cada 30s — App.tsx's `setInterval(fetchSymbolData, 30000)`).
//
// Escopo deliberadamente estreito: só funde o ÚLTIMO PREÇO real do ticker
// na vela JÁ CONHECIDA em formação (close = preço real; high/low estendidos
// só se o preço real ultrapassar os já registrados) — nunca fabrica o OPEN
// de uma vela nova. Abrir uma vela exige o preço real do PRIMEIRO trade do
// período, que só o REST/kline real entrega; até lá, a vela antiga
// permanece intocada e o próximo poll REST assume a criação da vela nova
// (fail-closed: melhor manter a vela anterior um instante a mais do que
// inventar um open).
//
// Consumido exclusivamente pela CAMADA DE RENDERIZAÇÃO (EnhancedChart via
// series.update()) — nunca escreve em `chartData`/no UnifiedGlobalSnapshot.
// Isto é deliberado: SMC/Fibonacci/Volume Profile são derivações
// estruturais que não precisam (nem devem) recomputar a cada tick de
// preço — só a cada vela REAL nova/fechada. Se este módulo alimentasse
// `chartData` diretamente, cada tick de WS recomputaria todos os motores a
// cada render, uma regressão real de performance (Main Thread sagrada).
import type { Candle, Timeframe } from "./types";

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
  "1h": 3600, "2h": 7200, "4h": 14400, "6h": 21600, "8h": 28800, "12h": 43200,
  // 1d/1w/1M: aproximação real de duração fixa (nunca mês calendário exato)
  // — usada só para decidir SE a última vela conhecida ainda é a corrente,
  // nunca para rotular a vela em si.
  "1d": 86400, "1w": 604800, "1M": 2_592_000,
};

/** Início real (Unix segundos, alinhado UTC) da barra que contém `nowSec`
 *  no timeframe `tf` — mesma convenção de bucket que a API de klines real
 *  usa (e que `fetchSymbolData`/REST já produz para as velas fechadas). */
export function currentBarStart(nowSec: number, tf: Timeframe): number {
  const size = TIMEFRAME_SECONDS[tf];
  return Math.floor(nowSec / size) * size;
}

/** Funde um preço real de ticker (último trade) na vela em formação.
 *  Devolve a vela corrigida, ou `null` (fail-closed: nada a fazer) quando:
 *    - a última vela conhecida NÃO é a vela corrente (REST ainda não criou
 *      a nova — nunca fabricamos o open dela a partir de um preço solto);
 *    - o preço não é finito;
 *    - nada mudaria de verdade (mesmo close, dentro do high/low já
 *      registrado) — nunca gera um update sem diferença real. */
export function patchLastCandleWithLiveTick(
  lastCandle: Candle,
  tf: Timeframe,
  price: number,
  nowMs: number = Date.now(),
): Candle | null {
  if (!Number.isFinite(price)) return null;
  if (currentBarStart(Math.floor(nowMs / 1000), tf) !== lastCandle.time) return null;
  if (price === lastCandle.close && price <= lastCandle.high && price >= lastCandle.low) return null;
  return {
    ...lastCandle,
    close: price,
    high: Math.max(lastCandle.high, price),
    low: Math.min(lastCandle.low, price),
  };
}
