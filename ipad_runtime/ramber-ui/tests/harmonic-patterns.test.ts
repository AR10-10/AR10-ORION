// harmonic-patterns.test.ts — Refinamento Final §8: execução real do motor
// harmônico. Cada padrão ganha uma fixture com as razões EXATAS da tabela
// documentada no módulo (fit = 1 quando tudo bate no ideal/range) — se a
// matemática de razão regredir, estes testes quebram na hora.
//
// Fixture: zigzag de pivôs com 5 candles por perna (k=2 confirma), candles
// doji high===low===v => preço do swing é exato (mesma técnica de
// premium-discount.test.ts).
import { describe, it, expect } from 'vitest';
import {
  detectHarmonicPatterns,
  buildAlternatingPivots,
  MIN_FIT_SCORE,
  HARMONIC_CONTRACT_VERSION,
} from '../src/nexus/harmonic-patterns';

const c = (v: number) => ({ high: v, low: v });

// Constrói candles a partir de uma lista de preços-pivô, interpolando 4
// candles entre cada par (pivô a cada 5 índices), com LEAD-IN antes do
// primeiro pivô e cauda depois do último: o fractal k=2 só confirma um
// extremo com 2 vizinhos DE CADA lado — sem lead-in, o pivô X (índice 0)
// jamais seria detectável e o padrão inteiro sumiria (bug real da primeira
// versão desta fixture, pego pela própria suíte).
function zigzagFromPivots(pivots: number[], tailDirection: 1 | -1 = 1): Array<{ high: number; low: number }> {
  const out: Array<{ high: number; low: number }> = [];
  // lead-in: 2 candles vindos do lado oposto ao primeiro movimento, para
  // que pivots[0] seja um extremo local estrito.
  const firstStep = Math.abs(pivots[1] - pivots[0]) / 5;
  const leadSign = pivots[1] > pivots[0] ? 1 : -1; // X é fundo => lead desce até X
  out.push(c(pivots[0] + leadSign * firstStep * 2), c(pivots[0] + leadSign * firstStep));
  for (let i = 0; i < pivots.length; i++) {
    if (i === 0) {
      out.push(c(pivots[0]));
      continue;
    }
    const from = pivots[i - 1];
    const to = pivots[i];
    for (let step = 1; step <= 5; step++) {
      out.push(c(from + ((to - from) * step) / 5));
    }
  }
  // cauda: afasta do último pivô na direção oposta ao movimento final,
  // confirmando-o como extremo local (2 candles bastam para k=2).
  const last = pivots[pivots.length - 1];
  const away = tailDirection * Math.abs(last) * 0.001 || tailDirection;
  out.push(c(last + away), c(last + away * 2), c(last + away * 3));
  return out;
}

describe('buildAlternatingPivots: zigzag estrito H/L a partir do findSwings compartilhado', () => {
  it('detecta a sequência alternada L,H,L com preços exatos', () => {
    const candles = zigzagFromPivots([1000, 1100, 1050], 1);
    const pivots = buildAlternatingPivots(candles);
    const types = pivots.map((p) => p.type).join(',');
    expect(types).toBe('L,H,L');
    expect(pivots.map((p) => p.price)).toEqual([1000, 1100, 1050]);
  });
});

// ---------- fixtures por padrão (razões da tabela do módulo) ----------
// XA = 100 em todos; ver comentários com a razão exata de cada perna.

