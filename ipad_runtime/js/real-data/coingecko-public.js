// coingecko-public.js — Conector real CoinGecko (mercado agregado, publico).
// Endpoint usado: GET /api/v3/coins/{id}/ohlc — candles OHLC nativos, sem
// chave de API, sem endpoint privado, sem credencial. Uma unica chamada de
// rede por probe (sem chamada "as ciegas" extra para ticker): o preco mais
// recente e derivado honestamente do close do ultimo candle, marcado como
// tal na evidencia. Ver docs/AR10_CYBORG_2_REAL_DATA_LAYER_RUNTIME_PROBE_V1.md.

import { probeJsonEndpoint } from './probe.js';
import { CONNECTOR_STATES, createEmptyEvidence, markFieldMissing, hashRawSample, computeDataQuality } from './schema.js';

export const meta = Object.freeze({
    connector_id: 'coingecko-market-data-adapter',
    connector_name: 'CoinGecko Market Data (public OHLC)',
    endpoint_kind: 'aggregator_market_chart_ohlc',
    instrument_type: 'crypto_spot',
    requires_api_key: false,
    supports_private_endpoints: false,
});

// Seed pequena e honesta — nao exaustiva. CoinGecko usa `id` proprio, nao o
// ticker da exchange; expandir esta tabela e seguro (so adiciona mapeamento
// de simbolo->id, nao toca em rede/credencial).
const SYMBOL_TO_COINGECKO_ID = Object.freeze({
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple',
});

function validateOhlcShape(json) {
    if (!Array.isArray(json)) return { valid: false, reason: 'resposta_nao_e_array' };
    if (json.length === 0) return { valid: false, reason: 'array_vazio' };
    const sample = json[0];
    if (!Array.isArray(sample) || sample.length < 5) return { valid: false, reason: 'linha_de_candle_com_formato_inesperado' };
    return { valid: true };
}

/** @param {{symbol?: string, days?: number, timeoutMs?: number}} opts */
export async function probe({ symbol = 'BTC', days = 1, timeoutMs = 8000 } = {}) {
    const coingeckoId = SYMBOL_TO_COINGECKO_ID[symbol];
    const evidence = createEmptyEvidence({
        source_id: meta.connector_id,
        source_name: meta.connector_name,
        endpoint_kind: meta.endpoint_kind,
        symbol,
        instrument_type: meta.instrument_type,
    });

    if (!coingeckoId) {
        return { state: CONNECTOR_STATES.DADOS_INSUFICIENTES, evidence, probe_detail: { reason: `simbolo_sem_mapeamento_coingecko:${symbol}` } };
    }

    const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/ohlc?vs_currency=usd&days=${encodeURIComponent(days)}`;
    const probeResult = await probeJsonEndpoint({ url, timeoutMs, validate: validateOhlcShape });

    if (probeResult.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        return { state: probeResult.state, evidence, probe_detail: probeResult };
    }

    const rows = probeResult.json;
    const candles = rows.map(([tMs, o, h, l, c]) => ({ t: Math.round(tMs / 1000), o, h, l, c }));
    const last = candles[candles.length - 1];

    evidence.timeframe = `AUTO_COINGECKO_days=${days}`;
    evidence.timestamp = new Date(last.t * 1000).toISOString();
    evidence.fetched_at = new Date().toISOString();
    evidence.freshness_ms = Date.now() - last.t * 1000;
    evidence.candles = candles;
    evidence.ticker = { last_price: last.c, derived_from: 'ULTIMO_CLOSE_DO_CANDLE_OHLC', vs_currency: 'usd' };
    evidence.raw_sample_hash = await hashRawSample(probeResult.raw_text);
    markFieldMissing(evidence, 'volume'); // endpoint OHLC nao traz volume
    evidence.data_quality = computeDataQuality(evidence);

    return { state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence, probe_detail: probeResult };
}
