// harmonic-patterns.ts — Refinamento Final §8 (Reconhecimento Harmônico,
// isolado e validado).
//
// Detecção XABCD dos 5 padrões harmônicos clássicos de razão de Fibonacci
// (Gartley, Bat, Butterfly, Crab, Cypher) sobre os MESMOS swings fractais
// compartilhados (fractal-swings.js — nunca uma segunda detecção de swing).
//
// Definições reais confirmadas por pesquisa (Carney "Harmonic Trading" /
// literatura padrão; ver PR para as fontes):
//   GARTLEY   B=0.618·XA (âncora) · C=0.382–0.886·AB · D=0.786·XA (âncora) · CD=1.13–1.618·BC
//   BAT       B=0.382–0.50·XA     · C=0.382–0.886·AB · D=0.886·XA (âncora) · CD=1.618–2.618·BC
//   BUTTERFLY B=0.786·XA (âncora) · C=0.382–0.886·AB · D=1.27–1.618·XA ext · CD=1.618–2.24·BC
//   CRAB      B=0.382–0.618·XA    · C=0.382–0.886·AB · D=1.618·XA ext (âncora) · CD=2.618–3.618·BC
//   CYPHER    B=0.382–0.618·XA    · C=1.13–1.414·XA ext (C ALÉM de A —
//             estrutura de extensão) · D=0.786·XC (âncora — medido sobre
//             XC, não XA; regra própria do Cypher)
//   SHARK     (Carney 2011, notação O-X-A-B-C mapeada nos MESMOS slots
//             X..D deste contrato): perna 3 estende a perna 2 em
//             1.13–1.618 (nossa BC/AB); perna 4 estende a perna 3 em
//             1.618–2.24 (nossa CD/BC); o ponto final completa em
//             0.886–1.13 da perna inicial (nossa AD/XA). Mesma estrutura
//             de extensão do Cypher (C além de A).
//   AB=CD     (4 pontos reais — X é honestamente ausente no contrato):
//             BC=0.382–0.886·AB (ideal 0.618) · CD=AB (âncora 1.0 —
//             a igualdade que dá nome ao padrão; a tolerância documentada
//             é a janela de aderência, nunca uma "variante" inventada).
//
// HONESTIDADE (Regra de Ouro 2, inegociável): fitScore é ADERÊNCIA DE
// RAZÃO — o quão perto as pernas medidas estão das razões definidas do
// padrão (1 = razões exatas, 0.75 = no limite da tolerância) — NUNCA uma
// probabilidade de o padrão "funcionar". Este repositório não tem backtest
// real que sustente afirmar probabilidade; o rótulo na UI diz isso.
//
// Fail-closed: candles insuficientes, swings não alternáveis, razão fora
// da tolerância dura, ou fit < MIN_FIT_SCORE ⇒ o padrão simplesmente não é
// reportado ([] é o estado honesto comum). Pura: zero rede, zero estado.
//
// WOLFE WAVES (Diretriz Mestra §9, pedidas pela 2ª vez — agora dentro):
// NÃO são padrão de razão XABCD — são geometria de canal em cunha com 5
// pontos. Regras canônicas confirmadas por pesquisa (ver PR para fontes):
//   Bullish (cunha descendente, reversão para cima esperada pela convenção
//   do padrão): pivôs 1(L) 2(H) 3(L) 4(H) 5(L), com 3 < 1 e 5 <= projeção
//   da linha 1→3 no tempo de 5 (o overshoot é a "sweet zone"), 4 < 2 e 4
//   dentro do range da onda 1→2; alvo = linha EPA 1→4. Bearish espelhado.
// O fitScore aqui também é ADERÊNCIA GEOMÉTRICA (overshoot dentro da banda
// documentada + cunha convergente) — nunca probabilidade. O preço EPA
// exposto é a linha 1→4 avaliada no TEMPO do ponto 5 (geometria real
// consumada). A ETA canônica da Wolfe (Consolidação Final §6) é o ÁPICE da
// cunha — o cruzamento das linhas 1→3 e 2→4, também geometria real dos
// pivôs (etaIndex) — exposta apenas quando está à frente do ponto 5.
import { findSwings, FRACTAL_K } from "../../../src/research/engines/fractal-swings.js";

export const HARMONIC_CONTRACT_VERSION = 1 as const;

