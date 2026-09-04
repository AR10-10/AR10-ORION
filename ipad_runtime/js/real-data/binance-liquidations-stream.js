// binance-liquidations-stream.js — Conector real de liquidacoes forcadas
// (Binance USDT-M Futures, publico, sem chave). Liquidacao forcada e' um
// evento discreto (nao uma foto de mercado), Binance nao expõe um REST
// equivalente para o stream agregado de todos os simbolos. Por isso este
// conector, ao contrario de mexc-trades-stream.js (REST polling), usa uma
// conexao persistente com reconexao/backoff — o mesmo padrao ja usado por
// ramber-ui/src/App.tsx para o ticker/depth de preco, so que aqui
// encapsulado como modulo reusavel (a diferenca com mexc-trades-stream.js
// nao e' filosofica, e' que aquele dado real tem uma forma de poll e este
// nao).
//
// 'liquidations' ja e' um EVIDENCE_DATA_FIELDS reconhecido em schema.js
// (NAO_APLICAVEL para spot, DADOS_INSUFICIENTES para futures ate' um
// conector real preencher) — este arquivo e' esse conector.
//
// MIGRACAO REAL (pesquisada, nao suposta — auditoria "carta branca",
// 2026-09-02): a Binance anunciou em 2026-03-06 uma reestruturacao das
// URLs de WebSocket de USDS-M Futures em 3 categorias (/public, /market,
// /private), com as URLs legadas (wss://fstream.binance.com/ws/... e
// /stream?streams=... SEM a categoria no caminho) descomissionadas em
// 2026-04-23 — data ja passada. `!forceOrder@arr` pertence a categoria
// /market. A URL antiga usada aqui (wss://fstream.binance.com/ws/
// !forceOrder@arr) parou de entregar dado nessa data — o feed real deste
// app ficou silenciosamente morto por ~4 meses (fail-closed real: o
// conector nunca fabricou um evento, so parou de receber; o painel
// "Forced Liquidations"/o heatmap real simplesmente ficaram vazios sem
// erro visivel). URL corrigida para o novo formato /market/stream?streams=
// (combinado — a mesma forma que ramber-ui/src/App.tsx e
// nexus/cross-exchange-service.ts ja usam para outros streams Binance,
// zero padrao novo), que embrulha cada mensagem em { stream, data } —
// startLiquidationStream desembrulha antes de chamar parseLiquidationMessage,
// que continua puro e recebendo exatamente a forma de sempre (o payload
// 'data' interno, nunca o envelope). NAO verificado contra uma conexao ao
// vivo nesta sessao (mesma barreira de rede/zero egress de sempre) — o
// formato do payload interno 'forceOrder' em si (documentado
// publicamente, estavel ha anos) nao muda com esta reestruturacao, so o
// endereco e o envelope externo.
//
// Honestidade de plataforma: o formato exato da mensagem 'forceOrder' NAO
// foi reverificado ao vivo nesta sessao (mesma barreira de rede do sandbox
// documentada em mexc-trades-stream.js). O formato assumido abaixo e' o
// documentado publicamente pela Binance (estavel ha' anos): { e:
// 'forceOrder', o: { s, S, q, p, ap, z, T } }. Se a forma real divergir,
// parseLiquidationMessage retorna null (evento descartado, nunca inventado)
// em vez de arriscar um campo fabricado.

import { CONNECTOR_STATES } from './schema.js';

export const meta = Object.freeze({
    connector_id: 'binance-futures-liquidations-stream',
    connector_name: 'Binance USDT-M Futures Force Order Stream (todos os simbolos)',
    endpoint_kind: 'exchange_public_liquidations',
    instrument_type: 'crypto_futures',
    requires_api_key: false,
    supports_private_endpoints: false,
});

export const LiquidationSide = Object.freeze({
    LONG_LIQUIDATED: 'LONG_LIQUIDATED',
    SHORT_LIQUIDATED: 'SHORT_LIQUIDATED',
});

