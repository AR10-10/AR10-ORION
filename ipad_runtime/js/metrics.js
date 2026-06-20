// metrics.js — equivalente PWA-leve do conceito "Instruments/profiling" do
// WWDC26 (camada 4 da planta mestra): não existe processo nativo para
// inspecionar este runtime, então este módulo registra, no próprio
// navegador, os sinais que um profiler nativo mostraria — tempo de carga,
// duração do último "Preparar Cyborg", contagem de eventos do Siriform e
// falhas observadas no último diagnóstico/Evaluations. Tudo aqui é leitura
// de fatos já ocorridos nesta sessão; nada é estimado, e nada sai do
// dispositivo (sem fetch, sem envio de telemetria a terceiros).

let siriformEventCount = 0;
let lastPrepDurationMs = null;
let lastDiagnosticsFails = null;
let lastEvaluationsFails = null;
const recentEvents = [];
const MAX_EVENTS = 12;

/** Observa o atributo data-state do avatar via MutationObserver em vez de
 *  exigir que cada chamador de setSiriformState() avise este módulo — assim
 *  siriform.js continua puramente visual, sem nova dependência. */
export function initMetrics(avatarEl) {
    if (!avatarEl || !('MutationObserver' in window)) return;
    const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.attributeName !== 'data-state') continue;
            siriformEventCount += 1;
            recentEvents.unshift({ t: Date.now(), state: avatarEl.getAttribute('data-state') });
            if (recentEvents.length > MAX_EVENTS) recentEvents.length = MAX_EVENTS;
        }
    });
    obs.observe(avatarEl, { attributes: true, attributeFilter: ['data-state'] });
}

export function recordPrepDuration(ms) {
    lastPrepDurationMs = Math.round(ms);
}

export function recordDiagnosticsReport(lines) {
    lastDiagnosticsFails = (lines || []).filter((l) => l.level === 'fail').length;
}

export function recordEvaluationsReport(report) {
    lastEvaluationsFails = report ? report.fail : null;
}

function navigationLoadTimeMs() {
    try {
        const [nav] = performance.getEntriesByType('navigation');
        if (nav && nav.loadEventEnd > 0) return Math.round(nav.loadEventEnd - nav.startTime);
    } catch { /* Navigation Timing Level 2 indisponivel — tenta o fallback abaixo */ }
    if (performance.timing && performance.timing.loadEventEnd && performance.timing.navigationStart) {
        const delta = performance.timing.loadEventEnd - performance.timing.navigationStart;
        if (delta > 0) return delta;
    }
    return null;
}

/** Snapshot somente-leitura para alimentar o painel "Métricas". */
export function getSnapshot() {
    const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return {
        loadTimeMs: navigationLoadTimeMs(),
        lastPrepDurationMs,
        siriformEventCount,
        recentEvents: recentEvents.slice(0, MAX_EVENTS),
        lastDiagnosticsFails,
        lastEvaluationsFails,
        reducedMotion,
    };
}
