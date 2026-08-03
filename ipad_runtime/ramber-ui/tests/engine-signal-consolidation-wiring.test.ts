// engine-signal-consolidation-wiring.test.ts — Ordem Nº 04 (§4,
// "consolidar camadas existentes... engine signals... sem criar
// duplicação"): achado real de auditoria — engine-signal-contract.ts
// (EPC OMEGA FINAL Parte 1) tinha zero consumidor real em todo o `src`
// (só o próprio arquivo se referenciava). CouncilWidget agora é o
// primeiro consumidor real — a lógica pura já tem execução real em
// nexus-engine-signal-contract.test.ts; aqui trancam-se os pontos de
// conexão (mesma convenção mista de sempre, ver consensus-radar-wiring.test.ts).
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

describe('App.tsx: deriveEngineSignalsFromCouncil real, importado e consumido dentro de CouncilWidget', () => {
  it('importa a função real do contrato único', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { deriveEngineSignalsFromCouncil } from "./nexus/engine-signal-contract";');
  });

  it('CouncilWidget deriva engineSignals a partir do MESMO council da store — reempacota, nunca recalcula', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    expect(widgetSrc).toContain('const council = useCouncilSnapshot();');
    expect(widgetSrc).toContain('const engineSignals = deriveEngineSignalsFromCouncil(council);');
  });

  it('LEI 24: CouncilWidget nunca chama aggregateCouncil/buildCouncilDecision — só reformata (mesmo padrão de formatScenarioPathLabel, já usado logo abaixo no mesmo componente)', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    expect(widgetSrc).not.toContain('aggregateCouncil(');
    expect(widgetSrc).not.toContain('buildCouncilDecision(');
    expect(widgetSrc).not.toMatch(/Math\.random/);
  });
});

describe('CouncilWidget: marcador real "fora do pool" — signal.weight null (RISK gate ou ABSTAIN), nunca antes exibido por voto', () => {
  it('pareia council.votes[i] com engineSignals[i] por índice (mesma ordem, mesmo comprimento garantido por deriveEngineSignalsFromCouncil)', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    expect(widgetSrc).toContain('{(council?.votes ?? []).map((v, i) => {');
    expect(widgetSrc).toContain('const inPool = engineSignals[i]?.weight !== null && engineSignals[i]?.weight !== undefined;');
  });

  it('renderiza o marcador só quando !inPool, com tooltip real explicando RISK/ABSTAIN', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    expect(widgetSrc).toContain('{!inPool && (');
    expect(widgetSrc).toContain('· fora do pool');
    expect(widgetSrc).toContain('Fora do pool linear real do Conselho: RISK é um portão fail-closed');
  });

  it('zero regressão visual nos campos já existentes: stance/confidence/rationale continuam lidos direto de `v`, não de `engineSignals`', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    expect(widgetSrc).toContain('{v.stance}');
    expect(widgetSrc).toContain('{Math.round(v.confidence * 100)}%');
    expect(widgetSrc).toContain('{v.rationale}');
    expect(widgetSrc).toContain('title={v.evidence.length > 0 ? v.evidence.join(" · ") : v.rationale}');
  });
});
