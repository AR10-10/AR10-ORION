// nexus-unified-presentation.test.ts — Evolução Incremental da
// Inteligência Central, Fase 1: execução real de computePresentationState.
// Mesma disciplina de decision-layer.test.ts: o ponto mais crítico é
// LEI 24 — verdict.direction é passthrough literal de NexusDecision.operation,
// nunca recomputado.
import { describe, it, expect } from 'vitest';
import { buildNexusDecision } from '../src/nexus/decision-layer';
import type { NexusDecisionInputs } from '../src/nexus/decision-layer';
import type { CouncilDecision } from '../src/nexus/council';
import type { AuraReading } from '../src/nexus/aura-lifecycle';
import {
  computePresentationState,
  PRESENTATION_STATE_CONTRACT_VERSION,
  type RegimeReading,
} from '../src/nexus/unified-presentation';

const minimalInputs: NexusDecisionInputs = {
  coreDirection: 'LONG',
  coreConfidence: 'ALTA',
  plan: null,
  targetsHit: 0,
  etaReading: null,
  score: 72,
  scoreZoneLabel: 'ZONA FORTE',
  scoreTrend: 'FORTALECENDO',
  councilStance: null,
  councilRiskGated: null,
  assistantMessage: null,
  inEntryZone: null,
  lastResolvedAt: null,
  councilVotes: null,
  convictionMembers: null,
  heatTier: null,
  premiumDiscountZone: null,
};

function council(stance: CouncilDecision['stance'], agreement: number | null): CouncilDecision {
  return {
    contractVersion: 2,
    stance,
    agreement,
    opinionMass: null,
    quorum: 5,
    riskGated: false,
    votes: [],
    computedAt: 0,
  };
}

function regime(status: 'OK' | 'DADOS_INSUFICIENTES', regimeValue: string, direction: 'ALTA' | 'BAIXA' | null): RegimeReading {
  return { status, regime: regimeValue, direction: status === 'OK' ? direction : null };
}

function aura(corridorWidthFactor: number | null): AuraReading {
  return {
    status: corridorWidthFactor === null ? 'DADOS_INSUFICIENTES' : 'OK',
    reason: null,
    plan: null,
    phase: null,
    targetIndex: null,
    targetProximity: null,
    corridorWidthFactor,
    pulseIntensity: null,
    fadeAlpha: 0,
    computedAt: 0,
  };
}

describe('computePresentationState: verdict — passthrough real, zero segunda fonte (LEI 24)', () => {
  it('direction é passthrough literal de NexusDecision.operation', () => {
    const decision = buildNexusDecision(minimalInputs);
    const state = computePresentationState({
      decision, council: null, regime: null, aura: null, structureLabel: null, riskStatus: null,
    });
    expect(state.verdict.direction).toBe('LONG');
    expect(state.verdict.provenance.direction).toBe('core-engine');
  });

  it('sem decisão real => AGUARDAR honesto, nunca um lado fabricado', () => {
    const state = computePresentationState({
      decision: null, council: null, regime: null, aura: null, structureLabel: null, riskStatus: null,
    });
    expect(state.verdict.direction).toBe('AGUARDAR');
  });

  it('score/confidenceLabel são passthrough literal de decision-layer.ts', () => {
    const decision = buildNexusDecision(minimalInputs);
    const state = computePresentationState({
      decision, council: null, regime: null, aura: null, structureLabel: null, riskStatus: null,
    });
    expect(state.verdict.score).toBe(72);
    expect(state.verdict.confidenceLabel).toBe('ALTA');
    expect(state.verdict.provenance.score).toBe('decision-layer');
  });

  it('contractVersion e computedAt reais no envelope', () => {
    const state = computePresentationState(
      { decision: null, council: null, regime: null, aura: null, structureLabel: null, riskStatus: null },
      12345,
    );
    expect(state.contractVersion).toBe(PRESENTATION_STATE_CONTRACT_VERSION);
    expect(state.computedAt).toBe(12345);
  });
});

