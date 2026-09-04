// macd.ts — MACD (Moving Average Convergence/Divergence, Gerald Appel
// 1979). Reusa a MESMA recorrência de EMA já real (ema.ts::computeEmaSeries)
// duas vezes — sobre o preço para as linhas rápida/lenta, depois sobre a
// própria linha MACD para a linha de sinal — zero segunda fórmula de EMA.
//
// EPC OMEGA FINAL Parte 1 §11 / Parte 3 §7: um dos indicadores nomeados
// pela diretiva e confirmado AUSENTE pela auditoria real (ver
// docs/historico/RELATORIO_EPC_OMEGA_FINAL.md) — dado 100% real (os MESMOS candles
// já usados por EMA), zero API nova, seguro implementar sem violar a
// Regra de Ouro 1 (ao contrário de itens como On-Chain/Whale Activity,
// confirmados impossíveis sem API paga).
//
// Períodos 12/26/9 são o padrão universal da indústria — mesma convenção
// "não é escolha arbitrária deste repositório" já documentada para
// EMA_PERIODS (ema.ts).
//
// LEI 24: display-only puro, contexto/confluência — NÃO entra na votação
// do Conselho nesta rodada. Calibrar stance/confiança a partir de
// cruzamento/histograma do MACD merece pesquisa e desenho próprios antes
// de virar um 8º voto real (a Regra de Ouro 2 exige que "confiança" nunca
// seja inventada) — ver roadmap do relatório.
import { computeEmaSeries, type EmaCandle, type EmaPoint } from "./ema";

export const MACD_FAST_PERIOD = 12;
export const MACD_SLOW_PERIOD = 26;
export const MACD_SIGNAL_PERIOD = 9;

export interface MacdPoint {
  time: number;
  macd: number; // EMA rápida - EMA lenta
  signal: number; // EMA do próprio MACD
  histogram: number; // macd - signal
}

/** Uma leitura de MACD por candle válido. Período inválido (fast ou slow)
 *  => série vazia honesta, nunca um ponto fabricado — mesmo fail-closed
 *  de computeEmaSeries, propagado aqui. */
export function computeMacdSeries(
  candles: EmaCandle[],
  fastPeriod: number = MACD_FAST_PERIOD,
  slowPeriod: number = MACD_SLOW_PERIOD,
  signalPeriod: number = MACD_SIGNAL_PERIOD,
): MacdPoint[] {
  const fast = computeEmaSeries(candles, fastPeriod);
  const slow = computeEmaSeries(candles, slowPeriod);
  if (fast.length === 0 || slow.length === 0) return [];

  // fast/slow vêm do MESMO array `candles` processado pela MESMA regra de
  // pular inválidos (ema.ts) — sempre o mesmo comprimento/alinhamento por
  // construção, nunca precisam de merge por tempo.
  const macdLine: EmaPoint[] = fast.map((f, i) => ({ time: f.time, value: f.value - slow[i].value }));
  const signalLine = computeEmaSeries(
    macdLine.map((p) => ({ time: p.time, close: p.value })),
    signalPeriod,
  );
  if (signalLine.length === 0) return [];

  return macdLine.map((m, i) => ({
    time: m.time,
    macd: m.value,
    signal: signalLine[i].value,
    histogram: m.value - signalLine[i].value,
  }));
}

/** A leitura mais recente, ou null se ainda não há histórico/período
 *  válido — nunca um ponto fabricado. */
export function latestMacd(series: MacdPoint[]): MacdPoint | null {
  return series.length > 0 ? series[series.length - 1] : null;
}
