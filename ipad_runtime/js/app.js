// app.js — orquestrador da tela Safari Local Runtime / Instalacao Local.
import * as feat from './feature-detect.js';
import * as storage from './storage.js';
import * as packManager from './pack-manager.js';
import * as diagnostics from './diagnostics.js';
import * as replayEngine from './replay-engine.js';
import { QuantWorkerClient } from './worker-client.js';
import * as siriform from './siriform.js';

const els = {};
['st-pwa', 'st-sw', 'st-cache', 'st-idb', 'st-opfs', 'st-webcrypto', 'st-wasm', 'st-workers',
    'st-webgpu', 'st-webgl', 'st-webllm', 'st-transformers', 'st-onnx', 'st-replay', 'st-vault', 'st-mode',
    'console-log', 'replay-canvas', 'replay-meta', 'import-input', 'home-modal', 'standalone-state',
    'siriform-avatar', 'siriform-caption', 'siriform-state-tag', 'engine-meta', 'analysis-frame-grid',
    'vault-meta', 'vault-hashes', 'profile-hint',
].forEach((id) => { els[id] = document.getElementById(id); });

const PROFILES = {
    light: { windowSize: 10, label: 'Light: janela SMA/EMA=10, leitura mais rápida e leve.' },
    balanced: { windowSize: 20, label: 'Balanced: janela SMA/EMA=20, resolução total do replay.' },
    heavy: { windowSize: 40, label: 'Heavy: janela SMA/EMA=40, mais precisão, mais cálculo.' },
};
let currentProfile = 'balanced';

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
    setStatus('st-webgl', f.webgl === 'OK' ? 'OK' : 'FALLBACK');
    setStatus('st-webllm', f.webllm);
    setStatus('st-transformers', f.transformers);
    setStatus('st-onnx', f.onnx);
    return f;
}

function renderVaultEvidence(vault) {
    if (vault.status !== 'READY') {
        els['vault-meta'].textContent = vault.reason
            ? `Vault LOCKED (${vault.reason}).`
            : 'Sem pacote instalado nesta sessão ainda.';
        els['vault-hashes'].innerHTML = '';
        return;
    }
    const installedAt = vault.installedAt ? new Date(vault.installedAt).toLocaleString('pt-BR') : 'n/d';
    els['vault-meta'].textContent = `Backend: ${String(vault.backend || '?').toUpperCase()} · Arquivos: ${vault.fileCount ?? '?'} · Instalado em: ${installedAt}`;
    const checksums = vault.checksums || {};
    els['vault-hashes'].innerHTML = Object.keys(checksums)
        .map((path) => `<span class="hash-chip">${path}: ${String(checksums[path]).slice(0, 12)}…</span>`)
        .join('');
}

async function refreshVaultAndReplayStatus() {
    const vault = await packManager.reloadVaultState((m, l) => log(m, l));
    setStatus('st-vault', vault.status === 'READY' ? 'READY' : 'LOCKED');
    renderVaultEvidence(vault);
    try {
        await packManager.loadReplayDataset(() => {});
        setStatus('st-replay', 'INSTALLED');
    } catch {
        setStatus('st-replay', 'MISSING');
    }
    return vault;
}

function renderAnalysisFrame(meta) {
    els['analysis-frame-grid'].innerHTML = `
        <div class="af-row"><span class="af-label">Candles</span><span class="af-value">${meta.count}</span></div>
        <div class="af-row"><span class="af-label">Último</span><span class="af-value">${meta.last.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">SMA</span><span class="af-value">${meta.sma.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">EMA</span><span class="af-value">${meta.ema.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">Desvio padrão</span><span class="af-value">${meta.stddev.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">Z-score</span><span class="af-value">${meta.zscore.toFixed(3)}</span></div>
        <div class="af-row"><span class="af-label">Máximo</span><span class="af-value">${meta.max.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">Mínimo</span><span class="af-value">${meta.min.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">Engine</span><span class="af-value">v${meta.engineVersion} · ${meta.elapsedMs}ms</span></div>
    `;
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
    siriform.setSiriformState('thinking', 'Verificando capacidades do Safari...');
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
    siriform.setSiriformState('responding', 'Runtime Safari detectado.');
}

