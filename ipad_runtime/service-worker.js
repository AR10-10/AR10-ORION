// service-worker.js — AR10 Cyborg 2.0 iPad Runtime
// Cache-first, offline-first. Tudo precache é same-origin; nenhuma rota
// de rede sensivel (MEXC/MT5/API secret) existe para interceptar.

const CACHE_VERSION = 'cyborg-ipad-runtime-v7';

const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/ipad-runtime.css',
    './js/app.js',
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
    './workers/quant-worker.js',
    './wasm/cyborg_quant_core.wasm',
    './data/btcusdt_replay.json',
    './AR10_CYBORG_LOCAL_PACK_V1.ar10pack',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon-180.png',
];

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
