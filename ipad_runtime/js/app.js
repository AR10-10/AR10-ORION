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
import * as realDataRegistry from './real-data/registry.js';
import { buildRealAnalysisFrame } from './real-data/analysis-frame.js';
import { DADOS_INSUFICIENTES, NAO_APLICAVEL, EVIDENCE_DATA_FIELDS } from './real-data/schema.js';
import { buildResearchEngineFrame } from './research/research-engine.js';
import { buildTargetTracker, TARGET_STATUS } from './research/target-tracker.js';
import * as persistentState from './memory/persistent-state.js';
import * as evidenceLedger from './memory/evidence-ledger.js';
import { rehydrateSession } from './memory/session-resume.js';
import * as eventBus from './core/event-bus.js';
import * as eventLog from './memory/event-log.js';
import { getCommanderSoldierStatus } from './core/commander-soldier.js';
import * as dataModeLabels from './core/data-mode-labels.js';
import * as snapshotManager from './memory/snapshot-manager.js';
import * as recoveryReport from './memory/recovery-report.js';
import * as hydrationReport from './memory/hydration-report.js';
import * as backupRestorePack from './memory/backup-restore-pack.js';
import * as riskGate from './trading/risk-gate.js';
import * as paperTrading from './trading/paper-trading.js';
import { getLiveStatus } from './trading/live-status.js';
import { getSourceHealthReport } from './real-data/source-health.js';
import { runLocalIntelligenceCycle } from './intelligence/local-brain.js';
import { buildAndRecordReflectionReport } from './intelligence/reflection-engine.js';
import { explainReflectionReport } from './intelligence/siriform-explainer.js';
import { resolveActiveLlmTier } from './intelligence/local-llm-adapter.js';
import { getSafariEdgeStatusReport } from './edge/safari-edge-status.js';
import { getTelegramAuxStatusReport } from './aux/telegram-aux-status.js';
import * as hydrationManager from './hydration/hydration-manager.js';
import { els } from './ui/dom-registry.js';
import { log, classFor, setStatus, setInfo, setStatusWithClass, MACRO_STATE_CLASS, setMacroStatus } from './ui/ui-helpers.js';
import * as liveTicker from './ui/live-ticker.js';

const PROFILES = {
    light: { windowSize: 10, label: 'Light: janela SMA/EMA=10, leitura mais rápida e leve.' },
    balanced: { windowSize: 20, label: 'Balanced: janela SMA/EMA=20, resolução total do replay.' },
    heavy: { windowSize: 40, label: 'Heavy: janela SMA/EMA=40, mais precisão, mais cálculo.' },
};
let currentProfile = 'balanced';

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
let lastReplayDrawData = null; // {closes, rollingSma} do ultimo replay — permite redesenhar o sparkline quando #advanced-section sai de hidden (canvas com rect 0x0 no draw original nao produz nada visivel)
let vaultFreshness = null; // null=nao verificado nesta sessao; so muda apos check real (NO_FAKE_LOCAL_AI_CLAIMS)
let lastVaultStatusObj = null; // cache do retorno de refreshVaultAndReplayStatus(), para computeMacroState()/Executive Summary lerem sem reconsultar o pack-manager
let lastRiskGateConfig = null; // cache do retorno de riskGate.getConfig()/engageKillSwitch()/disengageKillSwitch(), mesmo motivo

// Mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1 — estado do
// Real Data Layer. `sessionHasRealProbe` so vira true depois que UMA sonda
// real desta sessao (rede ou import local) chega a ACTIVE_READ_ONLY; e o que
// distingue "estou mostrando dado revalidado agora" de "estou mostrando
// memoria de uma sessao anterior" (isShowingHistoricalData() abaixo) — nunca
// dizemos que uma fonte esta ativa so porque ela ja esteve ativa um dia.
let activeRealEvidence = null;
let lastRealAnalysisFrame = null;
let lastResearchEngineFrame = null;
let lastTargetTracker = null;
let sessionHasRealProbe = false;
let rehydratedPreviousSession = false;
let rehydratedActiveSourceId = null;
let lastHydrationReport = null;
let lastSourceHealthReport = null;
let lastCommanderSoldierStatus = null;
let lastLocalIntelligenceResult = null;
let lastReflectionReport = null;
let lastSafariEdgeStatus = null;
let lastTelegramAuxStatus = null;
let lastHydrationEngineStatus = null;

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
    // modelInstalled e' sempre false nesta versao: nenhum fluxo de download
    // de modelo existe ainda (ver pack/manifest.models.json > blocking_reason).
    const llmTier = resolveActiveLlmTier(f, false);
    setStatus('st-llm-adapter-tier', llmTier.active_tier);
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
// técnico; análise de mercado REAL exige fonte pública/somente-leitura. O
// estado é recalculado a partir do registry real (nunca hardcoded) — se uma
// sonda real desta sessão chegou a ACTIVE_READ_ONLY, o painel mostra
// DISPONÍVEL; senão o estado honesto é DADOS INSUFICIENTES (NO_FAKE_DATA).
function refreshDataPolicyPanel() {
    const active = realDataRegistry.getActiveReadOnlySources();
    const rm = dataPolicy.realMarketAnalysisStatus(active);
    setStatus('dp-realmode', rm.status);
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
        els['ev-summary'].textContent = `Última execução: ${report.pass}/${report.total} verificações PASS, ${report.fail} FAIL, em ${report.elapsedMs}ms. Detalhe linha a linha na Telemetria ao Vivo e registrado no Activity Log (Memória Viva).`;
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
    EVIDENCE_LEDGER: 'Nenhum Evidence Ledger exportado ainda.',
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
    lastVaultStatusObj = vault;
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
        <div class="af-row"><span class="af-label">Modo</span><span class="af-value">SYNTHETIC_OFFLINE</span></div>
        <div class="af-row"><span class="af-label">Candles</span><span class="af-value">${meta.count}</span></div>
        <div class="af-row af-row-headline"><span class="af-label">Último</span><span class="af-value">${meta.last.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">SMA</span><span class="af-value">${meta.sma.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">EMA</span><span class="af-value">${meta.ema.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">Desvio padrão</span><span class="af-value">${meta.stddev.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">Z-score</span><span class="af-value">${meta.zscore.toFixed(3)}</span></div>
        <div class="af-row"><span class="af-label">Máximo</span><span class="af-value">${meta.max.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">Mínimo</span><span class="af-value">${meta.min.toFixed(2)}</span></div>
        <div class="af-row"><span class="af-label">Engine</span><span class="af-value">v${meta.engineVersion} · ${meta.elapsedMs}ms</span></div>
    `;
}

// Mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1 — render helpers
// do Real Data Layer. `isShowingHistoricalData()` e o unico portao usado nos
// quatro cards (Real Data Layer/AnalysisFrame real/Evidence/Research Engine)
// para decidir se mostramos o aviso "isto e memoria, ainda nao revalidada
// nesta sessao" — nunca apagamos o dado reidratado (o usuario nao volta a
// zero ao reabrir), mas tambem nunca deixamos parecer dado fresco sem uma
// sonda real ter rodado nesta sessao.
function isShowingHistoricalData() {
    return rehydratedPreviousSession && !sessionHasRealProbe;
}

function setHistoricalNote(id, present) {
    const el = els[id];
    if (!el) return;
    el.hidden = !present;
    if (present) {
        el.textContent = 'Memória da sessão anterior — ainda não revalidado nesta sessão. Toque em "Testar fontes reais" para confirmar de novo.';
    }
}

function refreshHistoricalNotes() {
    const present = isShowingHistoricalData();
    setHistoricalNote('real-analysis-frame-session-note', present);
    setHistoricalNote('re-session-note', present);
    setHistoricalNote('research-engine-session-note', present);
    setHistoricalNote('rdl-connector-session-note', present);
}

function classForConnectorState(state) {
    if (state === 'ACTIVE_READ_ONLY') return 'v-ok';
    if (state === 'STALE') return 'v-limited'; // dado real confirmado nesta sessao, porem velho demais para parecer "agora"
    if (state === 'SESSION_PREVIOUS') return 'v-info'; // nunca v-ok: e memoria, nao revalidacao fresca
    if (state === 'PLANNED' || state === 'PROBING' || state === 'REQUIRES_API_KEY') return 'v-pending';
    if (state === 'DEGRADED' || state === 'DADOS_INSUFICIENTES' || state === 'UNSUPPORTED_ON_IPAD') return 'v-limited';
    if (state === 'FUTURE' || state === 'NAO_LISTADO_NO_ROTEIRO_ESTATICO') return 'v-info';
    return 'v-fail'; // FAILED / BLOCKED_BY_CORS / BLOCKED_BY_SCHEMA / BLOCKED_BY_POLICY
}

// FOCO3 — Resumo Executivo (tela principal). Deriva 1 macro-estado a partir
// de sinais que ja existem em outros modulos (orbe, Vault, Risk Gate, Real
// Data Layer) — nunca inventa um numero novo. LIVE_LOCKED de proposito NAO
// entra aqui: e estrutural/permanente (sem rota de execucao no codigo, nao
// uma flag), por isso fica fixo no HTML (#ex-live), nunca calculado em JS.
function computeMacroState() {
    const activityState = els['siriform-avatar'] ? els['siriform-avatar'].getAttribute('data-state') : null;
    if (activityState === 'blocked') return 'FAIL_CLOSED';
    if (activityState === 'thinking' || activityState === 'checking' || activityState === 'diagnosing') return 'ANALYZING';
    if (activityState === 'updating' || activityState === 'repairing') return 'UPDATING';

    if (lastVaultStatusObj && lastVaultStatusObj.status !== 'READY') {
        return lastVaultStatusObj.reason === 'checksum_failed' ? 'FAIL_CLOSED' : 'IDLE';
    }
    if (lastRiskGateConfig && lastRiskGateConfig.kill_switch_engaged) return 'FAIL_CLOSED';
    const activeSources = realDataRegistry.getActiveReadOnlySources();
    if (!activeSources.length) return 'DADOS_INSUFICIENTES';
    if (activeSources.every((a) => realDataRegistry.isStale(a))) return 'DEGRADED'; // real, mas velho demais nesta sessao
    if (vaultFreshness === 'DESATUALIZADO') return 'DEGRADED';
    return 'READY';
}

// Le o estado real de Vault/Risk Gate/Real Data Layer/Paper Trading e pinta
// o chip do orbe + o card "Resumo Executivo" — chamada pelo MutationObserver
// de wireMacroStateObserver() (qualquer setSiriformState(...) ja dispara isto
// de graca) e, como rede de seguranca extra, apos boot() e apos o kill
// switch mudar (que nao necessariamente troca o data-state do orbe).
async function refreshExecutiveSummary() {
    const macro = computeMacroState();
    setMacroStatus('macro-state-chip', macro);
    setMacroStatus('ex-state', macro);
    // Espelha o mesmo macro-estado no wrapper (data-macro-state) so' para o
    // CSS escolher a cor/glow do destaque "hero" — nenhum estado novo, e o
    // mesmo valor que setMacroStatus ja calculou acima.
    if (els['ex-state-row']) els['ex-state-row'].setAttribute('data-macro-state', macro);

    const active = realDataRegistry.getActiveReadOnlySources();
    const freshActive = active.filter((a) => !realDataRegistry.isStale(a));
    const staleActive = active.filter((a) => realDataRegistry.isStale(a));
    if (freshActive.length) {
        setStatusWithClass('ex-source', freshActive.map((a) => a.connector_name).join(', '), classForConnectorState('ACTIVE_READ_ONLY'));
        const latest = freshActive.reduce((acc, a) => (a.last_probed_at && (!acc || a.last_probed_at > acc) ? a.last_probed_at : acc), null);
        setInfo('ex-freshness', latest ? new Date(latest).toLocaleString('pt-BR') : 'agora');
    } else if (staleActive.length) {
        setStatusWithClass('ex-source', `${staleActive.map((a) => a.connector_name).join(', ')} (STALE)`, classForConnectorState('STALE'));
        setInfo('ex-freshness', 'Confirmado nesta sessão, porém desatualizado agora — toque em "Atualizar dados reais".');
    } else if (isShowingHistoricalData() && rehydratedActiveSourceId) {
        const meta = realDataRegistry.getConnectorMeta(rehydratedActiveSourceId);
        setStatusWithClass('ex-source', `${meta ? meta.connector_name : rehydratedActiveSourceId} (sessão anterior)`, classForConnectorState('SESSION_PREVIOUS'));
        setInfo('ex-freshness', 'Memória da sessão anterior — ainda não revalidada nesta sessão.');
    } else {
        setStatusWithClass('ex-source', DADOS_INSUFICIENTES, classForConnectorState('DADOS_INSUFICIENTES'));
        setInfo('ex-freshness', 'Nenhuma fonte real validada nesta sessão ainda.');
    }

    if (lastRiskGateConfig) setStatus('ex-risk', lastRiskGateConfig.kill_switch_engaged ? 'BLOCK' : 'ALLOW');
    setStatus('ex-vault', packStatusLabel(lastVaultStatusObj, vaultFreshness));
    setInfo('ex-report', lastAnalysisMeta
        ? `Replay BTC/USDT analisado · SMA ${lastAnalysisMeta.sma.toFixed(2)} · EMA ${lastAnalysisMeta.ema.toFixed(2)}`
        : 'Nenhum relatório gerado nesta sessão ainda.');

    try {
        const summary = await paperTrading.getPaperSummary();
        setInfo('ex-paper', `${summary.mode} · ${summary.open_positions} posição(ões) aberta(s)`);
    } catch {
        setInfo('ex-paper', 'n/d');
    }

    refreshLiveTicker();
}

// Letreiro Vivo Central — coleta 1 snapshot dos mesmos sinais que
// refreshExecutiveSummary() acima ja le (macro state, conectores reais,
// AnalysisFrame real, Research Engine, Vault/Hydration/Safari Edge, Risk
// Gate). Nenhuma regra de negocio nova: blockedConnectors reusa
// classForConnectorState() (a mesma classificacao do Connector Probe grid)
// para so' listar falha real (v-fail), nunca um estado pendente normal
// (PLANNED/PROBING/STALE) como se fosse alerta critico.
function collectLiveTickerState() {
    const active = realDataRegistry.getActiveReadOnlySources();
    const freshActive = active.filter((a) => !realDataRegistry.isStale(a));
    const blockedConnectors = realDataRegistry.listConnectors()
        .filter((c) => classForConnectorState(c.state) === 'v-fail')
        .map((c) => ({ name: c.connector_name, state: c.state }));

    let rehydratedSourceName = null;
    if (isShowingHistoricalData() && rehydratedActiveSourceId) {
        const meta = realDataRegistry.getConnectorMeta(rehydratedActiveSourceId);
        rehydratedSourceName = meta ? meta.connector_name : rehydratedActiveSourceId;
    }

    return {
        macro: computeMacroState(),
        historical: isShowingHistoricalData(),
        rehydratedSourceName,
        freshSourceNames: freshActive.map((a) => a.connector_name),
        blockedConnectors,
        analysisFrame: lastRealAnalysisFrame,
        freshnessLabel: lastRealAnalysisFrame ? formatFreshnessMs(lastRealAnalysisFrame.freshness) : DADOS_INSUFICIENTES,
        researchFrame: lastResearchEngineFrame,
        targetTracker: lastTargetTracker,
        livePriceInfo: getLivePriceInfo(),
        vaultLabel: packStatusLabel(lastVaultStatusObj, vaultFreshness),
        hydrationStatus: lastHydrationEngineStatus ? lastHydrationEngineStatus.status : null,
        safariEdgeStatus: lastSafariEdgeStatus ? lastSafariEdgeStatus.edge_status : null,
        killSwitchEngaged: lastRiskGateConfig ? lastRiskGateConfig.kill_switch_engaged : null,
    };
}

function refreshLiveTicker() {
    liveTicker.updateLiveTickerFromRuntime(collectLiveTickerState(), els['live-ticker-track']);
}

// MutationObserver no data-state do orbe: unica fonte de verdade das ~80
// chamadas setSiriformState(...) espalhadas pelo arquivo. Em vez de tocar em
// cada call site para manter o Resumo Executivo sincronizado, observamos so
// a mudanca de atributo — custo zero em repouso, sem polling (FOCO9).
function wireMacroStateObserver() {
    const avatar = els['siriform-avatar'];
    if (!avatar || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => { refreshExecutiveSummary(); });
    observer.observe(avatar, { attributes: true, attributeFilter: ['data-state'] });
}

// Connector Probe grid: SEMPRE a verdade viva de registry.js (sessionState),
// nunca tocada pela reidratacao — todo conector nasce PLANNED nesta sessao e
// so muda de estado apos a propria sonda real responder. A unica excecao
// visual e o proprio conector que a Memoria Viva lembra como ativo numa
// sessao anterior: em vez de deixa-lo como "PLANNED" puro (identico a um
// conector nunca testado), ele mostra o rotulo sintetico SESSION_PREVIOUS —
// nunca ACTIVE_READ_ONLY, nunca verde — para que memoria de sessao anterior
// jamais seja confundida com dado revalidado agora (FOCO5: Real Data Layer
// mais claro).
function renderConnectorGrid() {
    const connectors = realDataRegistry.listConnectors();
    const showSessionPrevious = isShowingHistoricalData() && rehydratedActiveSourceId;
    els['rdl-connector-grid'].innerHTML = connectors.map((c) => {
        const isRememberedPrevious = showSessionPrevious && c.connector_id === rehydratedActiveSourceId && c.state === 'PLANNED';
        const isStaleNow = !isRememberedPrevious && realDataRegistry.isStale(c);
        const displayState = isRememberedPrevious ? 'SESSION_PREVIOUS' : (isStaleNow ? 'STALE' : c.state);
        const freshnessLabel = c.evidence ? formatFreshnessMs(c.evidence.freshness_ms) : DADOS_INSUFICIENTES;
        return `<div class="status-row">
            <span class="label">${c.connector_name}<br><span class="rdl-meta-sub">source_id: ${c.connector_id}</span></span>
            <span class="value ${classForConnectorState(displayState)}">${displayState}<br><span class="rdl-meta-sub">freshness: ${freshnessLabel}</span></span>
        </div>`;
    }).join('');

    const active = realDataRegistry.getActiveReadOnlySources();
    const freshActive = active.filter((a) => !realDataRegistry.isStale(a));
    const staleActive = active.filter((a) => realDataRegistry.isStale(a));
    if (freshActive.length) {
        els['rdl-active-source'].textContent = `Fonte ativa: ${freshActive.map((a) => a.connector_name).join(', ')}.`;
    } else if (staleActive.length) {
        els['rdl-active-source'].textContent = `Fonte ativa porém STALE (sondada há mais de 5min nesta sessão): ${staleActive.map((a) => a.connector_name).join(', ')}. Toque em "Atualizar dados reais".`;
    } else if (showSessionPrevious) {
        const meta = realDataRegistry.getConnectorMeta(rehydratedActiveSourceId);
        els['rdl-active-source'].textContent = `Fonte ativa (sessão anterior, ainda não revalidada agora): ${meta ? meta.connector_name : rehydratedActiveSourceId}.`;
    } else {
        els['rdl-active-source'].textContent = 'Fonte ativa: nenhuma nesta sessão ainda.';
    }
    setHistoricalNote('rdl-connector-session-note', Boolean(showSessionPrevious));
}

function formatEvidenceField(value) {
    if (value === DADOS_INSUFICIENTES || value === NAO_APLICAVEL) return value;
    if (Array.isArray(value)) return `${value.length} candles reais`;
    if (value && typeof value === 'object') {
        if ('last_price' in value) return `último preço real: ${value.last_price}`;
        if ('last_candle_volume' in value) return `volume real (última vela): ${value.last_candle_volume}`;
        return JSON.stringify(value);
    }
    return String(value);
}

function renderEvidence(evidence) {
    if (!evidence) {
        els['re-evidence-grid'].innerHTML = '<span class="analysis-frame-empty">Nenhuma evidência real ainda nesta sessão.</span>';
        els['re-missing-fields'].textContent = 'Campos ausentes: —';
        els['re-evidence-hash'].innerHTML = '';
        return;
    }
    const qualityClass = evidence.data_quality === 'COMPLETA_PARA_CAPACIDADES_TENTADAS' ? 'v-ok'
        : (evidence.data_quality === 'PARCIAL' ? 'v-limited' : 'v-fail');
    const identityRows = `
        <div class="status-row"><span class="label">Fonte</span><span class="value v-info">${evidence.source_name}</span></div>
        <div class="status-row"><span class="label">Símbolo</span><span class="value v-info">${evidence.symbol}</span></div>
        <div class="status-row"><span class="label">Timeframe</span><span class="value v-info">${evidence.timeframe}</span></div>
        <div class="status-row"><span class="label">Qualidade do dado</span><span class="value ${qualityClass}">${evidence.data_quality}</span></div>
    `;
    const fieldRows = EVIDENCE_DATA_FIELDS.map((field) => {
        const value = evidence[field];
        const cls = value === DADOS_INSUFICIENTES ? 'v-limited' : (value === NAO_APLICAVEL ? 'v-pending' : 'v-ok');
        return `<div class="status-row"><span class="label">${field}</span><span class="value ${cls}">${formatEvidenceField(value)}</span></div>`;
    }).join('');
    els['re-evidence-grid'].innerHTML = identityRows + fieldRows;
    els['re-missing-fields'].textContent = (evidence.missing_fields && evidence.missing_fields.length)
        ? `Campos ausentes: ${evidence.missing_fields.join(', ')}`
        : 'Campos ausentes: nenhum nesta leitura.';
    els['re-evidence-hash'].innerHTML = `<span class="hash-chip">raw_sample_hash: ${String(evidence.raw_sample_hash).slice(0, 20)}…</span><span class="hash-chip">timestamp: ${evidence.timestamp}</span><span class="hash-chip">fetched_at: ${evidence.fetched_at || '—'}</span>`;
}

// Frescor em prosa curta a partir de freshness_ms (idade do candle no momento
// da sonda, nao idade da sonda em si — ver registry.js:isStale para a outra
// nocao de frescor, a da sondagem). Nunca inventa uma idade: DADOS_INSUFICIENTES
// permanece DADOS_INSUFICIENTES.
function formatFreshnessMs(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return DADOS_INSUFICIENTES;
    if (ms < 60000) return `${Math.round(ms / 1000)}s atrás`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}min atrás`;
    return `${Math.round(ms / 3600000)}h atrás`;
}

function renderRealAnalysisFrame(frame) {
    if (!frame) {
        els['real-analysis-frame-grid'].innerHTML = '<span class="analysis-frame-empty">Sem fonte ACTIVE_READ_ONLY nesta sessão ainda. Teste uma fonte real primeiro.</span>';
        return;
    }
    // Snapshots reidratados de sessao anterior podem ter sido salvos antes de
    // um campo existir no schema atual — nunca deixa undefined/null vazar pro
    // template (mesmo vocabulario DADOS_INSUFICIENTES do resto do app).
    const str = (v) => (v === undefined || v === null ? DADOS_INSUFICIENTES : v);
    const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : str(v));
    // Mesmo portao de isShowingHistoricalData() usado pelo resto do Real Data
    // Layer: um frame com status OK persistido de uma sessao anterior nunca
    // pode se anunciar REAL_READ_ONLY de novo so' porque o campo `status` foi
    // gravado como OK no passado — sem isso o "Modo" contradiz o aviso de
    // memoria da sessao anterior mostrado a poucas linhas de distancia.
    const historical = isShowingHistoricalData();
    const modo = historical ? 'SESSION_PREVIOUS' : (frame.status === 'OK' ? 'REAL_READ_ONLY' : DADOS_INSUFICIENTES);
    els['real-analysis-frame-grid'].innerHTML = `
        <div class="af-row"><span class="af-label">Modo</span><span class="af-value">${modo}</span></div>
        <div class="af-row"><span class="af-label">Ativo</span><span class="af-value">${str(frame.asset)}</span></div>
        <div class="af-row"><span class="af-label">Fonte</span><span class="af-value">${str(frame.source)}</span></div>
        <div class="af-row"><span class="af-label">Timestamp</span><span class="af-value">${str(frame.timestamp)}</span></div>
        <div class="af-row"><span class="af-label">Candles</span><span class="af-value">${str(frame.candles_count)}</span></div>
        <div class="af-row af-row-headline"><span class="af-label">Último</span><span class="af-value">${fmt(frame.last_price)}</span></div>
        <div class="af-row"><span class="af-label">SMA</span><span class="af-value">${fmt(frame.sma)}</span></div>
        <div class="af-row"><span class="af-label">EMA</span><span class="af-value">${fmt(frame.ema)}</span></div>
        <div class="af-row"><span class="af-label">Desvio padrão</span><span class="af-value">${fmt(frame.stddev)}</span></div>
        <div class="af-row"><span class="af-label">Z-score</span><span class="af-value">${typeof frame.zscore === 'number' ? frame.zscore.toFixed(3) : str(frame.zscore)}</span></div>
        <div class="af-row"><span class="af-label">Suporte</span><span class="af-value">${fmt(frame.support)}</span></div>
        <div class="af-row"><span class="af-label">Resistência</span><span class="af-value">${fmt(frame.resistance)}</span></div>
        <div class="af-row"><span class="af-label">Volatilidade</span><span class="af-value">${str(frame.volatility_state)}</span></div>
        <div class="af-row"><span class="af-label">Direção (descritiva)</span><span class="af-value">${str(frame.trend_direction)}</span></div>
        <div class="af-row"><span class="af-label">Volume</span><span class="af-value">${str(frame.volume_status)}</span></div>
        <div class="af-row"><span class="af-label">Qualidade da fonte</span><span class="af-value">${str(frame.data_quality)}</span></div>
        <div class="af-row"><span class="af-label">Frescor do candle</span><span class="af-value">${formatFreshnessMs(frame.freshness)}</span></div>
        <div class="af-row"><span class="af-label">Status</span><span class="af-value">${str(frame.status)}</span></div>
    `;
    if (els['real-analysis-frame-note']) {
        if (historical) {
            els['real-analysis-frame-note'].textContent = 'Leitura descritiva — não é recomendação. Estatística calculada sobre candles de uma sessão anterior (memória local), ainda NÃO revalidada nesta sessão. Toque em "Testar fontes reais" para confirmar de novo antes de confiar nestes números.';
        } else {
            els['real-analysis-frame-note'].textContent = frame.status === 'OK'
                ? 'Leitura descritiva — não é recomendação. Estatística sobre candles reais validados nesta sessão por sonda real.'
                : `DADOS INSUFICIENTES: ${frame.status_reason || 'sem candles reais suficientes'}.`;
        }
    }
}

function renderResearchEngineFrame(frame) {
    const empty = '<span class="analysis-frame-empty">DADOS INSUFICIENTES.</span>';
    if (!frame) {
        els['route-a-long-grid'].innerHTML = empty;
        els['route-b-short-grid'].innerHTML = empty;
        els['route-c-wait-grid'].innerHTML = empty;
        els['research-data-matrix-grid'].innerHTML = empty;
        els['research-data-sufficiency-label'].textContent = 'Data Sufficiency: — / 100';
        return;
    }
    // Snapshots reidratados de sessao anterior podem ter sido gravados antes
    // de base_used/data_sufficiency_score/missing_fields/limitation_reason
    // existirem neste contrato — mesmo cuidado de renderRealAnalysisFrame():
    // nunca deixa undefined/null vazar pro template, cai em DADOS_INSUFICIENTES.
    const str = (v) => (v === undefined || v === null ? DADOS_INSUFICIENTES : v);
    const score = (v) => (Number.isFinite(v) ? `${v}/100` : DADOS_INSUFICIENTES);
    const missing = (fields) => (fields === undefined ? DADOS_INSUFICIENTES : (fields.length ? fields.join(', ') : 'nenhum nesta leitura'));
    const row = (label, value) => `<div class="status-row"><span class="label">${label}</span><span class="value ${(value === DADOS_INSUFICIENTES || value === NAO_APLICAVEL) ? 'v-limited' : 'v-info'}">${value}</span></div>`;
    // Matriz "Dados usados nesta leitura": status real por campo (OK/
    // DADOS_INSUFICIENTES/NAO_APLICAVEL), nunca um terceiro estado inventado.
    const matrixClass = (status) => {
        if (status === 'OK') return 'v-ok';
        if (status === NAO_APLICAVEL) return 'v-pending';
        if (status === DADOS_INSUFICIENTES) return 'v-limited';
        return 'v-info';
    };

    const sufficiency = frame.data_sufficiency;
    if (sufficiency) {
        els['research-data-sufficiency-label'].textContent = sufficiency.label;
        els['research-data-matrix-grid'].innerHTML = (sufficiency.breakdown || []).map((item) =>
            `<div class="status-row"><span class="label">${item.label}</span><span class="value ${matrixClass(item.status)}">${item.status} (${item.points_earned}/${item.points_possible})</span></div>`
        ).join('') || empty;
    } else {
        els['research-data-sufficiency-label'].textContent = 'Data Sufficiency: — / 100';
        els['research-data-matrix-grid'].innerHTML = empty;
    }

    const a = frame.rota_a_long;
    const b = frame.rota_b_short;
    const c = frame.rota_c_wait;
    els['route-a-long-grid'].innerHTML = row('Confiança', a.confidence) + row('Base usada', str(a.base_used))
        + row('Zona de interesse (cenário descritivo)', a.entry_zone) + row('Invalidação', a.invalidation)
        + row('Alvo 1', a.target_1) + row('Alvo 2', a.target_2) + row('Confirmação exigida', a.required_confirmation)
        + row('Data Sufficiency', score(a.data_sufficiency_score)) + row('Dado(s) ausente(s)', missing(a.missing_fields))
        + row('Motivo da limitação', str(a.limitation_reason));
    els['route-b-short-grid'].innerHTML = row('Confiança', b.confidence) + row('Base usada', str(b.base_used))
        + row('Zona de interesse (cenário descritivo)', b.entry_zone) + row('Invalidação', b.invalidation)
        + row('Alvo 1', b.target_1) + row('Alvo 2', b.target_2) + row('Confirmação exigida', b.required_confirmation)
        + row('Data Sufficiency', score(b.data_sufficiency_score)) + row('Dado(s) ausente(s)', missing(b.missing_fields))
        + row('Motivo da limitação', str(b.limitation_reason));
    els['route-c-wait-grid'].innerHTML = row('Motivo', c.reason) + row('Base usada', str(c.base_used))
        + row('Gatilho de reavaliação', c.trigger_to_reevaluate) + row('Dado ausente', c.data_missing)
        + row('Condição mais segura', c.safer_condition) + row('Data Sufficiency', score(c.data_sufficiency_score))
        + row('Motivo da limitação', str(c.limitation_reason));
}

// Mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1 — BTC Live
// Panel / Target Tracker (research/target-tracker.js). getLivePriceInfo()
// so' le o ticker da evidencia real ja ativa nesta sessao (nunca dispara
// sonda nova); refreshTargetTracker() compara esse preco vivo contra o
// snapshot fixado por handleGenerateRealAnalysis() — alvo/suporte/
// resistencia nunca sao recalculados aqui, so' lidos do snapshot via
// buildTargetTracker(). Chamado depois de qualquer evento que mude preco
// vivo OU snapshot (testar fontes, atualizar dados, gerar analise, importar
// CSV, reidratar sessao) e pelo auto-refresh silencioso mais abaixo.
function getLivePriceInfo() {
    if (!activeRealEvidence || !activeRealEvidence.ticker || typeof activeRealEvidence.ticker.last_price !== 'number') {
        return { value: DADOS_INSUFICIENTES, mode: DADOS_INSUFICIENTES, source: DADOS_INSUFICIENTES };
    }
    const active = realDataRegistry.getActiveReadOnlySources();
    const entry = active.find((a) => a.connector_id === activeRealEvidence.source_id);
    const historical = isShowingHistoricalData();
    let mode;
    if (historical) mode = 'SESSION_PREVIOUS';
    else if (entry && realDataRegistry.isStale(entry)) mode = 'STALE';
    else if (entry) mode = 'REAL_READ_ONLY';
    else mode = DADOS_INSUFICIENTES;
    return { value: activeRealEvidence.ticker.last_price, mode, source: activeRealEvidence.source_name };
}

function formatSignedNumber(v, decimals = 2) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return DADOS_INSUFICIENTES;
    return `${v > 0 ? '+' : ''}${v.toFixed(decimals)}`;
}

function formatSignedPct(v, decimals = 2) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return DADOS_INSUFICIENTES;
    return `${v > 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}

function classForTargetStatus(status) {
    if (status === TARGET_STATUS.TARGET_TOUCHED) return 'v-ok';
    if (status === TARGET_STATUS.INVALIDATED) return 'v-fail';
    if (status === TARGET_STATUS.APPROACHING_TARGET || status === TARGET_STATUS.STALE_REANALYZE) return 'v-limited';
    if (status === TARGET_STATUS.DADOS_INSUFICIENTES) return 'v-pending';
    return 'v-info';
}

function renderTargetTrackerRoute(gridId, route) {
    const str = (v) => (v === undefined || v === null ? DADOS_INSUFICIENTES : v);
    const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : str(v));
    const pct = (v) => (typeof v === 'number' ? `${v.toFixed(2)}%` : str(v));
    els[gridId].innerHTML = `
        <div class="status-row"><span class="label">Status</span><span class="value ${classForTargetStatus(route.status)}">${route.status}</span></div>
        <div class="status-row"><span class="label">Alvo 1</span><span class="value v-info">${fmt(route.target_1)}</span></div>
        <div class="status-row"><span class="label">Invalidação</span><span class="value v-info">${fmt(route.invalidation)}</span></div>
        <div class="status-row"><span class="label">Distância até alvo</span><span class="value v-info">${pct(route.distance_to_target_pct)}</span></div>
        <div class="status-row"><span class="label">Distância até invalidação</span><span class="value v-info">${pct(route.distance_to_invalidation_pct)}</span></div>
    `;
}

/** Renderiza o BTC Live Panel inteiro: preco vivo (linha hero, cor por
 *  data-live-mode — nunca por direcao long/short), snapshot da analise e as
 *  duas rotas do Target Tracker. tracker vem sempre de buildTargetTracker()
 *  (nunca null — emptyTracker() cobre o caso sem snapshot/sem preco). */
function renderTargetTracker(tracker, livePriceInfo) {
    const str = (v) => (v === undefined || v === null ? DADOS_INSUFICIENTES : v);
    const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : str(v));
    const mode = (livePriceInfo && livePriceInfo.mode) || DADOS_INSUFICIENTES;

    if (els['bl-price-row']) els['bl-price-row'].dataset.liveMode = mode;
    if (els['bl-current-price']) els['bl-current-price'].textContent = fmt(livePriceInfo ? livePriceInfo.value : DADOS_INSUFICIENTES);
    if (els['bl-current-source']) els['bl-current-source'].textContent = str(livePriceInfo ? livePriceInfo.source : DADOS_INSUFICIENTES);
    if (els['bl-current-freshness']) els['bl-current-freshness'].textContent = activeRealEvidence ? formatFreshnessMs(activeRealEvidence.freshness_ms) : DADOS_INSUFICIENTES;
    if (els['bl-current-mode']) {
        els['bl-current-mode'].textContent = mode;
        els['bl-current-mode'].className = `value ${mode === 'REAL_READ_ONLY' ? 'v-ok' : (mode === 'DADOS_INSUFICIENTES' ? 'v-fail' : 'v-limited')}`;
    }

    if (els['bl-snapshot-price']) els['bl-snapshot-price'].textContent = fmt(tracker.snapshot_price);
    if (els['bl-snapshot-time']) els['bl-snapshot-time'].textContent = str(tracker.snapshot_generated_at);
    if (els['bl-snapshot-age']) els['bl-snapshot-age'].textContent = formatFreshnessMs(tracker.snapshot_age_ms);
    if (els['bl-price-diff']) {
        els['bl-price-diff'].textContent = tracker.price_diff === DADOS_INSUFICIENTES
            ? DADOS_INSUFICIENTES
            : `${formatSignedNumber(tracker.price_diff)} / ${formatSignedPct(tracker.price_diff_pct)}`;
    }

    renderTargetTrackerRoute('bl-route-long-grid', tracker.rota_a_long);
    renderTargetTrackerRoute('bl-route-short-grid', tracker.rota_b_short);

    if (els['bl-reanalyze-banner']) {
        els['bl-reanalyze-banner'].hidden = !tracker.reanalyze_recommended;
        if (tracker.reanalyze_recommended) {
            els['bl-reanalyze-banner'].textContent = `Reavaliar análise recomendado: ${tracker.reanalyze_reasons.join(', ')}. Toque em "Gerar AnalysisFrame real" de novo.`;
        }
    }
}

function refreshTargetTracker() {
    const livePriceInfo = getLivePriceInfo();
    const tracker = buildTargetTracker({
        snapshot: { frame: lastRealAnalysisFrame, research: lastResearchEngineFrame },
        livePrice: livePriceInfo,
    });
    lastTargetTracker = tracker;
    renderTargetTracker(tracker, livePriceInfo);
    return tracker;
}

// Mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1 — handlers do
// Real Data Layer. Cada handler reusa so os modulos ja existentes
// (real-data/registry.js, real-data/analysis-frame.js, research/research-
// engine.js, memory/*) — nenhuma chamada nova de rede fora desses modulos,
// nenhum order_send/newOrder/placeOrder, nenhum endpoint privado.
async function persistProbeResult(result) {
    await persistentState.recordProbeResult(result.connector_id, result);
    if (result.evidence) {
        await evidenceLedger.appendEvidence({ connector_id: result.connector_id, state: result.state, evidence: result.evidence });
    }
}

async function handleTestRealSources() {
    siriform.setSiriformState('checking', 'Sondando fontes reais públicas (sem chave, sem endpoint privado)...');
    log('=== TESTAR FONTES REAIS ===', 'info');
    try {
        const results = await realDataRegistry.probeAllNetworkSources({
            symbol: 'BTC',
            onTransition: (id, state) => {
                log(`Conector ${id}: ${state}`, state === 'ACTIVE_READ_ONLY' ? 'ok' : (state === 'PROBING' ? 'dim' : 'warn'));
                renderConnectorGrid();
            },
        });
        for (const r of results) await persistProbeResult(r);
        renderConnectorGrid();
        refreshDataPolicyPanel();
        await renderSourceHealthCard();

        const active = results.find((r) => r.state === 'ACTIVE_READ_ONLY');
        if (active) {
            sessionHasRealProbe = true;
            rehydratedActiveSourceId = null;
            activeRealEvidence = active.evidence;
            renderEvidence(activeRealEvidence);
            refreshHistoricalNotes();
            const meta = realDataRegistry.getConnectorMeta(active.connector_id);
            log(`Fonte real ativa nesta sessão: ${meta ? meta.connector_name : active.connector_id}.`, 'ok');
            siriform.setSiriformState('success', `Fonte real validada: ${meta ? meta.connector_name : active.connector_id}.`);
        } else {
            log('Nenhum conector real ficou ACTIVE_READ_ONLY nesta sondagem — DADOS_INSUFICIENTES.', 'warn');
            siriform.setSiriformState('warning', 'Nenhuma fonte real pôde ser validada agora. DADOS_INSUFICIENTES.');
        }
        refreshTargetTracker();
    } catch (err) {
        log(`Erro ao sondar fontes reais: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui sondar as fontes reais agora.');
    }
}

