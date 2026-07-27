// mexc-futures-public.js — Conector real MEXC USDT-M Futures/Contract
// (público, sem chave). ADITIVO V-MAX Etapa 1 (Market Data Adapter):
// candles reais para o MEXCProvider — sonda dedicada, candles-only.
// funding/mark price da MEXC já têm sonda própria e independente em
// ramber-ui/src/cross-exchange/mexc-futures.ts (cross-check consultivo,
// nunca fonte de candle) — zero duplicação aqui, este arquivo cobre só
// o que faltava: uma série de candles real no schema canônico do Bus.
//
// Honestidade de pesquisa (CLAUDE.md — confirmar API real antes de
// implementar, nunca inventar uma variante própria): a documentação
// oficial (mexcdevelop.github.io/apidocs/contract_v1_en,
// www.mexc.com/api-docs/futures/market-endpoints) bloqueou fetch direto
// nesta sessão (HTTP 403 nas duas). Endpoint/schema abaixo vêm
// corroborados por múltiplas fontes secundárias independentes (a
// collection Postman oficial mexcdevelop/mexc-api-postman, buscas
// cruzadas): resposta é um OBJETO DE ARRAYS PARALELOS (nunca array-de-
// arrays como a Binance) — { success, code, data: { time[], open[],
// high[], low[], close[], vol[] } }, com `time` em SEGUNDOS (exemplo
// documentado de 10 dígitos) enquanto os parâmetros de query
// start/end são em MILISSEGUNDOS (exemplo de 13 dígitos) — assimetria
// real da API, não um erro deste conector. NUNCA verificado ao vivo
// neste sandbox (zero egress a exchanges nesta sessão de implementação)
// — se o schema real vier diferente do esperado, validateKlinesShape
// abaixo falha visivelmente (BLOCKED_BY_SCHEMA), nunca silenciosamente
// errado. Mesma disciplina/mesma ressalva que binance-futures-public.js
// já documenta para si mesmo.
import { probeJsonEndpoint } from './probe.js';
import { CONNECTOR_STATES, createEmptyEvidence, markFieldMissing, hashRawSample, computeDataQuality } from './schema.js';

export const meta = Object.freeze({
    connector_id: 'mexc-futures-public-adapter',
    connector_name: 'MEXC USDT-M Futures Public Market Data Adapter',
    endpoint_kind: 'exchange_public_futures_market_data',
    instrument_type: 'crypto_futures',
    requires_api_key: false,
    supports_private_endpoints: false,
});

const CONTRACT_BASE = 'https://contract.mexc.com';

// Símbolo MEXC Futures real: formato BTC_USDT (underscore) — MESMA
// convenção já documentada/usada em cross-exchange/mexc-futures.ts,
// nunca uma segunda regra de formatação inventada aqui.
function toMexcSymbol(symbol) {
    return symbol.includes('_') ? symbol : `${symbol}_USDT`;
}

// Granularidade real MEXC Contract (enum documentado — Min1/Min5/Min15/
// Min30/Min60/Hour4/Hour8/Day1/Week1/Month1 — nunca um valor livre).
// Mapeia os timeframes reais já usados pelo resto do app (mesmo
// vocabulário de engine-bridge.ts/EnhancedChart) para o enum da MEXC.
// Timeframe ausente do mapa => a sonda falha honesto (BLOCKED_BY_SCHEMA)
// em vez de adivinhar um enum que não existe.
const INTERVAL_MAP = Object.freeze({
    '1m': 'Min1', '3m': 'Min1', '5m': 'Min5', '15m': 'Min15', '30m': 'Min30',
    '1h': 'Min60', '4h': 'Hour4', '8h': 'Hour8', '1d': 'Day1', '1w': 'Week1',
});

