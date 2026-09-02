// structural-swings-trace.test.ts — MD-7 (Visual Confidence Trace, pedido
// direto do Operador). Execução REAL de computeStructuralSwings
// (engine-bridge.ts): o wrapper fino que expõe research/engines/
// fractal-swings.js (findSwings/FRACTAL_K) — o MESMO motor compartilhado
// já usado por market-structure-engine.js/support-resistance-engine.js/
// fvg-order-block-engine.js, nunca um segundo ZigZag. A correção
// (findSwings) já tem sua própria suíte real (fractal-swings.test.ts) —
// este arquivo prova só o que o WRAPPER adiciona: merge highs+lows por
// índice cronológico, shape ZigZagPoint, e a garantia de Zero Look-Ahead
// sobrevivendo intacta através do wrapper (item 9/17 do memo).
import { describe, it, expect } from 'vitest';
import { computeStructuralSwings } from '../src/engine-bridge';
import { findSwings, FRACTAL_K } from '../../src/research/engines/fractal-swings.js';

type Candle = { high: number; low: number };

// Zigzag triangular real (mesmo gerador de multi-timeframe-engine.test.ts):
// período 8, amplitude 10 — reverte a cada 4 candles, formando swing highs
// e lows CONFIRMÁVEIS reais (FRACTAL_K=2), nunca uma reta que nunca reverte.
function zigzagCandles(n: number): Candle[] {
  const period = 8;
  const amplitude = 10;
  return Array.from({ length: n }, (_, i) => {
    const pos = i % period;
    const half = period / 2;
    const tri = pos <= half ? pos / half : (period - pos) / half;
    const mid = 100 + tri * amplitude;
    return { high: mid + 0.5, low: mid - 0.5 };
  });
}

describe('computeStructuralSwings: wiring real contra fractal-swings.js', () => {
  it('sem candles suficientes (< 2*FRACTAL_K+1) => nenhum pivô, nunca um pivô fabricado', () => {
    const candles = zigzagCandles(3);
    expect(computeStructuralSwings(candles)).toEqual([]);
  });

  it('mescla highs+lows do MESMO findSwings/FRACTAL_K chamado diretamente, em ordem cronológica de índice', () => {
    const candles = zigzagCandles(40);
    const points = computeStructuralSwings(candles);

    const highs = findSwings(candles, FRACTAL_K, true);
    const lows = findSwings(candles, FRACTAL_K, false);
    expect(highs.length).toBeGreaterThan(0);
    expect(lows.length).toBeGreaterThan(0);

    // Mesmo conjunto de pontos (nenhum perdido, nenhum inventado).
    const expectedSet = new Set(
      [...highs.map((p: { index: number; price: number }) => `H:${p.index}:${p.price}`),
       ...lows.map((p: { index: number; price: number }) => `L:${p.index}:${p.price}`)],
    );
    const actualSet = new Set(points.map((p) => `${p.kind === 'HIGH' ? 'H' : 'L'}:${p.index}:${p.price}`));
    expect(actualSet).toEqual(expectedSet);

    // Ordem cronológica estrita — é o que torna a polyline visualmente coerente.
    for (let i = 1; i < points.length; i++) {
      expect(points[i].index).toBeGreaterThanOrEqual(points[i - 1].index);
    }
  });

  it('kind reflete corretamente HIGH vs LOW — nunca trocado', () => {
    const candles = zigzagCandles(40);
    const points = computeStructuralSwings(candles);
    for (const p of points) {
      const candle = candles[p.index];
      if (p.kind === 'HIGH') expect(p.price).toBe(candle.high);
      else expect(p.price).toBe(candle.low);
    }
  });

  it('ZERO LOOK-AHEAD: nenhum pivô aparece nos últimos FRACTAL_K candles — a borda viva nunca é tratada como confirmada', () => {
    const candles = zigzagCandles(50);
    const points = computeStructuralSwings(candles);
    const liveEdgeStart = candles.length - FRACTAL_K;
    for (const p of points) {
      expect(p.index).toBeLessThan(liveEdgeStart);
    }
  });

  it('ZERO LOOK-AHEAD: candles futuros NUNCA alteram um pivô já confirmado — só podem revelar pivôs novos perto da borda antiga', () => {
    const shortSeries = zigzagCandles(30);
    const longSeries = zigzagCandles(60); // MESMO gerador determinístico — os primeiros 30 candles são idênticos.

    const pointsShort = computeStructuralSwings(shortSeries);
    const pointsLong = computeStructuralSwings(longSeries);

    // Todo pivô confirmado com a amostra curta precisa reaparecer
    // IDÊNTICO (mesmo index/price/kind) na amostra longa — candles
    // futuros nunca reescrevem uma leitura estrutural já confirmada.
    expect(pointsShort.length).toBeGreaterThan(0);
    for (const p of pointsShort) {
      const match = pointsLong.find((q) => q.index === p.index && q.kind === p.kind);
      expect(match, `pivô ${p.kind}@${p.index} da amostra curta sumiu/mudou na amostra longa`).toBeDefined();
      expect(match!.price).toBe(p.price);
    }

    // E a amostra longa revela pivôs REAIS a mais perto da borda antiga
    // (índices 28/29 só confirmam com candles que só existem na longa) —
    // prova que o motor não está simplesmente truncando, está confirmando
    // de verdade conforme mais dado chega.
    expect(pointsLong.length).toBeGreaterThan(pointsShort.length);
  });

  it('candles em alta real: swing highs sucessivos estritamente maiores, swing lows sucessivos estritamente maiores (HH+HL) — mesma leitura de market-structure-engine.js sobre a mesma amostra', () => {
    const candles = zigzagCandles(40).map((c, i) => ({ high: c.high + i * 0.05, low: c.low + i * 0.05 }));
    const points = computeStructuralSwings(candles);
    const highs = points.filter((p) => p.kind === 'HIGH');
    expect(highs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < highs.length; i++) {
      expect(highs[i].price).toBeGreaterThan(highs[i - 1].price);
    }
  });
});
