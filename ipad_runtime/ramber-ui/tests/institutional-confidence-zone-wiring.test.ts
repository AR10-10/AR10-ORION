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

describe('ScoreContextCard (gaveta Core Intelligence): Score badge exibe a banda real §16 — cor e rótulo 1:1 com confidenceZone, nunca um segundo cálculo', () => {
  // v16.0 PRO Fase 1: o Score saiu da TopBar (item explícito da lista
  // "REMOVER do header") — mesmos dados reais, mesma fórmula, agora lidos
  // por ScoreContextCard (self-contained, mesmo padrão dos outros cards
  // da gaveta Core Intelligence).
  it('destrutura confidenceZone do WidgetContext ao lado de institutionalScore', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain(
      'const { institutionalScore, confidenceZone, convictionTrend, assistantMessages, heatReading, vwapCtx, nlState, nexusConfluence } =',
    );
  });

  it('a cor do número vem de confidenceZone.colorClass — nunca um limiar redundante hardcoded', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const scoreColor = confidenceZone === null ? "text-[#8ab4f8]/40" : confidenceZone.colorClass;');
  });

  // EPC FINAL §35 ("Indicador Institucional do Cabeçalho"): achado real —
  // a palavra "Score" e o rótulo de tier como linha sempre visível
  // violavam o pedido explícito ("somente cor; percentual", nunca a
  // palavra "Score"). O emoji real da zona (🟢/🟡/🟠/🔴) entra JUNTO do
  // número (nunca sozinho — "nunca exibir apenas a bolinha"), e o rótulo
  // do tier (Muito Forte/Forte/...) não foi apagado (Regra de Ouro 4) —
  // só realocado pro tooltip, que já carregava "Zona: ${confidenceZone.label}".
  it('emoji real da zona entra junto do percentual (nunca sozinho), null honesto em WAIT não vira um emoji fabricado', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('`${confidenceZone ? `${confidenceZone.emoji} ` : ""}${institutionalScore.score}%');
    expect(app).toContain('institutionalScore?.score !== null && institutionalScore?.score !== undefined\n      ? `${confidenceZone');
    expect(app).not.toContain('>Score</span>');
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
