// mexc-ws-public.js — Conector real MEXC Spot Public WebSocket (publico, sem
// chave). Canal usado: `spot@public.deals.v3.api@<PAR>` (stream de negocios/
// trades executados) via wss://wbs-api.mexc.com/ws. Sem chave de API, sem
// endpoint privado/account, sem credencial. Uma unica conexao WS por sonda:
// abre, inscreve, captura a primeira mensagem de negocio real, fecha — nunca
// mantem stream aberto entre chamadas (mesma filosofia de "uma sonda por
// chamada" dos conectores REST deste diretorio).
//
// Honestidade de plataforma: o formato real das mensagens publicas do
// WebSocket da MEXC (JSON vs. protobuf binario; nomes exatos de campo dentro
// do payload de deals; e mesmo o host wss exato) NAO foi re-verificado ao
// vivo nesta sessao (sandbox sem acesso de rede — mesma ressalva que
// mexc-public.js ja documenta para o REST, aqui ainda mais relevante pois a
// MEXC e' conhecida por ter migrado parte do seu WS V3 para protobuf). Por
// isso o validador abaixo e deliberadamente defensivo: aceita um pequeno
// conjunto de formas plausiveis de payload de deals e classifica frame
// binario nao-textual (provavel protobuf) como schema nao reconhecido em vez
// de tentar decodifica-lo. Se o formato real vier diferente do assumido
// aqui, a sonda falha de forma visivel (BLOCKED_BY_SCHEMA ou FAILED via
// probe-ws.js), nunca silenciosamente errado.
//
// connector_id novo (mexc-spot-public-ws-adapter), distinto de
// mexc-public-market-adapter (REST, mexc-public.js) — mesmo espirito de
// binance-public.js ao criar um id novo para um host/transporte diferente:
// REST (request/response) e WebSocket (push persistente) sao conexoes
// estruturalmente diferentes, entradas separadas e honestas.
//
// Escopo deliberadamente estreito: este conector so' produz `ticker` (preco
// do ultimo negocio real, ao vivo). NAO produz `candles` nem `order_book` —
// uma unica sonda de stream de trades nao constroi historico de velas nem
// livro de ofertas, e marcar esses campos como reais seria inventar dado que
// a sonda nao confirmou. Por isso este conector fica FORA de
// NETWORK_CONNECTORS em registry.js (que alimenta a fonte ativa de
// AnalysisFrame/ResearchEngineFrame, os quais esperam candles reais): e' uma
// fonte suplementar de visualizacao ao vivo, sondada separadamente como
// STREAMING_CONNECTORS.

import { probeWebSocketEndpoint } from './probe-ws.js';
import { CONNECTOR_STATES, createEmptyEvidence, markFieldMissing, hashRawSample, computeDataQuality } from './schema.js';

export const meta = Object.freeze({
    connector_id: 'mexc-spot-public-ws-adapter',
    connector_name: 'MEXC Spot Public WebSocket (deals stream)',
    endpoint_kind: 'exchange_public_ws_deals',
    instrument_type: 'crypto_spot',
    requires_api_key: false,
    supports_private_endpoints: false,
});

const SYMBOL_TO_PAIR = Object.freeze({ BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT', XRP: 'XRPUSDT' });

const WS_URL = 'wss://wbs-api.mexc.com/ws';

function extractFirstDeal(payloadContainer) {
    const deals = payloadContainer && Array.isArray(payloadContainer.deals) ? payloadContainer.deals : null;
    if (!deals || deals.length === 0) return null;
    const d = deals[0];
    const price = Number(d.p ?? d.price ?? d.P);
    const qty = Number(d.v ?? d.qty ?? d.q ?? d.V);
    const rawT = d.t ?? d.T ?? d.time;
    if (!Number.isFinite(price)) return null;
    return { price, qty: Number.isFinite(qty) ? qty : null, rawT };
}

function toEpochSeconds(rawT) {
    const n = Number(rawT);
    if (!Number.isFinite(n) || n <= 0) return Math.floor(Date.now() / 1000);
    return n > 1e12 ? Math.round(n / 1000) : Math.round(n);
}

/** Reconhece ack de inscricao ({"id":...,"code":...,"msg":<canal>}) e
 *  keepalive ({"msg":"PONG"} ou equivalente) como controle (nao erro, so'
 *  ainda nao e' o dado) — qualquer outra coisa que nao tenha uma lista
 *  `deals` valida e' schema desconhecido, classificado explicitamente. */
function validateDealsMessage(parsed, channel) {
    if (parsed && typeof parsed === 'object' && 'id' in parsed && 'code' in parsed && !('d' in parsed) && !('data' in parsed)) {
        return { matched: false, control: true };
    }
    if (parsed && (parsed.msg === 'PONG' || parsed.pong !== undefined || parsed.ping !== undefined)) {
        return { matched: false, control: true };
    }
    const container = (parsed && parsed.d) || (parsed && parsed.data) || null;
    const deal = extractFirstDeal(container);
    if (!deal) {
        return { matched: false, reason: 'payload_sem_lista_deals_reconhecivel_ou_sem_preco_numerico' };
    }
    return { matched: true, ...deal, channel };
}

/** @param {{symbol?: string, timeoutMs?: number}} opts `interval`/`limit` de
 *  outros conectores nao se aplicam aqui (canal de deals nao tem timeframe
 *  nem profundidade configuravel) — registry.js chama todo conector de rede
 *  com o mesmo conjunto de opts; os extras sao ignorados sem erro. */
export async function probe({ symbol = 'BTC', timeoutMs = 8000 } = {}) {
    const pair = SYMBOL_TO_PAIR[symbol] || `${symbol}USDT`;
    const channel = `spot@public.deals.v3.api@${pair}`;
    const evidence = createEmptyEvidence({
        source_id: meta.connector_id,
        source_name: meta.connector_name,
        endpoint_kind: meta.endpoint_kind,
        symbol,
        instrument_type: meta.instrument_type,
    });

    const probeResult = await probeWebSocketEndpoint({
        url: WS_URL,
        timeoutMs,
        buildSubscribeMessage: () => ({ method: 'SUBSCRIPTION', params: [channel] }),
        validate: (parsed) => validateDealsMessage(parsed, channel),
    });

    if (probeResult.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        return { state: probeResult.state, evidence, probe_detail: probeResult };
    }

    const deal = probeResult.matched;
    const tEpoch = toEpochSeconds(deal.rawT);

    evidence.timeframe = 'TRADE_BY_TRADE_STREAM';
    evidence.timestamp = new Date(tEpoch * 1000).toISOString();
    evidence.fetched_at = new Date().toISOString();
    evidence.freshness_ms = Date.now() - tEpoch * 1000;
    evidence.ticker = { last_price: deal.price, derived_from: 'WEBSOCKET_PUBLIC_DEALS_STREAM', pair, channel };
    if (deal.qty !== null) {
        evidence.volume = { last_trade_qty: deal.qty, unit: 'base_asset' };
    } else {
        markFieldMissing(evidence, 'volume');
    }
    markFieldMissing(evidence, 'candles'); // sonda de 1 negocio nao constroi historico de velas
    markFieldMissing(evidence, 'order_book'); // canal de deals nao inclui livro de ofertas
    evidence.raw_sample_hash = await hashRawSample(probeResult.raw_text);
    evidence.data_quality = computeDataQuality(evidence);

    return { state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence, probe_detail: probeResult };
}
