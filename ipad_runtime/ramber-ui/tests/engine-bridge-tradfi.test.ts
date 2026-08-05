// engine-bridge-tradfi.test.ts — getTradFiChartCandles (Ordem Market Data
// Fabric, Fase 1): mesma forma/contrato de getChartCandles (candle
// canônico {time,open,high,low,close,volume} | null honesto), fonte
// TRADFI_DELAYED em vez de Binance. Mocka só a fronteira real de rede
// (market-data-bus/index.js) — mesma convenção do resto da suíte
// (binance/mexc-futures-candle-connector.test.ts) — nunca reimplementa a
// lógica do Bus em si.
import { describe, it, expect, vi, afterEach } from 'vitest';

const requestSnapshotMock = vi.fn();

vi.mock('../../src/market-data-bus/index.js', () => ({
  getMarketDataBus: () => ({ requestSnapshot: requestSnapshotMock }),
  collectBinanceFuturesKlines: vi.fn(),
  collectMexcFuturesKlines: vi.fn(),
  collectTradfiDelayedKlines: vi.fn(),
}));

import { getTradFiChartCandles } from '../src/engine-bridge';

function fakeSnapshot(candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>) {
  return { ok: true, candles, symbol: 'CME_ES', timeframe: '1h', asOf: 1_700_000_000, fetchedAt: Date.now(), ageMs: 0, quality: 'EXCELENTE' };
}

describe('getTradFiChartCandles: mesmo contrato de getChartCandles, fonte TRADFI_DELAYED', () => {
  afterEach(() => {
    requestSnapshotMock.mockReset();
  });

  it('pede ao Bus exatamente o instrumentId como symbol (sem sufixo -PERP/-MEXC, ao contrário dos conectores cripto) com o provider TRADFI_DELAYED', async () => {
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([{ t: 1_700_000_000, o: 4500, h: 4505, l: 4495, c: 4502, v: 1000 }]));
    await getTradFiChartCandles('CME_ES', 200, '1h');
    expect(requestSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'CME_ES', timeframe: '1h', limit: 200, maxAgeMs: 25_000, collect: expect.any(Function) }),
    );
  });

  it('mapeia candles reais do Bus {t,o,h,l,c,v} -> {time,open,high,low,close,volume}, mesma forma exata de getChartCandles', async () => {
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([
      { t: 1_700_000_000, o: 4500, h: 4505, l: 4495, c: 4502, v: 1000 },
      { t: 1_700_003_600, o: 4502, h: 4510, l: 4500, c: 4508, v: 1200 },
    ]));
    const result = await getTradFiChartCandles('CME_ES', 200, '1h');
    expect(result).toEqual([
      { time: 1_700_000_000, open: 4500, high: 4505, low: 4495, close: 4502, volume: 1000 },
      { time: 1_700_003_600, open: 4502, high: 4510, low: 4500, close: 4508, volume: 1200 },
    ]);
  });

  it('snapshot.ok:false => null honesto, nunca um array vazio fingindo sucesso (mesmo fail-closed de getChartCandles)', async () => {
    requestSnapshotMock.mockResolvedValue({ ok: false, candles: [], symbol: 'CME_ES', timeframe: '1h', asOf: null, fetchedAt: Date.now(), ageMs: null, quality: 'DADOS_INSUFICIENTES' });
    const result = await getTradFiChartCandles('CME_ES', 200, '1h');
    expect(result).toBeNull();
  });

  it('defaults reais: limit=200, timeframe=1h (diferente do default cripto 50/15m — janela mais ampla para um candle delayed/menos frequente)', async () => {
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([]));
    await getTradFiChartCandles('CME_NQ');
    expect(requestSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'CME_NQ', timeframe: '1h', limit: 200 }));
  });
});
