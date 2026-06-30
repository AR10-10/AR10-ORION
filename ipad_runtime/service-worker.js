// service-worker.js — AR10 Cyborg 1.0 PRO iPad Runtime
// Cache-first, offline-first. Tudo precache é same-origin; nenhuma rota
// de rede sensivel (MEXC/MT5/API secret) existe para interceptar.
//
// COOP/COEP SELF-INJECTION: GitHub Pages (o alvo de deploy) nao deixa
// configurar response headers customizados, mas SharedArrayBuffer real
// (Skill 9: zero-copy ring buffer) exige `self.crossOriginIsolated ===
// true`, que por sua vez exige que TODA navegacao top-level E todo script
// de worker same-origin chegue com Cross-Origin-Opener-Policy: same-origin
// + Cross-Origin-Embedder-Policy: require-corp. Como o servidor nao manda
// esses headers, este worker reescreve toda resposta same-origin que ele
// mesmo intercepta (cache ou rede) para adiciona-los — o padrao conhecido
// como "coi-serviceworker". Seguro aqui porque: (1) o CSP de index.html so
// permite fetch() cross-origin via connect-src para APIs publicas que ja
// respondem com CORS valido — fetch em modo 'cors' com Access-Control-
// Allow-Origin valido nunca e bloqueado por COEP require-corp, so recursos
// carregados em modo no-cors (img/script/link cross-origin) precisariam de
// Cross-Origin-Resource-Policy, e este app nao tem nenhum (img-src 'self'
// data:, script-src 'self'); (2) sem crossOriginIsolated, ring-buffer.js
// ja degrada sozinho para o fallback Array (typeof SharedArrayBuffer ===
// 'undefined') — entao mesmo se este self-injection falhar em algum
// Safari mais antigo, o app continua funcionando, so sem zero-copy real.
const CACHE_VERSION = 'cyborg-ipad-runtime-v41';

function withCoiHeaders(response) {
    if (!response) return response;
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

// PRECACHE_URLS e' a fronteira same-origin do offline-first: precisa cobrir
// exatamente o fecho transitivo de import() a partir de js/app.js (o unico
// <script type="module"> de index.html). Lista revalidada em 2026-06-29 com
// uma varredura automatica do grafo de imports — qualquer modulo novo em
// js/**/*.js entra aqui na mesma leva em que e' importado por algum arquivo
// ja precacheado, senao a 1a navegacao offline falha ao abrir esse caminho.
// src/research/** (conectores/engines) permanece FORA quase por completo:
// nao e' importado por nenhum arquivo deste fecho, EXCETO os 2 engines
// graduados em 2026-06-25 (src/research/engines/support-resistance-engine.js
// e market-structure-engine.js, ver QUARANTINE.md secao "Engines graduados"),
// agora importados por js/real-data/analysis-frame.js e por isso listados
// abaixo. src/orderflow/** entrou em 2026-06-29 pelo mesmo motivo: o Order
// Flow Engine (Skills 1/2/4/8/9) passou a ser importado por js/app.js via
// js/orderflow-engine-ui.js. js/hydration/storage-router.js e' o mesmo caso
// do resto da arvore: existe, passa node --check, mas hydration-manager.js
// nao o importa (a escrita real do Vault e' single-writer via pack-
// manager.js, que ja cobre leitura/escrita correta) — ver header do proprio
// storage-router.js.
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/ipad-runtime.css',
    './js/app.js',
    './js/ui/dom-registry.js',
    './js/ui/ui-helpers.js',
    './js/ui/live-ticker.js',
    './js/ui/cockpit-viewport.js',
    './js/siriform.js',
    './js/voice.js',
    './js/feature-detect.js',
    './js/crypto-utils.js',
    './js/storage.js',
    './js/worker-client.js',
    './js/pack-manager.js',
    './js/replay-engine.js',
    './js/diagnostics.js',
    './js/export-manifest.js',
    './js/data-policy.js',
    './js/evaluations.js',
    './js/metrics.js',
    './js/core/event-bus.js',
    './js/core/data-mode-labels.js',
    './js/core/commander-soldier.js',
    './js/edge/safari-edge-status.js',
    './js/real-data/schema.js',
    './js/real-data/probe.js',
    './js/real-data/registry.js',
    './js/real-data/coingecko-public.js',
    './js/real-data/binance-public.js',
    './js/real-data/binance-futures-public.js',
    './js/real-data/mexc-public.js',
    './js/real-data/mexc-futures-public.js',
    './js/real-data/mexc-trades-stream.js',
    './js/real-data/csv-json-import.js',
    './js/real-data/analysis-frame.js',
    './js/real-data/source-health.js',
    './src/research/engines/support-resistance-engine.js',
    './src/research/engines/market-structure-engine.js',
    './js/research/research-engine.js',
    './js/research/data-sufficiency.js',
    './js/research/target-tracker.js',
    './js/research/trade-setup-matrix.js',
    './js/memory/persistent-state.js',
    './js/memory/evidence-ledger.js',
    './js/memory/session-resume.js',
    './js/memory/event-log.js',
    './js/memory/snapshot-manager.js',
    './js/memory/recovery-report.js',
    './js/memory/hydration-report.js',
    './js/memory/backup-restore-pack.js',
    './js/hydration/manifest-reader.js',
    './js/hydration/hash-validator.js',
    './js/hydration/quota-monitor.js',
    './js/hydration/hydration-checkpoint.js',
    './js/hydration/local-availability-map.js',
    './js/hydration/hydration-queue.js',
    './js/hydration/hydration-manager.js',
    './js/trading/risk-gate.js',
    './js/trading/paper-trading.js',
    './js/trading/live-status.js',
    './js/calc/feature-extractor.js',
    './js/intelligence/scoring-engine.js',
    './js/intelligence/memory-store.js',
    './js/intelligence/scenario-matcher.js',
    './js/intelligence/reflection-engine.js',
    './js/intelligence/siriform-explainer.js',
    './js/intelligence/local-brain.js',
    './js/orderflow-client.js',
    './js/orderflow-engine-ui.js',
    './src/orderflow/value-objects.js',
    './src/orderflow/ring-buffer.js',
    './src/orderflow/signal-engine.js',
    './src/orderflow/bio-reactor-render.js',
    './src/orderflow/candle-tick-synthesizer.js',
    './workers/quant-worker.js',
    './workers/orderflow-worker.js',
    './wasm/cyborg_quant_core.wasm',
    './data/btcusdt_replay.json',
    './AR10_CYBORG_LOCAL_PACK_V1.ar10pack',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon-180.png',
];

// skipWaiting() aqui e' incondicional (nunca espera o usuario fechar a
// ultima aba) — por isso o app.js detecta atualizacao pelo evento
// 'controllerchange' (quando clients.claim() troca quem controla a pagina
// ja aberta), nao por reg.waiting, e so entao mostra "Atualizacao
// disponivel" para o usuario decidir quando recarregar.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    if (new URL(req.url).origin !== self.location.origin) return; // nunca intercepta cross-origin

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return withCoiHeaders(cached);
            return fetch(req).then((resp) => {
                if (resp && resp.ok) {
                    const copy = resp.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
                }
                return withCoiHeaders(resp);
            }).catch(() => {
                if (req.mode === 'navigate') return caches.match('./index.html').then(withCoiHeaders);
                return new Response('', { status: 504, statusText: 'offline' });
            });
        })
    );
});