// Nucleo compartilhado entre o botao "Atualizar dados reais" (silent=false,
// log e voz do Siriform) e o auto-refresh silencioso do BTC Live Panel
// (silent=true, mais abaixo) — reproba so' a(s) fonte(s) ja ACTIVE_READ_ONLY
// nesta sessao, nunca sonda fontes novas (isso continua sendo so' o botao
// explicito "Testar fontes reais"). Nunca toca lastRealAnalysisFrame/
// lastResearchEngineFrame: o snapshot da analise so' muda em
// handleGenerateRealAnalysis(). Retorna false sem efeito nenhum quando nao
// ha fonte ativa para reprobar (o caller decide o que fazer nesse caso).
async function refreshActiveConnectorsEvidence({ silent = false } = {}) {
    const active = realDataRegistry.getActiveReadOnlySources();
    if (!active.length) return false;
    for (const conn of active) {
        const result = await realDataRegistry.probeNetworkConnector(conn.connector_id, {
            symbol: activeRealEvidence?.symbol || 'BTC',
            onTransition: silent ? undefined : () => renderConnectorGrid(),
        });
        await persistProbeResult(result);
        if (result.state === 'ACTIVE_READ_ONLY') {
            sessionHasRealProbe = true;
            rehydratedActiveSourceId = null;
            activeRealEvidence = result.evidence;
        }
    }
    renderConnectorGrid();
    refreshDataPolicyPanel();
    await renderSourceHealthCard();
    renderEvidence(activeRealEvidence);
    refreshHistoricalNotes();
    refreshTargetTracker();
    return true;
}