async function handleDownloadPack() {
    siriform.setSiriformState('thinking', 'Baixando pacote local...');
    try {
        await packManager.downloadLocalPack((m, l) => log(m, l));
        await refreshVaultAndReplayStatus();
        siriform.setSiriformState('responding', 'Pacote local pronto. Verifique o SHA256 antes de instalar.');
    } catch (err) {
        log(`Erro ao baixar pacote: ${err.message}`, 'fail');
        siriform.setSiriformState('responding', 'Não consegui baixar o pacote local agora.');
    }
}

async function handleImportPack() {
    siriform.pulseListening();
    els['import-input'].click();
}

async function handleVerifySha() {
    siriform.setSiriformState('analyzing', 'Verificando SHA256 do pacote...');
    try {
        if (!packManager.getLoadedPack()) {
            log('Nenhum pacote em memoria — baixe ou importe primeiro.', 'warn');
            siriform.setSiriformState('responding', 'Nenhum pacote em memória ainda.');
            return;
        }
        const { allOk } = await packManager.verifySha256((m, l) => log(m, l));
        siriform.setSiriformState('responding', allOk ? 'Checksum OK em todos os arquivos.' : 'Checksum divergente. Execução real bloqueada. Modo seguro ativo.');
    } catch (err) {
        log(`Erro na verificacao: ${err.message}`, 'fail');
        siriform.setSiriformState('fail_closed');
    }
}

async function handleInstallStorage() {
    siriform.setSiriformState('installing');
    try {
        if (!packManager.getLoadedPack()) {
            log('Nenhum pacote em memoria — baixe ou importe primeiro.', 'warn');
            siriform.setSiriformState('responding', 'Nenhum pacote em memória ainda.');
            return;
        }
        await packManager.installToSafariStorage((m, l) => log(m, l));
        await refreshVaultAndReplayStatus();
        siriform.setSiriformState('responding', 'Pacote local instalado. Vault em READY.');
    } catch (err) {
        log(`Instalacao bloqueada: ${err.message}`, 'fail');
        await refreshVaultAndReplayStatus();
        siriform.setSiriformState('fail_closed');
    }
}

async function handleRunDiagnostics() {
    siriform.setSiriformState('analyzing', 'Rodando diagnóstico offline...');
    await diagnostics.runOfflineDiagnostics({ workerClient, onLog: (m, l) => log(m, l) });
    siriform.setSiriformState('responding', 'Diagnóstico offline concluído.');
}

async function handleRunReplay() {
    siriform.setSiriformState('analyzing', 'Rodando replay BTC/USDT...');
    try {
        if (!replayDatasetCache) {
            replayDatasetCache = await packManager.loadReplayDataset((m, l) => log(m, l));
        }
        const profile = PROFILES[currentProfile];
        const result = await replayEngine.runReplay({
            dataset: replayDatasetCache,
            workerClient,
            windowSize: profile.windowSize,
            canvas: els['replay-canvas'],
            onLog: (m, l) => log(m, l),
            onMeta: (meta) => {
                els['replay-meta'].innerHTML = `
                    <span>Candles: <b>${meta.count}</b></span>
                    <span>Ultimo: <b>${meta.last.toFixed(2)}</b></span>
                    <span>SMA${profile.windowSize}: <b>${meta.sma.toFixed(2)}</b></span>
                    <span>EMA${profile.windowSize}: <b>${meta.ema.toFixed(2)}</b></span>
                    <span>STDDEV: <b>${meta.stddev.toFixed(2)}</b></span>
                    <span>Z-score: <b>${meta.zscore.toFixed(3)}</b></span>
                    <span>Engine v${meta.engineVersion} · ${meta.elapsedMs}ms</span>
                `;
                renderAnalysisFrame(meta);
            },
        });
        setStatus('st-replay', 'INSTALLED');
        siriform.setSiriformState('responding', 'Replay BTC/USDT pronto para análise.');
        void result;
    } catch (err) {
        log(`Erro no replay: ${err.message}`, 'fail');
        siriform.setSiriformState('responding', 'Não consegui rodar o replay agora.');
    }
}

