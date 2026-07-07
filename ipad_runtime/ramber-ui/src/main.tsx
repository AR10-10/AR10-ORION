import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fase L (diretriz 2 — Homologação Offline): service worker REAL com
// precache do shell do build + stale-while-revalidate (sw.js, gerado pelo
// build a partir da lista real de assets — ver ramber-ui/sw/build-sw.mjs).
// O app abre instantâneo no iPad mesmo em Modo Avião após a primeira
// visita online.
//
// Isto SUBSTITUI o antigo shim de autodestruição que vivia aqui (que
// desregistrava qualquer SW e apagava o Cache Storage a cada load, para
// nunca ficar preso atrás do SW cache-first do PWA vanilla legado). A
// garantia dele NÃO se perdeu — ela mudou de lugar: registrar sw.js no
// mesmo escopo substitui a registration legada, e o activate do novo SW
// apaga TODO cache que não é o da versão atual (inclusive os caches
// legados). Registro só em produção: no dev server não existe sw.js e um
// SW em dev só serviria build velho contra o HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Fail-open deliberado: sem SW (ex.: navegação privada) o app segue
    // 100% funcional online — offline é melhoria progressiva, nunca gate.
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
