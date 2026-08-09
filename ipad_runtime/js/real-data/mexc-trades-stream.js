// mexc-trades-stream.js — Conector real de trades MEXC Spot (publico, sem
// chave), dedicado a alimentar o Order Flow Engine com ticks reais
// lado BUY/SELL — a fonte que candle-tick-synthesizer.js sempre disse que
// faltava (ver header daquele arquivo). Endpoint: GET /api/v3/trades.
//
// Por que REST por polling, nao WebSocket: os outros 5 conectores deste
// app (coingecko/binance/binance-futures/mexc/mexc-futures, todos em
// registry.js) sao 100% GET publico fail-closed via probeJsonEndpoint —
// "uma sonda, um resultado real observado, classificado no vocabulario de
// CONNECTOR_STATES". Uma conexao WebSocket persistente fugiria desse
// modelo de falha auditado (timeout/CORS/schema) e exigiria estado de
// reconexao novo e nao testado neste app. Polling de /api/v3/trades a cada
// poucos segundos entrega o mesmo dado real (trade-a-trade, lado real do
// agressor) com o mesmo modelo de honestidade ja em produção.
//
// Por que NAO usa o Evidence Object de schema.js: aquele contrato
// (candles/ticker/order_book/funding/...) descreve uma fotografia de
// mercado para AnalysisFrame/ResearchEngineFrame. Um trade-a-trade real e
// um tipo de dado estruturalmente diferente (uma serie, nao uma
// fotografia) que so o Order Flow Engine consome via Tick[]. Ainda assim
// reusa CONNECTOR_STATES e probeJsonEndpoint — mesmo vocabulario de
// estado, mesmo fail-closed, sem inventar um contrato novo.
//
// Honestidade de plataforma: a forma exata da resposta de
// api.mexc.com/api/v3/trades NAO foi reverificada ao vivo nesta sessao —
// o sandbox de execucao nao tem saida de rede para exchanges (confirmado
// via curl direto: a CONNECT tunnel para api.mexc.com:443 volta 403 de
// "policy denial" no proxy do ambiente, mesma barreira documentada em
// mexc-public.js para klines). O formato assumido abaixo (array de
// objetos com price/qty/time/isBuyerMaker) e o documentado publicamente e
// e o mesmo formato ja assumido — e nunca testado ao vivo nesta sessao —
// por mexc-public.js para klines. isBuyerMaker e a convencao padrao deste
// tipo de API publica para inferir o lado do agressor sem acesso a
// L2/L3: isBuyerMaker=true => o comprador era o lado passivo (maker) =>
// quem agrediu o book foi o vendedor => Side.SELL; isBuyerMaker=false =>
// o comprador agrediu => Side.BUY. Se a resposta real vier em formato
// diferente, validateTradesShape falha de forma visivel
// (BLOCKED_BY_SCHEMA), nunca um tick inventado ou um lado chutado.

import { probeJsonEndpoint } from './probe.js';
import { CONNECTOR_STATES } from './schema.js';
import { Tick, Side } from '../../src/orderflow/value-objects.js';

export const meta = Object.freeze({
    connector_id: 'mexc-public-trades-stream',
    connector_name: 'MEXC Spot Public Trades Stream (polling)',
    endpoint_kind: 'exchange_public_trades',
    instrument_type: 'crypto_spot',
    requires_api_key: false,
    supports_private_endpoints: false,
});

