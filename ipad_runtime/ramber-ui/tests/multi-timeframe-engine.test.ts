// multi-timeframe-engine.test.ts — Fase Ω Priority 1 (Adaptive
// Multi-Timeframe Intelligence): real-execution tests for the pure
// orchestration engine. Same convention as nexus-council.test.ts: import
// the REAL production functions (never a mock). Where an assertion needs
// the real swing/ADX/RSI internals, this file independently recomputes the
// expected value by calling the SAME real primitives the engine imports —
// that locks the WIRING (right function, right args, right label mapping)
// without hand-predicting fractal-swing/ADX arithmetic, which is already
// covered by market-regime.test.ts and the engines' own contracts.
import { describe, it, expect } from 'vitest';
import { analyzeTimeframe, MULTI_TIMEFRAME_LIST, type MultiTimeframeCandle } from '../src/nexus/multi-timeframe-engine';
import { analyze as analyzeMarketStructure } from '../../src/research/engines/market-structure-engine.js';
import { analyze as analyzeSupportResistance } from '../../src/research/engines/support-resistance-engine.js';
import { classifyMarketRegime } from '../../src/market-regime/index.js';
import { computeRSI } from '../../src/research/engines/lorentzian-classifier.js';
import { buildEnsembleConsensus, opinionFromLabel, opinionFromVote } from '../../src/consensus/index.js';
import { momentumAgentVote } from '../src/nexus/council';

const T0 = 1_700_000_000;
const STEP = 900; // 15m em segundos, mesma convenção canônica dos outros testes (market-regime.test.ts)

function candle(i: number, mid: number, spread = 0.5): MultiTimeframeCandle {
  return { t: T0 + i * STEP, o: mid - spread * 0.4, h: mid + spread, l: mid - spread, c: mid + spread * 0.4, v: 10 };
}

// Zigzag triangular (período 8, amplitude 10) + drift monotônico por candle.
// Uma reta pura nunca forma um fractal (o vizinho seguinte é sempre mais
// alto/baixo, então nada "reverte") — este zigzag reverte a cada 4 candles,
// formando swing highs/lows REAIS e confirmáveis (FRACTAL_K=2), com cada
// pico/vale sucessivo estritamente mais alto (direction=1 => HH+HL real) ou
// mais baixo (direction=-1 => LH+LL real) que o anterior.
function zigzagTrend(n: number, direction: 1 | -1): MultiTimeframeCandle[] {
  const period = 8;
  const amplitude = 10;
  const driftPerCandle = 0.4 * direction;
  return Array.from({ length: n }, (_, i) => {
    const pos = i % period;
    const half = period / 2;
    const tri = pos <= half ? pos / half : (period - pos) / half;
    return candle(i, 100 + tri * amplitude + i * driftPerCandle);
  });
}

