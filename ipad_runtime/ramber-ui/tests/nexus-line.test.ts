// nexus-line.test.ts — Consolidação Final §26-§30: execução real da Nexus
// Line. Os pontos críticos travados aqui:
//   1. a linha só nasce quando os DOIS equilíbrios reais existem (VWAP da
//      sessão + dealing range confirmado) — nunca um valor fabricado;
//   2. ZERO lookahead: o pivô só entra no equilíbrio estrutural a partir
//      da barra em que o fractal confirma (index + k) — a linha não repinta;
//   3. os valores são exatamente a fusão documentada 0.5/0.5 + EMA(5),
//      verificados contra aritmética feita à mão no comentário;
//   4. a confluência §30 é informativa e falha para null sem leitura dupla.
import { describe, it, expect } from 'vitest';
import {
  computeNexusLineSeries,
  latestNexusLine,
  nexusLineState,
  nexusConfluenceVerdict,
  NEXUS_LINE_WEIGHTS,
  NEXUS_LINE_SMOOTHING_PERIOD,
} from '../src/nexus/nexus-line';

// Base de tempo: múltiplo exato de 86400 => todos os candles no MESMO dia
// UTC (a VWAP de sessão ancora no dia do último candle).
const DAY = 86400;
const BASE = DAY * 20000;
const mk = (i: number, v: number) => ({ time: BASE + i * 60, high: v, low: v, close: v, volume: 1 });

// Fixture à mão: sobe até topo em i2=12, desce até fundo em i5=9, cauda.
//   preços:  i0..i9 = [10, 11, 12, 11, 10, 9, 10, 11, 10, 10.8]
//   fractal k=2: topo 12@i2 confirma em i4; fundo 9@i5 confirma em i7.
//   VWAP (volume 1, doji tp=v): média cumulativa =>
//     i7: 84/8 = 10.5 · i8: 94/9 = 10.444444 · i9: 104.8/10 = 10.48
//   EQ estrutural (após i7): (12+9)/2 = 10.5
//   ATENÇÃO (comportamento real provado abaixo): i7=11 também é um topo
//   fractal (vizinhos 9,10 | 10,10.8 todos menores) e confirma em i9 —
//   o dealing range ATUALIZA no meio da série: EQ vira (11+9)/2 = 10.
//   raw = 0.5·VWAP + 0.5·EQ; EMA alpha = 2/(5+1) = 1/3:
//     i7: EQ 10.5, raw 10.5      => ema 10.5 (primeiro ponto)
//     i8: EQ 10.5, raw 10.472222 => ema 10.5 + (1/3)(−0.0277778) = 10.4907407
//     i9: EQ 10.0, raw 10.24     => ema 10.4907407 + (1/3)(−0.2507407) = 10.4071605
const PRICES = [10, 11, 12, 11, 10, 9, 10, 11, 10, 10.8];
const CANDLES = PRICES.map((v, i) => mk(i, v));

describe('computeNexusLineSeries: fusão 0.5/0.5 real com zero lookahead', () => {
  it('a linha só começa quando o fundo confirma (i5+k=i7) — nunca antes (sem repaint)', () => {
    const series = computeNexusLineSeries(CANDLES);
    expect(series.length).toBe(3);
    expect(series[0].time).toBe(BASE + 7 * 60);
  });

  it('valores exatos da aritmética à mão (fusão + EMA(5)), incluindo o range que ATUALIZA em i9', () => {
    const series = computeNexusLineSeries(CANDLES);
    expect(series[0].value).toBeCloseTo(10.5, 9);
    expect(series[1].value).toBeCloseTo(10.4907407407, 8);
    expect(series[2].value).toBeCloseTo(10.4071604938, 8);
  });

  it('sem swing confirmado (série monotônica) => [] mesmo com VWAP real', () => {
    const mono = Array.from({ length: 10 }, (_, i) => mk(i, 100 + i));
    expect(computeNexusLineSeries(mono)).toEqual([]);
  });

  it('entrada vazia => [] (fail-closed)', () => {
    expect(computeNexusLineSeries([])).toEqual([]);
  });

  it('latestNexusLine: último valor real; null honesto para série vazia', () => {
    expect(latestNexusLine(computeNexusLineSeries(CANDLES))).toBeCloseTo(10.4071604938, 8);
    expect(latestNexusLine([])).toBeNull();
  });

  it('pesos e suavização documentados são reais (auditáveis/reproduzíveis, §28)', () => {
    expect(NEXUS_LINE_WEIGHTS.volumeEquilibrium + NEXUS_LINE_WEIGHTS.structuralEquilibrium).toBe(1);
    expect(NEXUS_LINE_WEIGHTS.volumeEquilibrium).toBe(0.5);
    expect(NEXUS_LINE_SMOOTHING_PERIOD).toBe(5);
  });
});

describe('nexusLineState: mesma histerese compartilhada; null => NEUTRAL', () => {
  it('propaga a histerese real e falha fechado sem leituras', () => {
    expect(nexusLineState('NEUTRAL', 103.5, 100, 10)).toBe('BULLISH');
    expect(nexusLineState('BULLISH', 101.5, 100, 10)).toBe('BULLISH'); // sticky
    expect(nexusLineState('BULLISH', null, 100, 10)).toBe('NEUTRAL');
    expect(nexusLineState('BULLISH', 100, null, 10)).toBe('NEUTRAL');
  });
});

describe('nexusConfluenceVerdict (§30): informativo, nunca acionável', () => {
  it('as três leituras alinhadas => ALINHADA (LONG↔BULLISH, SHORT↔BEARISH)', () => {
    expect(nexusConfluenceVerdict('BULLISH', 'BULLISH', 'LONG')).toBe('ALINHADA');
    expect(nexusConfluenceVerdict('BEARISH', 'BEARISH', 'SHORT')).toBe('ALINHADA');
  });

  it('divergência com decisão direcional ativa => CONFLITO_ESTRUTURAL', () => {
    expect(nexusConfluenceVerdict('BULLISH', 'BEARISH', 'LONG')).toBe('CONFLITO_ESTRUTURAL');
    expect(nexusConfluenceVerdict('BEARISH', 'BEARISH', 'LONG')).toBe('CONFLITO_ESTRUTURAL');
  });

  it('sem decisão direcional ou sem leitura direcional dupla => null honesto', () => {
    expect(nexusConfluenceVerdict('BULLISH', 'BULLISH', 'AGUARDAR')).toBeNull();
    expect(nexusConfluenceVerdict('BULLISH', 'BULLISH', null)).toBeNull();
    expect(nexusConfluenceVerdict('NEUTRAL', 'BULLISH', 'LONG')).toBeNull();
    expect(nexusConfluenceVerdict('BULLISH', 'NEUTRAL', 'LONG')).toBeNull();
  });
});
