// organism-orchestrator.ts — Ordem "Próxima Evolução do Organismo": o braço
// concreto da camada central de orquestração (Nexus Core + Typed Event Bus).
//
// O organismo tem UMA regra de circulação de dados, e este módulo a torna
// mecânica em vez de disciplinar:
//
//   LEITURA  — todo motor/serviço lê o organismo exclusivamente através do
//              UnifiedGlobalSnapshot. Contexto imperativo (serviços, motores,
//              futuros workers) usa getSnapshotForEngine() — visão versionada,
//              sequenciada e tipada SÓ com estado (as ações ficam fora do
//              tipo: motor lê, nunca escreve fora da própria fatia). Contexto
//              React usa os seletores atômicos da própria store — a MESMA
//              fonte, só que com assinatura reativa por fatia.
//   ESCRITA  — todo motor entrega sua saída como escrita de UMA fatia do
//              snapshot (via as actions §3/§4/§5 já existentes).
//   PUBLICAÇÃO — este orquestrador assina a store UMA vez e traduz cada
//              escrita real de fatia de saída em exatamente UM evento tipado
//              no bus do Nexus Core, com payload = a MESMA referência que
//              entrou na store (zero cópia, zero segunda forma do dado).
//
// Consequência arquitetural (a exigência central da Ordem): NENHUM motor fala
// com outro motor. Conselho não entrega decisão ao Motor de Cenários; ele
// escreve `council` no snapshot, a store notifica, o cenário relê via
// snapshot — e qualquer futuro assinante recebe BRAIN.COUNCIL.UPDATED no bus
// sem que o conselho saiba que ele existe. Evolução 100% aditiva: um motor
// novo = (1) contrato próprio, (2) fatia própria no snapshot, (3) leitura via
// getSnapshotForEngine(), (4) um case novo de diff aqui — zero modificação
// nos motores existentes.
//
// Fail-Closed: o orquestrador não fabrica, não agenda e não interpola nada —
// se um motor escreve null (troca de ativo, degradação honesta), o evento
// publicado carrega null; se o orquestrador não está rodando, a LEITURA via
// getSnapshotForEngine() continua devolvendo o estado real da store (o
// contador seq fica parado, os dados nunca mentem). Main Thread sagrada: o
// custo por transição é um punhado de comparações por referência (===) — a
// tradução escrita→evento não computa nada.
import { useUnifiedSnapshotStore, type UnifiedSnapshotState } from "../store/unified-snapshot-store";
import type { TypedEventBus } from "./event-bus";

// Contrato da VISÃO (não do conteúdo): versiona a forma { seq, takenAt,
// snapshot } que os motores recebem. Os contratos de conteúdo continuam nos
// módulos donos de cada fatia (COUNCIL_CONTRACT_VERSION etc.) — versão da
// moldura e versão do quadro são coisas independentes.
export const ENGINE_SNAPSHOT_CONTRACT_VERSION = 1 as const;

export interface EngineSnapshotView {
  contractVersion: typeof ENGINE_SNAPSHOT_CONTRACT_VERSION;
  // Geração do organismo: incrementa a cada transição REAL da store observada
  // pelo orquestrador em execução (qualquer fatia — o organismo é um só).
  // Duas leituras com o mesmo seq viram do mesmo estado; seq maior = estado
  // estritamente mais novo. 0 = orquestrador ainda não iniciado (boot) — a
  // leitura dos DADOS permanece real mesmo assim (fail-closed só no contador,
  // nunca no conteúdo).
  seq: number;
  takenAt: number;
  // Readonly no topo + Immer congelando as fatias em dev: a visão é de
  // leitura. Zero cópia — é a referência viva do estado da store.
  snapshot: Readonly<UnifiedSnapshotState>;
}

// seq vive no módulo (não na instância) para que getSnapshotForEngine() seja
// uma função livre — motores não precisam segurar o orquestrador para ler.
let seqCounter = 0;

export function getSnapshotForEngine(): EngineSnapshotView {
  return {
    contractVersion: ENGINE_SNAPSHOT_CONTRACT_VERSION,
    seq: seqCounter,
    takenAt: Date.now(),
    snapshot: useUnifiedSnapshotStore.getState(),
  };
}

export class OrganismOrchestrator {
  private readonly bus: TypedEventBus;
  private unsubscribe: (() => void) | null = null;

  constructor(bus: TypedEventBus) {
    this.bus = bus;
  }