async function handleRefreshRealData() {
    const active = realDataRegistry.getActiveReadOnlySources();
    if (!active.length) {
        log('Atualizar dados reais: nenhuma fonte ACTIVE_READ_ONLY nesta sessão ainda — sondando todas de novo.', 'info');
        await handleTestRealSources();
        return;
    }
    siriform.setSiriformState('checking', 'Atualizando dados da fonte real ativa...');
    log('=== ATUALIZAR DADOS REAIS ===', 'info');
    try {
        await refreshActiveConnectorsEvidence({ silent: false });
        log('Dados reais atualizados a partir da fonte ativa.', 'ok');
        siriform.setSiriformState('success', 'Dados reais atualizados.');
    } catch (err) {
        log(`Erro ao atualizar dados reais: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui atualizar os dados reais agora.');
    }
}

// Auto-refresh do preco vivo do BTC Live Panel (spec: "Nao fazer loop
// pesado. Nao sobrecarregar Safari. Nao ficar chamando API rapido demais.").
// So' roda quando ha fonte ACTIVE_READ_ONLY nesta sessao e a aba esta
// visivel; nunca sonda fontes novas, nunca toca siriform/log/voz — so'
// reproba a mesma fonte ja validada e atualiza preco/Target Tracker. Uma
// falha aqui e' silenciosa de proposito: o proximo getActiveReadOnlySources()/
// isStale() ja refletira isso na UI (FAILED/STALE) sem alarmar o usuario por
// uma falha de rede transitoria em segundo plano.
const LIVE_PRICE_REFRESH_MS = 30 * 1000;
let livePriceRefreshTimer = null;

async function silentLivePriceTick() {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
        await refreshActiveConnectorsEvidence({ silent: true });
    } catch {
        // silencioso de proposito — ver comentario acima.
    }
}

function startLivePriceAutoRefresh() {
    if (livePriceRefreshTimer) return;
    livePriceRefreshTimer = setInterval(silentLivePriceTick, LIVE_PRICE_REFRESH_MS);
}

function handleImportRealCsv() {
    siriform.pulseListening();
    els['real-data-import-input'].click();
}

async function handleGenerateRealAnalysis() {
    if (!sessionHasRealProbe || !activeRealEvidence) {
        log('Gerar AnalysisFrame real: nenhuma fonte validada por sonda real nesta sessão ainda.', 'warn');
        siriform.setSiriformState('warning', 'Teste uma fonte real primeiro (a sonda precisa rodar nesta sessão).');
        return;
    }
    siriform.setSiriformState('thinking', 'Calculando AnalysisFrame sobre candles reais...');
    log('=== GERAR ANALYSISFRAME REAL ===', 'info');
    try {
        const profile = PROFILES[currentProfile];
        const frame = await buildRealAnalysisFrame({ evidence: activeRealEvidence, workerClient, windowSize: profile.windowSize });
        lastRealAnalysisFrame = frame;
        renderRealAnalysisFrame(frame);
        await persistentState.recordAnalysisFrame(frame);

        const freshSourceCount = realDataRegistry.getActiveReadOnlySources().filter((a) => !realDataRegistry.isStale(a)).length;
        const context = { historical: isShowingHistoricalData(), freshSourceCount };
        const research = buildResearchEngineFrame({ frame, evidence: activeRealEvidence, context });
        lastResearchEngineFrame = research;
        renderResearchEngineFrame(research);
        await persistentState.recordResearchFrame(research);

        refreshHistoricalNotes();
        refreshTargetTracker();

        if (frame.status === 'OK') {
            log(`AnalysisFrame real OK — ${frame.candles_count} candles, último ${frame.last_price}, SMA ${frame.sma}, EMA ${frame.ema}.`, 'ok');
            siriform.setSiriformState('success', 'AnalysisFrame real gerado a partir de candles reais validados.');
        } else {
            log(`AnalysisFrame real: DADOS_INSUFICIENTES (${frame.status_reason}).`, 'warn');
            siriform.setSiriformState('warning', `DADOS INSUFICIENTES: ${frame.status_reason}.`);
        }
    } catch (err) {
        log(`Erro ao gerar AnalysisFrame real: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui gerar o AnalysisFrame real agora.');
    }
}

// AR10 Local Intelligence Engine — reusa o CalculationFrame que ja existe
// (RealAnalysisFrame real, preferido, ou meta do replay sintetico so como
// exercicio matematico) em vez de recalcular nada via WASM de novo. Math/
// memoria/regras locais, sem API paga e sem rede nova; nunca um sinal.
function buildCalculationFrameInput() {
    if (lastRealAnalysisFrame && lastRealAnalysisFrame.status === 'OK') {
        const f = lastRealAnalysisFrame;
        return {
            sma: f.sma, ema: f.ema, stddev: f.stddev, zscore: f.zscore,
            last_price: f.last_price, support: f.support, resistance: f.resistance,
            data_mode: 'REAL_READ_ONLY', symbol: f.asset, source_id: f.source,
        };
    }
    if (lastAnalysisMeta) {
        return {
            sma: lastAnalysisMeta.sma, ema: lastAnalysisMeta.ema, stddev: lastAnalysisMeta.stddev, zscore: lastAnalysisMeta.zscore,
            last_price: lastAnalysisMeta.last, support: lastAnalysisMeta.min, resistance: lastAnalysisMeta.max,
            data_mode: 'SYNTHETIC_OFFLINE', symbol: 'BTCUSDT_REPLAY', source_id: 'synthetic_replay',
        };
    }
    return null;
}

function classForSetupLabel(label) {
    if (label === 'PAPER_ONLY') return 'v-ok';
    if (label === 'BLOQUEADO') return 'v-fail';
    if (label === 'OBSERVAR') return 'v-limited';
    return 'v-pending'; // DADOS_INSUFICIENTES
}

function classForDataMode(mode) {
    if (mode === 'REAL_READ_ONLY') return 'v-ok';
    if (mode === 'SYNTHETIC_OFFLINE') return 'v-limited';
    return 'v-pending'; // DADOS_INSUFICIENTES
}

function renderLocalIntelligenceCard(result) {
    if (!result) {
        setStatusWithClass('li-final-label', 'DADOS_INSUFICIENTES', 'v-pending');
        setStatusWithClass('li-data-mode', DADOS_INSUFICIENTES, 'v-pending');
        return;
    }
    const score = result.score;
    setStatusWithClass('li-final-label', score.final_label, classForSetupLabel(score.final_label));
    setInfo('li-confidence', result.confidence_label);
    setInfo('li-source-quality', `${score.source_quality}/100`);
    setInfo('li-volatility', score.volatility_score ?? 'n/d');
    setInfo('li-trend', score.trend_score ?? 'n/d');
    setInfo('li-risk', score.risk_score ?? 'n/d');
    setStatusWithClass('li-data-mode', result.source_data_mode, classForDataMode(result.source_data_mode));
    els['li-explanation'].textContent = result.explanation_pt_br;
}

function renderReflectionReportCard(report) {
    els['li-reflection-text'].textContent = report
        ? explainReflectionReport(report)
        : 'Nenhum Reflection Report gerado ainda nesta sessão.';
}

async function handleRunLocalIntelligence() {
    siriform.setSiriformState('thinking', 'Rodando Local Intelligence Engine sobre dados já existentes nesta sessão...');
    log('=== RODAR LOCAL INTELLIGENCE ===', 'info');
    try {
        const frame = buildCalculationFrameInput();
        const active = realDataRegistry.getActiveReadOnlySources().length > 0;
        const sourceHealthEntry = (lastSourceHealthReport && frame)
            ? lastSourceHealthReport.sources.find((s) => s.connector_id === frame.source_id)
            : null;
        const result = await runLocalIntelligenceCycle({
            frame,
            active,
            sourceHealthEntry,
            riskGateConfig: lastRiskGateConfig,
            symbol: frame ? frame.symbol : null,
        });
        lastLocalIntelligenceResult = result;
        renderLocalIntelligenceCard(result);
        log(`Local Intelligence: leitura ${result.score.final_label} (confiança ${result.confidence_label}).`, result.score.final_label === 'BLOQUEADO' ? 'fail' : 'ok');
        siriform.setSiriformState('success', 'Local Intelligence Engine gerou uma leitura local. Não é sinal, não é ordem.');
    } catch (err) {
        log(`Erro ao rodar Local Intelligence: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui rodar a Local Intelligence Engine agora.');
    }
}

async function handleRunReflection() {
    siriform.setSiriformState('thinking', 'Gerando Reflection Report local desta sessão...');
    log('=== GERAR REFLECTION REPORT ===', 'info');
    try {
        const paperSummary = await paperTrading.getPaperSummary();
        const report = await buildAndRecordReflectionReport({ riskGateConfig: lastRiskGateConfig, paperSummary });
        lastReflectionReport = report;
        renderReflectionReportCard(report);
        log(`Reflection Report gerado: ${report.what_changed}`, 'ok');
        siriform.setSiriformState('success', 'Reflection Report gerado e gravado no Evidence Ledger.');
    } catch (err) {
        log(`Erro ao gerar Reflection Report: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui gerar o Reflection Report agora.');
    }
}

function handleShowEvidence() {
    if (!activeRealEvidence) {
        log('Ver fonte/evidência: nenhuma evidência real nesta sessão ainda.', 'warn');
        siriform.setSiriformState('warning', 'Teste uma fonte real primeiro para gerar evidência.');
        return;
    }
    renderEvidence(activeRealEvidence);
    const ev = activeRealEvidence;
    log(`Evidência ativa: fonte=${ev.source_name} símbolo=${ev.symbol} timeframe=${ev.timeframe} qualidade=${ev.data_quality} hash=${String(ev.raw_sample_hash).slice(0, 20)}…`, 'info');
    siriform.setSiriformState('success', `Evidência de ${ev.source_name}: qualidade ${ev.data_quality}.`);
}

function handleShowMissingFields() {
    if (!activeRealEvidence) {
        log('Ver campos ausentes: nenhuma evidência real nesta sessão ainda.', 'warn');
        siriform.setSiriformState('warning', 'Teste uma fonte real primeiro.');
        return;
    }
    const missing = activeRealEvidence.missing_fields || [];
    const text = missing.length
        ? `Campos ausentes nesta leitura: ${missing.join(', ')}. Eles aparecem como DADOS_INSUFICIENTES porque deveriam existir mas a sonda real não confirmou — nunca são inventados.`
        : 'Nenhum campo crítico ausente nesta leitura. Campos estruturalmente impossíveis para este instrumento aparecem como NÃO_APLICÁVEL, não como erro.';
    log(`Campos ausentes: ${text}`, 'info');
    siriform.setSiriformState('success', text);
    voice.speak(text);
}

function buildRealDataExplanation() {
    const connectors = realDataRegistry.listConnectors();
    const active = connectors.filter((c) => c.state === 'ACTIVE_READ_ONLY');
    const blocked = connectors.filter((c) => c.state !== 'ACTIVE_READ_ONLY' && c.state !== 'PLANNED' && c.state !== 'PROBING');
    const parts = [];

    if (isShowingHistoricalData()) {
        parts.push('Estou mostrando memória de uma sessão anterior, ainda não revalidada agora nesta sessão.');
    }

    if (active.length) {
        parts.push(`Fonte usada: ${active.map((a) => a.connector_name).join(', ')} — validada por uma sonda real (fetch de verdade) nesta sessão, então o estado é ACTIVE_READ_ONLY.`);
    } else if (activeRealEvidence) {
        parts.push(`Última fonte conhecida: ${activeRealEvidence.source_name}, mas ela ainda não foi revalidada nesta sessão.`);
    } else {
        parts.push('Nenhuma fonte real foi validada ainda nesta sessão. Toque em "Testar fontes reais" primeiro.');
    }

    for (const b of blocked) {
        const reason = b.probe_detail?.reason || b.state;
        parts.push(`${b.connector_name} está em ${b.state} (motivo: ${reason}) — resultado real da última sonda, nunca um bloqueio decorativo.`);
    }

    if (activeRealEvidence) {
        const missing = activeRealEvidence.missing_fields || [];
        parts.push(missing.length
            ? `Campos ausentes na última leitura: ${missing.join(', ')} — aparecem como DADOS_INSUFICIENTES, nunca inventados.`
            : 'Nenhum campo crítico ficou ausente na última leitura desta fonte.');
    }

    if (lastRealAnalysisFrame && lastRealAnalysisFrame.status !== 'OK') {
        parts.push(`O AnalysisFrame real está em DADOS_INSUFICIENTES porque ${lastRealAnalysisFrame.status_reason}.`);
    }

    parts.push('A Research Engine sempre mostra as três rotas — LONG, SHORT e WAIT/NO TRADE — porque nenhuma heurística de fonte única deveria decidir por apenas um lado; a ROTA C de esperar é sempre uma leitura legítima, nunca uma rota vazia.');
    parts.push('A execução real continua bloqueada por política (DISABLED_BY_POLICY): nenhum botão ou comando de voz aqui envia, abre ou fecha ordem — READ_ONLY e FAIL_CLOSED permanecem intactos.');

    return parts.join(' ');
}

function handleExplainRealData() {
    const text = buildRealDataExplanation();
    if (els['rdl-explanation-text']) els['rdl-explanation-text'].textContent = text;
    log(`Explicar dados reais: ${text}`, 'info');
    siriform.setSiriformState('success', 'Explicação dos dados reais gerada pelo Siriform.');
    voice.speak(text);
}

// Session Resume: reaplica o ultimo estado real conhecido (IndexedDB) sem
// jamais marcar um conector como ACTIVE_READ_ONLY so por causa de memoria —
// isShowingHistoricalData() (definido acima) e que decide se os cards
// mostram o aviso de "ainda nao revalidado nesta sessao".
async function applyRehydratedSession(resume) {
    rehydratedPreviousSession = resume.has_previous_session;
    const { state } = resume;
    rehydratedActiveSourceId = state.activeSource || null;

    if (rehydratedActiveSourceId && state.evidenceByConnector && state.evidenceByConnector[rehydratedActiveSourceId]) {
        activeRealEvidence = state.evidenceByConnector[rehydratedActiveSourceId];
    }
    lastRealAnalysisFrame = state.lastAnalysisFrame || lastRealAnalysisFrame;
    lastResearchEngineFrame = state.lastResearchFrame || lastResearchEngineFrame;

    renderConnectorGrid();
    renderEvidence(activeRealEvidence);
    renderRealAnalysisFrame(lastRealAnalysisFrame);
    renderResearchEngineFrame(lastResearchEngineFrame);
    refreshHistoricalNotes();
    refreshTargetTracker();
    return resume;
}

async function handleRehydrateSession() {
    siriform.setSiriformState('checking', 'Reidratando sessão a partir da memória local (IndexedDB)...');
    log('=== REIDRATAR SESSÃO ===', 'info');
    try {
        const resume = await rehydrateSession();
        await applyRehydratedSession(resume);
        if (resume.has_previous_session) {
            log(`Sessão anterior encontrada: ${resume.ledger.length} evidência(s) no Evidence Ledger.`, 'ok');
            siriform.setSiriformState('success', 'Sessão reidratada a partir da memória local. Ainda não revalidada — toque em "Testar fontes reais" para confirmar de novo.');
        } else {
            log('Nenhuma sessão anterior encontrada nesta instalação.', 'info');
            siriform.setSiriformState('idle', 'Nenhuma sessão anterior encontrada ainda.');
        }
    } catch (err) {
        log(`Erro ao reidratar sessão: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui reidratar a sessão agora.');
    }
}

async function handleExportEvidenceLedger() {
    siriform.setSiriformState('thinking', 'Exportando Evidence Ledger...');
    log('=== EXPORTAR EVIDENCE LEDGER ===', 'info');
    try {
        const ledger = await evidenceLedger.getLedger();
        const payload = {
            generated_at: new Date().toISOString(),
            mode: 'IPAD_DIRECT / LOCAL_FIRST / READ_ONLY / FAIL_CLOSED',
            execution: 'DISABLED_BY_POLICY',
            entries: ledger,
            no_secrets: true,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const entry = exporter.downloadArtifact({ type: 'EVIDENCE_LEDGER', ext: 'json', blob, purpose: 'Histórico de Evidence real (Real Data Layer) exportado pelo usuário.' });
        renderExportPanel();
        log(`Evidence Ledger exportado com nome único: ${entry.filename} (${ledger.length} entrada(s)).`, 'ok');
        siriform.setSiriformState('success', 'Evidence Ledger exportado para o app Arquivos.');
    } catch (err) {
        log(`Erro ao exportar Evidence Ledger: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui exportar o Evidence Ledger agora.');
    }
}

// Boot silencioso: mostra na hora o ultimo estado real conhecido (Real Data
// Layer) sem precisar o usuario tocar em "Reidratar sessao" manualmente —
// mesma logica do handler, so sem o "thinking/checking" do toque manual.
async function bootRehydrateSession() {
    try {
        const resume = await rehydrateSession();
        await applyRehydratedSession(resume);
        if (resume.has_previous_session) {
            log(`Sessão anterior do Real Data Layer restaurada da memória local: ${resume.ledger.length} evidência(s) no ledger.`, 'info');
        }
        return resume;
    } catch (err) {
        log(`Falha ao reidratar memória do Real Data Layer: ${err.message}`, 'warn');
        return null;
    }
}

// "Atualizacao disponivel": o service-worker.js chama skipWaiting() sem
// condicao no install, entao a troca de controlador (controllerchange) so'
// acontece quando uma versao nova ASSUME uma pagina que ja estava sendo
// controlada por uma versao anterior — nunca no primeiro install (por isso
// hadControllerAtRegister e' checado ANTES do reload, nunca depois).
function showUpdateBanner() {
    if (!els['sw-update-banner']) return;
    els['sw-update-banner'].hidden = false;
    log('Atualização do runtime disponível (nova versão já pré-armazenada pelo Service Worker).', 'info');
    siriform.setSiriformState('updating', 'Atualização disponível — toque em "Atualizar agora" quando quiser aplicar.');
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        log('Service Worker indisponivel neste navegador.', 'warn');
        return;
    }
    try {
        const hadControllerAtRegister = Boolean(navigator.serviceWorker.controller);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hadControllerAtRegister) showUpdateBanner();
        });

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
    eventBus.emit('evaluations_report_completed', {
        source: eventBus.SOURCE.SYSTEM,
        severity: report.fail === 0 ? eventBus.SEVERITY.OK : eventBus.SEVERITY.WARN,
        payload: { pass: report.pass, fail: report.fail, total: report.total, elapsed_ms: report.elapsedMs },
    });
    renderActivityLog();
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
        lastReplayDrawData = { closes: replayDatasetCache.candles.map((c) => c.c), rollingSma: result.rollingSma };
        setStatus('st-replay', 'INSTALLED');
        setStatus('cr-replay', 'OK');
        siriform.setSiriformState('success', 'Replay BTC/USDT pronto para análise.');
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
        '# AR10 CYBORG 1.0 PRO — Relatório de Sessão',
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
        (() => {
            const rm = dataPolicy.realMarketAnalysisStatus(realDataRegistry.getActiveReadOnlySources());
            return `- Análise de mercado real: ${rm.status} (${rm.reason})`;
        })(),
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
        case 'test-real-sources': return handleTestRealSources();
        case 'refresh-real-data': return handleRefreshRealData();
        case 'generate-real-analysis': return handleGenerateRealAnalysis();
        case 'explain-real-data': return handleExplainRealData();
        case 'rehydrate-session': return handleRehydrateSession();
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
            // Secao estava hidden no draw original do replay -> canvas tinha
            // rect 0x0 e nao desenhou nada visivel. Redesenha agora que o
            // canvas tem layout real, sem rodar o replay de novo.
            if (lastReplayDrawData && els['replay-canvas']) {
                replayEngine.drawSparkline(els['replay-canvas'], lastReplayDrawData.closes, lastReplayDrawData.rollingSma);
            }
        }
    });
}

