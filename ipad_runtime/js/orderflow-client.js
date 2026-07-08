// orderflow-client.js — wrapper RPC (promise <-> postMessage) para o Web
// Worker do Order Flow Engine. Mantem OFI/Absorption/Exhaustion fora da
// thread principal; a UI so recebe os Signal resultantes.
//
// Fase I (Zero-Copy, diretriz 3): ingestTicks empacota o lote num
// Float64Array e TRANSFERE o buffer (lista de transferencia do
// postMessage) — zero copia, zero objetos deixados para o GC da main
// thread a cada poll de ~4s. Ver js/orderflow-tick-codec.js.

import { packTicks } from './orderflow-tick-codec.js';

export class OrderflowWorkerClient {
    constructor(workerUrl) {
        this.worker = new Worker(workerUrl, { type: 'module' });
        this.pending = new Map();
        this.seq = 0;
        this.worker.onmessage = (ev) => {
            const { id, ...rest } = ev.data || {};
            const entry = this.pending.get(id);
            if (!entry) return;
            this.pending.delete(id);
            entry.resolve(rest);
        };
        this.worker.onerror = (err) => {
            for (const [, entry] of this.pending) entry.reject(err);
            this.pending.clear();
        };
    }

    call(type, payload = {}, timeoutMs = 8000, transfer = []) {
        const id = ++this.seq;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`orderflow worker timeout: ${type}`));
            }, timeoutMs);
            this.pending.set(id, {
                resolve: (v) => { clearTimeout(timer); resolve(v); },
                reject: (e) => { clearTimeout(timer); reject(e); },
            });
            this.worker.postMessage({ id, type, ...payload }, transfer);
        });
    }

    ping() { return this.call('ping'); }
    init(capacity = 65536) { return this.call('init', { capacity }); }
    ingestTicks(ticks) {
        // Fase I: 1 buffer transferido em vez de N objetos clonados.
        const packed = packTicks(ticks);
        return this.call('ingest_ticks', { packed }, 8000, [packed.buffer]);
    }
    reset() { return this.call('reset'); }
    selfTest() { return this.call('self_test'); }
    terminate() { this.worker.terminate(); }
}