  start(): void {
    if (this.unsubscribe) return; // idempotente (sobrevive ao StrictMode)
    this.unsubscribe = useUnifiedSnapshotStore.subscribe((state, prev) => {
      seqCounter += 1;
      // Diff por REFERÊNCIA (===): a store é Immer — toda mudança real troca
      // a referência da fatia; escrita com o mesmo valor não notifica. Cada
      // fatia de saída vira no máximo UM evento por transição.
      //
      // §1/§5 — o orquestrador é o publicador real dos eventos de UI/offline
      // declarados na Fase 0 (até então sem emissor vivo):
      if (state.symbol !== prev.symbol) {
        this.bus.emit({ type: "UI.SYMBOL_CHANGED", payload: { symbol: state.symbol } });
      }
      if (state.activeTimeframe !== prev.activeTimeframe) {
        this.bus.emit({ type: "UI.TIMEFRAME_CHANGED", payload: { tf: state.activeTimeframe } });
      }
      if (state.offline !== prev.offline) {
        this.bus.emit({ type: "OFFLINE.CHANGED", payload: { offline: state.offline } });
      }
      // §3 MOTORES QUANT
      if (state.volumeProfile !== prev.volumeProfile) {
        this.bus.emit({ type: "QUANT.VOLUME_PROFILE.UPDATED", payload: { profile: state.volumeProfile } });
      }
      if (state.fibonacciConfluence !== prev.fibonacciConfluence) {
        this.bus.emit({ type: "QUANT.FIBONACCI.UPDATED", payload: { matrix: state.fibonacciConfluence } });
      }
      // OMEGA CORE V-MAX (Fase 1.1) — smc/cvd/orderflowSignals eram
      // "insumos pré-store" (docs/ORGANISM_DATA_FLOW.md): já reais, já
      // computados em App.tsx, sem fatia própria até esta fase. Mesmo
      // padrão de diff por referência dos dois casos QUANT.* acima.
      if (state.smc !== prev.smc) {
        this.bus.emit({ type: "QUANT.SMC.UPDATED", payload: { zones: state.smc } });
      }
      if (state.cvd !== prev.cvd) {
        this.bus.emit({ type: "QUANT.CVD.UPDATED", payload: { cvd: state.cvd } });
      }
      if (state.orderflowSignals !== prev.orderflowSignals) {
        this.bus.emit({ type: "QUANT.ORDERFLOW_SIGNALS.UPDATED", payload: { signals: state.orderflowSignals } });
      }
      // OMEGA CORE V-MAX (Fase 5) — Corredor de Confluência (Fusion §5).
      if (state.confluenceCorridor !== prev.confluenceCorridor) {
        this.bus.emit({ type: "QUANT.CONFLUENCE_CORRIDOR.UPDATED", payload: { reading: state.confluenceCorridor } });
      }
      // §4 CÉREBRO
      if (state.council !== prev.council) {
        this.bus.emit({ type: "BRAIN.COUNCIL.UPDATED", payload: { decision: state.council } });
      }
      if (state.scenario !== prev.scenario) {
        this.bus.emit({ type: "BRAIN.SCENARIO.UPDATED", payload: { projection: state.scenario } });
      }
      if (state.trapSignals !== prev.trapSignals) {
        this.bus.emit({ type: "BRAIN.TRAPS.UPDATED", payload: { traps: state.trapSignals } });
      }
      if (state.tradePlan !== prev.tradePlan) {
        this.bus.emit({ type: "BRAIN.TRADE_PLAN.UPDATED", payload: { plan: state.tradePlan } });
      }
      // §5 ORGANISMO — HEALTH.CHANGED continua do Health Monitor (publicador
      // único histórico da Fase 0.8) e DATA.* do CrossExchangeService: um
      // evento nunca ganha um segundo emissor.
      if (state.trustScore !== prev.trustScore) {
        this.bus.emit({ type: "ORGANISM.TRUST.UPDATED", payload: { score: state.trustScore } });
      }
      // Uma ingestão afetiva real substitui a referência de affectiveMemory
      // (e recomputa cpi no MESMO write — uma transição, um evento): o diff é
      // na memória, não no cpi, porque o cpi pode legitimamente repetir o
      // valor (1.0 → 1.0 com dois rewards) e o evento ainda é devido.
      if (state.affectiveMemory !== prev.affectiveMemory) {
        this.bus.emit({ type: "ORGANISM.AFFECT.UPDATED", payload: { cpi: state.cpi, memory: state.affectiveMemory } });
      }
      if (state.trackRecord !== prev.trackRecord) {
        this.bus.emit({ type: "ORGANISM.TRACK_RECORD.UPDATED", payload: { record: state.trackRecord } });
      }
    });
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

// Mesmo padrão de singleton de getNexusCore()/getHealthMonitor(): um único
// orquestrador real por página, ligado no MESMO efeito de boot do App que já
// inicia o Nexus Core e o Health Monitor.
let singleton: OrganismOrchestrator | null = null;

export function getOrganismOrchestrator(bus: TypedEventBus): OrganismOrchestrator {
  if (!singleton) singleton = new OrganismOrchestrator(bus);
  return singleton;
}

/** Só para testes: libera o singleton e zera o contador de geração. */
export function __resetOrganismOrchestratorForTests(): void {
  singleton?.stop();
  singleton = null;
  seqCounter = 0;
}
