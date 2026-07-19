// decision-quality-omega-core.test.ts — Diretriz de Evolução Global (Omega
// Core) §16: os doze testes de qualidade de decisão, cada um travado por
// EXECUÇÃO REAL contra o motor real que já garante (ou passa a garantir,
// no caso do item 8) a propriedade — nunca uma nova camada de decisão.
//
// Este arquivo não introduz matemática nova: ele nomeia, num único lugar,
// doze garantias que hoje vivem espalhadas em trade-plan.ts/decision-
// layer.ts/council.ts/fractal-swings.js/nexus-line.ts — a maioria já
// provada por testes próprios (referenciados abaixo), uma delas (item 8)
// fechada nesta mesma diretriz via decision-layer.ts (DIRECTION_CONFLICT).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildTradePlan, type TradePlanInputs } from '../src/nexus/trade-plan';
import { buildNexusDecision, NEXUS_PLAN_GAP_LABEL, type NexusDecisionInputs, type NexusPlanGap } from '../src/nexus/decision-layer';
import { aggregateCouncil, type CouncilVote } from '../src/nexus/council';
import { findSwings } from '../../src/research/engines/fractal-swings.js';

const app = () => readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

const PLAN_BASE: TradePlanInputs = {
  stance: 'LONG',
  riskGated: false,
  price: 50_000,
  zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
  levels: [
    { price: 48_800, kind: 'SR_SUPPORT_1' },
    { price: 51_000, kind: 'SR_RESISTANCE_1' },
  ],
};

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

