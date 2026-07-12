// unified-snapshot-store.test.ts — V18 Sprint 1, Tarefa A. Testa a store
// Zustand+Immer real diretamente via getState()/setState() (sem precisar
// montar um componente React) — mesmo espírito do resto da suíte: lógica de
// dados, nunca UI.
import { describe, it, expect, beforeEach } from 'vitest';
import { useUnifiedSnapshotStore } from '../src/store/unified-snapshot-store';

const RESET = {
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
  isDataFresh: false,
  uiFps: null,
  l2History: {},
  orderflowHistory: [],
  volumeProfile: null,
  fibonacciConfluence: null,
  council: null,
  affectiveMemory: { contractVersion: 1 as const, reward: 0, pain: 0, lastEventAt: null, eventCount: 0 },
  cpi: null,
  scenario: null,
  trapSignals: [],
  tradePlan: null,
  trackRecord: { contractVersion: 1 as const, active: null, history: [], targetHits: 0, stopHits: 0, replaced: 0 },
  trustScore: null,
};

describe('unified-snapshot-store: boots fail-closed (nada fabricado antes do primeiro dado real)', () => {
  beforeEach(() => {
    useUnifiedSnapshotStore.setState(RESET);
  });

  it('estado inicial é honesto: preço/livro/funding/núcleo todos null/vazio, nunca um valor inventado', () => {
    const s = useUnifiedSnapshotStore.getState();
    expect(s.price.price).toBeNull();
    expect(s.orderBook.bids).toEqual([]);
    expect(s.derivatives.fundingRate).toBeNull();
    expect(s.core.engineStatus).toBe('pending');
    expect(s.core.confidence).toBeNull();
  });
});

describe('unified-snapshot-store: setters escrevem exatamente o dado real recebido, com updatedAt real', () => {
  beforeEach(() => {
    useUnifiedSnapshotStore.setState(RESET);
  });

  it('setPrice grava os campos reais e carimba updatedAt (nunca null após um dado real chegar)', () => {
    const before = Date.now();
    useUnifiedSnapshotStore.getState().setPrice({
      price: 65000, delta: 120, deltaPct: 0.18, high: 65500, low: 64200, volume: 12345, direction: 'LONG',
    });
    const s = useUnifiedSnapshotStore.getState();
    expect(s.price.price).toBe(65000);
    expect(s.price.direction).toBe('LONG');
    expect(s.price.updatedAt).not.toBeNull();
    expect(s.price.updatedAt!).toBeGreaterThanOrEqual(before);
  });

  it('setOrderBook grava bids/asks reais e carimba updatedAt', () => {
    useUnifiedSnapshotStore.getState().setOrderBook({
      bids: [{ price: 64990, size: 1.2 }],
      asks: [{ price: 65010, size: 0.8 }],
    });
    const s = useUnifiedSnapshotStore.getState();
    expect(s.orderBook.bids).toEqual([{ price: 64990, size: 1.2 }]);
    expect(s.orderBook.asks).toEqual([{ price: 65010, size: 0.8 }]);
    expect(s.orderBook.updatedAt).not.toBeNull();
  });

  it('setDerivatives grava exatamente o objeto recebido (sem timestamp — funding/OI já carregam sua própria idade em outro lugar)', () => {
    useUnifiedSnapshotStore.getState().setDerivatives({ fundingRate: 0.0001, openInterest: 98765 });
    expect(useUnifiedSnapshotStore.getState().derivatives).toEqual({ fundingRate: 0.0001, openInterest: 98765 });
  });

  it('setCore grava o estado real do motor (engineStatus/direção/confiança categórica), nunca um score inventado', () => {
    useUnifiedSnapshotStore.getState().setCore({
      engineStatus: 'ok', direction: 'SHORT', confidence: 'ALTA', lastUpdateAt: 1700000000000, cycleLatencyMs: 42,
    });
    const s = useUnifiedSnapshotStore.getState();
    expect(s.core).toEqual({
      engineStatus: 'ok', direction: 'SHORT', confidence: 'ALTA', lastUpdateAt: 1700000000000, cycleLatencyMs: 42,
    });
  });

  it('setSymbol troca o símbolo real sem tocar em nenhuma outra fatia', () => {
    useUnifiedSnapshotStore.getState().setPrice({
      price: 3000, delta: 0, deltaPct: 0, high: 3010, low: 2990, volume: 500, direction: null,
    });
    useUnifiedSnapshotStore.getState().setSymbol('ETH');
    const s = useUnifiedSnapshotStore.getState();
    expect(s.symbol).toBe('ETH');
    expect(s.price.price).toBe(3000); // outra fatia intacta
  });
});

