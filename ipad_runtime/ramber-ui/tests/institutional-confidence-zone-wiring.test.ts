// institutional-confidence-zone-wiring.test.ts — Diretriz Complementar §16:
// fiação real da Zona de Confiança Institucional no App.tsx. A matemática
// pura já tem execução real em institutional-confidence-zone.test.ts —
// aqui trancam-se os pontos de conexão (mesma convenção mista de sempre).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: confidenceZone computado UMA vez sobre o mesmo institutionalScore, compartilhado via contextValue', () => {
  it('importa a função pura real do módulo já real (institutional-score.ts), nunca uma segunda fórmula', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { computeInstitutionalScore, institutionalConfidenceZone, computeConvictionTrend } from "./nexus/institutional-score";');
  });

  it('confidenceZone deriva de institutionalScore.score — zero segunda fonte', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const confidenceZone = useMemo(() => institutionalConfidenceZone(institutionalScore.score), [institutionalScore]);');
  });

  it('TDZ real: confidenceZone declarada DEPOIS de institutionalScore e ANTES de contextValue', () => {
    const app = read('../src/App.tsx');
    const scoreIdx = app.indexOf('const institutionalScore = useMemo(');
    const zoneIdx = app.indexOf('const confidenceZone = useMemo(');
    const contextIdx = app.indexOf('const contextValue = useMemo(');
    expect(scoreIdx).toBeGreaterThan(-1);
    expect(scoreIdx).toBeLessThan(zoneIdx);
    expect(zoneIdx).toBeLessThan(contextIdx);
  });

  it('contextValue expõe confidenceZone (objeto e deps) ao lado de institutionalScore', () => {
    const app = read('../src/App.tsx');
    const memoMatch = app.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(memoMatch).not.toBeNull();
    expect(memoMatch![1]).toContain('institutionalScore,\n      confidenceZone,');
    const depsMatch = app.match(/const contextValue = useMemo\([\s\S]*?\[([\s\S]*?)\],\s*\);/);
    expect(depsMatch).not.toBeNull();
    expect(depsMatch![1]).toContain('institutionalScore,\n      confidenceZone,');
  });
});

describe('Header: Score badge exibe a banda real §16 — cor e rótulo 1:1 com confidenceZone, nunca um segundo cálculo', () => {
  it('destrutura confidenceZone do WidgetContext ao lado de institutionalScore', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('institutionalScore,\n    confidenceZone,\n    convictionTrend,\n    assistantMessages,');
  });

  it('a cor do número vem de confidenceZone.colorClass — nunca um limiar redundante hardcoded', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('confidenceZone === null ? "text-[#8ab4f8]/40" : `${confidenceZone.colorClass} drop-shadow-[0_0_5px_currentColor]`');
  });

  it('o rótulo do tier (emoji + label) só renderiza quando a zona é real — null honesto em WAIT não vira uma legenda fabricada', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('{confidenceZone && (');
    expect(app).toContain('{confidenceZone.emoji} {confidenceZone.label}');
  });

  it('o tooltip cita a zona real, nunca um número solto sem contexto', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('Zona: ${confidenceZone?.label ?? DASH}.');
  });
});

describe('LEI 24 + Regras de Ouro: institutionalConfidenceZone é pura e honesta (mesmo contrato do módulo que a hospeda)', () => {
  it('zero escrita de volta, zero rede, zero Math.random, zero nova matemática de consenso', () => {
    const src = read('../src/nexus/institutional-score.ts');
    expect(src).not.toContain('setInstitutionalScore(');
    expect(src).not.toContain('useUnifiedSnapshotStore');
    expect(src).not.toContain('fetch(');
    expect(src).not.toMatch(/Math\.random/);
  });

  it('os 5 cortes/rótulos são literais da diretriz — nenhum novo limiar inventado fora dos 90/80/65/50', () => {
    const src = read('../src/nexus/institutional-score.ts');
    expect(src).toContain('{ min: 90, tier: "MUITO_FORTE"');
    expect(src).toContain('{ min: 80, tier: "FORTE"');
    expect(src).toContain('{ min: 65, tier: "MODERADA"');
    expect(src).toContain('{ min: 50, tier: "FRACA"');
    expect(src).toContain('tier: "INVALIDA"');
  });
});
