// engine-bridge.ts — RAMBER's connection to the real engine, not a
// second implementation of it. Imports the exact same modules js/app.js
// uses: js/worker-client.js (WASM Quant Engine via Worker) and the
// pure-function research pipeline (js/real-data/analysis-frame.js ->
// js/research/research-engine.js -> trade-setup-matrix.js /
// target-tracker.js). Same worker script, same wasm/cyborg_quant_core.wasm
// binary, same graduated support-resistance / market-structure engines (see
// ipad_runtime/src/research/QUARANTINE.md) — this file only calls them from
// React state instead of writing to `els[id]` DOM nodes. No
// re-implementation, no second heuristic, no fabricated value: every field
// below is either passthrough from these real modules or absent.
//
// Fase B (V15 Cap. 2, Market Data Bus): este arquivo NÃO chama mais
// js/real-data/binance-public.js diretamente. Todo candle (ciclo 15m, HTF
// 1h) vem de getMarketDataBus().requestSnapshot() — o Bus é quem chama o
// conector real (src/market-data-bus/binance-*-candle-connector.js), dedupe
// entre chamadores concorrentes (este arquivo e App.tsx's getChartCandles)
// e nunca dispara duas sondas de rede redundantes para a mesma
// symbol:timeframe.
//
// Overhaul Cross-Market (Diretriz 2) + V15.1 GOD TIER (Especificação
// Arquitetural Definitiva): Gráfico e Risk Engine consomem
// EXCLUSIVAMENTE o mercado USDT-M Futures/Perpétuo — instrução explícita
// e repetida do Operador ("extinguindo qualquer roteamento de gráficos
// para mercado Spot"), nenhum fallback para Spot neste caminho. GMIL e o
// Order Flow (MEXC) continuam no mercado que já usavam antes — esta troca
// é escopada só aos dois consumidores citados na diretriz.
//
// Histórico (revertido nesta versão): a Estabilização anterior tinha um
// fallback Futuros->Spot aqui ("Fail Closed Inteligente"), construído
// porque um bug real (sufixo -PERP vazando pro parâmetro de símbolo da
// API, ver binance-futures-candle-connector.js) fazia toda chamada real
// de futuros falhar, sempre — o fallback mascarava o sintoma sem corrigir
// a causa. Com a causa raiz corrigida, Futuros volta a ser confiável, e o
// Operador foi explícito: nenhum roteamento de gráfico para Spot, nunca.
// O fail-closed correto para uma falha residual de futuros é o mecanismo
// JÁ EXISTENTE do Bus (Fase B: último snapshot BOM DA PRÓPRIA FONTE,
// nunca uma substituição por outro mercado) — "Modo de Aguardo Elegante"
// honesto em vez de um dado real de uma fonte diferente da declarada.
import { QuantWorkerClient } from '../../js/worker-client.js';
import { OrderflowWorkerClient } from '../../js/orderflow-client.js';
import { getMarketDataBus } from '../../src/market-data-bus/index.js';
import { collectBinanceFuturesKlines } from '../../src/market-data-bus/binance-futures-candle-connector.js';
import { createLivePoller } from '../../js/real-data/mexc-trades-stream.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';
import { buildRealAnalysisFrame } from '../../js/real-data/analysis-frame.js';
import { buildResearchEngineFrame } from '../../js/research/research-engine.js';
import { buildTradeSetupMatrix } from '../../js/research/trade-setup-matrix.js';
import { buildTargetTracker } from '../../js/research/target-tracker.js';
import { startLiquidationStream } from '../../js/real-data/binance-liquidations-stream.js';
import { analyze as analyzeFvgOrderBlocks } from '../../src/research/engines/fvg-order-block-engine.js';
import { classify as classifyLorentzian } from '../../src/research/engines/lorentzian-classifier.js';
import { analyze as analyzeMarketStructure } from '../../src/research/engines/market-structure-engine.js';
import { classifyMarketRegime, RegimeHistory } from '../../src/market-regime/index.js';
// V-MAX Fase 1.3: derivação pura (HVN/LVN/preço-por-bucket) do Volume
// Profile computado pelo WASM no quant-worker — ver bloco no fim do arquivo.
import { detectHvnLvn, bucketMidPrice, type VolumeProfileResult } from './nexus/volume-profile';

