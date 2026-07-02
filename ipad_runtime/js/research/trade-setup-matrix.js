// trade-setup-matrix.js — Trade Setup Matrix (camada de apresentacao,
// mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
// research-engine.js sempre calcula e expõe as 3 rotas neutras (LONG/SHORT/
// WAIT) lado a lado, de propósito — "nunca só a rota favorita do momento"
// (ver header de research-engine.js). Esse contrato NAO muda aqui: as 3
// rotas continuam todas calculadas e inspecionáveis em research-engine.js.
// Este módulo é só uma camada de apresentação que ESCOLHE qual das 3 rotas
// já calculadas resumir num único badge SIGNAL para o Hero View, usando o
// mesmo trend_bias_heuristico que research-engine.js já usou para construir
// essas rotas — nunca uma heurística nova/paralela de decisão. Todo campo
// aqui é passthrough de research.rota_a_long / rota_b_short / rota_c_wait,
// ou DADOS_INSUFICIENTES quando o status de origem não é 'OK'. Read-only,
// nunca executa, nunca envia ordem.

import { DADOS_INSUFICIENTES } from '../real-data/schema.js';

function emptyMatrix(reason) {
    return {
        signal: DADOS_INSUFICIENTES,
        entry_zone: DADOS_INSUFICIENTES,
        take_profit_1: DADOS_INSUFICIENTES,
        take_profit_2: DADOS_INSUFICIENTES,
        stop_loss: DADOS_INSUFICIENTES,
        confidence: DADOS_INSUFICIENTES,
        market_structure: DADOS_INSUFICIENTES,
        condition: DADOS_INSUFICIENTES,
        rationale: reason,
        read_only: true,
        execution: 'DISABLED_BY_POLICY',
    };
}

/** @param {{research: object}} opts `research` é o ResearchEngineFrame de
 *  js/research/research-engine.js (já com rota_a_long/rota_b_short/
 *  rota_c_wait/market_structure calculados sobre candles reais).
 *  @returns {object} SIGNAL 'LONG'|'SHORT'|'WAIT'|DADOS_INSUFICIENTES com
 *  entry/TP1/TP2/SL — sempre derivado de uma das 3 rotas já calculadas,
 *  nunca uma 4a heurística inventada aqui. */
export function buildTradeSetupMatrix({ research } = {}) {
    if (!research || research.status !== 'OK') {
        return emptyMatrix((research && research.rota_c_wait && research.rota_c_wait.reason) || 'sem_research_engine_frame_valido_nesta_sessao');
    }

    const bias = research.trend_bias_heuristico;

    if (bias === 'ALTA') {
        const r = research.rota_a_long;
        return {
            signal: 'LONG',
            entry_zone: r.entry_zone,
            take_profit_1: r.target_1,
            take_profit_2: r.target_2,
            stop_loss: r.invalidation,
            confidence: r.confidence,
            market_structure: research.market_structure,
            condition: r.required_confirmation,
            rationale: r.risk_note,
            read_only: true,
            execution: 'DISABLED_BY_POLICY',
        };
    }

    if (bias === 'BAIXA') {
        const r = research.rota_b_short;
        return {
            signal: 'SHORT',
            entry_zone: r.entry_zone,
            take_profit_1: r.target_1,
            take_profit_2: r.target_2,
            stop_loss: r.invalidation,
            confidence: r.confidence,
            market_structure: research.market_structure,
            condition: r.required_confirmation,
            rationale: r.risk_note,
            read_only: true,
            execution: 'DISABLED_BY_POLICY',
        };
    }

    const wait = research.rota_c_wait;
    return {
        signal: 'WAIT',
        entry_zone: DADOS_INSUFICIENTES,
        take_profit_1: DADOS_INSUFICIENTES,
        take_profit_2: DADOS_INSUFICIENTES,
        stop_loss: DADOS_INSUFICIENTES,
        confidence: DADOS_INSUFICIENTES,
        market_structure: research.market_structure,
        condition: wait.trigger_to_reevaluate,
        rationale: wait.reason,
        read_only: true,
        execution: 'DISABLED_BY_POLICY',
    };
}
