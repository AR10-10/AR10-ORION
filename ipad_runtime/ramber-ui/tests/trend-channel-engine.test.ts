// trend-channel-engine.test.ts — execução REAL do Linear Regression
// Channel (Auditoria do painel do gráfico: "canais de tendência", gap
// real já documentado em rodadas anteriores). Verifica a matemática OLS
// exata (não só a forma do resultado), fail-closed com dados
// insuficientes, e que a janela recente nunca vaza para fora do escopo.
import { describe, it, expect } from 'vitest';
import {
  computeTrendChannel,
  TREND_CHANNEL_DEFAULT_WINDOW,
  TREND_CHANNEL_STDDEV_MULTIPLIER,
  type TrendChannelCandle,
} from '../src/nexus/trend-channel-engine';

function series(values: number[], startTime = 1_000): TrendChannelCandle[] {
  return values.map((close, i) => ({ time: startTime + i * 60, close }));
}

describe('computeTrendChannel — Linear Regression Channel real (OLS + desvio padrão amostral)', () => {
  it('reta perfeita sem ruído: mid coincide EXATAMENTE com os closes reais, stdDev = 0, banda colapsa na própria linha', () => {
    const candles = series(Array.from({ length: 20 }, (_, i) => 100 + i * 2)); // 100,102,104,...,138 — inclinação real exata = 2/barra
    const r = computeTrendChannel(candles, 20)!;
    expect(r).not.toBeNull();
    expect(r.slopePerBar).toBeCloseTo(2, 10);
    expect(r.stdDev).toBeCloseTo(0, 10);
    expect(r.direction).toBe('ASCENDING');
    for (let i = 0; i < 20; i++) {
      expect(r.mid[i].value).toBeCloseTo(candles[i].close, 8);
      expect(r.upper[i].value).toBeCloseTo(candles[i].close, 8); // banda = mid ± 2×0
      expect(r.lower[i].value).toBeCloseTo(candles[i].close, 8);
      expect(r.mid[i].time).toBe(candles[i].time); // tempo real preservado, nunca reindexado
    }
  });

  it('tendência descendente real: inclinação negativa, direção DESCENDING, espelho matemático exato da ascendente', () => {
    const candles = series(Array.from({ length: 20 }, (_, i) => 200 - i * 3));
    const r = computeTrendChannel(candles, 20)!;
    expect(r.slopePerBar).toBeCloseTo(-3, 10);
    expect(r.direction).toBe('DESCENDING');
  });

  it('mercado lateral real (ruído simétrico, sem inclinação líquida): direção FLAT, nunca ASCENDING/DESCENDING fabricado sobre ruído', () => {
    const values = [100, 101, 99, 100, 101, 99, 100, 101, 99, 100, 101, 99];
    const r = computeTrendChannel(series(values), values.length)!;
    expect(r.direction).toBe('FLAT');
  });

  it('banda = linha central ± k×desvio padrão AMOSTRAL real (k=2, convenção da indústria) — verificado contra o cálculo manual de resíduos', () => {
    const values = [10, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19, 22];
    const candles = series(values);
    const r = computeTrendChannel(candles, values.length)!;
    // Reconstrução manual independente da regressão OLS para cross-check.
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    values.forEach((y, i) => { num += (i - xMean) * (y - yMean); den += (i - xMean) ** 2; });
    const slope = num / den;
    const intercept = yMean - slope * xMean;
    let sumSq = 0;
    values.forEach((y, i) => { const resid = y - (intercept + slope * i); sumSq += resid * resid; });
    const stdDev = Math.sqrt(sumSq / (n - 1));
    expect(r.slopePerBar).toBeCloseTo(slope, 10);
    expect(r.stdDev).toBeCloseTo(stdDev, 10);
    for (let i = 0; i < n; i++) {
      expect(r.upper[i].value).toBeCloseTo(r.mid[i].value + TREND_CHANNEL_STDDEV_MULTIPLIER * stdDev, 8);
      expect(r.lower[i].value).toBeCloseTo(r.mid[i].value - TREND_CHANNEL_STDDEV_MULTIPLIER * stdDev, 8);
    }
  });

  it('fail-closed: histórico insuficiente (< 10 candles reais) devolve null, nunca um canal fabricado sobre quase nada', () => {
    expect(computeTrendChannel(series([1, 2, 3]), 20)).toBeNull();
    expect(computeTrendChannel([], 20)).toBeNull();
  });

  it('fail-closed: window pedido menor que o mínimo estatístico devolve null', () => {
    expect(computeTrendChannel(series(Array.from({ length: 30 }, (_, i) => 100 + i)), 5)).toBeNull();
  });

  it('candles com time/close não-finitos são filtrados, nunca geram um ponto fabricado (mesmo padrão fail-closed de ema.ts/vwap.ts)', () => {
    const candles: TrendChannelCandle[] = [
      ...series(Array.from({ length: 15 }, (_, i) => 100 + i)),
      { time: Number.NaN, close: 999 },
      { time: 2_000, close: Number.POSITIVE_INFINITY },
    ];
    const r = computeTrendChannel(candles, 20)!;
    expect(r.windowSize).toBe(15); // os 2 candles inválidos nunca entram na janela nem no cálculo
  });

  it('a janela recente NUNCA vaza para fora do escopo: candles antigos fora da janela não influenciam a inclinação/stdDev calculados', () => {
    const oldNoise = series(Array.from({ length: 100 }, () => 1_000_000), 0); // ruído extremo bem antigo
    const recentTrend = series(Array.from({ length: 20 }, (_, i) => 100 + i * 5), 100_000); // tendência limpa recente
    const combined = [...oldNoise, ...recentTrend];
    const r = computeTrendChannel(combined, 20)!;
    expect(r.windowSize).toBe(20);
    expect(r.slopePerBar).toBeCloseTo(5, 6); // só a tendência recente conta, o ruído antigo de 1_000_000 não entra
    expect(r.mid[0].time).toBe(recentTrend[0].time);
  });

  it('default de janela exportado é o mesmo usado quando nenhum window é passado (contrato estável para o chamador do gráfico)', () => {
    const candles = series(Array.from({ length: TREND_CHANNEL_DEFAULT_WINDOW + 10 }, (_, i) => 100 + i));
    const withDefault = computeTrendChannel(candles)!;
    const withExplicit = computeTrendChannel(candles, TREND_CHANNEL_DEFAULT_WINDOW)!;
    expect(withDefault.windowSize).toBe(withExplicit.windowSize);
    expect(withDefault.slopePerBar).toBeCloseTo(withExplicit.slopePerBar, 10);
  });
});
