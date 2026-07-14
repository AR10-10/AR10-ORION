// decision-layer.test.ts — Diretriz Final (Nexus Decision Layer): execução
// real da fusão. O ponto mais crítico é LEI 24: operation é passthrough do
// Core Engine — este teste trava isso para sempre.
import { describe, it, expect } from 'vitest';
import { buildNexusDecision, NEXUS_DECISION_CONTRACT_VERSION, NEXUS_PLAN_GAP_LABEL } from '../src/nexus/decision-layer';
import type { TradePlan } from '../src/nexus/trade-plan';
import type { EtaReading } from '../src/nexus/eta-engine';

const plan: TradePlan = {
  contractVersion: 2,
  direction: 'LONG',
  entry: { low: 99, high: 100, basis: 'OB_BULLISH' },
  stop: { price: 95, basis: 'SR_SUPPORT_1' },
  targets: [
    { price: 105, basis: 'VP_POC' },
    { price: 110, basis: 'EQH' },
  ],
  riskRewardRatios: [1.22, 2.44],
  computedAt: 0,
};

const eta: EtaReading = {
  status: 'OK', reason: null,
  etas: [
    { targetIndex: 0, bars: 10, ms: 600_000, barsMin: 5, msMin: 300_000, basis: 'real' },
    null,
  ],
  directionalEfficiency: 0.5, atrAbsolute: 1, computedAt: 0,
};

const base = {
  coreDirection: 'LONG' as const,
  coreConfidence: 'ALTA',
  plan,
  targetsHit: 1,
  etaReading: eta,
  score: 72,
  scoreZoneLabel: 'ZONA FORTE',
  scoreTrend: 'FORTALECENDO',
  councilStance: 'LONG' as const,
  councilRiskGated: false,
  assistantMessage: { text: 'Compra favorecida.', basis: 'conselho LONG + fluxo real' },
};

describe('buildNexusDecision: fusão pura das leituras reais', () => {
  it('LEI 24: operation é passthrough LITERAL do Core Engine, com a fonte gravada no contrato', () => {
    expect(buildNexusDecision(base).operation).toBe('LONG');
    expect(buildNexusDecision({ ...base, coreDirection: 'SHORT' }).operation).toBe('SHORT');
    expect(buildNexusDecision({ ...base, coreDirection: null }).operation).toBe('AGUARDAR');
    expect(buildNexusDecision(base).operationSource).toBe('CORE_ENGINE');
  });

  it('plano real vira o bloco único: entrada/stop/alvos com R:R, ETA (mín/provável) e hit do ratchet REAL', () => {
    const d = buildNexusDecision(base);
    expect(d.contractVersion).toBe(NEXUS_DECISION_CONTRACT_VERSION);
    expect(d.plan).not.toBeNull();
    expect(d.plan!.entryLow).toBe(99);
    expect(d.plan!.stopBasis).toBe('SR_SUPPORT_1');
    expect(d.plan!.targets).toHaveLength(2);
    expect(d.plan!.targets[0]).toMatchObject({ price: 105, riskReward: 1.22, etaMsMin: 300_000, etaMs: 600_000, hit: true });
    expect(d.plan!.targets[1]).toMatchObject({ price: 110, riskReward: 2.44, etaMsMin: null, etaMs: null, hit: false });
    expect(d.planGap).toBeNull();
  });

  it('confiança = leituras reais existentes (rótulo do motor + Score + zona + tendência) — nunca um número novo', () => {
    const d = buildNexusDecision(base);
    expect(d.confidenceLabel).toBe('ALTA');
    expect(d.score).toBe(72);
    expect(d.scoreZone).toBe('ZONA FORTE');
    expect(d.scoreTrend).toBe('FORTALECENDO');
    expect(buildNexusDecision({ ...base, score: NaN }).score).toBeNull();
  });

  it('motivo resumido = frase REAL do Assistente (com base verificável); null honesto sem mensagem', () => {
    const d = buildNexusDecision(base);
    expect(d.reason).toBe('Compra favorecida.');
    expect(d.reasonBasis).toContain('conselho');
    expect(buildNexusDecision({ ...base, assistantMessage: null }).reason).toBeNull();
  });

  it('planGap: as 4 causas reais estruturadas, mutuamente exclusivas, só quando plan é null', () => {
    const noPlan = { ...base, plan: null };
    expect(buildNexusDecision({ ...noPlan, councilStance: null }).planGap).toBe('AWAITING_COUNCIL');
    expect(buildNexusDecision({ ...noPlan, councilRiskGated: true }).planGap).toBe('RISK_GATED');
    expect(buildNexusDecision({ ...noPlan, councilStance: 'NEUTRAL' }).planGap).toBe('COUNCIL_NEUTRAL');
    expect(buildNexusDecision({ ...noPlan, councilStance: 'LONG' }).planGap).toBe('NO_STRUCTURE');
    expect(buildNexusDecision(base).planGap).toBeNull(); // com plano, gap nunca existe
    // todo código tem rótulo curto ao lado do contrato
    for (const code of ['AWAITING_COUNCIL', 'RISK_GATED', 'COUNCIL_NEUTRAL', 'NO_STRUCTURE'] as const) {
      expect(NEXUS_PLAN_GAP_LABEL[code].length).toBeGreaterThan(0);
    }
  });

  it('targetsHit fora da faixa é clampado (0..targets.length) — nunca um hit fabricado', () => {
    const d = buildNexusDecision({ ...base, targetsHit: 99 });
    expect(d.plan!.targets.every((t) => t.hit)).toBe(true);
    const d2 = buildNexusDecision({ ...base, targetsHit: -3 });
    expect(d2.plan!.targets.every((t) => !t.hit)).toBe(true);
  });

  it('contrato nunca fala em probabilidade (Regra de Ouro 2 no nível do fonte)', () => {
    const src = require('node:fs').readFileSync(require.resolve('../src/nexus/decision-layer.ts'), 'utf8');
    expect(src).not.toMatch(/probabilit(y|ies)|probabilidade de acerto|chance de subir/i);
  });
});
