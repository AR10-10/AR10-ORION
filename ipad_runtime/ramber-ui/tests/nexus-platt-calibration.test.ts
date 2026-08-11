// nexus-platt-calibration.test.ts — Escopo Cirúrgico (Operador, Fase 3:
// "Calibração de Probabilidade"). Execução real do gradiente (nunca um
// mock de A/B) e das 2 correções reais sobre o documento original: alvos
// suavizados (nunca 0/1 crus — a amostra pequena deste terminal saturaria
// em falsa certeza) e o gate fail-closed de calibrateConfidence.
import { describe, it, expect } from 'vitest';
import {
  trainPlattScaling,
  applyPlattScaling,
  calibrateConfidence,
  type PlattCalibrationSample,
} from '../src/nexus/platt-calibration';
import { MIN_TRADES_FOR_VALID_EXPECTANCY } from '../src/nexus/expectancy';
import type { TradeCostResult } from '../src/nexus/trade-simulation';

function result(netR: number, modelAgreement: number | null): TradeCostResult {
  return {
    status: netR > 0 ? 'TARGET_HIT' : 'STOP_HIT',
    direction: 'LONG',
    entryMid: 100,
    riskPoints: 1,
    grossR: netR,
    commissionR: 0,
    slippageR: 0,
    fundingR: 0,
    netR,
    holdingMs: 0,
    regime: null,
    fingerprint: null,
    modelAgreement,
  };
}

