// mexc-futures-public.js — Conector real MEXC Contract (Futures) (publico,
// sem chave). Mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1,
// passo "completar dados long/short sem live": segundo conector de
// derivativos publicos (par do binance-futures-public.js), mesmo nivel de
// risco — so GET publico, sem chave, sem endpoint privado/account/order.
//
// connector_id reaproveita `mexc-futures-public-adapter` de
// connector-registry.default.json (mesmo padrao de mexc-public.js e
// binance-futures-public.js: current_status do JSON estatico continua
// PLANNED; quem reporta ACTIVE_READ_ONLY de verdade, por sessao, e este
// modulo via registry.js).
//
// Quatro endpoints publicos do dominio contract.mexc.com, candles e' o unico
// obrigatorio (se falhar, o probe inteiro falha, igual aos demais
// conectores); order_book/funding/open_interest sao melhor-esforco e
// independentes entre si. long_short_ratio e liquidations ficam
// DADOS_INSUFICIENTES SEMPRE nesta fase — a MEXC nao expoe (com confianca de
// documentacao publica estavel) um endpoint REST publico equivalente ao
// globalLongShortAccountRatio/forceOrder da Binance; por honestidade
// (mandato: "se nao houver certeza, nao inventar dado"), nenhum endpoint e
// chutado para esses dois campos — markFieldMissing direto, sem tentativa de
// rede, igual ao tratamento de liquidacoes em binance-futures-public.js.
//
// Honestidade de plataforma: o dominio contract.mexc.com usa formato de
// resposta DIFERENTE do dominio api.mexc.com (spot) — kline aqui e
// colunar (arrays paralelos time/open/high/low/close/vol dentro de
// `data`), nao array de linhas. Isso nao foi re-verificado ao vivo nesta
// sessao de implementacao (sandbox sem acesso de rede de saida — mesma
// limitacao documentada em mexc-public.js e binance-futures-public.js).
// Segue a documentacao publica estavel conhecida da MEXC Contract API; se
// algo vier diferente do esperado, os validadores de schema abaixo falham
// de forma visivel (BLOCKED_BY_SCHEMA), nunca silenciosamente errado. Teste
// real fica para o iPad.

import { probeJsonEndpoint } from './probe.js';
import { CONNECTOR_STATES, DADOS_INSUFICIENTES, createEmptyEvidence, markFieldMissing, hashRawSample, computeDataQuality } from './schema.js';

export const meta = Object.freeze({
    connector_id: 'mexc-futures-public-adapter',
    connector_name: 'MEXC Futures (Contract) Public Market Data Adapter',
    endpoint_kind: 'exchange_public_futures_market_data',
    instrument_type: 'crypto_futures',
    requires_api_key: false,
    supports_private_endpoints: false,
});

const SYMBOL_TO_PAIR = Object.freeze({ BTC: 'BTC_USDT', ETH: 'ETH_USDT', SOL: 'SOL_USDT', BNB: 'BNB_USDT', XRP: 'XRP_USDT' });
const CONTRACT_BASE = 'https://contract.mexc.com';

function toEpochSeconds(rawT) {
    const n = Number(rawT);
    return n > 1e12 ? Math.round(n / 1000) : Math.round(n);
}

function validateKlinesShape(json) {
    if (!json || typeof json !== 'object' || !json.data || typeof json.data !== 'object') return { valid: false, reason: 'resposta_sem_campo_data' };
    const d = json.data;
    for (const key of ['time', 'open', 'high', 'low', 'close', 'vol']) {
        if (!Array.isArray(d[key])) return { valid: false, reason: `campo_${key}_nao_e_array` };
    }
    if (d.time.length === 0) return { valid: false, reason: 'array_vazio' };
    return { valid: true };
}

function validateDepthShape(json) {
    if (!json || typeof json !== 'object' || !json.data || typeof json.data !== 'object') return { valid: false, reason: 'resposta_sem_campo_data' };
    const d = json.data;
    if (!Array.isArray(d.bids) || !Array.isArray(d.asks)) return { valid: false, reason: 'resposta_sem_bids_ou_asks' };
    if (d.bids.length === 0 || d.asks.length === 0) return { valid: false, reason: 'order_book_vazio' };
    return { valid: true };
}

function validateFundingRateShape(json) {
    if (!json || typeof json !== 'object' || !json.data || typeof json.data !== 'object') return { valid: false, reason: 'resposta_sem_campo_data' };
    if (json.data.fundingRate === undefined) return { valid: false, reason: 'campo_fundingRate_ausente' };
    return { valid: true };
}

