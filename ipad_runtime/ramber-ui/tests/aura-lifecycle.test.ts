// aura-lifecycle.test.ts — Neural Market Aura, motor puro de tradução
// visual (ver cabeçalho de aura-lifecycle.ts para o racional completo).
// Real-execution tests: constrói TrackRecordState/TrackedPlan/TradePlan no
// formato REAL de signal-track-record.ts/trade-plan.ts e chama a função de
// produção.
import { describe, it, expect } from 'vitest';
import { computeAuraReading } from '../src/nexus/aura-lifecycle';
import type { TradePlan } from '../src/nexus/trade-plan';
import type { TrackedPlan, TrackRecordState } from '../src/nexus/signal-track-record';
import { EMPTY_TRACK_RECORD } from '../src/nexus/signal-track-record';

const T0 = 1_700_000_000_000; // ms
const BAR_MS = 15 * 60_000; // 15m timeframe, mesma convenção do resto da suíte

function plan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    contractVersion: 1,
    direction: 'LONG',
    entry: { low: 98, high: 100, basis: 'OB_BULLISH' },
    stop: { price: 95, basis: 'SR_SUPPORT_1' },
    target: { price: 110, basis: 'SR_RESISTANCE_1' },
    riskRewardRatio: 2,
    computedAt: T0,
    ...overrides,
  };
}

function tracked(overrides: Partial<TrackedPlan> = {}): TrackedPlan {
  return {
    plan: plan(),
    openedAt: T0,
    status: 'OPEN',
    resolvedAt: null,
    resolvedPrice: null,
    ...overrides,
  };
}

function stateWithActive(t: TrackedPlan): TrackRecordState {
  return { ...EMPTY_TRACK_RECORD, active: t };
}

function stateWithHistory(t: TrackedPlan): TrackRecordState {
  return { ...EMPTY_TRACK_RECORD, active: null, history: [t] };
}

describe('computeAuraReading: fail-closed sem plano real rastreado', () => {
  it('TrackRecordState vazio (nunca houve plano) => DADOS_INSUFICIENTES', () => {
    const r = computeAuraReading({ trackRecord: EMPTY_TRACK_RECORD, livePrice: 100, conviction: 0.8, atrPercent: 1, timeframeMs: BAR_MS, now: T0 });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('nenhum_trade_plan_real_rastreado_nesta_janela');
    expect(r.plan).toBeNull();
  });

  it('timeframeMs inválido (0 ou negativo) => DADOS_INSUFICIENTES mesmo com plano real', () => {
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked()), livePrice: 100, conviction: 0.8, atrPercent: 1, timeframeMs: 0, now: T0 });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('timeframe_real_indisponivel_para_medir_idade_em_barras');
  });
});

describe('computeAuraReading: ciclo de vida real (Nascimento -> Estabelecido)', () => {
  it('plano recém-aberto (idade 0) => fase BIRTH, fadeAlpha 0 mas status OK (é real, só ainda não rampou)', () => {
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked({ openedAt: T0 })), livePrice: 100, conviction: 0.8, atrPercent: 1, timeframeMs: BAR_MS, now: T0 });
    expect(r.status).toBe('OK');
    expect(r.phase).toBe('BIRTH');
    expect(r.fadeAlpha).toBe(0);
    expect(r.plan).not.toBeNull();
  });

  it('metade da rampa de nascimento (1.5 de 3 barras) => fadeAlpha real 0.5', () => {
    const r = computeAuraReading({
      trackRecord: stateWithActive(tracked({ openedAt: T0 })),
      livePrice: 100, conviction: 0.8, atrPercent: 1, timeframeMs: BAR_MS,
      now: T0 + 1.5 * BAR_MS,
    });
    expect(r.phase).toBe('BIRTH');
    expect(r.fadeAlpha).toBeCloseTo(0.5, 10);
  });

  it('após a rampa (>= 3 barras, plano ainda OPEN) => fase ESTABLISHED, fadeAlpha 1', () => {
    const r = computeAuraReading({
      trackRecord: stateWithActive(tracked({ openedAt: T0 })),
      livePrice: 100, conviction: 0.8, atrPercent: 1, timeframeMs: BAR_MS,
      now: T0 + 5 * BAR_MS,
    });
    expect(r.phase).toBe('ESTABLISHED');
    expect(r.fadeAlpha).toBe(1);
  });
});

describe('computeAuraReading: corredor de convicção = massa real do Confluence Engine', () => {
  it('corridorWidthFactor ecoa a convicção real 1:1 (0..1), nunca recalculada', () => {
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked()), livePrice: 100, conviction: 0.37, atrPercent: 1, timeframeMs: BAR_MS, now: T0 + 5 * BAR_MS });
    expect(r.corridorWidthFactor).toBeCloseTo(0.37, 10);
  });

  it('conviction null (subsistemas sem leitura real) => corridorWidthFactor null, nunca um valor fabricado', () => {
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked()), livePrice: 100, conviction: null, atrPercent: 1, timeframeMs: BAR_MS, now: T0 + 5 * BAR_MS });
    expect(r.corridorWidthFactor).toBeNull();
  });
});