// V-MAX Fase 0.4 — extensão aditiva rumo ao UnifiedGlobalSnapshot do
// Blueprint (§2.3): candles ring por símbolo/timeframe, livros por exchange,
// estado de conexão por exchange, health e offline.
describe('unified-snapshot-store (V-MAX Fase 0.4): candles por símbolo/timeframe nunca colidem nem se acumulam', () => {
  beforeEach(() => {
    useUnifiedSnapshotStore.setState(RESET);
  });

  const candle = (t: number) => ({ time: t, open: 100, high: 105, low: 95, close: 102 });

  it('setCandles grava a série real sob [symbol][timeframe]', () => {
    useUnifiedSnapshotStore.getState().setCandles('BTC', '15m', [candle(1), candle(2)]);
    expect(useUnifiedSnapshotStore.getState().candles.BTC?.['15m']).toEqual([candle(1), candle(2)]);
  });

  it('timeframes distintos do mesmo símbolo nunca colidem (BTC:15m e BTC:1h independentes)', () => {
    useUnifiedSnapshotStore.getState().setCandles('BTC', '15m', [candle(1)]);
    useUnifiedSnapshotStore.getState().setCandles('BTC', '1h', [candle(999)]);
    const s = useUnifiedSnapshotStore.getState();
    expect(s.candles.BTC?.['15m']).toEqual([candle(1)]);
    expect(s.candles.BTC?.['1h']).toEqual([candle(999)]);
  });

  it('símbolos distintos nunca colidem (BTC e ETH independentes)', () => {
    useUnifiedSnapshotStore.getState().setCandles('BTC', '15m', [candle(1)]);
    useUnifiedSnapshotStore.getState().setCandles('ETH', '15m', [candle(2)]);
    const s = useUnifiedSnapshotStore.getState();
    expect(s.candles.BTC?.['15m']).toEqual([candle(1)]);
    expect(s.candles.ETH?.['15m']).toEqual([candle(2)]);
  });

  it('setCandles de novo na mesma chave substitui, nunca acumula duplicado', () => {
    useUnifiedSnapshotStore.getState().setCandles('BTC', '15m', [candle(1)]);
    useUnifiedSnapshotStore.getState().setCandles('BTC', '15m', [candle(1), candle(2), candle(3)]);
    expect(useUnifiedSnapshotStore.getState().candles.BTC?.['15m']).toHaveLength(3);
  });
});

describe('unified-snapshot-store (V-MAX Fase 0.4): livros e conexões são honestos por exchange, nunca fabricados', () => {
  beforeEach(() => {
    useUnifiedSnapshotStore.setState(RESET);
  });

  it('orderBooks começa vazio — nenhuma exchange tem livro fabricado antes do primeiro dado real', () => {
    expect(useUnifiedSnapshotStore.getState().orderBooks).toEqual({});
  });

  it('setExchangeOrderBook(null) representa honestamente "sem L2 real ainda" — nunca um livro vazio fingindo ser real', () => {
    useUnifiedSnapshotStore.getState().setExchangeOrderBook('BYBIT', null);
    expect(useUnifiedSnapshotStore.getState().orderBooks.BYBIT).toBeNull();
  });

  it('setExchangeOrderBook grava o L2 real de uma exchange sem afetar as demais', () => {
    const snap = { bids: [{ price: 100, size: 1 }], asks: [{ price: 101, size: 2 }], updatedAt: 12345 };
    useUnifiedSnapshotStore.getState().setExchangeOrderBook('BINANCE', snap);
    const s = useUnifiedSnapshotStore.getState();
    expect(s.orderBooks.BINANCE).toEqual(snap);
    expect(s.orderBooks.BYBIT).toBeUndefined();
  });

  it('setConnectionState grava o estado real de uma exchange, independente das demais', () => {
    useUnifiedSnapshotStore.getState().setConnectionState('BINANCE', 'LIVE');
    useUnifiedSnapshotStore.getState().setConnectionState('BYBIT', 'DEGRADED');
    const s = useUnifiedSnapshotStore.getState();
    expect(s.connections.BINANCE).toBe('LIVE');
    expect(s.connections.BYBIT).toBe('DEGRADED');
    expect(s.connections.OKX).toBeUndefined();
  });
});

