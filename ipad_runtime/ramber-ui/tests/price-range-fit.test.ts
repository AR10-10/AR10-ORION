// price-range-fit.test.ts — Evolução Final §5 ("Enquadramento Automático"):
// execução REAL do núcleo puro compartilhado (nexus/price-range-fit.ts)
// entre o Smart Auto-Fit do gráfico ao vivo e o mini-gráfico de exportação.
// publication-render.test.ts já cobre o comportamento via
// computeChartPriceRange (candles reais); este arquivo testa a função
// compartilhada diretamente, incluindo o caso paddingRatio:0 (uso real do
// gráfico ao vivo, nunca exercitado pelos testes de publication/).
import { describe, it, expect } from 'vitest';
import { computeAutoFitPriceRange, isFiniteNum } from '../src/nexus/price-range-fit';

describe('computeAutoFitPriceRange: núcleo puro do Smart Auto-Fit', () => {
  it('sem nenhum nível real: devolve a faixa base intacta (paddingRatio padrão = 0)', () => {
    const range = computeAutoFitPriceRange(
      { min: 100, max: 110 },
      { entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [], livePrice: null },
    );
    expect(range).toEqual({ min: 100, max: 110 });
  });

  it('Entry/Stop/preço vivo fora da faixa base sempre esticam (nunca cortados de fora do quadro)', () => {
    const range = computeAutoFitPriceRange(
      { min: 100, max: 110 },
      { entryLow: 95, entryHigh: 96, stopPrice: 90, targetPrices: [], livePrice: 115 },
    );
    expect(range.min).toBeLessThanOrEqual(90);
    expect(range.max).toBeGreaterThanOrEqual(115);
  });

  it('alvo dentro do teto (4x por padrão) estica; alvo muito distante fica de fora', () => {
    const near = computeAutoFitPriceRange(
      { min: 100, max: 110 },
      { entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [130], livePrice: null },
    );
    expect(near.max).toBeGreaterThanOrEqual(130);

    const far = computeAutoFitPriceRange(
      { min: 100, max: 110 },
      { entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [10_000], livePrice: null },
    );
    expect(far.max).toBe(110);
  });

  it('targetCapMultiplier customizado muda o teto real (gráfico ao vivo pode pedir outro múltiplo no futuro)', () => {
    const tight = computeAutoFitPriceRange(
      { min: 100, max: 110 },
      { entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [130], livePrice: null },
      { targetCapMultiplier: 1 },
    );
    expect(tight.max).toBe(110); // teto de 1x (amplitude 10) não cobre um alvo a +20

    const loose = computeAutoFitPriceRange(
      { min: 100, max: 110 },
      { entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [130], livePrice: null },
      { targetCapMultiplier: 3 },
    );
    expect(loose.max).toBeGreaterThanOrEqual(130); // teto de 3x (amplitude 30) cobre
  });

  it('paddingRatio > 0 aplica padding real (uso do mini-gráfico de exportação, não do gráfico ao vivo)', () => {
    const withoutPad = computeAutoFitPriceRange(
      { min: 100, max: 110 },
      { entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [], livePrice: null },
    );
    const withPad = computeAutoFitPriceRange(
      { min: 100, max: 110 },
      { entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [], livePrice: null },
      { paddingRatio: 0.08 },
    );
    expect(withPad.min).toBeLessThan(withoutPad.min);
    expect(withPad.max).toBeGreaterThan(withoutPad.max);
  });

  it('paddingRatio 0 explícito (gráfico ao vivo): nunca soma padding — scaleMargins nativo da lib cuida disso', () => {
    const range = computeAutoFitPriceRange(
      { min: 100, max: 110 },
      { entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [], livePrice: null },
      { paddingRatio: 0 },
    );
    expect(range).toEqual({ min: 100, max: 110 });
  });
});

describe('isFiniteNum: guarda fail-closed reusada pelo mini-gráfico e pelo Smart Auto-Fit', () => {
  it('aceita apenas number finito', () => {
    expect(isFiniteNum(42)).toBe(true);
    expect(isFiniteNum(0)).toBe(true);
    expect(isFiniteNum(-1.5)).toBe(true);
  });
  it('rejeita null/undefined/NaN/Infinity/string', () => {
    expect(isFiniteNum(null)).toBe(false);
    expect(isFiniteNum(undefined)).toBe(false);
    expect(isFiniteNum(NaN)).toBe(false);
    expect(isFiniteNum(Infinity)).toBe(false);
    expect(isFiniteNum('42')).toBe(false);
  });
});
