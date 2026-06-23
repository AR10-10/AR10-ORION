// live-ticker.js — Letreiro Vivo Central ("Cyborg Live Ticker").
// Painel tipo cockpit no topo da tela: resume em 1 olhar o que o app.js ja
// sabe (Real Data Layer, AnalysisFrame real, Research Engine, Hydration,
// Vault, Risk Gate) sem o usuario precisar rolar para os cards mais abaixo.
// Modulo presentacional puro: nunca le app.js, nunca decide regra de negocio
// nova — so' recebe um snapshot ja calculado (collectLiveTickerState() em
// app.js) e formata. Se um campo do snapshot estiver ausente, o item cai em
// DADOS_INSUFICIENTES, nunca um numero ou frase inventada.

import { DADOS_INSUFICIENTES } from '../real-data/schema.js';

function severityClass(sev) {
    if (sev === 'critical') return 'v-fail';
    if (sev === 'warn') return 'v-limited';
    if (sev === 'ok') return 'v-ok';
    return 'v-info';
}

/**
 * @param {object} state - snapshot montado por collectLiveTickerState() (app.js).
 * @returns {Array<{category: string, text: string, severity: 'critical'|'warn'|'ok'|'info'}>}
 */
export function buildLiveTickerItems(state = {}) {
    const items = [];

    // 1) Alertas criticos primeiro — e' o que mais importa ver de cara.
    if (state.macro === 'FAIL_CLOSED') {
        items.push({ category: 'ALERTA', severity: 'critical', text: 'FAIL_CLOSED — kill switch ou integridade do pacote comprometida. Execução real permanece bloqueada.' });
    } else if (state.macro === 'DEGRADED') {
        items.push({ category: 'ALERTA', severity: 'warn', text: 'DEGRADED — fonte real confirmada nesta sessão, porém desatualizada (STALE) ou pacote local desatualizado.' });
    }
    if (state.historical) {
        items.push({
            category: 'ALERTA',
            severity: 'warn',
            text: `SESSION_PREVIOUS — mostrando memória da sessão anterior${state.rehydratedSourceName ? ` (${state.rehydratedSourceName})` : ''}, ainda não revalidada nesta sessão. Toque em "Testar fontes reais".`,
        });
    } else if (!state.freshSourceNames || !state.freshSourceNames.length) {
        items.push({ category: 'ALERTA', severity: 'warn', text: 'DADOS_INSUFICIENTES — nenhuma fonte real validada nesta sessão ainda.' });
    }
    for (const b of (state.blockedConnectors || [])) {
        items.push({ category: 'ALERTA', severity: 'critical', text: `${b.name}: ${b.state} — resultado real da última sonda.` });
    }

    // research/sufficiency calculados uma vez e reusados nas secoes 2 e 3 —
    // o mesmo Data Sufficiency Score de research-engine.js, nunca um segundo
    // calculo paralelo so' para o ticker.
    const research = state.researchFrame;
    const sufficiency = research ? research.data_sufficiency : null;
    const multiSourceItem = sufficiency ? (sufficiency.breakdown || []).find((x) => x.field === 'multi_source_confirmation') : null;
    const noMultiSourceConfirmation = !!(multiSourceItem && multiSourceItem.status !== 'OK');

    // 2) Dado real atual (preco/fonte/frescor/z-score) — BTC/USDT.
    const frame = state.analysisFrame;
    if (frame && frame.status === 'OK') {
        // modo reusa o mesmo livePriceInfo.mode do BTC Live Panel (getLivePriceInfo()
        // em app.js, ja' incluido no snapshot por collectLiveTickerState()) em vez de
        // recalcular historical/REAL_READ_ONLY aqui de novo — duas formas de derivar o
        // mesmo estado por caminhos diferentes e' exatamente o tipo de divergencia que
        // faria o ticker dizer REAL_READ_ONLY enquanto o card BTC ja diz STALE para o
        // mesmo preco. Cai no calculo antigo so' se livePriceInfo nao resolveu nada.
        const livePriceMode = state.livePriceInfo && state.livePriceInfo.mode;
        const modo = (livePriceMode && livePriceMode !== DADOS_INSUFICIENTES)
            ? livePriceMode
            : (state.historical ? 'SESSION_PREVIOUS' : 'REAL_READ_ONLY');
        const last = typeof frame.last_price === 'number' ? frame.last_price.toFixed(2) : DADOS_INSUFICIENTES;
        const z = typeof frame.zscore === 'number' ? frame.zscore.toFixed(2) : DADOS_INSUFICIENTES;
        const confirmNote = noMultiSourceConfirmation ? ' · preço real, mas sem confirmação multi-fonte' : '';
        items.push({
            category: 'AR10 LIVE',
            severity: modo === 'REAL_READ_ONLY' ? 'ok' : 'warn',
            text: `${frame.asset || 'BTC/USDT'} · ${modo} · ${frame.source || DADOS_INSUFICIENTES} · ${last} · z=${z} · freshness ${state.freshnessLabel || DADOS_INSUFICIENTES}${confirmNote}`,
        });
    } else {
        items.push({ category: 'AR10 LIVE', severity: 'warn', text: `BTC/USDT · ${DADOS_INSUFICIENTES} — gere o AnalysisFrame real após testar uma fonte real.` });
    }

    // 3) Long/Short Research — sempre as 3 rotas, nunca so' a "favorita".
    // Severidade e' rebaixada para 'warn' (nunca 'ok') quando o Data
    // Sufficiency Score for baixo ou faltarem campos — Long/Short nunca pode
    // aparecer "forte" no ticker so' porque o vies heuristico apontou algo,
    // se os dados reais por tras dele estiverem incompletos.
    if (research && research.rota_a_long && research.rota_b_short && research.rota_c_wait) {
        const a = research.rota_a_long;
        const b = research.rota_b_short;
        const c = research.rota_c_wait;
        const scoreKnown = sufficiency && Number.isFinite(sufficiency.score);
        const lowSufficiency = !scoreKnown || sufficiency.score < 70;
        items.push({
            category: 'LONG/SHORT',
            severity: lowSufficiency ? 'warn' : 'info',
            text: `Rota A (LONG) conf=${a.confidence} · Rota B (SHORT) conf=${b.confidence} · Rota C (WAIT): ${c.data_missing || c.reason || DADOS_INSUFICIENTES}${scoreKnown ? ` · ${sufficiency.label}` : ''}`,
        });
        if (sufficiency && sufficiency.missing_fields && sufficiency.missing_fields.length) {
            items.push({
                category: 'LONG/SHORT',
                severity: 'warn',
                text: `Long/Short limitado: faltam ${sufficiency.missing_fields.join(', ')}.`,
            });
        }
    } else {
        items.push({ category: 'LONG/SHORT', severity: 'warn', text: `${DADOS_INSUFICIENTES} — Research Engine ainda não rodou nesta sessão.` });
    }

    // 3b) Target Tracker — preco vivo (ultima sonda real desta sessao) vs
    // snapshot fixado na ultima analise (state.targetTracker, calculado por
    // app.js:refreshTargetTracker() via research/target-tracker.js). Nunca
    // mostra as duas rotas ao mesmo tempo aqui (ja tem card proprio com o
    // detalhe completo); so' a mais "avancada" das duas (tocada/invalidada
    // primeiro, depois a mais proxima do alvo), pra frase ficar curta.
    const tracker = state.targetTracker;
    if (tracker && tracker.current_price !== DADOS_INSUFICIENTES) {
        const current = tracker.current_price.toFixed(2);
        const snapshot = typeof tracker.snapshot_price === 'number' ? tracker.snapshot_price.toFixed(2) : DADOS_INSUFICIENTES;
        const diffPct = typeof tracker.price_diff_pct === 'number' ? `${tracker.price_diff_pct > 0 ? '+' : ''}${tracker.price_diff_pct.toFixed(2)}%` : DADOS_INSUFICIENTES;
        if (tracker.reanalyze_recommended) {
            items.push({
                category: 'TARGET TRACKER',
                severity: 'warn',
                text: `Snapshot stale ou divergente (${diffPct} vs. preço usado na análise) · toque em "Gerar AnalysisFrame real" para reavaliar.`,
            });
        } else {
            const priority = { TARGET_TOUCHED: 0, INVALIDATED: 0, APPROACHING_TARGET: 1, STALE_REANALYZE: 2, WAITING: 3, DADOS_INSUFICIENTES: 4 };
            const route = [tracker.rota_a_long, tracker.rota_b_short]
                .sort((a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5))[0];
            const target = typeof route.target_1 === 'number' ? route.target_1.toFixed(2) : DADOS_INSUFICIENTES;
            const dist = typeof route.distance_to_target_pct === 'number' ? `${route.distance_to_target_pct.toFixed(2)}%` : DADOS_INSUFICIENTES;
            items.push({
                category: 'TARGET TRACKER',
                severity: (route.status === 'TARGET_TOUCHED' || route.status === 'INVALIDATED') ? 'warn' : 'info',
                text: `BTC/USDT atual ${current} · análise feita em ${snapshot} (${diffPct}) · alvo ${target} · distância ${dist} · ${route.status}`,
            });
        }
    } else {
        items.push({ category: 'TARGET TRACKER', severity: 'warn', text: `${DADOS_INSUFICIENTES} — gere o AnalysisFrame real para iniciar o Target Tracker.` });
    }

    // 4) Hydration / Vault / Safari Edge.
    const vaultOk = state.vaultLabel === 'INSTALADO' || state.vaultLabel === 'ATUALIZADO';
    items.push({
        category: 'SAFARI',
        severity: vaultOk ? 'ok' : 'warn',
        text: `Vault ${state.vaultLabel || DADOS_INSUFICIENTES} · Hydration ${state.hydrationStatus || DADOS_INSUFICIENTES} · Safari Edge ${state.safariEdgeStatus || DADOS_INSUFICIENTES}`,
    });

    // 5) Seguranca — estrutural, sempre presente, sempre por ultimo.
    const riskLabel = state.killSwitchEngaged === null || state.killSwitchEngaged === undefined
        ? DADOS_INSUFICIENTES
        : (state.killSwitchEngaged ? 'BLOCK' : 'ALLOW');
    items.push({
        category: 'SEGURANÇA',
        severity: 'info',
        text: `READ_ONLY · FAIL_CLOSED · LIVE_LOCKED · Risk Gate ${riskLabel}`,
    });

    return items;
}

