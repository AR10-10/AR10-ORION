// head-shoulders-pattern.ts — Carta Branca (Reconhecimento de Padrões):
// motor puro de detecção de Ombro-Cabeça-Ombro (regular + inverso) sobre
// o MESMO zigzag alternado compartilhado (buildAlternatingPivots,
// harmonic-patterns.ts — zero segunda construção de pivô, zero segunda
// detecção de swing).
//
// Definição real confirmada por pesquisa (LightningChart, Dukascopy,
// LuxAlgo, OANDA — consistente entre as fontes; ver PR para os links):
//   REGULAR (baixista): 3 topos — Ombro Esquerdo, Cabeça (o mais alto),
//     Ombro Direito — com uma "neckline" real ligando os 2 fundos entre
//     eles (pode ser inclinada). Rompimento abaixo da neckline confirma.
//   INVERSO (altista): espelhado — 3 fundos, Cabeça o mais baixo,
//     neckline ligando os 2 topos entre eles. Rompimento acima confirma.
//   Ombros "aproximadamente iguais" em altura — medida a partir da
//     própria neckline (nunca preço bruto, já que ela pode ser inclinada).
//
// HONESTIDADE (Regra de Ouro 2/3): fitScore é ADERÊNCIA GEOMÉTRICA
// (simetria real dos ombros, medida sobre a neckline) — nunca
// probabilidade de reversão. Este motor NÃO verifica se havia uma
// tendência prévia real antes do padrão (a definição clássica pede um
// "prior trend" para ser tecnicamente uma reversão) — mesma disciplina já
// aplicada a XABCD/Wolfe neste repositório: detecta a GEOMETRIA pura,
// rotula a direção pela convenção do próprio padrão. Limitação conhecida,
// documentada honestamente aqui e no relatório da rodada — não escondida.
//
// Fail-closed: menos de 5 pivôs alternados frescos, cabeça não
// genuinamente mais extrema que os 2 ombros, ombros fora da tolerância de
// simetria, ou fit abaixo do piso ⇒ null honesto.
import { buildAlternatingPivots, type HarmonicPoint } from "./harmonic-patterns";

export const HEAD_SHOULDERS_CONTRACT_VERSION = 1 as const;

export const MIN_HEAD_SHOULDERS_FIT_SCORE = 0.75;

// Tolerância real de simetria de ombros — convenção declarada (mesma
// natureza dos ranges de hardTol em harmonic-patterns.ts): a literatura
// pede ombros "aproximadamente iguais" sem número exato; 35% de desvio
// mútuo permitido antes de rejeitar, para dado ao vivo nunca produzir
// ombros perfeitamente simétricos.
const SHOULDER_SYMMETRY_IDEAL = 1.0;
const SHOULDER_SYMMETRY_HARD_TOL = 0.35;
// Mesma janela de varredura de harmonic-patterns.ts (MAX_PIVOTS_SCANNED).
const MAX_PIVOTS_SCANNED = 12;

export type HeadShouldersKind = "REGULAR" | "INVERSE";

export interface HeadShouldersHit {
  contractVersion: typeof HEAD_SHOULDERS_CONTRACT_VERSION;
  kind: HeadShouldersKind;
  // REGULAR (3 topos, cabeça mais alta) => BEARISH (reversão baixista,
  // convenção real do padrão); INVERSE => BULLISH.
  direction: "BULLISH" | "BEARISH";
  leftShoulder: HarmonicPoint;
  neckline1: HarmonicPoint; // 1º ponto real da neckline (vale/pico entre ombro esq. e cabeça)
  head: HarmonicPoint;
  neckline2: HarmonicPoint; // 2º ponto real da neckline (vale/pico entre cabeça e ombro dir.)
  rightShoulder: HarmonicPoint;
  necklineSlope: number;
  necklineIntercept: number;
  // Nível real da neckline no ÚLTIMO candle carregado — o rompimento que
  // confirma o padrão, extrapolação linear real dos 2 pontos (mesma
  // técnica de linha avaliada em qualquer tempo já usada pela Wolfe).
  necklineAtLastCandle: number;
  shoulderSymmetry: number; // razão real ombro2/ombro1 (altura sobre a neckline) — 1.0 = simetria perfeita
  fitScore: number; // NUNCA probabilidade
  completedAtIndex: number; // índice do ombro direito (ponto mais recente)
}

