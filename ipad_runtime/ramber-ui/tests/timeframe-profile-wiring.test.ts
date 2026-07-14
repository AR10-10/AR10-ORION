// timeframe-profile-wiring.test.ts — Diretriz Complementar (Evolução da
// Inteligência Operacional §7): fiação real no App.tsx. A tabela pura já
// tem execução real em timeframe-profile.test.ts — aqui trancam-se os
// pontos de conexão (mesma convenção mista de sempre).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: perfil real do timeframe, zero segunda tabela', () => {
  it('importa a função pura real', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { timeframeProfile } from "./nexus/timeframe-profile";');
  });

  it('o tooltip de cada botão de timeframe carrega o perfil real quando existe, cai para o rótulo simples quando não', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('timeframeProfile(tf.value)');
    expect(app).toContain('`Timeframe ${tf.label} · ${timeframeProfile(tf.value)!.style} · ETA típico: ${timeframeProfile(tf.value)!.etaHorizon}`');
    expect(app).toContain('`Timeframe ${tf.label}`');
  });

  it('o painel Trade Plan (ANALYSIS) mostra o perfil real do timeframe ATIVO — nunca some quando o perfil existe', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('{timeframeProfile(chartTimeframe as string) && (');
    expect(app).toContain('label="Perfil do Timeframe"');
  });
});

describe('LEI 24 + Regras de Ouro: timeframe-profile.ts é puro e honesto', () => {
  it('zero I/O, zero Math.random, zero rede', () => {
    const src = read('../src/nexus/timeframe-profile.ts');
    expect(src).not.toContain('fetch(');
    expect(src).not.toMatch(/Math\.random/);
  });

  it('nunca afirma que o horizonte é uma medição — o header documenta a natureza de parâmetro (Regra de Ouro 2)', () => {
    const src = read('../src/nexus/timeframe-profile.ts');
    expect(src).toContain('nunca uma medição');
  });
});
