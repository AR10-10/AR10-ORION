// tradfi-delayed-yahoo.js — Sonda real de candles TradFi/futuros CME
// (Ordem Market Data Fabric §1/§3/§6/§13/§14). Mesmo padrão de
// binance-futures-public.js: fetch() real via probeJsonEndpoint (nunca
// fetch próprio reimplementado — Regra de Ouro 4), classificado
// honestamente no Connector State Machine (schema.js).
//
// FONTE: endpoint público de gráfico da Yahoo Finance, convenção "=F"
// (contrato contínuo de futuro — ES=F/GC=F/CL=F/...). Não é um produto
// oficial documentado pela Yahoo, mas é estável e amplamente usado há mais
// de uma década por ferramentas de mercado; confirmado nesta sessão via
// WebSearch (inclusive aparecendo literalmente em título de página real da
// Yahoo Finance retornado pela busca). O símbolo Yahoo de cada instrumento
// vem SEMPRE de instrument-registry.js (continuous_symbol_hint) — este
// arquivo nunca monta um símbolo por conta própria.
//
// POR QUE ESTA FONTE (Ordem §13, custo mínimo/Ordem §12, sem login): a CME
// exige distribuidor licenciado (ex. Databento) ou CME Information License
// Agreement para o feed oficial — não há caminho gratuito/self-serve para
// o dado real da CME nesta fase (ver docs/MARKET_DATA_FABRIC.md, achado de
// pesquisa desta mesma sessão). Esta é a alternativa gratuita mais
// confiável encontrada que não exige chave/login, documentada
// honestamente como NÃO-OFICIAL — nunca apresentada como o feed real CME.
//
// DATA_FRESHNESS: sempre DELAYED (ver schema.js). Este endpoint não
// documenta SLA de tempo real nenhum, e a via oficial de tempo real da CME
// é paga — nunca declarar REAL_TIME sem uma fonte que garanta isso por
// contrato (Ordem §3/§13: proibido mascarar/forjar tempo real só para
// satisfazer a exigência de gratuidade).
//
// BLOQUEIO DE REDE DESTA SESSÃO: o sandbox de implementação nega saída
// para query1.finance.yahoo.com — confirmado via
// $HTTPS_PROXY/__agentproxy/status ("connect_rejected", 403 de política),
// mesmo bloqueio observado nesta sessão para cmegroup.com/fapi.binance.com/
// query1.finance.yahoo.com/api.stlouisfed.org/stooq.com. Este conector
// nunca foi executado contra a rede real nesta sessão de implementação —
// mesma limitação já documentada em history-capture.js e nos demais
// conectores públicos deste repositório (mexc-public.js, binance-futures-
// public.js). Verificação real ao vivo fica para um ambiente com saída de
// rede liberada (dispositivo real do Operador).
//
// CORREÇÃO HONESTA (Ordem Mestra, auditoria pós-Fase-1): este mesmo
// repositório já tinha pesquisado exatamente este host antes — ver
// ramber-ui/src/gmil/README.md, "Fontes avaliadas e adiadas": "Yahoo
// Finance (Macro Market) — os endpoints não-oficiais mais usados bloqueiam
// CORS para fetch() de origem arbitrária; exigiria um proxy de backend que
// este projeto (100% estático, GitHub Pages) não tem." WebSearch nesta
// sessão confirmou de forma independente, com múltiplas fontes
// corroborando: query1/query2.finance.yahoo.com não enviam cabeçalho
// Access-Control-Allow-Origin — um problema conhecido e antigo, não uma
// suposição. Ou seja: além do bloqueio de REDE deste sandbox (acima), há
// um segundo bloqueio estrutural, DISTINTO e mais sério, que afeta
// qualquer navegador real rodando este PWA estático: o próprio servidor da
// Yahoo provavelmente rejeita o fetch() por política de CORS, não só esta
// sessão de implementação. A arquitetura Evidence-First já cobre esse
// cenário sem mudança de código nenhuma — probeJsonEndpoint (probe.js)
// classifica isso honestamente como BLOCKED_BY_CORS (nunca finge sucesso,
// nunca fabrica candle) — mas o Relatório de Fase 1 subestimou esse risco
// ao descrevê-lo só como "bloqueio de sandbox". Ver docs/MARKET_DATA_FABRIC.md
// para a correção completa. Nenhuma mudança de código foi necessária aqui:
// o parser abaixo já era deliberadamente defensivo — qualquer formato de
// resposta diferente do esperado falha de forma visível (BLOCKED_BY_SCHEMA),
// nunca finge sucesso nem inventa um candle para "parecer" que funcionou.
import { probeJsonEndpoint } from './probe.js';
import {
    CONNECTOR_STATES, DATA_FRESHNESS, createEmptyEvidence, markFieldMissing, hashRawSample, computeDataQuality,
} from './schema.js';