// ─────────────────────────────────────────────────────────────────────────────
// Fase G (V15, diretriz 4): envelope de tipos do santuário. A saída
// direcional primária é um TIPO FECHADO — o compilador passa a ser parte da
// trava de governança: nenhum valor fora de LONG/SHORT/WAIT atravessa esta
// fronteira, e a lógica consultiva (Ensemble/GMIL) não tem como escrever
// aqui (ver tests/core-engine-boundary.test.ts, que congela isso em CI).
// ─────────────────────────────────────────────────────────────────────────────
export type CoreSignal = 'LONG' | 'SHORT' | 'WAIT';

// Forma canônica que o Market Data Bus distribui (Fase B/C) — tipada aqui na
// fronteira TS; os módulos .js do Bus continuam JS puro por design.
interface BusCandle { t: number; o: number; h: number; l: number; c: number; v: number }
interface BusQualityReport { weight: number | null; score: number | null; classification: string }
interface BusSnapshot {
  symbol: string;
  timeframe: string;
  candles: BusCandle[];
  asOf: number | null;
  fetchedAt: number;
  ageMs: number;
  ok: boolean;
  errors?: string[];
  quality?: BusQualityReport | null;
}

// Evidence mínima que buildRealAnalysisFrame() consome — reconstruída a
// partir do snapshot do Bus (Fase B), agora com forma explícita em vez de
// `any` (nenhum campo novo, só o contrato que já existia tornado visível).
interface CoreEvidence {
  symbol: string;
  // Overhaul Cross-Market: sempre 'crypto_futures' agora — o Bus só é
  // chamado com o conector de futuros neste arquivo (ver import acima).
  // O tipo permanece uma união fechada (nunca um terceiro valor
  // inventado); 'crypto_spot' fica no vocabulário para o dia em que um
  // consumidor real voltar a pedir Spot explicitamente.
  instrument_type: 'crypto_spot' | 'crypto_futures';
  timeframe: string;
  source_id: string;
  timestamp: string;
  freshness_ms: number;
  candles: BusCandle[];
  ticker: { last_price: number; derived_from: string };
  volume: { last_candle_volume: number; unit: string };
  missing_fields: string[];
  data_quality: string;
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
  lastPrice?: number;
  signal?: CoreSignal | null;
  confidence?: string | null;
  marketStructure?: string | null;
  entry?: number | null;
  target1?: number | null;
  target2?: number | null;
  stop?: number | null;
  support?: number | null;
  resistance?: number | null;
  // V16 §3 (Chart Engine institucional): support-resistance-engine.js já
  // calculava support_1_strength/resistance_1_strength (contagem real de
  // toques de swing dentro de ±0.15% do nível — mesma função
  // computeLevelStrength() usada por target1Strength) a cada ciclo, mas
  // analysis-frame.js só repassava os PREÇOS (support/resistance acima),
  // descartando a força antes de chegar aqui. Achado da auditoria V16:
  // passthrough puro, nenhum cálculo novo.
  supportStrength?: { label: 'FORTE' | 'FRACA'; touches: number } | null;
  resistanceStrength?: { label: 'FORTE' | 'FRACA'; touches: number } | null;
  condition?: string | null;
  rationale?: string | null;
  lorentzian?: LorentzianResult;
  forecast?: HorizonForecast[];
  // V11.5 Fase 6 (motor cognitivo): riskRewardRatio é uma razão determinística
  // real (distância % até o alvo ÷ distância % até a invalidação, ambas já
  // calculadas em target-tracker.js) — NUNCA uma probabilidade estatística de
  // acerto, este repositório não tem backtest para sustentar essa afirmação.
  // target1Strength/target2Strength são uma contagem real de confluência de
  // swings (ver support-resistance-engine.js), não uma projeção. Protocolo
  // Mestre (Sincronização Global): target1Strength existe desde que o próprio
  // Alvo 1 passou a vir do swing fractal mais próximo (ver analysis-frame.js)
  // em vez do mínimo/máximo bruto da janela — antes só o Alvo 2 tinha força.
  riskRewardRatio?: number | null;
  target1Strength?: { label: 'FORTE' | 'FRACA'; touches: number } | null;
  target2Strength?: { label: 'FORTE' | 'FRACA'; touches: number } | null;
  // V11.5 §2 (Evolução Matemática — "melhorar contexto multitemporal"):
  // estrutura real de um timeframe MAIOR (1H), para o operador ver se o
  // sinal de 15m está confluente ou divergente com a tendência de prazo
  // mais longo. Nunca lido pelo Core Engine — puramente contexto exibido.
  htfMarketStructure?: string | null;
  htfTimeframe?: string | null;
  // Protocolo Mestre (Sincronização Global, achado de auditoria): idade real
  // do cache HTF — antes fetchedAt existia internamente mas nunca saía deste
  // arquivo, então a UI não tinha como saber se a estrutura de 1H mostrada
  // era de agora ou de ~5min atrás (HTF_REFRESH_MS). Mesmo princípio de
  // telemetria honesta já usado para preço/livro/ciclo (LEI 22).
  htfUpdatedAt?: number | null;
  // Fase D (V15, Market Regime Engine): classificação contínua de regime
  // sobre os MESMOS candles do Bus que o ciclo já usa — zero rede extra.
  // Contexto exibido, nunca um gate sobre `signal` (mesma regra do
  // Lorentziano/HTF). changedAt = quando o regime VIGENTE começou (do
  // RegimeHistory real), para a UI mostrar idade sem inventá-la.
  marketRegime?: {
    regime: string;
    direction: 'ALTA' | 'BAIXA' | null;
    adx: number;
    bandwidthPercentile: number | null;
    // Fase H: ATR% real da evidência do regime — insumo do Risk Engine
    // (unidade de risco = max(dist. do stop, ATR%)). Puro passthrough.
    atrPercent: number | null;
    changedAt: number;
  } | null;
  // Fase F: passthrough do relatório de qualidade da fonte (Data Quality
  // Layer da Fase C, já presente em todo snapshot do Bus) — o Ensemble usa
  // o peso como amortecedor de força (forca_ajustada). Puro repasse, nada
  // recomputado.
  dataQuality?: { weight: number | null; score: number | null; classification: string } | null;
  // Fase J (Cap. 17): variante WASM realmente carregada pelo quant-worker
  // ('escalar' | 'simd128', Fase I) — telemetria pura, capturada do
  // init_wasm_ok real, nunca deduzida.
  wasmVariant?: string | null;
  // Overhaul Cross-Market (Diretriz 2): passthrough honesto de qual
  // mercado realmente alimentou este ciclo — 'crypto_futures' quando o
  // Bus devolveu candles reais de futuros, null enquanto nenhum ciclo
  // bem-sucedido ainda rodou. A UI deriva o rótulo "FUTURES/PERP" DESTE
  // campo, nunca de uma string fixa — se o fetch falhar, o rótulo vira
  // AGUARDANDO honesto em vez de afirmar um mercado que não respondeu.
  instrumentType?: 'crypto_spot' | 'crypto_futures' | null;
}

