// unified-snapshot-store.ts — O UnifiedGlobalSnapshot (Blueprint §2.3): o
// objeto de FUSÃO do organismo. Zustand + Immer, seletores atômicos.
//
// ORGANIZAÇÃO (diretriz do Operador: "tudo no lugar certo, sequência de
// todos os dados corretamente"): o snapshot cresceu fase a fase em ordem
// CRONOLÓGICA de construção; esta passada o reordena por DOMÍNIO, sem
// mudar um único nome ou comportamento (prova: a suíte inteira passa
// intacta). A MESMA sequência de domínios se repete em quatro lugares —
// estado → ações → defaults → seletores — então cada dado tem exatamente
// UM lugar, e o lugar é o mesmo nos quatro blocos:
//
//   §1 MERCADO — dado bruto real do ativo ativo (App.tsx é o único coletor)
//      symbol · activeTimeframe · price · orderBook · derivatives ·
//      candles · orderBooks · connections
//   §2 SÉRIES HISTÓRICAS — memória temporal do mercado (rings reais)
//      l2History (Fase 1.1) · orderflowHistory (Fase 1.2)
//   §3 MOTORES QUANT — derivações computadas de dado real
//      volumeProfile (Fase 1.3, WASM) · fibonacciConfluence (Fase 1.4)
//   §4 CÉREBRO — deliberação e projeção (camada de análise, LEI 24)
//      council (item 4) · scenario (Fase 2) · trapSignals (Fase 2)
//   §5 ORGANISMO — estado do próprio sistema
//      core (motor) · health · offline · isDataFresh · uiFps ·
//      trustScore (Fase 2, WASM) · affectiveMemory + cpi (item 5)
//
// Arquitetura ADITIVA por design (diretriz explícita: "não tente reescrever
// o sistema inteiro de uma vez"): App.tsx continua a ÚNICA fonte real de
// coleta (WebSocket de preço/livro, REST de funding/OI, ciclo do motor) —
// nada aqui dispara uma segunda rede. Efeitos de sincronização em App.tsx
// espelham o dado já real para dentro da store; consumidores leem via os
// seletores atômicos (cada hook só re-renderiza quando a SUA fatia muda).
// Consumidores antigos continuam via WidgetContext sem migração forçada.
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Candle,
  Exchange,
  ExchangeConnectionState,
  HealthSnapshot,
  L2Snapshot,
  Timeframe,
} from "../nexus/types";
import { maybeSampleL2History, type L2HistoryEntry } from "../nexus/l2-history";
import { pushOrderflowHistory, type OrderflowHistoryEntry } from "../nexus/orderflow-history";
import { pushConvictionHistory, type ConvictionScoreSample } from "../nexus/institutional-score";
import type { VolumeProfileSnapshot } from "../nexus/volume-profile";
import type { FibonacciConfluenceMatrix } from "../nexus/fibonacci-confluence";
import type { CouncilDecision } from "../nexus/council";
import type { ScenarioProjection } from "../nexus/scenario-engine";
import type { TrapSignal } from "../nexus/trap-detection";
import type { TradePlan } from "../nexus/trade-plan";
import type { MultiTimeframeMatrix } from "../nexus/multi-timeframe-engine";
import {
  trackPlanTransition,
  trackPriceTick,
  EMPTY_TRACK_RECORD,
  type TrackRecordState,
} from "../nexus/signal-track-record";
import {
  ingestAffectiveEvent,
  computeCpi,
  EMPTY_AFFECTIVE_STATE,
  type AffectiveMemoryState,
  type AffectiveEventSource,
} from "../nexus/affective-memory";
// import type puro — apagado na compilação, nunca puxa o engine-bridge
// (e seus módulos js pesados) para dentro do bundle da store em runtime.
import type { TrustScoreSnapshot } from "../engine-bridge";

// ─────────────────────────────────────────────────────────────────────────
// Formas (§1 e §5 — as demais vêm dos módulos nexus/, um contrato por motor)
// ─────────────────────────────────────────────────────────────────────────

export interface PriceSnapshot {
  price: number | null;
  delta: number | null;
  deltaPct: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  direction: "LONG" | "SHORT" | null;
  updatedAt: number | null;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  updatedAt: number | null;
}

export interface DerivativesSnapshot {
  fundingRate: number | null;
  openInterest: number | null;
}

export type EngineStatus = "pending" | "ok" | "error";

