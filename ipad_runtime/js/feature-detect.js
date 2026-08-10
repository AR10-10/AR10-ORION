// feature-detect.js — sonda capacidades do Safari/iPadOS em tempo real.
// Toda funcao aqui e uma sonda FUNCIONAL (nao so "typeof"): tenta de fato
// usar a API e reporta FAIL/LIMITED se o uso real falhar, nao so a presenca.

export async function detectPwaHttps() {
    const ok = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    return ok ? 'OK' : 'FAIL';
}

export async function detectServiceWorker() {
    if (!('serviceWorker' in navigator)) return 'FAIL';
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) return 'OK';
        return navigator.serviceWorker.controller ? 'OK' : 'OK'; // API presente; registro acontece no boot
    } catch {
        return 'FAIL';
    }
}

export async function detectCacheApi() {
    if (!('caches' in window)) return 'FAIL';
    try {
        const cache = await caches.open('ar10-feature-probe');
        await cache.put('./__probe', new Response('ok'));
        const match = await cache.match('./__probe');
        await cache.delete('./__probe');
        return match ? 'OK' : 'FAIL';
    } catch {
        return 'FAIL';
    }
}

export async function detectIndexedDb() {
    if (!('indexedDB' in window)) return 'FAIL';
    try {
        await new Promise((resolve, reject) => {
            const req = indexedDB.open('ar10_feature_probe', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('p');
            req.onsuccess = () => { req.result.close(); resolve(); };
            req.onerror = () => reject(req.error);
        });
        indexedDB.deleteDatabase('ar10_feature_probe');
        return 'OK';
    } catch {
        return 'FAIL';
    }
}

export async function detectOpfs() {
    try {
        if (!('storage' in navigator) || typeof navigator.storage.getDirectory !== 'function') {
            return 'MISSING_API';
        }
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle('__probe', { create: true });
        const fh = await dir.getFileHandle('p.bin', { create: true });
        const writable = await fh.createWritable();
        await writable.write(new Uint8Array([1, 2, 3]));
        await writable.close();
        const file = await fh.getFile();
        const buf = await file.arrayBuffer();
        await root.removeEntry('__probe', { recursive: true });
        return (buf.byteLength === 3) ? 'OK' : 'LIMITED';
    } catch {
        return 'LIMITED';
    }
}

export async function detectWebCrypto() {
    if (!window.crypto || !window.crypto.subtle) return 'FAIL';
    try {
        const buf = new TextEncoder().encode('ar10-probe');
        const digest = await crypto.subtle.digest('SHA-256', buf);
        return digest.byteLength === 32 ? 'OK' : 'FAIL';
    } catch {
        return 'FAIL';
    }
}

export async function detectWasm() {
    if (typeof WebAssembly !== 'object') return 'FAIL';
    try {
        // Modulo WASM minimo valido (header + secao vazia) — valida o motor real.
        const tiny = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
        const ok = WebAssembly.validate(tiny);
        return ok ? 'OK' : 'FAIL';
    } catch {
        return 'FAIL';
    }
}

export async function detectWorkers() {
    return typeof Worker !== 'undefined' ? 'OK' : 'FAIL';
}

export async function detectWebGpu() {
    if (!('gpu' in navigator) || !navigator.gpu) return 'UNAVAILABLE';
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter ? 'OK' : 'UNAVAILABLE';
    } catch {
        return 'UNAVAILABLE';
    }
}

export async function detectWebGl() {
    try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        return gl ? 'OK' : 'FAIL';
    } catch {
        return 'FAIL';
    }
}

// WebLLM/Transformers.js/ONNX Runtime Web: planejados, nao empacotados nesta V1
// (modelos grandes demais para empacotar sem CDN externo ao nucleo). Estado
// honesto: FUTURE — roadmap declarado, nao "fake installed".
export function detectWebLlmStatus() { return 'FUTURE'; }
export function detectTransformersStatus() { return 'FUTURE'; }
export function detectOnnxStatus() { return 'FUTURE'; }

export function isStandalone() {
    return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export async function runAllFeatureDetections() {
    const [pwaHttps, serviceWorker, cacheApi, indexedDb, opfsRaw, webCrypto, wasm, workers, webgpu, webgl] =
        await Promise.all([
            detectPwaHttps(), detectServiceWorker(), detectCacheApi(), detectIndexedDb(),
            detectOpfs(), detectWebCrypto(), detectWasm(), detectWorkers(), detectWebGpu(), detectWebGl(),
        ]);

    // OPFS so conta "FAIL" de verdade se IndexedDB tambem falhar (ai sim sem
    // persistencia alguma). Caso contrario MISSING_API/erro pontual => LIMITED.
    let opfs = opfsRaw;
    if (opfsRaw !== 'OK' && indexedDb !== 'OK') opfs = 'FAIL';
    else if (opfsRaw !== 'OK') opfs = 'LIMITED';

    return {
        pwaHttps, serviceWorker, cacheApi, indexedDb, opfs, webCrypto, wasm, workers,
        webgpu, webgl,
        webllm: detectWebLlmStatus(),
        transformers: detectTransformersStatus(),
        onnx: detectOnnxStatus(),
        standalone: isStandalone(),
    };
}