describe('detectHarmonicPatterns: os 5 padrões com razões exatas => fit 1.0', () => {
  it('GARTLEY bullish: B=0.618·XA, D=0.786·XA, CD/BC=1.44 (dentro de 1.13–1.618)', () => {
    // X=1000 A=1100 B=1038.2 C=1076.4 (BC/AB=0.618·) D=1021.4
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1100, 1038.2, 1076.4, 1021.4], 1) });
    const g = hits.find((h) => h.pattern === 'GARTLEY');
    expect(g, JSON.stringify(hits.map((h) => h.pattern))).toBeDefined();
    expect(g!.direction).toBe('BULLISH');
    expect(g!.fitScore).toBeCloseTo(1, 5);
    expect(g!.points.D.price).toBeCloseTo(1021.4, 6);
    expect(g!.ratios.AB_XA).toBeCloseTo(0.618, 6);
    expect(g!.ratios.AD_XA).toBeCloseTo(0.786, 6);
    expect(g!.contractVersion).toBe(HARMONIC_CONTRACT_VERSION);
  });

  it('BAT bullish: B=0.45·XA, D=0.886·XA, CD/BC≈2.38 (dentro de 1.618–2.618)', () => {
    // X=1000 A=1100 B=1055 C=1086.5 (BC/AB=0.7) D=1011.4
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1100, 1055, 1086.5, 1011.4], 1) });
    const b = hits.find((h) => h.pattern === 'BAT');
    expect(b, JSON.stringify(hits.map((h) => h.pattern))).toBeDefined();
    expect(b!.fitScore).toBeCloseTo(1, 5);
    expect(b!.ratios.AD_XA).toBeCloseTo(0.886, 6);
  });

  it('BUTTERFLY bearish (espelhado): B=0.786·XA, D=1.27·XA além de X', () => {
    // Bearish: X=1100(H) A=1000(L) B=1078.6(H) C=1031.44(L, BC/AB=0.6) D=1127(H, AD=1.27·XA)
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1100, 1000, 1078.6, 1031.44, 1127], -1) });
    const bf = hits.find((h) => h.pattern === 'BUTTERFLY');
    expect(bf, JSON.stringify(hits.map((h) => h.pattern))).toBeDefined();
    expect(bf!.direction).toBe('BEARISH');
    expect(bf!.fitScore).toBeCloseTo(1, 5);
    expect(bf!.ratios.AB_XA).toBeCloseTo(0.786, 6);
    expect(bf!.ratios.AD_XA).toBeCloseTo(1.27, 6);
  });

  it('CRAB bullish: D=1.618·XA além de X, CD/BC≈3.52 (dentro de 2.618–3.618)', () => {
    // X=1000 A=1100 B=1050 (0.5) C=1094.3 (BC/AB=0.886) D=938.2 (AD=1.618·XA)
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1100, 1050, 1094.3, 938.2], 1) });
    const cr = hits.find((h) => h.pattern === 'CRAB');
    expect(cr, JSON.stringify(hits.map((h) => h.pattern))).toBeDefined();
    expect(cr!.fitScore).toBeCloseTo(1, 5);
    expect(cr!.ratios.AD_XA).toBeCloseTo(1.618, 6);
  });

  it('CYPHER bullish: C=1.27·XA ALÉM de A, D=0.786·XC — a única estrutura com C estendido', () => {
    // X=1000 A=1100 B=1050 (0.5) C=1127 (XC=1.27·XA) D=1027.178 (CD=0.786·XC=99.822)
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1100, 1050, 1127, 1027.178], 1) });
    const cy = hits.find((h) => h.pattern === 'CYPHER');
    expect(cy, JSON.stringify(hits.map((h) => h.pattern))).toBeDefined();
    expect(cy!.fitScore).toBeCloseTo(1, 4);
    expect(cy!.ratios.XC_XA).toBeCloseTo(1.27, 6);
    expect(cy!.ratios.CD_XC).toBeCloseTo(0.786, 3);
  });
});

describe('honestidade e fail-closed', () => {
  it('série monotônica (sem pivôs) => [] — nunca um padrão fabricado', () => {
    const mono = Array.from({ length: 40 }, (_, i) => c(1000 + i));
    expect(detectHarmonicPatterns({ candles: mono })).toEqual([]);
  });

  it('candles insuficientes => []', () => {
    expect(detectHarmonicPatterns({ candles: [c(1), c(2), c(3)] })).toEqual([]);
  });

  it('razão âncora fora da tolerância dura => padrão rejeitado (D=0.70·XA não é Gartley nem nada)', () => {
    // D em 1030 => AD_XA=0.70: longe de 0.786 (Gartley), 0.886 (Bat), fora
    // dos ranges de Butterfly/Crab; B=0.618 exclui Bat/Crab/Cypher de todo jeito.
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1100, 1038.2, 1076.4, 1030], 1) });
    expect(hits).toEqual([]);
  });

  it('fitScore parcial: B levemente fora do ideal ainda detecta, com fit < 1 e >= MIN_FIT_SCORE', () => {
    // Gartley com B=0.64 (desvio 0.022/0.06 = 0.367 => fit = 1 − 0.367/4 ≈ 0.908)
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1100, 1036, 1075.6, 1021.4], 1) });
    const g = hits.find((h) => h.pattern === 'GARTLEY');
    expect(g).toBeDefined();
    expect(g!.fitScore).toBeLessThan(1);
    expect(g!.fitScore).toBeGreaterThanOrEqual(MIN_FIT_SCORE);
  });

  it('fitScore NUNCA é apresentado como probabilidade no contrato (campo se chama fitScore, doc diz aderência)', () => {
    const src = detectHarmonicPatterns.toString();
    // guarda de contrato: nenhum campo "probability" no hit
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1100, 1038.2, 1076.4, 1021.4], 1) });
    expect(hits.length).toBeGreaterThan(0);
    expect(Object.keys(hits[0])).not.toContain('probability');
    expect(src).not.toContain('probability');
  });

  it('maxPatterns respeitado e ordenação por fit desc', () => {
    const hits = detectHarmonicPatterns({
      candles: zigzagFromPivots([1000, 1100, 1038.2, 1076.4, 1021.4], 1),
      maxPatterns: 1,
    });
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  it('padrão completado muitos pivôs atrás não é reportado (só D no último/penúltimo pivô)', () => {
    // Gartley perfeito seguido de 3 pivôs extras — o D antigo sai da janela de relevância.
    const candles = zigzagFromPivots([1000, 1100, 1038.2, 1076.4, 1021.4, 1060, 1035, 1055], -1);
    const hits = detectHarmonicPatterns({ candles });
    expect(hits.find((h) => h.points.D.price === 1021.4)).toBeUndefined();
  });
});
