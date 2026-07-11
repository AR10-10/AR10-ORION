// wasm-quant-core.test.ts — Fase G (V15): validação numérica DIRETA do
// binário WASM real do Core Engine (wasm/cyborg_quant_core.wasm — o mesmo
// arquivo servido em produção e carregado por workers/quant-worker.js),
// contra implementações de referência independentes escritas neste teste a
// partir da especificação documentada em wasm-src/cyborg_quant_core/src/
// lib.rs. Primeira vez que o santuário é validado numericamente em CI:
// até esta fase o WASM só era exercitado no navegador.
//
// TRAVA DE GOVERNANÇA (diretriz 2 da Fase G): este arquivo NÃO altera nada
// — ele TRAVA o comportamento consolidado. Se alguém recompilar o WASM com
// semântica diferente (EMA com outra semente, stddev populacional em vez
// de amostral, fail-closed virando chute), estes testes quebram o CI antes
// do deploy.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const wasmPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../wasm/cyborg_quant_core.wasm');

type QuantExports = {
  memory: WebAssembly.Memory;
  buffer_ptr: () => number;
  buffer_capacity: () => number;
  sma: (len: number, window: number) => number;
  ema: (len: number, period: number) => number;
  stddev: (len: number) => number;
  zscore_last: (len: number) => number;
  max_val: (len: number) => number;
  min_val: (len: number) => number;
  volume_profile: (candleCount: number, bucketCount: number) => number;
  trust_score: (gapCount: number, divergenceCount: number) => number;
  engine_version: () => number;
};

let wasm: QuantExports;

function writeSeries(values: number[]): number {
  const cap = wasm.buffer_capacity();
  const view = new Float64Array(wasm.memory.buffer, wasm.buffer_ptr(), cap);
  const len = Math.min(values.length, cap);
  for (let i = 0; i < len; i++) view[i] = values[i];
  return len;
}

// Referências independentes — reimplementadas AQUI a partir da spec do
// lib.rs, nunca importadas do código sob teste.
const refSma = (v: number[], w: number) => v.slice(v.length - w).reduce((a, b) => a + b, 0) / w;
const refEma = (v: number[], p: number) => {
  const k = 2 / (p + 1);
  return v.slice(1).reduce((e, x) => x * k + e * (1 - k), v[0]);
};
const refMean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const refStddevSample = (v: number[]) => {
  const m = refMean(v);
  return Math.sqrt(v.reduce((acc, x) => acc + (x - m) ** 2, 0) / (v.length - 1));
};

// Série determinística não-trivial (sem Math.random — testes reproduzíveis).
const SERIES = Array.from({ length: 64 }, (_, i) => 50_000 + 120 * Math.sin(i / 3) + 7 * i);

beforeAll(async () => {
  const bytes = readFileSync(wasmPath);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  wasm = instance.exports as unknown as QuantExports;
});

describe('wasm-quant-core: identidade e fronteira do binário real de produção', () => {
  it('expõe exatamente a superfície documentada (nenhuma primitiva de ordem/rede/sinal)', () => {
    // __data_end/__heap_base são globals padrão do wasm-ld (artefatos de
    // linker, não API) — filtrados; o que sobra é a superfície funcional.
    const exported = Object.keys(wasm).filter((k) => !k.startsWith('__')).sort();
    expect(exported).toEqual(
      ['buffer_capacity', 'buffer_ptr', 'ema', 'engine_version', 'max_val', 'memory', 'min_val', 'sma', 'stddev', 'trust_score', 'volume_profile', 'zscore_last'].sort(),
    );
  });

  it('capacidade fixa de 8192 e engine_version 1000, como documentado', () => {
    expect(wasm.buffer_capacity()).toBe(8192);
    expect(wasm.engine_version()).toBe(1000);
  });
});

