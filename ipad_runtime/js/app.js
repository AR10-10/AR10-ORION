// app.js — orquestrador da tela Safari Local Runtime / Instalacao Local.
import * as feat from './feature-detect.js';
import * as storage from './storage.js';
import * as packManager from './pack-manager.js';
import * as diagnostics from './diagnostics.js';
import * as replayEngine from './replay-engine.js';
import { QuantWorkerClient } from './worker-client.js';
import * as siriform from './siriform.js';
import * as voice from './voice.js';

const els = {};
['st-pwa', 'st-sw', 'st-cache', 'st-idb', 'st-opfs', 'st-webcrypto', 'st-wasm', 'st-workers',
    'st-webgpu', 'st-webgl', 'st-webllm', 'st-transformers', 'st-onnx', 'st-replay', 'st-vault', 'st-mode',
    'st-voice', 'st-speech-rec', 'st-speech-syn', 'st-mic-perm',
    'st-llama-layer', 'st-llama-profile', 'st-llama-runtime', 'st-llama-webgpu',
    'console-log', 'replay-canvas', 'replay-meta', 'import-input', 'home-modal', 'standalone-state',
    'siriform-avatar', 'siriform-caption', 'siriform-state-tag', 'mic-button', 'engine-meta', 'analysis-frame-grid',
    'vault-meta', 'vault-hashes', 'profile-hint',
    'cr-pwa', 'cr-sw', 'cr-cache', 'cr-idb', 'cr-opfs', 'cr-webcrypto', 'cr-wasm', 'cr-workers',
    'cr-webgpu', 'cr-voice', 'cr-llama', 'cr-pack', 'cr-replay', 'cr-safety',
    'vl-pack', 'vl-pack-name', 'vl-pack-version', 'vl-sha256', 'vl-sw-cache', 'vl-cache-api',
    'vl-idb', 'vl-opfs', 'vl-wasm', 'vl-replay', 'vl-updated', 'vl-cache-version',
    'vl-storage-used', 'vl-storage-quota', 'vl-safety', 'vl-repair',
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
    if (value === 'OK' || value === true || value === 'INSTALLED' || value === 'INSTALADO' || value === 'ATUALIZADO' || value === 'READY' || value === 'AVAILABLE' || value === 'GRANTED') return 'v-ok';
    if (value === 'FAIL' || value === 'MISSING' || value === 'UNSUPPORTED' || value === 'TOO_LARGE' || value === 'DENIED' || value === 'AUSENTE' || value === 'CORROMPIDO' || value === 'REINSTALAÇÃO NECESSÁRIA' || value === 'BLOQUEADO POR SEGURANÇA') return 'v-fail';
    if (value === 'FUTURE' || value === 'LIGHT' || value === 'BALANCED' || value === 'HEAVY') return 'v-info';
    return 'v-limited'; // DESATUALIZADO/LIMITADO caem aqui de proposito — else aberto, sem 6a classe
}

function setStatus(id, value) {
    const el = els[id];
    if (!el) return;
    el.textContent = String(value);
    el.classList.remove('v-ok', 'v-fail', 'v-limited', 'v-pending', 'v-info');
    el.classList.add(classFor(value));
}

function setInfo(id, text) {
    const el = els[id];
    if (!el) return;
    el.textContent = String(text);
    el.classList.remove('v-ok', 'v-fail', 'v-limited', 'v-pending', 'v-info');
    el.classList.add('v-info');
}

function okOrAusente(v) { return v === 'OK' ? 'OK' : 'AUSENTE'; }

async function getActiveCacheInfo() {
    if (!('caches' in window)) return { present: false, label: 'AUSENTE' };
    try {
        const keys = await caches.keys();
        const match = keys.find((k) => k.startsWith('cyborg-ipad-runtime-'));
        return match ? { present: true, label: match.replace('cyborg-ipad-runtime-', '') } : { present: false, label: 'AUSENTE' };
    } catch {
        return { present: false, label: 'AUSENTE' };
    }
}

