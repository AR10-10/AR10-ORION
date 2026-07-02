// engine-bridge.ts — RAMBER's connection to the real engine, not a
// second implementation of it. Imports the exact same modules js/app.js
// uses: js/worker-client.js (WASM Quant Engine via Worker), the real Binance
// connector (js/real-data/binance-public.js), and the pure-function research
// pipeline (js/real-data/analysis-frame.js -> js/research/research-engine.js
// -> trade-setup-matrix.js / target-tracker.js). Same worker script, same
// wasm/cyborg_quant_core.wasm binary, same graduated support-resistance /
// market-structure engines (see ipad_runtime/src/research/QUARANTINE.md) —
// this file only calls them from React state instead of writing to `els[id]`
// DOM nodes. No re-implementation, no second heuristic, no fabricated value:
// every field below is either passthrough from these real modules or absent.
import { QuantWorkerClient } from '../../js/worker-client.js';
import { OrderflowWorkerClient } from '../../js/orderflow-client.js';
import { probe as probeBinance } from '../../js/real-data/binance-public.js';
import { createLivePoller } from '../../js/real-data/mexc-trades-stream.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';
import { buildRealAnalysisFrame } from '../../js/real-data/analysis-frame.js';
import { buildResearchEngineFrame } from '../../js/research/research-engine.js';
import { buildTradeSetupMatrix } from '../../js/research/trade-setup-matrix.js';
import { buildTargetTracker } from '../../js/research/target-tracker.js';
import { startLiquidationStream } from '../../js/real-data/binance-liquidations-stream.js';
import { analyze as analyzeFvgOrderBlocks } from '../../src/research/engines/fvg-order-block-engine.js';
import { classify as classifyLorentzian } from '../../src/research/engines/lorentzian-classifier.js';

export interface RealCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface PriceZone {
  type: 'BULLISH' | 'BEARISH';
  index: number;
  top: number;
  bottom: number;
  mitigated: boolean;
}

export interface RealCycleResult {
  ok: boolean;
  reason?: string;
  candles?: RealCandle[];
  lastPrice?: number;
  signal?: 'LONG' | 'SHORT' | 'WAIT' | null;
  confidence?: string | null;
  marketStructure?: string | null;
  entry?: number | null;
  target1?: number | null;
  target2?: number | null;
  stop?: number | null;
  support?: number | null;
  resistance?: number | null;
  condition?: string | null;
  rationale?: string | null;
  lorentzian?: LorentzianResult;
  forecast?: HorizonForecast[];
}

let workerClientSingleton: any = null;
let wasmReadyPromise: Promise<any> | null = null;

function getWorkerClient() {
  if (!workerClientSingleton) {
    // This build's output IS ipad_runtime/index.html (deploy-ipad-pwa.yml
    // copies RAMBER-ui/dist/ into ipad_runtime/ root) — so
    // workers/quant-worker.js is a direct sibling of the deployed page, same
    // relative relationship app.js used to use. The worker script resolves
    // its own wasm import relative to itself (import.meta.url inside
    // quant-worker.js), so this is the only path that needs to be correct.
    const workerUrl = new URL('workers/quant-worker.js', window.location.href).href;
    workerClientSingleton = new QuantWorkerClient(workerUrl);
    wasmReadyPromise = workerClientSingleton.initWasm();
  }
  return { workerClient: workerClientSingleton, wasmReady: wasmReadyPromise as Promise<any> };
}

const isNum = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);

// Worker/script load failures reject with a DOM Event (no .message), which a
// template string renders as the useless "[object Event]" — surfaced verbatim
// in the UI's engine-status line. Name the event type instead.
const describeError = (err: any): string => {
  if (typeof Event !== 'undefined' && err instanceof Event) {
    return `evento_${err.type || 'erro'}_no_carregamento_do_worker`;
  }
  return String(err?.message || err);
};

