// mexc-public.js — Conector real MEXC Spot (publico, sem chave).
// Endpoint usado: GET /api/v3/klines — candles OHLCV. Sem chave de API, sem
// endpoint privado/account, sem credencial. connector_id reaproveita
// `mexc-public-market-adapter` de connector-registry.default.json (mesma
// identidade do roteiro estatico; current_status do JSON estatico continua
// PLANNED ate uma fase de seguranca dedicada promover o roteiro — quem
// reporta ACTIVE_READ_ONLY de verdade, por sessao, e este modulo via
// registry.js, nunca o JSON estatico).
//
// Honestidade de plataforma: a documentacao publica da MEXC para
// `/api/v3/klines` nao foi re-verificada nesta sessao (sandbox sem acesso de
// rede — ver relatorio final, secao "WHAT STILL NEEDS REAL IPAD TEST"). Por
// isso este modulo nao assume a unidade exata do timestamp (segundos vs
// milissegundos) e detecta pela magnitude, em vez de fixar um palpite — se o
// formato real vier diferente do esperado, validateKlinesShape ou o calculo
// de candles falha de forma visivel (BLOCKED_BY_SCHEMA), nunca silenciosamente
// errado.

import { probeJsonEndpoint } from './probe.js';
import { CONNECTOR_STATES, createEmptyEvidence, markFieldMissing, hashRawSample, computeDataQuality } from './schema.js';

export const meta = Object.freeze({
    connector_id: 'mexc-public-market-adapter',
    connector_name: 'MEXC Spot Public Market Data (klines)',
    endpoint_kind: 'exchange_public_klines',
    instrument_type: 'crypto_spot',
    requires_api_key: false,
    supports_private_endpoints: false,
});

const SYMBOL_TO_PAIR = Object.freeze({ BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT', XRP: 'XRPUSDT' });

function toEpochSeconds(rawT) {
    const n = Number(rawT);
    return n > 1e12 ? Math.round(n / 1000) : Math.round(n);
}

function validateKlinesShape(json) {
    if (!Array.isArray(json)) return { valid: false, reason: 'resposta_nao_e_array' };
    if (json.length === 0) return { valid: false, reason: 'array_vazio' };
    const sample = json[0];
    if (!Array.isArray(sample) || sample.length < 6) return { valid: false, reason: 'linha_de_kline_com_formato_inesperado' };
    return { valid: true };
}

/** @param {{symbol?: string, interval?: string, limit?: number, timeoutMs?: number}} opts */
export async function probe({ symbol = 'BTC', interval = '60m', limit = 100, timeoutMs = 8000 } = {}) {
    const pair = SYMBOL_TO_PAIR[symbol] || `${symbol}USDT`;
    const evidence = createEmptyEvidence({
        source_id: meta.connector_id,
        source_name: meta.connector_name,
        endpoint_kind: meta.endpoint_kind,
        symbol,
        instrument_type: meta.instrument_type,
    });

    const url = `https://api.mexc.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(limit)}`;
    const probeResult = await probeJsonEndpoint({ url, timeoutMs, validate: validateKlinesShape });

    if (probeResult.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        return { state: probeResult.state, evidence, probe_detail: probeResult };
    }

    const rows = probeResult.json;
    const candles = rows.map((row) => ({
        t: toEpochSeconds(row[0]), o: Number(row[1]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]), v: Number(row[5]),
    }));
    const last = candles[candles.length - 1];

    evidence.timeframe = interval;
    evidence.timestamp = new Date(last.t * 1000).toISOString();
    evidence.fetched_at = new Date().toISOString();
    evidence.freshness_ms = Date.now() - last.t * 1000;
    evidence.candles = candles;
    evidence.ticker = { last_price: last.c, derived_from: 'ULTIMO_CLOSE_DO_KLINE', pair };
    evidence.volume = { last_candle_volume: last.v, unit: 'base_asset' };
    evidence.raw_sample_hash = await hashRawSample(probeResult.raw_text);
    markFieldMissing(evidence, 'order_book'); // nao chamado nesta sonda (uma so chamada de rede)
    evidence.data_quality = computeDataQuality(evidence);

    return { state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence, probe_detail: probeResult };
}
