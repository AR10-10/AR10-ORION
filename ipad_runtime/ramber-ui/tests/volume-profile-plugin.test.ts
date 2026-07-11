// volume-profile-plugin.test.ts — V-MAX Fase 1 (superfície visual): trava
// o VolumeProfilePlugin e as linhas Fibonacci no nível de código-fonte —
// mesmo padrão da suite do LiquidityZonesPlugin (ambiente node, sem canvas
// real; a verificação visual real é feita via Playwright antes do commit).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('VolumeProfilePlugin: Fio de Seda + geometria real + dirty-flag (mesmas leis dos outros plugins)', () => {
  const src = () => read('../src/chart/VolumeProfilePlugin.tsx');

  it('nunca chama setLineDash — a linha do POC é sólida', () => {
    expect(src()).not.toMatch(/\.setLineDash\(/);
  });

  it('a linha do POC é lineWidth = 1 (fio de seda), nunca maior', () => {
    expect(src()).toContain('ctx.lineWidth = 1');
    expect(src()).not.toMatch(/ctx\.lineWidth = [2-9]/);
  });

  it('resolve preço→pixel via series.priceToCoordinate real da lib (nunca pixel fabricado)', () => {
    expect(src()).toContain('series.priceToCoordinate(');
  });

  it('bucket fora da área visível nunca é desenhado (Fail-Closed, nunca extrapola)', () => {
    expect(src()).toMatch(/if \(yLow === null \|\| yHigh === null\) continue;/);
  });

  it('sem perfil real => nada desenhado (nunca um histograma de exemplo); zero Math.random', () => {
    expect(src()).toMatch(/if \(!vp \|\| vp\.histogram\.length === 0\) return;/);
    expect(src()).not.toMatch(/Math\.random/);
  });

  it('dirty-flag + requestAnimationFrame + ResizeObserver + desmontagem limpa (mesma disciplina)', () => {
    const s = src();
    expect(s).toContain('requestAnimationFrame(');
    expect(s).toMatch(/if \(rafScheduled\) return;/);
    expect(s).toContain('subscribeVisibleLogicalRangeChange(');
    expect(s).toContain('unsubscribeVisibleLogicalRangeChange(');
    expect(s).toContain('new ResizeObserver(');
    expect(s).toContain('resizeObserver.disconnect()');
  });

  it('lê o dado real da store (useVolumeProfileSnapshot) — zero rede/recomputação própria', () => {
    const s = src();
    expect(s).toContain('useVolumeProfileSnapshot()');
    expect(s).not.toMatch(/fetch\(/);
  });
});

describe('EnhancedChart: níveis Fibonacci reais como price lines fio de seda', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('linhas FIB são lineStyle Solid, lineWidth 1, com ratio+score reais no título', () => {
    const s = chart();
    const fibBlock = s.slice(s.indexOf('fibonacciLevels ?? []'));
    expect(fibBlock).toContain('lineStyle: LineStyle.Solid');
    expect(fibBlock).toContain('lineWidth: 1');
    expect(s).toMatch(/FIB \$\{\(level\.ratio \* 100\)\.toFixed\(1\)\}%/);
  });

  it('nível com confluência real (score>0) é mais presente — hierarquia por opacidade, nunca por tracejado', () => {
    const s = chart();
    expect(s).toContain('level.score > 0 ? "rgba(0, 240, 255, 0.55)" : "rgba(0, 240, 255, 0.20)"');
    expect(s).not.toMatch(/LineStyle\.(Dashed|Dotted|LargeDashed|SparseDotted)/);
  });

  it('VolumeProfilePlugin montado com chart/série reais (nunca null fabricado por padrão)', () => {
    const s = chart();
    expect(s).toContain('<VolumeProfilePlugin');
    expect(s).toMatch(/VolumeProfilePlugin[\s\S]{0,120}chart=\{chartReady\?\.chart \?\? null\}/);
  });

  it('price lines FIB são limpas na desmontagem (fibLinesRef zerado junto dos demais)', () => {
    expect(chart()).toContain('fibLinesRef.current = [];');
  });
});

describe('EnhancedChart: linha de CVD real (fechamento do §3.1) — série nativa em escala própria', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('série LineSeries em priceScaleId "cvd" (nunca a escala das velas — CVD é volume assinado, não preço)', () => {
    const s = chart();
    expect(s).toContain('chart.addSeries(LineSeries, {');
    expect(s).toContain('priceScaleId: "cvd"');
    expect(s).toContain('chart.priceScale("cvd")');
  });

  it('fio de seda: lineWidth 1 e LineStyle.Solid na série de CVD', () => {
    const s = chart();
    const cvdBlock = s.slice(s.indexOf('chart.addSeries(LineSeries'), s.indexOf('cvdSeriesRef.current = cvdSeries'));
    expect(cvdBlock).toContain('lineWidth: 1');
    expect(cvdBlock).toContain('lineStyle: LineStyle.Solid');
  });

  it('alimentada pelo orderflowHistory REAL da store (useOrderflowHistory) — zero segunda coleta', () => {
    const s = chart();
    expect(s).toContain('useOrderflowHistory()');
    expect(s).toMatch(/Math\.floor\(entry\.time \/ 1000\)/); // ms reais → segundos da lib
  });

  it('ref da série zerada na desmontagem junto das demais', () => {
    expect(chart()).toContain('cvdSeriesRef.current = null;');
  });
});

describe('EnhancedChart: correção de latência (patch da vela em formação) isolada do recomputo de data', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('usa a função pura patchLastCandleWithLiveTick (fail-closed), nunca uma segunda regra de fusão inline', () => {
    const s = chart();
    expect(s).toContain('import { patchLastCandleWithLiveTick } from "../nexus/live-candle-sync"');
    expect(s).toContain('patchLastCandleWithLiveTick(data[data.length - 1], activeTimeframe, livePrice)');
  });

  it('aplica o patch via series.update() — nunca via setData() (setData recomputaria o zoom/pan e é custoso a cada tick)', () => {
    const s = chart();
    const liveBlock = s.slice(s.indexOf('patchLastCandleWithLiveTick('), s.indexOf('}, [livePrice, activeTimeframe, data]);'));
    expect(liveBlock).toContain('seriesRef.current.update(');
    expect(liveBlock).not.toContain('.setData(');
  });

  it('o efeito de live-tick é um useEffect PRÓPRIO, nunca reaproveita as deps do efeito de setData(formatted)', () => {
    const s = chart();
    expect(s).toContain('}, [livePrice, activeTimeframe, data]);');
    // o efeito original (setData) continua existindo, com suas próprias deps intactas — não foi fundido no novo.
    expect(s).toContain('seriesRef.current.setData(formatted);\n  }, [data]);');
  });

  it('livePrice/activeTimeframe são props opcionais — um chamador que ainda não os passa nunca quebra', () => {
    const s = chart();
    expect(s).toContain('livePrice?: number | null;');
    expect(s).toContain('activeTimeframe?: Timeframe;');
  });
});
