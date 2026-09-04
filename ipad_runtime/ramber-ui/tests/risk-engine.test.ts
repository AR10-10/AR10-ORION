// risk-engine.test.ts — permanent regression suite for the Fase H Risk
// Engine (Risk/ATR sizing + conservative fractional-Kelly capping).
// Imports the REAL module. Every number below is verifiable by hand from
// the documented formulas — no fixture magic.
import { describe, it, expect } from 'vitest';
import {
  buildRiskSuggestion,
  kellyFractionForForca,
  RISK_PER_TRADE_PCT_DEFAULT,
  ASSUMED_WIN_RATE,
  MIN_SAMPLE_FOR_REAL_WIN_RATE,
  MAX_POSITION_PCT,
  DISCLAIMER,
  KELLY_FRACTION_TIERS,
} from '../../src/risk/risk-engine.js';

// Cenário base verificável à mão: LONG @50000, stop 49000 (dist 2%),
// ATR 1% (stop mais largo => unidade de risco = 2%), R:R 2, comitê
// ALTA com força 0.7 (tier 1/2-Kelly), risco padrão 1%.
//   tamanho_vol = 1/2 × 100 = 50% eq
//   Kelly_pleno = 0.5 − 0.5/2 = 0.25;  teto = 0.5 × 0.25 × 100 = 12.5%
//   sugestão = min(50, 12.5, 100) = 12.5% eq
//   risco_efetivo = 12.5 × 2/100 = 0.25% do equity
const BASE = {
  signal: 'LONG' as const,
  entry: 50_000,
  stop: 49_000,
  atrPercent: 1,
  riskRewardRatio: 2,
  ensembleDirection: 'ALTA' as const,
  ensembleForca: 0.7,
};

describe('risk-engine: matemática verificável à mão (cenário base)', () => {
  const r = buildRiskSuggestion(BASE);

  it('dimensionamento por volatilidade: 1% de risco / 2% de unidade = 50% eq (pré-cap)', () => {
    expect(r.status).toBe('OK');
    expect(r.effective_risk_unit_pct).toBeCloseTo(2, 10);
    expect(r.vol_size_pct).toBeCloseTo(50, 10);
  });

  it('capping de Kelly fracionado: f* = 0.5 − 0.5/2 = 0.25; 1/2-Kelly => teto 12.5%', () => {
    expect(r.kelly_fraction_tier).toBe(0.5);
    expect(r.kelly_cap_pct).toBeCloseTo(12.5, 10);
    expect(r.suggested_position_pct).toBeCloseTo(12.5, 10);
  });

  it('risco efetivo = sugestão × unidade de risco = 0.25% do equity (≤ 1% pedido, o cap só reduz)', () => {
    expect(r.effective_risk_pct).toBeCloseTo(0.25, 10);
    expect(r.effective_risk_pct).toBeLessThanOrEqual(RISK_PER_TRADE_PCT_DEFAULT);
  });

  it('taxa de acerto assumida é FIXA em 0.5 (nenhuma probabilidade fabricada) e a saída ecoa insumos', () => {
    expect(r.assumed_win_rate).toBe(ASSUMED_WIN_RATE);
    expect(ASSUMED_WIN_RATE).toBe(0.5);
    expect(r.inputs.entry).toBe(50_000);
    expect(r.read_only).toBe(true);
  });
});

describe('risk-engine: acoplamento Risk/ATR — o piso de ATR engaja quando o stop está dentro do ruído', () => {
  it('stop de 0.5% com ATR de 2% => unidade de risco = 2% (ATR vence) => tamanho_vol 50%, não 200%', () => {
    const r = buildRiskSuggestion({ ...BASE, stop: 49_750, atrPercent: 2 }); // dist 0.5%
    expect(r.effective_risk_unit_pct).toBeCloseTo(2, 10);
    expect(r.vol_size_pct).toBeCloseTo(50, 10);
  });

  it('teto duro de 100%: nunca sugere alavancagem mesmo com unidade de risco minúscula e Kelly folgado', () => {
    // dist 0.1%, ATR 0.1% => vol_size = 1000%; R:R 10 => f*=0.45, tier 0.5 => cap 22.5%
    // min já resolveria, então force o caso: risco por trade 30% (política agressiva)
    const r = buildRiskSuggestion({ ...BASE, stop: 49_950, atrPercent: 0.1, riskRewardRatio: 10, riskPerTradePct: 30 });
    expect(r.status).toBe('OK');
    expect(r.suggested_position_pct).toBeLessThanOrEqual(MAX_POSITION_PCT);
  });
});