describe('wasm-quant-core: SMA — média dos ÚLTIMOS `window` de `len`', () => {
  it('bate com a referência independente em 10 casas decimais', () => {
    const len = writeSeries(SERIES);
    expect(wasm.sma(len, 20)).toBeCloseTo(refSma(SERIES, 20), 10);
    expect(wasm.sma(len, 5)).toBeCloseTo(refSma(SERIES, 5), 10);
    expect(wasm.sma(len, len)).toBeCloseTo(refMean(SERIES), 10);
  });

  it('FAIL_CLOSED: janela 0, len 0 ou janela > len => NaN, nunca um chute', () => {
    const len = writeSeries(SERIES);
    expect(Number.isNaN(wasm.sma(len, 0))).toBe(true);
    expect(Number.isNaN(wasm.sma(0, 10))).toBe(true);
    expect(Number.isNaN(wasm.sma(len, len + 1))).toBe(true);
  });
});

describe('wasm-quant-core: EMA — semente no primeiro valor, k = 2/(p+1)', () => {
  it('bate com a referência independente em 10 casas decimais', () => {
    const len = writeSeries(SERIES);
    expect(wasm.ema(len, 20)).toBeCloseTo(refEma(SERIES, 20), 10);
    expect(wasm.ema(len, 9)).toBeCloseTo(refEma(SERIES, 9), 10);
  });

  it('série constante => EMA exatamente igual à constante (qualquer período)', () => {
    const flat = Array.from({ length: 30 }, () => 123.45);
    const len = writeSeries(flat);
    expect(wasm.ema(len, 14)).toBeCloseTo(123.45, 12);
  });

  it('FAIL_CLOSED: período <= 0 ou len 0 => NaN', () => {
    const len = writeSeries(SERIES);
    expect(Number.isNaN(wasm.ema(len, 0))).toBe(true);
    expect(Number.isNaN(wasm.ema(len, -1))).toBe(true);
    expect(Number.isNaN(wasm.ema(0, 14))).toBe(true);
  });
});

describe('wasm-quant-core: STDDEV — desvio padrão AMOSTRAL (n−1), como o lib.rs documenta', () => {
  it('bate com a referência amostral independente em 10 casas decimais', () => {
    const len = writeSeries(SERIES);
    expect(wasm.stddev(len)).toBeCloseTo(refStddevSample(SERIES), 10);
  });

  it('é o amostral (n−1), NÃO o populacional (n) — a distinção que uma recompilação descuidada quebraria', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8];
    const len = writeSeries(v);
    const sample = refStddevSample(v);
    const population = Math.sqrt(v.reduce((acc, x) => acc + (x - refMean(v)) ** 2, 0) / v.length);
    expect(wasm.stddev(len)).toBeCloseTo(sample, 12);
    expect(Math.abs(wasm.stddev(len) - population)).toBeGreaterThan(1e-6);
  });

  it('FAIL_CLOSED: len < 2 => 0 (documentado), nunca NaN vazando para a UI', () => {
    writeSeries([42]);
    expect(wasm.stddev(1)).toBe(0);
    expect(wasm.stddev(0)).toBe(0);
  });
});

describe('wasm-quant-core: Z-SCORE do último valor — estatística descritiva, nunca sinal', () => {
  it('bate com (último − média)/stddev_amostral da referência', () => {
    const len = writeSeries(SERIES);
    const expected = (SERIES[SERIES.length - 1] - refMean(SERIES)) / refStddevSample(SERIES);
    expect(wasm.zscore_last(len)).toBeCloseTo(expected, 10);
  });

  it('é internamente consistente com as próprias exports (zscore == (último−média)/stddev)', () => {
    const len = writeSeries(SERIES);
    const mean = wasm.sma(len, len);
    const viaExports = (SERIES[SERIES.length - 1] - mean) / wasm.stddev(len);
    expect(wasm.zscore_last(len)).toBeCloseTo(viaExports, 10);
  });

  it('FAIL_CLOSED: série constante (sd=0) => 0; len < 2 => 0', () => {
    const flat = Array.from({ length: 10 }, () => 77);
    const len = writeSeries(flat);
    expect(wasm.zscore_last(len)).toBe(0);
    expect(wasm.zscore_last(1)).toBe(0);
  });
});

