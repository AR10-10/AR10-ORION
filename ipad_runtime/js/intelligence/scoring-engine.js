// scoring-engine.js — pontua qualidade de fonte e produz um SetupScore
// (leitura descritiva, nunca um sinal). Importante: o "BLOQUEADO" deste
// score e um rotulo descritivo interno da Local Intelligence Engine — NAO e
// o Risk Gate real (js/trading/risk-gate.js), que so avalia ordens de Paper
// Trading de fato. As duas coisas sao mantidas separadas de proposito para
// nao dar a impressao de que esta leitura decide ou autoriza qualquer
// execucao. final_label so usa os 4 valores do contrato: OBSERVAR,
// DADOS_INSUFICIENTES, PAPER_ONLY, BLOQUEADO.

import { extractFeatures } from '../calc/feature-extractor.js';

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function round2(v) {
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

const LOW_QUALITY_THRESHOLD = 50;

/** @param {{active:boolean, sourceHealthEntry:object|null}} */
export function scoreSourceQuality({ active, sourceHealthEntry }) {
    if (!active) return 0;
    if (sourceHealthEntry && sourceHealthEntry.has_real_probe_code && sourceHealthEntry.live_state === 'ACTIVE_READ_ONLY') return 90;
    if (sourceHealthEntry && sourceHealthEntry.has_real_probe_code) return 60;
    return 40;
}

function insufficientScore({ frame, symbol, timeframe, sourceQuality, reason }) {
    const features = frame ? extractFeatures(frame) : null;
    return {
        setup_id: `setup_${Date.now()}`,
        symbol: (frame && frame.symbol) || symbol || null,
        timeframe: timeframe || null,
        data_freshness: 'DADOS_INSUFICIENTES',
        source_quality: sourceQuality || 0,
        volatility_score: features ? features.volatility_score : null,
        trend_score: features ? features.trend_score : null,
        range_score: features ? features.range_pct : null,
        liquidity_score: null,
        risk_score: null,
        invalidation_reason: reason,
        final_label: 'DADOS_INSUFICIENTES',
        is_authoritative: false,
        is_recommendation: false,
        is_signal: false,
        requires_risk_gate: true,
    };
}

/** @param {{frame:object|null, sourceQuality:number, riskGateConfig:object|null, symbol?:string, timeframe?:string}} */
export function buildSetupScore({ frame, sourceQuality, riskGateConfig, symbol, timeframe }) {
    if (!frame) {
        return insufficientScore({
            frame: null, symbol, timeframe, sourceQuality,
            reason: 'Nenhum CalculationFrame disponivel nesta sessao (sem fonte real ativa e sem replay sintetico executado ainda).',
        });
    }
    if (frame.data_mode !== 'REAL_READ_ONLY') {
        return insufficientScore({
            frame, symbol, timeframe, sourceQuality,
            reason: 'Fonte sintetica/diagnostico (replay offline) — nao conta como leitura de mercado real para Paper/Live. Mostrado so como exercicio matematico.',
        });
    }

    const features = extractFeatures(frame);
    if (!features) {
        return insufficientScore({
            frame, symbol, timeframe, sourceQuality,
            reason: 'CalculationFrame real presente, mas sem SMA/EMA validos (amostra pequena demais).',
        });
    }

    const killSwitch = !!(riskGateConfig && riskGateConfig.kill_switch_engaged);
    let final_label;
    let invalidation_reason = null;

    if (killSwitch) {
        final_label = 'BLOQUEADO';
        invalidation_reason = 'Risk Gate real esta com o kill switch ACIONADO — esta leitura e marcada BLOQUEADO para refletir o estado real do sistema.';
    } else if (sourceQuality < LOW_QUALITY_THRESHOLD) {
        final_label = 'BLOQUEADO';
        invalidation_reason = `Qualidade descritiva da fonte (${sourceQuality}/100) considerada baixa demais por esta heuristica interna — nao e uma decisao do Risk Gate.`;
    } else if (features.zscore_band === 'EXTREMO') {
        final_label = 'OBSERVAR';
    } else {
        final_label = 'PAPER_ONLY';
    }

    const risk_score = round2(clamp((features.volatility_score || 0) * 0.6 + (100 - sourceQuality) * 0.4, 0, 100));

    return {
        setup_id: `setup_${Date.now()}`,
        symbol: frame.symbol || symbol || null,
        timeframe: timeframe || null,
        data_freshness: 'FRESCO_NESTA_SESSAO',
        source_quality: sourceQuality,
        volatility_score: features.volatility_score,
        trend_score: features.trend_score,
        range_score: features.range_pct,
        liquidity_score: null, // honesto: nenhum conector de profundidade/volume existe ainda nesta versao
        risk_score,
        invalidation_reason,
        final_label,
        is_authoritative: false,
        is_recommendation: false,
        is_signal: false,
        requires_risk_gate: true,
    };
}
