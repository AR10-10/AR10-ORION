// build-sw.mjs — Gerador do Service Worker de produção (Fase L, diretriz
// 2). Função PURA e testável: recebe a lista real de arquivos emitidos
// pelo build do Vite + a versão do selo, e devolve o código-fonte do
// sw.js. O plugin em vite.config.ts a chama em closeBundle; a suíte de
// selo de produção a chama diretamente e afirma sobre o resultado.
//
// ESTRATÉGIA (escolhida para "abrir no iPad de forma nativa e instantânea
// mesmo em Modo Avião" sem jamais servir build velho para sempre):
//   PRECACHE (install, atômico): o shell do app — index.html + todos os
//     assets do build EXCETO os chunks do Neural Core local (llm-*,
//     ~12 MB), que são opt-in por dynamic import e não podem custar a
//     instalação do SW nem o primeiro carregamento offline.
//   RUNTIME stale-while-revalidate (same-origin GET): tudo o mais que o
//     app realmente usa — workers/, wasm/, manifest, icons/ e os próprios
//     chunks llm quando o Operador ativa o Neural Core — é servido do
//     cache NA HORA (instantâneo, funciona offline após o primeiro uso) e
//     revalidado em segundo plano quando há rede. Os arquivos da árvore
//     estática (workers/wasm) não têm hash no nome; SWR garante que um
//     deploy novo deles chega no carregamento seguinte, sem acoplamento
//     de versão manual.
//   NAVEGAÇÃO: mesmo SWR com fallback ao index.html precacheado — o app
//     abre instantâneo sempre; um deploy novo aplica no lançamento
//     seguinte (comportamento PWA padrão).
//   VERSIONAMENTO: o nome do cache embute APP_VERSION (o MESMO selo que a
//     UI exibe — diretriz 3) + hash do manifest de precache; o activate
//     apaga TODO cache que não é o atual — inclusive os caches do PWA
//     vanilla legado, preservando a garantia do antigo shim de
//     autodestruição que este SW substitui.
//   Cross-origin (Binance/MEXC/HF): NUNCA interceptado — dado de mercado
//     não é cacheável por constituição (READ_ONLY sobre dado VIVO).
import { createHash } from 'node:crypto';

/** Arquivos do build que entram no precache do shell. Exclui os chunks
 *  do LLM local (opt-in, ~12 MB) e o próprio sw.js. */
export function selectPrecacheFiles(distFiles) {
    return distFiles
        .filter((f) => !/^assets\/llm-/.test(f))
        .filter((f) => f !== 'sw.js')
        .sort();
}

/** Fonte completa do sw.js — determinística para (files, version) fixos. */
export function generateSwSource(distFiles, version) {
    const precache = selectPrecacheFiles(distFiles);
    const manifestHash = createHash('sha256').update(JSON.stringify(precache)).digest('hex').slice(0, 12);
    const cacheName = `ar10-${version}-${manifestHash}`;
    return `// sw.js — gerado pelo build (ramber-ui/sw/build-sw.mjs), NUNCA editado à mão.
// AR10 CYBORG ${version} — precache do shell + stale-while-revalidate.
// READ_ONLY / FAIL_CLOSED: só GET same-origin; dado de mercado (cross-
// origin) passa direto para a rede, nunca é cacheado.
const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE = ${JSON.stringify(precache, null, 1)};

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                // Apaga TODO cache que não é o desta versão — inclusive os
                // do PWA vanilla legado (garantia herdada do shim antigo).
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
            ))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // mercado/HF: rede pura

    // Navegações caem no shell precacheado quando offline.
    const fallbackUrl = req.mode === 'navigate' ? 'index.html' : null;

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
            const refresh = fetch(req)
                .then((res) => {
                    if (res && res.ok) cache.put(req, res.clone());
                    return res;
                })
                .catch(() => null);
            if (cached) {
                // stale-while-revalidate: resposta instantânea, atualização
                // silenciosa em segundo plano para o PRÓXIMO carregamento.
                refresh.catch(() => {});
                return cached;
            }
            const fresh = await refresh;
            if (fresh) return fresh;
            if (fallbackUrl) {
                const shell = await cache.match(fallbackUrl);
                if (shell) return shell;
            }
            return Response.error();
        }),
    );
});
`;
}
