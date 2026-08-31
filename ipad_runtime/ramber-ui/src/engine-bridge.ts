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
// ADITIVO V-MAX Etapa 1 (Market Data Adapter): nenhum consumidor importa
// collectBinanceFuturesKlines/collectMexcFuturesKlines diretamente mais —
// getMarketDataProvider('BINANCE') é o único caminho, mesmo dado real,
// zero mudança de comportamento (default explícito, nunca implícito).
import { getMarketDataProvider, type MarketDataProviderId } from './market-data-adapter';
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
// OMEGA CORE V-MAX Fase 7 (completar o Radar/OIH): mesmo motor real de
// S/R que o ciclo principal já usa (via analysis-frame.js) — importado
// aqui diretamente porque o scanner do Radar roda para ativos que NÃO
// são o selecionado (o ciclo principal só cobre o ativo ativo). Zero
// segunda implementação de S/R.
import { analyze as analyzeSupportResistance } from '../../src/research/engines/support-resistance-engine.js';
// Ordem "Ciborgue Vivo": BOS/CHOCH — reaproveita fractal-swings.js e o
// structure_label de market-structure-engine.js por baixo (ver header do
// próprio arquivo); este import só traz a varredura de rompimento real.
import { analyze as analyzeBosChoch } from '../../src/research/engines/bos-choch-engine.js';
// Pedido do Operador ("ver o que está faltando... pra ele chegar na
// perfeição"): Liquidity Void (SMC/ICT) — deslocamento real de múltiplos
// candles com participação de volume anormalmente baixa, distinto de FVG
// (ver header do próprio arquivo + QUARANTINE.md).
import { analyze as analyzeLiquidityVoids } from '../../src/research/engines/liquidity-void-engine.js';
// Graduação de institutional-blocks.js (Breaker/Mitigation Block). O motor
// e sua suíte de execução real existiam desde a entrega anterior e nunca
// tinham chegado ao sistema ao vivo — 0 importadores. Ver QUARANTINE.md.
import { analyze as analyzeInstitutionalBlocks } from '../../src/research/engines/institutional-blocks.js';
// Entrega 47 (pedido direto do Operador): graduação do ZigZag do
// Laboratório de Evolução (isolado/testado desde a Entrega 35, nunca
// importado até aqui — ver QUARANTINE.md). Motor puro inalterado.
import {
  computeZigZag as computeZigZagPure,
  ZIGZAG_DEFAULT_DEVIATION_PCT,
  ZIGZAG_DEFAULT_DEPTH,
} from '../../src/research/engines/zigzag-engine.js';
// Graduação de supertrend-engine.js. O motor e sua suíte de execução real
// (18 casos) existiam desde a entrega anterior e nunca tinham chegado ao
// sistema ao vivo — 0 importadores, mesmo padrão de falha registrado para
// institutional-blocks.js. Ver QUARANTINE.md.
import { computeSuperTrend as computeSuperTrendPure } from '../../src/research/engines/supertrend-engine.js';
// Padrões de vela japoneses (candlestick-patterns.js) — pedido direto do
// Operador ("o gráfico tem que refletir os padrão das vela... existe padrão
// de vela que muda o sentido do mercado"). Auditoria antes de construir
// confirmou gap real: o sistema lia estrutura, zonas, regime e fluxo, mas
// nunca a FORMA da vela. Ver header do motor + QUARANTINE.md.
import { analyze as analyzeCandlePatterns } from '../../src/research/engines/candlestick-patterns.js';
import { classifyMarketRegime, RegimeHistory } from '../../src/market-regime/index.js';
// OMEGA CORE V-MAX Fase 7: mesmo Trade Plan real (Fase 4 do Signal
// Precision) e mesmo Corredor de Confluência real (Fase 5) que o ativo
// selecionado já usa — o scanner do Radar nunca reimplementa nenhum dos
// dois, só os alimenta com dado real de OUTROS ativos.
import { buildTradePlan, type TradePlan, type TradePlanLevelInput } from './nexus/trade-plan';
import { computeConfluenceCorridor, type ConfluenceCorridorReading } from './nexus/confluence-corridor';
// Correção real (achado de auditoria ao completar a Fase 7 — CLAUDE.md
// exige corrigir/reportar mesmo fora do foco direto): confluence-corridor
// agora consome uma ConvictionReading INTEIRA (nunca os 3 sinais brutos
// que já vivem dentro dela) — o scanner do Radar monta a SUA própria
// leitura "leve" (só o membro Multi-Timeframe é legível para um
// candidato de fundo) através do MESMO buildConvictionReading real que o
// ativo selecionado usa, nunca uma segunda fórmula de pool.
import { buildConvictionReading, type MultiTimeframeAgreementEntry } from './nexus/confluence-engine';
// V-MAX Fase 1.3: derivação pura (HVN/LVN/preço-por-bucket) do Volume
// Profile computado pelo WASM no quant-worker — ver bloco no fim do arquivo.
import { detectHvnLvn, bucketMidPrice, type VolumeProfileResult } from './nexus/volume-profile';
// V-MAX Fase 1.4: mesma detecção fractal de swings compartilhada pelos 3
// motores graduados (fractal-swings.js, extração da Auditoria Mestra) —
// a perna da retração Fibonacci é a MESMA perna real da extensão 61.8% do
// motor de S/R, nunca uma segunda definição de swing.
import { buildFibonacciConfluence, type ConfluenceSource, type FibonacciConfluenceMatrix } from './nexus/fibonacci-confluence';
// Fase Ω Priority 1 (Adaptive Multi-Timeframe Intelligence): motor puro
// já reaproveita analyzeMarketStructure/classifyMarketRegime/S-R/RSI por
// import próprio (ver header de multi-timeframe-engine.ts) — este arquivo
// só importa a função de orquestração e os tipos, nunca uma segunda cópia
// dos motores.
import {
  analyzeTimeframe,
  MULTI_TIMEFRAME_LIST,
  type MultiTimeframeId,
  type MultiTimeframeMatrix,
  type TimeframeContext,
} from './nexus/multi-timeframe-engine';

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
  // Evolução Total (fix documentado na Ordem Nº 03 §3): os 2 preços de
  // swing mais recentes do MESMO analyzeMarketStructure que já produz
  // marketStructure acima — antes computados e descartados dentro de
  // analysis-frame.js. Passthrough puro, zero cálculo novo aqui.
  lastSwingHigh?: number | null;
  lastSwingLow?: number | null;
  // Os 3 números que DECIDEM o `signal` acima (medido, não suposto):
  // trendBias(frame) em js/research/research-engine.js compara last_price vs
  // sma e ema vs sma — nada mais entra. Os três já eram computados todo ciclo
  // (js/real-data/analysis-frame.js) e `lastPrice` já saía daqui; sma/ema
  // morriam dentro do frame. Passthrough puro, zero cálculo novo, para o
  // Medidor de Distância à Decisão (nexus/decision-distance.ts) poder mostrar
  // ao Operador QUANTO falta para o limiar real — em vez de reimplementar a
  // fronteira do Núcleo numa segunda cópia, que é o que este repositório
  // proíbe.
  sma?: number | null;
  ema?: number | null;
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
  // Achado de auditoria (ADITIVO V-MAX: Ferramentas Institucionais):
  // support-resistance-engine.js já calcula fib_extension_long_target/
  // fib_extension_short_target TODO ciclo (extensão de Fibonacci de
  // 161.8% sobre a última perna confirmada — a notação profissional do
  // nível; ver a identidade documentada em support-resistance-engine.js) — o comentário da própria EPC §5/§6
  // no chart ("falta aparecer entrada e alvo/alvo2/alvo3") já esperava
  // este campo, mas ele morria dentro de research-engine.js (só como
  // texto formatado em rota_a_long/rota_b_short) e nunca chegava aqui.
  // Selecionado pela MESMA direção que já seleciona target1/target2
  // (route acima) — nunca uma 3ª fórmula, só o campo do frame que faltava
  // repassar.
  extendedTarget?: number | null;
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
  // ADITIVO V-MAX Etapa 10 (Data Quality Monitor unificado, achado de
  // auditoria): buildResearchEngineFrame() já computa data_sufficiency
  // (js/research/data-sufficiency.js) EM TODO ciclo — score 0-100 real de
  // cobertura de campos da Evidence — mas só usava internamente para
  // capConfidenceBySufficiency dentro de target-tracker.js; o valor nunca
  // saía deste arquivo, então a UI não tinha como mostrar AO OPERADOR por
  // que a confiança foi rebaixada. Puro passthrough (shape snake_case
  // preservado verbatim — é o mesmo objeto que data-sufficiency.js já
  // devolve, nunca reconstruído aqui), nada recomputado.
  dataSufficiency?: {
    score: number;
    max_score: number;
    breakdown: Array<{ field: string; label: string; points_possible: number; points_earned: number; status: string }>;
    missing_fields: string[];
    limitation_reason: string;
    label: string;
  } | null;
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
  // ADITIVO V-MAX Etapa 17 (Chart Integrity Engine, achado de auditoria):
  // symbol/timeframe são os parâmetros reais desta chamada — já existiam
  // como argumentos de runRealAnalysisCycle, mas nunca saíam no
  // resultado, então nenhum consumidor conseguia verificar "isto que
  // estou vendo é realmente do símbolo/timeframe selecionado agora?" sem
  // confiar cegamente no `cancelled` do efeito que dispara o ciclo em
  // App.tsx. candleAgeMs é o mesmo snapshot.ageMs real (Market Data Bus,
  // Fase B) já usado para freshness_ms internamente — puro passthrough,
  // nada recomputado. Ver nexus/chart-integrity.ts.
  symbol?: string;
  timeframe?: string;
  candleAgeMs?: number;
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
    symbol: `${symbol}-PERP`, timeframe, limit, collect: getMarketDataProvider('BINANCE').collect, maxAgeMs,
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
// Auditoria de arquitetura (revisão completa): `timeframe` era fixo em
// '15m' aqui embaixo mesmo com o parâmetro existindo no chamador — S1/R1 e
// parte do Trade Plan ficavam presos a essa análise de 15m
// independentemente do timeframe selecionado no gráfico. O resto da função
// já era 100% passthrough real (evidence.timeframe/regimeResult vêm de
// snapshot.timeframe, nunca do literal) — o único hardcode ficava na
// própria requisição do snapshot. Default '15m' preserva o comportamento
// anterior para qualquer chamador que não passe o parâmetro (mesmo padrão
// já usado por getChartCandles nesta auditoria P1).
export async function runRealAnalysisCycle(symbol = 'BTC', timeframe = '15m'): Promise<RealCycleResult> {
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
      symbol, timeframe, limit: 100, maxAgeMs: 25_000,
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
      lastSwingHigh: isNum(frame.last_swing_high) ? frame.last_swing_high : null,
      lastSwingLow: isNum(frame.last_swing_low) ? frame.last_swing_low : null,
      // Mesma disciplina fail-closed dos vizinhos: DADOS_INSUFICIENTES (string)
      // vira null explícito, nunca vaza pela fronteira tipada.
      sma: isNum(frame.sma) ? frame.sma : null,
      ema: isNum(frame.ema) ? frame.ema : null,
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
      // Mesma seleção por direção que `route` já faz acima (signal ===
      // 'SHORT' ? rota_b_short : signal === 'LONG' ? rota_a_long : null) —
      // frame.fib_extension_long_target/short_target não passam por
      // target-tracker.js (route), então a escolha do lado certo precisa
      // ser feita aqui diretamente sobre o frame.
      extendedTarget:
        signal === 'LONG' && isNum(frame.fib_extension_long_target)
          ? frame.fib_extension_long_target
          : signal === 'SHORT' && isNum(frame.fib_extension_short_target)
            ? frame.fib_extension_short_target
            : null,
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
      dataSufficiency: research.data_sufficiency,
      instrumentType: evidence.instrument_type,
      wasmVariant,
      symbol,
      timeframe: snapshot.timeframe,
      candleAgeMs: snapshot.ageMs,
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

// getTradFiChartCandles — Ordem Market Data Fabric, Fase 1: mesma FORMA e
// mesmo CONTRATO de getChartCandles acima (candle canônico {time,open,
// high,low,close,volume} | null honesto), só que para o Instrument
// Registry TradFi/CME (instrumentId, ex. 'CME_ES') em vez de um par
// cripto. Deliberadamente NÃO passa por requestFuturesCandleSnapshot (que
// sempre monta `${symbol}-PERP` e fixa getMarketDataProvider('BINANCE')):
// chama getMarketDataBus().requestSnapshot() direto com
// getMarketDataProvider('TRADFI_DELAYED'). instrumentId já é uma chave de
// cache inerentemente única no Bus (todo instrument_id do catálogo começa
// com 'CME_', nunca colide com um symbol cripto de 3-5 letras) — ao
// contrário de -PERP/-MEXC (ver market-data-adapter.ts), nenhum sufixo de
// cache-key extra é necessário aqui.
export async function getTradFiChartCandles(
  instrumentId: string,
  limit = 200,
  timeframe = '1h',
): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> | null> {
  const snapshot: BusSnapshot = await getMarketDataBus().requestSnapshot({
    symbol: instrumentId, timeframe, limit, collect: getMarketDataProvider('TRADFI_DELAYED').collect, maxAgeMs: 25_000,
  });
  if (!snapshot.ok) return null;
  return snapshot.candles.map((c: { t: number; o: number; h: number; l: number; c: number; v: number }) => ({
    time: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v,
  }));
}

// Auditoria de arquitetura (revisão completa): paginação histórica real do
// gráfico — achado: CHART_CANDLE_LIMIT era uma janela fixa de 200 candles,
// sem NENHUM caminho para carregar mais história ao arrastar para trás
// (borda dura, achado da auditoria de Chart Engine). Deliberadamente NUNCA
// passa pelo Market Data Bus/requestFuturesCandleSnapshot acima: o Bus é um
// cache de "snapshot MAIS RECENTE" por symbol:timeframe, compartilhado por
// todo o app real (este mesmo getChartCandles, o ciclo de análise, o
// contexto HTF) — escrever uma página antiga naquele mesmo buffer
// corromperia o snapshot canônico que os outros consumidores dependem
// sempre estar atualizado. Esta função chama o conector real diretamente
// (mesmo collectBinanceFuturesKlines, já importado acima), uma busca
// avulsa — nunca cacheada, nunca publicada a assinante nenhum. Fail-closed
// puro: qualquer falha real vira null, nunca uma página fabricada.
export async function getOlderChartCandles(
  symbol: string,
  beforeTime: number,
  limit: number,
  timeframe: string,
): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> | null> {
  try {
    // beforeTime é o `time` (epoch SEGUNDOS) do candle mais antigo já
    // carregado no gráfico; endTime da Binance é epoch MILISSEGUNDOS e
    // inclusivo (open time <= endTime) — subtrai 1s antes de converter
    // para nunca reincluir esse mesmo candle numa borda inclusiva
    // (garantido menor que a duração de qualquer timeframe real, mesmo o
    // de 1m).
    const raw = await getMarketDataProvider('BINANCE').collect({
      symbol: `${symbol}-PERP`, timeframe, limit, endTime: (beforeTime - 1) * 1000,
    });
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.map((c: { t: number; o: number; h: number; l: number; c: number; v: number }) => ({
      time: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v,
    }));
  } catch {
    return null;
  }
}

// Fase Ω Priority 1 — Adaptive Multi-Timeframe Intelligence: busca os 6
// prazos reais (1m/5m/15m/1h/4h/1d) em paralelo, cada um via o MESMO Bus/
// conector que o ciclo principal já usa (requestFuturesCandleSnapshot —
// zero segunda fonte de dado, zero segunda sonda de rede fora do que o Bus
// já dedupe entre chamadores concorrentes). Cadência PRÓPRIA e mais lenta
// que o ciclo principal (App.tsx chama isto a cada ~60s, não a cada ~30s):
// isto é confluência/contexto entre prazos, nunca o caminho crítico do
// sinal principal — mesma filosofia não-bloqueante já usada pelo contexto
// HTF acima (refreshHtfMarketStructureInBackground). LEI 24: apenas
// contexto/confluência entre prazos, nunca um segundo motor de decisão.
const MTF_CANDLE_LIMIT = 100;
const MTF_MAX_AGE_MS = 50_000;

export async function buildMultiTimeframeContext(symbol = 'BTC'): Promise<MultiTimeframeMatrix | null> {
  const entries = await Promise.all(
    MULTI_TIMEFRAME_LIST.map(async (tf): Promise<[MultiTimeframeId, TimeframeContext]> => {
      try {
        const snapshot = await requestFuturesCandleSnapshot({
          symbol, timeframe: tf, limit: MTF_CANDLE_LIMIT, maxAgeMs: MTF_MAX_AGE_MS,
        });
        return [tf, analyzeTimeframe(tf, snapshot.ok ? snapshot.candles : [])];
      } catch {
        // Bus lançou (rede/exceção real) — mesmo caminho honesto de "sem
        // candles reais para este prazo agora" que uma resposta ok:false.
        return [tf, analyzeTimeframe(tf, [])];
      }
    }),
  );
  // Todos os 6 prazos sem NENHUMA leitura real (ex.: rede totalmente fora)
  // devolve null honesto em vez de uma matriz de 6 linhas vazias — mesma
  // semântica de "ainda sem leitura" que os outros motores da store já
  // usam (volumeProfile, trustScore, etc. também começam null).
  const anyOk = entries.some(([, ctx]) => ctx.status === 'OK');
  if (!anyOk) return null;
  return Object.fromEntries(entries) as MultiTimeframeMatrix;
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
export type { ConfluenceSource, FibonacciConfluenceMatrix, FibConfluenceLevel } from './nexus/fibonacci-confluence';

// ─────────────────────────────────────────────────────────────────────────────
// V-MAX Fase 1.4 — Matriz de Confluência Fibonacci (agente transversal).
//
// A perna era derivada EXATAMENTE como no support-resistance-engine.js
// (último swing high/low fractal, K=2), e por isso a retração aqui e a
// extensão de 161.8% em produção falavam da MESMA perna. ISSO MUDOU nesta
// rodada, e a divergência está registrada de propósito em vez de escondida:
//
//   retração (aqui) ...... perna do ZigZag, limiar escalado pelo ATR real
//                          do tempo gráfico — a perna ESTRUTURAL
//   extensão 161.8% ...... support-resistance-engine.js, ainda fractal K=2
//                          — a última ondulação confirmada
//
// PENDÊNCIA CONSCIENTE, não esquecimento: unificar as duas exige mexer no
// motor que alimenta `extendedTarget` (engine-bridge.ts, campo que o
// Operador VÊ como alvo). Trocar um alvo exibido é mudança de outra
// natureza que lapidar uma camada de confluência, e não entra de carona
// numa rodada de Fibonacci sem o Operador decidir. Enquanto isso, os dois
// números continuam individualmente corretos — só não são a mesma perna.
//
// Cálculo O(n) trivial (mesma classe do computeSmcZones que já roda em
// useMemo), não precisa de worker. Camada de análise/exibição — LEI 24:
// nunca alimenta o Core Engine.
// ─────────────────────────────────────────────────────────────────────────────
// ═══ A PERNA DO FIBONACCI ESCALA COM O TEMPO GRÁFICO ═══
//
// PEDIDO DO OPERADOR: "ele tem que pegar [que] eu estou no gráfico em tal
// período e puxar baseado naquilo, pra o Fibonacci ficar igual os
// profissional".
//
// DEFEITO REAL, medido: a perna vinha de `findSwings(candles, FRACTAL_K)`
// com FRACTAL_K = 2 — um swing confirmado por 2 velas de cada lado, ou
// seja, a MENOR ondulação que existe. O Fibonacci era traçado no último
// tremor do preço, não na perna estrutural, e o critério era o MESMO em 1m
// e em 1W. FRACTAL_K é uma constante fixa; nada ali olhava o tempo gráfico.
//
// PESQUISA REAL antes de inventar variante própria (Disciplina §2 —
// TradingView Auto Fib Retracement e implementações derivadas): o padrão
// da categoria não usa fractal cru. Usa ZigZag com LIMIAR DE
// SIGNIFICÂNCIA, e a sensibilidade escala com a volatilidade — "a
// significance threshold that can be set as a multiple of ATR... letting
// the sensitivity of the zigzag scale with volatility". Os níveis são
// projetados sobre o ÚLTIMO SWING CONFIRMADO (0 = origem, 1 = extremo).
//
// REAPROVEITAMENTO, ZERO MATEMÁTICA NOVA: este repositório já tinha as
// duas peças e elas nunca tinham se encontrado — `zigzag-engine.js`
// (graduado, deviation% + depth, os 2 parâmetros reais do indicador) e o
// ATR% de Wilder já calculado por `regime-engine.js`. O ATR do tempo
// gráfico SELECIONADO é exatamente o que torna o limiar consciente do
// período: 1W tem ATR% muito maior que 1m, então o mesmo múltiplo produz
// uma perna proporcional em cada um, sem nenhuma tabela por timeframe.
//
// ATUALIZAÇÃO (auditoria do ecossistema de indicadores): esta escala deixou
// de ser exclusiva da perna do Fibonacci. `atrScaledZigZagDeviationPct`
// abaixo nasceu aqui com o nome `fibLegDeviationPct`, mas a lógica sempre
// foi 100% genérica — "limiar de reversão do ZigZag escalado pelo ATR do
// tempo gráfico", sem nada específico de Fibonacci nela. O ZigZag VISÍVEL
// no gráfico (ZigZagPlugin.tsx) tinha o mesmo defeito que a perna do
// Fibonacci tinha antes desta rodada: limiar FIXO, idêntico em 1m e em 1W.
// Renomeado para o nome que descreve o algoritmo, não o primeiro chamador —
// mesmo precedente já aplicado a fractal-swings.js e price-clustering.js.

/** Múltiplo de ATR que vira o limiar de reversão do ZigZag.
 *
 *  ANCORADO, não escolhido por gosto: o default clássico do indicador é 5%
 *  (documentado em zigzag-engine.js a partir de StockCharts/CFI/Capital.com).
 *  Com múltiplo 5, um ativo de ATR% = 1 reproduz exatamente esse 5% — o
 *  comportamento conhecido continua sendo o caso base, e o que muda é só a
 *  ESCALA quando a volatilidade real do período é outra. */
export const ZIGZAG_ATR_MULTIPLE = 5;
/** Piso e teto do limiar. O piso impede que um ATR degenerado (perto de
 *  zero) transforme cada vela num pivô; o teto respeita a faixa usual
 *  documentada do indicador (5-30% conforme volatilidade/timeframe). */
export const ZIGZAG_ATR_DEVIATION_MIN_PCT = 0.5;
export const ZIGZAG_ATR_DEVIATION_MAX_PCT = 30;

/** Limiar de reversão do ZigZag derivado do ATR real do tempo gráfico em
 *  uso — usado tanto pela perna do Fibonacci (computeRealFibonacciConfluence
 *  abaixo) quanto pelo ZigZag visível no gráfico (ZigZagPlugin.tsx via
 *  ChartWidget em App.tsx): mesmo indicador, mesmo limiar adaptativo, um só
 *  lugar que decide o número.
 *
 *  Sem ATR real cai no default CLÁSSICO do próprio motor (5%) — que é uma
 *  convenção pesquisada e documentada, nunca um número neutro fabricado.
 *  Isso é deliberado: fazer o ZigZag SUMIR por falta de ATR seria trocar
 *  um defeito por outro pior. */
export function atrScaledZigZagDeviationPct(atrPercent: number | null | undefined): number {
  if (!Number.isFinite(atrPercent) || (atrPercent as number) <= 0) {
    return ZIGZAG_DEFAULT_DEVIATION_PCT;
  }
  const escalado = (atrPercent as number) * ZIGZAG_ATR_MULTIPLE;
  return Math.min(ZIGZAG_ATR_DEVIATION_MAX_PCT, Math.max(ZIGZAG_ATR_DEVIATION_MIN_PCT, escalado));
}

export function computeRealFibonacciConfluence(
  candles: Array<{ open: number; high: number; low: number; close: number }>,
  sources: ConfluenceSource[],
  atrPercent?: number | null,
): FibonacciConfluenceMatrix | null {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  const pivots = computeZigZagPure(
    candles,
    atrScaledZigZagDeviationPct(atrPercent),
    ZIGZAG_DEFAULT_DEPTH,
  );
  // O motor só devolve pivô CONFIRMADO (a perna em formação nunca aparece),
  // então os 2 últimos são o último swing fechado — origem e extremo, na
  // mesma definição que a pesquisa descreve. Menos de 2 pivôs é uma resposta
  // real ("sem perna relevante com este limiar"), nunca um erro: FAIL_CLOSED.
  if (pivots.status !== 'OK' || pivots.points.length < 2) return null;
  const extremo = pivots.points[pivots.points.length - 1];
  const origem = pivots.points[pivots.points.length - 2];
  const legIsUp = extremo.price > origem.price;
  const legLow = Math.min(origem.price, extremo.price);
  const legHigh = Math.max(origem.price, extremo.price);
  // Perna degenerada (extremos iguais) — buildFibonacciConfluence devolve
  // null por conta própria (FAIL_CLOSED), nunca uma faixa de largura zero.
  return buildFibonacciConfluence(legLow, legHigh, legIsUp, sources);
}

// ~um bucket por ~8px de altura típica de chart (janela de legibilidade,
// mesma natureza do CELL_HEIGHT do heatmap) — o VALOR de cada bucket
// continua 100% real; só a resolução de exibição é uma escolha documentada.
const VP_BUCKET_COUNT = 96;

// ─────────────────────────────────────────────────────────────────────────────
// Achado da auditoria de evolução (docs/historico/AUDITORIA_UNIFICACAO_VOZ.md §4 item
// 2): buildRiskSuggestion (ipad_runtime/src/risk/risk-engine.js, chamado
// direto por App.tsx, não por este arquivo) nunca tinha um nome de tipo TS
// real — cada consumidor via inferência estrutural implícita. Nomeado aqui
// pelo MESMO motivo que SmcZonesSnapshot acima (a store precisa importar a
// forma real via `import type`, nunca redeclará-la por conta própria).
// União discriminada por `status`: SEM_SUGESTAO é o estado fail-closed real
// (insumo ausente/degenerado, Comitê sem força direcional, Kelly não
// positivo — ver risk-engine.js) — os campos numéricos ficam `null`/`0`
// honestos, nunca um valor neutro fabricado disfarçado de leitura real
// (Regra de Ouro 3).
export interface RiskSuggestionInputs {
  signal: 'LONG' | 'SHORT' | null;
  entry: number | null;
  stop: number | null;
  atr_percent: number | null;
  rr: number | null;
  ensemble_direction: string | null;
  ensemble_forca: number | null;
  risk_per_trade_pct: number;
}

export interface RiskSuggestionNone {
  status: 'SEM_SUGESTAO';
  reason: string;
  suggested_position_pct: 0;
  effective_risk_pct: 0;
  vol_size_pct: null;
  kelly_cap_pct: null;
  kelly_fraction_tier: null;
  assumed_win_rate: number;
  effective_win_rate: null;
  win_rate_source: null;
  effective_risk_unit_pct: null;
  inputs: Partial<RiskSuggestionInputs>;
  disclaimer: string;
  read_only: true;
}

export interface RiskSuggestionOk {
  status: 'OK';
  reason: string;
  suggested_position_pct: number;
  effective_risk_pct: number;
  vol_size_pct: number;
  kelly_cap_pct: number;
  kelly_fraction_tier: number;
  assumed_win_rate: number;
  effective_win_rate: number;
  win_rate_source: 'track_record_real' | 'assumed_0.5';
  effective_risk_unit_pct: number;
  inputs: RiskSuggestionInputs;
  disclaimer: string;
  read_only: true;
}

export type RiskSuggestion = RiskSuggestionNone | RiskSuggestionOk;

// V-MAX Fase 2 — TrustScoreEngine (WASM, lib.rs::trust_score): confiança na
// FONTE de dados a partir de medições reais — regularidade da cadência real
// de chegada de preço + convergência real entre exchanges. Complementar ao
// isDataFresh (staleness binária) — zero repetição.
// ─────────────────────────────────────────────────────────────────────────────
export interface TrustScoreSnapshot {
  score: number; // 0..1 — composto real (média dos componentes MEDIDOS)
  cadenceRegularity: number; // 1/(1+CV) real dos gaps de chegada
  crossExchangeConvergence: number | null; // null honesto sem divergência medida
  gapCount: number;
  divergenceCount: number;
  computedAt: number;
  engineVersion: number;
}

/** TrustScore real. gaps = intervalos reais (ms) entre chegadas de preço;
 *  divergencesBps = |Δ%|×100 reais vs outras exchanges quando LIVE.
 *  null em qualquer falha (FAIL_CLOSED, nunca um score-chute). */
export async function computeRealTrustScore(
  gaps: number[],
  divergencesBps: number[] = [],
): Promise<TrustScoreSnapshot | null> {
  if (!Array.isArray(gaps) || gaps.length < 2) return null;
  try {
    const { workerClient, wasmReady } = getWorkerClient();
    await wasmReady;
    const res: any = await workerClient.computeTrustScore(gaps, divergencesBps);
    const r = res?.result;
    if (!r || !isNum(r.score)) return null;
    return {
      score: r.score,
      cadenceRegularity: r.cadenceRegularity,
      crossExchangeConvergence: r.crossExchangeConvergence,
      gapCount: r.gapCount,
      divergenceCount: r.divergenceCount,
      computedAt: Date.now(),
      engineVersion: r.engineVersion,
    };
  } catch {
    return null;
  }
}

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
  /** índice do ÚLTIMO toque real do cluster */
  index: number;
  /** índice do PRIMEIRO toque real. Aditivo: o cluster do motor sempre
   *  soube disto, mas só o último índice era exportado — sem o primeiro não
   *  existe "trecho" e a única primitiva possível era uma linha de largura
   *  total (defeito relatado pelo Operador sobre a linha âmbar). */
  firstIndex: number;
  /** todos os índices de toque, ordenados — a evidência que sustenta
   *  `touches`, agora desenhável marca a marca no gráfico. */
  touchIndices: number[];
  swept: boolean;
}

// OMEGA CORE V-MAX (Fase 1.1) — nomeado (era um tipo de retorno anônimo)
// para a store poder importar a MESMA forma real via `import type`, em vez
// de redeclarar os 3 campos por conta própria (ver unified-snapshot-store.ts
// §3 `smc`). Puramente aditivo: o objeto literal devolvido abaixo já
// satisfazia esta forma antes de ela ter nome.
export interface SmcZonesSnapshot {
  fairValueGaps: PriceZone[];
  orderBlocks: PriceZone[];
  liquidityZones: LiquidityZone[];
}

export function computeSmcZones(candles: Array<{ open: number; high: number; low: number; close: number }>): SmcZonesSnapshot {
  const result = analyzeFvgOrderBlocks({ ohlcv_series: candles });
  if (result.status !== 'OK') return { fairValueGaps: [], orderBlocks: [], liquidityZones: [] };
  return {
    fairValueGaps: result.fair_value_gaps,
    orderBlocks: result.order_blocks,
    liquidityZones: result.liquidity_zones,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordem "Ciborgue Vivo": BOS/CHOCH (bos-choch-engine.js) — reaproveita o
// MESMO fractal-swings.js e o MESMO structure_label de
// market-structure-engine.js já usados acima; a única lógica nova é a
// varredura de rompimento real por fechamento. Computado contra o MESMO
// array de candles do gráfico que computeSmcZones acima já recebe (mesmo
// motivo: o `index` só faz sentido alinhado ao array que o caller desenha).
// Display only (LEI 24): alimenta anotação temporária + alerta, nunca uma
// segunda decisão de trading.
// ─────────────────────────────────────────────────────────────────────────────
export interface StructureBreak {
  type: 'BOS' | 'CHOCH';
  direction: 'ALTA' | 'BAIXA';
  level: number;
  index: number;
  time: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GRADUAÇÃO — Breaker / Mitigation Blocks (institutional-blocks.js).
//
// O motor classifica Order Blocks que FALHARAM (preço fechou através deles)
// em dois tipos, pelo único critério que a pesquisa confirmou distinguí-los:
// houve varredura de liquidez ANTES da falha (BREAKER, polaridade INVERTE)
// ou não houve (MITIGATION, polaridade se MANTÉM).
//
// Zero matemática nova: os Order Blocks vêm de fvg-order-block-engine.js e
// os swings de fractal-swings.js — o motor só classifica o que já é
// detectado. Computado contra o MESMO array de candles do gráfico que
// computeSmcZones/computeBosChoch já recebem (mesmo motivo de sempre: o
// `index` só faz sentido alinhado ao array que o caller desenha).
//
// LEI 24 — display only: alimenta anotação visual e contexto, NUNCA uma
// segunda decisão de trading e nunca um bloqueio da decisão do Núcleo.
// ─────────────────────────────────────────────────────────────────────────────
export interface InstitutionalBlock {
  kind: 'BREAKER' | 'MITIGATION';
  /** Direção OPERACIONAL depois da falha — já com a inversão de polaridade
   *  do Breaker aplicada. Nunca é o mesmo campo que `originType`. */
  direction: 'ALTA' | 'BAIXA';
  /** Polaridade ORIGINAL do Order Block, antes da falha. */
  originType: 'BULLISH' | 'BEARISH';
  index: number;
  failIndex: number;
  top: number;
  bottom: number;
  sweptLevel: number | null;
  sweepIndex: number | null;
  /** true quando o preço já voltou para dentro do bloco depois da falha —
   *  antes disso é uma zona identificada, não testada. */
  retested: boolean;
}

export function computeInstitutionalBlocks(
  candles: Array<{ open: number; high: number; low: number; close: number }>,
): InstitutionalBlock[] {
  const result = analyzeInstitutionalBlocks({ ohlcv_series: candles });
  // Fail-closed (Regra de Ouro 3): sem dado real suficiente, lista vazia —
  // nunca um bloco fabricado para preencher a camada.
  if (result.status !== 'OK') return [];
  return result.blocks;
}

export function computeBosChoch(
  candles: Array<{ open: number; high: number; low: number; close: number }>,
): { break: StructureBreak | null; structureLabel: string | null } {
  const result = analyzeBosChoch({ ohlcv_series: candles });
  if (result.status !== 'OK') return { break: null, structureLabel: null };
  return { break: result.break, structureLabel: result.structure_label };
}

// ─────────────────────────────────────────────────────────────────────────────
// Liquidity Void (liquidity-void-engine.js) — mesmo shape real de PriceZone
// (type/index/top/bottom/mitigated) já usado por FVG/OB acima, computado
// contra o MESMO array de candles do gráfico (index alinhado ao array que
// o caller desenha) — mas exige `volume` real por candle (ChartCandle já
// carrega, ver App.tsx), diferente de computeSmcZones/computeBosChoch que
// só precisam de OHLC. Display only (LEI 24): camada de confluência/
// contexto no gráfico, nunca uma segunda decisão de trading.
// ─────────────────────────────────────────────────────────────────────────────
export function computeLiquidityVoids(
  candles: Array<{ open: number; high: number; low: number; close: number; volume: number }>,
): PriceZone[] {
  const result = analyzeLiquidityVoids({ ohlcv_series: candles });
  if (result.status !== 'OK') return [];
  return result.liquidity_voids.map((v: { type: 'BULLISH' | 'BEARISH'; index: number; top: number; bottom: number; mitigated: boolean }) => ({
    type: v.type,
    index: v.index,
    top: v.top,
    bottom: v.bottom,
    mitigated: v.mitigated,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ZigZag (zigzag-engine.js) — graduado do Laboratório de Evolução na
// Entrega 47 (pedido direto do Operador). Indicador clássico de reversão
// por deviation% + depth (2 parâmetros reais do indicador nomeado,
// confirmados via pesquisa real ANTES de implementar — ver header do
// motor). Só pivôs CONFIRMADOS (nunca a perna em formação — Regra de Ouro
// 3). Display only (LEI 24): estrutura/contexto no gráfico, nunca uma
// segunda decisão de trading.
// ─────────────────────────────────────────────────────────────────────────────
export interface ZigZagPoint {
  index: number;
  price: number;
  kind: 'HIGH' | 'LOW';
}

// ─────────────────────────────────────────────────────────────────────────────
// GRADUAÇÃO — SuperTrend (supertrend-engine.js).
//
// Um TRAILING STOP que trilha o preço e trava: a banda de cima só desce ou
// fica parada enquanto o preço está acima dela, a de baixo só sobe ou fica
// parada enquanto o preço está abaixo. É a regra de travamento — não as
// bandas em si — que separa o SuperTrend real de um par de bandas tipo
// Keltner que inverte a cada respiro do mercado.
//
// LEI 24 — display only: a `trend` de cada ponto é CONTEXTO desenhado ao
// Operador, nunca uma segunda decisão de LONG/SHORT e nunca um filtro sobre
// a decisão do Núcleo. É o mesmo papel que VWAP/EMA/Trend Channel já têm.
// ─────────────────────────────────────────────────────────────────────────────
export interface SuperTrendPoint {
  index: number;
  /** preço da linha (o stop que trilha) naquele candle */
  line: number;
  trend: 'UP' | 'DOWN';
  /** true no candle em que a tendência virou — nunca por pavio, só por
   *  fechamento além da banda final oposta. */
  flipped: boolean;
}

export function computeSuperTrend(
  candles: Array<{ open: number; high: number; low: number; close: number }>,
  period?: number,
  multiplier?: number,
): SuperTrendPoint[] {
  const result = computeSuperTrendPure(candles, period, multiplier);
  // Fail-closed (Regra de Ouro 3): sem aquecimento real de Wilder, lista
  // vazia — nunca uma linha extrapolada sobre janela insuficiente.
  if (result.status !== 'OK') return [];
  return result.points;
}

export function computeZigZag(
  candles: Array<{ open: number; high: number; low: number; close: number }>,
  deviationPct?: number,
  depth?: number,
): ZigZagPoint[] {
  const result = computeZigZagPure(candles, deviationPct, depth);
  if (result.status !== 'OK') return [];
  return result.points;
}

// ─────────────────────────────────────────────────────────────────────────────
// Padrões de vela (candlestick-patterns.js) — pedido direto do Operador.
// Wrapper fino sobre o motor puro, nunca uma segunda implementação: só
// traduz o resultado para o vocabulário tipado que a UI consome.
//
// O contrato importante que este wrapper preserva: `direction` é o VIÉS que
// o padrão sugere, jamais uma decisão. O Core Engine continua sendo o único
// emissor de LONG/SHORT/WAIT (LEI 24) — um Engolfo de Alta contra um SHORT
// do Núcleo aparece como CONTEXTO conflitante para o Operador ler, nunca
// como um segundo sinal que sobrescreve ou bloqueia o primeiro.
// ─────────────────────────────────────────────────────────────────────────────
export interface CandlePattern {
  code: string;
  name: string;
  /** Viés sugerido pelo padrão. `null` em padrões de indecisão (Doji) — que
   *  deliberadamente NÃO ganham um lado inventado (Regra de Ouro 3). */
  direction: 'ALTA' | 'BAIXA' | null;
  kind: 'REVERSAL' | 'CONTINUATION' | 'INDECISION';
  index: number;
  time: number;
  /** Tamanho real do corpo em unidades de ATR — medição, nunca uma
   *  probabilidade de acerto (Regra de Ouro 2). */
  bodyAtr: number | null;
  /** A vela seguinte fechou a favor do viés? `null` quando o padrão acabou
   *  de se formar e ainda não existe vela seguinte — nunca um `false` que
   *  se leria como "foi negado". */
  confirmed: boolean | null;
  candles: number;
}

export interface CandlePatternReading {
  patterns: CandlePattern[];
  latest: CandlePattern | null;
  /** Contexto de tendência REAL usado para classificar as reversões
   *  (market-structure-engine.js). `null` = sem estrutura confirmada, e
   *  nesse caso nenhum padrão de reversão foi emitido — de propósito. */
  structureContext: string | null;
}

const EMPTY_PATTERNS: CandlePatternReading = { patterns: [], latest: null, structureContext: null };

export function computeCandlePatterns(
  candles: Array<{ open: number; high: number; low: number; close: number }>,
): CandlePatternReading {
  const result = analyzeCandlePatterns({ ohlcv_series: candles });
  if (result.status !== 'OK') return EMPTY_PATTERNS;
  return {
    patterns: result.patterns as CandlePattern[],
    latest: (result.latest ?? null) as CandlePattern | null,
    structureContext: result.structureContext ?? null,
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

// ─────────────────────────────────────────────────────────────────────────────
// OMEGA CORE V-MAX Fase 7 (completar o Radar/OIH): scanner real de UM
// candidato de background — chamado pelo varredor em App.tsx, uma vez por
// ativo da lista curada (radar-universe.ts), nunca para o ativo já
// selecionado (que já tem o ciclo principal completo cobrindo-o).
//
// Nível de riqueza DELIBERADAMENTE menor que o ativo AO VIVO selecionado —
// honestidade, não atalho escondido: o Conselho (7 agentes) e o
// institutionalScore precisam de orderflow/liquidez ao vivo que esta
// arquitetura só transmite para o ativo selecionado no momento (ver
// docs/ORGANISM_DATA_FLOW.md — "App.tsx é o único coletor real"). Rodar
// o Conselho completo para 30+ ativos simultâneos exigiria assinar
// orderflow ao vivo de todos eles ao mesmo tempo — uma mudança
// arquitetural muito maior que "completar o Radar", fora de escopo aqui.
// Por isso: `riskGated` é sempre `false` (nenhum Conselho rodou — nunca
// fabrica um resultado de risco que não foi medido), e a Confluência usa
// SÓ `multiTimeframe` real sobre 3 prazos de referência — mesmo formato
// `ConfluenceCorridorReading` da Fase 5, que já degrada honestamente
// quando opinionMass/institutionalScore/obstáculos vêm null (mesmo
// comportamento já provado em confluence-corridor.test.ts, ZERO
// modificação daquele motor). `intensity` para um candidato de background
// acaba sendo puramente a concordância real de regime entre os 3 prazos —
// uma base real, porém mais fraca que a leitura de 4 componentes do
// ativo ao vivo, nunca fabricada como equivalente.
const RADAR_SCAN_TIMEFRAMES = ['15m', '1h', '4h'] as const;
const RADAR_SCAN_CANDLE_LIMIT = 100;
const RADAR_SCAN_MAX_AGE_MS = 60_000;

export interface RadarCandidateScanResult {
  symbol: string;
  timeframe: string;
  structureLabel: 'ESTRUTURA_ALTA' | 'ESTRUTURA_BAIXA' | 'ESTRUTURA_LATERAL' | null;
  direction: 'LONG' | 'SHORT' | null;
  tradePlan: TradePlan | null;
  riskGated: boolean;
  confluence: ConfluenceCorridorReading;
  // ADITIVO V-MAX Etapa 9: exchange real que forneceu este candle/estrutura
  // — honestidade de proveniência (um candidato MEXC e um candidato
  // Binance do mesmo símbolo são leituras de fontes genuinamente
  // diferentes, nunca a "mesma verdade" por acaso terem o mesmo ticker).
  provider: MarketDataProviderId;
}

/** Igual a requestFuturesCandleSnapshot, mas PROVIDER-AWARE — usado só
 *  pelo scanner de fundo do Radar (scanRadarCandidate), nunca pelo ciclo
 *  real do Core Engine/gráfico (requestFuturesCandleSnapshot continua
 *  100% Binance, intocada). Mesmo Bus, mesmo dedupe — só o sufixo de
 *  cache-key muda por provider (nota de arquitetura em
 *  market-data-adapter.ts: sem isso, um candidato MEXC e um candidato
 *  Binance do MESMO símbolo colidiriam na mesma entrada do Bus e
 *  poderiam misturar candles de duas exchanges sob uma única chave). */
async function requestRadarCandleSnapshot({
  symbol, timeframe, limit, maxAgeMs, provider,
}: { symbol: string; timeframe: string; limit: number; maxAgeMs: number; provider: MarketDataProviderId }): Promise<BusSnapshot> {
  const cacheSuffix = provider === 'MEXC' ? '-MEXC' : '-PERP';
  return getMarketDataBus().requestSnapshot({
    symbol: `${symbol}${cacheSuffix}`, timeframe, limit, collect: getMarketDataProvider(provider).collect, maxAgeMs,
  });
}

/** Regime real (classifyMarketRegime, mesmo motor do ciclo principal e da
 *  Matriz Multi-Timeframe) → direção acionável. null honesto quando o
 *  regime está em CONSOLIDACAO/COMPRESSAO (ADX real sem força de
 *  tendência) ou sem leitura — nunca um rótulo forçado. */
function directionFromRegime(regimeDirection: 'ALTA' | 'BAIXA' | null): 'LONG' | 'SHORT' | null {
  if (regimeDirection === 'ALTA') return 'LONG';
  if (regimeDirection === 'BAIXA') return 'SHORT';
  return null;
}

/** UM candidato real de background — null honesto quando a rede falhou
 *  ou não há candles suficientes (fail-closed, nunca fabricado). */
export async function scanRadarCandidate(
  symbol: string,
  timeframe: string,
  provider: MarketDataProviderId = 'BINANCE',
): Promise<RadarCandidateScanResult | null> {
  let snapshot: BusSnapshot;
  try {
    snapshot = await requestRadarCandleSnapshot({
      symbol, timeframe, limit: RADAR_SCAN_CANDLE_LIMIT, maxAgeMs: RADAR_SCAN_MAX_AGE_MS, provider,
    });
  } catch {
    return null;
  }
  if (!snapshot.ok || snapshot.candles.length === 0) return null;

  const structureResult: any = analyzeMarketStructure({ ohlcv_series: snapshot.candles, timeframe });
  const srResult: any = analyzeSupportResistance({ ohlcv_series: snapshot.candles, timeframe, volume_profile: null });
  const regimeResult: any = classifyMarketRegime({ ohlcv_series: snapshot.candles, timeframe });

  const structureLabel = structureResult.status === 'OK' ? structureResult.structure_label : null;
  const direction = regimeResult.status === 'OK' ? directionFromRegime(regimeResult.direction) : null;

  const lastCandle = snapshot.candles[snapshot.candles.length - 1];
  const price = isNum(lastCandle?.c) ? lastCandle.c : null;

  const levels: TradePlanLevelInput[] = [];
  if (srResult.status === 'OK') {
    if (isNum(srResult.support_1)) levels.push({ price: srResult.support_1, kind: 'SR_SUPPORT_1' });
    if (isNum(srResult.resistance_1)) levels.push({ price: srResult.resistance_1, kind: 'SR_RESISTANCE_1' });
  }
  const tradePlan =
    direction && price !== null
      ? buildTradePlan({ stance: direction, riskGated: false, price, zones: [], levels })
      : null;

  // Confluência-leve: concordância real de regime entre os 3 prazos de
  // referência — cada leitura vem do MESMO classifyMarketRegime, sobre
  // candles reais desse prazo (reaproveita snapshot já buscado quando o
  // prazo de referência coincide com o prazo do candidato).
  const mtfEntries = await Promise.all(
    RADAR_SCAN_TIMEFRAMES.map(async (tf) => {
      try {
        const tfSnapshot =
          tf === timeframe
            ? snapshot
            : await requestRadarCandleSnapshot({ symbol, timeframe: tf, limit: RADAR_SCAN_CANDLE_LIMIT, maxAgeMs: RADAR_SCAN_MAX_AGE_MS, provider });
        if (!tfSnapshot.ok) return null;
        const tfRegime: any = classifyMarketRegime({ ohlcv_series: tfSnapshot.candles, timeframe: tf });
        return tfRegime.status === 'OK' ? (tfRegime.direction as 'ALTA' | 'BAIXA' | null) : null;
      } catch {
        return null;
      }
    }),
  );
  // status: 'OK' é honesto para toda entrada aqui — cada prazo de
  // referência TEVE uma busca/classificação real tentada; confidenceStance
  // null (regime CONSOLIDACAO ou fetch falho) já é filtrado por
  // buildConvictionReading independente do status, mesma semântica do
  // ativo selecionado (readMultiTimeframeMember, confluence-engine.ts).
  const multiTimeframeLite: Record<string, MultiTimeframeAgreementEntry> | null = mtfEntries.some(
    (d) => d !== null,
  )
    ? Object.fromEntries(
        RADAR_SCAN_TIMEFRAMES.map((tf, i) => [tf, { status: 'OK' as const, confidenceStance: directionFromRegime(mtfEntries[i]) }]),
      )
    : null;

  // Conviction "leve": mesmo buildConvictionReading real do ativo
  // selecionado (confluence-engine.ts) — nunca uma segunda fórmula de
  // pool. Ensemble/Council ficam null honestamente (nenhum dos dois roda
  // para candidatos de fundo, ver header do arquivo); só o membro
  // Multi-Timeframe é legível, então `conviction`/`convictionAdjusted`
  // saem inteiramente dessa única leitura real — mais fraco que o ativo
  // ao vivo, nunca fabricado como equivalente.
  const convictionLite = buildConvictionReading({
    coreDirection: direction,
    ensembleConsensus: null,
    council: null,
    multiTimeframe: multiTimeframeLite,
    trustScore: null,
  });

  const confluence = computeConfluenceCorridor({
    direction,
    conviction: convictionLite,
    activeObstacleCount: null,
  });

  return { symbol, timeframe, structureLabel, direction, tradePlan, riskGated: false, confluence, provider };
}
