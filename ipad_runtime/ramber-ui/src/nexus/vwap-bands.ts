// vwap-bands.ts — VWAP Standard Deviation Bands, ferramenta institucional
// padrão pedida pelo Operador ("ferramentas mais precisas"). Pesquisa real
// antes de implementar (CLAUDE.md, "pesquise de verdade quando a tarefa
// toca um método com nome próprio"): TradingView, Sierra Chart, TrendSpider
// e MultiCharts documentam a MESMA fórmula — banda = VWAP ± k×desvio-padrão
// PONDERADO POR VOLUME (não o desvio-padrão simples dos closes, que
// ignoraria o próprio peso que dá nome à ferramenta):
//
//   VWAP = Σ(precoTípico × volume) / Σvolume          (já real, vwap.ts)
//   variância = Σ(volume × precoTípico²) / Σvolume − VWAP²
//   desvio-padrão = sqrt(variância)
//   banda_superior = VWAP + k × desvio-padrão
//   banda_inferior = VWAP − k × desvio-padrão
//
// k=1 e k=2 são os multiplicadores padrão da indústria (mesma convenção já
// documentada em trend-channel-engine.ts para bandas ±σ — cobertura
// estatística real da amostra, NUNCA uma probabilidade calibrada de acerto
// de mercado, Regra de Ouro 2).
//
// A MATEMÁTICA da VWAP em si (nexus/vwap.ts) fica INTOCADA — este módulo
// nunca a reimplementa, só CONSOME computeSessionVwapSeries já real e
// acumula a variância por cima, mesmo espírito companion module de
// vwap-state.ts (zero segunda fórmula de VWAP).
import { computeSessionVwapSeries, type VwapCandle } from "./vwap";

export interface VwapBandPoint {
  time: number;
  vwap: number;
  upper1: number;
  lower1: number;
  upper2: number;
  lower2: number;
}

export const VWAP_BAND_MULTIPLIER_1 = 1;
export const VWAP_BAND_MULTIPLIER_2 = 2;

/**
 * Bandas de desvio-padrão real (ponderado por volume) em torno da VWAP de
 * sessão — mesma janela (UTC-day) e mesmo filtro fail-closed de
 * computeSessionVwapSeries: um candle que a VWAP já descartou (OHLC/volume
 * inválido, fora do dia corrente) nunca entra na variância. Devolve [] com
 * o mesmo honesto vazio de computeSessionVwapSeries — nunca uma banda
 * fabricada sem VWAP real por trás.
 */
export function computeVwapBands(candles: VwapCandle[]): VwapBandPoint[] {
  const vwapSeries = computeSessionVwapSeries(candles);
  if (vwapSeries.length === 0) return [];

  const vwapByTime = new Map<number, number>(vwapSeries.map((p) => [p.time, p.value]));

  const points: VwapBandPoint[] = [];
  let cumulativePriceSquaredVolume = 0;
  let cumulativeVolume = 0;
  for (const c of candles) {
    const vwap = vwapByTime.get(c.time);
    if (vwap === undefined) continue; // mesmo candle que computeSessionVwapSeries já descartou

    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumulativePriceSquaredVolume += typicalPrice * typicalPrice * c.volume!;
    cumulativeVolume += c.volume!;

    const variance = cumulativePriceSquaredVolume / cumulativeVolume - vwap * vwap;
    // Fail-closed: variância real nunca é negativa (Var(X) = E[X²] − E[X]²
    // >= 0 por definição) — só erro de ponto flutuante perto de zero pode
    // produzir um valor negativo minúsculo; nunca deixa virar NaN visível.
    const stdDev = variance > 0 ? Math.sqrt(variance) : 0;

    points.push({
      time: c.time,
      vwap,
      upper1: vwap + VWAP_BAND_MULTIPLIER_1 * stdDev,
      lower1: vwap - VWAP_BAND_MULTIPLIER_1 * stdDev,
      upper2: vwap + VWAP_BAND_MULTIPLIER_2 * stdDev,
      lower2: vwap - VWAP_BAND_MULTIPLIER_2 * stdDev,
    });
  }
  return points;
}

/** O ponto mais recente (atual) das bandas — último da série, ou null antes
 *  de qualquer volume real acumulado hoje (mesmo contrato de latestVwap). */
export function latestVwapBands(points: VwapBandPoint[]): VwapBandPoint | null {
  return points.length > 0 ? points[points.length - 1] : null;
}
