import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// base: './' — this app is served from a nested static path
// (.../ipad_runtime/cyborgpro-ui/) inside the existing AR10 GitHub Pages
// site, not from a domain root, so all built asset URLs must resolve
// relative to the HTML file rather than absolute from '/'.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
