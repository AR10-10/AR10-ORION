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
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

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

interface UnifiedSnapshotState {
  symbol: string;
  price: PriceSnapshot;
  orderBook: OrderBookSnapshot;
  derivatives: DerivativesSnapshot;
  core: CoreSnapshot;
}

interface UnifiedSnapshotActions {
  setSymbol: (symbol: string) => void;
  setPrice: (price: Omit<PriceSnapshot, "updatedAt">) => void;
  setOrderBook: (book: Omit<OrderBookSnapshot, "updatedAt">) => void;
  setDerivatives: (derivatives: DerivativesSnapshot) => void;
  setCore: (core: CoreSnapshot) => void;
}

export const useUnifiedSnapshotStore = create<UnifiedSnapshotState & UnifiedSnapshotActions>()(
  immer((set) => ({
    symbol: "BTC",
    price: EMPTY_PRICE,
    orderBook: EMPTY_ORDER_BOOK,
    derivatives: EMPTY_DERIVATIVES,
    core: EMPTY_CORE,

    setSymbol: (symbol) => set((s) => { s.symbol = symbol; }),
    setPrice: (price) => set((s) => { s.price = { ...price, updatedAt: Date.now() }; }),
    setOrderBook: (book) => set((s) => { s.orderBook = { ...book, updatedAt: Date.now() }; }),
    setDerivatives: (derivatives) => set((s) => { s.derivatives = derivatives; }),
    setCore: (core) => set((s) => { s.core = core; }),
  })),
);

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
