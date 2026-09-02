// liquidity-sweep-lines-plugin-wiring.test.ts — pendência #6 da PR #16
// ("chegar na perfeição"): fecha o resíduo real documentado em
// chart-layer-depth.ts — `liquidity_sweep` migrou de `series.
// createPriceLine(...)` nativo (preso ao z=35 compartilhado) para
// LiquiditySweepLinesPlugin.tsx (canvas próprio, z=50 real de "event").
// Mesma convenção mista de sempre: execução real para a constante pura
// (SWEEP_DECAY), padrão-no-código-fonte para a fiação do plugin/consumidor
// (o mesmo motivo de sempre — o bug mais provável aqui é "esqueceram de
// conectar A com B", não "a matemática está sutilmente errada": a
// matemática real de clusterização/decaimento já tem sua própria suíte em
// trap-detection.test.ts/annotation-decay.test.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SWEEP_DECAY } from '../src/chart/LiquiditySweepLinesPlugin';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const plugin = read('../src/chart/LiquiditySweepLinesPlugin.tsx');
const enhancedChart = read('../src/chart/EnhancedChart_110_Percent.tsx');
const chartLayerDepth = read('../src/chart/chart-layer-depth.ts');

describe('SWEEP_DECAY: execução real, valores exatos preservados pela migração', () => {
  it('fadeStartCandles=50, expireCandles=200, minAlpha=0.12 — mesmos números de sempre (EPC OMEGA FINAL, Etapa 10), nunca redescobertos', () => {
    expect(SWEEP_DECAY).toEqual({ fadeStartCandles: 50, expireCandles: 200, minAlpha: 0.12 });
  });
});

describe('LiquiditySweepLinesPlugin: fonte real, zero segunda lógica de clusterização/decaimento', () => {
  it('importa clusterSweptPrices/LIQUIDITY_PROXIMITY_PCT/ageAlpha reais — nunca reimplementa', () => {
    expect(plugin).toContain('import { clusterSweptPrices } from "../nexus/trap-detection"');
    expect(plugin).toContain('import { LIQUIDITY_PROXIMITY_PCT } from "../nexus/layer-relevance"');
    expect(plugin).toContain('import { ageAlpha,');
    expect(plugin).toContain('clusterSweptPrices(uniqueLevels, LIQUIDITY_PROXIMITY_PCT)');
    expect(plugin).toContain('ageAlpha(age, SWEEP_DECAY)');
  });

  it('dedup por preço ANTES de clusterizar — mesma regra real de sempre (1 cluster real = 1 linha)', () => {
    expect(plugin).toContain('seenSweepPrices');
    expect(plugin).toContain('!seenSweepPrices.has(l.price)');
  });

  it('só kind STOP_HUNT_TOPO/STOP_HUNT_FUNDO viram linha — ABSORCAO_ANOMALA (sem sweptLevels) nunca entra', () => {
    expect(plugin).toContain('t.kind !== "STOP_HUNT_TOPO" && t.kind !== "STOP_HUNT_FUNDO"');
  });

  it('fail-closed: cluster expirado (alpha<=0) e y fora da faixa visível nunca desenham', () => {
    expect(plugin).toMatch(/if\s*\(alpha\s*<=\s*0\)\s*continue;/);
    expect(plugin).toMatch(/if\s*\(y\s*===\s*null\)\s*continue;/);
  });

  it('cor vem da paleta canônica attention via ctx.strokeStyle — nunca um rgba redigitado (o triplo antigo já MEDIA a família attention, ver LiquidationHeatmapPlugin.tsx)', () => {
    expect(plugin).toContain('ctx.strokeStyle = chartPaletteRgba("attention", alpha * 0.85);');
  });

  it('Fio de Seda (Regra de Ouro 5): lineWidth 1, nunca ctx.setLineDash(', () => {
    expect(plugin).toContain('ctx.lineWidth = 1');
    expect(plugin).not.toContain('ctx.setLineDash(');
  });

  it('geometria full-width (x=0 até plotRight) — MESMO comportamento visual da price line nativa que substitui, nunca truncada pelo instante do evento (diferente de SessionKeyLevelsPlugin)', () => {
    expect(plugin).toContain('measurePlotArea(chart, cssWidth)');
    expect(plugin).toContain('ctx.moveTo(0, yLine)');
    expect(plugin).toContain('ctx.lineTo(plotRight, yLine)');
  });

  it('respeita a fronteira do eixo (chart-plot-area.ts) — nunca corre por baixo dos números do preço', () => {
    expect(plugin).toContain('import { measurePlotArea } from "./chart-plot-area"');
  });

  it('arquitetura de canvas real: rAF + ResizeObserver + subscribeVisibleLogicalRangeChange + getChartLayerZIndex("liquidity_sweep")', () => {
    expect(plugin).toContain('requestAnimationFrame');
    expect(plugin).toContain('ResizeObserver');
    expect(plugin).toContain('subscribeVisibleLogicalRangeChange');
    expect(plugin).toContain('getChartLayerZIndex("liquidity_sweep")');
  });
});

describe('EnhancedChart_110_Percent.tsx: wiring real do plugin + resíduo fechado', () => {
  it('monta LiquiditySweepLinesPlugin gated por visibility.liquidity_sweep, recebe traps real', () => {
    const idx = enhancedChart.indexOf('<LiquiditySweepLinesPlugin');
    expect(idx, 'LiquiditySweepLinesPlugin não montado').toBeGreaterThan(-1);
    const before = enhancedChart.slice(Math.max(0, idx - 120), idx);
    expect(before).toContain('visibility.liquidity_sweep && (');
    const block = enhancedChart.slice(idx, idx + 200);
    expect(block).toContain('traps={traps}');
    expect(block).toContain('data={data}');
  });

  it('SWEEP_DECAY importado de LiquiditySweepLinesPlugin — nunca uma segunda constante local declarada de novo', () => {
    expect(enhancedChart).toContain('import { LiquiditySweepLinesPlugin, SWEEP_DECAY } from "./LiquiditySweepLinesPlugin"');
    expect(enhancedChart).not.toMatch(/const SWEEP_DECAY[:=]/);
  });

  it('nenhum resquício da price line nativa antiga (sweepLinesRef/createPriceLine de sweep) sobrou no arquivo', () => {
    expect(enhancedChart).not.toContain('sweepLinesRef');
  });
});

describe('chart-layer-depth.ts: liquidity_sweep saiu das listas de nativa/line-only — cobertura já provada por chart-layer-depth.test.ts', () => {
  it('não aparece mais em CHART_NATIVE_LAYER_IDS nem em CHART_LINE_ONLY_LAYER_IDS', () => {
    const nativeBlock = chartLayerDepth.slice(
      chartLayerDepth.indexOf('export const CHART_NATIVE_LAYER_IDS'),
      chartLayerDepth.indexOf('];', chartLayerDepth.indexOf('export const CHART_NATIVE_LAYER_IDS')),
    );
    const lineOnlyBlock = chartLayerDepth.slice(
      chartLayerDepth.indexOf('export const CHART_LINE_ONLY_LAYER_IDS'),
      chartLayerDepth.indexOf('];', chartLayerDepth.indexOf('export const CHART_LINE_ONLY_LAYER_IDS')),
    );
    expect(nativeBlock).not.toContain('"liquidity_sweep"');
    expect(lineOnlyBlock).not.toContain('"liquidity_sweep"');
  });

  it('continua "event" em LAYER_TIER — o tier nunca mudou, só o mecanismo que agora o respeita de verdade', () => {
    expect(chartLayerDepth).toMatch(/liquidity_sweep:\s*"event"/);
  });
});