export interface CoreSnapshot {
  engineStatus: EngineStatus;
  direction: "LONG" | "SHORT" | null;
  // Rótulo categórico real (ALTA/MÉDIA/BAIXA), o mesmo RealCycleResult.confidence
  // que os outros widgets já exibem — não um score 0..1 (esse existiria só
  // dentro de realCycle.lorentzian, não é o que "confidence" significa aqui).
  confidence: string | null;
  lastUpdateAt: number | null;
  cycleLatencyMs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Estados vazios honestos (nunca um valor de exemplo) + referências
// estáveis (nunca um `[]` novo por chamada — sem isto, todo consumidor dos
// seletores de série re-renderizaria a cada render pela comparação por
// referência do Zustand, mesmo sem dado real novo).
// ─────────────────────────────────────────────────────────────────────────

const EMPTY_PRICE: PriceSnapshot = {
  price: null, delta: null, deltaPct: null, high: null, low: null, volume: null, direction: null, updatedAt: null,
};
const EMPTY_ORDER_BOOK: OrderBookSnapshot = { bids: [], asks: [], updatedAt: null };
const EMPTY_DERIVATIVES: DerivativesSnapshot = { fundingRate: null, openInterest: null };
const EMPTY_CORE: CoreSnapshot = {
  engineStatus: "pending", direction: null, confidence: null, lastUpdateAt: null, cycleLatencyMs: null,
};
// Health Monitor real só mede a partir da Fase 0.8; até lá este é o estado
// honesto de "ainda não medido", não um valor de exemplo.
const EMPTY_HEALTH: HealthSnapshot = {
  fps: null, cycleLatencyMs: null, memoryMb: null, workersAlive: 0,
  isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  lastUpdatedAt: 0,
};
const EMPTY_L2_HISTORY: L2HistoryEntry[] = [];
const EMPTY_ORDERFLOW_HISTORY: OrderflowHistoryEntry[] = [];
const EMPTY_TRAPS: TrapSignal[] = [];
const EMPTY_CONVICTION_HISTORY: ConvictionScoreSample[] = [];

// ─────────────────────────────────────────────────────────────────────────
// Estado — na ordem canônica dos domínios (§1 → §5)
// ─────────────────────────────────────────────────────────────────────────

// Exportada (aditivo, Ordem "Próxima Evolução do Organismo") para o
// gateway de leitura getSnapshotForEngine() em nexus/organism-orchestrator.ts
// tipar a visão que os motores recebem — só o ESTADO, nunca as ações:
// motor lê o organismo, jamais escreve nele por fora da própria fatia.
export interface UnifiedSnapshotState {
  // §1 MERCADO — `symbol` É o `activeSymbol` do Blueprint (nunca duplicado
  // sob um segundo nome). Cada campo espelha dado que App.tsx coleta de
  // verdade (Binance/Bybit/OKX/MEXC reais) — nada nasce aqui.
  symbol: string;
  activeTimeframe: Timeframe;
  price: PriceSnapshot;
  orderBook: OrderBookSnapshot;
  derivatives: DerivativesSnapshot;
  candles: Partial<Record<string, Partial<Record<Timeframe, Candle[]>>>>;
  orderBooks: Partial<Record<Exchange, L2Snapshot | null>>;
  connections: Partial<Record<Exchange, ExchangeConnectionState>>;

  // §2 SÉRIES HISTÓRICAS
  // Fase 1.1 — SÉRIE de snapshots L2 (não só o mais recente, que
  // `orderBooks` acima já cobre): sem isto o heatmap não tem "tempo".
  l2History: Partial<Record<Exchange, L2HistoryEntry[]>>;
  // Fase 1.2 — CVD + trades grandes reais por ciclo de poll. Um único
  // símbolo ativo por vez (o Order Flow real hoje só existe para o feed
  // MEXC), não particionado por exchange.
  orderflowHistory: OrderflowHistoryEntry[];

  // §3 MOTORES QUANT
  // Fase 1.3 — Volume Profile real (WASM no quant-worker, aproximação
  // OHLCV declarada — ver nexus/volume-profile.ts). null até o primeiro
  // cálculo real do ativo corrente.
  volumeProfile: VolumeProfileSnapshot | null;
  // Fase 1.4 — Matriz de Confluência Fibonacci (agente transversal):
  // retração real da última perna confirmada cruzada contra S/R, zonas SMC
  // e POC/HVN. null = sem perna confirmada (fail-closed); score 0 nos
  // níveis é resultado honesto, não erro.
  fibonacciConfluence: FibonacciConfluenceMatrix | null;

