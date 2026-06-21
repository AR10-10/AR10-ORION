// data-mode-labels.js — vocabulário fechado de "que tipo de dado é este".
// Qualquer card que mostre número, preço ou posição usa um destes modos —
// nunca deixa o usuário adivinhar se um valor é real, simulado, replay ou só
// contexto. PRIVATE existe só para o card poder dizer "isto seria privado e
// está bloqueado", nunca para mostrar dado privado de verdade.

export const DATA_MODES = Object.freeze({
    REAL: 'REAL',
    PAPER: 'PAPER',
    SIM: 'SIM',
    REPLAY: 'REPLAY',
    SYNTHETIC: 'SYNTHETIC',
    PRIVATE: 'PRIVATE',
    CONTEXT_ONLY: 'CONTEXT_ONLY',
});

const LABELS_PT_BR = Object.freeze({
    REAL: 'DADO REAL',
    PAPER: 'PAPER TRADING (simulado, preço real quando disponível)',
    SIM: 'SIMULAÇÃO INTERNA',
    REPLAY: 'REPLAY SINTÉTICO OFFLINE',
    SYNTHETIC: 'DADO SINTÉTICO',
    PRIVATE: 'DADO PRIVADO (bloqueado nesta versão)',
    CONTEXT_ONLY: 'SÓ CONTEXTO — NÃO É SINAL DE MERCADO',
});

const BADGE_CLASS = Object.freeze({
    REAL: 'dm-real',
    PAPER: 'dm-paper',
    SIM: 'dm-sim',
    REPLAY: 'dm-replay',
    SYNTHETIC: 'dm-synthetic',
    PRIVATE: 'dm-private',
    CONTEXT_ONLY: 'dm-context',
});

export function labelFor(dataMode) {
    return LABELS_PT_BR[dataMode] || 'DADOS INSUFICIENTES';
}

export function badgeClassFor(dataMode) {
    return BADGE_CLASS[dataMode] || 'dm-unknown';
}
