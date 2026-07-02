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
import { createEmptyEvidence, validateEvidenceShape } from './real-data/schema.js';
import { Side, SignalType, Signal } from '../src/orderflow/value-objects.js';
import { createEngineState, processSignals, defaultSettings } from '../src/orderflow/signal-engine.js';
import { validateTradesShape, tradesToTicks, filterNewTrades } from './real-data/mexc-trades-stream.js';

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

    const emptyEvidence = createEmptyEvidence({ source_id: 'self_test', source_name: 'self_test', endpoint_kind: 'self_test', symbol: 'SELF_TEST', instrument_type: 'crypto_spot' });
    const shapeOk = validateEvidenceShape(emptyEvidence);
    results.push(check(group, 'Evidence Object vazio bate com o contrato de schema.js', shapeOk.valid, shapeOk.valid ? 'shape ok' : shapeOk.errors.join(',')));
    const shapeRejectsEmpty = validateEvidenceShape({});
    results.push(check(group, 'validador rejeita objeto malformado', shapeRejectsEmpty.valid === false, 'objeto {} deve falhar'));

    return results;
}

function evalOrderflowEngine() {
    const group = 'orderflow_engine';
    const results = [];
    const mkTick = (price, volume, side) => ({ price, volume, side, timestamp: Date.now() });

    // OFI: janela toda comprada deve disparar imbalance ~+1.0; janela
    // balanceada nao deve disparar (sem falso positivo).
    {
        const state = createEngineState();
        const ticks = [];
        for (let i = 0; i < defaultSettings.ofi.windowSize; i++) ticks.push(mkTick(67000 + i, 2, Side.BUY));
        const ofi = processSignals(ticks, state).filter((s) => s.type === SignalType.OFI);
        results.push(check(group, 'OFI dispara em janela 100% comprada', ofi.length >= 1 && Math.abs(ofi[0].metadata.imbalance - 1) < 1e-9, ofi.length ? `imbalance=${ofi[0].metadata.imbalance.toFixed(4)}` : 'nenhum sinal'));
    }
    {
        const state = createEngineState();
        const ticks = [];
        for (let i = 0; i < defaultSettings.ofi.windowSize; i++) ticks.push(mkTick(67000, 2, i % 2 ? Side.BUY : Side.SELL));
        const ofi = processSignals(ticks, state).filter((s) => s.type === SignalType.OFI);
        results.push(check(group, 'OFI nao dispara em janela balanceada', ofi.length === 0, `${ofi.length} sinal(is)`));
    }

    // EXHAUSTION: baseline de baixa variancia (oscila 0/1) + um pico isolado
    // de volume muito acima do desvio-padrao da baseline, com colapso de
    // preco >20% nos ultimos 10 ticks do pico. Uma rampa monotonica pura
    // NAO serve de caso de teste aqui: o z-score fica matematicamente
    // limitado a raiz(3)~1.73 porque currentDelta e sempre o proprio
    // elemento extremo da janela usada para calcular media/desvio — por
    // isso o pico precisa ser curto e isolado dentro de uma janela estavel.
    {
        const state = createEngineState();
        const ticks = [];
        const lb = defaultSettings.exhaustion.deltaLookback;
        for (let i = 0; i < lb + 50; i++) ticks.push(mkTick(67000, 1, i % 2 ? Side.BUY : Side.SELL));
        for (let i = 0; i < 20; i++) {
            const price = i < 10 ? 67000 : 67000 * (1 - 0.03 * (i - 9));
            ticks.push(mkTick(price, 60, Side.BUY));
        }
        const exh = processSignals(ticks, state).filter((s) => s.type === SignalType.EXHAUSTION);
        const detail = exh.length ? `zScore=${exh[0].metadata.zScore.toFixed(2)} delta=${exh[0].metadata.delta} direction=${exh[0].metadata.direction}` : 'nenhum sinal';
        results.push(check(group, 'EXHAUSTION dispara em pico de delta + reversao de preco', exh.length >= 1 && Math.abs(exh[0].metadata.zScore) > defaultSettings.exhaustion.exhaustionThreshold && exh[0].metadata.direction === 'BUY_EXHAUSTED', detail));
    }

    // Value objects: Signal e Tick precisam ser imutaveis (Skill 2) — um
    // sinal emitido pelo engine nunca pode ser adulterado depois.
    {
        const s = new Signal({ type: SignalType.OFI, confidence: 0.9, price: 1, timestamp: 1, metadata: {} });
        results.push(check(group, 'Signal e um value object congelado', Object.isFrozen(s), `frozen=${Object.isFrozen(s)}`));
    }
    {
        const a = createEngineState();
        const b = createEngineState();
        a.ofi.buyVol = 999;
        results.push(check(group, 'createEngineState() nao compartilha estado entre instancias', b.ofi.buyVol === 0, `b.ofi.buyVol=${b.ofi.buyVol}`));
    }

    return results;
}

