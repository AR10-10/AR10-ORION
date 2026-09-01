// data-quality.test.ts — permanent regression suite for the Data Quality
// Layer (V15 Fase C: score dinâmico por fonte, 4 dimensões, rebaixamento
// automático de peso). Imports the REAL modules (never a mock) from
// src/market-data-bus/ — only the network-facing `collect` callback is
// faked per test, same convention as market-data-bus.test.ts.
import { describe, it, expect } from 'vitest';
import {
  timeframeToSeconds,
  scoreLatency,
  scoreAvailability,
  computeConsistency,
  scoreStability,
  classifyScore,
  tailFailureStreak,
  composeQualityReport,
  QUALITY_CLASSIFICATION,
  LATENCY_GOOD_MS,
  LATENCY_BAD_MS,
  QUARANTINE_THRESHOLD,
  FAILURE_STREAK_QUARANTINE,
} from '../../src/market-data-bus/quality-engine.js';
import { QualityMonitor } from '../../src/market-data-bus/quality-monitor.js';
import { MarketDataBus } from '../../src/market-data-bus/bus.js';

function candle(t: number, o = 100, h = 105, l = 95, c = 102, v = 10) {
  return { t, o, h, l, c, v };
}

/** Série perfeita de 15m (passo 900s) terminando agora. */
function perfect15mSeries(count: number) {
  const nowSec = Math.floor(Date.now() / 1000);
  return Array.from({ length: count }, (_, i) => candle(nowSec - (count - 1 - i) * 900));
}

const ok = (latencyMs = 100) => ({ ok: true, latencyMs });
const fail = () => ({ ok: false, latencyMs: null });

describe('data-quality: timeframeToSeconds parses only the real closed grammar', () => {
  it('parses the timeframes this codebase actually uses', () => {
    expect(timeframeToSeconds('15m')).toBe(900);
    expect(timeframeToSeconds('1h')).toBe(3600);
    expect(timeframeToSeconds('1m')).toBe(60);
    expect(timeframeToSeconds('1d')).toBe(86400);
  });

  it('returns null (never a guess) for garbage', () => {
    expect(timeframeToSeconds('')).toBeNull();
    expect(timeframeToSeconds('quinze')).toBeNull();
    expect(timeframeToSeconds(null as any)).toBeNull();
    expect(timeframeToSeconds('0m')).toBeNull();
  });

  it("mensal ('1M') devolve null POR DECISÃO — mês não tem passo fixo", () => {
    // Antes isto acontecia por acidente (o regex não tinha o M) e nada
    // registrava o porquê. A razão real: computeConsistency compara cada
    // delta contra o passo com 1% de tolerância; um passo fixo de 30 dias
    // marcaria como inconsistente todo mês de 28/29/31 dias — 8 dos 12 —
    // sobre dado íntegro. Dimensão ausente é honesto; dimensão errada não.
    expect(timeframeToSeconds('1M')).toBeNull();
    expect(timeframeToSeconds('3M')).toBeNull();
  });

  it("'m' minúsculo é MINUTO e 'M' maiúsculo é MÊS — a colisão que já causou bug real aqui", () => {
    // O gráfico mensal já foi lido como de 1 minuto neste projeto. Esta
    // função é case-sensitive de propósito: '1m' resolve, '1M' não.
    expect(timeframeToSeconds('1m')).toBe(60);
    expect(timeframeToSeconds('1M')).toBeNull();
  });

  it('consistência de dimensão ausente é EXCLUÍDA da média, nunca pontuada como zero', () => {
    // A consequência prática de devolver null: computeConsistency devolve
    // null, e composeQualityReport não pode transformar isso num zero que
    // puniria um dado íntegro. Prova por execução real do próprio motor.
    const mensal = computeConsistency(
      [
        { t: 0 }, { t: 2_592_000_000 }, { t: 5_184_000_000 },
      ] as any,
      '1M',
    );
    expect(mensal).toBeNull();
  });
});

describe('data-quality: latency dimension is a documented linear ramp, anchored to the real probe timeout', () => {
  it('is 1.0 at or below the good threshold', () => {
    expect(scoreLatency(LATENCY_GOOD_MS)).toBe(1);
    expect(scoreLatency(50)).toBe(1);
  });

  it('is 0.0 at or above the bad threshold (== probe.js timeout)', () => {
    expect(scoreLatency(LATENCY_BAD_MS)).toBe(0);
    expect(scoreLatency(20_000)).toBe(0);
  });

  it('is exactly 0.5 at the midpoint of the ramp', () => {
    const mid = (LATENCY_GOOD_MS + LATENCY_BAD_MS) / 2;
    expect(scoreLatency(mid)).toBeCloseTo(0.5, 10);
  });

  it('is null (unmeasured, not perfect and not terrible) with no EMA yet', () => {
    expect(scoreLatency(null as any)).toBeNull();
  });
});