  // §4 CÉREBRO (camada de análise — LEI 24: jamais alimenta o Core Engine)
  // Item 4 — Conselho Multi-Agente (contrato versionado): 6 votos reais +
  // decisão do Meta-Agent; ABSTAIN quando o RiskAgent trava (fail-closed).
  council: CouncilDecision | null;
  // Fase 2 — Cenários Path A/B: alvos = níveis reais; pesos = massa de
  // opinião real do conselho (NUNCA probabilidade de mercado).
  scenario: ScenarioProjection | null;
  // Fase 2 — armadilhas por corroboração de eventos REAIS consumados.
  // Lista vazia é o estado honesto comum, não erro.
  trapSignals: TrapSignal[];
  // Signal Precision order (phase 4) — actionable plan from REAL structure
  // (entry zone / stop / target / R:R). null = honest "no coherent plan"
  // (no directional stance, risk gate locked, or missing real structure).
  tradePlan: TradePlan | null;
  // Fase Ω Priority 1 — Adaptive Multi-Timeframe Intelligence: contexto real
  // independente por prazo (1m/5m/15m/1h/4h/1d), reaproveitando os mesmos
  // motores puros do ciclo principal (LEI 24: confluência/contexto, nunca um
  // segundo motor de decisão). null até o primeiro ciclo real.
  multiTimeframeContext: MultiTimeframeMatrix | null;
  // Diretriz Complementar §18/§4 ("tendência de convicção" / "Conviction
  // Engine"): série real do Score Geral (institutional-score.ts) ao longo
  // do tempo — só amostras REAIS entram (WAIT/DADOS_INSUFICIENTES nunca,
  // pontuar o nada seria fabricação). Escopada ao ativo ativo, mesmo
  // padrão de orderflowHistory.
  institutionalScoreHistory: ConvictionScoreSample[];

  // §5 ORGANISMO
  // Estado REAL do motor de análise (engineStatus/direção/confiança do
  // ciclo real de engine-bridge.ts) — nunca um score inventado.
  core: CoreSnapshot;
  health: HealthSnapshot;
  offline: boolean;
  // Fase 0.8 — "freshness" é responsabilidade do Health Monitor (Blueprint
  // §7.2), derivada de price/orderBook.updatedAt reais, nunca um segundo
  // relógio próprio.
  isDataFresh: boolean;
  // Fase 1.2 (dedup real): App.tsx já media FPS via requestAnimationFrame
  // desde antes da Fase 0 — o Health Monitor espelha este valor em vez de
  // amostrar de novo (zero repetição).
  uiFps: number | null;
  // Fase 2 — TrustScore da FONTE de dados (WASM): cadência real +
  // convergência cross-exchange. null até a primeira medição.
  trustScore: TrustScoreSnapshot | null;
  // Item 5 — Memória Afetiva (Reward/Pain com decaimento exponencial) +
  // CPI derivado. Escopo de SESSÃO do organismo, não por ativo — trocar de
  // ativo não apaga a memória operacional (as falhas/acertos de percepção
  // são do sistema, não do símbolo).
  affectiveMemory: AffectiveMemoryState;
  cpi: number | null;
  // Autonomy order — honest signal accuracy: every Trade Plan tracked
  // against the real price (first touch: target vs stop; conservative on
  // gaps). Session state hydrated from IndexedDB (Local-First).
  trackRecord: TrackRecordState;
}

// ─────────────────────────────────────────────────────────────────────────
// Ações — mesma ordem canônica (§1 → §5)
// ─────────────────────────────────────────────────────────────────────────

interface UnifiedSnapshotActions {
  // §1 MERCADO
  setSymbol: (symbol: string) => void;
  setActiveTimeframe: (tf: Timeframe) => void;
  setPrice: (price: Omit<PriceSnapshot, "updatedAt">) => void;
  setOrderBook: (book: Omit<OrderBookSnapshot, "updatedAt">) => void;
  setDerivatives: (derivatives: DerivativesSnapshot) => void;
  setCandles: (symbol: string, tf: Timeframe, candles: Candle[]) => void;
  setExchangeOrderBook: (exchange: Exchange, snapshot: L2Snapshot | null) => void;
  setConnectionState: (exchange: Exchange, state: ExchangeConnectionState) => void;

