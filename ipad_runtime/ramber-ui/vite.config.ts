import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { generateSwSource } from './sw/build-sw.mjs';
import { APP_VERSION } from './src/version';

// Fase L (diretriz 2): emite sw.js no dist com o precache REAL deste
// build (lista de arquivos lida do próprio outDir depois da escrita —
// nunca uma lista mantida à mão). A lógica do SW vive em sw/build-sw.mjs
// (função pura, coberta pela suíte de selo de produção); aqui só se
// coleta a lista e se escreve o arquivo.
function serviceWorkerPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'ar10-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const abs = path.join(dir, name);
          if (statSync(abs).isDirectory()) walk(abs);
          else files.push(path.relative(outDir, abs).split(path.sep).join('/'));
        }
      };
      walk(outDir);
      writeFileSync(path.join(outDir, 'sw.js'), generateSwSource(files, APP_VERSION));
    },
  };
}

// PWA — o manifesto e os ícones vivem em ipad_runtime/, um nível ACIMA da
// raiz deste app (é a mesma fonte que o app iPad original já usa).
//
// Sem esta ponte, o `<link rel="manifest">` do index.html cai no fallback SPA
// do Vite e volta HTML. MEDIDO, não suposto: `/manifest.webmanifest` e
// `/icons/icon-192.png` respondiam HTTP 200 com `Content-Type: text/html` e o
// corpo do index.html — parecia funcionar e não funcionava. O efeito real é
// que o Chrome/Edge nunca conseguia ler o manifesto e por isso NUNCA oferecia
// "Instalar AR10 CYBORG", justamente o modo aplicativo que o Operador pediu.
// No `dist` era pior: os arquivos simplesmente não existiam.
//
// A ponte SERVE a mesma fonte em vez de duplicar o arquivo — duas cópias
// divergiriam na primeira edição feita só num lado. Os caminhos relativos de
// dentro do manifesto (`./index.html`, `icons/...`) resolvem certo para os
// dois apps justamente por serem relativos ao endereço do próprio manifesto.
const PWA_ORIGEM = path.resolve(__dirname, '..');
const PWA_ARQUIVOS = [
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

function pwaAssetsPlugin(): Plugin {
  return {
    name: 'ar10-pwa-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const alvo = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!PWA_ARQUIVOS.includes(alvo)) return next();
        const abs = path.join(PWA_ORIGEM, alvo);
        if (!existsSync(abs)) return next();
        res.setHeader(
          'Content-Type',
          alvo.endsWith('.png') ? 'image/png' : 'application/manifest+json',
        );
        res.end(readFileSync(abs));
      });
    },
    // generateBundle, e não closeBundle: os arquivos precisam estar no dist
    // ANTES de o plugin do service worker varrer o diretório, senão ficam de
    // fora do precache e o app instalado não abriria offline.
    generateBundle() {
      for (const rel of PWA_ARQUIVOS) {
        const abs = path.join(PWA_ORIGEM, rel);
        if (!existsSync(abs)) continue;
        this.emitFile({ type: 'asset', fileName: rel, source: readFileSync(abs) });
      }
    },
  };
}

// base: './' — this app is served from a nested static path
// (.../ipad_runtime/ramber-ui/) inside the existing RAMBER GitHub Pages
// site, not from a domain root, so all built asset URLs must resolve
// relative to the HTML file rather than absolute from '/'.
export default defineConfig({
  // pwaAssetsPlugin antes do serviceWorkerPlugin: a varredura do precache
  // acontece depois, e assim enxerga o manifesto e os ícones.
  plugins: [react(), tailwindcss(), pwaAssetsPlugin(), serviceWorkerPlugin()],
  base: './',
  build: {
    // The ~6MB llm-worker/llm-bridge chunks are the opt-in local Llama 3
    // runtime (@mlc-ai/web-llm), deliberately isolated behind dynamic
    // import() and downloaded only when a user activates the Neural Core —
    // their size is intentional, not an accident the default 500KB warning
    // should keep flagging on every build. The main entry chunk stays
    // ~370KB and IS still covered (limit chosen just above the LLM chunks).
    chunkSizeWarningLimit: 6200,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // engine-bridge.ts imports the real engine modules directly from
    // ipad_runtime/js/** and ipad_runtime/src/research/** (outside this
    // project's own root) — Vite's dev server blocks serving files outside
    // root by default (server.fs.strict), so the real ipad_runtime/ tree
    // needs to be explicitly allowed for `npm run dev` to work. Production
    // `vite build` is unaffected by this (Rollup has no such restriction).
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