describe('trainPlattScaling: alvos suavizados reais (Platt 1999), nunca 0/1 crus', () => {
  it('amostra vazia => null honesto, nunca um ajuste fabricado', () => {
    expect(trainPlattScaling([])).toBeNull();
  });

  it('score alto correlaciona com WIN real, score baixo com LOSS real => probabilidade calibrada segue a mesma ordem (monotonicidade real)', () => {
    const samples: PlattCalibrationSample[] = [
      ...Array.from({ length: 16 }, () => ({ score: 0.8, outcome: true })),
      ...Array.from({ length: 4 }, () => ({ score: 0.8, outcome: false })),
      ...Array.from({ length: 4 }, () => ({ score: -0.8, outcome: true })),
      ...Array.from({ length: 16 }, () => ({ score: -0.8, outcome: false })),
    ];
    const params = trainPlattScaling(samples);
    expect(params).not.toBeNull();
    const high = applyPlattScaling(0.8, params!);
    const low = applyPlattScaling(-0.8, params!);
    expect(high).toBeGreaterThan(0.5);
    expect(low).toBeLessThan(0.5);
    expect(high).toBeGreaterThan(low);
  });

  it('amostra 100% WIN (nenhuma LOSS real) => probabilidade calibrada fica ABAIXO de 100%, nunca uma certeza fabricada — a correção real sobre o documento original (que usava 0/1 crus e satura em falsa certeza)', () => {
    const samples: PlattCalibrationSample[] = Array.from({ length: 30 }, () => ({ score: 1, outcome: true }));
    const params = trainPlattScaling(samples)!;
    const probability = applyPlattScaling(1, params);
    // Alvo suavizado real: (30+1)/(30+2) = 31/32 ≈ 0.96875 — o sigmoide
    // converge PARA esse teto, nunca o ultrapassa (gradiente correto).
    expect(probability).toBeLessThan(0.99);
    expect(probability).toBeGreaterThan(0.5);
  });

  it('amostra 100% LOSS (nenhuma WIN real) => probabilidade calibrada fica ACIMA de 0%, nunca um zero fabricado', () => {
    const samples: PlattCalibrationSample[] = Array.from({ length: 30 }, () => ({ score: -1, outcome: false }));
    const params = trainPlattScaling(samples)!;
    const probability = applyPlattScaling(-1, params);
    expect(probability).toBeGreaterThan(0.01);
    expect(probability).toBeLessThan(0.5);
  });

  it('nunca produz NaN, mesmo com score bruto extremo (segurança numérica do exp())', () => {
    const samples: PlattCalibrationSample[] = [
      { score: 1, outcome: true },
      { score: -1, outcome: false },
    ];
    const params = trainPlattScaling(samples)!;
    expect(Number.isNaN(params.a)).toBe(false);
    expect(Number.isNaN(params.b)).toBe(false);
    for (const extreme of [1000, -1000, 0, 1e10, -1e10]) {
      const p = applyPlattScaling(extreme, params);
      expect(Number.isNaN(p)).toBe(false);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('calibrateConfidence: camada de política (mesma forma de evaluateSignalFilter) — fail-closed com 2 motivos reais distintos', () => {
  it(`amostra usável abaixo de ${MIN_TRADES_FOR_VALID_EXPECTANCY} => calibrated false, motivo de amostra insuficiente, sampleSize real`, () => {
    const results = Array.from({ length: MIN_TRADES_FOR_VALID_EXPECTANCY - 1 }, (_, i) => result(i % 2 === 0 ? 1 : -1, 0.5));
    const out = calibrateConfidence(0.5, results);
    expect(out.calibrated).toBe(false);
    expect(out.probability).toBeNull();
    expect(out.sampleSize).toBe(MIN_TRADES_FOR_VALID_EXPECTANCY - 1);
    expect(out.reason).toContain(String(MIN_TRADES_FOR_VALID_EXPECTANCY));
  });

  it('trades com modelAgreement null (registro antigo, ou nenhum modelo real na abertura) NÃO contam para a amostra usável — mesmo com results.length suficiente', () => {
    const usable = Array.from({ length: MIN_TRADES_FOR_VALID_EXPECTANCY - 5 }, () => result(1, 0.5));
    const semScore = Array.from({ length: 20 }, () => result(1, null));
    const out = calibrateConfidence(0.5, [...usable, ...semScore]);
    expect(out.calibrated).toBe(false);
    expect(out.sampleSize).toBe(MIN_TRADES_FOR_VALID_EXPECTANCY - 5);
  });

  it('amostra suficiente mas rawScore null (sem plano ativo agora) => calibrated false, motivo DISTINTO (nunca confundido com amostra insuficiente)', () => {
    const results = Array.from({ length: MIN_TRADES_FOR_VALID_EXPECTANCY }, (_, i) => result(i % 2 === 0 ? 1 : -1, i % 2 === 0 ? 0.7 : -0.7));
    const out = calibrateConfidence(null, results);
    expect(out.calibrated).toBe(false);
    expect(out.probability).toBeNull();
    expect(out.reason).not.toContain(String(MIN_TRADES_FOR_VALID_EXPECTANCY));
    expect(out.reason).toMatch(/sem plano ativo/i);
  });

  it('amostra suficiente + rawScore real => calibrated true, probability 0-100 arredondado, sampleSize real', () => {
    const wins = Array.from({ length: 20 }, () => result(1.5, 0.8));
    const losses = Array.from({ length: 15 }, () => result(-1, -0.6));
    const out = calibrateConfidence(0.8, [...wins, ...losses]);
    expect(out.calibrated).toBe(true);
    expect(out.reason).toBeNull();
    expect(out.sampleSize).toBe(35);
    expect(out.probability).not.toBeNull();
    expect(Number.isInteger(out.probability)).toBe(true);
    expect(out.probability!).toBeGreaterThanOrEqual(0);
    expect(out.probability!).toBeLessThanOrEqual(100);
  });

  it('WIN é definido por netR > 0 (mesma definição real de expectancy.ts) — um PARTIAL_HIT com netR<=0 conta como LOSS na calibração, nunca por status', () => {
    // 20 PARTIAL_HIT com netR>0 (score alto) + 15 PARTIAL_HIT com netR<=0
    // (score baixo) — se calibrateConfidence usasse `status` em vez de
    // netR, os dois grupos pareceriam WINs (mesmo status), destruindo a
    // separação; usando netR, score alto deve calibrar mais alto.
    const partialWins: TradeCostResult[] = Array.from({ length: 20 }, () => ({ ...result(0.3, 0.9), status: 'PARTIAL_HIT' as const }));
    const partialLosses: TradeCostResult[] = Array.from({ length: 15 }, () => ({ ...result(-0.1, -0.9), status: 'PARTIAL_HIT' as const }));
    const high = calibrateConfidence(0.9, [...partialWins, ...partialLosses]);
    const low = calibrateConfidence(-0.9, [...partialWins, ...partialLosses]);
    expect(high.probability!).toBeGreaterThan(low.probability!);
  });
});
