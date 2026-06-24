// storage-router.js — decide ONDE ler/gravar os bytes de um HydrationPackage,
// respeitando a regra de escritor único do runtime: Cache Storage só é
// escrito pelo install handler de service-worker.js. Este router se RECUSA
// estruturalmente a escrever em pacotes CACHE_API — só lê, para fins de
// verificação/relatório. Pacotes OPFS_OR_IDB vão para storage.js (o mesmo
// Vault usado por pack-manager.js).
//
// FUTURE/não conectado ainda: hydration-manager.js NÃO importa este módulo
// hoje. A escrita real do Vault é single-writer via
// pack-manager.installToSafariStorage() (já testado, já usado pelo fluxo
// manual "Instalar"), e a re-verificação real já é feita por
// pack-manager.reloadVaultState() — ambos cobrem leitura/escrita correta sem
// precisar deste router. Existe como o contrato "Storage Router" pedido pela
// spec do Hydration Engine, pronto para um cenário futuro de escrita
// incremental por pacote (ex.: pacotes de prioridade 3/4 fora do .ar10pack
// único) sem duplicar a lógica que pack-manager.js já tem. Por isso não está
// no PRECACHE_URLS do service worker (mesma regra de "não precachear o que
// nenhum arquivo do fecho ainda importa").

import * as storage from '../storage.js';

export const STORAGE_TARGET = Object.freeze({
    OPFS_OR_IDB: 'OPFS_OR_IDB',
    CACHE_API: 'CACHE_API',
});

function relPathFor(pkg) {
    return pkg._meta?.rel_path || pkg.name;
}

/** @returns {Promise<{written:boolean, backend:string|null, reason?:string}>} */
export async function routeAndStore(pkg, bytes) {
    if (pkg.storage_target === STORAGE_TARGET.CACHE_API) {
        // Estrutural, não apenas convencional: nunca escreve em Cache Storage.
        // O Service Worker é o único escritor (cache.addAll no install
        // handler) — duplicar a escrita aqui criaria dois donos do mesmo
        // cache e risco de inconsistência entre eles.
        return { written: false, backend: null, reason: 'read_only_owned_by_service_worker' };
    }
    if (!bytes || bytes.length === 0) {
        return { written: false, backend: null, reason: 'bytes_ausentes' };
    }
    const backend = await storage.saveFile(relPathFor(pkg), bytes);
    return { written: true, backend };
}

/** Leitura de confirmação (não usada para decidir gravação — só para
 *  relatório/verificação de que os bytes já gravados ainda estão lá). */
export async function readBack(pkg) {
    if (pkg.storage_target === STORAGE_TARGET.CACHE_API) {
        return readFromCacheApi(pkg);
    }
    return storage.readFile(relPathFor(pkg));
}

async function readFromCacheApi(pkg) {
    if (!('caches' in window)) return null;
    const cacheName = pkg._meta?.cache_name;
    if (!cacheName) return null;
    try {
        const cache = await caches.open(cacheName);
        const resp = await cache.match(pkg.url);
        if (!resp) return null;
        const buf = await resp.arrayBuffer();
        return new Uint8Array(buf);
    } catch {
        return null;
    }
}