  // §2 SÉRIES HISTÓRICAS
  sampleL2History: (exchange: Exchange, entry: L2HistoryEntry) => void;
  // Nome deliberadamente diferente da função pura importada
  // (pushOrderflowHistory) que esta action chama por baixo — evita um
  // shadowing confuso entre função pura e action.
  recordOrderflowHistory: (entry: OrderflowHistoryEntry) => void;
  // Séries são acumuladas ao longo do tempo e escopadas ao ativo ativo —
  // trocar de ativo precisa limpá-las (senão amostras do ativo ANTERIOR
  // ficariam visíveis por minutos sob o novo), mesmo padrão do efeito de
  // troca em App.tsx que já zera price/chartData/orderBook/cvd.
  resetL2History: () => void;
  resetOrderflowHistory: () => void;

  // §3 MOTORES QUANT — null explícito = "ainda não computado/ativo
  // trocado", nunca um resultado velho de outro ativo.
  setVolumeProfile: (profile: VolumeProfileSnapshot | null) => void;
  setFibonacciConfluence: (matrix: FibonacciConfluenceMatrix | null) => void;

  // §4 CÉREBRO
  setCouncil: (decision: CouncilDecision | null) => void;
  setScenario: (projection: ScenarioProjection | null) => void;
  setTrapSignals: (traps: TrapSignal[]) => void;
  setTradePlan: (plan: TradePlan | null) => void;
  setMultiTimeframeContext: (matrix: MultiTimeframeMatrix | null) => void;
  // Diretriz Complementar §18/§4: registra uma amostra REAL do Score Geral
  // (nunca chamado com null/WAIT — o efeito que chama já filtra isso).
  recordInstitutionalScore: (score: number) => void;
  resetInstitutionalScoreHistory: () => void;