describe('risk-engine: multiplicadores FIXOS por faixa de força do comitê (ordem da Fase H)', () => {
  it('a tabela de tiers é a documentada e é imutável', () => {
    expect(KELLY_FRACTION_TIERS.map((t: any) => t.fraction)).toEqual([0.5, 0.25, 0.125]);
    expect(Object.isFrozen(KELLY_FRACTION_TIERS)).toBe(true);
  });

  it('força 0.6 => 1/2; 0.3 => 1/4; 0.05 => 1/8; 0 ou não-finita => 0', () => {
    expect(kellyFractionForForca(0.6)).toBe(0.5);
    expect(kellyFractionForForca(0.3)).toBe(0.25);
    expect(kellyFractionForForca(0.05)).toBe(0.125);
    expect(kellyFractionForForca(0)).toBe(0);
    expect(kellyFractionForForca(NaN)).toBe(0);
  });

  it('força fraca (1/8-Kelly) reduz o teto proporcionalmente: mesmo cenário base => 3.125%', () => {
    const r = buildRiskSuggestion({ ...BASE, ensembleForca: 0.1 });
    expect(r.kelly_fraction_tier).toBe(0.125);
    expect(r.suggested_position_pct).toBeCloseTo(3.125, 10);
  });
});

describe('risk-engine: Entrega 44 — taxa de acerto REAL (Track Record) substitui o p₀=0.5 assumido quando há amostra', () => {
  it('sem realWinRate/realWinRateSampleSize: comportamento IDÊNTICO ao de antes (regressão)', () => {
    const r = buildRiskSuggestion(BASE);
    expect(r.effective_win_rate).toBe(ASSUMED_WIN_RATE);
    expect(r.win_rate_source).toBe('assumed_0.5');
    expect(r.suggested_position_pct).toBeCloseTo(12.5, 10);
  });

  it('amostra real >= mínimo (30): usa a taxa REAL — cenário base recalculado à mão', () => {
    // p=0.6, b=2 => Kelly_pleno = 0.6 - 0.4/2 = 0.4; força 0.7 => 1/2-Kelly
    // => teto 20%; vol_size continua 50% (não depende de win rate) =>
    // sugestão = min(50, 20, 100) = 20%; risco efetivo = 20 × 2/100 = 0.4%.
    const r = buildRiskSuggestion({ ...BASE, realWinRate: 0.6, realWinRateSampleSize: MIN_SAMPLE_FOR_REAL_WIN_RATE });
    expect(r.status).toBe('OK');
    expect(r.effective_win_rate).toBe(0.6);
    expect(r.win_rate_source).toBe('track_record_real');
    expect(r.kelly_cap_pct).toBeCloseTo(20, 10);
    expect(r.suggested_position_pct).toBeCloseTo(20, 10);
    expect(r.effective_risk_pct).toBeCloseTo(0.4, 10);
    // assumed_win_rate continua ecoando o fallback fixo — nunca reescrito.
    expect(r.assumed_win_rate).toBe(0.5);
  });

  it('amostra 1 abaixo do mínimo (29): cai no fallback 0.5, mesmo resultado do cenário base', () => {
    const r = buildRiskSuggestion({ ...BASE, realWinRate: 0.6, realWinRateSampleSize: MIN_SAMPLE_FOR_REAL_WIN_RATE - 1 });
    expect(r.effective_win_rate).toBe(ASSUMED_WIN_RATE);
    expect(r.win_rate_source).toBe('assumed_0.5');
    expect(r.suggested_position_pct).toBeCloseTo(12.5, 10);
  });

  it('realWinRate fora de [0,1] (mesmo com amostra suficiente): fail-closed pro fallback, nunca usa o valor inválido', () => {
    const negative = buildRiskSuggestion({ ...BASE, realWinRate: -0.1, realWinRateSampleSize: 50 });
    const tooHigh = buildRiskSuggestion({ ...BASE, realWinRate: 1.5, realWinRateSampleSize: 50 });
    const notFinite = buildRiskSuggestion({ ...BASE, realWinRate: NaN, realWinRateSampleSize: 50 });
    for (const r of [negative, tooHigh, notFinite]) {
      expect(r.effective_win_rate).toBe(ASSUMED_WIN_RATE);
      expect(r.win_rate_source).toBe('assumed_0.5');
    }
  });

  it('realWinRateSampleSize não-finita: fail-closed pro fallback', () => {
    const r = buildRiskSuggestion({ ...BASE, realWinRate: 0.6, realWinRateSampleSize: NaN });
    expect(r.effective_win_rate).toBe(ASSUMED_WIN_RATE);
    expect(r.win_rate_source).toBe('assumed_0.5');
  });

  it('SEM_SUGESTAO: effective_win_rate e win_rate_source são null (nada foi de fato calculado)', () => {
    const r = buildRiskSuggestion({ ...BASE, signal: null, realWinRate: 0.6, realWinRateSampleSize: 50 } as any);
    expect(r.status).toBe('SEM_SUGESTAO');
    expect(r.effective_win_rate).toBeNull();
    expect(r.win_rate_source).toBeNull();
  });

  it('taxa real muito baixa ainda pode zerar o Kelly (mesma regra de assimetria de payoff)', () => {
    // p=0.3, b=1 (sem BASE override de rr) => Kelly = 0.3 - 0.7/1 = -0.4 <= 0.
    const r = buildRiskSuggestion({ ...BASE, riskRewardRatio: 1, realWinRate: 0.3, realWinRateSampleSize: 40 });
    expect(r.status).toBe('SEM_SUGESTAO');
    expect(r.reason).toContain('kelly_nao_positivo');
  });
});

