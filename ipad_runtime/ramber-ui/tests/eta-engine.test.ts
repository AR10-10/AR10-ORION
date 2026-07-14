// eta-engine.test.ts — Diretriz Complementar (Nexus Predictive Engine) §3:
// execução real de nexus/eta-engine.ts. Fixtures no formato REAL de
// TradePlan (buildTradePlan de verdade, nunca objeto de decisão montado à
// mão), referências matemáticas independentes calculadas no próprio teste.
import { describe, it, expect } from 'vitest';
import {
  computeSignedEfficiencyRatio,
  computeTargetEtas,
  formatEtaDuration,
  EFFICIENCY_RATIO_PERIOD,
  MAX_ETA_BARS,
} from '../src/nexus/eta-engine';
import { buildTradePlan } from '../src/nexus/trade-plan';

const BAR_MS = 15 * 60_000; // 15m

// Plano LONG real com 2 alvos (51.000 e 52.200), mesmo fixture da suíte v2.
const plan = buildTradePlan({
  stance: 'LONG',
  riskGated: false,
  price: 50_000,
  zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
  levels: [
    { price: 48_800, kind: 'SR_SUPPORT_1' },
    { price: 51_000, kind: 'SR_RESISTANCE_1' },
    { price: 52_200, kind: 'EQH' },
  ],
})!;

const shortPlan = buildTradePlan({
  stance: 'SHORT',
  riskGated: false,
  price: 50_000,
  zones: [{ low: 50_500, high: 50_800, kind: 'OB_BEARISH' }],
  levels: [
    { price: 51_400, kind: 'FIB_78.6' },
    { price: 49_000, kind: 'SR_SUPPORT_1' },
  ],
})!;

// Série perfeitamente direcional para cima: ER assinado = +1 exato.
const trendingUp = Array.from({ length: 30 }, (_, i) => 49_000 + i * 100);
// Série perfeitamente direcional para baixo: ER assinado = −1 exato.
const trendingDown = Array.from({ length: 30 }, (_, i) => 51_000 - i * 100);

describe('computeSignedEfficiencyRatio: definição real de Kaufman, assinada', () => {
  it('mercado perfeitamente direcional para cima => exatamente +1', () => {
    expect(computeSignedEfficiencyRatio(trendingUp)).toBe(1);
  });

  it('mercado perfeitamente direcional para baixo => exatamente −1', () => {
    expect(computeSignedEfficiencyRatio(trendingDown)).toBe(-1);
  });

  it('bate com a referência independente numa série mista (net / Σ|Δ|)', () => {
    const closes = [100, 102, 101, 104, 103, 106, 105, 108, 107, 110, 109];
    // janela = últimos period+1 = a série inteira (11 valores, period 10)
    const net = 109 - 100;
    let sum = 0;
    for (let i = 1; i < closes.length; i++) sum += Math.abs(closes[i] - closes[i - 1]);
    expect(computeSignedEfficiencyRatio(closes)).toBeCloseTo(net / sum, 12);
  });

  it('usa só a janela final (period+1 closes) — histórico mais velho não muda a leitura', () => {
    const tail = trendingUp.slice(-(EFFICIENCY_RATIO_PERIOD + 1));
    expect(computeSignedEfficiencyRatio(trendingUp)).toBe(computeSignedEfficiencyRatio(tail));
  });

  it('mercado exatamente parado (Σ|Δ| = 0) => 0 real, nunca NaN/erro', () => {
    expect(computeSignedEfficiencyRatio(Array.from({ length: 20 }, () => 100))).toBe(0);
  });

  it('FAIL_CLOSED: closes insuficientes (< period+1) ou período inválido => null', () => {
    expect(computeSignedEfficiencyRatio(trendingUp.slice(0, EFFICIENCY_RATIO_PERIOD))).toBeNull();
    expect(computeSignedEfficiencyRatio(trendingUp, 0)).toBeNull();
    expect(computeSignedEfficiencyRatio(trendingUp, NaN)).toBeNull();
  });

  it('closes não-finitos são filtrados, nunca corrompem a soma', () => {
    const withNaN = [...trendingUp.slice(0, 5), NaN, ...trendingUp.slice(5)];
    expect(computeSignedEfficiencyRatio(withNaN)).toBe(1);
  });
});

