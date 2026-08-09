// binance-futures-public.js — Conector real Binance USDT-M Futures (publico,
// sem chave). Mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1,
// passo "completar dados long/short sem live": prepara o contrato/sonda de
// derivativos publicos SEM nenhuma rota de execucao, exatamente no mesmo
// nivel de risco dos conectores spot ja existentes (binance-public.js,
// mexc-public.js) — so GET publico, sem chave, sem endpoint privado.
//
// connector_id reaproveita `binance-futures-public-adapter` de
// connector-registry.default.json (mesma identidade do roteiro estatico;
// current_status do JSON estatico continua PLANNED ate uma fase de seguranca
// dedicada promover o roteiro — quem reporta ACTIVE_READ_ONLY de verdade, por
// sessao, e este modulo via registry.js, nunca o JSON estatico. Mesmo padrao
// de mexc-public.js).
//
// Cinco endpoints publicos, candles e' o unico obrigatorio (se falhar, o
// probe inteiro falha, igual aos conectores spot); order_book/funding/open
// interest/long-short ratio sao melhor-esforco e independentes entre si — se
// um bloquear/falhar (CORS, schema, policy), so aquele campo fica
// DADOS_INSUFICIENTES via markFieldMissing, nunca derruba o probe inteiro e
// nunca inventa valor. Liquidacoes agregadas NAO tem endpoint REST publico
// estavel na Binance Futures (so existe via websocket !forceOrder@arr) —
// fica DADOS_INSUFICIENTES sempre nesta fase, por ausencia estrutural de
// rota REST, nao por falha de sonda.
//
// Honestidade de plataforma: estes 5 endpoints (klines/depth/premiumIndex/
// openInterest/globalLongShortAccountRatio) nao foram re-verificados ao vivo
// nesta sessao de implementacao (sandbox sem acesso de rede de saida — mesma
// limitacao documentada em mexc-public.js). Formato e nomes de campo seguem a
// documentacao publica estavel da Binance Futures; se algo vier diferente do
// esperado, os validadores de schema abaixo falham de forma visivel
// (BLOCKED_BY_SCHEMA), nunca silenciosamente errado. Teste real fica para o
// iPad (mesmo "WHAT STILL NEEDS REAL IPAD TEST" do restante do Real Data Layer).

import { probeJsonEndpoint } from './probe.js';
import { CONNECTOR_STATES, DADOS_INSUFICIENTES, createEmptyEvidence, markFieldMissing, hashRawSample, computeDataQuality } from './schema.js';
import { SYMBOL_TO_USDT_PAIR as SYMBOL_TO_PAIR } from '../shared/symbols.js';

export const meta = Object.freeze({
    connector_id: 'binance-futures-public-adapter',
    connector_name: 'Binance USDT-M Futures Public Market Data Adapter',
    endpoint_kind: 'exchange_public_futures_market_data',
    instrument_type: 'crypto_futures',
    requires_api_key: false,
    supports_private_endpoints: false,
});

const FUTURES_BASE = 'https://fapi.binance.com';

function validateKlinesShape(json) {
    if (!Array.isArray(json)) return { valid: false, reason: 'resposta_nao_e_array' };
    if (json.length === 0) return { valid: false, reason: 'array_vazio' };
    const sample = json[0];
    if (!Array.isArray(sample) || sample.length < 6) return { valid: false, reason: 'linha_de_kline_com_formato_inesperado' };
    return { valid: true };
}

function validateDepthShape(json) {
    if (!json || !Array.isArray(json.bids) || !Array.isArray(json.asks)) return { valid: false, reason: 'resposta_sem_bids_ou_asks' };
    if (json.bids.length === 0 || json.asks.length === 0) return { valid: false, reason: 'order_book_vazio' };
    return { valid: true };
}

function validatePremiumIndexShape(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return { valid: false, reason: 'resposta_nao_e_objeto' };
    if (json.lastFundingRate === undefined) return { valid: false, reason: 'campo_lastFundingRate_ausente' };
    return { valid: true };
}

function validateOpenInterestShape(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return { valid: false, reason: 'resposta_nao_e_objeto' };
    if (json.openInterest === undefined) return { valid: false, reason: 'campo_openInterest_ausente' };
    return { valid: true };
}

function validateLongShortShape(json) {
    if (!Array.isArray(json) || json.length === 0) return { valid: false, reason: 'resposta_nao_e_array_ou_vazia' };
    if (json[json.length - 1].longShortRatio === undefined) return { valid: false, reason: 'campo_longShortRatio_ausente' };
    return { valid: true };
}

/** @param {{symbol?: string, interval?: string, limit?: number, timeoutMs?: number, includeDerivatives?: boolean, endTime?: number}} opts
 *  includeDerivatives (default true, preserva o comportamento original para
 *  qualquer chamador que precise do Evidence Object completo): quando
 *  false, pula as 4 sondas de depth/funding/open_interest/long_short —
 *  achado real da auditoria autônoma (Master Panel handoff): o único
 *  chamador de produção deste probe() é collectBinanceFuturesKlines()
 *  (src/market-data-bus/binance-futures-candle-connector.js), que só lê
 *  evidence.candles — as 4 sondas extras eram buscadas via Promise.all e
 *  DESCARTADAS por inteiro a cada ciclo real (~a cada 25s), atrasando o
 *  caminho crítico do gráfico/Risk Engine por 4 round-trips de rede sem
 *  nenhum uso real do resultado.
 *  endTime (auditoria de arquitetura — paginação histórica do gráfico):
 *  epoch ms real, repassado direto ao parâmetro nativo `endTime` da Binance
 *  (documentado, não uma invenção) — devolve os `limit` candles mais
 *  recentes que fecham em ou antes desse instante, em vez dos mais
 *  recentes absolutos. undefined preserva o comportamento de sempre. */
