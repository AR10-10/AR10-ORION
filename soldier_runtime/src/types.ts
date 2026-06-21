// types.ts — Contrato de tipos do Sync Bridge Commander<->Soldier.
// NOT_DEPLOYED: este arquivo não é compilado, importado ou executado por
// nenhum runtime real neste repositório. Existe só para que um Soldier
// real, quando implementado, tenha um contrato pensado para implementar —
// em vez de inventar um formato ad hoc no momento. Ver README.md desta
// pasta para o racional completo.
//
// Cada forma abaixo espelha deliberadamente um módulo real e já em
// execução em ipad_runtime/ (Commander) — citado no comentário de cada
// bloco — para que o Sync Bridge nunca precise de uma camada de tradução
// entre "o que o Commander entende" e "o que o Soldier inventou sozinho".

/** Espelha SEVERITY de ipad_runtime/js/core/event-bus.js. */
export type Severity = 'INFO' | 'OK' | 'WARN' | 'FAIL' | 'CRITICAL';

/**
 * Espelha SOURCE de ipad_runtime/js/core/event-bus.js, com 'SOLDIER'
 * adicionado de propósito. O event-bus.js real do Commander NÃO inclui
 * 'SOLDIER' no seu enum — nenhum processo Soldier real existe nesta versão
 * para emitir nada. Este contrato é o lugar certo para esse terceiro valor
 * existir primeiro, antes de existir um processo real para usá-lo.
 */
export type SyncSource = 'COMMANDER' | 'SOLDIER' | 'SYSTEM';

/** Espelha o formato de evento de emit() em event-bus.js. */
export interface SyncEvent {
    seq: number;
    event_type: string;
    source: SyncSource;
    data_mode: string | null;
    severity: Severity;
    payload: unknown;
    correlation_id: string | null;
    at: string; // ISO 8601
}

/** Espelha o snapshot de ipad_runtime/js/memory/snapshot-manager.js. */
export interface StateSnapshot {
    state: Record<string, unknown>;
    hash: string; // sha256 hex de JSON.stringify(state)
    taken_at: string; // ISO 8601
    promoted_at?: string; // presente só quando promovido a "last good"
}

/** Espelha o relatório de ipad_runtime/js/memory/recovery-report.js. */
export type RecoveryStatus = 'CLEAN_BOOT' | 'RECOVERED' | 'PARTIAL_RECOVERY' | 'FAILED';

export interface RecoveryReport {
    recovery_id: string;
    boot_time: string; // ISO 8601
    restored_from: string;
    status: RecoveryStatus;
    restored_event_count: number;
    missing_event_count: number;
    last_good_state_hash: string | null;
    actions_required: string[];
    siriform_summary: string;
}

/** Espelha DEFAULT_CONFIG de ipad_runtime/js/trading/risk-gate.js. */
export interface RiskGateConfig {
    kill_switch_engaged: boolean;
    max_drawdown_pct: number;
    max_position_size_quote: number;
    require_stop_loss: boolean;
    min_source_data_quality: 'DADOS_INSUFICIENTES' | 'PARCIAL' | 'COMPLETA_PARA_CAPACIDADES_TENTADAS';
}

/** Espelha o retorno de evaluateOrder() em ipad_runtime/js/trading/risk-gate.js. */
export interface RiskGateDecision {
    decision: 'ALLOW' | 'BLOCK';
    reasons: string[];
    evaluated_at: string; // ISO 8601
    config_used: RiskGateConfig;
    execution_note: string;
}

/**
 * Heartbeat que um Soldier real enviaria pelo Sync Bridge. Não espelha
 * nenhum módulo existente porque não há Soldier real ainda — esta forma é
 * o ponto de partida proposto, não um contrato já validado em produção.
 */
export type SoldierStatus = 'BOOTING' | 'RUNNING' | 'DEGRADED' | 'STOPPING' | 'STOPPED';

export interface SoldierStatusReport {
    soldier_id: string;
    status: SoldierStatus;
    version: string;
    uptime_seconds: number;
    last_heartbeat_at: string; // ISO 8601
    connected_connectors: string[]; // connector_id[] ativos no Soldier
    risk_gate_config: RiskGateConfig;
}

/**
 * Comando que o Commander poderia emitir para o Soldier pelo Sync Bridge.
 * Deliberadamente pequeno e auditável — cada tipo de comando corresponde a
 * uma ação que já existe no lado do Commander hoje (ver
 * ipad_runtime/js/trading/risk-gate.js engageKillSwitch/disengageKillSwitch),
 * para que o Soldier nunca precise aceitar um comando sem equivalente
 * auditável no Commander.
 */
export type SyncCommandType =
    | 'REQUEST_STATUS'
    | 'REQUEST_SNAPSHOT'
    | 'ENGAGE_KILL_SWITCH'
    | 'DISENGAGE_KILL_SWITCH'
    | 'SYNC_STATE';

export interface SyncBridgeCommand {
    command_id: string;
    command_type: SyncCommandType;
    issued_by: 'COMMANDER';
    issued_at: string; // ISO 8601
    payload: unknown;
}

/** Envelope de transporte único do Sync Bridge — uma mensagem é sempre
 *  exatamente uma destas três formas, nunca uma mistura. */
export type SyncBridgeMessage =
    | { kind: 'EVENT'; message: SyncEvent }
    | { kind: 'COMMAND'; message: SyncBridgeCommand }
    | { kind: 'STATUS_REPORT'; message: SoldierStatusReport };