describe('computeTargetEtas: barras = distância / (ATR_abs × ER direcional) — matemática exata', () => {
  const base = {
    plan,
    targetsHit: 0,
    livePrice: 50_000,
    atrPercent: 1, // ATR_abs = 500 a preço 50.000
    closes: trendingUp,
    timeframeMs: BAR_MS,
    now: 7,
  };

  it('LONG em mercado perfeitamente direcional: ETA exata por alvo, ms = bars × timeframe', () => {
    const r = computeTargetEtas(base);
    expect(r.status).toBe('OK');
    expect(r.directionalEfficiency).toBe(1);
    expect(r.atrAbsolute).toBeCloseTo(500, 10);
    expect(r.etas).toHaveLength(2);
    // alvo 1 @ 51.000: distância 1.000 / (500 × 1) = 2 barras
    expect(r.etas[0]!.bars).toBeCloseTo(2, 10);
    expect(r.etas[0]!.ms).toBeCloseTo(2 * BAR_MS, 6);
    // alvo 2 @ 52.200: distância 2.200 / 500 = 4,4 barras
    expect(r.etas[1]!.bars).toBeCloseTo(4.4, 10);
    expect(r.computedAt).toBe(7);
  });

  it('ER parcial reduz a velocidade real: eficiência menor => proporcionalmente mais barras', () => {
    // Zigue-zague real: +100 depois −50, repetido — ambos os sinais
    // presentes, então 0 < ER < 1 por construção.
    const zigzag: number[] = [50_000];
    for (let i = 0; i < EFFICIENCY_RATIO_PERIOD / 2; i++) {
      const up = zigzag[zigzag.length - 1] + 100;
      zigzag.push(up, up - 50);
    }
    const er = computeSignedEfficiencyRatio(zigzag)!;
    expect(er).toBeGreaterThan(0);
    expect(er).toBeLessThan(1);
    const r = computeTargetEtas({ ...base, closes: zigzag, livePrice: 50_000 });
    expect(r.etas[0]!.bars).toBeCloseTo(1_000 / (500 * er), 8);
  });

  it('SHORT espelha: ER de série descendente vira eficiência direcional POSITIVA para o plano SHORT', () => {
    const r = computeTargetEtas({ ...base, plan: shortPlan, closes: trendingDown });
    expect(r.directionalEfficiency).toBe(1);
    // alvo SHORT @ 49.000: distância 1.000 / 500 = 2 barras
    expect(r.etas[0]!.bars).toBeCloseTo(2, 10);
  });

  it('mercado afastando-se do alvo (ER direcional <= 0) => etas null honestos + reason, nunca um número fabricado', () => {
    const r = computeTargetEtas({ ...base, closes: trendingDown }); // LONG com mercado caindo
    expect(r.status).toBe('OK');
    expect(r.directionalEfficiency).toBe(-1);
    expect(r.etas.every((e) => e === null)).toBe(true);
    expect(r.reason).toBe('sem_progresso_direcional_real_na_janela');
  });

  it('alvo já provado pelo ratchet real (targetsHit) => null naquele índice, estimativa só para o restante', () => {
    const r = computeTargetEtas({ ...base, targetsHit: 1, livePrice: 51_200 });
    expect(r.etas[0]).toBeNull(); // alvo 1 já atingido
    expect(r.etas[1]).not.toBeNull(); // alvo 2 @ 52.200: 1.000 / (512 × 1)
    expect(r.etas[1]!.bars).toBeCloseTo(1_000 / (0.01 * 51_200), 8);
  });

  it('preço já no/além do alvo neste tick => 0 barras real (não um chute, não um erro)', () => {
    const r = computeTargetEtas({ ...base, livePrice: 51_500 }); // acima do alvo 1
    expect(r.etas[0]!.bars).toBe(0);
    expect(r.etas[0]!.ms).toBe(0);
  });

  it('além do horizonte honesto (> MAX_ETA_BARS) => null, nunca uma extrapolação sem significado', () => {
    // ER ínfimo REAL: mercado quase todo ruído com viés mínimo pra cima
    // (+100 / −99,9 alternando) — ER ~ 0,0005, não a magnitude do drift
    // (ER mede eficiência; um drift minúsculo monotônico teria ER 1).
    const choppy: number[] = [50_000];
    for (let i = 0; i < EFFICIENCY_RATIO_PERIOD / 2; i++) {
      const up = choppy[choppy.length - 1] + 100;
      choppy.push(up, up - 99.9);
    }
    const r = computeTargetEtas({ ...base, closes: choppy, livePrice: 50_000 });
    expect(r.directionalEfficiency).toBeGreaterThan(0);
    expect(r.directionalEfficiency!).toBeLessThan(0.01);
    expect(r.etas[0]).toBeNull();
    expect(MAX_ETA_BARS).toBe(500);
  });

  it('FAIL_CLOSED: sem plano / sem preço / sem ATR / sem timeframe / closes curtos => DADOS_INSUFICIENTES com reason', () => {
    expect(computeTargetEtas({ ...base, plan: null }).reason).toBe('sem_trade_plan_real_ativo');
    expect(computeTargetEtas({ ...base, livePrice: null }).reason).toBe('sem_preco_real');
    expect(computeTargetEtas({ ...base, atrPercent: null }).reason).toBe('atr_real_ainda_nao_medido');
    expect(computeTargetEtas({ ...base, atrPercent: 0 }).reason).toBe('atr_real_ainda_nao_medido');
    expect(computeTargetEtas({ ...base, timeframeMs: 0 }).reason).toBe('timeframe_real_indisponivel');
    expect(computeTargetEtas({ ...base, closes: [1, 2, 3] }).reason).toBe('closes_insuficientes_para_efficiency_ratio');
  });

  it('determinística: mesmos insumos, mesma leitura', () => {
    expect(computeTargetEtas(base)).toEqual(computeTargetEtas(base));
  });

  it('toda estimativa carrega basis real com o aviso "nunca garantia" (§8 da diretriz)', () => {
    const r = computeTargetEtas(base);
    for (const eta of r.etas) {
      if (eta && eta.bars > 0) expect(eta.basis).toContain('nunca garantia');
    }
  });
});

