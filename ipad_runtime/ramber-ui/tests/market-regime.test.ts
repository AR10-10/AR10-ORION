// market-regime.test.ts — permanent regression suite for the Market Regime
// Engine (V15 Fase D: classificação contínua + matriz adaptativa +
// histórico de transições). Imports the REAL modules (never a mock) from
// src/market-regime/. All series are deterministic synthetic candles —
// same offline-testability convention as lorentzian-classifier.test.ts.
import { describe, it, expect } from 'vitest';
import {
  classifyMarketRegime,
  computeAdx,
  computeBandwidthSeries,
  percentileRank,
  REGIMES,
  MIN_CANDLES_FOR_REGIME,
  ADX_STRONG,
  ADX_MODERATE,
  SQUEEZE_PERCENTILE,
} from '../../src/market-regime/regime-engine.js';
import {
  MODULE_FAMILIES,
  REGIME_WEIGHT_MATRIX,
  getRegimeWeights,
  getSensitivity,
} from '../../src/market-regime/weight-matrix.js';
import { RegimeHistory } from '../../src/market-regime/regime-history.js';

const STEP = 900; // 15m em segundos, mesma convenção canônica do Bus
const T0 = 1_700_000_000;

function candle(i: number, c: number, spread = 1) {
  return { t: T0 + i * STEP, o: c, h: c + spread, l: c - spread, c, v: 10 };
}

/** Tendência de alta monotônica: highs e lows sempre subindo => +DM domina
 *  totalmente, −DM = 0 => ADX -> alto. */
function strongUptrend(n: number) {
  return Array.from({ length: n }, (_, i) => candle(i, 100 + i * 2));
}

function strongDowntrend(n: number) {
  return Array.from({ length: n }, (_, i) => candle(i, 500 - i * 2));
}

/** Range puro: oscilação senoidal com amplitude LEVEMENTE crescente —
 *  direção flipando a cada ~4 candles => DIs se cancelam => ADX baixo; a
 *  banda final é a mais LARGA da própria história (percentil alto), então
 *  nunca é lida como squeeze. Uma senóide de amplitude perfeitamente
 *  constante produz larguras de banda quase idênticas, e o percentil entre
 *  empates de float decide no ruído — fixture ruim, não engine errado. */
function sideways(n: number) {
  return Array.from({ length: n }, (_, i) => candle(i, 100 + (2.5 + i * 0.01) * Math.sin((i * 2 * Math.PI) / 8)));
}

/** Compressão: mesma oscilação com amplitude decaindo até quase zero — os
 *  últimos candles têm a banda mais estreita da própria história. */
function compression(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const amplitude = 5 * (1 - i / n) + 0.15;
    return candle(i, 100 + amplitude * Math.sin((i * 2 * Math.PI) / 8), 0.3);
  });
}

/** Compressão seguida de um candle final escapando para CIMA da banda
 *  superior (breakout detectado, não previsto). */
function breakoutUp(n: number) {
  const series = compression(n);
  const last = series[series.length - 1];
  series[series.length - 1] = { ...candle(n - 1, last.c + 8, 0.5), t: last.t };
  return series;
}

function breakoutDown(n: number) {
  const series = compression(n);
  const last = series[series.length - 1];
  series[series.length - 1] = { ...candle(n - 1, last.c - 8, 0.5), t: last.t };
  return series;
}

