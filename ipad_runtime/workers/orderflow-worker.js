// orderflow-worker.js — Web Worker dedicado ao Order Flow Engine (Skill 8:
// Actor Model). Mantem RingBuffer + engine state inteiramente dentro do
// seu proprio thread: ticks chegam em lotes via postMessage (lances reais
// vindos de js/real-data/mexc-trades-stream.js na main thread, ou do
// REPLAY local), e so os Signal resultantes (muito mais raros e leves que
// os ticks brutos) voltam para a UI. Isso tira o calculo de OFI/Absorption
// /Exhaustion da main thread sem exigir SharedArrayBuffer compartilhado
// entre threads (ver nota de seguranca em src/orderflow/ring-buffer.js).
//
// FRONTEIRA RIGIDA: este worker nao faz fetch proprio, nao abre WebSocket,
// nao envia ordem. Ele so recebe ticks que a main thread ja coletou de
// fontes publicas read-only e devolve sinais — pura funcao de calculo.

import { Tick, Side } from '../src/orderflow/value-objects.js';
import { RingBuffer } from '../src/orderflow/ring-buffer.js';
import { createEngineState, processSignals, defaultSettings } from '../src/orderflow/signal-engine.js';

let ring = null;
let engineState = null;
let settings = defaultSettings;

function ensureInitialized(capacity) {
    if (!ring) ring = new RingBuffer(capacity || 65536);
    if (!engineState) engineState = createEngineState();
    return ring;
}

function toTick(raw) {
    return new Tick({
        timestamp: raw.timestamp,
        price: raw.price,
        volume: raw.volume,
        side: raw.side === Side.SELL ? Side.SELL : Side.BUY,
        exchange: raw.exchange || 'MEXC',
    });
}

function runSelfTest() {
    const results = [];
    const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: String(detail) });
    const mkTick = (price, volume, side) => ({ price, volume, side, timestamp: Date.now() });

    {
        const state = createEngineState();
        const ticks = [];
        for (let i = 0; i < defaultSettings.ofi.windowSize; i++) ticks.push(mkTick(67000 + i, 2, Side.BUY));
        const ofi = processSignals(ticks, state).filter((s) => s.type === 'OFI');
        check('OFI dispara em janela 100% comprada', ofi.length >= 1 && Math.abs(ofi[0].metadata.imbalance - 1) < 1e-9, ofi.length ? `imbalance=${ofi[0].metadata.imbalance.toFixed(4)}` : 'nenhum sinal');
    }
    {
        const state = createEngineState();
        const lb = defaultSettings.exhaustion.deltaLookback;
        const ticks = [];
        for (let i = 0; i < lb + 50; i++) ticks.push(mkTick(67000, 1, i % 2 ? Side.BUY : Side.SELL));
        for (let i = 0; i < 20; i++) {
            const price = i < 10 ? 67000 : 67000 * (1 - 0.03 * (i - 9));
            ticks.push(mkTick(price, 60, Side.BUY));
        }
        const exh = processSignals(ticks, state).filter((s) => s.type === 'EXHAUSTION');
        check('EXHAUSTION dispara em pico de delta + reversao', exh.length >= 1 && Math.abs(exh[0].metadata.zScore) > defaultSettings.exhaustion.exhaustionThreshold, exh.length ? `zScore=${exh[0].metadata.zScore.toFixed(2)}` : 'nenhum sinal');
    }
    {
        const rb = new RingBuffer(8);
        for (let i = 0; i < 5; i++) rb.enqueue(toTick(mkTick(100 + i, 1, Side.BUY)));
        const drained = rb.drain();
        check('RingBuffer round-trip dentro do worker', drained.length === 5 && drained[0].price === 100, `drained=${drained.length}`);
    }

    const pass = results.every((r) => r.pass);
    return { pass, results };
}

self.onmessage = (ev) => {
    const { id, type } = ev.data || {};
    try {
        if (type === 'ping') {
            self.postMessage({ id, type: 'pong', ts: Date.now() });
            return;
        }

        if (type === 'init') {
            const { capacity } = ev.data;
            ensureInitialized(capacity);
            self.postMessage({ id, type: 'init_ok', capacity: ring.capacity, useSAB: ring.useSAB });
            return;
        }

        if (type === 'ingest_ticks') {
            ensureInitialized();
            const { ticks: rawTicks } = ev.data;
            for (const raw of rawTicks || []) ring.enqueue(toTick(raw));
            const drained = ring.drain();
            const signals = processSignals(drained, engineState, settings);
            self.postMessage({
                id,
                type: 'ingest_ticks_result',
                ingested: drained.length,
                signals: signals.map((s) => ({ type: s.type, confidence: s.confidence, price: s.price, timestamp: s.timestamp, metadata: s.metadata })),
            });
            return;
        }

        if (type === 'reset') {
            ring = new RingBuffer((ring && ring.capacity) || 65536);
            engineState = createEngineState();
            self.postMessage({ id, type: 'reset_ok' });
            return;
        }

        if (type === 'self_test') {
            self.postMessage({ id, type: 'self_test_result', ...runSelfTest() });
            return;
        }

        self.postMessage({ id, type: 'error', error: `unknown message type: ${type}` });
    } catch (err) {
        self.postMessage({ id, type: 'error', error: String((err && err.message) || err) });
    }
};
