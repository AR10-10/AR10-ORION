// probe.js — Sonda real de rede (Runtime CORS Probe), mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1.
// fetch() de verdade contra endpoint publico, classificado honestamente no
// vocabulario do Connector State Machine (schema.js). Nunca assume sucesso:
// todo resultado vem de uma resposta HTTP real observada nesta sessao, ou de
// uma rejeicao real do fetch(). So endpoint publico, sem chave, sem
// credencial, sem endpoint privado — ver CSP connect-src em index.html, que
// e a barreira de navegador que torna isto verdade mesmo se este modulo
// tivesse um bug.
//
// Nota honesta sobre limite de plataforma: a API fetch() do navegador, por
// design de seguranca, nao distingue de forma confiavel "bloqueado por CORS"
// de "rede indisponivel/DNS falhou" no caso generico — ambos chegam como o
// mesmo TypeError de rejeicao, sem detalhe. Classificamos esse caso como
// BLOCKED_BY_CORS com a ressalva explicita na evidencia (campo `reason`),
// em vez de fingir uma certeza que a plataforma nao oferece.

import { CONNECTOR_STATES } from './schema.js';

/**
 * @param {{url: string, timeoutMs?: number, validate?: (json: any) => {valid: boolean, reason?: string}}} opts
 * @returns {Promise<{state: string, http_status: number|null, elapsed_ms: number, raw_text: string|null, json: any, reason: string}>}
 */
export async function probeJsonEndpoint({ url, timeoutMs = 8000, validate }) {
    const startedAt = Date.now();
    const result = {
        state: CONNECTOR_STATES.BLOCKED_BY_POLICY,
        http_status: null,
        elapsed_ms: null,
        raw_text: null,
        json: null,
        reason: 'nao_executado',
    };

    if (typeof fetch !== 'function') {
        result.state = CONNECTOR_STATES.BLOCKED_BY_POLICY;
        result.reason = 'fetch_indisponivel_neste_runtime';
        result.elapsed_ms = Date.now() - startedAt;
        return result;
    }

    const controller = ('AbortController' in self) ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    let response;
    try {
        response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store',
            signal: controller ? controller.signal : undefined,
        });
    } catch (err) {
        if (timer) clearTimeout(timer);
        result.elapsed_ms = Date.now() - startedAt;
        if (err && err.name === 'AbortError') {
            result.state = CONNECTOR_STATES.DEGRADED;
            result.reason = `sem_resposta_em_${timeoutMs}ms_timeout`;
            return result;
        }
        result.state = CONNECTOR_STATES.BLOCKED_BY_CORS;
        result.reason = 'fetch_rejeitado_provavelmente_cors_ou_rede_indisponivel';
        return result;
    }
    if (timer) clearTimeout(timer);
    result.elapsed_ms = Date.now() - startedAt;
    result.http_status = response.status;

    // Defesa futura, nao um caminho vivo hoje: com mode:'cors' (unico modo
    // usado acima), um bloqueio real de CORS faz fetch() REJEITAR (capturado
    // no catch acima) em vez de resolver com response.type==='opaque' — isso
    // so aconteceria com mode:'no-cors', que este modulo nunca usa. Mantido
    // caso um chamador futuro precise de no-cors; nunca removido porque
    // Regra de Ouro 4 (nunca apagar funcionalidade real) tambem cobre
    // salvaguardas defensivas ainda corretas.
    if (response.type === 'opaque') {
        result.state = CONNECTOR_STATES.BLOCKED_BY_CORS;
        result.reason = 'resposta_opaca_modo_no-cors_corpo_inacessivel';
        return result;
    }

    if (!response.ok) {
        result.state = (response.status === 401 || response.status === 403)
            ? CONNECTOR_STATES.BLOCKED_BY_POLICY
            : CONNECTOR_STATES.DEGRADED;
        result.reason = `http_status_${response.status}`;
        try { result.raw_text = await response.text(); } catch { /* corpo pode estar vazio mesmo em erro HTTP */ }
        return result;
    }

    let rawText;
    try {
        rawText = await response.text();
    } catch {
        result.state = CONNECTOR_STATES.BLOCKED_BY_SCHEMA;
        result.reason = 'corpo_da_resposta_ilegivel';
        return result;
    }
    result.raw_text = rawText;

    let json;
    try {
        json = JSON.parse(rawText);
    } catch {
        result.state = CONNECTOR_STATES.BLOCKED_BY_SCHEMA;
        result.reason = 'corpo_nao_e_json_valido';
        return result;
    }
    result.json = json;

    if (typeof validate === 'function') {
        let verdict;
        try {
            verdict = validate(json);
        } catch {
            verdict = { valid: false, reason: 'validador_de_schema_lancou_excecao' };
        }
        if (!verdict || verdict.valid !== true) {
            result.state = CONNECTOR_STATES.BLOCKED_BY_SCHEMA;
            result.reason = (verdict && verdict.reason) || 'schema_nao_corresponde_ao_esperado';
            return result;
        }
    }

    result.state = CONNECTOR_STATES.ACTIVE_READ_ONLY;
    result.reason = 'probe_real_passou';
    return result;
}