function packStatusLabel(vault, freshness) {
    if (!vault || vault.status !== 'READY') {
        if (vault && vault.reason === 'checksum_failed') return 'BLOQUEADO POR SEGURANÇA';
        if (vault && vault.reason) return 'CORROMPIDO';
        return 'AUSENTE';
    }
    if (freshness === 'DESATUALIZADO') return 'DESATUALIZADO';
    if (freshness === 'ATUALIZADO') return 'ATUALIZADO';
    return 'INSTALADO';
}

function repairLabel(vault) {
    if (!vault || vault.status === undefined) return 'AUSENTE';
    if (vault.status === 'READY') return 'OK';
    if (vault.status === 'LOCKED' && vault.reason) return 'REINSTALAÇÃO NECESSÁRIA';
    return 'AUSENTE';
}

let workerClient = null;
let replayDatasetCache = null;
let lastAnalysisMeta = null;
let vaultFreshness = null; // null=nao verificado nesta sessao; so muda apos check real (NO_FAKE_LOCAL_AI_CLAIMS)

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

function refreshLlamaStatus(f) {
    setStatus('st-llama-layer', 'FUTURE');
    setStatus('st-llama-runtime', 'FUTURE');
    setStatus('st-llama-webgpu', f.webgpu === 'OK' ? 'AVAILABLE' : 'UNAVAILABLE');
}

async function refreshVoiceStatus() {
    const status = await voice.getVoiceStatus();
    setStatus('st-voice', status.overall);
    setStatus('st-speech-rec', status.recognition);
    setStatus('st-speech-syn', status.synthesis);
    setStatus('st-mic-perm', status.microphonePermission);
    if (status.overall === 'TEXT_ONLY') {
        siriform.setVoiceState('voice_text_only');
    } else if (status.recognition === 'UNSUPPORTED') {
        siriform.setVoiceState('voice_unsupported');
    } else if (status.microphonePermission === 'DENIED') {
        siriform.setVoiceState('voice_permission_required', 'Permissão de microfone negada. Toque para tentar novamente.');
    }
    return status;
}

function refreshCyborgReadiness(f, voiceStatus) {
    setStatus('cr-pwa', f.pwaHttps === 'OK' ? 'OK' : 'MISSING');
    setStatus('cr-sw', f.serviceWorker === 'OK' ? 'OK' : 'MISSING');
    setStatus('cr-cache', f.cacheApi === 'OK' ? 'OK' : 'MISSING');
    setStatus('cr-idb', f.indexedDb === 'OK' ? 'OK' : 'MISSING');
    setStatus('cr-opfs', f.opfs === 'OK' ? 'OK' : (f.opfs === 'LIMITED' ? 'LIMITED' : 'MISSING'));
    setStatus('cr-webcrypto', f.webCrypto === 'OK' ? 'OK' : 'MISSING');
    setStatus('cr-wasm', f.wasm === 'OK' ? 'OK' : 'MISSING');
    setStatus('cr-workers', f.workers === 'OK' ? 'OK' : 'MISSING');
    setStatus('cr-webgpu', f.webgpu === 'OK' ? 'OK' : 'UNSUPPORTED');
    setStatus('cr-voice', voiceStatus.overall === 'AVAILABLE' ? 'OK' : (voiceStatus.overall === 'LIMITED' ? 'LIMITED' : 'MISSING'));
    setStatus('cr-llama', 'FUTURE');
    setStatus('cr-safety', 'OK');
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

async function refreshVaultLocalPanel(vault) {
    const f = await feat.runAllFeatureDetections();
    setStatus('vl-pack', packStatusLabel(vault, vaultFreshness));
    setInfo('vl-pack-name', vault?.packageName || '—');
    setInfo('vl-pack-version', vault?.packVersion || '—');
    setStatus('vl-sha256', vault?.status === 'READY' ? 'OK' : (vault?.reason ? 'CORROMPIDO' : 'AUSENTE'));

    const cacheInfo = await getActiveCacheInfo();
    setStatus('vl-sw-cache', cacheInfo.present ? 'OK' : 'AUSENTE');
    setInfo('vl-cache-version', cacheInfo.present ? cacheInfo.label : '—');

    setStatus('vl-cache-api', okOrAusente(f.cacheApi));
    setStatus('vl-idb', okOrAusente(f.indexedDb));
    setStatus('vl-opfs', f.opfs === 'OK' ? 'OK' : (f.opfs === 'LIMITED' ? 'LIMITADO' : 'AUSENTE'));

    setStatus('vl-wasm', vault?.status === 'READY' ? 'OK' : 'AUSENTE');
    setStatus('vl-replay', vault?.status === 'READY' ? 'OK' : 'AUSENTE');

    setInfo('vl-updated', (vault?.updatedAt || vault?.installedAt) ? new Date(vault.updatedAt || vault.installedAt).toLocaleString('pt-BR') : '—');

    setStatus('vl-safety', (vault && vault.reason === 'checksum_failed') ? 'BLOQUEADO POR SEGURANÇA' : 'OK');
    setStatus('vl-repair', repairLabel(vault));

    const estimate = await storage.storageEstimate();
    const mb = (n) => (n / (1024 * 1024)).toFixed(1) + ' MB';
    setInfo('vl-storage-used', estimate ? mb(estimate.usage) : 'INDISPONÍVEL');
    setInfo('vl-storage-quota', estimate ? mb(estimate.quota) : 'INDISPONÍVEL');
}

async function refreshVaultAndReplayStatus() {
    const vault = await packManager.reloadVaultState((m, l) => log(m, l));
    setStatus('st-vault', vault.status === 'READY' ? 'READY' : 'LOCKED');
    setStatus('cr-pack', vault.status === 'READY' ? 'OK' : 'MISSING');
    renderVaultEvidence(vault);
    try {
        await packManager.loadReplayDataset(() => {});
        setStatus('st-replay', 'INSTALLED');
        setStatus('cr-replay', 'OK');
    } catch {
        setStatus('st-replay', 'MISSING');
        setStatus('cr-replay', 'MISSING');
    }
    await refreshVaultLocalPanel(vault);
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
    const f = await refreshFeatureStatus();
    refreshLlamaStatus(f);
    const voiceStatus = await refreshVoiceStatus();
    refreshCyborgReadiness(f, voiceStatus);
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
                lastAnalysisMeta = meta;
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
        setStatus('cr-replay', 'OK');
        siriform.setSiriformState('responding', 'Replay BTC/USDT pronto para análise.');
        void result;
    } catch (err) {
        log(`Erro no replay: ${err.message}`, 'fail');
        siriform.setSiriformState('responding', 'Não consegui rodar o replay agora.');
    }
}