function itemHtml(item) {
    return `<span class="lt-item ${severityClass(item.severity)}"><b class="lt-tag">[${item.category}]</b> ${item.text}</span>`;
}

// Renderiza no track. Decide animado (marquee continuo) vs. lista estatica
// (sem nenhum movimento) verificando prefers-reduced-motion diretamente —
// nao basta confiar so' na regra global de animation-duration:0.01ms do CSS,
// porque o truque de marquee duplica o conteudo para o loop ficar sem
// emenda; sem essa checagem o usuario com reduced-motion veria so' o
// primeiro item (o resto ficaria cortado fora do viewport, sem nunca
// "passar" porque a animacao parou em 1 frame).
export function renderLiveTicker(items, trackEl) {
    if (!trackEl) return;
    if (!items || !items.length) {
        trackEl.innerHTML = `<span class="lt-item v-pending">[AR10 LIVE] ${DADOS_INSUFICIENTES}</span>`;
        trackEl.classList.remove('lt-animate');
        return;
    }
    const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const html = items.map(itemHtml).join('<span class="lt-sep">•</span>');
    if (reducedMotion) {
        trackEl.classList.remove('lt-animate');
        trackEl.innerHTML = html;
    } else {
        trackEl.classList.add('lt-animate');
        trackEl.innerHTML = `${html}<span class="lt-sep">•</span>${html}`;
    }
}