function validateKlinesShape(json) {
    if (!json || typeof json !== 'object' || json.success !== true) return { valid: false, reason: 'campo_success_nao_e_true' };
    const d = json.data;
    if (!d || typeof d !== 'object') return { valid: false, reason: 'campo_data_ausente' };
    const arrays = ['time', 'open', 'high', 'low', 'close', 'vol'];
    for (const key of arrays) {
        if (!Array.isArray(d[key])) return { valid: false, reason: `campo_data.${key}_nao_e_array` };
    }
    if (d.time.length === 0) return { valid: false, reason: 'serie_vazia' };
    const n = d.time.length;
    if (arrays.some((key) => d[key].length !== n)) return { valid: false, reason: 'arrays_paralelos_com_tamanhos_diferentes' };
    return { valid: true };
}

/** @param {{symbol?: string, interval?: string, limit?: number, timeoutMs?: number, endTime?: number}} opts
 *  endTime: epoch ms real (mesma semântica de binance-futures-public.js),
 *  repassado ao parâmetro `end` (ms, documentado) da MEXC — devolve os
 *  candles mais próximos desse instante em vez dos mais recentes
 *  absolutos. undefined preserva o comportamento default (mais
 *  recentes).
 *  limit: a MEXC não documenta um parâmetro `limit` de query para este
 *  endpoint (só start/end, teto de 2000 por request) — cortado aqui,
 *  do lado mais recente da resposta, mesmo contrato honesto de "os
 *  `limit` candles mais recentes" que o resto do pipeline espera.
 *  @returns {Promise<{state: string, evidence: object, probe_detail: object}>} */
export async function probe({ symbol = 'BTC', interval = '15m', limit = 100, timeoutMs = 8000, endTime } = {}) {
    const pair = toMexcSymbol(symbol);
    const mexcInterval = INTERVAL_MAP[interval];
    const evidence = createEmptyEvidence({
        source_id: meta.connector_id,
        source_name: meta.connector_name,
        endpoint_kind: meta.endpoint_kind,
        symbol,
        instrument_type: meta.instrument_type,
    });

    if (!mexcInterval) {
        return { state: CONNECTOR_STATES.BLOCKED_BY_SCHEMA, evidence, probe_detail: { reason: `timeframe_sem_mapeamento_mexc:${interval}` } };
    }

    const klinesUrl = `${CONTRACT_BASE}/api/v1/contract/kline/${encodeURIComponent(pair)}?interval=${encodeURIComponent(mexcInterval)}`
        + (Number.isFinite(endTime) ? `&end=${encodeURIComponent(Math.round(endTime))}` : '');
    const klinesProbe = await probeJsonEndpoint({ url: klinesUrl, timeoutMs, validate: validateKlinesShape });

    if (klinesProbe.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        return { state: klinesProbe.state, evidence, probe_detail: klinesProbe };
    }

    const d = klinesProbe.json.data;
    const n = d.time.length;
    const rows = [];
    for (let i = 0; i < n; i++) {
        rows.push({
            t: Math.round(Number(d.time[i])), o: Number(d.open[i]), h: Number(d.high[i]),
            l: Number(d.low[i]), c: Number(d.close[i]), v: Number(d.vol[i]),
        });
    }
    const candles = rows.slice(-limit);
    const last = candles[candles.length - 1];

    evidence.timeframe = interval;
    evidence.timestamp = new Date(last.t * 1000).toISOString();
    evidence.fetched_at = new Date().toISOString();
    evidence.freshness_ms = Date.now() - last.t * 1000;
    evidence.candles = candles;
    evidence.ticker = { last_price: last.c, derived_from: 'ULTIMO_CLOSE_DO_KLINE', pair };
    evidence.volume = { last_candle_volume: last.v, unit: 'base_asset' };
    evidence.raw_sample_hash = await hashRawSample(klinesProbe.raw_text);
    markFieldMissing(evidence, 'order_book');
    markFieldMissing(evidence, 'funding');
    markFieldMissing(evidence, 'open_interest');
    markFieldMissing(evidence, 'long_short_ratio');
    markFieldMissing(evidence, 'liquidations');
    evidence.data_quality = computeDataQuality(evidence);
    return { state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence, probe_detail: { klines: klinesProbe } };
}