async function handleClearReinstall() {
    const confirmMsg = 'Isso vai remover do Vault local deste iPad: o motor WASM, o dataset de replay, '
        + 'os manifestos/metadados e a versão instalada. O PWA em si (instalação na Tela de Início, '
        + 'Service Worker) NÃO é removido — apenas os dados locais. Depois disso você precisará tocar '
        + 'em "Preparar tudo neste iPad" de novo. Continuar?';
    if (!window.confirm(confirmMsg)) return;
    siriform.setSiriformState('thinking', 'Limpando Vault local...');
    await packManager.clearAndReinstall((m, l) => log(m, l));
    replayDatasetCache = null;
    vaultFreshness = null;
    await refreshVaultAndReplayStatus();
    siriform.setSiriformState('responding', 'Vault limpo. Pacote local ainda não instalado.');
}

async function handleCheckLocalInstall() {
    siriform.setSiriformState('analyzing', 'Verificando instalação local...');
    log('=== VERIFICAR INSTALAÇÃO LOCAL ===', 'info');
    const vault = await refreshVaultAndReplayStatus();
    if (vault.status === 'READY') {
        log(`Instalação local OK — pacote ${vault.packageName || '?'} v${vault.packVersion || '?'} (backend=${String(vault.backend || '?').toUpperCase()}).`, 'ok');
        siriform.setSiriformState('responding', 'Instalação local verificada: tudo OK.');
    } else {
        log(`Instalação local ausente ou bloqueada${vault.reason ? ` (${vault.reason})` : ''}.`, 'warn');
        siriform.setSiriformState('responding', 'Nada instalado ainda, ou instalação bloqueada por segurança.');
    }
}

