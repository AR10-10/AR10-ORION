// quant-worker.js — Web Worker dedicado: carrega o WASM Quant Engine e
// executa indicadores (SMA/EMA/STDDEV/Z-SCORE) fora da thread principal.
//
// FRONTEIRA RIGIDA: este worker nao tem acesso de rede util (sem fetch para
// fora da origem por CSP), nao envia ordens, nao fala com corretora alguma.
// Ele so calcula estatistica descritiva sobre numeros que o app principal
// fornece (replay local ou dados importados do pacote).

let exportsRef = null;
let memoryRef = null;

async function loadWasm() {
    if (exportsRef) return exportsRef;
    const wasmUrl = new URL('../wasm/cyborg_quant_core.wasm', import.meta.url);
    let bytes;
    try {
        const resp = await fetch(wasmUrl);
        if (!resp.ok) throw new Error(`fetch wasm HTTP ${resp.status}`);
        try {
            const { instance } = await WebAssembly.instantiateStreaming(resp.clone(), {});
            exportsRef = instance.exports;
        } catch {
            bytes = await resp.arrayBuffer();
            const { instance } = await WebAssembly.instantiate(bytes, {});
            exportsRef = instance.exports;
        }
    } catch (err) {
        throw new Error(`wasm load failed: ${err.message || err}`);
    }
    memoryRef = exportsRef.memory;
    return exportsRef;
}

function writeBuffer(closes) {
    const cap = exportsRef.buffer_capacity();
    const len = Math.min(closes.length, cap);
    const ptr = exportsRef.buffer_ptr();
    const view = new Float64Array(memoryRef.buffer, ptr, cap);
    for (let i = 0; i < len; i++) view[i] = closes[i];
    return len;
}

self.onmessage = async (ev) => {
    const { id, type } = ev.data || {};
    try {
        if (type === 'ping') {
            self.postMessage({ id, type: 'pong', ts: Date.now() });
            return;
        }

        if (type === 'init_wasm') {
            const e = await loadWasm();
            self.postMessage({
                id,
                type: 'init_wasm_ok',
                exportNames: Object.keys(e),
                version: e.engine_version(),
                capacity: e.buffer_capacity(),
            });
            return;
        }

        if (type === 'self_test') {
            const e = await loadWasm();
            const sample = [100, 102, 101, 105, 110, 108, 112, 115, 111, 109];
            writeBuffer(sample);
            const result = {
                sma: e.sma(sample.length, 5),
                ema: e.ema(sample.length, 5),
                stddev: e.stddev(sample.length),
                zscore: e.zscore_last(sample.length),
                failClosedNaN: e.sma(0, 5),
            };
            const pass = Number.isFinite(result.sma) && Number.isFinite(result.ema)
                && Number.isFinite(result.stddev) && Number.isNaN(result.failClosedNaN);
            self.postMessage({ id, type: 'self_test_result', pass, result });
            return;
        }

        if (type === 'compute_series') {
            const e = await loadWasm();
            const { closes, window } = ev.data;
            const len = writeBuffer(closes);
            const rollingSma = [];
            const rollingZ = [];
            for (let i = window; i <= len; i++) {
                rollingSma.push(e.sma(i, window));
                rollingZ.push(e.zscore_last(i));
            }
            const result = {
                len,
                window,
                sma: e.sma(len, window),
                ema: e.ema(len, window),
                stddev: e.stddev(len),
                zscoreLast: e.zscore_last(len),
                max: e.max_val(len),
                min: e.min_val(len),
                rollingSma,
                rollingZ,
                engineVersion: e.engine_version(),
            };
            self.postMessage({ id, type: 'compute_series_result', result });
            return;
        }

        self.postMessage({ id, type: 'error', error: `unknown message type: ${type}` });
    } catch (err) {
        self.postMessage({ id, type: 'error', error: String(err && err.message || err) });
    }
};
