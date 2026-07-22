// nexus-persistence.test.ts — V-MAX Fase 0.3: trava a persistência
// IndexedDB real via fake-indexeddb (implementação spec-compliant, não
// um mock de comportamento) — o ambiente de teste (vitest environment:
// 'node') não tem IndexedDB nativo, então isto é o que torna a camada
// Local-First genuinely testável em vez de só confiada por inspeção.
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  candleKey,
  saveCandles,
  loadCandles,
  saveSnapshotSummary,
  loadSnapshotSummary,
  saveTrackRecord,
  loadTrackRecord,
  compactPersistedCandles,
  CANDLE_CACHE_MAX_AGE_MS,
  CANDLE_CACHE_MAX_RECORDS,
  __closeDbConnectionForTests,
} from '../src/nexus/persistence';
import type { Candle } from '../src/nexus/types';

function candle(t: number, o = 100, h = 105, l = 95, c = 102): Candle {
  return { time: t, open: o, high: h, low: l, close: c };
}

beforeEach(async () => {
  await __closeDbConnectionForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('ar10-cyborg-nexus');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('persistence: candleKey é pura e determinística', () => {
  it('combina symbol:timeframe exatamente', () => {
    expect(candleKey('BTC', '15m')).toBe('BTC:15m');
    expect(candleKey('ETH', '1h')).toBe('ETH:1h');
  });
});

describe('persistence: candles reais salvos são lidos de volta exatamente (round-trip real via IndexedDB)', () => {
  it('loadCandles retorna null honesto quando nunca foi salvo (nunca um array vazio fabricado)', async () => {
    const result = await loadCandles('SOL', '15m');
    expect(result).toBeNull();
  });

  it('saveCandles + loadCandles faz round-trip exato dos candles reais', async () => {
    const data = [candle(1000), candle(1900, 102, 108, 98, 105)];
    await saveCandles('BTC', '15m', data);
    const result = await loadCandles('BTC', '15m');
    expect(result).toEqual(data);
  });

  it('chaves distintas (symbol:timeframe) nunca colidem — BTC:15m e BTC:1h são independentes', async () => {
    const data15m = [candle(1000)];
    const data1h = [candle(2000, 999)];
    await saveCandles('BTC', '15m', data15m);
    await saveCandles('BTC', '1h', data1h);
    expect(await loadCandles('BTC', '15m')).toEqual(data15m);
    expect(await loadCandles('BTC', '1h')).toEqual(data1h);
  });

  it('salvar de novo na mesma chave substitui o valor anterior (nunca acumula duplicado)', async () => {
    await saveCandles('ETH', '5m', [candle(1)]);
    await saveCandles('ETH', '5m', [candle(1), candle(2)]);
    const result = await loadCandles('ETH', '5m');
    expect(result).toHaveLength(2);
  });
});

describe('persistence: resumo do snapshot (símbolo/timeframe ativos, conexões) sobrevive round-trip real', () => {
  it('loadSnapshotSummary retorna null honesto quando nunca foi salvo', async () => {
    expect(await loadSnapshotSummary()).toBeNull();
  });

  it('saveSnapshotSummary + loadSnapshotSummary faz round-trip exato', async () => {
    await saveSnapshotSummary({
      activeSymbol: 'BTC',
      activeTimeframe: '15m',
      connections: { BINANCE: 'LIVE', BYBIT: 'DEGRADED' },
    });
    const result = await loadSnapshotSummary();
    expect(result?.activeSymbol).toBe('BTC');
    expect(result?.activeTimeframe).toBe('15m');
    expect(result?.connections).toEqual({ BINANCE: 'LIVE', BYBIT: 'DEGRADED' });
    expect(result?.savedAt).toBeGreaterThan(0);
  });

  it('salvar de novo substitui o resumo anterior (uma única linha "latest", nunca um histórico acumulado)', async () => {
    await saveSnapshotSummary({ activeSymbol: 'BTC', activeTimeframe: '15m', connections: {} });
    await saveSnapshotSummary({ activeSymbol: 'ETH', activeTimeframe: '1h', connections: { OKX: 'LIVE' } });
    const result = await loadSnapshotSummary();
    expect(result?.activeSymbol).toBe('ETH');
  });
});

// ─── Consolidação Operacional §5: envelhecimento/compactação do cache ───
// Execução real via fake-indexeddb (mesma convenção do resto do arquivo):
// savedAt é controlado espionando Date.now() durante cada save — nunca um
// sleep frágil, nunca um registro fabricado direto na store.
describe('persistence §5: compactPersistedCandles (envelhecimento + teto, nunca toca o track record)', () => {
  async function saveAt(savedAt: number, symbol: string, tf: '1m' | '5m' | '15m' | '1h') {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(savedAt);
    try {
      await saveCandles(symbol, tf, [candle(savedAt)]);
    } finally {
      spy.mockRestore();
    }
  }

  it('expira registros além do TTL e preserva os dentro dele — contagens honestas no resultado', async () => {
    await saveAt(1_000, 'BTC', '15m'); // idade 9_000 > TTL 5_000 → expira
    await saveAt(6_000, 'ETH', '1h'); //  idade 4_000 ≤ TTL 5_000 → fica
    const result = await compactPersistedCandles(10_000, 5_000, 64);
    expect(result).toEqual({ scanned: 2, expired: 1, evicted: 0 });
    expect(await loadCandles('BTC', '15m')).toBeNull();
    expect(await loadCandles('ETH', '1h')).not.toBeNull();
  });

  it('acima do teto despeja os MAIS ANTIGOS primeiro (savedAt), preservando os recentes', async () => {
    await saveAt(1_000, 'BTC', '1m');
    await saveAt(2_000, 'ETH', '1m');
    await saveAt(3_000, 'SOL', '1m');
    const result = await compactPersistedCandles(4_000, 1_000_000, 2);
    expect(result).toEqual({ scanned: 3, expired: 0, evicted: 1 });
    expect(await loadCandles('BTC', '1m')).toBeNull(); // o mais antigo saiu
    expect(await loadCandles('ETH', '1m')).not.toBeNull();
    expect(await loadCandles('SOL', '1m')).not.toBeNull();
  });

  it('sem expiração nem excesso: zero remoções e os dados ficam intactos (compactação nunca é destrutiva à toa)', async () => {
    await saveAt(9_000, 'BTC', '5m');
    await saveAt(9_500, 'ETH', '5m');
    const result = await compactPersistedCandles(10_000, 5_000, 64);
    expect(result).toEqual({ scanned: 2, expired: 0, evicted: 0 });
    expect(await loadCandles('BTC', '5m')).not.toBeNull();
    expect(await loadCandles('ETH', '5m')).not.toBeNull();
  });

  it('NUNCA toca a snapshot store: track record e resumo sobrevivem a uma compactação agressiva', async () => {
    await saveAt(1_000, 'BTC', '15m');
    await saveTrackRecord({ contractVersion: 2, active: null, history: [], targetHits: 3, partialHits: 1, stopHits: 2, replaced: 0 });
    await saveSnapshotSummary({ activeSymbol: 'BTC', activeTimeframe: '15m', connections: {} });
    const result = await compactPersistedCandles(1_000_000_000, 1, 0); // TTL 1ms + teto 0: remove TODO candle
    expect(result?.scanned).toBe(1);
    expect(await loadCandles('BTC', '15m')).toBeNull();
    const track = (await loadTrackRecord()) as { targetHits: number } | null;
    expect(track?.targetHits).toBe(3); // conhecimento acumulado real intacto
    expect((await loadSnapshotSummary())?.activeSymbol).toBe('BTC');
  });

  it('constantes documentadas são reais: TTL de 14 dias e teto de 64 registros', () => {
    expect(CANDLE_CACHE_MAX_AGE_MS).toBe(14 * 24 * 60 * 60 * 1000);
    expect(CANDLE_CACHE_MAX_RECORDS).toBe(64);
  });
});
