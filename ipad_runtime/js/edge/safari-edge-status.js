// safari-edge-status.js — Safari Assisted Edge Layer: telemetria real de
// sessao/render deste iPad/Safari. Camada visual/contextual, NUNCA
// autoritativa: is_authoritative e sempre false, fixado no retorno, nao um
// booleano livre que algum chamador poderia inverter por engano.
//
// Cada campo abaixo le uma API real do browser (rAF, visibilityState,
// navigator.onLine, sessionStorage) ou um valor real passado pelo chamador
// (vindo de core/event-bus.js, core/commander-soldier.js, storage.js,
// real-data/analysis-frame.js) — nenhum numero e inventado. Quando o sinal
// nao existe ou nao e seguro/barato de medir, o campo correspondente
// retorna 'NOT_AVAILABLE', nunca um valor decorativo.
//
// Nunca chama rede. Nunca decide trade. Nunca substitui o Soldier.

const SESSION_STORAGE_KEY = 'ar10_edge_session_id';
const EXPECTED_FRAME_MS = 1000 / 60;
const DROPPED_FRAME_THRESHOLD_MS = EXPECTED_FRAME_MS * 1.75;
const STORAGE_MIRROR_LABELS = Object.freeze({ opfs: 'OPFS', idb: 'INDEXEDDB' });

let sessionId = null;
let rafHandle = null;
let lastFrameAt = null;
let lastFrameDeltaMs = null;
let frameSamples = 0;
let droppedFrames = 0;

function resolveSessionId() {
    if (sessionId) return sessionId;
    try {
        const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (existing) { sessionId = existing; return sessionId; }
    } catch { /* sessionStorage indisponivel nesta sessao — segue so em memoria */ }
    sessionId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `edge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try { sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId); } catch { /* ok, fica so em memoria */ }
    return sessionId;
}

function rafTick(now) {
    if (lastFrameAt !== null) {
        const delta = now - lastFrameAt;
        lastFrameDeltaMs = delta;
        frameSamples += 1;
        if (delta > DROPPED_FRAME_THRESHOLD_MS) droppedFrames += 1;
    }
    lastFrameAt = now;
    rafHandle = requestAnimationFrame(rafTick);
}

function ensureMonitorStarted() {
    if (rafHandle !== null) return;
    if (typeof requestAnimationFrame !== 'function') return;
    rafHandle = requestAnimationFrame(rafTick);
}

function countVisiblePanels() {
    try {
        const cards = document.querySelectorAll('section.card');
        let visible = 0;
        cards.forEach((el) => { if (el.offsetParent !== null) visible += 1; });
        return visible;
    } catch {
        return 'NOT_AVAILABLE';
    }
}

function detectDeviceLabel() {
    try {
        const ua = navigator.userAgent || '';
        if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad (Safari)';
        if (/iPhone/.test(ua)) return 'iPhone (Safari)';
        if (/Macintosh/.test(ua)) return 'Mac (Safari)';
        return navigator.platform || 'NOT_AVAILABLE';
    } catch {
        return 'NOT_AVAILABLE';
    }
}

function resolveEdgeStatus() {
    if (typeof document === 'undefined') return 'OFFLINE';
    if (document.visibilityState !== 'visible') return 'OFFLINE';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'DEGRADED';
    if (frameSamples > 30 && lastFrameDeltaMs !== null && lastFrameDeltaMs > DROPPED_FRAME_THRESHOLD_MS * 2) return 'DEGRADED';
    return 'ACTIVE';
}

function buildSiriformSummary(soldierStatus) {
    const validation = soldierStatus === 'NOT_DEPLOYED'
        ? 'O Soldier ainda não existe nesta versão (NOT_DEPLOYED) — quando existir, ele é quem vai validar ou descartar qualquer leitura desta camada antes dela influenciar qualquer decisão.'
        : 'O Soldier está implantado e é ele quem precisa validar esta leitura antes de qualquer decisão — esta camada nunca decide por conta própria.';
    return `O que o Safari Edge faz: mede sinais reais e locais deste iPad/Safari — latência de render, frames perdidos, painel/símbolo/timeframe em foco, estado de conexão e de armazenamento. O que ele não faz: nunca decide trade, nunca executa ordem, nunca substitui o Soldier, nunca inventa preço ou sinal de mercado. Por que não é autoritativo: is_authoritative é sempre FALSE porque isto é telemetria de UI deste dispositivo, não dado de mercado validado. ${validation}`;
}

/**
 * @param {{ soldierStatus?: string, lastSequenceSeen?: number, focusedSymbol?: string,
 *   focusedTimeframe?: string, storageBackend?: 'opfs'|'idb' }} ctx sinais reais
 *   ja resolvidos por outros modulos (core/commander-soldier.js,
 *   core/event-bus.js, storage.js, real-data/analysis-frame.js). Este
 *   modulo nunca le esses sistemas diretamente, para nao duplicar a fonte
 *   da verdade de cada um.
 * @returns {object} relatorio pronto para exibicao — is_authoritative
 *   sempre false.
 */
export function getSafariEdgeStatusReport(ctx = {}) {
    ensureMonitorStarted();
    const soldierStatus = ctx.soldierStatus || 'NOT_DEPLOYED';
    return {
        edge_status: resolveEdgeStatus(),
        device: detectDeviceLabel(),
        session_id: resolveSessionId(),
        last_sequence_seen: Number.isFinite(ctx.lastSequenceSeen) ? ctx.lastSequenceSeen : 'NOT_AVAILABLE',
        render_latency_ms: lastFrameDeltaMs !== null ? `${lastFrameDeltaMs.toFixed(1)} ms` : 'NOT_AVAILABLE',
        dropped_frames: frameSamples > 0 ? droppedFrames : 'NOT_AVAILABLE',
        visible_panels: countVisiblePanels(),
        focused_symbol: ctx.focusedSymbol || 'NOT_AVAILABLE',
        focused_timeframe: ctx.focusedTimeframe || 'NOT_AVAILABLE',
        connection_state: (typeof navigator !== 'undefined' && 'onLine' in navigator) ? (navigator.onLine ? 'ONLINE' : 'OFFLINE') : 'NOT_AVAILABLE',
        storage_mirror: ctx.storageBackend ? (STORAGE_MIRROR_LABELS[ctx.storageBackend] || 'NOT_AVAILABLE') : 'NOT_AVAILABLE',
        is_authoritative: false,
        soldier_validation: soldierStatus === 'NOT_DEPLOYED' ? 'NOT_DEPLOYED' : 'REQUIRED',
        siriform_summary: buildSiriformSummary(soldierStatus),
    };
}
