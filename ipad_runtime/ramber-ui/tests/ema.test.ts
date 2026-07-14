// ema.test.ts — execução real de nexus/ema.ts (Diretriz Camada de Decisão
// Profissional, item 1). Duas frentes: (1) matemática pura da série contra
// uma referência independente, mesmo padrão de tests/vwap.test.ts; (2)
// PARIDADE real contra o binário WASM de produção (wasm/cyborg_quant_core.
// wasm) — o último ponto da série TEM que bater exatamente com
// wasm.ema(len, period), provando que "EMA" significa a mesma coisa nos
// dois lugares do sistema (ver cabeçalho de nexus/ema.ts para o porquê de
// existir uma implementação em série em vez de reaproveitar o WASM
// diretamente).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { computeEmaSeries, latestEma, EMA_PERIODS, DEFAULT_EMA_PERIOD, type EmaCandle } from '../src/nexus/ema';

const refEma = (v: number[], p: number) => {
  const k = 2 / (p + 1);
  return v.slice(1).reduce((e, x) => x * k + e * (1 - k), v[0]);
};

const CLOSES = Array.from({ length: 64 }, (_, i) => 50_000 + 120 * Math.sin(i / 3) + 7 * i);
const candles: EmaCandle[] = CLOSES.map((close, i) => ({ time: 1_700_000_000 + i * 900, close }));

describe('computeEmaSeries: um ponto por candle, semente no primeiro valor, k = 2/(p+1)', () => {
  it('bate com a referência independente em todo ponto, não só no final', () => {
    const series = computeEmaSeries(candles, 20);
    expect(series).toHaveLength(candles.length);
    for (let i = 0; i < candles.length; i++) {
      expect(series[i].value).toBeCloseTo(refEma(CLOSES.slice(0, i + 1), 20), 10);
      expect(series[i].time).toBe(candles[i].time);
    }
  });

  it('primeiro ponto é exatamente o primeiro close (semente, nunca uma SMA de abertura)', () => {
    const series = computeEmaSeries(candles, 9);
    expect(series[0].value).toBe(CLOSES[0]);
  });

  it('série de close constante => EMA exatamente igual à constante em todo ponto', () => {
    const flat: EmaCandle[] = Array.from({ length: 30 }, (_, i) => ({ time: i, close: 123.45 }));
    const series = computeEmaSeries(flat, 14);
    for (const p of series) expect(p.value).toBeCloseTo(123.45, 12);
  });

  it('FAIL_CLOSED: período <= 0 ou não-finito => série vazia, nunca um chute', () => {
    expect(computeEmaSeries(candles, 0)).toEqual([]);
    expect(computeEmaSeries(candles, -5)).toEqual([]);
    expect(computeEmaSeries(candles, NaN)).toEqual([]);
  });

  it('histórico vazio => série vazia', () => {
    expect(computeEmaSeries([], 21)).toEqual([]);
  });

  it('candle com time/close não-finito é pulado — a recorrência continua a partir do próximo válido', () => {
    const withGap: EmaCandle[] = [
      { time: 1, close: 100 },
      { time: 2, close: NaN },
      { time: 3, close: Infinity },
      { time: NaN, close: 105 },
      { time: 4, close: 102 },
    ];
    const series = computeEmaSeries(withGap, 9);
    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({ time: 1, value: 100 });
    const k = 2 / 10;
    expect(series[1].value).toBeCloseTo(102 * k + 100 * (1 - k), 10);
  });
});

describe('latestEma: último ponto real, ou null honesto sem série', () => {
  it('devolve o valor do último ponto', () => {
    const series = computeEmaSeries(candles, 21);
    expect(latestEma(series)).toBe(series[series.length - 1].value);
  });

  it('série vazia => null, nunca 0 fabricado', () => {
    expect(latestEma([])).toBeNull();
  });
});

describe('EMA_PERIODS / DEFAULT_EMA_PERIOD: contrato exposto ao painel Camadas do Gráfico', () => {
  it('quatro períodos padrão da indústria, 21 como default', () => {
    expect(EMA_PERIODS).toEqual([9, 21, 50, 200]);
    expect(EMA_PERIODS).toContain(DEFAULT_EMA_PERIOD);
    expect(DEFAULT_EMA_PERIOD).toBe(21);
  });
});

// Paridade real contra o binário WASM de produção — mesma série
// determinística de tests/wasm-quant-core.test.ts (sem Math.random,
// reproduzível), instanciando o MESMO .wasm servido em produção.
const wasmPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../wasm/cyborg_quant_core.wasm');
type QuantExports = {
  memory: WebAssembly.Memory;
  buffer_ptr: () => number;
  buffer_capacity: () => number;
  ema: (len: number, period: number) => number;
};
let wasm: QuantExports;

function writeSeries(values: number[]): number {
  const cap = wasm.buffer_capacity();
  const view = new Float64Array(wasm.memory.buffer, wasm.buffer_ptr(), cap);
  const len = Math.min(values.length, cap);
  for (let i = 0; i < len; i++) view[i] = values[i];
  return len;
}

beforeAll(async () => {
  const bytes = readFileSync(wasmPath);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  wasm = instance.exports as unknown as QuantExports;
});

describe('PARIDADE real: último ponto de computeEmaSeries === wasm.ema() no binário de produção', () => {
  it('período 20 e período 9 — mesma leitura escalar do motor real', () => {
    const len = writeSeries(CLOSES);
    const series20 = computeEmaSeries(candles, 20);
    const series9 = computeEmaSeries(candles, 9);
    expect(series20[series20.length - 1].value).toBeCloseTo(wasm.ema(len, 20), 10);
    expect(series9[series9.length - 1].value).toBeCloseTo(wasm.ema(len, 9), 10);
  });
});
