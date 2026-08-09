// binance-public.js — Conector real Binance Spot (publico, sem chave).
// Endpoint usado: GET /api/v3/klines — candles OHLCV nativos (inclui volume
// real, diferente do CoinGecko OHLC). Sem chave de API, sem endpoint
// privado/account, sem credencial. Uma unica chamada de rede por probe.
// connector_id novo (binance-spot-public-adapter) porque o registro
// existente (connector-registry.default.json) so tinha a entrada de
// futuros (binance-futures-public-adapter) — spot e perpetual sao hosts/
// endpoints diferentes, entradas separadas e honestas.

import { probeJsonEndpoint } from './probe.js';
import { CONNECTOR_STATES, createEmptyEvidence, hashRawSample, computeDataQuality } from './schema.js';
import { SYMBOL_TO_USDT_PAIR as SYMBOL_TO_PAIR } from '../shared/symbols.js';

export const meta = Object.freeze({
    connector_id: 'binance-spot-public-adapter',
    connector_name: 'Binance Spot Public Market Data (klines)',
    endpoint_kind: 'exchange_public_klines',
    instrument_type: 'crypto_spot',
    requires_api_key: false,
    supports_private_endpoints: false,
});

function validateKlinesShape(json) {
    if (!Array.isArray(json)) return { valid: false, reason: 'resposta_nao_e_array' };
    if (json.length === 0) return { valid: false, reason: 'array_vazio' };
    const sample = json[0];
    if (!Array.isArray(sample) || sample.length < 6) return { valid: false, reason: 'linha_de_kline_com_formato_inesperado' };
    return { valid: true };
}

/** @param {{symbol?: string, interval?: string, limit?: number, timeoutMs?: number}} opts */
export async function probe({ symbol = 'BTC', interval = '1h', limit = 100, timeoutMs = 8000 } = {}) {
    const pair = SYMBOL_TO_PAIR[symbol] || `${symbol}USDT`;
    const evidence = createEmptyEvidence({
        source_id: meta.connector_id,
        source_name: meta.connector_name,
        endpoint_kind: meta.endpoint_kind,
        symbol,
        instrument_type: meta.instrument_type,
    });

    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(limit)}`;
    const probeResult = await probeJsonEndpoint({ url, timeoutMs, validate: validateKlinesShape });

    if (probeResult.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        return { state: probeResult.state, evidence, probe_detail: probeResult };
    }

    const rows = probeResult.json;
    const candles = rows.map((row) => ({
        t: Math.round(row[0] / 1000), o: Number(row[1]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]), v: Number(row[5]),
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
    evidence.data_quality = computeDataQuality(evidence);

    return { state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence, probe_detail: probeResult };
}