describe('computeAuraReading: Market Pulse = ATR% real normalizado, nunca uma segunda medição', () => {
  it('ATR 1.5% (metade do teto de saturação 3%) => pulseIntensity real 0.5', () => {
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked()), livePrice: 100, conviction: 0.5, atrPercent: 1.5, timeframeMs: BAR_MS, now: T0 + 5 * BAR_MS });
    expect(r.pulseIntensity).toBeCloseTo(0.5, 10);
  });

  it('ATR acima do teto (5%) satura em 1, nunca ultrapassa', () => {
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked()), livePrice: 100, conviction: 0.5, atrPercent: 5, timeframeMs: BAR_MS, now: T0 + 5 * BAR_MS });
    expect(r.pulseIntensity).toBe(1);
  });

  it('atrPercent null (regime ainda sem leitura real) => pulseIntensity null', () => {
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked()), livePrice: 100, conviction: 0.5, atrPercent: null, timeframeMs: BAR_MS, now: T0 + 5 * BAR_MS });
    expect(r.pulseIntensity).toBeNull();
  });
});

describe('computeAuraReading: proximidade real do alvo, escalada por ATR real', () => {
  it('preço distante do alvo (fora da banda ATR-escalada) => WAITING', () => {
    // alvo 110, preço 100: distância real 9.09%; ATR 1% * 0.5 = 0.5% de banda — bem fora.
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked()), livePrice: 100, conviction: 0.5, atrPercent: 1, timeframeMs: BAR_MS, now: T0 + 5 * BAR_MS });
    expect(r.targetProximity).toBe('WAITING');
  });

  it('preço real dentro da banda ATR-escalada do alvo => APPROACHING', () => {
    // alvo 110, ATR 4% -> banda 2%. Preço 109 está a ~0.91% do alvo — dentro.
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked()), livePrice: 109, conviction: 0.5, atrPercent: 4, timeframeMs: BAR_MS, now: T0 + 5 * BAR_MS });
    expect(r.targetProximity).toBe('APPROACHING');
  });

  it('sem ATR real medido ainda => WAITING honesto, nunca um palpite de proximidade', () => {
    const r = computeAuraReading({ trackRecord: stateWithActive(tracked()), livePrice: 109.9, conviction: 0.5, atrPercent: null, timeframeMs: BAR_MS, now: T0 + 5 * BAR_MS });
    expect(r.targetProximity).toBe('WAITING');
  });

  it('fase TARGET_HIT => targetProximity HIT sempre, independente do preço', () => {
    const r = computeAuraReading({
      trackRecord: stateWithHistory(tracked({ status: 'TARGET_HIT', resolvedAt: T0 + 5 * BAR_MS, resolvedPrice: 110 })),
      livePrice: 200, conviction: 0.5, atrPercent: 1, timeframeMs: BAR_MS, now: T0 + 6 * BAR_MS,
    });
    expect(r.phase).toBe('TARGET_HIT');
    expect(r.targetProximity).toBe('HIT');
  });
});

describe('computeAuraReading: dissolução real após resolução (reaproveita ageAlpha)', () => {
  it('logo após TARGET_HIT (dentro de fadeStartCandles=2) => fadeAlpha 1, ainda totalmente visível', () => {
    const r = computeAuraReading({
      trackRecord: stateWithHistory(tracked({ status: 'TARGET_HIT', resolvedAt: T0, resolvedPrice: 110 })),
      livePrice: 110, conviction: 0.5, atrPercent: 1, timeframeMs: BAR_MS, now: T0 + 1 * BAR_MS,
    });
    expect(r.status).toBe('OK');
    expect(r.fadeAlpha).toBe(1);
  });

  it('no meio da janela de dissolução => fadeAlpha real entre minAlpha e 1 (esmaecendo)', () => {
    const r = computeAuraReading({
      trackRecord: stateWithHistory(tracked({ status: 'STOP_HIT', resolvedAt: T0, resolvedPrice: 95 })),
      livePrice: 95, conviction: 0.5, atrPercent: 1, timeframeMs: BAR_MS, now: T0 + 7 * BAR_MS,
    });
    expect(r.status).toBe('OK');
    expect(r.fadeAlpha).toBeGreaterThan(0);
    expect(r.fadeAlpha).toBeLessThan(1);
  });

  it('além da janela de dissolução (>= 12 barras) => DADOS_INSUFICIENTES honesto (esquecida da tela)', () => {
    const r = computeAuraReading({
      trackRecord: stateWithHistory(tracked({ status: 'REPLACED', resolvedAt: T0, resolvedPrice: null })),
      livePrice: 100, conviction: 0.5, atrPercent: 1, timeframeMs: BAR_MS, now: T0 + 20 * BAR_MS,
    });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('aura_dissolvida_apos_resolucao_real');
  });

  it('REPLACED usa a fase real REPLACED (nunca confundida com TARGET_HIT/STOP_HIT)', () => {
    const r = computeAuraReading({
      trackRecord: stateWithHistory(tracked({ status: 'REPLACED', resolvedAt: T0, resolvedPrice: null })),
      livePrice: 100, conviction: 0.5, atrPercent: 1, timeframeMs: BAR_MS, now: T0 + 1 * BAR_MS,
    });
    expect(r.phase).toBe('REPLACED');
  });
});

describe('computeAuraReading: prioriza o plano ATIVO sobre o histórico', () => {
  it('com active presente, ignora history mesmo que exista', () => {
    const state: TrackRecordState = {
      ...EMPTY_TRACK_RECORD,
      active: tracked({ plan: plan({ direction: 'LONG' }) }),
      history: [tracked({ status: 'STOP_HIT', plan: plan({ direction: 'SHORT' }), resolvedAt: T0 })],
    };
    const r = computeAuraReading({ trackRecord: state, livePrice: 100, conviction: 0.5, atrPercent: 1, timeframeMs: BAR_MS, now: T0 + 5 * BAR_MS });
    expect(r.phase).toBe('ESTABLISHED');
    expect(r.plan?.direction).toBe('LONG');
  });
});
