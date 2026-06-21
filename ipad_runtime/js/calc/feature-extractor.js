// feature-extractor.js — CalculationFrame -> features descritivas.
// Nao recalcula nada no WASM: le o resultado que ja existe (RealAnalysisFrame
// real de js/real-data/analysis-frame.js, ou o meta sintetico do replay em
// js/replay-engine.js) e deriva numeros descritivos adicionais (volatilidade
// normalizada, forca de tendencia, banda de z-score). Quem chama (app.js)
// monta o objeto normalizado abaixo a partir de qualquer um dos dois — este
// modulo nunca sabe se a fonte era real ou sintetica, so confia no campo
// data_mode que o chamador preencheu.

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function round2(v) {
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

/** @param {{sma:number, ema:number, stddev:number, zscore:number, last_price?:number, support?:number, resistance?:number}} frame
 *  @returns {null|{range_pct:number|null, volatility_score:number|null, trend_direction:string, trend_score:number|null, zscore_band:string, zscore_last:number|null}} */
export function extractFeatures(frame) {
    if (!frame || typeof frame.sma !== 'number' || typeof frame.ema !== 'number' || !Number.isFinite(frame.sma)) {
        return null;
    }
    const basePrice = typeof frame.last_price === 'number' ? frame.last_price : frame.sma;
    const hasRange = typeof frame.support === 'number' && typeof frame.resistance === 'number';
    const rangePct = hasRange && basePrice ? round2(((frame.resistance - frame.support) / basePrice) * 100) : null;
    const volatilityScore = basePrice && typeof frame.stddev === 'number'
        ? round2(clamp((Math.abs(frame.stddev) / basePrice) * 1000, 0, 100))
        : null;
    const trendDirection = frame.ema > frame.sma ? 'ALTA' : frame.ema < frame.sma ? 'BAIXA' : 'NEUTRO';
    const trendScore = frame.sma ? round2(clamp((Math.abs(frame.ema - frame.sma) / frame.sma) * 1000, 0, 100)) : null;
    const zscoreLast = typeof frame.zscore === 'number' && Number.isFinite(frame.zscore) ? frame.zscore : null;
    const zscoreBand = zscoreLast === null
        ? 'DESCONHECIDO'
        : (Math.abs(zscoreLast) > 2 ? 'EXTREMO' : (Math.abs(zscoreLast) > 1 ? 'ELEVADO' : 'NORMAL'));

    return {
        range_pct: rangePct,
        volatility_score: volatilityScore,
        trend_direction: trendDirection,
        trend_score: trendScore,
        zscore_band: zscoreBand,
        zscore_last: zscoreLast,
    };
}