describe('data-quality: availability is the honest success ratio over the sliding window', () => {
  it('is null with zero attempts (never an optimistic default)', () => {
    expect(scoreAvailability([])).toBeNull();
  });

  it('is 1.0 when every attempt succeeded and 0.0 when every attempt failed', () => {
    expect(scoreAvailability([ok(), ok(), ok()])).toBe(1);
    expect(scoreAvailability([fail(), fail()])).toBe(0);
  });

  it('is the exact ratio for mixed outcomes', () => {
    expect(scoreAvailability([ok(), fail(), ok(), fail()])).toBe(0.5);
  });
});

describe('data-quality: consistency detects real temporal gaps, without touching the local clock', () => {
  it('is 1.0 for a perfectly spaced series', () => {
    expect(computeConsistency(perfect15mSeries(10), '15m')).toBe(1);
  });

  it('drops to the exact fraction when one candle is missing (interval of 2 steps)', () => {
    // t: 0, 900, 1800, 3600 — the 2700 candle is missing.
    const series = [candle(0), candle(900), candle(1800), candle(3600)];
    expect(computeConsistency(series, '15m')).toBeCloseTo(2 / 3, 10);
  });

  it('is null for an unparseable timeframe or a series too short to have intervals', () => {
    expect(computeConsistency(perfect15mSeries(10), 'xyz')).toBeNull();
    expect(computeConsistency([candle(0)], '15m')).toBeNull();
  });
});

describe('data-quality: stability is latency jitter (CV) over real successes only', () => {
  it('is null below the minimum sample count', () => {
    expect(scoreStability([ok(100), ok(100)])).toBeNull();
  });

  it('is 1.0 for perfectly constant latencies', () => {
    expect(scoreStability([ok(200), ok(200), ok(200)])).toBe(1);
  });

  it('is low for erratic latencies even when the mean is fast', () => {
    const jittery = scoreStability([ok(50), ok(900), ok(50), ok(900)]);
    const steady = scoreStability([ok(475), ok(475), ok(475), ok(475)]);
    expect(jittery!).toBeLessThan(steady!);
  });

  it('ignores failures (they punish availability, not jitter)', () => {
    expect(scoreStability([ok(200), fail(), ok(200), ok(200)])).toBe(1);
  });
});

describe('data-quality: composite score, weight demotion and classification', () => {
  it('with no measurements at all: score null, weight null, DADOS_INSUFICIENTES', () => {
    const report = composeQualityReport({ emaLatencyMs: null, attempts: [], consistency: null });
    expect(report.score).toBeNull();
    expect(report.weight).toBeNull();
    expect(report.classification).toBe(QUALITY_CLASSIFICATION.DADOS_INSUFICIENTES);
  });

  it('null dimensions are excluded and the mean renormalizes over the measured ones', () => {
    // Only availability measured (one failure): score must be exactly 0,
    // not diluted by unmeasured dimensions.
    const report = composeQualityReport({ emaLatencyMs: null, attempts: [fail()], consistency: null });
    expect(report.score).toBe(0);
    expect(report.weight).toBe(0);
    expect(report.classification).toBe(QUALITY_CLASSIFICATION.QUARENTENA);
  });

  it('a healthy source scores high, weight == score, classification EXCELENTE', () => {
    const report = composeQualityReport({
      emaLatencyMs: 200,
      attempts: [ok(180), ok(210), ok(200), ok(190)],
      consistency: 1,
    });
    expect(report.score).toBeGreaterThanOrEqual(0.85);
    expect(report.weight).toBe(report.score);
    expect(report.classification).toBe(QUALITY_CLASSIFICATION.EXCELENTE);
  });

  it('below the quarantine threshold the weight is forced to exactly 0 (never a small residual weight)', () => {
    // Latency at the floor + heavy failures drive the composite under 0.25.
    const attempts = [ok(7900), fail(), fail(), fail()];
    const report = composeQualityReport({ emaLatencyMs: 7900, attempts, consistency: 0 });
    expect(report.score).not.toBeNull();
    expect(report.score!).toBeLessThan(QUARANTINE_THRESHOLD);
    expect(report.weight).toBe(0);
    expect(report.classification).toBe(QUALITY_CLASSIFICATION.QUARENTENA);
  });

  it('classification thresholds are exact', () => {
    expect(classifyScore(0.85)).toBe(QUALITY_CLASSIFICATION.EXCELENTE);
    expect(classifyScore(0.6)).toBe(QUALITY_CLASSIFICATION.SAUDAVEL);
    expect(classifyScore(0.25)).toBe(QUALITY_CLASSIFICATION.DEGRADADA);
    expect(classifyScore(0.2499)).toBe(QUALITY_CLASSIFICATION.QUARENTENA);
    expect(classifyScore(null)).toBe(QUALITY_CLASSIFICATION.DADOS_INSUFICIENTES);
  });
});