async function handleUpdateLocalPack() {
    siriform.setSiriformState('thinking', 'Verificando se há atualização do pacote local...');
    log('=== ATUALIZAR PACOTE LOCAL ===', 'info');
    try {
        const before = await packManager.getInstalledVaultMeta();
        const pack = await packManager.downloadLocalPack((m, l) => log(m, l));
        const availableVersion = pack?.manifest?.pack_version || 'DESCONHECIDA';
        const installedVersion = before?.packVersion;

        if (before?.status === 'READY' && installedVersion && installedVersion === availableVersion) {
            vaultFreshness = 'ATUALIZADO';
            log(`Pacote local já está na versão mais recente (v${installedVersion}). Nenhuma reinstalação necessária.`, 'ok');
            await refreshVaultAndReplayStatus();
            siriform.setSiriformState('responding', 'Pacote local já está atualizado.');
            return;
        }

        vaultFreshness = 'DESATUALIZADO';
        log(`Nova versão disponível: v${availableVersion}${installedVersion ? ` (instalada: v${installedVersion})` : ''}.`, 'info');
        const { allOk } = await packManager.verifySha256((m, l) => log(m, l));
        if (!allOk) {
            log('FAIL_CLOSED: checksum inválido na atualização — instalação anterior preservada (nada foi sobrescrito).', 'fail');
            await refreshVaultAndReplayStatus();
            siriform.setSiriformState('fail_closed');
            return;
        }
        await packManager.installToSafariStorage((m, l) => log(m, l));
        vaultFreshness = 'ATUALIZADO';
        await refreshVaultAndReplayStatus();
        log(`=== PACOTE LOCAL ATUALIZADO PARA v${availableVersion} ===`, 'ok');
        siriform.setSiriformState('responding', 'Pacote local atualizado com sucesso.');
    } catch (err) {
        log(`Erro ao atualizar pacote local: ${err.message}`, 'fail');
        siriform.setSiriformState('responding', 'Não consegui verificar atualização agora.');
    }
}

