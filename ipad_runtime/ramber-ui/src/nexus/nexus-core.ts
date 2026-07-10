// nexus-core.ts — V-MAX Fase 0.2: orquestrador central (Blueprint §1.2).
//
// "Não contém lógica de negócio pesada" — este arquivo não sabe o que é
// um candle, um funding rate ou um agente. Ele só: (1) possui a ÚNICA
// instância real do Event Bus tipado que todo o resto do sistema
// compartilha, e (2) coordena o ciclo de vida (start/pause/resume/stop)
// dos serviços reais que se registram nele (CrossExchangeService, Health
// Monitor, ...) — cada serviço decide sozinho o que fazer em cada fase;
// o Nexus Core só garante que todos ouçam a MESMA transição, na mesma
// ordem de registro.
import { TypedEventBus } from "./event-bus";

export type NexusLifecycleState = "idle" | "running" | "paused" | "stopped";

export interface NexusLifecycleHooks {
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

export class NexusCore {
  readonly bus = new TypedEventBus();
  private state: NexusLifecycleState = "idle";
  private hooks: NexusLifecycleHooks[] = [];

  getState(): NexusLifecycleState {
    return this.state;
  }

  // Serviços reais (CrossExchangeService, Health Monitor) se registram
  // aqui uma vez, no boot — retorna o cancelamento para symmetry com
  // useEffect/o resto do padrão de assinatura já usado no app.
  register(hooks: NexusLifecycleHooks): () => void {
    this.hooks.push(hooks);
    return () => {
      const i = this.hooks.indexOf(hooks);
      if (i >= 0) this.hooks.splice(i, 1);
    };
  }

  start(): void {
    if (this.state === "running") return;
    this.state = "running";
    for (const h of this.hooks) h.onStart?.();
  }

  pause(): void {
    if (this.state !== "running") return;
    this.state = "paused";
    for (const h of this.hooks) h.onPause?.();
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = "running";
    for (const h of this.hooks) h.onResume?.();
  }

  stop(): void {
    if (this.state === "stopped") return;
    this.state = "stopped";
    for (const h of this.hooks) h.onStop?.();
    this.bus.clear();
    this.hooks = [];
  }
}

// Singleton por página — mesmo padrão já estabelecido em
// market-data-bus/bus.js (getMarketDataBus()): um único Nexus Core real
// compartilhado por todos os consumidores da árvore React, nunca uma
// instância por componente.
let singleton: NexusCore | null = null;

export function getNexusCore(): NexusCore {
  if (!singleton) singleton = new NexusCore();
  return singleton;
}
