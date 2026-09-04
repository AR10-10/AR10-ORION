// institutional-conviction-trend-wiring.test.ts — Diretriz Complementar
// (Nexus Predictive Engine §18 / Evolução da Inteligência Operacional §4,
// "Conviction Engine" ▲/▬/▼): fiação real no App.tsx + na store. A
// matemática pura já tem execução real em institutional-conviction-
// trend.test.ts — aqui trancam-se os pontos de conexão (mesma convenção
// mista de sempre).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: institutionalScoreHistory alimentada em efeito real, convictionTrend computado sobre a MESMA série', () => {
  it('importa o motor puro real', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('computeConvictionTrend');
    expect(app).toContain('from "./nexus/institutional-score";');
  });

  it('reaproveita o MESMO hook de histórico da store — zero segunda série', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('useInstitutionalScoreHistory');
  });

  it('grava a amostra em EFEITO (escrita real na store), nunca em useMemo, e só quando o score é real (nunca WAIT/null)', () => {
    const app = read('../src/App.tsx');
    const m = app.match(/useEffect\(\(\) => \{\s*if \(institutionalScore\.score !== null\) \{([\s\S]*?)\}\s*\}, \[institutionalScore\]\);/);
    expect(m, 'efeito de gravação não encontrado').not.toBeNull();
    expect(m![1]).toContain('recordInstitutionalScore(institutionalScore.score)');
  });

  it('convictionTrend é computado sobre institutionalScoreHistory, nunca recalculado a partir de outra fonte', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const convictionTrend = useMemo(() => computeConvictionTrend(institutionalScoreHistory), [institutionalScoreHistory]);');
  });

  it('TDZ real: convictionTrend declarada DEPOIS de institutionalScoreHistory e ANTES de contextValue', () => {
    const app = read('../src/App.tsx');
    const histIdx = app.indexOf('const institutionalScoreHistory = useInstitutionalScoreHistory();');
    const trendIdx = app.indexOf('const convictionTrend = useMemo(');
    const contextIdx = app.indexOf('const contextValue = useMemo(');
    expect(histIdx).toBeGreaterThan(-1);
    expect(histIdx).toBeLessThan(trendIdx);
    expect(trendIdx).toBeLessThan(contextIdx);
  });

  it('contextValue expõe convictionTrend (objeto e deps) ao lado de orderflowTrend', () => {
    const app = read('../src/App.tsx');
    const memoMatch = app.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(memoMatch).not.toBeNull();
    expect(memoMatch![1]).toContain('orderflowTrend,\n      convictionTrend,');
    const depsMatch = app.match(/const contextValue = useMemo\([\s\S]*?\[([\s\S]*?)\],\s*\);/);
    expect(depsMatch).not.toBeNull();
    expect(depsMatch![1]).toContain('orderflowTrend,\n      convictionTrend,');
  });

  it('a série é resetada DENTRO do efeito real de troca de ativo (nunca uma ocorrência solta em outro lugar) — junto de l2History/orderflowHistory/trackRecord/multiTimeframeContext, mesma disciplina, mesmo efeito', () => {
    const app = read('../src/App.tsx');
    const m = app.match(/useEffect\(\(\) => \{\s*setPriceData\(null\);[\s\S]*?\}, \[selectedAsset\]\);/);
    expect(m, 'efeito de reset por troca de ativo não encontrado').not.toBeNull();
    const block = m![0];
    expect(block).toContain('useUnifiedSnapshotStore.getState().resetL2History();');
    expect(block).toContain('useUnifiedSnapshotStore.getState().resetOrderflowHistory();');
    expect(block).toContain('useUnifiedSnapshotStore.getState().resetInstitutionalScoreHistory();');
  });
});

describe('ScoreContextCard (gaveta Core Intelligence): glifo ▲/▬/▼ real do Conviction Engine (Evolução da Inteligência Operacional §4)', () => {
  // v16.0 PRO Fase 1: mesmo destino de institutional-confidence-zone-
  // wiring.test.ts — Score/Conviction saíram da TopBar, mesmos dados
  // reais, agora em ScoreContextCard (self-contained).
  it('destrutura convictionTrend do WidgetContext ao lado de confidenceZone', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain(
      'const { institutionalScore, confidenceZone, convictionTrend, assistantMessages, heatReading, vwapCtx, nlState, nexusConfluence } =',
    );
  });

  it('os 3 glifos exatos da diretriz — FORTALECENDO=▲, ENFRAQUECENDO=▼, ESTAVEL=▬ — nunca um quarto símbolo inventado', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('convictionTrend.trend === "FORTALECENDO" ? "▲" : convictionTrend.trend === "ENFRAQUECENDO" ? "▼" : "▬"');
  });

  it('o glifo só renderiza com uma leitura OK real — histórico insuficiente não vira um símbolo fabricado', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('convictionTrend?.status === "OK" && convictionTrend.trend\n            ? `');
  });

  it('o Conviction Engine NUNCA substitui o score — é um glifo adicional ao lado do número, não uma segunda métrica separada', () => {
    const app = read('../src/App.tsx');
    // Âncora estável: o bloco real de scoreValue (nunca scoreTitle, que
    // repete a mesma condição de guarda mas é um texto de tooltip
    // separado) — limitado até a próxima const para nunca vazar para
    // scoreColor/scoreTitle abaixo.
    const start = app.indexOf('const scoreValue =');
    const end = app.indexOf('const scoreColor =', start);
    expect(start, 'scoreValue não encontrado').toBeGreaterThan(-1);
    expect(end, 'fim de scoreValue não encontrado').toBeGreaterThan(start);
    const block = app.slice(start, end);
    expect(block).toContain('${institutionalScore.score}%');
    expect(block).toContain('convictionTrend.trend === "FORTALECENDO"');
  });
});

describe('LEI 24 + Regras de Ouro: institutionalScoreHistory/computeConvictionTrend são puros e honestos', () => {
  it('a store escreve institutionalScoreHistory só via recordInstitutionalScore/resetInstitutionalScoreHistory', () => {
    const store = read('../src/store/unified-snapshot-store.ts');
    expect(store).toContain('recordInstitutionalScore: (score) => set((s) => {');
    expect(store).toContain('resetInstitutionalScoreHistory: () => set((s) => { s.institutionalScoreHistory = []; }),');
  });

  it('institutional-score.ts nunca usa Math.random/fetch/rede — pushConvictionHistory e computeConvictionTrend são puros', () => {
    const src = read('../src/nexus/institutional-score.ts');
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toContain('fetch(');
  });

  it('"probabilidade" só aparece como disclaimer de negação (Regra de Ouro 2), nunca rotulando a tendência de convicção', () => {
    const src = read('../src/nexus/institutional-score.ts');
    expect(src.toLowerCase()).not.toContain('probabilidade de acerto');
    expect(src.toLowerCase()).not.toContain('probabilidade real');
  });
});