export function updateLiveTickerFromRuntime(state, trackEl) {
    renderLiveTicker(buildLiveTickerItems(state), trackEl);
}

let tickerTimer = null;
let reduceMotionQuery = null;
let reduceMotionListener = null;

// startLiveTicker: dono do ciclo de vida (timer de atualizacao de conteudo +
// reacao a mudanca de prefers-reduced-motion em tempo real). `getState` e'
// um callback fornecido pelo app.js (collectLiveTickerState) — este modulo
// nunca importa app.js de volta, so' chama o que recebeu, mantendo a mesma
// dependencia em um sentido so' usada no resto do runtime.
export function startLiveTicker(getState, trackEl, { intervalMs = 20000 } = {}) {
    stopLiveTicker();
    const tick = () => updateLiveTickerFromRuntime(getState(), trackEl);
    tick();
    tickerTimer = window.setInterval(tick, intervalMs);
    if (window.matchMedia) {
        reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reduceMotionListener = tick;
        reduceMotionQuery.addEventListener?.('change', reduceMotionListener);
    }
}

export function stopLiveTicker() {
    if (tickerTimer) { window.clearInterval(tickerTimer); tickerTimer = null; }
    if (reduceMotionQuery && reduceMotionListener) { reduceMotionQuery.removeEventListener?.('change', reduceMotionListener); }
    reduceMotionQuery = null;
    reduceMotionListener = null;
}
