// decision-layer.test.ts — Diretriz Final (Nexus Decision Layer): execução
// real da fusão. O ponto mais crítico é LEI 24: operation é passthrough do
// Core Engine — este teste trava isso para sempre.
import { describe, it, expect } from 'vitest';
import { buildNexusDecision, NEXUS_DECISION_CONTRACT_VERSION, NEXUS_PLAN_GAP_LABEL, NEXUS_CLOSED_WINDOW_MS, NEXUS_MAX_REASONS } from '../src/nexus/decision-layer';
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
  // ── V2 ──
  inEntryZone: false,
  lastResolvedAt: null,
  councilVotes: [
    { agent: 'STRUCTURE', stance: 'LONG', rationale: 'estrutura real de alta' },
    { agent: 'ORDERFLOW', stance: 'LONG', rationale: 'fluxo comprador dominante' },
    { agent: 'MANIPULATION', stance: 'SHORT', rationale: 'sweep de topo recente' },
    { agent: 'RISK', stance: 'NEUTRAL', rationale: 'condições ok' },
  ],
  convictionMembers: [
    { id: 'ENSEMBLE', agreesWithCore: true, detail: 'ensemble LONG forte' },
    { id: 'MULTI_TIMEFRAME', agreesWithCore: false, detail: '3/9 prazos concordam' },
    { id: 'COUNCIL', agreesWithCore: null, detail: 'sem leitura' },
  ],
  heatTier: 'QUENTE',
  premiumDiscountZone: 'DISCOUNT' as const,
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

describe('V2 §3 — estado operacional único derivado de leituras reais', () => {
  const now = 1_000_000;
  it('com plano: GERENCIANDO (>=1 alvo provado) > EXECUTAVEL (na zona) > CONFIRMANDO', () => {
    expect(buildNexusDecision({ ...base, targetsHit: 1 }, now).operationalState).toBe('GERENCIANDO');
    expect(buildNexusDecision({ ...base, targetsHit: 0, inEntryZone: true }, now).operationalState).toBe('EXECUTAVEL');
    expect(buildNexusDecision({ ...base, targetsHit: 0, inEntryZone: false }, now).operationalState).toBe('CONFIRMANDO');
  });

  it('sem plano: ENCERRADO dentro da janela documentada; fora dela cai para PREPARANDO/OBSERVANDO', () => {
    const noPlan = { ...base, plan: null };
    expect(buildNexusDecision({ ...noPlan, lastResolvedAt: now - NEXUS_CLOSED_WINDOW_MS + 1 }, now).operationalState).toBe('ENCERRADO');
    expect(buildNexusDecision({ ...noPlan, lastResolvedAt: now - NEXUS_CLOSED_WINDOW_MS - 1 }, now).operationalState).toBe('PREPARANDO');
    expect(buildNexusDecision({ ...noPlan, coreDirection: null, lastResolvedAt: null }, now).operationalState).toBe('OBSERVANDO');
    expect(buildNexusDecision({ ...noPlan, coreDirection: 'LONG', lastResolvedAt: null }, now).operationalState).toBe('PREPARANDO');
  });
});

describe('V2 §4 — justificativa estruturada de fontes reais nomeadas', () => {
  it('votos direcionais do Conselho concordando => favoráveis (rationale literal + fonte); discordando => contrários; NEUTRAL/ABSTAIN fora', () => {
    const d = buildNexusDecision(base);
    expect(d.reasonsFor).toContain('estrutura real de alta (Conselho·STRUCTURE)');
    expect(d.reasonsFor).toContain('fluxo comprador dominante (Conselho·ORDERFLOW)');
    expect(d.reasonsAgainst).toContain('sweep de topo recente (Conselho·MANIPULATION)');
    expect(d.reasonsFor.join()).not.toContain('RISK');
  });

  it('Conviction agree/disagree entram com a fonte; agreesWithCore null fica fora (sem leitura real)', () => {
    const d = buildNexusDecision(base);
    expect(d.reasonsFor).toContain('ensemble LONG forte (Conviction·ENSEMBLE)');
    expect(d.reasonsAgainst).toContain('3/9 prazos concordam (Conviction·MULTI_TIMEFRAME)');
    expect([...d.reasonsFor, ...d.reasonsAgainst].join()).not.toContain('COUNCIL');
  });

  it('DISCOUNT favorece LONG (e PREMIUM favorece SHORT — convenção SMC); Heat EXTREMO é sempre contrário', () => {
    const d = buildNexusDecision(base);
    expect(d.reasonsFor).toContain('Preço em DISCOUNT do range (Premium/Discount)');
    const hot = buildNexusDecision({ ...base, heatTier: 'EXTREMO' });
    expect(hot.reasonsAgainst).toContain('Atividade/volatilidade extrema agora (Heat Score)');
    const shortPremium = buildNexusDecision({ ...base, coreDirection: 'SHORT', premiumDiscountZone: 'PREMIUM' });
    expect(shortPremium.reasonsFor).toContain('Preço em PREMIUM do range (Premium/Discount)');
  });

  it('AGUARDAR não fabrica justificativa direcional (só o fator de atividade extrema pode entrar)', () => {
    const d = buildNexusDecision({ ...base, coreDirection: null });
    expect(d.reasonsFor).toEqual([]);
    const hot = buildNexusDecision({ ...base, coreDirection: null, heatTier: 'EXTREMO' });
    expect(hot.reasonsAgainst).toEqual(['Atividade/volatilidade extrema agora (Heat Score)']);
  });

  it('cap documentado por lista (NEXUS_MAX_REASONS) — leitura <5s, nunca uma parede de texto', () => {
    const manyVotes = Array.from({ length: 10 }, (_, i) => ({ agent: `A${i}`, stance: 'LONG', rationale: `motivo ${i}` }));
    const d = buildNexusDecision({ ...base, councilVotes: manyVotes });
    expect(d.reasonsFor.length).toBeLessThanOrEqual(NEXUS_MAX_REASONS);
  });
});
