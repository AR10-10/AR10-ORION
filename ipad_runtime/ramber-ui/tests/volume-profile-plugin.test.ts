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
