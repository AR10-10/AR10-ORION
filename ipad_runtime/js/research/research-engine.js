// research-engine.js — ResearchEngineFrame real (mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
// Primeira implementacao executavel do contrato descrito em
// docs/ANALYSIS_OUTPUT_CONTRACT.md (antes so design/FUTURE): ROTA A (LONG),
// ROTA B (SHORT) e ROTA C (WAIT/NO TRADE) sempre presentes, nunca so a rota
// "favorita" do momento. Nenhuma rota aqui executa, envia ou simula ordem —
// e leitura descritiva de cenario, sempre com read_only:true e
// execution:'DISABLED_BY_POLICY'.
//
// Heuristica usada (deliberadamente minima e honesta, proxima de
// "trend-continuation" em docs/STRATEGY_PLAYBOOK.md): compara last_price
// contra SMA/EMA reais de RealAnalysisFrame para decidir o vies de
// tendencia. Confidence e SEMPRE LOW/MEDIUM/HIGH qualitativo — nunca uma
// probabilidade estatistica, porque nao existe backtest neste repositorio
// (mesma regra de configs/strategy-playbook.default.json#confidence_model).
// Target 2 / Extended target ficam DADOS_INSUFICIENTES de proposito: nenhum
// motor de extensao tecnica (ex. Fibonacci) esta implementado nesta fase —
// melhor honesto do que inventado.
//
// Data Sufficiency Score (data-sufficiency.js) e' calculado uma unica vez por
// frame e propagado para as 3 rotas como base_used/data_sufficiency_score/
// missing_fields/limitation_reason — nunca recalculado por rota, para as tres
// rotas sempre concordarem sobre quanto dado real existe nesta leitura. A
// confidence de Rota A/B e' SEMPRE rebaixada (nunca promovida) por esse score
// via capConfidenceBySufficiency: nenhuma rota pode parecer mais confiavel do
// que os dados reais permitem.

import { DADOS_INSUFICIENTES, NAO_APLICAVEL } from '../real-data/schema.js';
import { computeDataSufficiency } from './data-sufficiency.js';

function trendBias(frame) {
    if (!Number.isFinite(frame.last_price) || !Number.isFinite(frame.sma) || !Number.isFinite(frame.ema)) return 'INDEFINIDO';
    if (frame.last_price > frame.sma && frame.ema >= frame.sma) return 'ALTA';
    if (frame.last_price < frame.sma && frame.ema <= frame.sma) return 'BAIXA';
    return 'NEUTRO';
}

function fmt(n) {
    return Number.isFinite(n) ? n.toFixed(2) : n;
}

// SYNTHETIC_OFFLINE existe no enum conceitual de base_used (replay/dataset
// sintetico) mas e' estruturalmente inalcancavel a partir daqui:
// buildResearchEngineFrame so e' chamado pelo fluxo de dados reais
// (handleGenerateRealAnalysis em app.js), nunca pelo replay-engine.js
// sintetico. Documentado aqui para nao sobrar um 4o estado escondido.
function computeBaseUsada(frame, context) {
    if (!frame || frame.status !== 'OK') return DADOS_INSUFICIENTES;
    if (context && context.historical) return 'SESSION_PREVIOUS';
    return 'REAL_READ_ONLY';
}

const CONFIDENCE_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 };

// Nunca promove confianca, so' rebaixa: a heuristica de bias/volume decide um
// teto otimista, mas o Data Sufficiency Score decide o teto real. HIGH exige
// score>=70, MEDIUM exige score>=40 — abaixo disso a leitura fica LOW mesmo
// que o vies de tendencia pareca forte, porque faltam campos reais para
// sustentar essa confianca (ver data-sufficiency.js).
function capConfidenceBySufficiency(confidence, sufficiencyScore) {
    const cap = sufficiencyScore >= 70 ? 'HIGH' : (sufficiencyScore >= 40 ? 'MEDIUM' : 'LOW');
    return CONFIDENCE_RANK[confidence] <= CONFIDENCE_RANK[cap] ? confidence : cap;
}

