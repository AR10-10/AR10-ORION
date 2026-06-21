// telegram-aux-status.js — Telegram AUX/Quarantine: status declarado desta
// camada auxiliar nesta versao. Espelha em codigo real (lido pela UI) o
// contrato ja registrado em soldier_runtime/telegram-aux/types.ts — cada
// valor abaixo e' a politica deliberada desta fase, nao uma medicao.
//
// Garantia estrutural: nenhuma funcao deste arquivo abre rede, le token, ou
// aceita comando — exatamente como TelegramAuxQuarantinePolicy declara em
// soldier_runtime/telegram-aux/types.ts. Nao existe import de fetch/XHR/
// WebSocket neste arquivo, de proposito.

// Fila real (sempre vazia nesta fase: nenhum produtor existe ainda) usada
// so para o campo Signal Quarantine nao ser um literal solto — se algum dia
// um sinal real entrar aqui, o campo passa a refletir o tamanho real da
// fila, nunca um numero decorativo.
const QUARANTINE_QUEUE = [];

const SIRIFORM_SUMMARY = 'Telegram nesta versão é só uma camada auxiliar de '
    + 'notificação — nunca um executor. Token e webhook não existem nesta '
    + 'fase (NOT_CONFIGURED/DISABLED), então nenhuma rede nova foi aberta. '
    + 'Se um sinal chegar por aqui no futuro, ele entra em quarentena '
    + '(Signal Quarantine), é rejeitado automaticamente sem stop loss, e só '
    + 'pode ser considerado depois de validação do Soldier e aprovação do '
    + 'Risk Gate — nunca como fonte de verdade isolada. Live Trading '
    + 'continua LIVE_LOCKED independente do que o Telegram disser. '
    + 'is_authoritative é sempre FALSE.';

/**
 * Estado declarado desta camada nesta versao — politica, nao medicao.
 * @returns {object} relatorio pronto para exibicao — is_authoritative
 *   sempre false.
 */
export function getTelegramAuxStatusReport() {
    return {
        telegram_layer: 'QUARANTINE_READY',
        bot_token: 'NOT_CONFIGURED',
        webhook: 'DISABLED',
        live_execution: 'FORBIDDEN',
        signal_quarantine: QUARANTINE_QUEUE.length > 0 ? 'READY' : 'EMPTY',
        source_trust: 'NOT_EVALUATED',
        allowed_commands: 'PLANNED',
        risk_gate: 'REQUIRED',
        event_ledger: 'REQUIRED',
        is_authoritative: false,
        siriform_summary: SIRIFORM_SUMMARY,
    };
}