describe('unified-snapshot-store (V-MAX Fase 0.4): health/offline honestos, nunca fabricados antes do Health Monitor real', () => {
  beforeEach(() => {
    useUnifiedSnapshotStore.setState(RESET);
  });

  it('health inicial nunca finge ter medido FPS/latência/memória — tudo null até a Fase 0.8', () => {
    const h = useUnifiedSnapshotStore.getState().health;
    expect(h.fps).toBeNull();
    expect(h.cycleLatencyMs).toBeNull();
    expect(h.memoryMb).toBeNull();
    expect(h.workersAlive).toBe(0);
  });

  it('setHealth grava exatamente o snapshot real recebido', () => {
    const health = { fps: 60, cycleLatencyMs: 8, memoryMb: 120, workersAlive: 1, isOnline: true, lastUpdatedAt: 1700000000000 };
    useUnifiedSnapshotStore.getState().setHealth(health);
    expect(useUnifiedSnapshotStore.getState().health).toEqual(health);
  });

  it('setOffline grava a transição real de conectividade', () => {
    useUnifiedSnapshotStore.getState().setOffline(true);
    expect(useUnifiedSnapshotStore.getState().offline).toBe(true);
    useUnifiedSnapshotStore.getState().setOffline(false);
    expect(useUnifiedSnapshotStore.getState().offline).toBe(false);
  });

  it('setActiveTimeframe grava o timeframe ativo real sem tocar em candles já carregados', () => {
    useUnifiedSnapshotStore.getState().setCandles('BTC', '15m', [{ time: 1, open: 1, high: 1, low: 1, close: 1 }]);
    useUnifiedSnapshotStore.getState().setActiveTimeframe('1h');
    const s = useUnifiedSnapshotStore.getState();
    expect(s.activeTimeframe).toBe('1h');
    expect(s.candles.BTC?.['15m']).toHaveLength(1);
  });

  it('setUiFps espelha o FPS real já medido por App.tsx (Fase J) — nunca uma segunda amostragem própria da store', () => {
    expect(useUnifiedSnapshotStore.getState().uiFps).toBeNull();
    useUnifiedSnapshotStore.getState().setUiFps(58);
    expect(useUnifiedSnapshotStore.getState().uiFps).toBe(58);
  });
});

// V-MAX Fase 1.1 — pré-requisito real do OrderFlowHeatmapPlugin: uma
// série de snapshots L2 por exchange, não só o mais recente.
describe('unified-snapshot-store (V-MAX Fase 1.1): l2History retém amostras reais por exchange, nunca fabrica uma entrada', () => {
  beforeEach(() => {
    useUnifiedSnapshotStore.setState(RESET);
  });

  const l2 = (t: number) => ({ time: t, bids: [{ price: 100, size: 1 }], asks: [{ price: 101, size: 1 }] });

  it('l2History começa vazio — nenhuma exchange tem histórico fabricado antes do primeiro L2 real', () => {
    expect(useUnifiedSnapshotStore.getState().l2History).toEqual({});
  });

  it('sampleL2History grava a primeira amostra real sob a exchange certa', () => {
    useUnifiedSnapshotStore.getState().sampleL2History('BINANCE', l2(1000));
    expect(useUnifiedSnapshotStore.getState().l2History.BINANCE).toEqual([l2(1000)]);
  });

  it('duas exchanges nunca colidem — histórico independente por exchange', () => {
    useUnifiedSnapshotStore.getState().sampleL2History('BINANCE', l2(1000));
    useUnifiedSnapshotStore.getState().sampleL2History('BYBIT', l2(999));
    const s = useUnifiedSnapshotStore.getState();
    expect(s.l2History.BINANCE).toEqual([l2(1000)]);
    expect(s.l2History.BYBIT).toEqual([l2(999)]);
  });

  it('uma segunda amostra real chegando cedo demais é descartada (mesma cadência da função pura maybeSampleL2History)', () => {
    useUnifiedSnapshotStore.getState().sampleL2History('BINANCE', l2(1000));
    useUnifiedSnapshotStore.getState().sampleL2History('BINANCE', l2(1500)); // 500ms depois, cedo demais
    expect(useUnifiedSnapshotStore.getState().l2History.BINANCE).toHaveLength(1);
  });

  it('exchange nunca amostrada fica honestamente ausente do mapa (undefined), nunca um array vazio fabricado no estado real', () => {
    useUnifiedSnapshotStore.getState().sampleL2History('BINANCE', l2(1000));
    expect(useUnifiedSnapshotStore.getState().l2History.BYBIT).toBeUndefined();
  });

  it('respeita o teto real de capacidade (L2_HISTORY_CAPACITY) — nunca acumula sem limite', () => {
    const store = useUnifiedSnapshotStore.getState();
    for (let i = 0; i < 190; i++) {
      store.sampleL2History('BINANCE', l2(i * 2000));
    }
    expect(useUnifiedSnapshotStore.getState().l2History.BINANCE).toHaveLength(180);
  });
});