// Fase D: histórico real de transições de regime por símbolo (V15 Cap. 5,
// "mudanças de regime serão registradas"). Vive no módulo, não no React —
// sobrevive a re-render, morre com a página (sem persistência por design).
const regimeHistory = new RegimeHistory();

let workerClientSingleton: any = null;
let wasmReadyPromise: Promise<any> | null = null;

// V-MAX Fase 0.8 (Health Monitor): estado real do único worker desta árvore
// (QuantWorkerClient) — nunca deduzido de fora, atualizado no MESMO
// wasmReadyPromise que runRealAnalysisCycle já espera (um segundo
// .then/.catch anexado à mesma promise real, não uma segunda inicialização
// nem um caminho paralelo). "ready" é o único estado que conta como
// worker vivo para o Health Monitor — "pending"/"error"/"idle" nunca são
// contados como um worker confirmado ativo (Fail-Closed).
type QuantWorkerState = 'idle' | 'pending' | 'ready' | 'error';
let quantWorkerState: QuantWorkerState = 'idle';

export function getQuantWorkerState(): QuantWorkerState {
  return quantWorkerState;
}

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
    quantWorkerState = 'pending';
    wasmReadyPromise = workerClientSingleton.initWasm();
    wasmReadyPromise.then(
      () => { quantWorkerState = 'ready'; },
      () => { quantWorkerState = 'error'; },
    );
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

