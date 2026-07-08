// production-seal.test.ts — Fase L (V15, fase FINAL): o selo de produção
// como invariante executável. Cada diretriz da ordem de ignição vira uma
// trava de CI permanente:
//   1. Governança: o Risk Engine consome forca_ajustada (nunca a bruta).
//   2. Offline: sw.js real gerado do build (precache do shell + SWR),
//      shim de autodestruição substituído por registro de verdade.
//   3. Versão: selo único, consistente entre package.json, UI e cache.
//   4. Congelamento: zero console ruidoso no perímetro do produto.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { APP_VERSION, APP_SEAL } from '../src/version';
import { generateSwSource, selectPrecacheFiles } from '../sw/build-sw.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('diretriz 3: selo de versão semântica — fonte única e consistente', () => {
  it('APP_VERSION/APP_SEAL têm a forma final masterizada', () => {
    expect(APP_VERSION).toBe('v15.0.0-GODTIER');
    expect(APP_SEAL).toBe('AR10 CYBORG v15.0.0-GODTIER');
  });

  it('package.json carrega a MESMA versão semântica (15.0.0)', () => {
    const pkg = JSON.parse(read('../package.json'));
    expect(`v${pkg.version}-GODTIER`).toBe(APP_VERSION);
  });

  it('a UI exibe o selo exatamente uma vez (zero repetição), no painel de saúde do sistema', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { APP_SEAL } from "./version"');
    expect(app.match(/APP_SEAL/g)!.length).toBe(2); // 1 import + 1 render
  });

  it('o manifest declara a versão e a capacidade offline com honestidade (sem prometer cache de dado de mercado)', () => {
    const manifest = JSON.parse(read('../../manifest.webmanifest'));
    expect(manifest.description).toContain('v15.0.0-GODTIER');
    expect(manifest.description).toContain('offline');
    expect(manifest.description).not.toContain('nenhum service worker');
    expect(manifest.description).toContain('READ_ONLY / FAIL_CLOSED');
  });
});

describe('diretriz 2: service worker real — precache do shell + stale-while-revalidate', () => {
  const distExemplo = [
    'index.html',
    'assets/index-HASH123.js',
    'assets/index-HASH456.css',
    'assets/icon-192-HASH.png',
    'assets/llm-worker-HASH.js',
    'assets/llm-bridge-HASH.js',
    'sw.js',
  ];

  it('o precache inclui o shell e EXCLUI os chunks llm (opt-in, ~12MB) e o próprio sw.js', () => {
    const pre = selectPrecacheFiles(distExemplo);
    expect(pre).toContain('index.html');
    expect(pre).toContain('assets/index-HASH123.js');
    expect(pre).toContain('assets/index-HASH456.css');
    expect(pre.some((f: string) => f.includes('llm-'))).toBe(false);
    expect(pre).not.toContain('sw.js');
  });

  it('o nome do cache embute o selo de versão da diretriz 3 + hash do manifest de precache', () => {
    const src = generateSwSource(distExemplo, APP_VERSION);
    expect(src).toMatch(new RegExp(`CACHE_NAME = "ar10-${APP_VERSION.replace(/\./g, '\\.')}-[0-9a-f]{12}"`));
  });

  it('geração determinística: mesma lista + mesma versão => mesmo sw.js byte a byte', () => {
    expect(generateSwSource(distExemplo, APP_VERSION)).toBe(generateSwSource(distExemplo, APP_VERSION));
  });

  it('ciclo de vida completo: install atômico com skipWaiting, activate limpa TODO cache antigo (inclusive o do PWA legado) e reivindica clientes', () => {
    const src = generateSwSource(distExemplo, APP_VERSION);
    expect(src).toContain("addEventListener('install'");
    expect(src).toContain('cache.addAll(PRECACHE)');
    expect(src).toContain('self.skipWaiting()');
    expect(src).toContain("addEventListener('activate'");
    expect(src).toContain('caches.delete(k)');
    expect(src).toContain('self.clients.claim()');
  });

  it('dado de mercado NUNCA é interceptado: só GET same-origin entra no cache', () => {
    const src = generateSwSource(distExemplo, APP_VERSION);
    expect(src).toContain("if (req.method !== 'GET') return;");
    expect(src).toContain('if (url.origin !== self.location.origin) return;');
  });

  it('navegação offline cai no shell precacheado (abre em Modo Avião)', () => {
    const src = generateSwSource(distExemplo, APP_VERSION);
    expect(src).toContain("req.mode === 'navigate' ? 'index.html' : null");
    expect(src).toContain('cache.match(fallbackUrl)');
  });

  it('main.tsx registra o sw.js SÓ em produção e o shim de autodestruição foi realmente removido', () => {
    const main = read('../src/main.tsx');
    expect(main).toContain("import.meta.env.PROD && 'serviceWorker' in navigator");
    expect(main).toContain("navigator.serviceWorker.register('sw.js')");
    // o antigo shim: unregister em massa + limpeza de Cache Storage a cada load
    expect(main).not.toContain('getRegistrations');
    expect(main).not.toContain('caches.keys()');
  });

  it('vite.config.ts emite o sw.js no build a partir da lista REAL de arquivos do dist', () => {
    const cfg = read('../vite.config.ts');
    expect(cfg).toContain("import { generateSwSource } from './sw/build-sw.mjs'");
    expect(cfg).toContain('serviceWorkerPlugin()');
    expect(cfg).toContain('closeBundle()');
  });
});

describe('diretriz 1: governança — o Risk Engine consome a força AJUSTADA pela qualidade', () => {
  it('App.tsx alimenta buildRiskSuggestion com forca_ajustada (e não a força bruta)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('ensembleForca: ensembleConsensus?.status === "OK" ? ensembleConsensus.forca_ajustada : null');
  });

  it('o motor de replay espelha a MESMA fiação (mirror 1:1 de produção)', () => {
    const replay = read('../../src/replay/replay-engine.js');
    expect(replay).toContain("ensembleForca: ensemble?.status === 'OK' ? ensemble.forca_ajustada : null");
  });
});

describe('diretriz 4: congelamento — zero console ruidoso no perímetro do produto', () => {
  it('nenhum console.log/debug/info em ramber-ui/src, src/ (domínios), workers e clientes RPC', () => {
    const roots = [
      resolve(here, '../src'),
      resolve(here, '../../src'),
      resolve(here, '../../workers'),
    ];
    const singles = [
      resolve(here, '../../js/worker-client.js'),
      resolve(here, '../../js/orderflow-client.js'),
      resolve(here, '../../js/orderflow-tick-codec.js'),
    ];
    const offenders: string[] = [];
    const scan = (file: string) => {
      const code = readFileSync(file, 'utf8');
      code.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return; // comentários citando não contam
        if (/console\.(log|debug|info)\(/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    };
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name);
        if (statSync(abs).isDirectory()) walk(abs);
        else if (/\.(ts|tsx|js|mjs)$/.test(name)) scan(abs);
      }
    };
    roots.forEach(walk);
    singles.forEach(scan);
    expect(offenders).toEqual([]);
  });
});
