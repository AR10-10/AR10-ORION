// market-analysis.test.ts — Ordem "Market Analysis & Publication Engine":
// execução REAL de ponta a ponta (mesmo padrão de operational-readability.
// test.ts) — inputs reais → buildNexusDecision → buildMarketAnalysis →
// formatMarketAnalysisForX. Pura montagem/formatação de dado já real, mas
// a SELEÇÃO de campos (zona de interesse, retest, fail-closed) é lógica
// nova o bastante para justificar execução real, não só padrão de fonte.
import { describe, it, expect } from 'vitest';
import { buildNexusDecision, type NexusDecisionInputs } from '../src/nexus/decision-layer';
import { buildMarketAnalysis, formatMarketAnalysisForX, type MarketAnalysisInput } from '../src/nexus/market-analysis';
import type { TradePlan } from '../src/nexus/trade-plan';

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
  computedAt: 1_700_000_000_000,
};

const BASE_INPUTS: NexusDecisionInputs = {
  coreDirection: 'LONG',
  coreConfidence: 'ALTA',
  plan,
  targetsHit: 0,
  etaReading: null,
  score: 72,
  scoreZoneLabel: 'ZONA FORTE',
  scoreTrend: 'FORTALECENDO',
  councilStance: 'LONG',
  councilRiskGated: false,
  assistantMessage: null,
  inEntryZone: false, // + targetsHit:0 => operationalState CONFIRMANDO => entryState WAITING_FOR_RETEST
  lastResolvedAt: null,
  councilVotes: null,
  convictionMembers: null,
  heatTier: 'NORMAL',
  premiumDiscountZone: null,
};

const baseAnalysisInput = (overrides: Partial<MarketAnalysisInput> = {}): MarketAnalysisInput => ({
  symbol: 'BTCUSDT',
  timeframe: '1h',
  decision: buildNexusDecision(BASE_INPUTS, 1_700_000_000_000),
  regimeLabel: 'Tendência de Alta',
  structureLabel: 'BULLISH',
  support: 96,
  supportStrength: { label: 'FORTE', touches: 3 },
  resistance: 112,
  resistanceStrength: { label: 'FRACA', touches: 1 },
  livePrice: 100.5,
  ...overrides,
});

describe('buildMarketAnalysis: fail-closed total quando o Core Engine não tem leitura real', () => {
  it('decision null => análise null (DADOS INSUFICIENTES)', () => {
    expect(buildMarketAnalysis(baseAnalysisInput({ decision: null }))).toBeNull();
  });

  it('bias INSUFFICIENT_DATA (confidence/score ambos null) => análise null, nunca uma leitura parcial', () => {
    const decision = buildNexusDecision(
      { ...BASE_INPUTS, coreDirection: null, coreConfidence: null, score: null, plan: null, councilStance: null },
      1_700_000_000_000,
    );
    expect(buildMarketAnalysis(baseAnalysisInput({ decision }))).toBeNull();
  });
});

describe('buildMarketAnalysis: campos reais passam direto, zero segunda fórmula', () => {
  it('symbol/timeframe/generatedAt vêm do input e do decision.computedAt real — nunca Date.now() da UI', () => {
    const a = buildMarketAnalysis(baseAnalysisInput())!;
    expect(a.symbol).toBe('BTCUSDT');
    expect(a.timeframe).toBe('1h');
    expect(a.generatedAt).toBe(1_700_000_000_000);
  });

  it('plan reflete EXATAMENTE o Trade Plan real (entry/stop/targets), nunca recalculado', () => {
    const a = buildMarketAnalysis(baseAnalysisInput())!;
    expect(a.plan).toEqual({
      entryLow: 99,
      entryHigh: 100,
      entryBasis: 'OB_BULLISH',
      invalidationPrice: 95,
      invalidationBasis: 'SR_SUPPORT_1',
      targets: [
        { index: 0, price: 105, riskReward: 1.22, reached: false },
        { index: 1, price: 110, riskReward: 2.44, reached: false },
      ],
    });
  });

  it('sem plano real (planGap), plan é null e planGapLabel nomeia o motivo real — nunca um silêncio', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, plan: null, councilStance: 'NEUTRAL' }, 1_700_000_000_000);
    const a = buildMarketAnalysis(baseAnalysisInput({ decision }))!;
    expect(a.plan).toBeNull();
    expect(a.planGapLabel).toBe('Conselho neutro — sem plano acionável');
  });
});

