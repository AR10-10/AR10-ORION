// nexus-health-monitor.test.ts — V-MAX Fase 0.8: trava o Health Monitor
// real. requestAnimationFrame/performance.memory não existem no ambiente
// de teste (vitest environment: 'node', sem browser real) — stubados aqui
// de forma controlável para testar a LÓGICA de amostragem/limiar, nunca
// para fabricar um FPS/memória de produto (o componente real só entra em
// produção via App.tsx, num browser real).
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
};

describe('HealthMonitor: cada campo é medido de verdade ou fica null/0 honesto — nunca um valor de exemplo', () => {
  let rafCallbacks: Array<(t: number) => void>;
  let rafClock: number;
  let monitor: HealthMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    useUnifiedSnapshotStore.setState(STORE_RESET);
    __resetHealthMonitorSingletonForTests();
    rafCallbacks = [];
    rafClock = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.mocked(getQuantWorkerState).mockReturnValue('idle');
  });

  afterEach(() => {
    monitor?.stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function fireFrame(deltaMs: number) {
    rafClock += deltaMs;
    const due = rafCallbacks.splice(0, rafCallbacks.length);
    due.forEach((cb) => cb(rafClock));
  }

  it('fps começa null (amostra curta demais) — nunca um chute antes de frames reais suficientes', () => {
    const bus = new TypedEventBus();
    monitor = new HealthMonitor(bus);
    monitor.start();
    expect(useUnifiedSnapshotStore.getState().health.fps).toBeNull();
  });

  it('fps real emerge da média de deltas reais entre frames (~60fps de frames de 16.67ms)', () => {
    const bus = new TypedEventBus();
    monitor = new HealthMonitor(bus);
    monitor.start();
    for (let i = 0; i < 10; i++) fireFrame(16.67);
    vi.advanceTimersByTime(2_000);
    const fps = useUnifiedSnapshotStore.getState().health.fps;
    expect(fps).not.toBeNull();
    expect(fps).toBeGreaterThanOrEqual(58);
    expect(fps).toBeLessThanOrEqual(62);
  });

  it('frames mais lentos (30fps real) produzem um fps real proporcionalmente menor, nunca fixo em 60', () => {
    const bus = new TypedEventBus();
    monitor = new HealthMonitor(bus);
    monitor.start();
    for (let i = 0; i < 10; i++) fireFrame(33.33);
    vi.advanceTimersByTime(2_000);
    const fps = useUnifiedSnapshotStore.getState().health.fps;
    expect(fps).toBeGreaterThanOrEqual(28);
    expect(fps).toBeLessThanOrEqual(32);
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

  it('stop() encerra o loop de rAF e o intervalo — nenhum snapshot novo depois', () => {
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
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.mocked(getQuantWorkerState).mockReturnValue('idle');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