async function handleRepairInstall() {
    siriform.setSiriformState('installing', 'Reparando instalação local...');
    log('=== REPARAR INSTALAÇÃO ===', 'info');
    try {
        await packManager.downloadLocalPack((m, l) => log(m, l));
        const { allOk } = await packManager.verifySha256((m, l) => log(m, l));
        if (!allOk) {
            log('FAIL_CLOSED: checksum inválido — reparo abortado.', 'fail');
            await refreshVaultAndReplayStatus();
            siriform.setSiriformState('fail_closed');
            return;
        }
        await packManager.installToSafariStorage((m, l) => log(m, l));
        vaultFreshness = 'ATUALIZADO';
        await refreshVaultAndReplayStatus();
        log('=== INSTALAÇÃO REPARADA ===', 'ok');
        siriform.setSiriformState('responding', 'Instalação local reparada com sucesso.');
    } catch (err) {
        log(`Reparo bloqueado: ${err.message}`, 'fail');
        await refreshVaultAndReplayStatus();
        siriform.setSiriformState('fail_closed');
    }
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

async function handlePrepareCyborg() {
    siriform.setSiriformState('installing', 'Preparando Cyborg neste iPad...');
    log('=== PREPARAR CYBORG NESTE IPAD ===', 'info');
    try {
        if (!packManager.getLoadedPack()) {
            log('Pacote local ainda nao esta em memoria — baixando do mesmo HTTPS origin...', 'info');
            await packManager.downloadLocalPack((m, l) => log(m, l));
        } else {
            log('Pacote local ja em memoria — reutilizando.', 'dim');
        }

        siriform.setSiriformState('analyzing', 'Verificando SHA256...');
        const { allOk } = await packManager.verifySha256((m, l) => log(m, l));
        if (!allOk) {
            siriform.setSiriformState('fail_closed');
            log('FAIL_CLOSED: checksum invalido — preparacao abortada.', 'fail');
            return;
        }

        siriform.setSiriformState('installing', 'Instalando no Safari Storage...');
        await packManager.installToSafariStorage((m, l) => log(m, l));
        await refreshVaultAndReplayStatus();

        if (workerClient) {
            try { await workerClient.initWasm(); } catch { /* ja reportado no boot; nao bloqueia preparacao */ }
        }

        await handleRunReplay();
        await handleRunDiagnostics();

        log('=== CYBORG PREPARADO NESTE IPAD: LOCAL-FIRST / READ_ONLY / FAIL_CLOSED ===', 'ok');
        siriform.setSiriformState('responding', 'Replay BTC/USDT pronto para análise.');
    } catch (err) {
        log(`Preparacao bloqueada: ${err.message}`, 'fail');
        siriform.setSiriformState('fail_closed');
    }
}

function handleExplainAnalysis() {
    if (!lastAnalysisMeta) {
        log('Explicar analise: nenhum AnalysisFrame disponivel ainda.', 'warn');
        siriform.setSiriformState('responding', 'Rode o Replay BTC/USDT primeiro para gerar o AnalysisFrame.');
        return;
    }
    const m = lastAnalysisMeta;
    const text = `AnalysisFrame: ${m.count} candles, último preço ${m.last.toFixed(2)}, SMA ${m.sma.toFixed(2)}, EMA ${m.ema.toFixed(2)}, desvio padrão ${m.stddev.toFixed(2)}, z-score ${m.zscore.toFixed(3)}. Leitura descritiva, não é recomendação de ordem.`;
    log(`Explicar analise: ${text}`, 'info');
    siriform.setSiriformState('responding', text);
    voice.speak(text);
}

function handleShowReport() {
    log('=== RELATORIO ===', 'info');
    log('Modo: IPAD DIRECT / LOCAL-FIRST / READ_ONLY / FAIL_CLOSED.', 'dim');
    log(lastAnalysisMeta
        ? `Replay BTC/USDT: ${lastAnalysisMeta.count} candles, SMA ${lastAnalysisMeta.sma.toFixed(2)}, EMA ${lastAnalysisMeta.ema.toFixed(2)}, z-score ${lastAnalysisMeta.zscore.toFixed(3)}.`
        : 'Replay BTC/USDT: ainda não executado nesta sessão.', 'dim');
    siriform.setSiriformState('responding', 'Relatório gerado nos Logs do Sistema.');
}

function handleShowStatus() {
    log('Status atual: IPAD DIRECT / LOCAL-FIRST / READ_ONLY / FAIL_CLOSED.', 'info');
    siriform.setSiriformState('read_only', 'Cyborg operando em READ_ONLY / FAIL_CLOSED.');
    voice.speak('Cyborg operando em READ_ONLY / FAIL_CLOSED.');
}

function handleShowSafetyMode() {
    const text = 'Execução real está bloqueada. O Cyborg está em READ_ONLY / FAIL_CLOSED.';
    log(text, 'info');
    siriform.setSiriformState('fail_closed');
    voice.speak(text);
}

async function dispatchVoiceCommand(id) {
    switch (id) {
        case 'check-safari': return handleCheckSafari();
        case 'prepare-cyborg': return handlePrepareCyborg();
        case 'run-diagnostics': return handleRunDiagnostics();
        case 'run-replay': return handleRunReplay();
        case 'show-status': return handleShowStatus();
        case 'explain-analysis': return handleExplainAnalysis();
        case 'show-safety-mode': return handleShowSafetyMode();
        case 'show-add-home': return handleAddHome();
        default: return undefined;
    }
}

async function handleVoiceTranscript(transcript) {
    siriform.setVoiceState('voice_processing');
    log(`Voz reconhecida: "${transcript}"`, 'dim');
    const result = voice.matchCommand(transcript);

    if (result.type === 'blocked') {
        log(`Comando de voz BLOQUEADO (frase: "${result.matchedPhrase}").`, 'fail');
        siriform.setVoiceState('voice_blocked_by_policy');
        siriform.setSiriformState('fail_closed');
        voice.speak(result.response);
        return;
    }
    if (result.type === 'allowed') {
        log(`Comando de voz reconhecido: ${result.id} (frase: "${result.matchedPhrase}").`, 'ok');
        siriform.setVoiceState('voice_responding');
        await dispatchVoiceCommand(result.id);
        return;
    }
    if (result.type === 'empty') {
        siriform.setVoiceState('voice_idle');
        return;
    }
    log(`Comando de voz nao reconhecido: "${transcript}".`, 'warn');
    siriform.setVoiceState('voice_responding', 'Não entendi esse comando. Toque nos botões na tela.');
}

function handleVoiceError(err) {
    if (err === 'unsupported') {
        siriform.setVoiceState('voice_unsupported');
        log('Reconhecimento de voz nao suportado neste navegador.', 'warn');
        return;
    }
    if (err === 'not-allowed' || err === 'service-not-allowed') {
        siriform.setVoiceState('voice_permission_required', 'Preciso da permissão do microfone para ouvir você.');
        log('Permissao de microfone negada ou pendente.', 'warn');
        return;
    }
    log(`Erro no reconhecimento de voz: ${err}`, 'warn');
    siriform.setVoiceState('voice_idle');
}

function handleMicButton() {
    if (voice.isListening()) {
        voice.stopListening();
        return;
    }
    const caps = voice.getVoiceCapabilities();
    if (caps.recognition !== 'AVAILABLE') {
        siriform.setVoiceState('voice_unsupported');
        log('Reconhecimento de voz nao suportado neste navegador — use os botões na tela.', 'warn');
        return;
    }
    siriform.setVoiceState('voice_listening');
    voice.startListening({
        onStart: () => log('Microfone: escutando um comando...', 'info'),
        onResult: (transcript) => handleVoiceTranscript(transcript),
        onError: (err) => handleVoiceError(err),
    });
}

function wireProfileToggle() {
    const buttons = document.querySelectorAll('.profile-btn');
    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            currentProfile = btn.dataset.profile;
            buttons.forEach((b) => b.classList.toggle('active', b === btn));
            els['profile-hint'].textContent = PROFILES[currentProfile].label;
            setStatus('st-llama-profile', currentProfile.toUpperCase());
            log(`Perfil de processamento: ${currentProfile.toUpperCase()}.`, 'info');
        });
    });
}

