// ui-helpers.js — helpers de UI puros sobre o registro DOM (els), extraidos
// de app.js (FOCO6: app.js nao pode virar bola de neve). Nenhuma logica de
// negocio aqui — so' leitura/escrita de texto e classe em elementos ja
// resolvidos por dom-registry.js. Extracao mecanica, sem mudanca de
// comportamento: mesmas funcoes, mesmo corpo, app.js so' passou a importar.

import { els } from './dom-registry.js';

export function log(msg, level = 'dim') {
    const time = new Date().toISOString().slice(11, 19);
    const line = document.createElement('div');
    line.className = `ln-${level}`;
    line.textContent = `[${time}] ${msg}`;
    els['console-log'].appendChild(line);
    els['console-log'].scrollTop = els['console-log'].scrollHeight;
    // Telemetria ao Vivo: o último evento real fica sempre visível no topo do
    // card, sem precisar rolar a "caixa preta" inteira (Fase 5 — logs viram
    // telemetria legível, nunca um muro de terminal dominando a primeira tela).
    if (els['telemetry-latest']) {
        els['telemetry-latest'].textContent = `[${time}] ${msg}`;
        els['telemetry-latest'].className = `telemetry-latest ln-${level}`;
    }
    return line;
}

export function classFor(value) {
    if (value === 'OK' || value === true || value === 'INSTALLED' || value === 'INSTALADO' || value === 'ATUALIZADO' || value === 'READY' || value === 'AVAILABLE' || value === 'GRANTED' || value === 'DISPONÍVEL NESTA SESSÃO' || value === 'RECOVERED' || value === 'RECUPERADO' || value === 'ACTIVE_READ_ONLY' || value === 'ONLINE' || value === 'ALLOW' || value === 'CLEAN_BOOT' || value === 'FULLY_RECOVERED' || value === 'ACTIVE' || value === 'COMPLETED') return 'v-ok';
    if (value === 'FAIL' || value === 'MISSING' || value === 'UNSUPPORTED' || value === 'TOO_LARGE' || value === 'DENIED' || value === 'AUSENTE' || value === 'CORROMPIDO' || value === 'REINSTALAÇÃO NECESSÁRIA' || value === 'BLOQUEADO POR SEGURANÇA' || value === 'FAILED' || value === 'BLOCKED' || value === 'LIVE_LOCKED' || value === 'BLOCK' || value === 'OFFLINE' || value === 'FORBIDDEN' || value === 'FAIL_CLOSED' || value === 'CRITICAL') return 'v-fail';
    if (value === 'FUTURE' || value === 'LIGHT' || value === 'BALANCED' || value === 'HEAVY' || value === 'PARTIAL' || value === 'PARCIAL' || value === 'PARTIAL_RECOVERY' || value === 'PARTIAL_WITH_FAILURES' || value === 'DEGRADED' || value === 'PLANNED' || value === 'RUNNING' || value === 'PAUSED') return 'v-info';
    return 'v-limited'; // DESATUALIZADO/LIMITADO/NOT_DEPLOYED/NOT_CONNECTED caem aqui de proposito — else aberto, sem 6a classe
}

export function setStatus(id, value) {
    const el = els[id];
    if (!el) return;
    el.textContent = String(value);
    el.classList.remove('v-ok', 'v-fail', 'v-limited', 'v-pending', 'v-info');
    el.classList.add(classFor(value));
}

export function setInfo(id, text) {
    const el = els[id];
    if (!el) return;
    el.textContent = String(text);
    el.classList.remove('v-ok', 'v-fail', 'v-limited', 'v-pending', 'v-info');
    el.classList.add('v-info');
}

export function setStatusWithClass(id, text, cls) {
    const el = els[id];
    if (!el) return;
    el.textContent = text;
    el.classList.remove('v-ok', 'v-fail', 'v-limited', 'v-pending', 'v-info');
    el.classList.add(cls);
}

// FOCO3 — vocabulario macro de 1 olho so (Resumo Executivo + chip do orbe).
// Nao reusa classFor() de proposito: classFor() conhece os rotulos antigos
// (READY/LIVE_LOCKED ja existiam la para outros campos) mas ANALYZING/
// UPDATING/DEGRADED/FAIL_CLOSED precisam de um mapeamento proprio para nao
// cair no v-limited generico por acidente.
export const MACRO_STATE_CLASS = {
    IDLE: 'v-pending',
    READY: 'v-ok',
    ANALYZING: 'v-info',
    UPDATING: 'v-info',
    DEGRADED: 'v-limited',
    DADOS_INSUFICIENTES: 'v-limited',
    FAIL_CLOSED: 'v-fail',
};

export function setMacroStatus(id, macro) {
    const el = els[id];
    if (!el) return;
    el.textContent = macro;
    el.classList.remove('v-ok', 'v-fail', 'v-limited', 'v-pending', 'v-info');
    el.classList.add(MACRO_STATE_CLASS[macro] || 'v-info');
}
