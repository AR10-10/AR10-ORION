// types.ts — Contrato de tipos do Telegram AUX/Quarantine.
// NOT_CONNECTED: este arquivo não é compilado, importado ou executado por
// nenhum runtime real neste repositório. Nenhuma integração com Telegram
// existe hoje em nenhum lugar do código (ver varredura: zero ocorrências de
// "telegram" em ipad_runtime/). Este contrato existe para registrar, antes
// de qualquer implementação, que a única forma permitida é notificação de
// saída (outbound-only) — nunca um canal de comando.
//
// A garantia estrutural deste arquivo: não existe nenhum tipo aqui que
// represente "comando recebido do Telegram". Não é uma regra documentada em
// comentário que um handler futuro precisaria lembrar de respeitar — é a
// ausência do próprio tipo. Quem quiser adicionar um "TelegramInboundCommand"
// no futuro precisa editar este arquivo de propósito, em um diff revisável,
// nunca por acidente.

import type { Severity } from '../src/types.js';

/**
 * Onde o bot token real seria armazenado, se um dia existir. Nunca no
 * frontend, nunca no repositório, nunca no storage do PWA — mesma postura
 * de WindowsLocalSecretPolicy (../windows/types.ts), mas para este conector
 * auxiliar especificamente.
 */
export interface TelegramAuxSecretPolicy {
    storage: 'WINDOWS_CREDENTIAL_MANAGER' | 'ENV_FILE_LOCAL_ONLY';
    never_in_frontend: true;
    never_in_repo: true;
    never_in_pwa_storage: true;
}

/** Estado da conexão — hoje sempre seria 'NOT_CONNECTED' em qualquer leitura
 *  real, porque nenhuma conexão foi estabelecida. */
export type TelegramAuxStatus = 'NOT_CONNECTED' | 'CONFIGURED_INACTIVE' | 'ACTIVE_NOTIFY_ONLY' | 'ERROR';

export interface TelegramAuxConfig {
    bot_token_storage: TelegramAuxSecretPolicy;
    chat_id_placeholder: string;
    status: TelegramAuxStatus;
    direction: 'OUTBOUND_ONLY';
}

/**
 * Uma mensagem de notificação enviada PARA o Telegram. `direction` é fixado
 * no literal `'OUTBOUND_ONLY'` — não existe (de propósito) nenhuma forma
 * gêmea "INBOUND" neste arquivo. Reaproveita Severity de ../src/types.ts em
 * vez de inventar uma escala paralela de urgência.
 */
export interface TelegramAuxMessage {
    message_id: string;
    text: string;
    severity: Severity;
    sent_at: string; // ISO 8601
    direction: 'OUTBOUND_ONLY';
    delivery_confirmed: boolean;
}

/**
 * Política explícita do que este conector nunca pode se tornar. Cada campo
 * é um literal `true` fixo, não um booleano livre — a negação está no
 * próprio tipo.
 */
export interface TelegramAuxQuarantinePolicy {
    accepts_inbound_commands: false;
    can_engage_or_disengage_kill_switch: false;
    can_submit_orders: false;
    treated_as_signal_source: false;
}

/** Status declarado deste scaffold — nunca lido por nenhum runtime real. */
export const TELEGRAM_AUX_STATUS = 'NOT_CONNECTED' as const;
