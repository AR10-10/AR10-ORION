// app.js — orquestrador da tela Safari Local Runtime / Instalacao Local.
import * as feat from './feature-detect.js';
import * as storage from './storage.js';
import * as packManager from './pack-manager.js';
import * as diagnostics from './diagnostics.js';
import * as replayEngine from './replay-engine.js';
import { QuantWorkerClient } from './worker-client.js';
import * as siriform from './siriform.js';
import * as voice from './voice.js';
import * as exporter from './export-manifest.js';
import * as dataPolicy from './data-policy.js';
import * as evaluations from './evaluations.js';
import * as metrics from './metrics.js';

const els = {};
['st-pwa', 'st-sw', 'st-cache', 'st-idb', 'st-opfs', 'st-webcrypto', 'st-wasm', 'st-workers',
    'st-webgpu', 'st-webgl', 'st-webllm', 'st-transformers', 'st-onnx', 'st-replay', 'st-vault', 'st-mode',
    'st-voice', 'st-speech-rec', 'st-speech-syn', 'st-mic-perm',
    'st-llama-layer', 'st-llama-profile', 'st-llama-runtime', 'st-llama-webgpu',
    'console-log', 'telemetry-latest', 'replay-canvas', 'replay-meta', 'import-input', 'home-modal', 'standalone-state',
    'siriform-avatar', 'siriform-caption', 'siriform-state-tag', 'mic-button', 'engine-meta', 'analysis-frame-grid',
    'vault-meta', 'vault-hashes', 'profile-hint',
    'cr-pwa', 'cr-sw', 'cr-cache', 'cr-idb', 'cr-opfs', 'cr-webcrypto', 'cr-wasm', 'cr-workers',
    'cr-webgpu', 'cr-voice', 'cr-llama', 'cr-pack', 'cr-replay', 'cr-safety',
    'vl-pack', 'vl-pack-name', 'vl-pack-version', 'vl-sha256', 'vl-sw-cache', 'vl-cache-api',
    'vl-idb', 'vl-opfs', 'vl-wasm', 'vl-replay', 'vl-updated', 'vl-cache-version',
    'vl-storage-used', 'vl-storage-quota', 'vl-safety', 'vl-repair',
    'dp-realmode', 'dp-analysis', 'export-list',
    'topbar-status', 'advanced-section', 'btn-tb-advanced',
    'ev-command-routing', 'ev-security-posture', 'ev-data-policy', 'ev-fail-closed', 'ev-siriform-states', 'ev-summary',
    'mx-load-time', 'mx-prep-time', 'mx-cache', 'mx-storage', 'mx-siriform-events', 'mx-diag-fails', 'mx-eval-fails', 'mx-reduced-motion',
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
    // Telemetria ao Vivo: o último evento real fica sempre visível no topo do
    // card, sem precisar rolar a "caixa preta" inteira (Fase 5 — logs viram
    // telemetria legível, nunca um muro de terminal dominando a primeira tela).
    if (els['telemetry-latest']) {
        els['telemetry-latest'].textContent = `[${time}] ${msg}`;
        els['telemetry-latest'].className = `telemetry-latest ln-${level}`;
    }
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

// Fase 6 — política de dados de mercado. O replay sintético é só diagnóstico
// técnico; análise de mercado REAL exige fonte pública/somente-leitura. Como
// nenhum conector real está habilitado nesta versão, o estado honesto da
// análise real é DADOS INSUFICIENTES (NO_FAKE_DATA), nunca um número inventado.
function refreshDataPolicyPanel() {
    const rm = dataPolicy.realMarketAnalysisStatus();
    setStatus('dp-realmode', rm.status);   // 'DADOS INSUFICIENTES' → v-limited (else aberto)
    setStatus('dp-analysis', rm.status);
}

// Fase 8 — painel "Evaluations": resumo por grupo (PASS/total), nunca um
// "tudo certo" decorativo. setStatus()/classFor() não cobrem o formato
// "N/M PASS", então a classe v-ok/v-fail é decidida aqui mesmo, igual ao
// padrão já usado em refreshTopbarStatus().
function renderEvaluationsPanel(report) {
    const byGroup = {};
    for (const r of report.results) {
        byGroup[r.group] = byGroup[r.group] || { pass: 0, total: 0 };
        byGroup[r.group].total += 1;
        if (r.pass) byGroup[r.group].pass += 1;
    }
    const setGroup = (id, key) => {
        const el = els[id];
        if (!el) return;
        const g = byGroup[key];
        el.textContent = g ? `${g.pass}/${g.total} PASS` : '—';
        el.classList.remove('v-ok', 'v-fail', 'v-limited', 'v-pending', 'v-info');
        el.classList.add(g && g.pass === g.total ? 'v-ok' : 'v-fail');
    };
    setGroup('ev-command-routing', 'command_routing');
    setGroup('ev-security-posture', 'security_posture');
    setGroup('ev-data-policy', 'dados_insuficientes');
    setGroup('ev-fail-closed', 'read_only_fail_closed');
    setGroup('ev-siriform-states', 'siriform_states');
    if (els['ev-summary']) {
        els['ev-summary'].textContent = `Última execução: ${report.pass}/${report.total} verificações PASS, ${report.fail} FAIL, em ${report.elapsedMs}ms. Detalhe linha a linha na Telemetria ao Vivo.`;
    }
}

// Fase 8 — painel "Métricas": equivalente leve do Instruments (WWDC26).
// Reusa getActiveCacheInfo()/storage.storageEstimate() (mesma fonte da
// Vault Local) em vez de recalcular cache/armazenamento de um jeito
// diferente — duas formas de medir a mesma coisa só criariam divergência.
async function refreshMetricsPanel() {
    const snap = metrics.getSnapshot();
    setInfo('mx-load-time', snap.loadTimeMs != null ? `${snap.loadTimeMs} ms` : 'INDISPONÍVEL');
    setInfo('mx-prep-time', snap.lastPrepDurationMs != null ? `${snap.lastPrepDurationMs} ms` : 'Ainda não executado nesta sessão.');

    const cacheInfo = await getActiveCacheInfo();
    setStatus('mx-cache', cacheInfo.present ? 'OK' : 'AUSENTE');

    const estimate = await storage.storageEstimate();
    const mb = (n) => (n / (1024 * 1024)).toFixed(1) + ' MB';
    setInfo('mx-storage', estimate ? `${mb(estimate.usage)} / ${mb(estimate.quota)}` : 'INDISPONÍVEL');

    setInfo('mx-siriform-events', String(snap.siriformEventCount));
    setInfo('mx-diag-fails', snap.lastDiagnosticsFails != null ? String(snap.lastDiagnosticsFails) : 'Ainda não executado nesta sessão.');
    setInfo('mx-eval-fails', snap.lastEvaluationsFails != null ? String(snap.lastEvaluationsFails) : 'Ainda não executado nesta sessão.');
    setInfo('mx-reduced-motion', snap.reducedMotion ? 'ATIVADO' : 'DESATIVADO');
}

// Fase 4 — painel "Arquivos Exportados". NUNCA mostra um nome generico/sem
// timestamp como se fosse um arquivo ja exportado: so exibe nome de arquivo
// quando ele e real, com timestamp, gerado nesta sessao (sessionExports). Os
// artefatos ainda nao exportados aparecem como "Nenhum X exportado ainda.",
// com a visibilidade correta (INTERNO / DISPONÍVEL PARA EXPORTAR / SOB
// DEMANDA / FUTURO) — nunca um nome de arquivo fantasma.
const EXPORT_EMPTY_LABEL = {
    LOCAL_PACK: 'Nenhum backup do pacote local exportado ainda.',
    FINAL_REPORT: 'Nenhum relatório exportado ainda.',
    EVIDENCE_OUTBOX: 'Nenhuma evidência exportada ainda.',
    PROJECT_DECKAP: 'Nenhum DECAP exportado ainda.',
};

function renderExportPanel() {
    if (!els['export-list']) return;
    const visLabel = {
        downloadable: { txt: 'DISPONÍVEL PARA EXPORTAR', cls: 'v-info' },
        on_demand: { txt: 'SOB DEMANDA', cls: 'v-info' },
        internal: { txt: 'INTERNO', cls: 'v-info' },
        future: { txt: 'FUTURO', cls: 'v-limited' },
    };
    els['export-list'].innerHTML = exporter.listForPanel().map((a) => {
        if (a.filename) {
            return `<div class="export-row">
                <span class="export-name">${a.filename}</span>
                <span class="export-tag v-ok">EXPORTADO</span>
            </div>`;
        }
        const v = visLabel[a.visibility] || visLabel.internal;
        const label = EXPORT_EMPTY_LABEL[a.type] || `Nenhum ${a.type} exportado ainda.`;
        return `<div class="export-row">
            <span class="export-name export-name-empty">${label}</span>
            <span class="export-tag ${v.cls}">${v.txt}</span>
        </div>`;
    }).join('');
}

// Fase 1/5 — status compacto e central no topbar: responde de cara "Cyborg
// esta pronto? / precisa de atenção?" sem precisar abrir nenhum painel.
function refreshTopbarStatus(vault) {
    const el = els['topbar-status'];
    if (!el) return;
    el.classList.remove('v-ok', 'v-fail', 'v-limited', 'v-info');
    if (vault.status === 'READY') {
        el.textContent = vaultFreshness === 'DESATUALIZADO' ? 'Cyborg pronto · atualização disponível' : 'Cyborg pronto neste iPad';
        el.classList.add(vaultFreshness === 'DESATUALIZADO' ? 'v-limited' : 'v-ok');
    } else if (vault.reason === 'checksum_failed') {
        el.textContent = 'Bloqueado por segurança';
        el.classList.add('v-fail');
    } else if (vault.reason) {
        el.textContent = 'Instalação corrompida';
        el.classList.add('v-fail');
    } else {
        el.textContent = 'Instalação local ainda não preparada';
        el.classList.add('v-limited');
    }
}

async function refreshVaultAndReplayStatus() {
    const vault = await packManager.reloadVaultState((m, l) => log(m, l));
    setStatus('st-vault', vault.status === 'READY' ? 'READY' : 'LOCKED');
    setStatus('cr-pack', vault.status === 'READY' ? 'OK' : 'MISSING');
    renderVaultEvidence(vault);
    refreshTopbarStatus(vault);
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
    siriform.setSiriformState('checking', 'Verificando capacidades do Safari...');
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
    siriform.setSiriformState('success', 'Runtime Safari detectado.');
}

async function handleDownloadPack() {
    siriform.setSiriformState('thinking', 'Baixando pacote local para backup...');
    try {
        await packManager.downloadLocalPack((m, l) => log(m, l));
        await refreshVaultAndReplayStatus();
        renderExportPanel();
        siriform.setSiriformState('success', 'Pacote local exportado para backup.');
    } catch (err) {
        log(`Erro ao baixar pacote: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui baixar o pacote local agora.');
    }
}

async function handleImportPack() {
    siriform.pulseListening();
    els['import-input'].click();
}

async function handleVerifySha() {
    siriform.setSiriformState('checking', 'Verificando SHA256 do pacote...');
    try {
        if (!packManager.getLoadedPack()) {
            log('Nenhum pacote em memoria — baixe ou importe primeiro.', 'warn');
            siriform.setSiriformState('warning', 'Nenhum pacote em memória ainda.');
            return;
        }
        const { allOk } = await packManager.verifySha256((m, l) => log(m, l));
        siriform.setSiriformState(allOk ? 'success' : 'blocked', allOk ? 'Checksum OK em todos os arquivos.' : 'Checksum divergente. Execução real bloqueada. Modo seguro ativo.');
    } catch (err) {
        log(`Erro na verificacao: ${err.message}`, 'fail');
        siriform.setSiriformState('blocked');
    }
}

async function handleInstallStorage() {
    siriform.setSiriformState('updating');
    try {
        if (!packManager.getLoadedPack()) {
            log('Nenhum pacote em memoria — baixe ou importe primeiro.', 'warn');
            siriform.setSiriformState('warning', 'Nenhum pacote em memória ainda.');
            return;
        }
        await packManager.installToSafariStorage((m, l) => log(m, l));
        await refreshVaultAndReplayStatus();
        siriform.setSiriformState('success', 'Pacote local instalado. Vault em READY.');
    } catch (err) {
        log(`Instalacao bloqueada: ${err.message}`, 'fail');
        await refreshVaultAndReplayStatus();
        siriform.setSiriformState('blocked');
    }
}

async function handleRunDiagnostics() {
    siriform.setSiriformState('diagnosing', 'Rodando diagnóstico técnico offline...');
    const lines = await diagnostics.runOfflineDiagnostics({ workerClient, onLog: (m, l) => log(m, l) });
    metrics.recordDiagnosticsReport(lines);
    siriform.setSiriformState('success', 'Diagnóstico offline concluído.');
}

// Fase 8 — equivalente local do framework "Evaluations" da Apple (WWDC26):
// auto-teste real de roteamento de comando, postura de seguranca e
// vocabulario de estado do Siriform. Termina em "protected" quando tudo
// passa (confirmacao ambiente de que READ_ONLY/FAIL_CLOSED seguem intactos)
// ou em "warning" quando alguma verificacao falhar.
async function handleRunEvaluations() {
    siriform.setSiriformState('diagnosing', 'Rodando Evaluations (auto-teste de comportamento e segurança)...');
    const report = await evaluations.runEvaluations({
        packManager,
        avatarEl: els['siriform-avatar'],
        onLog: (m, l) => log(m, l),
    });
    metrics.recordEvaluationsReport(report);
    renderEvaluationsPanel(report);
    if (report.fail === 0) {
        siriform.setSiriformState('protected', `Evaluations: ${report.pass}/${report.total} verificações OK. Leis de segurança intactas.`);
    } else {
        siriform.setSiriformState('warning', `Evaluations: ${report.fail} verificação(ões) falharam — ver Telemetria ao Vivo.`);
    }
}

async function handleRunReplay() {
    siriform.setSiriformState('checking', 'Rodando replay técnico BTC/USDT...');
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
        siriform.setSiriformState('success', 'Replay BTC/USDT pronto para análise.');
        void result;
    } catch (err) {
        log(`Erro no replay: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui rodar o replay agora.');
    }
}

async function handleClearReinstall() {
    const confirmMsg = 'Isso vai remover do Vault local deste iPad: o motor WASM, o dataset de replay, '
        + 'os manifestos/metadados e a versão instalada. O PWA em si (instalação na Tela de Início, '
        + 'Service Worker) NÃO é removido — apenas os dados locais. Depois disso você precisará tocar '
        + 'em "Preparar / Atualizar Cyborg neste iPad" de novo. Continuar?';
    if (!window.confirm(confirmMsg)) return;
    siriform.setSiriformState('thinking', 'Limpando Vault local...');
    await packManager.clearAndReinstall((m, l) => log(m, l));
    replayDatasetCache = null;
    vaultFreshness = null;
    await refreshVaultAndReplayStatus();
    siriform.setSiriformState('warning', 'Vault limpo. Pacote local ainda não instalado.');
}

// Fase 3 — estado guiado, nunca um beco sem saída tecnico. Primeira visita:
// aponta para o botao principal. Instalacao anterior corrompida: tenta
// reparo automatico seguro primeiro; só then comunica sucesso/falha.
async function handleCheckLocalInstall() {
    siriform.setSiriformState('checking', 'Verificando instalação local...');
    log('=== VERIFICAR INSTALAÇÃO LOCAL ===', 'info');
    const before = await packManager.getInstalledVaultMeta();
    const vault = await refreshVaultAndReplayStatus();

    if (vault.status === 'READY') {
        log(`Instalação local OK — pacote ${vault.packageName || '?'} v${vault.packVersion || '?'} (backend=${String(vault.backend || '?').toUpperCase()}).`, 'ok');
        siriform.setSiriformState('success', 'Instalação local verificada: tudo OK.');
        return;
    }

    if (!before || !before.checksums) {
        log('Instalação local ainda não preparada — nenhuma instalação anterior encontrada neste iPad.', 'info');
        siriform.setSiriformState('idle', 'Instalação local ainda não preparada. Toque em "Preparar / Atualizar Cyborg neste iPad".');
        return;
    }

    log('Instalação local encontrada porém corrompida/bloqueada — tentando reparo automático seguro antes de qualquer mensagem final...', 'warn');
    siriform.setSiriformState('repairing', 'Tentando reparo automático...');
    const repair = await packManager.autoRepairVault((m, l) => log(m, l));
    await refreshVaultAndReplayStatus();
    if (repair.status === 'READY') {
        vaultFreshness = 'ATUALIZADO';
        log('=== INSTALAÇÃO REPARADA AUTOMATICAMENTE ===', 'ok');
        siriform.setSiriformState('success', 'Instalação reparada.');
    } else if (repair.reason === 'checksum_failed') {
        log('FAIL_CLOSED: checksum inválido — reparo automático abortado, estado anterior preservado.', 'fail');
        siriform.setSiriformState('blocked', 'Bloqueado por segurança. Toque em "Reparar instalação" no Modo avançado.');
    } else {
        log('Reparo automático não concluído.', 'warn');
        siriform.setSiriformState('warning', 'Não consegui reparar automaticamente. Toque em "Reparar instalação" no Modo avançado.');
    }
}

async function handleUpdateLocalPack() {
    siriform.setSiriformState('checking', 'Verificando se há atualização do pacote local...');
    log('=== ATUALIZAR SISTEMA ===', 'info');
    try {
        const before = await packManager.getInstalledVaultMeta();
        const pack = await packManager.fetchLocalPack((m, l) => log(m, l));
        const availableVersion = pack?.manifest?.pack_version || 'DESCONHECIDA';
        const installedVersion = before?.packVersion;

        if (before?.status === 'READY' && installedVersion && installedVersion === availableVersion) {
            vaultFreshness = 'ATUALIZADO';
            log(`Pacote local já está na versão mais recente (v${installedVersion}). Nenhuma reinstalação necessária.`, 'ok');
            await refreshVaultAndReplayStatus();
            siriform.setSiriformState('success', 'Pacote local já está atualizado.');
            return;
        }

        vaultFreshness = 'DESATUALIZADO';
        log(`Nova versão disponível: v${availableVersion}${installedVersion ? ` (instalada: v${installedVersion})` : ''}.`, 'info');
        siriform.setSiriformState('updating', 'Atualizando pacote local...');
        const { allOk } = await packManager.verifySha256((m, l) => log(m, l));
        if (!allOk) {
            log('FAIL_CLOSED: checksum inválido na atualização — instalação anterior preservada (nada foi sobrescrito).', 'fail');
            await refreshVaultAndReplayStatus();
            siriform.setSiriformState('blocked');
            return;
        }
        await packManager.installToSafariStorage((m, l) => log(m, l));
        vaultFreshness = 'ATUALIZADO';
        await refreshVaultAndReplayStatus();
        log(`=== PACOTE LOCAL ATUALIZADO PARA v${availableVersion} ===`, 'ok');
        siriform.setSiriformState('success', 'Pacote local atualizado com sucesso.');
    } catch (err) {
        log(`Erro ao atualizar pacote local: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui verificar atualização agora.');
    }
}

async function handleRepairInstall() {
    siriform.setSiriformState('repairing', 'Reparando instalação local...');
    log('=== REPARAR INSTALAÇÃO ===', 'info');
    try {
        // Auto-reparo seguro: re-verifica → reindexa do armazenamento se os
        // arquivos existem → re-checa SHA256 → restaura, ou reinstala com
        // segurança a partir do pacote do app (FAIL_CLOSED se checksum falhar).
        // Nunca apaga dados como primeiro recurso.
        const result = await packManager.autoRepairVault((m, l) => log(m, l));
        await refreshVaultAndReplayStatus();
        if (result.status === 'READY') {
            vaultFreshness = 'ATUALIZADO';
            const how = result.action === 'reindex'
                ? 'arquivos locais já estavam íntegros — índice restaurado sem reinstalar'
                : (result.action === 'none' ? 'já estava íntegro' : 'reinstalação segura concluída');
            log(`=== INSTALAÇÃO REPARADA (${how}) ===`, 'ok');
            siriform.setSiriformState('success', 'Instalação reparada.');
        } else if (result.reason === 'checksum_failed') {
            log('FAIL_CLOSED: checksum inválido — reparo abortado, estado anterior preservado.', 'fail');
            siriform.setSiriformState('blocked');
        } else {
            log('Reparo automático não concluído. Em último caso, use "Limpar/Reinstalar".', 'warn');
            siriform.setSiriformState('warning', 'Não consegui reparar automaticamente. Tente "Limpar/Reinstalar" como último recurso.');
        }
    } catch (err) {
        log(`Reparo bloqueado: ${err.message}`, 'fail');
        await refreshVaultAndReplayStatus();
        siriform.setSiriformState('blocked');
    }
}

async function handleExportReport() {
    siriform.setSiriformState('thinking', 'Gerando relatório de sessão...');
    log('=== EXPORTAR RELATÓRIO ===', 'info');
    const vault = await packManager.getInstalledVaultMeta();
    const now = new Date().toISOString();
    const a = lastAnalysisMeta;
    const lines = [
        '# AR10 CYBORG 2.0 — Relatório de Sessão',
        '',
        `- Gerado em: ${now}`,
        '- Modo: IPAD DIRECT / LOCAL-FIRST / READ_ONLY / FAIL_CLOSED',
        '- Execução: DISABLED_BY_POLICY (sem ordem, sem live trading, sem API secret)',
        '',
        '## Vault Local',
        `- Status: ${vault?.status || 'NÃO INSTALADO'}`,
        `- Pacote: ${vault?.packageName || '—'} v${vault?.packVersion || '—'}`,
        `- Backend: ${(vault?.backend || '—').toString().toUpperCase()}`,
        `- Arquivos: ${vault?.fileCount ?? '—'}`,
        '',
        '## AnalysisFrame (DIAGNÓSTICO SINTÉTICO — NÃO É DECISÃO DE MERCADO)',
        a
            ? `- Candles: ${a.count} | Último: ${a.last.toFixed(2)} | SMA: ${a.sma.toFixed(2)} | EMA: ${a.ema.toFixed(2)} | STDDEV: ${a.stddev.toFixed(2)} | Z: ${a.zscore.toFixed(3)}`
            : '- Replay ainda não executado nesta sessão.',
        '',
        '## Política de Dados',
        '- Replay BTC/USDT: SYNTHETIC_OFFLINE_SAMPLE — teste técnico offline, não usar para decisão de mercado.',
        `- Análise de mercado real: ${dataPolicy.realMarketAnalysisStatus().status} (nenhuma fonte pública/somente-leitura conectada nesta versão).`,
        '',
        '> Este relatório não contém segredo, chave de API, credencial de corretora ou dado de conta real.',
        '',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const entry = exporter.downloadArtifact({ type: 'FINAL_REPORT', ext: 'md', blob, purpose: 'Relatório de sessão exportado pelo usuário.' });
    renderExportPanel();
    log(`Relatório exportado com nome único: ${entry.filename}.`, 'ok');
    siriform.setSiriformState('success', 'Relatório de sessão exportado para o app Arquivos.');
}

async function handleExportEvidence() {
    siriform.setSiriformState('thinking', 'Gerando pacote de evidência...');
    log('=== EXPORTAR EVIDÊNCIA ===', 'info');
    const vault = await packManager.getInstalledVaultMeta();
    const f = await feat.runAllFeatureDetections();
    const estimate = await storage.storageEstimate();
    const evidence = {
        generated_at: new Date().toISOString(),
        mode: 'IPAD_DIRECT / LOCAL_FIRST / READ_ONLY / FAIL_CLOSED',
        execution: 'DISABLED_BY_POLICY',
        vault: vault ? { status: vault.status, packageName: vault.packageName, packVersion: vault.packVersion, backend: vault.backend, fileCount: vault.fileCount, checksums: vault.checksums } : null,
        feature_detection: f,
        storage_estimate: estimate ? { usage: estimate.usage, quota: estimate.quota } : null,
        data_policy: dataPolicy.MARKET_DATA_POLICY,
        no_secrets: true,
    };
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
    const entry = exporter.downloadArtifact({ type: 'EVIDENCE_OUTBOX', ext: 'json', blob, purpose: 'Snapshot de evidência da sessão exportado pelo usuário.' });
    renderExportPanel();
    log(`Evidência exportada com nome único: ${entry.filename}.`, 'ok');
    siriform.setSiriformState('success', 'Snapshot de evidência exportado para o app Arquivos.');
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

// Fase 2 — o UNICO botao principal do fluxo normal. Sozinho ele: verifica
// Safari/PWA, verifica instalacao existente (reparo seguro antes de
// reinstalar do zero), baixa/verifica/instala so se necessario, valida WASM
// e dataset de replay, e termina com a frase exata "Cyborg pronto neste
// iPad." — nunca um beco sem saida tecnico.
async function handlePrepareCyborg() {
    siriform.setSiriformState('updating', 'Preparando Cyborg neste iPad...');
    log('=== PREPARAR / ATUALIZAR CYBORG NESTE IPAD ===', 'info');
    const t0 = performance.now();
    try {
        const before = await packManager.getInstalledVaultMeta();
        let ready = false;

        if (before?.status === 'READY' && before?.checksums) {
            siriform.setSiriformState('checking', 'Verificando instalação existente...');
            const repair = await packManager.autoRepairVault((m, l) => log(m, l));
            if (repair.status === 'READY') {
                vaultFreshness = 'ATUALIZADO';
                ready = true;
            } else if (repair.reason === 'checksum_failed') {
                siriform.setSiriformState('blocked');
                log('FAIL_CLOSED: checksum inválido — preparação abortada, estado anterior preservado.', 'fail');
                await refreshVaultAndReplayStatus();
                return;
            } else {
                log('Reparo automático não concluído — tentando reinstalação completa...', 'warn');
            }
        }

        if (!ready) {
            if (!packManager.getLoadedPack()) {
                log('Pacote local ainda nao esta em memoria — buscando do mesmo HTTPS origin (sem download visivel; instalacao e automatica)...', 'info');
                await packManager.fetchLocalPack((m, l) => log(m, l));
            } else {
                log('Pacote local ja em memoria — reutilizando.', 'dim');
            }

            siriform.setSiriformState('checking', 'Verificando SHA256...');
            const { allOk } = await packManager.verifySha256((m, l) => log(m, l));
            if (!allOk) {
                siriform.setSiriformState('blocked');
                log('FAIL_CLOSED: checksum invalido — preparacao abortada.', 'fail');
                await refreshVaultAndReplayStatus();
                return;
            }

            siriform.setSiriformState('updating', 'Instalando no Safari Storage...');
            await packManager.installToSafariStorage((m, l) => log(m, l));
            vaultFreshness = 'ATUALIZADO';
        }

        await refreshVaultAndReplayStatus();

        if (workerClient) {
            try { await workerClient.initWasm(); } catch { /* ja reportado no boot; nao bloqueia preparacao */ }
        }

        await handleRunReplay();
        await handleRunDiagnostics();

        log('=== CYBORG PRONTO NESTE IPAD: LOCAL-FIRST / READ_ONLY / FAIL_CLOSED ===', 'ok');
        siriform.setSiriformState('success', 'Cyborg pronto neste iPad.');
    } catch (err) {
        log(`Preparacao bloqueada: ${err.message}`, 'fail');
        siriform.setSiriformState('blocked');
        await refreshVaultAndReplayStatus();
    } finally {
        metrics.recordPrepDuration(performance.now() - t0);
    }
}

function handleExplainAnalysis() {
    if (!lastAnalysisMeta) {
        log('Explicar analise: nenhum AnalysisFrame disponivel ainda.', 'warn');
        siriform.setSiriformState('warning', 'Rode o Replay BTC/USDT primeiro para gerar o AnalysisFrame.');
        return;
    }
    const m = lastAnalysisMeta;
    const text = `AnalysisFrame: ${m.count} candles, último preço ${m.last.toFixed(2)}, SMA ${m.sma.toFixed(2)}, EMA ${m.ema.toFixed(2)}, desvio padrão ${m.stddev.toFixed(2)}, z-score ${m.zscore.toFixed(3)}. Leitura descritiva, não é recomendação de ordem.`;
    log(`Explicar analise: ${text}`, 'info');
    siriform.setSiriformState('success', text);
    voice.speak(text);
}

function handleShowReport() {
    log('=== RELATORIO ===', 'info');
    log('Modo: IPAD DIRECT / LOCAL-FIRST / READ_ONLY / FAIL_CLOSED.', 'dim');
    log(lastAnalysisMeta
        ? `Replay BTC/USDT: ${lastAnalysisMeta.count} candles, SMA ${lastAnalysisMeta.sma.toFixed(2)}, EMA ${lastAnalysisMeta.ema.toFixed(2)}, z-score ${lastAnalysisMeta.zscore.toFixed(3)}.`
        : 'Replay BTC/USDT: ainda não executado nesta sessão.', 'dim');
    siriform.setSiriformState('success', 'Relatório gerado nos Logs do Sistema.');
}

function handleShowStatus() {
    log('Status atual: IPAD DIRECT / LOCAL-FIRST / READ_ONLY / FAIL_CLOSED.', 'info');
    siriform.setSiriformState('idle', 'Cyborg operando em READ_ONLY / FAIL_CLOSED.');
    voice.speak('Cyborg operando em READ_ONLY / FAIL_CLOSED.');
}

function handleShowSafetyMode() {
    const text = 'Execução real está bloqueada. O Cyborg está em READ_ONLY / FAIL_CLOSED.';
    log(text, 'info');
    siriform.setSiriformState('blocked');
    voice.speak(text);
}

// Fase 7 — "Analisar sistema" no topbar: combina verificacao de capacidades
// do Safari com verificacao/repair guiado da instalacao local, um so toque.
async function handleAnalyzeSystem() {
    await handleCheckSafari();
    await handleCheckLocalInstall();
}

async function dispatchVoiceCommand(id) {
    switch (id) {
        case 'check-safari': return handleCheckSafari();
        case 'prepare-cyborg': return handlePrepareCyborg();
        case 'run-diagnostics': return handleRunDiagnostics();
        case 'run-replay': return handleRunReplay();
        case 'run-evaluations': return handleRunEvaluations();
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
        siriform.setSiriformState('blocked');
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

// Fase 7 — "Modo avançado": tudo que não é o fluxo normal de um toque fica
// escondido por padrão atrás deste alternador, fora do .bento principal.
function wireAdvancedToggle() {
    const btn = els['btn-tb-advanced'];
    const section = els['advanced-section'];
    if (!btn || !section) return;
    btn.addEventListener('click', () => {
        const show = section.hidden;
        section.hidden = !show;
        btn.textContent = show ? 'Ocultar modo avançado' : 'Modo avançado';
        btn.setAttribute('aria-expanded', show ? 'true' : 'false');
        if (show) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            refreshMetricsPanel();
        }
    });
}

function wireButtons() {
    document.getElementById('btn-check-safari').addEventListener('click', handleCheckSafari);
    document.getElementById('btn-prepare-cyborg').addEventListener('click', handlePrepareCyborg);
    document.getElementById('btn-check-install').addEventListener('click', handleCheckLocalInstall);
    document.getElementById('btn-download-pack').addEventListener('click', handleDownloadPack);
    document.getElementById('btn-import-pack').addEventListener('click', handleImportPack);
    document.getElementById('btn-verify-sha').addEventListener('click', handleVerifySha);
    document.getElementById('btn-install-storage').addEventListener('click', handleInstallStorage);
    document.getElementById('btn-run-diagnostics').addEventListener('click', handleRunDiagnostics);
    document.getElementById('btn-run-replay').addEventListener('click', handleRunReplay);
    const btnEvaluations = document.getElementById('btn-run-evaluations');
    if (btnEvaluations) btnEvaluations.addEventListener('click', handleRunEvaluations);
    document.getElementById('btn-repair-install').addEventListener('click', handleRepairInstall);
    document.getElementById('btn-clear-reinstall').addEventListener('click', handleClearReinstall);
    document.getElementById('btn-add-home').addEventListener('click', handleAddHome);
    document.getElementById('btn-tb-update').addEventListener('click', handleUpdateLocalPack);
    document.getElementById('btn-tb-analyze').addEventListener('click', handleAnalyzeSystem);
    wireAdvancedToggle();
    const btnReport = document.getElementById('btn-export-report');
    if (btnReport) btnReport.addEventListener('click', handleExportReport);
    const btnEvidence = document.getElementById('btn-export-evidence');
    if (btnEvidence) btnEvidence.addEventListener('click', handleExportEvidence);
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
            siriform.setSiriformState('success', 'Pacote importado. Verifique o SHA256 antes de instalar.');
        } catch (err) {
            log(`Erro ao importar: ${err.message}`, 'fail');
            siriform.setSiriformState('warning', 'Não consegui importar esse arquivo.');
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
    metrics.initMetrics(els['siriform-avatar']);
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
    let vault = await refreshVaultAndReplayStatus();
    refreshCyborgReadiness(f, voiceStatus);
    refreshDataPolicyPanel();
    renderExportPanel();

    // Auto-reparo no boot: SÓ quando algo já foi instalado antes (existe meta
    // com checksums) e agora está quebrado — o caso "corrompido/ausente após
    // girar a tela ou reabrir". Numa primeira visita (nada instalado) não
    // auto-instala nada; deixa o usuário tocar em "Preparar / Atualizar Cyborg
    // neste iPad".
    let bootMessaged = false;
    if (vault.status !== 'READY') {
        const prev = await packManager.getInstalledVaultMeta();
        if (prev && prev.checksums) {
            log('Vault não está íntegro e havia instalação anterior — tentando auto-reparo seguro...', 'warn');
            siriform.setSiriformState('repairing', 'Recuperando Vault automaticamente...');
            const r = await packManager.autoRepairVault((m, l) => log(m, l));
            vault = await refreshVaultAndReplayStatus();
            bootMessaged = true;
            if (r.status === 'READY') {
                vaultFreshness = 'ATUALIZADO';
                siriform.setSiriformState('success', 'Vault recuperado automaticamente. Cyborg pronto neste iPad.');
            } else {
                siriform.setSiriformState('warning', 'Não consegui recuperar o Vault sozinho. Toque em "Reparar instalação" no Modo avançado.');
            }
        }
    }

    log('Boot concluido. Modo: IPAD DIRECT / LOCAL-FIRST / READ_ONLY / FAIL_CLOSED.', 'ok');
    if (vault.status === 'READY' && !bootMessaged) {
        siriform.setSiriformState('success', 'Cyborg pronto neste iPad.');
    } else if (vault.status !== 'READY' && !bootMessaged) {
        siriform.setSiriformState('idle', 'Instalação local ainda não preparada. Toque em "Preparar / Atualizar Cyborg neste iPad".');
    }
}

boot();
