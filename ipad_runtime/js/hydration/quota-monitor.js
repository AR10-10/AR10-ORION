// quota-monitor.js — consulta navigator.storage.estimate() (via storage.js,
// já usado pelo card Vault Local para vl-storage-used/vl-storage-quota) e
// classifica OK/LOW/CRITICAL. Nunca inventa números: se a API não responder
// ou não existir, o status é DESCONHECIDO — nunca um valor fabricado.

import * as storage from '../storage.js';

export const QUOTA_STATUS = Object.freeze({
    OK: 'OK',
    LOW: 'LOW',
    CRITICAL: 'CRITICAL',
    DESCONHECIDO: 'DESCONHECIDO',
});

const LOW_RATIO = 0.75;
const CRITICAL_RATIO = 0.90;

export async function getQuotaSnapshot() {
    const estimate = await storage.storageEstimate();
    if (!estimate || typeof estimate.quota !== 'number' || typeof estimate.usage !== 'number' || estimate.quota <= 0) {
        return { status: QUOTA_STATUS.DESCONHECIDO, usage: null, quota: null, ratio: null, available: null };
    }
    const ratio = estimate.usage / estimate.quota;
    let status = QUOTA_STATUS.OK;
    if (ratio >= CRITICAL_RATIO) status = QUOTA_STATUS.CRITICAL;
    else if (ratio >= LOW_RATIO) status = QUOTA_STATUS.LOW;
    return { status, usage: estimate.usage, quota: estimate.quota, ratio, available: estimate.quota - estimate.usage };
}

/** Verificação preventiva antes de gravar um pacote grande. Quando a API de
 *  quota não responde (DESCONHECIDO), não bloqueia preventivamente — o
 *  FAIL_CLOSED real de "sem espaço" acontece quando a escrita de fato falhar,
 *  não por uma estimativa que o navegador não conseguiu dar. */
export async function hasEnoughSpace(bytesNeeded) {
    const snap = await getQuotaSnapshot();
    if (snap.available === null) return true;
    return snap.available > bytesNeeded;
}
