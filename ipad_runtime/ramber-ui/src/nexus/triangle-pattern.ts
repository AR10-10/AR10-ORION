// triangle-pattern.ts — Carta Branca (Reconhecimento de Padrões): motor
// puro de detecção de Triângulos (Ascendente/Descendente/Simétrico) sobre
// os MESMOS swings fractais compartilhados (fractal-swings.js — zero
// segunda detecção de swing, mesmo utilitário de harmonic-patterns.ts).
//
// Definição real confirmada por pesquisa (FXOpen, ChartMill, Strike.money,
// Titan FX, Scanz — consistente entre as fontes; ver PR para os links):
//   ASCENDENTE: resistência HORIZONTAL (topos praticamente iguais) +
//     suporte SUBINDO (fundos cada vez mais altos) — continuação de alta.
//   DESCENDENTE: suporte HORIZONTAL (fundos praticamente iguais) +
//     resistência DESCENDO (topos cada vez mais baixos) — continuação de
//     baixa.
//   SIMÉTRICO: as duas linhas convergem (resistência descendo, suporte
//     subindo) — indecisão real; a própria literatura confirma que o lado
//     do rompimento "pode ser em qualquer direção, geralmente informado
//     pela tendência mais ampla" — por isso este motor NUNCA atribui
//     direção a um Simétrico (Regra de Ouro 3: fail-closed, nunca uma
//     direção fabricada sem base geométrica real).
//   Regra real de toque mínimo (mesma em todas as fontes pesquisadas): o
//     preço precisa tocar cada linha pelo menos 2 vezes.
//
// HONESTIDADE (Regra de Ouro 2): fitScore é ADERÊNCIA GEOMÉTRICA (R² real
// do ajuste por mínimos quadrados de cada trendline aos swings que a
// formam) — nunca probabilidade de rompimento. Com exatamente 2 toques
// por linha (o mínimo real da definição), o R² satura em 1.0 por
// definição matemática — uma reta sempre passa exatamente por 2 pontos,
// isso não é over-fitting fabricado. A aderência genuína só se torna
// informativa a partir de 3+ toques reais por linha.
//
// Este motor NUNCA projeta um alvo de preço: a técnica clássica de "medir
// a altura da base" fica deliberadamente fora — projetaria um número com
// aparência de previsão sem histórico real de backtest neste repositório
// que sustente a técnica (mesma nota de honestidade de scenario-engine.ts).
//
// Fail-closed: menos de 2 topos ou 2 fundos reais na janela, linhas
// paralelas/alargando (não convergem — não é um triângulo), linhas já
// cruzadas, padrão sem toque recente, ou fit abaixo do piso ⇒ null honesto.
import { findSwings, FRACTAL_K } from "../../../src/research/engines/fractal-swings.js";

export const TRIANGLE_CONTRACT_VERSION = 1 as const;

export const MIN_TRIANGLE_FIT_SCORE = 0.75;

// Janela real de candles onde o triângulo pode estar se formando —
// convenção declarada (mesma natureza de MAX_PIVOTS_SCANNED em
// harmonic-patterns.ts), não uma medição.
const TRIANGLE_LOOKBACK_CANDLES = 90;
// Regra real de toque mínimo confirmada por pesquisa: 2 por linha.
const MIN_TOUCHES_PER_LINE = 2;
const MAX_TOUCHES_PER_LINE = 6;
// Frescor: o toque mais recente (de qualquer lado) precisa estar dentro
// desta distância do candle mais novo — mesma disciplina de "D é o
// último ou penúltimo pivô" de harmonic-patterns.ts, com janela um pouco
// maior porque triângulos amadurecem mais devagar que um XABCD de 5 pivôs.
const RECENT_TOUCH_TOLERANCE_CANDLES = 6;
// Convenção declarada: |slope| abaixo disto (normalizado pelo preço
// médio da amostra, %/candle) conta como "linha horizontal" — mesma
// natureza da banda morta de trend_direction (0.1%) em analysis-frame.js.
const FLAT_SLOPE_PCT_PER_CANDLE = 0.02;

export type TriangleKind = "ASCENDING" | "DESCENDING" | "SYMMETRICAL";

export interface TrianglePoint {
  index: number;
  price: number;
}

export interface TrianglePatternHit {
  contractVersion: typeof TRIANGLE_CONTRACT_VERSION;
  kind: TriangleKind;
  // Ascendente => BULLISH (continuação real documentada); Descendente =>
  // BEARISH; Simétrico => null honesto (geometria não determina o lado —
  // ver cabeçalho do arquivo).
  direction: "BULLISH" | "BEARISH" | null;
  resistancePoints: TrianglePoint[]; // topos reais que formam a linha superior
  supportPoints: TrianglePoint[]; // fundos reais que formam a linha inferior
  resistanceSlope: number;
  resistanceIntercept: number;
  supportSlope: number;
  supportIntercept: number;
  // Nível real de cada linha no ÚLTIMO candle carregado — a zona de
  // reteste que o Operador observa agora.
  resistanceAtLastCandle: number;
  supportAtLastCandle: number;
  // Ápice real (interseção das 2 retas) — só exposto quando está À
  // FRENTE do último candle (mesma honestidade de etaIndex em
  // harmonic-patterns.ts — um ápice no passado não é uma projeção honesta).
  apexIndex: number | null;
  fitScore: number; // aderência geométrica (R² combinado) — NUNCA probabilidade
  completedAtIndex: number; // índice do toque mais recente (resistência ou suporte)
}

interface LineFit {
  slope: number;
  intercept: number;
  r2: number;
}

