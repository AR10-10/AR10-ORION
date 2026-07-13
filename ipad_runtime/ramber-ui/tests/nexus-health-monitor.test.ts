// nexus-health-monitor.test.ts — V-MAX Fase 0.8 (revisado na Fase 1.2):
// trava o Health Monitor real. performance.memory não existe no ambiente
// de teste (vitest environment: 'node', sem browser real) — stubado aqui
// de forma controlável para testar a LÓGICA de leitura/limiar, nunca para
// fabricar memória de produto.
//
// fps NÃO tem mais amostragem própria aqui (achado real da Fase 1.2:
// App.tsx já mede FPS via requestAnimationFrame desde antes da Fase 0 —
// "FPS (UI REAL)" — o Health Monitor tinha uma segunda amostragem
// paralela, uma duplicação real removida). Agora fps só espelha
// store.uiFps, mesmo padrão de cycleLatencyMs/isOnline — testado como tal.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TypedEventBus } from '../src/nexus/event-bus';
import { useUnifiedSnapshotStore } from '../src/store/unified-snapshot-store';

vi.mock('../src/engine-bridge', () => ({
  getQuantWorkerState: vi.fn(() => 'idle'),
}));
import { getQuantWorkerState } from '../src/engine-bridge';
import { HealthMonitor, getHealthMonitor, __resetHealthMonitorSingletonForTests } from '../src/nexus/health-monitor';

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
  trackRecord: { contractVersion: 2 as const, active: null, history: [], targetHits: 0, partialHits: 0, stopHits: 0, replaced: 0 },
  trustScore: null,
};

describe('HealthMonitor: cada campo é medido de verdade ou fica null/0 honesto — nunca um valor de exemplo', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    useUnifiedSnapshotStore.setState(STORE_RESET);
    __resetHealthMonitorSingletonForTests();
    vi.mocked(getQuantWorkerState).mockReturnValue('idle');
  });

  afterEach(() => {
    monitor?.stop();
    vi.useRealTimers();
  });

  it('fps espelha store.uiFps real (mesma medição de App.tsx, "FPS REAL da UI") — nunca uma segunda amostragem própria', () => {
    useUnifiedSnapshotStore.getState().setUiFps(58);
    const bus = new TypedEventBus();
    monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().health.fps).toBe(58);
  });

  it('fps fica null honesto quando App.tsx ainda não mediu nenhum frame real', () => {
    const bus = new TypedEventBus();
    monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().health.fps).toBeNull();
  });

  it('memoryMb fica null quando performance.memory não existe (ambiente sem essa API) — nunca estimado', () => {
    const bus = new TypedEventBus();
    monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().health.memoryMb).toBeNull();
  });

  it('memoryMb real quando performance.memory existe (Chrome/Safari real)', () => {
    const originalMemory = (performance as any).memory;
    (performance as any).memory = { usedJSHeapSize: 52_428_800 }; // 50 MiB exatos
    try {
      const bus = new TypedEventBus();
      monitor = new HealthMonitor(bus);
      monitor.start();
      expect(useUnifiedSnapshotStore.getState().health.memoryMb).toBe(50);
    } finally {
      (performance as any).memory = originalMemory;
    }
  });

  it('workersAlive só conta "ready" real (getQuantWorkerState) — pending/error/idle nunca contam como vivo', () => {
    const bus = new TypedEventBus();
    vi.mocked(getQuantWorkerState).mockReturnValue('pending');
    monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().health.workersAlive).toBe(0);

    monitor.stop();
    vi.mocked(getQuantWorkerState).mockReturnValue('ready');
    monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().health.workersAlive).toBe(1);
  });

  it('cycleLatencyMs espelha core.cycleLatencyMs real da store — nunca uma segunda medição', () => {
    useUnifiedSnapshotStore.getState().setCore({
      engineStatus: 'ok', direction: 'LONG', confidence: 'ALTA', lastUpdateAt: Date.now(), cycleLatencyMs: 842,
    });
    const bus = new TypedEventBus();
    monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().health.cycleLatencyMs).toBe(842);
  });

  it('isOnline espelha !offline real da store (Fase 0.4, navigator.onLine)', () => {
    useUnifiedSnapshotStore.getState().setOffline(true);
    const bus = new TypedEventBus();
    monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().health.isOnline).toBe(false);
  });

  it('publica HEALTH.CHANGED no bus real a cada snapshot', () => {
    const bus = new TypedEventBus();
    const received: any[] = [];
    bus.on('HEALTH.CHANGED', (p) => received.push(p));
    monitor = new HealthMonitor(bus);
    monitor.start();
    expect(received).toHaveLength(1); // leitura imediata no start()
    vi.advanceTimersByTime(2_000);
    expect(received.length).toBeGreaterThanOrEqual(2);
  });

  it('stop() encerra o intervalo — nenhum snapshot novo depois', () => {
    const bus = new TypedEventBus();
    monitor = new HealthMonitor(bus);
    monitor.start();
    monitor.stop();
    const before = useUnifiedSnapshotStore.getState().health.lastUpdatedAt;
    vi.advanceTimersByTime(10_000);
    expect(useUnifiedSnapshotStore.getState().health.lastUpdatedAt).toBe(before);
  });

  it('start() chamado duas vezes seguidas não duplica o loop (idempotente)', () => {
    const bus = new TypedEventBus();
    const received: any[] = [];
    bus.on('HEALTH.CHANGED', (p) => received.push(p));
    monitor = new HealthMonitor(bus);
    monitor.start();
    monitor.start();
    expect(received).toHaveLength(1);
  });
});

describe('HealthMonitor: isDataFresh (Blueprint §7.2) — freshness real a partir de price/orderBook.updatedAt reais', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUnifiedSnapshotStore.setState(STORE_RESET);
    __resetHealthMonitorSingletonForTests();
    vi.mocked(getQuantWorkerState).mockReturnValue('idle');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nunca fresco antes do primeiro dado real (updatedAt ainda null nos dois)', () => {
    const bus = new TypedEventBus();
    const monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().isDataFresh).toBe(false);
    monitor.stop();
  });

  it('fresco logo após um preço real chegar', () => {
    useUnifiedSnapshotStore.getState().setPrice({
      price: 65000, delta: 0, deltaPct: 0, high: 65100, low: 64900, volume: 10, direction: 'LONG',
    });
    const bus = new TypedEventBus();
    const monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().isDataFresh).toBe(true);
    monitor.stop();
  });

  it('deixa de ser fresco depois do limiar real sem nenhuma atualização nova', () => {
    useUnifiedSnapshotStore.getState().setPrice({
      price: 65000, delta: 0, deltaPct: 0, high: 65100, low: 64900, volume: 10, direction: 'LONG',
    });
    const bus = new TypedEventBus();
    const monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().isDataFresh).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(useUnifiedSnapshotStore.getState().isDataFresh).toBe(false);
    monitor.stop();
  });

  it('getHealthMonitor() é singleton — mesma instância entre chamadas', () => {
    const bus = new TypedEventBus();
    const a = getHealthMonitor(bus);
    const b = getHealthMonitor(bus);
    expect(a).toBe(b);
  });
});
