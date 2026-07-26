// event-bus.ts — V-MAX Fase 0.2: Event Bus tipado do Nexus Core.
//
// Implementação própria em vez de uma dependência externa (mitt) —
// ~30 linhas reais, zero superfície de API não usada, "Simplicidade
// radical" (Blueprint §0). Cada handler roda dentro de um try/catch: um
// assinante com bug nunca derruba os demais nem o publicador (mesmo
// princípio já usado em bus.js/market-data-bus para subscribers).
import type { Exchange, ExchangeConnectionState, HealthSnapshot, Timeframe } from "./types";
// Payloads dos eventos de saída de motor = os MESMOS contratos versionados
// que as fatias correspondentes do UnifiedGlobalSnapshot — um evento carrega
// a referência exata escrita na store, nunca uma segunda forma do mesmo dado.
// Todos `import type` puros: apagados na compilação, zero custo em runtime.
import type { VolumeProfileSnapshot } from "./volume-profile";
import type { FibonacciConfluenceMatrix } from "./fibonacci-confluence";
import type { CouncilDecision } from "./council";
import type { ScenarioProjection } from "./scenario-engine";
import type { TrapSignal } from "./trap-detection";
import type { TradePlan } from "./trade-plan";
import type { AffectiveMemoryState } from "./affective-memory";
import type { TrackRecordState } from "./signal-track-record";
import type { TrustScoreSnapshot, SmcZonesSnapshot, OrderflowSignal } from "../engine-bridge";

// Diretamente do Blueprint V-MAX §1.3 — os únicos eventos reais que este
// sistema publica. Nenhum evento é adicionado especulativamente; cada um
// só existe quando o publicador correspondente (CrossExchangeService,
// Health Monitor, UI) realmente o emite nesta Fase 0.
//
// Ordem "Próxima Evolução do Organismo": a família de eventos de SAÍDA DE
// MOTOR (QUANT.*, BRAIN.*, ORGANISM.*) tem exatamente UM publicador real —
// o OrganismOrchestrator (organism-orchestrator.ts), que traduz cada
// escrita de fatia de saída no UnifiedGlobalSnapshot em um evento tipado.
// Motores nunca chamam emit() diretamente e nunca se falam entre si:
// escrevem na store (fusão) → o orquestrador notifica o organismo via bus.
// O mesmo orquestrador é o publicador real de UI.SYMBOL_CHANGED /
// UI.TIMEFRAME_CHANGED / OFFLINE.CHANGED (declarados na Fase 0, até então
// sem emissor vivo). DATA.* seguem do CrossExchangeService e
// HEALTH.CHANGED do Health Monitor — um único publicador por evento,
// nunca dois emissores para o mesmo tipo.
export type NexusEvent =
  | { type: "DATA.CANDLES_UPDATED"; payload: { symbol: string; tf: Timeframe; exchange: Exchange } }
  | { type: "DATA.ORDERBOOK_UPDATED"; payload: { exchange: Exchange } }
  | { type: "DATA.CONNECTION_CHANGED"; payload: { exchange: Exchange; state: ExchangeConnectionState } }
  | { type: "HEALTH.CHANGED"; payload: HealthSnapshot }
  | { type: "UI.TIMEFRAME_CHANGED"; payload: { tf: Timeframe } }
  | { type: "UI.SYMBOL_CHANGED"; payload: { symbol: string } }
  | { type: "OFFLINE.CHANGED"; payload: { offline: boolean } }
  // §3 MOTORES QUANT — null explícito é transição REAL (fail-closed na
  // troca de ativo: assinantes precisam saber que o dado se foi, nunca
  // continuar exibindo um resultado velho de outro ativo).
  | { type: "QUANT.VOLUME_PROFILE.UPDATED"; payload: { profile: VolumeProfileSnapshot | null } }
  | { type: "QUANT.FIBONACCI.UPDATED"; payload: { matrix: FibonacciConfluenceMatrix | null } }
  // OMEGA CORE V-MAX (Fase 1.1) — smc (FVG/OB/liquidez) e o Order Flow ao
  // vivo (CVD + sinais OFI/Absorção/Exaustão), mesma família QUANT.*.
  | { type: "QUANT.SMC.UPDATED"; payload: { zones: SmcZonesSnapshot | null } }
  | { type: "QUANT.CVD.UPDATED"; payload: { cvd: number | null } }
  | { type: "QUANT.ORDERFLOW_SIGNALS.UPDATED"; payload: { signals: OrderflowSignal[] } }
  // §4 CÉREBRO
  | { type: "BRAIN.COUNCIL.UPDATED"; payload: { decision: CouncilDecision | null } }
  | { type: "BRAIN.SCENARIO.UPDATED"; payload: { projection: ScenarioProjection | null } }
  | { type: "BRAIN.TRAPS.UPDATED"; payload: { traps: TrapSignal[] } }
  | { type: "BRAIN.TRADE_PLAN.UPDATED"; payload: { plan: TradePlan | null } }
  // §5 ORGANISMO
  | { type: "ORGANISM.TRUST.UPDATED"; payload: { score: TrustScoreSnapshot | null } }
  // Uma ingestão afetiva real = um evento (a fatia affectiveMemory é
  // substituída por referência a cada ingestão); cpi pode repetir o mesmo
  // valor entre eventos (ex.: 1.0 → 1.0 com dois rewards) — o evento
  // continua sendo emitido porque a MEMÓRIA mudou de verdade.
  | { type: "ORGANISM.AFFECT.UPDATED"; payload: { cpi: number | null; memory: AffectiveMemoryState } }
  // Honest signal accuracy: a plan opened, resolved (target/stop) or was
  // superseded — one real transition, one event.
  | { type: "ORGANISM.TRACK_RECORD.UPDATED"; payload: { record: TrackRecordState } };

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
