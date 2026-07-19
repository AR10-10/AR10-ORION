// integration-audit-bias-setup-entry.test.ts — Diretriz de Continuidade
// "Auditoria Final da Separação BIAS → SETUP → ENTRY → PLANO": trava por
// EXECUÇÃO REAL a matriz de consistência obrigatória (§2, casos A-E) e a
// prova estrutural de que BIAS≠ENTRY/SETUP≠ENTRY nunca colapsam (§6) —
// nenhuma matemática nova, só travas de regressão sobre os módulos reais
// já existentes (decision-layer.ts, trade-plan.ts, operational-
// readability.ts).
import { describe, it, expect } from 'vitest';
import { buildTradePlan, type TradePlanInputs } from '../src/nexus/trade-plan';
import { buildNexusDecision, type NexusDecisionInputs } from '../src/nexus/decision-layer';
import {
  deriveBiasLabel,
  deriveEntryState,
  deriveOutcomeLabel,
  deriveSetupState,
} from '../src/nexus/operational-readability';

const DECISION_BASE: NexusDecisionInputs = {
  coreDirection: null,
  coreConfidence: null,
  plan: null,
  targetsHit: 0,
  etaReading: null,
  score: null,
  scoreZoneLabel: null,
  scoreTrend: null,
  councilStance: null,
  councilRiskGated: false,
  assistantMessage: null,
  inEntryZone: false,
  lastResolvedAt: null,
  councilVotes: null,
  convictionMembers: null,
  heatTier: null,
  premiumDiscountZone: null,
};

const LONG_PLAN_INPUTS: TradePlanInputs = {
  stance: 'LONG',
  riskGated: false,
  price: 50_000,
  zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
  levels: [
    { price: 48_800, kind: 'SR_SUPPORT_1' },
    { price: 51_000, kind: 'SR_RESISTANCE_1' },
    { price: 52_500, kind: 'EQH' },
  ],
};

const SHORT_PLAN_INPUTS: TradePlanInputs = {
  stance: 'SHORT',
  riskGated: false,
  price: 50_000,
  zones: [{ low: 50_500, high: 50_800, kind: 'OB_BEARISH' }],
  levels: [
    { price: 51_500, kind: 'SR_RESISTANCE_1' },
    { price: 49_000, kind: 'SR_SUPPORT_1' },
    { price: 47_500, kind: 'EQL' },
  ],
};

