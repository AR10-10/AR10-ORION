// app.js — orquestrador da tela Safari Local Runtime / Instalacao Local.
import * as feat from './feature-detect.js';
import * as storage from './storage.js';
import * as packManager from './pack-manager.js';
import * as diagnostics from './diagnostics.js';
import * as replayEngine from './replay-engine.js';
import { QuantWorkerClient } from './worker-client.js';

const els = {};
['st-pwa', 'st-sw', 'st-cache', 'st-idb', 'st-opfs', 'st-webcrypto', 'st-wasm', 'st-workers',
    'st-webgpu', 'st-webllm', 'st-transformers', 'st-onnx', 'st-replay', 'st-vault', 'st-mode',
    'console-log', 'replay-canvas', 'replay-meta', 'import-input', 'home-modal', 'standalone-state',
].forEach((id) => { els[id] = document.getElementById(id); });

function log(msg, level = 'dim') {
    const time = new Date().toISOString().slice(11, 19);
    const line = document.createElement('div');
    line.className = `ln-${level}`;
    line.textContent = `[${time}] ${msg}`;
    els['console-log'].appendChild(line);
    els['console-log'].scrollTop = els['console-log'].scrollHeight;
    return line;
}

function classFor(value) {
    if (value === 'OK' || value === true || value === 'INSTALLED' || value === 'READY') return 'v-ok';
    if (value === 'FAIL' || value === 'UNSUPPORTED' || value === 'TOO_LARGE') return 'v-fail';
    return 'v-limited';
}

function setStatus(id, value) {
    const el = els[id];
    if (!el) return;
    el.textContent = String(value);
    el.classList.remove('v-ok', 'v-fail', 'v-limited', 'v-pending', 'v-info');
    el.classList.add(classFor(value));
}

let workerClient = null;
let replayDatasetCache = null;

async function refreshFeatureStatus() {
    const f = await feat.runAllFeatureDetections();
    setStatus('st-pwa', f.pwaHttps);
    setStatus('st-sw', f.serviceWorker);
    setStatus('st-cache', f.cacheApi);
    setStatus('st-idb', f.indexedDb);
    setStatus('st-opfs', f.opfs);
    setStatus('st-webcrypto', f.webCrypto);
    setStatus('st-wasm', f.wasm);
    setStatus('st-workers', f.workers);
    setStatus('st-webgpu', f.webgpu === 'OK' ? 'OK' : 'UNAVAILABLE');
    setStatus('st-webllm', f.webllm);
    setStatus('st-transformers', f.transformers);
    setStatus('st-onnx', f.onnx);
    return f;
}

async function refreshVaultAndReplayStatus() {
    const vault = await packManager.reloadVaultState((m, l) => log(m, l));
    setStatus('st-vault', vault.status === 'READY' ? 'READY' : 'LOCKED');
    try {
        await packManager.loadReplayDataset(() => {});
        setStatus('st-replay', 'INSTALLED');
    } catch {
        setStatus('st-replay', 'MISSING');
    }
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        log('Service Worker indisponivel neste navegador.', 'warn');
        return;
    }
    try {
        const swUrl = new URL('service-worker.js', window.location.href).href;
        const reg = await navigator.serviceWorker.register(swUrl, { scope: './' });
        log(`Service Worker registrado (scope=${reg.scope}).`, 'ok');
    } catch (err) {
        log(`Falha ao registrar Service Worker: ${err.message}`, 'fail');
    }
}

async function handleCheckSafari() {
    log('=== VERIFICAR SAFARI ===', 'info');
    log(`User-Agent: ${navigator.userAgent}`, 'dim');
    log(`Plataforma: ${navigator.platform || 'n/d'} | maxTouchPoints=${navigator.maxTouchPoints}`, 'dim');
    log(`Standalone (Home Screen): ${feat.isStandalone() ? 'SIM' : 'NAO'}`, feat.isStandalone() ? 'ok' : 'dim');
    log(`Viewport: ${window.innerWidth}x${window.innerHeight} | DPR=${window.devicePixelRatio}`, 'dim');

    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.padding = 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    log(`Safe-area insets: top=${cs.paddingTop} right=${cs.paddingRight} bottom=${cs.paddingBottom} left=${cs.paddingLeft}`, 'dim');
    probe.remove();

    const estimate = await storage.storageEstimate();
    if (estimate) {
        const mb = (n) => (n / (1024 * 1024)).toFixed(1);
        log(`Quota de armazenamento: uso=${mb(estimate.usage)}MB / limite=${mb(estimate.quota)}MB`, 'info');
    }
    log(`Backend de storage ativo: ${(await storage.activeBackend()).toUpperCase()}`, 'info');
    await refreshFeatureStatus();
    log('Verificacao concluida.', 'ok');
}

async function handleDownloadPack() {
    try {
        await packManager.downloadLocalPack((m, l) => log(m, l));
        await refreshVaultAndReplayStatus();
    } catch (err) {
        log(`Erro ao baixar pacote: ${err.message}`, 'fail');
    }
}

