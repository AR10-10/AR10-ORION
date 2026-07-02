import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// base: './' — this app is served from a nested static path
// (.../ipad_runtime/ramber-ui/) inside the existing RAMBER GitHub Pages
// site, not from a domain root, so all built asset URLs must resolve
// relative to the HTML file rather than absolute from '/'.
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