// Piso de aderência para reportar ("nível mínimo de confiança" da diretriz,
// com o nome honesto): abaixo disso o padrão não aparece em lugar nenhum.
export const MIN_FIT_SCORE = 0.75;

// Quantos pivôs recentes entram na varredura (janelas de 5 consecutivos).
const MAX_PIVOTS_SCANNED = 12;

export type HarmonicPatternName =
  | "GARTLEY"
  | "BAT"
  | "BUTTERFLY"
  | "CRAB"
  | "CYPHER"
  | "SHARK"
  | "ABCD"
  | "WOLFE";

export interface HarmonicPoint {
  index: number; // índice do candle onde o swing confirmou
  price: number;
}

export interface HarmonicPatternHit {
  contractVersion: typeof HARMONIC_CONTRACT_VERSION;
  pattern: HarmonicPatternName;
  // BULLISH = o ponto final é um fundo (a convenção do padrão espera
  // reversão para cima); BEARISH espelhado. É a convenção do PADRÃO —
  // display-only, nunca uma segunda decisão de trading (LEI 24).
  direction: "BULLISH" | "BEARISH";
  // XABCD para os harmônicos de razão de 5 pontos; para WOLFE os mesmos
  // slots carregam os pontos 1..5 (X=1, A=2, B=3, C=4, D=5 — mesma ordem
  // temporal alternada, zero segundo formato de contrato). Para AB=CD
  // (4 pontos reais) o X é honestamente AUSENTE — nunca um ponto
  // duplicado/fabricado para preencher o slot.
  points: { X?: HarmonicPoint; A: HarmonicPoint; B: HarmonicPoint; C: HarmonicPoint; D: HarmonicPoint };
  // Razões realmente medidas (verificáveis contra a tabela do cabeçalho).
  // Para WOLFE: overshoot do ponto 5 além da linha 1→3 (fração da altura
  // da cunha) e razão de convergência das linhas.
  ratios: Record<string, number>;
  fitScore: number; // aderência de razão/geometria 0..1 — NUNCA probabilidade
  completedAtIndex: number; // índice do candle do ponto final (D / 5)
  // Só WOLFE: preço da linha EPA (1→4) avaliada no tempo do ponto 5 —
  // o alvo clássico do padrão, geometria real consumada (ver cabeçalho).
  epaPrice?: number;
  // Só WOLFE (§ ETA, terminologia canônica do padrão): índice FRACIONÁRIO
  // de barra onde as linhas 1→3 e 2→4 se cruzam (o ápice da cunha) — a
  // literatura usa esse cruzamento como o tempo estimado de chegada à EPA.
  // Presente apenas quando o ápice está À FRENTE do ponto 5 (um ápice no
  // passado não é uma ETA honesta). É geometria real dos pivôs — nunca
  // uma previsão fabricada; a UI o apresenta como "≈" e o rótulo diz isso.
  etaIndex?: number;
}

interface RatioSpec {
  key: string; // qual razão medida esta regra avalia
  kind: "ideal" | "range";
  ideal?: number; // kind=ideal
  tol?: number; // kind=ideal: desvio que zera a contribuição (duro: além disso, rejeita)
  min?: number; // kind=range
  max?: number;
  hardTol?: number; // kind=range: quanto além da borda ainda degrada em vez de rejeitar
}

interface PatternSpec {
  name: HarmonicPatternName;
  cypherShape: boolean; // true = C além de A (mede XC), false = C retração de AB
  rules: RatioSpec[];
}

