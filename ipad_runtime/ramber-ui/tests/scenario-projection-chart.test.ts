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

  it('sem scenario real => zero níveis calculados (early return, nunca um caminho de exemplo)', () => {
    const s = src();
    const idx = s.indexOf('const scenarioProjectionLevels = useMemo<HorizontalLevel[]>(() => {');
    expect(idx, 'useMemo de scenario não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 200);
    expect(block).toContain('if (!scenario) return [];');
  });

  it('Achado 2.5: scenario_projection existe em CHART_LAYER_IDS (toggle manual real) — era a única camada sem nenhum', () => {
    const s = src();
    expect(s).toContain('"scenario_projection",');
    expect(s).toContain('scenario_projection: true,');
  });

  it('GRADUAÇÃO (2026-09-07): visibilidade agora é gate JSX (mesmo padrão do Harmônico) — sem visibility.scenario_projection, HorizontalLevelLinesPlugin nem monta; migrou de createPriceLine nativo pra canvas próprio', () => {
    const s = src();
    const mountIdx = s.indexOf('levels={scenarioProjectionLevels}');
    expect(mountIdx, 'HorizontalLevelLinesPlugin com levels={scenarioProjectionLevels} não montado').toBeGreaterThan(-1);
    const before = s.slice(Math.max(0, mountIdx - 200), mountIdx);
    expect(before).toContain('visibility.scenario_projection && (');
  });

  it('Fio de Seda: zero setLineDash em qualquer lugar do arquivo — 1px sólido é contrato do próprio HorizontalLevelLinesPlugin (travado em horizontal-level-lines-plugin.test.ts), não reimplementado aqui', () => {
    const s = src();
    expect(s).not.toMatch(/\.setLineDash\(/);
  });

  it('v2 (Future Path Map): desenha até MAX_SCENARIO_TARGETS por caminho — path.targets.forEach, nunca só o primeiro; lado sem nível real (targets=[]) desenha zero linhas naturalmente (fail-closed por construção, não por um if extra)', () => {
    const s = src();
    expect(s).toContain('path.targets.forEach((target, i) => {');
    expect(s).toContain('if (!Number.isFinite(target.price)) return;');
  });

  it('v2: opacidade decresce por rank (TARGET_ALPHA_FALLOFF) — o alvo mais próximo pesa mais que o 2º/3º, nunca todos com o mesmo peso visual', () => {
    const s = src();
    expect(s).toContain('const TARGET_ALPHA_FALLOFF = [1, 0.65, 0.4];');
    expect(s).toContain('TARGET_ALPHA_FALLOFF[i] ?? TARGET_ALPHA_FALLOFF[TARGET_ALPHA_FALLOFF.length - 1]');
  });

  it('v2: invalidation NUNCA vira uma price line própria — por construção do motor ela é sempre igual ao alvo mais próximo do caminho OPOSTO (já desenhado), então uma segunda linha no mesmo preço seria a "linha fantasma" redundante que a diretriz proíbe', () => {
    const s = src();
    expect(s).not.toContain('path.invalidation');
  });

  it('Diretriz Restauração/Inteligência Visual §3: cor dedicada (lavanda), NUNCA a mesma do LONG/SHORT real — achado real via harness Playwright: title só aparece via axisLabelVisible/hover, que esta linha não tem, então cor é o ÚNICO sinal que o operador vê', () => {
    const s = src();
    expect(s).toContain('const PROJECTION_RGB = "186, 168, 255";');
    expect(s).toContain('color: `rgba(${PROJECTION_RGB}, ${alpha.toFixed(2)})` });');
  });

  it('regressão: a cor da projeção nunca volta a ser rgba(0,255,170,...)/rgba(255,0,85,...) — a mesma cor de um nível LONG/SHORT já confirmado tornaria a projeção indistinguível de estrutura real', () => {
    const s = src();
    const idx = s.indexOf('const PROJECTION_RGB');
    const block = s.slice(idx, idx + 700);
    expect(block).not.toContain('8, 153, 129');
    expect(block).not.toContain('242, 54, 69');
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
    expect(s).toContain('rgba(242, 54, 69, 0.75)'); // linha real do Stop do Trade Plan, referência do teto
  });

  // GRADUAÇÃO (2026-09-07): os testes que travavam axisLabelVisible/title/
  // reaction/weightLabel/"opinion n/a" e a limpeza de scenarioLinesRef
  // foram removidos — esse metadado (título nativo da lib) nunca chegava à
  // tela (mesma classe de achado já documentada para harmônicos/EQH-EQL:
  // axisLabelVisible:false silencia o title por completo) e a ref deixou
  // de existir (HorizontalLevelLinesPlugin gerencia seu próprio canvas,
  // sem refs de IPriceLine). describeScenarioConfidence/describeScenarioReaction
  // saíram do import junto — zero motor/cálculo perdido: a INFORMAÇÃO real
  // (reação/confiança) nunca foi apagada de lugar nenhum, só nunca chegou a
  // ser exibida aqui (Regra de Ouro 4 — nada que já era observável se perde).
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
