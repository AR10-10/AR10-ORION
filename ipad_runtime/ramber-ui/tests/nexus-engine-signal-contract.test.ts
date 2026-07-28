// nexus-engine-signal-contract.test.ts — EPC OMEGA FINAL Parte 1: o
// contrato só reempacota leituras reais do Conselho — nunca uma segunda
// pool, nunca um campo fabricado para "completar" a forma.
import { describe, it, expect } from 'vitest';
import { deriveEngineSignalsFromCouncil } from '../src/nexus/engine-signal-contract';
import type { CouncilDecision, CouncilVote } from '../src/nexus/council';

const vote = (agent: CouncilVote['agent'], stance: CouncilVote['stance'], confidence: number | null, evidence: string[] = []): CouncilVote => ({
  agent, stance, confidence, rationale: `rationale-${agent}`, evidence,
});

const decision = (votes: CouncilVote[]): CouncilDecision => ({
  contractVersion: 1 as any,
  stance: 'NEUTRAL',
  agreement: null,
  opinionMass: null,
  quorum: votes.filter((v) => v.agent !== 'RISK' && v.stance !== 'ABSTAIN').length,
  riskGated: false,
  votes,
  computedAt: 1_700_000_000_000,
});

describe('deriveEngineSignalsFromCouncil: reempacota votos reais, zero segunda matemática', () => {
  it('sem decisão real => lista vazia (fail-closed, não um placeholder)', () => {
    expect(deriveEngineSignalsFromCouncil(null)).toEqual([]);
  });

  it('um sinal por voto real, mesma ordem, id prefixado', () => {
    const d = decision([vote('LIQUIDITY', 'LONG', 0.6), vote('STRUCTURE', 'SHORT', 0.4)]);
    const signals = deriveEngineSignalsFromCouncil(d);
    expect(signals.map((s) => s.id)).toEqual(['Conselho·LIQUIDITY', 'Conselho·STRUCTURE']);
  });

  it('RISK nunca ganha peso — é portão fail-closed, não voto direcional do pool', () => {
    const d = decision([vote('RISK', 'LONG', 0.9), vote('RISK', 'ABSTAIN', null)]);
    const [longRisk, abstainRisk] = deriveEngineSignalsFromCouncil(d);
    expect(longRisk.weight).toBeNull();
    expect(abstainRisk.weight).toBeNull();
  });

  it('ABSTAIN de qualquer outro agente também fica sem peso e sem validade', () => {
    const d = decision([vote('MOMENTUM', 'ABSTAIN', null)]);
    const [s] = deriveEngineSignalsFromCouncil(d);
    expect(s.weight).toBeNull();
    expect(s.validity).toBe(false);
    expect(s.confidence).toBeNull();
  });

  it('voto direcional real fora do RISK: peso uniforme 1 (mesmo valor literal do pool), validity true', () => {
    const d = decision([vote('FIBONACCI', 'LONG', 0.75)]);
    const [s] = deriveEngineSignalsFromCouncil(d);
    expect(s.weight).toBe(1);
    expect(s.validity).toBe(true);
    expect(s.confidence).toBe(0.75);
  });

  it('context = evidence real unida; null quando não há evidência', () => {
    const d = decision([
      vote('ORDERFLOW', 'LONG', 0.5, ['CVD +120', 'delta positivo']),
      vote('MANIPULATION', 'NEUTRAL', 0, []),
    ]);
    const [withEvidence, withoutEvidence] = deriveEngineSignalsFromCouncil(d);
    expect(withEvidence.context).toBe('CVD +120; delta positivo');
    expect(withoutEvidence.context).toBeNull();
  });

  it('justification = rationale real, passthrough literal', () => {
    const d = decision([vote('STRUCTURE', 'SHORT', 0.3)]);
    expect(deriveEngineSignalsFromCouncil(d)[0].justification).toBe('rationale-STRUCTURE');
  });

  it('os 5 campos ainda não instrumentados no Conselho ficam null honesto, nunca fabricados', () => {
    const d = decision([vote('LIQUIDITY', 'LONG', 0.6)]);
    const [s] = deriveEngineSignalsFromCouncil(d);
    expect(s.relevance).toBeNull();
    expect(s.priority).toBeNull();
    expect(s.quality).toBeNull();
    expect(s.temporalHorizon).toBeNull();
    expect(s.lifespanCandles).toBeNull();
  });
});
