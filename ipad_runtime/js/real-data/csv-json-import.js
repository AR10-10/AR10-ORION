// csv-json-import.js — Conector local de importacao CSV/JSON real (SEM REDE).
// O usuario escolhe um arquivo local (<input type=file>); este modulo le com
// FileReader/File.text(), nunca fetch/XHR. Dado real fornecido pelo proprio
// usuario, explicitamente distinto do replay sintetico offline
// (data/btcusdt_replay.json) — nunca tratado como sintetico, nunca
// re-rotulado como "fonte ao vivo" alem do que o arquivo de fato contem.
// connector_id reaproveita `custom-csv-import-route` de
// connector-registry.default.json.

import { CONNECTOR_STATES, createEmptyEvidence, markFieldMissing, hashRawSample, computeDataQuality, DADOS_INSUFICIENTES } from './schema.js';

export const meta = Object.freeze({
    connector_id: 'custom-csv-import-route',
    connector_name: 'Importacao Local CSV/JSON (sem rede)',
    endpoint_kind: 'local_file_import',
    instrument_type: 'imported_series',
    requires_api_key: false,
    supports_private_endpoints: false,
});

// CSV minimo, sem suporte a aspas/escape — formato esperado: cabecalho
// "t,o,h,l,c" (v opcional), uma linha por candle, t em segundos epoch (mesma
// convencao de data/btcusdt_replay.json).
function parseCsv(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { ok: false, reason: 'csv_sem_linhas_de_dado_apos_o_cabecalho' };
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const idx = { t: header.indexOf('t'), o: header.indexOf('o'), h: header.indexOf('h'), l: header.indexOf('l'), c: header.indexOf('c'), v: header.indexOf('v') };
    if (idx.t < 0 || idx.o < 0 || idx.h < 0 || idx.l < 0 || idx.c < 0) {
        return { ok: false, reason: 'cabecalho_csv_precisa_das_colunas_t,o,h,l,c_(v_opcional)' };
    }
    const candles = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const t = Number(cols[idx.t]); const o = Number(cols[idx.o]); const h = Number(cols[idx.h]); const l = Number(cols[idx.l]); const c = Number(cols[idx.c]);
        if (![t, o, h, l, c].every(Number.isFinite)) return { ok: false, reason: `linha_${i + 1}_com_valor_nao_numerico` };
        const v = idx.v >= 0 ? Number(cols[idx.v]) : null;
        candles.push(Number.isFinite(v) ? { t, o, h, l, c, v } : { t, o, h, l, c });
    }
    return { ok: true, candles };
}

// JSON aceito: array de {t,o,h,l,c,v?} OU objeto {symbol?, instrument_type?,
// timeframe?, candles:[...]} — mesmo shape de candle de data/btcusdt_replay.json.
function parseJsonCandles(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, reason: 'json_invalido' };
    }
    const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.candles) ? parsed.candles : null);
    if (!list) return { ok: false, reason: 'json_precisa_ser_array_de_candles_ou_objeto_com_campo_candles' };
    const candles = [];
    for (let i = 0; i < list.length; i++) {
        const row = list[i] || {};
        const t = Number(row.t); const o = Number(row.o); const h = Number(row.h); const l = Number(row.l); const c = Number(row.c);
        if (![t, o, h, l, c].every(Number.isFinite)) return { ok: false, reason: `item_${i}_sem_os_campos_numericos_t,o,h,l,c` };
        const v = row.v != null ? Number(row.v) : null;
        candles.push(Number.isFinite(v) ? { t, o, h, l, c, v } : { t, o, h, l, c });
    }
    const wrapper = Array.isArray(parsed) ? {} : parsed;
    return { ok: true, candles, symbol: wrapper.symbol, instrument_type: wrapper.instrument_type, timeframe: wrapper.timeframe };
}

/** @param {{file: File, symbol?: string}} opts — `file` vem so de escolha explicita do usuario num <input type=file>. */
export async function probe({ file, symbol = 'IMPORTADO' } = {}) {
    const evidence = createEmptyEvidence({
        source_id: meta.connector_id,
        source_name: meta.connector_name,
        endpoint_kind: meta.endpoint_kind,
        symbol,
        instrument_type: meta.instrument_type,
    });

    if (!file) {
        return { state: CONNECTOR_STATES.DADOS_INSUFICIENTES, evidence, probe_detail: { reason: 'nenhum_arquivo_selecionado' } };
    }

    let text;
    try {
        text = await file.text();
    } catch {
        return { state: CONNECTOR_STATES.BLOCKED_BY_SCHEMA, evidence, probe_detail: { reason: 'arquivo_ilegivel' } };
    }

    const looksJson = /\.json$/i.test(file.name) || text.trim().startsWith('{') || text.trim().startsWith('[');
    const parsedResult = looksJson ? parseJsonCandles(text) : parseCsv(text);

    if (!parsedResult.ok || !parsedResult.candles || parsedResult.candles.length === 0) {
        return { state: CONNECTOR_STATES.BLOCKED_BY_SCHEMA, evidence, probe_detail: { reason: parsedResult.reason || 'nenhum_candle_extraido_do_arquivo' } };
    }

    const candles = parsedResult.candles.slice().sort((a, b) => a.t - b.t);
    const last = candles[candles.length - 1];

    evidence.symbol = parsedResult.symbol || symbol;
    evidence.timeframe = parsedResult.timeframe || DADOS_INSUFICIENTES;
    evidence.timestamp = new Date(last.t * 1000).toISOString();
    evidence.fetched_at = new Date().toISOString();
    evidence.freshness_ms = Date.now() - last.t * 1000;
    evidence.candles = candles;
    evidence.ticker = { last_price: last.c, derived_from: 'ULTIMO_CLOSE_DO_ARQUIVO_IMPORTADO' };
    if (candles.every((cd) => cd.v != null && Number.isFinite(cd.v))) {
        evidence.volume = { last_candle_volume: last.v, unit: 'conforme_arquivo_importado_pelo_usuario' };
    } else {
        markFieldMissing(evidence, 'volume');
    }
    evidence.raw_sample_hash = await hashRawSample(text);
    evidence.data_quality = computeDataQuality(evidence);

    return {
        state: CONNECTOR_STATES.ACTIVE_READ_ONLY,
        evidence,
        probe_detail: { reason: 'import_local_validado', file_name: file.name, candle_count: candles.length },
    };
}
