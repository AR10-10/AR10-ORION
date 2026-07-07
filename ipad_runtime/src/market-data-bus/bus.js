// bus.js — Market Data Bus (Fase B / V15 Cap. 2, Constituição, Capítulo 20
// Roadmap Fase B). Barramento único: todo consumidor de candles (ciclo de
// análise 15m, contexto HTF 1h, gráfico da UI) pede o MESMO snapshot por
// symbol:timeframe em vez de cada um rodar sua própria sonda de rede.
//
// Pipeline obrigatório por requestSnapshot(): Coleta (collect, injetado
// pelo chamador — nunca hardcoded aqui, o Bus fica agnóstico de exchange) ->
// Normalização (normalizer.js) -> Validação (integrity-validator.js) ->
// Sincronização Temporal (time-synchronizer.js) -> Distribuição (snapshot
// cacheado + subscribe()).
//
// Deduplicação real: duas chamadas concorrentes para a mesma chave
// symbol:timeframe (ex.: o ciclo de análise e o gráfico, ambos pedindo
// BTC:15m dentro da mesma janela de 30s) compartilham a MESMA promise em
// voo — nunca disparam uma segunda sonda de rede redundante. Isso substitui
// diretamente a duplicação real encontrada na Fase A: App.tsx e
// engine-bridge.ts sondavam klines de BTC/15m de forma independente e
// simultânea.
//
// Fail-closed: se a coleta falhar E já existir um snapshot anterior válido
// para a chave, o Bus devolve o último snapshot real conhecido (nunca um
// valor fabricado) e marca `ok` do resultado da tentativa como falho só
// quando não há NENHUM snapshot anterior para cair de volta.
import { CandleRingBuffer } from './candle-ring-buffer.js';
import { normalizeCandles } from './normalizer.js';
import { validateCandleSeries } from './integrity-validator.js';
import { computeAsOf, computeAgeMs, isStale } from './time-synchronizer.js';
import { QualityMonitor } from './quality-monitor.js';
import { PipelineTelemetry } from './pipeline-telemetry.js';

const DEFAULT_MAX_AGE_MS = 25_000;
const DEFAULT_CAPACITY = 200;

function sliceSnapshot(snapshot, limit) {
    if (!snapshot || !snapshot.ok) return snapshot;
    if (!Number.isFinite(limit) || limit >= snapshot.candles.length) return snapshot;
    return Object.freeze({ ...snapshot, candles: Object.freeze(snapshot.candles.slice(-limit)) });
}

export class MarketDataBus {
    constructor() {
        this._entries = new Map();
        // Fase C (Data Quality Layer): toda tentativa real de coleta é
        // medida aqui — o monitor não tem timer próprio, a cadência de
        // medição é a cadência real do Bus.
        this._quality = new QualityMonitor();
        // Estabilização (Prioridade 2): telemetria real por etapa do
        // pipeline (ver pipeline-telemetry.js) — mesma cadência do Bus,
        // mesma regra de "nunca fabricar": só registra o que de fato
        // aconteceu numa tentativa real de coleta.
        this._telemetry = new PipelineTelemetry();
    }

    _keyOf(symbol, timeframe) {
        return `${symbol}:${timeframe}`;
    }

    _entryFor(key, capacity) {
        let entry = this._entries.get(key);
        if (!entry) {
            entry = {
                buffer: new CandleRingBuffer(capacity),
                snapshot: null,
                inFlight: null,
                maxLimit: 0,
                subscribers: new Set(),
            };
            this._entries.set(key, entry);
        }
        return entry;
    }

    _failedSnapshot(symbol, timeframe, errors, quality = null) {
        return Object.freeze({ symbol, timeframe, candles: Object.freeze([]), asOf: null, fetchedAt: Date.now(), ageMs: Infinity, ok: false, errors, quality });
    }

    /** Resultado de uma tentativa que NÃO produziu série nova válida.
     *  Fail-closed igual à Fase B (último snapshot bom > nada; nada
     *  fabricado), mas o campo quality é sempre o ATUAL — o operador vê a
     *  fonte degradando mesmo enquanto os candles exibidos continuam sendo
     *  os últimos reais conhecidos. */
    _degradedResult(entry, symbol, timeframe, errors) {
        const quality = this._quality.reportFor(this._keyOf(symbol, timeframe));
        if (entry.snapshot) {
            entry.snapshot = Object.freeze({ ...entry.snapshot, quality });
            return entry.snapshot;
        }
        return this._failedSnapshot(symbol, timeframe, errors, quality);
    }

    /** Relatório de qualidade atual da fonte desta chave (Fase C) — score,
     *  peso estatístico derivado, classificação e as 4 dimensões. Não
     *  dispara coleta nenhuma. */
    getQualityReport(symbol, timeframe) {
        return this._quality.reportFor(this._keyOf(symbol, timeframe));
    }

    /** Telemetria real por etapa (Recebido/Normalizado/Validado/
     *  Sincronizado/Distribuído) da tentativa de coleta mais recente para
     *  symbol:timeframe — Estabilização Prioridade 2. null se esta chave
     *  nunca disparou uma coleta real (sempre serviu de cache, ou nunca foi
     *  pedida). Não dispara coleta nenhuma. */
    getPipelineTelemetry(symbol, timeframe) {
        return this._telemetry.reportFor(this._keyOf(symbol, timeframe));
    }

