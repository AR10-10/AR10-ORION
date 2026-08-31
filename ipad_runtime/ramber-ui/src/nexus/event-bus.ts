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
import type { ConfluenceCorridorReading } from "./confluence-corridor";
import type { RadarQualificationResult } from "./radar-qualification";
import type { NexusDecision } from "./decision-layer";
import type { InstitutionalScoreReading } from "./institutional-score";
import type { HeatScoreReading } from "./heat-score";
import type { GmilSnapshot } from "../gmil/gmil-orchestrator";
import type { InstitutionalZone } from "./institutional-zones";
import type { RiskSuggestion } from "../engine-bridge";

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
// Achado real de auditoria (DIRETRIZES AVANÇADAS, ecossistema): os 3
// DATA.* abaixo NÃO têm publicador vivo hoje — cross-exchange-service.ts
// (o único código que os emitiria) é deliberadamente NÃO iniciado por
// App.tsx nesta fase (ver o cabeçalho do próprio arquivo: substituir o
// caminho WS/REST que já funciona é o passo de maior risco do projeto,
// adiado de propósito). Um assinante futuro que registrar `bus.on("DATA.…")`
// esperando receber algo real ficará esperando para sempre, sem erro —
// documentado aqui pra nunca ser um mistério silencioso.
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
  | { type: "QUANT.CONFLUENCE_CORRIDOR.UPDATED"; payload: { reading: ConfluenceCorridorReading | null } }
  // Achado da auditoria de evolução (Unificação da Inteligência,
  // docs/historico/AUDITORIA_UNIFICACAO_VOZ.md §4 item 1): computeInstitutionalZones
  // já tinha fatia real na store (Carta Branca) mas nunca ganhou evento —
  // nenhum assinante podia reagir a "uma zona nova se formou" sem antes
  // recomputar tudo sozinho. Mesmo padrão passthrough de QUANT.SMC acima.
  | { type: "QUANT.INSTITUTIONAL_ZONES.UPDATED"; payload: { zones: InstitutionalZone[] } }
  // Achado da auditoria de evolução (docs/historico/AUDITORIA_UNIFICACAO_VOZ.md §4
  // item 2): riskSuggestion (risk-engine.js) já era computado real em
  // App.tsx mas não tinha fatia na store nem evento — nenhum consumidor
  // fora da árvore React do App podia lê-lo.
  | { type: "QUANT.RISK_SUGGESTION.UPDATED"; payload: { suggestion: RiskSuggestion | null } }
  // §4 CÉREBRO
  | { type: "BRAIN.COUNCIL.UPDATED"; payload: { decision: CouncilDecision | null } }
  | { type: "BRAIN.SCENARIO.UPDATED"; payload: { projection: ScenarioProjection | null } }
  | { type: "BRAIN.TRAPS.UPDATED"; payload: { traps: TrapSignal[] } }
  | { type: "BRAIN.TRADE_PLAN.UPDATED"; payload: { plan: TradePlan | null } }
  | { type: "BRAIN.RADAR_CANDIDATES.UPDATED"; payload: { candidates: RadarQualificationResult[] } }
  // EPC OMEGA FINAL Parte 1 ("Meta Engine", achado de auditoria): estas 3
  // leituras já existiam (App.tsx, useMemo local) mas nunca tinham fatia
  // própria no organismo — computadas de novo a cada consumidor, invisíveis
  // para qualquer assinante futuro do bus. Passthrough puro (LEI 24): os
  // motores continuam os mesmos, só ganham um lugar real no organismo.
  | { type: "BRAIN.NEXUS_DECISION.UPDATED"; payload: { decision: NexusDecision | null } }
  | { type: "BRAIN.INSTITUTIONAL_SCORE.UPDATED"; payload: { reading: InstitutionalScoreReading | null } }
  | { type: "BRAIN.HEAT_SCORE.UPDATED"; payload: { reading: HeatScoreReading | null } }
  // Diretriz Final de Integração Total: o GMIL já alimentava a UI real
  // (App.tsx via useGmilSnapshot) mas nunca tinha evento próprio no
  // organismo — mesmo passthrough puro dos demais BRAIN.*.
  | { type: "BRAIN.GMIL.UPDATED"; payload: { snapshot: GmilSnapshot | null } }
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
