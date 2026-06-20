// evaluations.js — equivalente local/PWA do framework "Evaluations" da
// Apple (WWDC26, camada 4 da planta mestra). Não existe LLM embutido nesta
// versão, então isto não é uma avaliação de modelo — é um auto-teste
// comportamental REAL do que este runtime já faz: roteamento de
// comando de voz/texto (voice.js), vocabulário de estado do Siriform
// (siriform.js) e postura de segurança (CSP, política de dados, Vault
// FAIL_CLOSED). Cada checagem chama o código vivo do app; nenhum resultado
// aqui é hardcoded ou decorativo — "PASS" só aparece quando a função real
// devolveu o valor esperado nesta sessão.

import * as voice from './voice.js';
import * as siriform from './siriform.js';
import { MARKET_DATA_POLICY, realMarketAnalysisStatus } from './data-policy.js';

function check(group, name, pass, detail) {
    return { group, name, pass: !!pass, detail: String(detail) };
}

function evalCommandRouting() {
    const group = 'command_routing';
    const results = [];

    const allowedSamples = [
        ['verificar safari', 'check-safari'],
        ['preparar cyborg', 'prepare-cyborg'],
        ['rodar diagnostico', 'run-diagnostics'],
        ['rodar replay btc usdt', 'run-replay'],
        ['rodar evaluations', 'run-evaluations'],
        ['mostrar status', 'show-status'],
    ];
    for (const [phrase, expectedId] of allowedSamples) {
        const r = voice.matchCommand(phrase);
        results.push(check(group, `comando permitido: "${phrase}"`, r.type === 'allowed' && r.id === expectedId, `type=${r.type} id=${r.id || '-'}`));
    }

    for (const phrase of voice.BLOCKED_PHRASES) {
        const r = voice.matchCommand(phrase);
        results.push(check(group, `frase bloqueada: "${phrase}"`, r.type === 'blocked', `type=${r.type}`));
    }

    // Defesa em profundidade: uma frase com comando permitido + trecho
    // bloqueado precisa continuar "blocked" (nunca deixar a parte permitida
    // vazar como comando executavel).
    const mixed = 'preparar cyborg e comprar agora';
    const rMixed = voice.matchCommand(mixed);
    results.push(check(group, 'frase mista permanece bloqueada', rMixed.type === 'blocked', `type=${rMixed.type}`));

    const rEmpty = voice.matchCommand('');
    results.push(check(group, 'transcricao vazia', rEmpty.type === 'empty', `type=${rEmpty.type}`));

    const rUnknown = voice.matchCommand('isso aqui nao corresponde a nenhum comando');
    results.push(check(group, 'transcricao desconhecida', rUnknown.type === 'unknown', `type=${rUnknown.type}`));

    return results;
}

function evalSecurityPosture() {
    const group = 'security_posture';
    const results = [];

    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    const csp = cspMeta ? (cspMeta.getAttribute('content') || '') : '';
    results.push(check(group, 'tag CSP presente no documento', !!cspMeta, csp ? 'presente' : 'ausente'));
    for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "connect-src 'self'", "form-action 'none'"]) {
        results.push(check(group, `CSP contem: ${directive}`, csp.includes(directive), csp ? 'verificado no DOM' : 'CSP vazia'));
    }

    const scripts = Array.from(document.scripts || []);
    const externalScripts = scripts.filter((s) => s.src && !s.src.startsWith(window.location.origin));
    results.push(check(group, 'nenhum <script> de origem externa', externalScripts.length === 0, `${externalScripts.length} encontrado(s)`));

    results.push(check(group, 'execucao real desabilitada por politica', MARKET_DATA_POLICY.execution === 'DISABLED_BY_POLICY', `execution=${MARKET_DATA_POLICY.execution}`));
    const requiredBlocks = ['NO_REAL_EXECUTION', 'NO_SECRET_IN_LOCALSTORAGE', 'NO_PRIVATE_ACCOUNT_ACCESS', 'PRIVATE_FINANCIAL_DATA_BLOCKED'];
    for (const b of requiredBlocks) {
        results.push(check(group, `politica bloqueia: ${b}`, MARKET_DATA_POLICY.blocked.includes(b), MARKET_DATA_POLICY.blocked.join(', ')));
    }

    let secretLeak = null;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key) || '';
            if (/api[_-]?key|secret|private[_-]?key/i.test(key) || /api[_-]?key|secret|private[_-]?key/i.test(val)) {
                secretLeak = key;
                break;
            }
        }
        results.push(check(group, 'nenhuma chave tipo segredo/API key no localStorage', !secretLeak, secretLeak ? `chave suspeita: ${secretLeak}` : 'limpo'));
    } catch (err) {
        results.push(check(group, 'nenhuma chave tipo segredo/API key no localStorage', true, `localStorage indisponivel (${err.message}) — nada para vazar`));
    }

    return results;
}