export async function probe({ symbol = 'BTC', interval = '1h', limit = 100, timeoutMs = 8000, includeDerivatives = true, endTime } = {}) {
    const pair = SYMBOL_TO_PAIR[symbol] || `${symbol}USDT`;
    const evidence = createEmptyEvidence({
        source_id: meta.connector_id,
        source_name: meta.connector_name,
        endpoint_kind: meta.endpoint_kind,
        symbol,
        instrument_type: meta.instrument_type,
    });

    const klinesUrl = `${FUTURES_BASE}/fapi/v1/klines?symbol=${encodeURIComponent(pair)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(limit)}`
        + (Number.isFinite(endTime) ? `&endTime=${encodeURIComponent(Math.round(endTime))}` : '');
    const klinesProbe = await probeJsonEndpoint({ url: klinesUrl, timeoutMs, validate: validateKlinesShape });

    if (klinesProbe.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        return { state: klinesProbe.state, evidence, probe_detail: klinesProbe };
    }

    const rows = klinesProbe.json;
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
    evidence.raw_sample_hash = await hashRawSample(klinesProbe.raw_text);

    if (!includeDerivatives) {
        // Mesmas 5 chamadas a markFieldMissing/liquidations do caminho
        // completo abaixo — o Evidence Object continua honesto sobre o que
        // não foi buscado (DADOS_INSUFICIENTES, nunca inventado), só sem
        // pagar o custo de rede de sondas cujo resultado seria descartado.
        markFieldMissing(evidence, 'order_book');
        markFieldMissing(evidence, 'funding');
        markFieldMissing(evidence, 'open_interest');
        markFieldMissing(evidence, 'long_short_ratio');
        markFieldMissing(evidence, 'liquidations');
        evidence.data_quality = computeDataQuality(evidence);
        return { state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence, probe_detail: { klines: klinesProbe } };
    }

    const [depthProbe, fundingProbe, oiProbe, lsProbe] = await Promise.all([
        probeJsonEndpoint({ url: `${FUTURES_BASE}/fapi/v1/depth?symbol=${encodeURIComponent(pair)}&limit=5`, timeoutMs, validate: validateDepthShape }),
        probeJsonEndpoint({ url: `${FUTURES_BASE}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(pair)}`, timeoutMs, validate: validatePremiumIndexShape }),
        probeJsonEndpoint({ url: `${FUTURES_BASE}/fapi/v1/openInterest?symbol=${encodeURIComponent(pair)}`, timeoutMs, validate: validateOpenInterestShape }),
        probeJsonEndpoint({ url: `${FUTURES_BASE}/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(pair)}&period=5m&limit=1`, timeoutMs, validate: validateLongShortShape }),
    ]);

    if (depthProbe.state === CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        const d = depthProbe.json;
        evidence.order_book = {
            best_bid: Number(d.bids[0][0]),
            best_ask: Number(d.asks[0][0]),
            depth_levels: Math.min(d.bids.length, d.asks.length),
        };
    } else {
        markFieldMissing(evidence, 'order_book');
    }

    if (fundingProbe.state === CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        const f = fundingProbe.json;
        evidence.funding = {
            last_funding_rate: Number(f.lastFundingRate),
            mark_price: Number(f.markPrice),
            next_funding_time: f.nextFundingTime ? new Date(f.nextFundingTime).toISOString() : DADOS_INSUFICIENTES,
        };
    } else {
        markFieldMissing(evidence, 'funding');
    }

    if (oiProbe.state === CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        evidence.open_interest = { value: Number(oiProbe.json.openInterest), unit: 'base_asset' };
    } else {
        markFieldMissing(evidence, 'open_interest');
    }

    if (lsProbe.state === CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        const entry = lsProbe.json[lsProbe.json.length - 1];
        evidence.long_short_ratio = {
            ratio: Number(entry.longShortRatio),
            long_account: Number(entry.longAccount),
            short_account: Number(entry.shortAccount),
        };
    } else {
        markFieldMissing(evidence, 'long_short_ratio');
    }

    // Sem endpoint REST publico estavel para liquidacoes agregadas na Binance
    // Futures nesta fase (ver header) — DADOS_INSUFICIENTES por ausencia
    // estrutural de rota, nunca um valor inventado.
    markFieldMissing(evidence, 'liquidations');

    evidence.data_quality = computeDataQuality(evidence);

    return {
        state: CONNECTOR_STATES.ACTIVE_READ_ONLY,
        evidence,
        probe_detail: { klines: klinesProbe, order_book: depthProbe, funding: fundingProbe, open_interest: oiProbe, long_short_ratio: lsProbe },
    };
}
