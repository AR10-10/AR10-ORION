// probe-ws.js — Sonda real de WebSocket publico (Runtime WS Probe), mesma
// missao AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1 de probe.js, mas
// para transporte WebSocket (conexao persistente, mensagens push) em vez de
// request/response REST. Continua sendo UMA sonda por chamada: abre, envia a
// mensagem de inscricao do chamador, captura a primeira mensagem que o
// `validate` do chamador reconhecer como dado real (nao um ack/keepalive), e
// fecha o socket — nunca mantem o stream aberto entre chamadas, nunca chama
// ordem/endpoint privado.
//
// Nota honesta sobre classificacao de falha (equivalente ao aviso
// CORS-vs-rede de probe.js, adaptado para WS): a API WebSocket nao exp~oe
// motivo/status no evento 'error' por design (mesma opacidade do TypeError
// generico do fetch) — entao:
// - `new WebSocket(url)` lancando excecao SINCRONA e o sinal mais proximo de
//   "bloqueado por politica do navegador" que existe aqui (tipicamente CSP
//   connect-src ou mixed-content) -> BLOCKED_BY_POLICY.
// - conexao fechando ('close') antes de qualquer mensagem reconhecida chegar
//   e ambiguo (rede indisponivel, host recusou, ou outro motivo que o
//   navegador nao revela) -> FAILED, nunca uma certeza que a plataforma nao
//   oferece.
// - timeout sem nenhuma mensagem reconhecida -> DEGRADED (mesmo rotulo que
//   probe.js usa para AbortError).
// - mensagem(ns) reais chegaram mas nenhuma bateu o schema esperado do
//   `validate` (incluindo frame binario nao-textual, provavel protobuf) ->
//   BLOCKED_BY_SCHEMA.
// Sem chave, sem credencial, sem canal privado — so' inscricao publica de
// mercado. Ver CSP connect-src em index.html, a barreira de navegador que
// torna isto verdade mesmo se este modulo tivesse um bug.

import { CONNECTOR_STATES } from './schema.js';

/**
 * @param {{
 *   url: string,
 *   timeoutMs?: number,
 *   maxMessages?: number,
 *   buildSubscribeMessage: () => (string|object),
 *   validate: (parsed: any, rawText: string) => ({ matched: true, [extra: string]: any } | { matched: false, control?: boolean, reason?: string }),
 * }} opts
 * @returns {Promise<{state: string, raw_text: string|null, json: any, matched: any, reason: string, elapsed_ms: number}>}
 */
export function probeWebSocketEndpoint({ url, timeoutMs = 8000, maxMessages = 10, buildSubscribeMessage, validate }) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
        const result = {
            state: CONNECTOR_STATES.BLOCKED_BY_POLICY,
            raw_text: null,
            json: null,
            matched: null,
            reason: 'nao_executado',
            elapsed_ms: null,
        };
        let settled = false;
        let messagesSeen = 0;
        let lastSchemaReason = 'nenhuma_mensagem_recebida_no_periodo_da_sonda';
        let ws = null;
        let timer = null;

        function finish(state, reason, extra) {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            result.state = state;
            result.reason = reason;
            result.elapsed_ms = Date.now() - startedAt;
            if (extra) Object.assign(result, extra);
            try { if (ws) ws.close(); } catch { /* socket pode ja estar fechando/fechado */ }
            resolve(result);
        }

        timer = setTimeout(() => {
            finish(CONNECTOR_STATES.DEGRADED, `sem_mensagem_reconhecida_em_${timeoutMs}ms_timeout`);
        }, timeoutMs);

        if (!('WebSocket' in self)) {
            finish(CONNECTOR_STATES.BLOCKED_BY_POLICY, 'websocket_indisponivel_neste_runtime');
            return;
        }

        try {
            ws = new WebSocket(url);
        } catch {
            finish(CONNECTOR_STATES.BLOCKED_BY_POLICY, 'construtor_websocket_lancou_excecao_sincrona_provavel_csp_ou_mixed_content');
            return;
        }

        ws.onopen = () => {
            try {
                const sub = buildSubscribeMessage();
                ws.send(typeof sub === 'string' ? sub : JSON.stringify(sub));
            } catch (err) {
                finish(CONNECTOR_STATES.FAILED, `falha_ao_enviar_mensagem_de_inscricao:${err.message || err}`);
            }
        };

        ws.onclose = () => {
            finish(CONNECTOR_STATES.FAILED, 'conexao_websocket_fechada_antes_de_mensagem_reconhecida_rede_ou_host_recusou');
        };

        ws.onmessage = (event) => {
            messagesSeen += 1;
            const rawText = typeof event.data === 'string' ? event.data : null;
            if (rawText === null) {
                lastSchemaReason = 'mensagem_binaria_nao_textual_provavel_protobuf_nao_decodificada';
                if (messagesSeen >= maxMessages) finish(CONNECTOR_STATES.BLOCKED_BY_SCHEMA, lastSchemaReason);
                return;
            }

            let parsed;
            try {
                parsed = JSON.parse(rawText);
            } catch {
                lastSchemaReason = 'mensagem_nao_e_json_valido';
                if (messagesSeen >= maxMessages) finish(CONNECTOR_STATES.BLOCKED_BY_SCHEMA, lastSchemaReason);
                return;
            }

            let verdict;
            try {
                verdict = validate(parsed, rawText);
            } catch (err) {
                verdict = { matched: false, reason: `validador_de_schema_lancou_excecao:${err.message || err}` };
            }

            if (verdict && verdict.matched === true) {
                finish(CONNECTOR_STATES.ACTIVE_READ_ONLY, 'probe_real_passou', { raw_text: rawText, json: parsed, matched: verdict });
                return;
            }
            if (verdict && verdict.control === true) return; // ack/pong/keepalive: continua esperando o dado real
            lastSchemaReason = (verdict && verdict.reason) || 'schema_nao_corresponde_ao_esperado';
            if (messagesSeen >= maxMessages) finish(CONNECTOR_STATES.BLOCKED_BY_SCHEMA, lastSchemaReason);
        };
    });
}