const RANGE_HARD_TOL = 0.08; // além da borda do range: degrada até rejeitar a +0.08
const PATTERNS: PatternSpec[] = [
  {
    name: "GARTLEY",
    cypherShape: false,
    rules: [
      { key: "AB_XA", kind: "ideal", ideal: 0.618, tol: 0.06 },
      { key: "BC_AB", kind: "range", min: 0.382, max: 0.886, hardTol: RANGE_HARD_TOL },
      { key: "AD_XA", kind: "ideal", ideal: 0.786, tol: 0.06 },
      { key: "CD_BC", kind: "range", min: 1.13, max: 1.618, hardTol: RANGE_HARD_TOL },
    ],
  },
  {
    name: "BAT",
    cypherShape: false,
    rules: [
      { key: "AB_XA", kind: "range", min: 0.382, max: 0.5, hardTol: RANGE_HARD_TOL },
      { key: "BC_AB", kind: "range", min: 0.382, max: 0.886, hardTol: RANGE_HARD_TOL },
      { key: "AD_XA", kind: "ideal", ideal: 0.886, tol: 0.06 },
      { key: "CD_BC", kind: "range", min: 1.618, max: 2.618, hardTol: RANGE_HARD_TOL },
    ],
  },
  {
    name: "BUTTERFLY",
    cypherShape: false,
    rules: [
      { key: "AB_XA", kind: "ideal", ideal: 0.786, tol: 0.06 },
      { key: "BC_AB", kind: "range", min: 0.382, max: 0.886, hardTol: RANGE_HARD_TOL },
      { key: "AD_XA", kind: "range", min: 1.27, max: 1.618, hardTol: RANGE_HARD_TOL },
      { key: "CD_BC", kind: "range", min: 1.618, max: 2.24, hardTol: RANGE_HARD_TOL },
    ],
  },
  {
    name: "CRAB",
    cypherShape: false,
    rules: [
      { key: "AB_XA", kind: "range", min: 0.382, max: 0.618, hardTol: RANGE_HARD_TOL },
      { key: "BC_AB", kind: "range", min: 0.382, max: 0.886, hardTol: RANGE_HARD_TOL },
      { key: "AD_XA", kind: "ideal", ideal: 1.618, tol: 0.1 },
      { key: "CD_BC", kind: "range", min: 2.618, max: 3.618, hardTol: RANGE_HARD_TOL },
    ],
  },
  {
    name: "CYPHER",
    cypherShape: true,
    rules: [
      { key: "AB_XA", kind: "range", min: 0.382, max: 0.618, hardTol: RANGE_HARD_TOL },
      { key: "XC_XA", kind: "range", min: 1.13, max: 1.414, hardTol: RANGE_HARD_TOL },
      { key: "CD_XC", kind: "ideal", ideal: 0.786, tol: 0.06 },
    ],
  },
  {
    // SHARK (Carney 2011; Diretriz Mestra Consolidação Final §5) — pontos
    // canônicos O-X-A-B-C mapeados nos nossos slots X-A-B-C-D (mesma ordem
    // temporal alternada). Regras reais confirmadas por pesquisa (ver PR):
    //   deles AB estende XA 1.13–1.618  => nosso BC_AB ∈ [1.13, 1.618]
    //   deles BC estende AB 1.618–2.24  => nosso CD_BC ∈ [1.618, 2.24]
    //   deles C completa 0.886–1.13 de OX => nosso AD_XA ∈ [0.886, 1.13]
    // A extensão >1 do "AB deles" além do início da perna é exatamente o
    // shape com C além de A (o mesmo grupo geométrico do Cypher).
    name: "SHARK",
    cypherShape: true,
    rules: [
      { key: "BC_AB", kind: "range", min: 1.13, max: 1.618, hardTol: RANGE_HARD_TOL },
      { key: "CD_BC", kind: "range", min: 1.618, max: 2.24, hardTol: RANGE_HARD_TOL },
      { key: "AD_XA", kind: "range", min: 0.886, max: 1.13, hardTol: RANGE_HARD_TOL },
    ],
  },
];

