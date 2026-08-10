// order-book-depth.test.ts — execução REAL das derivações puras sobre o
// livro de ofertas já ao vivo (Entrega 40).
import { describe, it, expect } from 'vitest';
import { detectWalls, computeBidAskRatio, computeImbalance, WALL_VOLUME_MULTIPLIER } from '../src/nexus/order-book-depth';
import type { OrderBookLevel } from '../src/store/unified-snapshot-store';

function level(price: number, size: number): OrderBookLevel {
  return { price, size };
}

describe('order-book-depth: detectWalls', () => {
  it('array vazio => []', () => {
    expect(detectWalls([])).toEqual([]);
  });

  it('1 único nível (sem "demais" reais para comparar) => [false], nunca wall fabricada', () => {
    expect(detectWalls([level(100, 50)])).toEqual([false]);
  });

  it('todos os níveis do mesmo tamanho => nenhuma wall (sem outlier real)', () => {
    expect(detectWalls([level(100, 10), level(99, 10), level(98, 10)])).toEqual([false, false, false]);
  });

  it('1 nível real >2x a média dos demais => essa posição marcada wall, as outras não', () => {
    // demais (10, 10) → média 10; 30 > 2*10 → wall real.
    const walls = detectWalls([level(100, 30), level(99, 10), level(98, 10)]);
    expect(walls).toEqual([true, false, false]);
  });

  it('multiplier customizado muda o limiar real', () => {
    // demais média 10; 15 não é >2x10 mas é >1x10.
    const levels = [level(100, 15), level(99, 10), level(98, 10)];
    expect(detectWalls(levels, WALL_VOLUME_MULTIPLIER)).toEqual([false, false, false]);
    expect(detectWalls(levels, 1)).toEqual([true, false, false]);
  });
});

describe('order-book-depth: computeBidAskRatio', () => {
  it('bids ou asks vazios => null, nunca Infinity/NaN disfarçado', () => {
    expect(computeBidAskRatio([], [level(100, 5)])).toBeNull();
    expect(computeBidAskRatio([level(100, 5)], [])).toBeNull();
    expect(computeBidAskRatio([], [])).toBeNull();
  });

  it('volumes iguais => ratio 1', () => {
    expect(computeBidAskRatio([level(100, 10), level(99, 10)], [level(101, 15), level(102, 5)])).toBe(1);
  });

  it('bids dominantes => ratio real > 1', () => {
    const r = computeBidAskRatio([level(100, 30)], [level(101, 10)]);
    expect(r).toBe(3);
  });
});

describe('order-book-depth: computeImbalance', () => {
  it('ambos os lados vazios => null, nunca 0 fabricado como "equilíbrio"', () => {
    expect(computeImbalance([], [])).toBeNull();
  });

  it('só bids reais (asks vazio, mas total > 0) => +1 honesto, não null', () => {
    expect(computeImbalance([level(100, 10)], [])).toBe(1);
  });

  it('só asks reais => -1 honesto', () => {
    expect(computeImbalance([], [level(100, 10)])).toBe(-1);
  });

  it('volumes iguais => 0 real (equilíbrio genuíno, dado real, não fallback)', () => {
    expect(computeImbalance([level(100, 10)], [level(101, 10)])).toBe(0);
  });

  it('desbalanceado 70/30 => imbalance real de +0.4', () => {
    const r = computeImbalance([level(100, 70)], [level(101, 30)]);
    expect(r).toBeCloseTo(0.4, 10);
  });
});
