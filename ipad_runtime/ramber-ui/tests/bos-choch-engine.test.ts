// bos-choch-engine.test.ts — Ordem "Ciborgue Vivo" §1 (Break of
// Structure / Change of Character): real-execution tests for the new
// engine. Same fixture recipe already proven in
// multi-timeframe-engine.test.ts: a straight monotonic line never forms a
// fractal swing (the neighbor is always higher/lower), so a real zigzag +
// drift is required to get genuine HH+HL/LH+LL structure and, on top of
// that, a genuine break.
import { describe, it, expect } from 'vitest';
import { analyze } from '../../src/research/engines/bos-choch-engine.js';

const T0 = 1_700_000_000;
const STEP = 900; // 15m em segundos, mesma convenção canônica dos outros testes

function candle(i: number, mid: number, spread = 0.5) {
  return { t: T0 + i * STEP, o: mid - spread * 0.4, h: mid + spread, l: mid - spread, c: mid + spread * 0.4, v: 10 };
}

function zigzagTrend(n: number, direction: 1 | -1) {
  const period = 8;
  const amplitude = 10;
  const driftPerCandle = 0.4 * direction;
  return Array.from({ length: n }, (_, i) => {
    const pos = i % period;
    const half = period / 2;
    const tri = pos <= half ? pos / half : (period - pos) / half;
    return candle(i, 100 + tri * amplitude + i * driftPerCandle);
  });
}

describe('bos-choch-engine: fail-closed honesto sem estrutura real por trás', () => {
  it('array vazio => DADOS_INSUFICIENTES (delega o motivo real ao market-structure-engine)', () => {
    const result = analyze({ ohlcv_series: [] });
    expect(result.status).toBe('DADOS_INSUFICIENTES');
    expect(result.reason).toBe('apenas_0_candles_abaixo_do_minimo_15');
  });

  it('candles reais mas sem 2 swing highs/lows confirmados => DADOS_INSUFICIENTES honesto', () => {
    const result = analyze({ ohlcv_series: zigzagTrend(10, 1) });
    expect(result.status).toBe('DADOS_INSUFICIENTES');
  });
});

describe('bos-choch-engine: sem rompimento real ainda (meio da tendência)', () => {
  it('60 candles em zigzag de alta, sem escapar da estrutura => break null honesto', () => {
    const result = analyze({ ohlcv_series: zigzagTrend(60, 1) });
    expect(result.status).toBe('OK');
    expect(result.structure_label).toBe('ESTRUTURA_ALTA');
    expect(result.break).toBeNull();
  });
});

describe('bos-choch-engine: CHOCH real (rompimento CONTRA a estrutura vigente)', () => {
  it('estrutura de alta + fechamento real abaixo do último swing low => CHOCH de baixa', () => {
    const base = zigzagTrend(60, 1);
    const lastMid = 100 + (base.length - 1) * 0.4;
    const plunge = [...base];
    for (let i = 0; i < 5; i++) plunge.push(candle(base.length + i, lastMid - 30 - i * 5, 0.5));

    const result = analyze({ ohlcv_series: plunge });
    expect(result.status).toBe('OK');
    expect(result.structure_label).toBe('ESTRUTURA_ALTA');
    expect(result.break).not.toBeNull();
    expect(result.break!.type).toBe('CHOCH');
    expect(result.break!.direction).toBe('BAIXA');
    expect(result.break!.index).toBe(plunge.length - 1); // o rompimento mais recente, não o primeiro candle da queda
  });

  it('espelho: estrutura de baixa + fechamento real acima do último swing high => CHOCH de alta', () => {
    const base = zigzagTrend(60, -1);
    const lastMid = 100 - (base.length - 1) * 0.4;
    const spike = [...base];
    for (let i = 0; i < 5; i++) spike.push(candle(base.length + i, lastMid + 30 + i * 5, 0.5));

    const result = analyze({ ohlcv_series: spike });
    expect(result.status).toBe('OK');
    expect(result.structure_label).toBe('ESTRUTURA_BAIXA');
    expect(result.break!.type).toBe('CHOCH');
    expect(result.break!.direction).toBe('ALTA');
  });
});

describe('bos-choch-engine: BOS real (rompimento na MESMA direção da estrutura vigente)', () => {
  it('continuação real da tendência de alta rompe o swing high anterior => BOS de alta', () => {
    const result = analyze({ ohlcv_series: zigzagTrend(70, 1) });
    expect(result.status).toBe('OK');
    expect(result.structure_label).toBe('ESTRUTURA_ALTA');
    expect(result.break).not.toBeNull();
    expect(result.break!.type).toBe('BOS');
    expect(result.break!.direction).toBe('ALTA');
  });
});

describe('bos-choch-engine: aceita tanto a forma curta {t,o,h,l,c,v} (Bus) quanto a longa {time,open,high,low,close} (gráfico)', () => {
  it('mesma amostra, duas formas de candle => mesmo resultado real', () => {
    const base = zigzagTrend(60, 1);
    const lastMid = 100 + (base.length - 1) * 0.4;
    const shortShape = [...base];
    for (let i = 0; i < 5; i++) shortShape.push(candle(base.length + i, lastMid - 30 - i * 5, 0.5));

    const longShape = shortShape.map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v }));

    const a = analyze({ ohlcv_series: shortShape });
    const b = analyze({ ohlcv_series: longShape });
    expect(b.break!.type).toBe(a.break!.type);
    expect(b.break!.direction).toBe(a.break!.direction);
    expect(b.break!.level).toBe(a.break!.level);
    expect(b.break!.index).toBe(a.break!.index);
    expect(b.break!.time).toBe(a.break!.time);
  });
});
