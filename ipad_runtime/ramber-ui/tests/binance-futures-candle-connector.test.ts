// binance-futures-candle-connector.test.ts — trava permanente do bug real
// encontrado via captura de tela do Operador em dispositivo real: o
// sufixo -PERP (só a chave de CACHE do Bus, nunca um símbolo de exchange
// de verdade) vazava para o parâmetro `symbol` enviado à API real da
// Binance Futures, produzindo um par inválido ("BTC-PERPUSDT") — toda
// chamada real de futuros falhava, sempre, em qualquer rede real,
// mascarada pelo fallback automático para Spot (Estabilização desta
// sessão), que fazia a UI mostrar o badge "SPOT" em vez de "Futures/Perp"
// sem nunca satisfazer de fato a Diretriz 2. Este teste mocka só a
// fronteira de rede (probe.js) — a mesma convenção do resto da suíte.
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../js/real-data/binance-futures-public.js', () => ({
  probe: vi.fn(),
}));

import { probe } from '../../js/real-data/binance-futures-public.js';
import { collectBinanceFuturesKlines } from '../../src/market-data-bus/binance-futures-candle-connector.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';

const mockedProbe = probe as unknown as ReturnType<typeof vi.fn>;

function fakeCandles() {
  return [{ t: 1, o: 100, h: 105, l: 95, c: 102, v: 10 }];
}

describe('binance-futures-candle-connector: o sufixo -PERP (chave de cache do Bus) nunca vaza para a API real', () => {
  afterEach(() => {
    mockedProbe.mockReset();
  });

  it('symbol="BTC-PERP" (exatamente como o Bus de fato envia) chega a probe() como "BTC" puro', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectBinanceFuturesKlines({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100 });
    expect(mockedProbe).toHaveBeenCalledWith({ symbol: 'BTC', interval: '15m', limit: 100 });
  });

  it('ETH-PERP/SOL-PERP também têm o sufixo removido — não é um caso especial só de BTC', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectBinanceFuturesKlines({ symbol: 'ETH-PERP', timeframe: '1h', limit: 60 });
    expect(mockedProbe).toHaveBeenCalledWith({ symbol: 'ETH', interval: '1h', limit: 60 });
  });

  it('um símbolo sem o sufixo -PERP passa intocado (nunca corta caracteres de mais)', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectBinanceFuturesKlines({ symbol: 'ETH', timeframe: '1h', limit: 60 });
    expect(mockedProbe).toHaveBeenCalledWith({ symbol: 'ETH', interval: '1h', limit: 60 });
  });

  it('devolve os candles reais da evidência quando o estado é ACTIVE_READ_ONLY', async () => {
    const candles = fakeCandles();
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles } });
    const result = await collectBinanceFuturesKlines({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100 });
    expect(result).toBe(candles);
  });

  it('lança um erro honesto (nunca candles fabricados) quando o estado real não é ACTIVE_READ_ONLY', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.BLOCKED_BY_CORS, evidence: { candles: [] } });
    await expect(
      collectBinanceFuturesKlines({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100 }),
    ).rejects.toThrow(/conector_binance_futures_estado:BLOCKED_BY_CORS/);
  });
});
