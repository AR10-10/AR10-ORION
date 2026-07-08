// wasm-simd-parity.test.ts — Fase I (V15 Cap. 16.2): suite de PARIDADE
// entre os dois binários compilados da MESMA fonte (build.sh):
//   wasm/cyborg_quant_core.wasm       escalar  (engine_version 1000)
//   wasm/cyborg_quant_core_simd.wasm  simd128  (engine_version 1001)
// A rede da Fase G (wasm-quant-core.test.ts) continua validando o binário
// escalar contra referências independentes; ESTA suite instancia o binário
// SIMD e prova (a) as mesmas referências, (b) a concordância cruzada
// escalar×SIMD função a função.
//
// NOTA DE HONESTIDADE (documentada também no lib.rs): a redução vetorial
// f64x2 soma em ORDEM diferente da escalar; soma de ponto flutuante não é
// associativa (IEEE 754), então igualdade bit-a-bit entre as duas ordens
// não é matematicamente prometível — o critério de equivalência é 10-12
// casas decimais, o mesmo padrão da Fase G. EMA é serial e idêntica nos
// dois builds (mesma recorrência, mesma ordem) — nela exige-se igualdade
// EXATA (toBe), que é o teste de que a recompilação não tocou o que não
// devia.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const scalarPath = resolve(here, '../../wasm/cyborg_quant_core.wasm');
const simdPath = resolve(here, '../../wasm/cyborg_quant_core_simd.wasm');

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

let scalar: QuantExports;
let simd: QuantExports;

async function load(path: string): Promise<QuantExports> {
  const { instance } = await WebAssembly.instantiate(readFileSync(path), {});
  return instance.exports as unknown as QuantExports;
}

function write(wasm: QuantExports, values: number[]): number {
  const view = new Float64Array(wasm.memory.buffer, wasm.buffer_ptr(), wasm.buffer_capacity());
  values.forEach((v, i) => { view[i] = v; });
  return values.length;
}

// Séries determinísticas: par, ímpar (exercita a cauda do laço f64x2) e
// constante.
const EVEN = Array.from({ length: 64 }, (_, i) => 50_000 + 120 * Math.sin(i / 3) + 7 * i);
const ODD = Array.from({ length: 63 }, (_, i) => 4_000 - 35 * Math.cos(i / 5) + 2.5 * i);
const FLAT = Array.from({ length: 21 }, () => 123.456);

beforeAll(async () => {
  scalar = await load(scalarPath);
  simd = await load(simdPath);
});

describe('simd-parity: os dois binários existem e se identificam corretamente', () => {
  it('o binário SIMD está versionado ao lado do escalar (deploy serve os dois)', () => {
    expect(existsSync(scalarPath)).toBe(true);
    expect(existsSync(simdPath)).toBe(true);
  });

  it('engine_version distingue as variantes: escalar=1000, simd=1001', () => {
    expect(scalar.engine_version()).toBe(1000);
    expect(simd.engine_version()).toBe(1001);
  });

  it('mesma superfície de exports e mesma capacidade nos dois', () => {
    const surface = (w: QuantExports) => Object.keys(w).filter((k) => !k.startsWith('__')).sort();
    expect(surface(simd)).toEqual(surface(scalar));
    expect(simd.buffer_capacity()).toBe(scalar.buffer_capacity());
  });
});

describe('simd-parity: concordância cruzada escalar×SIMD (10-12 casas) em séries pares, ímpares e constantes', () => {
  const series: Array<[string, number[]]> = [['par(64)', EVEN], ['impar(63)', ODD], ['constante(21)', FLAT]];

  for (const [label, data] of series) {
    it(`sma/stddev/zscore/max/min concordam na série ${label}`, () => {
      const lenS = write(scalar, data);
      const lenV = write(simd, data);
      expect(simd.sma(lenV, 20)).toBeCloseTo(scalar.sma(lenS, 20), 10);
      expect(simd.sma(lenV, 5)).toBeCloseTo(scalar.sma(lenS, 5), 10);
      expect(simd.stddev(lenV)).toBeCloseTo(scalar.stddev(lenS), 10);
      expect(simd.zscore_last(lenV)).toBeCloseTo(scalar.zscore_last(lenS), 10);
      // max/min não são reduções aritméticas — comparação exata é devida.
      expect(simd.max_val(lenV)).toBe(scalar.max_val(lenS));
      expect(simd.min_val(lenV)).toBe(scalar.min_val(lenS));
    });
  }

  it('EMA é serial e intocada: igualdade EXATA entre os dois binários', () => {
    const lenS = write(scalar, EVEN);
    const lenV = write(simd, EVEN);
    expect(simd.ema(lenV, 20)).toBe(scalar.ema(lenS, 20));
    expect(simd.ema(lenV, 9)).toBe(scalar.ema(lenS, 9));
  });
});

describe('simd-parity: o binário SIMD honra os mesmos FAIL_CLOSED documentados', () => {
  it('bordas NaN/0 idênticas às da Fase G', () => {
    const len = write(simd, EVEN);
    expect(Number.isNaN(simd.sma(len, 0))).toBe(true);
    expect(Number.isNaN(simd.sma(0, 10))).toBe(true);
    expect(Number.isNaN(simd.ema(len, 0))).toBe(true);
    expect(simd.stddev(1)).toBe(0);
    expect(simd.zscore_last(1)).toBe(0);
    expect(Number.isNaN(simd.max_val(0))).toBe(true);
    expect(Number.isNaN(simd.min_val(0))).toBe(true);
  });

  it('série constante: stddev 0 e zscore 0 também no SIMD (sem ruído de reordenação)', () => {
    const len = write(simd, FLAT);
    expect(simd.stddev(len)).toBe(0);
    expect(simd.zscore_last(len)).toBe(0);
  });
});

describe('simd-parity: o binário SIMD passa nas MESMAS referências independentes da Fase G', () => {
  const refSma = (v: number[], w: number) => v.slice(v.length - w).reduce((a, b) => a + b, 0) / w;
  const refMean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const refStddev = (v: number[]) => {
    const m = refMean(v);
    return Math.sqrt(v.reduce((acc, x) => acc + (x - m) ** 2, 0) / (v.length - 1));
  };

  it('sma/stddev/zscore do SIMD batem com as referências em 10 casas', () => {
    const len = write(simd, ODD);
    expect(simd.sma(len, 15)).toBeCloseTo(refSma(ODD, 15), 10);
    expect(simd.stddev(len)).toBeCloseTo(refStddev(ODD), 10);
    expect(simd.zscore_last(len)).toBeCloseTo((ODD[ODD.length - 1] - refMean(ODD)) / refStddev(ODD), 10);
  });
});