// V15.1 GOD TIER: candle de Futuros, exclusivamente — nenhum fallback
// para Spot (ver header do arquivo). O fail-closed real para uma falha
// de futuros é o mecanismo já existente do Bus (Fase B: devolve o último
// snapshot BOM DA MESMA CHAVE symbol-PERP se a coleta nova falhar; só
// ok:false honesto se NUNCA houve um sucesso anterior para essa chave).
async function requestFuturesCandleSnapshot({
  symbol, timeframe, limit, maxAgeMs,
}: { symbol: string; timeframe: string; limit: number; maxAgeMs: number }): Promise<BusSnapshot> {
  return getMarketDataBus().requestSnapshot({
    symbol: `${symbol}-PERP`, timeframe, limit, collect: collectBinanceFuturesKlines, maxAgeMs,
  });
}

// V11.5 §2 "Evolução Matemática" (melhorar contexto multitemporal): estrutura
// real de um timeframe MAIOR (1H) via o MESMO market-structure-engine.js já
// graduado — só chamado com uma janela de candles diferente, não uma segunda
// heurística. Cacheado por HTF_REFRESH_MS: o ciclo principal roda a cada 30s
// (App.tsx), mas a estrutura de 1H não muda de forma significativa nesse
// intervalo — rebuscar a cada ciclo seria uma chamada de rede redundante sem
// nenhum ganho real de informação (Meta Máxima: mínimo consumo de recursos).
//
// V11.5 §9 (Performance/mínima latência): NÃO-BLOQUEANTE por design. A
// primeira versão desta função era `await`ada inline no ciclo principal —
// o que significava que, a cada ~5 minutos (cache expirado), o ciclo de
// 15m (o caminho crítico: LONG/SHORT/confiança) ficava mais lento esperando
// uma sonda de rede extra para um dado puramente contextual/secundário.
// Corrigido: retorna IMEDIATAMENTE o que já está em cache (ou null se ainda
// não há nada para este ativo) e dispara a busca real em segundo plano
// quando o cache expira — o próximo ciclo (até 30s depois) já vê o
// resultado atualizado. Uma leitura de contexto atrasada em 1 ciclo é um
// custo aceitável; atrasar o sinal principal não seria.
const HTF_INTERVAL = '1h';
const HTF_REFRESH_MS = 5 * 60_000;
let htfCache: { symbol: string; structureLabel: string | null; fetchedAt: number } | null = null;
let htfFetchInFlight = false;

function refreshHtfMarketStructureInBackground(symbol: string): void {
  if (htfFetchInFlight) return;
  htfFetchInFlight = true;
  (async () => {
    try {
      // Fase B: chave 'symbol:1h' própria no Bus, separada da chave
      // 'symbol:15m' do ciclo principal abaixo — não competem nem se
      // sobrescrevem, cada timeframe mantém seu próprio snapshot cacheado.
      // V15.1 GOD TIER: Futuros exclusivo, sem fallback (ver header).
      const htfSnapshot = await requestFuturesCandleSnapshot({
        symbol, timeframe: HTF_INTERVAL, limit: 60, maxAgeMs: HTF_REFRESH_MS,
      });
      if (!htfSnapshot.ok) {
        htfCache = { symbol, structureLabel: null, fetchedAt: Date.now() };
        return;
      }
      const structureResult = analyzeMarketStructure({ ohlcv_series: htfSnapshot.candles, timeframe: HTF_INTERVAL });
      const label = structureResult.status === 'OK' ? structureResult.structure_label : null;
      htfCache = { symbol, structureLabel: label, fetchedAt: Date.now() };
    } catch {
      htfCache = { symbol, structureLabel: null, fetchedAt: Date.now() };
    } finally {
      htfFetchInFlight = false;
    }
  })();
}

function getHtfMarketStructure(symbol: string): { label: string | null; updatedAt: number | null } {
  const now = Date.now();
  const cacheValid = !!htfCache && htfCache.symbol === symbol && now - htfCache.fetchedAt < HTF_REFRESH_MS;
  if (!cacheValid) refreshHtfMarketStructureInBackground(symbol);
  if (htfCache && htfCache.symbol === symbol) {
    return { label: htfCache.structureLabel, updatedAt: htfCache.fetchedAt };
  }
  return { label: null, updatedAt: null };
}

