// harmonic-geometry-plugin-wiring.test.ts — pendência #6 da PR #16, perna
// final ("chegar na perfeição"): fecha o resíduo real documentado em
// chart-layer-depth.ts — o zigue-zague XABCD/Wolfe/H&S, a PRZ/EPA/
// NECKLINE/APEX e o triângulo migraram de `series.createPriceLine(...)`/
// `chart.addSeries(LineSeries, ...)` nativos (presos ao z=35 compartilhado)
// para HarmonicGeometryPlugin.tsx (canvas próprio, z=50 real de "event").
// Mesma convenção mista de sempre: padrão-no-código-fonte para a fiação
// (o bug mais provável aqui é "esqueceram de conectar A com B" ou "a
// migração perdeu um pedaço da lógica original", nunca "a matemática está
// sutilmente errada" — a matemática real de winner-selection/geometria
// já vinha do useEffect nativo, só movida de lugar, e as fórmulas em si
// (fitScore/slope/intercept) já têm suíte própria nos motores
// harmonic-patterns.test.ts/triangle-pattern.test.ts/
// head-shoulders-pattern.test.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const plugin = read('../src/chart/HarmonicGeometryPlugin.tsx');
const enhancedChart = read('../src/chart/EnhancedChart_110_Percent.tsx');
const chartLayerDepth = read('../src/chart/chart-layer-depth.ts');