// Mission 2 — Commander/Soldier, Memória Viva, Source Health, Risk Gate,
// Paper Trading, Live Status, Backup/Recovery. Cada render* le um modulo
// backend real (sem nenhum numero inventado em app.js); cada handle* aciona
// uma acao real (Risk Gate, Paper Trading, Snapshot Manager, Backup Pack).

function renderCommanderSoldierCard() {
    const status = getCommanderSoldierStatus();
    lastCommanderSoldierStatus = status;
    setStatus('cs-commander-status', status.commander.status);
    setStatus('cs-soldier-status', status.soldier.status);
    setStatus('cs-sync-bridge-status', status.sync_bridge.status);
}

// Safari Edge: telemetria local real (rAF/visibility/storage backend),
// nunca autoritativa — reler periodicamente porque latencia/frames/foco
// mudam enquanto a aba fica aberta (unico card desta tela com refresh por
// intervalo; todos os outros so atualizam em boot/acao do usuario porque
// representam estado que so muda por evento, nao por tempo).
async function renderSafariEdgeCard() {
    const commanderSoldier = lastCommanderSoldierStatus || getCommanderSoldierStatus();
    const backend = await storage.activeBackend();
    const status = getSafariEdgeStatusReport({
        soldierStatus: commanderSoldier.soldier.status,
        lastSequenceSeen: eventBus.getRecentEvents(1)[0]?.seq,
        focusedSymbol: lastRealAnalysisFrame?.asset,
        focusedTimeframe: lastRealAnalysisFrame?.timeframe,
        storageBackend: backend,
    });
    lastSafariEdgeStatus = status;
    setStatus('se-edge-status', status.edge_status);
    setStatus('se-device', status.device);
    setStatus('se-session-id', status.session_id);
    setStatus('se-last-sequence', status.last_sequence_seen);
    setStatus('se-render-latency', status.render_latency_ms);
    setStatus('se-dropped-frames', status.dropped_frames);
    setStatus('se-visible-panels', status.visible_panels);
    setStatus('se-focused-symbol', status.focused_symbol);
    setStatus('se-focused-timeframe', status.focused_timeframe);
    setStatus('se-connection-state', status.connection_state);
    setStatus('se-storage-mirror', status.storage_mirror);
    setStatus('se-is-authoritative', status.is_authoritative ? 'TRUE' : 'FALSE');
    setStatus('se-soldier-validation', status.soldier_validation);
}

