// market-data-bus.test.ts — permanent regression suite for the Market Data
// Bus (V15 Fase B: Coleta -> Normalização -> Validação -> Sincronização
// Temporal -> Distribuição). Imports the REAL modules (never a mock) from
// src/market-data-bus/ — only the network-facing `collect` callback is
// faked per test, exactly like target-tracker.test.ts fakes livePrice/
// snapshot inputs instead of hitting a real exchange.
import { describe, it, expect } from 'vitest';
import { normalizeCandles } from '../../src/market-data-bus/normalizer.js';
import { validateCandleSeries } from '../../src/market-data-bus/integrity-validator.js';
import { computeAsOf, computeAgeMs, isStale } from '../../src/market-data-bus/time-synchronizer.js';
import { MarketDataBus } from '../../src/market-data-bus/bus.js';

function candle(t: number, o = 100, h = 105, l = 95, c = 102, v = 10) {
  return { t, o, h, l, c, v };
}

describe('market-data-bus: normalizer never fabricates, only drops malformed rows', () => {
  it('keeps well-formed candles untouched', () => {
    const out = normalizeCandles([candle(1), candle(2)]);
    expect(out).toEqual([candle(1), candle(2)]);
  });

  it('drops a row missing a required field instead of inventing it', () => {
    const out = normalizeCandles([candle(1), { t: 2, o: 100, h: 105, l: 95, c: 102 }]);
    expect(out).toEqual([candle(1)]);
  });

  it('drops a row with a non-finite field (NaN/Infinity)', () => {
    const out = normalizeCandles([candle(1), candle(2, NaN)]);
    expect(out).toEqual([candle(1)]);
  });

  it('returns an empty array for non-array input, never throws', () => {
    expect(normalizeCandles(null as any)).toEqual([]);
    expect(normalizeCandles(undefined as any)).toEqual([]);
  });
});

describe('market-data-bus: integrity-validator rejects the whole series on structural inconsistency', () => {
  it('accepts a well-formed ascending series', () => {
    const result = validateCandleSeries([candle(1), candle(2), candle(3)]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects an empty series', () => {
    expect(validateCandleSeries([]).valid).toBe(false);
  });

  it('rejects when high < low', () => {
    const result = validateCandleSeries([candle(1, 100, 90, 95, 92)]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('high_menor_que_low'))).toBe(true);
  });

  it('rejects when high is below open/close', () => {
    const result = validateCandleSeries([{ t: 1, o: 100, h: 99, l: 90, c: 98, v: 1 }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('high_abaixo_de_open_ou_close'))).toBe(true);
  });

  it('rejects a non-positive price', () => {
    const result = validateCandleSeries([candle(1, 0)]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('preco_nao_positivo'))).toBe(true);
  });

  it('rejects timestamps that are not strictly increasing', () => {
    const result = validateCandleSeries([candle(2), candle(1)]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('timestamp_nao_estritamente_crescente'))).toBe(true);
  });
});

describe('market-data-bus: time-synchronizer age is always derived from the real last candle', () => {
  it('computeAsOf converts the last candle seconds-timestamp to ms', () => {
    expect(computeAsOf([candle(1000), candle(2000)])).toBe(2000 * 1000);
  });

  it('computeAsOf is null for an empty series (never fabricated)', () => {
    expect(computeAsOf([])).toBeNull();
  });

  it('computeAgeMs is Infinity (never a fabricated small number) for a null asOf', () => {
    expect(computeAgeMs(null as any)).toBe(Infinity);
  });

  it('isStale is true for a non-finite age (fail-closed)', () => {
    expect(isStale(Infinity, 10_000)).toBe(true);
    expect(isStale(NaN, 10_000)).toBe(true);
  });

  it('isStale compares age against the threshold honestly', () => {
    expect(isStale(5_000, 10_000)).toBe(false);
    expect(isStale(15_000, 10_000)).toBe(true);
  });
});

