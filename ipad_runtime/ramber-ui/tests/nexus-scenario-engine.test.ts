// nexus-scenario-engine.test.ts — V-MAX Fase 2 + v2 (Diretriz Suprema de
// Evolução Integrativa §5/§6, "Future Path Map"): trava o Motor de
// Cenários. Alvos = níveis reais mais próximos (até MAX_SCENARIO_TARGETS,
// mais perto primeiro); invalidação = nível real mais próximo do lado
// OPOSTO; pesos = massa de opinião do conselho (nunca probabilidade — o
// rótulo `basis` é permanente e testado).
import { describe, it, expect } from 'vitest';
import {
  buildScenarioProjection,
  formatScenarioPathLabel,
  describeScenarioConfidence,
  describeScenarioReaction,
  MAX_SCENARIO_TARGETS,
  type ScenarioLevel,
} from '../src/nexus/scenario-engine';
import type { CouncilDecision } from '../src/nexus/council';

const council = (over: Partial<CouncilDecision> = {}): CouncilDecision => ({
  contractVersion: 2,
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

  it('targets[0] de cada caminho é o nível real MAIS PRÓXIMO daquele lado, ordenado por distância', () => {
    const p = buildScenarioProjection(100, levels, council(), 5)!;
    expect(p.pathA.direction).toBe('LONG'); // postura do conselho
    expect(p.pathA.targets).toEqual([
      { price: 110, sourceKind: 'EQH' },
      { price: 118, sourceKind: 'SR_RESISTANCE_1' },
    ]); // 110 < 118, mais perto primeiro
    expect(p.pathB.targets).toEqual([
      { price: 95, sourceKind: 'VP_POC' },
      { price: 90, sourceKind: 'EQL' },
    ]); // 95 > 90, mais perto primeiro
  });

  it('invalidação de cada caminho é o alvo mais próximo do lado OPOSTO — a mesma leitura estrutural, zero cálculo novo', () => {
    const p = buildScenarioProjection(100, levels, council())!;
    expect(p.pathA.invalidation).toEqual({ price: 95, sourceKind: 'VP_POC' }); // = pathB.targets[0]
    expect(p.pathB.invalidation).toEqual({ price: 110, sourceKind: 'EQH' }); // = pathA.targets[0]
    expect(p.pathA.invalidation).toEqual(p.pathB.targets[0]);
    expect(p.pathB.invalidation).toEqual(p.pathA.targets[0]);
  });

  it('teto real de MAX_SCENARIO_TARGETS por caminho — nunca inventa um 4º nível projetado além do que os motores mapearam', () => {
    const manyAbove: ScenarioLevel[] = [
      { price: 105, sourceKind: 'FIB_38.2' },
      { price: 110, sourceKind: 'EQH' },
      { price: 115, sourceKind: 'SR_RESISTANCE_1' },
      { price: 120, sourceKind: 'VP_HVN' }, // 4º nível real — deve ficar de fora
    ];
    const p = buildScenarioProjection(100, manyAbove, council())!;
    expect(p.pathA.targets).toHaveLength(MAX_SCENARIO_TARGETS);
    expect(p.pathA.targets.map((t) => t.price)).toEqual([105, 110, 115]);
  });

  it('pesos vêm da massa real do pool (long/short), nunca inventados', () => {
    const p = buildScenarioProjection(100, levels, council())!;
    expect(p.pathA.opinionWeight).toBeCloseTo(0.6, 12);
    expect(p.pathB.opinionWeight).toBeCloseTo(0.2, 12);
  });

  it('conselho SHORT inverte o Path A (direção primária real)', () => {
    const p = buildScenarioProjection(100, levels, council({ stance: 'SHORT' }))!;
    expect(p.pathA.direction).toBe('SHORT');
    expect(p.pathA.targets[0]?.sourceKind).toBe('VP_POC');
    expect(p.pathA.opinionWeight).toBeCloseTo(0.2, 12);
  });

  it('conselho travado (riskGated) => pesos null honestos, geografia continua real', () => {
    const p = buildScenarioProjection(100, levels, council({ riskGated: true, stance: 'ABSTAIN', opinionMass: null }))!;
    expect(p.pathA.opinionWeight).toBeNull();
    expect(p.pathB.opinionWeight).toBeNull();
    expect(p.pathA.targets.length).toBeGreaterThan(0);
  });

  it('sem conselho nenhum => pesos null, caminhos ainda mapeiam os níveis reais', () => {
    const p = buildScenarioProjection(100, levels, null)!;
    expect(p.pathA.opinionWeight).toBeNull();
    expect(p.pathA.targets[0]?.price).toBe(110);
  });

  it('lado sem nenhum nível real => targets [] honesto (nunca um alvo projetado) e invalidation null quando o lado oposto TAMBÉM está vazio', () => {
    const onlyBelow: ScenarioLevel[] = [{ price: 90, sourceKind: 'EQL' }];
    const p = buildScenarioProjection(100, onlyBelow, council())!;
    expect(p.pathA.targets).toEqual([]); // nada acima
    expect(p.pathA.invalidation).toEqual({ price: 90, sourceKind: 'EQL' }); // invalidação de A = alvo de B
    expect(p.pathB.targets[0]?.price).toBe(90);
    expect(p.pathB.invalidation).toBeNull(); // nada acima para invalidar B
  });

  it('o rótulo de honestidade é permanente no contrato; contractVersion 2 (v2: targets[]/invalidation)', () => {
    const p = buildScenarioProjection(100, levels, council())!;
    expect(p.basis).toBe('COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY');
    expect(p.contractVersion).toBe(2);
  });
});

