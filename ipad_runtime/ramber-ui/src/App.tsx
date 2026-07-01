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
} from "./engine-bridge";
// llm-bridge.ts (and the @mlc-ai/web-llm package it imports) is loaded via
// dynamic import() only inside NeuralCoreWidget's activation handler below
// — never a static top-level import here. A static import would pull
// WebLLM's runtime code into the SAME bundle every visitor downloads on
// boot, defeating the entire point of this being opt-in. `import type`
// is erased at compile time (zero runtime/bundle cost either way).
import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import {
  LayoutDashboard,
  BarChart2,
  Activity,
  Cpu,
  Scan,
  Briefcase,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Wifi,
  Play,
  Disc,
  X,
  ShieldCheck,
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
// js/real-data/binance-public.js + js/real-data/analysis-frame.js +
// js/research/research-engine.js/target-tracker.js/trade-setup-matrix.js) —
// not a second implementation. Live price/orderbook still come from this
// file's own direct Binance WS (same real public endpoint either way).
// ─────────────────────────────────────────────────────────────────────────────
const DASH = "—";
const AWAIT = "AGUARDANDO";

const num = (v: any): v is number => typeof v === "number" && Number.isFinite(v);

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
  const [scannerData, setScannerData] = useState<any[]>([]);
  const [bootAt] = useState(() => Date.now());
  const [wsLive, setWsLive] = useState(false);
  const [activeTab, setActiveTab] = useState("DASHBOARD");

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

  // Widget visibility / floating state.
  const [widgets, setWidgets] = useState<{
    [key: string]: { visible: boolean; floating: boolean };
  }>({
    chart: { visible: false, floating: false },
    orderflow: { visible: false, floating: false },
    heatmap: { visible: false, floating: false },
    market_direction: { visible: true, floating: false },
    se_core: { visible: true, floating: false },
    confluence: { visible: false, floating: false },
    orderbook: { visible: false, floating: false },
    scanner: { visible: false, floating: false },
    exposure: { visible: false, floating: false },
    events: { visible: false, floating: false },
    neural_core: { visible: false, floating: false },
    processing: { visible: false, floating: false },
    stream: { visible: false, floating: false },
    tactical: { visible: false, floating: false },
    log: { visible: false, floating: false },
    playback: { visible: false, floating: false },
  });

  // Stable identity across renders (functional setState form needs no deps) —
  // required so the memoized context value below doesn't churn on every tick.
  const toggleWidget = useCallback((id: string, prop: "visible" | "floating") => {
    setWidgets((prev) => ({
      ...prev,
      [id]: { ...prev[id], [prop]: !prev[id][prop] },
    }));
  }, []);

  // REST: real klines + real 24h scanner ticker (public, read-only).
  const fetchSymbolData = async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=50`,
      );
      if (!res.ok) throw new Error(`klines HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setChartData(
          data.map((d: any) => ({
            open: Number(d[1]),
            high: Number(d[2]),
            low: Number(d[3]),
            close: Number(d[4]),
          })),
        );
      }

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
    } catch {
      // FAIL_CLOSED: leave last known real data; never substitute fabricated values.
    }
  };

  // REST: real Binance futures funding rate + open interest (public, read-only).
  const fetchDerivatives = async () => {
    try {
      const [fundingRes, oiRes] = await Promise.all([
        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT`),
        fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT`),
      ]);
      if (!fundingRes.ok || !oiRes.ok) throw new Error(`derivatives HTTP ${fundingRes.status}/${oiRes.status}`);
      const funding = await fundingRes.json();
      const oi = await oiRes.json();
      setDerivatives({
        fundingRate: num(Number(funding?.lastFundingRate))
          ? Number(funding.lastFundingRate)
          : null,
        openInterest: num(Number(oi?.openInterest))
          ? Number(oi.openInterest)
          : null,
      });
    } catch {
      setDerivatives({ fundingRate: null, openInterest: null });
    }
  };

  useEffect(() => {
    fetchSymbolData();
    fetchDerivatives();
    const restInterval = setInterval(fetchSymbolData, 60000);
    const derivInterval = setInterval(fetchDerivatives, 60000);

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelayMs = 1000;
    let unmounted = false;

    // depth10@100ms can fire up to 10x/s — coalesce into a trailing update
    // capped at ~5/s so the order-book-derived UI (heatmap, flow pressure,
    // market direction) doesn't re-render faster than a mobile Safari
    // browser can usefully paint.
    const ORDER_BOOK_THROTTLE_MS = 200;
    let pendingOrderBook: { bids: Level[]; asks: Level[] } | null = null;
    let orderBookFlushTimer: ReturnType<typeof setTimeout> | null = null;
    const flushOrderBook = () => {
      orderBookFlushTimer = null;
      if (pendingOrderBook) setOrderBook(pendingOrderBook);
    };

    const connect = () => {
      if (unmounted) return;
      ws = new WebSocket(
        "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/btcusdt@depth10@100ms/ethusdt@ticker/solusdt@ticker",
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
        if (msg.stream === "btcusdt@ticker") {
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
        } else if (msg.stream === "btcusdt@depth10@100ms") {
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
        } else if (
          msg.stream === "ethusdt@ticker" ||
          msg.stream === "solusdt@ticker"
        ) {
          setScannerData((prev) => {
            const symbolMap: any = {
              "ethusdt@ticker": "ETH/USDT",
              "solusdt@ticker": "SOL/USDT",
            };
            const targetSym = symbolMap[msg.stream];
            if (!targetSym) return prev;
            return prev.map((item) => {
              if (item.p === targetSym) {
                const change = Number(msg.data.P);
                return {
                  ...item,
                  s: change > 1 ? "LONG" : change < -1 ? "SHORT" : "NEUTRAL",
                  str: Math.min(Math.abs(change) * 20, 100),
                  chg: change,
                };
              }
              return item;
            });
          });
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
  }, []);

  // Real engine cycle — WASM Quant Engine + research pipeline (engine-bridge.ts).
  // Runs on the same cadence as the REST refresh above; the WASM worker and
  // candle window don't change meaningfully faster than that.
  useEffect(() => {
    let cancelled = false;
    const runCycle = async () => {
      const result = await runRealAnalysisCycle("BTC");
      if (cancelled) return;
      setRealCycle(result);
      setEngineStatus(result.ok ? "ok" : "error");
    };
    runCycle();
    const engineInterval = setInterval(runCycle, 60000);
    return () => {
      cancelled = true;
      clearInterval(engineInterval);
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
      "BTC",
    );
    return stop;
  }, []);

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
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Quantitative engine.
  //   • Flow pressure = real order-book imbalance (local, from the live WS book).
  //   • Signal/entry/target/stop/confidence/support/resistance/market structure
  //     come SOLELY from realCycle (engine-bridge.ts -> the real WASM engine +
  //     research pipeline) — never a local heuristic, never computed twice.
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
    const confidence = cycleOk ? (realCycle?.confidence ?? null) : null;
    const marketStructure = cycleOk ? (realCycle?.marketStructure ?? null) : null;
    const support = cycleOk ? (realCycle?.support ?? null) : null;
    const resistance = cycleOk ? (realCycle?.resistance ?? null) : null;

    // Real % move from entry to the real target (not a profit promise).
    const moveToTargetPct =
      entry !== null && target !== null && entry !== 0
        ? Math.abs(((target - entry) / entry) * 100)
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
      confidence,
      marketStructure,
      support,
      resistance,
      moveToTargetPct,
    };
  }, [priceData, orderBook, realCycle]);

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
  // AssistantOrb, MarketDirectionWidget, ConfluenceWidget...) from re-rendering
  // on renders that don't actually change any of these values.
  const contextValue = useMemo(
    () => ({
      widgets,
      toggleWidget,
      engine,
      smcZones,
      wsLive,
      bootAt,
      engineStatus,
      realCycle,
      orderflowSignals,
      orderflowState,
      orderflowReason,
      cvd,
      liquidations,
      liquidationState,
    }),
    [
      widgets,
      toggleWidget,
      engine,
      smcZones,
      wsLive,
      bootAt,
      engineStatus,
      realCycle,
      orderflowSignals,
      orderflowState,
      orderflowReason,
      cvd,
      liquidations,
      liquidationState,
    ],
  );

  return (
    <WidgetContext.Provider value={contextValue}>
      <div className="flex flex-col h-[100dvh] bg-[#020610] text-[#a0f0ff] font-mono overflow-hidden selection:bg-[#00f0ff30]">
        <TopBar data={priceData} derivatives={derivatives} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <SideBar activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="flex flex-col flex-1 p-2 gap-2 min-h-0 overflow-hidden relative">
            {activeTab === "DASHBOARD" ? (
              <>
                <div className="flex-1 flex flex-col md:flex-row gap-2 min-h-0 overflow-y-auto md:overflow-x-auto md:overflow-y-hidden scrollbar-hide p-1">
                  {/* Left Column */}
                  {(widgets.chart.visible ||
                    widgets.orderflow.visible ||
                    widgets.heatmap.visible) && (
                    <div className="flex-[0.85] flex flex-col gap-2 w-full md:w-auto md:min-w-[320px] min-h-[600px] md:min-h-0 md:h-full md:overflow-y-auto scrollbar-hide shrink-0 md:shrink pointer-events-none [&>*]:pointer-events-auto">
                      <ChartWidget data={priceData} chartData={chartData} />
                      <OrderFlowWidget />
                      <HeatmapWidget book={orderBook} data={priceData} />
                    </div>
                  )}

                  {/* Middle Column */}
                  {(widgets.market_direction.visible ||
                    widgets.se_core.visible ||
                    widgets.confluence.visible) && (
                    <div className="flex-[1.15] flex flex-col gap-2 w-full md:w-auto md:min-w-[380px] min-h-[600px] md:min-h-0 md:h-full md:overflow-y-auto scrollbar-hide relative z-0 shrink-0 md:shrink pointer-events-none [&>*]:pointer-events-auto">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.05)_0%,transparent_60%)] pointer-events-none mix-blend-screen"></div>
                      <MarketDirectionWidget />
                      <AssistantOrb inCenter={true} />
                      <ConfluenceWidget />
                    </div>
                  )}

                  {/* Right Column */}
                  {(widgets.orderbook.visible ||
                    widgets.scanner.visible ||
                    widgets.exposure.visible ||
                    widgets.neural_core.visible) && (
                    <div className="flex-[0.95] flex flex-col gap-2 w-full md:w-auto md:min-w-[340px] min-h-[600px] md:min-h-0 md:h-full md:overflow-y-auto scrollbar-hide shrink-0 md:shrink pointer-events-none [&>*]:pointer-events-auto">
                      <div className="flex flex-col sm:flex-row md:flex-col xl:flex-row gap-2 min-h-0 flex-[0.85]">
                        <OrderBookWidget data={priceData} book={orderBook} />
                        <ScannerWidget data={scannerData} />
                      </div>
                      <ExposureWidget />
                      <EventsWidget />
                      <NeuralCoreWidget />
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
                    {activeTab} MODULE
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
      </div>
    </WidgetContext.Provider>
  );
}