function necklineFrom(
  n1: HarmonicPoint,
  n2: HarmonicPoint,
): { slope: number; intercept: number; valueAt: (i: number) => number } {
  const slope = (n2.price - n1.price) / Math.max(1, n2.index - n1.index);
  const intercept = n1.price - slope * n1.index;
  return { slope, intercept, valueAt: (i: number) => slope * i + intercept };
}

export interface HeadShouldersInputs {
  candles: Array<{ high?: number; low?: number; h?: number; l?: number }>;
}

/** Motor puro: zigzag alternado real -> Ombro-Cabeça-Ombro (regular ou
 *  inverso) real, o de maior fit dentre as janelas frescas. Determinístico,
 *  zero rede/estado, fail-closed. */
export function detectHeadAndShoulders({ candles }: HeadShouldersInputs): HeadShouldersHit | null {
  if (!Array.isArray(candles) || candles.length < 9) return null;
  const pivots = buildAlternatingPivots(candles).slice(-MAX_PIVOTS_SCANNED);
  if (pivots.length < 5) return null;

  let best: HeadShouldersHit | null = null;
  const lastIndex = candles.length - 1;

  for (let end = 4; end < pivots.length; end++) {
    // Frescor: ombro direito precisa ser o último ou penúltimo pivô —
    // mesma disciplina de "D fresco" em harmonic-patterns.ts.
    if (end < pivots.length - 2) continue;
    const [p1, p2, p3, p4, p5] = pivots.slice(end - 4, end + 1);
    // Regular: H,L,H,L,H (cabeça é um TOPO). Inverso: L,H,L,H,L (cabeça é
    // um FUNDO). A alternância estrita já vem garantida pelo zigzag.
    if (p1.type !== p3.type || p3.type !== p5.type) continue; // defesa extra, nunca deveria falhar dado o zigzag
    const regular = p1.type === "H";

    const headMoreExtreme = regular
      ? p3.price > p1.price && p3.price > p5.price
      : p3.price < p1.price && p3.price < p5.price;
    if (!headMoreExtreme) continue; // cabeça precisa ser genuinamente mais extrema que os 2 ombros

    const neckline = necklineFrom(p2, p4);
    const shoulder1Height = Math.abs(p1.price - neckline.valueAt(p1.index));
    const shoulder2Height = Math.abs(p5.price - neckline.valueAt(p5.index));
    const headHeight = Math.abs(p3.price - neckline.valueAt(p3.index));
    if (!(shoulder1Height > 0) || !(shoulder2Height > 0) || !(headHeight > 0)) continue;
    if (!(headHeight > shoulder1Height) || !(headHeight > shoulder2Height)) continue; // cabeça precisa se destacar da neckline mais que os ombros

    const symmetry = shoulder2Height / shoulder1Height;
    const dev = Math.abs(symmetry - SHOULDER_SYMMETRY_IDEAL) / SHOULDER_SYMMETRY_HARD_TOL;
    if (dev > 1) continue; // além da tolerância dura de simetria — rejeita
    const fitScore = 1 - dev;
    if (fitScore < MIN_HEAD_SHOULDERS_FIT_SCORE) continue;

    const hit: HeadShouldersHit = {
      contractVersion: HEAD_SHOULDERS_CONTRACT_VERSION,
      kind: regular ? "REGULAR" : "INVERSE",
      direction: regular ? "BEARISH" : "BULLISH",
      leftShoulder: { index: p1.index, price: p1.price },
      neckline1: { index: p2.index, price: p2.price },
      head: { index: p3.index, price: p3.price },
      neckline2: { index: p4.index, price: p4.price },
      rightShoulder: { index: p5.index, price: p5.price },
      necklineSlope: neckline.slope,
      necklineIntercept: neckline.intercept,
      necklineAtLastCandle: neckline.valueAt(lastIndex),
      shoulderSymmetry: symmetry,
      fitScore,
      completedAtIndex: p5.index,
    };
    if (!best || hit.fitScore > best.fitScore) best = hit;
  }

  return best;
}