describe('market-regime: ADX de Wilder — força real de tendência, matemática clássica', () => {
  it('uma tendência monotônica de alta produz ADX alto com +DI dominando', () => {
    const result = computeAdx(strongUptrend(80))!;
    expect(result.adx).toBeGreaterThan(ADX_STRONG);
    expect(result.plusDi).toBeGreaterThan(result.minusDi);
  });

  it('uma tendência monotônica de baixa produz ADX alto com −DI dominando', () => {
    const result = computeAdx(strongDowntrend(80))!;
    expect(result.adx).toBeGreaterThan(ADX_STRONG);
    expect(result.minusDi).toBeGreaterThan(result.plusDi);
  });

  it('um range oscilante produz ADX baixo (direção não se sustenta)', () => {
    const result = computeAdx(sideways(80))!;
    expect(result.adx).toBeLessThan(ADX_MODERATE);
  });

  it('devolve null (nunca um número fabricado) abaixo da amostra mínima de Wilder', () => {
    expect(computeAdx(strongUptrend(20))).toBeNull();
  });

  it('ADX e DIs ficam dentro de [0,100]', () => {
    for (const series of [strongUptrend(80), strongDowntrend(80), sideways(80)]) {
      const r = computeAdx(series)!;
      for (const v of [r.adx, r.plusDi, r.minusDi]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('market-regime: largura de banda de Bollinger + percentil (auto-calibração)', () => {
  it('a série de larguras começa no índice period−1 e nunca é negativa', () => {
    const bands = computeBandwidthSeries(sideways(80));
    expect(bands[0].index).toBe(19);
    expect(bands.every((b) => b.bandwidth >= 0)).toBe(true);
  });

  it('numa compressão real, a última largura está no quartil mais estreito da própria história', () => {
    const bands = computeBandwidthSeries(compression(80));
    const history = bands.slice(-40).map((b) => b.bandwidth);
    const rank = percentileRank(history, bands[bands.length - 1].bandwidth)!;
    expect(rank).toBeLessThanOrEqual(SQUEEZE_PERCENTILE);
  });

  it('percentileRank é null para entrada vazia (nunca um rank inventado)', () => {
    expect(percentileRank([], 1)).toBeNull();
  });
});

describe('market-regime: classificação contínua — vocabulário fechado, 1 regime por leitura', () => {
  it('tendência de alta monotônica => TENDENCIA_FORTE · ALTA', () => {
    const result = classifyMarketRegime({ ohlcv_series: strongUptrend(100), timeframe: '15m' });
    expect(result.status).toBe('OK');
    expect(result.regime).toBe(REGIMES.TENDENCIA_FORTE);
    expect(result.direction).toBe('ALTA');
  });

  it('tendência de baixa monotônica => TENDENCIA_FORTE · BAIXA', () => {
    const result = classifyMarketRegime({ ohlcv_series: strongDowntrend(100), timeframe: '15m' });
    expect(result.regime).toBe(REGIMES.TENDENCIA_FORTE);
    expect(result.direction).toBe('BAIXA');
  });

  it('range oscilante estável => CONSOLIDACAO, sem direção', () => {
    const result = classifyMarketRegime({ ohlcv_series: sideways(100), timeframe: '15m' });
    expect(result.regime).toBe(REGIMES.CONSOLIDACAO);
    expect(result.direction).toBeNull();
  });

  it('amplitude decaindo até o mínimo => COMPRESSAO, sem direção', () => {
    const result = classifyMarketRegime({ ohlcv_series: compression(100), timeframe: '15m' });
    expect(result.regime).toBe(REGIMES.COMPRESSAO);
    expect(result.direction).toBeNull();
  });

  it('escape para cima vindo de compressão => BREAKOUT · ALTA (detecção, nunca previsão)', () => {
    const result = classifyMarketRegime({ ohlcv_series: breakoutUp(100), timeframe: '15m' });
    expect(result.regime).toBe(REGIMES.BREAKOUT);
    expect(result.direction).toBe('ALTA');
    expect(result.evidence!.close_position).toBe('ACIMA_BANDA_SUPERIOR');
  });

  it('escape para baixo vindo de compressão => BREAKOUT · BAIXA', () => {
    const result = classifyMarketRegime({ ohlcv_series: breakoutDown(100), timeframe: '15m' });
    expect(result.regime).toBe(REGIMES.BREAKOUT);
    expect(result.direction).toBe('BAIXA');
  });

  it('abaixo da amostra mínima => DADOS_INSUFICIENTES honesto, evidência null', () => {
    const result = classifyMarketRegime({ ohlcv_series: strongUptrend(MIN_CANDLES_FOR_REGIME - 1), timeframe: '15m' });
    expect(result.status).toBe('DADOS_INSUFICIENTES');
    expect(result.regime).toBe(REGIMES.DADOS_INSUFICIENTES);
    expect(result.evidence).toBeNull();
  });

  it('é determinística: a mesma série produz exatamente o mesmo resultado', () => {
    const a = classifyMarketRegime({ ohlcv_series: breakoutUp(100), timeframe: '15m' });
    const b = classifyMarketRegime({ ohlcv_series: breakoutUp(100), timeframe: '15m' });
    expect(a).toEqual(b);
  });

  it('a evidência carrega números reais auditáveis (ADX, percentil, ATR%), nunca probabilidade', () => {
    const result = classifyMarketRegime({ ohlcv_series: strongUptrend(100), timeframe: '15m' });
    const e = result.evidence!;
    expect(Number.isFinite(e.adx)).toBe(true);
    expect(e.bandwidth_percentile).toBeGreaterThan(0);
    expect(e.bandwidth_percentile).toBeLessThanOrEqual(1);
    expect(Number.isFinite(e.atr_percent)).toBe(true);
    expect('probability' in e).toBe(false);
  });
});

describe('market-regime: matriz dinâmica de pesos adaptativos (API consultiva)', () => {
  it('toda linha cobre exatamente as famílias de módulo reais, com pesos em [0,1]', () => {
    const regimes = [REGIMES.TENDENCIA_FORTE, REGIMES.TENDENCIA_MODERADA, REGIMES.CONSOLIDACAO, REGIMES.COMPRESSAO, REGIMES.BREAKOUT];
    for (const regime of regimes) {
      const row = getRegimeWeights(regime)!;
      expect(Object.keys(row).sort()).toEqual([...MODULE_FAMILIES].sort());
      for (const family of MODULE_FAMILIES) {
        expect(row[family]).toBeGreaterThanOrEqual(0);
        expect(row[family]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('codifica o racional documentado: momentum manda em tendência, reversão à média manda em range', () => {
    expect(getSensitivity(REGIMES.TENDENCIA_FORTE, 'momentum')!).toBeGreaterThan(
      getSensitivity(REGIMES.CONSOLIDACAO, 'momentum')!,
    );
    expect(getSensitivity(REGIMES.CONSOLIDACAO, 'reversao_media')!).toBeGreaterThan(
      getSensitivity(REGIMES.TENDENCIA_FORTE, 'reversao_media')!,
    );
    expect(getSensitivity(REGIMES.COMPRESSAO, 'rompimento')).toBe(1.0);
  });

  it('regime inexistente ou DADOS_INSUFICIENTES => null, nunca um peso neutro fabricado', () => {
    expect(getRegimeWeights(REGIMES.DADOS_INSUFICIENTES)).toBeNull();
    expect(getRegimeWeights('REGIME_INVENTADO')).toBeNull();
    expect(getSensitivity(REGIMES.TENDENCIA_FORTE, 'familia_inventada')).toBeNull();
  });

  it('a matriz é imutável (congelada) — nenhum consumidor pode reescrever pesos em runtime', () => {
    expect(Object.isFrozen(REGIME_WEIGHT_MATRIX)).toBe(true);
    expect(Object.isFrozen(REGIME_WEIGHT_MATRIX[REGIMES.BREAKOUT])).toBe(true);
  });
});

describe('market-regime: histórico real de transições (V15 Cap. 5)', () => {
  it('a primeira leitura registra a transição inicial (from null)', () => {
    const history = new RegimeHistory();
    const { changed, startedAt } = history.record('BTC', REGIMES.CONSOLIDACAO, null, 50000, 1000);
    expect(changed).toBe(true);
    expect(startedAt).toBe(1000);
    expect(history.historyFor('BTC')).toHaveLength(1);
    expect(history.historyFor('BTC')[0].from).toBeNull();
  });

  it('leituras repetidas do mesmo regime NÃO inflam o histórico e preservam o startedAt original', () => {
    const history = new RegimeHistory();
    history.record('BTC', REGIMES.CONSOLIDACAO, null, 50000, 1000);
    const second = history.record('BTC', REGIMES.CONSOLIDACAO, null, 50100, 2000);
    expect(second.changed).toBe(false);
    expect(second.startedAt).toBe(1000);
    expect(history.historyFor('BTC')).toHaveLength(1);
  });

  it('uma mudança real de regime registra from/to com preço e timestamp reais', () => {
    const history = new RegimeHistory();
    history.record('BTC', REGIMES.COMPRESSAO, null, 50000, 1000);
    history.record('BTC', REGIMES.BREAKOUT, 'ALTA', 50500, 2000);
    const transitions = history.historyFor('BTC');
    expect(transitions).toHaveLength(2);
    expect(transitions[1]).toMatchObject({ from: REGIMES.COMPRESSAO, to: REGIMES.BREAKOUT, to_direction: 'ALTA', price: 50500, at: 2000 });
  });

  it('mudança só de DIREÇÃO (mesmo regime) também é uma transição real', () => {
    const history = new RegimeHistory();
    history.record('BTC', REGIMES.TENDENCIA_FORTE, 'ALTA', 50000, 1000);
    const flipped = history.record('BTC', REGIMES.TENDENCIA_FORTE, 'BAIXA', 49000, 2000);
    expect(flipped.changed).toBe(true);
    expect(history.historyFor('BTC')).toHaveLength(2);
  });

  it('símbolos nunca se contaminam e o teto de transições é respeitado', () => {
    const history = new RegimeHistory();
    history.record('ETH', REGIMES.CONSOLIDACAO, null, 3000, 1000);
    for (let i = 0; i < 60; i++) {
      history.record('BTC', i % 2 === 0 ? REGIMES.CONSOLIDACAO : REGIMES.COMPRESSAO, null, 50000, 1000 + i);
    }
    expect(history.historyFor('ETH')).toHaveLength(1);
    expect(history.historyFor('BTC').length).toBeLessThanOrEqual(50);
  });
});