function validateTickerShape(json) {
    if (!json || typeof json !== 'object' || !json.data || typeof json.data !== 'object') return { valid: false, reason: 'resposta_sem_campo_data' };
    if (json.data.holdVol === undefined) return { valid: false, reason: 'campo_holdVol_ausente' };
    return { valid: true };
}

/** @param {{symbol?: string, interval?: string, limit?: number, timeoutMs?: number}} opts */
export async function probe({ symbol = 'BTC', interval = 'Min60', timeoutMs = 8000 } = {}) {
    const pair = SYMBOL_TO_PAIR[symbol] || `${symbol}_USDT`;
    const evidence = createEmptyEvidence({
        source_id: meta.connector_id,
        source_name: meta.connector_name,
        endpoint_kind: meta.endpoint_kind,
        symbol,
        instrument_type: meta.instrument_type,
    });

    const klinesUrl = `${CONTRACT_BASE}/api/v1/contract/kline/${encodeURIComponent(pair)}?interval=${encodeURIComponent(interval)}`;
    const klinesProbe = await probeJsonEndpoint({ url: klinesUrl, timeoutMs, validate: validateKlinesShape });

    if (klinesProbe.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        return { state: klinesProbe.state, evidence, probe_detail: klinesProbe };
    }

    const d = klinesProbe.json.data;
    const candles = d.time.map((t, i) => ({
        t: toEpochSeconds(t), o: Number(d.open[i]), h: Number(d.high[i]), l: Number(d.low[i]), c: Number(d.close[i]), v: Number(d.vol[i]),
    }));
    const last = candles[candles.length - 1];

    evidence.timeframe = interval;
    evidence.timestamp = new Date(last.t * 1000).toISOString();
    evidence.fetched_at = new Date().toISOString();
    evidence.freshness_ms = Date.now() - last.t * 1000;
    evidence.candles = candles;
    evidence.ticker = { last_price: last.c, derived_from: 'ULTIMO_CLOSE_DO_KLINE', pair };
    evidence.volume = { last_candle_volume: last.v, unit: 'contratos' };
    evidence.raw_sample_hash = await hashRawSample(klinesProbe.raw_text);

    const [depthProbe, fundingProbe, tickerProbe] = await Promise.all([
        probeJsonEndpoint({ url: `${CONTRACT_BASE}/api/v1/contract/depth/${encodeURIComponent(pair)}?limit=5`, timeoutMs, validate: validateDepthShape }),
        probeJsonEndpoint({ url: `${CONTRACT_BASE}/api/v1/contract/funding_rate/${encodeURIComponent(pair)}`, timeoutMs, validate: validateFundingRateShape }),
        probeJsonEndpoint({ url: `${CONTRACT_BASE}/api/v1/contract/ticker?symbol=${encodeURIComponent(pair)}`, timeoutMs, validate: validateTickerShape }),
    ]);

    if (depthProbe.state === CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        const dep = depthProbe.json.data;
        evidence.order_book = {
            best_bid: Number(dep.bids[0][0]),
            best_ask: Number(dep.asks[0][0]),
            depth_levels: Math.min(dep.bids.length, dep.asks.length),
        };
    } else {
        markFieldMissing(evidence, 'order_book');
    }

    if (fundingProbe.state === CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        const f = fundingProbe.json.data;
        evidence.funding = {
            last_funding_rate: Number(f.fundingRate),
            mark_price: DADOS_INSUFICIENTES,
            next_funding_time: f.nextSettleTime ? new Date(Number(f.nextSettleTime)).toISOString() : DADOS_INSUFICIENTES,
        };
    } else {
        markFieldMissing(evidence, 'funding');
    }

    if (tickerProbe.state === CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        evidence.open_interest = { value: Number(tickerProbe.json.data.holdVol), unit: 'contratos' };
    } else {
        markFieldMissing(evidence, 'open_interest');
    }

    // Sem endpoint REST publico estavel e confirmado por documentacao para
    // long/short ratio e liquidacoes agregadas na MEXC Contract API nesta
    // fase (ver header) — DADOS_INSUFICIENTES por ausencia estrutural de
    // rota conhecida, nunca um valor inventado ou um endpoint chutado.
    markFieldMissing(evidence, 'long_short_ratio');
    markFieldMissing(evidence, 'liquidations');

    evidence.data_quality = computeDataQuality(evidence);

    return {
        state: CONNECTOR_STATES.ACTIVE_READ_ONLY,
        evidence,
        probe_detail: { klines: klinesProbe, order_book: depthProbe, funding: fundingProbe, open_interest: tickerProbe },
    };
}
