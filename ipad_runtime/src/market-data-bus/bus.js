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

    _failedSnapshot(symbol, timeframe, errors) {
        return Object.freeze({ symbol, timeframe, candles: Object.freeze([]), asOf: null, fetchedAt: Date.now(), ageMs: Infinity, ok: false, errors });
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
            try {
                const raw = await collect({ symbol, timeframe, limit: entry.maxLimit });
                const candles = normalizeCandles(raw);
                const verdict = validateCandleSeries(candles);
                if (!verdict.valid) {
                    return entry.snapshot ?? this._failedSnapshot(symbol, timeframe, verdict.errors);
                }

                entry.buffer.setAll(candles);
                const stored = Object.freeze(entry.buffer.toArray());
                const asOf = computeAsOf(stored);
                const snapshot = Object.freeze({
                    symbol,
                    timeframe,
                    candles: stored,
                    asOf,
                    fetchedAt: now,
                    ageMs: computeAgeMs(asOf, now),
                    ok: true,
                });
                entry.snapshot = snapshot;
                entry.subscribers.forEach((cb) => {
                    try { cb(snapshot); } catch { /* um assinante ruim nunca derruba os demais */ }
                });
                return snapshot;
            } catch (err) {
                return entry.snapshot ?? this._failedSnapshot(symbol, timeframe, [`coleta_lancou_excecao:${err?.message || err}`]);
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
