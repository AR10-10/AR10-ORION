// recovery-report.js — RecoveryReport é o contrato que explica, depois de
// qualquer boot, o que o Cyborg fez para se recuperar sozinho (vault
// auto-repair, reidratação de sessão, fallback OPFS->IndexedDB) sem o
// usuário precisar abrir nenhum log técnico. `restoredFrom` e os contadores
// vêm de quem chama (app.js), que já sabe qual caminho real de boot
// executou — este módulo só empacota, persiste um histórico limitado, e
// narra em português.

import { setMeta, getMeta } from '../storage.js';

const HISTORY_KEY = 'ar10_recovery_report_history_v1';
const MAX_HISTORY = 20;
let recoveryCounter = 0;

function siriformSummary({ status, restored_event_count, missing_event_count, actions_required }) {
    if (status === 'CLEAN_BOOT') return 'Boot limpo — nenhuma recuperação foi necessária.';
    if (status === 'RECOVERED') return `Recuperação automática concluída: ${restored_event_count} item(ns) restaurado(s).`;
    if (status === 'PARTIAL_RECOVERY') return `Recuperação parcial: ${restored_event_count} item(ns) restaurado(s), ${missing_event_count} ainda ausente(s).${actions_required.length ? ' ' + actions_required.join(' ') : ''}`;
    return `Recuperação falhou.${actions_required.length ? ' Ação necessária: ' + actions_required.join(' ') : ' Verifique o Vault Local manualmente.'}`;
}

export async function buildAndPersistRecoveryReport({
    restoredFrom = 'NONE',
    lastGoodStateHash = null,
    restoredEventCount = 0,
    missingEventCount = 0,
    status = 'CLEAN_BOOT',
    actionsRequired = [],
} = {}) {
    const report = {
        recovery_id: `RECOVERY_${Date.now()}_${++recoveryCounter}`,
        boot_time: new Date().toISOString(),
        restored_from: restoredFrom,
        status,
        restored_event_count: restoredEventCount,
        missing_event_count: missingEventCount,
        last_good_state_hash: lastGoodStateHash,
        actions_required: actionsRequired,
    };
    report.siriform_summary = siriformSummary(report);

    const history = await getRecoveryHistory();
    history.unshift(report);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    await setMeta(HISTORY_KEY, history);
    return report;
}

export async function getRecoveryHistory() {
    const v = await getMeta(HISTORY_KEY);
    return Array.isArray(v) ? v : [];
}

export async function getLatestRecoveryReport() {
    const history = await getRecoveryHistory();
    return history[0] || null;
}

/** Usado só pelo Backup/Restore Pack. */
export async function restoreHistory(history) {
    await setMeta(HISTORY_KEY, Array.isArray(history) ? history.slice(0, MAX_HISTORY) : []);
}