async function handleClearReinstall() {
    if (!window.confirm('Limpar o pacote local instalado (Vault)? O PWA continua instalado; apenas os dados locais sao apagados.')) return;
    siriform.setSiriformState('thinking', 'Limpando Vault local...');
    await packManager.clearAndReinstall((m, l) => log(m, l));
    replayDatasetCache = null;
    await refreshVaultAndReplayStatus();
    siriform.setSiriformState('responding', 'Vault limpo. Pacote local ainda não instalado.');
}

function handleAddHome() {
    siriform.pulseListening();
    const standalone = feat.isStandalone();
    els['standalone-state'].textContent = standalone
        ? '✓ Este PWA já está rodando em modo standalone (instalado).'
        : 'Ainda rodando dentro do Safari (não instalado).';
    els['standalone-state'].className = standalone ? 'v-ok' : 'v-limited';
    els['home-modal'].hidden = false;
}

function wireProfileToggle() {
    const buttons = document.querySelectorAll('.profile-btn');
    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            currentProfile = btn.dataset.profile;
            buttons.forEach((b) => b.classList.toggle('active', b === btn));
            els['profile-hint'].textContent = PROFILES[currentProfile].label;
            log(`Perfil de processamento: ${currentProfile.toUpperCase()}.`, 'info');
        });
    });
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
    wireProfileToggle();

    els['import-input'].addEventListener('change', async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        siriform.setSiriformState('thinking', 'Importando pacote do app Arquivos...');
        try {
            await packManager.importLocalPackFromFile(file, (m, l) => log(m, l));
            siriform.setSiriformState('responding', 'Pacote importado. Verifique o SHA256 antes de instalar.');
        } catch (err) {
            log(`Erro ao importar: ${err.message}`, 'fail');
            siriform.setSiriformState('responding', 'Não consegui importar esse arquivo.');
        }
        ev.target.value = '';
    });
}

async function boot() {
    siriform.initSiriform({
        avatar: els['siriform-avatar'],
        caption: els['siriform-caption'],
        tag: els['siriform-state-tag'],
    });
    siriform.setSiriformState('thinking', 'Inicializando runtime local...');
    log('AR10_CYBORG_2_IPAD_ONE_TAP_CLOUD_RUNTIME_V1 — boot iniciado.', 'info');
    wireButtons();
    await registerServiceWorker();
    const workerUrl = new URL('workers/quant-worker.js', window.location.href).href;
    workerClient = new QuantWorkerClient(workerUrl);
    try {
        await workerClient.ping();
        const wasmInfo = await workerClient.initWasm();
        els['engine-meta'].textContent = `Engine v${wasmInfo.version} · capacidade do buffer=${wasmInfo.capacity} amostras · ${wasmInfo.exportNames.length} exports.`;
        log('Worker + WASM Quant Engine prontos.', 'ok');
    } catch (err) {
        els['engine-meta'].textContent = `Falha ao inicializar o engine: ${err.message}`;
        log(`Worker/WASM falhou ao iniciar: ${err.message}`, 'fail');
    }
    await refreshFeatureStatus();
    const vault = await refreshVaultAndReplayStatus();
    log('Boot concluido. Modo: IPAD DIRECT / LOCAL-FIRST / READ_ONLY / FAIL_CLOSED.', 'ok');
    if (vault.status === 'READY') {
        siriform.setSiriformState('responding', 'Pacote local pronto. Posso preparar seu ambiente local.');
    } else {
        siriform.setSiriformState('idle', 'Pacote local ainda não instalado.');
    }
}

boot();
