// orderflow-client.js — wrapper RPC (promise <-> postMessage) para o Web
// Worker do Order Flow Engine. Mantem OFI/Absorption/Exhaustion fora da
// thread principal; a UI so recebe os Signal resultantes.

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

    call(type, payload = {}, timeoutMs = 8000) {
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
            this.worker.postMessage({ id, type, ...payload });
        });
    }

    ping() { return this.call('ping'); }
    init(capacity = 65536) { return this.call('init', { capacity }); }
    ingestTicks(ticks) { return this.call('ingest_ticks', { ticks }); }
    reset() { return this.call('reset'); }
    selfTest() { return this.call('self_test'); }
    terminate() { this.worker.terminate(); }
}