describe('computePresentationState: regime — regime-engine.js, NUNCA aura-lifecycle (correção sobre o documento)', () => {
  it('regime OK real => regime/direction passthrough, provenance regime-engine', () => {
    const state = computePresentationState({
      decision: null, council: null, regime: regime('OK', 'TENDENCIA_FORTE', 'ALTA'), aura: null,
      structureLabel: null, riskStatus: null,
    });
    expect(state.verdict.regime).toBe('TENDENCIA_FORTE');
    expect(state.verdict.regimeDirection).toBe('ALTA');
    expect(state.verdict.provenance.regime).toBe('regime-engine');
  });

  it('regime DADOS_INSUFICIENTES ou ausente => rótulo honesto, direção null', () => {
    const semLeitura = computePresentationState({
      decision: null, council: null, regime: null, aura: null, structureLabel: null, riskStatus: null,
    });
    expect(semLeitura.verdict.regime).toBe('DADOS_INSUFICIENTES');
    expect(semLeitura.verdict.regimeDirection).toBeNull();

    const insuficiente = computePresentationState({
      decision: null, council: null, regime: regime('DADOS_INSUFICIENTES', 'DADOS_INSUFICIENTES', null), aura: null,
      structureLabel: null, riskStatus: null,
    });
    expect(insuficiente.verdict.regimeDirection).toBeNull();
  });
});

describe('computePresentationState: conviction — categorização de corridorWidthFactor (aura-lifecycle.ts)', () => {
  it('>= 0.7 => FORTE; >= 0.4 => MODERADA; abaixo => FRACA', () => {
    expect(computePresentationState({ decision: null, council: null, regime: null, aura: aura(0.85), structureLabel: null, riskStatus: null }).verdict.conviction).toBe('FORTE');
    expect(computePresentationState({ decision: null, council: null, regime: null, aura: aura(0.55), structureLabel: null, riskStatus: null }).verdict.conviction).toBe('MODERADA');
    expect(computePresentationState({ decision: null, council: null, regime: null, aura: aura(0.1), structureLabel: null, riskStatus: null }).verdict.conviction).toBe('FRACA');
  });

  it('sem leitura real (aura null ou DADOS_INSUFICIENTES) => null honesto, nunca um rótulo fabricado', () => {
    expect(computePresentationState({ decision: null, council: null, regime: null, aura: null, structureLabel: null, riskStatus: null }).verdict.conviction).toBeNull();
    expect(computePresentationState({ decision: null, council: null, regime: null, aura: aura(null), structureLabel: null, riskStatus: null }).verdict.conviction).toBeNull();
  });
});

describe('computePresentationState: displayConflicts — lista central nomeada (reusa conflict-detector.ts)', () => {
  it('tudo alinhado ou sem leitura dupla => lista vazia', () => {
    const state = computePresentationState({
      decision: null, council: null, regime: regime('OK', 'TENDENCIA_FORTE', 'ALTA'), aura: null,
      structureLabel: 'ESTRUTURA_ALTA', riskStatus: null,
    });
    expect(state.displayConflicts).toEqual([]);
  });

  it('Regime ALTA x Structure ESTRUTURA_BAIXA => 1 conflito nomeado, severidade ALTO', () => {
    const state = computePresentationState({
      decision: null, council: null, regime: regime('OK', 'TENDENCIA_FORTE', 'ALTA'), aura: null,
      structureLabel: 'ESTRUTURA_BAIXA', riskStatus: null,
    });
    expect(state.displayConflicts).toHaveLength(1);
    expect(state.displayConflicts[0]).toMatchObject({ motorA: 'regime', motorB: 'structure', severity: 'ALTO' });
  });

  it('Conselho fortemente direcional + Risk SEM_SUGESTAO => conflito CRITICO (§3.2 Regra 3 do documento)', () => {
    const state = computePresentationState({
      decision: null, council: council('LONG', 0.9), regime: null, aura: null,
      structureLabel: null, riskStatus: 'SEM_SUGESTAO',
    });
    expect(state.displayConflicts).toHaveLength(1);
    expect(state.displayConflicts[0]).toMatchObject({ motorA: 'risk', motorB: 'council', severity: 'CRITICO' });
  });

  it('dois conflitos reais simultâneos => lista com os dois', () => {
    const state = computePresentationState({
      decision: null, council: council('LONG', 0.9), regime: regime('OK', 'TENDENCIA_FORTE', 'BAIXA'), aura: null,
      structureLabel: 'ESTRUTURA_ALTA', riskStatus: 'SEM_SUGESTAO',
    });
    expect(state.displayConflicts).toHaveLength(2);
  });
});