describe('§2 Matriz de consistência obrigatória — Casos A-E por execução real', () => {
  it('CASO A (variante "nada real chegou ainda") — Núcleo E Conselho sem NENHUMA leitura: BIAS INSUFFICIENT_DATA · SETUP/ENTRY WAITING_FOR_CONFIRMATION (achado real: mais preciso que NO_VALID_SETUP — "Conselho ainda não votou" é distinto de "Conselho votou e não achou estrutura") · LEITURA SEM OPERAÇÃO · PLANO ausente', () => {
    const d = buildNexusDecision(DECISION_BASE);
    expect(d.operation).toBe('AGUARDAR'); // nunca LONG/SHORT sem leitura real do Núcleo
    expect(d.plan).toBeNull();
    expect(deriveBiasLabel(d)).toBe('INSUFFICIENT_DATA');
    expect(deriveSetupState(d)).toBe('WAITING_FOR_CONFIRMATION');
    expect(deriveEntryState(d)).toBe('WAITING_FOR_CONFIRMATION');
    expect(deriveOutcomeLabel(d)).toBe('SEM OPERAÇÃO');
  });

  it('CASO A (variante literal da diretriz) — Conselho JÁ votou real e direcional mas sem estrutura mapeada, Núcleo ainda sem leitura: BIAS INSUFFICIENT_DATA · SETUP NO_VALID_SETUP · ENTRY NO_ENTRY · PLANO ausente — nunca LONG/SHORT/stop/TP/ETA fabricados. LEITURA: achado real — "SEM OPERAÇÃO" (repouso genuíno), mais preciso que o "OBSERVAR" do exemplo: OBSERVAR neste motor é reservado para quando o PRÓPRIO Núcleo já tem uma direção real (§4/CASO B abaixo); aqui o Núcleo continua em AGUARDAR puro.', () => {
    const d = buildNexusDecision({ ...DECISION_BASE, councilStance: 'LONG', councilRiskGated: false });
    expect(d.operation).toBe('AGUARDAR');
    expect(d.plan).toBeNull();
    expect(d.planGap).toBe('NO_STRUCTURE');
    expect(deriveBiasLabel(d)).toBe('INSUFFICIENT_DATA');
    expect(deriveSetupState(d)).toBe('NO_VALID_SETUP');
    expect(deriveEntryState(d)).toBe('NO_ENTRY');
    expect(deriveOutcomeLabel(d)).toBe('SEM OPERAÇÃO');
  });

  it('CASO B — BIAS LONG sem estrutura: BIAS LONG_BIAS · SETUP NO_VALID_SETUP · ENTRY NO_ENTRY · LEITURA OBSERVAR (nunca uma entrada falsa)', () => {
    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'LONG', coreConfidence: 'ALTA', score: 70, councilStance: 'LONG', councilRiskGated: false });
    expect(d.planGap).toBe('NO_STRUCTURE');
    expect(deriveBiasLabel(d)).toBe('LONG_BIAS');
    expect(deriveSetupState(d)).toBe('NO_VALID_SETUP');
    expect(deriveEntryState(d)).toBe('NO_ENTRY');
    expect(deriveOutcomeLabel(d)).toBe('OBSERVAR');
    expect(d.plan).toBeNull();
  });

  it('CASO C — BIAS LONG + SETUP LONG, timing ainda pendente: LEITURA AGUARDAR LONG (SETUP e ENTRY podem divergir honestamente)', () => {
    const plan = buildTradePlan(LONG_PLAN_INPUTS, 1_000)!;
    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'LONG', coreConfidence: 'ALTA', score: 70, councilStance: 'LONG', plan, targetsHit: 0, inEntryZone: false });
    expect(d.operationalState).toBe('CONFIRMANDO'); // plano real, mas fora da zona agora
    expect(deriveBiasLabel(d)).toBe('LONG_BIAS');
    expect(deriveSetupState(d)).toBe('LONG_SETUP'); // estrutura EXISTE
    expect(deriveEntryState(d)).toBe('WAITING_FOR_RETEST'); // mas o timing ainda não
    expect(deriveOutcomeLabel(d)).toBe('AGUARDAR LONG');
  });

  it('CASO D — LONG completo: BIAS LONG_BIAS · SETUP LONG_SETUP · ENTRY ENTRY_CONFIRMED · LEITURA "LONG — PLANO ATIVO" · plano com TP1<TP2<TP3, R:R real', () => {
    const plan = buildTradePlan(LONG_PLAN_INPUTS, 1_000)!;
    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'LONG', coreConfidence: 'ALTA', score: 70, councilStance: 'LONG', plan, targetsHit: 1 });
    expect(d.operationalState).toBe('GERENCIANDO');
    expect(deriveBiasLabel(d)).toBe('LONG_BIAS');
    expect(deriveSetupState(d)).toBe('LONG_SETUP');
    expect(deriveEntryState(d)).toBe('ENTRY_CONFIRMED');
    expect(deriveOutcomeLabel(d)).toBe('LONG');
    expect(d.plan).not.toBeNull();
    const entryMid = (d.plan!.entryLow + d.plan!.entryHigh) / 2;
    for (let i = 0; i < d.plan!.targets.length; i++) {
      expect(d.plan!.targets[i].price).toBeGreaterThan(entryMid);
      if (i > 0) expect(d.plan!.targets[i].price).toBeGreaterThan(d.plan!.targets[i - 1].price);
      expect(d.plan!.targets[i].riskReward).not.toBeNull();
    }
  });

  it('CASO E — SHORT completo, espelho matemático exato: BIAS SHORT_BIAS · SETUP SHORT_SETUP · ENTRY ENTRY_CONFIRMED · LEITURA "SHORT — PLANO ATIVO" · TP1>TP2>TP3', () => {
    const plan = buildTradePlan(SHORT_PLAN_INPUTS, 1_000)!;
    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'SHORT', coreConfidence: 'ALTA', score: 70, councilStance: 'SHORT', plan, targetsHit: 1 });
    expect(d.operationalState).toBe('GERENCIANDO');
    expect(deriveBiasLabel(d)).toBe('SHORT_BIAS');
    expect(deriveSetupState(d)).toBe('SHORT_SETUP');
    expect(deriveEntryState(d)).toBe('ENTRY_CONFIRMED');
    expect(deriveOutcomeLabel(d)).toBe('SHORT');
    expect(d.plan).not.toBeNull();
    const entryMid = (d.plan!.entryLow + d.plan!.entryHigh) / 2;
    for (let i = 0; i < d.plan!.targets.length; i++) {
      expect(d.plan!.targets[i].price).toBeLessThan(entryMid);
      if (i > 0) expect(d.plan!.targets[i].price).toBeLessThan(d.plan!.targets[i - 1].price);
      expect(d.plan!.targets[i].riskReward).not.toBeNull();
    }
  });
});

