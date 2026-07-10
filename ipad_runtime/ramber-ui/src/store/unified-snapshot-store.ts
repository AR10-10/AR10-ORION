// unified-snapshot-store.ts — V18 Sprint 1, Tarefa A: Zustand + Immer para o
// UnifiedGlobalSnapshot (Preço, Livro, Funding, Estado do Núcleo/Motor).
//
// Arquitetura ADITIVA por design (diretriz explícita: "não tente reescrever
// o sistema inteiro de uma vez"): App.tsx continua a ÚNICA fonte real de
// coleta (WebSocket de preço/livro, REST de funding/OI, ciclo do motor) —
// nada aqui dispara uma segunda rede. Um efeito de sincronização em App.tsx
// espelha esse mesmo dado real para dentro da store sempre que ele muda.
// Qualquer consumidor NOVO (a partir do EnhancedChart_110_Percent, por
// exemplo) lê daqui via os seletores atômicos abaixo — cada hook só
// re-renderiza quando a FATIA específica que ele pediu muda, não a cada
// tick de qualquer parte do snapshot (o gargalo que este Sprint pediu para
// resolver). Consumidores existentes continuam via WidgetContext sem
// nenhuma migração forçada nesta passada.
//
// "Estado do Núcleo Biológico": este sistema ainda não tem (e não finge
// ter) um núcleo de Reward/Pain com memória afetiva persistida — isso é
// uma peça de engenharia própria, maior, para uma fase futura (V18 §3), não
// algo que se fabrica aqui só para preencher um campo. `core` abaixo é o
// estado REAL mais próximo que já existe hoje: engineStatus/direção/
// confiança do ciclo real do motor (engine-bridge.ts) — nunca um score
// inventado.
//
// V-MAX Fase 0.4 (Blueprint §2.3): esta store É o UnifiedGlobalSnapshot do
// Blueprint — estendida aqui, nunca duplicada numa segunda store paralela.
// Mesma regra aditiva de sempre: `candles`/`orderBooks`/`connections`
// espelham dado que App.tsx já coleta de verdade hoje (Binance real);
// `health` chega vazio-honesto até a Fase 0.8 (Health Monitor) computar
// FPS/memória/workers reais; `offline` já nasce ligado ao navigator.onLine
// real do browser, o único sinal disponível nesta fase.
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

const EMPTY_PRICE: PriceSnapshot = {
  price: null, delta: null, deltaPct: null, high: null, low: null, volume: null, direction: null, updatedAt: null,
};
const EMPTY_ORDER_BOOK: OrderBookSnapshot = { bids: [], asks: [], updatedAt: null };
const EMPTY_DERIVATIVES: DerivativesSnapshot = { fundingRate: null, openInterest: null };
const EMPTY_CORE: CoreSnapshot = {
  engineStatus: "pending", direction: null, confidence: null, lastUpdateAt: null, cycleLatencyMs: null,
};
// V-MAX Fase 0.4 — Health Monitor real só entra na Fase 0.8; até lá este é
// o estado honesto de "ainda não medido" (nunca um FPS/latência inventado
// só para preencher o campo), não um valor de exemplo.
const EMPTY_HEALTH: HealthSnapshot = {
  fps: null, cycleLatencyMs: null, memoryMb: null, workersAlive: 0,
  isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  lastUpdatedAt: 0,
};
// Referência estável (nunca um `[]` novo por chamada) — sem isto, todo
// consumidor de useL2History re-renderizaria a cada render por causa da
// comparação por referência do Zustand, mesmo sem nenhum L2 real novo.
const EMPTY_L2_HISTORY: L2HistoryEntry[] = [];