describe('MULTI_TIMEFRAME_LIST: contrato dos 9 prazos (Diretriz Mestra §7: +3m/30m/1w)', () => {
  it('exatamente 1m/3m/5m/15m/30m/1h/4h/1d/1w, nesta ordem (App.tsx e engine-bridge.ts dependem desta ordem para a linha da matriz)', () => {
    expect(MULTI_TIMEFRAME_LIST).toEqual(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']);
  });
});

describe('analyzeTimeframe: fail-closed honesto sem dados reais', () => {
  it('array vazio => DADOS_INSUFICIENTES, todos os campos null, candlesUsed 0, nunca 0 fabricado', () => {
    const ctx = analyzeTimeframe('15m', []);
    expect(ctx.status).toBe('DADOS_INSUFICIENTES');
    expect(ctx.reason).toBe('sem_candles_reais_para_este_timeframe');
    expect(ctx.structureLabel).toBeNull();
    expect(ctx.regime).toBeNull();
    expect(ctx.regimeDirection).toBeNull();
    expect(ctx.atrPercent).toBeNull();
    expect(ctx.rsi).toBeNull();
    expect(ctx.support1).toBeNull();
    expect(ctx.resistance1).toBeNull();
    expect(ctx.confidence).toBeNull();
    expect(ctx.confidenceStance).toBeNull();
    expect(ctx.candlesUsed).toBe(0);
    expect(ctx.timeframe).toBe('15m');
  });

  it('candles reais mas abaixo do mínimo de TODOS os motores (5 < 15 de estrutura/S-R/RSI) => DADOS_INSUFICIENTES honesto', () => {
    const ctx = analyzeTimeframe('1m', zigzagTrend(5, 1));
    expect(ctx.status).toBe('DADOS_INSUFICIENTES');
    expect(ctx.reason).toBe('nenhum_motor_real_teve_leitura_nesta_janela');
    expect(ctx.rsi).toBeNull();
    expect(ctx.confidence).toBeNull();
    expect(ctx.confidenceStance).toBeNull();
  });
});

describe('analyzeTimeframe: degradação parcial honesta (estrutura/S-R/RSI reais, regime ainda indisponível)', () => {
  it('40 candles: acima do mínimo de estrutura/S-R/RSI (15) mas abaixo do mínimo real de regime (60) — regime null nunca poisona os outros campos', () => {
    const candles = zigzagTrend(40, 1);
    const ctx = analyzeTimeframe('5m', candles);
    expect(ctx.status).toBe('OK'); // pelo menos um motor real teve leitura
    expect(ctx.regime).toBeNull();
    expect(ctx.regimeDirection).toBeNull();
    expect(ctx.atrPercent).toBeNull();
    expect(ctx.structureLabel).not.toBeNull();
    expect(ctx.rsi).not.toBeNull();
    expect(ctx.support1).not.toBeNull();
    expect(ctx.resistance1).not.toBeNull();
    expect(ctx.candlesUsed).toBe(40);
  });
});

describe('analyzeTimeframe: leitura completa (100 candles, os 4 motores reais) — wiring verificado contra os MESMOS motores chamados diretamente', () => {
  const cases: Array<['alta' | 'baixa', 1 | -1]> = [['alta', 1], ['baixa', -1]];
  for (const [label, direction] of cases) {
    it(`tendência real de ${label}: cada campo bate exatamente com o motor real chamado diretamente sobre a mesma amostra`, () => {
      const candles = zigzagTrend(100, direction);
      const ctx = analyzeTimeframe('1h', candles);

      // Reconstrução independente: os MESMOS motores reais que
      // multi-timeframe-engine.ts importa, chamados diretamente aqui sobre
      // a MESMA amostra — prova o wiring sem hand-predizer swing/ADX.
      const structureResult = analyzeMarketStructure({ ohlcv_series: candles, timeframe: '1h' }) as any;
      const regimeResult = classifyMarketRegime({ ohlcv_series: candles, timeframe: '1h' }) as any;
      const srResult = analyzeSupportResistance({ ohlcv_series: candles, timeframe: '1h' }) as any;
      const rsiSeries = computeRSI(candles.map((c) => c.c), 14) as number[];
      const expectedRsi = rsiSeries[rsiSeries.length - 1];

      // Confirma que o fixture de fato exercita os 4 motores reais (senão
      // as comparações abaixo seriam null===null, um teste vazio disfarçado).
      expect(structureResult.status).toBe('OK');
      expect(srResult.status).toBe('OK');
      expect(regimeResult.status).toBe('OK');
      expect(Number.isFinite(expectedRsi)).toBe(true);

      expect(ctx.status).toBe('OK');
      expect(ctx.reason).toBeNull();
      expect(ctx.structureLabel).toBe(structureResult.structure_label);
      expect(ctx.regime).toBe(regimeResult.regime);
      expect(ctx.regimeDirection).toBe(regimeResult.direction);
      expect(ctx.atrPercent).toBe(regimeResult.evidence.atr_percent);
      expect(ctx.rsi).toBeCloseTo(expectedRsi, 10);
      expect(ctx.support1).toBe(srResult.support_1);
      expect(ctx.resistance1).toBe(srResult.resistance_1);
      expect(ctx.candlesUsed).toBe(100);
      expect(ctx.timeframe).toBe('1h');
      expect(Date.now() - ctx.computedAt).toBeLessThan(5000);

      // Confidence: reconstrução independente via os MESMOS 3 insumos + o
      // MESMO pool real (Stone/DeGroot) que computeTimeframeConfidence usa
      // internamente — trava o rótulo/função exatos usados na chamada real.
      const members: Array<{ id: string; familia: null; opiniao: any }> = [];
      if (structureResult.structure_label) {
        const lbl =
          structureResult.structure_label === 'ESTRUTURA_ALTA' ? 'ALTA'
          : structureResult.structure_label === 'ESTRUTURA_BAIXA' ? 'BAIXA'
          : 'LATERAL';
        const o = opinionFromLabel(lbl);
        if (o) members.push({ id: 'structure', familia: null, opiniao: o });
      }
      if (regimeResult.direction) {
        const o = opinionFromLabel(regimeResult.direction);
        if (o) members.push({ id: 'regime', familia: null, opiniao: o });
      }
      const momentum = momentumAgentVote(Number.isFinite(expectedRsi) ? expectedRsi : null);
      if (momentum.stance !== 'ABSTAIN') {
        const o = opinionFromVote(momentum.stance, momentum.confidence ?? 0);
        if (o) members.push({ id: 'momentum', familia: null, opiniao: o });
      }
      const pool = buildEnsembleConsensus({ members }) as any;
      const expectedStance =
        pool.status === 'OK' ? (pool.direcao === 'ALTA' ? 'LONG' : pool.direcao === 'BAIXA' ? 'SHORT' : 'NEUTRAL') : null;
      const expectedConfidence = pool.status === 'OK' ? pool.forca : null;

      expect(ctx.confidenceStance).toBe(expectedStance);
      if (expectedConfidence === null) {
        expect(ctx.confidence).toBeNull();
      } else {
        expect(ctx.confidence).toBeCloseTo(expectedConfidence, 10);
      }
    });
  }
});
