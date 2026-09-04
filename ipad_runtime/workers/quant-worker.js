// quant-worker.js — Web Worker dedicado: carrega o WASM Quant Engine e
// executa indicadores (SMA/EMA/STDDEV/Z-SCORE) fora da thread principal.
//
// FRONTEIRA RIGIDA: este worker nao tem acesso de rede util (sem fetch para
// fora da origem por CSP), nao envia ordens, nao fala com corretora alguma.
// Ele so calcula estatistica descritiva sobre numeros que o app principal
// fornece — desde a Fase B (V15), exclusivamente closes de candles reais
// normalizados/validados e distribuidos pelo Market Data Bus
// (src/market-data-bus/); a mencao antiga a "replay local/dados do pacote"
// descrevia caminhos da arvore vanilla ja removida (Fase G, purge de
// residuo de mock data — correcao de comentario, zero mudanca de codigo).

let exportsRef = null;
let memoryRef = null;
let loadedVariant = null;

// Fase I (V15 Cap. 16.2, diretriz 4): sonda canonica de suporte a SIMD —
// um modulo wasm minimo contendo uma instrucao v128 (i8x16.splat).
// WebAssembly.validate responde true so quando o runtime aceita SIMD; em
// Safari antigo responde false e o worker nem tenta o binario SIMD.
const SIMD_PROBE = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3,
    2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 26, 11,
]);

function simdSupported() {
    try {
        return typeof WebAssembly.validate === 'function' && WebAssembly.validate(SIMD_PROBE);
    } catch {
        return false;
    }
}

async function instantiate(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch wasm HTTP ${resp.status}`);
    try {
        const { instance } = await WebAssembly.instantiateStreaming(resp.clone(), {});
        return instance.exports;
    } catch {
        const bytes = await resp.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(bytes, {});
        return instance.exports;
    }
}

// Fallback SILENCIOSO (diretriz 4 da Fase I): tenta o binario SIMD apenas
// quando a sonda aprova; QUALQUER falha nele (404, rede, validacao) cai
// para o escalar sem erro visivel — o escalar e o mesmo caminho de sempre,
// validado pela rede numerica da Fase G. Nenhuma degradacao de
// estabilidade: o pior caso e identico ao comportamento pre-Fase I.
async function loadWasm() {
    if (exportsRef) return exportsRef;
    const candidates = simdSupported()
        ? [
            { url: new URL('../wasm/cyborg_quant_core_simd.wasm', import.meta.url), variant: 'simd128' },
            { url: new URL('../wasm/cyborg_quant_core.wasm', import.meta.url), variant: 'escalar' },
        ]
        : [{ url: new URL('../wasm/cyborg_quant_core.wasm', import.meta.url), variant: 'escalar' }];

    let lastErr = null;
    for (const candidate of candidates) {
        try {
            exportsRef = await instantiate(candidate.url);
            loadedVariant = candidate.variant;
            memoryRef = exportsRef.memory;
            return exportsRef;
        } catch (err) {
            lastErr = err;
        }
    }
    throw new Error(`wasm load failed: ${(lastErr && lastErr.message) || lastErr}`);
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
                // Fase I: telemetria honesta de qual variante realmente
                // carregou (1000=escalar, 1001=simd128) — so informativo.
                variant: loadedVariant,
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

        // V-MAX Fase 1.3: Volume Profile real (histograma + POC) sobre
        // candles OHLCV reais fornecidos pelo caller — computo pesado
        // (candles × buckets) roda no WASM DESTE worker, nunca na main
        // thread. Layout do buffer documentado em lib.rs::volume_profile.
        // NaN do WASM => result null (FAIL_CLOSED repassado, nunca um
        // histograma inventado).
        if (type === 'compute_volume_profile') {
            const e = await loadWasm();
            const { highs, lows, volumes, buckets } = ev.data;
            const n = Math.min(highs.length, lows.length, volumes.length);
            const cap = e.buffer_capacity();
            if (n === 0 || !Number.isInteger(buckets) || buckets <= 0 || n * 3 > cap) {
                self.postMessage({ id, type: 'volume_profile_result', result: null });
                return;
            }
            const ptr = e.buffer_ptr();
            const view = new Float64Array(memoryRef.buffer, ptr, cap);
            for (let i = 0; i < n; i++) view[i] = highs[i];
            for (let i = 0; i < n; i++) view[n + i] = lows[i];
            for (let i = 0; i < n; i++) view[2 * n + i] = volumes[i];
            const poc = e.volume_profile(n, buckets);
            if (Number.isNaN(poc)) {
                self.postMessage({ id, type: 'volume_profile_result', result: null });
                return;
            }
            const out = new Float64Array(memoryRef.buffer, ptr, buckets + 2);
            const result = {
                pocIndex: poc,
                histogram: Array.from(out.subarray(0, buckets)),
                rangeMin: out[buckets],
                rangeMax: out[buckets + 1],
                candleCount: n,
                engineVersion: e.engine_version(),
            };
            self.postMessage({ id, type: 'volume_profile_result', result });
            return;
        }

        // V-MAX Fase 2: TrustScore real (regularidade de cadência +
        // convergência cross-exchange) no WASM. Layout em lib.rs::trust_score.
        // NaN => result null (FAIL_CLOSED repassado, nunca um score-chute).
        if (type === 'compute_trust_score') {
            const e = await loadWasm();
            const { gaps, divergences } = ev.data;
            const n = gaps.length;
            const m = divergences.length;
            const cap = e.buffer_capacity();
            if (n === 0 || n + m > cap) {
                self.postMessage({ id, type: 'trust_score_result', result: null });
                return;
            }
            const ptr = e.buffer_ptr();
            const view = new Float64Array(memoryRef.buffer, ptr, cap);
            for (let i = 0; i < n; i++) view[i] = gaps[i];
            for (let i = 0; i < m; i++) view[n + i] = divergences[i];
            const score = e.trust_score(n, m);
            if (Number.isNaN(score)) {
                self.postMessage({ id, type: 'trust_score_result', result: null });
                return;
            }
            const out = new Float64Array(memoryRef.buffer, ptr, 2);
            const result = {
                score,
                cadenceRegularity: out[0],
                crossExchangeConvergence: Number.isNaN(out[1]) ? null : out[1],
                gapCount: n,
                divergenceCount: m,
                engineVersion: e.engine_version(),
            };
            self.postMessage({ id, type: 'trust_score_result', result });
            return;
        }

        if (type === 'compute_series') {
            const e = await loadWasm();
            const { closes, window, includeRolling } = ev.data;
            const len = writeBuffer(closes);
            if (len === 0 || !Number.isInteger(window) || window <= 0 || window > len) {
                self.postMessage({ id, type: 'compute_series_result', result: null });
                return;
            }
            // includeRolling (default false): nenhum consumidor real do
            // ramber-ui le rollingSma/rollingZ hoje (grep confirma) — o loop
            // abaixo chamava o WASM ate ~2×(len-window) vezes por ciclo
            // (centenas de chamadas reais) so' para preencher um array
            // sempre descartado. Fica opt-in para quem realmente precisar da
            // serie completa; sma/ema/stddev/zscoreLast/max/min continuam
            // sempre calculados, comportamento identico para todo chamador
            // atual.
            const rollingSma = [];
            const rollingZ = [];
            if (includeRolling) {
                for (let i = window; i <= len; i++) {
                    rollingSma.push(e.sma(i, window));
                    rollingZ.push(e.zscore_last(i));
                }
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
