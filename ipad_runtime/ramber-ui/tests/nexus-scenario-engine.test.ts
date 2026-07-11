// nexus-scenario-engine.test.ts — V-MAX Fase 2: trava o Motor de Cenários.
// Alvos = níveis reais mais próximos; pesos = massa de opinião do conselho
// (nunca probabilidade — o rótulo `basis` é permanente e testado).
import { describe, it, expect } from 'vitest';
import { buildScenarioProjection, type ScenarioLevel } from '../src/nexus/scenario-engine';
import type { CouncilDecision } from '../src/nexus/council';

const council = (over: Partial<CouncilDecision> = {}): CouncilDecision => ({
  contractVersion: 1,
  stance: 'LONG',
  agreement: 0.4,
  opinionMass: { long: 0.6, short: 0.2, neutral: 0.2 },
  quorum: 3,
  riskGated: false,
  votes: [],
  computedAt: 1,
  ...over,
});

const levels: ScenarioLevel[] = [
  { price: 110, sourceKind: 'EQH' },
  { price: 118, sourceKind: 'SR_RESISTANCE_1' },
  { price: 95, sourceKind: 'VP_POC' },
  { price: 90, sourceKind: 'EQL' },
];

describe('buildScenarioProjection: geografia real de níveis + opinião real do conselho', () => {
  it('FAIL_CLOSED: sem preço real => null', () => {
    expect(buildScenarioProjection(null, levels, council())).toBeNull();
    expect(buildScenarioProjection(Number.NaN, levels, council())).toBeNull();
  });

  it('alvo de cada caminho é o nível real MAIS PRÓXIMO daquele lado', () => {
    const p = buildScenarioProjection(100, levels, council(), 5)!;
    expect(p.pathA.direction).toBe('LONG'); // postura do conselho
    expect(p.pathA.target).toEqual({ price: 110, sourceKind: 'EQH' }); // 110 < 118
    expect(p.pathB.target).toEqual({ price: 95, sourceKind: 'VP_POC' }); // 95 > 90
  });

  it('pesos vêm da massa real do pool (long/short), nunca inventados', () => {
    const p = buildScenarioProjection(100, levels, council())!;
    expect(p.pathA.opinionWeight).toBeCloseTo(0.6, 12);
    expect(p.pathB.opinionWeight).toBeCloseTo(0.2, 12);
  });

  it('conselho SHORT inverte o Path A (direção primária real)', () => {
    const p = buildScenarioProjection(100, levels, council({ stance: 'SHORT' }))!;
    expect(p.pathA.direction).toBe('SHORT');
    expect(p.pathA.target?.sourceKind).toBe('VP_POC');
    expect(p.pathA.opinionWeight).toBeCloseTo(0.2, 12);
  });

  it('conselho travado (riskGated) => pesos null honestos, geografia continua real', () => {
    const p = buildScenarioProjection(100, levels, council({ riskGated: true, stance: 'ABSTAIN', opinionMass: null }))!;
    expect(p.pathA.opinionWeight).toBeNull();
    expect(p.pathB.opinionWeight).toBeNull();
    expect(p.pathA.target).not.toBeNull();
  });

  it('sem conselho nenhum => pesos null, caminhos ainda mapeiam os níveis reais', () => {
    const p = buildScenarioProjection(100, levels, null)!;
    expect(p.pathA.opinionWeight).toBeNull();
    expect(p.pathA.target?.price).toBe(110);
  });

  it('lado sem nenhum nível real => target null honesto (nunca um alvo projetado)', () => {
    const onlyBelow: ScenarioLevel[] = [{ price: 90, sourceKind: 'EQL' }];
    const p = buildScenarioProjection(100, onlyBelow, council())!;
    expect(p.pathA.target).toBeNull(); // nada acima
    expect(p.pathB.target?.price).toBe(90);
  });

  it('o rótulo de honestidade é permanente no contrato', () => {
    const p = buildScenarioProjection(100, levels, council())!;
    expect(p.basis).toBe('COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY');
    expect(p.contractVersion).toBe(1);
  });
});
