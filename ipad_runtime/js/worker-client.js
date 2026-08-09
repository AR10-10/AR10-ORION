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
    computeSeries(closes, window = 20, includeRolling = false) {
        // Fase I (Zero-Copy, diretriz 3): closes viajam como Float64Array
        // TRANSFERIDO — o quant-worker ja escrevia num Float64Array de
        // qualquer forma (writeBuffer), entao a main thread deixa de clonar
        // um array de numeros por ciclo (30s) e nao deixa lixo para o GC.
        // includeRolling (default false): rollingSma/rollingZ so' sao
        // calculados quando um chamador realmente precisar da serie
        // completa — nenhum consumidor real pede isso hoje.
        const packed = closes instanceof Float64Array ? closes : Float64Array.from(closes);
        return this.call('compute_series', { closes: packed, window, includeRolling }, 15000, [packed.buffer]);
    }
    // V-MAX Fase 1.3: Volume Profile real no WASM do worker. Mesmo padrao
    // zero-copy do computeSeries — os tres arrays viajam TRANSFERIDOS.
    computeVolumeProfile(highs, lows, volumes, buckets) {
        const h = highs instanceof Float64Array ? highs : Float64Array.from(highs);
        const l = lows instanceof Float64Array ? lows : Float64Array.from(lows);
        const v = volumes instanceof Float64Array ? volumes : Float64Array.from(volumes);
        return this.call('compute_volume_profile', { highs: h, lows: l, volumes: v, buckets }, 15000, [h.buffer, l.buffer, v.buffer]);
    }
    // V-MAX Fase 2: TrustScore real no WASM (mesmo zero-copy transferido).
    computeTrustScore(gaps, divergences = []) {
        const g = gaps instanceof Float64Array ? gaps : Float64Array.from(gaps);
        const d = divergences instanceof Float64Array ? divergences : Float64Array.from(divergences);
        return this.call('compute_trust_score', { gaps: g, divergences: d }, 15000, [g.buffer, d.buffer]);
    }
    selfTest() { return this.call('self_test'); }
    terminate() {
        for (const [, entry] of this.pending) entry.reject(new Error('worker terminated'));
        this.pending.clear();
        this.worker.terminate();
    }
}