function wireButtons() {
    document.getElementById('btn-check-safari').addEventListener('click', handleCheckSafari);
    document.getElementById('btn-prepare-cyborg').addEventListener('click', handlePrepareCyborg);
    document.getElementById('btn-check-install').addEventListener('click', handleCheckLocalInstall);
    document.getElementById('btn-download-pack').addEventListener('click', handleDownloadPack);
    document.getElementById('btn-update-pack').addEventListener('click', handleUpdateLocalPack);
    document.getElementById('btn-import-pack').addEventListener('click', handleImportPack);
    document.getElementById('btn-verify-sha').addEventListener('click', handleVerifySha);
    document.getElementById('btn-install-storage').addEventListener('click', handleInstallStorage);
    document.getElementById('btn-run-diagnostics').addEventListener('click', handleRunDiagnostics);
    document.getElementById('btn-run-replay').addEventListener('click', handleRunReplay);
    document.getElementById('btn-repair-install').addEventListener('click', handleRepairInstall);
    document.getElementById('btn-clear-reinstall').addEventListener('click', handleClearReinstall);
    document.getElementById('btn-add-home').addEventListener('click', handleAddHome);
    document.getElementById('btn-close-modal').addEventListener('click', () => { els['home-modal'].hidden = true; });
    document.getElementById('qa-diagnostics').addEventListener('click', handleRunDiagnostics);
    document.getElementById('qa-replay').addEventListener('click', handleRunReplay);
    document.getElementById('qa-analysis').addEventListener('click', handleExplainAnalysis);
    document.getElementById('qa-report').addEventListener('click', handleShowReport);
    if (els['mic-button']) els['mic-button'].addEventListener('click', handleMicButton);
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
        mic: els['mic-button'],
    });
    siriform.setSiriformState('thinking', 'Inicializando runtime local...');
    log('AR10_CYBORG_2_IPAD_ONE_TAP_CLOUD_RUNTIME_V1 — boot iniciado.', 'info');
    setStatus('st-llama-profile', currentProfile.toUpperCase());
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
    const f = await refreshFeatureStatus();
    refreshLlamaStatus(f);
    const voiceStatus = await refreshVoiceStatus();
    const vault = await refreshVaultAndReplayStatus();
    refreshCyborgReadiness(f, voiceStatus);
    log('Boot concluido. Modo: IPAD DIRECT / LOCAL-FIRST / READ_ONLY / FAIL_CLOSED.', 'ok');
    if (vault.status === 'READY') {
        siriform.setSiriformState('responding', 'Pacote local pronto. Posso preparar seu ambiente local.');
    } else {
        siriform.setSiriformState('idle', 'Pacote local ainda não instalado.');
    }
}

boot();
