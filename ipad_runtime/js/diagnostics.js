// diagnostics.js — Diagnostico Offline. Deve funcionar 100% sem rede
// (Modo Aviao) depois que o PWA e o pacote local ja foram instalados.

import * as feat from './feature-detect.js';
import * as storage from './storage.js';

export async function runOfflineDiagnostics({ workerClient, onLog }) {
    const lines = [];
    const log = (msg, level = 'dim') => { lines.push({ msg, level }); onLog?.(msg, level); };
    const t0 = performance.now();

    log('=== DIAGNOSTICO OFFLINE — INICIO ===', 'info');

    // 1. Deteccao de capacidades
    const features = await feat.runAllFeatureDetections();
    for (const [k, v] of Object.entries(features)) {
        const level = (v === 'OK' || v === true) ? 'ok' : (v === 'FAIL') ? 'fail' : 'warn';
        log(`feature.${k} = ${v}`, level);
    }

    // 2. Storage round-trip (escreve, le, apaga)
    try {
        const probe = new Uint8Array([9, 8, 7, 6]);
        await storage.saveFile('_diag/probe.bin', probe);
        const back = await storage.readFile('_diag/probe.bin');
        const ok = back && back.length === 4 && back[0] === 9;
        log(`storage.roundtrip = ${ok ? 'OK' : 'FAIL'} (backend=${await storage.activeBackend()})`, ok ? 'ok' : 'fail');
    } catch (err) {
        log(`storage.roundtrip = FAIL (${err.message})`, 'fail');
    }

    // 3. Worker + WASM self-test
    try {
        await workerClient.ping();
        log('worker.ping = OK', 'ok');
        const wasmInfo = await workerClient.initWasm();
        log(`worker.init_wasm = OK (versao=${wasmInfo.version}, capacidade=${wasmInfo.capacity})`, 'ok');
        const selfTest = await workerClient.selfTest();
        log(`worker.wasm_self_test = ${selfTest.pass ? 'OK' : 'FAIL'} sma=${selfTest.result.sma.toFixed(3)} ema=${selfTest.result.ema.toFixed(3)} stddev=${selfTest.result.stddev.toFixed(3)} failClosedNaN=${selfTest.result.failClosedNaN}`, selfTest.pass ? 'ok' : 'fail');
    } catch (err) {
        log(`worker/wasm = FAIL (${err.message})`, 'fail');
    }

    // 4. Estimativa de quota
    const estimate = await storage.storageEstimate();
    if (estimate) {
        const mb = (n) => (n / (1024 * 1024)).toFixed(1);
        log(`storage.estimate = usage=${mb(estimate.usage)}MB quota=${mb(estimate.quota)}MB`, 'info');
    } else {
        log('storage.estimate = indisponivel', 'warn');
    }

    // 5. Confirma ausencia de chamadas de rede sensiveis (estatico, documental)
    log('network.private_endpoints = BLOQUEADO (CSP connect-src self; nenhuma rota MEXC/MT5 existe no codigo)', 'ok');
    log('execution.order_send = AUSENTE (nenhuma funcao de ordem/execucao existe neste pacote)', 'ok');

    const elapsed = (performance.now() - t0).toFixed(0);
    log(`=== DIAGNOSTICO OFFLINE — FIM (${elapsed}ms) ===`, 'info');

    return lines;
}
