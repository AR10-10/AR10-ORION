// registry.js — RealDataSourceRegistry + driver do Connector State Machine
// (mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
//
// Regra central, sem excecao: nenhum conector comeca como ACTIVE_READ_ONLY
// por suposicao. Todo conector nasce PLANNED nesta sessao e SO muda de
// estado depois que a sonda real (fetch de verdade ou leitura de arquivo
// local de verdade) responder. O estado mostrado na UI e sempre o ultimo
// resultado real observado nesta sessao, nunca um valor decorativo.
//
// Este registry cobre apenas os conectores com codigo real implementado
// nesta fase (rede publica sem chave, ou import local sem rede). O roteiro
// mais amplo (MEXC futures, Binance futures, CoinGlass, Yahoo/Google
// Finance, MT5 bridge etc.) continua vivendo so como PLANNED/FUTURE em
// configs/connector-registry.default.json — nao duplicado aqui, para nao
// criar duas fontes de verdade que podem divergir.

import { CONNECTOR_STATES } from './schema.js';
import * as coingeckoPublic from './coingecko-public.js';
import * as binancePublic from './binance-public.js';
import * as mexcPublic from './mexc-public.js';
import * as csvJsonImport from './csv-json-import.js';

// Conectores de rede (probados automaticamente em "Testar fontes reais").
const NETWORK_CONNECTORS = Object.freeze([coingeckoPublic, binancePublic, mexcPublic]);

// Conector local (so probado quando o usuario escolhe um arquivo — nunca
// disparado por "Testar fontes reais", porque nao ha rede nem arquivo
// implicito para sondar).
const LOCAL_CONNECTORS = Object.freeze([csvJsonImport]);

const ALL_CONNECTORS = Object.freeze([...NETWORK_CONNECTORS, ...LOCAL_CONNECTORS]);

// Estado por sessao (RAM) — a persistencia entre sessoes e responsabilidade
// de js/memory/persistent-state.js, que envelopa este modulo a partir do
// app.js. Aqui vive so a verdade "agora", desta aba.
const sessionState = new Map(); // connector_id -> { state, evidence, probe_detail, last_probed_at }

for (const mod of ALL_CONNECTORS) {
    sessionState.set(mod.meta.connector_id, {
        state: CONNECTOR_STATES.PLANNED,
        evidence: null,
        probe_detail: { reason: 'ainda_nao_sondado_nesta_sessao' },
        last_probed_at: null,
    });
}

export function listConnectors() {
    return ALL_CONNECTORS.map((mod) => ({
        ...mod.meta,
        ...sessionState.get(mod.meta.connector_id),
    }));
}

export function getConnectorMeta(connectorId) {
    const mod = ALL_CONNECTORS.find((m) => m.meta.connector_id === connectorId);
    return mod ? mod.meta : null;
}

export function getConnectorState(connectorId) {
    return sessionState.get(connectorId) || null;
}

/** Fontes que neste exato momento estao ACTIVE_READ_ONLY validado por sonda
 *  real nesta sessao — nunca um valor assumido/cacheado de outra sessao. */
export function getActiveReadOnlySources() {
    return listConnectors().filter((c) => c.state === CONNECTOR_STATES.ACTIVE_READ_ONLY);
}

async function runProbe(mod, opts, onTransition) {
    const id = mod.meta.connector_id;
    sessionState.set(id, { ...sessionState.get(id), state: CONNECTOR_STATES.PROBING });
    onTransition?.(id, CONNECTOR_STATES.PROBING);

    let result;
    try {
        result = await mod.probe(opts);
    } catch (err) {
        result = {
            state: CONNECTOR_STATES.BLOCKED_BY_POLICY,
            evidence: null,
            probe_detail: { reason: `excecao_nao_tratada_na_sonda:${err.message || err}` },
        };
    }

    const entry = {
        state: result.state,
        evidence: result.evidence || null,
        probe_detail: result.probe_detail || {},
        last_probed_at: new Date().toISOString(),
    };
    sessionState.set(id, entry);
    onTransition?.(id, result.state, entry);
    return { connector_id: id, ...entry };
}

/** Sonda todos os conectores de rede publica em paralelo (hosts diferentes,
 *  sem credencial, sem endpoint privado — ver CSP connect-src). Cada
 *  resultado e 100% derivado da resposta real (ou rejeicao real) do fetch
 *  desta sessao. */
export async function probeAllNetworkSources({ symbol = 'BTC', timeoutMs = 8000, onTransition } = {}) {
    const results = await Promise.all(
        NETWORK_CONNECTORS.map((mod) => runProbe(mod, { symbol, timeoutMs }, onTransition))
    );
    return results;
}

export async function probeNetworkConnector(connectorId, { symbol = 'BTC', timeoutMs = 8000, onTransition } = {}) {
    const mod = NETWORK_CONNECTORS.find((m) => m.meta.connector_id === connectorId);
    if (!mod) throw new Error(`conector_de_rede_desconhecido:${connectorId}`);
    return runProbe(mod, { symbol, timeoutMs }, onTransition);
}

/** Import local CSV/JSON — `file` so vem de escolha explicita do usuario num
 *  <input type=file>; nunca rede, nunca caminho implicito. */
export async function probeLocalImport({ file, symbol = 'IMPORTADO', onTransition } = {}) {
    return runProbe(csvJsonImport, { file, symbol }, onTransition);
}

export function networkConnectorIds() {
    return NETWORK_CONNECTORS.map((m) => m.meta.connector_id);
}
