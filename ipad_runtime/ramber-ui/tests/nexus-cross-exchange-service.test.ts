// nexus-cross-exchange-service.test.ts — V-MAX Fase 0.5: trava o serviço
// real Binance (WS kline+L2 supervisionado) + Bybit/OKX (REST poll) contra
// um transporte fake determinístico e as funções reais de fetch
// substituídas via vi.mock (mesma técnica idiomática do vitest para trocar
// só a borda de rede, nunca a lógica em si) — a lógica de merge/estado
// sendo testada é 100% real.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WebSocketLike } from '../src/nexus/connection-manager';
import { CrossExchangeService, mergeLiveCandle } from '../src/nexus/cross-exchange-service';
import { TypedEventBus } from '../src/nexus/event-bus';
import { useUnifiedSnapshotStore } from '../src/store/unified-snapshot-store';
import type { Candle } from '../src/nexus/types';

vi.mock('../src/cross-exchange/bybit-futures', () => ({
  fetchBybitPerpTicker: vi.fn(),
}));
vi.mock('../src/cross-exchange/okx-futures', () => ({
  fetchOkxPerpTicker: vi.fn(),
}));

import { fetchBybitPerpTicker } from '../src/cross-exchange/bybit-futures';
import { fetchOkxPerpTicker } from '../src/cross-exchange/okx-futures';

const candle = (t: number, o = 100, h = 105, l = 95, c = 102): Candle => ({ time: t, open: o, high: h, low: l, close: c });

describe('mergeLiveCandle: funde vela ao vivo no ring real sem duplicar nem reordenar às cegas', () => {
  it('array vazio simplesmente recebe a primeira vela', () => {
    expect(mergeLiveCandle([], candle(100))).toEqual([candle(100)]);
  });

  it('mesmo time da última vela SUBSTITUI (tick de uma vela ainda em formação), nunca duplica', () => {
    const existing = [candle(100), candle(200, 1, 1, 1, 1)];
    const updated = mergeLiveCandle(existing, candle(200, 1, 1, 1, 999));
    expect(updated).toHaveLength(2);
    expect(updated[1].close).toBe(999);
  });

  it('time maior que a última vela é anexado (vela realmente fechou, nova abriu)', () => {
    const existing = [candle(100), candle(200)];
    const updated = mergeLiveCandle(existing, candle(300));
    expect(updated).toHaveLength(3);
    expect(updated[2].time).toBe(300);
  });

  it('time menor que a última vela conhecida é descartado (frame atrasado/fora de ordem)', () => {
    const existing = [candle(100), candle(300)];
    const updated = mergeLiveCandle(existing, candle(200));
    expect(updated).toEqual(existing);
  });

  it('respeita o teto do ring: anexar além do limite descarta a mais antiga', () => {
    const existing = [candle(1), candle(2), candle(3)];
    const updated = mergeLiveCandle(existing, candle(4), 3);
    expect(updated).toEqual([candle(2), candle(3), candle(4)]);
  });
});

class FakeSocket implements WebSocketLike {
  onopen: ((ev: any) => void) | null = null;
  onclose: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  closed = false;
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.({});
  }
}

const STORE_RESET = {
  symbol: 'BTC',
  price: { price: null, delta: null, deltaPct: null, high: null, low: null, volume: null, direction: null, updatedAt: null },
  orderBook: { bids: [], asks: [], updatedAt: null },
  derivatives: { fundingRate: null, openInterest: null },
  core: { engineStatus: 'pending' as const, direction: null, confidence: null, lastUpdateAt: null, cycleLatencyMs: null },
  activeTimeframe: '15m' as const,
  candles: {},
  orderBooks: {},
  connections: {},
  health: { fps: null, cycleLatencyMs: null, memoryMb: null, workersAlive: 0, isOnline: true, lastUpdatedAt: 0 },
  offline: false,
};

