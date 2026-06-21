// risk-gate.js — Risk Gate real (não decorativo): toda ordem de Paper
// Trading passa por aqui antes de ser aceita. Não existe nenhuma rota de
// execução real neste runtime (sem order_send, sem endpoint privado — ver
// CSP em index.html), então este gate hoje só pode bloquear/permitir Paper
// Trading; mas a lógica de avaliação é real e é o mesmo padrão que seria
// exigido antes de qualquer execução real futura. Nenhuma ordem passa sem
// Stop Loss definido (NO_STOP_NO_TRADE), sem fonte de preço com qualidade
// suficiente, com posição maior que o limite configurado, ou com o kill
// switch ativado.

import { setMeta, getMeta } from '../storage.js';
import { emit, SEVERITY } from '../core/event-bus.js';

const CONFIG_KEY = 'ar10_risk_gate_config_v1';

const DEFAULT_CONFIG = Object.freeze({
    kill_switch_engaged: false,
    max_drawdown_pct: 5,
    max_position_size_quote: 100,
    require_stop_loss: true,
    min_source_data_quality: 'PARCIAL',
});

const QUALITY_RANK = Object.freeze({ DADOS_INSUFICIENTES: 0, PARCIAL: 1, COMPLETA_PARA_CAPACIDADES_TENTADAS: 2 });

export async function getConfig() {
    const stored = await getMeta(CONFIG_KEY);
    return { ...DEFAULT_CONFIG, ...(stored || {}) };
}

export async function setConfig(partial) {
    const current = await getConfig();
    const next = { ...current, ...partial };
    await setMeta(CONFIG_KEY, next);
    return next;
}

export async function engageKillSwitch() {
    const next = await setConfig({ kill_switch_engaged: true });
    emit('risk_gate_kill_switch_engaged', { severity: SEVERITY.WARN, payload: { config: next } });
    return next;
}

export async function disengageKillSwitch() {
    const next = await setConfig({ kill_switch_engaged: false });
    emit('risk_gate_kill_switch_disengaged', { severity: SEVERITY.OK, payload: { config: next } });
    return next;
}

/** Avalia UMA ordem proposta de Paper Trading.
 *  @param {{side?:string, sizeQuote?:number, stopLoss?:number, sourceDataQuality?:string}} order
 *  @param {{currentDrawdownPct?:number}} context
 *  Nunca retorna ALLOW se faltar qualquer requisito — cada bloqueio vem com
 *  motivo explícito em português, nunca um "não" silencioso. */
export async function evaluateOrder(order = {}, context = {}) {
    const cfg = await getConfig();
    const reasons = [];

    if (cfg.kill_switch_engaged) {
        reasons.push('Kill switch está ativado — toda nova ordem (mesmo paper) fica bloqueada até ser desativado manualmente.');
    }
    if (cfg.require_stop_loss && (order.stopLoss === undefined || order.stopLoss === null)) {
        reasons.push('NO_STOP_NO_TRADE: nenhuma ordem é aceita sem Stop Loss definido.');
    }
    const quality = order.sourceDataQuality || 'DADOS_INSUFICIENTES';
    if ((QUALITY_RANK[quality] ?? 0) < (QUALITY_RANK[cfg.min_source_data_quality] ?? 1)) {
        reasons.push(`Qualidade da fonte de preço insuficiente (${quality}) — mínimo exigido: ${cfg.min_source_data_quality}.`);
    }
    if (typeof order.sizeQuote === 'number' && order.sizeQuote > cfg.max_position_size_quote) {
        reasons.push(`Tamanho da posição (${order.sizeQuote}) excede o limite configurado (${cfg.max_position_size_quote}).`);
    }
    const drawdown = context.currentDrawdownPct ?? 0;
    if (drawdown >= cfg.max_drawdown_pct) {
        reasons.push(`Drawdown atual (${drawdown.toFixed ? drawdown.toFixed(2) : drawdown}%) já atingiu ou superou o limite configurado (${cfg.max_drawdown_pct}%).`);
    }

    return {
        decision: reasons.length === 0 ? 'ALLOW' : 'BLOCK',
        reasons,
        evaluated_at: new Date().toISOString(),
        config_used: cfg,
        execution_note: 'Mesmo quando ALLOW, este Risk Gate nunca autoriza execução real — não existe rota de execução real neste runtime. ALLOW aqui só libera Paper Trading.',
    };
}