describe('§6 Prova estrutural: BIAS ≠ ENTRY e SETUP ≠ ENTRY nunca colapsam em "plano ativo sem entrada confirmada"', () => {
  it('exemplo VÁLIDO da diretriz: SHORT_BIAS + SHORT_SETUP + WAITING_FOR_RETEST => "AGUARDAR SHORT", nunca "SHORT — PLANO ATIVO"', () => {
    const plan = buildTradePlan(SHORT_PLAN_INPUTS, 1_000)!;
    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'SHORT', coreConfidence: 'ALTA', score: 70, councilStance: 'SHORT', plan, targetsHit: 0, inEntryZone: false });
    expect(deriveBiasLabel(d)).toBe('SHORT_BIAS');
    expect(deriveSetupState(d)).toBe('SHORT_SETUP');
    expect(deriveEntryState(d)).toBe('WAITING_FOR_RETEST');
    expect(deriveOutcomeLabel(d)).toBe('AGUARDAR SHORT');
  });

  it('exemplo INVÁLIDO da diretriz é estruturalmente IMPOSSÍVEL de produzir: nenhum insumo real gera "ENTRY: NO_ENTRY" junto de "LEITURA: SHORT — PLANO ATIVO" — varredura por todos os operationalState possíveis', () => {
    const plan = buildTradePlan(SHORT_PLAN_INPUTS, 1_000)!;
    // targetsHit/inEntryZone cobrem os 3 operationalState alcançáveis com plano real (CONFIRMANDO/EXECUTAVEL/GERENCIANDO)
    const combos: Array<{ targetsHit: number; inEntryZone: boolean }> = [
      { targetsHit: 0, inEntryZone: false }, // CONFIRMANDO
      { targetsHit: 0, inEntryZone: true }, // EXECUTAVEL
      { targetsHit: 1, inEntryZone: false }, // GERENCIANDO
    ];
    for (const combo of combos) {
      const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'SHORT', coreConfidence: 'ALTA', score: 70, councilStance: 'SHORT', plan, ...combo });
      const outcome = deriveOutcomeLabel(d);
      const entry = deriveEntryState(d);
      // a implicação central: sempre que a LEITURA promete um plano ativo, ENTRY já é ENTRY_CONFIRMED — nunca NO_ENTRY/WAITING_*/INVALIDATED
      if (outcome === 'LONG' || outcome === 'SHORT') {
        expect(entry).toBe('ENTRY_CONFIRMED');
      }
    }
    // e a via contrária: NO_ENTRY só nasce de fato quando não há plano real algum
    const noPlan = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'SHORT', coreConfidence: 'ALTA', score: 70, councilStance: 'SHORT', councilRiskGated: false, plan: null });
    expect(noPlan.plan).toBeNull();
    expect(deriveEntryState(noPlan)).toBe('NO_ENTRY');
    expect(deriveOutcomeLabel(noPlan)).not.toBe('SHORT'); // nunca "PLANO ATIVO" sem plano real
  });

  it('a mesma prova espelhada em LONG (nenhuma lógica bullish vaza para o lado bearish nem vice-versa)', () => {
    const plan = buildTradePlan(LONG_PLAN_INPUTS, 1_000)!;
    const combos: Array<{ targetsHit: number; inEntryZone: boolean }> = [
      { targetsHit: 0, inEntryZone: false },
      { targetsHit: 0, inEntryZone: true },
      { targetsHit: 1, inEntryZone: false },
    ];
    for (const combo of combos) {
      const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'LONG', coreConfidence: 'ALTA', score: 70, councilStance: 'LONG', plan, ...combo });
      const outcome = deriveOutcomeLabel(d);
      if (outcome === 'LONG' || outcome === 'SHORT') {
        expect(deriveEntryState(d)).toBe('ENTRY_CONFIRMED');
      }
    }
  });
});

describe('§7 Auditoria matemática do Trade Plan (RISK/REWARD/R:R) — geometria real, nenhum valor fabricado', () => {
  it('LONG: RISK = entryMid - stop; REWARD = target - entryMid; R:R = REWARD/RISK, exato por alvo', () => {
    const plan = buildTradePlan(LONG_PLAN_INPUTS, 1_000)!;
    const entryMid = (plan.entry.low + plan.entry.high) / 2;
    const risk = entryMid - plan.stop.price;
    expect(risk).toBeGreaterThan(0);
    plan.targets.forEach((t, i) => {
      const reward = t.price - entryMid;
      expect(reward).toBeGreaterThan(0);
      expect(plan.riskRewardRatios[i]).toBeCloseTo(reward / risk, 10);
    });
  });

  it('SHORT: RISK = stop - entryMid; REWARD = entryMid - target; R:R = REWARD/RISK, exato por alvo', () => {
    const plan = buildTradePlan(SHORT_PLAN_INPUTS, 1_000)!;
    const entryMid = (plan.entry.low + plan.entry.high) / 2;
    const risk = plan.stop.price - entryMid;
    expect(risk).toBeGreaterThan(0);
    plan.targets.forEach((t, i) => {
      const reward = entryMid - t.price;
      expect(reward).toBeGreaterThan(0);
      expect(plan.riskRewardRatios[i]).toBeCloseTo(reward / risk, 10);
    });
  });
});