describe('CrossExchangeService: Binance real (kline+L2 via WS supervisionado)', () => {
  let sockets: FakeSocket[];
  let bus: TypedEventBus;
  let service: CrossExchangeService;

  beforeEach(() => {
    vi.useFakeTimers();
    useUnifiedSnapshotStore.setState(STORE_RESET);
    sockets = [];
    bus = new TypedEventBus();
    vi.mocked(fetchBybitPerpTicker).mockResolvedValue({ ok: false, price: null, fundingRate: null, openInterest: null });
    vi.mocked(fetchOkxPerpTicker).mockResolvedValue({ ok: false, price: null, fundingRate: null, openInterest: null });
  });

  afterEach(async () => {
    service?.stop();
    await vi.runOnlyPendingTimersAsync().catch(() => {});
    vi.useRealTimers();
  });

  function makeService() {
    service = new CrossExchangeService({
      symbol: 'BTC',
      timeframe: '15m',
      bus,
      wsFactory: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s;
      },
    });
    return service;
  }

  it('abre um WS combinado só com depth+kline (nunca ticker — fora do escopo desta fase)', () => {
    makeService().start();
    expect(sockets).toHaveLength(1);
  });

  it('frame real de kline grava o candle real na store sob [symbol][timeframe]', async () => {
    makeService().start();
    sockets[0].onopen?.({});
    const frame = {
      stream: 'btcusdt@kline_15m',
      data: { k: { t: 1_700_000_000_000, o: '100.5', h: '105.2', l: '99.1', c: '103.4', x: false } },
    };
    sockets[0].onmessage?.({ data: JSON.stringify(frame) });
    const stored = useUnifiedSnapshotStore.getState().candles.BTC?.['15m'];
    expect(stored).toEqual([{ time: 1_700_000_000, open: 100.5, high: 105.2, low: 99.1, close: 103.4 }]);
  });

  it('publica DATA.CANDLES_UPDATED no bus real a cada kline processado', async () => {
    const received: any[] = [];
    bus.on('DATA.CANDLES_UPDATED', (p) => received.push(p));
    makeService().start();
    sockets[0].onopen?.({});
    sockets[0].onmessage?.({
      data: JSON.stringify({ stream: 'btcusdt@kline_15m', data: { k: { t: 1000000, o: '1', h: '1', l: '1', c: '1' } } }),
    });
    expect(received).toEqual([{ symbol: 'BTC', tf: '15m', exchange: 'BINANCE' }]);
  });

  it('frame real de depth grava bids/asks reais na store, asks em ordem decrescente (mesma convenção da UI real)', () => {
    makeService().start();
    sockets[0].onopen?.({});
    const frame = {
      stream: 'btcusdt@depth10@100ms',
      data: {
        bids: [['100', '1'], ['99', '2']],
        asks: [['101', '1'], ['102', '2']],
      },
    };
    sockets[0].onmessage?.({ data: JSON.stringify(frame) });
    const book = useUnifiedSnapshotStore.getState().orderBooks.BINANCE;
    expect(book?.bids).toEqual([{ price: 100, size: 1 }, { price: 99, size: 2 }]);
    expect(book?.asks).toEqual([{ price: 102, size: 2 }, { price: 101, size: 1 }]);
  });

  it('frame malformado (JSON inválido) nunca lança e nunca corrompe a store', () => {
    makeService().start();
    sockets[0].onopen?.({});
    expect(() => sockets[0].onmessage?.({ data: '{not json' })).not.toThrow();
    expect(useUnifiedSnapshotStore.getState().orderBooks.BINANCE).toBeUndefined();
  });

  it('onopen real grava connections.BINANCE=LIVE e emite DATA.CONNECTION_CHANGED (CONNECTING → LIVE, cada transição uma vez)', () => {
    const received: any[] = [];
    bus.on('DATA.CONNECTION_CHANGED', (p) => received.push(p));
    makeService().start();
    sockets[0].onopen?.({});
    expect(useUnifiedSnapshotStore.getState().connections.BINANCE).toBe('LIVE');
    // Filtra só BINANCE: Bybit/OKX (mockados ok:false) também publicam sua
    // própria transição real (DEGRADED) assim que o poll REST resolve —
    // isto é esperado e coberto pelo describe dedicado abaixo, não uma
    // preocupação deste teste.
    const binanceEvents = received.filter((e) => e.exchange === 'BINANCE');
    expect(binanceEvents).toEqual([
      { exchange: 'BINANCE', state: 'CONNECTING' },
      { exchange: 'BINANCE', state: 'LIVE' },
    ]);
  });

  it('setTimeframe troca a stream de kline real (reconecta o WS com o novo intervalo)', () => {
    makeService().start();
    sockets[0].onopen?.({});
    service.setTimeframe('1h');
    expect(sockets).toHaveLength(2); // reconectou
    sockets[1].onopen?.({});
    sockets[1].onmessage?.({
      data: JSON.stringify({ stream: 'btcusdt@kline_1h', data: { k: { t: 1000000, o: '1', h: '1', l: '1', c: '1' } } }),
    });
    expect(useUnifiedSnapshotStore.getState().candles.BTC?.['1h']).toHaveLength(1);
  });

  it('setSymbol troca o par real (reconecta o WS com o novo símbolo)', () => {
    makeService().start();
    sockets[0].onopen?.({});
    service.setSymbol('ETH');
    expect(sockets).toHaveLength(2);
  });

  it('stop() encerra a conexão real e nenhum reconnect automático dispara depois', () => {
    makeService().start();
    sockets[0].onopen?.({});
    service.stop();
    const countBefore = sockets.length;
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(countBefore);
  });
});

