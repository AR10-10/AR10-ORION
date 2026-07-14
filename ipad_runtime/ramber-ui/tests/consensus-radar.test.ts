// consensus-radar.test.ts — Diretriz Complementar (Evolução da
// Inteligência Operacional §8, "Radar de Consenso"): execução real de
// computeConsensusRadar() em nexus/consensus-radar.ts.
import { describe, it, expect } from 'vitest';
import { computeConsensusRadar, CONSENSUS_RADAR_CATEGORIES } from '../src/nexus/consensus-radar';
import type { CouncilDecision, CouncilVote } from '../src/nexus/council';

function vote(agent: CouncilVote['agent'], confidence: number | null): CouncilVote {
  return { agent, stance: confidence === null ? 'ABSTAIN' : 'LONG', confidence, rationale: 'r', evidence: [] };
}

function council(votes: CouncilVote[]): CouncilDecision {
  return {
    contractVersion: 2,
    stance: 'LONG',
    agreement: 0.5,
    opinionMass: { long: 0.5, short: 0.3, neutral: 0.2 },
    quorum: votes.filter((v) => v.stance !== 'ABSTAIN').length,
    riskGated: false,
    votes,
    computedAt: 1000,
  };
}

const FULL_VOTES: CouncilVote[] = [
  vote('LIQUIDITY', 0.4),
  vote('STRUCTURE', 0.6),
  vote('ORDERFLOW', 0.8),
  vote('RISK', 1),
  vote('MANIPULATION', 0.2),
  vote('FIBONACCI', 0.3),
  vote('MOMENTUM', 0.9),
];

describe('computeConsensusRadar: as 6 categorias reais, ordem fixa', () => {
  it('sempre devolve exatamente as 6 categorias de CONSENSUS_RADAR_CATEGORIES, nesta ordem', () => {
    const reading = computeConsensusRadar({ council: null, bandwidthPercentile: null, gmilScore: null });
    expect(reading.spokes.map((s) => s.category)).toEqual([...CONSENSUS_RADAR_CATEGORIES]);
  });

  it('mapeia Estrutura/Liquidez/Fluxo/Momentum diretamente da confidence real do Conselho — zero segunda matemática', () => {
    const reading = computeConsensusRadar({
      council: council(FULL_VOTES),
      bandwidthPercentile: null,
      gmilScore: null,
    });
    const byCategory = Object.fromEntries(reading.spokes.map((s) => [s.category, s.value]));
    expect(byCategory.ESTRUTURA).toBe(0.6);
    expect(byCategory.LIQUIDEZ).toBe(0.4);
    expect(byCategory.FLUXO).toBe(0.8);
    expect(byCategory.MOMENTUM).toBe(0.9);
  });

  it('Volatilidade é passthrough puro do bandwidthPercentile real', () => {
    const reading = computeConsensusRadar({ council: null, bandwidthPercentile: 0.73, gmilScore: null });
    const spoke = reading.spokes.find((s) => s.category === 'VOLATILIDADE')!;
    expect(spoke.value).toBe(0.73);
  });

  it('GMIL é a MAGNITUDE (Math.abs) do score sinalizado real — nunca a direção', () => {
    const negative = computeConsensusRadar({ council: null, bandwidthPercentile: null, gmilScore: -0.65 });
    const positive = computeConsensusRadar({ council: null, bandwidthPercentile: null, gmilScore: 0.65 });
    const gmilOf = (r: ReturnType<typeof computeConsensusRadar>) => r.spokes.find((s) => s.category === 'GMIL')!.value;
    expect(gmilOf(negative)).toBe(0.65);
    expect(gmilOf(positive)).toBe(0.65);
  });

  it('FAIL_CLOSED: council null => Estrutura/Liquidez/Fluxo/Momentum todos null (nunca 0 fabricado)', () => {
    const reading = computeConsensusRadar({ council: null, bandwidthPercentile: null, gmilScore: null });
    for (const cat of ['ESTRUTURA', 'LIQUIDEZ', 'FLUXO', 'MOMENTUM'] as const) {
      expect(reading.spokes.find((s) => s.category === cat)!.value).toBeNull();
    }
  });

  it('FAIL_CLOSED: voto ABSTAIN (confidence null) vira spoke null — nunca 0', () => {
    const votes = FULL_VOTES.map((v) => (v.agent === 'MOMENTUM' ? vote('MOMENTUM', null) : v));
    const reading = computeConsensusRadar({ council: council(votes), bandwidthPercentile: null, gmilScore: null });
    expect(reading.spokes.find((s) => s.category === 'MOMENTUM')!.value).toBeNull();
  });

  it('voto NEUTRAL com confidence 0 real permanece 0 — nunca vira null (0 é dado real, não ausência)', () => {
    const votes = FULL_VOTES.map((v) => (v.agent === 'STRUCTURE' ? vote('STRUCTURE', 0) : v));
    const reading = computeConsensusRadar({ council: council(votes), bandwidthPercentile: null, gmilScore: null });
    expect(reading.spokes.find((s) => s.category === 'ESTRUTURA')!.value).toBe(0);
  });

  it('NaN/Infinity honesto em bandwidthPercentile ou gmilScore => null, nunca propagado', () => {
    const reading = computeConsensusRadar({ council: null, bandwidthPercentile: NaN, gmilScore: Infinity });
    expect(reading.spokes.find((s) => s.category === 'VOLATILIDADE')!.value).toBeNull();
    expect(reading.spokes.find((s) => s.category === 'GMIL')!.value).toBeNull();
  });

  it('computedAt usa Date.now() real quando omitido, ou o valor explícito quando informado', () => {
    const explicit = computeConsensusRadar({ council: null, bandwidthPercentile: null, gmilScore: null, computedAt: 555 });
    expect(explicit.computedAt).toBe(555);
    const before = Date.now();
    const implicit = computeConsensusRadar({ council: null, bandwidthPercentile: null, gmilScore: null });
    expect(implicit.computedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('LEI 24 + Regra de Ouro 1: consensus-radar.ts é puro e honesto', () => {
  it('zero I/O, zero Math.random, zero rede, zero segunda matemática de consenso (nunca reimplementa buildEnsembleConsensus)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/nexus/consensus-radar.ts', import.meta.url), 'utf8');
    expect(src).not.toContain('fetch(');
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toContain('buildEnsembleConsensus');
    expect(src).not.toContain('opinionFromVote');
  });

  it('documenta honestamente a omissão do Risk Engine (Regra de Ouro 1 — zero dado fabricado)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/nexus/consensus-radar.ts', import.meta.url), 'utf8');
    expect(src).toContain('Risk Engine');
    expect(src).toContain('Regra de Ouro 1');
  });
});
