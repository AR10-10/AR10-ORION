// scenario-projection-chart.test.ts — §6 "Smart Projection Engine"
// (Diretriz Complementar): trava no nível de código-fonte a leitura real
// do Motor de Cenários (scenario-engine.ts, já testado em
// tests/scenario-engine.test.ts se existir, ou equivalente) desenhada como
// price lines nativas no gráfico — mesmo padrão de fiação source-pattern
// dos outros plugins de chart (VolumeProfilePlugin, LiquidityZonesPlugin).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('EnhancedChart_110_Percent: Scenario Path A/B como price lines nativas reais', () => {
  const src = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('importa o tipo real do Motor de Cenários — zero contrato próprio duplicado', () => {
    expect(src()).toContain('import type { ScenarioProjection } from "../nexus/scenario-engine";');
  });

  it('prop scenario é opcional/fail-closed (mesma convenção de tradePlan/aura/confidenceZone)', () => {
    expect(src()).toContain('scenario?: ScenarioProjection | null;');
  });

  it('sem scenario real => nada desenhado (early return, nunca um caminho de exemplo)', () => {
    const s = src();
    const idx = s.indexOf('scenarioLinesRef.current.forEach((line) => series.removePriceLine(line));');
    expect(idx, 'efeito de scenario não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 150);
    expect(block).toContain('scenarioLinesRef.current = [];');
    expect(block).toContain('if (!scenario) return;');
  });

  it('Fio de Seda: LineStyle.Solid sempre, zero setLineDash em qualquer lugar do arquivo', () => {
    const s = src();
    expect(s).not.toMatch(/\.setLineDash\(/);
    // a linha de scenario específica usa lineWidth 1 + LineStyle.Solid, mesma disciplina das outras.
    const idx = s.indexOf('scenarioLinesRef.current.push(');
    expect(idx).toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 400);
    expect(block).toContain('lineWidth: 1,');
    expect(block).toContain('lineStyle: LineStyle.Solid,');
  });

  it('cada path desenha SÓ quando tem alvo real (target !== null) — fail-closed por lado, nunca um alvo fabricado', () => {
    expect(src()).toContain('if (!path.target || !Number.isFinite(path.target.price)) return;');
  });

  it('Diretriz Restauração/Inteligência Visual §3: cor dedicada (lavanda), NUNCA a mesma do LONG/SHORT real — achado real via harness Playwright: title só aparece via axisLabelVisible/hover, que esta linha não tem, então cor é o ÚNICO sinal que o operador vê', () => {
    const s = src();
    expect(s).toContain('const PROJECTION_RGB = "186, 168, 255";');
    expect(s).toContain('const rgb = PROJECTION_RGB;');
  });

  it('regressão: a cor da projeção nunca volta a ser rgba(0,255,170,...)/rgba(255,0,85,...) — a mesma cor de um nível LONG/SHORT já confirmado tornaria a projeção indistinguível de estrutura real', () => {
    const s = src();
    const idx = s.indexOf('const PROJECTION_RGB');
    const block = s.slice(idx, idx + 700);
    expect(block).not.toContain('0, 255, 170');
    expect(block).not.toContain('255, 0, 85');
  });

  it('opacidade real escala linearmente por opinionWeight (0..1), piso honesto quando null — nunca invisível, nunca inventado', () => {
    const s = src();
    const idx = s.indexOf('const alphaOf = (weight: number | null): number => {');
    expect(idx).toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 400);
    expect(block).toContain('if (weight === null || !Number.isFinite(weight)) return floor;');
    expect(block).toContain('return floor + Math.max(0, Math.min(1, weight)) * (ceiling - floor);');
  });

  it('teto de opacidade real do Scenario fica ABAIXO do Trade Plan ativo (0.75) — LEI 24: nunca compete visualmente com o plano real', () => {
    const s = src();
    const alphaIdx = s.indexOf('const alphaOf = (weight: number | null): number => {');
    const block = s.slice(alphaIdx, alphaIdx + 300);
    expect(block).toMatch(/const ceiling = 0\.55/);
    expect(s).toContain('rgba(255, 0, 85, 0.75)'); // linha real do Stop do Trade Plan, referência do teto
  });

  it('axisLabelVisible false (mais discreto que o Trade Plan, que usa true) e título carrega direção + fonte real + peso real', () => {
    const s = src();
    const idx = s.indexOf('scenarioLinesRef.current.push(');
    const block = s.slice(idx, idx + 1100);
    expect(block).toContain('axisLabelVisible: false,');
    expect(block).toContain('title: `PROJEÇÃO · ${label} · ${path.direction} · ${path.target.sourceKind} · ${weightLabel}`,');
  });

  it('Diretriz Restauração/Inteligência Visual §3: título começa explicitamente com "PROJEÇÃO" — passado/presente/projeção nunca se confundem só pela cor/opacidade', () => {
    const s = src();
    const idx = s.indexOf('scenarioLinesRef.current.push(');
    const block = s.slice(idx, idx + 1100);
    expect(block).toMatch(/title: `PROJEÇÃO · /);
  });

  it('peso null vira "opinion n/a" honesto no título — nunca uma porcentagem fabricada', () => {
    expect(src()).toContain('"opinion n/a"');
  });

  it('ref limpa no unmount (mesma disciplina de fibLinesRef/tradePlanLinesRef)', () => {
    const s = src();
    const cleanupIdx = s.indexOf('chart.remove();');
    const cleanupBlock = s.slice(cleanupIdx, cleanupIdx + 400);
    expect(cleanupBlock).toContain('scenarioLinesRef.current = [];');
  });
});

describe('App.tsx: ChartWidget lê o Motor de Cenários real e passa ao gráfico — zero segunda fonte', () => {
  it('useScenarioSnapshot() chamado dentro de ChartWidget (antes só CouncilWidget/SecondaryModuleView liam)', () => {
    const app = read('../src/App.tsx');
    const widgetIdx = app.indexOf('function ChartWidget(');
    const nextWidgetIdx = app.indexOf('function OrderFlowWidget()');
    expect(widgetIdx).toBeGreaterThan(-1);
    expect(nextWidgetIdx).toBeGreaterThan(widgetIdx);
    const widgetSrc = app.slice(widgetIdx, nextWidgetIdx);
    expect(widgetSrc).toContain('const chartScenario = useScenarioSnapshot();');
    expect(widgetSrc).toContain('scenario={chartScenario ?? null}');
  });
});
