// reflection-engine.js — ReflectionReport: sintese de fim de sessao sobre o
// que o Event Bus e o memory-store ja registraram. Nao e' aprendizado de
// maquina, e' agregacao/template sobre dados que ja existem (event-bus.js em
// RAM nesta aba, e o Evidence Ledger persistido). Nenhuma sugestao de regra
// e aplicada automaticamente — "rules_to_adjust" e' so texto explicativo
// para o humano decidir.

import { getRecentEvents } from '../core/event-bus.js';
import { getSetupScoreHistory, recordReflectionReport, getReflectionHistory as getHistoryFromStore } from './memory-store.js';

const BLOCKED_EVENT_PATTERN = /blocked|bloqueado|kill_switch_engaged/i;

/** @param {{sessionId?:string, paperSummary?:object, riskGateConfig?:object}} ctx */
export async function buildReflectionReport({ sessionId, paperSummary, riskGateConfig } = {}) {
    const events = getRecentEvents(200);
    const blocked = events.filter((e) => BLOCKED_EVENT_PATTERN.test(e.event_type || ''));
    const scores = await getSetupScoreHistory(20);

    const observar = scores.filter((s) => s.final_label === 'OBSERVAR').length;
    const paperOnly = scores.filter((s) => s.final_label === 'PAPER_ONLY').length;
    const bloqueado = scores.filter((s) => s.final_label === 'BLOQUEADO').length;
    const insuficiente = scores.filter((s) => s.final_label === 'DADOS_INSUFICIENTES').length;

    return {
        report_id: `reflect_${Date.now()}`,
        session_id: sessionId || 'sessao_atual',
        generated_at: new Date().toISOString(),
        what_changed: `Esta sessao gerou ${scores.length} leitura(s) de Local Intelligence (Evidence Ledger).`,
        what_worked: paperSummary
            ? `Paper Trading em modo ${paperSummary.mode}: ${paperSummary.open_positions} posicao(oes) aberta(s), ${paperSummary.closed_trades} fechada(s).`
            : 'Nenhum dado de Paper Trading disponivel nesta sessao.',
        what_failed: bloqueado > 0
            ? `${bloqueado} leitura(s) marcada(s) BLOQUEADO (kill switch ou qualidade de fonte baixa).`
            : 'Nenhuma leitura BLOQUEADA na amostra recente.',
        blocked_actions: blocked.slice(0, 10).map((e) => e.event_type),
        data_quality_notes: insuficiente > 0
            ? `${insuficiente} leitura(s) com DADOS_INSUFICIENTES — sem fonte real fresca o suficiente no momento.`
            : 'Fonte de dados suficiente nas leituras recentes desta amostra.',
        paper_notes: paperOnly > 0
            ? `${paperOnly} leitura(s) elegiveis apenas para Paper (PAPER_ONLY).`
            : 'Nenhuma leitura PAPER_ONLY nesta amostra.',
        memory_updates: `${scores.length} leitura(s) de score e este relatorio sao gravados no Evidence Ledger (kind=local_setup_score / local_reflection_report).`,
        rules_to_adjust: riskGateConfig && riskGateConfig.kill_switch_engaged
            ? 'Kill switch do Risk Gate permanece ACIONADO; nenhuma regra nova e sugerida automaticamente.'
            : 'Nenhuma sugestao automatica de regra nesta versao — qualquer ajuste de regra exige decisao humana explicita.',
        next_safe_steps: [
            `Revisar manualmente as ${observar} leitura(s) marcada(s) OBSERVAR.`,
            'Manter Paper First / Live Locked.',
            'Reexecutar Evaluations periodicamente para confirmar postura de seguranca.',
        ],
        is_authoritative: false,
        is_recommendation: false,
    };
}

export async function buildAndRecordReflectionReport(context) {
    const report = await buildReflectionReport(context);
    await recordReflectionReport(report);
    return report;
}

export async function getReflectionHistory(limit = 10) {
    return getHistoryFromStore(limit);
}