// AB=CD (Diretriz Mestra Consolidação Final §5) — o único padrão de 4
// pontos reais da família. Regras clássicas confirmadas por pesquisa (ver
// PR): BC retrai AB em 0.382–0.886 (ideal 0.618) e CD ≈ AB (a igualdade
// que dá nome ao padrão; a tolerância de ±10% é a janela de aderência
// prática — o fitScore mede exatamente o desvio dela, nunca uma
// probabilidade). Detector próprio de janela de 4 pivôs — o slot X fica
// honestamente ausente no hit (ver comentário do contrato).
const ABCD_RULES: RatioSpec[] = [
  { key: "BC_AB", kind: "range", min: 0.382, max: 0.886, hardTol: RANGE_HARD_TOL },
  { key: "CD_AB", kind: "ideal", ideal: 1.0, tol: 0.1 },
];

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Constrói a sequência zigzag alternada (H,L,H,L,...) a partir dos swings
// confirmados dos dois lados: ordena por índice; dois do MESMO lado em
// sequência colapsam no mais extremo (higher high / lower low) — o padrão
// XABCD exige alternância estrita.
export function buildAlternatingPivots(
  candles: Array<{ high?: number; low?: number; h?: number; l?: number }>,
): Array<HarmonicPoint & { type: "H" | "L" }> {
  const highs = findSwings(candles, FRACTAL_K, true).map((s) => ({ ...s, type: "H" as const }));
  const lows = findSwings(candles, FRACTAL_K, false).map((s) => ({ ...s, type: "L" as const }));
  const merged = [...highs, ...lows].sort((a, b) => a.index - b.index);
  const out: Array<HarmonicPoint & { type: "H" | "L" }> = [];
  for (const p of merged) {
    const prev = out[out.length - 1];
    if (prev && prev.type === p.type) {
      const moreExtreme = p.type === "H" ? p.price > prev.price : p.price < prev.price;
      if (moreExtreme) out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
}

function scoreRule(rule: RatioSpec, measured: number): number | null {
  if (!fin(measured)) return null;
  if (rule.kind === "ideal") {
    const dev = Math.abs(measured - (rule.ideal as number)) / (rule.tol as number);
    return dev > 1 ? null : dev; // além da tolerância dura => rejeita o padrão
  }
  const { min, max, hardTol } = rule as Required<Pick<RatioSpec, "min" | "max" | "hardTol">> & RatioSpec;
  if (measured >= min && measured <= max) return 0;
  const distOut = measured < min ? min - measured : measured - max;
  return distOut > hardTol ? null : distOut / hardTol;
}

export interface HarmonicInputs {
  candles: Array<{ high?: number; low?: number; h?: number; l?: number }>;
  maxPatterns?: number;
}

export function detectHarmonicPatterns(
  { candles, maxPatterns = 3 }: HarmonicInputs,
  _computedAt: number = Date.now(),
): HarmonicPatternHit[] {
  if (!Array.isArray(candles) || candles.length < FRACTAL_K * 2 + 5) return [];
  const pivots = buildAlternatingPivots(candles).slice(-MAX_PIVOTS_SCANNED);
  if (pivots.length < 5) return [];

  const hits: HarmonicPatternHit[] = [];
  for (let end = 4; end < pivots.length; end++) {
    // Relevância operacional (a diretriz pede padrões para DECIDIR agora):
    // só janelas cujo D é o último ou penúltimo pivô confirmado — um XABCD
    // completado muitos swings atrás é história, não plano.
    if (end < pivots.length - 2) continue;
    const [X, A, B, C, D] = pivots.slice(end - 4, end + 1);
    // Alternância estrita já garantida pelo zigzag; a orientação vem do
    // tipo do primeiro pivô: X=L => XA de alta => padrão BULLISH (D fundo).
    const bullish = X.type === "L";
    if (D.type !== X.type) continue; // X e D são sempre o mesmo lado num XABCD alternado (L,H,L,H,L)

    const XA = Math.abs(A.price - X.price);
    const AB = Math.abs(A.price - B.price);
    const BC = Math.abs(C.price - B.price);
    const CD = Math.abs(C.price - D.price);
    const XC = Math.abs(C.price - X.price);
    const AD = Math.abs(A.price - D.price);
    if (XA <= 0 || AB <= 0 || BC <= 0 || CD <= 0 || XC <= 0) continue;

    // C além de A (na direção de XA) => shape de Cypher; C retração => os outros 4.
    const cBeyondA = bullish ? C.price > A.price : C.price < A.price;

    const ratios: Record<string, number> = {
      AB_XA: AB / XA,
      BC_AB: BC / AB,
      CD_BC: CD / BC,
      AD_XA: AD / XA,
      XC_XA: XC / XA,
      CD_XC: CD / XC,
    };

    for (const spec of PATTERNS) {
      if (spec.cypherShape !== cBeyondA) continue;
      let devSum = 0;
      let rejected = false;
      for (const rule of spec.rules) {
        const d = scoreRule(rule, ratios[rule.key]);
        if (d === null) {
          rejected = true;
          break;
        }
        devSum += d;
      }
      if (rejected) continue;
      const fitScore = 1 - devSum / spec.rules.length;
      if (fitScore < MIN_FIT_SCORE) continue;
      hits.push({
        contractVersion: HARMONIC_CONTRACT_VERSION,
        pattern: spec.name,
        direction: bullish ? "BULLISH" : "BEARISH",
        points: {
          X: { index: X.index, price: X.price },
          A: { index: A.index, price: A.price },
          B: { index: B.index, price: B.price },
          C: { index: C.index, price: C.price },
          D: { index: D.index, price: D.price },
        },
        ratios,
        fitScore,
        completedAtIndex: D.index,
      });
    }
  }

  // AB=CD (§5): janela própria de 4 pivôs, mesmas regras de frescor.
  hits.push(...detectAbcdInPivots(pivots));

  // Wolfe Waves (§9): mesma varredura de pivôs, geometria própria.
  hits.push(...detectWolfeInPivots(pivots));

  return hits.sort((a, b) => b.fitScore - a.fitScore).slice(0, Math.max(0, maxPatterns));
}

// AB=CD: varredura de janelas de 4 pivôs alternados (A,B,C,D). Direção
// pela convenção do padrão: D fundo => BULLISH (reversão para cima
// esperada), D topo => BEARISH — display-only, nunca decisão (LEI 24).
function detectAbcdInPivots(pivots: Array<HarmonicPoint & { type: "H" | "L" }>): HarmonicPatternHit[] {
  const hits: HarmonicPatternHit[] = [];
  for (let end = 3; end < pivots.length; end++) {
    if (end < pivots.length - 2) continue; // frescor: D no último/penúltimo pivô (mesma regra dos XABCD)
    const [A, B, C, D] = pivots.slice(end - 3, end + 1);
    const AB = Math.abs(A.price - B.price);
    const BC = Math.abs(C.price - B.price);
    const CD = Math.abs(C.price - D.price);
    if (AB <= 0 || BC <= 0 || CD <= 0) continue;
    const ratios: Record<string, number> = { BC_AB: BC / AB, CD_AB: CD / AB };
    let devSum = 0;
    let rejected = false;
    for (const rule of ABCD_RULES) {
      const d = scoreRule(rule, ratios[rule.key]);
      if (d === null) {
        rejected = true;
        break;
      }
      devSum += d;
    }
    if (rejected) continue;
    const fitScore = 1 - devSum / ABCD_RULES.length;
    if (fitScore < MIN_FIT_SCORE) continue;
    hits.push({
      contractVersion: HARMONIC_CONTRACT_VERSION,
      pattern: "ABCD",
      direction: D.type === "L" ? "BULLISH" : "BEARISH",
      points: {
        A: { index: A.index, price: A.price },
        B: { index: B.index, price: B.price },
        C: { index: C.index, price: C.price },
        D: { index: D.index, price: D.price },
      },
      ratios,
      fitScore,
      completedAtIndex: D.index,
    });
  }
  return hits;
}

// Bandas geométricas documentadas da Wolfe (parâmetros declarados, mesma
// natureza dos ranges de razão dos XABCD — não medições):
//   overshoot do ponto 5 além da linha 1→3, como fração da altura da cunha
//   no tempo de 5: aceito em [-0.05, 0.50] (levemente aquém até metade da
//   altura além), ideal em [0, 0.25] — a "sweet zone" da literatura.
//   convergência: |slope(2→4)| / |slope(1→3)| — a cunha precisa ESTREITAR
//   para frente, e isso exige a linha 2→4 mais íngreme que a 1→3 (razão
//   > 1): o gap entre as linhas é L24−L13 e a derivada dele é s24−s13 —
//   com as duas descendo (bullish), só encolhe quando |s24| > |s13|.
//   CORREÇÃO REAL (Consolidação Final §6): a primeira versão exigia razão
//   em (0, 1) — aceitava cunhas que ALARGAM (ápice no passado) e rejeitava
//   as convergentes canônicas. O bug foi exposto ao derivar a ETA (ápice =
//   cruzamento 1→3 × 2→4, que precisa estar À FRENTE do ponto 5). Janela
//   corrigida: (1.001, 50], ideal [1.1, 5].
const WOLFE_OVERSHOOT_WINDOW = { min: -0.05, max: 0.5, idealMin: 0, idealMax: 0.25 };
const WOLFE_CONVERGENCE_WINDOW = { min: 1.001, max: 50, idealMin: 1.1, idealMax: 5 };

function bandDeviation(v: number, w: { min: number; max: number; idealMin: number; idealMax: number }): number | null {
  if (!fin(v) || v < w.min || v > w.max) return null; // fora da janela dura => rejeita
  if (v >= w.idealMin && v <= w.idealMax) return 0;
  // desvio linear da borda ideal até a borda dura correspondente
  return v < w.idealMin ? (w.idealMin - v) / (w.idealMin - w.min) : (v - w.idealMax) / (w.max - w.idealMax);
}

function detectWolfeInPivots(pivots: Array<HarmonicPoint & { type: "H" | "L" }>): HarmonicPatternHit[] {
  const hits: HarmonicPatternHit[] = [];
  for (let end = 4; end < pivots.length; end++) {
    if (end < pivots.length - 2) continue; // mesma janela de frescor dos XABCD
    const [p1, p2, p3, p4, p5] = pivots.slice(end - 4, end + 1);
    const bullish = p1.type === "L";
    if (p5.type !== p1.type) continue;

    // Cunha canônica: bullish = fundos descendo (3<1) e topos descendo
    // (4<2) com 4 ainda dentro do range da onda 1→2; bearish espelhado.
    const wedgeOk = bullish
      ? p3.price < p1.price && p4.price < p2.price && p4.price > p1.price
      : p3.price > p1.price && p4.price > p2.price && p4.price < p1.price;
    if (!wedgeOk) continue;

    const slope13 = (p3.price - p1.price) / Math.max(1, p3.index - p1.index);
    const slope24 = (p4.price - p2.price) / Math.max(1, p4.index - p2.index);
    // Altura real da cunha no tempo de 5 (distância entre as duas linhas).
    const line13At5 = p1.price + slope13 * (p5.index - p1.index);
    const line24At5 = p2.price + slope24 * (p5.index - p2.index);
    const wedgeHeightAt5 = Math.abs(line24At5 - line13At5);
    if (!(wedgeHeightAt5 > 0)) continue;

    // Overshoot do 5 ALÉM da linha 1→3 (positivo = sweet zone real).
    const overshoot = (bullish ? line13At5 - p5.price : p5.price - line13At5) / wedgeHeightAt5;
    const convergence = Math.abs(slope24) / Math.max(Math.abs(slope13), 1e-12);

    const dOver = bandDeviation(overshoot, WOLFE_OVERSHOOT_WINDOW);
    const dConv = bandDeviation(convergence, WOLFE_CONVERGENCE_WINDOW);
    if (dOver === null || dConv === null) continue;
    const fitScore = 1 - (dOver + dConv) / 2;
    if (fitScore < MIN_FIT_SCORE) continue;

    // EPA: linha 1→4 avaliada no tempo do ponto 5 (geometria consumada).
    const slope14 = (p4.price - p1.price) / Math.max(1, p4.index - p1.index);
    const epaPrice = p1.price + slope14 * (p5.index - p1.index);

    // ETA canônica da Wolfe (Diretriz Mestra §6): o ápice da cunha — o
    // índice (fracionário) onde as linhas 1→3 e 2→4 se cruzam. Geometria
    // real dos pivôs, nunca previsão: só é exposta quando o ápice está À
    // FRENTE do ponto 5 (cruzamento no passado não é uma ETA honesta).
    // Denominador nunca ~0 aqui: a janela de convergência já exigiu
    // |slope24| < |slope13| com o mesmo sinal (cunha real).
    const slopeGap = slope13 - slope24;
    let etaIndex: number | undefined;
    if (Math.abs(slopeGap) > 1e-12) {
      const apex = (p2.price - slope24 * p2.index - p1.price + slope13 * p1.index) / slopeGap;
      if (Number.isFinite(apex) && apex > p5.index) etaIndex = apex;
    }

    hits.push({
      contractVersion: HARMONIC_CONTRACT_VERSION,
      pattern: "WOLFE",
      direction: bullish ? "BULLISH" : "BEARISH",
      points: {
        X: { index: p1.index, price: p1.price },
        A: { index: p2.index, price: p2.price },
        B: { index: p3.index, price: p3.price },
        C: { index: p4.index, price: p4.price },
        D: { index: p5.index, price: p5.price },
      },
      ratios: { WOLFE_OVERSHOOT: overshoot, WOLFE_CONVERGENCE: convergence },
      fitScore,
      completedAtIndex: p5.index,
      epaPrice,
      etaIndex,
    });
  }
  return hits;
}