export const meta = Object.freeze({
    connector_id: 'tradfi-delayed-yahoo-adapter',
    connector_name: 'TradFi Futures Delayed Chart Adapter (Yahoo Finance, não-oficial)',
    endpoint_kind: 'public_delayed_futures_chart',
    instrument_type: 'tradfi_futures',
    requires_api_key: false,
    supports_private_endpoints: false,
    data_freshness: DATA_FRESHNESS.DELAYED,
});

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Apenas os intervalos que este endpoint realmente aceita (documentação
// pública estável da Yahoo chart API). Note a AUSÊNCIA deliberada de '4h':
// a Yahoo não expõe granularidade intraday de 4 horas — um pedido nesse
// timeframe falha fechado com motivo explícito (ver resolveYahooInterval),
// nunca arredonda silenciosamente para '1h' ou '1d' fingindo ser o mesmo
// dado (Ordem §17: nunca aproximar um timeframe não suportado).
const SYSTEM_TIMEFRAME_TO_YAHOO_INTERVAL = Object.freeze({
    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '60m', '1d': '1d', '1w': '1wk',
});

export function resolveYahooInterval(timeframe) {
    return SYSTEM_TIMEFRAME_TO_YAHOO_INTERVAL[timeframe] || null;
}

// Sessão de futuro roda ~23h/5,5 dias por semana (fecha fim de semana e
// feriados) — pedir exatamente limit*intervalo em segundos corridos
// devolveria menos candles reais do que `limit`. A folga abaixo só amplia
// a JANELA pedida à fonte (period1/period2); nunca inventa um candle nem
// garante que `limit` candles realmente existam na resposta.
const SESSION_COVERAGE_SLACK = Object.freeze({ intraday: 2.2, daily: 2.5, weekly: 3 });

function slackFor(intervalSeconds) {
    if (intervalSeconds >= 7 * 86400) return SESSION_COVERAGE_SLACK.weekly;
    if (intervalSeconds >= 86400) return SESSION_COVERAGE_SLACK.daily;
    return SESSION_COVERAGE_SLACK.intraday;
}

const YAHOO_INTERVAL_TO_SECONDS = Object.freeze({
    '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '60m': 3600, '1d': 86400, '1wk': 604800,
});

/** @param {{yahooSymbol: string, yahooInterval: string, limit: number, endTimeMs?: number}} opts */
export function buildChartUrl({ yahooSymbol, yahooInterval, limit, endTimeMs }) {
    const intervalSeconds = YAHOO_INTERVAL_TO_SECONDS[yahooInterval];
    const period2 = Number.isFinite(endTimeMs) ? Math.floor(endTimeMs / 1000) : Math.floor(Date.now() / 1000);
    const span = Math.ceil(limit * intervalSeconds * slackFor(intervalSeconds));
    const period1 = period2 - span;
    const url = new URL(`${CHART_BASE}/${encodeURIComponent(yahooSymbol)}`);
    url.searchParams.set('interval', yahooInterval);
    url.searchParams.set('period1', String(period1));
    url.searchParams.set('period2', String(period2));
    url.searchParams.set('includePrePost', 'false');
    return url.toString();
}

function validateChartShape(json) {
    const result = json && json.chart && Array.isArray(json.chart.result) ? json.chart.result[0] : null;
    if (!result) return { valid: false, reason: 'chart_result_ausente' };
    const timestamps = result.timestamp;
    const quote = result.indicators && Array.isArray(result.indicators.quote) ? result.indicators.quote[0] : null;
    if (!Array.isArray(timestamps) || timestamps.length === 0) return { valid: false, reason: 'timestamp_ausente_ou_vazio' };
    if (!quote || !Array.isArray(quote.open) || !Array.isArray(quote.high) || !Array.isArray(quote.low) || !Array.isArray(quote.close)) {
        return { valid: false, reason: 'quote_ohlc_ausente' };
    }
    return { valid: true };
}

/** Forma columnar da Yahoo (arrays paralelos, `null` nos índices em que o
 *  mercado estava fechado) -> {t,o,h,l,c,v}, mesma forma canônica de
 *  normalizer.js (t em segundos). Linha com qualquer campo OHLC ausente é
 *  descartada, nunca preenchida (Regra de Ouro 1/3). Volume ausente/não-
 *  finito também descarta a linha em vez de fabricar um 0 — mesma
 *  disciplina exata que normalizeCandles() já aplica a todo conector deste
 *  repositório: a forma canônica {t,o,h,l,c,v} não tem espaço para um
 *  sentinela "volume desconhecido" dentro de um campo numérico sem quebrar
 *  todo consumidor a jusante (barras de volume, VWAP, volume relativo) que
 *  assume `v` como número real utilizável — descartar a linha preserva
 *  esse contrato em vez de violá-lo. */
// BUG REAL evitado aqui (achado pelos testes reais desta mesma sessão,
// antes de qualquer graduação): Number(null) === 0 em JavaScript — a
// forma columnar da Yahoo usa null (não undefined) para marcar um índice
// em que o mercado de futuro estava fechado. Number(...) direto converteria
// esse buraco real em zero e Number.isFinite(0) é true, então a linha
// passaria como "candle válido" com preço/volume 0 — exatamente o "zero
// fabricado disfarçado de leitura real" que a Regra de Ouro 3 proíbe.
// toFiniteOrNull rejeita null/undefined ANTES de converter para número.
function toFiniteOrNull(raw) {
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function extractCandles(timestamps, quote) {
    const out = [];
    for (let i = 0; i < timestamps.length; i++) {
        const t = toFiniteOrNull(timestamps[i]);
        const o = toFiniteOrNull(quote.open[i]);
        const h = toFiniteOrNull(quote.high[i]);
        const l = toFiniteOrNull(quote.low[i]);
        const c = toFiniteOrNull(quote.close[i]);
        const v = toFiniteOrNull(Array.isArray(quote.volume) ? quote.volume[i] : undefined);
        if ([t, o, h, l, c, v].some((x) => x === null)) continue;
        out.push({ t, o, h, l, c, v });
    }
    return out;
}

/** @param {{yahooSymbol: string, symbolLabel: string, timeframe: string, limit?: number, timeoutMs?: number, endTimeMs?: number}} opts
 *  yahooSymbol: símbolo contínuo real (ex. 'ES=F'), sempre resolvido pelo
 *  chamador via instrument-registry.js — esta função nunca monta um
 *  símbolo por conta própria.
 *  symbolLabel: identificador interno gravado no Evidence Object
 *  (instrument_id do catálogo, ex. 'CME_ES') — separado de yahooSymbol
 *  porque o Evidence Object identifica o instrumento pelo nosso próprio
 *  vocabulário, nunca pelo símbolo de uma fonte específica (Ordem §11). */
export async function probe({ yahooSymbol, symbolLabel, timeframe, limit = 200, timeoutMs = 8000, endTimeMs } = {}) {
    const evidence = createEmptyEvidence({
        source_id: meta.connector_id,
        source_name: meta.connector_name,
        endpoint_kind: meta.endpoint_kind,
        symbol: symbolLabel,
        instrument_type: meta.instrument_type,
    });

    const yahooInterval = resolveYahooInterval(timeframe);
    if (!yahooInterval) {
        return { state: CONNECTOR_STATES.DADOS_INSUFICIENTES, evidence, reason: `timeframe_nao_suportado_por_esta_fonte:${timeframe}` };
    }
    if (!yahooSymbol) {
        return { state: CONNECTOR_STATES.DADOS_INSUFICIENTES, evidence, reason: 'instrumento_sem_continuous_symbol_hint_nesta_fonte' };
    }

    const url = buildChartUrl({ yahooSymbol, yahooInterval, limit, endTimeMs });
    const chartProbe = await probeJsonEndpoint({ url, timeoutMs, validate: validateChartShape });
    if (chartProbe.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        return { state: chartProbe.state, evidence, reason: chartProbe.reason, probe_detail: chartProbe };
    }

    const result = chartProbe.json.chart.result[0];
    const quote = result.indicators.quote[0];
    const extracted = extractCandles(result.timestamp, quote);
    if (extracted.length === 0) {
        return { state: CONNECTOR_STATES.DADOS_INSUFICIENTES, evidence, reason: 'resposta_valida_porem_sem_nenhum_candle_completo_apos_filtragem' };
    }
    // Diferente da Binance (parâmetro `limit` nativo da API), a Yahoo chart
    // API só aceita period1/period2 — a janela com folga de slackFor() acima
    // tipicamente devolve MAIS candles reais do que `limit` pedido. Corta
    // para os `limit` mais recentes aqui, nunca no chamador, para que o
    // contrato externo (~`limit` candles) valha para qualquer fonte,
    // exatamente como já vale para os conectores irmãos.
    const candles = extracted.length > limit ? extracted.slice(extracted.length - limit) : extracted;
    const last = candles[candles.length - 1];

    evidence.timeframe = timeframe;
    evidence.timestamp = new Date(last.t * 1000).toISOString();
    evidence.fetched_at = new Date().toISOString();
    evidence.freshness_ms = Date.now() - last.t * 1000;
    evidence.candles = candles;
    evidence.ticker = { last_price: last.c, derived_from: 'ULTIMO_CLOSE_DO_CANDLE', yahoo_symbol: yahooSymbol };
    evidence.volume = { last_candle_volume: last.v, unit: 'contratos' };
    evidence.raw_sample_hash = await hashRawSample(chartProbe.raw_text);
    evidence.data_freshness = DATA_FRESHNESS.DELAYED;

    // funding/liquidations/long_short_ratio já nascem NAO_APLICAVEL em
    // createEmptyEvidence (schema.js: STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT.
    // tradfi_futures) — mecânica de perpétuo cripto, estruturalmente
    // impossível num contrato futuro datado da CME. order_book/open_interest
    // SÃO conceitos reais para um futuro CME, só que este endpoint de
    // gráfico não os carrega — ficam DADOS_INSUFICIENTES (honesto: "deveria
    // existir, esta fonte não confirmou"), nunca NAO_APLICAVEL.
    markFieldMissing(evidence, 'order_book');
    markFieldMissing(evidence, 'open_interest');
    evidence.data_quality = computeDataQuality(evidence);

    return { state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence, probe_detail: { chart: chartProbe } };
}
