// schema.js — Evidence-First Data Object (mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
// Contrato unico de evidencia para qualquer conector real (rede ou import
// local). Toda leitura passa por aqui antes de alimentar AnalysisFrame ou
// ResearchEngineFrame — nenhum campo e inventado: ou tem dado real, ou e
// DADOS_INSUFICIENTES (deveria existir, a sonda nao confirmou) ou
// NAO_APLICAVEL (este tipo de instrumento/fonte estruturalmente nunca tem
// este campo). Ver docs/AR10_CYBORG_2_REAL_DATA_LAYER_RUNTIME_PROBE_V1.md.

import { sha256Hex } from '../crypto-utils.js';

export const DADOS_INSUFICIENTES = 'DADOS_INSUFICIENTES';
export const NAO_APLICAVEL = 'NAO_APLICAVEL';

// Vocabulario fechado do Connector State Machine. Nenhum conector pode
// comecar como ACTIVE_READ_ONLY por suposicao — so chega la se a propria
// sonda real (probe.js) passar.
// STALE nao e setado por nenhuma sonda: e um rotulo calculado em tempo de
// exibicao (registry.js:isStale / app.js) quando um conector ja confirmado
// ACTIVE_READ_ONLY nesta sessao passa muito tempo sem ser sondado de novo —
// a verdade gravada em sessionState nunca expira sozinha, so o rotulo exibido
// troca, para que dado real velho nunca pareca dado real "agora".
// FAILED e o resultado de uma excecao nao tratada dentro da propria sonda
// (bug/erro generico do conector), distinto dos BLOCKED_BY_* que sao
// classificacoes deliberadas de uma resposta HTTP real observada.
export const CONNECTOR_STATES = Object.freeze({
    PLANNED: 'PLANNED',
    PROBING: 'PROBING',
    ACTIVE_READ_ONLY: 'ACTIVE_READ_ONLY',
    STALE: 'STALE',
    DEGRADED: 'DEGRADED',
    BLOCKED_BY_CORS: 'BLOCKED_BY_CORS',
    BLOCKED_BY_SCHEMA: 'BLOCKED_BY_SCHEMA',
    BLOCKED_BY_POLICY: 'BLOCKED_BY_POLICY',
    FAILED: 'FAILED',
    DADOS_INSUFICIENTES: 'DADOS_INSUFICIENTES',
});

// Campos de dado do Evidence Object (subconjunto que pode ser DADOS_INSUFICIENTES
// ou NAO_APLICAVEL — os campos de identidade/metadado nunca usam este vocabulario).
export const EVIDENCE_DATA_FIELDS = Object.freeze([
    'candles', 'ticker', 'order_book', 'volume',
    'funding', 'open_interest', 'liquidations', 'long_short_ratio',
]);

// Por instrument_type, quais campos de dado sao estruturalmente impossiveis
// (NAO_APLICAVEL) independente de qualquer esforco de conector — ex.: spot
// nunca tem funding rate, isso nao e uma falha de leitura, e a natureza do
// instrumento. Campos fora desta lista comecam DADOS_INSUFICIENTES (o
// conector ainda precisa preenche-los com dado real).
const STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT = Object.freeze({
    crypto_spot: ['funding', 'open_interest', 'liquidations', 'long_short_ratio'],
    crypto_futures: [],
    imported_series: ['order_book', 'funding', 'open_interest', 'liquidations', 'long_short_ratio'],
});

/** Evidence Object vazio e honesto: identidade preenchida, todo campo de
 *  dado em DADOS_INSUFICIENTES ou NAO_APLICAVEL conforme instrument_type.
 *  O conector preenche por cima apenas o que a sonda real confirmou. */
export function createEmptyEvidence({ source_id, source_name, endpoint_kind, symbol, instrument_type }) {
    const structuralNA = STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT[instrument_type] || [];
    const evidence = {
        source_id,
        source_name,
        endpoint_kind,
        symbol,
        instrument_type,
        timeframe: DADOS_INSUFICIENTES,
        timestamp: DADOS_INSUFICIENTES,
        fetched_at: null,
        freshness_ms: null,
        data_quality: DADOS_INSUFICIENTES,
        missing_fields: [],
        raw_sample_hash: DADOS_INSUFICIENTES,
    };
    for (const field of EVIDENCE_DATA_FIELDS) {
        evidence[field] = structuralNA.includes(field) ? NAO_APLICAVEL : DADOS_INSUFICIENTES;
    }
    return evidence;
}

const REQUIRED_KEYS = Object.freeze([
    'source_id', 'source_name', 'endpoint_kind', 'symbol', 'instrument_type',
    'timeframe', 'timestamp', 'fetched_at', 'freshness_ms', 'data_quality',
    'missing_fields', 'raw_sample_hash', ...EVIDENCE_DATA_FIELDS,
]);

/** Validacao estrutural pura (formato), nao validacao de conteudo de mercado.
 *  Usada por probe.js apos parse e por evaluations.js no self-test. */
export function validateEvidenceShape(obj) {
    const errors = [];
    if (!obj || typeof obj !== 'object') return { valid: false, errors: ['evidence_nao_e_objeto'] };
    for (const key of REQUIRED_KEYS) {
        if (!(key in obj)) errors.push(`campo_ausente:${key}`);
    }
    if (!Array.isArray(obj.missing_fields)) errors.push('missing_fields_nao_e_array');
    return { valid: errors.length === 0, errors };
}

/** Marca um campo de dado como confirmadamente ausente nesta leitura (a
 *  sonda rodou mas o campo nao veio) — nunca usado para campos NAO_APLICAVEL,
 *  que sao estruturais e não entram em missing_fields. */
export function markFieldMissing(evidence, field) {
    if (evidence[field] === NAO_APLICAVEL) return;
    evidence[field] = DADOS_INSUFICIENTES;
    if (!evidence.missing_fields.includes(field)) evidence.missing_fields.push(field);
}

/** Hash SHA-256 hex da amostra crua (texto da resposta, antes do parse) —
 *  reaproveita crypto-utils.js, mesmo Web Crypto usado pelo Local Pack. */
export async function hashRawSample(rawText) {
    if (!rawText) return DADOS_INSUFICIENTES;
    try {
        const bytes = new TextEncoder().encode(rawText);
        return await sha256Hex(bytes);
    } catch {
        return DADOS_INSUFICIENTES;
    }
}

/** Avaliacao honesta de data_quality a partir do que sobrou em missing_fields
 *  apos o conector preencher o que conseguiu. Nunca "OK" se faltou campo que
 *  deveria existir para este instrument_type. */
export function computeDataQuality(evidence) {
    if (!evidence.fetched_at) return DADOS_INSUFICIENTES;
    if (evidence.missing_fields.length === 0) return 'COMPLETA_PARA_CAPACIDADES_TENTADAS';
    return 'PARCIAL';
}
