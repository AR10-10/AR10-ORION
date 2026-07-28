// macd.test.ts — execução real de nexus/macd.ts. Mesma disciplina de
// tests/ema.test.ts: matemática pura contra uma referência independente
// em CADA ponto, não só no final.
import { describe, it, expect } from 'vitest';
import { computeMacdSeries, latestMacd, MACD_FAST_PERIOD, MACD_SLOW_PERIOD, MACD_SIGNAL_PERIOD, type MacdPoint } from '../src/nexus/macd';
import type { EmaCandle } from '../src/nexus/ema';

function refEma(values: number[], p: number): number[] {
  const k = 2 / (p + 1);
  let e = values[0];
  const out = [e];
  for (let i = 1; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

function refMacd(closes: number[], fast: number, slow: number, signal: number) {
  const fastSeries = refEma(closes, fast);
  const slowSeries = refEma(closes, slow);
  const macdLine = fastSeries.map((f, i) => f - slowSeries[i]);
  const signalSeries = refEma(macdLine, signal);
  return macdLine.map((m, i) => ({ macd: m, signal: signalSeries[i], histogram: m - signalSeries[i] }));
}

const CLOSES = Array.from({ length: 80 }, (_, i) => 50_000 + 150 * Math.sin(i / 4) + 9 * i);
const candles: EmaCandle[] = CLOSES.map((close, i) => ({ time: 1_700_000_000 + i * 900, close }));

describe('computeMacdSeries: bate com referência independente em todo ponto, reusa EMA duas vezes', () => {
  it('macd/signal/histogram batem com a referência ponto a ponto, tempo preservado', () => {
    const series = computeMacdSeries(candles);
    const ref = refMacd(CLOSES, MACD_FAST_PERIOD, MACD_SLOW_PERIOD, MACD_SIGNAL_PERIOD);
    expect(series).toHaveLength(candles.length);
    for (let i = 0; i < series.length; i++) {
      expect(series[i].time).toBe(candles[i].time);
      expect(series[i].macd).toBeCloseTo(ref[i].macd, 8);
      expect(series[i].signal).toBeCloseTo(ref[i].signal, 8);
      expect(series[i].histogram).toBeCloseTo(ref[i].histogram, 8);
    }
  });

  it('histograma = macd - signal exatamente, em todo ponto real', () => {
    const series = computeMacdSeries(candles);
    for (const p of series) expect(p.histogram).toBeCloseTo(p.macd - p.signal, 12);
  });

  it('períodos customizados também batem com a referência', () => {
    const series = computeMacdSeries(candles, 5, 13, 4);
    const ref = refMacd(CLOSES, 5, 13, 4);
    expect(series[series.length - 1].macd).toBeCloseTo(ref[ref.length - 1].macd, 8);
    expect(series[series.length - 1].signal).toBeCloseTo(ref[ref.length - 1].signal, 8);
  });

  it('série de close CONSTANTE => EMA rápida = EMA lenta = sinal, macd/histograma exatamente 0', () => {
    const flat: EmaCandle[] = Array.from({ length: 40 }, (_, i) => ({ time: i, close: 200 }));
    const series = computeMacdSeries(flat);
    for (const p of series) {
      expect(p.macd).toBeCloseTo(0, 10);
      expect(p.signal).toBeCloseTo(0, 10);
      expect(p.histogram).toBeCloseTo(0, 10);
    }
  });

  it('FAIL_CLOSED: período rápido ou lento inválido => série vazia, nunca um ponto fabricado', () => {
    expect(computeMacdSeries(candles, 0, 26, 9)).toEqual([]);
    expect(computeMacdSeries(candles, 12, -1, 9)).toEqual([]);
    expect(computeMacdSeries(candles, NaN, 26, 9)).toEqual([]);
  });

  it('histórico vazio => série vazia', () => {
    expect(computeMacdSeries([], 12, 26, 9)).toEqual([]);
  });
});

describe('latestMacd: última leitura real, ou null honesto sem série', () => {
  it('devolve o último ponto real', () => {
    const series = computeMacdSeries(candles);
    expect(latestMacd(series)).toEqual(series[series.length - 1]);
  });

  it('série vazia => null, nunca um ponto fabricado', () => {
    expect(latestMacd([] as MacdPoint[])).toBeNull();
  });
});

describe('Constantes: padrão universal da indústria (Gerald Appel 1979)', () => {
  it('12/26/9, não uma escolha arbitrária deste repositório', () => {
    expect(MACD_FAST_PERIOD).toBe(12);
    expect(MACD_SLOW_PERIOD).toBe(26);
    expect(MACD_SIGNAL_PERIOD).toBe(9);
  });
});