    /** Distribuição por push: cada callback recebe todo snapshot novo real
     *  publicado para esta symbol:timeframe (nunca um snapshot com falha —
     *  ver requestSnapshot). Retorna a função de cancelamento. */
    subscribe(symbol, timeframe, callback) {
        const entry = this._entryFor(this._keyOf(symbol, timeframe), DEFAULT_CAPACITY);
        entry.subscribers.add(callback);
        return () => entry.subscribers.delete(callback);
    }

    /** Snapshot cacheado mais recente para symbol:timeframe, sem disparar
     *  nenhuma coleta nova. null se esta chave nunca foi pedida antes. */
    getSnapshot(symbol, timeframe) {
        return this._entries.get(this._keyOf(symbol, timeframe))?.snapshot ?? null;
    }

    /** @param {{symbol:string, timeframe:string, limit:number,
     *   collect: (opts:{symbol:string,timeframe:string,limit:number}) => Promise<any[]>,
     *   maxAgeMs?: number, capacity?: number}} opts */
    async requestSnapshot({ symbol, timeframe, limit, collect, maxAgeMs = DEFAULT_MAX_AGE_MS, capacity = DEFAULT_CAPACITY }) {
        const key = this._keyOf(symbol, timeframe);
        const entry = this._entryFor(key, capacity);
        entry.maxLimit = Math.max(entry.maxLimit, limit);

        const now = Date.now();
        const fresh = entry.snapshot
            && entry.snapshot.ok
            && entry.snapshot.candles.length >= limit
            && !isStale(computeAgeMs(entry.snapshot.asOf, now), maxAgeMs);
        if (fresh) return sliceSnapshot(entry.snapshot, limit);

        if (entry.inFlight) return entry.inFlight.then((snap) => sliceSnapshot(snap, limit));

        entry.inFlight = (async () => {
            // Fase C: latência real desta coleta, medida em volta do await
            // do collect() — a única rede que existe neste caminho.
            const startedAt = Date.now();
            // Estabilização (Prioridade 2): abre uma tentativa real de
            // telemetria por etapa — stageInProgress rastreia qual das 5
            // etapas (ver pipeline-telemetry.js) está rodando agora, para
            // que uma exceção inesperada em QUALQUER uma delas (não só a
            // coleta) seja atribuída à etapa certa no catch abaixo.
            this._telemetry.begin(key);
            let stageInProgress = 'recebido';
            try {
                const raw = await collect({ symbol, timeframe, limit: entry.maxLimit });
                this._telemetry.mark(key, 'recebido', true);

                stageInProgress = 'normalizado';
                const candles = normalizeCandles(raw);
                this._telemetry.mark(key, 'normalizado', true);

                stageInProgress = 'validado';
                const verdict = validateCandleSeries(candles);
                if (!verdict.valid) {
                    // Série corrompida = falha de qualidade da fonte, igual
                    // a uma exceção de rede (pediu-se dado real, não veio
                    // dado utilizável).
                    this._telemetry.mark(key, 'validado', false, {
                        component: 'integrity-validator.js',
                        reason: verdict.errors?.[0] || 'serie_invalida',
                    });
                    this._quality.recordFailure(key);
                    const degraded = this._degradedResult(entry, symbol, timeframe, verdict.errors);
                    if (degraded.ok) this._telemetry.markRecovered(key);
                    return degraded;
                }
                this._telemetry.mark(key, 'validado', true);
                this._quality.recordSuccess(key, Date.now() - startedAt, candles, timeframe);

                entry.buffer.setAll(candles);
                const stored = Object.freeze(entry.buffer.toArray());
                const asOf = computeAsOf(stored);

                stageInProgress = 'sincronizado';
                const ageMs = computeAgeMs(asOf, now);
                this._telemetry.mark(key, 'sincronizado', true);

                stageInProgress = 'distribuido';
                const snapshot = Object.freeze({
                    symbol,
                    timeframe,
                    candles: stored,
                    asOf,
                    fetchedAt: now,
                    ageMs,
                    ok: true,
                    // Distribuição (Fase C): todo snapshot publicado carrega
                    // o relatório de qualidade da fonte que o produziu.
                    quality: this._quality.reportFor(key),
                });
                entry.snapshot = snapshot;
                entry.subscribers.forEach((cb) => {
                    try { cb(snapshot); } catch { /* um assinante ruim nunca derruba os demais */ }
                });
                this._telemetry.mark(key, 'distribuido', true);
                return snapshot;
            } catch (err) {
                this._quality.recordFailure(key);
                const reason = `${stageInProgress}_lancou_excecao:${err?.message || err}`;
                this._telemetry.mark(key, stageInProgress, false, {
                    component: stageInProgress === 'recebido' ? 'collect (conector injetado pelo chamador)' : `bus.js:${stageInProgress}`,
                    reason,
                });
                const degraded = this._degradedResult(entry, symbol, timeframe, [reason]);
                if (degraded.ok) this._telemetry.markRecovered(key);
                return degraded;
            } finally {
                entry.inFlight = null;
            }
        })();

        return entry.inFlight.then((snap) => sliceSnapshot(snap, limit));
    }
}

let singleton = null;

/** Singleton por página — mesma instância para engine-bridge.ts e App.tsx,
 *  para que a deduplicação de chamadas concorrentes funcione de verdade
 *  entre os dois consumidores. */
export function getMarketDataBus() {
    if (!singleton) singleton = new MarketDataBus();
    return singleton;
}
