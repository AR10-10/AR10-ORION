// service-worker.js — SELF-DESTRUCT SHIM.
//
// This used to be the old vanilla-JS app's cache-first service worker
// (registered by js/app.js with scope: './', i.e. the whole origin). That
// app has been fully replaced by the RAMBER terminal (React/Vite, built
// from ipad_runtime/ramber-ui/), which registers NO service worker of its
// own — see ramber-ui/src/main.tsx.
//
// Any device that visited before the switchover still has the OLD version
// of this file installed, cache-first, for every same-origin GET —
// including navigation to "/". That means it keeps serving the OLD cached
// index.html/app.js forever: the new app's own bundle (and the cleanup
// code in main.tsx that unregisters stray service workers) never gets a
// chance to load, because the browser never even asks the network for the
// new page. The fix has to live here, in the SW itself, because changing
// these bytes is what makes the browser notice an update is available for
// an already-installed registration.
//
// Lifecycle order below is deliberate and was verified against a real
// two-phase (old-SW-installed -> new-SW-deployed) reproduction: delete
// every cache this origin's SW ever created, THEN unregister, THEN
// force-navigate any open tabs to their current URL (a real network fetch
// now that nothing intercepts it, landing on the real RAMBER app). Calling
// clients.claim() before navigate() (and unregistering only at the very
// end) was tried first and reliably deadlocked — the client's forced
// navigation never resolved because it re-entered this same worker's own
// activation. Unregistering before navigating avoids that self-reference
// entirely, at the cost of not calling clients.claim() — unnecessary here
// since we're not trying to serve anything, only to get out of the way.
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then((clients) => {
                clients.forEach((client) => client.navigate(client.url).catch(() => {}));
            })
    );
});