describe('formatScenarioPathLabel: formatador único (Diretriz Suprema §5/§6) — reaproveitado por App.tsx em 2 pontos antes duplicados', () => {
  it('sem alvo real: "no real level", nunca um preço fabricado', () => {
    const label = formatScenarioPathLabel({ direction: 'LONG', targets: [], invalidation: null, opinionWeight: null });
    expect(label).toBe('LONG → no real level');
  });

  it('1 alvo real: preço + fonte, sem sufixo "+N" (só há 1)', () => {
    const label = formatScenarioPathLabel({
      direction: 'LONG',
      targets: [{ price: 110, sourceKind: 'EQH' }],
      invalidation: null,
      opinionWeight: null,
    });
    expect(label).toBe('LONG → 110 (EQH)');
  });

  it('3 alvos reais: sufixo "+2" honesto (quantos outros existem além do mais próximo) — confiança qualitativa, nunca porcentagem', () => {
    const label = formatScenarioPathLabel({
      direction: 'SHORT',
      targets: [
        { price: 95, sourceKind: 'VP_POC' },
        { price: 92, sourceKind: 'FIB_61.8' },
        { price: 90, sourceKind: 'EQL' },
      ],
      invalidation: { price: 110, sourceKind: 'EQH' },
      opinionWeight: 0.42,
    });
    expect(label).toBe('SHORT → 95 (VP_POC) +2 · inv 110 · opinion MODERADA');
  });

  it('invalidação null nunca aparece no texto (sem "· inv" pendurado) — confiança qualitativa no limite FORTE (0.5)', () => {
    const label = formatScenarioPathLabel({
      direction: 'LONG',
      targets: [{ price: 110, sourceKind: 'EQH' }],
      invalidation: null,
      opinionWeight: 0.5,
    });
    expect(label).not.toContain('inv');
    expect(label).toBe('LONG → 110 (EQH) · opinion FORTE');
  });

  it('peso null vira ausência honesta de sufixo de opinião (nunca "opinion n/a" fabricado dentro deste formatador específico — App.tsx decide seu próprio fallback quando precisa)', () => {
    const label = formatScenarioPathLabel({
      direction: 'LONG',
      targets: [{ price: 110, sourceKind: 'EQH' }],
      invalidation: null,
      opinionWeight: null,
    });
    expect(label).toBe('LONG → 110 (EQH)');
  });
});

// Diretriz Final — Camada de Cenários Inteligentes §4 ("Não utilizar
// porcentagens arbitrárias... classificações qualitativas"): cortes
// uniformes de 25%, mesmo espírito de heatTier (heat-score.ts) — testa
// os 4 limiares reais + os 2 casos honestos (null/fora de faixa).
describe('describeScenarioConfidence: faixa qualitativa real, nunca uma porcentagem exposta', () => {
  it('null/NaN => null honesto (nunca uma faixa fabricada sem peso real)', () => {
    expect(describeScenarioConfidence(null)).toBeNull();
    expect(describeScenarioConfidence(Number.NaN)).toBeNull();
  });

  it('4 faixas reais nos limiares documentados (cortes de 25%)', () => {
    expect(describeScenarioConfidence(0)).toBe('FRACA');
    expect(describeScenarioConfidence(0.24)).toBe('FRACA');
    expect(describeScenarioConfidence(0.25)).toBe('MODERADA');
    expect(describeScenarioConfidence(0.49)).toBe('MODERADA');
    expect(describeScenarioConfidence(0.5)).toBe('FORTE');
    expect(describeScenarioConfidence(0.74)).toBe('FORTE');
    expect(describeScenarioConfidence(0.75)).toBe('MUITO_FORTE');
    expect(describeScenarioConfidence(1)).toBe('MUITO_FORTE');
  });

  it('peso fora de [0,1] é grampeado (fail-safe), nunca lança nem devolve uma faixa fora do vocabulário real', () => {
    expect(describeScenarioConfidence(-0.5)).toBe('FRACA');
    expect(describeScenarioConfidence(1.5)).toBe('MUITO_FORTE');
  });
});

// §3 ("Pontos de Reteste... possível pullback/rejeição/continuação/
// reversão... sempre derivados de cálculos reais"): a classificação
// nasce só do sourceKind que o motor já produz (scenario-engine.ts
// acima, mesma lista real usada por buildScenarioProjection), zero
// inferência nova.
describe('describeScenarioReaction: classificação honesta derivada só do sourceKind real, nunca uma inferência nova', () => {
  it('família de liquidez (EQH/EQL) => varredura de liquidez', () => {
    expect(describeScenarioReaction('EQH')).toBe('possível varredura de liquidez');
    expect(describeScenarioReaction('EQL')).toBe('possível varredura de liquidez');
  });

  it('família estrutural (SR_*) => pullback/rejeição', () => {
    expect(describeScenarioReaction('SR_SUPPORT_1')).toBe('possível pullback/rejeição');
    expect(describeScenarioReaction('SR_RESISTANCE_1')).toBe('possível pullback/rejeição');
  });

  it('família Fibonacci (FIB_*) => retração', () => {
    expect(describeScenarioReaction('FIB_61.8')).toBe('possível retração');
  });

  it('família Volume Profile (VP_*) => ímã de volume', () => {
    expect(describeScenarioReaction('VP_POC')).toBe('possível ímã de volume');
    expect(describeScenarioReaction('VP_HVN')).toBe('possível ímã de volume');
  });

  it('sourceKind desconhecido (motor futuro ainda não mapeado aqui) => fallback honesto genérico, nunca lança exceção', () => {
    expect(() => describeScenarioReaction('QUALQUER_COISA_NOVA')).not.toThrow();
    expect(describeScenarioReaction('QUALQUER_COISA_NOVA')).toBe('possível reação estrutural');
  });
});