describe('data-quality: failure-streak circuit — a freshly dead source cannot hide behind its own old good numbers', () => {
  it('tailFailureStreak counts only the consecutive failures at the tail', () => {
    expect(tailFailureStreak([ok(), fail(), fail()])).toBe(2);
    expect(tailFailureStreak([fail(), fail(), ok()])).toBe(0);
    expect(tailFailureStreak([])).toBe(0);
  });

  it(`${FAILURE_STREAK_QUARANTINE} consecutive failures force weight 0 + QUARENTENA even while stale latency/consistency hold the composite high`, () => {
    // 10 good attempts followed by a full quarantine streak of failures:
    // latency EMA (200ms => 1.0) and consistency (1.0) are frozen from the
    // last success — without the streak circuit the composite stays ~0.7.
    const attempts = [
      ...Array.from({ length: 10 }, () => ok(200)),
      ...Array.from({ length: FAILURE_STREAK_QUARANTINE }, () => fail()),
    ];
    const report = composeQualityReport({ emaLatencyMs: 200, attempts, consistency: 1 });
    expect(report.score!).toBeGreaterThan(QUARANTINE_THRESHOLD); // the composite alone would NOT quarantine
    expect(report.failureStreak).toBe(FAILURE_STREAK_QUARANTINE);
    expect(report.weight).toBe(0); // ...but the streak circuit does
    expect(report.classification).toBe(QUALITY_CLASSIFICATION.QUARENTENA);
  });

  it('a single real success exits streak-quarantine automatically (zero human intervention, both directions)', () => {
    const attempts = [
      ...Array.from({ length: FAILURE_STREAK_QUARANTINE }, () => fail()),
      ok(200),
    ];
    const report = composeQualityReport({ emaLatencyMs: 200, attempts, consistency: 1 });
    expect(report.failureStreak).toBe(0);
    expect(report.weight).toBe(report.score);
    expect(report.classification).not.toBe(QUALITY_CLASSIFICATION.QUARENTENA);
  });
});

describe('data-quality: QualityMonitor accumulates real attempts per stream key', () => {
  it('an unknown key reports DADOS_INSUFICIENTES, never an optimistic default', () => {
    const monitor = new QualityMonitor();
    const report = monitor.reportFor('BTC:15m');
    expect(report.score).toBeNull();
    expect(report.classification).toBe(QUALITY_CLASSIFICATION.DADOS_INSUFICIENTES);
  });

  it('keys never contaminate each other', () => {
    const monitor = new QualityMonitor();
    monitor.recordSuccess('BTC:15m', 100, perfect15mSeries(5), '15m');
    monitor.recordFailure('ETH:15m');
    expect(monitor.reportFor('BTC:15m').dimensions.availability).toBe(1);
    expect(monitor.reportFor('ETH:15m').dimensions.availability).toBe(0);
  });

  it('the sliding window really slides (old attempts fall out)', () => {
    const monitor = new QualityMonitor();
    // 20 failures, then 20 successes: window keeps only the last 20.
    for (let i = 0; i < 20; i++) monitor.recordFailure('SOL:15m');
    for (let i = 0; i < 20; i++) monitor.recordSuccess('SOL:15m', 100, perfect15mSeries(5), '15m');
    const report = monitor.reportFor('SOL:15m');
    expect(report.sampleSize).toBe(20);
    expect(report.dimensions.availability).toBe(1);
  });
});