describe('§16 Omega Core — doze testes de qualidade de decisão', () => {
  it('1) não força entrada: sem estrutura real de suporte no lado da entrada, nenhum plano é criado', () => {
    expect(buildTradePlan({ ...PLAN_BASE, zones: [], levels: PLAN_BASE.levels.filter((l) => l.price > 50_000) })).toBeNull();
  });

  it('2) não cria TP sem justificativa: sem nível real oposto mapeado, nenhum alvo é fabricado (targets nunca > níveis reais)', () => {
    expect(buildTradePlan({ ...PLAN_BASE, levels: PLAN_BASE.levels.filter((l) => l.price < 50_000) })).toBeNull();
    // e quando existe estrutura real, targets.length nunca excede o que foi de fato mapeado
    const plan = buildTradePlan(PLAN_BASE, 1_000)!;
    expect(plan.targets.length).toBe(PLAN_BASE.levels.filter((l) => l.price > 50_000).length);
  });

  it('3) não cria stop impossível: sem nível real além da entrada (invalidação coerente), nenhum plano é criado', () => {
    expect(buildTradePlan({
      ...PLAN_BASE,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
      levels: [{ price: 51_000, kind: 'SR_RESISTANCE_1' }], // nada abaixo da entrada
    })).toBeNull();
  });

  it('4) não mistura timeframes: trade-plan.ts é puro e nunca importa a Matriz Multi-Timeframe — todos os níveis vêm de UM ciclo real do App (mesmo prazo do gráfico)', () => {
    const src = readFileSync(new URL('../src/nexus/trade-plan.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/multiTimeframe|multi-timeframe-engine/i);
    // e o único call-site real monta os inputs a partir das MESMAS leituras do prazo ativo (engine?.support/resistance, smcZones, fibonacciMatrix, volumeProfileSnapshot) — nunca da Matriz
    const a = app();
    const call = a.match(/buildTradePlan\(\{[\s\S]*?\}\),/);
    expect(call).not.toBeNull();
    expect(call![0]).not.toMatch(/multiTimeframeContext/);
  });

  it('5) não usa dados futuros: um swing só confirma depois de K candles de confirmação de cada lado (fractal-swings.js, base compartilhada de todo motor novo)', () => {
    const candles = [1, 2, 3, 4, 3, 2, 1].map((h) => ({ h, l: h }));
    const swings = findSwings(candles, 2, true) as Array<{ index: number; price: number }>;
    expect(swings).toEqual([{ index: 3, price: 4 }]);
    // estrutural: o laço nunca alcança um índice sem os K candles de confirmação à frente ainda existirem na série
    for (const s of swings) expect(s.index).toBeLessThan(candles.length - 2);
  });

  it('6) não repinta: mesmos inputs produzem exatamente o mesmo NexusDecision (nenhum campo se redesenha silenciosamente entre ciclos idênticos)', () => {
    const a = buildNexusDecision(DECISION_BASE, 1_000);
    const b = buildNexusDecision(DECISION_BASE, 1_000);
    expect(a).toEqual(b);
  });

  it('7) não usa dado ausente como confirmação: agreesWithCore null (sem leitura real) nunca entra em Favoráveis nem Contrários', () => {
    const d = buildNexusDecision({
      ...DECISION_BASE,
      convictionMembers: [{ id: 'MULTI_TIMEFRAME', agreesWithCore: null, detail: 'sem leitura real nesta janela' }],
    });
    expect(d.reasonsFor.some((r) => r.includes('MULTI_TIMEFRAME'))).toBe(false);
    expect(d.reasonsAgainst.some((r) => r.includes('MULTI_TIMEFRAME'))).toBe(false);
  });

  it('8) não permite LONG e SHORT simultâneos: plano do Conselho na direção oposta à operação do Núcleo nunca é renderizado — vira DIRECTION_CONFLICT nomeado', () => {
    const shortPlan = buildTradePlan({ ...PLAN_BASE, stance: 'SHORT', zones: [{ low: 51_500, high: 51_800, kind: 'OB_BEARISH' }], levels: [{ price: 52_200, kind: 'SR_RESISTANCE_1' }, { price: 48_800, kind: 'SR_SUPPORT_1' }] }, 1_000)!;
    expect(shortPlan.direction).toBe('SHORT');
    const d = buildNexusDecision({ ...DECISION_BASE, coreDirection: 'LONG', plan: shortPlan });
    expect(d.operation).toBe('LONG'); // LEI 24: o Núcleo nunca é bloqueado
    expect(d.plan).toBeNull(); // mas o plano contraditório nunca é exibido junto
    expect(d.planGap).toBe('DIRECTION_CONFLICT');
  });

  it('9) não gera plano com confluência insuficiente: RISK real (não travado) mas ZERO agentes direcionais com leitura (quórum 0) já é o gate real — ABSTAIN, nunca um plano', () => {
    const votes: CouncilVote[] = [
      { agent: 'RISK', stance: 'NEUTRAL', confidence: 1, rationale: 'condições operacionais normais', evidence: [] },
      { agent: 'LIQUIDITY', stance: 'ABSTAIN', confidence: null, rationale: 'sem dado real nesta janela', evidence: [] },
      { agent: 'STRUCTURE', stance: 'ABSTAIN', confidence: null, rationale: 'sem dado real nesta janela', evidence: [] },
    ];
    const decision = aggregateCouncil(votes, 1_000);
    expect(decision.riskGated).toBe(false); // isola de RISK_GATED — o gate aqui é falta de confluência, não risco
    expect(decision.stance).toBe('ABSTAIN');
    expect(decision.quorum).toBe(0);
    expect(buildTradePlan({ ...PLAN_BASE, stance: decision.stance as 'LONG' | 'SHORT' | 'NEUTRAL' | 'ABSTAIN' })).toBeNull();
  });

  it('10) explica AGUARDAR: todo código de planGap (inclusive DIRECTION_CONFLICT) tem um rótulo real e não-vazio — nunca um traço mudo com causa conhecida', () => {
    const gaps: NexusPlanGap[] = ['AWAITING_COUNCIL', 'RISK_GATED', 'COUNCIL_NEUTRAL', 'NO_STRUCTURE', 'DIRECTION_CONFLICT'];
    for (const g of gaps) {
      expect(NEXUS_PLAN_GAP_LABEL[g]).toBeTruthy();
      expect(NEXUS_PLAN_GAP_LABEL[g].length).toBeGreaterThan(5);
    }
  });

  it('11) simetria LONG/SHORT: a mesma geometria espelhada produz o mesmo R:R em magnitude — nenhuma direção recebe fórmula própria', () => {
    const long = buildTradePlan({
      stance: 'LONG', riskGated: false, price: 100,
      zones: [{ low: 95, high: 96, kind: 'OB_BULLISH' }],
      levels: [{ price: 90, kind: 'SR_SUPPORT_1' }, { price: 110, kind: 'SR_RESISTANCE_1' }],
    }, 1_000)!;
    const short = buildTradePlan({
      stance: 'SHORT', riskGated: false, price: 100,
      zones: [{ low: 104, high: 105, kind: 'OB_BEARISH' }],
      levels: [{ price: 110, kind: 'SR_RESISTANCE_1' }, { price: 90, kind: 'SR_SUPPORT_1' }],
    }, 1_000)!;
    expect(long.riskRewardRatios[0]).not.toBeNull();
    expect(short.riskRewardRatios[0]).not.toBeNull();
    expect(long.riskRewardRatios[0]!).toBeCloseTo(short.riskRewardRatios[0]!, 6);
  });

  it('12) mesma decisão em todos os consumidores: buildNexusDecision tem exatamente UM call-site real (App.tsx) — todo widget lê o mesmo contrato, nunca uma segunda fusão', () => {
    const a = app();
    const calls = a.match(/buildNexusDecision\(/g) ?? [];
    expect(calls.length).toBe(1);
  });
});