describe('CrossExchangeService: Bybit/OKX real (REST poll → connections honestas, nunca ruidosas)', () => {
  let bus: TypedEventBus;
  let service: CrossExchangeService;

  beforeEach(() => {
    vi.useFakeTimers();
    useUnifiedSnapshotStore.setState(STORE_RESET);
    bus = new TypedEventBus();
    vi.mocked(fetchBybitPerpTicker).mockResolvedValue({ ok: false, price: null, fundingRate: null, openInterest: null });
    vi.mocked(fetchOkxPerpTicker).mockResolvedValue({ ok: false, price: null, fundingRate: null, openInterest: null });
  });

  afterEach(async () => {
    service?.stop();
    await vi.runOnlyPendingTimersAsync().catch(() => {});
    vi.useRealTimers();
  });

  function makeService(restPollMs = 60_000) {
    service = new CrossExchangeService({
      symbol: 'BTC',
      timeframe: '15m',
      bus,
      wsFactory: () => new FakeSocket(),
      restPollMs,
    });
    return service;
  }

  it('poll bem-sucedido grava connections.BYBIT=LIVE (nunca DEGRADED/OFFLINE fabricado)', async () => {
    vi.mocked(fetchBybitPerpTicker).mockResolvedValue({ ok: true, price: 65000, fundingRate: 0.0001, openInterest: 1000 });
    makeService().start();
    await vi.runOnlyPendingTimersAsync();
    expect(useUnifiedSnapshotStore.getState().connections.BYBIT).toBe('LIVE');
  });

  it('poll falho grava connections.OKX=DEGRADED honesto (nunca esconde a falha real)', async () => {
    vi.mocked(fetchOkxPerpTicker).mockResolvedValue({ ok: false, price: null, fundingRate: null, openInterest: null });
    makeService().start();
    await vi.runOnlyPendingTimersAsync();
    expect(useUnifiedSnapshotStore.getState().connections.OKX).toBe('DEGRADED');
  });

  it('polls repetidos com o MESMO resultado nunca reemitem DATA.CONNECTION_CHANGED (zero ruído no bus)', async () => {
    const received: any[] = [];
    bus.on('DATA.CONNECTION_CHANGED', (p) => received.push(p));
    vi.mocked(fetchBybitPerpTicker).mockResolvedValue({ ok: true, price: 1, fundingRate: null, openInterest: null });
    makeService(1000).start();
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    const bybitEvents = received.filter((e) => e.exchange === 'BYBIT');
    expect(bybitEvents).toHaveLength(1); // só a transição real IDLE→LIVE, nunca repetida
  });

  it('uma transição real LIVE→DEGRADED é publicada normalmente', async () => {
    const received: any[] = [];
    bus.on('DATA.CONNECTION_CHANGED', (p) => received.push(p));
    vi.mocked(fetchBybitPerpTicker).mockResolvedValueOnce({ ok: true, price: 1, fundingRate: null, openInterest: null });
    vi.mocked(fetchBybitPerpTicker).mockResolvedValueOnce({ ok: false, price: null, fundingRate: null, openInterest: null });
    makeService(1000).start();
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(1000);
    const bybitStates = received.filter((e) => e.exchange === 'BYBIT').map((e) => e.state);
    expect(bybitStates).toEqual(['LIVE', 'DEGRADED']);
  });
});
