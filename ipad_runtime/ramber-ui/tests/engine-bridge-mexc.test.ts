// engine-bridge-mexc.test.ts — getMexcChartCandles (Ordem "MEXC ASSET
// DISCOVERY" + "UNIVERSAL ASSET DISCOVERY"): mesma forma/contrato de
// getChartCandles/getTradFiChartCandles (candle canônico {time,open,high,
// low,close,volume} | null honesto), fonte MEXC em vez de Binance/TradFi.
// Mocka só a fronteira real de rede (market-data-bus/index.js) — mesma
// convenção do resto da suíte (engine-bridge-tradfi.test.ts), nunca
// reimplementa a lógica do Bus/conector em si.
import { describe, it, expect, vi, afterEach } from 'vitest';

const requestSnapshotMock = vi.fn();

vi.mock('../../src/market-data-bus/index.js', () => ({
  getMarketDataBus: () => ({ requestSnapshot: requestSnapshotMock }),
  collectBinanceFuturesKlines: vi.fn(),
  collectMexcFuturesKlines: vi.fn(),
  collectTradfiDelayedKlines: vi.fn(),
}));

import { getMexcChartCandles } from '../src/engine-bridge';

function fakeSnapshot(candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>) {
  return { ok: true, candles, symbol: 'BTC-MEXC', timeframe: '15m', asOf: 1_700_000_000, fetchedAt: Date.now(), ageMs: 0, quality: 'EXCELENTE' };
}

describe('getMexcChartCandles: mesmo contrato de getChartCandles, fonte MEXC', () => {
  afterEach(() => {
    requestSnapshotMock.mockReset();
  });

  it('pede ao Bus o baseAsset com sufixo -MEXC (mesma convenção já real de requestRadarCandleSnapshot) com o provider MEXC', async () => {
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([{ t: 1_700_000_000, o: 100, h: 105, l: 95, c: 102, v: 10 }]));
    await getMexcChartCandles('BTC', 200, '15m');
    expect(requestSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'BTC-MEXC', timeframe: '15m', limit: 200, maxAgeMs: 25_000, collect: expect.any(Function) }),
    );
  });

  it('mapeia candles reais do Bus {t,o,h,l,c,v} -> {time,open,high,low,close,volume}, mesma forma exata de getChartCandles', async () => {
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([
      { t: 1_700_000_000, o: 100, h: 105, l: 95, c: 102, v: 10 },
      { t: 1_700_000_900, o: 102, h: 110, l: 100, c: 108, v: 12 },
    ]));
    const result = await getMexcChartCandles('BTC', 200, '15m');
    expect(result).toEqual([
      { time: 1_700_000_000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
      { time: 1_700_000_900, open: 102, high: 110, low: 100, close: 108, volume: 12 },
    ]);
  });

  it('snapshot.ok:false => null honesto, nunca um array vazio fingindo sucesso (mesmo fail-closed dos outros providers)', async () => {
    requestSnapshotMock.mockResolvedValue({ ok: false, candles: [], symbol: 'BTC-MEXC', timeframe: '15m', asOf: null, fetchedAt: Date.now(), ageMs: null, quality: 'DADOS_INSUFICIENTES' });
    const result = await getMexcChartCandles('BTC', 200, '15m');
    expect(result).toBeNull();
  });

  it('defaults reais: limit=200, timeframe=15m', async () => {
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([]));
    await getMexcChartCandles('XYZ');
    expect(requestSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'XYZ-MEXC', timeframe: '15m', limit: 200 }));
  });

  it('nunca chama o provider BINANCE — fonte MEXC isolada, mesma disciplina de market-data-adapter.test.ts', async () => {
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([]));
    await getMexcChartCandles('BTC', 200, '15m');
    const call = requestSnapshotMock.mock.calls[0][0];
    // O `collect` passado precisa ser o do provider MEXC — verificado indiretamente
    // via market-data-adapter.test.ts; aqui confirmamos que o símbolo carrega o
    // sufixo -MEXC (nunca -PERP, que identificaria o caminho Binance).
    expect(call.symbol).not.toMatch(/-PERP$/);
    expect(call.symbol).toMatch(/-MEXC$/);
  });
});
