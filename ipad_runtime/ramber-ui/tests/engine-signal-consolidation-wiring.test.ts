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
  it('importa a função real do contrato único (Carta Branca: agora junto de deriveEngineSignalsFromInstitutionalZones, 2º montador real)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { deriveEngineSignalsFromCouncil, deriveEngineSignalsFromInstitutionalZones } from "./nexus/engine-signal-contract";');
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

// Carta Branca (Evidence Fusion Engine): SYSTEM_HANDBOOK §6.72/§6.74/§6.76
// classificaram isto como "iniciativa de arquitetura própria" por 3
// rodadas seguidas, nunca construído. Lógica pura já tem execução real em
// evidence-fusion.test.ts/nexus-engine-signal-contract.test.ts; aqui
// trancam-se os pontos de conexão reais (mesma convenção mista de sempre).
describe('App.tsx: Evidence Fusion Engine real — primeiro consumidor vivo de engine-signal-contract.ts + evidence-fusion.ts', () => {
  it('importa fuseEvidence do motor isolado (zero segunda implementação dentro de App.tsx)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { fuseEvidence, type EvidenceFusionSourceGroup } from "./nexus/evidence-fusion";');
  });

  it('CouncilWidget lê institutionalZones da MESMA store que o gráfico publica — zero segundo cálculo de zonas', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    expect(widgetSrc).toContain('const institutionalZones = useInstitutionalZonesSnapshot();');
    expect(widgetSrc).not.toContain('computeInstitutionalZones(');
  });

  it('as 2 fontes reais e independentes alimentam fuseEvidence — Conselho E Zonas Institucionais, nunca Scenario (redundante com o Conselho, documentado no cabeçalho de evidence-fusion.ts)', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    expect(widgetSrc).toContain('const institutionalSignals = deriveEngineSignalsFromInstitutionalZones(institutionalZones);');
    expect(widgetSrc).toContain('{ source: "Conselho", signals: engineSignals }');
    expect(widgetSrc).toContain('{ source: "Zonas Institucionais", signals: institutionalSignals }');
    expect(widgetSrc).not.toMatch(/source:\s*"Scenario"/);
  });

  it('LEI 24 / Regra de Ouro 2: o painel real nunca usa cor direcional (verde/vermelho) — sempre neutro, porque a leitura nunca é uma direção', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    const idx = widgetSrc.indexOf('EVIDENCE FUSION');
    expect(idx, 'bloco EVIDENCE FUSION não encontrado').toBeGreaterThan(-1);
    const block = widgetSrc.slice(idx - 400, idx + 700);
    expect(block).not.toContain('#00ffaa'); // verde real de LONG usado em todo o resto do app
    expect(block).not.toContain('#ff0055'); // vermelho real de SHORT usado em todo o resto do app
    expect(block).toContain('text-[#8ab4f8]'); // cor neutra real, mesma família do resto do widget
  });

  it('estado honesto vazio usa AWAIT (mesma convenção do resto do widget), nunca um número fabricado quando totalSignals é 0', () => {
    const widgetSrc = councilWidgetSource(read('../src/App.tsx'));
    expect(widgetSrc).toContain('evidenceFusion.totalSignals > 0');
    expect(widgetSrc).toMatch(/:\s*AWAIT/);
  });
});
