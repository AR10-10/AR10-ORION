import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { GlobalErrorBoundary } from './global-error-boundary';
import './index.css';

// ORDEM "REMOVER PASSWORD GATE TEMPORÁRIO" (2026-09-07): a cortina de senha
// global (AccessGate, ver access-gate.tsx) saiu do caminho crítico de
// build/deploy/runtime — ela estava bloqueando o próprio ciclo de
// publicação (VITE_ACCESS_HASH nunca cadastrado como secret) sem proteger
// nada de verdade (o próprio access-gate.tsx já documentava isso: hash
// inline no bundle publicado, contornável por localStorage). O painel volta
// a abrir direto — READ_ONLY/FAIL_CLOSED/sem execução real continuam
// intactos, porque nunca dependeram desta cortina. `access-gate.tsx`/
// `access-gate-crypto.ts` continuam no repositório (Zero Delete Rule) para
// reaproveitamento futuro; só pararam de ser montados aqui. Autenticação
// real (identidade individual, login, sessão, papéis) é arquitetura
// futura — ver docs/ACESSO_PRIVADO.md.

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
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
