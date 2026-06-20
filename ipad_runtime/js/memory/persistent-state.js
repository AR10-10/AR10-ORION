// persistent-state.js — Memoria persistente do Real Data Layer (mission
// AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
// Usa js/storage.js (setMeta/getMeta -> IndexedDB META_STORE, RAM-only nunca
// e a unica copia) para sobreviver a fechar a aba/PWA. Nenhum segredo, nenhuma
// chave de API, nenhuma credencial e gravada aqui — so estado de conector,
// evidencia publica e frames descritivos.

import { setMeta, getMeta } from '../storage.js';

const KEYS = Object.freeze({
    lastConnectorTested: 'real_data_last_connector_tested',
    connectorStates: 'real_data_connector_states', // { [connector_id]: { state, last_probed_at, block_reason } }
    evidenceByConnector: 'real_data_evidence_by_connector', // { [connector_id]: evidence }
    activeSource: 'real_data_active_source', // connector_id | null
    lastAnalysisFrame: 'real_data_last_analysis_frame',
    lastResearchFrame: 'real_data_last_research_frame',
    lastDadosInsuficientes: 'real_data_last_dados_insuficientes', // { reason, at } | null
});

async function getOrEmptyObject(key) {
    const v = await getMeta(key);
    return v && typeof v === 'object' ? v : {};
}

/** Grava o resultado de UM probe real (rede ou import local). Atualiza o
 *  mapa de estados por conector, a evidencia mais recente desse conector, e
 *  — se o resultado for ACTIVE_READ_ONLY — marca esse conector como fonte
 *  ativa. Se o resultado for DADOS_INSUFICIENTES/BLOCKED_*, registra o
 *  motivo do bloqueio para a UI explicar honestamente por que. */
export async function recordProbeResult(connectorId, { state, evidence, probe_detail } = {}) {
    const states = await getOrEmptyObject(KEYS.connectorStates);
    const nowIso = new Date().toISOString();
    states[connectorId] = {
        state,
        last_probed_at: nowIso,
        block_reason: state === 'ACTIVE_READ_ONLY' ? null : (probe_detail?.reason || null),
    };
    await setMeta(KEYS.connectorStates, states);
    await setMeta(KEYS.lastConnectorTested, { connector_id: connectorId, at: nowIso });

    if (evidence) {
        const evidenceMap = await getOrEmptyObject(KEYS.evidenceByConnector);
        evidenceMap[connectorId] = evidence;
        await setMeta(KEYS.evidenceByConnector, evidenceMap);
    }

    if (state === 'ACTIVE_READ_ONLY') {
        await setMeta(KEYS.activeSource, connectorId);
    } else {
        const currentActive = await getMeta(KEYS.activeSource);
        if (currentActive === connectorId) await setMeta(KEYS.activeSource, null);
        await setMeta(KEYS.lastDadosInsuficientes, { connector_id: connectorId, reason: probe_detail?.reason || state, at: nowIso });
    }
}

export async function recordAnalysisFrame(frame) {
    await setMeta(KEYS.lastAnalysisFrame, frame);
    if (frame && frame.status !== 'OK') {
        await setMeta(KEYS.lastDadosInsuficientes, { context: 'analysis_frame', reason: frame.status_reason, at: new Date().toISOString() });
    }
}

export async function recordResearchFrame(frame) {
    await setMeta(KEYS.lastResearchFrame, frame);
}

/** Rehidratacao: tudo que a UI precisa para mostrar o ultimo estado real
 *  conhecido SEM precisar sondar rede de novo ao reabrir o app. */
export async function loadAll() {
    const [connectorStates, evidenceByConnector, activeSource, lastAnalysisFrame, lastResearchFrame, lastDadosInsuficientes, lastConnectorTested] = await Promise.all([
        getOrEmptyObject(KEYS.connectorStates),
        getOrEmptyObject(KEYS.evidenceByConnector),
        getMeta(KEYS.activeSource),
        getMeta(KEYS.lastAnalysisFrame),
        getMeta(KEYS.lastResearchFrame),
        getMeta(KEYS.lastDadosInsuficientes),
        getMeta(KEYS.lastConnectorTested),
    ]);
    return {
        connectorStates,
        evidenceByConnector,
        activeSource: activeSource || null,
        lastAnalysisFrame: lastAnalysisFrame || null,
        lastResearchFrame: lastResearchFrame || null,
        lastDadosInsuficientes: lastDadosInsuficientes || null,
        lastConnectorTested: lastConnectorTested || null,
    };
}

/** Limpa so a memoria do Real Data Layer — nunca toca em Vault/pack/replay. */
export async function clearRealDataMemory() {
    await Promise.all(Object.values(KEYS).map((k) => setMeta(k, null)));
}
