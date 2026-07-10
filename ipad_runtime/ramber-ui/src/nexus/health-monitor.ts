// health-monitor.ts — V-MAX Fase 0.8 (Blueprint §7.2: "Latência por
// exchange, FPS, memória JS, status Workers, freshness, offline.
// Publicado via HEALTH.CHANGED.").
//
// Cada campo é medido de verdade ou fica honestamente null/0 — nunca um
// valor de exemplo:
//   fps            — amostragem real via requestAnimationFrame (janela
//                    deslizante de 60 frames), nunca um número fixo.
//   memoryMb       — performance.memory.usedJSHeapSize quando o browser
//                    expõe (Chrome/Safari); null nos que não expõem
//                    (Firefox) — nunca estimado.
//   workersAlive   — getQuantWorkerState() === 'ready' real
//                    (engine-bridge.ts); 'pending'/'error'/'idle' nunca
//                    contam como vivo.
//   cycleLatencyMs — espelha core.cycleLatencyMs já real da store (mesmo
//                    ciclo do motor que os outros widgets já exibem),
//                    nunca uma segunda medição.
//   isOnline       — espelha o offline real da store (Fase 0.4,
//                    navigator.onLine + listeners reais).
// isDataFresh (fora do HealthSnapshot, mas mesma responsabilidade do
// Health Monitor por definição do Blueprint) é derivado de
// price.updatedAt/orderBook.updatedAt reais — "fresco" = o mais recente
// dos dois chegou há menos de FRESHNESS_THRESHOLD_MS. O limiar (60s) é
// 2x a cadência real mais lenta do sistema hoje (o poll REST de 30s que
// resincroniza o candle do gráfico) — folga deliberada para não marcar
// "stale" por causa de uma única rodada atrasada, nunca um número
// arbitrário.
import { getQuantWorkerState } from "../engine-bridge";
import { useUnifiedSnapshotStore } from "../store/unified-snapshot-store";
import type { TypedEventBus } from "./event-bus";
import type { HealthSnapshot } from "./types";

const FRESHNESS_THRESHOLD_MS = 60_000;
const SNAPSHOT_INTERVAL_MS = 2_000;
const FPS_SAMPLE_WINDOW = 60;

function readMemoryMb(): number | null {
  const mem = (performance as any).memory;
  if (!mem || typeof mem.usedJSHeapSize !== "number") return null;
  return Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
}

export class HealthMonitor {
  private readonly bus: TypedEventBus;
  private rafId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private frameTimes: number[] = [];
  private lastFrameAt: number | null = null;
  private running = false;

  constructor(bus: TypedEventBus) {
    this.bus = bus;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameAt = null;
    this.frameTimes = [];
    const sampleFrame = (t: number) => {
      if (this.lastFrameAt !== null) {
        this.frameTimes.push(t - this.lastFrameAt);
        if (this.frameTimes.length > FPS_SAMPLE_WINDOW) this.frameTimes.shift();
      }
      this.lastFrameAt = t;
      if (this.running) this.rafId = requestAnimationFrame(sampleFrame);
    };
    this.rafId = requestAnimationFrame(sampleFrame);

    this.emitSnapshot(); // primeira leitura real imediata, sem esperar o primeiro intervalo.
    this.intervalId = setInterval(() => this.emitSnapshot(), SNAPSHOT_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private currentFps(): number | null {
    if (this.frameTimes.length < 5) return null; // amostra curta demais — melhor null honesto que um número instável.
    const avgMs = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    if (avgMs <= 0) return null;
    return Math.round(1000 / avgMs);
  }

  private emitSnapshot(): void {
    const store = useUnifiedSnapshotStore.getState();
    const snapshot: HealthSnapshot = {
      fps: this.currentFps(),
      cycleLatencyMs: store.core.cycleLatencyMs,
      memoryMb: readMemoryMb(),
      workersAlive: getQuantWorkerState() === "ready" ? 1 : 0,
      isOnline: !store.offline,
      lastUpdatedAt: Date.now(),
    };
    store.setHealth(snapshot);
    this.bus.emit({ type: "HEALTH.CHANGED", payload: snapshot });

    const freshest = Math.max(store.price.updatedAt ?? 0, store.orderBook.updatedAt ?? 0);
    store.setDataFresh(freshest > 0 && Date.now() - freshest < FRESHNESS_THRESHOLD_MS);
  }
}

let singleton: HealthMonitor | null = null;

// Mesmo padrão de singleton de getNexusCore()/getMarketDataBus(): um único
// Health Monitor real por página.
export function getHealthMonitor(bus: TypedEventBus): HealthMonitor {
  if (!singleton) singleton = new HealthMonitor(bus);
  return singleton;
}

/** Só para testes: libera o singleton para o próximo teste começar limpo. */
export function __resetHealthMonitorSingletonForTests(): void {
  singleton = null;
}
