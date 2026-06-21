// snapshot-manager.js — "Auto Snapshot" / "Last Good State" da Memória Viva.
// Um snapshot é um resumo leve e serializável do estado do app (nunca
// segredo/credencial) com um hash SHA-256 — assim o Recovery Report pode
// dizer "o estado restaurado bate com o hash gravado" em vez de só confiar
// numa flag salva. `current` é regravado a cada boot bem-sucedido;
// `lastGood` só avança quando o app explicitamente promove um snapshot
// (promoteToLastGood) — nunca automaticamente a partir de um boot com falha,
// senão um estado ruim poderia se promover sozinho a "last good".

import { setMeta, getMeta } from '../storage.js';
import { sha256Hex } from '../crypto-utils.js';

const CURRENT_KEY = 'ar10_snapshot_current_v1';
const LAST_GOOD_KEY = 'ar10_snapshot_last_good_v1';

async function hashState(state) {
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    return sha256Hex(bytes);
}

export async function takeSnapshot(state) {
    const hash = await hashState(state);
    const snapshot = { state, hash, taken_at: new Date().toISOString() };
    await setMeta(CURRENT_KEY, snapshot);
    return snapshot;
}

export async function getCurrentSnapshot() {
    return (await getMeta(CURRENT_KEY)) || null;
}

export async function promoteToLastGood(snapshot) {
    const promoted = { ...snapshot, promoted_at: new Date().toISOString() };
    await setMeta(LAST_GOOD_KEY, promoted);
    return promoted;
}

export async function getLastGoodState() {
    return (await getMeta(LAST_GOOD_KEY)) || null;
}

/** Confere se um snapshot ainda bate com o hash que ele mesmo declara —
 *  detecta corrupção/edição manual do IndexedDB, mesma filosofia do Vault. */
export async function verifySnapshotIntegrity(snapshot) {
    if (!snapshot || !snapshot.state || !snapshot.hash) return false;
    return (await hashState(snapshot.state)) === snapshot.hash;
}

/** Usado só pelo Backup/Restore Pack. */
export async function restoreSnapshots({ current, lastGood } = {}) {
    if (current) await setMeta(CURRENT_KEY, current);
    if (lastGood) await setMeta(LAST_GOOD_KEY, lastGood);
}