async function handleImportPack() {
    els['import-input'].click();
}

async function handleVerifySha() {
    try {
        if (!packManager.getLoadedPack()) {
            log('Nenhum pacote em memoria — baixe ou importe primeiro.', 'warn');
            return;
        }
        await packManager.verifySha256((m, l) => log(m, l));
    } catch (err) {
        log(`Erro na verificacao: ${err.message}`, 'fail');
    }
}

async function handleInstallStorage() {
    try {
        if (!packManager.getLoadedPack()) {
            log('Nenhum pacote em memoria — baixe ou importe primeiro.', 'warn');
            return;
        }
        await packManager.installToSafariStorage((m, l) => log(m, l));
        await refreshVaultAndReplayStatus();
    } catch (err) {
        log(`Instalacao bloqueada: ${err.message}`, 'fail');
        await refreshVaultAndReplayStatus();
    }
}

async function handleRunDiagnostics() {
    await diagnostics.runOfflineDiagnostics({ workerClient, onLog: (m, l) => log(m, l) });
}

async function handleRunReplay() {
    try {
        if (!replayDatasetCache) {
            replayDatasetCache = await packManager.loadReplayDataset((m, l) => log(m, l));
        }
        const result = await replayEngine.runReplay({
            dataset: replayDatasetCache,
            workerClient,
            windowSize: 20,
            canvas: els['replay-canvas'],
            onLog: (m, l) => log(m, l),
            onMeta: (meta) => {
                els['replay-meta'].innerHTML = `
                    <span>Candles: <b>${meta.count}</b></span>
                    <span>Ultimo: <b>${meta.last.toFixed(2)}</b></span>
                    <span>SMA20: <b>${meta.sma.toFixed(2)}</b></span>
                    <span>EMA20: <b>${meta.ema.toFixed(2)}</b></span>
                    <span>STDDEV: <b>${meta.stddev.toFixed(2)}</b></span>
                    <span>Z-score: <b>${meta.zscore.toFixed(3)}</b></span>
                    <span>Engine v${meta.engineVersion} · ${meta.elapsedMs}ms</span>
                `;
            },
        });
        setStatus('st-replay', 'INSTALLED');
        void result;
    } catch (err) {
        log(`Erro no replay: ${err.message}`, 'fail');
    }
}

async function handleClearReinstall() {
    if (!window.confirm('Limpar o pacote local instalado (Vault)? O PWA continua instalado; apenas os dados locais sao apagados.')) return;
    await packManager.clearAndReinstall((m, l) => log(m, l));
    replayDatasetCache = null;
    await refreshVaultAndReplayStatus();
}

function handleAddHome() {
    const standalone = feat.isStandalone();
    els['standalone-state'].textContent = standalone
        ? '✓ Este PWA já está rodando em modo standalone (instalado).'
        : 'Ainda rodando dentro do Safari (não instalado).';
    els['standalone-state'].className = standalone ? 'v-ok' : 'v-limited';
    els['home-modal'].hidden = false;
}

function wireButtons() {
    document.getElementById('btn-check-safari').addEventListener('click', handleCheckSafari);
    document.getElementById('btn-download-pack').addEventListener('click', handleDownloadPack);
    document.getElementById('btn-import-pack').addEventListener('click', handleImportPack);
    document.getElementById('btn-verify-sha').addEventListener('click', handleVerifySha);
    document.getElementById('btn-install-storage').addEventListener('click', handleInstallStorage);
    document.getElementById('btn-run-diagnostics').addEventListener('click', handleRunDiagnostics);
    document.getElementById('btn-run-replay').addEventListener('click', handleRunReplay);
    document.getElementById('btn-clear-reinstall').addEventListener('click', handleClearReinstall);
    document.getElementById('btn-add-home').addEventListener('click', handleAddHome);
    document.getElementById('btn-close-modal').addEventListener('click', () => { els['home-modal'].hidden = true; });

    els['import-input'].addEventListener('change', async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        try {
            await packManager.importLocalPackFromFile(file, (m, l) => log(m, l));
        } catch (err) {
            log(`Erro ao importar: ${err.message}`, 'fail');
        }
        ev.target.value = '';
    });
}

async function boot() {
    log('AR10_CYBORG_2_IPAD_ONE_TAP_CLOUD_RUNTIME_V1 — boot iniciado.', 'info');
    wireButtons();
    await registerServiceWorker();
    const workerUrl = new URL('workers/quant-worker.js', window.location.href).href;
    workerClient = new QuantWorkerClient(workerUrl);
    try {
        await workerClient.ping();
        await workerClient.initWasm();
        log('Worker + WASM Quant Engine prontos.', 'ok');
    } catch (err) {
        log(`Worker/WASM falhou ao iniciar: ${err.message}`, 'fail');
    }
    await refreshFeatureStatus();
    await refreshVaultAndReplayStatus();
    log('Boot concluido. Modo: IPAD DIRECT / LOCAL-FIRST / READ_ONLY / FAIL_CLOSED.', 'ok');
}

boot();
