// evidence-ledger.js — Historico append-only de Evidence real (mission
// AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
// Usa js/storage.js (setMeta/getMeta -> IndexedDB META_STORE) para guardar as
// ultimas evidencias reais recebidas de qualquer conector, mais antiga
// primeiro descartada — nunca segredo, nunca credencial, apenas a mesma
// Evidence publica ja validada pelo probe (js/real-data/schema.js).

import { setMeta, getMeta } from '../storage.js';

const LEDGER_KEY = 'real_data_evidence_ledger_v1';
const MAX_ENTRIES = 50;

/** Acrescenta uma entrada ao ledger (mais recente primeiro). Corta o ledger
 *  em MAX_ENTRIES para nao crescer sem limite no IndexedDB. */
export async function appendEvidence(entry) {
    const ledger = await getLedger();
    ledger.unshift({ ...entry, recorded_at: new Date().toISOString() });
    if (ledger.length > MAX_ENTRIES) ledger.length = MAX_ENTRIES;
    await setMeta(LEDGER_KEY, ledger);
    return ledger;
}

export async function getLedger() {
    const v = await getMeta(LEDGER_KEY);
    return Array.isArray(v) ? v : [];
}

export async function clearLedger() {
    await setMeta(LEDGER_KEY, []);
}

/** Usado só pelo Backup/Restore Pack (memory/backup-restore-pack.js). */
export async function restoreLedger(ledger) {
    await setMeta(LEDGER_KEY, Array.isArray(ledger) ? ledger.slice(0, MAX_ENTRIES) : []);
}
