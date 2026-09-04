// market-data-adapter.test.ts — ADITIVO V-MAX Etapa 1 (Market Data
// Adapter, PRIORIDADE ABSOLUTA): "Não substituir Binance por MEXC. Não
// criar um pipeline paralelo para MEXC. Criar uma camada única de
// abstração" (texto literal da diretiva). Trava o contrato real: default
// explícito BINANCE (zero mudança de fonte para nenhum consumidor
// existente), MEXC disponível só quando pedido explicitamente, e cada
// provider chama exatamente o conector real que já existia — mocka só a
// fronteira (market-data-bus/index.js), nunca reimplementa a lógica de
// collect em si (já coberta por binance/mexc-futures-candle-connector.test.ts).
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/market-data-bus/index.js', () => ({
  collectBinanceFuturesKlines: vi.fn(),
  collectMexcFuturesKlines: vi.fn(),
  collectTradfiDelayedKlines: vi.fn(),
}));

import { collectBinanceFuturesKlines, collectMexcFuturesKlines, collectTradfiDelayedKlines } from '../../src/market-data-bus/index.js';
import {
  getMarketDataProvider,
  DEFAULT_MARKET_DATA_PROVIDER,
  MARKET_DATA_PROVIDER_IDS,
} from '../src/market-data-adapter';

const mockedBinance = collectBinanceFuturesKlines as unknown as ReturnType<typeof vi.fn>;
const mockedMexc = collectMexcFuturesKlines as unknown as ReturnType<typeof vi.fn>;
const mockedTradfi = collectTradfiDelayedKlines as unknown as ReturnType<typeof vi.fn>;

function fakeCandles() {
  return [{ t: 1700000000, o: 100, h: 105, l: 95, c: 102, v: 10 }];
}

describe('MarketDataAdapter: provider é parâmetro explícito, nunca um toggle global', () => {
  afterEach(() => {
    mockedBinance.mockReset();
    mockedMexc.mockReset();
    mockedTradfi.mockReset();
  });

  it('DEFAULT_MARKET_DATA_PROVIDER é BINANCE — fonte primária, trava permanente do CLAUDE.md', () => {
    expect(DEFAULT_MARKET_DATA_PROVIDER).toBe('BINANCE');
  });

  it('getMarketDataProvider() sem argumento resolve para BINANCE (default explícito, nunca implícito)', () => {
    expect(getMarketDataProvider().id).toBe('BINANCE');
  });

  it('getMarketDataProvider("BINANCE").collect chama exatamente collectBinanceFuturesKlines — o mesmo conector real de sempre', async () => {
    mockedBinance.mockResolvedValue(fakeCandles());
    const result = await getMarketDataProvider('BINANCE').collect({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100 });
    expect(mockedBinance).toHaveBeenCalledWith({ symbol: 'BTC-PERP', timeframe: '15m', limit: 100 });
    expect(mockedMexc).not.toHaveBeenCalled();
    expect(result).toEqual(fakeCandles());
  });

  it('getMarketDataProvider("MEXC").collect chama exatamente collectMexcFuturesKlines — nunca reusa/mistura com o caminho Binance', async () => {
    mockedMexc.mockResolvedValue(fakeCandles());
    const result = await getMarketDataProvider('MEXC').collect({ symbol: 'BTC-MEXC', timeframe: '15m', limit: 100 });
    expect(mockedMexc).toHaveBeenCalledWith({ symbol: 'BTC-MEXC', timeframe: '15m', limit: 100 });
    expect(mockedBinance).not.toHaveBeenCalled();
    expect(result).toEqual(fakeCandles());
  });

  it('getMarketDataProvider("TRADFI_DELAYED").collect chama exatamente collectTradfiDelayedKlines (Ordem Market Data Fabric, Fase 1) — nunca reusa/mistura com Binance/MEXC', async () => {
    mockedTradfi.mockResolvedValue(fakeCandles());
    const result = await getMarketDataProvider('TRADFI_DELAYED').collect({ symbol: 'CME_ES', timeframe: '1h', limit: 200 });
    expect(mockedTradfi).toHaveBeenCalledWith({ symbol: 'CME_ES', timeframe: '1h', limit: 200 });
    expect(mockedBinance).not.toHaveBeenCalled();
    expect(mockedMexc).not.toHaveBeenCalled();
    expect(result).toEqual(fakeCandles());
  });

  it('MARKET_DATA_PROVIDER_IDS lista exatamente os 3 providers reais desta entrega — Bybit/OKX/Hyperliquid ficam para quando forem pedidos', () => {
    expect(MARKET_DATA_PROVIDER_IDS).toEqual(['BINANCE', 'MEXC', 'TRADFI_DELAYED']);
  });

  it('adicionar TRADFI_DELAYED não muda o default nem o comportamento de nenhum consumidor cripto existente', () => {
    expect(DEFAULT_MARKET_DATA_PROVIDER).toBe('BINANCE');
    expect(getMarketDataProvider().id).toBe('BINANCE');
  });

  it('cada provider carrega um label real e distinto — nunca dois rótulos idênticos que confundiriam diagnóstico/UI', () => {
    const labels = MARKET_DATA_PROVIDER_IDS.map((id) => getMarketDataProvider(id).label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
  });
});
