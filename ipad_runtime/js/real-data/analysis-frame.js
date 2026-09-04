// analysis-frame.js — RealAnalysisFrame (mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
// Constroi a leitura estatistica descritiva sobre candles REAIS de uma
// Evidence (js/real-data/schema.js), reusando o mesmo motor WASM/worker do
// replay sintetico (js/worker-client.js) — o calculo e identico, so a fonte
// dos closes muda (candle real validado por sonda, nunca dataset sintetico).
// Suporte/resistencia (nivel 1) vem do swing fractal confirmado mais proximo
// do preco (support-resistance-engine.js) — a mesma amostra de candles reais,
// so' que via deteccao de pivot em vez do minimo/maximo bruto da janela
// inteira. Fallback honesto para max(high)/min(low) reais so' quando o motor
// fractal nao tiver swing confirmado suficiente nesta amostra (nunca reduz a
// disponibilidade que existia antes). Suporte/resistencia nivel 2 e os alvos
// de extensao de Fibonacci vem do mesmo motor graduado (ver QUARANTINE.md
// secao "Engines graduados") — mesmos candles reais, nunca um nivel
// inventado ou extrapolado por modelo nao implementado.
//
// Protocolo Mestre (Auditoria de Sincronizacao Global): antes desta mudanca,
// support-resistance-engine.js ja computava resistance_1/support_1 (o swing
// mais proximo) a cada ciclo, mas o valor era descartado — so' resistance_2/
// support_2 (o alvo 2, mais distante) chegava ate aqui. O nivel 1 e' o que
// vira Alvo 1 e Invalidacao/Stop em target-tracker.js — os dois numeros mais
// centrais do Trade Setup — e por isso os que mais se beneficiam de um swing
// real em vez de um pavio isolado da janela inteira definir o nivel.

import { DADOS_INSUFICIENTES, NAO_APLICAVEL } from './schema.js';
import { analyze as analyzeSupportResistance } from '../../src/research/engines/support-resistance-engine.js';
import { analyze as analyzeMarketStructure } from '../../src/research/engines/market-structure-engine.js';

// Minimo de candles reais para que SMA/EMA/STDDEV/Z-score tenham algum
// significado — abaixo disso o estado honesto e DADOS_INSUFICIENTES, nunca
// um numero calculado sobre uma amostra pequena demais para significar algo.
const MIN_CANDLES_FOR_ANALYSIS = 10;

function resolveWindow(candleCount, requestedWindow) {
    const w = Number.isFinite(requestedWindow) && requestedWindow > 1 ? requestedWindow : 20;
    return Math.max(2, Math.min(w, candleCount - 1));
}

function volatilityState(stddev, lastPrice) {
    if (!Number.isFinite(stddev) || !Number.isFinite(lastPrice) || lastPrice === 0) return DADOS_INSUFICIENTES;
    const ratio = Math.abs(stddev / lastPrice);
    if (ratio < 0.005) return 'BAIXA';
    if (ratio < 0.02) return 'MEDIA';
    return 'ALTA';
}

// Leitura puramente descritiva da posicao do ultimo preco real frente a sua
// propria SMA do periodo — nunca um sinal, nunca uma instrucao de ordem.
// Vocabulario fechado de proposito (nenhuma palavra de acao como "comprar"/
// "vender"/"entrar"), ver js/voice.js BLOCKED_PHRASES para o mesmo cuidado
// no canal de voz.
function trendDirection(lastPrice, sma) {
    if (!Number.isFinite(lastPrice) || !Number.isFinite(sma) || sma === 0) return DADOS_INSUFICIENTES;
    const diffPct = (lastPrice - sma) / sma;
    if (Math.abs(diffPct) < 0.001) return 'LATERAL_PROXIMO_DA_MEDIA';
    return diffPct > 0 ? 'ACIMA_DA_MEDIA' : 'ABAIXO_DA_MEDIA';
}

function emptyFrame(evidence, reason) {
    return {
        asset: evidence.symbol,
        instrument_type: evidence.instrument_type,
        timeframe: evidence.timeframe,
        source: evidence.source_id,
        timestamp: evidence.timestamp,
        freshness: evidence.freshness_ms,
        candles_count: Array.isArray(evidence.candles) ? evidence.candles.length : 0,
        last_price: DADOS_INSUFICIENTES,
        sma: DADOS_INSUFICIENTES,
        ema: DADOS_INSUFICIENTES,
        stddev: DADOS_INSUFICIENTES,
        zscore: DADOS_INSUFICIENTES,
        volume_status: DADOS_INSUFICIENTES,
        support: DADOS_INSUFICIENTES,
        resistance: DADOS_INSUFICIENTES,
        support_1_strength: null,
        resistance_1_strength: null,
        support_2: DADOS_INSUFICIENTES,
        resistance_2: DADOS_INSUFICIENTES,
        support_2_strength: null,
        resistance_2_strength: null,
        fib_extension_long_target: DADOS_INSUFICIENTES,
        fib_extension_short_target: DADOS_INSUFICIENTES,
        market_structure: DADOS_INSUFICIENTES,
        last_swing_high: DADOS_INSUFICIENTES,
        last_swing_low: DADOS_INSUFICIENTES,
        volatility_state: DADOS_INSUFICIENTES,
        trend_direction: DADOS_INSUFICIENTES,
        missing_fields: evidence.missing_fields || [],
        data_quality: evidence.data_quality || DADOS_INSUFICIENTES,
        read_only: true,
        execution: 'DISABLED_BY_POLICY',
        status: DADOS_INSUFICIENTES,
        status_reason: reason,
    };
}

