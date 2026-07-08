import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import { Rnd } from "react-rnd";
import {
  runRealAnalysisCycle,
  type RealCycleResult,
  startMexcOrderflowFeed,
  type OrderflowSignal,
  type OrderflowConnectorState,
  startRealLiquidationFeed,
  type LiquidationEvent,
  computeSmcZones,
  type PriceZone,
  type LiquidityZone,
  getChartCandles,
} from "./engine-bridge";
// Fase F (V15): Comitê de Validação — linear opinion pool puro
// (src/consensus/). Importado pela CAMADA DE EXIBIÇÃO, não por
// engine-bridge.ts — o comitê consome contexto GMIL, e a LEI 04 proíbe
// GMIL de cruzar para o lado do Core Engine.
import {
  buildEnsembleConsensus,
  opinionFromLabel,
  opinionFromLean,
  opinionFromVote,
} from "../../src/consensus/index.js";
// Fase H (V15): Risk Engine — dimensionamento Risk/ATR com capping de
// Kelly fracionado (src/risk/). Consumidor terminal composto na camada de
// exibição (como o Comitê da Fase F): recebe números já computados pelos
// domínios reais, nunca toca o sinal do Core Engine.
import { buildRiskSuggestion } from "../../src/risk/index.js";
// Fase J (Cap. 17): classificadores puros de saúde do sistema — a UI só
// exibe; medições vêm de APIs reais (rAF, cronômetro do ciclo) e o que a
// plataforma não expõe (memória no Safari, CPU/GPU em qualquer navegador)
// é declarado, nunca fabricado.
import { classifyFps, classifyCycleLatency, memoryUsedMB, wasmVariantLabel } from "../../src/telemetry/index.js";
import { APP_SEAL } from "./version";
// llm-bridge.ts (and the @mlc-ai/web-llm package it imports) is loaded via
// dynamic import() only inside NeuralCoreWidget's activation handler below
// — never a static top-level import here. A static import would pull
// WebLLM's runtime code into the SAME bundle every visitor downloads on
// boot, defeating the entire point of this being opt-in. `import type`
// is erased at compile time (zero runtime/bundle cost either way).
import type { MLCEngineInterface } from "@mlc-ai/web-llm";
// synthetic-reading.ts is a tiny pure rule-based module (no @mlc-ai/web-llm
// dependency) — safe to import statically so a real tactical reading is
// available even before the optional LLM is ever activated.
import { buildSyntheticReading } from "./synthetic-reading";
import type { TacticalContextInput } from "./llm-bridge";
// IRON-VOICE layer (src/voice/) — decoupled: these modules never import
// from App; the App pushes real-state snapshots INTO them. TTS/STT are the
// browser's own speechSynthesis/webkitSpeechRecognition (feature-detected,
// fail-closed), so this static import costs a few KB, no model, no network.
import { voiceEngine } from "./voice/voice-engine";
import { computeAlerts } from "./voice/voice-dispatcher";
import type { TerminalSnapshot } from "./voice/voice-intents";
import { VoiceControlWidget } from "./voice/VoiceControlWidget";
// GMIL (Global Market Intelligence Layer, src/gmil/) — Providers →
// Normalizers → Event Bus → Consensus Engine, decoupled from the Core
// Engine on purpose: no module in engine-bridge.ts imports anything from
// gmil/, and nothing here ever writes into `engine`/`realCycle`. GMIL is
// read here purely as consultive context (LEI 01).
import { useGmilSnapshot } from "./gmil/use-gmil-snapshot";
import { gmilBus } from "./gmil/event-bus";
import { describeProviderHealthChange } from "./gmil/gmil-voice-alerts";
import { computeConsensus, type ConsensusInput } from "./gmil/consensus-engine";
// Overhaul Cross-Market (Missão 2): Smart Omnibox — busca categorizada
// multi-mercado (cripto/meme reais via Binance + taxonomia TradFi
// hardcoded para conexão futura) e o Empty State fail-closed que ela
// exige quando um ativo TradFi é escolhido (diretriz 4).
import { SmartOmnibox } from "./omnibox/SmartOmnibox";
import { TradFiEmptyState } from "./omnibox/TradFiEmptyState";
import { type TradFiAsset } from "./omnibox/tradfi-assets";
// Master Panel handoff (Multi-Source Market Data Fusion, escopo reduzido a
// UMA fonte adicional real por decisão do Operador): Bybit USDT-M Perpétuo
// como segundo dado real e independente, comparado só contra o markPrice
// que a Binance já devolve em fetchDerivatives abaixo — nunca uma segunda
// fonte do Core Engine/Risk Engine (essa trava é da Fase G/Diretriz 2).
import { fetchBybitPerpTicker, compareCrossExchange, type CrossExchangeCheck } from "./cross-exchange/bybit-futures";
// Terceira fonte real (pedido do Operador: "puxa dados públicos de
// qualquer outra corretora"): OKX Perpétuo, mesmo papel e mesma trava
// fail-closed da Bybit acima — ver header de okx-futures.ts.
import { fetchOkxPerpTicker } from "./cross-exchange/okx-futures";
import {
  LayoutDashboard,
  BarChart2,
  Activity,
  Scan,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Wifi,
  Disc,
  X,
  ShieldCheck,
  Power,
  Globe,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Pin,
  PanelLeft,
  PanelRight,
  Zap,
  Newspaper,
  Bell,
} from "lucide-react";

export const WidgetContext = createContext<any>(null);

// ─────────────────────────────────────────────────────────────────────────────
// FAIL_CLOSED display layer.
//
// Constitution: READ_ONLY / FAIL_CLOSED. A null datum is NEVER promoted to a
// fabricated number — it renders the muted "—" / "AGUARDANDO" placeholder. There
// is no mock data, no synthetic trade levels, no inflated confidence, no fake
// open position, no Math.random() anywhere in this file. Signal/entry/target/
// stop come from engine-bridge.ts, which calls the SAME real WASM engine and
// research pipeline ipad_runtime/js/app.js uses (js/worker-client.js +
// js/real-data/analysis-frame.js + js/research/research-engine.js/
// target-tracker.js/trade-setup-matrix.js) — not a second implementation.
// Fase B (Market Data Bus): candles reach both this file (getChartCandles)
// and engine-bridge.ts through src/market-data-bus/ — neither calls
// js/real-data/binance-public.js directly anymore; only the Bus's own
// connector (binance-candle-connector.js) does. Live price/orderbook still
// come from this file's own direct Binance WS (same real public endpoint
// either way) — deliberately out of Fase B's first pass, see engine-bridge.ts.
// ─────────────────────────────────────────────────────────────────────────────
const DASH = "—";
const AWAIT = "AGUARDANDO";

const num = (v: any): v is number => typeof v === "number" && Number.isFinite(v);

// Verified directly against market-structure-engine.js: ESTRUTURA_ALTA/
// ESTRUTURA_BAIXA/ESTRUTURA_LATERAL are the only 3 raw values it ever
// returns. Shared by the primary (15m) and higher-timeframe (1H) structure
// reads (V11.5 §2 multi-timeframe context) so both use one mapping.
const cleanStructureLabel = (raw: string | null | undefined): "ALTA" | "BAIXA" | "LATERAL" | null =>
  raw === "ESTRUTURA_ALTA" ? "ALTA" : raw === "ESTRUTURA_BAIXA" ? "BAIXA" : raw === "ESTRUTURA_LATERAL" ? "LATERAL" : null;

// Confiança do k-NN Lorentziano (0..1 real) como percentual inteiro — chamada
// tanto pelo badge inline do AssistantOrb quanto pelo tacticalInput do
// NeuralCoreWidget, que antes recomputavam a mesma conta a partir do mesmo
// realCycle.lorentzian.confidence (achado da auditoria de Sincronização
// Global). null quando não há leitura Lorentziana válida nesta sessão.
const lorentzianConfidencePct = (lorentzian: { ok: boolean; confidence?: number | null } | null | undefined): number | null =>
  lorentzian?.ok ? Math.round((lorentzian.confidence ?? 0) * 100) : null;

// Institutional quick-list (V11 §5) — os 5 favoritos de atalho na barra;
// deixaram de ser o universo INTEIRO de escolha com o Smart Omnibox
// (Overhaul Cross-Market, Missão 2), que lista qualquer ticker USDT real
// da Binance (cripto/meme) e a taxonomia TradFi hardcoded. Trocar de
// ativo continua re-apontando cada feed real (klines, derivativos, WS
// ticker/depth, order flow, ciclo do motor) para o novo símbolo;
// engine-bridge.ts's runRealAnalysisCycle/startMexcOrderflowFeed já
// aceitam qualquer símbolo (string), então isto reusa o mesmo caminho —
// nunca um segundo código.
const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP"] as const;
type AssetSymbol = string;

const fmt = (v: number | null | undefined, d = 2) =>
  num(v)
    ? v.toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : DASH;