describe('wasm-quant-core: MAX/MIN sobre os primeiros `len`', () => {
  it('batem com Math.max/Math.min da referência', () => {
    const len = writeSeries(SERIES);
    expect(wasm.max_val(len)).toBeCloseTo(Math.max(...SERIES), 12);
    expect(wasm.min_val(len)).toBeCloseTo(Math.min(...SERIES), 12);
  });

  it('FAIL_CLOSED: len 0 => NaN', () => {
    expect(Number.isNaN(wasm.max_val(0))).toBe(true);
    expect(Number.isNaN(wasm.min_val(0))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// V-MAX Fase 1.3: volume_profile — histograma OHLCV (aproximação
// DECLARADA: volume do candle distribuído uniformemente por [low,high],
// ver lib.rs). Layout do buffer: entrada [highs|lows|volumes], saída
// [histograma|range_min|range_max], retorno = índice do bucket POC.
// ─────────────────────────────────────────────────────────────────────────
describe('wasm-quant-core: VOLUME_PROFILE — histograma real + POC, FAIL_CLOSED em dado corrompido', () => {
  function writeCandles(highs: number[], lows: number[], vols: number[]): number {
    const n = highs.length;
    const view = new Float64Array(wasm.memory.buffer, wasm.buffer_ptr(), wasm.buffer_capacity());
    for (let i = 0; i < n; i++) view[i] = highs[i];
    for (let i = 0; i < n; i++) view[n + i] = lows[i];
    for (let i = 0; i < n; i++) view[2 * n + i] = vols[i];
    return n;
  }
  function readProfile(buckets: number): { hist: number[]; rangeMin: number; rangeMax: number } {
    const out = new Float64Array(wasm.memory.buffer, wasm.buffer_ptr(), buckets + 2);
    return { hist: Array.from(out.subarray(0, buckets)), rangeMin: out[buckets], rangeMax: out[buckets + 1] };
  }

  it('POC é o bucket de maior volume real; range é o [min(low), max(high)] real', () => {
    // Metade de baixo com 10 de volume, metade de cima com 30.
    const n = writeCandles([105, 110], [100, 105], [10, 30]);
    const poc = wasm.volume_profile(n, 2);
    expect(poc).toBe(1);
    const { hist, rangeMin, rangeMax } = readProfile(2);
    expect(hist[0]).toBeCloseTo(10, 10);
    expect(hist[1]).toBeCloseTo(30, 10);
    expect(rangeMin).toBe(100);
    expect(rangeMax).toBe(110);
  });

  it('conserva o volume total (nenhum volume inventado nem perdido nas bordas)', () => {
    const highs = [103, 107.5, 110, 104.2];
    const lows = [100, 102, 106, 101.1];
    const vols = [12.5, 7.25, 19, 3.75];
    const n = writeCandles(highs, lows, vols);
    expect(Number.isNaN(wasm.volume_profile(n, 24))).toBe(false);
    const { hist } = readProfile(24);
    const total = hist.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(vols.reduce((a, b) => a + b, 0), 9);
  });

  it('referência independente: 1 candle cobrindo a faixa toda distribui uniforme', () => {
    const n = writeCandles([110], [100], [40]);
    const poc = wasm.volume_profile(n, 4);
    expect(poc).toBe(0); // empate perfeito => índice mais baixo, determinístico
    const { hist } = readProfile(4);
    hist.forEach((b) => expect(b).toBeCloseTo(10, 10));
  });

  it('caso degenerado real (todos os candles no mesmo preço): todo o volume no bucket 0', () => {
    const n = writeCandles([100, 100], [100, 100], [5, 7]);
    expect(wasm.volume_profile(n, 8)).toBe(0);
    const { hist, rangeMin, rangeMax } = readProfile(8);
    expect(hist[0]).toBe(12);
    expect(rangeMin).toBe(100);
    expect(rangeMax).toBe(100);
  });

  it('FAIL_CLOSED: candles 0, buckets 0, buckets > 512 => NaN', () => {
    expect(Number.isNaN(wasm.volume_profile(0, 10))).toBe(true);
    const n = writeCandles([110], [100], [1]);
    expect(Number.isNaN(wasm.volume_profile(n, 0))).toBe(true);
    expect(Number.isNaN(wasm.volume_profile(n, 513))).toBe(true);
  });

  it('FAIL_CLOSED: dado corrompido (NaN, volume negativo, high < low) => NaN, nunca um perfil-chute', () => {
    let n = writeCandles([Number.NaN], [100], [1]);
    expect(Number.isNaN(wasm.volume_profile(n, 4))).toBe(true);
    n = writeCandles([110], [100], [-1]);
    expect(Number.isNaN(wasm.volume_profile(n, 4))).toBe(true);
    n = writeCandles([100], [110], [1]); // high < low: candle impossível
    expect(Number.isNaN(wasm.volume_profile(n, 4))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// V-MAX Fase 2: trust_score — regularidade real de cadência (1/(1+CV)) +
// convergência cross-exchange (1/(1+média|bps|/10)). Layout em lib.rs.
// ─────────────────────────────────────────────────────────────────────────
describe('wasm-quant-core: TRUST_SCORE — confiança na fonte, FAIL_CLOSED em amostra inválida', () => {
  function writeTrust(gaps: number[], divs: number[]): void {
    const view = new Float64Array(wasm.memory.buffer, wasm.buffer_ptr(), wasm.buffer_capacity());
    gaps.forEach((g, i) => { view[i] = g; });
    divs.forEach((d, i) => { view[gaps.length + i] = d; });
  }

  it('cadência perfeitamente regular sem divergência => score 1, convergência NaN honesta no buffer', () => {
    writeTrust([200, 200, 200, 200], []);
    const score = wasm.trust_score(4, 0);
    expect(score).toBeCloseTo(1, 12);
    const out = new Float64Array(wasm.memory.buffer, wasm.buffer_ptr(), 2);
    expect(out[0]).toBeCloseTo(1, 12); // regularidade
    expect(Number.isNaN(out[1])).toBe(true); // convergência não medida
  });

  it('bate com a referência independente (CV + escala de 10 bps)', () => {
    const gaps = [180, 220, 200, 240, 160];
    const divs = [5, -15];
    writeTrust(gaps, divs);
    const score = wasm.trust_score(gaps.length, divs.length);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((acc, g) => acc + (g - mean) ** 2, 0) / (gaps.length - 1));
    const refReg = 1 / (1 + sd / mean);
    const refConv = 1 / (1 + (divs.reduce((a, d) => a + Math.abs(d), 0) / divs.length) / 10);
    expect(score).toBeCloseTo((refReg + refConv) / 2, 10);
  });

  it('cadência errática degrada o score de verdade', () => {
    writeTrust([200, 200, 200, 200], []);
    const uniform = wasm.trust_score(4, 0);
    writeTrust([50, 900, 20, 1400], []);
    const erratic = wasm.trust_score(4, 0);
    expect(erratic).toBeLessThan(uniform);
  });

  it('FAIL_CLOSED: <2 gaps, gap negativo/NaN, média zero, divergência não-finita => NaN', () => {
    writeTrust([200], []);
    expect(Number.isNaN(wasm.trust_score(1, 0))).toBe(true);
    writeTrust([200, -5], []);
    expect(Number.isNaN(wasm.trust_score(2, 0))).toBe(true);
    writeTrust([0, 0], []);
    expect(Number.isNaN(wasm.trust_score(2, 0))).toBe(true);
    writeTrust([200, 200], [Number.POSITIVE_INFINITY]);
    expect(Number.isNaN(wasm.trust_score(2, 1))).toBe(true);
    expect(Number.isNaN(wasm.trust_score(0, 0))).toBe(true);
  });
});
