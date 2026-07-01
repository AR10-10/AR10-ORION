// engine-bridge.ts — cyborgpro's connection to the REAL AR10 engine, not a
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
import { probe as probeBinance } from '../../js/real-data/binance-public.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';
import { buildRealAnalysisFrame } from '../../js/real-data/analysis-frame.js';
import { buildResearchEngineFrame } from '../../js/research/research-engine.js';
import { buildTradeSetupMatrix } from '../../js/research/trade-setup-matrix.js';
import { buildTargetTracker } from '../../js/research/target-tracker.js';

export interface RealCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
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
}

let workerClientSingleton: any = null;
let wasmReadyPromise: Promise<any> | null = null;

function getWorkerClient() {
  if (!workerClientSingleton) {
    // Same relative relationship app.js uses (new URL('workers/quant-worker.js',
    // window.location.href)) — just resolved from this page's own deployed
    // location instead. cyborgpro-ui's built index.html is served from
    // ipad_runtime/cyborgpro-ui/dist/, so two levels up reaches ipad_runtime/,
    // where workers/quant-worker.js and wasm/cyborg_quant_core.wasm actually
    // live. The worker script resolves its own wasm import relative to
    // itself (import.meta.url inside quant-worker.js), so this is the only
    // path that needs to be correct here.
    const workerUrl = new URL('../../workers/quant-worker.js', window.location.href).href;
    workerClientSingleton = new QuantWorkerClient(workerUrl);
    wasmReadyPromise = workerClientSingleton.initWasm();
  }
  return { workerClient: workerClientSingleton, wasmReady: wasmReadyPromise as Promise<any> };
}

const isNum = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);

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
    return { ok: false, reason: `wasm_init_falhou: ${err?.message || err}` };
  }

  let probeResult: any;
  try {
    probeResult = await probeBinance({ symbol, interval: '15m', limit: 100 });
  } catch (err: any) {
    return { ok: false, reason: `probe_binance_lancou_excecao: ${err?.message || err}` };
  }
  if (probeResult.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
    return { ok: false, reason: `conector_binance_estado: ${probeResult.state}` };
  }
  const evidence = probeResult.evidence;

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

  return {
    ok: true,
    candles: evidence.candles,
    lastPrice: evidence.ticker.last_price,
    signal,
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
}