describe('buildMarketAnalysis: RETESTE — só quando plano real existe E o timing genuinamente aguarda retorno ao nível', () => {
  it('plano existe, timing NÃO confirmado (fora da zona de entrada) => retest real com a MESMA cláusula de operational-readability.ts', () => {
    const a = buildMarketAnalysis(baseAnalysisInput())!;
    expect(a.retest).toEqual({
      low: 99,
      high: 100,
      condition: 'aguardando o preço retornar ao nível real mapeado',
      context: 'OB_BULLISH',
    });
  });

  it('timing JÁ confirmado (preço dentro da zona de entrada) => retest null, nunca uma região inventada', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, inEntryZone: true }, 1_700_000_000_000);
    const a = buildMarketAnalysis(baseAnalysisInput({ decision }))!;
    expect(a.retest).toBeNull();
  });

  it('sem plano real => retest null (nunca fabrica uma região de reteste sem estrutura real por trás)', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, plan: null, councilStance: 'NEUTRAL' }, 1_700_000_000_000);
    const a = buildMarketAnalysis(baseAnalysisInput({ decision }))!;
    expect(a.retest).toBeNull();
  });
});

describe('buildMarketAnalysis: Zona de Interesse — só níveis FORTES (mesmo gate do eixo do gráfico), o mais perto do preço vivo', () => {
  it('S1 forte + R1 fraca => só S1 entra (R1 fraca nunca vira zona de interesse)', () => {
    const a = buildMarketAnalysis(baseAnalysisInput())!;
    expect(a.zoneOfInterest).toEqual({ price: 96, label: 'S1', touches: 3 });
  });

  it('os dois fortes => vence o mais perto do preço vivo', () => {
    const a = buildMarketAnalysis(
      baseAnalysisInput({
        support: 96,
        supportStrength: { label: 'FORTE', touches: 3 },
        resistance: 101, // mais perto de 100.5 que 96 está
        resistanceStrength: { label: 'FORTE', touches: 2 },
        livePrice: 100.5,
      }),
    )!;
    expect(a.zoneOfInterest?.label).toBe('R1');
  });

  it('nenhum forte => zoneOfInterest null, nunca um nível fraco promovido a "interesse"', () => {
    const a = buildMarketAnalysis(
      baseAnalysisInput({
        supportStrength: { label: 'FRACA', touches: 1 },
        resistanceStrength: { label: 'FRACA', touches: 1 },
      }),
    )!;
    expect(a.zoneOfInterest).toBeNull();
  });

  it('fail-closed: sem preço vivo, mantém ordem determinística (S1 antes de R1) em vez de inventar distância', () => {
    const a = buildMarketAnalysis(
      baseAnalysisInput({
        supportStrength: { label: 'FORTE', touches: 3 },
        resistanceStrength: { label: 'FORTE', touches: 3 },
        livePrice: null,
      }),
    )!;
    expect(a.zoneOfInterest?.label).toBe('S1');
  });
});

describe('buildMarketAnalysis: corePlan — Ordem "Correção Definitiva do Market Analysis / Social Card" §5 (achado real: Conselho neutro escondia o fallback real do Núcleo)', () => {
  const noCouncilPlan = { plan: null, councilStance: 'NEUTRAL' as const };
  const realCoreFallback = { direction: 'LONG' as const, stop: 63800, target1: 66800, target2: 68200, target3: 70100, riskRewardRatio: 1.33 };

  it('Conselho sem plano + Núcleo com direção/stop/target1 reais => corePlan real, nunca null quando o dado existe', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, ...noCouncilPlan }, 1_700_000_000_000);
    const a = buildMarketAnalysis(baseAnalysisInput({ decision, coreFallback: realCoreFallback }))!;
    expect(a.plan).toBeNull();
    expect(a.corePlan).toEqual({ direction: 'LONG', stop: 63800, target1: 66800, target2: 68200, target3: 70100, riskRewardRatio: 1.33 });
  });

  it('Conselho TEM plano real => corePlan sempre null, mesmo com fallback do Núcleo disponível (Conselho sempre vence — mesma prioridade do gráfico ao vivo)', () => {
    const a = buildMarketAnalysis(baseAnalysisInput({ coreFallback: realCoreFallback }))!;
    expect(a.plan).not.toBeNull();
    expect(a.corePlan).toBeNull();
  });

  it('sem coreFallback repassado (chamador antigo) => corePlan null, nunca undefined tratado como dado', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, ...noCouncilPlan }, 1_700_000_000_000);
    const a = buildMarketAnalysis(baseAnalysisInput({ decision }))!;
    expect(a.corePlan).toBeNull();
  });

  it('Núcleo sem direção real (WAIT) => corePlan null, nunca fabricado a partir de direção ausente', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, ...noCouncilPlan, coreDirection: null }, 1_700_000_000_000);
    const a = buildMarketAnalysis(baseAnalysisInput({ decision, coreFallback: { ...realCoreFallback, direction: 'WAIT' } }))!;
    expect(a.corePlan).toBeNull();
  });

  it('Núcleo sem stop ou sem target1 finito => corePlan null (fail-closed: mínimo real exigido)', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, ...noCouncilPlan }, 1_700_000_000_000);
    expect(buildMarketAnalysis(baseAnalysisInput({ decision, coreFallback: { ...realCoreFallback, stop: null } }))!.corePlan).toBeNull();
    expect(buildMarketAnalysis(baseAnalysisInput({ decision, coreFallback: { ...realCoreFallback, target1: NaN } }))!.corePlan).toBeNull();
  });

  it('target2/target3/riskRewardRatio ausentes => corePlan real só com o que existe, nunca um número inventado para o resto', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, ...noCouncilPlan }, 1_700_000_000_000);
    const a = buildMarketAnalysis(
      baseAnalysisInput({ decision, coreFallback: { direction: 'LONG', stop: 63800, target1: 66800, target2: null, target3: undefined, riskRewardRatio: null } }),
    )!;
    expect(a.corePlan).toEqual({ direction: 'LONG', stop: 63800, target1: 66800, target2: null, target3: null, riskRewardRatio: null });
  });
});

