// event-bus.js — Barramento de eventos em memória (Memória Viva). Qualquer
// módulo que faça algo que o usuário deveria conseguir explicar depois
// (sonda de fonte real, snapshot, recovery, Risk Gate, paper trade) emite
// aqui em vez de só escrever na Telemetria. js/memory/event-log.js escuta
// este barramento e persiste no IndexedDB; o card Activity Log/Siriform lê o
// histórico persistido — assim nenhum subsistema novo precisa conhecer
// storage.js diretamente, só emitir um evento.

export const SEVERITY = Object.freeze({
    INFO: 'INFO',
    OK: 'OK',
    WARN: 'WARN',
    FAIL: 'FAIL',
    CRITICAL: 'CRITICAL',
});

// SOURCE não inclui 'SOLDIER' de propósito: nenhum processo Soldier real
// existe nesta versão (ver js/core/commander-soldier.js) — só o Commander
// (este PWA/iPad) e o próprio runtime (SYSTEM) emitem eventos de verdade.
export const SOURCE = Object.freeze({
    COMMANDER: 'COMMANDER',
    SYSTEM: 'SYSTEM',
});

const MAX_RING = 200;
const ring = [];
const listeners = new Map(); // eventType -> Set<fn>; '*' ouve todos os tipos

let seq = 0;

export function emit(eventType, { source = SOURCE.COMMANDER, dataMode = null, severity = SEVERITY.INFO, payload = null, correlationId = null } = {}) {
    const event = Object.freeze({
        seq: ++seq,
        event_type: eventType,
        source,
        data_mode: dataMode,
        severity,
        payload,
        correlation_id: correlationId,
        at: new Date().toISOString(),
    });
    ring.push(event);
    if (ring.length > MAX_RING) ring.shift();
    for (const fn of listeners.get(eventType) || []) fn(event);
    if (eventType !== '*') for (const fn of listeners.get('*') || []) fn(event);
    return event;
}

/** @returns {() => void} função de cancelamento da inscrição. */
export function on(eventType, fn) {
    if (!listeners.has(eventType)) listeners.set(eventType, new Set());
    listeners.get(eventType).add(fn);
    return () => listeners.get(eventType)?.delete(fn);
}

export function getRecentEvents(n = MAX_RING) {
    return n ? ring.slice(-n) : ring.slice();
}

export function clearRingBuffer() {
    ring.length = 0;
}
