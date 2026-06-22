// local-availability-map.js — LocalAvailabilityMap (contrato da especificação
// do Hydration Engine). Cada campo reflete um estado JÁ REAL de outro
// módulo — nunca um valor inventado. Quando uma fonte ainda não existe (ex.:
// nenhum probe de dado real feito nesta sessão), o campo correspondente fica
// honestamente false, com o motivo listado em `limitations`.

import * as packManager from '../pack-manager.js';
import * as storage from '../storage.js';
import * as persistentState from '../memory/persistent-state.js';
import * as eventLog from '../memory/event-log.js';
import { detectActiveCacheName } from './manifest-reader.js';

async function fileExistsInVault(relPath) {
    try {
        const bytes = await storage.readFile(relPath);
        return !!bytes && bytes.length > 0;
    } catch {
        return false;
    }
}

export async function buildLocalAvailabilityMap() {
    const limitations = [];

    const cacheName = await detectActiveCacheName();
    const appCoreReady = !!cacheName;
    if (!appCoreReady) limitations.push('Service Worker ainda sem cache ativo nesta sessão — app shell não confirmado offline.');

    const vaultMeta = await packManager.getInstalledVaultMeta();
    const vaultReady = vaultMeta?.status === 'READY';
    if (!vaultReady) limitations.push('Vault local não está READY — pacote ainda não instalado ou bloqueado (FAIL_CLOSED).');

    const replayReady = vaultReady && await fileExistsInVault('data/btcusdt_replay.json');
    if (!replayReady) limitations.push('Replay técnico indisponível no Vault local.');

    const calculationsReady = vaultReady && await fileExistsInVault('wasm/cyborg_quant_core.wasm');
    if (!calculationsReady) limitations.push('Motor WASM de cálculo indisponível no Vault local.');

    let realDataCacheReady = false;
    try {
        const real = await persistentState.loadAll();
        realDataCacheReady = Object.keys(real.evidenceByConnector || {}).length > 0;
    } catch { /* memória do Real Data Layer indisponível nesta sessão */ }
    if (!realDataCacheReady) limitations.push('Nenhuma evidência de dado real persistida nesta sessão (nenhum probe ainda, ou memória vazia).');

    let memoryReady = false;
    try {
        const recent = await eventLog.getRecentPersisted(1);
        memoryReady = Array.isArray(recent) && recent.length > 0;
    } catch { /* event log indisponível nesta sessão */ }
    if (!memoryReady) limitations.push('Nenhum evento persistido ainda no Event Log local.');

    // Siriform não tem dependência de dado própria além do app shell (só
    // JS/CSS já cobertos pelo precache) — sua disponibilidade offline é a
    // mesma do app core, não um sinal separado.
    const siriformReady = appCoreReady;

    const offlineModeAvailable = appCoreReady && vaultReady;
    if (!offlineModeAvailable) limitations.push('Modo offline completo ainda não disponível (depende de app shell + Vault READY).');

    return {
        generated_at: new Date().toISOString(),
        app_core_ready: appCoreReady,
        vault_ready: vaultReady,
        replay_ready: replayReady,
        real_data_cache_ready: realDataCacheReady,
        memory_ready: memoryReady,
        siriform_ready: siriformReady,
        calculations_ready: calculationsReady,
        offline_mode_available: offlineModeAvailable,
        limitations,
    };
}