// One full real cycle: real Binance probe -> real WASM analysis frame ->
// real research engine -> real trade-setup-matrix + target-tracker. This is
// the same pipeline app.js's handleGenerateRealAnalysis() +
// refreshTargetTracker() run — same connector, same WASM, same engines,
// called directly here instead of triggered by a button/DOM event.
export async function runRealAnalysisCycle(symbol = 'BTC'): Promise<RealCycleResult> {
  const { workerClient, wasmReady } = getWorkerClient();
  let wasmVariant: string | null = null;
  try {
    // init_wasm_ok real carrega `variant` desde a Fase I — capturado aqui
    // como telemetria (Fase J), nunca deduzido.
    const init: any = await wasmReady;
    wasmVariant = typeof init?.variant === 'string' ? init.variant : null;
  } catch (err: any) {
    return { ok: false, reason: `wasm_init_falhou: ${describeError(err)}` };
  }

  // Fase B (Market Data Bus): pede o snapshot canônico de BTC-PERP:15m em
  // vez de sondar Binance diretamente. Se App.tsx (getChartCandles) já
  // pediu essa mesma chave há menos de 25s, este cycle reaproveita o
  // mesmo snapshot — zero segunda sonda de rede para o mesmo candle.
  // V15.1 GOD TIER: futuros/perpétuo é a fonte EXCLUSIVA — ver header.
  let snapshot: BusSnapshot;
  try {
    snapshot = await requestFuturesCandleSnapshot({
      symbol, timeframe: '15m', limit: 100, maxAgeMs: 25_000,
    });
  } catch (err: any) {
    return { ok: false, reason: `market_data_bus_lancou_excecao: ${describeError(err)}` };
  }
  if (!snapshot.ok) {
    return { ok: false, reason: `market_data_bus_estado: ${snapshot.errors?.[0] || 'sem_candles_validos'}` };
  }

  // Evidence Object mínimo reconstruído a partir do snapshot do Bus — só os
  // campos que buildRealAnalysisFrame() de fato lê (ver analysis-frame.js).
  // O Bus já normalizou/validou os candles; isto não é uma segunda fonte,
  // é o mesmo dado real do snapshot na forma que analysis-frame.js espera.
  // Fase G: tipado (CoreEvidence) — snapshot.ok garante candles não-vazios e
  // asOf real em runtime; o fallback fetchedAt existe só para o compilador,
  // com o mesmo valor de relógio da própria coleta.
  const lastCandle = snapshot.candles[snapshot.candles.length - 1];
  const evidence: CoreEvidence = {
    symbol,
    // V15.1 GOD TIER: o snapshot acima só pode ter vindo de Futuros
    // (requestFuturesCandleSnapshot não tem fallback) — este valor é
    // sempre exato por construção, nunca um rótulo independente do que
    // de fato aconteceu na coleta.
    instrument_type: 'crypto_futures',
    timeframe: snapshot.timeframe,
    source_id: 'market-data-bus',
    timestamp: new Date(snapshot.asOf ?? snapshot.fetchedAt).toISOString(),
    freshness_ms: snapshot.ageMs,
    candles: snapshot.candles,
    ticker: { last_price: lastCandle.c, derived_from: 'ULTIMO_CLOSE_DO_KLINE_VIA_MARKET_DATA_BUS' },
    volume: { last_candle_volume: lastCandle.v, unit: 'base_asset' },
    missing_fields: [],
    data_quality: 'COMPLETA_PARA_CAPACIDADES_TENTADAS',
  };

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
        lastPrice: isNum(evidence.ticker?.last_price) ? evidence.ticker.last_price : undefined,
      };
    }

    const research = buildResearchEngineFrame({ frame, evidence, context: {} });
    const matrix = buildTradeSetupMatrix({ research });

    // Fase G: estreitamento em runtime PARA o tipo fechado — qualquer valor
    // fora do vocabulário (ex.: DADOS_INSUFICIENTES da matrix) vira null
    // explícito, nunca vaza um string arbitrário pela fronteira tipada.
    const signal: CoreSignal | null =
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
    // getHtfMarketStructure() é síncrona e não-bloqueante (ver comentário na
    // definição): nunca adiciona latência ao ciclo principal de 15m.
    const htf = getHtfMarketStructure(symbol);

    // Fase D: regime classificado sobre os MESMOS 100 candles do Bus deste
    // ciclo — função pura, zero rede extra. Transições reais registradas
    // no RegimeHistory (V15 Cap. 5).
    const regimeResult = classifyMarketRegime({ ohlcv_series: snapshot.candles, timeframe: snapshot.timeframe });
    let marketRegime: RealCycleResult['marketRegime'] = null;
    if (regimeResult.status === 'OK') {
      const { startedAt } = regimeHistory.record(
        symbol, regimeResult.regime, regimeResult.direction, evidence.ticker.last_price,
      );
      marketRegime = {
        regime: regimeResult.regime,
        direction: regimeResult.direction,
        adx: regimeResult.evidence.adx,
        bandwidthPercentile: regimeResult.evidence.bandwidth_percentile,
        atrPercent: regimeResult.evidence.atr_percent ?? null,
        changedAt: startedAt,
      };
    }

    return {
      ok: true,
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
      supportStrength: frame.support_1_strength ?? null,
      resistanceStrength: frame.resistance_1_strength ?? null,
      condition: typeof matrix.condition === 'string' ? matrix.condition : null,
      rationale: typeof matrix.rationale === 'string' ? matrix.rationale : null,
      riskRewardRatio: route && isNum(route.risk_reward_ratio) ? route.risk_reward_ratio : null,
      target1Strength: route && route.target_1_strength ? route.target_1_strength : null,
      target2Strength: route && route.target_2_strength ? route.target_2_strength : null,
      htfMarketStructure: htf.label,
      htfTimeframe: HTF_INTERVAL,
      htfUpdatedAt: htf.updatedAt,
      marketRegime,
      dataQuality: snapshot.quality
        ? {
            weight: snapshot.quality.weight ?? null,
            score: snapshot.quality.score ?? null,
            classification: snapshot.quality.classification,
          }
        : null,
      instrumentType: evidence.instrument_type,
      wasmVariant,
    };
  } catch (err: any) {
    return { ok: false, reason: `pipeline_de_pesquisa_falhou: ${describeError(err)}` };
  }
}