// URL real pos-migracao (ver header): !forceOrder@arr pertence a categoria
// /market. Formato combinado ?streams= (mesmo padrao ja usado por
// ramber-ui/src/App.tsx e nexus/cross-exchange-service.ts para outros
// streams Binance) — o nome do stream some do PATH e aparece no
// query param + no envelope {stream, data} de cada mensagem.
const LIQUIDATIONS_WS_URL = 'wss://fstream.binance.com/market/stream?streams=!forceOrder@arr';

/** Mapeia uma mensagem crua 'forceOrder' para um evento real de liquidacao,
 *  ou null se a forma nao bater com o documentado (fail-closed, nunca um
 *  campo inventado). Funcao pura — testavel offline. `S: 'SELL'` no lado
 *  da ordem forcada significa que uma posicao LONG foi liquidada (a
 *  corretora vendeu a forca); `S: 'BUY'` significa SHORT liquidado. */
export function parseLiquidationMessage(raw) {
    if (!raw || raw.e !== 'forceOrder' || !raw.o || typeof raw.o !== 'object') return null;
    const o = raw.o;
    if (typeof o.s !== 'string' || (o.S !== 'SELL' && o.S !== 'BUY')) return null;
    const price = Number(o.ap || o.p);
    const qty = Number(o.z || o.q);
    const timestamp = Number(o.T || raw.E);
    if (!Number.isFinite(price) || !Number.isFinite(qty) || !Number.isFinite(timestamp)) return null;
    return {
        symbol: o.s,
        side: o.S === 'SELL' ? LiquidationSide.LONG_LIQUIDATED : LiquidationSide.SHORT_LIQUIDATED,
        price,
        qty,
        notionalUsd: price * qty,
        timestamp,
    };
}

/** Abre o stream real de liquidacoes (todos os simbolos) com
 *  reconexao/backoff (1s -> 15s, reset no open — mesmo padrao do WS de
 *  preco). onEvent recebe cada LiquidationEvent real ja' acima de
 *  minNotionalUsd (filtro de tamanho, nao de fabricacao — todo evento
 *  emitido veio de uma mensagem real do exchange). onState reporta
 *  CONNECTOR_STATES.ACTIVE_READ_ONLY/FAILED a cada mudanca real de estado
 *  da conexao. Retorna stop(). */
export function startLiquidationStream({ onEvent, onState, minNotionalUsd = 50000 }) {
    let ws = null;
    let reconnectTimer = null;
    let reconnectDelayMs = 1000;
    let stopped = false;

    const connect = () => {
        if (stopped) return;
        ws = new WebSocket(LIQUIDATIONS_WS_URL);
        ws.onopen = () => {
            // Mesma guarda ja usada em onclose logo abaixo: se stop() rodou
            // enquanto esta conexao ainda estava CONNECTING (corrida real de
            // rede), o navegador pode entregar um onopen tardio mesmo depois
            // do close() que stop() ja disparou — sem isto, o estado
            // ACTIVE_READ_ONLY seria reportado para uma stream que o
            // chamador ja mandou parar.
            if (stopped) return;
            reconnectDelayMs = 1000;
            onState?.(CONNECTOR_STATES.ACTIVE_READ_ONLY);
        };
        ws.onclose = () => {
            if (stopped) return;
            onState?.(CONNECTOR_STATES.FAILED, 'conexao_fechada');
            reconnectTimer = setTimeout(connect, reconnectDelayMs);
            reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15000);
        };
        ws.onerror = () => ws?.close();
        ws.onmessage = (event) => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch {
                return;
            }
            // Formato combinado (?streams=): cada mensagem chega embrulhada
            // em { stream, data } — mesmo desembrulho que App.tsx ja faz
            // pro ticker/depth. parseLiquidationMessage continua recebendo
            // exatamente a forma de sempre (o payload 'forceOrder' interno),
            // nunca o envelope.
            const raw = msg && typeof msg === 'object' && 'data' in msg ? msg.data : msg;
            const parsed = parseLiquidationMessage(raw);
            if (parsed && parsed.notionalUsd >= minNotionalUsd) onEvent?.(parsed);
        };
    };
    connect();

    return () => {
        stopped = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        ws?.close();
    };
}
