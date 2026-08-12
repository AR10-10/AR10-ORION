// depth-chart-plugin.test.ts — Falha #3 (AR10_AUDITORIA_ECOSSISTEMA.md /
// AR10_ORDEM_POS_AUDITORIA.md): DepthChartPlugin era o outro dos 2 únicos
// plugins de 15 sem teste de padrão no código-fonte — e foi EDITADO nesta
// mesma sessão (etiqueta WALL BID/ASK passa a reusar canvas-palette.ts) sem
// essa rede de segurança. Mesmo padrão dos outros 13 plugins de teste.
// Não testa o motor puro (detectWalls já coberto por order-book-depth.test.ts)
// — só a fiação: import, montagem, CHART_LAYER_IDS, visibility gate, cores.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('DepthChartPlugin: Fio de Seda + geometria real + dirty-flag (mesmas leis dos outros plugins)', () => {
  const src = () => read('../src/chart/DepthChartPlugin.tsx');

  it('nunca chama setLineDash — a borda de destaque de wall é sólida', () => {
    expect(src()).not.toMatch(/\.setLineDash\(/);
  });

  it('a borda de wall é lineWidth = 1 (fio de seda), nunca maior', () => {
    const s = src();
    expect(s).toContain('ctx.lineWidth = 1');
    expect(s).not.toMatch(/ctx\.lineWidth = [2-9]/);
  });

  it('resolve preço→pixel via series.priceToCoordinate real da lib (nunca pixel fabricado)', () => {
    expect(src()).toContain('series.priceToCoordinate(');
  });

  it('nível fora da área visível nunca é desenhado (Fail-Closed, nunca extrapola)', () => {
    expect(src()).toMatch(/if \(y === null\) return;/);
  });

  it('sem livro real => nada desenhado (nunca um book de exemplo); zero Math.random', () => {
    const s = src();
    expect(s).toMatch(/if \(bids\.length === 0 && asks\.length === 0\) return;/);
    expect(s).not.toMatch(/Math\.random/);
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

  it('lê o dado real da store (useOrderBookSnapshot) — mesmo book que OrderBookWidget desenha, zero segunda assinatura de WebSocket', () => {
    const s = src();
    expect(s).toContain('useOrderBookSnapshot()');
    expect(s).not.toMatch(/fetch\(|new WebSocket\(/);
  });

  it('detecção de wall vem do motor real (detectWalls), nunca uma segunda regra inline', () => {
    const s = src();
    expect(s).toContain('import { detectWalls } from "../nexus/order-book-depth";');
    expect(s).toContain('detectWalls(bids)');
    expect(s).toContain('detectWalls(asks)');
  });

  it('bid/ask reusam o par canônico bullish/bearish (canvas-palette.ts) — achado B12 da auditoria, nunca um 2º par nascido por acidente', () => {
    const s = src();
    expect(s).toContain('import { chartBullishRgba, chartBearishRgba } from "./canvas-palette";');
    expect(s).toContain('const BID_FILL = chartBullishRgba(0.22);');
    expect(s).toContain('const ASK_FILL = chartBearishRgba(0.22);');
  });

  it('etiqueta WALL BID/WALL ASK segue a cor da própria barra que rotula (fix desta sessão) — WALL_BORDER continua só o contorno de destaque, papel diferente de direção', () => {
    const s = src();
    expect(s).toContain('const labelFill = sideLabel === "BID" ? chartBullishRgba(0.85) : chartBearishRgba(0.85);');
    expect(s).toContain('drawCanvasLabel(ctx, cssWidth - w - size.width - 4, y - size.height / 2, { fill: labelFill, text });');
    expect(s).toContain('const WALL_BORDER = "rgba(240, 208, 111, 0.9)";');
    expect(s).toContain('ctx.strokeStyle = WALL_BORDER;');
  });
});

describe('EnhancedChart: DepthChartPlugin montado (CHART_LAYER_IDS + visibilidade padrão + wiring real)', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('CHART_LAYER_IDS + visibilidade padrão + plugin de canvas montado condicionalmente (mesmo padrão de ZigZag/VolumeProfile)', () => {
    const s = chart();
    expect(s).toContain('"order_book_depth",');
    expect(s).toContain('order_book_depth: true,');
    expect(s).toContain('import { DepthChartPlugin } from "./DepthChartPlugin";');
    expect(s).toContain('visibility.order_book_depth && (');
  });

  it('montado com chart/série reais (nunca null fabricado por padrão)', () => {
    const s = chart();
    expect(s).toMatch(/DepthChartPlugin[\s\S]{0,120}chart=\{chartReady\?\.chart \?\? null\}/);
    const start = s.indexOf('<DepthChartPlugin');
    const block = s.slice(start, start + 150);
    expect(block).toContain('series={chartReady?.series ?? null}');
  });
});
