// health-monitor.ts — V-MAX Fase 0.8 (Blueprint §7.2: "Latência por
// exchange, FPS, memória JS, status Workers, freshness, offline.
// Publicado via HEALTH.CHANGED.").
//
// Cada campo é medido de verdade ou fica honestamente null/0 — nunca um
// valor de exemplo:
//   fps            — Fase 1.2 (achado real durante a auditoria de dados
//                    para o OrderFlowHeatmapPlugin): App.tsx JÁ tinha um
//                    contador de FPS real via requestAnimationFrame desde
//                    antes da Fase 0 ("FPS (UI REAL)", já exibido na UI) —
//                    este módulo tinha sua PRÓPRIA amostragem paralela,
//                    uma duplicação real que a Regra de Ouro 9/"zero
//                    repetição" não deveria ter deixado passar. Corrigido:
//                    espelha store.uiFps (mesmo padrão já usado para
//                    cycleLatencyMs/isOnline abaixo), nunca mede de novo.
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
// Ordem "Próxima Evolução do Organismo": serviços imperativos leem o
// organismo pelo gateway versionado — mesma store, mesma referência viva,
// só que através do contrato único que todo motor (atual ou futuro) usa.
import { getSnapshotForEngine } from "./organism-orchestrator";
import type { TypedEventBus } from "./event-bus";
import type { HealthSnapshot } from "./types";

const FRESHNESS_THRESHOLD_MS = 60_000;
const SNAPSHOT_INTERVAL_MS = 2_000;

function readMemoryMb(): number | null {
  const mem = (performance as any).memory;
  if (!mem || typeof mem.usedJSHeapSize !== "number") return null;
  return Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
}

export class HealthMonitor {
  private readonly bus: TypedEventBus;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(bus: TypedEventBus) {
    this.bus = bus;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.emitSnapshot(); // primeira leitura real imediata, sem esperar o primeiro intervalo.
    this.intervalId = setInterval(() => this.emitSnapshot(), SNAPSHOT_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private emitSnapshot(): void {
    // Leitura EXCLUSIVA via UnifiedGlobalSnapshot (gateway versionado);
    // escrita via as actions da própria store — leitura e escrita separadas
    // de propósito: a visão de motor não carrega ações.
    const { snapshot: organism } = getSnapshotForEngine();
    const snapshot: HealthSnapshot = {
      fps: organism.uiFps,
      cycleLatencyMs: organism.core.cycleLatencyMs,
      memoryMb: readMemoryMb(),
      workersAlive: getQuantWorkerState() === "ready" ? 1 : 0,
      isOnline: !organism.offline,
      lastUpdatedAt: Date.now(),
    };
    const actions = useUnifiedSnapshotStore.getState();
    actions.setHealth(snapshot);
    this.bus.emit({ type: "HEALTH.CHANGED", payload: snapshot });

    const freshest = Math.max(organism.price.updatedAt ?? 0, organism.orderBook.updatedAt ?? 0);
    actions.setDataFresh(freshest > 0 && Date.now() - freshest < FRESHNESS_THRESHOLD_MS);
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