describe('risk-engine: FAIL-CLOSED — 0% sempre que faltar base real (diretriz 4)', () => {
  const zeroCases: Array<[string, Record<string, unknown>]> = [
    ['sem sinal do Core', { signal: null }],
    ['sinal WAIT não dimensiona', { signal: 'WAIT' }],
    ['entry não-finito', { entry: NaN }],
    ['stop ausente', { stop: null }],
    ['ATR ausente', { atrPercent: null }],
    ['R:R ausente', { riskRewardRatio: null }],
    ['força ausente', { ensembleForca: null }],
    ['entry == stop (unidade degenerada)', { stop: 50_000 }],
    ['risco por trade 0', { riskPerTradePct: 0 }],
  ];
  for (const [label, override] of zeroCases) {
    it(`${label} => SEM_SUGESTAO com 0%`, () => {
      const r = buildRiskSuggestion({ ...BASE, ...override } as any);
      expect(r.status).toBe('SEM_SUGESTAO');
      expect(r.suggested_position_pct).toBe(0);
      expect(r.effective_risk_pct).toBe(0);
      expect(typeof r.reason).toBe('string');
    });
  }

  it('comitê NEUTRO ou contrário ao sinal => 0% (o comitê precisa CONFIRMAR a direção do Core)', () => {
    expect(buildRiskSuggestion({ ...BASE, ensembleDirection: 'NEUTRO' }).suggested_position_pct).toBe(0);
    expect(buildRiskSuggestion({ ...BASE, ensembleDirection: 'BAIXA' }).suggested_position_pct).toBe(0);
    const shortOk = buildRiskSuggestion({ ...BASE, signal: 'SHORT', stop: 51_000, ensembleDirection: 'BAIXA' });
    expect(shortOk.status).toBe('OK');
  });

  it('R:R ≤ 1 => Kelly não-positivo sob p₀=0.5 => 0% (sem assimetria de payoff, sem sugestão)', () => {
    const r = buildRiskSuggestion({ ...BASE, riskRewardRatio: 1 });
    expect(r.status).toBe('SEM_SUGESTAO');
    expect(r.reason).toContain('kelly_nao_positivo');
    expect(r.suggested_position_pct).toBe(0);
  });
});

describe('risk-engine: selo obrigatório e determinismo', () => {
  it('o disclaimer está presente em TODA saída — inclusive SEM_SUGESTAO — e a saída é congelada', () => {
    const ok = buildRiskSuggestion(BASE);
    const zero = buildRiskSuggestion({ ...BASE, signal: null } as any);
    expect(ok.disclaimer).toBe(DISCLAIMER);
    expect(zero.disclaimer).toBe(DISCLAIMER);
    expect(Object.isFrozen(ok)).toBe(true);
    expect(Object.isFrozen(zero)).toBe(true);
  });

  it('é determinístico: mesmas entradas => exatamente a mesma saída', () => {
    expect(buildRiskSuggestion(BASE)).toEqual(buildRiskSuggestion(BASE));
  });
});
