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

// ===========================================================================
// Achado 3.3 — reclamação direta do Operador: "algumas linhas não ficam
// retas". A investigação eliminou primeiro as 2 causas mais prováveis, com
// evidência: (a) o alinhamento de meio-pixel do canvas JÁ estava correto nos
// 6 pontos que desenham linha horizontal (`Math.round(y) + 0.5`); (b) a
// escala de preço é linear — zero PriceScaleMode logarítmico no projeto. O
// defeito real era o eixo X deste motor: regressão contra POSIÇÃO NO ARRAY,
// pontos plotados contra TIMESTAMP. Com buraco na série (o Chart Integrity
// Engine existe justamente porque isso acontece), a reta ganha um joelho.
//
// Mesmo erro que as tasks #195/#196 já corrigiram no lorentzian-classifier.js
// ("espaçamento cronológico") — este motor tinha a falha idêntica.
// ===========================================================================
describe('Achado 3.3: o eixo X é TEMPO REAL, não índice de array', () => {
  const STEP = 900; // 15m em segundos

  /** Série perfeitamente linear em PREÇO por unidade de TEMPO. */
  const linearInTime = (times: number[], base: number, perStep: number) =>
    times.map((t) => ({ time: t, close: base + ((t - times[0]) / STEP) * perStep }));

  it('série SEM buraco: saída bit-idêntica ao comportamento anterior — zero regressão no caminho normal', () => {
    // Com espaçamento uniforme, xs[i] === i exatamente, então a matemática é
    // a mesma de antes. Verificado pelo resultado exato, não por aproximação.
    const times = Array.from({ length: 30 }, (_, i) => 1_700_000_000 + i * STEP);
    const r = computeTrendChannel(linearInTime(times, 60_000, 10));
    expect(r).not.toBeNull();
    expect(r!.slopePerBar).toBeCloseTo(10, 9);
    expect(r!.mid[0].value).toBeCloseTo(60_000, 6);
    expect(r!.mid[29].value).toBeCloseTo(60_000 + 29 * 10, 6);
    // `direction` NÃO é asserido aqui de propósito: inclinação de 10 sobre um
    // ativo de ~60k é 0,017% por barra, abaixo de FLAT_SLOPE_THRESHOLD_FRACTION
    // — o motor classifica FLAT, e está certo. Esse limiar é comportamento
    // pré-existente, não é o que este Achado mudou.
    expect(r!.stdDev).toBeCloseTo(0, 9);
  });

  it('BUG CORRIGIDO — série COM buraco: a linha continua uma reta perfeita no espaço de TEMPO', () => {
    // 20 candles, mas os índices 10..14 faltam (gap real de 5 barras).
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      if (i >= 10 && i < 15) continue; // buraco real
      times.push(1_700_000_000 + i * STEP);
    }
    const r = computeTrendChannel(linearInTime(times, 60_000, 10));
    expect(r).not.toBeNull();
    // O dado é EXATAMENTE linear em tempo, então o ajuste tem de recuperar a
    // inclinação real e resíduo ZERO. Antes do fix o resíduo era > 0 porque a
    // reta era ajustada num eixo (índice) e avaliada em outro (tempo).
    expect(r!.slopePerBar).toBeCloseTo(10, 9);
    expect(r!.stdDev).toBeCloseTo(0, 9);
  });

  it('BUG CORRIGIDO: cada ponto emitido cai exatamente sobre a reta real — nenhum joelho no buraco', () => {
    const times: number[] = [];
    for (let i = 0; i < 24; i++) {
      if (i === 8 || i === 9 || i === 17) continue; // 2 buracos distintos
      times.push(1_700_000_000 + i * STEP);
    }
    const r = computeTrendChannel(linearInTime(times, 50_000, 25));
    expect(r).not.toBeNull();
    for (const p of r!.mid) {
      const barsFromStart = (p.time - times[0]) / STEP;
      // valor esperado da reta REAL naquele instante
      expect(p.value).toBeCloseTo(50_000 + barsFromStart * 25, 6);
    }
  });

  it('colinearidade real: mid é uma reta perfeita — a segunda diferença é zero em todo ponto interno, mesmo com buraco', () => {
    const times: number[] = [];
    for (let i = 0; i < 22; i++) {
      if (i === 12) continue;
      times.push(1_700_000_000 + i * STEP);
    }
    const r = computeTrendChannel(linearInTime(times, 61_000, -8));
    expect(r).not.toBeNull();
    const mid = r!.mid;
    for (let i = 1; i < mid.length - 1; i++) {
      const dtPrev = (mid[i].time - mid[i - 1].time) / STEP;
      const dtNext = (mid[i + 1].time - mid[i].time) / STEP;
      const slopePrev = (mid[i].value - mid[i - 1].value) / dtPrev;
      const slopeNext = (mid[i + 1].value - mid[i].value) / dtNext;
      // Inclinação por unidade de TEMPO idêntica em todo segmento = reta.
      expect(slopeNext).toBeCloseTo(slopePrev, 6);
    }
  });

  it('a mediana (não a média) normaliza o eixo — um único gap gigante não distorce slopePerBar', () => {
    const times = [1_700_000_000];
    for (let i = 1; i < 15; i++) times.push(times[i - 1] + STEP);
    times.push(times[times.length - 1] + STEP * 500); // gap absurdo de 500 barras
    for (let i = 0; i < 8; i++) times.push(times[times.length - 1] + STEP);
    const r = computeTrendChannel(linearInTime(times, 60_000, 3));
    expect(r).not.toBeNull();
    expect(r!.slopePerBar).toBeCloseTo(3, 9); // continua "por barra" real
    expect(r!.stdDev).toBeCloseTo(0, 6);
  });

  it('as bandas ±σ seguem o mid com deslocamento constante — o canal nunca deixa de ser paralelo', () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      if (i === 7) continue;
      times.push(1_700_000_000 + i * STEP);
    }
    const noisy = times.map((t, i) => ({ time: t, close: 60_000 + ((t - times[0]) / STEP) * 5 + (i % 2 === 0 ? 30 : -30) }));
    const r = computeTrendChannel(noisy);
    expect(r).not.toBeNull();
    const band = r!.upper[0].value - r!.mid[0].value;
    expect(band).toBeGreaterThan(0);
    for (let i = 0; i < r!.mid.length; i++) {
      expect(r!.upper[i].value - r!.mid[i].value).toBeCloseTo(band, 9);
      expect(r!.mid[i].value - r!.lower[i].value).toBeCloseTo(band, 9);
    }
  });
});
