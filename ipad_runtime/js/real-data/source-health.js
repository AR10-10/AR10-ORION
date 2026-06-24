// source-health.js — visão unificada de "saúde de fontes de dado": funde os
// conectores com sonda real desta sessão (real-data/registry.js) com o
// roteiro estático mais amplo (configs/connector-registry.default.json,
// fetch same-origin, cacheado uma vez por sessão). Nunca promove um
// conector do roteiro a ACTIVE_READ_ONLY sozinho — só registry.js pode fazer
// isso, via sonda real; este módulo só decora o roteiro com o estado vivo
// quando os connector_id coincidem, e lista separadamente qualquer conector
// com sonda real que ainda não está no roteiro estático (ex.: Binance Spot
// Public, implementado antes do roteiro futuro de Binance Futures).

import * as registry from './registry.js';

const ROADMAP_URL = new URL('../../configs/connector-registry.default.json', import.meta.url).href;
let roadmapCache = null;

async function loadRoadmap() {
    if (roadmapCache) return roadmapCache;
    try {
        const res = await fetch(ROADMAP_URL);
        if (!res.ok) throw new Error(`http_${res.status}`);
        const json = await res.json();
        roadmapCache = Array.isArray(json.connectors) ? json.connectors : [];
    } catch {
        roadmapCache = [];
    }
    return roadmapCache;
}

export async function getSourceHealthReport() {
    const roadmap = await loadRoadmap();
    const live = registry.listConnectors();
    const liveById = new Map(live.map((c) => [c.connector_id, c]));
    const roadmapIds = new Set(roadmap.map((c) => c.connector_id));

    const fromRoadmap = roadmap.map((entry) => {
        const liveEntry = liveById.get(entry.connector_id);
        return {
            connector_id: entry.connector_id,
            connector_name: entry.connector_name,
            has_real_probe_code: Boolean(liveEntry),
            live_state: liveEntry ? liveEntry.state : null,
            roadmap_status: entry.current_status,
            enabled_now: Boolean(entry.enabled_now),
            execution_supported: Boolean(entry.execution_supported),
        };
    });

    const liveOnly = live
        .filter((c) => !roadmapIds.has(c.connector_id))
        .map((c) => ({
            connector_id: c.connector_id,
            connector_name: c.connector_name || c.connector_id,
            has_real_probe_code: true,
            live_state: c.state,
            roadmap_status: 'NAO_LISTADO_NO_ROTEIRO_ESTATICO',
            enabled_now: true,
            execution_supported: false,
        }));

    const sources = [...fromRoadmap, ...liveOnly];
    const activeCount = sources.filter((c) => c.live_state === 'ACTIVE_READ_ONLY').length;
    const withCodeCount = sources.filter((c) => c.has_real_probe_code).length;

    return {
        generated_at: new Date().toISOString(),
        total_sources: sources.length,
        with_real_probe_code: withCodeCount,
        active_read_only_now: activeCount,
        sources,
        siriform_summary: activeCount > 0
            ? `${activeCount} de ${sources.length} fonte(s) catalogada(s) está(ão) ACTIVE_READ_ONLY nesta sessão; ${withCodeCount} já têm sonda real implementada, as demais permanecem roteiro PLANNED/FUTURE.`
            : `Nenhuma fonte está ACTIVE_READ_ONLY nesta sessão ainda. ${withCodeCount} de ${sources.length} fonte(s) já têm sonda real implementada — toque em "Testar fontes reais".`,
    };
}