// Fase B (Market Data Bus): candles do gráfico da UI (App.tsx's chartData)
// vêm da MESMA chave symbol-PERP:15m que o ciclo de análise acima usa —
// não é mais um segundo fetch() direto a api.binance.com/klines feito de
// dentro de App.tsx. Achado real da Fase A: antes desta mudança, App.tsx e
// este arquivo sondavam klines de forma independente e simultânea a cada
// ~30s, mesmo símbolo, mesmo timeframe, dois resultados que podiam nem
// bater. V15.1 GOD TIER: futuros/perpétuo é a fonte EXCLUSIVA — nenhum
// fallback para Spot (ver header do arquivo).
// Auditoria de estabilização (P1): timeframe agora é um parâmetro real, não
// mais fixo em '15m' — collectBinanceFuturesKlines já repassava `timeframe`
// sem alteração até a URL real de klines da Binance (ver
// binance-futures-candle-connector.js/binance-futures-public.js); o único
// hardcode ficava aqui, no único call site real (App.tsx). Default '15m'
// preserva o comportamento anterior para qualquer chamador que não passe o
// parâmetro.
// V18 Sprint 1 (Tarefa B): `time` (timestamp real do candle, em segundos —
// o mesmo `t` que já vem da Binance e já era usado internamente pelo Bus/
// time-synchronizer) volta a fazer parte do retorno. Antes desta mudança
// era descartado aqui — o gráfico antigo (SVG feito à mão) plotava os
// candles com espaçamento igual, ignorando gaps reais de tempo. Um chart
// de eixo temporal de verdade (lightweight-charts) PRECISA desse dado real
// por candle; nunca foi inventado, só não saía deste retorno.
// V-MAX Fase 1.3: `volume` (o `v` real que o Bus SEMPRE carregou por
// candle — mesma história do `time` acima: nunca inventado, só não saía
// deste retorno) agora passa adiante — o Volume Profile precisa dele.
// Aditivo/backward-compatible: campo extra não quebra nenhum consumidor.
export async function getChartCandles(
  symbol = 'BTC',
  limit = 50,
  timeframe = '15m',
): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> | null> {
  const snapshot = await requestFuturesCandleSnapshot({
    symbol, timeframe, limit, maxAgeMs: 25_000,
  });
  if (!snapshot.ok) return null;
  return snapshot.candles.map((c: { t: number; o: number; h: number; l: number; c: number; v: number }) => ({
    time: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// V-MAX Fase 1.3 — Volume Profile real via WASM Quant Core no quant-worker.
//
// Auditoria de zero-repetição feita ANTES de construir: nenhuma outra
// implementação de Volume Profile existe no repo (o `volume_profile: null`
// que analysis-frame.js passa ao support-resistance-engine documenta
// exatamente essa ausência). O histograma pesado (candles × buckets) roda
// no WASM DENTRO do worker (Main Thread sagrada); HVN/LVN são derivação
// O(buckets) pura em nexus/volume-profile.ts.
// ─────────────────────────────────────────────────────────────────────────────
export type { VolumeProfileResult, VolumeProfileSnapshot } from './nexus/volume-profile';

// ~um bucket por ~8px de altura típica de chart (janela de legibilidade,
// mesma natureza do CELL_HEIGHT do heatmap) — o VALOR de cada bucket
// continua 100% real; só a resolução de exibição é uma escolha documentada.
const VP_BUCKET_COUNT = 96;

/** Volume Profile real sobre candles OHLCV reais. null em qualquer falha
 *  (worker/WASM/dado corrompido) — FAIL_CLOSED, nunca um perfil inventado. */
export async function computeRealVolumeProfile(
  candles: Array<{ high: number; low: number; volume: number }>,
  buckets: number = VP_BUCKET_COUNT,
): Promise<VolumeProfileResult | null> {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  try {
    const { workerClient, wasmReady } = getWorkerClient();
    await wasmReady;
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);
    const res: any = await workerClient.computeVolumeProfile(highs, lows, volumes, buckets);
    const r = res?.result;
    if (!r || !Array.isArray(r.histogram) || !isNum(r.pocIndex)) return null;
    const { hvn, lvn } = detectHvnLvn(r.histogram);
    return {
      histogram: r.histogram,
      rangeMin: r.rangeMin,
      rangeMax: r.rangeMax,
      bucketCount: buckets,
      pocIndex: r.pocIndex,
      pocPrice: bucketMidPrice(r.pocIndex, r.rangeMin, r.rangeMax, buckets),
      hvnIndices: hvn,
      lvnIndices: lvn,
      candleCount: r.candleCount,
      computedAt: Date.now(),
      engineVersion: r.engineVersion,
    };
  } catch {
    return null;
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

// V-MAX Fase 1.2 (OrderFlowHeatmapPlugin — "bubbles"): forma real de um
// trade individual, exatamente como mexc-trades-stream.js's tradesToTicks
// já produz (price/volume/side/timestamp reais) — nunca um campo novo
// inventado, só exposto um nível acima.
export interface OrderflowTick {
  timestamp: number;
  price: number;
  volume: number;
  side: 'BUY' | 'SELL';
}

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
// ingested. onTrades (V-MAX Fase 1.2, opcional/backward-compatible) reporta
// os MESMOS ticks reais desta rodada de poll ANTES de serem empacotados
// para o worker — mexc-trades-stream.js já busca esses trades reais a cada
// ~4s para o cálculo de CVD/sinais; isto só expõe o mesmo dado real um
// nível acima, para o OrderFlowHeatmapPlugin desenhar bolhas reais de
// trades grandes, sem nenhuma sonda de rede nova. Returns a stop()
// function; call it on unmount.
export function startMexcOrderflowFeed(
  onSignals: (signals: OrderflowSignal[]) => void,
  onState: (state: OrderflowConnectorState, reason?: string) => void,
  onCvd: (value: number) => void,
  symbol = 'BTC',
  onTrades?: (ticks: OrderflowTick[]) => void,
): () => void {
  const { orderflowClient, initReady } = getOrderflowWorkerClient();
  let stopped = false;

  const poller = createLivePoller({
    symbol,
    intervalMs: 4000,
    limit: 500,
    onResult: async ({ state, ticks }: { state: string; ticks: OrderflowTick[] }) => {
      if (stopped) return;
      if (state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        onState('ERROR', state);
        return;
      }
      onState('LIVE');
      if (!ticks.length) return;
      onTrades?.(ticks);
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
// It never gates or overrides the Core Engine pipeline's own LONG/SHORT/WAIT
// call (research-engine.js's SMA/EMA trend-bias heuristic via trade-setup-
// matrix.js — not WASM; WASM itself only computes SMA/EMA/stddev/zscore,
// see the audit note in App.tsx's tacticalInput); it's a second, differently
// -computed real opinion the UI must show side by side, clearly labeled,
// not blended into the primary signal.
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