interface UnifiedSnapshotState {
  symbol: string;
  price: PriceSnapshot;
  orderBook: OrderBookSnapshot;
  derivatives: DerivativesSnapshot;
  core: CoreSnapshot;
  // V-MAX Fase 0.4 — extensão aditiva rumo ao UnifiedGlobalSnapshot do
  // Blueprint (§2.3). `symbol` acima JÁ é o `activeSymbol` do Blueprint —
  // não duplicado sob um segundo nome. `consensus`/`marketRegime`/
  // `scenario`/`cpi`/`trapProbability` do Blueprint ficam de fora nesta
  // fase de propósito: cada um pertence a um motor real que ainda não
  // existe nesta árvore (Quant Worker, Núcleo Biológico, Scenario Engine)
  // — declarar o campo sem o motor por trás seria a mesma dívida de "zero
  // mocks" só que ao nível de estado global.
  activeTimeframe: Timeframe;
  candles: Partial<Record<string, Partial<Record<Timeframe, Candle[]>>>>;
  orderBooks: Partial<Record<Exchange, L2Snapshot | null>>;
  connections: Partial<Record<Exchange, ExchangeConnectionState>>;
  health: HealthSnapshot;
  offline: boolean;
  // V-MAX Fase 0.8 (Health Monitor) — chega aqui, não na 0.4: "freshness"
  // é explicitamente responsabilidade do Health Monitor no Blueprint
  // (§7.2), calculado a partir de price.updatedAt/orderBook.updatedAt
  // reais que já existem desde a 0.4, nunca um segundo relógio próprio.
  isDataFresh: boolean;
  // V-MAX Fase 1.2 (achado real, dedup): App.tsx já mede FPS real via
  // requestAnimationFrame desde antes da Fase 0 ("FPS (UI REAL)") — o
  // Health Monitor espelha esse valor real em vez de medir de novo (mesmo
  // padrão de core.cycleLatencyMs/offline, nunca uma segunda amostragem).
  uiFps: number | null;
  // V-MAX Fase 1.1 — pré-requisito real do OrderFlowHeatmapPlugin: uma
  // SÉRIE de snapshots L2 (não só o mais recente, que `orderBooks` acima
  // já cobre) — sem isto, um heatmap não tem "tempo" nenhum para desenhar.
  l2History: Partial<Record<Exchange, L2HistoryEntry[]>>;
}

interface UnifiedSnapshotActions {
  setSymbol: (symbol: string) => void;
  setPrice: (price: Omit<PriceSnapshot, "updatedAt">) => void;
  setOrderBook: (book: Omit<OrderBookSnapshot, "updatedAt">) => void;
  setDerivatives: (derivatives: DerivativesSnapshot) => void;
  setCore: (core: CoreSnapshot) => void;
  setActiveTimeframe: (tf: Timeframe) => void;
  setCandles: (symbol: string, tf: Timeframe, candles: Candle[]) => void;
  setExchangeOrderBook: (exchange: Exchange, snapshot: L2Snapshot | null) => void;
  setConnectionState: (exchange: Exchange, state: ExchangeConnectionState) => void;
  setHealth: (health: HealthSnapshot) => void;
  setOffline: (offline: boolean) => void;
  setDataFresh: (fresh: boolean) => void;
  setUiFps: (fps: number | null) => void;
  sampleL2History: (exchange: Exchange, entry: L2HistoryEntry) => void;
}

export const useUnifiedSnapshotStore = create<UnifiedSnapshotState & UnifiedSnapshotActions>()(
  immer((set) => ({
    symbol: "BTC",
    price: EMPTY_PRICE,
    orderBook: EMPTY_ORDER_BOOK,
    derivatives: EMPTY_DERIVATIVES,
    core: EMPTY_CORE,
    activeTimeframe: "15m",
    candles: {},
    orderBooks: {},
    connections: {},
    health: EMPTY_HEALTH,
    offline: typeof navigator === "undefined" ? false : !navigator.onLine,
    isDataFresh: false,
    uiFps: null,
    l2History: {},

    setSymbol: (symbol) => set((s) => { s.symbol = symbol; }),
    setPrice: (price) => set((s) => { s.price = { ...price, updatedAt: Date.now() }; }),
    setOrderBook: (book) => set((s) => { s.orderBook = { ...book, updatedAt: Date.now() }; }),
    setDerivatives: (derivatives) => set((s) => { s.derivatives = derivatives; }),
    setCore: (core) => set((s) => { s.core = core; }),
    setActiveTimeframe: (tf) => set((s) => { s.activeTimeframe = tf; }),
    setCandles: (symbol, tf, candles) => set((s) => {
      const bySymbol = s.candles[symbol] ?? {};
      bySymbol[tf] = candles;
      s.candles[symbol] = bySymbol;
    }),
    setExchangeOrderBook: (exchange, snapshot) => set((s) => { s.orderBooks[exchange] = snapshot; }),
    setConnectionState: (exchange, state) => set((s) => { s.connections[exchange] = state; }),
    setHealth: (health) => set((s) => { s.health = health; }),
    setOffline: (offline) => set((s) => { s.offline = offline; }),
    setDataFresh: (fresh) => set((s) => { s.isDataFresh = fresh; }),
    setUiFps: (fps) => set((s) => { s.uiFps = fps; }),
    sampleL2History: (exchange, entry) => set((s) => {
      const ring = (s.l2History[exchange] ?? []) as L2HistoryEntry[];
      s.l2History[exchange] = maybeSampleL2History(ring, entry);
    }),
  })),
);

