// heat-score.ts — Diretriz Mestra §1/§12 ("Heat Score" no header).
//
// O QUE É (definição honesta, já que a diretriz nomeia mas não define):
// intensidade de ATIVIDADE real do mercado agora — o quão "quente" está o
// pregão — composta de 3 magnitudes que o sistema JÁ mede de verdade:
//   1. bandwidthPercentile (Market Regime Engine, Fase D): percentil real
//      da largura de banda de volatilidade contra a própria história do
//      ativo — já é 0..100 por construção, o clássico "aquecimento" de
//      volatilidade.
//   2. |Δ24h%| (ticker real da Binance): magnitude do movimento diário,
//      capada em 10% (teto documentado — um dia de ±10% em BTC/ETH é
//      atividade extrema; o cap é um parâmetro declarado, mesma natureza
//      dos limiares 70/30 do RSI, não uma medição).
//   3. Liquidações recentes (feed real de forceOrder): contagem na janela
//      viva, capada em 10 eventos (mesmo tipo de teto documentado).
//
// O QUE NÃO É (Regra de Ouro 2, inegociável): NUNCA probabilidade, NUNCA
// direção. Heat alto significa "mercado ativo/volátil agora" — não "vai
// subir" nem "sinal forte". O tooltip da UI repete isso.
//
// Composição: média SIMPLES das componentes disponíveis (zero pesos
// inventados — mesma resolução do Radar de Consenso: reempacotar
// magnitudes reais sem uma segunda matemática de opinião). Fail-closed:
// menos de 2 componentes reais => DADOS_INSUFICIENTES (uma "média" de um
// único número seria só esse número fantasiado de composição).
//
// LEI 24: display/contexto puro — jamais alimenta o Core Engine.
export const HEAT_SCORE_CONTRACT_VERSION = 1 as const;

// Tetos documentados das componentes abertas (ver cabeçalho).
export const HEAT_DELTA_PCT_CAP = 10;
export const HEAT_LIQUIDATION_CAP = 10;

export type HeatTier = "FRIO" | "MORNO" | "QUENTE" | "EXTREMO";

export interface HeatComponent {
  id: "VOLATILITY_PERCENTILE" | "DELTA_24H" | "LIQUIDATIONS";
  value01: number; // contribuição normalizada 0..1
  source: string; // origem real verificável
}

export interface HeatScoreReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  score: number | null; // 0..100
  tier: HeatTier | null;
  components: HeatComponent[];
  computedAt: number;
}

export interface HeatScoreInputs {
  bandwidthPercentile: number | null; // Market Regime Engine (0..100 real)
  deltaPct: number | null; // Δ24h% real do ticker
  recentLiquidationCount: number | null; // janela viva do feed forceOrder
}

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Faixas do tier — cortes uniformes de 25 (parâmetro documentado, não uma
// medição; a cor/rótulo é leitura rápida, o número exato está sempre junto).
export function heatTier(score: number): HeatTier {
  return score < 25 ? "FRIO" : score < 50 ? "MORNO" : score < 75 ? "QUENTE" : "EXTREMO";
}

export function computeHeatScore(inputs: HeatScoreInputs, computedAt: number = Date.now()): HeatScoreReading {
  const components: HeatComponent[] = [];
  if (fin(inputs.bandwidthPercentile)) {
    components.push({
      id: "VOLATILITY_PERCENTILE",
      value01: Math.max(0, Math.min(100, inputs.bandwidthPercentile)) / 100,
      source: "percentil real de largura de banda (Market Regime Engine)",
    });
  }
  if (fin(inputs.deltaPct)) {
    components.push({
      id: "DELTA_24H",
      value01: Math.min(Math.abs(inputs.deltaPct), HEAT_DELTA_PCT_CAP) / HEAT_DELTA_PCT_CAP,
      source: `|Δ24h| real do ticker, teto documentado ${HEAT_DELTA_PCT_CAP}%`,
    });
  }
  if (fin(inputs.recentLiquidationCount) && inputs.recentLiquidationCount >= 0) {
    components.push({
      id: "LIQUIDATIONS",
      value01: Math.min(inputs.recentLiquidationCount, HEAT_LIQUIDATION_CAP) / HEAT_LIQUIDATION_CAP,
      source: `liquidações reais na janela viva, teto documentado ${HEAT_LIQUIDATION_CAP}`,
    });
  }

  if (components.length < 2) {
    return {
      status: "DADOS_INSUFICIENTES",
      reason: "menos_de_2_componentes_reais_medidas",
      score: null,
      tier: null,
      components,
      computedAt,
    };
  }

  const mean01 = components.reduce((acc, c) => acc + c.value01, 0) / components.length;
  const score = Math.round(mean01 * 100);
  return { status: "OK", reason: null, score, tier: heatTier(score), components, computedAt };
}
