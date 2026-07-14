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
//   CYPHER    B=0.382–0.618·XA    · C=1.13–1.414·XA ext (C ALÉM de A — única
//             estrutura diferente) · D=0.786·XC (âncora — medido sobre XC,
//             não XA; regra própria do Cypher)
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
// Wolfe Waves (também citadas na diretriz §8) NÃO estão aqui: não são um
// padrão de razão XABCD — são um padrão geométrico de canal (5 pontos +
// linha EPA 1→4), outra máquina de detecção. Entregar junto seria apressado
// (Disciplina de trabalho item 5); documentado como pendência real no PR.
import { findSwings, FRACTAL_K } from "../../../src/research/engines/fractal-swings.js";

export const HARMONIC_CONTRACT_VERSION = 1 as const;

// Piso de aderência para reportar ("nível mínimo de confiança" da diretriz,
// com o nome honesto): abaixo disso o padrão não aparece em lugar nenhum.
export const MIN_FIT_SCORE = 0.75;

// Quantos pivôs recentes entram na varredura (janelas de 5 consecutivos).
const MAX_PIVOTS_SCANNED = 12;

export type HarmonicPatternName = "GARTLEY" | "BAT" | "BUTTERFLY" | "CRAB" | "CYPHER";

export interface HarmonicPoint {
  index: number; // índice do candle onde o swing confirmou
  price: number;
}

export interface HarmonicPatternHit {
  contractVersion: typeof HARMONIC_CONTRACT_VERSION;
  pattern: HarmonicPatternName;
  // BULLISH = D é um fundo (a convenção do padrão espera reversão para
  // cima a partir de D); BEARISH espelhado. É a convenção do PADRÃO —
  // display-only, nunca uma segunda decisão de trading (LEI 24).
  direction: "BULLISH" | "BEARISH";
  points: { X: HarmonicPoint; A: HarmonicPoint; B: HarmonicPoint; C: HarmonicPoint; D: HarmonicPoint };
  // Razões realmente medidas (verificáveis contra a tabela do cabeçalho).
  ratios: Record<string, number>;
  fitScore: number; // aderência de razão 0..1 — NUNCA probabilidade
  completedAtIndex: number; // índice do candle do ponto D
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

  return hits.sort((a, b) => b.fitScore - a.fitScore).slice(0, Math.max(0, maxPatterns));
}
