// nexus-persistence.test.ts — V-MAX Fase 0.3: trava a persistência
// IndexedDB real via fake-indexeddb (implementação spec-compliant, não
// um mock de comportamento) — o ambiente de teste (vitest environment:
// 'node') não tem IndexedDB nativo, então isto é o que torna a camada
// Local-First genuinely testável em vez de só confiada por inspeção.
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from 'vitest';
import {
  candleKey,
  saveCandles,
  loadCandles,
  saveSnapshotSummary,
  loadSnapshotSummary,
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
