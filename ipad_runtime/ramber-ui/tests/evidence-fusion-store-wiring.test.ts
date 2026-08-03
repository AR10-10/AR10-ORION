// evidence-fusion-store-wiring.test.ts — Ordem Fechamento (§3, "Evidence
// Fusion... deve tornar-se o barramento inteligente do ecossistema"):
// mesmo achado de auditoria de institutional-zones-store-wiring.test.ts —
// fuseEvidence() já era computado a cada render dentro de CouncilWidget,
// mas SEM fatia própria na store, nenhum outro consumidor conseguia ler a
// MESMA leitura. Trava os 4 lugares reais (state → actions → defaults →
// seletor, mesma convenção documentada no cabeçalho de unified-snapshot-
// store.ts) + o ponto de publicação em CouncilWidget (zero segundo
// cálculo) + o primeiro consumidor real (self-diagnostics.ts). A
// agregação real que consome isto tem execução própria em
// evidence-fusion.test.ts/self-diagnostics.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

function councilWidgetSource(app: string): string {
  const widgetIdx = app.indexOf('function CouncilWidget()');
  const nextWidgetIdx = app.indexOf('function MultiTimeframeMatrixWidget()');
  expect(widgetIdx).toBeGreaterThan(-1);
  expect(nextWidgetIdx).toBeGreaterThan(widgetIdx);
  return app.slice(widgetIdx, nextWidgetIdx);
}

describe('unified-snapshot-store.ts: evidenceFusion nos 4 lugares reais (§3 Motores Quant)', () => {
  it('state interface declara o campo real', () => {
    const s = read('../src/store/unified-snapshot-store.ts');
    expect(s).toContain('evidenceFusion: EvidenceFusionReading | null;');
  });

  it('action real de escrita', () => {
    const s = read('../src/store/unified-snapshot-store.ts');
    expect(s).toContain('setEvidenceFusion: (reading: EvidenceFusionReading | null) => void;');
    expect(s).toContain('setEvidenceFusion: (reading) => set((s) => { s.evidenceFusion = reading; }),');
  });

  it('default real: null honesto (mesmo padrão de layerRelevance, nunca um objeto fabricado)', () => {
    const s = read('../src/store/unified-snapshot-store.ts');
    expect(s).toContain('evidenceFusion: null,');
  });

  it('seletor atômico real', () => {
    const s = read('../src/store/unified-snapshot-store.ts');
    expect(s).toContain('export const useEvidenceFusionSnapshot = (): EvidenceFusionReading | null =>');
    expect(s).toContain('useUnifiedSnapshotStore((s) => s.evidenceFusion);');
  });
});

describe('App.tsx CouncilWidget: publica a MESMA leitura já computada — zero segundo cálculo', () => {
  it('evidenceFusion é memoizado (useMemo) antes de ser publicado — nunca uma nova referência a cada render disparando escrita na store sem mudança real', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    expect(widgetSrc).toContain('const evidenceFusion = useMemo(');
    expect(widgetSrc).toContain('[engineSignals, institutionalSignals, layerRelevance],');
  });

  it('o useEffect de publicação vem logo após o useMemo real de evidenceFusion, mesma variável', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    const memoIdx = widgetSrc.indexOf('const evidenceFusion = useMemo(');
    expect(memoIdx, 'useMemo real não encontrado').toBeGreaterThan(-1);
    const block = widgetSrc.slice(memoIdx, memoIdx + 1000);
    expect(block).toContain('useUnifiedSnapshotStore.getState().setEvidenceFusion(evidenceFusion);');
    expect(block).toContain('}, [evidenceFusion]);');
  });
});

describe('self-diagnostics.ts: primeiro consumidor real de evidenceFusion via a store (Ordem Fechamento §3)', () => {
  it('DiagnosticInput declara o campo real derivado (não o objeto inteiro — self-diagnostics.ts fica desacoplado da forma de EvidenceFusionReading)', () => {
    const s = read('../src/nexus/self-diagnostics.ts');
    expect(s).toContain('evidenceFusionFieldCoverage: number | null;');
    expect(s).not.toContain('EvidenceFusionReading');
  });

  it('App.tsx deriva evidenceFusionFieldCoverage da MESMA fórmula já usada pelo painel EVIDENCE FUSION (N campos com montador real / 10), lendo via getSnapshotForEngine — zero segundo cálculo de fuseEvidence', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const evidenceFusion = engineView.snapshot.evidenceFusion;');
    expect(app).toContain('Object.values(evidenceFusion.fieldCoverage).filter((v) => v > 0).length / 10');
    expect(app).toContain('evidenceFusionFieldCoverage,');
    expect(app).not.toContain('fuseEvidence(engineView');
  });
});
