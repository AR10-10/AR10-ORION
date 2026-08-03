// evidence-fusion.test.ts — Carta Branca (Evidence Fusion Engine):
// execução real do motor puro de agregação — nunca uma direção, nunca um
// score combinado, só estatística real de cobertura/volume de evidência.
import { describe, it, expect } from 'vitest';
import { fuseEvidence, EVIDENCE_FUSION_CONTRACT_VERSION, type EvidenceFusionSourceGroup } from '../src/nexus/evidence-fusion';
import type { EngineSignal } from '../src/nexus/engine-signal-contract';

const signal = (overrides: Partial<EngineSignal> = {}): EngineSignal => ({
  id: 'sig',
  weight: null,
  confidence: null,
  relevance: null,
  validity: null,
  context: null,
  justification: null,
  priority: null,
  quality: null,
  temporalHorizon: null,
  lifespanCandles: null,
  ...overrides,
});

describe('fuseEvidence: fail-closed real (nenhuma fonte real ainda montada)', () => {
  it('grupos vazios => contadores 0, fieldCoverage 0 em todos os 10 campos, nunca fabricado', () => {
    const reading = fuseEvidence([]);
    expect(reading.contractVersion).toBe(EVIDENCE_FUSION_CONTRACT_VERSION);
    expect(reading.totalSignals).toBe(0);
    expect(reading.validSignals).toBe(0);
    expect(reading.meanConfidence).toBeNull();
    expect(reading.bySource).toEqual([]);
    for (const v of Object.values(reading.fieldCoverage)) expect(v).toBe(0);
  });

  it('um grupo real sem nenhum sinal ainda => mesmo resultado honesto de "sem grupo"', () => {
    const groups: EvidenceFusionSourceGroup[] = [{ source: 'Conselho', signals: [] }];
    const reading = fuseEvidence(groups);
    expect(reading.totalSignals).toBe(0);
    expect(reading.bySource).toEqual([{ source: 'Conselho', total: 0, valid: 0, meanWeight: null }]);
  });
});

describe('fuseEvidence: agregação real de múltiplas fontes independentes', () => {
  it('totalSignals/validSignals somam TODOS os grupos, nunca só o primeiro', () => {
    const groups: EvidenceFusionSourceGroup[] = [
      { source: 'Conselho', signals: [signal({ validity: true }), signal({ validity: false })] },
      { source: 'Zonas Institucionais', signals: [signal({ validity: true }), signal({ validity: true })] },
    ];
    const reading = fuseEvidence(groups);
    expect(reading.totalSignals).toBe(4);
    expect(reading.validSignals).toBe(3);
  });

  it('bySource: um breakdown real POR grupo, na mesma ordem de entrada', () => {
    const groups: EvidenceFusionSourceGroup[] = [
      { source: 'Conselho', signals: [signal({ validity: true, weight: 1 }), signal({ validity: false, weight: null })] },
      { source: 'Zonas Institucionais', signals: [signal({ validity: true, weight: 0.6 })] },
    ];
    const reading = fuseEvidence(groups);
    expect(reading.bySource).toEqual([
      { source: 'Conselho', total: 2, valid: 1, meanWeight: 1 },
      { source: 'Zonas Institucionais', total: 1, valid: 1, meanWeight: 0.6 },
    ]);
  });

  it('meanWeight por fonte: média real só entre os sinais com peso não-nulo — um weight:null (ex.: RISK/ABSTAIN) não derruba a média, só fica de fora', () => {
    const groups: EvidenceFusionSourceGroup[] = [
      { source: 'Conselho', signals: [signal({ weight: 1 }), signal({ weight: 0.5 }), signal({ weight: null })] },
    ];
    const reading = fuseEvidence(groups);
    expect(reading.bySource[0].total).toBe(3); // o weight:null continua contando no total real
    expect(reading.bySource[0].meanWeight).toBeCloseTo(0.75, 6); // média real só de 1 e 0.5
  });
});

describe('fuseEvidence: meanConfidence honesto (só sinais VÁLIDOS com confidence real)', () => {
  it('um sinal inválido com confidence não-nulo NUNCA entra na média — validity é o portão real', () => {
    const groups: EvidenceFusionSourceGroup[] = [
      { source: 'Conselho', signals: [signal({ validity: true, confidence: 0.8 }), signal({ validity: false, confidence: 0.99 })] },
    ];
    const reading = fuseEvidence(groups);
    expect(reading.meanConfidence).toBe(0.8); // 0.99 do inválido fica de fora
  });

  it('sinal válido mas sem confidence real (null) também fica de fora da média, nunca vira 0 fabricado', () => {
    const groups: EvidenceFusionSourceGroup[] = [
      { source: 'Zonas Institucionais', signals: [signal({ validity: true, confidence: null }), signal({ validity: true, confidence: null })] },
    ];
    const reading = fuseEvidence(groups);
    expect(reading.meanConfidence).toBeNull();
  });
});

describe('fuseEvidence: fieldCoverage real — a pergunta "quantos dos 10 campos têm montador real hoje", ao vivo', () => {
  it('campo presente em metade dos sinais reais => cobertura 0.5 exata', () => {
    const groups: EvidenceFusionSourceGroup[] = [
      { source: 'Conselho', signals: [signal({ confidence: 0.5 }), signal({ confidence: null })] },
    ];
    const reading = fuseEvidence(groups);
    expect(reading.fieldCoverage.confidence).toBeCloseTo(0.5, 6);
  });

  it('campo nunca preenchido por nenhum montador real hoje (ex.: priority) => cobertura 0 honesta', () => {
    const groups: EvidenceFusionSourceGroup[] = [
      { source: 'Conselho', signals: [signal({ weight: 1 }), signal({ weight: 1 })] },
    ];
    const reading = fuseEvidence(groups);
    expect(reading.fieldCoverage.priority).toBe(0);
    expect(reading.fieldCoverage.quality).toBe(0);
    expect(reading.fieldCoverage.temporalHorizon).toBe(0);
    expect(reading.fieldCoverage.lifespanCandles).toBe(0);
    expect(reading.fieldCoverage.relevance).toBe(0);
  });

  it('cobertura conta TODOS os sinais de TODOS os grupos, não só um grupo isolado', () => {
    const groups: EvidenceFusionSourceGroup[] = [
      { source: 'Conselho', signals: [signal({ context: 'a' })] },
      { source: 'Zonas Institucionais', signals: [signal({ context: 'b' }), signal({ context: null })] },
    ];
    const reading = fuseEvidence(groups);
    expect(reading.fieldCoverage.context).toBeCloseTo(2 / 3, 6);
  });
});

describe('fuseEvidence: LEI 24 / Regra de Ouro 2 — nunca um campo de direção ou score combinado', () => {
  it('a forma real de EvidenceFusionReading não tem stance/direction/score/probability em lugar nenhum', () => {
    const reading = fuseEvidence([{ source: 'Conselho', signals: [signal({ validity: true, confidence: 0.5, weight: 1 })] }]);
    const keys = Object.keys(reading);
    for (const forbidden of ['stance', 'direction', 'score', 'probability', 'signal']) {
      expect(keys).not.toContain(forbidden);
    }
    const sourceKeys = Object.keys(reading.bySource[0]);
    for (const forbidden of ['stance', 'direction', 'score', 'probability']) {
      expect(sourceKeys).not.toContain(forbidden);
    }
  });
});