describe('formatMarketAnalysisForX: texto público, zero jargão interno, vocabulário de cenário (§9)', () => {
  it('nunca vaza rótulos internos (LONG_BIAS/CONFIRMANDO/NEXUS_DECISION/etc.)', () => {
    const a = buildMarketAnalysis(baseAnalysisInput())!;
    const text = formatMarketAnalysisForX(a);
    expect(text).not.toContain('LONG_BIAS');
    expect(text).not.toContain('CONFIRMANDO');
    expect(text).not.toContain('NEXUS_DECISION');
    expect(text).not.toContain('WAITING_FOR_RETEST');
  });

  it('usa "Alvo/Cenário" e "Cenário de reteste" e "Invalidação do cenário" — nunca linguagem de garantia (§9)', () => {
    const a = buildMarketAnalysis(baseAnalysisInput())!;
    const text = formatMarketAnalysisForX(a);
    expect(text).toContain('Alvo/Cenário 1:');
    expect(text).toContain('Alvo/Cenário 2:');
    expect(text).toContain('Cenário de reteste:');
    expect(text).toContain('Invalidação do cenário:');
    expect(text).not.toMatch(/vai (bater|atingir|chegar)/i);
    expect(text).not.toMatch(/garantid/i);
  });

  it('symbol e timeframe reais abrem o texto', () => {
    const a = buildMarketAnalysis(baseAnalysisInput())!;
    const text = formatMarketAnalysisForX(a);
    expect(text.startsWith('BTCUSDT · 1H')).toBe(true);
  });

  it('sem plano real, omite Entry/Invalidação/Alvo e mostra o planGapLabel real — nunca inventa números', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, plan: null, councilStance: 'NEUTRAL' }, 1_700_000_000_000);
    const a = buildMarketAnalysis(baseAnalysisInput({ decision }))!;
    const text = formatMarketAnalysisForX(a);
    expect(text).not.toContain('Entry:');
    expect(text).not.toContain('Alvo/Cenário');
    expect(text).toContain('Plano: Conselho neutro — sem plano acionável');
  });

  it('disclaimer real fixo: confluência nunca é probabilidade, e o texto nunca promete retorno', () => {
    const a = buildMarketAnalysis(baseAnalysisInput())!;
    const text = formatMarketAnalysisForX(a);
    expect(text).toContain('confluência real, nunca probabilidade');
    expect(text).toContain('não é recomendação de investimento');
  });

  it('§5 da Ordem "Correção Definitiva": sem plano do Conselho mas com corePlan real, mostra o STOP/alvos do Núcleo rotulados "(Núcleo)" — nunca como se fosse o plano do Conselho', () => {
    const decision = buildNexusDecision({ ...BASE_INPUTS, plan: null, councilStance: 'NEUTRAL' }, 1_700_000_000_000);
    const a = buildMarketAnalysis(
      baseAnalysisInput({
        decision,
        coreFallback: { direction: 'LONG', stop: 63800, target1: 66800, target2: 68200, target3: null, riskRewardRatio: 1.33 },
      }),
    )!;
    const text = formatMarketAnalysisForX(a);
    expect(text).toContain('Plano (Núcleo, sem estrutura do Conselho ainda): Stop 63800');
    expect(text).toContain('Alvo (Núcleo) 1: 66800 · R:R 1:1.33');
    expect(text).toContain('Alvo (Núcleo) 2: 68200');
    expect(text).not.toContain('Entry:');
  });
});