  // §5 ORGANISMO
  setCore: (core: CoreSnapshot) => void;
  setHealth: (health: HealthSnapshot) => void;
  setOffline: (offline: boolean) => void;
  setDataFresh: (fresh: boolean) => void;
  setUiFps: (fps: number | null) => void;
  setTrustScore: (score: TrustScoreSnapshot | null) => void;
  // Ingestão de um evento afetivo REAL (transição operacional verdadeira,
  // nunca chamado por render) — decai a memória até agora e recomputa o
  // CPI no mesmo write (decaimento lazy: entre eventos a razão é
  // invariante, ver nexus/affective-memory.ts).
  recordAffectiveEvent: (source: AffectiveEventSource) => void;
  trackPlanTransition: (plan: TradePlan | null) => void;
  trackPriceTick: (price: number) => void;
  hydrateTrackRecord: (state: TrackRecordState) => void;
}

export const useUnifiedSnapshotStore = create<UnifiedSnapshotState & UnifiedSnapshotActions>()(
  immer((set) => ({
    // §1 MERCADO
    symbol: "BTC",
    activeTimeframe: "15m",
    price: EMPTY_PRICE,
    orderBook: EMPTY_ORDER_BOOK,
    derivatives: EMPTY_DERIVATIVES,
    candles: {},
    orderBooks: {},
    connections: {},
    // §2 SÉRIES HISTÓRICAS
    l2History: {},
    orderflowHistory: [],
    // §3 MOTORES QUANT
    volumeProfile: null,
    fibonacciConfluence: null,
    // §4 CÉREBRO
    council: null,
    scenario: null,
    trapSignals: [],
    tradePlan: null,
    multiTimeframeContext: null,
    institutionalScoreHistory: [],
    // §5 ORGANISMO
    core: EMPTY_CORE,
    health: EMPTY_HEALTH,
    offline: typeof navigator === "undefined" ? false : !navigator.onLine,
    isDataFresh: false,
    uiFps: null,
    trustScore: null,
    affectiveMemory: EMPTY_AFFECTIVE_STATE,
    cpi: null,
    trackRecord: EMPTY_TRACK_RECORD,

    // §1 MERCADO
    setSymbol: (symbol) => set((s) => { s.symbol = symbol; }),
    setActiveTimeframe: (tf) => set((s) => { s.activeTimeframe = tf; }),
    setPrice: (price) => set((s) => { s.price = { ...price, updatedAt: Date.now() }; }),
    setOrderBook: (book) => set((s) => { s.orderBook = { ...book, updatedAt: Date.now() }; }),
    setDerivatives: (derivatives) => set((s) => { s.derivatives = derivatives; }),
    setCandles: (symbol, tf, candles) => set((s) => {
      const bySymbol = s.candles[symbol] ?? {};
      bySymbol[tf] = candles;
      s.candles[symbol] = bySymbol;
    }),
    setExchangeOrderBook: (exchange, snapshot) => set((s) => { s.orderBooks[exchange] = snapshot; }),
    setConnectionState: (exchange, state) => set((s) => { s.connections[exchange] = state; }),
    // §2 SÉRIES HISTÓRICAS
    sampleL2History: (exchange, entry) => set((s) => {
      const ring = (s.l2History[exchange] ?? []) as L2HistoryEntry[];
      s.l2History[exchange] = maybeSampleL2History(ring, entry);
    }),
    recordOrderflowHistory: (entry) => set((s) => {
      s.orderflowHistory = pushOrderflowHistory(s.orderflowHistory as OrderflowHistoryEntry[], entry);
    }),
    resetL2History: () => set((s) => { s.l2History = {}; }),
    resetOrderflowHistory: () => set((s) => { s.orderflowHistory = []; }),
    // §3 MOTORES QUANT
    setVolumeProfile: (profile) => set((s) => { s.volumeProfile = profile; }),
    setFibonacciConfluence: (matrix) => set((s) => { s.fibonacciConfluence = matrix; }),
    // §4 CÉREBRO
    setCouncil: (decision) => set((s) => { s.council = decision; }),
    setScenario: (projection) => set((s) => { s.scenario = projection; }),
    setTrapSignals: (traps) => set((s) => { s.trapSignals = traps; }),
    setTradePlan: (plan) => set((s) => { s.tradePlan = plan; }),
    setMultiTimeframeContext: (matrix) => set((s) => { s.multiTimeframeContext = matrix; }),
    recordInstitutionalScore: (score) => set((s) => {
      s.institutionalScoreHistory = pushConvictionHistory(s.institutionalScoreHistory as ConvictionScoreSample[], { score, at: Date.now() });
    }),
    resetInstitutionalScoreHistory: () => set((s) => { s.institutionalScoreHistory = []; }),
    // §5 ORGANISMO
    setCore: (core) => set((s) => { s.core = core; }),
    setHealth: (health) => set((s) => { s.health = health; }),
    setOffline: (offline) => set((s) => { s.offline = offline; }),
    setDataFresh: (fresh) => set((s) => { s.isDataFresh = fresh; }),
    setUiFps: (fps) => set((s) => { s.uiFps = fps; }),
    setTrustScore: (score) => set((s) => { s.trustScore = score; }),
    recordAffectiveEvent: (source) => set((s) => {
      const next = ingestAffectiveEvent(s.affectiveMemory as AffectiveMemoryState, source, Date.now());
      s.affectiveMemory = next;
      s.cpi = computeCpi(next);
    }),
    // The pure functions return the ORIGINAL reference when nothing changed
    // (same advisory reading, no touch) — immer then sees an identical
    // assignment and produces NO transition: zero spurious notifications on
    // the per-tick path (Main Thread sacred).
    trackPlanTransition: (plan) => set((s) => {
      s.trackRecord = trackPlanTransition(s.trackRecord as TrackRecordState, plan, Date.now());
    }),
    trackPriceTick: (price) => set((s) => {
      s.trackRecord = trackPriceTick(s.trackRecord as TrackRecordState, price, Date.now());
    }),
    hydrateTrackRecord: (state) => set((s) => { s.trackRecord = state; }),
  })),
);

// navigator.onLine é um sinal real do browser (não um valor inventado):
// espelha as transições reais de conectividade para dentro da store assim
// que acontecem. Auto-inicializado uma vez por página, mesmo padrão do
// singleton de getNexusCore() — nunca um listener por componente.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => useUnifiedSnapshotStore.getState().setOffline(false));
  window.addEventListener("offline", () => useUnifiedSnapshotStore.getState().setOffline(true));
}

// ─────────────────────────────────────────────────────────────────────────
// Seletores atômicos — mesma ordem canônica (§1 → §5). Cada hook só
// re-renderiza o componente quando a fatia SELECIONADA muda (comparação
// por referência do Zustand), nunca a cada atualização de qualquer parte
// do snapshot — é isto que resolve o gargalo do Sprint 1.
// ─────────────────────────────────────────────────────────────────────────

