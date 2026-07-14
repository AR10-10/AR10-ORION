// ema.ts — Exponential Moving Average como overlay nativo do gráfico
// (Diretriz Camada de Decisão Profissional, item 1: "linha de EMA real
// marcada automaticamente no gráfico", um dos gaps nomeados
// explicitamente pela própria diretriz).
//
// Auditoria antes de construir (CLAUDE.md, "audite antes de construir"):
// o WASM (cyborg_quant_core::ema, wasm-src/cyborg_quant_core/src/lib.rs)
// JÁ calcula EMA — mas devolve só o valor ESCALAR final da recorrência
// sobre um buffer inteiro (o formato certo para uma LEITURA pontual, já
// reaproveitado hoje em analysis-frame.js/research-engine.js para o viés
// de tendência SMA/EMA). Um overlay de linha no gráfico precisa de UM
// PONTO POR CANDLE — recomputar o WASM uma vez por candle reescreveria o
// buffer compartilhado (CAPACITY=8192) N vezes para produzir uma série de
// N pontos (O(n²)), estritamente pior que o laço O(n) abaixo. Por isso
// esta é uma implementação nova legítima, não uma duplicação — mas usa
// DELIBERADAMENTE a MESMA fórmula/semente do motor WASM (k = 2/(period+1),
// semente = primeiro valor válido, nunca uma SMA de abertura), para que
// "EMA" signifique exatamente a mesma coisa em qualquer lugar do sistema.
// O próprio teste de paridade do WASM (wasm-quant-core.test.ts, describe
// "EMA — semente no primeiro valor, k = 2/(p+1)") já documenta esta
// convenção como a definição canônica do repositório.
//
// Fail-closed: candle com time/close não-finito é PULADO (nunca gera um
// ponto fabricado) — a recorrência continua a partir do próximo candle
// válido, exatamente como computeSessionVwapSeries (vwap.ts) trata
// candles inválidos.
export interface EmaCandle {
  time: number; // Unix segundos real
  close: number;
}

export interface EmaPoint {
  time: number;
  value: number;
}

// Períodos padrão da indústria expostos ao Operador (Camadas do Gráfico):
// 9/21 = tendência rápida, 50/200 = tendência de fundo. Nenhum "melhor"
// objetivo — são os quatro períodos universalmente reconhecidos, não uma
// escolha arbitrária deste repositório.
export const EMA_PERIODS = [9, 21, 50, 200] as const;
export type EmaPeriod = (typeof EMA_PERIODS)[number];
export const DEFAULT_EMA_PERIOD: EmaPeriod = 21;

/**
 * Uma EMA por candle válido, mesma semente/fator k do motor WASM.
 * Período inválido (<=0, não-finito) ou histórico vazio => série vazia
 * honesta — nunca uma linha fabricada.
 */
export function computeEmaSeries(candles: EmaCandle[], period: number): EmaPoint[] {
  if (!Number.isFinite(period) || period <= 0) return [];
  const k = 2 / (period + 1);
  const points: EmaPoint[] = [];
  let e: number | null = null;
  for (const c of candles) {
    if (!Number.isFinite(c.time) || !Number.isFinite(c.close)) continue;
    e = e === null ? c.close : c.close * k + e * (1 - k);
    points.push({ time: c.time, value: e });
  }
  return points;
}

/** O valor mais recente da série, ou null se ainda não há nenhum ponto real. */
export function latestEma(series: EmaPoint[]): number | null {
  return series.length > 0 ? series[series.length - 1].value : null;
}
