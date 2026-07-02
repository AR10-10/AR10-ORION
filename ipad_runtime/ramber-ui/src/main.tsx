import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// This app has no service worker of its own — but a previously-visited
// version of this origin might still have one installed (the old vanilla
// PWA's cache-first service-worker.js), which would keep serving its own
// stale cached HTML/assets forever with no way to self-update: nothing on
// this page ever calls navigator.serviceWorker.register(), so the browser
// has no trigger to re-check that old SW for changes. Unregistering any
// registration + clearing Cache Storage on every load is a safe no-op when
// there's nothing to clean up, and guarantees this page is never stuck
// behind a stale cache from before.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}
if ('caches' in window) {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