// V-MAX Fase 0.4 — navigator.onLine é um sinal real do browser (não um
// valor inventado): espelha as transições reais de conectividade para
// dentro da store assim que acontecem, sem esperar por nenhum ciclo de
// rede. Auto-inicializado uma vez por página, mesmo padrão do singleton de
// getNexusCore()/getMarketDataBus() — nunca um listener por componente.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => useUnifiedSnapshotStore.getState().setOffline(false));
  window.addEventListener("offline", () => useUnifiedSnapshotStore.getState().setOffline(true));
}

// Seletores atômicos — useUnifiedSnapshotStore(selector) só re-renderiza o
// componente quando a fatia SELECIONADA muda (Zustand faz a comparação por
// referência), nunca a cada atualização de QUALQUER parte do snapshot. É
// isto que resolve o gargalo descrito no Sprint 1: um componente que só
// quer o preço não deve re-renderizar quando o livro de ofertas atualiza.
export const usePriceSnapshot = (): PriceSnapshot => useUnifiedSnapshotStore((s) => s.price);
export const useOrderBookSnapshot = (): OrderBookSnapshot => useUnifiedSnapshotStore((s) => s.orderBook);
export const useDerivativesSnapshot = (): DerivativesSnapshot => useUnifiedSnapshotStore((s) => s.derivatives);
export const useCoreSnapshot = (): CoreSnapshot => useUnifiedSnapshotStore((s) => s.core);
export const useSymbolSnapshot = (): string => useUnifiedSnapshotStore((s) => s.symbol);

// V-MAX Fase 0.4 — seletores das novas fatias. useCandles é parametrizado
// (symbol/tf) em vez de devolver o mapa inteiro: um consumidor que só
// quer BTC/15m não deve re-renderizar quando ETH/1h muda em outro widget.
export const useActiveTimeframeSnapshot = (): Timeframe => useUnifiedSnapshotStore((s) => s.activeTimeframe);
export const useCandles = (symbol: string, tf: Timeframe): Candle[] | null =>
  useUnifiedSnapshotStore((s) => s.candles[symbol]?.[tf] ?? null);
export const useExchangeOrderBooks = (): Partial<Record<Exchange, L2Snapshot | null>> =>
  useUnifiedSnapshotStore((s) => s.orderBooks);
export const useConnectionsSnapshot = (): Partial<Record<Exchange, ExchangeConnectionState>> =>
  useUnifiedSnapshotStore((s) => s.connections);
export const useHealthSnapshot = (): HealthSnapshot => useUnifiedSnapshotStore((s) => s.health);
export const useOfflineSnapshot = (): boolean => useUnifiedSnapshotStore((s) => s.offline);
export const useDataFreshSnapshot = (): boolean => useUnifiedSnapshotStore((s) => s.isDataFresh);
// V-MAX Fase 1.1 — histórico L2 por exchange, para o OrderFlowHeatmapPlugin.
export const useL2History = (exchange: Exchange): L2HistoryEntry[] =>
  useUnifiedSnapshotStore((s) => s.l2History[exchange] ?? EMPTY_L2_HISTORY);
export const useUiFpsSnapshot = (): number | null => useUnifiedSnapshotStore((s) => s.uiFps);
