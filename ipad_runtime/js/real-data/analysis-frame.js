// analysis-frame.js — RealAnalysisFrame (mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
// Constroi a leitura estatistica descritiva sobre candles REAIS de uma
// Evidence (js/real-data/schema.js), reusando o mesmo motor WASM/worker do
// replay sintetico (js/worker-client.js) — o calculo e identico, so a fonte
// dos closes muda (candle real validado por sonda, nunca dataset sintetico).
// Suporte/resistencia vem de max(high)/min(low) reais dos candles recebidos,
// nunca de um nivel inventado ou extrapolado por modelo nao implementado.

import { DADOS_INSUFICIENTES, NAO_APLICAVEL } from './schema.js';

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
        volatility_state: DADOS_INSUFICIENTES,
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
    const support = Math.min(...candles.map((c) => c.l));
    const resistance = Math.max(...candles.map((c) => c.h));

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
        volatility_state: volatilityState(result.stddev, lastPrice),
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
