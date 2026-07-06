// system-health.test.ts — Fase J (V15 Cap. 17): classificadores puros da
// telemetria de sistema. Import the REAL module; as medições em si (rAF,
// cronômetro do ciclo) são da plataforma e ficam na UI — aqui trava-se a
// matemática/rotulagem e a honestidade das bordas.
import { describe, it, expect } from 'vitest';
import {
  classifyFps,
  classifyCycleLatency,
  memoryUsedMB,
  wasmVariantLabel,
  FPS_CLASSIFICATION,
  CYCLE_CLASSIFICATION,
} from '../../src/telemetry/system-health.js';

describe('system-health: classifyFps — limiares exatos, null quando não medido', () => {
  it('50+ FLUIDO, 30-49 ACEITAVEL, <30 CRITICO', () => {
    expect(classifyFps(60)).toBe(FPS_CLASSIFICATION.FLUIDO);
    expect(classifyFps(50)).toBe(FPS_CLASSIFICATION.FLUIDO);
    expect(classifyFps(49)).toBe(FPS_CLASSIFICATION.ACEITAVEL);
    expect(classifyFps(30)).toBe(FPS_CLASSIFICATION.ACEITAVEL);
    expect(classifyFps(29)).toBe(FPS_CLASSIFICATION.CRITICO);
  });

  it('não-finito/negativo => null (nunca uma classe fabricada)', () => {
    expect(classifyFps(null as any)).toBeNull();
    expect(classifyFps(NaN)).toBeNull();
    expect(classifyFps(-1)).toBeNull();
  });
});

describe('system-health: classifyCycleLatency — limiares exatos', () => {
  it('<500 RAPIDO, <1500 OK, senão LENTO', () => {
    expect(classifyCycleLatency(200)).toBe(CYCLE_CLASSIFICATION.RAPIDO);
    expect(classifyCycleLatency(499)).toBe(CYCLE_CLASSIFICATION.RAPIDO);
    expect(classifyCycleLatency(500)).toBe(CYCLE_CLASSIFICATION.OK);
    expect(classifyCycleLatency(1499)).toBe(CYCLE_CLASSIFICATION.OK);
    expect(classifyCycleLatency(1500)).toBe(CYCLE_CLASSIFICATION.LENTO);
  });

  it('não medido => null', () => {
    expect(classifyCycleLatency(null as any)).toBeNull();
  });
});

describe('system-health: memoryUsedMB — só quando a plataforma expõe API (Safari => null honesto)', () => {
  it('performance.memory presente => MB reais', () => {
    const fakePerf = { memory: { usedJSHeapSize: 128 * 1024 * 1024 } };
    expect(memoryUsedMB(fakePerf)).toBeCloseTo(128, 10);
  });

  it('sem memory (Safari) / valores inválidos => null, nunca um número chutado', () => {
    expect(memoryUsedMB({} as any)).toBeNull();
    expect(memoryUsedMB(undefined)).toBeNull();
    expect(memoryUsedMB({ memory: { usedJSHeapSize: -5 } })).toBeNull();
    expect(memoryUsedMB({ memory: { usedJSHeapSize: NaN } })).toBeNull();
  });
});

describe('system-health: wasmVariantLabel — vocabulário fechado da Fase I', () => {
  it('mapeia as 2 variantes reais e rejeita o resto', () => {
    expect(wasmVariantLabel('simd128')).toBe('SIMD128');
    expect(wasmVariantLabel('escalar')).toBe('ESCALAR');
    expect(wasmVariantLabel(null)).toBeNull();
    expect(wasmVariantLabel('outra_coisa')).toBeNull();
  });
});
