// hydration-manager.js — orquestrador do Hydration Engine. Compõe os outros
// 7 módulos desta pasta; é o ÚNICO arquivo que ipad_runtime/js/app.js precisa
// importar. Política específica do Safari (aba em background, bateria baixa,
// pausa pedida pelo usuário) vive aqui — hydration-queue.js permanece
// genérico/platform-agnostic.
//
// Regra de escritor único respeitada: este módulo NUNCA grava o commit final
// do Vault (chave 'vault_state'). Quando todos os pacotes do .ar10pack
// validam, delega a escrita real e o commit atômico a
// pack-manager.installToSafariStorage() — a mesma função, já testada, que o
// fluxo manual "Preparar/Instalar" usa. Isto evita dois donos escrevendo o
// mesmo estado.

import { base64ToBytes } from '../crypto-utils.js';
import * as packManager from '../pack-manager.js';
import * as eventBus from '../core/event-bus.js';
import * as manifestReader from './manifest-reader.js';
import * as hashValidator from './hash-validator.js';
import * as quotaMonitor from './quota-monitor.js';
import * as hydrationCheckpoint from './hydration-checkpoint.js';
import * as localAvailabilityMap from './local-availability-map.js';
import * as hydrationQueue from './hydration-queue.js';

export const HYDRATION_STATUS = hydrationCheckpoint.HYDRATION_STATUS;

let runningPromise = null;
let pauseRequested = false;

export function requestPause() {
    pauseRequested = true;
}

async function readBatterySignal() {
    if (!('getBattery' in navigator)) return 'NOT_AVAILABLE'; // Safari/WebKit: API ausente, nunca fabricar OK/LOW
    try {
        const batt = await navigator.getBattery();
        if (typeof batt.level !== 'number') return 'NOT_AVAILABLE';
        return (batt.level <= 0.15 && !batt.charging) ? 'LOW' : 'OK';
    } catch {
        return 'NOT_AVAILABLE';
    }
}

async function decideShouldPause() {
    if (pauseRequested) return 'user_requested';
    if (typeof document !== 'undefined' && document.hidden) return 'background_tab';
    if (await readBatterySignal() === 'LOW') return 'low_battery';
    return false;
}

async function processPackage(pkg, packJson, onLog) {
    if (pkg.type === 'APP_SHELL') {
        const cacheName = await manifestReader.detectActiveCacheName();
        return cacheName
            ? { ok: true, verified: true }
            : { ok: false, reason: 'cache_nao_encontrado' };
    }

    const relPath = pkg._meta?.rel_path;
    const b64 = packJson?.files?.[relPath];
    if (!b64) return { ok: false, reason: 'arquivo_ausente_no_pacote' };

    let bytes;
    try {
        bytes = base64ToBytes(b64);
    } catch {
        return { ok: false, reason: 'base64_invalido' };
    }

    const validation = await hashValidator.validateBytes(bytes, pkg.sha256);
    if (validation.result === hashValidator.VALIDATION_RESULT.FAIL) {
        onLog?.(`FAIL_CLOSED: hash divergente em ${relPath}`, 'fail');
        return { ok: false, reason: 'hash_invalido' };
    }
    return { ok: true, validated: true };
}

/** Inicia uma sessão nova ou retoma o checkpoint salvo. Single-flight: uma
 *  segunda chamada concorrente recebe a MESMA promise em andamento, nunca
 *  inicia uma segunda corrida. */
export async function startOrResumeHydration(onLog) {
    if (runningPromise) return runningPromise;
    runningPromise = doRun(onLog).finally(() => { runningPromise = null; });
    return runningPromise;
}