describe('market-data-bus: MarketDataBus dedupes concurrent requests (the real Fase A finding)', () => {
  it('two concurrent requestSnapshot calls for the same symbol:timeframe trigger exactly one collect()', async () => {
    const bus = new MarketDataBus();
    let collectCalls = 0;
    const collect = async () => {
      collectCalls++;
      await new Promise((r) => setTimeout(r, 5));
      return [candle(1), candle(2), candle(3)];
    };

    const [a, b] = await Promise.all([
      bus.requestSnapshot({ symbol: 'BTC', timeframe: '15m', limit: 3, collect }),
      bus.requestSnapshot({ symbol: 'BTC', timeframe: '15m', limit: 3, collect }),
    ]);

    expect(collectCalls).toBe(1);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.candles).toEqual(b.candles);
  });

  it('a fresh cached snapshot is reused without calling collect() again', async () => {
    const bus = new MarketDataBus();
    let collectCalls = 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const collect = async () => {
      collectCalls++;
      return [candle(nowSec - 1), candle(nowSec)];
    };

    await bus.requestSnapshot({ symbol: 'ETH', timeframe: '15m', limit: 2, collect, maxAgeMs: 60_000 });
    await bus.requestSnapshot({ symbol: 'ETH', timeframe: '15m', limit: 2, collect, maxAgeMs: 60_000 });

    expect(collectCalls).toBe(1);
  });

  it('distinct symbol:timeframe keys never collide (BTC:15m vs BTC:1h are independent)', async () => {
    const bus = new MarketDataBus();
    const collect15m = async () => [candle(1, 100, 105, 95, 102)];
    const collect1h = async () => [candle(1, 999, 1005, 995, 1002)];

    const snap15m = await bus.requestSnapshot({ symbol: 'BTC', timeframe: '15m', limit: 1, collect: collect15m });
    const snap1h = await bus.requestSnapshot({ symbol: 'BTC', timeframe: '1h', limit: 1, collect: collect1h });

    expect(snap15m.candles[0].o).toBe(100);
    expect(snap1h.candles[0].o).toBe(999);
  });

  it('falls back to the last known-good snapshot when collect() fails, never fabricating data', async () => {
    const bus = new MarketDataBus();
    let attempt = 0;
    const flakyCollect = async () => {
      attempt++;
      if (attempt === 1) return [candle(1), candle(2)];
      throw new Error('rede_indisponivel');
    };

    const first = await bus.requestSnapshot({ symbol: 'SOL', timeframe: '15m', limit: 2, collect: flakyCollect, maxAgeMs: 0 });
    const second = await bus.requestSnapshot({ symbol: 'SOL', timeframe: '15m', limit: 2, collect: flakyCollect, maxAgeMs: 0 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.candles).toEqual(first.candles);
  });

  it('reports ok:false (never a fabricated snapshot) when collect() fails with no prior snapshot', async () => {
    const bus = new MarketDataBus();
    const alwaysFails = async () => {
      throw new Error('sem_rede');
    };
    const result = await bus.requestSnapshot({ symbol: 'BNB', timeframe: '15m', limit: 2, collect: alwaysFails });
    expect(result.ok).toBe(false);
    expect(result.candles).toEqual([]);
  });

  it('rejects the whole snapshot (fail-closed) when collect() returns a structurally invalid series', async () => {
    const bus = new MarketDataBus();
    const badCollect = async () => [{ t: 1, o: 100, h: 90, l: 95, c: 92, v: 1 }]; // high < low
    const result = await bus.requestSnapshot({ symbol: 'XRP', timeframe: '15m', limit: 1, collect: badCollect });
    expect(result.ok).toBe(false);
  });

  it('slices a larger cached snapshot down to a smaller requested limit', async () => {
    const bus = new MarketDataBus();
    const nowSec = Math.floor(Date.now() / 1000);
    const c1 = candle(nowSec - 3);
    const c2 = candle(nowSec - 2);
    const c3 = candle(nowSec - 1);
    const c4 = candle(nowSec);
    const collect = async () => [c1, c2, c3, c4];
    await bus.requestSnapshot({ symbol: 'BTC', timeframe: '5m', limit: 4, collect });
    const smaller = await bus.requestSnapshot({ symbol: 'BTC', timeframe: '5m', limit: 2, collect, maxAgeMs: 60_000 });
    expect(smaller.candles).toEqual([c3, c4]);
  });
});

