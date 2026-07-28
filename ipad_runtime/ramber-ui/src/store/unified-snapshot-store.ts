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
//      volumeProfile (Fase 1.3, WASM) · fibonacciConfluence (Fase 1.4) ·
//      premiumDiscount · harmonicPatterns · layerRelevance · smc/cvd/
//      orderflowSignals (OMEGA CORE V-MAX Fase 1.1)
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
import { touchCandlesSymbol } from "../nexus/candles-cache";
import { pushOrderflowHistory, type OrderflowHistoryEntry } from "../nexus/orderflow-history";
import { pushConvictionHistory, type ConvictionScoreSample, type InstitutionalScoreReading } from "../nexus/institutional-score";
import type { HeatScoreReading } from "../nexus/heat-score";
import type { NexusDecision } from "../nexus/decision-layer";
import type { VolumeProfileSnapshot } from "../nexus/volume-profile";
import type { FibonacciConfluenceMatrix } from "../nexus/fibonacci-confluence";
import type { CouncilDecision } from "../nexus/council";
import type { ConsensusRadarReading } from "../nexus/consensus-radar";
import type { PremiumDiscountReading } from "../nexus/premium-discount";
import type { HarmonicPatternHit } from "../nexus/harmonic-patterns";
import type { LayerRelevanceReading } from "../nexus/layer-relevance";
import type { ConfluenceCorridorReading } from "../nexus/confluence-corridor";
import type { RadarQualificationResult } from "../nexus/radar-qualification";
import type { ScenarioProjection } from "../nexus/scenario-engine";
import type { TrapSignal } from "../nexus/trap-detection";
import type { TradePlan } from "../nexus/trade-plan";
import type { MultiTimeframeMatrix } from "../nexus/multi-timeframe-engine";
import {
  trackPlanTransition,
  trackPriceTick,
  stampOpenContext,
  EMPTY_TRACK_RECORD,
  type TrackRecordState,
  type PlanOpenContext,
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
import type { TrustScoreSnapshot, SmcZonesSnapshot, OrderflowSignal } from "../engine-bridge";

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

// Achado real de auditoria (DIRETRIZES AVANÇADAS, sincronização — bug
// HIGH confirmado): exportado para App.tsx poder repassar este MESMO
// valor honesto de reset ao trocar de ativo, em vez de silenciosamente
// pular a escrita (ver o efeito espelho de `setPrice` em App.tsx).
export const EMPTY_PRICE: PriceSnapshot = {
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
const EMPTY_HARMONIC_HITS: HarmonicPatternHit[] = [];
const EMPTY_ORDERFLOW_SIGNALS: OrderflowSignal[] = [];

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
  // Refinamento Final §7 — Premium/Equilibrium/Discount do dealing range
  // atual (últimos swings fractais confirmados — mesmo findSwings
  // compartilhado). null = sem dois swings opostos confirmados.
  premiumDiscount: PremiumDiscountReading | null;
  // Refinamento Final §8 — padrões harmônicos XABCD detectados (fit >=
  // MIN_FIT_SCORE, D recente). Lista vazia é o estado honesto comum;
  // fitScore é aderência de razão, NUNCA probabilidade (Regra de Ouro 2).
  harmonicPatterns: HarmonicPatternHit[];
  // NÚCLEO GRAVITACIONAL AUTÔNOMO §1/§6 — leitura real do Relevance Engine
  // (nexus/layer-relevance.ts), computada uma vez em ChartWidget (onde os
  // sinais reais que a alimentam já convergem) e lida daqui por QUALQUER
  // outro consumidor (o painel de camadas precisa da mesma leitura, sem
  // recomputar). null = ainda sem nenhum ciclo real processado.
  layerRelevance: LayerRelevanceReading | null;
  // OMEGA CORE V-MAX (Fase 1.1, "matar a segunda verdade") — Fair Value
  // Gaps/Order Blocks/liquidez (fvg-order-block-engine.js via
  // engine-bridge.ts's computeSmcZones) e o Order Flow ao vivo (CVD +
  // sinais OFI/Absorção/Exaustão do MEXC via src/orderflow/signal-engine.js)
  // — os dois já reais e já computados em App.tsx desde antes desta fase;
  // só não tinham fatia própria (ver docs/ORGANISM_DATA_FLOW.md, "Insumos
  // pré-store"). Espelho fiel do MESMO dado real, escrito no MESMO commit
  // de render — zero segunda computação, zero segundo motor. Consumidores
  // existentes (WidgetContext) continuam sem migração forçada (nota no
  // topo do arquivo); esta fatia é o gateway novo para
  // getSnapshotForEngine()/futuros assinantes do bus.
  smc: SmcZonesSnapshot | null;
  // Soma corrida real desde a criação do worker de order flow desta aba —
  // null só até a primeira leitura real (ver signal-engine.js). Nunca
  // resetada de fato na fonte ao trocar de ativo (mesmo comportamento já
  // real do useState espelhado); ver setCvd(null) no efeito de troca.
  cvd: number | null;
  orderflowSignals: OrderflowSignal[];
  // OMEGA CORE V-MAX (Fase 5, Fusion §5 — task já aprovada pelo Operador
  // "Corredor de Confluência"): organizador de contexto real que cruza
  // opinionMass/institutionalScore/MTF/obstáculos já reais — nunca gera
  // LONG/SHORT/WAIT (LEI 24). null enquanto o Core Engine está em WAIT ou
  // nenhum componente real está disponível ainda.
  confluenceCorridor: ConfluenceCorridorReading | null;

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
  // Diretriz Complementar §8 ("Radar de Consenso"): reempacote de 6
  // magnitudes 0..1 reais já votadas/computadas alhures (ver
  // consensus-radar.ts) — zero segunda matemática de consenso. null =
  // ainda sem primeiro ciclo real do Conselho.
  consensusRadar: ConsensusRadarReading | null;
  // Signal Precision order (phase 4) — actionable plan from REAL structure
  // (entry zone / stop / target / R:R). null = honest "no coherent plan"
  // (no directional stance, risk gate locked, or missing real structure).
  tradePlan: TradePlan | null;
  // Fase Ω Priority 1 — Adaptive Multi-Timeframe Intelligence: contexto real
  // independente por prazo (1m/5m/15m/1h/4h/1d), reaproveitando os mesmos
  // motores puros do ciclo principal (LEI 24: confluência/contexto, nunca um
  // segundo motor de decisão). null até o primeiro ciclo real.
  multiTimeframeContext: MultiTimeframeMatrix | null;
  // OMEGA CORE V-MAX Fase 7 (Radar/OIH v1): lista JÁ filtrada e ordenada
  // por qualityIndex real (rankRadarCandidates, radar-qualification.ts) —
  // só ativos que passaram no filtro mínimo real (estrutura confirmada,
  // Trade Plan real, risk gate liberado, confluência-leve suficiente).
  // Nunca uma segunda decisão (LEI 24) — puro achado de contexto já
  // validado em outro lugar. Lista vazia é o estado honesto comum
  // (nenhum candidato qualificado agora), não um erro.
  radarCandidates: RadarQualificationResult[];
  // Diretriz Complementar §18/§4 ("tendência de convicção" / "Conviction
  // Engine"): série real do Score Geral (institutional-score.ts) ao longo
  // do tempo — só amostras REAIS entram (WAIT/DADOS_INSUFICIENTES nunca,
  // pontuar o nada seria fabricação). Escopada ao ativo ativo, mesmo
  // padrão de orderflowHistory.
  institutionalScoreHistory: ConvictionScoreSample[];
  // EPC OMEGA FINAL Parte 1 ("Meta Engine", achado de auditoria): estas 3
  // leituras já existiam como useMemo local em App.tsx — nunca tinham fatia
  // própria no organismo, então recomputavam a cada consumidor e ficavam
  // invisíveis para qualquer assinante futuro do bus (getSnapshotForEngine).
  // Passthrough puro (LEI 24): nenhuma matemática nova, os motores
  // continuam decision-layer.ts/institutional-score.ts/heat-score.ts.
  nexusDecision: NexusDecision | null;
  institutionalScoreReading: InstitutionalScoreReading | null;
  heatScoreReading: HeatScoreReading | null;

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
  // Achado real de auditoria (Diretriz de Evolução Geral do Organismo
  // §6.8, "memória de decisões hoje é uma fatia GLOBAL"): arquivo do
  // agregado (history/targetHits/partialHits/stopHits/replaced) por
  // chave symbol:timeframe (mesma convenção de candleKey em
  // persistence.ts) — trocar de ativo/timeframe não perde mais o
  // desempenho real já medido daquela combinação. O plano ATIVO
  // (`trackRecord.active`) continua resetando sempre — é o
  // rastreamento AO VIVO do que está na tela agora, nunca deve
  // reaparecer stale de uma combinação antiga.
  trackRecordArchive: Record<string, TrackRecordState>;
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
  setPremiumDiscount: (reading: PremiumDiscountReading | null) => void;
  setHarmonicPatterns: (hits: HarmonicPatternHit[]) => void;
  setLayerRelevance: (reading: LayerRelevanceReading | null) => void;
  setSmc: (zones: SmcZonesSnapshot | null) => void;
  setCvd: (cvd: number | null) => void;
  setOrderflowSignals: (signals: OrderflowSignal[]) => void;
  setConfluenceCorridor: (reading: ConfluenceCorridorReading | null) => void;

  // §4 CÉREBRO
  setCouncil: (decision: CouncilDecision | null) => void;
  setScenario: (projection: ScenarioProjection | null) => void;
  setTrapSignals: (traps: TrapSignal[]) => void;
  setConsensusRadar: (reading: ConsensusRadarReading | null) => void;
  setTradePlan: (plan: TradePlan | null) => void;
  setMultiTimeframeContext: (matrix: MultiTimeframeMatrix | null) => void;
  setRadarCandidates: (candidates: RadarQualificationResult[]) => void;
  // Diretriz Complementar §18/§4: registra uma amostra REAL do Score Geral
  // (nunca chamado com null/WAIT — o efeito que chama já filtra isso).
  recordInstitutionalScore: (score: number) => void;
  resetInstitutionalScoreHistory: () => void;
  setNexusDecision: (decision: NexusDecision | null) => void;
  setInstitutionalScoreReading: (reading: InstitutionalScoreReading | null) => void;
  setHeatScoreReading: (reading: HeatScoreReading | null) => void;

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
  // Cockpit de Leitura §11: carimbo único do contexto de abertura no plano
  // ativo (ETA previsto + estados VWAP/NL + score) — stampOpenContext puro,
  // nunca reescreve (memória jamais altera o histórico retroativamente).
  stampPlanOpenContext: (ctx: PlanOpenContext) => void;
  hydrateTrackRecord: (state: TrackRecordState) => void;
  // Substitui o antigo resetTrackRecord (Evolução Profunda §11/§13-J/K,
  // que zerava o agregado inteiro na troca — perdia memória real em vez
  // de só evitar que ela vazasse entre combinações). Fecha o plano ATIVO
  // como REPLACED (reusa trackPlanTransition(state, null, now), nunca
  // uma segunda lógica de fechamento) e arquiva o agregado resultante
  // sob `key` — chamado só no cleanup do efeito de troca de
  // ativo/timeframe (App.tsx), nunca durante o uso normal.
  archiveTrackRecord: (key: string) => void;
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
    premiumDiscount: null,
    harmonicPatterns: [],
    layerRelevance: null,
    smc: null,
    cvd: null,
    orderflowSignals: [],
    confluenceCorridor: null,
    // §4 CÉREBRO
    council: null,
    scenario: null,
    trapSignals: [],
    consensusRadar: null,
    tradePlan: null,
    multiTimeframeContext: null,
    radarCandidates: [],
    institutionalScoreHistory: [],
    nexusDecision: null,
    institutionalScoreReading: null,
    heatScoreReading: null,
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
    trackRecordArchive: {},

    // §1 MERCADO
    setSymbol: (symbol) => set((s) => { s.symbol = symbol; }),
    setActiveTimeframe: (tf) => set((s) => { s.activeTimeframe = tf; }),
    setPrice: (price) => set((s) => { s.price = { ...price, updatedAt: Date.now() }; }),
    setOrderBook: (book) => set((s) => { s.orderBook = { ...book, updatedAt: Date.now() }; }),
    setDerivatives: (derivatives) => set((s) => { s.derivatives = derivatives; }),
    setCandles: (symbol, tf, candles) => set((s) => {
      const bySymbol = s.candles[symbol] ?? {};
      bySymbol[tf] = candles;
      s.candles = touchCandlesSymbol(s.candles as Record<string, typeof bySymbol>, symbol, bySymbol);
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
    setPremiumDiscount: (reading) => set((s) => { s.premiumDiscount = reading; }),
    setHarmonicPatterns: (hits) => set((s) => { s.harmonicPatterns = hits; }),
    setLayerRelevance: (reading) => set((s) => { s.layerRelevance = reading; }),
    setSmc: (zones) => set((s) => { s.smc = zones; }),
    setCvd: (cvd) => set((s) => { s.cvd = cvd; }),
    setOrderflowSignals: (signals) => set((s) => { s.orderflowSignals = signals; }),
    setConfluenceCorridor: (reading) => set((s) => { s.confluenceCorridor = reading; }),
    // §4 CÉREBRO
    setCouncil: (decision) => set((s) => { s.council = decision; }),
    setScenario: (projection) => set((s) => { s.scenario = projection; }),
    setTrapSignals: (traps) => set((s) => { s.trapSignals = traps; }),
    setConsensusRadar: (reading) => set((s) => { s.consensusRadar = reading; }),
    setTradePlan: (plan) => set((s) => { s.tradePlan = plan; }),
    setMultiTimeframeContext: (matrix) => set((s) => { s.multiTimeframeContext = matrix; }),
    setRadarCandidates: (candidates) => set((s) => { s.radarCandidates = candidates; }),
    recordInstitutionalScore: (score) => set((s) => {
      s.institutionalScoreHistory = pushConvictionHistory(s.institutionalScoreHistory as ConvictionScoreSample[], { score, at: Date.now() });
    }),
    resetInstitutionalScoreHistory: () => set((s) => { s.institutionalScoreHistory = []; }),
    setNexusDecision: (decision) => set((s) => { s.nexusDecision = decision; }),
    setInstitutionalScoreReading: (reading) => set((s) => { s.institutionalScoreReading = reading; }),
    setHeatScoreReading: (reading) => set((s) => { s.heatScoreReading = reading; }),
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
    stampPlanOpenContext: (ctx) => set((s) => {
      s.trackRecord = stampOpenContext(s.trackRecord as TrackRecordState, ctx);
    }),
    hydrateTrackRecord: (state) => set((s) => { s.trackRecord = state; }),
    archiveTrackRecord: (key) => set((s) => {
      const closed = trackPlanTransition(s.trackRecord as TrackRecordState, null, Date.now());
      // Escreve nos DOIS lugares: o arquivo (memória durável da chave) e o
      // trackRecord AO VIVO (nunca deixa um plano aberto "stale" pendurado
      // ali se o chamador não emendar um hydrateTrackRecord logo em
      // seguida — a ação fica correta sozinha, não depende de quem chama).
      s.trackRecord = closed;
      s.trackRecordArchive[key] = closed;
    }),
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
export const usePremiumDiscountSnapshot = (): PremiumDiscountReading | null =>
  useUnifiedSnapshotStore((s) => s.premiumDiscount);
export const useHarmonicPatternsSnapshot = (): HarmonicPatternHit[] =>
  useUnifiedSnapshotStore((s) => s.harmonicPatterns ?? EMPTY_HARMONIC_HITS);
export const useLayerRelevanceSnapshot = (): LayerRelevanceReading | null =>
  useUnifiedSnapshotStore((s) => s.layerRelevance);
export const useSmcSnapshot = (): SmcZonesSnapshot | null =>
  useUnifiedSnapshotStore((s) => s.smc);
export const useCvdSnapshot = (): number | null =>
  useUnifiedSnapshotStore((s) => s.cvd);
export const useOrderflowSignalsSnapshot = (): OrderflowSignal[] =>
  useUnifiedSnapshotStore((s) => s.orderflowSignals ?? EMPTY_ORDERFLOW_SIGNALS);
export const useConfluenceCorridorSnapshot = (): ConfluenceCorridorReading | null =>
  useUnifiedSnapshotStore((s) => s.confluenceCorridor);

// §4 CÉREBRO
export const useCouncilSnapshot = (): CouncilDecision | null =>
  useUnifiedSnapshotStore((s) => s.council);
export const useScenarioSnapshot = (): ScenarioProjection | null =>
  useUnifiedSnapshotStore((s) => s.scenario);
export const useTrapSignalsSnapshot = (): TrapSignal[] =>
  useUnifiedSnapshotStore((s) => s.trapSignals ?? EMPTY_TRAPS);
export const useConsensusRadarSnapshot = (): ConsensusRadarReading | null =>
  useUnifiedSnapshotStore((s) => s.consensusRadar);
export const useTradePlanSnapshot = (): TradePlan | null =>
  useUnifiedSnapshotStore((s) => s.tradePlan);
export const useMultiTimeframeSnapshot = (): MultiTimeframeMatrix | null =>
  useUnifiedSnapshotStore((s) => s.multiTimeframeContext);
const EMPTY_RADAR_CANDIDATES: RadarQualificationResult[] = [];
export const useRadarCandidatesSnapshot = (): RadarQualificationResult[] =>
  useUnifiedSnapshotStore((s) => s.radarCandidates ?? EMPTY_RADAR_CANDIDATES);
export const useInstitutionalScoreHistory = (): ConvictionScoreSample[] =>
  useUnifiedSnapshotStore((s) => s.institutionalScoreHistory ?? EMPTY_CONVICTION_HISTORY);
export const useNexusDecisionSnapshot = (): NexusDecision | null =>
  useUnifiedSnapshotStore((s) => s.nexusDecision);
export const useInstitutionalScoreReadingSnapshot = (): InstitutionalScoreReading | null =>
  useUnifiedSnapshotStore((s) => s.institutionalScoreReading);
export const useHeatScoreReadingSnapshot = (): HeatScoreReading | null =>
  useUnifiedSnapshotStore((s) => s.heatScoreReading);

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
export const useTrackRecordArchive = (): Record<string, TrackRecordState> =>
  useUnifiedSnapshotStore((s) => s.trackRecordArchive);
