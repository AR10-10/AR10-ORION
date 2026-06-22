// service-worker.js — AR10 Cyborg 1.0 PRO iPad Runtime
// Cache-first, offline-first. Tudo precache é same-origin; nenhuma rota
// de rede sensivel (MEXC/MT5/API secret) existe para interceptar.

const CACHE_VERSION = 'cyborg-ipad-runtime-v21';

// PRECACHE_URLS e' a fronteira same-origin do offline-first: precisa cobrir
// exatamente o fecho transitivo de import() a partir de js/app.js (o unico
// <script type="module"> de index.html). Lista revalidada em 2026-06-22 com
// uma varredura automatica do grafo de imports — qualquer modulo novo em
// js/**/*.js entra aqui na mesma leva em que e' importado por algum arquivo
// ja precacheado, senao a 1a navegacao offline falha ao abrir esse caminho.
// src/research/** (conectores/engines) deliberadamente FORA: nao e' importado
// por nenhum arquivo deste fecho ainda (mesmo status de "contrato, nao
// instalado" que soldier_runtime/ no monorepo). js/hydration/storage-router.js
// e' o mesmo caso: existe, passa node --check, mas hydration-manager.js nao o
// importa (a escrita real do Vault e' single-writer via pack-manager.js, que
// ja cobre leitura/escrita correta) — ver header do proprio storage-router.js.
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/ipad-runtime.css',
    './js/app.js',
    './js/ui/dom-registry.js',
    './js/ui/ui-helpers.js',
    './js/ui/live-ticker.js',
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
    './js/aux/telegram-aux-status.js',
    './js/real-data/schema.js',
    './js/real-data/probe.js',
    './js/real-data/registry.js',
    './js/real-data/coingecko-public.js',
    './js/real-data/binance-public.js',
    './js/real-data/binance-futures-public.js',
    './js/real-data/mexc-public.js',
    './js/real-data/mexc-futures-public.js',
    './js/real-data/csv-json-import.js',
    './js/real-data/analysis-frame.js',
    './js/real-data/source-health.js',
    './js/research/research-engine.js',
    './js/research/data-sufficiency.js',
    './js/research/target-tracker.js',
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
    './js/intelligence/local-llm-adapter.js',
    './workers/quant-worker.js',
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
            if (cached) return cached;
            return fetch(req).then((resp) => {
                if (resp && resp.ok) {
                    const copy = resp.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
                }
                return resp;
            }).catch(() => {
                if (req.mode === 'navigate') return caches.match('./index.html');
                return new Response('', { status: 504, statusText: 'offline' });
            });
        })
    );
});