describe('market-data-bus: stress — high-volume concurrent demand still yields exactly one real fetch', () => {
  it('25 simultaneous requestSnapshot calls for the same key trigger exactly one collect(), all identical', async () => {
    const bus = new MarketDataBus();
    let collectCalls = 0;
    const collect = async () => {
      collectCalls++;
      await new Promise((r) => setTimeout(r, 10));
      return [candle(1), candle(2), candle(3)];
    };

    const results = await Promise.all(
      Array.from({ length: 25 }, () => bus.requestSnapshot({ symbol: 'BTC', timeframe: '15m', limit: 3, collect })),
    );

    expect(collectCalls).toBe(1);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.every((r) => r.candles === results[0].candles || JSON.stringify(r.candles) === JSON.stringify(results[0].candles))).toBe(true);
  });

  it('a burst of consumers with different limits (chart=50, analysis=100, HTF-style=60) within the same freshness window still triggers exactly one collect()', async () => {
    const bus = new MarketDataBus();
    let collectCalls = 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const window = Array.from({ length: 100 }, (_, i) => candle(nowSec - (99 - i)));
    const collect = async () => {
      collectCalls++;
      return window;
    };

    const [chart, analysis, mid] = await Promise.all([
      bus.requestSnapshot({ symbol: 'ETH', timeframe: '15m', limit: 50, collect }),
      bus.requestSnapshot({ symbol: 'ETH', timeframe: '15m', limit: 100, collect }),
      bus.requestSnapshot({ symbol: 'ETH', timeframe: '15m', limit: 60, collect }),
    ]);

    expect(collectCalls).toBe(1);
    expect(chart.candles.length).toBe(50);
    expect(analysis.candles.length).toBe(100);
    expect(mid.candles.length).toBe(60);
  });

  it('100 sequential requests within the freshness window never re-fetch after the first (no request-storm on a hot key)', async () => {
    const bus = new MarketDataBus();
    let collectCalls = 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const collect = async () => {
      collectCalls++;
      return [candle(nowSec - 1), candle(nowSec)];
    };

    for (let i = 0; i < 100; i++) {
      await bus.requestSnapshot({ symbol: 'SOL', timeframe: '15m', limit: 2, collect, maxAgeMs: 60_000 });
    }

    expect(collectCalls).toBe(1);
  });
});