describe('data-quality: integration with the real MarketDataBus distribution flow', () => {
  it('every published snapshot carries the quality report of the source that produced it', async () => {
    const bus = new MarketDataBus();
    const collect = async () => perfect15mSeries(10);
    const snapshot = await bus.requestSnapshot({ symbol: 'BTC', timeframe: '15m', limit: 10, collect });
    expect(snapshot.ok).toBe(true);
    expect(snapshot.quality).toBeDefined();
    expect(snapshot.quality.dimensions.availability).toBe(1);
    expect(snapshot.quality.dimensions.consistency).toBe(1);
    expect(snapshot.quality.weight).toBe(snapshot.quality.score);
    expect(Object.values(QUALITY_CLASSIFICATION)).toContain(snapshot.quality.classification);
  });

  it('a delivered series with a temporal gap is visible in the snapshot quality (consistency < 1)', async () => {
    const bus = new MarketDataBus();
    const nowSec = Math.floor(Date.now() / 1000);
    // 15m series with one missing candle in the middle.
    const gappy = [candle(nowSec - 3600), candle(nowSec - 2700), candle(nowSec - 900), candle(nowSec)];
    const collect = async () => gappy;
    const snapshot = await bus.requestSnapshot({ symbol: 'ETH', timeframe: '15m', limit: 4, collect });
    expect(snapshot.ok).toBe(true);
    expect(snapshot.quality.dimensions.consistency).toBeCloseTo(2 / 3, 10);
  });

  it('repeated collect failures demote the source to weight 0 automatically — zero human intervention', async () => {
    const bus = new MarketDataBus();
    const alwaysFails = async () => {
      throw new Error('rede_morta');
    };
    for (let i = 0; i < FAILURE_STREAK_QUARANTINE; i++) {
      await bus.requestSnapshot({ symbol: 'BNB', timeframe: '15m', limit: 2, collect: alwaysFails });
    }
    const report = bus.getQualityReport('BNB', '15m');
    expect(report.dimensions.availability).toBe(0);
    expect(report.weight).toBe(0);
    expect(report.classification).toBe(QUALITY_CLASSIFICATION.QUARENTENA);
  });

  it('a corrupted series (rejected by the integrity validator) counts as a quality failure, same as a network error', async () => {
    const bus = new MarketDataBus();
    const corrupted = async () => [{ t: 1, o: 100, h: 90, l: 95, c: 92, v: 1 }]; // high < low
    await bus.requestSnapshot({ symbol: 'XRP', timeframe: '15m', limit: 1, collect: corrupted });
    const report = bus.getQualityReport('XRP', '15m');
    expect(report.dimensions.availability).toBe(0);
    expect(report.failureStreak).toBe(1);
  });

  it('the fail-closed fallback snapshot keeps the LAST GOOD candles but carries the CURRENT degraded quality', async () => {
    const bus = new MarketDataBus();
    let attempt = 0;
    const flaky = async () => {
      attempt++;
      if (attempt === 1) return perfect15mSeries(5);
      throw new Error('rede_caiu');
    };
    const first = await bus.requestSnapshot({ symbol: 'SOL', timeframe: '15m', limit: 5, collect: flaky, maxAgeMs: 0 });
    const second = await bus.requestSnapshot({ symbol: 'SOL', timeframe: '15m', limit: 5, collect: flaky, maxAgeMs: 0 });
    expect(second.ok).toBe(true);
    expect(second.candles).toEqual(first.candles); // data: last known good, never fabricated
    expect(first.quality.dimensions.availability).toBe(1);
    expect(second.quality.dimensions.availability).toBe(0.5); // telemetry: current, honest
  });

  it('recovery is automatic too: one real success after quarantine restores a non-zero weight', async () => {
    const bus = new MarketDataBus();
    let failing = true;
    const collect = async () => {
      if (failing) throw new Error('fora_do_ar');
      return perfect15mSeries(5);
    };
    for (let i = 0; i < FAILURE_STREAK_QUARANTINE; i++) {
      await bus.requestSnapshot({ symbol: 'ADA', timeframe: '15m', limit: 5, collect });
    }
    expect(bus.getQualityReport('ADA', '15m').weight).toBe(0);

    failing = false;
    const recovered = await bus.requestSnapshot({ symbol: 'ADA', timeframe: '15m', limit: 5, collect });
    expect(recovered.ok).toBe(true);
    const report = bus.getQualityReport('ADA', '15m');
    expect(report.failureStreak).toBe(0);
    expect(report.weight!).toBeGreaterThan(0);
  });
});
