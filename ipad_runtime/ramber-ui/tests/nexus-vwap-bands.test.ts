// nexus-vwap-bands.test.ts — trava por execução real a matemática de
// VWAP Standard Deviation Bands (banda = VWAP ± k×desvio-padrão ponderado
// por volume, fórmula real pesquisada e confirmada — TradingView/Sierra
// Chart/TrendSpider/MultiCharts documentam a mesma definição). Pura,
// mesmo estilo de nexus-vwap.test.ts (candle helper idêntico).
import { describe, it, expect } from 'vitest';
import { computeVwapBands, latestVwapBands, VWAP_BAND_MULTIPLIER_1, VWAP_BAND_MULTIPLIER_2 } from '../src/nexus/vwap-bands';
import type { VwapCandle } from '../src/nexus/vwap';

const DAY = 86400;
const dayStart = 20 * DAY;

const candle = (offsetSec: number, high: number, low: number, close: number, volume: number): VwapCandle => ({
  time: dayStart + offsetSec,
  high,
  low,
  close,
  volume,
});

describe('computeVwapBands: desvio-padrão real ponderado por volume, fórmula pesquisada e confirmada', () => {
  it('entrada vazia devolve [] honesto — nunca uma banda fabricada sem VWAP real por trás', () => {
    expect(computeVwapBands([])).toEqual([]);
  });

  it('um único candle real: variância é zero — bandas colapsam exatamente na VWAP (upper1 === lower1 === vwap)', () => {
    const c = candle(0, 110, 90, 100, 50);
    const points = computeVwapBands([c]);
    expect(points).toHaveLength(1);
    const p = points[0];
    expect(p.vwap).toBeCloseTo((110 + 90 + 100) / 3, 8);
    expect(p.upper1).toBeCloseTo(p.vwap, 8);
    expect(p.lower1).toBeCloseTo(p.vwap, 8);
    expect(p.upper2).toBeCloseTo(p.vwap, 8);
    expect(p.lower2).toBeCloseTo(p.vwap, 8);
  });

  it('duas leituras reais: desvio-padrão ponderado por volume bate com o cálculo manual (VWAP=175, stdDev=25√3≈43.301)', () => {
    // typicalPrice/volume: c1 = 100/10, c2 = 200/30 (H=L=C, typicalPrice = close).
    // VWAP cumulativo em c2 = (100*10 + 200*30)/40 = 175 (mesmo cálculo de nexus-vwap.test.ts).
    // variância = Σ(vol*typicalPrice²)/Σvol − VWAP² = (100²*10 + 200²*30)/40 − 175²
    //           = (100000 + 1200000)/40 − 30625 = 32500 − 30625 = 1875 = 625*3
    // stdDev = sqrt(1875) = 25*sqrt(3) ≈ 43.30127018922193
    const c1 = candle(0, 100, 100, 100, 10);
    const c2 = candle(900, 200, 200, 200, 30);
    const points = computeVwapBands([c1, c2]);
    expect(points).toHaveLength(2);

    expect(points[0].vwap).toBeCloseTo(100, 8);
    expect(points[0].upper1).toBeCloseTo(100, 8); // stdDev=0 num único ponto

    const expectedStdDev = 25 * Math.sqrt(3);
    const p2 = points[1];
    expect(p2.vwap).toBeCloseTo(175, 8);
    expect(p2.upper1).toBeCloseTo(175 + VWAP_BAND_MULTIPLIER_1 * expectedStdDev, 6);
    expect(p2.lower1).toBeCloseTo(175 - VWAP_BAND_MULTIPLIER_1 * expectedStdDev, 6);
    expect(p2.upper2).toBeCloseTo(175 + VWAP_BAND_MULTIPLIER_2 * expectedStdDev, 6);
    expect(p2.lower2).toBeCloseTo(175 - VWAP_BAND_MULTIPLIER_2 * expectedStdDev, 6);
  });

  it('banda 2σ é sempre mais larga que a banda 1σ (mesma direção real, nunca invertida)', () => {
    const points = computeVwapBands([candle(0, 100, 100, 100, 10), candle(900, 300, 300, 300, 40)]);
    const p = points[points.length - 1];
    expect(p.upper2).toBeGreaterThan(p.upper1);
    expect(p.lower2).toBeLessThan(p.lower1);
  });

  it('candle de um dia UTC anterior nunca entra na variância (mesmo reset real de sessão da VWAP)', () => {
    const yesterday = candle(-DAY + 100, 1000, 1000, 1000, 999);
    const today1 = candle(0, 100, 100, 100, 10);
    const today2 = candle(900, 200, 200, 200, 30);
    const points = computeVwapBands([yesterday, today1, today2]);
    expect(points).toHaveLength(2); // yesterday excluído por completo, mesmo comportamento de computeSessionVwapSeries
    expect(points[1].vwap).toBeCloseTo(175, 8);
  });

  it('candle com volume zero/negativo ou OHLC inválido é pulado — mesmo filtro fail-closed da VWAP', () => {
    const zero = candle(0, 100, 100, 100, 0);
    const real = candle(900, 100, 100, 100, 10);
    const points = computeVwapBands([zero, real]);
    expect(points).toHaveLength(1);
    expect(points[0].time).toBe(real.time);
  });
});

describe('latestVwapBands: só o ponto mais recente', () => {
  it('devolve null para série vazia — nunca um valor fabricado ou obsoleto', () => {
    expect(latestVwapBands([])).toBeNull();
  });

  it('devolve o último ponto real da série', () => {
    const points = computeVwapBands([candle(0, 100, 100, 100, 10), candle(900, 200, 200, 200, 30)]);
    const latest = latestVwapBands(points);
    expect(latest).not.toBeNull();
    expect(latest!.time).toBe(points[1].time);
    expect(latest!.vwap).toBeCloseTo(175, 8);
  });
});