describe('market-data-bus: pipeline telemetry (Estabilização Prioridade 2) — Recebido/Normalizado/Validado/Sincronizado/Distribuído observáveis em runtime', () => {
  it('returns null for a key that was never requested (no fabricated telemetry)', () => {
    const bus = new MarketDataBus();
    expect(bus.getPipelineTelemetry('GHOST', '15m')).toBeNull();
  });

  it('a successful collect() marks all 5 stages ok, with no failedStage and recovered false', async () => {
    const bus = new MarketDataBus();
    const collect = async () => [candle(1), candle(2), candle(3)];
    await bus.requestSnapshot({ symbol: 'BTC', timeframe: '15m', limit: 3, collect });

    const telemetry = bus.getPipelineTelemetry('BTC', '15m');
    expect(telemetry).not.toBeNull();
    for (const stage of ['recebido', 'normalizado', 'validado', 'sincronizado', 'distribuido'] as const) {
      expect(telemetry!.stages[stage]?.ok, `etapa ${stage} deveria estar ok`).toBe(true);
      expect(telemetry!.stages[stage]?.at).toBeGreaterThan(0);
    }
    expect(telemetry!.failedStage).toBeNull();
    expect(telemetry!.recovered).toBe(false);
  });

  it('a structurally invalid series stops at "validado" with the real component/reason, later stages stay null', async () => {
    const bus = new MarketDataBus();
    const badCollect = async () => [{ t: 1, o: 100, h: 90, l: 95, c: 92, v: 1 }]; // high < low
    await bus.requestSnapshot({ symbol: 'XRP', timeframe: '15m', limit: 1, collect: badCollect });

    const telemetry = bus.getPipelineTelemetry('XRP', '15m');
    expect(telemetry!.stages.recebido?.ok).toBe(true);
    expect(telemetry!.stages.normalizado?.ok).toBe(true);
    expect(telemetry!.stages.validado?.ok).toBe(false);
    expect(telemetry!.stages.sincronizado).toBeNull();
    expect(telemetry!.stages.distribuido).toBeNull();
    expect(telemetry!.failedStage).toBe('validado');
    expect(telemetry!.failedComponent).toBe('integrity-validator.js');
    expect(telemetry!.failedReason).toContain('high_menor_que_low');
    // sem snapshot anterior nenhum para recuperar — recovered honesto: false
    expect(telemetry!.recovered).toBe(false);
  });

  it('collect() throwing is attributed to "recebido", with the real exception message as reason', async () => {
    const bus = new MarketDataBus();
    const alwaysFails = async () => {
      throw new Error('sem_rede');
    };
    await bus.requestSnapshot({ symbol: 'BNB', timeframe: '15m', limit: 2, collect: alwaysFails });

    const telemetry = bus.getPipelineTelemetry('BNB', '15m');
    expect(telemetry!.failedStage).toBe('recebido');
    expect(telemetry!.failedComponent).toBe('collect (conector injetado pelo chamador)');
    expect(telemetry!.failedReason).toContain('sem_rede');
    expect(telemetry!.recovered).toBe(false);
  });

  it('a later failure recovers via the last known-good snapshot — recovered:true even though failedStage records the real failure', async () => {
    const bus = new MarketDataBus();
    let attempt = 0;
    const flakyCollect = async () => {
      attempt++;
      if (attempt === 1) return [candle(1), candle(2)];
      throw new Error('rede_indisponivel');
    };

    await bus.requestSnapshot({ symbol: 'SOL', timeframe: '15m', limit: 2, collect: flakyCollect, maxAgeMs: 0 });
    const second = await bus.requestSnapshot({ symbol: 'SOL', timeframe: '15m', limit: 2, collect: flakyCollect, maxAgeMs: 0 });

    expect(second.ok).toBe(true); // fail-closed já existente (Fase B): último snapshot bom
    const telemetry = bus.getPipelineTelemetry('SOL', '15m');
    expect(telemetry!.failedStage).toBe('recebido');
    expect(telemetry!.failedReason).toContain('rede_indisponivel');
    expect(telemetry!.recovered).toBe(true); // Prioridade 3: recuperação automática observável
  });

  it('reports ok:false with recovered:false when collect() fails and there is no prior snapshot to fall back to', async () => {
    const bus = new MarketDataBus();
    const alwaysFails = async () => {
      throw new Error('primeira_tentativa_sem_rede');
    };
    const result = await bus.requestSnapshot({ symbol: 'ADA', timeframe: '15m', limit: 2, collect: alwaysFails });

    expect(result.ok).toBe(false);
    const telemetry = bus.getPipelineTelemetry('ADA', '15m');
    expect(telemetry!.recovered).toBe(false); // honesto: não havia nada bom pra recuperar
  });
});

describe('market-data-bus: temporal validation — staleness boundary is exact, never approximate', () => {
  it('age exactly equal to maxAgeMs is NOT stale (boundary is a strict greater-than)', () => {
    expect(isStale(10_000, 10_000)).toBe(false);
  });

  it('age one millisecond past maxAgeMs IS stale', () => {
    expect(isStale(10_001, 10_000)).toBe(true);
  });

  it('a snapshot exactly at the freshness boundary is reused; one millisecond older triggers a real refetch', async () => {
    const bus = new MarketDataBus();
    let collectCalls = 0;
    // asOf pinned far enough in the past that we can control ageMs precisely
    // via maxAgeMs on the second call, instead of racing the real clock.
    const asOfSec = Math.floor((Date.now() - 5_000) / 1000);
    const collect = async () => {
      collectCalls++;
      return [candle(asOfSec)];
    };

    const first = await bus.requestSnapshot({ symbol: 'BNB', timeframe: '1m', limit: 1, collect, maxAgeMs: 60_000 });
    const stillFresh = await bus.requestSnapshot({ symbol: 'BNB', timeframe: '1m', limit: 1, collect, maxAgeMs: 60_000 });
    expect(collectCalls).toBe(1);

    const nowStale = await bus.requestSnapshot({ symbol: 'BNB', timeframe: '1m', limit: 1, collect, maxAgeMs: 1 });
    expect(collectCalls).toBe(2);
    expect(first.ok && stillFresh.ok && nowStale.ok).toBe(true);
  });
});
