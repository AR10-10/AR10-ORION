// nexus-fibonacci-confluence.test.ts — V-MAX Fase 1.4: trava a Matriz de
// Confluência Fibonacci (retração real da perna + cruzamento transversal
// contra fontes reais). Lógica pura, sem rede/DOM.
import { describe, it, expect } from 'vitest';
import {
  computeFibRetracements,
  buildFibonacciConfluence,
  FIB_RETRACEMENT_RATIOS,
  type ConfluenceSource,
} from '../src/nexus/fibonacci-confluence';

const point = (kind: string, price: number): ConfluenceSource => ({ kind, priceLow: price, priceHigh: price });
const zone = (kind: string, low: number, high: number): ConfluenceSource => ({ kind, priceLow: low, priceHigh: high });

describe('computeFibRetracements: perna de alta retraciona DESCENDO do high; perna de baixa SUBINDO do low', () => {
  it('perna de ALTA [100→200]: 38.2% = 161.8, 61.8% = 138.2', () => {
    const levels = computeFibRetracements(100, 200, true);
    const at = (r: number) => levels.find((l) => l.ratio === r)!.price;
    expect(at(0.382)).toBeCloseTo(161.8, 10);
    expect(at(0.5)).toBeCloseTo(150, 10);
    expect(at(0.618)).toBeCloseTo(138.2, 10);
  });

  it('perna de BAIXA [200→100]: 38.2% = 138.2, 61.8% = 161.8 (espelho real)', () => {
    const levels = computeFibRetracements(100, 200, false);
    const at = (r: number) => levels.find((l) => l.ratio === r)!.price;
    expect(at(0.382)).toBeCloseTo(138.2, 10);
    expect(at(0.618)).toBeCloseTo(161.8, 10);
  });

  it('sempre os 5 ratios padrão, em ordem ascendente fixa', () => {
    const levels = computeFibRetracements(100, 200, true);
    expect(levels.map((l) => l.ratio)).toEqual([...FIB_RETRACEMENT_RATIOS]);
  });
});

describe('buildFibonacciConfluence: FAIL_CLOSED em perna inválida, score 0 honesto sem fontes', () => {
  it('perna inválida (range zero/negativo, não-finito) => null, nunca níveis chutados', () => {
    expect(buildFibonacciConfluence(100, 100, true, [])).toBeNull();
    expect(buildFibonacciConfluence(200, 100, true, [])).toBeNull();
    expect(buildFibonacciConfluence(Number.NaN, 200, true, [])).toBeNull();
  });

  it('sem nenhuma fonte, a matriz sai com níveis reais e score 0 em todos — ausência real de confluência', () => {
    const m = buildFibonacciConfluence(100, 200, true, [])!;
    expect(m).not.toBeNull();
    expect(m.levels).toHaveLength(FIB_RETRACEMENT_RATIOS.length);
    m.levels.forEach((l) => {
      expect(l.score).toBe(0);
      expect(l.matches).toEqual([]);
    });
  });

  it('fonte inválida (NaN, faixa invertida) é descartada em vez de corromper o score', () => {
    const m = buildFibonacciConfluence(100, 200, true, [
      point('SR_SUPPORT_1', Number.NaN),
      zone('FVG_BULLISH', 150, 140), // faixa invertida: high < low
    ])!;
    m.levels.forEach((l) => expect(l.score).toBe(0));
  });
});

describe('buildFibonacciConfluence: cruzamento real por janela proporcional à perna (2%)', () => {
  it('fonte pontual exatamente no nível 50% marca confluência', () => {
    const m = buildFibonacciConfluence(100, 200, true, [point('VP_POC', 150)])!;
    const l50 = m.levels.find((l) => l.ratio === 0.5)!;
    expect(l50.score).toBe(1);
    expect(l50.matches[0].kind).toBe('VP_POC');
  });

  it('fonte dentro da janela (±2% da perna = ±2.0 nesta perna de 100) conta; fora não conta', () => {
    const inside = buildFibonacciConfluence(100, 200, true, [point('SR_SUPPORT_1', 151.9)])!;
    expect(inside.levels.find((l) => l.ratio === 0.5)!.score).toBe(1);
    const outside = buildFibonacciConfluence(100, 200, true, [point('SR_SUPPORT_1', 152.1)])!;
    expect(outside.levels.find((l) => l.ratio === 0.5)!.score).toBe(0);
  });

  it('zona (FVG/OB) conta quando o nível cai DENTRO da faixa real dela', () => {
    const m = buildFibonacciConfluence(100, 200, true, [zone('OB_BULLISH', 148, 155)])!;
    expect(m.levels.find((l) => l.ratio === 0.5)!.score).toBe(1);
  });

  it('uma zona é UMA fonte — nunca conta duas vezes pelo mesmo nível', () => {
    const m = buildFibonacciConfluence(100, 200, true, [zone('FVG_BULLISH', 130, 165)])!;
    // A zona cobre 38.2/50/61.8 — cada nível marca 1 (a mesma zona), nunca 2+.
    const l50 = m.levels.find((l) => l.ratio === 0.5)!;
    expect(l50.score).toBe(1);
  });

  it('múltiplas fontes independentes somam score real', () => {
    const m = buildFibonacciConfluence(100, 200, true, [
      point('VP_POC', 149.5),
      point('SR_SUPPORT_1', 150.5),
      zone('OB_BULLISH', 147, 152),
      point('EQH', 190), // longe do 50% — não conta nele
    ])!;
    const l50 = m.levels.find((l) => l.ratio === 0.5)!;
    expect(l50.score).toBe(3);
    expect(l50.matches.map((s) => s.kind).sort()).toEqual(['OB_BULLISH', 'SR_SUPPORT_1', 'VP_POC']);
  });

  it('a tolerância real usada é publicada na matriz (para a UI exibir a janela)', () => {
    const m = buildFibonacciConfluence(100, 200, true, [])!;
    expect(m.toleranceAbs).toBeCloseTo(2.0, 10); // 2% da perna de 100
  });
});
