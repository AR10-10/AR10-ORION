// decision-quality-fase13-scenarios.test.ts — Diretriz de Evolução Profunda
// §13: os doze cenários nomeados de qualidade de decisão (A-L), cada um por
// EXECUÇÃO REAL contra o motor real correspondente — nunca uma nova camada
// de decisão. Cenários já cobertos em suítes existentes são REFERENCIADOS
// (comentário + apontamento do arquivo real), nunca duplicados (Diretriz
// §15, "Não duplicar" — o mesmo princípio já aplicado em toda a sessão).
import { describe, it, expect } from 'vitest';
import { buildTradePlan, type TradePlanInputs } from '../src/nexus/trade-plan';
import { buildNexusDecision, type NexusDecisionInputs } from '../src/nexus/decision-layer';
import { deriveOutcomeLabel, deriveSetupState } from '../src/nexus/operational-readability';

const DECISION_BASE: NexusDecisionInputs = {
  coreDirection: 'LONG',
  coreConfidence: 'ALTA',
  plan: null,
  targetsHit: 0,
  etaReading: null,
  score: 70,
  scoreZoneLabel: null,
  scoreTrend: null,
  councilStance: 'LONG',
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

describe('§13 Fase 13 — cenários A-L de qualidade de decisão', () => {
  it('A — LONG CONFIRMADO: BIAS LONG, SETUP LONG, ENTRY LONG, plano com TPs ordenados e R:R real', () => {
    const plan = buildTradePlan(LONG_PLAN_INPUTS, 1_000)!;
    expect(plan).not.toBeNull();
    // TPs ordenados e fora do preço de entrada (ENTRY < TP1 < TP2 < ...)
    for (let i = 0; i < plan.targets.length; i++) {
      expect(plan.targets[i].price).toBeGreaterThan((plan.entry.low + plan.entry.high) / 2);
      if (i > 0) expect(plan.targets[i].price).toBeGreaterThan(plan.targets[i - 1].price);
    }
    expect(plan.riskRewardRatios.every((r) => r !== null && r > 0)).toBe(true);

    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'LONG', plan, targetsHit: 1, councilStance: 'LONG' });
    expect(d.operation).toBe('LONG');
    expect(d.operationalState).toBe('GERENCIANDO');
    expect(deriveOutcomeLabel(d)).toBe('LONG'); // BIAS×ENTRY reconciliados => rótulo puro, entrada já confirmada
    expect(deriveSetupState(d)).toBe('LONG_SETUP');
  });

  it('B — SHORT CONFIRMADO: mesmo contrato em espelho, nenhuma fórmula própria por direção', () => {
    const plan = buildTradePlan(SHORT_PLAN_INPUTS, 1_000)!;
    expect(plan).not.toBeNull();
    for (let i = 0; i < plan.targets.length; i++) {
      expect(plan.targets[i].price).toBeLessThan((plan.entry.low + plan.entry.high) / 2);
      if (i > 0) expect(plan.targets[i].price).toBeLessThan(plan.targets[i - 1].price);
    }
    expect(plan.riskRewardRatios.every((r) => r !== null && r > 0)).toBe(true);

    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'SHORT', plan, targetsHit: 1, councilStance: 'SHORT' });
    expect(d.operation).toBe('SHORT');
    expect(d.operationalState).toBe('GERENCIANDO');
    expect(deriveOutcomeLabel(d)).toBe('SHORT');
    expect(deriveSetupState(d)).toBe('SHORT_SETUP');
  });

  it('C — BIAS LONG SEM ENTRADA: Núcleo direcional mas sem plano real => "AGUARDAR LONG", zero plano fabricado', () => {
    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'LONG', plan: null, councilStance: null, targetsHit: 0 });
    expect(d.plan).toBeNull();
    expect(d.operation).toBe('LONG');
    expect(deriveOutcomeLabel(d)).toBe('AGUARDAR LONG');
  });

  it('D — BIAS SHORT SEM ENTRADA: mesmo espelhado em SHORT', () => {
    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'SHORT', plan: null, councilStance: null, targetsHit: 0 });
    expect(d.plan).toBeNull();
    expect(d.operation).toBe('SHORT');
    expect(deriveOutcomeLabel(d)).toBe('AGUARDAR SHORT');
  });

  it('E — CONFLITO: BIAS LONG + plano real do Conselho em SHORT => DIRECTION_CONFLICT nomeado, NO PLAN renderizado', () => {
    const shortPlan = buildTradePlan(SHORT_PLAN_INPUTS, 1_000)!;
    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'LONG', plan: shortPlan });
    expect(d.operation).toBe('LONG'); // LEI 24: Núcleo nunca é bloqueado pelo conflito
    expect(d.plan).toBeNull();
    expect(d.planGap).toBe('DIRECTION_CONFLICT');
    expect(deriveSetupState(d)).toBe('INVALIDATED');
  });

  it('F — DADOS INSUFICIENTES: sem confiança/score reais, o contrato mostra DASH honesto — zero LONG/SHORT fabricado por falta de dado', () => {
    const d = buildNexusDecision({
      ...DECISION_BASE,
      coreDirection: null,
      coreConfidence: null,
      plan: null,
      score: null,
      scoreZoneLabel: null,
      scoreTrend: null,
      councilStance: null,
    });
    expect(d.operation).toBe('AGUARDAR'); // nunca um LONG/SHORT inventado sem leitura real do Núcleo
    expect(d.confidenceLabel).toBeNull();
    expect(d.score).toBeNull();
  });

  it('G — TP INVÁLIDO: a estrutura garante R:R > 0 por construção (entry sempre do lado do pullback, target sempre do lado oposto); trade-plan.ts filtra qualquer alvo com R:R <= 0 como trava defensiva adicional — nenhum alvo com recompensa não-positiva jamais aparece no plano', () => {
    const longPlan = buildTradePlan(LONG_PLAN_INPUTS, 1_000)!;
    const shortPlan = buildTradePlan(SHORT_PLAN_INPUTS, 1_000)!;
    for (const plan of [longPlan, shortPlan]) {
      expect(plan.targets.length).toBeGreaterThan(0);
      expect(plan.riskRewardRatios).toHaveLength(plan.targets.length);
      expect(plan.riskRewardRatios.every((r) => typeof r === 'number' && r > 0)).toBe(true);
    }
  });

  it('H — STOP INVÁLIDO: sem nível real além da entrada (nenhuma invalidação coerente), o plano inteiro é rejeitado — nunca um stop fabricado', () => {
    const plan = buildTradePlan({
      ...LONG_PLAN_INPUTS,
      levels: LONG_PLAN_INPUTS.levels.filter((l) => l.price > 50_000), // nada abaixo da entrada => sem invalidação real
    });
    expect(plan).toBeNull();
  });

  // I — R:R INSUFICIENTE: DEFERIDO deliberadamente. Rejeitar/aguardar um
  // plano por R:R "insuficiente" exigiria um limiar mínimo inventado — a
  // mesma armadilha que a Regra de Ouro 2 e a disciplina desta sessão já
  // evitaram para "probabilidade" (nenhum número calibrado sem base real).
  // Diferente de "R:R <= 0" (item G, geometria quebrada, sem ambiguidade),
  // "insuficiente" é uma decisão de risco do Operador — mesma fronteira já
  // documentada em TradePlanTopStrip ("qual sinal trava o Trade Plan é
  // território do Operador"). Não implementado sem esse número vir do
  // Operador.

  // J/K/L (troca de ativo, troca de timeframe, reload) — já cobertos por
  // execução real/padrão de fonte em tests/refinamento-final-wiring.test.ts
  // ("Evolução Profunda §11/§13-J/K: ...") e tests/chart-history-
  // pagination.test.ts (efeito [selectedAsset]); reload/rehidratação em
  // tests/nexus-signal-track-record.test.ts ("rehydrate rejects garbage...",
  // "an OPEN plan from a dead session is counted superseded..."). Não
  // duplicados aqui.
});
