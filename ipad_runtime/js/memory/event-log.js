// event-log.js — persiste o barramento de eventos (core/event-bus.js) no
// IndexedDB via storage.js, para o card "Activity Log" sobreviver a fechar a
// aba/PWA. Não duplica o ring buffer em RAM do event-bus — só grava, em
// ordem do mais recente primeiro, o que já passou por ele nesta ou em
// sessões anteriores.

import { setMeta, getMeta } from '../storage.js';
import { on } from '../core/event-bus.js';

const LOG_KEY = 'ar10_event_log_v1';
const MAX_ENTRIES = 300;
let unsubscribe = null;

async function append(event) {
    const log = await getRecentPersisted(0);
    log.unshift(event);
    if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
    await setMeta(LOG_KEY, log);
}

/** Liga o event-log ao barramento — chamar uma vez no boot. Idempotente
 *  (uma segunda chamada não duplica a inscrição). */
export function wireToEventBus() {
    if (unsubscribe) return;
    unsubscribe = on('*', (event) => { append(event); });
}

export function unwireFromEventBus() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

/** @param {number} n 0 = sem limite (todo o histórico persistido). */
export async function getRecentPersisted(n = MAX_ENTRIES) {
    const v = await getMeta(LOG_KEY);
    const log = Array.isArray(v) ? v : [];
    return n ? log.slice(0, n) : log;
}

export async function countByType() {
    const log = await getRecentPersisted(0);
    const counts = {};
    for (const e of log) counts[e.event_type] = (counts[e.event_type] || 0) + 1;
    return counts;
}

export async function clearLog() {
    await setMeta(LOG_KEY, []);
}

/** Usado só pelo Backup/Restore Pack — nunca chamado a partir de uma sonda
 *  de rede ou entrada do usuário sem ter passado pela verificação de hash em
 *  memory/backup-restore-pack.js. */
export async function restoreLog(entries) {
    await setMeta(LOG_KEY, Array.isArray(entries) ? entries.slice(0, MAX_ENTRIES) : []);
}