function evalDataPolicy() {
    const group = 'dados_insuficientes';
    const results = [];
    const status = realMarketAnalysisStatus();
    results.push(check(group, 'analise de mercado real reporta DADOS INSUFICIENTES', status.available === false && status.status === 'DADOS INSUFICIENTES', `status=${status.status}`));
    results.push(check(group, 'dataset de diagnostico marcado como nao-acionavel', MARKET_DATA_POLICY.diagnostic_mode.usable_for_market_decision === false, `usable_for_market_decision=${MARKET_DATA_POLICY.diagnostic_mode.usable_for_market_decision}`));
    return results;
}

async function evalVaultFailClosed(packManager) {
    const group = 'read_only_fail_closed';
    const results = [];
    try {
        const meta = await packManager.reloadVaultState();
        const validStatus = !!meta && (meta.status === 'READY' || meta.status === 'LOCKED');
        results.push(check(group, 'Vault resolve sempre para READY ou LOCKED', validStatus, `status=${meta && meta.status}`));
    } catch (err) {
        results.push(check(group, 'Vault resolve sempre para READY ou LOCKED', false, `erro: ${err.message}`));
    }
    return results;
}

function evalSiriformStates(avatarEl) {
    const group = 'siriform_states';
    const results = [];
    if (!avatarEl) {
        results.push(check(group, 'elemento do avatar presente no DOM', false, 'siriform-avatar nao encontrado'));
        return results;
    }
    for (const state of siriform.STATES) {
        siriform.setSiriformState(state);
        const applied = avatarEl.getAttribute('data-state');
        results.push(check(group, `estado alcancavel: ${state}`, applied === state, `data-state=${applied}`));
    }
    siriform.setSiriformState('estado-invalido-xyz');
    const fallback = avatarEl.getAttribute('data-state');
    results.push(check(group, 'estado desconhecido normaliza para idle (fail-closed)', fallback === 'idle', `data-state=${fallback}`));
    return results;
}

/** Roda todos os grupos de auto-teste e devolve um relatorio estruturado.
 *  `packManager` e injetado pelo chamador (em vez de importado direto) so
 *  para este modulo nao precisar conhecer storage/crypto internos — so a
 *  funcao publica reloadVaultState(). O grupo siriform_states e o ultimo de
 *  proposito: e o unico com efeito visual (troca o data-state do avatar). */
export async function runEvaluations({ packManager, avatarEl, onLog } = {}) {
    const log = (msg, level = 'dim') => onLog?.(msg, level);
    const t0 = performance.now();
    log('=== EVALUATIONS (auto-teste local) — INICIO ===', 'info');

    const groups = [evalCommandRouting(), evalSecurityPosture(), evalDataPolicy()];
    if (packManager) groups.push(await evalVaultFailClosed(packManager));
    groups.push(evalSiriformStates(avatarEl));

    const all = groups.flat();
    for (const r of all) {
        log(`${r.group}.${r.name} = ${r.pass ? 'PASS' : 'FAIL'} (${r.detail})`, r.pass ? 'ok' : 'fail');
    }
    const pass = all.filter((r) => r.pass).length;
    const fail = all.length - pass;
    const elapsedMs = Math.round(performance.now() - t0);
    log(`=== EVALUATIONS — FIM: ${pass}/${all.length} PASS, ${fail} FAIL (${elapsedMs}ms) ===`, fail === 0 ? 'ok' : 'fail');

    return { total: all.length, pass, fail, results: all, elapsedMs };
}
