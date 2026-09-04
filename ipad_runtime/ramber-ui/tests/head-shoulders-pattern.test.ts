// head-shoulders-pattern.test.ts — Carta Branca (Reconhecimento de
// Padrões): execução real do motor de Ombro-Cabeça-Ombro. Mesma técnica
// de fixture de harmonic-patterns.test.ts (zigzag com lead-in/cauda para
// os pivôs fractais confirmarem k=2 nos dois lados).
import { describe, it, expect } from 'vitest';
import {
  detectHeadAndShoulders,
  MIN_HEAD_SHOULDERS_FIT_SCORE,
  HEAD_SHOULDERS_CONTRACT_VERSION,
} from '../src/nexus/head-shoulders-pattern';

const c = (v: number) => ({ high: v, low: v });

// Idêntica à técnica de harmonic-patterns.test.ts: lead-in de 2 candles +
// 5 candles por perna + cauda de 3 candles. tailDirection deve afastar o
// ÚLTIMO pivô na direção que o mantém extremo (+1 se ele é um FUNDO,
// -1 se ele é um TOPO) — a mesma convenção já usada nos testes irmãos.
function zigzagFromPivots(pivots: number[], tailDirection: 1 | -1): Array<{ high: number; low: number }> {
  const out: Array<{ high: number; low: number }> = [];
  const firstStep = Math.abs(pivots[1] - pivots[0]) / 5;
  const leadSign = pivots[1] > pivots[0] ? 1 : -1;
  out.push(c(pivots[0] + leadSign * firstStep * 2), c(pivots[0] + leadSign * firstStep));
  for (let i = 0; i < pivots.length; i++) {
    if (i === 0) {
      out.push(c(pivots[0]));
      continue;
    }
    const from = pivots[i - 1];
    const to = pivots[i];
    for (let step = 1; step <= 5; step++) out.push(c(from + ((to - from) * step) / 5));
  }
  const last = pivots[pivots.length - 1];
  const away = tailDirection * Math.abs(last) * 0.001 || tailDirection;
  out.push(c(last + away), c(last + away * 2), c(last + away * 3));
  return out;
}

describe('detectHeadAndShoulders: REGULAR (3 topos, cabeça mais alta) => BEARISH', () => {
  it('ombros simétricos + neckline flat => fitScore 1.0, neckline extrapolada corretamente', () => {
    // p1=1000(H) p2=950(L) p3=1100(H,cabeça) p4=950(L) p5=1000(H) — neckline
    // flat em 950; ombro1=|1000-950|=50, ombro2=|1000-950|=50 (simetria 1.0).
    const candles = zigzagFromPivots([1000, 950, 1100, 950, 1000], -1);
    const hit = detectHeadAndShoulders({ candles });
    expect(hit, 'nenhum H&S detectado').not.toBeNull();
    expect(hit!.kind).toBe('REGULAR');
    expect(hit!.direction).toBe('BEARISH');
    expect(hit!.contractVersion).toBe(HEAD_SHOULDERS_CONTRACT_VERSION);
    expect(hit!.head.price).toBe(1100);
    expect(hit!.leftShoulder.price).toBe(1000);
    expect(hit!.rightShoulder.price).toBe(1000);
    expect(hit!.shoulderSymmetry).toBeCloseTo(1.0, 6);
    expect(hit!.fitScore).toBeCloseTo(1.0, 6);
    // Neckline flat em 950: extrapolada para o último candle continua 950.
    expect(hit!.necklineAtLastCandle).toBeCloseTo(950, 6);
    expect(hit!.completedAtIndex).toBe(hit!.rightShoulder.index);
  });

  it('neckline inclinada: necklineAtLastCandle é extrapolação linear real dos 2 pontos (nunca a média/o último valor)', () => {
    // neckline sobe de 900 (p2, índice 7) para 960 (p4, índice 17): slope
    // real 6/índice, intercept 858. Ombros escolhidos para medir 150 de
    // altura ACIMA da própria neckline (não do preço bruto): p1=1020 =>
    // necklineAt(2)=870 => altura 150; p5=1140 => necklineAt(22)=990 =>
    // altura 150 (simetria exata). Cabeça 1230 => necklineAt(12)=930 =>
    // altura 300 (> ombros, prominência real exigida).
    const candles = zigzagFromPivots([1020, 900, 1230, 960, 1140], -1);
    const hit = detectHeadAndShoulders({ candles });
    expect(hit).not.toBeNull();
    const expectedSlope = (hit!.neckline2.price - hit!.neckline1.price) / (hit!.neckline2.index - hit!.neckline1.index);
    const expectedValue = hit!.neckline1.price + expectedSlope * (candles.length - 1 - hit!.neckline1.index);
    expect(hit!.necklineAtLastCandle).toBeCloseTo(expectedValue, 6);
    expect(hit!.necklineAtLastCandle).toBeGreaterThan(hit!.neckline2.price); // reta continua subindo além de p4
  });
});

describe('detectHeadAndShoulders: INVERSE (3 fundos, cabeça mais baixa) => BULLISH', () => {
  it('espelho exato do REGULAR: mesma simetria, cabeça mais baixa, direção invertida', () => {
    const candles = zigzagFromPivots([2000, 2050, 1900, 2050, 2000], 1);
    const hit = detectHeadAndShoulders({ candles });
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe('INVERSE');
    expect(hit!.direction).toBe('BULLISH');
    expect(hit!.head.price).toBe(1900);
    expect(hit!.shoulderSymmetry).toBeCloseTo(1.0, 6);
    expect(hit!.fitScore).toBeCloseTo(1.0, 6);
  });
});

describe('detectHeadAndShoulders: fail-closed real (Regra de Ouro 3 — nunca fabrica um padrão)', () => {
  it('ombros muito assimétricos (além da tolerância de 35%) => null honesto', () => {
    // ombro1 = |1000-950| = 50; ombro2 = |1100-950| ... vamos forçar >35%
    // de desvio: p5 bem mais alto que p1 (ombro2 = |1150-950|=200, razão 4x).
    const candles = zigzagFromPivots([1000, 950, 1300, 950, 1150], -1);
    expect(detectHeadAndShoulders({ candles })).toBeNull();
  });

  it('cabeça NÃO mais extrema que um dos ombros (não é H&S de verdade) => null', () => {
    // p3 (pretendida cabeça) mais baixa que p1 — geometria não é H&S.
    const candles = zigzagFromPivots([1000, 950, 990, 950, 1000], -1);
    expect(detectHeadAndShoulders({ candles })).toBeNull();
  });

  it('amostra insuficiente (< 9 candles) => null sem tentar detectar', () => {
    expect(detectHeadAndShoulders({ candles: [c(100), c(101), c(99)] })).toBeNull();
  });

  it('MIN_HEAD_SHOULDERS_FIT_SCORE é o piso real documentado (0.75, mesmo padrão de MIN_FIT_SCORE harmônico)', () => {
    expect(MIN_HEAD_SHOULDERS_FIT_SCORE).toBe(0.75);
  });
});
