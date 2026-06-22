// hydration-checkpoint.js — persiste o HydrationState (contrato da
// especificação do Hydration Engine) em storage.js (mesma camada
// OPFS/IndexedDB do Vault), sob uma chave própria — NUNCA reusa
// 'vault_state' (chave exclusiva de pack-manager.js). É o que permite
// retomar uma hidratação pausada/interrompida sem reiniciar do zero.

import * as storage from '../storage.js';

const CHECKPOINT_META_KEY = 'hydration_checkpoint';

export const HYDRATION_STATUS = Object.freeze({
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    FAIL_CLOSED: 'FAIL_CLOSED',
});

export function newSessionId() {
    return `hyd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyState() {
    return {
        session_id: newSessionId(),
        started_at: new Date().toISOString(),
        status: HYDRATION_STATUS.IDLE,
        current_package_id: null,
        completed_packages: [],
        failed_packages: [],
        pending_packages: [],
        bytes_downloaded: 0,
        bytes_total: 0,
        storage_used: null,
        storage_available: null,
        last_checkpoint_at: null,
        last_error: null,
        fail_closed: false,
    };
}

export async function loadCheckpoint() {
    const saved = await storage.getMeta(CHECKPOINT_META_KEY);
    return saved || null;
}

export async function saveCheckpoint(state) {
    const toSave = { ...state, last_checkpoint_at: new Date().toISOString() };
    await storage.setMeta(CHECKPOINT_META_KEY, toSave);
    return toSave;
}

export async function clearCheckpoint() {
    await storage.setMeta(CHECKPOINT_META_KEY, null);
}

/** Um checkpoint só é retomável se existir, não estiver COMPLETED, e ainda
 *  tiver pacotes pendentes — evita "retomar" uma sessão que já terminou. */
export function isResumable(state) {
    if (!state) return false;
    if (state.status === HYDRATION_STATUS.COMPLETED) return false;
    return Array.isArray(state.pending_packages) && state.pending_packages.length > 0;
}
