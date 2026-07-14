// nexus-live-candle-sync.test.ts — correção de latência (barra superior ↔
// gráfico): trava as regras fail-closed do patch cirúrgico da vela em
// formação. Lógica pura, sem lightweight-charts nem DOM.
import { describe, it, expect } from 'vitest';
import { currentBarStart, patchLastCandleWithLiveTick } from '../src/nexus/live-candle-sync';
import type { Candle } from '../src/nexus/types';

describe('currentBarStart: alinhamento UTC real por timeframe', () => {
  it('15m: arredonda para baixo ao múltiplo de 900s', () => {
    expect(currentBarStart(1_000, '15m')).toBe(900);
    expect(currentBarStart(899, '15m')).toBe(0);
    expect(currentBarStart(900, '15m')).toBe(900);
    expect(currentBarStart(1_799, '15m')).toBe(900);
  });

  it('1h: arredonda para baixo ao múltiplo de 3600s', () => {
    expect(currentBarStart(3_599, '1h')).toBe(0);
    expect(currentBarStart(3_600, '1h')).toBe(3_600);
  });

  it('1m: cada minuto real é o próprio bucket', () => {
    expect(currentBarStart(125, '1m')).toBe(120);
  });
});

const BASE: Candle = { time: 900, open: 100, high: 105, low: 98, close: 102 };
const NOW_MS = 900_000 + 30_000; // dentro do bucket [900, 1800) do timeframe 15m

describe('patchLastCandleWithLiveTick: funde o último preço real na vela em formação, nunca fabrica uma vela nova', () => {
  it('preço real dentro do range atualiza só o close — high/low intactos', () => {
    const patched = patchLastCandleWithLiveTick(BASE, '15m', 101, NOW_MS);
    expect(patched).toEqual({ time: 900, open: 100, high: 105, low: 98, close: 101 });
  });

  it('preço real acima do high conhecido estende o high — nunca perde o teto anterior', () => {
    const patched = patchLastCandleWithLiveTick(BASE, '15m', 110, NOW_MS);
    expect(patched).toEqual({ time: 900, open: 100, high: 110, low: 98, close: 110 });
  });

  it('preço real abaixo do low conhecido estende o low', () => {
    const patched = patchLastCandleWithLiveTick(BASE, '15m', 90, NOW_MS);
    expect(patched).toEqual({ time: 900, open: 100, high: 105, low: 90, close: 90 });
  });

  it('open real da vela NUNCA é tocado pelo patch (só REST/kline abre uma vela)', () => {
    const patched = patchLastCandleWithLiveTick(BASE, '15m', 999, NOW_MS);
    expect(patched?.open).toBe(BASE.open);
  });

  it('fail-closed: última vela conhecida NÃO é a vela corrente (REST ainda não abriu a nova) — nunca fabrica o open, devolve null', () => {
    // NOW_MS cai no bucket [1800, 2700), mas a última vela conhecida ainda é a de time=900.
    const staleNow = 1_800_000 + 5_000;
    expect(patchLastCandleWithLiveTick(BASE, '15m', 103, staleNow)).toBeNull();
  });

  it('fail-closed: preço não finito nunca produz patch', () => {
    expect(patchLastCandleWithLiveTick(BASE, '15m', NaN, NOW_MS)).toBeNull();
    expect(patchLastCandleWithLiveTick(BASE, '15m', Infinity, NOW_MS)).toBeNull();
  });

  it('zero update espúrio: preço igual ao close e dentro do high/low já registrado devolve null (nada mudou de verdade)', () => {
    expect(patchLastCandleWithLiveTick(BASE, '15m', BASE.close, NOW_MS)).toBeNull();
  });
});
