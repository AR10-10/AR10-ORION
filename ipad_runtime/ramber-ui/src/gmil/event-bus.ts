// event-bus.ts — GMIL LEI 02/11: barramento de eventos único entre
// Providers → Normalizers → Consumers → Consensus Engine. Nenhum módulo do
// GMIL importa outro diretamente para trocar dado em tempo real; tudo passa
// por aqui. (Imports de TIPOS entre módulos continuam normais — a regra é
// sobre fluxo de dado em runtime, não sobre TypeScript.)

export type GmilEventType = 'PROVIDER_READING' | 'PROVIDER_HEALTH_CHANGED' | 'CONSENSUS_UPDATED';

export interface GmilEvent<T = unknown> {
  type: GmilEventType;
  payload: T;
  timestamp: number;
}

type Listener<T> = (event: GmilEvent<T>) => void;

export class GmilEventBus {
  private listeners = new Map<GmilEventType, Set<Listener<any>>>();

  on<T>(type: GmilEventType, fn: Listener<T>): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
    return () => this.listeners.get(type)?.delete(fn);
  }

  emit<T>(type: GmilEventType, payload: T): void {
    const event: GmilEvent<T> = { type, payload, timestamp: Date.now() };
    this.listeners.get(type)?.forEach((fn) => fn(event));
  }
}

// Singleton — um barramento por aba, como o resto do runtime real (mesmo
// padrão do singleton de worker em engine-bridge.ts's getWorkerClient()).
export const gmilBus = new GmilEventBus();