async function doRun(onLog) {
    pauseRequested = false;
    onLog?.('=== HYDRATION ENGINE: iniciando/retomando ===', 'info');

    let packJson = packManager.getLoadedPack();
    if (!packJson) {
        packJson = await packManager.fetchLocalPack(onLog);
    }
    const manifest = await manifestReader.buildHydrationManifest({ packJson });

    let state = await hydrationCheckpoint.loadCheckpoint();
    if (!hydrationCheckpoint.isResumable(state)) {
        state = hydrationCheckpoint.emptyState();
        state.pending_packages = manifest.packages.map((p) => p.package_id);
        state.bytes_total = manifest.total_size_bytes;
    } else {
        onLog?.(`Retomando sessão ${state.session_id} (checkpoint de ${state.last_checkpoint_at}).`, 'info');
    }
    state.status = HYDRATION_STATUS.RUNNING;
    await hydrationCheckpoint.saveCheckpoint(state);
    eventBus.emit('hydration.started', { payload: { session_id: state.session_id } });

    const alreadyDone = new Set([...(state.completed_packages || []), ...(state.failed_packages || [])]);
    const itemsToProcess = manifest.packages.filter((p) => !alreadyDone.has(p.package_id));

    const { pausedEarly, pauseReason } = await hydrationQueue.run(
        itemsToProcess,
        (pkg) => processPackage(pkg, packJson, onLog),
        {
            shouldPause: decideShouldPause,
            onProgress: async ({ item, result }) => {
                if (result?.ok) {
                    state.completed_packages.push(item.package_id);
                    state.bytes_downloaded += item.size_bytes || 0;
                } else {
                    state.failed_packages.push(item.package_id);
                    state.last_error = result?.error || result?.reason || 'falha_desconhecida';
                }
                state.pending_packages = state.pending_packages.filter((id) => id !== item.package_id);
                state.current_package_id = item.package_id;
                await hydrationCheckpoint.saveCheckpoint(state);
                onLog?.(`${result?.ok ? 'OK' : 'FALHA'}  ${item.name} (prioridade ${item.priority})`, result?.ok ? 'ok' : 'fail');
            },
        }
    );

    if (pausedEarly) {
        state.status = HYDRATION_STATUS.PAUSED;
        await hydrationCheckpoint.saveCheckpoint(state);
        onLog?.(`Hidratação pausada (${pauseReason}). ${state.pending_packages.length} pacote(s) pendente(s).`, 'warn');
        eventBus.emit('hydration.paused', { payload: { reason: pauseReason } });
        return { status: state.status, pauseReason };
    }

    if (state.failed_packages.length > 0) {
        state.status = HYDRATION_STATUS.FAILED;
        await hydrationCheckpoint.saveCheckpoint(state);
        onLog?.('Hidratação encerrada com falhas — Vault NÃO foi instalado/commitado (FAIL_CLOSED).', 'fail');
        eventBus.emit('hydration.failed', { severity: eventBus.SEVERITY.FAIL, payload: { failed: state.failed_packages } });
        return { status: state.status };
    }

    // Todos os pacotes deste pack foram validados — delega o commit atômico
    // final ao pack-manager (único escritor do Vault). Reescrever os mesmos 2
    // arquivos é barato (pacote pequeno) e mantém um único dono da escrita.
    try {
        await packManager.installToSafariStorage(onLog);
        state.status = HYDRATION_STATUS.COMPLETED;
        state.last_error = null;
        await hydrationCheckpoint.saveCheckpoint(state);
        onLog?.('=== HYDRATION ENGINE: concluído (Vault READY) ===', 'ok');
        eventBus.emit('hydration.completed', { severity: eventBus.SEVERITY.OK, payload: { session_id: state.session_id } });
        return { status: state.status };
    } catch (err) {
        state.status = HYDRATION_STATUS.FAIL_CLOSED;
        state.last_error = String(err?.message || err);
        state.fail_closed = true;
        await hydrationCheckpoint.saveCheckpoint(state);
        onLog?.(`FAIL_CLOSED: commit final do Vault falhou (${state.last_error}).`, 'fail');
        eventBus.emit('hydration.fail_closed', { severity: eventBus.SEVERITY.CRITICAL, payload: { reason: state.last_error } });
        return { status: state.status };
    }
}

export async function hasResumableCheckpoint() {
    const state = await hydrationCheckpoint.loadCheckpoint();
    return hydrationCheckpoint.isResumable(state);
}

/** Delegado a pack-manager.reloadVaultState — re-hash real dos arquivos já
 *  instalados, não apenas relê uma flag salva. */
