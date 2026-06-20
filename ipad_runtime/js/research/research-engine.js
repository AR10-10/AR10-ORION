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

import { DADOS_INSUFICIENTES, NAO_APLICAVEL } from '../real-data/schema.js';

function trendBias(frame) {
    if (!Number.isFinite(frame.last_price) || !Number.isFinite(frame.sma) || !Number.isFinite(frame.ema)) return 'INDEFINIDO';
    if (frame.last_price > frame.sma && frame.ema >= frame.sma) return 'ALTA';
    if (frame.last_price < frame.sma && frame.ema <= frame.sma) return 'BAIXA';
    return 'NEUTRO';
}

function fmt(n) {
    return Number.isFinite(n) ? n.toFixed(2) : n;
}

function buildRouteLong(frame, bias, volumeReal) {
    if (frame.status !== 'OK') {
        return {
            entry_zone: DADOS_INSUFICIENTES, invalidation: DADOS_INSUFICIENTES, stop_logic: DADOS_INSUFICIENTES,
            target_1: DADOS_INSUFICIENTES, target_2: DADOS_INSUFICIENTES, extended_target: DADOS_INSUFICIENTES,
            required_confirmation: DADOS_INSUFICIENTES, risk_note: DADOS_INSUFICIENTES, confidence: 'LOW',
        };
    }
    let confidence = 'LOW';
    if (bias === 'ALTA') confidence = volumeReal ? 'HIGH' : 'MEDIUM';
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
        risk_note: 'Leitura heuristica de fonte unica (SMA/EMA reais); nao e backtested, nao considera funding/liquidacao quando DADOS_INSUFICIENTES.',
        confidence,
    };
}

function buildRouteShort(frame, bias, volumeReal) {
    if (frame.status !== 'OK') {
        return {
            entry_zone: DADOS_INSUFICIENTES, invalidation: DADOS_INSUFICIENTES, stop_logic: DADOS_INSUFICIENTES,
            target_1: DADOS_INSUFICIENTES, target_2: DADOS_INSUFICIENTES, extended_target: DADOS_INSUFICIENTES,
            required_confirmation: DADOS_INSUFICIENTES, risk_note: DADOS_INSUFICIENTES, confidence: 'LOW',
        };
    }
    let confidence = 'LOW';
    if (bias === 'BAIXA') confidence = volumeReal ? 'HIGH' : 'MEDIUM';
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
        risk_note: 'Leitura heuristica de fonte unica (SMA/EMA reais); nao e backtested, nao considera funding/liquidacao quando DADOS_INSUFICIENTES.',
        confidence,
    };
}

function buildRouteWait(frame, bias, evidence) {
    if (frame.status !== 'OK') {
        return {
            reason: `DADOS_INSUFICIENTES: ${frame.status_reason || 'candles reais insuficientes para qualquer leitura de tendencia'}.`,
            trigger_to_reevaluate: 'Novo probe real com candles suficientes de uma fonte ACTIVE_READ_ONLY.',
            data_missing: (evidence?.missing_fields || []).join(', ') || 'candles',
            safer_condition: 'Aguardar fonte real validada antes de qualquer leitura de tendencia.',
        };
    }
    if (bias === 'NEUTRO' || bias === 'INDEFINIDO') {
        return {
            reason: 'Preco real entre SMA e EMA sem inclinacao clara — sem confirmacao de tendencia nesta amostra.',
            trigger_to_reevaluate: 'Nova leitura apos rompimento claro de suporte ou resistencia reais.',
            data_missing: (evidence?.missing_fields || []).join(', ') || 'nenhum campo critico ausente nesta leitura',
            safer_condition: 'Aguardar romper e fechar fora da faixa SMA/EMA atual com volume real, se disponivel.',
        };
    }
    return {
        reason: `Heuristica de fonte unica aponta para ${bias}, mas confirmacao adicional (volume/derivativos) esta ${(evidence?.missing_fields || []).length ? 'parcial' : 'limitada a uma so fonte'}.`,
        trigger_to_reevaluate: 'Confirmacao por volume real e/ou segunda fonte ACTIVE_READ_ONLY independente.',
        data_missing: (evidence?.missing_fields || []).join(', ') || 'nenhum campo critico ausente nesta leitura',
        safer_condition: 'Tratar ROTA C como a leitura default enquanto so houver uma fonte e uma heuristica simples confirmando.',
    };
}

/** @param {{frame: object, evidence: object}} opts — `frame` e o
 *  RealAnalysisFrame de js/real-data/analysis-frame.js; `evidence` e a
 *  Evidence original de js/real-data/schema.js (para funding/OI/liquidacao/
 *  long-short e fonte/timestamp no bloco EVIDENCE). */
export function buildResearchEngineFrame({ frame, evidence } = {}) {
    if (!frame || !evidence) {
        throw new Error('buildResearchEngineFrame requer { frame, evidence }');
    }
    const bias = trendBias(frame);
    const volumeReal = frame.volume_status === 'REAL';

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
        key_levels: {
            support: frame.support,
            resistance: frame.resistance,
            liquidity: evidence.order_book,
            retracement: DADOS_INSUFICIENTES, // nenhum motor de retracao (ex. Fibonacci) implementado
            volatility: frame.volatility_state,
        },
        futures_derivatives_data: futuresDerivativesData,
        rota_a_long: buildRouteLong(frame, bias, volumeReal),
        rota_b_short: buildRouteShort(frame, bias, volumeReal),
        rota_c_wait: buildRouteWait(frame, bias, evidence),
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
            'Funding/open interest/liquidacao/long-short ratio ficam NAO_APLICAVEL (spot) ou DADOS_INSUFICIENTES (nenhum conector de derivativos ativo nesta fase).',
            'Nenhuma rota aqui executa, envia ou simula ordem — leitura puramente descritiva.',
        ],
        read_only: true,
        execution: 'DISABLED_BY_POLICY',
    };
}