// Telegram AUX/Quarantine: politica declarada desta fase (token/webhook
// desligados, execucao proibida) — constante, nao telemetria, por isso so
// renderiza uma vez no boot, igual a Live Status/Risk Gate.
function renderTelegramAuxCard() {
    const status = getTelegramAuxStatusReport();
    lastTelegramAuxStatus = status;
    setStatus('ta-telegram-layer', status.telegram_layer);
    setStatus('ta-bot-token', status.bot_token);
    setStatus('ta-webhook', status.webhook);
    setStatus('ta-live-execution', status.live_execution);
    setStatus('ta-signal-quarantine', status.signal_quarantine);
    setStatus('ta-source-trust', status.source_trust);
    setStatus('ta-allowed-commands', status.allowed_commands);
    setStatus('ta-risk-gate', status.risk_gate);
    setStatus('ta-event-ledger', status.event_ledger);
    setStatus('ta-is-authoritative', status.is_authoritative ? 'TRUE' : 'FALSE');
}

// Hydration Engine: armazenamento progressivo no Safari/iPad (pacotes
// pequenos, hash SHA-256, checkpoint retomável) — ver js/hydration/*.js.
// Cada campo aqui reflete getHydrationEngineStatusReport() real; nenhum
// número é inventado em app.js.
async function renderHydrationEngineCard() {
    const status = await hydrationManager.getHydrationEngineStatusReport();
    lastHydrationEngineStatus = status;
    const mb = (n) => (n / (1024 * 1024)).toFixed(2) + ' MB';
    // Anel/percentual sao só leitura visual derivada de completed_count/total_count
    // ja presentes no relatorio — nenhum numero novo, so' um foco visual distinto
    // do status-grid plano do resto do painel.
    const pct = status.total_count > 0 ? Math.round((status.completed_count / status.total_count) * 100) : 0;
    if (els['he-ring']) {
        els['he-ring'].style.setProperty('--he-progress', String(pct));
        els['he-ring'].setAttribute('data-engine-state', status.status);
    }
    if (els['he-progress-pct']) els['he-progress-pct'].textContent = `${pct}%`;
    setStatus('he-status', status.status);
    setInfo('he-current-package', status.current_package_name || (status.is_running ? 'Selecionando próximo pacote…' : 'Nenhum (ocioso)'));
    setInfo('he-session', status.session_id || 'Nenhuma sessão iniciada');
    setInfo('he-completed', `${status.completed_count} / ${status.total_count}`);
    setInfo('he-pending', String(status.pending_count));
    setInfo('he-failed', String(status.failed_count));
    setInfo('he-bytes', `${mb(status.bytes_downloaded)} / ${mb(status.bytes_total)}`);
    setInfo('he-checkpoint', status.last_checkpoint_at ? new Date(status.last_checkpoint_at).toLocaleString('pt-BR') : 'Nunca');
    setStatus('he-quota', status.quota.status);
    setStatus('he-resumable', status.has_resumable_checkpoint ? 'OK' : 'AUSENTE');
    setStatus('he-offline-available', status.local_availability_map.offline_mode_available ? 'OK' : 'PARTIAL');
    setStatus('he-fail-closed', status.fail_closed ? 'FAIL_CLOSED' : 'OK');
    setInfo('he-last-error', status.last_error || 'Nenhum');
}

async function handleStartOrResumeHydration() {
    siriform.setSiriformState('thinking', 'Hidratando armazenamento local em pacotes pequenos...');
    log('=== HYDRATION ENGINE: iniciar/retomar ===', 'info');
    const result = await hydrationManager.startOrResumeHydration((m, l) => log(m, l));
    await renderHydrationEngineCard();
    if (result.status === hydrationManager.HYDRATION_STATUS.COMPLETED) {
        siriform.setSiriformState('success', 'Hidratação concluída — Vault local pronto.');
    } else if (result.status === hydrationManager.HYDRATION_STATUS.PAUSED) {
        siriform.setSiriformState('idle', `Hidratação pausada (${result.pauseReason}). Toque novamente para retomar.`);
    } else {
        siriform.setSiriformState('warning', 'Hidratação não foi concluída — veja o console técnico.');
    }
    renderActivityLog();
}

function handlePauseHydration() {
    hydrationManager.requestPause();
    log('Pausa solicitada — Hydration Engine para de forma limpa entre pacotes (sem travar).', 'info');
    siriform.setSiriformState('idle', 'Pausa solicitada. Vai parar antes do próximo pacote.');
}

async function handleVerifyHydrationIntegrity() {
    siriform.setSiriformState('checking', 'Verificando integridade do Vault (Hydration Engine)...');
    log('=== HYDRATION ENGINE: verificar integridade ===', 'info');
    await hydrationManager.verifyHydrationIntegrity((m, l) => log(m, l));
    await refreshVaultAndReplayStatus();
    await renderHydrationEngineCard();
    siriform.setSiriformState('success', 'Verificação de integridade concluída.');
}

async function handleRepairHydration() {
    siriform.setSiriformState('repairing', 'Reparando hidratação/Vault local...');
    log('=== HYDRATION ENGINE: reparar ===', 'info');
    const result = await hydrationManager.repairHydration((m, l) => log(m, l));
    await refreshVaultAndReplayStatus();
    await renderHydrationEngineCard();
    siriform.setSiriformState(
        result.status === 'READY' ? 'success' : 'warning',
        result.status === 'READY' ? 'Reparo concluído — Vault READY.' : 'Reparo não restaurou o Vault — veja o console técnico.'
    );
    renderActivityLog();
}