/** @param {{evidence: object, workerClient: import('../worker-client.js').QuantWorkerClient, windowSize?: number}} opts */
export async function buildRealAnalysisFrame({ evidence, workerClient, windowSize } = {}) {
    if (!evidence || !Array.isArray(evidence.candles) || evidence.candles.length === 0) {
        return emptyFrame(evidence || {}, 'sem_candles_reais_na_evidencia');
    }
    if (evidence.candles.length < MIN_CANDLES_FOR_ANALYSIS) {
        return emptyFrame(evidence, `apenas_${evidence.candles.length}_candles_reais_abaixo_do_minimo_${MIN_CANDLES_FOR_ANALYSIS}`);
    }
    if (!workerClient) {
        return emptyFrame(evidence, 'worker_quant_engine_indisponivel_nesta_sessao');
    }

    const candles = evidence.candles;
    const closes = candles.map((c) => c.c);
    const window = resolveWindow(candles.length, windowSize);

    let result;
    try {
        ({ result } = await workerClient.computeSeries(closes, window));
    } catch (err) {
        return emptyFrame(evidence, `falha_no_motor_quant:${err.message || err}`);
    }

    const lastPrice = closes[closes.length - 1];
    // Nunca Math.min(...array)/Math.max(...array): um historico grande o
    // suficiente (paginacao historica, backtest) estoura a pilha de
    // argumentos do spread — mesmo resultado (incluindo propagacao de NaN,
    // se algum candle vier corrompido) via acumulador em loop, sem limite
    // de tamanho de array.
    let windowLow = Infinity;
    let windowHigh = -Infinity;
    for (const c of candles) {
        windowLow = Math.min(windowLow, c.l);
        windowHigh = Math.max(windowHigh, c.h);
    }

    const srResult = analyzeSupportResistance({ ohlcv_series: candles, timeframe: evidence.timeframe, volume_profile: null });
    const structureResult = analyzeMarketStructure({ ohlcv_series: candles, timeframe: evidence.timeframe });
    // Nivel 1 real (swing fractal mais proximo) substitui o minimo/maximo
    // bruto da janela quando disponivel; fallback preserva a disponibilidade
    // de antes desta mudanca (nunca vira DADOS_INSUFICIENTES por causa dela).
    const srHasLevels = srResult.status === 'OK';
    const support = srHasLevels ? srResult.support_1 : windowLow;
    const resistance = srHasLevels ? srResult.resistance_1 : windowHigh;
    const support1Strength = srHasLevels ? (srResult.support_1_strength ?? null) : null;
    const resistance1Strength = srHasLevels ? (srResult.resistance_1_strength ?? null) : null;
    const support2 = srHasLevels ? srResult.support_2 : DADOS_INSUFICIENTES;
    const resistance2 = srHasLevels ? srResult.resistance_2 : DADOS_INSUFICIENTES;
    // V11.5 Fase 6: força por confluência real (ver support-resistance-engine.js)
    // propagada junto do próprio nível 2 que ela descreve — nunca recomputada
    // aqui, nunca uma probabilidade.
    const support2Strength = srHasLevels ? (srResult.support_2_strength ?? null) : null;
    const resistance2Strength = srHasLevels ? (srResult.resistance_2_strength ?? null) : null;
    const fibLongTarget = srHasLevels ? srResult.fib_extension_long_target : DADOS_INSUFICIENTES;
    const fibShortTarget = srHasLevels ? srResult.fib_extension_short_target : DADOS_INSUFICIENTES;
    const marketStructure = structureResult.status === 'OK' ? structureResult.structure_label : DADOS_INSUFICIENTES;
    // Evolução Total (fix documentado na Ordem Nº 03 §3, executado sob a
    // autorização "não deixa nada pendente"): os 2 preços de swing mais
    // recentes JÁ eram computados por analyzeMarketStructure acima a cada
    // ciclo, mas eram descartados aqui — só structure_label saía no frame.
    // Puramente aditivo (nenhum campo existente muda), mesmo padrão
    // fail-closed de support_1_strength na mesma função.
    const lastSwingHigh = structureResult.status === 'OK' ? structureResult.last_swing_high : DADOS_INSUFICIENTES;
    const lastSwingLow = structureResult.status === 'OK' ? structureResult.last_swing_low : DADOS_INSUFICIENTES;

    const volumeStatus = (evidence.volume === DADOS_INSUFICIENTES || evidence.volume === NAO_APLICAVEL)
        ? evidence.volume
        : 'REAL';

    return {
        asset: evidence.symbol,
        instrument_type: evidence.instrument_type,
        timeframe: evidence.timeframe,
        source: evidence.source_id,
        timestamp: evidence.timestamp,
        freshness: evidence.freshness_ms,
        candles_count: candles.length,
        last_price: lastPrice,
        sma: result.sma,
        ema: result.ema,
        stddev: result.stddev,
        zscore: result.zscoreLast,
        volume_status: volumeStatus,
        support,
        resistance,
        support_1_strength: support1Strength,
        resistance_1_strength: resistance1Strength,
        support_2: support2,
        resistance_2: resistance2,
        support_2_strength: support2Strength,
        resistance_2_strength: resistance2Strength,
        fib_extension_long_target: fibLongTarget,
        fib_extension_short_target: fibShortTarget,
        market_structure: marketStructure,
        last_swing_high: lastSwingHigh,
        last_swing_low: lastSwingLow,
        volatility_state: volatilityState(result.stddev, lastPrice),
        trend_direction: trendDirection(lastPrice, result.sma),
        missing_fields: evidence.missing_fields || [],
        data_quality: evidence.data_quality || DADOS_INSUFICIENTES,
        read_only: true,
        execution: 'DISABLED_BY_POLICY',
        status: 'OK',
        status_reason: 'analysis_frame_calculado_sobre_candles_reais_validados',
        engine_version: result.engineVersion,
        window_used: window,
    };
}