// One full real cycle: real Binance probe -> real WASM analysis frame ->
// real research engine -> real trade-setup-matrix + target-tracker. This is
// the same pipeline app.js's handleGenerateRealAnalysis() +
// refreshTargetTracker() run — same connector, same WASM, same engines,
// called directly here instead of triggered by a button/DOM event.
export async function runRealAnalysisCycle(symbol = 'BTC'): Promise<RealCycleResult> {
  const { workerClient, wasmReady } = getWorkerClient();
  try {
    await wasmReady;
  } catch (err: any) {
    return { ok: false, reason: `wasm_init_falhou: ${describeError(err)}` };
  }

  let probeResult: any;
  try {
    probeResult = await probeBinance({ symbol, interval: '15m', limit: 100 });
  } catch (err: any) {
    return { ok: false, reason: `probe_binance_lancou_excecao: ${describeError(err)}` };
  }
  if (probeResult.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
    return { ok: false, reason: `conector_binance_estado: ${probeResult.state}` };
  }
  const evidence = probeResult.evidence;

  // research-engine.js's buildResearchEngineFrame() explicitly throws on a
  // malformed {frame, evidence} pair — this function's contract (see
  // RealCycleResult) is to always resolve, never reject, so every pure-
  // function call in the pipeline below is covered by one try/catch.
  try {
    const frame = await buildRealAnalysisFrame({ evidence, workerClient, windowSize: 20 });
    if (frame.status !== 'OK') {
      return {
        ok: false,
        reason: frame.status_reason,
        candles: evidence.candles,
        lastPrice: isNum(evidence.ticker?.last_price) ? evidence.ticker.last_price : undefined,
      };
    }

    const research = buildResearchEngineFrame({ frame, evidence, context: {} });
    const matrix = buildTradeSetupMatrix({ research });

    const signal: 'LONG' | 'SHORT' | 'WAIT' | null =
      matrix.signal === 'LONG' || matrix.signal === 'SHORT' || matrix.signal === 'WAIT' ? matrix.signal : null;

    const tracker = buildTargetTracker({
      snapshot: { frame, research },
      livePrice: { value: evidence.ticker.last_price, mode: 'REAL' },
    });

    const route = signal === 'SHORT' ? tracker.rota_b_short : signal === 'LONG' ? tracker.rota_a_long : null;

    // Independent confluence signal — a real k-NN classification over the
    // same real candle window, never allowed to change `signal` above.
    const lorentzian = computeLorentzianClassification(evidence.candles);
    // Previsão multi-horizonte (4/8/16 velas) sobre os MESMOS candles reais.
    const forecast = computeMultiHorizonForecast(evidence.candles);

    return {
      ok: true,
      candles: evidence.candles,
      lastPrice: evidence.ticker.last_price,
      signal,
      lorentzian,
      forecast,
      confidence: typeof matrix.confidence === 'string' ? matrix.confidence : null,
      marketStructure: typeof frame.market_structure === 'string' ? frame.market_structure : null,
      entry: route && isNum(tracker.current_price) ? tracker.current_price : null,
      target1: route && isNum(route.target_1) ? route.target_1 : null,
      target2: route && isNum(route.target_2) ? route.target_2 : null,
      stop: route && isNum(route.invalidation) ? route.invalidation : null,
      support: isNum(frame.support) ? frame.support : null,
      resistance: isNum(frame.resistance) ? frame.resistance : null,
      condition: typeof matrix.condition === 'string' ? matrix.condition : null,
      rationale: typeof matrix.rationale === 'string' ? matrix.rationale : null,
    };
  } catch (err: any) {
    return { ok: false, reason: `pipeline_de_pesquisa_falhou: ${describeError(err)}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Flow Engine (OFI/Absorption/Exhaustion) fed by REAL MEXC trades.
//
// MEXC has no WebSocket connector in this codebase — mexc-trades-stream.js
// deliberately polls GET /api/v3/trades every few seconds instead (see that
// file's own header: a persistent WS would escape the app's audited
// fail-closed model of "one probe, one observed state, one CONNECTOR_STATES
// classification"). This bridge reuses that exact real poller — not a
// WebSocket, because the real thing this project built is not one.
// ─────────────────────────────────────────────────────────────────────────────
export interface OrderflowSignal {
  type: 'OFI' | 'ABSORPTION' | 'EXHAUSTION';
  confidence: number;
  price: number;
  timestamp: number;
  metadata: Record<string, any>;
}

export type OrderflowConnectorState = 'LIVE' | 'ERROR' | 'STOPPED';

let orderflowWorkerSingleton: any = null;
let orderflowInitPromise: Promise<any> | null = null;

function getOrderflowWorkerClient() {
  if (!orderflowWorkerSingleton) {
    // Same reasoning as getWorkerClient() above — workers/ is a direct
    // sibling of the deployed root index.html.
    const workerUrl = new URL('workers/orderflow-worker.js', window.location.href).href;
    orderflowWorkerSingleton = new OrderflowWorkerClient(workerUrl);
    orderflowInitPromise = orderflowWorkerSingleton.init(65536);
  }
  return { orderflowClient: orderflowWorkerSingleton, initReady: orderflowInitPromise as Promise<any> };
}

// Starts the real MEXC trade poller -> real Order Flow Engine pipeline.
// onSignals fires with newly produced real Signal[] (usually empty — OFI/
// Absorption/Exhaustion are meant to be rare relative to raw ticks).
// onState reports the real connector state on every poll cycle, including
// failures — the UI must never keep showing "LIVE" after the feed dies.
// onCvd reports the real Cumulative Volume Delta (running sum of signed
// real trade volume since this engine instance was created — see
// signal-engine.js's createEngineState) whenever new ticks were actually
// ingested. Returns a stop() function; call it on unmount.
export function startMexcOrderflowFeed(
  onSignals: (signals: OrderflowSignal[]) => void,
  onState: (state: OrderflowConnectorState, reason?: string) => void,
  onCvd: (value: number) => void,
  symbol = 'BTC',
): () => void {
  const { orderflowClient, initReady } = getOrderflowWorkerClient();
  let stopped = false;

  const poller = createLivePoller({
    symbol,
    intervalMs: 4000,
    limit: 500,
    onResult: async ({ state, ticks }: { state: string; ticks: any[] }) => {
      if (stopped) return;
      if (state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        onState('ERROR', state);
        return;
      }
      onState('LIVE');
      if (!ticks.length) return;
      try {
        await initReady;
        const { signals, cvd } = await orderflowClient.ingestTicks(ticks);
        if (stopped) return;
        if (Array.isArray(signals) && signals.length) onSignals(signals);
        if (isNum(cvd)) onCvd(cvd);
      } catch (err: any) {
        if (!stopped) onState('ERROR', `orderflow_worker_falhou: ${describeError(err)}`);
      }
    },
  });

  poller.start();

  return () => {
    stopped = true;
    poller.stop();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Real institutional liquidation feed (Binance USDT-M Futures, public,
// no key — binance-liquidations-stream.js). Distinct data source from the
// MEXC order-flow feed above: this is forced-liquidation events across
// the whole exchange, filtered to real notional size, not per-symbol
// trade ticks.
// ─────────────────────────────────────────────────────────────────────────────
export interface LiquidationEvent {
  symbol: string;
  side: 'LONG_LIQUIDATED' | 'SHORT_LIQUIDATED';
  price: number;
  qty: number;
  notionalUsd: number;
  timestamp: number;
}

export function startRealLiquidationFeed(
  onEvent: (event: LiquidationEvent) => void,
  onState: (state: 'LIVE' | 'ERROR') => void,
  minNotionalUsd = 50000,
): () => void {
  return startLiquidationStream({
    onEvent: (e: LiquidationEvent) => onEvent(e),
    onState: (state: string) => onState(state === CONNECTOR_STATES.ACTIVE_READ_ONLY ? 'LIVE' : 'ERROR'),
    minNotionalUsd,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Money Concepts: Fair Value Gaps + Order Blocks
// (fvg-order-block-engine.js). Deliberately computed against the exact
// candle array the chart renders (not the separate 100-candle window
// engine-bridge.ts's own analysis cycle probes) — the `index` field on
// each zone below is meaningless unless it lines up with the array the
// caller is actually drawing.
// ─────────────────────────────────────────────────────────────────────────────
export interface LiquidityZone {
  type: 'EQUAL_HIGH' | 'EQUAL_LOW';
  price: number;
  touches: number;
  index: number;
  swept: boolean;
}

export function computeSmcZones(candles: Array<{ open: number; high: number; low: number; close: number }>): {
  fairValueGaps: PriceZone[];
  orderBlocks: PriceZone[];
  liquidityZones: LiquidityZone[];
} {
  const result = analyzeFvgOrderBlocks({ ohlcv_series: candles });
  if (result.status !== 'OK') return { fairValueGaps: [], orderBlocks: [], liquidityZones: [] };
  return {
    fairValueGaps: result.fair_value_gaps,
    orderBlocks: result.order_blocks,
    liquidityZones: result.liquidity_zones,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lorentzian k-NN classifier (lorentzian-classifier.js) — an INDEPENDENT
// confluence signal, deliberately separate from RealCycleResult.signal.
// It never gates or overrides the real WASM engine's own LONG/SHORT/WAIT
// call; it's a second, differently-computed real opinion the UI must show
// side by side, clearly labeled, not blended into the primary signal.
// ─────────────────────────────────────────────────────────────────────────────
export interface LorentzianResult {
  ok: boolean;
  reason?: string;
  classification?: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence?: number;
  sampleSize?: number;
}

export function computeLorentzianClassification(
  candles: Array<{ open?: number; high?: number; low?: number; close?: number; o?: number; h?: number; l?: number; c?: number }>,
): LorentzianResult {
  const result = classifyLorentzian({ ohlcv_series: candles });
  if (result.status !== 'OK') return { ok: false, reason: result.reason };
  return {
    ok: true,
    classification: result.classification,
    confidence: result.confidence,
    sampleSize: result.sample_size,
  };
}

// Previsão multi-horizonte: o MESMO k-NN Lorentziano re-rotulado para cada
// horizonte (4/8/16 velas de 15m ≈ 1h/2h/4h à frente). Não é extrapolação de
// curva nem promessa — é a mesma classificação estatística real, repetida com
// rótulos de treino mais distantes. Horizontes maiores têm MENOS amostra
// (candles do fim da série ficam sem rótulo resolvido) e isso é reportado por
// horizonte, nunca escondido. Um horizonte sem dados suficientes vem ok:false
// individualmente em vez de derrubar os demais.
export const FORECAST_HORIZONS = [4, 8, 16] as const;

export interface HorizonForecast {
  horizonBars: number;
  ok: boolean;
  reason?: string;
  classification?: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence?: number;
  sampleSize?: number;
}

export function computeMultiHorizonForecast(
  candles: Array<{ open?: number; high?: number; low?: number; close?: number; o?: number; h?: number; l?: number; c?: number }>,
): HorizonForecast[] {
  return FORECAST_HORIZONS.map((horizon) => {
    const result = classifyLorentzian({ ohlcv_series: candles, horizon });
    if (result.status !== 'OK') return { horizonBars: horizon, ok: false, reason: result.reason };
    return {
      horizonBars: horizon,
      ok: true,
      classification: result.classification,
      confidence: result.confidence,
      sampleSize: result.sample_size,
    };
  });
}