export async function verifyHydrationIntegrity(onLog) {
    onLog?.('Hydration Engine: verificando integridade do Vault (delegado ao pack-manager)...', 'info');
    return packManager.reloadVaultState(onLog);
}

/** Delegado a pack-manager.autoRepairVault. Se o reparo restaurar READY,
 *  sincroniza o checkpoint para COMPLETED — senão o card mostraria Vault
 *  READY com a Hidratação ainda "pendente/falhou", uma contradição visível. */
export async function repairHydration(onLog) {
    onLog?.('Hydration Engine: solicitando auto-reparo do Vault (delegado ao pack-manager)...', 'info');
    const result = await packManager.autoRepairVault(onLog);
    if (result.status === 'READY') {
        const state = await hydrationCheckpoint.loadCheckpoint();
        if (state && state.status !== HYDRATION_STATUS.COMPLETED) {
            state.status = HYDRATION_STATUS.COMPLETED;
            state.failed_packages = [];
            state.pending_packages = [];
            state.last_error = null;
            await hydrationCheckpoint.saveCheckpoint(state);
        }
    }
    return result;
}

/** Snapshot completo para o card de status — combina checkpoint, manifesto,
 *  quota e Local Availability Map. Tudo lido de módulos já reais; nada
 *  fabricado para preencher um campo do contrato. */
export async function getHydrationEngineStatusReport() {
    const [checkpoint, quota, lam] = await Promise.all([
        hydrationCheckpoint.loadCheckpoint(),
        quotaMonitor.getQuotaSnapshot(),
        localAvailabilityMap.buildLocalAvailabilityMap(),
    ]);

    const packJson = packManager.getLoadedPack();
    const manifest = await manifestReader.buildHydrationManifest({ packJson });

    const completedIds = new Set(checkpoint?.completed_packages || []);
    const failedIds = new Set(checkpoint?.failed_packages || []);
    const pendingCount = manifest.packages.filter((p) => !completedIds.has(p.package_id) && !failedIds.has(p.package_id)).length;

    const currentPackageId = checkpoint?.current_package_id || null;
    const currentPackage = currentPackageId
        ? manifest.packages.find((p) => p.package_id === currentPackageId) || null
        : null;

    return {
        status: checkpoint?.status || HYDRATION_STATUS.IDLE,
        session_id: checkpoint?.session_id || null,
        completed_count: completedIds.size,
        failed_count: failedIds.size,
        pending_count: pendingCount,
        total_count: manifest.packages.length,
        current_package_id: currentPackageId,
        current_package_name: currentPackage?.name || null,
        bytes_downloaded: checkpoint?.bytes_downloaded || 0,
        bytes_total: manifest.total_size_bytes,
        last_checkpoint_at: checkpoint?.last_checkpoint_at || null,
        last_error: checkpoint?.last_error || null,
        fail_closed: !!checkpoint?.fail_closed,
        is_running: !!runningPromise,
        is_paused: checkpoint?.status === HYDRATION_STATUS.PAUSED,
        has_resumable_checkpoint: hydrationCheckpoint.isResumable(checkpoint),
        manifest_summary: {
            manifest_id: manifest.manifest_id,
            package_count: manifest.packages.length,
            required_count: manifest.required_packages.length,
        },
        quota,
        local_availability_map: lam,
    };
}

let autoResumeWired = false;

/** Liga listeners de retomada automática (online / aba volta ao foco) — só
 *  RETOMA uma sessão já em andamento/pausada, nunca INICIA uma hidratação
 *  nova sem ação do usuário (mesma disciplina do resto do app: nada de
 *  rede/storage por conta própria sem um toque inicial). Idempotente: chamar
 *  mais de uma vez não duplica listeners. */
export function wireAutoResume(onLog) {
    if (autoResumeWired) return;
    autoResumeWired = true;
    const tryResume = () => {
        hasResumableCheckpoint().then((resumable) => {
            if (resumable && !runningPromise) startOrResumeHydration(onLog);
        });
    };
    window.addEventListener('online', tryResume);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) tryResume();
    });
}
