// worker-client.js — wrapper RPC (promise <-> postMessage) para o Web Worker
// que hospeda o WASM Quant Engine. Mantem o calculo fora da thread principal.

export class QuantWorkerClient {
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

    call(type, payload = {}, timeoutMs = 8000) {
        const id = ++this.seq;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`worker timeout: ${type}`));
            }, timeoutMs);
            this.pending.set(id, {
                resolve: (v) => { clearTimeout(timer); resolve(v); },
                reject: (e) => { clearTimeout(timer); reject(e); },
            });
            this.worker.postMessage({ id, type, ...payload });
        });
    }

    ping() { return this.call('ping'); }
    initWasm() { return this.call('init_wasm'); }
    computeSeries(closes, window = 20) {
        return this.call('compute_series', { closes, window }, 15000);
    }
    selfTest() { return this.call('self_test'); }
    terminate() { this.worker.terminate(); }
}