async function handleExportHydrationReport() {
    siriform.setSiriformState('thinking', 'Gerando relatório curto da Hydration Engine...');
    log('=== EXPORTAR RELATÓRIO: HYDRATION ENGINE ===', 'info');
    const status = lastHydrationEngineStatus || await hydrationManager.getHydrationEngineStatusReport();
    const report = {
        generated_at: new Date().toISOString(),
        engine: 'AR10 Cyborg Hydration Engine (armazenamento progressivo Safari/iPad)',
        ...status,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const entry = exporter.downloadArtifact({
        type: 'HYDRATION_ENGINE_REPORT',
        ext: 'json',
        blob,
        purpose: 'Relatório curto da Hydration Engine (status, progresso, quota, Local Availability Map) — sem segredos.',
    });
    log(`Relatório da Hydration Engine exportado: ${entry.filename}.`, 'ok');
    siriform.setSiriformState('success', 'Relatório da Hydration Engine exportado.');
    renderActivityLog();
}

function activityLogRowClass(severity) {
    if (severity === 'FAIL') return 'al-fail';
    if (severity === 'CRITICAL') return 'al-critical';
    if (severity === 'WARN') return 'al-warn';
    if (severity === 'OK') return 'al-ok';
    return '';
}

async function renderActivityLog() {
    const entries = await eventLog.getRecentPersisted(50);
    setInfo('al-count', `${entries.length} evento(s) persistido(s) (até 50 mais recentes)`);
    els['al-list'].innerHTML = entries.length
        ? entries.map((e) => `
            <div class="activity-log-row ${activityLogRowClass(e.severity)}">
                <span class="al-time">${e.at.slice(11, 19)}</span>
                <span class="al-type">${e.event_type}</span>
                <span class="al-severity">${e.severity}</span>
            </div>
        `).join('')
        : '<span class="analysis-frame-empty">Nenhum evento persistido ainda nesta instalação.</span>';
}

// Boot real da Memória Viva: confere a integridade do snapshot da sessao
// anterior, tira um snapshot novo do estado de fato reidratado, promove a
// Last Good State so quando a integridade bate, e persiste um RecoveryReport
// que reflete o resultado real — nunca um status decorativo fixo.
async function runMemoryAliveBootSequence(resume) {
    const sections = [
        { name: 'Real Data Layer (Evidence Ledger)', hasData: Boolean(resume && resume.ledger && resume.ledger.length > 0), hasError: !resume, count: resume ? resume.ledger.length : 0 },
        { name: 'Fonte ativa anterior', hasData: Boolean(resume && resume.state && resume.state.activeSource), hasError: !resume },
        { name: 'AnalysisFrame anterior', hasData: Boolean(resume && resume.state && resume.state.lastAnalysisFrame), hasError: !resume },
    ];

    const previousSnapshot = await snapshotManager.getCurrentSnapshot();
    const previousIntact = previousSnapshot ? await snapshotManager.verifySnapshotIntegrity(previousSnapshot) : null;
    sections.push({ name: 'Snapshot anterior (integridade)', hasData: previousIntact === true, hasError: previousIntact === false });

    const recoveryHistory = await recoveryReport.getRecoveryHistory();
    sections.push({ name: 'Histórico de Recovery Reports', hasData: recoveryHistory.length > 0, count: recoveryHistory.length });

    const report = hydrationReport.buildHydrationReport(sections);
    lastHydrationReport = report;

    const newSnapshot = await snapshotManager.takeSnapshot(resume ? resume.state : {});

    let status = 'CLEAN_BOOT';
    let restoredFrom = 'NONE';
    const restoredEventCount = resume ? resume.ledger.length : 0;
    let missingEventCount = 0;
    let actionsRequired = [];

    if (!previousSnapshot) {
        status = 'CLEAN_BOOT';
    } else if (previousIntact) {
        await snapshotManager.promoteToLastGood(newSnapshot);
        status = resume && resume.has_previous_session ? 'RECOVERED' : 'CLEAN_BOOT';
        restoredFrom = 'CURRENT_SNAPSHOT_VERIFIED';
    } else {
        const lastGood = await snapshotManager.getLastGoodState();
        const lastGoodIntact = lastGood ? await snapshotManager.verifySnapshotIntegrity(lastGood) : false;
        if (lastGoodIntact) {
            status = 'PARTIAL_RECOVERY';
            restoredFrom = 'LAST_GOOD_STATE';
            missingEventCount = 1;
            actionsRequired = ['Snapshot mais recente estava corrompido; estado restaurado a partir do último Last Good State íntegro.'];
        } else {
            status = 'FAILED';
            missingEventCount = 1;
            actionsRequired = ['Nem o snapshot atual nem o Last Good State passaram a verificação de integridade — revise a Memória Viva manualmente.'];
        }
    }

    await recoveryReport.buildAndPersistRecoveryReport({
        restoredFrom,
        lastGoodStateHash: newSnapshot.hash,
        restoredEventCount,
        missingEventCount,
        status,
        actionsRequired,
    });

    eventBus.emit('memory_alive_boot_sequence_completed', {
        source: eventBus.SOURCE.SYSTEM,
        severity: status === 'FAILED' ? eventBus.SEVERITY.FAIL : (status === 'PARTIAL_RECOVERY' ? eventBus.SEVERITY.WARN : eventBus.SEVERITY.OK),
        payload: { status, hydration_overall: report.overall_status },
    });

    await renderMemoryAliveCard();
}

async function renderMemoryAliveCard() {
    const [persistedLog, currentSnapshot, lastGood, latestRecovery] = await Promise.all([
        eventLog.getRecentPersisted(0),
        snapshotManager.getCurrentSnapshot(),
        snapshotManager.getLastGoodState(),
        recoveryReport.getLatestRecoveryReport(),
    ]);
    setInfo('mv-event-log-count', `${persistedLog.length} evento(s) persistido(s)`);
    setStatus('mv-snapshot-status', currentSnapshot ? 'OK' : 'AUSENTE');
    setStatus('mv-last-good-status', lastGood ? 'OK' : 'AUSENTE');
    setStatus('mv-recovery-status', latestRecovery ? latestRecovery.status : 'SEM_HISTORICO');
    setStatus('mv-hydration-status', lastHydrationReport ? lastHydrationReport.overall_status : 'AUSENTE');
    renderActivityLog();
}

async function handleManualSnapshot() {
    siriform.setSiriformState('thinking', 'Tirando snapshot manual do estado atual...');
    log('=== TIRAR SNAPSHOT AGORA ===', 'info');
    const resume = await rehydrateSession();
    const snapshot = await snapshotManager.takeSnapshot(resume.state);
    const intact = await snapshotManager.verifySnapshotIntegrity(snapshot);
    if (intact) await snapshotManager.promoteToLastGood(snapshot);
    eventBus.emit('memory_manual_snapshot_taken', { severity: eventBus.SEVERITY.OK, payload: { hash: snapshot.hash, promoted: intact } });
    log(`Snapshot manual tirado (hash ${snapshot.hash.slice(0, 12)}...)${intact ? ' e promovido a Last Good State.' : '.'}`, 'ok');
    siriform.setSiriformState('success', 'Snapshot manual concluído.');
    await renderMemoryAliveCard();
}

async function renderSourceHealthCard() {
    const report = await getSourceHealthReport();
    lastSourceHealthReport = report;
    setInfo('sh-active-count', `Fontes ACTIVE_READ_ONLY nesta sessão: ${report.active_read_only_now}`);
    setInfo('sh-total-count', `Total de fontes no roadmap: ${report.total_sources} (${report.with_real_probe_code} com sonda real implementada)`);
    els['sh-grid'].innerHTML = report.sources.map((s) => `
        <div class="status-row"><span class="label">${s.connector_name}</span><span class="value ${classForConnectorState(s.live_state || s.roadmap_status)}">${s.live_state || s.roadmap_status}</span></div>
    `).join('');
}

function setKillSwitchStatus(engaged) {
    setStatus('rg-kill-switch', engaged ? 'BLOCK' : 'ALLOW');
}

async function renderRiskGateCard() {
    const cfg = await riskGate.getConfig();
    lastRiskGateConfig = cfg;
    setKillSwitchStatus(cfg.kill_switch_engaged);
    setInfo('rg-max-drawdown', `${cfg.max_drawdown_pct}%`);
    setInfo('rg-max-position', `${cfg.max_position_size_quote} (quote)`);
    setStatus('rg-require-stop', cfg.require_stop_loss ? 'OK' : 'FAIL');
    setInfo('rg-min-quality', cfg.min_source_data_quality);
}

async function handleEngageKillSwitch() {
    const next = await riskGate.engageKillSwitch();
    lastRiskGateConfig = next;
    setKillSwitchStatus(next.kill_switch_engaged);
    log('Kill switch ACIONADO — toda nova ordem (mesmo Paper) fica bloqueada até ser desativada manualmente.', 'warn');
    siriform.setSiriformState('warning', 'Kill switch acionado. Paper Trading bloqueado.');
    renderActivityLog();
    refreshExecutiveSummary();
}

async function handleDisengageKillSwitch() {
    const next = await riskGate.disengageKillSwitch();
    lastRiskGateConfig = next;
    setKillSwitchStatus(next.kill_switch_engaged);
    log('Kill switch DESACIONADO — novas ordens de Paper Trading voltam a ser avaliadas normalmente pelo Risk Gate.', 'ok');
    siriform.setSiriformState('success', 'Kill switch desacionado.');
    renderActivityLog();
    refreshExecutiveSummary();
}

async function renderPaperTradingCard() {
    const [summary, openPositions, cfg] = await Promise.all([
        paperTrading.getPaperSummary(),
        paperTrading.getOpenPositions(),
        riskGate.getConfig(),
    ]);
    setInfo('pt-mode', summary.mode);
    setInfo('pt-open-positions', String(summary.open_positions));
    setInfo('pt-closed-trades', String(summary.closed_trades));
    setInfo('pt-realized-pnl', `${summary.realized_pnl_quote.toFixed(2)} (quote)`);
    setStatus('pt-drawdown', summary.current_drawdown_pct >= cfg.max_drawdown_pct ? 'FAIL' : 'OK');
    els['pt-positions-grid'].innerHTML = openPositions.length
        ? openPositions.map((t) => `
            <div class="status-row" data-trade-id="${t.trade_id}">
                <span class="label">${t.side} · ${t.sizeQuote} @ ${t.entryPrice} · SL ${t.stopLoss}</span>
                <span class="value v-info">${t.trade_id}</span>
                <button class="rt-btn btn-pt-close" data-trade-id="${t.trade_id}" type="button">Fechar</button>
            </div>
        `).join('')
        : '<span class="analysis-frame-empty">Nenhuma posição de papel aberta nesta sessão.</span>';
    els['pt-positions-grid'].querySelectorAll('.btn-pt-close').forEach((btn) => {
        btn.addEventListener('click', () => handleClosePaperPosition(btn.dataset.tradeId));
    });
}

async function handleOpenPaperPosition() {
    siriform.setSiriformState('thinking', 'Avaliando ordem de Paper Trading pelo Risk Gate...');
    log('=== ABRIR POSIÇÃO DE PAPEL (LONG) ===', 'info');
    const evidence = activeRealEvidence;
    const price = evidence && evidence.ticker && typeof evidence.ticker.last_price === 'number' ? evidence.ticker.last_price : null;
    if (!price) {
        const blockedMsg = 'Paper bloqueado: preço real não validado nesta sessão.';
        log(`${blockedMsg} (nenhuma fonte real ACTIVE_READ_ONLY nesta sessão tem preço/ticker.last_price ainda)`, 'warn');
        siriform.setSiriformState('warning', blockedMsg);
        if (els['pt-block-note']) {
            els['pt-block-note'].hidden = false;
            els['pt-block-note'].textContent = blockedMsg;
        }
        return;
    }
    if (els['pt-block-note']) els['pt-block-note'].hidden = true;
    const cfg = await riskGate.getConfig();
    const order = {
        side: 'LONG',
        sizeQuote: Math.min(50, cfg.max_position_size_quote),
        stopLoss: price * 0.98,
        entryPrice: price,
        sourceConnectorId: evidence.source_id,
        sourceDataQuality: evidence.data_quality,
    };
    const result = await paperTrading.openPaperPosition(order);
    if (result.opened) {
        log(`Posição de papel aberta: ${result.trade.trade_id} (${result.trade.side} ${result.trade.sizeQuote} @ ${result.trade.entryPrice}).`, 'ok');
        siriform.setSiriformState('success', 'Posição de papel aberta.');
    } else {
        log(`Risk Gate bloqueou a ordem de papel: ${result.decision.reasons.join(' ')}`, 'warn');
        siriform.setSiriformState('warning', 'Risk Gate bloqueou esta ordem de papel.');
    }
    await renderPaperTradingCard();
    renderActivityLog();
}

async function handleClosePaperPosition(tradeId) {
    const openPositions = await paperTrading.getOpenPositions();
    const trade = openPositions.find((t) => t.trade_id === tradeId);
    if (!trade) return;
    const evidence = activeRealEvidence;
    const price = evidence && evidence.ticker && typeof evidence.ticker.last_price === 'number' ? evidence.ticker.last_price : trade.entryPrice;
    const result = await paperTrading.closePaperPosition(tradeId, price);
    if (result.closed) {
        log(`Posição de papel fechada: ${tradeId} · PnL realizado: ${result.trade.realizedPnlQuote.toFixed(2)} (quote).`, result.trade.realizedPnlQuote >= 0 ? 'ok' : 'warn');
        siriform.setSiriformState(result.trade.realizedPnlQuote >= 0 ? 'success' : 'warning', `Posição fechada. PnL: ${result.trade.realizedPnlQuote.toFixed(2)}.`);
    } else {
        log(`Não foi possível fechar a posição ${tradeId}: ${result.reason}.`, 'warn');
    }
    await renderPaperTradingCard();
    renderActivityLog();
}

async function handleClearPaperLedger() {
    await paperTrading.clearPaperLedger();
    log('Ledger de Paper Trading limpo manualmente.', 'info');
    siriform.setSiriformState('idle', 'Ledger de Paper Trading limpo.');
    await renderPaperTradingCard();
}

function renderLiveStatusCard() {
    const status = getLiveStatus();
    setInfo('ls-mode', status.mode);
    setStatus('ls-status', status.status);
    setInfo('ls-reasons', status.reasons.join(' '));
    setInfo('ls-unlock-requires', status.unlock_requires.join(' '));
}

async function handleExportBackup() {
    siriform.setSiriformState('thinking', 'Empacotando memória viva para exportação...');
    log('=== EXPORTAR MEMÓRIA VIVA (BACKUP) ===', 'info');
    try {
        const pack = await backupRestorePack.buildBackupPack();
        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
        const entry = exporter.downloadArtifact({ type: 'MEMORY_BACKUP', ext: 'json', blob, purpose: 'Backup completo da Memória Viva (Real Data Layer, Evidence Ledger, Event Log, Snapshots, Recovery History) — sem segredos.' });
        renderExportPanel();
        els['br-last-backup'].textContent = `Último backup: ${entry.filename} (gerado ${pack.generated_at.slice(11, 19)}).`;
        log(`Memória viva exportada com nome único: ${entry.filename}.`, 'ok');
        siriform.setSiriformState('success', 'Memória viva exportada para o app Arquivos.');
    } catch (err) {
        log(`Erro ao exportar memória viva: ${err.message}`, 'fail');
        siriform.setSiriformState('warning', 'Não consegui exportar a memória viva agora.');
    }
    renderActivityLog();
}

function handleImportBackup() {
    siriform.pulseListening();
    els['br-import-input'].click();
}

function defaultCardSummary(cardEl) {
    const title = cardEl.querySelector('h2')?.textContent?.trim() || 'Resumo';
    const rows = Array.from(cardEl.querySelectorAll('.status-row')).map((row) => {
        const label = row.querySelector('.label')?.textContent?.trim() || '';
        const value = row.querySelector('.value')?.textContent?.trim() || '';
        return `${label}: ${value}`;
    });
    const body = rows.length ? rows.join(' · ') : 'Sem dados estruturados neste card ainda.';
    return { title, body };
}

const CUSTOM_CARD_SUMMARY = {
    'commander-soldier-panel': () => ({
        title: 'Commander / Soldier',
        body: lastCommanderSoldierStatus ? lastCommanderSoldierStatus.siriform_summary : 'Status ainda não carregado nesta sessão.',
    }),
    'source-health-panel': () => ({
        title: 'Source Health',
        body: lastSourceHealthReport ? lastSourceHealthReport.siriform_summary : 'Source Health ainda não carregado nesta sessão.',
    }),
    'memory-alive-panel': () => ({
        title: 'Memória Viva',
        body: lastHydrationReport ? lastHydrationReport.siriform_summary : 'Hydration Report ainda não carregado nesta sessão.',
    }),
    'live-status-panel': () => {
        const ls = getLiveStatus();
        return { title: 'Live Trading', body: ls.siriform_summary };
    },
    'safari-edge-layer-panel': () => ({
        title: 'Safari Assisted Edge Layer',
        body: lastSafariEdgeStatus ? lastSafariEdgeStatus.siriform_summary : 'Safari Edge ainda não foi lido nesta sessão.',
    }),
    'telegram-aux-panel': () => ({
        title: 'Telegram AUX / Quarantine',
        body: lastTelegramAuxStatus ? lastTelegramAuxStatus.siriform_summary : 'Telegram AUX ainda não foi lido nesta sessão.',
    }),
};

function openStatusModal(title, body) {
    els['status-modal-title'].textContent = title;
    els['status-modal-body'].textContent = body;
    els['status-modal'].hidden = false;
}

function closeStatusModal() {
    els['status-modal'].hidden = true;
}

function wireStatusCardModal() {
    document.querySelectorAll('section.card[tabindex]').forEach((card) => {
        card.setAttribute('role', 'button');
        card.addEventListener('click', (ev) => {
            if (ev.target.closest('button, a, input, label, summary')) return;
            const custom = CUSTOM_CARD_SUMMARY[card.id];
            const { title, body } = custom ? custom() : defaultCardSummary(card);
            openStatusModal(title, body);
        });
        card.addEventListener('keydown', (ev) => {
            if (ev.target !== card || (ev.key !== 'Enter' && ev.key !== ' ')) return;
            ev.preventDefault();
            card.click();
        });
    });
    if (els['btn-status-modal-close']) els['btn-status-modal-close'].addEventListener('click', closeStatusModal);
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
    // FOCO3 — os mesmos 4 botoes do topbar/quick-actions, espelhados no card
    // Resumo Executivo para nao depender so do header sticky; reusam os
    // mesmos handlers (nenhuma logica nova/duplicada).
    if (els['ex-btn-prepare']) els['ex-btn-prepare'].addEventListener('click', handlePrepareCyborg);
    if (els['ex-btn-analyze']) els['ex-btn-analyze'].addEventListener('click', handleAnalyzeSystem);
    if (els['ex-btn-report']) els['ex-btn-report'].addEventListener('click', handleShowReport);
    if (els['ex-btn-advanced']) els['ex-btn-advanced'].addEventListener('click', () => els['btn-tb-advanced'].click());
    const btnSwUpdateReload = document.getElementById('btn-sw-update-reload');
    if (btnSwUpdateReload) btnSwUpdateReload.addEventListener('click', () => window.location.reload());
    const btnSwUpdateDismiss = document.getElementById('btn-sw-update-dismiss');
    if (btnSwUpdateDismiss) btnSwUpdateDismiss.addEventListener('click', () => { els['sw-update-banner'].hidden = true; });
    wireAdvancedToggle();
    const btnReport = document.getElementById('btn-export-report');
    if (btnReport) btnReport.addEventListener('click', handleExportReport);
    const btnEvidence = document.getElementById('btn-export-evidence');
    if (btnEvidence) btnEvidence.addEventListener('click', handleExportEvidence);

    const btnTestRealSources = document.getElementById('btn-test-real-sources');
    if (btnTestRealSources) btnTestRealSources.addEventListener('click', handleTestRealSources);
    const btnRefreshRealData = document.getElementById('btn-refresh-real-data');
    if (btnRefreshRealData) btnRefreshRealData.addEventListener('click', handleRefreshRealData);
    const btnImportRealCsv = document.getElementById('btn-import-real-csv');
    if (btnImportRealCsv) btnImportRealCsv.addEventListener('click', handleImportRealCsv);
    const btnGenerateRealAnalysis = document.getElementById('btn-generate-real-analysis');
    if (btnGenerateRealAnalysis) btnGenerateRealAnalysis.addEventListener('click', handleGenerateRealAnalysis);
    if (els['bl-btn-refresh-now']) els['bl-btn-refresh-now'].addEventListener('click', handleRefreshRealData);
    const btnShowEvidence = document.getElementById('btn-show-evidence');
    if (btnShowEvidence) btnShowEvidence.addEventListener('click', handleShowEvidence);
    const btnShowMissingFields = document.getElementById('btn-show-missing-fields');
    if (btnShowMissingFields) btnShowMissingFields.addEventListener('click', handleShowMissingFields);
    const btnExplainRealData = document.getElementById('btn-explain-real-data');
    if (btnExplainRealData) btnExplainRealData.addEventListener('click', handleExplainRealData);
    const btnRehydrateSession = document.getElementById('btn-rehydrate-session');
    if (btnRehydrateSession) btnRehydrateSession.addEventListener('click', handleRehydrateSession);
    const btnExportEvidenceLedger = document.getElementById('btn-export-evidence-ledger');
    if (btnExportEvidenceLedger) btnExportEvidenceLedger.addEventListener('click', handleExportEvidenceLedger);

    if (els['btn-mv-snapshot']) els['btn-mv-snapshot'].addEventListener('click', handleManualSnapshot);
    if (els['btn-rg-engage']) els['btn-rg-engage'].addEventListener('click', handleEngageKillSwitch);
    if (els['btn-rg-disengage']) els['btn-rg-disengage'].addEventListener('click', handleDisengageKillSwitch);
    if (els['btn-li-run']) els['btn-li-run'].addEventListener('click', handleRunLocalIntelligence);
    if (els['btn-li-reflect']) els['btn-li-reflect'].addEventListener('click', handleRunReflection);
    if (els['btn-pt-open']) els['btn-pt-open'].addEventListener('click', handleOpenPaperPosition);
    if (els['btn-pt-clear']) els['btn-pt-clear'].addEventListener('click', handleClearPaperLedger);
    if (els['btn-br-export']) els['btn-br-export'].addEventListener('click', handleExportBackup);
    if (els['btn-br-import']) els['btn-br-import'].addEventListener('click', handleImportBackup);
    if (els['btn-al-refresh']) els['btn-al-refresh'].addEventListener('click', () => renderActivityLog());

    if (els['btn-he-start']) els['btn-he-start'].addEventListener('click', handleStartOrResumeHydration);
    if (els['btn-he-pause']) els['btn-he-pause'].addEventListener('click', handlePauseHydration);
    if (els['btn-he-verify']) els['btn-he-verify'].addEventListener('click', handleVerifyHydrationIntegrity);
    if (els['btn-he-repair']) els['btn-he-repair'].addEventListener('click', handleRepairHydration);
    if (els['btn-he-export']) els['btn-he-export'].addEventListener('click', handleExportHydrationReport);

    if (els['br-import-input']) {
        els['br-import-input'].addEventListener('change', async (ev) => {
            const file = ev.target.files && ev.target.files[0];
            ev.target.value = '';
            if (!file) return;
            siriform.setSiriformState('checking', 'Lendo backup da memória viva...');
            log('=== RESTAURAR MEMÓRIA VIVA (BACKUP) ===', 'info');
            try {
                const pack = JSON.parse(await file.text());
                const result = await backupRestorePack.restoreBackupPack(pack);
                if (result.restored) {
                    log('Memória viva restaurada a partir do backup.', 'ok');
                    siriform.setSiriformState('success', 'Memória viva restaurada. Atualizando cards...');
                    await renderMemoryAliveCard();
                    await renderPaperTradingCard();
                    const resume = await rehydrateSession();
                    await applyRehydratedSession(resume);
                } else {
                    log(`Restauração bloqueada: ${result.reason}.`, 'warn');
                    siriform.setSiriformState('warning', `Não restaurei o backup: ${result.reason}.`);
                }
            } catch (err) {
                log(`Erro ao restaurar backup: ${err.message}`, 'fail');
                siriform.setSiriformState('warning', 'Não consegui ler esse arquivo de backup.');
            }
            renderActivityLog();
        });
    }

    document.getElementById('btn-close-modal').addEventListener('click', () => { els['home-modal'].hidden = true; });
    document.getElementById('qa-diagnostics').addEventListener('click', handleRunDiagnostics);
    document.getElementById('qa-replay').addEventListener('click', handleRunReplay);
    document.getElementById('qa-analysis').addEventListener('click', handleExplainAnalysis);
    document.getElementById('qa-report').addEventListener('click', handleShowReport);
    if (els['mic-button']) els['mic-button'].addEventListener('click', handleMicButton);
    if (els['btn-voice-info']) {
        els['btn-voice-info'].addEventListener('click', () => openStatusModal(
            'Siriform Voice',
            'Exemplos: "Verificar Safari", "Mostrar status", "Rodar diagnóstico". O Siriform Voice só lê o estado deste runtime e toca os mesmos botões da tela — nunca envia ordem, nunca abre live trading e nunca sai de READ_ONLY/FAIL_CLOSED. Comando fora dessa lista aparece como "bloqueado por política", nunca falha silenciosa.'
        ));
    }
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

    els['real-data-import-input'].addEventListener('change', async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        ev.target.value = '';
        if (!file) return;
        siriform.setSiriformState('checking', 'Lendo arquivo local (sem rede)...');
        log(`=== IMPORTAR CSV/JSON LOCAL: ${file.name} ===`, 'info');
        try {
            const result = await realDataRegistry.probeLocalImport({
                file,
                symbol: 'IMPORTADO',
                onTransition: () => renderConnectorGrid(),
            });
            await persistProbeResult(result);
            renderConnectorGrid();
            refreshDataPolicyPanel();
            if (result.state === 'ACTIVE_READ_ONLY') {
                sessionHasRealProbe = true;
                rehydratedActiveSourceId = null;
                activeRealEvidence = result.evidence;
                renderEvidence(activeRealEvidence);
                refreshHistoricalNotes();
                log('Arquivo local importado e validado como evidência real.', 'ok');
                siriform.setSiriformState('success', 'Arquivo local importado e validado.');
            } else {
                log(`Importação não passou da sonda: ${result.state}.`, 'warn');
                siriform.setSiriformState('warning', `Importação bloqueada: ${result.state}.`);
            }
            refreshTargetTracker();
        } catch (err) {
            log(`Erro ao importar arquivo local: ${err.message}`, 'fail');
            siriform.setSiriformState('warning', 'Não consegui importar esse arquivo.');
        }
    });
}