/** Auto-teste 100% offline das funcoes puras de mexc-trades-stream.js (Task
 *  #37) — nao toca rede, roda em qualquer sessao independente de
 *  conectividade real com api.mexc.com (ver "Honestidade de plataforma" no
 *  cabecalho daquele arquivo: a sonda real so e validavel ao vivo, fora
 *  deste sandbox). Cobre exatamente as 3 funcoes exportadas para isso:
 *  validacao de shape fail-closed, mapeamento isBuyerMaker->Side e dedup
 *  por lastTradeId entre ciclos de polling. */
function evalMexcLiveConnector() {
    const group = 'mexc_live_connector';
    const results = [];

    results.push(check(group, 'validateTradesShape aceita amostra bem formada', validateTradesShape([{ price: '67000.5', qty: '0.01', time: 1700000000000, isBuyerMaker: true, id: 1 }]).valid, 'amostra com price/qty/time/isBuyerMaker'));
    results.push(check(group, 'validateTradesShape rejeita resposta nao-array (fail-closed)', validateTradesShape({}).valid === false, 'objeto {} deve falhar'));
    results.push(check(group, 'validateTradesShape rejeita array vazio', validateTradesShape([]).valid === false, '[] deve falhar'));
    results.push(check(group, 'validateTradesShape rejeita item sem campos esperados', validateTradesShape([{ foo: 1 }]).valid === false, 'item sem price/qty/time/isBuyerMaker deve falhar'));

    {
        const ticks = tradesToTicks([
            { price: '100', qty: '1', time: 2, isBuyerMaker: true },
            { price: '101', qty: '2', time: 1, isBuyerMaker: false },
        ]);
        results.push(check(group, 'tradesToTicks ordena por tempo ascendente de forma defensiva', ticks[0].timestamp === 1 && ticks[1].timestamp === 2, `timestamps=${ticks.map((t) => t.timestamp).join(',')}`));
        results.push(check(group, 'tradesToTicks: isBuyerMaker=false => agressor comprador => Side.BUY', ticks[0].side === Side.BUY, `side=${ticks[0].side}`));
        results.push(check(group, 'tradesToTicks: isBuyerMaker=true => agressor vendedor => Side.SELL', ticks[1].side === Side.SELL, `side=${ticks[1].side}`));
    }

    {
        const rows = [{ id: 5 }, { id: 6 }, { id: 7 }];
        const firstCycle = filterNewTrades(rows, null);
        results.push(check(group, 'filterNewTrades admite a janela inteira no primeiro ciclo (lastTradeId=null)', firstCycle.length === 3, `${firstCycle.length} linha(s)`));
        const nextCycle = filterNewTrades(rows, 6);
        results.push(check(group, 'filterNewTrades (dedup) so admite ids estritamente maiores que lastTradeId', nextCycle.length === 1 && nextCycle[0].id === 7, `${nextCycle.length} linha(s) nova(s)`));
    }

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

    const groups = [evalCommandRouting(), evalSecurityPosture(), evalDataPolicy(), evalOrderflowEngine(), evalMexcLiveConnector()];
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