const SYMBOL_TO_PAIR = Object.freeze({ BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT', XRP: 'XRPUSDT' });

/** Validacao estrutural pura da resposta de /api/v3/trades — formato, nao
 *  conteudo de mercado. Falha fechado (BLOCKED_BY_SCHEMA via probe.js) se
 *  a forma real divergir do documentado. */
export function validateTradesShape(json) {
    if (!Array.isArray(json)) return { valid: false, reason: 'resposta_nao_e_array' };
    if (json.length === 0) return { valid: false, reason: 'array_vazio' };
    const sample = json[0];
    if (!sample || typeof sample !== 'object') return { valid: false, reason: 'item_nao_e_objeto' };
    if (sample.price === undefined || sample.qty === undefined || sample.time === undefined || sample.isBuyerMaker === undefined) {
        return { valid: false, reason: 'campos_esperados_ausentes(price/qty/time/isBuyerMaker)' };
    }
    return { valid: true };
}

// BUG REAL evitado aqui (mesma classe ja encontrada e corrigida nesta sessao
// em tradfi-delayed-yahoo.js): Number(null) === 0 em JavaScript. Um campo
// price/time/qty ausente ou malformado numa linha real da API viraria um
// zero fabricado — e Number.isFinite(0) e true, entao passaria disfarcado
// de tick valido — exatamente o que a Regra de Ouro 3 proibe.
// toFiniteOrNull rejeita null/undefined ANTES de converter para numero.
function toFiniteOrNull(raw) {
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

/** Mapeia linhas cruas de /api/v3/trades para Tick[] do Order Flow Engine.
 *  Funcao pura: mesma entrada sempre produz a mesma saida, zero rede,
 *  testavel offline (ver evaluations.js). Ordena por tempo ascendente de
 *  forma defensiva — nunca assume a ordem da resposta real, mesmo que a
 *  documentacao publica diga que ja vem ascendente. Linhas com
 *  price/time/qty ausente, nao-numerico ou volume negativo sao descartadas
 *  em silencio (fail-closed), nunca viram um Tick fabricado. */
export function tradesToTicks(rows, exchange = 'MEXC_SPOT_LIVE') {
    return rows
        .slice()
        .sort((a, b) => Number(a.time) - Number(b.time))
        .map((row) => ({
            timestamp: toFiniteOrNull(row.time),
            price: toFiniteOrNull(row.price),
            volume: toFiniteOrNull(row.qty),
            side: row.isBuyerMaker ? Side.SELL : Side.BUY,
        }))
        .filter((t) => t.timestamp !== null && t.price !== null && t.volume !== null && t.volume >= 0)
        .map((t) => new Tick({ ...t, exchange }));
}

/** Filtra so' os trades estritamente mais novos que lastTradeId (dedup
 *  entre ciclos de polling). lastTradeId=null significa "primeiro ciclo":
 *  admite a janela inteira retornada pela API (comportamento documentado,
 *  nao um efeito colateral). Funcao pura, testavel offline. */
export function filterNewTrades(rows, lastTradeId) {
    if (lastTradeId === null || lastTradeId === undefined) return rows.slice();
    return rows.filter((row) => Number(row.id) > lastTradeId);
}

function maxTradeId(rows, fallback) {
    let max = fallback;
    for (const row of rows) {
        const id = Number(row.id);
        if (Number.isFinite(id) && (max === null || id > max)) max = id;
    }
    return max;
}

/** Uma sonda real = uma janela de trades recentes (sem paginacao por id;
 *  ver createLivePoller para ingestao continua deduplicada entre ciclos). */
export async function probe({ symbol = 'BTC', limit = 500, timeoutMs = 8000 } = {}) {
    const pair = SYMBOL_TO_PAIR[symbol] || `${symbol}USDT`;
    const url = `https://api.mexc.com/api/v3/trades?symbol=${encodeURIComponent(pair)}&limit=${encodeURIComponent(limit)}`;
    const probeResult = await probeJsonEndpoint({ url, timeoutMs, validate: validateTradesShape });
    if (probeResult.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        return { state: probeResult.state, rows: [], probe_detail: probeResult };
    }
    return { state: CONNECTOR_STATES.ACTIVE_READ_ONLY, rows: probeResult.json, probe_detail: probeResult };
}

/** Cria um poller de trades reais com dedup por id entre ciclos. Nao inicia
 *  sozinho — start()/stop() sao explicitos, chamados pela camada de
 *  orquestracao (orderflow-engine-ui.js). Cada ciclo chama onResult com o
 *  estado real observado nesta sondagem, mesmo quando nao ha trade novo ou
 *  quando a sonda falha — a UI nunca deve ficar com um badge "LIVE" parado
 *  no ultimo sucesso depois que a rede caiu. */
export function createLivePoller({ symbol = 'BTC', intervalMs = 4000, limit = 500, timeoutMs = 8000, onResult }) {
    let timerHandle = null;
    let lastTradeId = null;
    let running = false;

    async function cycle() {
        const result = await probe({ symbol, limit, timeoutMs });
        if (result.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
            onResult?.({ state: result.state, ticks: [], probe_detail: result.probe_detail });
            return;
        }
        const newRows = filterNewTrades(result.rows, lastTradeId);
        lastTradeId = maxTradeId(result.rows, lastTradeId);
        const ticks = tradesToTicks(newRows);
        onResult?.({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, ticks, probe_detail: result.probe_detail });
    }

    return {
        start() {
            if (running) return;
            running = true;
            lastTradeId = null;
            cycle();
            timerHandle = setInterval(cycle, intervalMs);
        },
        stop() {
            running = false;
            if (timerHandle !== null) clearInterval(timerHandle);
            timerHandle = null;
        },
        isRunning() {
            return running;
        },
    };
}
