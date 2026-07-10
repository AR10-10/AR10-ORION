// event-bus.ts — V-MAX Fase 0.2: Event Bus tipado do Nexus Core.
//
// Implementação própria em vez de uma dependência externa (mitt) —
// ~30 linhas reais, zero superfície de API não usada, "Simplicidade
// radical" (Blueprint §0). Cada handler roda dentro de um try/catch: um
// assinante com bug nunca derruba os demais nem o publicador (mesmo
// princípio já usado em bus.js/market-data-bus para subscribers).
import type { Exchange, ExchangeConnectionState, HealthSnapshot, Timeframe } from "./types";

// Diretamente do Blueprint V-MAX §1.3 — os únicos eventos reais que este
// sistema publica. Nenhum evento é adicionado especulativamente; cada um
// só existe quando o publicador correspondente (CrossExchangeService,
// Health Monitor, UI) realmente o emite nesta Fase 0.
export type NexusEvent =
  | { type: "DATA.CANDLES_UPDATED"; payload: { symbol: string; tf: Timeframe; exchange: Exchange } }
  | { type: "DATA.ORDERBOOK_UPDATED"; payload: { exchange: Exchange } }
  | { type: "DATA.CONNECTION_CHANGED"; payload: { exchange: Exchange; state: ExchangeConnectionState } }
  | { type: "HEALTH.CHANGED"; payload: HealthSnapshot }
  | { type: "UI.TIMEFRAME_CHANGED"; payload: { tf: Timeframe } }
  | { type: "UI.SYMBOL_CHANGED"; payload: { symbol: string } }
  | { type: "OFFLINE.CHANGED"; payload: { offline: boolean } };

export type NexusEventType = NexusEvent["type"];
type PayloadOf<T extends NexusEventType> = Extract<NexusEvent, { type: T }>["payload"];
type Handler<T extends NexusEventType> = (payload: PayloadOf<T>) => void;

export class TypedEventBus {
  private handlers: Map<NexusEventType, Set<Handler<any>>> = new Map();

  on<T extends NexusEventType>(type: T, handler: Handler<T>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  emit<T extends NexusEventType>(event: Extract<NexusEvent, { type: T }>): void {
    const set = this.handlers.get(event.type);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(event.payload);
      } catch {
        // um assinante ruim nunca derruba os demais nem o publicador —
        // mesmo princípio de bus.js's subscribers.forEach.
      }
    }
  }

  // Só para testes/depuração — nunca usado no caminho real de publicação.
  listenerCount(type: NexusEventType): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
  }
}
