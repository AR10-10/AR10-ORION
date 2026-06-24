// local-brain.js — orquestrador da AR10 Local Intelligence Engine. Liga
// Scoring Engine + Memory Store + Scenario Matcher + Siriform Explainer em
// um unico ciclo (runLocalIntelligenceCycle) e devolve um
// LocalIntelligenceResult no formato do contrato. Nao chama rede nem IA
// externa — e' so composicao de modulos que ja existem, sobre dados que ja
// existem (CalculationFrame real ou meta de replay sintetico). O resultado
// nunca autoriza ordem real: is_authoritative/is_recommendation/is_signal
// ficam sempre false e requires_risk_gate sempre true.

import { emit, SEVERITY, SOURCE } from '../core/event-bus.js';
import { scoreSourceQuality, buildSetupScore } from './scoring-engine.js';
import { recordSetupScore } from './memory-store.js';
import { findSimilarScenarios } from './scenario-matcher.js';
import { explainSetupScore, explainMemoryMatches } from './siriform-explainer.js';

function hashInput(frame, symbol, timeframe) {
    const basis = JSON.stringify({
        symbol: (frame && frame.symbol) || symbol || null,
        timeframe: timeframe || null,
        sma: frame ? frame.sma : null,
        ema: frame ? frame.ema : null,
        stddev: frame ? frame.stddev : null,
        zscore: frame ? frame.zscore : null,
        last_price: frame ? frame.last_price : null,
    });
    let h = 0;
    for (let i = 0; i < basis.length; i += 1) h = (h * 31 + basis.charCodeAt(i)) | 0;
    return `ih_${Math.abs(h)}`;
}

function confidenceLabel(finalLabel) {
    if (finalLabel === 'DADOS_INSUFICIENTES') return 'SEM_BASE';
    if (finalLabel === 'BLOQUEADO') return 'BLOQUEADA';
    if (finalLabel === 'OBSERVAR') return 'BAIXA_PARA_MEDIA';
    return 'DESCRITIVA_PAPER_ONLY';
}

function emitCycleEvent(score) {
    const severityByLabel = {
        DADOS_INSUFICIENTES: SEVERITY.WARN,
        BLOQUEADO: SEVERITY.FAIL,
        OBSERVAR: SEVERITY.WARN,
        PAPER_ONLY: SEVERITY.OK,
    };
    emit(`local_intelligence_${score.final_label.toLowerCase()}`, {
        source: SOURCE.SYSTEM,
        dataMode: score.data_freshness,
        severity: severityByLabel[score.final_label] || SEVERITY.INFO,
        payload: { setup_id: score.setup_id, symbol: score.symbol, final_label: score.final_label },
    });
}

/** @param {{frame:object|null, active:boolean, sourceHealthEntry:object|null, riskGateConfig:object|null, symbol?:string, timeframe?:string}} ctx
 *  @returns {Promise<object>} LocalIntelligenceResult */
export async function runLocalIntelligenceCycle({ frame, active, sourceHealthEntry, riskGateConfig, symbol, timeframe } = {}) {
    const sourceQuality = scoreSourceQuality({ active, sourceHealthEntry });
    const score = buildSetupScore({ frame, sourceQuality, riskGateConfig, symbol, timeframe });

    await recordSetupScore(score);
    emitCycleEvent(score);

    const matches = await findSimilarScenarios(score);

    const explanation = [explainSetupScore(score)];
    if (matches.length) explanation.push(explainMemoryMatches(matches));

    return {
        result_id: `lir_${Date.now()}`,
        created_at: new Date().toISOString(),
        task_type: 'SETUP_SCORE_CYCLE',
        input_hash: hashInput(frame, symbol, timeframe),
        source_data_mode: (frame && frame.data_mode) || 'DADOS_INSUFICIENTES',
        features_used: ['volatility_score', 'trend_score', 'range_score', 'risk_score'],
        memory_matches: matches,
        rules_applied: [
            'DADOS_INSUFICIENTES quando nao ha CalculationFrame real fresco nesta sessao.',
            'BLOQUEADO quando o kill switch do Risk Gate esta ACIONADO.',
            'BLOQUEADO quando a qualidade descritiva da fonte fica abaixo do limite interno.',
            'OBSERVAR quando o z-score esta em banda extrema.',
        ],
        score,
        confidence_label: confidenceLabel(score.final_label),
        limitations: [
            'Sem conector de profundidade/volume nesta versao — liquidity_score e sempre null.',
            'Similaridade de cenario e geometria simples (distancia euclidiana), nao um modelo treinado.',
            'Esta leitura nunca autoriza ou bloqueia ordem real — isso continua tarefa exclusiva do Risk Gate (js/trading/risk-gate.js).',
        ],
        explanation_pt_br: explanation.join(' '),
        is_authoritative: false,
        is_recommendation: false,
        is_signal: false,
        requires_risk_gate: true,
        event_ledger_id: score.setup_id,
    };
}
