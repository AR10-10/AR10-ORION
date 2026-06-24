// backup-restore-pack.js — "Backup/Restore Pack" da Memória Viva: empacota
// tudo que o Cyborg guarda sobre si mesmo (Real Data Layer, Evidence Ledger,
// Activity Log, Snapshots, histórico de Recovery Reports) num único JSON
// exportável, e sabe ler esse mesmo JSON de volta. Nunca inclui segredo,
// chave de API ou credencial — só o que já é gravado por storage.setMeta nos
// outros módulos de memória, que por design nunca guardam isso.

import { sha256Hex } from '../crypto-utils.js';
import * as persistentState from './persistent-state.js';
import * as evidenceLedger from './evidence-ledger.js';
import * as eventLog from './event-log.js';
import * as snapshotManager from './snapshot-manager.js';
import * as recoveryReport from './recovery-report.js';
import { emit, SEVERITY } from '../core/event-bus.js';

const FORMAT = 'AR10_CYBORG_MEMORY_BACKUP_V1';

export async function buildBackupPack() {
    const [realData, ledger, log, currentSnapshot, lastGoodState, recoveryHistory] = await Promise.all([
        persistentState.loadAll(),
        evidenceLedger.getLedger(),
        eventLog.getRecentPersisted(0),
        snapshotManager.getCurrentSnapshot(),
        snapshotManager.getLastGoodState(),
        recoveryReport.getRecoveryHistory(),
    ]);
    const body = {
        real_data_layer: realData,
        evidence_ledger: ledger,
        event_log: log,
        current_snapshot: currentSnapshot,
        last_good_state: lastGoodState,
        recovery_history: recoveryHistory,
    };
    const body_sha256 = await sha256Hex(new TextEncoder().encode(JSON.stringify(body)));
    const pack = {
        format: FORMAT,
        generated_at: new Date().toISOString(),
        no_secrets: true,
        body_sha256,
        body,
    };
    emit('memory_backup_exported', { severity: SEVERITY.OK, payload: { generated_at: pack.generated_at, body_sha256 } });
    return pack;
}

function validatePack(pack) {
    if (!pack || pack.format !== FORMAT) return { valid: false, reason: 'formato_desconhecido' };
    if (!pack.body || !pack.body_sha256) return { valid: false, reason: 'corpo_ou_hash_ausente' };
    return { valid: true, reason: null };
}

/** Restaura um Backup Pack previamente exportado. Recalcula o hash do corpo
 *  e recusa restaurar (FAIL_CLOSED) se não bater com body_sha256 gravado no
 *  próprio arquivo — mesma filosofia do Vault: nunca confiar só numa flag,
 *  sempre reconferir o conteúdo de verdade antes de aplicar. */
export async function restoreBackupPack(pack) {
    const check = validatePack(pack);
    if (!check.valid) {
        emit('memory_backup_restore_blocked', { severity: SEVERITY.WARN, payload: { reason: check.reason } });
        return { restored: false, reason: check.reason };
    }

    const recomputed = await sha256Hex(new TextEncoder().encode(JSON.stringify(pack.body)));
    if (recomputed !== pack.body_sha256) {
        emit('memory_backup_restore_blocked', { severity: SEVERITY.WARN, payload: { reason: 'hash_do_corpo_nao_confere' } });
        return { restored: false, reason: 'hash_do_corpo_nao_confere' };
    }

    const b = pack.body;
    await Promise.all([
        persistentState.restoreAll(b.real_data_layer || {}),
        evidenceLedger.restoreLedger(b.evidence_ledger || []),
        eventLog.restoreLog(b.event_log || []),
        snapshotManager.restoreSnapshots({ current: b.current_snapshot, lastGood: b.last_good_state }),
        recoveryReport.restoreHistory(b.recovery_history || []),
    ]);
    emit('memory_backup_restored', { severity: SEVERITY.OK, payload: { generated_at: pack.generated_at } });
    return { restored: true, reason: null };
}