const fmtInt = (v: number | null | undefined) =>
  num(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : DASH;

const fmtSignedPct = (v: number | null | undefined, d = 2) =>
  num(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(d)}%` : DASH;

type Direction = "LONG" | "SHORT" | null;

interface PriceState {
  price: number | null;
  delta: number | null;
  deltaPct: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  direction: Direction;
}

interface DerivativesState {
  fundingRate: number | null; // real, Binance futures premiumIndex
  openInterest: number | null; // real, Binance futures openInterest (BTC)
}

interface Level {
  price: number;
  size: number;
}

export default function App() {
  const [priceData, setPriceData] = useState<PriceState | null>(null);
  // Master Panel handoff: cross-check real Binance-vs-Bybit — puramente
  // informativo (nunca gate o Core Engine), atualizado na mesma cadência de
  // fetchDerivatives abaixo. INDISPONIVEL até o primeiro ciclo real.
  const [crossExchangeCheck, setCrossExchangeCheck] = useState<CrossExchangeCheck>({
    ok: false,
    priceDeltaPct: null,
    consensus: "INDISPONIVEL",
  });
  // Mesmo papel do crossExchangeCheck acima, para a OKX (terceira fonte).
  const [okxCrossExchangeCheck, setOkxCrossExchangeCheck] = useState<CrossExchangeCheck>({
    ok: false,
    priceDeltaPct: null,
    consensus: "INDISPONIVEL",
  });
  const [derivatives, setDerivatives] = useState<DerivativesState>({
    fundingRate: null,
    openInterest: null,
  });
  const [chartData, setChartData] = useState<
    { open: number; high: number; low: number; close: number }[]
  >([]);
  const [orderBook, setOrderBook] = useState<{ bids: Level[]; asks: Level[] }>({
    bids: [],
    asks: [],
  });
  // V11.1 LEI 22 (Temporal Synchronization): timestamp real de quando cada
  // fonte foi vista pela última vez, para telemetria honesta de idade — não
  // um clock único forçado sobre tudo (WS tica a cada ~1s, o ciclo do motor
  // a cada 30s; cada fonte tem sua própria cadência real e não faz sentido
  // fingir que todas compartilham um relógio, só reportar a idade de cada
  // uma com honestidade).
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<number | null>(null);
  const [orderBookUpdatedAt, setOrderBookUpdatedAt] = useState<number | null>(null);
  const [scannerData, setScannerData] = useState<any[]>([]);
  const [bootAt] = useState(() => Date.now());
  const [wsLive, setWsLive] = useState(false);
  const [activeTab, setActiveTab] = useState("DASHBOARD");
  // V16 Workspace Manager panel (Pinned/Docked/Collapsed/Hidden/Floating
  // per secondary module) — opened from the SideBar's footer button.
  const [workspaceManagerOpen, setWorkspaceManagerOpen] = useState(false);
  // V16.1 correção crítica (Protocolo TradingView e Gavetas Ocultas):
  // Market Intelligence (esquerda) / Core Intelligence (direita) são
  // gavetas fechadas por padrão — o Gráfico reina sozinho no boot.
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  // The currently analyzed asset. Included in the SAME effect dependency
  // arrays as bootGeneration below — switching it tears down and re-opens
  // the market-data WS/REST, engine cycle, and order-flow feed exactly like
  // a manual "REINICIAR SISTEMA" does, just scoped to the new symbol
  // instead of the same one.
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>("BTC");

  // Overhaul Cross-Market (Missão 2): o Smart Omnibox também lista a
  // taxonomia TradFi (índices/ações/commodities/forex) para conexão
  // FUTURA — hoje NENHUMA API macro existe neste sistema. Escolher um
  // ativo TradFi NUNCA muda `selectedAsset` (o motor real continua
  // rodando sobre a última cripto real, intocado) — só liga o modo
  // TRADFI, que faz os painéis específicos de ativo mostrarem o Empty
  // State fail-closed em vez de tentar (e falhar) puxar dado da Binance
  // para um símbolo que não é dela (diretriz 4, Modo Fail-Closed).
  const [marketMode, setMarketMode] = useState<"CRYPTO" | "TRADFI">("CRYPTO");
  const [selectedTradFiAsset, setSelectedTradFiAsset] = useState<TradFiAsset | null>(null);

  // Bumping bootGeneration tears down and re-runs every real boot effect
  // below (REST fetch + WS connect, engine cycle, order flow feed,
  // liquidation feed) — a manual "force refresh everything" trigger, not
  // a gate the initial load waits behind (all of those effects already
  // run automatically on mount regardless of this value).
  const [bootGeneration, setBootGeneration] = useState(0);
  // True only after the FIRST attempt AND its retries all fail — never set
  // by the recurring 60s interval calls, which keep their own existing
  // fail-closed behavior (silently try again next tick).
  const [bootRestFailed, setBootRestFailed] = useState(false);
  const handleManualRestart = useCallback(() => {
    setBootRestFailed(false);
    setBootGeneration((g) => g + 1);
  }, []);

  // Real engine cycle (WASM + research pipeline via engine-bridge.ts).
  // 'pending' until the first cycle resolves — the UI must never show a
  // signal/level before the real engine has actually produced one.
  const [realCycle, setRealCycle] = useState<RealCycleResult | null>(null);
  const [engineStatus, setEngineStatus] = useState<"pending" | "ok" | "error">("pending");

  // Real Order Flow Engine (OFI/Absorption/Exhaustion) fed by real MEXC trades
  // (engine-bridge.ts's startMexcOrderflowFeed). "pending" until the first
  // poll cycle reports a state, matching the FAIL_CLOSED rule used everywhere
  // else in this file.
  const [orderflowSignals, setOrderflowSignals] = useState<OrderflowSignal[]>([]);
  const [orderflowState, setOrderflowState] = useState<OrderflowConnectorState | "pending">("pending");
  const [orderflowReason, setOrderflowReason] = useState<string | null>(null);
  // Real Cumulative Volume Delta — running sum of signed real MEXC trade
  // volume since this tab opened (see signal-engine.js). Null until the
  // first real tick batch is ingested.
  const [cvd, setCvd] = useState<number | null>(null);

  // Real institutional liquidation feed (Binance USDT-M Futures, public —
  // engine-bridge.ts's startRealLiquidationFeed). Capped to the most
  // recent 30 — a real feed of forced-liquidation events, not a polling
  // snapshot, so it can only ever grow via real exchange events.
  const [liquidations, setLiquidations] = useState<LiquidationEvent[]>([]);
  const [liquidationState, setLiquidationState] = useState<"LIVE" | "ERROR" | "pending">("pending");

  // Widget Workspace Manager state (V16): 5 conceptual states — Pinned,
  // Docked, Collapsed, Hidden, Floating — built from 4 orthogonal booleans
  // rather than a single enum, so the existing generic toggleWidget(id, prop)
  // mechanism (and every existing widgets[id].visible/.floating read site)
  // keeps working unmodified:
  //   hidden    = !visible
  //   floating  = visible && floating
  //   collapsed = visible && !floating && collapsed
  //   pinned    = visible && !floating && !collapsed && pinned
  //   docked    = visible && !floating && !collapsed && !pinned
  // V16 Institutional Command Center defaults: Chart (center), Market
  // Direction + Siriform Core summary (left), GMIL/Market Regime/Decision
  // Validation (Consensus+Risk+Data Quality)/System Health (right) are
  // ALWAYS docked — never gear-gated, per the operator's explicit reference
  // layout. Everything else (order book/flow/liquidity heatmap/scanner/
  // exposure/events/neural core/asset heatmap/tactical liquidations) is a
  // secondary tool: defaults to hidden, reachable on demand via the
  // Workspace Manager panel. Persisted to localStorage so a reload never
  // silently drops the dashboard back to a near-empty screen.
  const WIDGET_PREFS_KEY = "ramber_widget_prefs_v2";
  const DEFAULT_WIDGETS: { [key: string]: { visible: boolean; floating: boolean; collapsed: boolean; pinned: boolean } } = {
    chart: { visible: true, floating: false, collapsed: false, pinned: true },
    orderflow: { visible: false, floating: false, collapsed: false, pinned: false },
    heatmap: { visible: false, floating: false, collapsed: false, pinned: false },
    market_direction: { visible: true, floating: false, collapsed: false, pinned: false },
    // Collapsed by default — the compact SiriformCoreCard (right column)
    // always shows the real summary; expanding reveals the full,
    // unmodified AssistantOrb detail (forecast/voice/quick actions) below
    // the 3-column row, never removed, just progressively disclosed.
    se_core: { visible: true, floating: false, collapsed: true, pinned: false },
    orderbook: { visible: false, floating: false, collapsed: false, pinned: false },
    scanner: { visible: false, floating: false, collapsed: false, pinned: false },
    exposure: { visible: false, floating: false, collapsed: false, pinned: false },
    gmil_context: { visible: true, floating: false, collapsed: false, pinned: false },
    events: { visible: false, floating: false, collapsed: false, pinned: false },
    neural_core: { visible: false, floating: false, collapsed: false, pinned: false },
    tactical: { visible: false, floating: false, collapsed: false, pinned: false },
    market_regime: { visible: true, floating: false, collapsed: false, pinned: false },
    system_health: { visible: true, floating: false, collapsed: false, pinned: false },
    asset_heatmap: { visible: false, floating: false, collapsed: false, pinned: false },
    decision_validation: { visible: true, floating: false, collapsed: false, pinned: false },
  };
  const [widgets, setWidgets] = useState<{
    [key: string]: { visible: boolean; floating: boolean; collapsed: boolean; pinned: boolean };
  }>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_PREFS_KEY);
      if (!saved) return DEFAULT_WIDGETS;
      const parsed = JSON.parse(saved);
      // Merge per known key only — saved prefs from an older build must not
      // resurrect widgets that no longer exist (ConfigPanel renders straight
      // from these keys, so a stale entry would show a dead toggle).
      const merged = { ...DEFAULT_WIDGETS };
      for (const key of Object.keys(merged)) {
        if (parsed && typeof parsed[key]?.visible === "boolean") {
          merged[key] = { ...merged[key], ...parsed[key] };
        }
      }
      return merged;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(widgets));
    } catch {
      // Best-effort only — private browsing / quota errors never block the UI.
    }
  }, [widgets]);

  // Stable identity across renders (functional setState form needs no deps) —
  // required so the memoized context value below doesn't churn on every tick.
  const toggleWidget = useCallback((id: string, prop: "visible" | "floating" | "collapsed" | "pinned") => {
    setWidgets((prev) => ({
      ...prev,
      [id]: { ...prev[id], [prop]: !prev[id][prop] },
    }));
  }, []);

  // V16 Workspace Manager: jumps a module directly to one of the 5 named
  // states in one shot — the generic single-boolean toggleWidget above
  // can't express "go straight to Floating from Hidden" (that needs BOTH
  // visible AND floating flipped together), so the panel needs its own
  // explicit setter instead of composing multiple toggleWidget calls.
  const setWidgetWorkspaceState = useCallback(
    (id: string, state: "hidden" | "docked" | "collapsed" | "pinned" | "floating") => {
      setWidgets((prev) => {
        const flags =
          state === "hidden"
            ? { visible: false, floating: false, collapsed: false, pinned: false }
            : state === "docked"
              ? { visible: true, floating: false, collapsed: false, pinned: false }
              : state === "collapsed"
                ? { visible: true, floating: false, collapsed: true, pinned: false }
                : state === "pinned"
                  ? { visible: true, floating: false, collapsed: false, pinned: true }
                  : { visible: true, floating: true, collapsed: false, pinned: false };
        return { ...prev, [id]: { ...prev[id], ...flags } };
      });
    },
    [],
  );

  // Klines: candles do gráfico agora vêm do Market Data Bus (Fase B —
  // getChartCandles em engine-bridge.ts), a MESMA chave symbol:15m que o
  // ciclo de análise (runCycle, abaixo) já pede. Nenhum fetch() direto a
  // api.binance.com/klines é feito por este componente desde a Fase B —
  // antes disso havia dois fetches independentes do mesmo candle real a
  // cada ~30s (achado da Fase A).
  //
  // 24h scanner ticker: ainda um fetch() direto — fora do escopo desta
  // primeira fase do Market Data Bus (não é candle; ver relatório da Fase
  // B). Retorna success/failure so the boot sequence below can retry a
  // transient failure quickly instead of silently waiting for the next 60s
  // tick.
  const fetchSymbolData = async (): Promise<boolean> => {
    try {
      const candles = await getChartCandles(selectedAsset, 50);
      if (!candles) throw new Error('market_data_bus_sem_candles_validos');
      setChartData(candles);

      const tickerRes = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT"]`,
      );
      if (!tickerRes.ok) throw new Error(`ticker HTTP ${tickerRes.status}`);
      const tickerData = await tickerRes.json();
      if (Array.isArray(tickerData)) {
        setScannerData(
          tickerData.map((t) => {
            const change = Number(t.priceChangePercent);
            return {
              p: t.symbol.replace("USDT", "/USDT"),
              s: change > 1 ? "LONG" : change < -1 ? "SHORT" : "NEUTRAL",
              str: Math.min(Math.abs(change) * 20, 100),
              chg: change, // real 24h % — replaces the old Math.random() timestamp
            };
          }),
        );
      }
      return true;
    } catch {
      // FAIL_CLOSED: leave last known real data; never substitute fabricated values.
      return false;
    }
  };

  // REST: real Binance futures funding rate + open interest (public, read-only).
  const fetchDerivatives = async (): Promise<boolean> => {
    let binanceOk = false;
    let binanceMarkPrice: number | null = null;
    try {
      const [fundingRes, oiRes] = await Promise.all([
        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${selectedAsset}USDT`),
        fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${selectedAsset}USDT`),
      ]);
      if (!fundingRes.ok || !oiRes.ok) throw new Error(`derivatives HTTP ${fundingRes.status}/${oiRes.status}`);
      const funding = await fundingRes.json();
      const oi = await oiRes.json();
      binanceMarkPrice = num(Number(funding?.markPrice)) ? Number(funding.markPrice) : null;
      setDerivatives({
        fundingRate: num(Number(funding?.lastFundingRate))
          ? Number(funding.lastFundingRate)
          : null,
        openInterest: num(Number(oi?.openInterest))
          ? Number(oi.openInterest)
          : null,
      });
      binanceOk = true;
    } catch {
      setDerivatives({ fundingRate: null, openInterest: null });
    }

    // Master Panel handoff: cross-check Bybit + OKX — independente do
    // try/catch acima por design, buscados em paralelo (Zero Latência: uma
    // fonte lenta não atrasa a outra). fetchBybitPerpTicker()/
    // fetchOkxPerpTicker() já são fail-closed internamente (nunca lançam),
    // então uma falha em qualquer uma nunca reverte nem atrasa o resultado
    // real da Binance já processado logo acima.
    const [bybit, okx] = await Promise.all([
      fetchBybitPerpTicker(selectedAsset),
      fetchOkxPerpTicker(selectedAsset),
    ]);
    setCrossExchangeCheck(compareCrossExchange(binanceMarkPrice, bybit));
    setOkxCrossExchangeCheck(compareCrossExchange(binanceMarkPrice, okx));

    return binanceOk;
  };

  // Bounded retry for the ONE-SHOT boot calls above (2s/4s/8s backoff) — the
  // recurring setInterval calls deliberately keep their existing
  // fail-closed "wait for next tick" behavior; this is only for the
  // first attempt, so a transient hiccup on page load doesn't leave the
  // user staring at AGUARDANDO for up to 60s with no visible retry.
  const retryBoot = async (
    fn: () => Promise<boolean>,
    isCancelled: () => boolean,
    attempts = 3,
  ): Promise<boolean> => {
    for (let i = 0; i < attempts; i++) {
      if (isCancelled()) return true; // unmounted/restarted mid-retry — not a failure
      if (await fn()) return true;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, i)));
      }
    }
    return false;
  };

  // Switching the selected asset must clear every display value scoped to
  // the PREVIOUS asset before the new one's feeds connect — otherwise the
  // old asset's price/candles/order book/signal/confidence would sit on
  // screen for a moment mislabeled as the new asset's. Deliberately its own
  // effect, scoped only to [selectedAsset] (not bootGeneration) — a manual
  // "REINICIAR SISTEMA" on the SAME asset should keep showing last-known-
  // good data while it reconnects, per existing fail-closed behavior; only
  // an actual asset change should blank the screen back to AGUARDANDO.
  useEffect(() => {
    setPriceData(null);
    setChartData([]);
    setOrderBook({ bids: [], asks: [] });
    setOrderflowSignals([]);
    setCvd(0);
    setRealCycle(null);
    setEngineStatus("pending");
    setPriceUpdatedAt(null);
    setOrderBookUpdatedAt(null);
  }, [selectedAsset]);

  useEffect(() => {
    let unmounted = false;
    (async () => {
      const [restOk, derivOk] = await Promise.all([
        retryBoot(fetchSymbolData, () => unmounted),
        retryBoot(fetchDerivatives, () => unmounted),
      ]);
      if (!unmounted) setBootRestFailed(!restOk && !derivOk);
    })();
    // Klines a 30s: mantém o último candle do gráfico em sincronia com o
    // ciclo do motor (mesma cadência). Derivativos (funding/OI) mudam devagar
    // — 60s continua correto para eles.
    const restInterval = setInterval(fetchSymbolData, 30000);
    const derivInterval = setInterval(fetchDerivatives, 60000);

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelayMs = 1000;

    // depth10@100ms can fire up to 10x/s — coalesce into a trailing update
    // capped at ~5/s so the order-book-derived UI (heatmap, flow pressure,
    // market direction) doesn't re-render faster than a mobile Safari
    // browser can usefully paint.
    const ORDER_BOOK_THROTTLE_MS = 200;
    let pendingOrderBook: { bids: Level[]; asks: Level[] } | null = null;
    let orderBookFlushTimer: ReturnType<typeof setTimeout> | null = null;
    const flushOrderBook = () => {
      orderBookFlushTimer = null;
      if (pendingOrderBook) {
        setOrderBook(pendingOrderBook);
        setOrderBookUpdatedAt(Date.now());
      }
    };

    // Only the selected asset gets the millisecond-fresh WS ticker+depth
    // feed — that's the one thing that actually needs sub-second latency
    // (live price, order book). The other 4 assets' scanner summaries come
    // from the 30s REST ticker refresh above, which is plenty fresh for an
    // overview strip and avoids hardcoding a fixed subset of "the other
    // assets" into the WS multiplex (the previous version only special-
    // cased ETH/SOL, silently leaving BNB/XRP scanner rows WS-stale between
    // REST ticks even though they were displayed as if live).
    const wsSymbol = selectedAsset.toLowerCase();
    const tickerStream = `${wsSymbol}usdt@ticker`;
    const depthStream = `${wsSymbol}usdt@depth10@100ms`;

    const connect = () => {
      if (unmounted) return;
      ws = new WebSocket(
        `wss://stream.binance.com:9443/stream?streams=${tickerStream}/${depthStream}`,
      );
      ws.onopen = () => {
        setWsLive(true);
        reconnectDelayMs = 1000;
      };
      ws.onclose = () => {
        setWsLive(false);
        if (unmounted) return;
        reconnectTimer = setTimeout(connect, reconnectDelayMs);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15000);
      };
      ws.onerror = () => ws?.close();

      ws.onmessage = (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return; // malformed frame — drop it, keep the connection alive
        }
        if (msg.stream === tickerStream) {
          const d = msg.data;
          const currentPrice = Number(d.c);
          const open = Number(d.o);
          const delta = currentPrice - open;
          setPriceData({
            price: currentPrice,
            delta,
            deltaPct: Number(d.P),
            high: Number(d.h),
            low: Number(d.l),
            volume: Number(d.v),
            direction: delta >= 0 ? "LONG" : "SHORT",
          });
          setPriceUpdatedAt(Date.now());
        } else if (msg.stream === depthStream) {
          const d = msg.data;
          if (d.bids && d.asks) {
            pendingOrderBook = {
              bids: d.bids
                .slice(0, 8)
                .map((b: string[]) => ({ price: Number(b[0]), size: Number(b[1]) })),
              asks: d.asks
                .slice(0, 8)
                .map((a: string[]) => ({ price: Number(a[0]), size: Number(a[1]) }))
                .reverse(),
            };
            if (!orderBookFlushTimer) {
              orderBookFlushTimer = setTimeout(flushOrderBook, ORDER_BOOK_THROTTLE_MS);
            }
          }
        }
      };
    };
    connect();

    return () => {
      unmounted = true;
      clearInterval(restInterval);
      clearInterval(derivInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (orderBookFlushTimer) clearTimeout(orderBookFlushTimer);
      ws?.close();
    };
  }, [bootGeneration, selectedAsset]);

  // Real engine cycle — WASM Quant Engine + research pipeline (engine-bridge.ts).
  // 30s cadence: the 15m candle's close evolves continuously, and the target
  // tracker prices its entry/move% off the ticker fetched AT cycle time — a
  // 60s cycle left those numbers up to a minute behind the live WS price in
  // the top bar. 30s halves that worst-case skew for ~4 extra REST weight/min
  // (Binance budget is 1200/min); the k-NN + pipeline cost per cycle is
  // milliseconds. The initial call gets the same bounded retry as the REST
  // fetches above; the recurring interval keeps calling the plain version.
  // Real timestamp of the last successful engine cycle — the "ÚLTIMA
  // ATUALIZAÇÃO" field DCI's Essential Strip requires. Only stamped on a
  // real ok:true resolution, never on a failed/retried attempt.
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  // Fase J (Cap. 17): latência REAL do último ciclo do motor — cronometrada
  // em volta do await, nunca estimada. Só de ciclos ok (falha de rede não é
  // "latência do motor", é falha — e já aparece como engineStatus error).
  const [cycleLatencyMs, setCycleLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const runCycle = async (): Promise<boolean> => {
      const startedAt = Date.now();
      const result = await runRealAnalysisCycle(selectedAsset);
      if (cancelled) return true;
      setRealCycle(result);
      setEngineStatus(result.ok ? "ok" : "error");
      if (result.ok) {
        setLastUpdateAt(Date.now());
        setCycleLatencyMs(Date.now() - startedAt);
      }
      return result.ok;
    };
    retryBoot(runCycle, () => cancelled);
    const engineInterval = setInterval(runCycle, 30000);
    return () => {
      cancelled = true;
      clearInterval(engineInterval);
    };
  }, [bootGeneration, selectedAsset]);

  // Fase J (Cap. 17): FPS REAL da UI via requestAnimationFrame — contagem
  // de frames por janela de 1s. É a medição verdadeira do que o Safari
  // está pintando, não uma constante otimista. O loop é 1 rAF vivo por
  // sessão (custo desprezível) e respeita unmount.
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    let frames = 0;
    let windowStart = performance.now();
    let rafId = 0;
    let alive = true;
    const tick = (now: number) => {
      if (!alive) return;
      frames += 1;
      if (now - windowStart >= 1000) {
        setFps(Math.round((frames * 1000) / (now - windowStart)));
        frames = 0;
        windowStart = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Real MEXC trade poller -> real Order Flow Engine (engine-bridge.ts).
  // Signal list is capped to the most recent 20 — OFI/Absorption/Exhaustion
  // are meant to be rare, not a firehose.
  useEffect(() => {
    const stop = startMexcOrderflowFeed(
      (newSignals) => {
        setOrderflowSignals((prev) => [...newSignals, ...prev].slice(0, 20));
      },
      (state, reason) => {
        setOrderflowState(state);
        setOrderflowReason(reason ?? null);
      },
      (value) => setCvd(value),
      selectedAsset,
    );
    return stop;
  }, [bootGeneration, selectedAsset]);

  // Real institutional liquidation feed (Binance USDT-M Futures, public,
  // no key — engine-bridge.ts's startRealLiquidationFeed). Exchange-wide,
  // not BTC-only — large forced liquidations anywhere are the real signal
  // this widget shows.
  useEffect(() => {
    const stop = startRealLiquidationFeed(
      (event) => {
        setLiquidations((prev) => [event, ...prev].slice(0, 30));
      },
      (state) => setLiquidationState(state),
    );
    return stop;
  }, [bootGeneration]);

  // ───────────────────────────────────────────────────────────────────────────
  // Quantitative engine.
  //   • Flow pressure = real order-book imbalance (local, from the live WS book).
  //   • Signal/entry/target/stop/confidence/support/resistance/market structure
  //     come SOLELY from realCycle (engine-bridge.ts -> the real engine +
  //     research pipeline) — never a SECOND local heuristic computed here.
  //     (Auditoria Mestra 360°, sec. 3: the signal itself is a real SMA/EMA
  //     trend-bias heuristic in research-engine.js, not WASM output — WASM
  //     only computes SMA/EMA/stddev/zscore upstream in analysis-frame.js.)
  //     Null (-> AGUARDANDO) until the real engine's first cycle succeeds.
  //   • No position, no PnL, no leverage, no win-rate. None of those have a real
  //     read-only source, so they do not exist here.
  // ───────────────────────────────────────────────────────────────────────────
  const engine = React.useMemo(() => {
    const buyVolume = orderBook.bids.reduce((a, v) => a + v.size, 0);
    const sellVolume = orderBook.asks.reduce((a, v) => a + v.size, 0);
    const totalVolume = buyVolume + sellVolume;
    const hasBook = totalVolume > 0;

    // Real signed imbalance in [-1, 1]; null when there is no book yet.
    const imbalance = hasBook ? (buyVolume - sellVolume) / totalVolume : null;
    // Real flow-pressure magnitude as a percentage (0..100), honest — not clamped.
    const flowPressure = imbalance === null ? null : Math.abs(imbalance) * 100;
    // Buy/sell share of resting liquidity (real), null when no book.
    const buyPercent = hasBook ? (buyVolume / totalVolume) * 100 : null;
    const sellPercent = hasBook ? (sellVolume / totalVolume) * 100 : null;

    const price = priceData?.price ?? null;
    const delta = priceData?.delta ?? null;
    const deltaPct = priceData?.deltaPct ?? null;

    const cycleOk = realCycle?.ok === true;
    const direction: Direction =
      cycleOk && (realCycle?.signal === "LONG" || realCycle?.signal === "SHORT")
        ? realCycle.signal
        : null;
    const isLong = direction === "LONG";

    const entry = cycleOk ? (realCycle?.entry ?? null) : null;
    const target = cycleOk ? (realCycle?.target1 ?? null) : null;
    const target2 = cycleOk ? (realCycle?.target2 ?? null) : null;
    const stop = cycleOk ? (realCycle?.stop ?? null) : null;
    // V11.5 Fase 6: razão real distância-ao-alvo/distância-à-invalidação
    // (target-tracker.js) e força por confluência de swings do Alvo 2
    // (support-resistance-engine.js) — repassados, nunca recomputados aqui.
    const riskRewardRatio = cycleOk ? (realCycle?.riskRewardRatio ?? null) : null;
    // Protocolo Mestre (Sincronização Global): target1Strength existe desde
    // que o Alvo 1 passou a vir do swing fractal mais próximo (ver
    // analysis-frame.js) — antes só o Alvo 2 tinha essa força reportada.
    const target1Strength = cycleOk ? (realCycle?.target1Strength ?? null) : null;
    const target2Strength = cycleOk ? (realCycle?.target2Strength ?? null) : null;
    const confidence = cycleOk ? (realCycle?.confidence ?? null) : null;
    const marketStructure = cycleOk ? (realCycle?.marketStructure ?? null) : null;
    // Clean label for marketStructure's raw internal string, computed once
    // here instead of re-derived by every consumer (AssistantOrb's
    // ESTRUTURA row, MarketRegimeWidget's TENDÊNCIA row). Values verified
    // directly against src/research/engines/market-structure-engine.js —
    // ESTRUTURA_ALTA/ESTRUTURA_BAIXA/ESTRUTURA_LATERAL are the only 3 it
    // ever returns.
    const marketStructureLabel = cleanStructureLabel(marketStructure);

    // V11.5 §2 (contexto multitemporal): estrutura real do timeframe maior
    // (1H), mesma engine graduada, cacheada em engine-bridge.ts. Confluência
    // é só uma comparação honesta dos dois rótulos reais — nunca um sinal
    // novo, nunca escrita de volta no Core Engine.
    const htfMarketStructureLabel = cycleOk ? cleanStructureLabel(realCycle?.htfMarketStructure) : null;
    const htfTimeframe = cycleOk ? (realCycle?.htfTimeframe ?? null) : null;
    // Protocolo Mestre (achado de auditoria): idade real do cache HTF —
    // fetchedAt já existia em engine-bridge.ts mas nunca saía dele, então a
    // UI não tinha como saber se a estrutura de 1H era de agora ou de
    // ~5min atrás (HTF_REFRESH_MS). Mesma telemetria honesta de preço/
    // livro/ciclo (LEI 22), agora completa para a 4ª fonte real.
    const htfUpdatedAt = cycleOk ? (realCycle?.htfUpdatedAt ?? null) : null;
    const timeframeConfluence: "CONFLUENTE" | "DIVERGENTE" | null =
      marketStructureLabel && htfMarketStructureLabel && marketStructureLabel !== "LATERAL" && htfMarketStructureLabel !== "LATERAL"
        ? marketStructureLabel === htfMarketStructureLabel
          ? "CONFLUENTE"
          : "DIVERGENTE"
        : null;

    const support = cycleOk ? (realCycle?.support ?? null) : null;
    const resistance = cycleOk ? (realCycle?.resistance ?? null) : null;
    // V16 §3: força real por confluência de swings (mesmo computeLevelStrength
    // de target1Strength/target2Strength) — passthrough puro de realCycle.
    const supportStrength = cycleOk ? (realCycle?.supportStrength ?? null) : null;
    const resistanceStrength = cycleOk ? (realCycle?.resistanceStrength ?? null) : null;

    // V16 §3 (Chart Engine institucional — "Rejected"/"Breakouts" por nível):
    // nenhum motor existente conta rompimentos reais de um nível, então isto
    // é um cálculo NOVO — mas puramente honesto: conta closes REAIS da MESMA
    // janela de candles (chartData) que o support-resistance-engine já
    // analisou, além (rompeu) ou aquém (não rompeu) do nível. "Rejeitados" =
    // toques reais (supportStrength/resistanceStrength.touches) menos
    // rompimentos reais — nunca um número inventado, nunca uma probabilidade.
    const countBreakouts = (level: number | null, kind: "support" | "resistance"): number =>
      num(level) && chartData && chartData.length > 0
        ? chartData.reduce(
            (n: number, c: any) => n + ((kind === "resistance" ? c.close > level : c.close < level) ? 1 : 0),
            0,
          )
        : 0;
    const resistanceBreakouts = resistanceStrength ? countBreakouts(resistance, "resistance") : 0;
    const supportBreakouts = supportStrength ? countBreakouts(support, "support") : 0;

    // Real % move from entry to the real target (not a profit promise).
    const moveToTargetPct =
      entry !== null && target !== null && entry !== 0
        ? Math.abs(((target - entry) / entry) * 100)
        : null;

    // Real, honest volatility proxy (Market Regime panel, V11 §13): mean
    // (high-low)/close across the fetched candle window, as a percentage —
    // the same idea as ATR%, computed from the exact same real klines the
    // chart draws, not a separate/invented source.
    const volatilityPct =
      chartData && chartData.length > 0
        ? (chartData.reduce((sum: number, c: any) => sum + (c.close > 0 ? (c.high - c.low) / c.close : 0), 0) /
            chartData.length) *
          100
        : null;

    // Real, already-computed Order Flow Imbalance from the actual Signal
    // Engine (src/orderflow/signal-engine.js), reused for the institutional
    // consensus index (V11.5 Fase 5) — not recomputed, not a second source.
    // An OFI reading is an EVENT (fires only when the imbalance crosses a
    // real threshold), not a continuous stream, so a stale/missing signal
    // means "no data" (null), never a fabricated neutral 0.
    const FLOW_SIGNAL_MAX_AGE_MS = 5 * 60_000;
    const latestOfi = orderflowSignals.find((s) => s.type === "OFI") ?? null;
    const flowImbalance =
      latestOfi &&
      Date.now() - latestOfi.timestamp <= FLOW_SIGNAL_MAX_AGE_MS &&
      typeof latestOfi.metadata?.imbalance === "number"
        ? Math.max(-1, Math.min(1, latestOfi.metadata.imbalance))
        : null;

    return {
      buyVolume,
      sellVolume,
      totalVolume,
      hasBook,
      imbalance,
      flowPressure,
      buyPercent,
      sellPercent,
      price,
      delta,
      deltaPct,
      direction,
      isLong,
      entry,
      target,
      target2,
      stop,
      riskRewardRatio,
      target1Strength,
      target2Strength,
      confidence,
      marketStructure,
      marketStructureLabel,
      support,
      resistance,
      supportStrength,
      resistanceStrength,
      supportBreakouts,
      resistanceBreakouts,
      moveToTargetPct,
      volatilityPct,
      flowImbalance,
      htfMarketStructureLabel,
      htfTimeframe,
      htfUpdatedAt,
      timeframeConfluence,
      // Fase D (Market Regime Engine): classificação oficial de regime,
      // computada em engine-bridge.ts sobre os mesmos candles do Bus do
      // ciclo — puro passthrough aqui, nunca recomputado na UI.
      marketRegime: cycleOk ? (realCycle?.marketRegime ?? null) : null,
    };
  }, [priceData, orderBook, realCycle, chartData, orderflowSignals]);

  // V11.5 Fase 5 — Consensus Engine: um ÚNICO hook subscrito ao GMIL aqui em
  // App() (antes cada consumidor — EssentialStrip, GmilContextWidget —
  // chamava useGmilSnapshot() por conta própria, 2 assinaturas redundantes
  // ao mesmo singleton). O índice institucional combina os 3 provedores
  // externos do GMIL com 2 dimensões locais REAIS já computadas acima —
  // liquidez (engine.imbalance, do livro de ofertas ao vivo) e fluxo
  // (engine.flowImbalance, do Signal Engine real) — reutilizando a MESMA
  // função pura computeConsensus (LEI 04), não uma segunda matemática de
  // consenso. Continua 100% consultivo: nenhum destes valores é lido por
  // engine-bridge.ts nem altera realCycle/engine.direction/confidence.
  // Fase E: além dos provedores, o snapshot agora traz os 4 vieses da
  // Constituição (context-aggregator.ts) — passthrough puro para a UI.
  const { providers: gmilProviders, biases: gmilBiases } = useGmilSnapshot();
  const institutionalConsensus = useMemo(() => {
    const localInputs: ConsensusInput[] = [
      { providerId: "liquidez_livro_ofertas", lean: engine.imbalance, weight: engine.hasBook ? 1 : 0 },
      { providerId: "fluxo_ofi", lean: engine.flowImbalance, weight: engine.flowImbalance !== null ? 1 : 0 },
    ];
    const providerInputs: ConsensusInput[] = gmilProviders.map((p) => ({
      providerId: p.id,
      lean: p.lastReading?.ok ? (p.lastReading.lean ?? null) : null,
      weight: p.weight,
    }));
    return computeConsensus([...providerInputs, ...localInputs]);
  }, [gmilProviders, engine.imbalance, engine.hasBook, engine.flowImbalance]);

  // Fase F (V15): Comitê de Validação — Ensemble Probabilístico (linear
  // opinion pool, src/consensus/). Composto AQUI na camada de exibição,
  // como o institutionalConsensus acima (V11.5 Fase 5), porque é o único
  // lugar onde as leituras locais (ciclo real, CVD) e o contexto GMIL
  // coexistem sem violar a LEI 04 — engine-bridge.ts continua sem nenhum
  // import de gmil/. Consumidor oficial da matriz de pesos da Fase D
  // (regime vigente) e do peso de qualidade da Fase C (amortecedor de
  // força). 100% consultivo: nada aqui é lido de volta pelo Core Engine
  // nem altera engine.direction/confidence.
  const ensembleConsensus = useMemo(() => {
    const lorentzian = realCycle?.lorentzian;
    const members = [
      {
        id: "lorentzian_knn",
        familia: "momentum",
        opiniao: lorentzian?.ok
          ? opinionFromVote(lorentzian.classification ?? null, lorentzian.confidence ?? NaN)
          : null,
      },
      { id: "estrutura_15m", familia: "momentum", opiniao: opinionFromLabel(engine.marketStructureLabel) },
      { id: "estrutura_1h", familia: "momentum", opiniao: opinionFromLabel(engine.htfMarketStructureLabel) },
      {
        id: "cvd_fluxo",
        familia: "fluxo_ordens",
        opiniao: num(cvd) && cvd !== 0 ? opinionFromLabel(cvd > 0 ? "ALTA" : "BAIXA") : null,
      },
      // GMIL: membro externo sem família local — o peso interno dele já
      // vem quality-ponderado na origem (consensus-engine do GMIL); o
      // regime local não modula leitura de contexto global.
      { id: "gmil_contexto", familia: null, opiniao: opinionFromLean(gmilBiases?.contextScore?.score ?? null) },
    ];
    return buildEnsembleConsensus({
      members,
      regime: engine.marketRegime?.regime ?? null,
      dataQualityWeight: realCycle?.dataQuality?.weight ?? null,
    });
  }, [realCycle, engine.marketStructureLabel, engine.htfMarketStructureLabel, engine.marketRegime, cvd, gmilBiases]);

  // Fase H (V15): sugestão de dimensionamento — % do equity e % de risco,
  // NUNCA valor monetário (o sistema não conhece o capital do operador).
  // Fail-closed por construção: qualquer insumo ausente/não-finito, comitê
  // dividido ou contrário ao sinal => 0%. A UI exibe o selo obrigatório ao
  // lado dos números. Consultivo: nada aqui é lido de volta pelo Core.
  //
  // Fase L (diretriz 1 — correção de governança do achado da Fase K): o
  // Kelly fracionado consome a força AJUSTADA pela qualidade da fonte
  // (forca_ajustada = forca × peso do Bus da Fase C), nunca mais a força
  // bruta. Consequência deliberada: fonte em quarentena (peso 0) ou nunca
  // medida (peso null) => força 0/null => sugestão 0% — a qualidade da
  // rede agora impacta o lote final, fail-closed de ponta a ponta.
  const riskSuggestion = useMemo(
    () =>
      buildRiskSuggestion({
        signal: engine.direction === "LONG" || engine.direction === "SHORT" ? engine.direction : null,
        entry: engine.entry,
        stop: engine.stop,
        atrPercent: engine.marketRegime?.atrPercent ?? null,
        riskRewardRatio: engine.riskRewardRatio,
        ensembleDirection: ensembleConsensus?.status === "OK" ? ensembleConsensus.direcao : null,
        ensembleForca: ensembleConsensus?.status === "OK" ? ensembleConsensus.forca_ajustada : null,
      }),
    [engine.direction, engine.entry, engine.stop, engine.marketRegime, engine.riskRewardRatio, ensembleConsensus],
  );

  // IRON-VOICE: espelho somente-leitura do estado real para a camada de voz
  // (src/voice/). Mesmos campos que a UI renderiza — nenhum valor novo é
  // computado aqui, só repassado.
  const voiceSnapshot = useMemo<TerminalSnapshot>(
    () => ({
      direction: engine.direction,
      confidence: engine.confidence,
      marketStructure: engine.marketStructure,
      entry: engine.entry,
      target: engine.target,
      stop: engine.stop,
      support: engine.support,
      resistance: engine.resistance,
      rationale: realCycle?.ok ? (realCycle.rationale ?? null) : null,
      engineStatus,
      engineReason: realCycle?.reason ?? null,
      lorentzianOk: realCycle?.lorentzian?.ok === true,
      lorentzianClassification: realCycle?.lorentzian?.classification ?? null,
      lorentzianConfidence: realCycle?.lorentzian?.confidence ?? null,
      lorentzianSampleSize: realCycle?.lorentzian?.sampleSize ?? null,
      lastPrice: priceData?.price ?? null,
      cvd,
      recentOrderflowTypes: orderflowSignals.slice(0, 10).map((s) => s.type),
      orderflowState,
      recentLiquidationCount: liquidations.length,
      liquidationState,
      wsLive,
      forecast: realCycle?.ok && realCycle.forecast ? realCycle.forecast : [],
    }),
    [engine, realCycle, engineStatus, priceData, cvd, orderflowSignals, orderflowState, liquidations, liquidationState, wsLive],
  );

  // Alertas executivos falados: computeAlerts é pura e só reage a TRANSIÇÕES
  // reais (prev vs next) — nunca repete o mesmo estado. Fila do voice-engine
  // é assíncrona por natureza: nada aqui bloqueia render/WS/WebGPU.
  //
  // DCI Focus Layer (item 8): a MESMA lista de alertas dirige o pulso visual
  // — nenhuma segunda detecção de transição é criada. Um alerta de prioridade
  // CRITICAL/ALERT (vetor confirmado/invalidado, motor caiu, liquidação nova,
  // divergência, absorção) acende `criticalPulse` por ~2.5s: a barra de
  // comando ganha um anel de brilho e a coluna de decisão um halo. O antigo
  // opacity-40 no resto da tela foi removido — em screenshot real do iPad a
  // tela inteira parecia "apagada" com só a barra viva (feedback direto do
  // operador); destaque agora é só aditivo, nunca subtrativo.
  const [criticalPulse, setCriticalPulse] = useState(false);
  const prevVoiceSnapshotRef = useRef<TerminalSnapshot | null>(null);
  useEffect(() => {
    const alerts = computeAlerts(prevVoiceSnapshotRef.current, voiceSnapshot);
    alerts.forEach((a) => voiceEngine.speak(a.text, a.priority));
    prevVoiceSnapshotRef.current = voiceSnapshot;
    if (alerts.some((a) => a.priority === "CRITICAL" || a.priority === "ALERT")) {
      setCriticalPulse(true);
      const t = setTimeout(() => setCriticalPulse(false), 2500);
      return () => clearTimeout(t);
    }
  }, [voiceSnapshot]);

  useEffect(() => {
    voiceEngine.init();
  }, []);

  // Real SMC zones (FVG/Order Blocks/Liquidity) — lifted here (rather than
  // computed locally inside ChartWidget) so the Neural Core widget's
  // tactical-context prompt uses the exact same real counts the chart
  // itself renders, not a second independent computation.
  const smcZones = useMemo(
    () =>
      chartData && chartData.length > 0
        ? computeSmcZones(chartData)
        : { fairValueGaps: [], orderBlocks: [], liquidityZones: [] },
    [chartData],
  );

  // Stable reference — prevents every context consumer (TopBar, all Widgets,
  // AssistantOrb, MarketDirectionWidget...) from re-rendering on renders
  // that don't actually change any of these values.
  const contextValue = useMemo(
    () => ({
      widgets,
      toggleWidget,
      setWidgetWorkspaceState,
      workspaceManagerOpen,
      setWorkspaceManagerOpen,
      engine,
      smcZones,
      bootAt,
      engineStatus,
      realCycle,
      orderflowSignals,
      orderflowState,
      orderflowReason,
      cvd,
      liquidations,
      liquidationState,
      bootRestFailed,
      handleManualRestart,
      voiceSnapshot,
      lastUpdateAt,
      criticalPulse,
      selectedAsset,
      setSelectedAsset,
      marketMode,
      setMarketMode,
      selectedTradFiAsset,
      setSelectedTradFiAsset,
      scannerData,
      gmilProviders,
      gmilBiases,
      institutionalConsensus,
      ensembleConsensus,
      riskSuggestion,
      cycleLatencyMs,
      fps,
      priceUpdatedAt,
      orderBookUpdatedAt,
    }),
    [
      widgets,
      toggleWidget,
      setWidgetWorkspaceState,
      workspaceManagerOpen,
      engine,
      smcZones,
      bootAt,
      engineStatus,
      realCycle,
      orderflowSignals,
      orderflowState,
      orderflowReason,
      cvd,
      liquidations,
      liquidationState,
      bootRestFailed,
      handleManualRestart,
      voiceSnapshot,
      lastUpdateAt,
      criticalPulse,
      selectedAsset,
      marketMode,
      selectedTradFiAsset,
      scannerData,
      gmilProviders,
      gmilBiases,
      institutionalConsensus,
      ensembleConsensus,
      riskSuggestion,
      cycleLatencyMs,
      fps,
      priceUpdatedAt,
      orderBookUpdatedAt,
    ],
  );

  return (
    <WidgetContext.Provider value={contextValue}>
      {/* pt-safe/pb-safe: em PWA standalone no iPad (viewport-fit=cover) a
          status bar translúcida pinta por cima do topo e o home indicator
          invadiria o rodapé — confirmado em screenshot real do dispositivo
          (barra de comando cortada em pé e deitado). Em navegador comum
          env() é 0 e nada muda. */}
      <div className="flex flex-col h-[100dvh] pt-safe pb-safe bg-[#020610] text-[#a0f0ff] font-mono overflow-hidden selection:bg-[#00f0ff30]">
        <TopBar
          data={priceData}
          derivatives={derivatives}
          crossExchangeCheck={crossExchangeCheck}
          okxCrossExchangeCheck={okxCrossExchangeCheck}
        />
        {bootRestFailed && (
          <div className="shrink-0 bg-[#ff005515] border-b border-[#ff005550] px-4 py-2 flex items-center justify-between gap-3">
            <span className="text-[0.55rem] sm:text-[0.6rem] tracking-[0.15em] text-[#ff0055] font-bold uppercase">
              Falha ao conectar aos feeds reais (Binance) após 3 tentativas — verifique a rede.
            </span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 px-3 py-1.5 rounded border border-[#ff0055] bg-[#ff005520] text-[#ff0055] font-black tracking-[0.15em] text-[0.55rem] uppercase active:bg-[#ff005535]"
            >
              REINICIAR SISTEMA
            </button>
          </div>
        )}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <SideBar activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="flex flex-col flex-1 p-2 gap-2 min-h-0 overflow-hidden relative">
            {activeTab === "DASHBOARD" ? (
              <>
                {/* DCI Essential Strip (item 1) agora vive DENTRO da barra de
                    comando unificada (TopBar) — uma barra só com toda a
                    informação de decisão, visível em todas as abas, zero
                    repetição de preço/símbolo/feed pelo resto da tela. */}

                {/* V16.1 correção crítica (Protocolo TradingView e Gavetas
                    Ocultas): o Operador rejeitou a V16 original — 3
                    colunas sempre visíveis espremiam o Gráfico. Esquerda
                    "Market Intelligence" e direita "Core Intelligence"
                    agora são GAVETAS fechadas por padrão
                    (leftDrawerOpen/rightDrawerOpen, false no boot),
                    sobrepostas (.terminal-left/.terminal-right,
                    position:absolute em index.css) ao Gráfico — nunca
                    dividem espaço de flexbox com ele, então o
                    Institutional Chart Engine ocupa ~100% da largura por
                    padrão, em qualquer viewport. Dois botões discretos
                    nas bordas (PanelLeft/PanelRight) abrem/fecham cada
                    gaveta; clicar no backdrop translúcido também fecha —
                    devolvendo o espaço total ao gráfico imediatamente
                    (position:absolute é excluído do algoritmo de flex do
                    pai, então fechar a gaveta nunca precisa de reflow).
                    Só os módulos VERDADEIRAMENTE secundários (Order Book/
                    Order Flow/Heatmap de liquidez/Scanner/Exposição/
                    Eventos/Núcleo Neural/Heatmap de ativos) vivem, à
                    parte, no Workspace Manager (Pinned/Docked/Collapsed/
                    Hidden/Floating — ver WorkspaceManagerPanel). */}
                <div className="terminal-grid flex-1 min-h-0 overflow-y-auto min-[1120px]:overflow-hidden scrollbar-hide p-1">
                  <div className="terminal-row min-h-0">
                    {/* MAIN — o Gráfico é o coração da operação; sozinho em
                        .terminal-main, sem colunas fixas disputando
                        espaço, o Institutional Chart Engine domina quase
                        100% da área visual por padrão. */}
                    <div className="terminal-main min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-2">
                      {widgets.chart.visible &&
                        (marketMode === "TRADFI" ? (
                          <TradFiEmptyState
                            assetLabel={`${selectedTradFiAsset?.symbol ?? ""} · ${selectedTradFiAsset?.name ?? ""}`}
                          />
                        ) : (
                          <ChartWidget data={priceData} chartData={chartData} />
                        ))}
                    </div>

                    {/* Backdrop — clicar fora de qualquer gaveta aberta a
                        fecha; um único elemento cobre a área do cockpit
                        (nunca a TopBar/FooterBar) para as duas gavetas. */}
                    <div
                      className={`terminal-drawer-backdrop ${leftDrawerOpen || rightDrawerOpen ? "drawer-open" : ""}`}
                      onClick={() => {
                        setLeftDrawerOpen(false);
                        setRightDrawerOpen(false);
                      }}
                    />

                    {/* Alça discreta — Market Intelligence (gaveta esquerda).
                        Achado real do Operador (captura de tela de
                        dispositivo real): com a gaveta aberta e agora
                        abraçando a altura do conteúdo (não mais esticada
                        até o rodapé), esta alça — fixa no centro vertical
                        de .terminal-row — podia acabar sobrando ABAIXO da
                        gaveta encolhida, flutuando sozinha sobre o
                        gráfico. A própria gaveta já tem seu X no
                        cabeçalho + fecha ao clicar fora, então a alça só
                        precisa existir para ABRIR — soma-se quando já
                        está aberta. */}
                    {!leftDrawerOpen && (
                      <button
                        type="button"
                        onClick={() => setLeftDrawerOpen(true)}
                        title="Market Intelligence"
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-50 w-8 h-14 rounded-r-lg border border-l-0 flex items-center justify-center transition-colors bg-[#010308]/80 border-[#00f0ff20] text-[#8ab4f8]/60 hover:text-[#00f0ff] hover:border-[#00f0ff40]"
                      >
                        <PanelLeft size={14} />
                      </button>
                    )}
                    {/* Alça discreta — Core Intelligence (gaveta direita). */}
                    {!rightDrawerOpen && (
                      <button
                        type="button"
                        onClick={() => setRightDrawerOpen(true)}
                        title="Core Intelligence"
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-50 w-8 h-14 rounded-l-lg border border-r-0 flex items-center justify-center transition-colors bg-[#010308]/80 border-[#00f0ff20] text-[#8ab4f8]/60 hover:text-[#00f0ff] hover:border-[#00f0ff40]"
                      >
                        <PanelRight size={14} />
                      </button>
                    )}

                    {/* LEFT (gaveta) — Market Intelligence: Vetor de
                        Mercado (livro real) + Bias/Convicção/Zonas/Gestão
                        de Risco. */}
                    <div
                      className={`terminal-left flex flex-col gap-2 ${leftDrawerOpen ? "drawer-open" : ""}`}
                    >
                      <div className="flex items-center justify-between shrink-0 pb-1 border-b border-[#00f0ff15]">
                        <span className="text-[0.5rem] font-bold tracking-[0.2em] uppercase text-[#00f0ff]">
                          Market Intelligence
                        </span>
                        <div
                          className="text-[#8ab4f8]/50 hover:text-[#ff0055] px-1 py-0.5 rounded cursor-pointer"
                          onClick={() => setLeftDrawerOpen(false)}
                        >
                          <X size={12} />
                        </div>
                      </div>
                      {marketMode === "TRADFI" ? (
                        <TradFiEmptyState compact assetLabel="MARKET INTELLIGENCE" />
                      ) : (
                        <>
                          <MarketDirectionWidget />
                          <MarketBiasDecisionCard />
                        </>
                      )}
                    </div>

                    {/* RIGHT (gaveta) — Core Intelligence: Siriform Core
                        (resumo compacto, detalhe completo sob demanda na
                        strip abaixo) + GMIL + Regime + Comitê de
                        Consenso/Risk Engine/Data Quality
                        (DecisionValidationWidget já cobre os 3) + Saúde
                        do Sistema. */}
                    <div
                      className={`terminal-right flex flex-col gap-2 ${rightDrawerOpen ? "drawer-open" : ""}`}
                    >
                      <div className="flex items-center justify-between shrink-0 pb-1 border-b border-[#00f0ff15]">
                        <span className="text-[0.5rem] font-bold tracking-[0.2em] uppercase text-[#00f0ff]">
                          Core Intelligence
                        </span>
                        <div
                          className="text-[#8ab4f8]/50 hover:text-[#ff0055] px-1 py-0.5 rounded cursor-pointer"
                          onClick={() => setRightDrawerOpen(false)}
                        >
                          <X size={12} />
                        </div>
                      </div>
                      {/* Fusão visual: sequência reorganizada para bater com
                          a ordem da imagem de referência — Siriform → GMIL
                          → Regime/Consenso/Risk Engine → Saúde do Sistema
                          (antes GMIL vinha por último). GmilContextWidget
                          continua FORA de qualquer ternário de marketMode —
                          é contexto macro global, sempre real
                          independente do ativo selecionado (mesmo
                          comportamento de sempre, só a posição mudou). */}
                      {marketMode === "TRADFI" ? (
                        <TradFiEmptyState compact assetLabel="SIRIFORM CORE" />
                      ) : (
                        widgets.se_core.visible && <SiriformCoreCard />
                      )}
                      <GmilContextWidget />
                      {marketMode === "TRADFI" ? (
                        <TradFiEmptyState compact assetLabel="REGIME · COMITÊ DE DECISÃO" />
                      ) : (
                        (widgets.market_regime.visible || widgets.decision_validation.visible) && (
                          <>
                            <MarketRegimeWidget />
                            <DecisionValidationWidget />
                          </>
                        )
                      )}
                      <TelemetryHealthWidget />
                    </div>
                  </div>

                  {/* STRIP — conteúdo sob demanda (Progressive Disclosure,
                      Workspace Manager §2): detalhe completo do Siriform
                      Core quando expandido (mesmo AssistantOrb rico de
                      sempre, intocado) e qualquer módulo secundário que o
                      operador tenha ancorado (Docked/Pinned/Collapsed) via
                      Workspace Manager. Fica com altura zero — sem espaço
                      morto — quando nada está expandido/ancorado. */}
                  {(!widgets.se_core.collapsed ||
                    widgets.orderbook.visible ||
                    widgets.orderflow.visible ||
                    widgets.heatmap.visible ||
                    widgets.scanner.visible ||
                    widgets.exposure.visible ||
                    widgets.events.visible ||
                    widgets.neural_core.visible ||
                    widgets.asset_heatmap.visible) && (
                    <div className="terminal-strip shrink-0 flex flex-col gap-2 max-h-[46vh] min-[1120px]:max-h-[38vh] overflow-y-auto scrollbar-hide">
                      {!widgets.se_core.collapsed &&
                        (marketMode === "TRADFI" ? (
                          <TradFiEmptyState compact assetLabel="SIRIFORM CORE · DETALHE COMPLETO" />
                        ) : (
                          <AssistantOrb inCenter={true} />
                        ))}
                      {(widgets.orderbook.visible || widgets.orderflow.visible || widgets.heatmap.visible) && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide h-[200px] min-[1120px]:h-[168px] shrink-0">
                          {widgets.orderbook.visible && (
                            <div className="min-w-[260px] flex-1 flex flex-col">
                              {marketMode === "TRADFI" ? (
                                <TradFiEmptyState compact assetLabel="LIVRO DE OFERTAS" />
                              ) : (
                                <OrderBookWidget data={priceData} book={orderBook} />
                              )}
                            </div>
                          )}
                          {widgets.orderflow.visible && (
                            <div className="min-w-[240px] flex-1 flex flex-col">
                              {marketMode === "TRADFI" ? (
                                <TradFiEmptyState compact assetLabel="ORDER FLOW" />
                              ) : (
                                <OrderFlowWidget />
                              )}
                            </div>
                          )}
                          {widgets.heatmap.visible && (
                            <div className="min-w-[240px] flex-1 flex flex-col">
                              {marketMode === "TRADFI" ? (
                                <TradFiEmptyState compact assetLabel="MAPA DE LIQUIDEZ" />
                              ) : (
                                <HeatmapWidget book={orderBook} data={priceData} />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {(widgets.scanner.visible ||
                        widgets.exposure.visible ||
                        widgets.events.visible ||
                        widgets.neural_core.visible ||
                        widgets.asset_heatmap.visible) && (
                        <div className="flex flex-col gap-2">
                          {widgets.asset_heatmap.visible && <AssetHeatmapWidget />}
                          {widgets.scanner.visible && <ScannerWidget data={scannerData} />}
                          {widgets.exposure.visible && <ExposureWidget />}
                          {widgets.events.visible && <EventsWidget />}
                          {widgets.neural_core.visible && <NeuralCoreWidget />}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <BottomPanels />
              </>
            ) : activeTab === "SETTINGS" ? (
              <ConfigPanel />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-[#8ab4f8]/50 p-8 cyber-panel bg-[#010308]/50">
                  <Settings
                    size={48}
                    className="opacity-50 animate-[spin_10s_linear_infinite]"
                  />
                  <span className="tracking-[0.3em] font-bold text-lg text-[#00f0ff] uppercase">
                    MÓDULO {activeTab}
                  </span>
                  <span className="text-xs uppercase tracking-widest text-[#00ffaa]">
                    AGUARDANDO FONTE DE DADOS REAL...
                  </span>
                  <div className="w-48 h-1 bg-[#010308] mt-4 overflow-hidden rounded">
                    <div className="w-1/2 h-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] animate-pulse"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <FooterBar />
        <WorkspaceManagerPanel />
      </div>
    </WidgetContext.Provider>
  );
}

// --- CONFIGURATION PANEL ---
// Official module names — exactly the titles each widget renders on the
// dashboard, so SETTINGS and the cockpit never disagree about what a
// module is called (no raw internal keys like "se_core" shown to the user).
const WIDGET_LABELS: { [key: string]: string } = {
  chart: "GRÁFICO · BINANCE SPOT",
  orderflow: "FLUXO DE ORDENS · LIVRO REAL",
  heatmap: "MAPA DE LIQUIDEZ · PROFUNDIDADE REAL",
  market_direction: "VETOR DE MERCADO",
  se_core: "NÚCLEO DE INTELIGÊNCIA S.E.",
  orderbook: "LIVRO DE OFERTAS",
  scanner: "QUANT SCANNER · 24H REAL",
  exposure: "EXPOSIÇÃO · READ-ONLY",
  gmil_context: "CONTEXTO GLOBAL · GMIL",
  events: "TELEMETRIA DE EVENTOS",
  neural_core: "NÚCLEO NEURAL · LLAMA 3 (LOCAL) + SÍNTESE",
  tactical: "LIQUIDAÇÕES INSTITUCIONAIS · REAL",
  market_regime: "REGIME DE MERCADO",
  asset_heatmap: "HEATMAP · ATIVOS",
  decision_validation: "VALIDAÇÃO MULTI-CAMADA",
  system_health: "SAÚDE DO SISTEMA",
};

function ConfigPanel() {
  const { widgets, toggleWidget } = useContext(WidgetContext);
  return (
    <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 max-w-4xl mx-auto w-full">
      <div className="text-2xl font-black text-[#00f0ff] drop-shadow-[0_0_10px_#00f0ff] tracking-[0.2em] mb-4">
        CONFIGURAÇÃO DO SISTEMA
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(widgets).map(([id, state]: [string, any]) => (
          <div
            key={id}
            className="cyber-panel p-4 flex flex-col gap-3 bg-[#010205]"
          >
            <span className="font-bold text-white tracking-widest uppercase">
              {WIDGET_LABELS[id] ?? id}
            </span>
            <div className="flex justify-between items-center bg-[#010308] p-2 rounded border border-[#00f0ff20]">
              <span className="text-xs text-[#8ab4f8]">VISIBILIDADE</span>
              <button
                onClick={() => toggleWidget(id, "visible")}
                className={`text-xs px-3 py-1 font-bold rounded ${state.visible ? "bg-[#00ffaa20] text-[#00ffaa] border border-[#00ffaa50]" : "bg-[#ff005520] text-[#ff0055] border border-[#ff005550]"}`}
              >
                {state.visible ? "VISÍVEL" : "OCULTO"}
              </button>
            </div>
            <div className="flex justify-between items-center bg-[#010308] p-2 rounded border border-[#00f0ff20]">
              <span className="text-xs text-[#8ab4f8]">MODO FLUTUANTE (REDIMENSIONÁVEL)</span>
              <button
                onClick={() => toggleWidget(id, "floating")}
                className={`text-xs px-3 py-1 font-bold rounded ${state.floating ? "bg-[#00f0ff20] text-[#00f0ff] border border-[#00f0ff50]" : "bg-transparent text-[#8ab4f8]/50 border border-[#8ab4f8]/30 hover:text-white"}`}
              >
                {state.floating ? "ATIVO" : "INATIVO"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- V16 WORKSPACE MANAGER (§2) — the single entry point (SideBar footer
// button) for the Pinned/Docked/Collapsed/Hidden/Floating states of every
// TRULY secondary module. Chart and the always-docked left/right V16
// columns (Market Direction/Decision, Siriform Core summary, GMIL, Market
// Regime, Decision Validation, System Health) are deliberately absent from
// this list — they're part of the fixed default view per the operator's
// spec, not optional tools. Reuses setWidgetWorkspaceState (App(), one
// setState per state jump) so picking "Floating" from "Hidden" flips both
// the visible AND floating flags atomically, never a stale in-between.
const WORKSPACE_MANAGER_MODULES: { id: string; label: string }[] = [
  { id: "orderbook", label: "LIVRO DE OFERTAS" },
  { id: "orderflow", label: "FLUXO DE ORDENS" },
  { id: "heatmap", label: "MAPA DE LIQUIDEZ" },
  { id: "scanner", label: "QUANT SCANNER · 24H" },
  { id: "exposure", label: "EXPOSIÇÃO" },
  { id: "events", label: "TELEMETRIA DE EVENTOS" },
  { id: "neural_core", label: "NÚCLEO NEURAL · LLAMA 3" },
  { id: "asset_heatmap", label: "HEATMAP · ATIVOS" },
  { id: "tactical", label: "LIQUIDAÇÕES INSTITUCIONAIS" },
];
const WORKSPACE_STATES = ["hidden", "docked", "collapsed", "pinned", "floating"] as const;
type WorkspaceState = (typeof WORKSPACE_STATES)[number];

function widgetWorkspaceState(st: { visible: boolean; floating: boolean; collapsed: boolean; pinned: boolean } | undefined): WorkspaceState {
  if (!st || !st.visible) return "hidden";
  if (st.floating) return "floating";
  if (st.collapsed) return "collapsed";
  if (st.pinned) return "pinned";
  return "docked";
}

function WorkspaceManagerPanel() {
  const { widgets, workspaceManagerOpen, setWorkspaceManagerOpen, setWidgetWorkspaceState } =
    useContext(WidgetContext) || {};
  if (!workspaceManagerOpen) return null;

  return (
    <div
      className="!fixed !inset-0 !z-[999] bg-[#010308]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setWorkspaceManagerOpen?.(false)}
    >
      <div
        className="cyber-panel w-full max-w-2xl max-h-[80vh] flex flex-col bg-[#010308]/98"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cyber-header flex items-center justify-between">
          <span className="font-bold tracking-[0.2em]">WORKSPACE MANAGER</span>
          <div
            className="text-[#8ab4f8]/50 hover:text-[#00f0ff] px-1 py-0.5 rounded cursor-pointer"
            onClick={() => setWorkspaceManagerOpen?.(false)}
          >
            <X size={14} />
          </div>
        </div>
        <div className="p-3 flex flex-col gap-2 overflow-y-auto scrollbar-hide">
          <span className="text-[0.5rem] text-[#8ab4f8]/70 tracking-[0.15em] uppercase">
            Módulos secundários — Progressive Disclosure: escondidos por padrão, disponíveis sob demanda
          </span>
          {WORKSPACE_MANAGER_MODULES.map(({ id, label }) => {
            const current = widgetWorkspaceState(widgets?.[id]);
            return (
              <div
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 bg-[#010205] border border-[#00f0ff15] rounded-lg px-3 py-2"
              >
                <span className="text-[0.55rem] font-bold tracking-widest text-white">{label}</span>
                <div className="flex gap-1 flex-wrap">
                  {WORKSPACE_STATES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setWidgetWorkspaceState?.(id, s)}
                      className={`flex items-center gap-0.5 text-[0.4rem] px-1.5 py-1 rounded border font-bold uppercase tracking-wider ${
                        current === s
                          ? "border-[#00f0ff] bg-[#00f0ff20] text-[#00f0ff]"
                          : "border-[#8ab4f8]/20 text-[#8ab4f8]/50 hover:text-[#8ab4f8]"
                      }`}
                    >
                      {s === "pinned" && <Pin size={9} />}
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- RIGHT COLUMN: SIRIFORM CORE (V16 §1/§3) — compact real-status summary
// docked in the right column by default (se_core.collapsed: true). Never a
// second computation: engineStatus/direction/confidence/lorentzian all come
// straight from the SAME `engine`/`realCycle` the full AssistantOrb detail
// reads. "Expandir" flips the exact same `se_core.collapsed` flag the
// Workspace Manager panel controls — the full, unmodified AssistantOrb
// (forecast/voice/quick actions, nothing removed) renders below the
// 3-column row when expanded (see the DASHBOARD strip in App()).
function SiriformCoreCard() {
  const { engine, engineStatus, realCycle, widgets, toggleWidget } = useContext(WidgetContext) || {};
  const direction: Direction = engine?.direction ?? null;
  const collapsed = widgets?.se_core?.collapsed ?? true;
  const statusLabel = engineStatus === "pending" ? AWAIT : engineStatus === "ok" ? "SINCRONIZADO" : "FALHOU";
  const statusColor =
    engineStatus === "pending" ? "text-[#f0d06f]" : engineStatus === "ok" ? "text-[#00ffaa]" : "text-[#ff0055]";
  const dirColor =
    direction === "LONG" ? "text-[#00ffaa]" : direction === "SHORT" ? "text-[#ff0055]" : "text-[#8ab4f8]/60";
  const lorentzian = realCycle?.lorentzian?.ok ? realCycle.lorentzian : null;
  const lorentzianLabel = lorentzian
    ? `${lorentzian.classification} · ${lorentzianConfidencePct(lorentzian)}%`
    : AWAIT;
  // Fusão visual (imagem de referência): anel de sincronização — nunca um
  // número inventado. 100% só quando o ciclo real do próprio engineStatus
  // (a MESMA variável que já orienta statusLabel acima) está "ok"; 0%
  // quando falhou; "pending" fica com o anel indeterminado (animate-spin),
  // nunca uma % fabricada enquanto o primeiro ciclo real ainda não voltou.
  const syncPct = engineStatus === "ok" ? 100 : engineStatus === "error" ? 0 : null;
  const syncColor = syncPct === 100 ? "#00ffaa" : syncPct === 0 ? "#ff0055" : "#f0d06f";

  return (
    <div className="cyber-panel shrink-0 flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="font-bold tracking-[0.2em] text-[0.55rem] uppercase text-[#00f0ff]">
          SIRIFORM INTELLIGENCE CORE
        </span>
        <button
          type="button"
          onClick={() => toggleWidget?.("se_core", "collapsed")}
          className="text-[0.4rem] tracking-[0.1em] font-bold uppercase text-[#8ab4f8] hover:text-[#00f0ff] px-1.5 py-0.5 rounded border border-[#8ab4f8]/20 shrink-0"
        >
          {collapsed ? "EXPANDIR" : "RECOLHER"}
        </button>
      </div>
      <div className="flex items-center justify-center py-1">
        <div
          className={`relative w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${syncPct === null ? "animate-spin [animation-duration:2.5s]" : ""}`}
          style={{
            background:
              syncPct === null
                ? `conic-gradient(${syncColor} 0% 25%, rgba(138,180,248,0.12) 25% 100%)`
                : `conic-gradient(${syncColor} ${syncPct}%, rgba(138,180,248,0.12) ${syncPct}% 100%)`,
          }}
        >
          <div className="absolute inset-[3px] rounded-full bg-[#010308] flex flex-col items-center justify-center">
            <span
              className={`text-[0.6rem] font-black ${syncPct === null ? "animate-spin [animation-duration:2.5s] [animation-direction:reverse]" : ""}`}
              style={{ color: syncColor }}
            >
              {syncPct === null ? "···" : `${syncPct}%`}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <MiniStat label="Ciclo de Análise" value={statusLabel} color={statusColor} />
        <MiniStat label="Sinal" value={direction ?? AWAIT} color={dirColor} />
        <MiniStat label="k-NN Lorentz." value={lorentzianLabel} color="text-[#8ab4f8]" />
        <MiniStat
          label="Estrutura (15m)"
          value={engine?.marketStructureLabel ?? AWAIT}
          color="text-[#8ab4f8]"
        />
      </div>
    </div>
  );
}

// --- ASSISTANT ORB / S.E. CORE (center hero, detalhe completo — expandido
// sob demanda a partir do SiriformCoreCard acima) ---
const ASSISTANT_MESSAGES = [
  "NÚCLEO EM MODO LEITURA (READ_ONLY).",
  "SINCRONIZANDO FLUXO DE ORDENS REAL...",
  "MAPEANDO ESTRUTURA DE PREÇO (SWINGS REAIS).",
  "SEM EXECUÇÃO DE ORDEM — APENAS ANÁLISE.",
];

function AssistantOrb({ inCenter = false }: { inCenter?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const { widgets, engine, engineStatus, realCycle, voiceSnapshot, handleManualRestart } =
    useContext(WidgetContext) || {};

  if (widgets && inCenter && !widgets.se_core?.visible) return null;

  const direction: Direction = engine?.direction ?? null;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const entry: number | null = engine?.entry ?? null;
  const target: number | null = engine?.target ?? null;
  const stop: number | null = engine?.stop ?? null;
  const flowPressure: number | null = engine?.flowPressure ?? null;
  const moveToTargetPct: number | null = engine?.moveToTargetPct ?? null;
  const riskRewardRatio: number | null = engine?.riskRewardRatio ?? null;
  const target1Strength: { label: "FORTE" | "FRACA"; touches: number } | null = engine?.target1Strength ?? null;
  const target2Strength: { label: "FORTE" | "FRACA"; touches: number } | null = engine?.target2Strength ?? null;

  const dirLabel = isLong ? "LONG" : isShort ? "SHORT" : AWAIT;
  const dirColor = isLong
    ? "text-[#00ffaa]"
    : isShort
      ? "text-[#ff0055]"
      : "text-[#8ab4f8]/60";

  // Quick Action buttons are real UI gated by the real engine's confluence
  // state — but this terminal has no exchange API key and no order-send
  // path anywhere in the codebase (READ_ONLY/FAIL_CLOSED by design, not by
  // an unfinished feature). Tapping never places an order; it always
  // surfaces that fact instead of silently doing nothing or faking a
  // success.
  const handleAction = (label: string) => {
    setActionFeedback(`${label} · EXECUÇÃO DESABILITADA (READ_ONLY)`);
  };
  useEffect(() => {
    if (!actionFeedback) return;
    const t = setTimeout(() => setActionFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [actionFeedback]);

  useEffect(() => {
    if ((hovered || inCenter) && !inputValue) {
      const t = setInterval(() => {
        setMsgIdx((prev) => (prev + 1) % ASSISTANT_MESSAGES.length);
      }, 3500);
      return () => clearInterval(t);
    } else {
      setMsgIdx(0);
    }
  }, [hovered, inCenter, inputValue]);

  if (inCenter) {
    return (
      <div className="flex-1 shrink-0 flex flex-col items-center justify-between relative min-h-[500px] min-[1120px]:min-h-0 overflow-y-auto overscroll-contain scrollbar-hide z-0 group py-4 bg-[#010308]/72 backdrop-blur-3xl border border-[#00f0ff]/15 rounded-2xl shadow-[inset_0_0_90px_rgba(0,240,255,0.06),0_10px_40px_rgba(0,0,0,0.7)] w-full max-w-4xl mx-auto">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px]"></div>

        <div className="absolute top-3 left-0 right-0 flex justify-center opacity-50 text-[0.55rem] tracking-[0.4em] font-bold text-[#00f0ff] z-10">
          NÚCLEO DE INTELIGÊNCIA S.E.
        </div>

        <div
          className={`mt-6 [@media(max-height:1050px)]:mt-2 w-full px-4 sm:px-6 transition-all duration-700 ${hovered ? "opacity-20 blur-[2px]" : "opacity-100 blur-0"} z-10`}
        >
          <div className="flex flex-col gap-4 [@media(max-height:1050px)]:gap-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#00f0ff20] pb-2 gap-2 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className={`tracking-[0.2em] font-black whitespace-nowrap ${direction ? "text-base sm:text-lg" : "text-[0.6rem] sm:text-xs"} ${dirColor}`}
                >
                  VETOR {dirLabel}
                </span>
                <span className="text-[0.5rem] sm:text-[0.55rem] tracking-[0.2em] text-[#8ab4f8] font-bold uppercase opacity-80 mt-1 sm:mt-0">
                  (ESTRUTURA REAL)
                </span>
              </div>
              <div className="flex items-center gap-2 bg-[#00ffaa10] px-3 py-1 rounded border border-[#00ffaa30]">
                <Wifi size={12} className="animate-pulse text-[#00ffaa]" />
                <span className="text-[0.5rem] sm:text-[0.55rem] tracking-[0.2em] text-[#00ffaa] font-bold">
                  DADOS REAIS · READ-ONLY
                </span>
              </div>
            </div>

            {/* Real engine status — honest state of the real-data + WASM +
                research pipeline cycle (engine-bridge.ts). Never implies a
                signal exists before the real engine has actually produced
                one.
                Auditoria Mestra 360° (secao 3): rotulo mudou de "MOTOR WASM"
                para "CICLO DE ANÁLISE" — este indicador reporta o estado do
                CICLO INTEIRO (sonda Binance + init WASM + pipeline de
                pesquisa), nao so' do WASM; o WASM em si so' calcula SMA/EMA/
                stddev/zscore dentro desse ciclo, nunca o sinal LONG/SHORT
                mostrado (ver tacticalInput acima). */}
            <div className="flex items-center gap-2 mt-2 z-10">
              <div
                className={`w-1.5 h-1.5 rounded-full ${engineStatus === "ok" ? "bg-[#00ffaa] animate-pulse" : engineStatus === "error" ? "bg-[#ff0055]" : "bg-[#f0d06f] animate-pulse"}`}
              ></div>
              {engineStatus === "pending" ? (
                <span className="flex items-center gap-1.5 text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase text-[#f0d06f]">
                  CICLO DE ANÁLISE ·
                  <span className="skeleton-shimmer h-[0.6em] w-16 rounded-sm" />
                </span>
              ) : (
                <span
                  className={`text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase ${engineStatus === "ok" ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
                >
                  CICLO DE ANÁLISE ·{" "}
                  {engineStatus === "ok" ? "CONECTADO" : `FALHOU (${realCycle?.reason || DASH})`}
                </span>
              )}
              {engine.confidence && (
                <span className="text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase text-[#8ab4f8] border border-[#8ab4f8]/30 px-1.5 py-0.5 rounded">
                  CONFIANÇA {engine.confidence}
                </span>
              )}
              {/* Sinal de confluência INDEPENDENTE (k-NN Lorentziano sobre
                  features reais) — nunca substitui nem é substituído pelo
                  VETOR da Heurística de Tendência acima (SMA/EMA real, não
                  WASM — ver tacticalInput); amostra pequena (~60-90 pontos,
                  candles desta sessão) é reportada, nunca escondida. */}
              {realCycle?.lorentzian?.ok && (
                <span
                  className={`text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase border px-1.5 py-0.5 rounded ${
                    realCycle.lorentzian.classification === "LONG"
                      ? "text-[#00ffaa] border-[#00ffaa30]"
                      : realCycle.lorentzian.classification === "SHORT"
                        ? "text-[#ff0055] border-[#ff005530]"
                        : "text-[#8ab4f8] border-[#8ab4f8]/30"
                  }`}
                  title={`Amostra: ${realCycle.lorentzian.sampleSize} pontos históricos`}
                >
                  k-NN LORENTZ. {realCycle.lorentzian.classification} ·{" "}
                  {lorentzianConfidencePct(realCycle.lorentzian)}% (n=
                  {realCycle.lorentzian.sampleSize})
                </span>
              )}
            </div>

            <div className="flex flex-col mt-2 sm:mt-4 gap-4 [@media(max-height:1050px)]:mt-1 [@media(max-height:1050px)]:gap-2">
              {/* Structural levels — real distinct numbers once a direction
                  exists. Below that, a SINGLE waiting message: showing four
                  separate "AGUARDANDO" cards here (on top of the "VETOR
                  AGUARDANDO" headline above) repeated the same fact five
                  times on one screen for no informational gain. */}
              {direction ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <LevelCard
                    label="Entrada (Spot)"
                    value={entry}
                    accent="#00f0ff"
                    tag="REF"
                  />
                  <LevelCard
                    label={isShort ? "Alvo 1 · Suporte" : "Alvo 1 · Resistência"}
                    value={target}
                    accent="#00ffaa"
                    // Protocolo Mestre (Sincronização Global): Alvo 1 agora vem
                    // do swing fractal mais próximo (não mais o mínimo/máximo
                    // bruto da janela — ver analysis-frame.js), então também
                    // ganha o mesmo badge de força por confluência real que o
                    // Alvo 2 já tinha (V11.5 Fase 6).
                    tag={target1Strength?.label ?? "REAL"}
                  />
                  <LevelCard
                    label="Alvo 2 · Extensão"
                    value={engine.target2}
                    accent="#00ffaa"
                    // V11.5 Fase 6: quando o motor confirma força por
                    // confluência real de swings, o badge mostra isso em vez
                    // do genérico "REAL" — mesmo espaço visual, mais
                    // informação (nunca uma probabilidade, ver
                    // support-resistance-engine.js).
                    tag={target2Strength?.label ?? "REAL"}
                    dim={!num(engine.target2)}
                  />
                  <LevelCard
                    label={isShort ? "Stop · Resistência" : "Stop · Suporte"}
                    value={stop}
                    accent="#ff0055"
                    tag="REAL"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-[#8ab4f8]/20 bg-[#8ab4f8]/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f0d06f] animate-pulse shrink-0"></div>
                  <span className="text-[0.5rem] sm:text-[0.55rem] tracking-[0.15em] text-[#8ab4f8] font-bold uppercase">
                    Motor real aguardando confirmação direcional para Entrada/Alvos/Stop — níveis estruturais brutos já disponíveis abaixo
                  </span>
                </div>
              )}

              {/* Previsão multi-horizonte REAL: o mesmo k-NN Lorentziano
                  re-rotulado para 4/8/16 velas (15m ≈ 1h/2h/4h). Leitura
                  probabilística com amostra declarada por horizonte — um
                  horizonte sem amostra vira chip apagado, nunca um número
                  inventado. Nunca gera ordem: READ_ONLY. */}
              {realCycle?.forecast && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.5rem] text-[#8ab4f8] tracking-[0.25em] font-bold uppercase flex items-center gap-2">
                    <Activity size={11} /> PREVISÃO MULTI-HORIZONTE (k-NN REAL)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {realCycle.forecast.map((f: any) => (
                      <div
                        key={f.horizonBars}
                        className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 ${
                          !f.ok
                            ? "border-[#8ab4f8]/10 opacity-40"
                            : f.classification === "LONG"
                              ? "border-[#00ffaa30] bg-[#00ffaa08]"
                              : f.classification === "SHORT"
                                ? "border-[#ff005530] bg-[#ff005508]"
                                : "border-[#8ab4f8]/20 bg-[#8ab4f8]/5"
                        }`}
                        title={f.ok ? `Amostra real: ${f.sampleSize} pontos` : f.reason}
                      >
                        <span className="text-[0.5rem] tracking-[0.15em] text-[#8ab4f8] font-black uppercase">
                          {f.horizonBars / 4}H
                        </span>
                        <span className="text-[0.4rem] tracking-[0.15em] text-[#8ab4f8]/50 uppercase">
                          {f.horizonBars} velas (15m)
                        </span>
                        <span
                          className={`text-[0.6rem] font-black tracking-[0.1em] ${
                            !f.ok
                              ? "text-[#8ab4f8]/40"
                              : f.classification === "LONG"
                                ? "text-[#00ffaa]"
                                : f.classification === "SHORT"
                                  ? "text-[#ff0055]"
                                  : "text-[#8ab4f8]"
                          }`}
                        >
                          {f.ok ? f.classification : AWAIT}
                        </span>
                        <span className="text-[0.45rem] text-[#8ab4f8]/60 font-mono">
                          {f.ok ? `${Math.round((f.confidence ?? 0) * 100)}% · n=${f.sampleSize}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Honest flow / move metrics — no PnL, no leverage, no win-rate. */}
              <div className="flex flex-col lg:flex-row gap-2 sm:gap-4">
                <div className="bg-gradient-to-br from-[#00f0ff10] to-[#00ffaa10] border border-[#00f0ff30] p-4 rounded-xl flex flex-col relative overflow-hidden flex-[1.2] justify-center items-center text-center transition-colors duration-500 shadow-[inset_0_0_30px_rgba(0,240,255,0.05)]">
                  <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#00f0ff10] to-transparent pointer-events-none"></div>
                  <span className="text-[0.6rem] text-[#a0f0ff] tracking-[0.25em] mb-2 font-bold uppercase z-10 flex items-center gap-2">
                    <Activity size={12} className="text-[#00f0ff]" /> MOVE ATÉ ALVO
                    ESTRUTURAL
                  </span>
                  <div className="flex items-center gap-3 z-10 mb-2">
                    <span className="text-3xl text-white font-black font-mono tracking-tight drop-shadow-[0_0_12px_rgba(0,240,255,0.5)]">
                      {num(moveToTargetPct) ? `${moveToTargetPct.toFixed(2)}%` : DASH}
                    </span>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-[#00f0ff] border-[#00f0ff50] bg-[#00f0ff10] text-[0.6rem] font-bold border px-2 py-0.5 rounded">
                        PRESSÃO {num(flowPressure) ? `${flowPressure.toFixed(1)}%` : DASH}
                      </span>
                      {/* V11.5 Fase 6: razão real distância-ao-alvo/distância-
                          à-invalidação (target-tracker.js) — nunca uma
                          probabilidade de acerto, ver comentário na fonte. */}
                      {num(riskRewardRatio) && (
                        <span className="text-[#f0d06f] border border-[#f0d06f]/40 bg-[#f0d06f]/10 text-[0.55rem] font-bold px-2 py-0.5 rounded">
                          R:R {riskRewardRatio.toFixed(2)}
                        </span>
                      )}
                      <span className="text-[#8ab4f8] border border-[#8ab4f8]/30 bg-[#8ab4f8]/5 text-[0.55rem] font-bold px-2 py-0.5 rounded">
                        SEM ALAVANCAGEM
                      </span>
                    </div>
                  </div>
                  <div className="w-full flex justify-between items-center text-[0.55rem] mt-2 border-t border-[#00f0ff20] pt-2 z-10 font-mono text-[#8ab4f8]">
                    <span>ENTRADA: {fmt(entry)}</span>
                    <span>ALVO: {fmt(target)}</span>
                    <span className="text-[#ff0055]">STOP: {fmt(stop)}</span>
                  </div>
                </div>

                <div className="bg-[#010205] p-3 rounded-xl border border-[#8ab4f8] flex flex-col flex-1 relative overflow-hidden shadow-[inset_0_0_15px_rgba(138,180,248,0.1)]">
                  <span className="text-[0.55rem] text-[#8ab4f8] tracking-[0.2em] mb-3 font-bold uppercase flex items-center gap-2">
                    <Activity size={12} /> NÍVEIS ESTRUTURAIS (MOTOR REAL)
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#00ffaa20]">
                      <span className="text-[0.5rem] text-[#00ffaa]/80 font-bold tracking-widest">
                        RESISTÊNCIA
                      </span>
                      <span className="text-[0.55rem] text-white font-mono">
                        {fmt(engine?.resistance ?? null)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#ff005520]">
                      <span className="text-[0.5rem] text-[#ff0055]/80 font-bold tracking-widest">
                        SUPORTE
                      </span>
                      <span className="text-[0.55rem] text-white font-mono">
                        {fmt(engine?.support ?? null)}
                      </span>
                    </div>
                    {engine?.marketStructureLabel && (
                      <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#00f0ff20]">
                        <span className="text-[0.5rem] text-[#00f0ff]/80 font-bold tracking-widest">
                          ESTRUTURA
                        </span>
                        <span className="text-[0.55rem] text-white font-mono">
                          {engine.marketStructureLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ação Rápida — real touch-friendly UI, gated by the real
                  engine's confluence state, but this terminal has no
                  exchange API key and no order-send path anywhere in the
                  codebase: READ_ONLY/FAIL_CLOSED by permanent design.
                  Tapping always surfaces that instead of placing an order
                  or faking success. */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[0.55rem] text-[#8ab4f8] tracking-[0.2em] font-bold uppercase flex items-center gap-2">
                    <Target size={12} /> AÇÃO RÁPIDA
                  </span>
                  {actionFeedback && (
                    <span className="text-[0.45rem] tracking-[0.15em] text-[#f0d06f] font-bold uppercase animate-fade-in">
                      {actionFeedback}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={!isLong}
                    onClick={() => handleAction("LONG")}
                    className={`py-3 rounded-lg border font-black tracking-[0.15em] text-[0.6rem] uppercase flex items-center justify-center gap-1.5 transition-colors ${isLong ? "border-[#00ffaa60] bg-[#00ffaa15] text-[#00ffaa] active:bg-[#00ffaa25]" : "border-[#8ab4f8]/15 bg-transparent text-[#8ab4f8]/30 cursor-not-allowed"}`}
                  >
                    <ArrowUpRight size={14} /> LONG
                  </button>
                  <button
                    type="button"
                    disabled={!isShort}
                    onClick={() => handleAction("SHORT")}
                    className={`py-3 rounded-lg border font-black tracking-[0.15em] text-[0.6rem] uppercase flex items-center justify-center gap-1.5 transition-colors ${isShort ? "border-[#ff005560] bg-[#ff005515] text-[#ff0055] active:bg-[#ff005525]" : "border-[#8ab4f8]/15 bg-transparent text-[#8ab4f8]/30 cursor-not-allowed"}`}
                  >
                    <ArrowDownRight size={14} /> SHORT
                  </button>
                  <button
                    type="button"
                    disabled
                    className="py-3 rounded-lg border border-[#8ab4f8]/15 bg-transparent text-[#8ab4f8]/30 cursor-not-allowed font-black tracking-[0.15em] text-[0.6rem] uppercase flex items-center justify-center gap-1.5"
                  >
                    <X size={14} /> CLOSE
                  </button>
                </div>
                <span className="text-[0.45rem] tracking-[0.15em] text-[#8ab4f8]/40 uppercase font-bold text-center">
                  Sem posição ao vivo · execução desabilitada por projeto (READ_ONLY)
                </span>
              </div>

              {/* IRON-VOICE fundido no núcleo — a voz É parte do S.E., não um
                  painel separado: mesmos dados, mesmo card, mesmo organismo. */}
              {voiceSnapshot && (
                <div className="flex flex-col gap-2 border-t border-[#00f0ff15] pt-3">
                  <span className="text-[0.55rem] text-[#8ab4f8] tracking-[0.2em] font-bold uppercase flex items-center gap-2">
                    <Wifi size={12} /> VOZ DO NÚCLEO · IRON-VOICE
                  </span>
                  <VoiceControlWidget snapshot={voiceSnapshot} onRefresh={handleManualRestart} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* S.E. central orb */}
        <div className="flex-1 flex items-center justify-center relative w-full mt-4 pb-8 min-h-[300px] [@media(max-height:1050px)]:min-h-[130px] [@media(max-height:1050px)]:pb-2 [@media(max-height:1050px)]:mt-1 overflow-hidden">
          <div className="absolute w-[360px] h-[360px] [@media(max-height:1050px)]:w-[150px] [@media(max-height:1050px)]:h-[150px] rounded-full border border-[#00f0ff1a] animate-[spin_30s_linear_infinite] pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#00f0ff] rounded-full shadow-[0_0_15px_#00f0ff]"></div>
          </div>
          <div className="absolute w-[280px] h-[280px] [@media(max-height:1050px)]:w-[115px] [@media(max-height:1050px)]:h-[115px] rounded-full border border-[#00f0ff15] animate-[spin_20s_linear_infinite_reverse] pointer-events-none">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#00ffaa] rounded-full shadow-[0_0_10px_#00ffaa]"></div>
          </div>

          <div
            className={`relative z-10 flex flex-col items-center justify-center transition-all duration-700 ease-out ${hovered ? "scale-105" : "scale-100"}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
              if (!inputValue) setHovered(false);
            }}
          >
            <div
              className={`absolute w-64 h-64 [@media(max-height:1050px)]:w-28 [@media(max-height:1050px)]:h-28 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.25)_0%,transparent_70%)] blur-2xl transition-all duration-1000 ${hovered ? "opacity-100 scale-125 animate-[pulse_2s_ease-in-out_infinite]" : "opacity-50 scale-100 animate-[pulse_4s_ease-in-out_infinite]"}`}
            ></div>

            <div
              className={`relative w-32 h-32 [@media(max-height:1050px)]:w-16 [@media(max-height:1050px)]:h-16 rounded-full border-[3px] border-[#00f0ff60] bg-[#010205] flex items-center justify-center shadow-[0_0_50px_rgba(0,240,255,0.4)] transition-all duration-500 overflow-hidden cursor-pointer ${hovered ? "w-[450px] h-[120px] max-w-[90vw] rounded-2xl border-[#00f0ff] shadow-[0_0_60px_#00f0ff] bg-[#00f0ff0a] backdrop-blur-2xl" : ""}`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hovered ? "opacity-0 pointer-events-none" : "opacity-100"}`}
              >
                <div className="w-24 h-24 rounded-full bg-[#00f0ff] opacity-10 animate-ping"></div>
                <div className="w-16 h-16 rounded-full bg-[#00f0ff] opacity-20 animate-pulse absolute"></div>
                <div className="absolute w-6 h-6 rounded-full bg-white shadow-[0_0_20px_#fff,0_0_40px_#00f0ff]"></div>
              </div>

              <div
                className={`absolute inset-0 flex flex-col justify-center px-4 sm:px-8 transition-opacity duration-700 delay-100 ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#00f0ff] shadow-[0_0_30px_#00f0ff] animate-pulse shrink-0 flex items-center justify-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full"></div>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[0.5rem] sm:text-[0.55rem] text-[#8ab4f8] tracking-[0.2em] font-bold uppercase mb-[2px]">
                      S.E. · NÚCLEO READ-ONLY
                    </span>
                    <span className="text-[0.6rem] sm:text-[0.7rem] text-white font-bold tracking-[0.1em] truncate animate-fade-in drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]">
                      {ASSISTANT_MESSAGES[msgIdx]}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 sm:gap-4 items-center mt-3 sm:mt-4 bg-[#010205]/60 px-3 py-2 sm:px-4 sm:py-2 rounded-lg border border-[#00f0ff40]">
                  <input
                    type="text"
                    placeholder="NOTA DE ANÁLISE (LOCAL)..."
                    className="flex-1 bg-transparent border-none outline-none text-[0.6rem] sm:text-[0.65rem] text-white font-bold tracking-widest placeholder-[#00f0ff50]"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setInputValue("");
                        setHovered(false);
                      }
                    }}
                  />
                  <div className="flex gap-[2px] sm:gap-[4px] items-end h-4 sm:h-5 shrink-0">
                    {[40, 70, 30, 80, 55, 90, 45, 65].map((h, i) => (
                      <div
                        key={i}
                        className="w-[2px] sm:w-[3px] bg-[#00f0ff] rounded-full animate-[sound-wave_1s_ease-in-out_infinite]"
                        style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full px-4 sm:px-8 text-center z-10 mt-auto pb-4 [@media(max-height:1050px)]:pb-1 shrink-0">
          <div className="inline-block bg-[#010205] border border-[#00f0ff20] px-4 py-2 [@media(max-height:1050px)]:py-1 [@media(max-height:1050px)]:px-2 rounded-lg text-[0.5rem] sm:text-[0.55rem] text-[#8ab4f8]/80 leading-relaxed text-justify max-w-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <strong className="text-[#00f0ff]">POLÍTICA DO ECOSSISTEMA:</strong>{" "}
            opera em{" "}
            <span className="text-[#00ffaa] font-bold">
              modo somente-leitura (READ_ONLY / FAIL_CLOSED)
            </span>
            . Nenhum valor é simulado: todo número vem de feed público real ou
            aparece como{" "}
            <span className="text-[#00f0ff] font-bold">AGUARDANDO</span>. Sem
            ordens, sem chaves de API, sem posição ao vivo.
          </div>
        </div>
      </div>
    );
  }

  // Único ponto de montagem é o centro do cockpit (inCenter) — a antiga
  // variante FAB flutuante nunca era montada e foi removida como código
  // morto na consolidação RC1.
  return null;
}

const LevelCard = React.memo(function LevelCard({
  label,
  value,
  accent,
  tag,
  dim,
}: {
  label: string;
  value: number | null;
  accent: string;
  tag: string;
  dim?: boolean;
}) {
  const has = num(value);
  return (
    <div
      className="p-2 sm:p-3 rounded-lg border flex flex-col relative overflow-hidden transition-colors"
      style={{
        background: `${accent}08`,
        borderColor: `${accent}20`,
        opacity: dim || !has ? 0.55 : 1,
      }}
    >
      <div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ background: accent }}
      ></div>
      <div className="flex justify-between items-center pl-1 sm:pl-2 w-full">
        <span
          className="text-[0.5rem] sm:text-[0.55rem] tracking-[0.2em] font-bold uppercase"
          style={{ color: `${accent}cc` }}
        >
          {label}
        </span>
        <span
          className="text-[0.5rem] font-bold border px-1 rounded"
          style={{ color: accent, borderColor: `${accent}30`, background: `${accent}10` }}
        >
          {tag}
        </span>
      </div>
      <div className="flex items-end mt-1 pl-1 sm:pl-2">
        <span
          className="text-base sm:text-lg font-black font-mono tracking-tight"
          style={{ color: has ? "#ffffff" : "rgba(255,255,255,0.25)" }}
        >
          {has ? fmt(value) : AWAIT}
        </span>
      </div>
    </div>
  );
});

// --- TOP BAR ---
function TopBar({
  data,
  derivatives,
  crossExchangeCheck,
  okxCrossExchangeCheck,
}: {
  data?: PriceState | null;
  derivatives: DerivativesState;
  crossExchangeCheck: CrossExchangeCheck;
  okxCrossExchangeCheck: CrossExchangeCheck;
}) {
  const {
    bootAt,
    handleManualRestart,
    selectedAsset,
    setSelectedAsset,
    criticalPulse,
    marketMode,
    setMarketMode,
    selectedTradFiAsset,
    setSelectedTradFiAsset,
    realCycle,
  } = useContext(WidgetContext) || {};
  // Overhaul Cross-Market (Diretriz 2): o rótulo do mercado é passthrough
  // REAL de realCycle.instrumentType (mesmo padrão de wasmVariant) — nunca
  // uma string fixa. Antes de qualquer ciclo bem-sucedido (ou se o fetch
  // de futuros falhar), fica AGUARDANDO honesto em vez de afirmar
  // "Futures/Perp" sem ter recebido dado real nenhum.
  const cryptoMarketLabel =
    realCycle?.instrumentType === "crypto_futures"
      ? "Futures/Perp"
      : realCycle?.instrumentType === "crypto_spot"
        ? "Spot"
        : AWAIT;
  const isPos = (data?.deltaPct ?? 0) >= 0;
  const [uptime, setUptime] = useState("");

  useEffect(() => {
    const t = setInterval(() => {
      if (!bootAt) return;
      const s = Math.floor((Date.now() - bootAt) / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setUptime(
        `${h.toString().padStart(2, "0")}:${m
          .toString()
          .padStart(2, "0")}:${sec.toString().padStart(2, "0")}`,
      );
    }, 1000);
    return () => clearInterval(t);
  }, [bootAt]);

  const funding = derivatives.fundingRate;
  const oi = derivatives.openInterest;

  return (
    // Barra de comando unificada (protocolo "Refinamento Visual Absoluto"
    // §1/§2): o antigo cabeçalho isolado + a faixa essencial viraram UMA
    // barra de alta densidade em duas linhas dentro do mesmo contêiner.
    // Cada dado aparece exatamente uma vez em toda a tela: o preço vive só
    // aqui (o chip Preço da faixa e o overlay gigante do gráfico foram
    // removidos), variação 24h só aqui, HIGH/VOL só aqui, READ-ONLY e a
    // marca AR10 CYBORG só no rodapé, e FEED sumiu porque "DADOS n/4" da faixa
    // já conta o mesmo WebSocket. O pulso crítico (DCI) acende o anel da
    // barra inteira — sem apagar o resto da tela.
    <div
      className={`shrink-0 z-20 bg-[#010308]/95 backdrop-blur-xl border-b transition-[border-color,box-shadow] duration-500 ${
        criticalPulse
          ? "border-[#00f0ff] shadow-[0_0_24px_rgba(0,240,255,0.35)]"
          : "border-[#00f0ff25] shadow-[0_2px_15px_rgba(0,0,0,0.5)]"
      }`}
    >
      <div className="h-[46px] flex items-center justify-between gap-2 px-3 lg:px-5">
        <div className="flex gap-2 md:gap-3 h-full items-center min-w-0">
          <div className="flex items-center gap-2 pr-2 md:pr-3 border-r border-[#00f0ff20] h-[70%]">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                marketMode === "TRADFI"
                  ? "bg-[#b026ff20] border border-[#b026ff40] shadow-[0_0_10px_rgba(176,38,255,0.25)]"
                  : selectedAsset === "BTC"
                    ? "bg-[#f7931a] shadow-[0_0_10px_rgba(247,147,26,0.4)]"
                    : "bg-[#00f0ff20] border border-[#00f0ff40] shadow-[0_0_10px_rgba(0,240,255,0.2)]"
              }`}
            >
              <span className="text-white font-bold text-xs">
                {marketMode === "TRADFI"
                  ? (selectedTradFiAsset?.symbol?.[0] ?? "?")
                  : selectedAsset === "BTC"
                    ? "₿"
                    : selectedAsset?.[0]}
              </span>
            </div>
            <div className="text-[#a0f0ff] font-black text-sm flex items-center gap-1.5 whitespace-nowrap">
              {marketMode === "TRADFI" ? selectedTradFiAsset?.symbol : `${selectedAsset}/USDT`}{" "}
              <span
                className={`text-[0.5rem] px-1 py-0.5 rounded uppercase tracking-wider ${
                  marketMode === "TRADFI" ? "bg-[#b026ff20] text-[#b026ff]" : "bg-[#00f0ff20] text-[#00f0ff]"
                }`}
              >
                {marketMode === "TRADFI" ? "Macro" : cryptoMarketLabel}
              </span>
            </div>
          </div>

          {/* Smart Omnibox (Overhaul Missão 2) — substitui os 5 botões fixos
              como forma PRIMÁRIA de trocar de ativo: busca categorizada
              multi-mercado (cripto/meme real via Binance + taxonomia
              TradFi para conexão futura). Os 5 favoritos ficam como atalho
              de um toque ao lado, em telas largas o bastante. */}
          <div className="flex items-center gap-1.5 pr-2 md:pr-3 border-r border-[#00f0ff20] h-[70%]">
            <div className="hidden lg:flex items-center gap-1">
              {ASSETS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setMarketMode?.("CRYPTO");
                    setSelectedTradFiAsset?.(null);
                    setSelectedAsset?.(a);
                  }}
                  className={`px-1.5 py-1 rounded text-[0.5rem] font-bold tracking-wider transition-colors ${
                    marketMode === "CRYPTO" && selectedAsset === a
                      ? "bg-[#00f0ff20] text-[#00f0ff] border border-[#00f0ff40]"
                      : "text-[#8ab4f8]/50 hover:text-[#8ab4f8] border border-transparent"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <SmartOmnibox
              selectedLabel={marketMode === "TRADFI" ? (selectedTradFiAsset?.symbol ?? "Buscar ativo") : "Buscar ativo"}
              onSelectCrypto={(baseAsset: string) => {
                setMarketMode?.("CRYPTO");
                setSelectedTradFiAsset?.(null);
                setSelectedAsset?.(baseAsset);
              }}
              onSelectTradFi={(asset: TradFiAsset) => {
                setMarketMode?.("TRADFI");
                setSelectedTradFiAsset?.(asset);
              }}
            />
          </div>

          {/* O preço — única ocorrência em toda a interface. Em modo
              TRADFI não existe fonte real ligada (fail-closed, Missão 2
              diretriz 4): mostra o rótulo honesto em vez de um preço de
              cripto sem nenhuma relação com o ativo selecionado. */}
          {marketMode === "TRADFI" ? (
            <div className="flex items-center gap-1.5 pr-2 md:pr-3 border-r border-[#00f0ff20] whitespace-nowrap">
              <span className="text-[0.55rem] font-bold text-[#8ab4f8]/50 uppercase tracking-wider">
                {AWAIT} · Macro API
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5 pr-2 md:pr-3 border-r border-[#00f0ff20] whitespace-nowrap">
              <span
                className={`text-base md:text-lg font-black font-mono tracking-tight drop-shadow-[0_0_6px_currentColor] ${
                  isPos ? "text-[#00ffaa]" : "text-[#ff0055]"
                }`}
              >
                {fmt(data?.price ?? null)}
              </span>
              <span
                className={`text-[0.55rem] font-bold ${isPos ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
              >
                {fmtSignedPct(data?.deltaPct ?? null)}
              </span>
            </div>
          )}

          {marketMode === "CRYPTO" && (
            <div className="hidden md:flex gap-1 lg:gap-2 h-full items-center">
              <TopStat
                label="24H HIGH"
                value={fmt(data?.high ?? null)}
                color="text-[#a0f0ff]"
                className="hidden xl:flex"
              />
              <TopStat
                label="24H LOW"
                value={fmt(data?.low ?? null)}
                color="text-[#a0f0ff]"
                className="hidden xl:flex"
              />
              <TopStat
                label={`24H VOL (${selectedAsset})`}
                value={fmtInt(data?.volume ?? null)}
                color="text-[#a0f0ff]"
                className="hidden lg:flex"
              />
              <TopStat
                label="FUNDING / 8H"
                value={num(funding) ? `${(funding * 100).toFixed(4)}%` : DASH}
                color="text-[#f7931a]"
              />
              <TopStat
                label="OPEN INTEREST"
                value={num(oi) ? `${fmtInt(oi)} ${selectedAsset}` : DASH}
                color="text-[#a0f0ff]"
              />
              {/* Master Panel handoff (Multi-Source Market Data Fusion,
                  escopo reduzido a 1 fonte adicional): cross-check real
                  Binance-vs-Bybit — puramente informativo, nunca um sinal.
                  INDISPONIVEL honesto (nunca "0.000%" fabricado) antes do
                  primeiro ciclo real ou se o Bybit não responder. */}
              <TopStat
                label="BYBIT Δ"
                value={
                  crossExchangeCheck.consensus === "INDISPONIVEL" || crossExchangeCheck.priceDeltaPct === null
                    ? DASH
                    : `${crossExchangeCheck.priceDeltaPct.toFixed(3)}%`
                }
                color={
                  crossExchangeCheck.consensus === "ALINHADO"
                    ? "text-[#00ffaa]"
                    : crossExchangeCheck.consensus === "DIVERGENTE"
                      ? "text-[#ff0055]"
                      : "text-[#a0f0ff]"
                }
                className="hidden xl:flex"
              />
              {/* Terceira fonte real (OKX) — mesmo papel puramente
                  informativo da BYBIT Δ acima. */}
              <TopStat
                label="OKX Δ"
                value={
                  okxCrossExchangeCheck.consensus === "INDISPONIVEL" || okxCrossExchangeCheck.priceDeltaPct === null
                    ? DASH
                    : `${okxCrossExchangeCheck.priceDeltaPct.toFixed(3)}%`
                }
                color={
                  okxCrossExchangeCheck.consensus === "ALINHADO"
                    ? "text-[#00ffaa]"
                    : okxCrossExchangeCheck.consensus === "DIVERGENTE"
                      ? "text-[#ff0055]"
                      : "text-[#a0f0ff]"
                }
                className="hidden xl:flex"
              />
            </div>
          )}
        </div>

        <div className="flex gap-1 md:gap-2 h-full items-center justify-end shrink-0">
          <TopStat label="SESSÃO" value={uptime || DASH} color="text-white" />
          <button
            type="button"
            onClick={handleManualRestart}
            title="Forçar reconexão de todos os feeds reais"
            className="ml-1 w-8 h-8 rounded-full border border-[#00f0ff40] bg-[#00f0ff08] flex items-center justify-center text-[#00f0ff] hover:bg-[#00f0ff20] active:scale-95 transition-all shadow-[0_0_10px_rgba(0,240,255,0.15)] animate-pulse"
          >
            <Power size={14} />
          </button>
        </div>
      </div>

      {/* Linha 2 — faixa de decisão (DCI item 1), agora parte da mesma
          barra: os campos decisão-críticos continuam visíveis antes de
          qualquer scroll, em todas as abas e orientações. */}
      <EssentialStrip />
    </div>
  );
}
interface TopStatProps {
  label: string;
  value: string | number;
  color: string;
  className?: string;
}

// V11.5 §13 auto-otimização: subValue/subColor/active existiam só para os
// chips MODO e FEED, removidos na consolidação da barra única (DADOS n/4 na
// faixa essencial já cobre o mesmo sinal de WebSocket). Nenhum caller restante
// os usa — confirmado via grep antes de remover, não suposição.
const TopStat = React.memo(function TopStat({
  label,
  value,
  color,
  className = "",
}: TopStatProps) {
  return (
    <div className={`flex flex-col justify-center min-w-[85px] h-[36px] px-2.5 rounded transition-colors hover:bg-white/5 ${className}`}>
      <span className="text-[0.45rem] text-[#8ab4f8] tracking-[0.15em] mb-[2px] text-center font-bold">
        {label}
      </span>
      <div className="flex items-center justify-center gap-1.5 leading-none">
        <span className={`text-[0.65rem] font-bold tracking-widest ${color}`}>
          {value}
        </span>
      </div>
    </div>
  );
});

// --- SIDE BAR ---
function SideBar({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
}) {
  const { setWorkspaceManagerOpen } = useContext(WidgetContext) || {};
  // Fusão visual (imagem de referência AR10 CYBORG v15.1 GOD TIER):
  // id é o valor real de roteamento (só "DASHBOARD" e "SETTINGS" têm
  // comportamento próprio, ver o ternário logo abaixo de "DASHBOARD" ?
  // ... : "SETTINGS" ? ... : AGUARDANDO); label é só o texto exibido —
  // desacoplar os dois deixa os nomes do menu iguais aos da imagem sem
  // tocar em nenhuma lógica de roteamento real. As 7 abas que não são
  // COCKPIT/CONFIGURAÇÕES continuam o mesmo placeholder honesto
  // "AGUARDANDO FONTE DE DADOS REAL" que já usavam — nenhuma delas fica
  // com uma alegação de dado real que este terminal não tem.
  const items: { icon: any; id: string; label: string }[] = [
    { icon: LayoutDashboard, id: "DASHBOARD", label: "COCKPIT" },
    { icon: BarChart2, id: "MERCADOS", label: "MERCADOS" },
    { icon: Activity, id: "ANÁLISES", label: "ANÁLISES" },
    { icon: ShieldCheck, id: "RISCOS", label: "RISCOS" },
    { icon: Zap, id: "EXECUÇÃO", label: "EXECUÇÃO" },
    { icon: Scan, id: "SCANNER", label: "SCANNER" },
    { icon: Newspaper, id: "NOTÍCIAS", label: "NOTÍCIAS" },
    { icon: Bell, id: "ALERTAS", label: "ALERTAS" },
    { icon: Settings, id: "SETTINGS", label: "CONFIGURAÇÕES" },
  ];
  return (
    <div className="w-[60px] md:w-[70px] border-r border-[#00f0ff20] bg-[#010308]/95 flex flex-col items-center py-3 gap-5 shrink-0 z-10 overflow-y-auto scrollbar-hide backdrop-blur-md">
      <div className="relative mb-1">
        <Target className="text-[#00f0ff] opacity-90" size={20} strokeWidth={1.5} />
        <div className="absolute inset-0 border border-[#00f0ff] rounded-full animate-ping opacity-30"></div>
      </div>
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <div
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 w-full cursor-pointer transition-colors relative py-1.5 ${isActive ? "text-[#00f0ff] bg-gradient-to-r from-[#00f0ff1a] to-transparent" : "text-[#8ab4f8]/50 hover:text-[#8ab4f8]"}`}
          >
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]"></div>
            )}
            <item.icon size={16} className="relative z-10" />
            <span className="text-[0.42rem] md:text-[0.45rem] tracking-[0.1em] text-center font-bold mt-1">
              {item.label}
            </span>
          </div>
        );
      })}
      {/* V16 Workspace Manager entry point — a single, discoverable way in
          to the Pinned/Docked/Collapsed/Hidden/Floating controls for every
          secondary module, instead of a gear icon per module. Pinned to
          the bottom (mt-auto) like the reference layout's footer link. */}
      <button
        type="button"
        onClick={() => setWorkspaceManagerOpen?.((v: boolean) => !v)}
        title="Workspace Manager"
        className="mt-auto flex flex-col items-center gap-1 w-full cursor-pointer transition-colors text-[#8ab4f8]/50 hover:text-[#00f0ff] py-1.5 shrink-0"
      >
        <LayoutGrid size={16} className="relative z-10" />
        <span className="text-[0.4rem] md:text-[0.42rem] tracking-[0.08em] text-center font-bold mt-1 leading-tight">
          WORKSPACE
          <br />
          MANAGER
        </span>
      </button>
    </div>
  );
}

// --- WIDGET ERROR BOUNDARY ---
// A single widget's render can throw on a real but unanticipated data shape
// (e.g. an exchange response schema change) — this must never take down the
// rest of the cockpit. Error boundaries have no hook equivalent; a class
// component is the only way React supports catching render errors.
interface WidgetErrorBoundaryState {
  hasError: boolean;
}
class WidgetErrorBoundary extends React.Component<
  { title?: string; children: React.ReactNode },
  WidgetErrorBoundaryState
> {
  constructor(props: { title?: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-1 text-center px-2">
          <span className="text-[0.5rem] tracking-[0.15em] text-[#ff0055] font-bold uppercase">
            {this.props.title || "PAINEL"} · ERRO DE RENDERIZAÇÃO
          </span>
          <span className="text-[0.45rem] text-[#8ab4f8]/50">
            Os demais painéis continuam ativos.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- WIDGET WRAPPER ---
function Widget({ id, children, title, className = "", flex = "flex-1", extraHeader }: any) {
  const { widgets, toggleWidget } = useContext(WidgetContext) || {};
  const [maximized, setMaximized] = useState(false);
  // Collapse is a persisted Workspace Manager state (V16) for any widget
  // with an id — a reload or a toggle from the Workspace Manager panel must
  // agree with the header's own "_" control. Widgets with no id (e.g. the
  // always-on left/right V16 cards) fall back to local-only state, same as
  // before this change.
  const [localMinimized, setLocalMinimized] = useState(false);

  const widgetState = id && widgets ? widgets[id] : null;
  if (widgetState && !widgetState.visible) return null;

  const minimized = widgetState ? widgetState.collapsed : localMinimized;
  const setMinimized = (next: boolean) => {
    if (widgetState) {
      if (next !== widgetState.collapsed) toggleWidget(id, "collapsed");
    } else {
      setLocalMinimized(next);
    }
  };

  const isFloating = widgetState && widgetState.floating;

  const renderHeader = (isFloatMode = false) => (
    // flex-wrap: em Slide Over/Split View estreito (≤375px) o grupo de
    // controles (extraHeader + minimizar/fechar) quebra para a linha de
    // baixo em vez de estourar a borda direita do painel.
    <div
      className="cyber-header cursor-pointer select-none flex flex-wrap items-center justify-between gap-y-1"
      onDoubleClick={(e) => {
        if (!isFloatMode) {
          e.stopPropagation();
          setMaximized(!maximized);
        }
      }}
    >
      <span className="font-bold tracking-[0.2em] min-w-0">{title}</span>
      <div className="flex gap-2 items-center max-w-full flex-wrap">
        {extraHeader && <div className="min-w-0">{extraHeader}</div>}
        <div className="flex gap-1">
          {!maximized && !isFloatMode && (
            <div
              className="text-[#8ab4f8]/50 hover:text-[#00f0ff] px-1 py-0.5 rounded cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setMinimized(true);
              }}
              title="Minimizar"
            >
              _
            </div>
          )}
          {/* Visible expand/restore toggle — previously the ONLY way to
              maximize a panel was an undocumented double-click on the
              header, with zero visual affordance. This makes the exact
              same existing `maximized` mechanism discoverable. */}
          {!isFloatMode && (
            <div
              className={`px-1 py-0.5 rounded cursor-pointer ${maximized ? "text-[#00f0ff] bg-[#00f0ff10] border border-[#00f0ff30]" : "text-[#8ab4f8]/50 hover:text-[#00f0ff]"}`}
              onClick={(e) => {
                e.stopPropagation();
                setMaximized(!maximized);
              }}
              title={maximized ? "Restaurar" : "Tela cheia"}
            >
              {maximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </div>
          )}
          {widgetState && (
            <div
              className="text-[#ff0055]/50 hover:text-[#ff0055] px-1 py-0.5 rounded cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                toggleWidget(id, "visible");
              }}
            >
              <X size={12} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isFloating) {
    return (
      <Rnd
        default={{ x: 100, y: 100, width: 400, height: 350 }}
        minWidth={250}
        minHeight={200}
        bounds="window"
        dragHandleClassName="cyber-header"
        style={{ zIndex: 1000 }}
      >
        <div
          className={`cyber-panel w-full h-full flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.2)] bg-[#010308]/95 backdrop-blur-xl ${className}`}
        >
          {title && renderHeader(true)}
          <div className="flex-1 min-h-0 relative p-2 overflow-hidden flex flex-col z-10">
            <div className="cyber-scanline z-0"></div>
            <WidgetErrorBoundary title={title}>{children}</WidgetErrorBoundary>
          </div>
        </div>
      </Rnd>
    );
  }

  if (minimized) {
    return (
      <div
        className={`cyber-panel shrink-0 h-[32px] transition-all cursor-pointer hover:bg-[#00f0ff10] border-[#00f0ff30] opacity-70 hover:opacity-100 ${className}`}
        onClick={() => setMinimized(false)}
      >
        <div className="cyber-header border-none h-full bg-transparent flex items-center justify-between">
          <span className="font-bold tracking-[0.2em]">{title}</span>
          <div className="text-[#00f0ff] font-bold px-2 hover:text-white">[]</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        maximized
          ? // `!` (important) is required on position/inset/z-index here:
            // .cyber-panel's own `position: relative` rule (index.css) is
            // textually AFTER Tailwind's generated utilities in the compiled
            // stylesheet (it follows @import "tailwindcss" in the same
            // file), so a plain `fixed` utility loses the cascade to it —
            // confirmed via getComputedStyle: without `!`, this panel
            // computed position:relative and stayed pinned at its normal
            // in-flow size instead of covering the viewport. This is why
            // "maximize" silently never worked at all, hidden or not.
            `!fixed !inset-2 md:!inset-8 !z-50 cyber-panel flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.2)] bg-[#010308]/95 backdrop-blur-xl`
          : // min-h-0 is scoped to the landscape 3-column breakpoint on purpose:
            // that layout gives each column a real h-full + overflow-y-auto
            // container, and min-h-0 is what lets flex-grow actually
            // distribute that fixed height among a column's widgets. Below
            // 1120px the columns stack with no bounded parent height (by
            // design — the whole page scrolls instead), so forcing min-h-0
            // there collapsed every widget toward its header (confirmed:
            // chart panel measured 113px/9% of viewport in iPad Air
            // portrait). The content wrapper just below is `overflow-hidden`
            // though, which per spec disables flexbox's automatic
            // content-based minimum size entirely (not just "sets it to
            // 0" — the browser doesn't crawl into overflow:hidden content
            // at all), so plain min-height:auto alone doesn't recover a
            // usable size here the way it did for the three column divs.
            // A real, explicit floor is required; 180px is a sane default
            // for compact list/ticker widgets, callers needing more (the
            // chart) pass a larger min-h-[Npx] via their own `flex` prop,
            // which wins over this default (same mechanism already proven
            // by NeuralCoreWidget's min-h-[160px]).
            `cyber-panel ${flex} ${className} min-h-[180px] min-[1120px]:min-h-0 transition-all`
      }
    >
      {title && renderHeader(false)}
      <div
        className="flex-1 min-h-0 relative p-2 overflow-hidden flex flex-col z-10"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="cyber-scanline z-0"></div>
        <WidgetErrorBoundary title={title}>{children}</WidgetErrorBoundary>
      </div>
    </div>
  );
}

// --- CHART WIDGET ---
// Zoom windows over the SAME real 15m candles already fetched (no new
// fetch, no fabricated data) — fewer candles visible = each one gets more
// horizontal room, same principle as any real charting tool's zoom.
const CHART_ZOOM_STEPS = [12, 20, 30, 50];

function ChartWidget({ data, chartData }: any) {
  // Real Fair Value Gaps / Order Blocks / Liquidity zones — computed once
  // in App() (see contextValue) against this exact candle array, shared
  // with the Neural Core widget's tactical-context prompt so both use the
  // same real counts rather than two independent computations.
  const { smcZones, selectedAsset, engine } = useContext(WidgetContext) || {};
  const [zoomStep, setZoomStep] = useState(CHART_ZOOM_STEPS.length - 1);
  const visibleCount = CHART_ZOOM_STEPS[zoomStep];
  const zoomedData = chartData && chartData.length > 0 ? chartData.slice(-visibleCount) : chartData;
  const canZoomIn = zoomStep > 0;
  const canZoomOut = zoomStep < CHART_ZOOM_STEPS.length - 1;

  // smcZones' indices are relative to the FULL chartData array (computed
  // once in App()). Zooming shows only the last `visibleCount` candles, so
  // every zone's index needs the same offset subtracted or it would point
  // at the wrong candle (or land off-screen entirely). Zones that belong to
  // a candle scrolled out of the zoomed window are dropped, not clamped —
  // showing them at the edge would misrepresent where they actually are.
  const zoomOffset = chartData && chartData.length > 0 ? Math.max(chartData.length - visibleCount, 0) : 0;
  const zoomedZones = useMemo(() => {
    if (!smcZones) return smcZones;
    const remap = <T extends { index: number }>(arr: T[]): T[] =>
      arr.filter((z) => z.index - zoomOffset >= 0).map((z) => ({ ...z, index: z.index - zoomOffset }));
    return {
      fairValueGaps: remap(smcZones.fairValueGaps ?? []),
      orderBlocks: remap(smcZones.orderBlocks ?? []),
      liquidityZones: remap(smcZones.liquidityZones ?? []),
    };
  }, [smcZones, zoomOffset]);

  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Widget
      id="chart"
      title={`GRÁFICO · ${selectedAsset ?? ""}/USDT`}
      flex="flex-[1.8] min-h-[320px]"
      extraHeader={
        <div className="flex items-center gap-1 text-[0.45rem]">
          {["1M", "5M", "15M", "1H", "4H", "1D"].map((tf) => (
            <span
              key={tf}
              className={`px-1 rounded ${tf === "15M" ? "bg-[#00f0ff20] text-[#00f0ff] font-bold border border-[#00f0ff40]" : "text-[#8ab4f8]/60"}`}
            >
              {tf}
            </span>
          ))}
          <div className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-[#8ab4f8]/20">
            <button
              type="button"
              onClick={(e) => {
                stopBubble(e);
                setZoomStep((z) => Math.min(z + 1, CHART_ZOOM_STEPS.length - 1));
              }}
              onDoubleClick={stopBubble}
              disabled={!canZoomOut}
              title="Diminuir zoom"
              className="p-0.5 rounded text-[#8ab4f8]/60 hover:text-[#00f0ff] disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ZoomOut size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                stopBubble(e);
                setZoomStep((z) => Math.max(z - 1, 0));
              }}
              onDoubleClick={stopBubble}
              disabled={!canZoomIn}
              title="Aumentar zoom"
              className="p-0.5 rounded text-[#8ab4f8]/60 hover:text-[#00f0ff] disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ZoomIn size={11} />
            </button>
            <span className="text-[#8ab4f8]/40 tabular-nums">{visibleCount}</span>
          </div>
        </div>
      }
    >
      {/* Zero repetição (protocolo §2): o antigo overlay com símbolo/preço
          gigante/variação/HIGH/VOL duplicava — em dobro ou triplo — dados que
          agora têm ocorrência única na barra de comando unificada. Removido
          por inteiro; o espaço vertical recuperado (~50px) vai para as velas
          (prioridade do gráfico, V11 §7). O título do Widget carrega o
          símbolo, necessário quando o gráfico está maximizado cobrindo a
          barra; a tag de último preço no eixo é parte intrínseca do gráfico. */}
      <div className="flex-1 mt-1 mr-8 relative min-h-0">
        {zoomedData && zoomedData.length > 0 ? (
          <CandleChart
            data={zoomedData}
            last={data?.price ?? null}
            zones={zoomedZones}
            support={engine?.support ?? null}
            resistance={engine?.resistance ?? null}
            supportStrength={engine?.supportStrength ?? null}
            resistanceStrength={engine?.resistanceStrength ?? null}
            supportBreakouts={engine?.supportBreakouts ?? 0}
            resistanceBreakouts={engine?.resistanceBreakouts ?? 0}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
            {AWAIT} CANDLES…
          </div>
        )}
      </div>
    </Widget>
  );
}

// Split so the expensive part (100 candles -> ~200 SVG nodes) only
// re-renders when the candle window itself changes (~every 60s), not on
// every live ticker tick (~1/s) that only moves the last-price marker.
function CandleChart({
  data,
  last,
  zones,
  support,
  resistance,
  supportStrength,
  resistanceStrength,
  supportBreakouts,
  resistanceBreakouts,
}: {
  data: any[];
  last: number | null;
  zones?: { fairValueGaps: PriceZone[]; orderBlocks: PriceZone[]; liquidityZones?: LiquidityZone[] };
  support?: number | null;
  resistance?: number | null;
  supportStrength?: { label: "FORTE" | "FRACA"; touches: number } | null;
  resistanceStrength?: { label: "FORTE" | "FRACA"; touches: number } | null;
  supportBreakouts?: number;
  resistanceBreakouts?: number;
}) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data.map((d) => d.low));
  const max = Math.max(...data.map((d) => d.high));
  const range = max - min || 1;
  const lastY = num(last) ? 100 - ((last - min) / range) * 100 : null;
  const priceToPct = (price: number) => 100 - ((price - min) / range) * 100;

  // Only unmitigated/unswept zones — the ones still "live" for a trader to
  // watch. Capped so a busy 100-candle window doesn't turn into a wall of
  // boxes/lines.
  const unmitigatedFvgs = (zones?.fairValueGaps ?? []).filter((z) => !z.mitigated).slice(0, 3);
  const unmitigatedBlocks = (zones?.orderBlocks ?? []).filter((z) => !z.mitigated).slice(0, 3);
  const unsweptLiquidity = (zones?.liquidityZones ?? []).filter((z) => !z.swept).slice(0, 4);

  return (
    <div className="absolute inset-0 border-b border-[#00f0ff20]">
      {/* V16 §3 (Chart Engine institucional): R1/S1 — o nível de suporte/
          resistência mais próximo já usado pelo Risk Engine/S.E. (mesmo
          engine.support/resistance exibido em outros cards), com força e
          contagem REAIS de toques/rompimentos (ver countBreakouts em
          App()) — nunca um número inventado. Uma linha por nível (não o
          par completo S1/S2/R1/R2) para não poluir o gráfico; o detalhe
          completo fica no card compacto (MarketBiasDecisionCard). */}
      {num(resistance) && (
        <div
          className="absolute pointer-events-none border-t border-dashed border-[#ff0055]/60 flex items-center justify-end"
          style={{ top: `${priceToPct(resistance)}%`, left: 0, right: 0 }}
        >
          <span className="text-[0.42rem] font-bold text-[#ff0055] bg-[#010308]/70 px-[3px] leading-none -translate-y-1/2">
            R1 {fmtInt(resistance)}
            {resistanceStrength
              ? ` · ${resistanceStrength.label} · ${resistanceStrength.touches}× retest · ${resistanceBreakouts ?? 0}× romp.`
              : ""}
          </span>
        </div>
      )}
      {num(support) && (
        <div
          className="absolute pointer-events-none border-t border-dashed border-[#00ffaa]/60 flex items-center justify-end"
          style={{ top: `${priceToPct(support)}%`, left: 0, right: 0 }}
        >
          <span className="text-[0.42rem] font-bold text-[#00ffaa] bg-[#010308]/70 px-[3px] leading-none -translate-y-1/2">
            S1 {fmtInt(support)}
            {supportStrength
              ? ` · ${supportStrength.label} · ${supportStrength.touches}× retest · ${supportBreakouts ?? 0}× romp.`
              : ""}
          </span>
        </div>
      )}
      {unsweptLiquidity.map((z, i) => (
        <div
          key={`liq-${z.index}-${i}`}
          className="absolute pointer-events-none border-t border-dashed border-[#f0d06f]/50 flex items-center"
          style={{ top: `${priceToPct(z.price)}%`, left: `${(z.index / data.length) * 100}%`, right: 0 }}
        >
          <span className="text-[0.42rem] font-bold text-[#f0d06f]/70 bg-[#010308]/60 px-[3px] leading-none -translate-y-1/2">
            {z.type === "EQUAL_HIGH" ? "EQH" : "EQL"} ×{z.touches}
          </span>
        </div>
      ))}
      {unmitigatedFvgs.map((z, i) => (
        <div
          key={`fvg-${z.index}-${i}`}
          className={`absolute pointer-events-none ${z.type === "BULLISH" ? "bg-[#00ffaa]/[0.06] border-y border-[#00ffaa]/25" : "bg-[#ff0055]/[0.06] border-y border-[#ff0055]/25"}`}
          style={{
            top: `${priceToPct(z.top)}%`,
            height: `${Math.max(priceToPct(z.bottom) - priceToPct(z.top), 0.6)}%`,
            left: `${(z.index / data.length) * 100}%`,
            right: 0,
          }}
        />
      ))}
      {unmitigatedBlocks.map((z, i) => (
        <div
          key={`ob-${z.index}-${i}`}
          className={`absolute pointer-events-none border-dashed ${z.type === "BULLISH" ? "border-[#00ffaa]/40" : "border-[#ff0055]/40"}`}
          style={{
            top: `${priceToPct(z.top)}%`,
            height: `${Math.max(priceToPct(z.bottom) - priceToPct(z.top), 0.6)}%`,
            left: `${(z.index / data.length) * 100}%`,
            right: 0,
            borderTopWidth: 1,
            borderBottomWidth: 1,
          }}
        />
      ))}
      <CandlesSvg data={data} />
      {lastY !== null && (
        <div
          className="absolute right-[-36px] text-[0.45rem] font-bold text-[#010308] bg-[#00ffaa] px-[4px] py-[2px] rounded shadow-[0_0_10px_#00ffaa] translate-y-[-50%] border border-[#00ffaa] flex items-center gap-1"
          style={{ top: `${lastY}%` }}
        >
          <div className="w-1 h-1 bg-[#010308] rounded-full animate-ping opacity-70"></div>
          {fmtInt(last)}
        </div>
      )}
    </div>
  );
}

const CandlesSvg = React.memo(function CandlesSvg({ data }: { data: any[] }) {
  const min = Math.min(...data.map((d) => d.low));
  const max = Math.max(...data.map((d) => d.high));
  const range = max - min || 1;

  const polyPoints = data
    .map((d, i) => {
      const xPos = ((i + 0.5) / data.length) * 100;
      const yPos = 100 - ((d.close - min) / range) * 100;
      return `${xPos},${yPos}`;
    })
    .join(" ");

  return (
    <>
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <div
          key={pct}
          className="absolute left-0 right-0 border-t border-white/5 pointer-events-none"
          style={{ top: `${pct * 100}%` }}
        ></div>
      ))}
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        className="overflow-visible absolute inset-0 z-0 opacity-20"
      >
        <defs>
          <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${polyPoints} 100,100`} fill="url(#glowGrad)" />
      </svg>

      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        className="overflow-visible absolute inset-0 z-10"
      >
        <defs>
          <filter id="glow-up">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-down">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {data.map((d, i) => {
          const yHigh = 100 - ((d.high - min) / range) * 100 + "%";
          const yLow = 100 - ((d.low - min) / range) * 100 + "%";
          const yOpen = 100 - ((d.open - min) / range) * 100 + "%";
          const yClose = 100 - ((d.close - min) / range) * 100 + "%";
          const isUp = d.close >= d.open;
          const color = isUp ? "#00ffaa" : "#ff0055";
          const filter = isUp ? "url(#glow-up)" : "url(#glow-down)";
          const boxTop = isUp ? yClose : yOpen;
          const rawHeight = Math.abs(((d.close - d.open) / range) * 100);
          const boxHeight = Math.max(0.5, rawHeight) + "%";
          const xPos = `${((i + 0.5) / data.length) * 100}%`;
          const xRect = `${((i + 0.1) / data.length) * 100}%`;
          const wRect = `${(0.8 / data.length) * 100}%`;
          return (
            <g key={i}>
              <line x1={xPos} y1={yHigh} x2={xPos} y2={yLow} stroke={color} strokeWidth="1" opacity={0.5} />
              <rect x={xRect} y={boxTop} width={wRect} height={boxHeight} fill={color} filter={filter} />
            </g>
          );
        })}
      </svg>

      <div className="absolute -right-9 top-0 bottom-0 flex flex-col justify-between text-[0.45rem] text-[#8ab4f8]/70 text-right w-8 translate-y-[-4px]">
        <span>{fmt(max)}</span>
        <span>{fmt((max * 3 + min) / 4)}</span>
        <span>{fmt((max + min) / 2)}</span>
        <span>{fmt((max + min * 3) / 4)}</span>
        <span className="translate-y-[8px]">{fmt(min)}</span>
      </div>
    </>
  );
});

// --- ORDER FLOW WIDGET ---
function OrderFlowWidget() {
  const { engine, orderflowState, orderflowReason, orderflowSignals, cvd } =
    useContext(WidgetContext) || {};
  const buyPercent: number | null = engine?.buyPercent ?? null;
  const sellPercent: number | null = engine?.sellPercent ?? null;
  const delta: number | null = engine?.delta ?? null;
  const imbalance: number | null = engine?.imbalance ?? null;
  const cvdValue: number | null = num(cvd) ? cvd : null;

  const signals: OrderflowSignal[] = orderflowSignals ?? [];
  const ofState: string = orderflowState ?? "pending";
  const ofColor =
    ofState === "LIVE" ? "text-[#00ffaa]" : ofState === "ERROR" ? "text-[#ff0055]" : "text-[#f0d06f]";
  const signalColor = (t: string) =>
    t === "EXHAUSTION" ? "text-[#ff0055]" : t === "ABSORPTION" ? "text-[#f0d06f]" : "text-[#00ffaa]";

  return (
    <Widget id="orderflow" title="FLUXO DE ORDENS · LIVRO REAL" flex="flex-[0.85] min-h-[110px]">
      <div className="flex flex-col h-full justify-between gap-1 py-1">
        <div className="flex justify-between items-center px-1">
          <FlowMetric
            label="DELTA 24H"
            value={num(delta) ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}` : DASH}
            color={num(delta) && delta >= 0 ? "text-[#00ffaa]" : "text-[#ff0055]"}
          />
          <FlowMetric
            label="BID"
            value={num(buyPercent) ? `${buyPercent.toFixed(1)}%` : DASH}
            color="text-[#00ffaa]"
          />
          <FlowMetric
            label="ASK"
            value={num(sellPercent) ? `${sellPercent.toFixed(1)}%` : DASH}
            color="text-[#ff0055]"
          />
          <FlowMetric
            label="DESEQ."
            value={num(imbalance) ? `${imbalance >= 0 ? "+" : ""}${(imbalance * 100).toFixed(1)}%` : DASH}
            color={num(imbalance) && imbalance >= 0 ? "text-[#00ffaa]" : "text-[#ff0055]"}
          />
          <FlowMetric
            label="CVD SESSÃO"
            value={cvdValue !== null ? `${cvdValue >= 0 ? "+" : ""}${cvdValue.toFixed(2)}` : DASH}
            color={cvdValue !== null && cvdValue >= 0 ? "text-[#00ffaa]" : "text-[#ff0055]"}
          />
        </div>

        <div className="w-full h-4 mt-1 flex relative bg-[#010308] border border-[#00f0ff15] rounded overflow-hidden shadow-[inset_0_0_10px_rgba(0,240,255,0.05)]">
          <div
            className="h-full bg-gradient-to-r from-[#00ffaa10] to-[#00ffaa60] border-r border-[#00ffaa] relative overflow-hidden transition-all duration-500"
            style={{ width: `${num(buyPercent) ? buyPercent : 50}%` }}
          >
            <div className="absolute top-0 bottom-0 w-[50px] bg-gradient-to-r from-transparent via-[#00ffaa] to-transparent opacity-30 -translate-x-full animate-[scan-horizontal_2s_linear_infinite]"></div>
          </div>
          <div
            className="h-full bg-gradient-to-l from-[#ff005510] to-[#ff005560] border-l border-[#ff0055] relative overflow-hidden transition-all duration-500"
            style={{ width: `${num(sellPercent) ? sellPercent : 50}%` }}
          >
            <div className="absolute top-0 bottom-0 w-[50px] bg-gradient-to-l from-transparent via-[#ff0055] to-transparent opacity-30 translate-x-[500%] animate-[scan-horizontal_2s_linear_infinite_reverse]"></div>
          </div>
        </div>

        {/* Real Order Flow Engine (OFI/Absorption/Exhaustion) fed by real
            MEXC trades — engine-bridge.ts's startMexcOrderflowFeed(). */}
        <div className="flex items-center gap-1.5 px-1 mt-1">
          <div
            className={`w-1.5 h-1.5 rounded-full ${ofState === "LIVE" ? "bg-[#00ffaa] animate-pulse" : ofState === "ERROR" ? "bg-[#ff0055]" : "bg-[#f0d06f] animate-pulse"}`}
          ></div>
          <span className={`text-[0.45rem] tracking-[0.15em] font-bold uppercase ${ofColor}`}>
            MEXC ORDERFLOW ·{" "}
            {ofState === "LIVE" ? "LIVE" : ofState === "ERROR" ? `FALHOU (${orderflowReason || DASH})` : "AGUARDANDO"}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-1">
          {signals.length === 0 ? (
            <div className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest py-1">
              {AWAIT} SINAL REAL…
            </div>
          ) : (
            signals.slice(0, 4).map((s, i) => (
              <div key={i} className="flex justify-between items-center text-[0.42rem] py-[1px]">
                <span className={`font-bold tracking-wider ${signalColor(s.type)}`}>{s.type}</span>
                <span className="text-[#a0f0ff]/80 font-mono">{fmt(s.price)}</span>
                <span className="text-[#8ab4f8]/60 font-mono">
                  {num(s.confidence) ? `${(s.confidence * 100).toFixed(0)}%` : DASH}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Widget>
  );
}
interface FlowMetricProps {
  label: string;
  value: string | number;
  color: string;
}
const FlowMetric = React.memo(function FlowMetric({ label, value, color }: FlowMetricProps) {
  return (
    <div className="flex flex-col items-center xl:items-start">
      <span className="text-[0.45rem] text-[#8ab4f8] uppercase tracking-[0.1em] mb-[2px]">
        {label}
      </span>
      <span className={`text-[0.6rem] font-bold ${color}`}>{value}</span>
    </div>
  );
});

// --- HEATMAP WIDGET (deterministic mapping of REAL depth — no Math.random) ---
function HeatmapWidget({ book, data }: any) {
  const [filter, setFilter] = useState("ALL");
  const mid = num(data?.price) ? data.price : null;

  const bids: Level[] = book?.bids ?? [];
  const asks: Level[] = book?.asks ?? [];
  const maxSize = Math.max(1, ...bids.map((b) => b.size), ...asks.map((a) => a.size));
  const hasDepth = bids.length > 0 || asks.length > 0;

  return (
    <Widget
      id="heatmap"
      title="MAPA DE LIQUIDEZ · PROFUNDIDADE REAL"
      flex="flex-1 min-h-[160px]"
      extraHeader={
        <div className="flex gap-1 text-[0.45rem]">
          {["ALL", "BIDS", "ASKS"].map((f) => (
            <span
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1.5 py-[1px] rounded cursor-pointer transition-all ${filter === f ? "bg-[#00f0ff20] text-[#00f0ff] border border-[#00f0ff40] shadow-[0_0_5px_rgba(0,240,255,0.3)]" : "text-slate-500 hover:text-[#00f0ff] hover:bg-[#00f0ff0a]"}`}
            >
              {f}
            </span>
          ))}
        </div>
      }
    >
      <div className="w-full h-full relative pr-10 pb-3 min-h-0">
        <div className="absolute inset-0 right-10 bottom-3 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:8px_8px] border border-[#00f0ff1a] overflow-hidden rounded-[2px] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
          {!hasDepth && (
            <div className="absolute inset-0 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
              {AWAIT} PROFUNDIDADE…
            </div>
          )}

          {/* Asks: deterministic bars in the upper half, width ∝ real size. */}
          {filter !== "BIDS" &&
            asks.map((a, idx) => {
              const rel = a.size / maxSize;
              return (
                <div
                  key={`a${idx}`}
                  className="absolute right-0 mix-blend-screen transition-all duration-500"
                  style={{
                    top: `${Math.max(2, 46 - idx * 5.5)}%`,
                    height: "4%",
                    width: `${Math.max(4, rel * 90)}%`,
                    backgroundColor: rel > 0.66 ? "#ff0055" : "#00f0ff",
                    opacity: 0.25 + rel * 0.6,
                    boxShadow: rel > 0.7 ? `0 0 ${rel * 10}px #ff0055` : "none",
                  }}
                ></div>
              );
            })}

          {/* Current price line */}
          <div className="absolute top-[48%] left-0 right-0 h-[1px] bg-white shadow-[0_0_8px_#fff] opacity-80 z-20"></div>

          {/* Bids: deterministic bars in the lower half. */}
          {filter !== "ASKS" &&
            bids.map((b, idx) => {
              const rel = b.size / maxSize;
              return (
                <div
                  key={`b${idx}`}
                  className="absolute right-0 mix-blend-screen transition-all duration-500"
                  style={{
                    top: `${Math.min(94, 52 + idx * 5.5)}%`,
                    height: "4%",
                    width: `${Math.max(4, rel * 90)}%`,
                    backgroundColor: rel > 0.66 ? "#00ffaa" : "#00f0ff",
                    opacity: 0.25 + rel * 0.6,
                    boxShadow: rel > 0.7 ? `0 0 ${rel * 10}px #00ffaa` : "none",
                  }}
                ></div>
              );
            })}
        </div>

        {/* Real price scale from real top-of-book. */}
        <div className="absolute right-0 top-0 bottom-3 flex flex-col justify-between text-[0.45rem] text-[#8ab4f8]/60 items-end z-10 font-bold font-mono">
          <span className="text-[#ff0055]">{asks.length ? fmtInt(asks[0].price) : DASH}</span>
          <span className="text-[#ff0055]/70">
            {asks.length ? fmtInt(asks[Math.floor(asks.length / 2)].price) : DASH}
          </span>
          <span className="text-white drop-shadow-[0_0_4px_#fff]">{num(mid) ? fmtInt(mid) : DASH}</span>
          <span className="text-[#00ffaa]/70">
            {bids.length ? fmtInt(bids[Math.floor(bids.length / 2)].price) : DASH}
          </span>
          <span className="text-[#00ffaa]">{bids.length ? fmtInt(bids[bids.length - 1].price) : DASH}</span>
        </div>
      </div>
    </Widget>
  );
}

// --- DCI ESSENTIAL STRIP (item 1) ---
// The "read in under 2 seconds" layer: Direção, Confiança, Liquidez, Risco,
// Estado do sistema, Saúde dos dados, Preço, Última atualização — nothing
// else. Every field is a passthrough from state the rest of the app already
// computes (engine/voiceSnapshot/lastUpdateAt/GMIL); this component invents
// no new number, it only elevates existing ones to constant visibility.
function EssentialStrip() {
  const { engine, engineStatus, voiceSnapshot, lastUpdateAt, institutionalConsensus } =
    useContext(WidgetContext) || {};
  // V11.5 Fase 5: lê o índice já combinado (3 provedores GMIL + liquidez +
  // fluxo) computado uma única vez em App() — não assina o GMIL de novo
  // aqui (era uma 2ª assinatura redundante ao mesmo singleton antes desta
  // fase).
  const consensus = institutionalConsensus ?? { score: null, sampleSize: 0, contributingProviders: [] };

  const direction: Direction = engine?.direction ?? null;
  const dirLabel = direction ?? "AGUARDANDO";
  const dirColor =
    direction === "LONG"
      ? "text-[#00ffaa] border-[#00ffaa50] bg-[#00ffaa10]"
      : direction === "SHORT"
        ? "text-[#ff0055] border-[#ff005550] bg-[#ff005510]"
        : "text-[#8ab4f8] border-[#8ab4f8]/30 bg-[#8ab4f8]/5";

  const confidence: string | null = engine?.confidence ?? null;

  const liquidezPct = num(engine?.buyPercent) ? Math.round(engine.buyPercent) : null;
  const liquidezLabel = liquidezPct === null ? AWAIT : `BID ${liquidezPct}%`;
  const liquidezColor = liquidezPct === null ? "text-[#8ab4f8]" : liquidezPct >= 50 ? "text-[#00ffaa]" : "text-[#ff0055]";

  // Risco: distância real preço->stop quando há setup confirmado; senão
  // conta de liquidações institucionais recentes como sinal de risco bruto.
  const stopDistPct =
    direction && num(engine?.stop) && num(engine?.price) && engine.price !== 0
      ? Math.abs(((engine.price - engine.stop) / engine.price) * 100)
      : null;
  const liqCount = voiceSnapshot?.recentLiquidationCount ?? 0;
  const riskLabel = stopDistPct !== null ? `STOP ${stopDistPct.toFixed(2)}%` : liqCount > 0 ? `${liqCount} LIQ.` : AWAIT;
  const riskColor = stopDistPct !== null ? "text-[#f0d06f]" : liqCount > 0 ? "text-[#ff0055]" : "text-[#8ab4f8]";

  const systemLabel = engineStatus === "ok" ? "OK" : engineStatus === "pending" ? "INICIANDO" : "FALHA";
  const systemColor =
    engineStatus === "ok" ? "text-[#00ffaa]" : engineStatus === "pending" ? "text-[#f0d06f]" : "text-[#ff0055]";

  // Saúde dos dados: conta real de feeds independentes ativos agora mesmo.
  const feedsUp = [
    voiceSnapshot?.wsLive,
    voiceSnapshot?.orderflowState === "LIVE",
    voiceSnapshot?.liquidationState === "LIVE",
    engineStatus === "ok",
  ].filter(Boolean).length;
  const dataColor = feedsUp === 4 ? "text-[#00ffaa]" : feedsUp >= 2 ? "text-[#f0d06f]" : "text-[#ff0055]";

  const updateLabel = lastUpdateAt
    ? new Date(lastUpdateAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : AWAIT;

  const gmilLabel = formatConsensusScore(consensus.score);

  // V10.4 §2 "Glow Inteligente": glow apenas onde há informação relevante
  // que deve "respirar" — Direção, Confiança, Liquidez, Preço, Contexto
  // Global, Sistema. Risco/Dados/Última Att. ficam de propósito sem glow
  // (não são o foco perceptual da faixa). drop-shadow com currentColor
  // acompanha automaticamente a cor condicional de cada valor sem precisar
  // hardcodar um glow por branch de cor.
  const Chip = ({
    label,
    value,
    valueClass,
    glow = false,
  }: {
    label: string;
    value: string;
    valueClass: string;
    glow?: boolean;
  }) => (
    <div className="flex flex-col items-start gap-0.5 px-2.5 py-1.5 min-w-0">
      <span className="text-[0.45rem] tracking-[0.2em] text-[#8ab4f8]/60 font-bold uppercase whitespace-nowrap">
        {label}
      </span>
      <span
        className={`text-[0.62rem] font-black font-mono tracking-tight whitespace-nowrap ${valueClass} ${
          glow ? "drop-shadow-[0_0_5px_currentColor]" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );

  // Linha 2 da barra de comando unificada — sem contêiner/borda próprios
  // (o anel do pulso crítico vive no contêiner da barra, no TopBar). O chip
  // "Preço" saiu: o preço agora tem UMA ocorrência, na linha 1 da barra.
  return (
    <div className="flex flex-wrap items-stretch divide-x divide-[#8ab4f8]/10 border-t border-[#00f0ff15]">
      <Chip label="Direção" value={dirLabel} valueClass={`px-1.5 rounded border ${dirColor}`} glow />
      <Chip
        label="Confiança"
        value={confidence ?? AWAIT}
        valueClass="px-1.5 rounded border border-[#8ab4f8]/40 bg-[#8ab4f8]/10 text-[#8ab4f8]"
        glow
      />
      <Chip label="Liquidez" value={liquidezLabel} valueClass={liquidezColor} glow />
      <Chip label="Risco" value={riskLabel} valueClass={riskColor} />
      <Chip label="Contexto Global" value={gmilLabel} valueClass="text-[#8ab4f8]" glow />
      <Chip label="Sistema" value={systemLabel} valueClass={systemColor} glow />
      <Chip label="Dados" value={`${feedsUp}/4`} valueClass={dataColor} />
      <Chip label="Última Att." value={updateLabel} valueClass="text-[#8ab4f8]/80" />
    </div>
  );
}

// --- MIDDLE COLUMN: DIRECTION ---
function MarketDirectionWidget() {
  const { widgets, engine } = useContext(WidgetContext) || {};
  if (widgets && !widgets.market_direction.visible) return null;

  const buyPercent: number | null = engine?.buyPercent ?? null;
  const sellPercent: number | null = engine?.sellPercent ?? null;
  const direction: Direction = engine?.direction ?? null;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  const vectorLabel = isLong ? "Domínio Long" : isShort ? "Domínio Short" : AWAIT;
  const vectorColor = isLong
    ? "text-[#00ffaa] drop-shadow-[0_0_10px_rgba(0,255,170,0.8)]"
    : isShort
      ? "text-[#ff0055] drop-shadow-[0_0_10px_rgba(255,0,85,0.8)]"
      : "text-[#8ab4f8]/60";
  const glowColor = isLong
    ? "bg-[#00ffaa] shadow-[0_0_8px_#00ffaa]"
    : isShort
      ? "bg-[#ff0055] shadow-[0_0_8px_#ff0055]"
      : "bg-[#8ab4f8]/50";

  // Fusão visual — achado real do Operador (captura de tela de
  // dispositivo real, gaveta Market Intelligence aberta): este card foi
  // desenhado originalmente para dividir uma coluna larga de 3 colunas
  // (max-w-[600px], números text-3xl, ícones de 24px) — dentro da gaveta
  // estreita (~320px) isso ficava desproporcional/pouco profissional.
  // Compactado para uma faixa única e densa (mesmos 3 dados reais, só
  // menores) — cabe inteira sem quebrar linha mesmo na largura mínima da
  // gaveta.
  return (
    <div className="cyber-panel shrink-0 flex items-center justify-between gap-1.5 px-2.5 py-2">
      <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
        <span className="text-[0.4rem] text-[#00ffaa]/80 tracking-[0.15em] font-bold uppercase">
          Pressão Bid
        </span>
        <div className="flex items-center gap-1 text-sm font-black text-[#00ffaa]">
          <ArrowUpRight size={12} strokeWidth={3} />
          {num(buyPercent) ? Math.round(buyPercent) : DASH}
          <span className="text-[0.6rem]">%</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-0.5 px-1 shrink-0">
        <span className="text-[0.35rem] text-[#8ab4f8]/70 tracking-[0.15em] uppercase font-bold whitespace-nowrap">
          Vetor
        </span>
        <span className={`text-[0.6rem] font-black tracking-wide uppercase whitespace-nowrap ${vectorColor}`}>
          {vectorLabel}
        </span>
        <div className="flex items-center gap-1">
          <div className={`w-1 h-1 rounded-full animate-pulse ${glowColor}`}></div>
          <span className="text-[0.32rem] uppercase tracking-widest font-bold text-[#8ab4f8]/60">
            Livro Real
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
        <span className="text-[0.4rem] text-[#ff0055]/80 tracking-[0.15em] font-bold uppercase">
          Pressão Ask
        </span>
        <div className="flex items-center gap-1 text-sm font-bold text-[#ff0055]">
          {num(sellPercent) ? Math.round(sellPercent) : DASH}
          <span className="text-[0.6rem]">%</span>
          <ArrowDownRight size={12} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}

// --- LEFT COLUMN: MARKET BIAS / DECISION (V16 §4, Long/Short Decision
// Module evolution) — a compact institutional view (bias/convicção/
// entrada/invalidação/alvos/R:R/tamanho sugerido/status da decisão)
// instead of a bare LONG/SHORT button. Every number here is a real
// passthrough from `engine`/`riskSuggestion` (already computed elsewhere
// in this file, see contextValue) — nothing is recomputed or invented.
function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col bg-[#010308] px-2 py-1.5 rounded border border-[#8ab4f8]/10 min-w-0">
      <span className="text-[0.4rem] text-[#8ab4f8]/60 font-bold tracking-widest uppercase truncate">{label}</span>
      <span className={`text-[0.55rem] font-mono font-black truncate ${color}`}>{value}</span>
    </div>
  );
}

function MarketBiasDecisionCard() {
  const { engine, riskSuggestion, ensembleConsensus } = useContext(WidgetContext) || {};
  const direction: Direction = engine?.direction ?? null;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const dirLabelColor = isLong ? "text-[#00ffaa]" : isShort ? "text-[#ff0055]" : "text-[#8ab4f8]/60";
  const entry: number | null = engine?.entry ?? null;
  const target: number | null = engine?.target ?? null;
  const target2: number | null = engine?.target2 ?? null;
  const stop: number | null = engine?.stop ?? null;
  const riskRewardRatio: number | null = engine?.riskRewardRatio ?? null;
  const target1Strength: { label: "FORTE" | "FRACA"; touches: number } | null = engine?.target1Strength ?? null;
  const target2Strength: { label: "FORTE" | "FRACA"; touches: number } | null = engine?.target2Strength ?? null;
  // engine.confidence is the Core Engine's own real categorical read
  // (ALTA/MÉDIA/BAIXA, see engine-bridge.ts's RealCycleResult.confidence:
  // string|null) — never a fabricated percentage. AGUARDANDO honestly
  // before the first cycle succeeds.
  const confidenceLabel = engine?.confidence ?? AWAIT;

  const riskOk = riskSuggestion?.status === "OK";
  const riskLabel = riskOk
    ? `${riskSuggestion.suggested_position_pct.toFixed(1)}% eq · risco ${riskSuggestion.effective_risk_pct.toFixed(2)}%`
    : "0% · sem sugestão";

  // V16 §4: Decision Status (WAIT/CONFIRM/EXECUTE) — an honest confluence
  // read across two ALREADY-real, independent signals (never a new score
  // invented for this card): the Core Engine's own direction+Risk Engine
  // sizing, and the secondary Ensemble Committee's direction (GMIL +
  // local logics, src/consensus/). EXECUTE only when both agree AND the
  // Risk Engine actually produced a non-zero suggestion; CONFIRM when the
  // Core Engine has a signal but the committee hasn't confirmed it yet;
  // WAIT otherwise. Purely an analytical label — same LEI 24 rule as
  // DecisionValidationWidget: display only, never gates or auto-fires
  // anything (this terminal has no order-send path at all, READ_ONLY).
  const ensembleOk = ensembleConsensus?.status === "OK";
  const ensembleAgrees =
    ensembleOk &&
    ((isLong && ensembleConsensus.direcao === "ALTA") || (isShort && ensembleConsensus.direcao === "BAIXA"));
  const decisionStatus: "WAIT" | "CONFIRM" | "EXECUTE" =
    !direction || !riskOk || riskSuggestion.suggested_position_pct <= 0
      ? "WAIT"
      : ensembleAgrees
        ? "EXECUTE"
        : "CONFIRM";
  const decisionClass =
    decisionStatus === "WAIT"
      ? "text-[#f0d06f] border-[#f0d06f]/40 bg-[#f0d06f]/10"
      : decisionStatus === "CONFIRM"
        ? "text-[#00f0ff] border-[#00f0ff]/40 bg-[#00f0ff]/10"
        : isShort
          ? "text-[#ff0055] border-[#ff0055]/40 bg-[#ff0055]/10"
          : "text-[#00ffaa] border-[#00ffaa]/40 bg-[#00ffaa]/10";

  // Fusão visual (imagem de referência): a imagem mostra "DIREÇÃO" e
  // "GESTÃO DE POSIÇÃO" como 2 cards empilhados, não 1 — dividido aqui
  // por puro reagrupamento visual, os MESMOS campos reais de antes,
  // nenhum dado novo. Omite deliberadamente o slider de alavancagem e o
  // slider de quantidade em BTC + o botão verde de execução assistida da
  // imagem: este terminal é READ_ONLY por decisão permanente (sem chave
  // de API, sem caminho de envio de ordem em lugar nenhum do código) e já tinha,
  // antes desta sessão, substituído um antigo widget de "posição ao
  // vivo" fabricada por um aviso honesto — reintroduzir uma UI de
  // quantidade/alavancagem repetiria exatamente o padrão já rejeitado.
  return (
    <>
      <div className="cyber-panel shrink-0 flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="font-bold tracking-[0.2em] text-[0.55rem] uppercase text-[#00f0ff]">DIREÇÃO</span>
          <span
            className={`text-[0.45rem] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded border ${decisionClass}`}
            title="Rótulo analítico — nunca aciona ordens (READ_ONLY)"
          >
            {decisionStatus}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div className={`text-center py-1.5 rounded border text-[0.5rem] font-black tracking-widest ${isLong ? "border-[#00ffaa60] bg-[#00ffaa15] text-[#00ffaa]" : "border-[#8ab4f8]/15 text-[#8ab4f8]/30"}`}>
            LONG
          </div>
          <div className={`text-center py-1.5 rounded border text-[0.5rem] font-black tracking-widest ${!direction ? "border-[#8ab4f8]/40 bg-[#8ab4f8]/10 text-[#8ab4f8]" : "border-[#8ab4f8]/15 text-[#8ab4f8]/30"}`}>
            NEUTRO
          </div>
          <div className={`text-center py-1.5 rounded border text-[0.5rem] font-black tracking-widest ${isShort ? "border-[#ff005560] bg-[#ff005515] text-[#ff0055]" : "border-[#8ab4f8]/15 text-[#8ab4f8]/30"}`}>
            SHORT
          </div>
        </div>

        <span className="text-[0.45rem] text-[#8ab4f8]/60 tracking-[0.15em] font-bold uppercase">
          Sinal Institucional
        </span>
        <span className={`text-[0.75rem] font-black tracking-wide -mt-1 ${dirLabelColor}`}>
          {direction ?? AWAIT}
        </span>

        <MiniStat label="Convicção (Core Engine)" value={confidenceLabel} color="text-[#8ab4f8]" />
      </div>

      <div className="cyber-panel shrink-0 flex flex-col gap-2 p-3">
        <span className="font-bold tracking-[0.2em] text-[0.55rem] uppercase text-[#00f0ff]">
          GESTÃO DE POSIÇÃO
        </span>

        {direction ? (
          <div className="grid grid-cols-2 gap-1.5">
            <LevelCard label="Entrada" value={entry} accent="#00f0ff" tag="REF" />
            <LevelCard label="Invalidação" value={stop} accent="#ff0055" tag="REAL" />
            <LevelCard
              label="Alvo 1"
              value={target}
              accent="#00ffaa"
              tag={target1Strength?.label ?? "REAL"}
            />
            <LevelCard
              label="Alvo 2"
              value={target2}
              accent="#00ffaa"
              tag={target2Strength?.label ?? "REAL"}
              dim={!num(target2)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#8ab4f8]/20 bg-[#8ab4f8]/5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f0d06f] animate-pulse shrink-0"></div>
            <span className="text-[0.45rem] tracking-[0.1em] text-[#8ab4f8] font-bold uppercase leading-relaxed">
              Motor real aguardando confirmação direcional — zonas de entrada/alvos/stop aparecem aqui assim que houver sinal.
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {num(riskRewardRatio) && (
            <span className="text-[#f0d06f] border border-[#f0d06f]/40 bg-[#f0d06f]/10 text-[0.5rem] font-bold px-2 py-0.5 rounded">
              R:R {riskRewardRatio.toFixed(2)}
            </span>
          )}
          <span className={`text-[0.5rem] font-bold px-2 py-0.5 rounded border ${riskOk ? "text-[#00f0ff] border-[#00f0ff]/40 bg-[#00f0ff]/10" : "text-[#8ab4f8]/50 border-[#8ab4f8]/20"}`}>
            TAMANHO SUGERIDO · {riskLabel}
          </span>
        </div>

        <span className="text-[0.4rem] text-[#f0d06f]/80 font-bold tracking-widest">
          SUGESTÃO ALGORÍTMICA · NÃO É CONSELHO FINANCEIRO · SEM EXECUÇÃO REAL (READ_ONLY)
        </span>
      </div>
    </>
  );
}

// --- RIGHT COLUMN: ORDER BOOK ---
function OrderBookWidget({ data, book }: any) {
  const mid = num(data?.price) ? data.price : null;
  const asks: Level[] = book?.asks ?? [];
  const bids: Level[] = book?.bids ?? [];
  const hasBook = asks.length > 0 || bids.length > 0;

  let accumAsk = 0;
  let accumBid = 0;

  return (
    <Widget id="orderbook" title="LIVRO DE OFERTAS" flex="flex-1">
      <div className="flex flex-col h-full text-[0.5rem] justify-between pb-1 min-h-0">
        <div className="flex justify-between text-[#8ab4f8] mb-1 px-1 pb-1 tracking-widest uppercase border-b border-[#00f0ff1a] shrink-0 font-bold">
          <span className="w-1/3">PREÇO (USDT)</span>
          <span className="w-1/3 text-right">SIZE</span>
          <span className="w-1/3 text-right">TOTAL</span>
        </div>

        {!hasBook ? (
          <div className="flex-1 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
            {AWAIT} LIVRO…
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-[1px] relative flex-1 min-h-0 overflow-hidden justify-end">
              {asks.slice(0, 7).map((a, i) => {
                accumAsk += a.size;
                return (
                  <div key={`a${i}`} className="flex justify-between px-1 py-[1px] relative z-10 group cursor-pointer">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#ff00551a] z-[-1]"
                      style={{ width: `${Math.min((accumAsk / 8) * 100, 100)}%` }}
                    ></div>
                    <span className="text-[#ff0055] w-1/3 font-bold group-hover:text-white transition-colors">
                      {a.price.toFixed(2)}
                    </span>
                    <span className="text-[#a0f0ff]/80 w-1/3 text-right">{a.size.toFixed(3)}</span>
                    <span className="text-[#a0f0ff]/50 w-1/3 text-right">{accumAsk.toFixed(3)}</span>
                  </div>
                );
              })}
            </div>

            <div className="text-center text-base font-black text-[#00ffaa] py-1 drop-shadow-[0_0_8px_rgba(0,255,170,0.6)] my-[2px] bg-[#00ffaa08] border-y border-[#00ffaa20] shrink-0">
              {fmt(mid)}
            </div>

            <div className="flex flex-col gap-[1px] relative flex-1 min-h-0 overflow-hidden justify-start">
              {bids.slice(0, 7).map((b, i) => {
                accumBid += b.size;
                return (
                  <div key={`b${i}`} className="flex justify-between px-1 py-[1px] relative z-10 group cursor-pointer">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#00ffaa1a] z-[-1]"
                      style={{ width: `${Math.min((accumBid / 8) * 100, 100)}%` }}
                    ></div>
                    <span className="text-[#00ffaa] w-1/3 font-bold group-hover:text-white transition-colors">
                      {b.price.toFixed(2)}
                    </span>
                    <span className="text-[#a0f0ff]/80 w-1/3 text-right">{b.size.toFixed(3)}</span>
                    <span className="text-[#a0f0ff]/50 w-1/3 text-right">{accumBid.toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Widget>
  );
}

// --- RIGHT COLUMN: SCANNER ---
function ScannerWidget({ data }: { data: any[] }) {
  const pairs = data && data.length > 0 ? data.slice(0, 5) : [];
  return (
    <Widget id="scanner" title="QUANT SCANNER · 24H REAL" flex="flex-1">
      <div className="flex flex-col h-full text-[0.5rem]">
        <div className="flex justify-between text-[#8ab4f8] mb-1.5 px-1 pb-1 tracking-widest uppercase border-b border-[#00f0ff1a] font-bold shrink-0">
          <span className="w-[30%]">PAR</span>
          <span className="w-[25%]">VETOR</span>
          <span className="w-[25%] text-center">FORÇA</span>
          <span className="w-[20%] text-right">24H</span>
        </div>
        {pairs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
            {AWAIT}…
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-1 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            {pairs.map((p) => (
              <div key={p.p} className="flex justify-between items-center px-1">
                <span className="text-[#a0f0ff] w-[30%] font-bold">{p.p}</span>
                <span
                  className={`w-[25%] font-bold tracking-wider ${p.s === "LONG" ? "text-[#00ffaa] drop-shadow-[0_0_3px_rgba(0,255,170,0.8)]" : p.s === "SHORT" ? "text-[#ff0055] drop-shadow-[0_0_3px_rgba(255,0,85,0.8)]" : "text-[#8ab4f8]/50"}`}
                >
                  {p.s}
                </span>
                <div className="w-[25%] flex items-center justify-center px-1">
                  <div className="w-full h-1 bg-[#010308] rounded-full overflow-hidden border border-[#00f0ff20]">
                    <div
                      className={`h-full ${p.s === "LONG" ? "bg-[#00ffaa] shadow-[0_0_4px_#00ffaa]" : p.s === "SHORT" ? "bg-[#ff0055] shadow-[0_0_4px_#ff0055]" : "bg-[#8ab4f8]/50"}`}
                      style={{ width: `${p.str}%` }}
                    ></div>
                  </div>
                </div>
                <span
                  className={`w-[20%] text-right font-bold ${num(p.chg) && p.chg >= 0 ? "text-[#00ffaa]/80" : "text-[#ff0055]/80"}`}
                >
                  {fmtSignedPct(p.chg, 1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Widget>
  );
}

// --- RIGHT COLUMN: EXPOSURE (READ-ONLY — replaces the fake live position) ---
function ExposureWidget() {
  return (
    <Widget id="exposure" title="EXPOSIÇÃO · READ-ONLY" flex="flex-[0.7] min-h-[120px]">
      <div className="flex flex-col h-full items-center justify-center gap-3 p-3 text-center">
        <div className="w-10 h-10 rounded-full border border-[#00ffaa40] bg-[#00ffaa08] flex items-center justify-center shadow-[0_0_15px_rgba(0,255,170,0.15)]">
          <ShieldCheck size={20} className="text-[#00ffaa]" />
        </div>
        <span className="text-[0.6rem] font-black tracking-[0.2em] text-[#00ffaa] uppercase">
          Sem posição ao vivo
        </span>
        <span className="text-[0.5rem] text-[#8ab4f8]/70 leading-relaxed max-w-[230px]">
          Terminal em modo <span className="text-[#00f0ff] font-bold">FAIL_CLOSED</span>.
          Nenhuma chave de API, nenhuma ordem, nenhuma execução. Posições reais só
          aparecem quando um conector autorizado e auditado for conectado.
        </span>
        <span className="text-[0.45rem] tracking-[0.25em] text-[#8ab4f8]/40 uppercase font-bold border border-[#8ab4f8]/15 px-2 py-0.5 rounded">
          execução desabilitada por projeto
        </span>
      </div>
    </Widget>
  );
}

// --- RIGHT COLUMN: EVENTS — fed by the real GMIL event bus (LEI 02: "todo
// módulo distribui eventos"). Previously a permanently-empty placeholder;
// GMIL's provider readings/health transitions are exactly the kind of real,
// timestamped telemetry this panel always meant to show.
interface GmilLogEntry {
  id: string;
  timestamp: number;
  text: string;
  tone: "ok" | "warn" | "error";
}

const fmtClock = (ts: number) =>
  new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function EventsWidget() {
  const [log, setLog] = useState<GmilLogEntry[]>([]);

  useEffect(() => {
    const pushEntry = (entry: GmilLogEntry) => {
      setLog((prev) => [entry, ...prev].slice(0, 8));
    };
    const offReading = gmilBus.on<{ providerId: string; result: { ok: boolean; reason?: string } }>(
      "PROVIDER_READING",
      (event) => {
        const { providerId, result } = event.payload;
        pushEntry({
          id: `r-${event.timestamp}-${providerId}`,
          timestamp: event.timestamp,
          text: result.ok ? `${providerId} · leitura real recebida` : `${providerId} · falhou (${result.reason ?? "erro"})`,
          tone: result.ok ? "ok" : "warn",
        });
      },
    );
    const offHealth = gmilBus.on<{ providerId: string; from: string; to: string }>(
      "PROVIDER_HEALTH_CHANGED",
      (event) => {
        const { providerId, from, to } = event.payload;
        pushEntry({
          id: `h-${event.timestamp}-${providerId}`,
          timestamp: event.timestamp,
          text: `${providerId} · circuito ${from} → ${to}`,
          tone: to === "OPEN" ? "error" : "ok",
        });
        const spoken = describeProviderHealthChange(providerId, from as any, to as any);
        if (spoken) voiceEngine.speak(spoken, "ALERT");
      },
    );
    return () => {
      offReading();
      offHealth();
    };
  }, []);

  return (
    <Widget id="events" title="TELEMETRIA DE EVENTOS" flex="flex-[0.8] min-h-[110px]">
      {log.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
          {AWAIT} EVENTOS REAIS…
        </div>
      ) : (
        <div className="flex flex-col gap-1 h-full overflow-y-auto scrollbar-hide px-1 py-1">
          {log.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-[0.45rem] font-mono">
              <span className="text-[#8ab4f8]/50 shrink-0">{fmtClock(entry.timestamp)}</span>
              <span
                className={`shrink-0 w-1 h-1 rounded-full ${
                  entry.tone === "ok" ? "bg-[#00ffaa]" : entry.tone === "warn" ? "bg-[#f0d06f]" : "bg-[#ff0055]"
                }`}
              ></span>
              <span className="text-[#a0f0ff]/80 truncate">{entry.text}</span>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// --- RIGHT COLUMN: GMIL · CONTEXTO GLOBAL ---
// LEI 04: um único GLOBAL CONSENSUS SCORE, sempre rotulado como contexto
// consultivo — nunca lido por engine-bridge.ts, nunca um "sinal". LEI 05:
// cada provedor mostra seu peso de qualidade em tempo real; um provedor
// degradado perde peso automaticamente e o consenso reflete isso sozinho.
// V11.5 Fase 5: `consensus` vem de App() já ampliado (3 provedores externos
// + liquidez + fluxo reais) — mesma fonte que a faixa essencial usa, então
// os dois nunca podem mostrar números diferentes sob o mesmo rótulo.
function GmilContextWidget() {
  // Fase J (diretriz 2, ZERO REPETIÇÃO): o número do consenso global mora
  // EXCLUSIVAMENTE na barra operacional (EssentialStrip) — o cabeçalho
  // duplicado que este painel exibia foi removido; aqui ficam só os
  // conteúdos únicos deste painel (vieses por categoria + provedores).
  const { gmilProviders, gmilBiases } = useContext(WidgetContext) || {};
  const providers = gmilProviders ?? [];

  // Fase E (V15 Cap. 6): os 3 vieses por categoria do context-aggregator.
  // Categoria sem provedor ativo (MACRO hoje) => score null => AGUARDANDO —
  // o gancho é visível e honesto, nunca um neutro fabricado.
  const biasCells: Array<{ label: string; score: number | null }> = [
    { label: "INST", score: gmilBiases?.institutionalBias?.score ?? null },
    { label: "MACRO", score: gmilBiases?.macroBias?.score ?? null },
    { label: "LIQ", score: gmilBiases?.liquidityBias?.score ?? null },
  ];
  const biasColor = (score: number | null) =>
    score === null
      ? "text-[#8ab4f8]/50"
      : score > 0.1
        ? "text-[#00ffaa]"
        : score < -0.1
          ? "text-[#ff0055]"
          : "text-[#8ab4f8]";


  return (
    <Widget
      id="gmil_context"
      title="CONTEXTO GLOBAL · GMIL"
      flex="flex-[0.9] min-h-[190px]"
      extraHeader={<Globe size={12} className="text-[#00f0ff60]" />}
    >
      {/* overflow-y-auto: this panel now shares its column with 2 more
          widgets than when it was built (Market Regime + Asset Heatmap),
          and flex-grow can shrink it below its 2-providers' natural
          content height in landscape mode — without this, a crowded
          column would silently clip provider rows with no way to reach
          them (confirmed on MarketRegimeWidget in this same audit pass). */}
      <div className="flex flex-col gap-1.5 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        {/* Fase J: o cabeçalho "CONSENSO GLOBAL" que morava aqui foi
            removido — o número já vive na barra operacional (EssentialStrip),
            e a regra de Zero Repetição da Fase J proíbe o mesmo indicador em
            dois painéis. */}
        {/* Fase E: vieses por categoria (V15 Cap. 6) — INST (derivativos/
            on-chain), MACRO (sem fonte keyless ainda: AGUARDANDO honesto),
            LIQ (agregados de mercado). */}
        <div className="grid grid-cols-3 gap-1">
          {biasCells.map((b) => (
            <div key={b.label} className="flex flex-col items-center bg-[#010308] px-1 py-1 rounded border border-[#8ab4f8]/10">
              <span className="text-[0.4rem] text-[#8ab4f8]/60 font-bold tracking-widest">VIÉS {b.label}</span>
              <span className={`text-[0.55rem] font-mono font-black ${biasColor(b.score)}`}>
                {formatConsensusScore(b.score)}
              </span>
            </div>
          ))}
        </div>
        {providers.map((p) => {
          const value = p.lastReading?.ok ? p.lastReading.fields : null;
          const summary =
            p.id === "coingecko_global" && value
              ? `BTC ${typeof value.btcDominancePct === "number" ? value.btcDominancePct.toFixed(1) : DASH}% · ETH ${typeof value.ethDominancePct === "number" ? value.ethDominancePct.toFixed(1) : DASH}%`
              : p.id === "fear_greed_index" && value
                ? `${value.classification ?? DASH} (${value.value ?? DASH})`
                : p.id === "trending_coins" && value
                  ? typeof value.topSymbols === "string" && value.topSymbols
                    ? value.topSymbols
                    : DASH
                  : p.id === "derivatives_positioning" && value
                    ? `fund ${typeof value.fundingRate === "number" ? (value.fundingRate * 100).toFixed(4) : DASH}% · basis ${typeof value.basisPct === "number" ? value.basisPct.toFixed(3) : DASH}%`
                    : p.circuitState === "OPEN"
                      ? "circuito aberto"
                      : AWAIT;
          const dotColor =
            p.circuitState === "OPEN" ? "bg-[#ff0055]" : p.weight > 0.6 ? "bg-[#00ffaa]" : "bg-[#f0d06f]";
          // Data Quality (V11 §12): disponibilidade/latência/peso/última
          // atualização por provedor — reaproveita os mesmos campos que a
          // linha acima já busca (circuitState/lastLatencyMs/weight/
          // lastSuccessAt já existem em ProviderRuntimeSnapshot), então isto
          // é uma segunda LINHA da mesma lista existente, não um painel
          // duplicado listando os mesmos 2 provedores de novo.
          const ageLabel = ageLabelOf(p.lastSuccessAt ?? null);
          const latencyLabel = num(p.lastLatencyMs) ? `${Math.round(p.lastLatencyMs)}ms` : AWAIT;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-0.5 bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
            >
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide truncate">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}></span>
                  {p.label}
                </span>
                <span className="text-[0.45rem] text-white font-mono shrink-0 ml-1">{summary}</span>
              </div>
              <div className="flex justify-between items-center text-[0.4rem] text-[#8ab4f8]/40 font-mono pl-3">
                <span>{p.circuitState} · {latencyLabel} · att. há {ageLabel}</span>
                <span>peso {Math.round(p.weight * 100)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}

// --- MARKET REGIME (V11 §13) ---
// Every field is a passthrough or trivial derivation of state already
// computed in the `engine` useMemo — nothing new is fetched or invented.
//
// Self-audit finding (this charter's "mínima redundância de informações",
// already stated once before in V11 §9): this widget originally had 6
// rows, but Liquidez/Risco/Macro were EXACT duplicates of EssentialStrip's
// always-visible chips — same source field, same formula, same rounding —
// with Macro additionally repeated a THIRD time in GmilContextWidget's own
// "CONSENSO GLOBAL" row a few pixels away in the same column. Pruned to
// the 3 fields with no existing representation anywhere else: Tendência
// (engine.marketStructureLabel — the SAME clean label AssistantOrb's
// ESTRUTURA row now also uses, computed once in the engine useMemo, not
// re-derived here), Momentum (CVD's direction as a label — CVD's raw
// number is shown in OrderFlowWidget, but not this label), Volatilidade
// (genuinely new).
// Fase D: rótulos de exibição do vocabulário fechado do Market Regime
// Engine (src/market-regime/regime-engine.js REGIMES) — só tradução visual,
// a classificação em si nunca é recomputada aqui.
const REGIME_DISPLAY: Record<string, { label: string; color: string }> = {
  TENDENCIA_FORTE: { label: "TEND. FORTE", color: "text-[#00ffaa]" },
  TENDENCIA_MODERADA: { label: "TEND. MODERADA", color: "text-[#8ab4f8]" },
  CONSOLIDACAO: { label: "CONSOLIDAÇÃO", color: "text-[#8ab4f8]" },
  COMPRESSAO: { label: "COMPRESSÃO", color: "text-[#f0d06f]" },
  BREAKOUT: { label: "BREAKOUT", color: "text-[#f0d06f]" },
};

function MarketRegimeWidget() {
  const { engine, cvd } = useContext(WidgetContext) || {};

  // Fase D: linha oficial do Market Regime Engine (ADX/DI + percentil de
  // banda, ver src/market-regime/). Direção colore o rótulo composto;
  // regimes sem direção (consolidação/compressão) usam a cor do tipo.
  const regime = engine?.marketRegime ?? null;
  const regimeDisplay = regime ? REGIME_DISPLAY[regime.regime] : null;
  // Fase J (diretriz 4): idade REAL do regime vigente — changedAt vem do
  // RegimeHistory (quando a transição de verdade aconteceu), não do último
  // ciclo. Mora AQUI, na linha oficial do regime (zero repetição).
  const regimeLabel = regimeDisplay
    ? `${regimeDisplay.label}${regime.direction ? ` · ${regime.direction}` : ""}${num(regime.changedAt) ? ` · há ${ageLabelOf(regime.changedAt)}` : ""}`
    : AWAIT;
  const regimeColor = !regimeDisplay
    ? "text-[#8ab4f8]"
    : regime.direction === "ALTA"
      ? "text-[#00ffaa]"
      : regime.direction === "BAIXA"
        ? "text-[#ff0055]"
        : regimeDisplay.color;

  const trendLabel = engine?.marketStructureLabel ?? AWAIT;
  const trendColor =
    engine?.marketStructureLabel === "ALTA"
      ? "text-[#00ffaa]"
      : engine?.marketStructureLabel === "BAIXA"
        ? "text-[#ff0055]"
        : "text-[#8ab4f8]";

  const momentumLabel = !num(cvd) || cvd === 0 ? AWAIT : cvd > 0 ? "COMPRADOR" : "VENDEDOR";
  const momentumColor = !num(cvd) || cvd === 0 ? "text-[#8ab4f8]" : cvd > 0 ? "text-[#00ffaa]" : "text-[#ff0055]";

  const volPct = num(engine?.volatilityPct) ? engine.volatilityPct : null;
  const volLabel = volPct === null ? AWAIT : `${volPct.toFixed(2)}%`;
  const volColor = volPct === null ? "text-[#8ab4f8]" : volPct > 1.5 ? "text-[#ff0055]" : volPct > 0.6 ? "text-[#f0d06f]" : "text-[#00ffaa]";

  // V11.5 §2 (contexto multitemporal): compara a estrutura de 15m (acima)
  // com a de 1H, real, cacheada em engine-bridge.ts — não uma duplicata da
  // linha TENDÊNCIA, é uma pergunta diferente ("os dois prazos concordam?").
  const htfLabel = engine?.htfMarketStructureLabel ?? AWAIT;
  const confluenceLabel =
    engine?.timeframeConfluence ?? (engine?.htfMarketStructureLabel ? "LATERAL/MISTO" : AWAIT);
  const confluenceColor =
    engine?.timeframeConfluence === "CONFLUENTE"
      ? "text-[#00ffaa]"
      : engine?.timeframeConfluence === "DIVERGENTE"
        ? "text-[#f0d06f]"
        : "text-[#8ab4f8]";

  const Row = ({ label, value, valueClass }: { label: string; value: string; valueClass: string }) => (
    <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10">
      <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">{label}</span>
      <span className={`text-[0.5rem] font-mono font-black ${valueClass}`}>{value}</span>
    </div>
  );

  return (
    <Widget id="market_regime" title="REGIME DE MERCADO" flex="flex-[0.9] min-h-[190px]">
      {/* overflow-y-auto here is a hard requirement, not decoration: in
          landscape mode min-[1120px]:min-h-0 lets flex-grow shrink this
          panel below its natural content height when the column gets
          crowded (confirmed via measurement: shrank to 74px with 6+
          sibling widgets competing for the same column, clipping 2 of 3
          rows with no way to reach them). ScannerWidget already uses this
          exact pattern for the same reason. */}
      <div className="flex flex-col gap-1.5 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        <Row label="REGIME (MOTOR OFICIAL)" value={regimeLabel} valueClass={regimeColor} />
        <Row label="TENDÊNCIA (ESTRUTURA 15M)" value={trendLabel} valueClass={trendColor} />
        <Row label={`ESTRUTURA ${engine?.htfTimeframe?.toUpperCase() ?? "1H"}`} value={htfLabel} valueClass="text-[#8ab4f8]" />
        <Row label="CONFLUÊNCIA MULTI-TF" value={confluenceLabel} valueClass={confluenceColor} />
        <Row label="MOMENTUM (CVD)" value={momentumLabel} valueClass={momentumColor} />
        <Row label="VOLATILIDADE" value={volLabel} valueClass={volColor} />
      </div>
    </Widget>
  );
}

// --- SAÚDE DO SISTEMA (Fase J / V15 Cap. 17) ---
// Telemetria de sistema com medições REAIS: qualidade da fonte do Bus
// (Fase C), variante WASM carregada (Fase I), latência cronometrada do
// ciclo, FPS via rAF e memória JS SÓ onde a plataforma expõe API
// (Chromium; Safari => SEM_API declarado, nunca um número fabricado).
// ZERO REPETIÇÃO: nenhum destes indicadores aparece em outro painel —
// regime/vieses/comitê/risco moram nos painéis das suas fases.
function TelemetryHealthWidget() {
  const { engine, realCycle, cycleLatencyMs, fps } = useContext(WidgetContext) || {};

  const quality = realCycle?.dataQuality ?? null;
  const qualityLabel = quality
    ? `${quality.classification}${num(quality.weight) ? ` · peso ${(quality.weight * 100).toFixed(0)}%` : ""}`
    : AWAIT;
  const qualityColor =
    quality?.classification === "EXCELENTE" || quality?.classification === "SAUDAVEL"
      ? "text-[#00ffaa]"
      : quality?.classification === "DEGRADADA"
        ? "text-[#f0d06f]"
        : quality?.classification === "QUARENTENA"
          ? "text-[#ff0055]"
          : "text-[#8ab4f8]/50";

  const variant = wasmVariantLabel(realCycle?.wasmVariant ?? null);
  const fpsClass = classifyFps(fps);
  const fpsColor = fpsClass === "FLUIDO" ? "text-[#00ffaa]" : fpsClass === "ACEITAVEL" ? "text-[#f0d06f]" : fpsClass === "CRITICO" ? "text-[#ff0055]" : "text-[#8ab4f8]/50";
  const cycleClass = classifyCycleLatency(cycleLatencyMs);
  const cycleColor = cycleClass === "RAPIDO" ? "text-[#00ffaa]" : cycleClass === "OK" ? "text-[#f0d06f]" : cycleClass === "LENTO" ? "text-[#ff0055]" : "text-[#8ab4f8]/50";
  const memMB = typeof performance !== "undefined" ? memoryUsedMB(performance as any) : null;

  const Row = ({ label, value, valueClass }: { label: string; value: string; valueClass: string }) => (
    <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10">
      <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">{label}</span>
      <span className={`text-[0.5rem] font-mono font-black ${valueClass}`}>{value}</span>
    </div>
  );

  return (
    <Widget id="system_health" title="SAÚDE DO SISTEMA" flex="flex-[0.8] min-h-[170px]">
      <div className="flex flex-col gap-1.5 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        <Row label="QUALIDADE DA FONTE (BUS)" value={qualityLabel} valueClass={qualityColor} />
        <Row label="MOTOR WASM" value={variant ?? AWAIT} valueClass={variant === "SIMD128" ? "text-[#00ffaa]" : "text-[#8ab4f8]"} />
        <Row
          label="LATÊNCIA DO CICLO (15M)"
          value={num(cycleLatencyMs) ? `${cycleLatencyMs}ms${cycleClass ? ` · ${cycleClass}` : ""}` : AWAIT}
          valueClass={cycleColor}
        />
        <Row label="FPS (UI REAL)" value={num(fps) ? `${fps}${fpsClass ? ` · ${fpsClass}` : ""}` : AWAIT} valueClass={fpsColor} />
        <Row
          label="MEMÓRIA JS"
          value={memMB !== null ? `${memMB.toFixed(0)} MB` : "SEM_API (Safari não expõe)"}
          valueClass={memMB !== null ? "text-[#8ab4f8]" : "text-[#8ab4f8]/40"}
        />
        {/* Fase L (diretriz 3): selo de versão — confirmação FÍSICA de qual
            build está servido (inclusive do precache offline do service
            worker, cujo nome de cache deriva desta mesma constante).
            Aparece UMA vez em toda a UI (zero repetição). */}
        <Row label="BUILD" value={APP_SEAL} valueClass="text-[#00f0ff]" />
        {/* engine é lido só para o gate de visibilidade herdado do Widget —
            nenhuma leitura de mercado é exibida aqui (zero repetição). */}
        {engine ? null : null}
      </div>
    </Widget>
  );
}

// --- ASSET HEATMAP (V11 §14) ---
// Reuses scannerData as-is — the SAME 24h-ticker REST call every viewer of
// the Quant Scanner already relies on, fetched once every 30s in App(). No
// new API call, no new provider, no second source of truth for the same 5
// symbols.
function AssetHeatmapWidget() {
  const { scannerData } = useContext(WidgetContext) || {};
  const rows: any[] = Array.isArray(scannerData) ? scannerData : [];

  return (
    <Widget id="asset_heatmap" title="HEATMAP · ATIVOS" flex="flex-[0.7] min-h-[150px]">
      <div className="grid grid-cols-5 gap-1 h-full min-h-0 items-stretch px-1 py-1 overflow-y-auto scrollbar-hide">
        {ASSETS.map((a) => {
          const row = rows.find((r) => r.p === `${a}/USDT`);
          const dir: string | null = row?.s ?? null;
          const chg: number | null = num(row?.chg) ? row.chg : null;
          const bg =
            dir === "LONG"
              ? "bg-[#00ffaa15] border-[#00ffaa40] text-[#00ffaa]"
              : dir === "SHORT"
                ? "bg-[#ff005515] border-[#ff005540] text-[#ff0055]"
                : "bg-[#8ab4f810] border-[#8ab4f830] text-[#8ab4f8]";
          return (
            <div
              key={a}
              className={`flex flex-col items-center justify-center gap-0.5 rounded border ${bg}`}
            >
              <span className="text-[0.45rem] font-black tracking-wider">{a}</span>
              <span className="text-[0.4rem] font-mono">{chg !== null ? fmtSignedPct(chg) : AWAIT}</span>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}

// --- DECISION VALIDATION (V11.1 LEI 24) ---
// IMPORTANTE: isto é um painel de CONFLUÊNCIA/TRANSPARÊNCIA, não um portão.
// A LEI 24 pede para "validar" liquidez/volatilidade/consenso/fluxo/
// estrutura/multi-timeframe/etc. "antes do Core Engine emitir LONG/SHORT" —
// mas implementar isso literalmente (suprimir ou adiar o sinal se alguma
// checagem falhar) violaria a restrição permanente e repetida em TODO
// protocolo desta sessão, incluindo a própria LEI 27 deste protocolo:
// "O Core Engine permanece absolutamente preservado" e "nenhuma fonte pode
// alterar a decisão do Core Engine". A leitura que reconcilia as duas coisas
// sem contradição: este painel mostra, para o sinal que o Core Engine JÁ
// emitiu, quais das dimensões reais estão disponíveis agora — puro contexto
// exibido, nunca um gatilho. O operador vê a confluência; a decisão em si
// nunca é atrasada, escondida ou alterada por esta camada.
//
// Cada linha reflete DISPONIBILIDADE de um dado real já computado em outro
// lugar desta sessão (engine useMemo / institutionalConsensus / GMIL) — zero
// fetch novo, zero cálculo duplicado. "Consenso entre corretoras" é
// honestamente NÃO_APLICAVEL: este terminal só tem uma fonte real de preço
// (Binance); fabricar um consenso multi-exchange que não existe violaria o
// princípio de dado real deste projeto. "Integridade dos dados" não vira uma
// linha aqui de propósito — já é a faixa "DADOS n/4" sempre visível da
// EssentialStrip; repetir o mesmo cálculo aqui seria a exata duplicação que
// a LEI 25 (Self Audit) pede para eliminar, não para criar.
// Idade legível de um timestamp real — chamada por GmilContextWidget (idade
// de cada provedor) e aqui (idade de preço/livro/ciclo/HTF/GMIL), em vez de
// cada widget reimplementar a mesma conta (achado da auditoria de
// Sincronização Global: antes disso, GmilContextWidget tinha sua própria
// cópia inline idêntica em vez de chamar esta função, apesar do comentário
// já dizer que reaproveitava — LEI 25).
function ageLabelOf(updatedAt: number | null): string {
  if (updatedAt === null) return AWAIT;
  const ageSec = Math.round((Date.now() - updatedAt) / 1000);
  return ageSec < 60 ? `${ageSec}s` : `${Math.round(ageSec / 60)}min`;
}

// Rótulo do Consensus Score (-1..1 -> string com sinal, ex.: "+42"/"-17") —
// chamado por EssentialStrip e GmilContextWidget, que antes calculavam o
// mesmo formato duas vezes a partir do mesmo institutionalConsensus.score
// (mesmo achado de duplicação da auditoria de Sincronização Global).
function formatConsensusScore(score: number | null): string {
  return score === null ? AWAIT : `${score >= 0 ? "+" : ""}${(score * 100).toFixed(0)}`;
}

function DecisionValidationWidget() {
  const { engine, institutionalConsensus, ensembleConsensus, riskSuggestion, gmilProviders, priceUpdatedAt, orderBookUpdatedAt, lastUpdateAt } =
    useContext(WidgetContext) || {};

  // Fase H: sugestão de dimensionamento (% equity / % risco). Fail-closed:
  // SEM_SUGESTAO exibe 0% com o motivo real. O selo é PERMANENTE e
  // incondicional (diretriz 3 da ordem de ignição).
  const riskOk = riskSuggestion?.status === "OK";
  const riskLabel = riskOk
    ? `${riskSuggestion.suggested_position_pct.toFixed(1)}% eq · risco ${riskSuggestion.effective_risk_pct.toFixed(2)}%`
    : "0% · sem sugestão";
  const riskColor = riskOk ? "text-[#00f0ff]" : "text-[#8ab4f8]/50";

  // Fase F: Comitê de Validação (linear opinion pool, src/consensus/).
  // Direção + força do comitê das lógicas SECUNDÁRIAS — rótulo deixa
  // explícito que é o comitê, nunca o sinal do Core Engine.
  const ensembleOk = ensembleConsensus?.status === "OK";
  const ensembleLabel = ensembleOk
    ? `${ensembleConsensus.direcao} · força ${(ensembleConsensus.forca * 100).toFixed(0)}%${
        num(ensembleConsensus.forca_ajustada) ? ` (aj. ${(ensembleConsensus.forca_ajustada * 100).toFixed(0)}%)` : ""
      }`
    : AWAIT;
  const ensembleColor = !ensembleOk
    ? "text-[#8ab4f8]/50"
    : ensembleConsensus.direcao === "ALTA"
      ? "text-[#00ffaa]"
      : ensembleConsensus.direcao === "BAIXA"
        ? "text-[#ff0055]"
        : "text-[#8ab4f8]";

  const checks: { label: string; available: boolean | null }[] = [
    { label: "Liquidez (Livro de Ofertas)", available: !!engine?.hasBook },
    { label: "Volatilidade", available: num(engine?.volatilityPct) },
    { label: "Contexto Global (Consenso)", available: num(institutionalConsensus?.score) },
    { label: "Consenso Entre Corretoras", available: null }, // null = NÃO_APLICAVEL, nunca fabricado
    { label: "Fluxo Institucional (OFI)", available: num(engine?.flowImbalance) },
    { label: "Força do Alvo Estrutural", available: !!engine?.target2Strength },
    { label: "Estrutura de Mercado", available: !!engine?.marketStructureLabel },
    { label: "Multi-Timeframe (15M/1H)", available: !!engine?.timeframeConfluence },
    {
      label: "Qualidade das Fontes (GMIL)",
      available: Array.isArray(gmilProviders) && gmilProviders.some((p: any) => p.weight > 0),
    },
    { label: "Confidence Score (Core Engine)", available: !!engine?.confidence },
  ];
  const availableCount = checks.filter((c) => c.available === true).length;
  const applicableCount = checks.filter((c) => c.available !== null).length;

  // V11.1 LEI 22 (Temporal Synchronization): idade real de cada fonte, não
  // um clock único fingido — cada uma tem sua própria cadência (WS ~1s,
  // livro ~1s throttled, ciclo do motor 15m a cada 30s). Telemetria honesta,
  // nunca um valor inventado quando a fonte ainda não respondeu.
  // Protocolo Mestre (achado de auditoria de sincronização): HTF e GMIL/
  // Consenso eram as 2 fontes reais SEM telemetria de idade aqui — o
  // "Ciclo do Motor" cobria o sinal de 15m, mas a estrutura de 1H (cache
  // próprio, HTF_REFRESH_MS=5min) e o consenso GMIL (3 provedores, cadência
  // 90-180s cada) podiam estar mais velhos do que o operador percebia.
  // GMIL usa o provedor CONTRIBUINTE mais velho (weight>0), não uma média —
  // o consenso só é tão fresco quanto sua fonte mais atrasada.
  const contributingGmil = (gmilProviders ?? []).filter(
    (p: any) => p.weight > 0 && num(p.lastSuccessAt),
  );
  const gmilOldestSuccessAt = contributingGmil.length
    ? Math.min(...contributingGmil.map((p: any) => p.lastSuccessAt))
    : null;

  const syncRows: { label: string; ageLabel: string }[] = [
    { label: "Preço (WS)", ageLabel: ageLabelOf(priceUpdatedAt) },
    { label: "Livro de Ofertas", ageLabel: ageLabelOf(orderBookUpdatedAt) },
    { label: "Ciclo do Motor (15M)", ageLabel: ageLabelOf(lastUpdateAt) },
    { label: `Estrutura ${engine?.htfTimeframe?.toUpperCase() ?? "1H"}`, ageLabel: ageLabelOf(engine?.htfUpdatedAt ?? null) },
    { label: "Contexto Global (GMIL)", ageLabel: ageLabelOf(gmilOldestSuccessAt) },
  ];

  return (
    <Widget id="decision_validation" title="VALIDAÇÃO MULTI-CAMADA" flex="flex-[1.3] min-h-[280px]">
      <div className="flex flex-col gap-1 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        <div className="flex justify-between items-center bg-[#010308] px-2 py-1.5 rounded border border-[#00f0ff20] shrink-0">
          <span className="text-[0.45rem] text-[#8ab4f8]/80 font-bold tracking-widest">
            CONFLUÊNCIA · CONTEXTO DO SINAL ATUAL
          </span>
          <span className="text-[0.55rem] font-mono font-black text-[#00f0ff]">
            {availableCount}/{applicableCount}
          </span>
        </div>
        {/* Fase F: leitura agregada do comitê (n = membros com leitura real
            nesta janela). Consultivo — nunca o sinal do Core Engine. */}
        <div className="flex justify-between items-center bg-[#010308] px-2 py-1.5 rounded border border-[#00f0ff20] shrink-0">
          <span className="text-[0.45rem] accent-consensus font-bold tracking-widest">
            COMITÊ (ENSEMBLE) · CONSULTIVO
            {ensembleOk && (
              <span className="text-[#8ab4f8]/40"> n={ensembleConsensus.membros.length}</span>
            )}
          </span>
          <span className={`text-[0.55rem] font-mono font-black ${ensembleColor}`}>{ensembleLabel}</span>
        </div>
        {/* Fase H: Risk Engine — % do equity e % de risco (nunca valor
            monetário). O selo abaixo é OBRIGATÓRIO e permanente (ordem de
            ignição da Fase H, diretriz 3) — presente mesmo em 0%. */}
        <div className="flex flex-col gap-0.5 bg-[#010308] px-2 py-1.5 rounded border border-[#00f0ff20] shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-[0.45rem] accent-risk font-bold tracking-widest">TAMANHO SUGERIDO (RISK ENGINE)</span>
            <span className={`text-[0.55rem] font-mono font-black ${riskColor}`}>{riskLabel}</span>
          </div>
          <span className="text-[0.4rem] text-[#f0d06f]/80 font-bold tracking-widest">
            SUGESTÃO ALGORÍTMICA · NÃO É CONSELHO FINANCEIRO
          </span>
        </div>
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
          >
            <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">{c.label}</span>
            <span
              className={`text-[0.5rem] font-mono font-black ${
                c.available === null
                  ? "text-[#8ab4f8]/40"
                  : c.available
                    ? "text-[#00ffaa]"
                    : "text-[#f0d06f]"
              }`}
            >
              {c.available === null ? "NÃO_APLICÁVEL" : c.available ? "✓ REAL" : AWAIT}
            </span>
          </div>
        ))}

        <div className="h-px bg-[#8ab4f8]/10 shrink-0 my-0.5" />
        <span className="text-[0.4rem] text-[#8ab4f8]/50 font-bold tracking-widest shrink-0 px-0.5">
          SINCRONIZAÇÃO · IDADE DAS FONTES
        </span>
        {syncRows.map((r) => (
          <div
            key={r.label}
            className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
          >
            <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">{r.label}</span>
            <span className="text-[0.5rem] font-mono font-black text-[#8ab4f8]">{r.ageLabel}</span>
          </div>
        ))}
      </div>
    </Widget>
  );
}

// --- NEURAL CORE (local Llama 3 via WebLLM/WebGPU) ---
// Entirely opt-in and isolated: nothing in this widget runs until the user
// explicitly taps ATIVAR. Before that, zero network requests, zero WebGPU
// usage, zero effect on the rest of the app's instant boot. The model
// itself and @mlc-ai/web-llm's runtime are loaded via a lazy import()
// inside handleActivate — see the comment on the App.tsx import block
// above for why a static import would have defeated this entirely.
type NeuralCoreStatus = "idle" | "loading" | "ready" | "generating" | "error";

function NeuralCoreWidget() {
  const { engine, realCycle, smcZones, cvd, orderflowSignals } = useContext(WidgetContext) || {};
  const [status, setStatus] = useState<NeuralCoreStatus>("idle");
  const [loadProgress, setLoadProgress] = useState<{
    progress: number;
    text: string;
    modelId: string;
    tier: number;
    tierCount: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reading, setReading] = useState<string>("");
  // V11.5 Fase 7: qual dos 3 níveis reais (8B/3B/1B) efetivamente carregou —
  // a orquestração em llm-bridge.ts pode ter caído para um nível mais leve
  // se o primeiro falhou (ex.: teto de memória do iPad), e a UI mostra qual
  // foi de verdade, nunca assume o nível pedido original.
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const engineRef = useRef<MLCEngineInterface | null>(null);
  // Auditoria Mestra 360° (secao 6): referencia crua do Worker por tras do
  // engine — engine.unload() libera o modelo/pesos mas nao encerra a thread
  // do Worker (nao documentado como fazendo isso), entao ela precisa ser
  // finalizada separadamente ao desmontar o widget.
  const workerRef = useRef<Worker | null>(null);

  // Trivial, import-free feature check — deciding whether to even OFFER
  // the option must not itself trigger loading the WebLLM bundle.
  const gpuSupported = typeof navigator !== "undefined" && "gpu" in (navigator as any);

  // Built once, shared by the LLM path (handleGenerate) and the synthetic
  // fallback below — both read the exact same real fields, so the two
  // readings can never disagree about what the underlying data actually is.
  //
  // Auditoria Mestra 360° (secao 3): renomeado de wasmSignal/wasmConfidence
  // para heuristicSignal/heuristicConfidence — engine.direction/confidence
  // vem da heuristica de tendencia SMA/EMA em research-engine.js (via
  // trade-setup-matrix.js), NAO do WASM. O WASM (cyborg_quant_core.wasm)
  // so' calcula SMA/EMA/stddev/zscore em analysis-frame.js; nunca produz
  // LONG/SHORT/WAIT diretamente. O rotulo antigo implicava uma origem
  // errada, mesmo sendo funcionalmente inofensivo.
  const tacticalInput = useMemo<TacticalContextInput>(
    () => ({
      heuristicSignal: engine?.direction ?? null,
      heuristicConfidence: engine?.confidence ?? null,
      marketStructure: engine?.marketStructure ?? null,
      support: engine?.support ?? null,
      resistance: engine?.resistance ?? null,
      lorentzianClassification: realCycle?.lorentzian?.ok ? realCycle.lorentzian.classification ?? null : null,
      lorentzianConfidencePct: lorentzianConfidencePct(realCycle?.lorentzian),
      lorentzianSampleSize: realCycle?.lorentzian?.ok ? realCycle.lorentzian.sampleSize ?? null : null,
      unmitigatedFvgCount: (smcZones?.fairValueGaps ?? []).filter((z: PriceZone) => !z.mitigated).length,
      unmitigatedOrderBlockCount: (smcZones?.orderBlocks ?? []).filter((z: PriceZone) => !z.mitigated).length,
      unsweptLiquidityZoneCount: (smcZones?.liquidityZones ?? []).filter((z: LiquidityZone) => !z.swept).length,
      cvd: cvd ?? null,
      recentOrderflowSignalTypes: (orderflowSignals ?? []).slice(0, 5).map((s: OrderflowSignal) => s.type),
    }),
    [engine, realCycle, smcZones, cvd, orderflowSignals],
  );

  // Always on, zero cost, zero download — a rule-based reading of the same
  // real signals, available the instant data exists regardless of whether
  // the (optional, ~5GB) LLM has ever been activated.
  const syntheticReading = useMemo(() => buildSyntheticReading(tacticalInput), [tacticalInput]);

  // Encerra o par engine+worker atual, se houver. Chamado ao desmontar o
  // widget (efeito abaixo) — o unload() é best-effort porque o que garante
  // liberar a thread é o terminate() do Worker, não a promessa do engine.
  const teardownEngine = () => {
    engineRef.current?.unload().catch(() => {});
    workerRef.current?.terminate();
    engineRef.current = null;
    workerRef.current = null;
  };

  useEffect(() => {
    return () => teardownEngine();
  }, []);

  const handleActivate = async () => {
    if (!gpuSupported) {
      setStatus("error");
      setErrorMsg("WebGPU indisponível neste navegador — núcleo neural requer WebGPU.");
      return;
    }
    setStatus("loading");
    setErrorMsg(null);
    try {
      const { createLocalLlmEngine } = await import("./llm-bridge");
      const result = await createLocalLlmEngine((report) => setLoadProgress(report));
      if (!result.ok) {
        setStatus("error");
        setErrorMsg(result.reason);
        return;
      }
      engineRef.current = result.engine;
      workerRef.current = result.worker;
      setActiveModelId(result.modelId);
      setStatus("ready");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(`falha_inesperada: ${err?.message || err}`);
    }
  };

  const handleGenerate = async () => {
    if (!engineRef.current) return;
    setStatus("generating");
    setReading("");
    setErrorMsg(null);
    try {
      const { buildTacticalContext, streamTacticalReading } = await import("./llm-bridge");
      const context = buildTacticalContext(tacticalInput);
      const result = await streamTacticalReading(engineRef.current, context, (textSoFar) => setReading(textSoFar));
      if (!result.ok) {
        setErrorMsg(result.reason);
      }
      setStatus("ready");
    } catch (err: any) {
      setStatus("ready");
      setErrorMsg(`falha_inesperada: ${err?.message || err}`);
    }
  };

  return (
    <Widget id="neural_core" title="NÚCLEO NEURAL · LLAMA 3 (LOCAL) + SÍNTESE" flex="flex-[1.1] min-h-[160px]">
      <div className="flex flex-col h-full gap-2 p-1 text-[0.5rem]">
        <span className="text-[0.45rem] text-[#8ab4f8]/50 leading-relaxed">
          Leitura sintética abaixo é cálculo determinístico, sempre ativa, sem download. LLM
          local opcional (WebGPU, {" "}navegador — nenhum dado sai deste dispositivo) adiciona
          síntese em linguagem natural; modelo grande (~5GB) baixado só quando ativado.
        </span>

        <div className="flex flex-col gap-1 shrink-0">
          <span className="text-[0.45rem] font-bold tracking-[0.15em] text-[#8ab4f8] uppercase">
            Leitura Sintética · cálculo, sem IA
          </span>
          <div className="bg-[#010308] border border-[#8ab4f8]/15 rounded p-2 text-[#a0f0ff] leading-relaxed">
            {syntheticReading}
          </div>
        </div>

        <div className="h-px bg-[#8ab4f8]/10 shrink-0" />

        <span className="text-[0.45rem] font-bold tracking-[0.15em] text-[#00f0ff]/70 uppercase shrink-0">
          Leitura por IA generativa (opcional)
        </span>

        {status === "idle" && (
          <button
            type="button"
            onClick={handleActivate}
            disabled={!gpuSupported}
            className={`mt-1 py-2 rounded-lg border font-black tracking-[0.15em] text-[0.55rem] uppercase transition-colors ${gpuSupported ? "border-[#00f0ff60] bg-[#00f0ff15] text-[#00f0ff] active:bg-[#00f0ff25]" : "border-[#8ab4f8]/15 text-[#8ab4f8]/30 cursor-not-allowed"}`}
          >
            {gpuSupported ? "ATIVAR NÚCLEO NEURAL" : "WEBGPU INDISPONÍVEL"}
          </button>
        )}

        {status === "loading" && (
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-[0.45rem] tracking-[0.15em] text-[#f0d06f] font-bold uppercase animate-pulse">
              Injetando pesos da Meta…
              {loadProgress && ` (nível ${loadProgress.tier}/${loadProgress.tierCount})`}
            </span>
            <div className="w-full h-1.5 bg-[#010308] border border-[#f0d06f]/30 rounded overflow-hidden">
              <div
                className="h-full bg-[#f0d06f] transition-all duration-300"
                style={{ width: `${Math.round((loadProgress?.progress ?? 0) * 100)}%` }}
              />
            </div>
            <span className="text-[0.45rem] text-[#8ab4f8]/50 truncate">
              {loadProgress?.modelId ?? "…"} {loadProgress?.text ? `· ${loadProgress.text}` : ""}
            </span>
            {/* V11.5 Fase 7: se o nível 1 (8B) já falhou nesta ativação e a
                orquestração está tentando um nível mais leve, isso fica
                visível aqui — nunca um retry silencioso do mesmo modelo. */}
            {loadProgress && loadProgress.tier > 1 && (
              <span className="text-[0.42rem] text-[#f0d06f]/70 uppercase tracking-[0.1em]">
                Nível anterior indisponível neste dispositivo — tentando modelo mais leve.
              </span>
            )}
          </div>
        )}

        {(status === "ready" || status === "generating") && (
          <>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={status === "generating"}
              className="mt-1 py-1.5 rounded-lg border border-[#00ffaa60] bg-[#00ffaa15] text-[#00ffaa] active:bg-[#00ffaa25] font-black tracking-[0.15em] text-[0.5rem] uppercase disabled:opacity-50"
            >
              {status === "generating" ? "GERANDO…" : "GERAR LEITURA TÁTICA"}
            </button>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide bg-[#010308] border border-[#00f0ff15] rounded p-2 text-[#a0f0ff] leading-relaxed">
              {reading || (
                <span className="text-[#8ab4f8]/40 uppercase tracking-[0.2em]">
                  {status === "generating" ? "GERANDO…" : `${AWAIT} — TOQUE EM GERAR LEITURA TÁTICA`}
                </span>
              )}
            </div>
            <span className="text-[0.42rem] text-[#8ab4f8]/40 uppercase tracking-[0.15em]">
              {activeModelId ?? "Llama (local)"} · leitura analítica, não é ordem — decisão sempre
              humana.
            </span>
          </>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-[0.45rem] tracking-[0.15em] text-[#ff0055] font-bold uppercase">
              {errorMsg || "FALHA DESCONHECIDA"}
            </span>
            <span className="text-[0.42rem] text-[#8ab4f8]/50 leading-relaxed">
              A leitura sintética acima continua funcionando normalmente — só a síntese por IA
              generativa não carregou neste navegador.
            </span>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="py-1.5 rounded-lg border border-[#8ab4f8]/30 text-[#8ab4f8] text-[0.5rem] font-bold uppercase tracking-[0.15em]"
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        )}
      </div>
    </Widget>
  );
}

// --- BOTTOM PANELS ---
// EFIP prune: this strip once held five panels; four were permanently-empty
// boxes (gauges hardwired to null, a "stream" with no possible source, an
// execution log for an app that will never execute, a playback relic from
// the pre-React runtime). Only the real liquidation feed earned its place.
function BottomPanels() {
  const { widgets, liquidations, liquidationState } = useContext(WidgetContext) || {};
  // Without this guard, the 95px bar and its edge-fade overlays below still
  // render even when the widget inside returns null — an empty dark strip
  // floating with nothing under it. Not visible by default.
  if (!widgets?.tactical?.visible) return null;

  return (
    <div className="relative shrink-0 w-full mb-1">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#010205] to-transparent z-20 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#010205] to-transparent z-20 pointer-events-none"></div>

      <div className="h-[95px] flex gap-2 w-full pb-1 overflow-x-auto overflow-y-hidden scrollbar-hide snap-x pt-1 px-4">
        <Widget id="tactical" title="LIQUIDAÇÕES INSTITUCIONAIS · REAL" className="min-w-[320px] snap-start" flex="flex-[1.8]" extraHeader={<Activity size={12} className="text-[#ff005560]" />}>
          {liquidations && liquidations.length > 0 ? (
            <div className="flex flex-col justify-center h-full gap-1 px-1">
              {liquidations.slice(0, 2).map((liq: LiquidationEvent, i: number) => {
                const isLongLiq = liq.side === "LONG_LIQUIDATED";
                const color = isLongLiq ? "text-[#ff0055]" : "text-[#00ffaa]";
                return (
                  <div key={`${liq.timestamp}-${i}`} className="flex justify-between items-center text-[0.45rem] gap-2">
                    <span className={`font-bold tracking-wider whitespace-nowrap ${color}`}>
                      {isLongLiq ? "LONG LIQUIDADA" : "SHORT LIQUIDADA"}
                    </span>
                    <span className="text-[#a0f0ff]/80 font-mono">{liq.symbol}</span>
                    <span className="text-[#8ab4f8]/70 font-mono whitespace-nowrap">
                      ${(liq.notionalUsd / 1000).toFixed(0)}k
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold text-center px-2">
              {liquidationState === "ERROR" ? "FEED INDISPONÍVEL" : `${AWAIT} LIQUIDAÇÃO REAL…`}
            </div>
          )}
        </Widget>

      </div>
    </div>
  );
}

// --- FOOTER BAR ---
// Owns its own clock tick locally so the 1s interval never re-renders the
// rest of the tree (App/TopBar/all Widgets) — only this 24px bar updates.
function FooterBar() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Base da tela no mesmo padrão luminoso do topo (protocolo §3): borda,
  // texto e indicadores subiram de intensidade + um glow sutil para cima,
  // espelhando a sombra que a barra de comando projeta para baixo.
  return (
    <div className="h-[24px] border-t border-[#00f0ff35] shadow-[0_-2px_14px_rgba(0,240,255,0.08)] flex items-center justify-between px-3 bg-[#010308] shrink-0 text-[0.45rem] tracking-[0.2em] text-[#8ab4f8]/80 font-bold uppercase">
      <div className="flex gap-3">
        <span className="text-[#00f0ff] drop-shadow-[0_0_5px_#00f0ff]">AR10 CYBORG</span>
        <span className="hidden md:inline">|</span>
        <span className="hidden md:inline">TERMINAL READ-ONLY</span>
      </div>

      <div className="flex gap-2 hidden lg:flex items-center text-[#8ab4f8]/60">
        <span>DADOS REAIS</span>{" "}
        <div className="w-1 h-1 rounded-full bg-[#00f0ff]/70 shadow-[0_0_4px_rgba(0,240,255,0.6)]"></div>
        <span>FAIL-CLOSED</span>{" "}
        <div className="w-1 h-1 rounded-full bg-[#00f0ff]/70 shadow-[0_0_4px_rgba(0,240,255,0.6)]"></div>
        <span>SEM ORDENS</span>{" "}
        <div className="w-1 h-1 rounded-full bg-[#00f0ff]/70 shadow-[0_0_4px_rgba(0,240,255,0.6)]"></div>
        <span>SEM CHAVES</span>
      </div>

      <div className="flex gap-3 items-center">
        <span className="text-[#a0f0ff]/90">{time.toLocaleTimeString("en-US", { hour12: false })}</span>
        <div className="flex gap-1.5 ml-1 text-[#00f0ff]/80">
          <Disc size={10} />
          <Wifi size={10} />
          <Activity size={10} />
        </div>
      </div>
    </div>
  );
}
