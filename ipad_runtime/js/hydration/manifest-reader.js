// manifest-reader.js — monta o HydrationManifest a partir do pacote local já
// carregado (mesmo objeto que pack-manager.getLoadedPack() expõe) mais um
// pacote sintético "app_shell" que representa o que o Service Worker já
// precacheou. Nenhuma origem de rede nova: tudo vem do .ar10pack (mesma
// origem, já buscado por pack-manager.fetchLocalPack/downloadLocalPack) ou
// do Cache Storage já existente. Módulo puro: não escreve em nenhum storage.

import { base64ToBytes } from '../crypto-utils.js';
import { DATA_MODES } from '../core/data-mode-labels.js';

// Mesma string exibida no rodapé de index.html ("v1.0.0-pro"). Não existe
// constante JS compartilhada para isto hoje; se o rodapé mudar, atualizar
// aqui também.
const APP_VERSION = 'v1.0.0-pro';
const MANIFEST_SCHEMA_VERSION = '1.0.0';
const CACHE_PREFIX = 'cyborg-ipad-runtime-';

// Prioridade real, não heurística: espelha exatamente a regra declarada
// ("Prioridade 1 — essencial: ...WASM principal...", "Prioridade 2 —
// funcionamento local: Replay técnico..."). Um `kind` novo no manifest.pack.json
// que não apareça aqui cai em DEFAULT_FILE_PRIORITY (3 — memória/extra), nunca
// em 1 por acidente.
const PRIORITY_BY_KIND = {
    WASM_QUANT_ENGINE: 1,
    REPLAY_DATASET: 2,
};
const DEFAULT_FILE_PRIORITY = 3;

function priorityForKind(kind) {
    return PRIORITY_BY_KIND[kind] || DEFAULT_FILE_PRIORITY;
}

function sanitizeId(relPath) {
    return relPath.replace(/[\\/.]/g, '_');
}

/** Descobre o nome do cache ativo do Service Worker dinamicamente (mesmo
 *  padrão já usado por app.js:getActiveCacheInfo()) em vez de hardcodar
 *  CACHE_VERSION aqui — evita uma segunda fonte de verdade que poderia
 *  divergir silenciosamente quando service-worker.js for atualizado. */
export async function detectActiveCacheName() {
    if (!('caches' in window)) return null;
    try {
        const keys = await caches.keys();
        return keys.find((k) => k.startsWith(CACHE_PREFIX)) || null;
    } catch {
        return null;
    }
}

async function appShellPackage() {
    const cacheName = await detectActiveCacheName();
    let sizeBytes = 0;
    let entryCount = 0;
    if (cacheName) {
        try {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();
            entryCount = requests.length;
            for (const req of requests) {
                try {
                    const resp = await cache.match(req);
                    if (!resp) continue;
                    const blob = await resp.blob();
                    sizeBytes += blob.size;
                } catch { /* resposta opaca/ilegível: ignora este item no total, nao' falha o pacote inteiro */ }
            }
        } catch { /* Cache Storage indisponivel agora: segue com tamanho/contagem 0, honesto */ }
    }
    return {
        package_id: 'app_shell',
        name: 'App Shell (HTML/CSS/JS/WASM/ícones precacheados)',
        type: 'APP_SHELL',
        priority: 1,
        url: './',
        size_bytes: sizeBytes,
        // Agregado: integridade ja' garantida pelo cache.addAll() tudo-ou-nada
        // do install handler do Service Worker — nenhum hash unico cobre o
        // conjunto, entao sha256 fica null (NOT_APPLICABLE em hash-validator.js,
        // nunca um PASS fabricado).
        sha256: null,
        storage_target: 'CACHE_API',
        required: true,
        data_mode: null,
        can_use_offline: true,
        description_pt_br: cacheName
            ? `${entryCount} arquivo(s) já precacheados pelo Service Worker (cache "${cacheName}").`
            : 'Service Worker ainda não registrou um cache ativo nesta sessão.',
        _meta: { cache_name: cacheName, entry_count: entryCount },
    };
}

function filePackagesFromPack(packJson) {
    if (!packJson || !packJson.files || !packJson.checksums) return [];
    const contentsByPath = {};
    for (const entry of packJson.manifest?.contents || []) contentsByPath[entry.path] = entry;

    return Object.keys(packJson.files).map((relPath) => {
        const contentEntry = contentsByPath[relPath] || {};
        const kind = contentEntry.kind || 'DATA_FILE';
        const priority = priorityForKind(kind);
        let sizeBytes = 0;
        try { sizeBytes = base64ToBytes(packJson.files[relPath]).length; } catch { sizeBytes = 0; }
        return {
            package_id: `file_${sanitizeId(relPath)}`,
            name: relPath,
            type: kind,
            priority,
            // Os arquivos do pacote nao tem URL individual fetchavel: vem todos
            // juntos de UM unico .ar10pack ja buscado por pack-manager.js. O
            // fragmento so identifica de qual sub-recurso este pacote veio —
            // nunca sugere um endpoint de rede que nao existe.
            url: `./AR10_CYBORG_LOCAL_PACK_V1.ar10pack#${relPath}`,
            size_bytes: sizeBytes,
            sha256: packJson.checksums[relPath] || null,
            storage_target: 'OPFS_OR_IDB',
            required: priority <= 2,
            data_mode: kind === 'REPLAY_DATASET' ? DATA_MODES.REPLAY : null,
            can_use_offline: true,
            description_pt_br: contentEntry.role || `Arquivo do pacote local (${kind}).`,
            _meta: { rel_path: relPath, kind },
        };
    });
}

/** @param {{packJson: object|null}} ctx */
export async function buildHydrationManifest({ packJson } = {}) {
    const appShell = await appShellPackage();
    const filePackages = filePackagesFromPack(packJson);
    const packages = [appShell, ...filePackages].sort((a, b) => a.priority - b.priority);

    const required = packages.filter((p) => p.required).map((p) => p.package_id);
    const optional = packages.filter((p) => !p.required).map((p) => p.package_id);
    const totalSizeBytes = packages.reduce((sum, p) => sum + (p.size_bytes || 0), 0);
    const packVersion = packJson?.manifest?.pack_version || '0.0.0';

    return {
        // Deterministico (sem timestamp): mesmo pacote + mesma contagem de
        // pacotes => mesmo manifest_id entre chamadas, nao "muda a cada render".
        manifest_id: `HYD_${packVersion}_${packages.length}pkgs`,
        version: MANIFEST_SCHEMA_VERSION,
        created_at: new Date().toISOString(),
        app_version: APP_VERSION,
        packages,
        required_packages: required,
        optional_packages: optional,
        total_size_bytes: totalSizeBytes,
        hash_algorithm: 'SHA-256',
    };
}