describe('formatEtaDuration: o formato dos exemplos da própria diretriz (≈ 35m / ≈ 1h40 / ≈ 4h20)', () => {
  it('minutos', () => {
    expect(formatEtaDuration(35 * 60_000)).toBe('≈ 35m');
  });

  it('horas com minutos zero-padded, exatamente como "1h40"', () => {
    expect(formatEtaDuration(100 * 60_000)).toBe('≈ 1h40');
    expect(formatEtaDuration(260 * 60_000)).toBe('≈ 4h20');
    expect(formatEtaDuration(605 * 60_000)).toBe('≈ 10h05');
  });

  it('hora exata omite os minutos', () => {
    expect(formatEtaDuration(120 * 60_000)).toBe('≈ 2h');
  });

  it('dias', () => {
    expect(formatEtaDuration(52 * 3_600_000)).toBe('≈ 2d 4h');
    expect(formatEtaDuration(48 * 3_600_000)).toBe('≈ 2d');
  });

  it('abaixo de 1 minuto', () => {
    expect(formatEtaDuration(20_000)).toBe('<1m');
  });

  it('null/não-finito/negativo => null (o chamador mostra DASH)', () => {
    expect(formatEtaDuration(null)).toBeNull();
    expect(formatEtaDuration(NaN)).toBeNull();
    expect(formatEtaDuration(-5)).toBeNull();
  });
});