// --- CONFIGURATION PANEL ---
function ConfigPanel() {
  const { widgets, toggleWidget } = useContext(WidgetContext);
  return (
    <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 max-w-4xl mx-auto w-full">
      <div className="text-2xl font-black text-[#00f0ff] drop-shadow-[0_0_10px_#00f0ff] tracking-[0.2em] mb-4">
        SYSTEM CONFIGURATION
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(widgets).map(([id, state]: [string, any]) => (
          <div
            key={id}
            className="cyber-panel p-4 flex flex-col gap-3 bg-[#010205]"
          >
            <span className="font-bold text-white tracking-widest uppercase">
              {id} MODULE
            </span>
            <div className="flex justify-between items-center bg-[#010308] p-2 rounded border border-[#00f0ff20]">
              <span className="text-xs text-[#8ab4f8]">VISIBILITY</span>
              <button
                onClick={() => toggleWidget(id, "visible")}
                className={`text-xs px-3 py-1 font-bold rounded ${state.visible ? "bg-[#00ffaa20] text-[#00ffaa] border border-[#00ffaa50]" : "bg-[#ff005520] text-[#ff0055] border border-[#ff005550]"}`}
              >
                {state.visible ? "ENABLED" : "DISABLED"}
              </button>
            </div>
            <div className="flex justify-between items-center bg-[#010308] p-2 rounded border border-[#00f0ff20]">
              <span className="text-xs text-[#8ab4f8]">FLOAT MODE (RESIZABLE)</span>
              <button
                onClick={() => toggleWidget(id, "floating")}
                className={`text-xs px-3 py-1 font-bold rounded ${state.floating ? "bg-[#00f0ff20] text-[#00f0ff] border border-[#00f0ff50]" : "bg-transparent text-[#8ab4f8]/50 border border-[#8ab4f8]/30 hover:text-white"}`}
              >
                {state.floating ? "ACTIVE" : "INACTIVE"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- ASSISTANT ORB / S.E. CORE (center hero) ---
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
  const { widgets, engine, engineStatus, realCycle } = useContext(WidgetContext) || {};

  if (widgets && inCenter && !widgets.se_core?.visible) return null;

  const direction: Direction = engine?.direction ?? null;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const entry: number | null = engine?.entry ?? null;
  const target: number | null = engine?.target ?? null;
  const stop: number | null = engine?.stop ?? null;
  const flowPressure: number | null = engine?.flowPressure ?? null;
  const moveToTargetPct: number | null = engine?.moveToTargetPct ?? null;

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
      <div className="flex-1 shrink-0 flex flex-col items-center justify-between relative min-h-[500px] md:min-h-0 overflow-hidden z-0 group py-4 bg-[#010308]/60 backdrop-blur-3xl border border-[#00f0ff]/20 rounded-2xl shadow-[inset_0_0_80px_rgba(0,240,255,0.05),0_8px_32px_rgba(0,0,0,0.6)] w-full max-w-4xl mx-auto">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px]"></div>

        <div className="absolute top-3 left-0 right-0 flex justify-center opacity-50 text-[0.55rem] tracking-[0.4em] font-bold text-[#00f0ff] z-10">
          NÚCLEO DE INTELIGÊNCIA S.E.
        </div>

        <div
          className={`mt-6 w-full px-4 sm:px-6 transition-all duration-700 ${hovered ? "opacity-20 blur-[2px]" : "opacity-100 blur-0"} z-10`}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#00f0ff20] pb-2 gap-2 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className={`text-base sm:text-lg tracking-[0.2em] font-black ${dirColor}`}
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

            {/* Real engine status — honest state of the WASM + research
                pipeline cycle (engine-bridge.ts). Never implies a signal
                exists before the real engine has actually produced one. */}
            <div className="flex items-center gap-2 mt-2 z-10">
              <div
                className={`w-1.5 h-1.5 rounded-full ${engineStatus === "ok" ? "bg-[#00ffaa] animate-pulse" : engineStatus === "error" ? "bg-[#ff0055]" : "bg-[#f0d06f] animate-pulse"}`}
              ></div>
              {engineStatus === "pending" ? (
                <span className="flex items-center gap-1.5 text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase text-[#f0d06f]">
                  MOTOR WASM ·
                  <span className="skeleton-shimmer h-[0.6em] w-16 rounded-sm" />
                </span>
              ) : (
                <span
                  className={`text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase ${engineStatus === "ok" ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
                >
                  MOTOR WASM ·{" "}
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
                  VETOR do motor WASM acima; amostra pequena (~60-90 pontos,
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
                  {Math.round((realCycle.lorentzian.confidence ?? 0) * 100)}% (n=
                  {realCycle.lorentzian.sampleSize})
                </span>
              )}
            </div>

            <div className="flex flex-col mt-2 sm:mt-4 gap-4">
              {/* Structural levels — every value real or AGUARDANDO. */}
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
                  tag="REAL"
                />
                <LevelCard
                  label="Alvo 2 · Extensão"
                  value={engine.target2}
                  accent="#00ffaa"
                  tag="REAL"
                  dim={!num(engine.target2)}
                />
                <LevelCard
                  label={isShort ? "Stop · Resistência" : "Stop · Suporte"}
                  value={stop}
                  accent="#ff0055"
                  tag="REAL"
                />
              </div>

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
                    {engine?.marketStructure && (
                      <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#00f0ff20]">
                        <span className="text-[0.5rem] text-[#00f0ff]/80 font-bold tracking-widest">
                          ESTRUTURA
                        </span>
                        <span className="text-[0.55rem] text-white font-mono">
                          {engine.marketStructure}
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
                <span className="text-[0.4rem] tracking-[0.15em] text-[#8ab4f8]/40 uppercase font-bold text-center">
                  Sem posição ao vivo · execução desabilitada por projeto (READ_ONLY)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* S.E. central orb */}
        <div className="flex-1 flex items-center justify-center relative w-full mt-4 pb-8 min-h-[300px]">
          <div className="absolute w-[360px] h-[360px] rounded-full border border-[#00f0ff1a] animate-[spin_30s_linear_infinite] pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#00f0ff] rounded-full shadow-[0_0_15px_#00f0ff]"></div>
          </div>
          <div className="absolute w-[280px] h-[280px] rounded-full border border-[#00f0ff15] animate-[spin_20s_linear_infinite_reverse] pointer-events-none">
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
              className={`absolute w-64 h-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.25)_0%,transparent_70%)] blur-2xl transition-all duration-1000 ${hovered ? "opacity-100 scale-125 animate-[pulse_2s_ease-in-out_infinite]" : "opacity-50 scale-100 animate-[pulse_4s_ease-in-out_infinite]"}`}
            ></div>

            <div
              className={`relative w-32 h-32 rounded-full border-[3px] border-[#00f0ff60] bg-[#010205] flex items-center justify-center shadow-[0_0_50px_rgba(0,240,255,0.4)] transition-all duration-500 overflow-hidden cursor-pointer ${hovered ? "w-[450px] h-[120px] max-w-[90vw] rounded-2xl border-[#00f0ff] shadow-[0_0_60px_#00f0ff] bg-[#00f0ff0a] backdrop-blur-2xl" : ""}`}
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

        <div className="w-full px-4 sm:px-8 text-center z-10 mt-auto pb-4">
          <div className="inline-block bg-[#010205] border border-[#00f0ff20] px-4 py-2 rounded-lg text-[0.5rem] sm:text-[0.55rem] text-[#8ab4f8]/80 leading-relaxed text-justify max-w-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
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

  // Floating FAB variant.
  return (
    <div
      className={`fixed bottom-[40px] right-[40px] z-[9999] transition-all duration-700 ease-out flex items-center justify-center ${hovered ? "scale-110" : "scale-100"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        if (!inputValue) setHovered(false);
      }}
    >
      <div
        className={`absolute w-32 h-32 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.4)_0%,transparent_70%)] blur-md transition-all duration-1000 ${hovered ? "opacity-100 scale-150 animate-[pulse_2s_ease-in-out_infinite]" : "opacity-40 scale-100 animate-[pulse_4s_ease-in-out_infinite]"}`}
      ></div>
      <div
        className={`relative w-12 h-12 rounded-full border-2 border-[#00f0ff60] bg-[#010205] flex items-center justify-center shadow-[0_0_20px_#00f0ff] transition-all duration-500 overflow-hidden cursor-pointer ${hovered ? "w-[320px] h-[80px] rounded-xl border-[#00f0ff] shadow-[0_0_30px_#00f0ff] bg-[#00f0ff10] backdrop-blur-md" : ""}`}
      >
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hovered ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          <div className="w-8 h-8 rounded-full bg-[#00f0ff] opacity-20 animate-ping"></div>
          <div className="absolute w-4 h-4 rounded-full bg-[#00f0ff] shadow-[0_0_10px_#fff]"></div>
        </div>
        <div
          className={`absolute inset-0 flex flex-col justify-center px-4 transition-opacity duration-700 delay-100 ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-[#00f0ff] shadow-[0_0_15px_#00f0ff] animate-pulse shrink-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[0.45rem] text-[#8ab4f8] tracking-widest font-bold uppercase">
                S.E. · READ-ONLY
              </span>
              <span className="text-[0.55rem] text-white font-bold tracking-wider truncate animate-fade-in">
                {ASSISTANT_MESSAGES[msgIdx]}
              </span>
            </div>
          </div>
          <div className="flex gap-2 items-center mt-2 px-1">
            <input
              type="text"
              placeholder="NOTA DE ANÁLISE (LOCAL)..."
              className="flex-1 bg-transparent border-none outline-none text-[0.5rem] text-white font-bold tracking-widest placeholder-[#00f0ff50]"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setInputValue("");
                  setHovered(false);
                }
              }}
            />
            <div className="flex gap-[2px] items-end h-3 shrink-0">
              {[40, 70, 30, 80, 55, 90, 45, 65].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-[#00f0ff] rounded-full animate-[sound-wave_1s_ease-in-out_infinite]"
                  style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
}: {
  data?: PriceState | null;
  derivatives: DerivativesState;
}) {
  const { wsLive, bootAt } = useContext(WidgetContext) || {};
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
    <div className="h-[52px] border-b border-[#00f0ff20] flex items-center justify-between px-3 lg:px-6 bg-[#010308]/95 shrink-0 z-20 backdrop-blur-xl shadow-[0_2px_15px_rgba(0,0,0,0.5)]">
      <div className="flex gap-4 md:gap-6 h-full items-center">
        <div className="flex items-center gap-3 pr-4 border-r border-[#00f0ff20] h-[70%]">
          <div className="w-8 h-8 rounded-full bg-[#f7931a] flex items-center justify-center shadow-[0_0_10px_rgba(247,147,26,0.4)]">
            <span className="text-white font-bold text-sm">₿</span>
          </div>
          <div className="flex flex-col">
            <div className="text-[#a0f0ff] font-black text-sm flex items-center gap-1.5">
              BTC/USDT{" "}
              <span className="text-[0.5rem] bg-[#00f0ff20] text-[#00f0ff] px-1 py-0.5 rounded uppercase tracking-wider">
                Spot
              </span>
            </div>
            <div
              className={`text-sm font-bold font-mono ${isPos ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
            >
              {fmt(data?.price ?? null)}
            </div>
          </div>
        </div>

        <div className="hidden lg:flex gap-4 h-full items-center">
          <TopStat
            label="24H CHANGE"
            value={fmtSignedPct(data?.deltaPct ?? null)}
            color={isPos ? "text-[#00ffaa]" : "text-[#ff0055]"}
          />
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
            label="24H VOL (BTC)"
            value={fmtInt(data?.volume ?? null)}
            color="text-[#a0f0ff]"
          />
          <TopStat
            label="FUNDING / 8H"
            value={num(funding) ? `${(funding * 100).toFixed(4)}%` : DASH}
            color="text-[#f7931a]"
          />
          <TopStat
            label="OPEN INTEREST"
            value={num(oi) ? `${fmtInt(oi)} BTC` : DASH}
            color="text-[#a0f0ff]"
          />
        </div>
      </div>

      <div className="hidden xl:flex flex-col items-center justify-center px-4 cursor-default group absolute left-1/2 -translate-x-1/2">
        <div className="text-xl font-black tracking-[0.3em] text-[#00f0ff] drop-shadow-[0_0_12px_rgba(0,240,255,0.8)] leading-none transition-all group-hover:drop-shadow-[0_0_20px_rgba(0,240,255,1)]">
          RAMBER
        </div>
        <div className="text-[0.4rem] text-[#00f0ff80] tracking-[0.4em] mt-1.5 whitespace-nowrap font-bold uppercase transition-colors group-hover:text-[#00f0ff]">
          TERMINAL READ-ONLY · DADOS REAIS
        </div>
      </div>

      <div className="flex gap-2 md:gap-4 h-full items-center justify-end">
        <TopStat
          label="MODO"
          value="READ-ONLY"
          color="text-[#00ffaa]"
          active
          className="hidden md:flex"
        />
        <TopStat
          label="FEED"
          value={wsLive ? "LIVE" : AWAIT}
          subValue={wsLive ? "WS" : ""}
          color={wsLive ? "text-[#00ffaa]" : "text-[#8ab4f8]"}
          subColor="text-[#00ffaa]"
          className="hidden md:flex"
        />
        <TopStat label="SESSÃO" value={uptime || DASH} color="text-white" />
      </div>
    </div>
  );
}
interface TopStatProps {
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  subColor?: string;
  active?: boolean;
  className?: string;
}

const TopStat = React.memo(function TopStat({
  label,
  value,
  subValue,
  color,
  subColor,
  active,
  className = "",
}: TopStatProps) {
  return (
    <div
      className={`flex flex-col justify-center min-w-[85px] h-[36px] px-2.5 transition-colors ${active ? "border border-[#00f0ff30] rounded bg-[#00f0ff08] shadow-[inset_0_0_10px_rgba(0,240,255,0.05)]" : "hover:bg-white/5 rounded"} ${className}`}
    >
      <span className="text-[0.4rem] text-[#8ab4f8] tracking-[0.15em] mb-[2px] text-center font-bold">
        {label}
      </span>
      <div className="flex items-center justify-center gap-1.5 leading-none">
        <span className={`text-[0.65rem] font-bold tracking-widest ${color}`}>
          {value}
        </span>
        {subValue && (
          <span className={`text-[0.5rem] font-bold ${subColor || color}`}>
            {subValue}
          </span>
        )}
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
  const items = [
    { icon: LayoutDashboard, label: "DASHBOARD" },
    { icon: BarChart2, label: "MARKET" },
    { icon: Activity, label: "ANALYTICS" },
    { icon: Cpu, label: "AI CORE" },
    { icon: Scan, label: "SCANNER" },
    { icon: Briefcase, label: "PORTFOLIO" },
    { icon: Settings, label: "SETTINGS" },
  ];
  return (
    <div className="w-[60px] md:w-[70px] border-r border-[#00f0ff20] bg-[#010308]/95 flex flex-col items-center py-3 gap-5 shrink-0 z-10 overflow-y-auto scrollbar-hide backdrop-blur-md">
      <div className="relative mb-1">
        <Target className="text-[#00f0ff] opacity-90" size={20} strokeWidth={1.5} />
        <div className="absolute inset-0 border border-[#00f0ff] rounded-full animate-ping opacity-30"></div>
      </div>
      {items.map((item) => {
        const isActive = activeTab === item.label;
        return (
          <div
            key={item.label}
            onClick={() => setActiveTab(item.label)}
            className={`flex flex-col items-center gap-1 w-full cursor-pointer transition-colors relative py-1.5 ${isActive ? "text-[#00f0ff] bg-gradient-to-r from-[#00f0ff1a] to-transparent" : "text-[#8ab4f8]/50 hover:text-[#8ab4f8]"}`}
          >
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]"></div>
            )}
            <item.icon size={16} className="relative z-10" />
            <span className="text-[0.35rem] md:text-[0.4rem] tracking-[0.1em] text-center font-bold mt-1">
              {item.label}
            </span>
          </div>
        );
      })}
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
          <span className="text-[0.4rem] text-[#8ab4f8]/50">
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
  const [minimized, setMinimized] = useState(false);

  const widgetState = id && widgets ? widgets[id] : null;
  if (widgetState && !widgetState.visible) return null;

  const isFloating = widgetState && widgetState.floating;

  const renderHeader = (isFloatMode = false) => (
    <div
      className="cyber-header cursor-pointer select-none flex items-center justify-between"
      onDoubleClick={(e) => {
        if (!isFloatMode) {
          e.stopPropagation();
          setMaximized(!maximized);
        }
      }}
    >
      <span className="font-bold tracking-[0.2em]">{title}</span>
      <div className="flex gap-2 items-center">
        {extraHeader && <div>{extraHeader}</div>}
        <div className="flex gap-1">
          {!maximized && !isFloatMode && (
            <div
              className="text-[#8ab4f8]/50 hover:text-[#00f0ff] px-1 py-0.5 rounded cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setMinimized(true);
              }}
            >
              _
            </div>
          )}
          {maximized && !isFloatMode && (
            <div
              className="text-[#00f0ff] hover:text-white px-2 py-0.5 rounded bg-[#00f0ff10] border border-[#00f0ff30]"
              onClick={(e) => {
                e.stopPropagation();
                setMaximized(false);
              }}
            >
              ✕
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
          ? `fixed inset-2 md:inset-8 z-50 cyber-panel flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.2)] bg-[#010308]/95 backdrop-blur-xl`
          : `cyber-panel ${flex} ${className} min-h-0 transition-all`
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
function ChartWidget({ data, chartData }: any) {
  // Real Fair Value Gaps / Order Blocks / Liquidity zones — computed once
  // in App() (see contextValue) against this exact candle array, shared
  // with the Neural Core widget's tactical-context prompt so both use the
  // same real counts rather than two independent computations.
  const { smcZones } = useContext(WidgetContext) || {};

  return (
    <Widget
      id="chart"
      flex="flex-[1.8]"
      extraHeader={
        <div className="flex gap-1 text-[0.45rem]">
          {["1M", "5M", "15M", "1H", "4H", "1D"].map((tf) => (
            <span
              key={tf}
              className={`px-1 rounded ${tf === "15M" ? "bg-[#00f0ff20] text-[#00f0ff] font-bold border border-[#00f0ff40]" : "text-[#8ab4f8]/60"}`}
            >
              {tf}
            </span>
          ))}
        </div>
      }
    >
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10 pointer-events-none group">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#f3ba2f] flex items-center justify-center text-black font-bold text-[9px] shadow-[0_0_8px_#f3ba2f]">
            ₿
          </div>
          <span className="text-white font-bold tracking-[0.15em] text-xs drop-shadow-[0_0_5px_#fff]">
            BTC/USDT
          </span>
          <span className="text-[0.45rem] text-[#8ab4f8] tracking-widest border border-[#8ab4f8]/30 px-1 rounded bg-[#010308]/50">
            BINANCE SPOT
          </span>
        </div>
        <div className="flex gap-3 text-[0.45rem] text-right pointer-events-auto bg-[#010308]/80 p-1 rounded border border-[#00f0ff20] backdrop-blur-sm opacity-50 group-hover:opacity-100 transition-opacity">
          <div className="flex flex-col">
            <span className="text-slate-500 mb-[2px]">HIGH</span>
            <span className="text-white font-bold">{fmt(data?.high ?? null)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 mb-[2px]">VOL</span>
            <span className="text-white font-bold">{fmtInt(data?.volume ?? null)}</span>
          </div>
        </div>
      </div>

      <div className="absolute top-8 left-2 flex items-end gap-2 z-10 pointer-events-none">
        <span className="text-2xl font-black text-[#00ffaa] tracking-tighter drop-shadow-[0_0_8px_rgba(0,255,170,0.4)]">
          {fmt(data?.price ?? null)}
        </span>
        {data && num(data.deltaPct) && (
          <div className="flex flex-col justify-center pb-[2px]">
            <span
              className={`text-[0.55rem] font-bold leading-tight tracking-wider ${data.deltaPct >= 0 ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
            >
              {fmtSignedPct(data.deltaPct)}
            </span>
            <span
              className={`text-[0.55rem] font-bold leading-tight tracking-wider ${data.deltaPct >= 0 ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
            >
              {num(data.delta) ? `${data.delta >= 0 ? "+" : ""}${data.delta.toFixed(2)}` : DASH}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 mt-[50px] mr-8 relative min-h-0">
        {chartData && chartData.length > 0 ? (
          <CandleChart data={chartData} last={data?.price ?? null} zones={smcZones} />
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
}: {
  data: any[];
  last: number | null;
  zones?: { fairValueGaps: PriceZone[]; orderBlocks: PriceZone[]; liquidityZones?: LiquidityZone[] };
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
      {unsweptLiquidity.map((z, i) => (
        <div
          key={`liq-${z.index}-${i}`}
          className="absolute pointer-events-none border-t border-dashed border-[#f0d06f]/50 flex items-center"
          style={{ top: `${priceToPct(z.price)}%`, left: `${(z.index / data.length) * 100}%`, right: 0 }}
        >
          <span className="text-[0.35rem] font-bold text-[#f0d06f]/70 bg-[#010308]/60 px-[3px] leading-none -translate-y-1/2">
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
          className="absolute right-[-36px] text-[0.4rem] font-bold text-[#010308] bg-[#00ffaa] px-[4px] py-[2px] rounded shadow-[0_0_10px_#00ffaa] translate-y-[-50%] border border-[#00ffaa] flex items-center gap-1"
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
          <span className={`text-[0.4rem] tracking-[0.15em] font-bold uppercase ${ofColor}`}>
            MEXC ORDERFLOW ·{" "}
            {ofState === "LIVE" ? "LIVE" : ofState === "ERROR" ? `FALHOU (${orderflowReason || DASH})` : "AGUARDANDO"}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-1">
          {signals.length === 0 ? (
            <div className="text-[0.4rem] text-[#8ab4f8]/40 tracking-widest py-1">
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
      <span className="text-[0.4rem] text-[#8ab4f8] uppercase tracking-[0.1em] mb-[2px]">
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

  return (
    <div className="flex justify-between items-center shrink-0 z-10 relative pt-4 px-4 xl:px-8 w-full max-w-[600px] mx-auto h-[85px] border-b-2 border-[#00f0ff10] pb-4 mb-4 bg-gradient-to-b from-[#00f0ff08] to-transparent rounded-t-lg">
      <div className="flex flex-col items-center p-3 bg-gradient-to-br from-[#00ffaa10] to-transparent border border-[#00ffaa30] rounded-lg shadow-[inset_0_0_20px_rgba(0,255,170,0.05)] transition-all flex-1 mx-2">
        <span className="text-[0.6rem] text-[#00ffaa] tracking-[0.25em] mb-[2px] font-bold">
          PRESSÃO BID
        </span>
        <div className="flex items-center gap-2 text-3xl font-black text-[#00ffaa] drop-shadow-[0_0_12px_rgba(0,255,170,0.6)]">
          <ArrowUpRight size={24} strokeWidth={3} />{" "}
          {num(buyPercent) ? Math.round(buyPercent) : DASH}
          <span className="text-xl">%</span>
        </div>
      </div>

      <div className="flex flex-col items-center px-4 py-2 text-center flex-[1.2] relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.1)_0%,transparent_70%)] pointer-events-none"></div>
        <span className="text-[0.55rem] text-[#8ab4f8] tracking-[0.3em] uppercase mb-[4px] font-bold z-10">
          VETOR DE MERCADO
        </span>
        <span className={`text-lg font-black tracking-[0.15em] mb-[2px] z-10 uppercase transition-colors ${vectorColor}`}>
          {vectorLabel}
        </span>
        <div className="flex items-center gap-1.5 mt-1 z-10 bg-[#020610] px-2 py-0.5 rounded-full border border-[#00f0ff30]">
          <div className={`w-2 h-2 rounded-full animate-pulse ${glowColor}`}></div>
          <span className="text-[0.5rem] uppercase tracking-widest font-bold text-[#8ab4f8]">
            LIVRO REAL
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center p-3 bg-gradient-to-br from-[#ff005510] to-transparent border border-[#ff005530] rounded-lg shadow-[inset_0_0_20px_rgba(255,0,85,0.05)] transition-all flex-1 mx-2">
        <span className="text-[0.6rem] text-[#ff0055] tracking-[0.25em] mb-[2px] font-bold">
          PRESSÃO ASK
        </span>
        <div className="flex items-center gap-2 text-3xl font-bold text-[#ff0055] drop-shadow-[0_0_12px_rgba(255,0,85,0.6)]">
          {num(sellPercent) ? Math.round(sellPercent) : DASH}
          <span className="text-xl">%</span> <ArrowDownRight size={24} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}

// --- MIDDLE COLUMN: CONFLUENCE (no real multi-agent backend → honest AGUARDANDO) ---
function ConfluenceWidget() {
  const { widgets } = useContext(WidgetContext) || {};
  if (widgets && !widgets.confluence.visible) return null;

  const agents = [
    { name: "TENDÊNCIA", role: "ESTRUTURA" },
    { name: "LIQUIDEZ", role: "LIVRO" },
    { name: "FLUXO", role: "DELTA" },
    { name: "VOLUME", role: "24H" },
    { name: "SENTIMENTO", role: "FUNDING" },
  ];
  return (
    <div className="shrink-0 p-2 z-10 relative flex flex-col items-center w-full max-w-[500px] mx-auto bg-gradient-to-t from-[#00f0ff05] to-transparent border-t border-[#00f0ff20] rounded-t-[4px]">
      <div className="flex items-center w-full justify-between mb-3 px-2">
        <span className="text-[0.55rem] text-[#8ab4f8] tracking-[0.3em] uppercase font-bold">
          CONSENSO MULTI-AGENTE
        </span>
        <span className="text-[0.45rem] text-[#8ab4f8]/60 tracking-widest uppercase border border-[#8ab4f8]/20 px-1 rounded">
          backend não conectado
        </span>
      </div>

      <div className="flex justify-between w-full px-1 mb-3">
        {agents.map((a, i) => (
          <div
            key={i}
            className="flex flex-col items-center border border-[#00f0ff10] bg-[#010308]/60 p-1.5 rounded flex-1 mx-[2px] min-w-0"
          >
            <span className="text-[0.4rem] text-[#8ab4f8]/60 tracking-[0.1em] mb-[2px] truncate w-full text-center">
              {a.name}
            </span>
            <span className="text-[0.45rem] text-[#a0f0ff] tracking-wider mb-1 font-bold truncate w-full text-center">
              {a.role}
            </span>
            <span className="text-[0.55rem] font-bold text-[#8ab4f8]/50 tracking-widest">
              {AWAIT}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 w-full px-2 pb-1">
        <span className="text-[0.5rem] text-[#8ab4f8]/80 tracking-[0.2em] font-bold">
          SINCRONIA
        </span>
        <span className="text-base font-black text-[#8ab4f8]/50">{DASH}</span>
        <div className="flex-1 h-1.5 bg-[#010308] rounded-full overflow-hidden border border-[#00f0ff20]"></div>
      </div>
    </div>
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

// --- RIGHT COLUMN: EVENTS (no real event feed → honest empty state) ---
function EventsWidget() {
  return (
    <Widget id="events" title="TELEMETRIA DE EVENTOS" flex="flex-[0.8] min-h-[110px]">
      <div className="flex-1 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
        {AWAIT} EVENTOS REAIS…
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
  const [loadProgress, setLoadProgress] = useState<{ progress: number; text: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reading, setReading] = useState<string>("");
  const engineRef = useRef<MLCEngineInterface | null>(null);

  // Trivial, import-free feature check — deciding whether to even OFFER
  // the option must not itself trigger loading the WebLLM bundle.
  const gpuSupported = typeof navigator !== "undefined" && "gpu" in (navigator as any);

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
      const context = buildTacticalContext({
        wasmSignal: engine?.direction ?? null,
        wasmConfidence: engine?.confidence ?? null,
        marketStructure: engine?.marketStructure ?? null,
        support: engine?.support ?? null,
        resistance: engine?.resistance ?? null,
        lorentzianClassification: realCycle?.lorentzian?.ok ? realCycle.lorentzian.classification ?? null : null,
        lorentzianConfidencePct: realCycle?.lorentzian?.ok
          ? Math.round((realCycle.lorentzian.confidence ?? 0) * 100)
          : null,
        lorentzianSampleSize: realCycle?.lorentzian?.ok ? realCycle.lorentzian.sampleSize ?? null : null,
        unmitigatedFvgCount: (smcZones?.fairValueGaps ?? []).filter((z: PriceZone) => !z.mitigated).length,
        unmitigatedOrderBlockCount: (smcZones?.orderBlocks ?? []).filter((z: PriceZone) => !z.mitigated).length,
        unsweptLiquidityZoneCount: (smcZones?.liquidityZones ?? []).filter((z: LiquidityZone) => !z.swept).length,
        cvd: cvd ?? null,
        recentOrderflowSignalTypes: (orderflowSignals ?? []).slice(0, 5).map((s: OrderflowSignal) => s.type),
      });
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
    <Widget id="neural_core" title="NÚCLEO NEURAL · META LLAMA 3 (LOCAL)" flex="flex-[1.1] min-h-[160px]">
      <div className="flex flex-col h-full gap-2 p-1 text-[0.5rem]">
        <span className="text-[0.4rem] text-[#8ab4f8]/50 leading-relaxed">
          LLM local (WebGPU, {" "}navegador — nenhum dado sai deste dispositivo). Modelo grande
          (~5GB) baixado só quando ativado. Experimental: requer suporte real a WebGPU no
          navegador.
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
            </span>
            <div className="w-full h-1.5 bg-[#010308] border border-[#f0d06f]/30 rounded overflow-hidden">
              <div
                className="h-full bg-[#f0d06f] transition-all duration-300"
                style={{ width: `${Math.round((loadProgress?.progress ?? 0) * 100)}%` }}
              />
            </div>
            <span className="text-[0.4rem] text-[#8ab4f8]/50 truncate">{loadProgress?.text ?? "…"}</span>
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
                  {AWAIT} LEITURA…
                </span>
              )}
            </div>
            <span className="text-[0.35rem] text-[#8ab4f8]/40 uppercase tracking-[0.15em]">
              Llama-3-8B-Instruct-q4f32_1-MLC (local) · leitura analítica, não é ordem — decisão
              sempre humana.
            </span>
          </>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-[0.45rem] tracking-[0.15em] text-[#ff0055] font-bold uppercase">
              {errorMsg || "FALHA DESCONHECIDA"}
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
function BottomPanels() {
  const { widgets, liquidations, liquidationState } = useContext(WidgetContext) || {};
  const anyVisible =
    widgets?.processing?.visible ||
    widgets?.stream?.visible ||
    widgets?.tactical?.visible ||
    widgets?.log?.visible ||
    widgets?.playback?.visible;
  // Without this guard, the 95px bar and its edge-fade overlays below still
  // render even when every widget inside returns null — an empty dark strip
  // floating with nothing under it. No widgets here are visible by default.
  if (!anyVisible) return null;

  return (
    <div className="relative shrink-0 w-full mb-1">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#010205] to-transparent z-20 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#010205] to-transparent z-20 pointer-events-none"></div>

      <div className="h-[95px] flex gap-2 w-full pb-1 overflow-x-auto overflow-y-hidden scrollbar-hide snap-x pt-1 px-4">
        <Widget id="processing" title="MÓDULOS DE PROCESSAMENTO" className="min-w-[280px] snap-start" flex="flex-[1.2]">
          <div className="flex justify-around items-center px-1 h-full pb-1">
            <Gauge value={null} label="CPU" color="#00f0ff" />
            <Gauge value={null} label="GPU" color="#00f0ff" />
            <Gauge value={null} label="RAM" color="#00ffaa" />
            <Gauge value={null} label="WORK" color="#00ffaa" />
          </div>
        </Widget>

        <Widget id="stream" title="STREAM DE INTELIGÊNCIA" className="min-w-[320px] snap-start" flex="flex-[1.8]" extraHeader={<Wifi size={12} className="text-[#00f0ff60]" />}>
          <div className="flex items-center justify-center h-full text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
            {AWAIT} FONTE DE INTELIGÊNCIA…
          </div>
        </Widget>

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

        <Widget id="log" title="LOG DE EXECUÇÃO" className="min-w-[200px] snap-start" flex="flex-[1]">
          <div className="flex items-center justify-center h-full text-[0.5rem] tracking-[0.2em] text-[#8ab4f8]/40 font-bold text-center px-2">
            SEM EXECUÇÃO (READ-ONLY)
          </div>
        </Widget>

        <Widget id="playback" title="PLAYBACK ENGINE" className="min-w-[280px] snap-start" flex="flex-[1.2]" extraHeader={<Play size={12} className="text-[#00f0ff60]" />}>
          <div className="px-3 flex flex-col justify-center h-full gap-2.5">
            <div className="flex justify-between items-center text-[0.5rem]">
              <div className="flex flex-col">
                <span className="text-[#8ab4f8]/70 uppercase tracking-widest mb-[2px]">STATUS</span>
                <span className="text-[#8ab4f8]/50 font-bold">{AWAIT}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#8ab4f8]/70 uppercase tracking-widest mb-[2px]">CLOCK</span>
                <span className="text-[#8ab4f8]/50 font-bold">{DASH}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#8ab4f8]/70 uppercase tracking-widest mb-[2px]">SOURCE</span>
                <span className="text-[#8ab4f8]/50 font-bold">{DASH}</span>
              </div>
              <div className="w-7 h-7 rounded-full border border-[#00f0ff30] bg-[#00f0ff08] flex items-center justify-center opacity-50">
                <Play size={12} className="text-[#00f0ff] ml-[1px]" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-[2px] bg-[#8ab4f8]/20 relative"></div>
              <span className="text-[0.45rem] text-[#8ab4f8]/70 shrink-0 font-bold">00:00 / 00:00</span>
            </div>
          </div>
        </Widget>
      </div>
    </div>
  );
}
const Gauge = React.memo(function Gauge({ value, label, color }: { value: number | null; label: string; color: string }) {
  const has = num(value);
  return (
    <div className="flex flex-col items-center justify-center relative w-10 h-10">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-[#8ab4f8]/10"
          strokeWidth="3"
          stroke="currentColor"
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        {has && (
          <path
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${value}, 100`}
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span
          className="text-[0.5rem] font-bold"
          style={{ color: has ? color : "rgba(138,180,248,0.5)", textShadow: has ? `0 0 5px ${color}` : "none" }}
        >
          {has ? `${value}%` : DASH}
        </span>
        <span className="text-[0.3rem] text-[#8ab4f8]/70 tracking-widest mt-[1px] font-bold">
          {label}
        </span>
      </div>
    </div>
  );
});

// --- FOOTER BAR ---
// Owns its own clock tick locally so the 1s interval never re-renders the
// rest of the tree (App/TopBar/all Widgets) — only this 24px bar updates.
function FooterBar() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-[24px] border-t border-[#00f0ff20] flex items-center justify-between px-3 bg-[#010308] shrink-0 text-[0.45rem] tracking-[0.2em] text-[#8ab4f8]/60 font-bold uppercase">
      <div className="flex gap-3">
        <span className="text-[#00f0ff] drop-shadow-[0_0_3px_#00f0ff]">RAMBER</span>
        <span className="hidden md:inline">|</span>
        <span className="hidden md:inline">TERMINAL READ-ONLY</span>
      </div>

      <div className="flex gap-2 hidden lg:flex items-center text-[#8ab4f8]/40">
        <span>DADOS REAIS</span>{" "}
        <div className="w-1 h-1 rounded-full bg-[#00f0ff]/40"></div>
        <span>FAIL-CLOSED</span>{" "}
        <div className="w-1 h-1 rounded-full bg-[#00f0ff]/40"></div>
        <span>SEM ORDENS</span>{" "}
        <div className="w-1 h-1 rounded-full bg-[#00f0ff]/40"></div>
        <span>SEM CHAVES</span>
      </div>

      <div className="flex gap-3 items-center">
        <span>{time.toLocaleTimeString("en-US", { hour12: false })}</span>
        <div className="flex gap-1.5 ml-1 text-[#00f0ff]/60">
          <Disc size={10} />
          <Wifi size={10} />
          <Activity size={10} />
        </div>
      </div>
    </div>
  );
}