function buildRouteLong(frame, bias, volumeReal, ctx) {
    const { baseUsada, sufficiency } = ctx;
    if (frame.status !== 'OK') {
        return {
            entry_zone: DADOS_INSUFICIENTES, invalidation: DADOS_INSUFICIENTES, stop_logic: DADOS_INSUFICIENTES,
            target_1: DADOS_INSUFICIENTES, target_2: DADOS_INSUFICIENTES, extended_target: DADOS_INSUFICIENTES,
            required_confirmation: DADOS_INSUFICIENTES, risk_note: DADOS_INSUFICIENTES, confidence: 'LOW',
            scenario_label: 'CENARIO_DESCRITIVO',
            base_used: baseUsada,
            data_sufficiency_score: sufficiency.score,
            missing_fields: sufficiency.missing_fields,
            limitation_reason: sufficiency.limitation_reason,
        };
    }
    let confidence = 'LOW';
    if (bias === 'ALTA') confidence = volumeReal ? 'HIGH' : 'MEDIUM';
    confidence = capConfidenceBySufficiency(confidence, sufficiency.score);
    return {
        entry_zone: `Proximo ao suporte real observado (~${fmt(frame.support)})`,
        invalidation: `Fechamento abaixo do suporte real (~${fmt(frame.support)})`,
        stop_logic: `Abaixo da zona de suporte observada nesta amostra (~${fmt(frame.support)})`,
        target_1: `Resistencia real observada nesta amostra (~${fmt(frame.resistance)})`,
        target_2: DADOS_INSUFICIENTES,
        extended_target: DADOS_INSUFICIENTES,
        required_confirmation: volumeReal
            ? `Rompimento e fechamento acima da resistencia (~${fmt(frame.resistance)}) com volume real confirmando`
            : 'Rompimento e fechamento acima da resistencia real — volume real indisponivel nesta fonte para confirmar',
        risk_note: 'Leitura heuristica de fonte unica (SMA/EMA reais); nao e backtested, nao considera funding/liquidacao quando DADOS_INSUFICIENTES. Cenario descritivo — nao e recomendacao de compra/venda, nao e instrucao de entrada.',
        confidence,
        scenario_label: 'CENARIO_DESCRITIVO',
        base_used: baseUsada,
        data_sufficiency_score: sufficiency.score,
        missing_fields: sufficiency.missing_fields,
        limitation_reason: sufficiency.limitation_reason,
    };
}

function buildRouteShort(frame, bias, volumeReal, ctx) {
    const { baseUsada, sufficiency } = ctx;
    if (frame.status !== 'OK') {
        return {
            entry_zone: DADOS_INSUFICIENTES, invalidation: DADOS_INSUFICIENTES, stop_logic: DADOS_INSUFICIENTES,
            target_1: DADOS_INSUFICIENTES, target_2: DADOS_INSUFICIENTES, extended_target: DADOS_INSUFICIENTES,
            required_confirmation: DADOS_INSUFICIENTES, risk_note: DADOS_INSUFICIENTES, confidence: 'LOW',
            scenario_label: 'CENARIO_DESCRITIVO',
            base_used: baseUsada,
            data_sufficiency_score: sufficiency.score,
            missing_fields: sufficiency.missing_fields,
            limitation_reason: sufficiency.limitation_reason,
        };
    }
    let confidence = 'LOW';
    if (bias === 'BAIXA') confidence = volumeReal ? 'HIGH' : 'MEDIUM';
    confidence = capConfidenceBySufficiency(confidence, sufficiency.score);
    return {
        entry_zone: `Proximo a resistencia real observada (~${fmt(frame.resistance)})`,
        invalidation: `Fechamento acima da resistencia real (~${fmt(frame.resistance)})`,
        stop_logic: `Acima da zona de resistencia observada nesta amostra (~${fmt(frame.resistance)})`,
        target_1: `Suporte real observado nesta amostra (~${fmt(frame.support)})`,
        target_2: DADOS_INSUFICIENTES,
        extended_target: DADOS_INSUFICIENTES,
        required_confirmation: volumeReal
            ? `Rompimento e fechamento abaixo do suporte (~${fmt(frame.support)}) com volume real confirmando`
            : 'Rompimento e fechamento abaixo do suporte real — volume real indisponivel nesta fonte para confirmar',
        risk_note: 'Leitura heuristica de fonte unica (SMA/EMA reais); nao e backtested, nao considera funding/liquidacao quando DADOS_INSUFICIENTES. Cenario descritivo — nao e recomendacao de compra/venda, nao e instrucao de entrada.',
        confidence,
        scenario_label: 'CENARIO_DESCRITIVO',
        base_used: baseUsada,
        data_sufficiency_score: sufficiency.score,
        missing_fields: sufficiency.missing_fields,
        limitation_reason: sufficiency.limitation_reason,
    };
}

