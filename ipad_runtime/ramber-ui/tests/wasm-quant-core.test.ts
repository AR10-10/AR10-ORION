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
      ['buffer_capacity', 'buffer_ptr', 'ema', 'engine_version', 'max_val', 'memory', 'min_val', 'sma', 'stddev', 'zscore_last'].sort(),
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
