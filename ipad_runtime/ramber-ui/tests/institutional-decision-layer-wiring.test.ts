// institutional-decision-layer-wiring.test.ts — Diretriz V-MAX de
// Refinamento Institucional (itens 5/6/7): fiação real do Score Geral +
// Assistente Operacional + header "SÍMBOLO ▼". A lógica pura já tem
// execução real em institutional-decision-layer.test.ts — aqui trancam-se
// os pontos de conexão (mesma convenção mista de sempre).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: Score + Assistente computados UMA vez (padrão convictionReading), compartilhados via contextValue', () => {
  it('importa os dois módulos puros reais', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { computeInstitutionalScore, institutionalConfidenceZone } from "./nexus/institutional-score";');
    expect(app).toContain('import { buildAssistantMessages } from "./nexus/operation-assistant";');
  });

  it('institutionalScore reaproveita convictionReading + riskGated real do Conselho — zero segunda matemática de consenso', () => {
    const app = read('../src/App.tsx');
    const m = app.match(/const institutionalScore = useMemo\(([\s\S]*?)\);/);
    expect(m, 'institutionalScore não encontrado').not.toBeNull();
    expect(m![1]).toContain('conviction: convictionReading,');
    expect(m![1]).toContain('riskGated: councilFromSnapshot?.riskGated ?? false,');
  });

  it('assistantMessages consome scoreReading + council + inEntryZoneNow reais (nunca recalcula nenhum)', () => {
    const app = read('../src/App.tsx');
    const m = app.match(/const assistantMessages = useMemo\(([\s\S]*?)\);/);
    expect(m, 'assistantMessages não encontrado').not.toBeNull();
    expect(m![1]).toContain('scoreReading: institutionalScore,');
    expect(m![1]).toContain('council: councilFromSnapshot ?? null,');
    expect(m![1]).toContain('inEntryZone: inEntryZoneNow,');
  });

  it('TDZ real: institutionalScore/assistantMessages declarados DEPOIS de convictionReading/inEntryZoneNow e ANTES de contextValue', () => {
    const app = read('../src/App.tsx');
    const convictionIdx = app.indexOf('const convictionReading = useMemo(');
    const zoneIdx = app.indexOf('const inEntryZoneNow = useMemo(');
    const scoreIdx = app.indexOf('const institutionalScore = useMemo(');
    const assistantIdx = app.indexOf('const assistantMessages = useMemo(');
    const contextIdx = app.indexOf('const contextValue = useMemo(');
    expect(convictionIdx).toBeGreaterThan(-1);
    expect(zoneIdx).toBeLessThan(scoreIdx);
    expect(convictionIdx).toBeLessThan(scoreIdx);
    expect(scoreIdx).toBeLessThan(assistantIdx);
    expect(assistantIdx).toBeLessThan(contextIdx);
  });

  it('contextValue expõe os dois (objeto e deps)', () => {
    const app = read('../src/App.tsx');
    const memoMatch = app.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(memoMatch).not.toBeNull();
    expect(memoMatch![1]).toContain('institutionalScore,');
    expect(memoMatch![1]).toContain('assistantMessages,');
  });
});

describe('TopBar: Score 0-100 honesto + frase do Assistente + gatilho "SÍMBOLO ▼" (Diretriz V-MAX item 7)', () => {
  it('Score exibe DASH honesto quando null (WAIT) — nunca um 0 fabricado', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('{institutionalScore?.score ?? DASH}');
  });

  it('tooltip do Score afirma explicitamente "nunca probabilidade" (Regra de Ouro 2)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('nunca probabilidade de acerto');
  });

  it('frase do Assistente carrega a base real verificável no tooltip', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('assistantMessages.map((m: { text: string; basis: string }) => `${m.text} — ${m.basis}`).join("\\n")');
    expect(app).toContain('{assistantMessages[0].text}');
  });

  it('Omnibox: App passa o símbolo REAL selecionado como rótulo do gatilho', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('selectedLabel={marketMode === "TRADFI" ? (selectedTradFiAsset?.symbol ?? "Buscar ativo") : `${selectedAsset}USDT`}');
  });

  it('SmartOmnibox: gatilho é "rótulo + ▼" (ícone de busca saiu do header; a busca continua no input do dropdown)', () => {
    const omnibox = read('../src/omnibox/SmartOmnibox.tsx');
    expect(omnibox).not.toContain('from "lucide-react"');
    expect(omnibox).toContain('▼');
    expect(omnibox).toContain('placeholder="Buscar: BTC, PEPE, AAPL, XAUUSD..."');
  });
});

describe('LEI 24: os dois módulos novos nunca escrevem de volta em engine/TradePlan/TrackRecord', () => {
  it('institutional-score.ts e operation-assistant.ts são puros — só import type dos contratos, nenhuma escrita', () => {
    for (const rel of ['../src/nexus/institutional-score.ts', '../src/nexus/operation-assistant.ts']) {
      const src = read(rel);
      expect(src).not.toContain('setTradePlan(');
      expect(src).not.toContain('useUnifiedSnapshotStore');
      expect(src).not.toContain('fetch(');
      expect(src).not.toMatch(/Math\.random/);
    }
  });
});