describe('HarmonicGeometryPlugin: zero segunda matemática — mesma disputa/geometria do useEffect nativo que substitui', () => {
  it('ATUALIZAÇÃO 04/09/2026 (pedido direto do Operador): fim do winner-take-all — CADA hit do array desenha, HEAD_SHOULDERS desenha sempre que presente (sem disputa de fitScore entre famílias), TRIANGLE continua independente', () => {
    expect(plugin).not.toContain('const candidates: Array<{ family: "HARMONIC" | "HEAD_SHOULDERS"; fitScore: number }> = [];');
    expect(plugin).not.toContain('let winner: { family: "HARMONIC" | "HEAD_SHOULDERS"; fitScore: number } | null');
    expect(plugin).toContain('for (const hit of hits ?? []) {');
    expect(plugin).toMatch(/^\s*if \(hs\) \{/m);
    expect(plugin).toContain('if (triangle) {');
  });

  it('drawZigzagOutline: mesma técnica real de filtro/sort/dedup por tempo, reusada por HARMONIC (dentro do loop, um hit por vez) e HEAD_SHOULDERS (zero segunda cópia)', () => {
    expect(plugin).toContain('const drawZigzagOutline = (points: Array<HarmonicPoint | undefined>) => {');
    expect(plugin).toContain('.filter((p): p is HarmonicPoint => p !== undefined)');
    expect(plugin).toContain('.sort((a, b) => a.time - b.time)');
    expect(plugin).toContain('.filter((p, i, arr) => i === 0 || p.time !== arr[i - 1].time)');
    expect(plugin).toContain('drawZigzagOutline([hit.points.X, hit.points.A, hit.points.B, hit.points.C, hit.points.D]);');
    expect(plugin).toContain('drawZigzagOutline([hs.leftShoulder, hs.neckline1, hs.head, hs.neckline2, hs.rightShoulder]);');
  });

  it('os 4 rótulos reais (PRZ/EPA/NECKLINE/APEX) — mesmo texto exato do mkH() nativo que substitui, nenhuma string redigitada (PRZ agora por hit, dentro do loop)', () => {
    expect(plugin).toContain('`${hit.pattern} ${hDirGlyph} PRZ ${(hit.fitScore * 100).toFixed(0)}%`');
    expect(plugin).toContain('`WOLFE EPA${etaLabel ? ` · ETA ${etaLabel}` : ""}`');
    expect(plugin).toContain('`${hs.kind === "REGULAR" ? "H&S" : "INV H&S"} ${hsDirGlyph} NECKLINE ${(hs.fitScore * 100).toFixed(0)}%`');
    expect(plugin).toContain(
      '`${triangle.kind} ${dirGlyph} APEX ${(triangle.fitScore * 100).toFixed(0)}%${etaLabel ? ` · ETA ${etaLabel}` : ""}`',
    );
  });

  it('múltiplos padrões harmônicos reais desenham ao mesmo tempo (achado real: hits[0] escondia qualquer segundo hit já duplamente filtrado — MIN_FIT_SCORE geométrico + confluência institucional)', () => {
    const loopStart = plugin.indexOf('for (const hit of hits ?? []) {');
    expect(loopStart).toBeGreaterThan(-1);
    const loopEnd = plugin.indexOf('\n      }', loopStart);
    const loopBody = plugin.slice(loopStart, loopEnd);
    // dentro do loop, cada hit desenha seu próprio zigue-zague + PRZ — nenhum
    // `hits[0]`/`hits[<índice fixo>]` sobrevivendo escondido no corpo.
    expect(loopBody).not.toMatch(/hits\[\d+\]/);
    expect(loopBody).toContain('drawZigzagOutline(');
    expect(loopBody).toContain('drawLevelWithLabel(hit.points.D.price');
  });

  it('triângulo: slope/intercept avaliados exatamente como o motor já expõe (resistanceAtLastCandle/supportAtLastCandle/apexIndex), zero fórmula nova', () => {
    expect(plugin).toContain('triangle.resistanceSlope * firstRes.index + triangle.resistanceIntercept');
    expect(plugin).toContain('triangle.supportSlope * firstSup.index + triangle.supportIntercept');
    expect(plugin).toContain('const apexPrice = triangle.resistanceSlope * triangle.apexIndex + triangle.resistanceIntercept;');
  });

  it('achado real da migração: os 4 rótulos agora desenham DE VERDADE via drawCanvasLabel — antes (axisLabelVisible:false + title nativo) nunca chegavam à tela', () => {
    expect(plugin).toContain('import { drawCanvasLabel, measureCanvasLabel } from "../nexus/canvas-label"');
    expect(plugin).toContain('drawCanvasLabel(ctx, boxX, boxY, { fill: LABEL_FILL, text: label });');
  });

  it('cor vem da paleta canônica "projection" (mesmo matiz roxo/lavanda que a polilinha/triângulo nativos já usavam) — nunca um rgba redigitado', () => {
    expect(plugin).toContain('chartPaletteRgba("projection", 0.55)');
    expect(plugin).toContain('chartPaletteRgba("projection", 0.4)');
    expect(plugin).toContain('chartPaletteRgba("projection", 0.85)');
  });

  it('Fio de Seda (Regra de Ouro 5): lineWidth 1, nunca ctx.setLineDash(', () => {
    expect(plugin).toContain('ctx.lineWidth = 1;');
    expect(plugin).not.toContain('ctx.setLineDash(');
  });

  it('geometria full-width para PRZ/EPA/NECKLINE/APEX (x=0 até plotRight) — MESMO comportamento visual de series.createPriceLine que substitui', () => {
    expect(plugin).toContain('import { measurePlotArea } from "./chart-plot-area"');
    // Rodada de acessibilidade da navegação/gráfico (achado real: "cada
    // item no seu canto, nada cobrindo nada") — plotRight agora também
    // exclui a lane real do Volume Profile/TPO/Order Book Depth quando
    // ativas (activeLanes), nunca só o eixo.
    expect(plugin).toContain('const { plotRight } = measurePlotArea(chart, cssWidth, lanes);');
    expect(plugin).toContain('activeLanes?: readonly ChartProfileLaneId[];');
    expect(plugin).toContain('ctx.moveTo(0, yLine);');
    expect(plugin).toContain('ctx.lineTo(plotRight, yLine);');
  });

  it('fail-closed: segmento com qualquer extremo fora da janela visível nunca desenha (zero extrapolação)', () => {
    expect(plugin).toMatch(/if\s*\(x1\s*===\s*null\s*\|\|\s*y1\s*===\s*null\s*\|\|\s*x2\s*===\s*null\s*\|\|\s*y2\s*===\s*null\)\s*return;/);
  });

  it('ATUALIZAÇÃO 04/09/2026: nível fora da faixa vertical visível nunca fabrica posição — em vez de só "return" silencioso, aciona o indicador fora-da-vista', () => {
    expect(plugin).toMatch(/if\s*\(y\s*===\s*null\)\s*\{\s*\n\s*drawOffscreenIndicator\(price,\s*label\);\s*\n\s*return;/);
  });

  it('drawOffscreenIndicator: usa series.priceScale().getVisibleRange() (preço real, nunca pixel) para decidir ▲ (acima) ou ▼ (abaixo) — nunca fabrica a posição do nível em si', () => {
    expect(plugin).toContain('const drawOffscreenIndicator = (price: number, label: string) => {');
    expect(plugin).toContain('const range = series.priceScale().getVisibleRange();');
    expect(plugin).toContain('if (!range) return;');
    expect(plugin).toContain('const above = price > range.to;');
    expect(plugin).toContain('const below = price < range.from;');
    expect(plugin).toContain('if (!above && !below) return;');
    expect(plugin).toContain('const text = `${above ? "▲" : "▼"} ${label} · fora da vista`;');
  });

  it('drawOffscreenIndicator ancora o aviso perto da borda do canvas (topo quando acima, base quando abaixo) via a mesma primitiva drawCanvasLabel — zero segunda forma de desenhar texto', () => {
    const fnStart = plugin.indexOf('const drawOffscreenIndicator = (price: number, label: string) => {');
    const fnEnd = plugin.indexOf('\n      };', fnStart);
    const fnBody = plugin.slice(fnStart, fnEnd);
    expect(fnBody).toContain('const boxY = above ? 4 : cssHeight - size.height - 4;');
    expect(fnBody).toContain('drawCanvasLabel(ctx, boxX, boxY, { fill: LABEL_FILL, text });');
  });

  it('arquitetura de canvas real: rAF + ResizeObserver + subscribeVisibleLogicalRangeChange + getChartLayerZIndex("harmonics")', () => {
    expect(plugin).toContain('requestAnimationFrame');
    expect(plugin).toContain('ResizeObserver');
    expect(plugin).toContain('subscribeVisibleLogicalRangeChange');
    expect(plugin).toContain('getChartLayerZIndex("harmonics")');
  });
});

describe('EnhancedChart_110_Percent.tsx: wiring real do plugin + resíduo fechado por completo', () => {
  it('monta HarmonicGeometryPlugin gated por visibility.harmonics, recebe harmonicHits/trianglePattern/headShouldersPattern reais', () => {
    const idx = enhancedChart.indexOf('<HarmonicGeometryPlugin');
    expect(idx, 'HarmonicGeometryPlugin não montado').toBeGreaterThan(-1);
    const before = enhancedChart.slice(Math.max(0, idx - 120), idx);
    expect(before).toContain('visibility.harmonics && (');
    const block = enhancedChart.slice(idx, idx + 320);
    expect(block).toContain('data={data}');
    expect(block).toContain('harmonicHits={harmonicHits}');
    expect(block).toContain('trianglePattern={trianglePattern}');
    expect(block).toContain('headShouldersPattern={headShouldersPattern}');
  });

  it('nenhum resquício de CÓDIGO da renderização nativa antiga sobrou no arquivo (refs/séries/price lines do harmônico) — o nome antigo pode aparecer só em prosa de comentário explicando a migração, nunca em uso real', () => {
    for (const oldRef of ['harmonicPolylineRef', 'harmonicLinesRef', 'triangleResistanceLineRef', 'triangleSupportLineRef', 'necklineExtensionLineRef']) {
      expect(enhancedChart).not.toContain(`${oldRef}.current`);
      expect(enhancedChart).not.toMatch(new RegExp(`const ${oldRef}\\s*=\\s*useRef`));
    }
  });

  it('HarmonicConfluenceArrowPlugin (SMC Harmonic Fusion, migrado numa rodada anterior) continua montado — a seta de confluência é um consumidor diferente, não afetado por esta migração', () => {
    expect(enhancedChart).toContain('<HarmonicConfluenceArrowPlugin');
  });
});

describe('chart-layer-depth.ts: harmonics fechou o resíduo por completo — cobertura já provada por chart-layer-depth.test.ts', () => {
  it('não aparece em CHART_NATIVE_LAYER_IDS nem em CHART_LINE_ONLY_LAYER_IDS', () => {
    const nativeBlock = chartLayerDepth.slice(
      chartLayerDepth.indexOf('export const CHART_NATIVE_LAYER_IDS'),
      chartLayerDepth.indexOf('];', chartLayerDepth.indexOf('export const CHART_NATIVE_LAYER_IDS')),
    );
    const lineOnlyBlock = chartLayerDepth.slice(
      chartLayerDepth.indexOf('export const CHART_LINE_ONLY_LAYER_IDS'),
      chartLayerDepth.indexOf('];', chartLayerDepth.indexOf('export const CHART_LINE_ONLY_LAYER_IDS')),
    );
    expect(nativeBlock).not.toContain('"harmonics"');
    expect(lineOnlyBlock).not.toContain('"harmonics"');
  });

  it('continua "event" em LAYER_TIER — o tier nunca mudou, só o mecanismo que agora o respeita de verdade em TODA a camada (seta + geometria)', () => {
    expect(chartLayerDepth).toMatch(/harmonics:\s*"event"/);
  });
});
