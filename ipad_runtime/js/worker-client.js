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

    call(type, payload = {}, timeoutMs = 8000, transfer = []) {
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
            this.worker.postMessage({ id, type, ...payload }, transfer);
        });
    }

    ping() { return this.call('ping'); }
    initWasm() { return this.call('init_wasm'); }
    computeSeries(closes, window = 20) {
        // Fase I (Zero-Copy, diretriz 3): closes viajam como Float64Array
        // TRANSFERIDO — o quant-worker ja escrevia num Float64Array de
        // qualquer forma (writeBuffer), entao a main thread deixa de clonar
        // um array de numeros por ciclo (30s) e nao deixa lixo para o GC.
        const packed = closes instanceof Float64Array ? closes : Float64Array.from(closes);
        return this.call('compute_series', { closes: packed, window }, 15000, [packed.buffer]);
    }
    selfTest() { return this.call('self_test'); }
    terminate() { this.worker.terminate(); }
}