async function boot() {
    siriform.initSiriform({
        avatar: els['siriform-avatar'],
        caption: els['siriform-caption'],
        tag: els['siriform-state-tag'],
        mic: els['mic-button'],
        micStatus: els['mic-status-label'],
    });
    metrics.initMetrics(els['siriform-avatar']);
    wireMacroStateObserver();
    siriform.setSiriformState('thinking', 'Inicializando runtime local...');
    log('AR10 Cyborg 1.0 PRO (codinome interno AR10_CYBORG_2_IPAD_ONE_TAP_CLOUD_RUNTIME_V1) — boot iniciado.', 'info');
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
    eventLog.wireToEventBus();
    renderCommanderSoldierCard();
    const resume = await bootRehydrateSession();
    await runMemoryAliveBootSequence(resume);
    await renderSourceHealthCard();
    await renderRiskGateCard();
    await renderPaperTradingCard();
    renderLiveStatusCard();
    renderTelegramAuxCard();
    await renderSafariEdgeCard();
    setInterval(renderSafariEdgeCard, 2000);

    await renderHydrationEngineCard();
    if (await hydrationManager.hasResumableCheckpoint()) {
        log('Hydration Engine: checkpoint retomável encontrado — retomando automaticamente...', 'info');
        await hydrationManager.startOrResumeHydration((m, l) => log(m, l));
        await renderHydrationEngineCard();
    }
    hydrationManager.wireAutoResume((m, l) => log(m, l));

    wireStatusCardModal();

    // Letreiro Vivo Central — inicia depois que Vault/Risk Gate/Real Data
    // Layer/Hydration/Safari Edge ja tem leitura real desta sessao acima,
    // para o primeiro tick do letreiro nao mostrar DADOS_INSUFICIENTES so'
    // por ter rodado cedo demais no boot.
    liveTicker.startLiveTicker(collectLiveTickerState, els['live-ticker-track']);

    // BTC Live Panel: preco vivo desta sessao reprobado a cada 30s (so'
    // quando ha fonte ACTIVE_READ_ONLY e a aba esta visivel — ver
    // silentLivePriceTick acima). Comeca depois do live ticker pelo mesmo
    // motivo do comentario acima: nao reprobar antes do Real Data Layer ter
    // lido o estado real desta sessao pelo menos uma vez.
    startLivePriceAutoRefresh();

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
    await refreshExecutiveSummary();
}

boot();
