// mexc-futures-candle-connector.test.ts — ADITIVO V-MAX Etapa 1 (Market
// Data Adapter): irmão direto de binance-futures-candle-connector.test.ts
// — mesma trava real (o sufixo de cache do Bus nunca pode vazar para o
// parâmetro de símbolo enviado à API), agora cobrindo os DOIS sufixos
// possíveis (`-PERP`, herdado do Binance por convenção de cache-key, e
// `-MEXC`, a convenção nova documentada em market-data-adapter.ts para
// um futuro caller que peça este provider explicitamente).
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../js/real-data/mexc-futures-public.js', () => ({
  probe: vi.fn(),
}));

import { probe } from '../../js/real-data/mexc-futures-public.js';
import { collectMexcFuturesKlines } from '../../src/market-data-bus/mexc-futures-candle-connector.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';

const mockedProbe = probe as unknown as ReturnType<typeof vi.fn>;

function fakeCandles() {
  return [{ t: 1700000000, o: 100, h: 105, l: 95, c: 102, v: 10 }];
}

describe('mexc-futures-candle-connector: nenhum sufixo de cache-key vaza para a API real', () => {
  afterEach(() => {
    mockedProbe.mockReset();
  });

  it('symbol="BTC-PERP" chega a probe() como "BTC" puro (mesma convenção de cache-key que o Bus já usa para Binance)', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectMexcFuturesKlines({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100 });
    expect(mockedProbe).toHaveBeenCalledWith({ symbol: 'BTC', interval: '15m', limit: 100, endTime: undefined });
  });

  it('symbol="BTC-MEXC" (convenção nova, dedicada ao provider MEXC) também chega como "BTC" puro', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectMexcFuturesKlines({ symbol: 'BTC-MEXC', timeframe: '15m', limit: 100 });
    expect(mockedProbe).toHaveBeenCalledWith({ symbol: 'BTC', interval: '15m', limit: 100, endTime: undefined });
  });

  it('um símbolo sem sufixo passa intocado', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectMexcFuturesKlines({ symbol: 'ETH', timeframe: '1h', limit: 60 });
    expect(mockedProbe).toHaveBeenCalledWith({ symbol: 'ETH', interval: '1h', limit: 60, endTime: undefined });
  });

  it('endTime real é repassado intocado até probe()', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectMexcFuturesKlines({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100, endTime: 1700000000123 });
    expect(mockedProbe).toHaveBeenCalledWith({ symbol: 'BTC', interval: '15m', limit: 100, endTime: 1700000000123 });
  });

  it('devolve os candles reais da evidência quando o estado é ACTIVE_READ_ONLY', async () => {
    const candles = fakeCandles();
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles } });
    const result = await collectMexcFuturesKlines({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100 });
    expect(result).toBe(candles);
  });

  it('lança um erro honesto (nunca candles fabricados) quando o estado real não é ACTIVE_READ_ONLY', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.BLOCKED_BY_SCHEMA, evidence: { candles: [] } });
    await expect(
      collectMexcFuturesKlines({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100 }),
    ).rejects.toThrow(/conector_mexc_futures_estado:BLOCKED_BY_SCHEMA/);
  });

  it('returnEvidence:true devolve o Evidence Object completo; o default continua devolvendo só o array', async () => {
    const evidence = { candles: fakeCandles(), fetched_at: '2026-07-27T00:00:00.000Z', source_id: 'mexc-futures-public-adapter' };
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence });
    const withEvidence = await collectMexcFuturesKlines({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100, returnEvidence: true });
    expect(withEvidence).toBe(evidence);
    const withoutEvidence = await collectMexcFuturesKlines({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100 });
    expect(withoutEvidence).toBe(evidence.candles);
  });
});