// Regressão linear real (mínimos quadrados) + R² real do ajuste — mesma
// disciplina de "geometria real dos pivôs" já usada pela Wolfe (linha
// avaliada em qualquer tempo via slope*Δindex + intercept).
function fitLine(points: TrianglePoint[]): LineFit | null {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.index, 0) / n;
  const meanY = points.reduce((s, p) => s + p.price, 0) / n;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of points) {
    sumXY += (p.index - meanX) * (p.price - meanY);
    sumXX += (p.index - meanX) * (p.index - meanX);
  }
  if (sumXX === 0) return null; // todos os pontos no mesmo índice — geometria degenerada
  const slope = sumXY / sumXX;
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = slope * p.index + intercept;
    ssRes += (p.price - predicted) ** 2;
    ssTot += (p.price - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

export interface TriangleInputs {
  candles: Array<{ high?: number; low?: number; h?: number; l?: number }>;
}

/** Motor puro: swings fractais reais -> Triângulo (Ascendente/Descendente/
 *  Simétrico) real, geometria por mínimos quadrados. Determinístico, zero
 *  rede/estado, fail-closed em qualquer amostra insuficiente. */
export function detectTrianglePattern({ candles }: TriangleInputs): TrianglePatternHit | null {
  if (!Array.isArray(candles) || candles.length < FRACTAL_K * 2 + 5) return null;
  const lastIndex = candles.length - 1;
  const windowStart = Math.max(0, lastIndex - TRIANGLE_LOOKBACK_CANDLES);

  const highs = findSwings(candles, FRACTAL_K, true).filter((s: TrianglePoint) => s.index >= windowStart);
  const lows = findSwings(candles, FRACTAL_K, false).filter((s: TrianglePoint) => s.index >= windowStart);
  if (highs.length < MIN_TOUCHES_PER_LINE || lows.length < MIN_TOUCHES_PER_LINE) return null;

  const resistancePoints: TrianglePoint[] = highs.slice(-MAX_TOUCHES_PER_LINE);
  const supportPoints: TrianglePoint[] = lows.slice(-MAX_TOUCHES_PER_LINE);

  const mostRecentTouch = Math.max(
    resistancePoints[resistancePoints.length - 1].index,
    supportPoints[supportPoints.length - 1].index,
  );
  if (lastIndex - mostRecentTouch > RECENT_TOUCH_TOLERANCE_CANDLES) return null; // padrão não é mais fresco

  const resistanceFit = fitLine(resistancePoints);
  const supportFit = fitLine(supportPoints);
  if (!resistanceFit || !supportFit) return null;

  // Preço médio real da amostra — referência honesta e estável para
  // normalizar slope em %/candle, nunca um número mágico absoluto.
  const refPrice =
    (resistancePoints.reduce((s, p) => s + p.price, 0) / resistancePoints.length +
      supportPoints.reduce((s, p) => s + p.price, 0) / supportPoints.length) /
    2;
  if (!(refPrice > 0)) return null;
  const resSlopePct = (resistanceFit.slope / refPrice) * 100;
  const supSlopePct = (supportFit.slope / refPrice) * 100;
  const resFlat = Math.abs(resSlopePct) <= FLAT_SLOPE_PCT_PER_CANDLE;
  const supFlat = Math.abs(supSlopePct) <= FLAT_SLOPE_PCT_PER_CANDLE;

  let kind: TriangleKind;
  let direction: "BULLISH" | "BEARISH" | null;
  if (resFlat && supSlopePct > FLAT_SLOPE_PCT_PER_CANDLE) {
    kind = "ASCENDING";
    direction = "BULLISH";
  } else if (supFlat && resSlopePct < -FLAT_SLOPE_PCT_PER_CANDLE) {
    kind = "DESCENDING";
    direction = "BEARISH";
  } else if (resSlopePct < -FLAT_SLOPE_PCT_PER_CANDLE && supSlopePct > FLAT_SLOPE_PCT_PER_CANDLE) {
    kind = "SYMMETRICAL";
    direction = null; // geometria não determina o lado — ver cabeçalho
  } else {
    return null; // paralelas, alargando (broadening), ou nenhuma forma real de triângulo
  }

  const resistanceAtLastCandle = resistanceFit.slope * lastIndex + resistanceFit.intercept;
  const supportAtLastCandle = supportFit.slope * lastIndex + supportFit.intercept;
  if (resistanceAtLastCandle <= supportAtLastCandle) return null; // linhas já cruzaram — geometria de triângulo encerrada

  // Ápice real: interseção das 2 retas (mesma técnica de apex já usada
  // por detectWolfeInPivots em harmonic-patterns.ts) — só honesto quando
  // está à frente do candle atual.
  const slopeGap = resistanceFit.slope - supportFit.slope;
  let apexIndex: number | null = null;
  if (Math.abs(slopeGap) > 1e-12) {
    const apex = (supportFit.intercept - resistanceFit.intercept) / slopeGap;
    if (Number.isFinite(apex) && apex > lastIndex) apexIndex = apex;
  }

  const fitScore = Math.min(resistanceFit.r2, supportFit.r2);
  if (fitScore < MIN_TRIANGLE_FIT_SCORE) return null;

  return {
    contractVersion: TRIANGLE_CONTRACT_VERSION,
    kind,
    direction,
    resistancePoints,
    supportPoints,
    resistanceSlope: resistanceFit.slope,
    resistanceIntercept: resistanceFit.intercept,
    supportSlope: supportFit.slope,
    supportIntercept: supportFit.intercept,
    resistanceAtLastCandle,
    supportAtLastCandle,
    apexIndex,
    fitScore,
    completedAtIndex: mostRecentTouch,
  };
}
