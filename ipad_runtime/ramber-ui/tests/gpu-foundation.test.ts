// gpu-foundation.test.ts — Fase I (WebGPU, diretriz 2): a fundação do
// pipeline de cômputo GPU. WebGPU não existe em node — o que É testável
// (e testado) são as partes puras: a referência CPU (provada IDÊNTICA à
// matemática do classificador real), o seletor de backend com a cadeia
// oficial de fallback e a detecção de capacidade silenciosa (diretriz 4).
import { describe, it, expect } from 'vitest';
import {
  cpuLorentzianDistances,
  selectComputeBackend,
  detectGpuAdapter,
  WGSL_LORENTZIAN_DISTANCES,
} from '../../src/gpu/lorentzian-gpu.js';
import { lorentzianDistance } from '../../src/research/engines/lorentzian-classifier.js';

describe('gpu-foundation: a referência CPU é a MESMA matemática do motor real', () => {
  it('cpuLorentzianDistances == lorentzianDistance do classificador, vetor a vetor', () => {
    const query = [0.5, -1.2, 3.3, 0.01];
    const candidates = [
      [0.4, -1.0, 3.0, 0.02],
      [2.5, 0.0, -1.1, 0.5],
      [0.5, -1.2, 3.3, 0.01], // idêntico => distância 0
    ];
    const distances = cpuLorentzianDistances(query, candidates);
    candidates.forEach((candidate, i) => {
      expect(distances[i]).toBeCloseTo(lorentzianDistance(query, candidate), 12);
    });
    expect(distances[2]).toBe(0);
  });

  it('a fórmula é ln(1+|a−b|) somada — verificável à mão', () => {
    const d = cpuLorentzianDistances([0], [[1]]);
    expect(d[0]).toBeCloseTo(Math.log(2), 12);
  });
});

describe('gpu-foundation: seletor de backend — a cadeia oficial de fallback da Fase I', () => {
  it('adapter GPU real presente => webgpu', () => {
    expect(selectComputeBackend({ gpuAdapter: {}, simdSupported: true })).toBe('webgpu');
  });

  it('sem GPU mas com SIMD aprovado pela sonda => wasm-simd', () => {
    expect(selectComputeBackend({ gpuAdapter: null, simdSupported: true })).toBe('wasm-simd');
  });

  it('sem GPU e sem SIMD => scalar (o caminho de sempre, validado pela Fase G)', () => {
    expect(selectComputeBackend({ gpuAdapter: null, simdSupported: false })).toBe('scalar');
    expect(selectComputeBackend()).toBe('scalar');
  });
});

describe('gpu-foundation: detecção de capacidade é SILENCIOSA (diretriz 4 — nunca degrada o app)', () => {
  it('navigator ausente/sem gpu => null, sem lançar', async () => {
    expect(await detectGpuAdapter(undefined)).toBeNull();
    expect(await detectGpuAdapter({} as any)).toBeNull();
  });

  it('requestAdapter negando (null) ou explodindo => null, sem lançar', async () => {
    expect(await detectGpuAdapter({ gpu: { requestAdapter: async () => null } } as any)).toBeNull();
    expect(
      await detectGpuAdapter({ gpu: { requestAdapter: async () => { throw new Error('blocked'); } } } as any),
    ).toBeNull();
  });

  it('adapter real concedido => devolvido intacto', async () => {
    const fakeAdapter = { name: 'apple-silicon' };
    expect(await detectGpuAdapter({ gpu: { requestAdapter: async () => fakeAdapter } } as any)).toBe(fakeAdapter);
  });
});

describe('gpu-foundation: integridade do kernel WGSL', () => {
  it('o kernel computa a mesma fórmula (log/abs), lê query/features e escreve distances', () => {
    expect(WGSL_LORENTZIAN_DISTANCES).toContain('log(1.0 + abs(');
    expect(WGSL_LORENTZIAN_DISTANCES).toContain('var<storage, read> query');
    expect(WGSL_LORENTZIAN_DISTANCES).toContain('var<storage, read> features');
    expect(WGSL_LORENTZIAN_DISTANCES).toContain('var<storage, read_write> distances');
    expect(WGSL_LORENTZIAN_DISTANCES).toContain('@compute @workgroup_size(64)');
  });
});
