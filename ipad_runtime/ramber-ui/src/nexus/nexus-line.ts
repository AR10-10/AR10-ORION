// nexus-line.ts — Diretriz Mestra de Consolidação Final §26-§30: a Nexus
// Line (NL), linha matemática proprietária do AR10.
//
// O QUE ELA É (§27): o equilíbrio matemático produzido pelo próprio
// sistema — a fusão, com pesos DOCUMENTADOS/AUDITÁVEIS/REPRODUZÍVEIS
// (§28, exportados abaixo em NEXUS_LINE_WEIGHTS), dos dois níveis de
// equilíbrio reais que o sistema já calcula por barra:
//   · equilíbrio de VOLUME — a própria VWAP de sessão (nexus/vwap.ts;
//     matemática intocada, §20);
//   · equilíbrio ESTRUTURAL — o ponto médio do dealing range vigente
//     (último swing high/low CONFIRMADOS pelos mesmos fractais
//     compartilhados de fractal-swings.js — a mesma definição de range do
//     Premium/Discount, nunca uma segunda detecção de swing).
// A fusão é suavizada por EMA curta (NEXUS_LINE_SMOOTHING_PERIOD) — §29
// "suavizada, sem atraso excessivo".
//
// O QUE ELA NÃO É (§27): VWAP, EMA de preço, média móvel, previsão.
//
// POR QUE só dois âncoras, sendo que o §28 lista mais fontes: as demais
// leituras (Conviction, Heat, Institutional Score, Decision Layer, CVD,
// funding, OI, harmônicos...) NÃO têm valor histórico por barra sem
// fabricação — recalculá-las "como se" para cada barra passada repintaria
// a linha (Regra de Ouro 1, zero dado fabricado). Elas entram no ESTADO
// (cor da barra atual, via a MESMA histerese compartilhada de
// vwap-state.ts) e na CONFLUÊNCIA (§30) — nunca na geometria do caminho.
// O caminho usa exclusivamente o que é computável por barra com dado até
// aquela barra: SEM lookahead (um pivô só entra no equilíbrio a partir da
// barra em que o fractal confirma, index + FRACTAL_K) — a linha NUNCA
// repinta.
//
// §30 (confluência VWAP × NL × Decision Layer): veredito INFORMATIVO —
// "informar conflito estrutural", nunca alterar a operação (LEI 24).
import { computeSessionVwapSeries, type VwapCandle } from "./vwap";
import { directionalStateWithHysteresis, type DirectionalLineState } from "./vwap-state";
import { findSwings, FRACTAL_K } from "../../../src/research/engines/fractal-swings.js";

export const NEXUS_LINE_CONTRACT_VERSION = 1 as const;

// Pesos documentados e reproduzíveis (§28): metade equilíbrio de volume,
// metade equilíbrio estrutural — dois níveis de natureza distinta com a
// mesma legitimidade institucional; nenhum dado para privilegiar um sem
// backtest real (afirmar pesos "ótimos" seria fabricação).
export const NEXUS_LINE_WEIGHTS = {
  volumeEquilibrium: 0.5,
  structuralEquilibrium: 0.5,
} as const;

// EMA curta de 5 barras: alisa o degrau discreto dos pivôs sem introduzir
// atraso perceptível (§29).
export const NEXUS_LINE_SMOOTHING_PERIOD = 5;

export interface NexusLinePoint {
  time: number; // Unix segundos, mesmo eixo dos candles
  value: number;
}

type NlCandle = VwapCandle & { high: number; low: number };

/** Série da Nexus Line — um ponto por barra do dia UTC corrente (mesmo
 *  span da VWAP de sessão: os dois âncoras precisam existir; §29 "nunca
 *  competir visualmente com a VWAP" também vale para o span). Barras antes
 *  do primeiro dealing range confirmado não geram ponto (fail-closed,
 *  nunca um valor fabricado). */
export function computeNexusLineSeries(candles: NlCandle[]): NexusLinePoint[] {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const vwap = computeSessionVwapSeries(candles);
  if (vwap.length === 0) return [];

  const highs = findSwings(candles, FRACTAL_K, true) as Array<{ index: number; price: number }>;
  const lows = findSwings(candles, FRACTAL_K, false) as Array<{ index: number; price: number }>;
  const indexByTime = new Map<number, number>();
  candles.forEach((c, i) => indexByTime.set(c.time, i));

  const alpha = 2 / (NEXUS_LINE_SMOOTHING_PERIOD + 1);
  const points: NexusLinePoint[] = [];
  let hi = 0;
  let lo = 0;
  let lastHigh: number | null = null;
  let lastLow: number | null = null;
  let ema: number | null = null;

  for (const p of vwap) {
    const barIndex = indexByTime.get(p.time);
    if (barIndex === undefined) continue;
    // Confirmação fractal real: o pivô em `index` só é conhecido k barras
    // depois — avançar os ponteiros por (index + FRACTAL_K <= barra atual)
    // garante zero lookahead/repaint.
    while (hi < highs.length && highs[hi].index + FRACTAL_K <= barIndex) {
      lastHigh = highs[hi].price;
      hi++;
    }
    while (lo < lows.length && lows[lo].index + FRACTAL_K <= barIndex) {
      lastLow = lows[lo].price;
      lo++;
    }
    if (lastHigh === null || lastLow === null) continue;
    const structuralEq = (lastHigh + lastLow) / 2;
    const raw =
      NEXUS_LINE_WEIGHTS.volumeEquilibrium * p.value +
      NEXUS_LINE_WEIGHTS.structuralEquilibrium * structuralEq;
    ema = ema === null ? raw : ema + alpha * (raw - ema);
    points.push({ time: p.time, value: ema });
  }
  return points;
}

/** Valor corrente da NL — último ponto real, ou null (fail-closed). */
export function latestNexusLine(series: NexusLinePoint[]): number | null {
  return series.length > 0 ? series[series.length - 1].value : null;
}

/** Estado da NL para a barra atual — a MESMA histerese compartilhada da
 *  VWAP (§29 estados Verde/Vermelho/Branco-Dourado, §22 nunca flapping). */
export function nexusLineState(
  prev: DirectionalLineState,
  price: number | null,
  nl: number | null,
  atrAbs: number | null,
): DirectionalLineState {
  if (price === null || nl === null) return "NEUTRAL";
  return directionalStateWithHysteresis(prev, price, nl, atrAbs);
}

export type NexusConfluenceVerdict = "ALINHADA" | "CONFLITO_ESTRUTURAL";

/** §30: quando VWAP, Nexus Line e Decision Layer apontam juntos =>
 *  ALINHADA; quando qualquer um diverge dos demais com decisão direcional
 *  ativa => CONFLITO_ESTRUTURAL (informado, nunca acionado). Sem decisão
 *  direcional (AGUARDAR) ou sem leitura direcional dupla das linhas =>
 *  null honesto — nunca um veredito fabricado. */
export function nexusConfluenceVerdict(
  vwapState: DirectionalLineState,
  nlState: DirectionalLineState,
  operation: "LONG" | "SHORT" | "AGUARDAR" | null,
): NexusConfluenceVerdict | null {
  if (operation !== "LONG" && operation !== "SHORT") return null;
  if (vwapState === "NEUTRAL" || nlState === "NEUTRAL") return null;
  const aligned = operation === "LONG" ? "BULLISH" : "BEARISH";
  return vwapState === aligned && nlState === aligned ? "ALINHADA" : "CONFLITO_ESTRUTURAL";
}