function buildRouteWait(frame, bias, evidence, ctx) {
    const { baseUsada, sufficiency } = ctx;
    if (frame.status !== 'OK') {
        return {
            reason: `DADOS_INSUFICIENTES: ${frame.status_reason || 'candles reais insuficientes para qualquer leitura de tendencia'}.`,
            trigger_to_reevaluate: 'Novo probe real com candles suficientes de uma fonte ACTIVE_READ_ONLY.',
            data_missing: (evidence?.missing_fields || []).join(', ') || 'candles',
            safer_condition: 'Aguardar fonte real validada antes de qualquer leitura de tendencia.',
            base_used: baseUsada,
            data_sufficiency_score: sufficiency.score,
            missing_fields: sufficiency.missing_fields,
            limitation_reason: sufficiency.limitation_reason,
        };
    }
    if (bias === 'NEUTRO' || bias === 'INDEFINIDO') {
        return {
            reason: `Preco real entre SMA e EMA sem inclinacao clara — sem confirmacao de tendencia nesta amostra. (${sufficiency.label})`,
            trigger_to_reevaluate: 'Nova leitura apos rompimento claro de suporte ou resistencia reais.',
            data_missing: (evidence?.missing_fields || []).join(', ') || 'nenhum campo critico ausente nesta leitura',
            safer_condition: 'Aguardar romper e fechar fora da faixa SMA/EMA atual com volume real, se disponivel.',
            base_used: baseUsada,
            data_sufficiency_score: sufficiency.score,
            missing_fields: sufficiency.missing_fields,
            limitation_reason: sufficiency.limitation_reason,
        };
    }
    return {
        reason: `Heuristica de fonte unica aponta para ${bias}, mas confirmacao adicional (volume/derivativos) esta ${(evidence?.missing_fields || []).length ? 'parcial' : 'limitada a uma so fonte'}. (${sufficiency.label})`,
        trigger_to_reevaluate: 'Confirmacao por volume real e/ou segunda fonte ACTIVE_READ_ONLY independente.',
        data_missing: (evidence?.missing_fields || []).join(', ') || 'nenhum campo critico ausente nesta leitura',
        safer_condition: 'Tratar ROTA C como a leitura default enquanto so houver uma fonte e uma heuristica simples confirmando.',
        base_used: baseUsada,
        data_sufficiency_score: sufficiency.score,
        missing_fields: sufficiency.missing_fields,
        limitation_reason: sufficiency.limitation_reason,
    };
}

/** @param {{frame: object, evidence: object, context?: {historical?: boolean, freshSourceCount?: number}}} opts
 *  `frame` e o RealAnalysisFrame de js/real-data/analysis-frame.js; `evidence`
 *  e a Evidence original de js/real-data/schema.js (para funding/OI/liquidacao/
 *  long-short e fonte/timestamp no bloco EVIDENCE); `context` traz sinais da
 *  sessao (dado historico/rehidratado? quantas fontes frescas confirmaram?)
 *  usados pelo Data Sufficiency Score e por base_used — nenhum dos dois e
 *  inventado aqui, so' derivado do que app.js ja sabe sobre a sessao. */
export function buildResearchEngineFrame({ frame, evidence, context } = {}) {
    if (!frame || !evidence) {
        throw new Error('buildResearchEngineFrame requer { frame, evidence }');
    }
    const bias = trendBias(frame);
    const volumeReal = frame.volume_status === 'REAL';
    const historical = !!(context && context.historical);
    const sufficiency = computeDataSufficiency({ frame, evidence, historical, freshSourceCount: context?.freshSourceCount });
    const baseUsada = computeBaseUsada(frame, context);
    const routeCtx = { baseUsada, sufficiency };

    const futuresDerivativesData = {
        funding: evidence.funding,
        open_interest: evidence.open_interest,
        liquidations: evidence.liquidations,
        long_short_ratio: evidence.long_short_ratio,
        basis: DADOS_INSUFICIENTES, // nenhum conector compara spot vs futuros nesta fase
        data_quality: evidence.data_quality || DADOS_INSUFICIENTES,
    };

    return {
        asset: frame.asset,
        generated_at: new Date().toISOString(),
        status: frame.status,
        trend_bias_heuristico: bias,
        base_used: baseUsada,
        data_sufficiency: sufficiency,
        key_levels: {
            support: frame.support,
            resistance: frame.resistance,
            liquidity: evidence.order_book,
            retracement: DADOS_INSUFICIENTES, // nenhum motor de retracao (ex. Fibonacci) implementado
            volatility: frame.volatility_state,
        },
        futures_derivatives_data: futuresDerivativesData,
        rota_a_long: buildRouteLong(frame, bias, volumeReal, routeCtx),
        rota_b_short: buildRouteShort(frame, bias, volumeReal, routeCtx),
        rota_c_wait: buildRouteWait(frame, bias, evidence, routeCtx),
        evidence: {
            price_source: evidence.source_id,
            futures_data_source: evidence.instrument_type === 'crypto_futures' ? evidence.source_id : NAO_APLICAVEL,
            timestamp: evidence.timestamp,
            data_quality: evidence.data_quality,
            missing_fields: evidence.missing_fields || [],
            raw_sample_hash: evidence.raw_sample_hash,
        },
        limitations: [
            'Heuristica de tendencia usa apenas SMA/EMA reais de uma unica fonte nesta amostra; nao e backtested.',
            'Target 2 e Extended target ficam DADOS_INSUFICIENTES nesta fase: nenhum motor de extensao tecnica esta implementado.',
            'Funding/open interest/liquidacao/long-short ratio ficam NAO_APLICAVEL (spot) ou DADOS_INSUFICIENTES (sem conector de derivativos ativo confirmado nesta sessao).',
            'Nenhuma rota aqui executa, envia ou simula ordem — leitura puramente descritiva.',
            'Data Sufficiency Score e deterministico (0-100) a partir de campos reais desta sessao — nunca probabilistico, nunca uma media de confianca.',
        ],
        read_only: true,
        execution: 'DISABLED_BY_POLICY',
    };
}