// §1 MERCADO
export const useSymbolSnapshot = (): string => useUnifiedSnapshotStore((s) => s.symbol);
export const useActiveTimeframeSnapshot = (): Timeframe => useUnifiedSnapshotStore((s) => s.activeTimeframe);
export const usePriceSnapshot = (): PriceSnapshot => useUnifiedSnapshotStore((s) => s.price);
export const useOrderBookSnapshot = (): OrderBookSnapshot => useUnifiedSnapshotStore((s) => s.orderBook);
export const useDerivativesSnapshot = (): DerivativesSnapshot => useUnifiedSnapshotStore((s) => s.derivatives);
// Parametrizado (symbol/tf) em vez de devolver o mapa inteiro: um
// consumidor que só quer BTC/15m não re-renderiza quando ETH/1h muda.
export const useCandles = (symbol: string, tf: Timeframe): Candle[] | null =>
  useUnifiedSnapshotStore((s) => s.candles[symbol]?.[tf] ?? null);
export const useExchangeOrderBooks = (): Partial<Record<Exchange, L2Snapshot | null>> =>
  useUnifiedSnapshotStore((s) => s.orderBooks);
export const useConnectionsSnapshot = (): Partial<Record<Exchange, ExchangeConnectionState>> =>
  useUnifiedSnapshotStore((s) => s.connections);

// §2 SÉRIES HISTÓRICAS
export const useL2History = (exchange: Exchange): L2HistoryEntry[] =>
  useUnifiedSnapshotStore((s) => s.l2History[exchange] ?? EMPTY_L2_HISTORY);
export const useOrderflowHistory = (): OrderflowHistoryEntry[] =>
  useUnifiedSnapshotStore((s) => s.orderflowHistory ?? EMPTY_ORDERFLOW_HISTORY);

// §3 MOTORES QUANT
export const useVolumeProfileSnapshot = (): VolumeProfileSnapshot | null =>
  useUnifiedSnapshotStore((s) => s.volumeProfile);
export const useFibonacciConfluenceSnapshot = (): FibonacciConfluenceMatrix | null =>
  useUnifiedSnapshotStore((s) => s.fibonacciConfluence);

// §4 CÉREBRO
export const useCouncilSnapshot = (): CouncilDecision | null =>
  useUnifiedSnapshotStore((s) => s.council);
export const useScenarioSnapshot = (): ScenarioProjection | null =>
  useUnifiedSnapshotStore((s) => s.scenario);
export const useTrapSignalsSnapshot = (): TrapSignal[] =>
  useUnifiedSnapshotStore((s) => s.trapSignals ?? EMPTY_TRAPS);
export const useTradePlanSnapshot = (): TradePlan | null =>
  useUnifiedSnapshotStore((s) => s.tradePlan);
export const useMultiTimeframeSnapshot = (): MultiTimeframeMatrix | null =>
  useUnifiedSnapshotStore((s) => s.multiTimeframeContext);
export const useInstitutionalScoreHistory = (): ConvictionScoreSample[] =>
  useUnifiedSnapshotStore((s) => s.institutionalScoreHistory ?? EMPTY_CONVICTION_HISTORY);

// §5 ORGANISMO
export const useCoreSnapshot = (): CoreSnapshot => useUnifiedSnapshotStore((s) => s.core);
export const useHealthSnapshot = (): HealthSnapshot => useUnifiedSnapshotStore((s) => s.health);
export const useOfflineSnapshot = (): boolean => useUnifiedSnapshotStore((s) => s.offline);
export const useDataFreshSnapshot = (): boolean => useUnifiedSnapshotStore((s) => s.isDataFresh);
export const useUiFpsSnapshot = (): number | null => useUnifiedSnapshotStore((s) => s.uiFps);
export const useTrustScoreSnapshot = (): TrustScoreSnapshot | null =>
  useUnifiedSnapshotStore((s) => s.trustScore);
export const useCpiSnapshot = (): number | null => useUnifiedSnapshotStore((s) => s.cpi);
export const useAffectiveMemorySnapshot = (): AffectiveMemoryState =>
  useUnifiedSnapshotStore((s) => s.affectiveMemory);
export const useTrackRecordSnapshot = (): TrackRecordState =>
  useUnifiedSnapshotStore((s) => s.trackRecord);
