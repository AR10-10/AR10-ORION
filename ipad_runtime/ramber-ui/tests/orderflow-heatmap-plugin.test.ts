// orderflow-heatmap-plugin.test.ts — V-MAX Fase 1.2: trava o
// OrderFlowHeatmapPlugin no nível de código-fonte, mesmo padrão já
// estabelecido em liquidity-zones-plugin.test.ts (lib de canvas real, sem
// DOM/canvas real neste ambiente de teste 'node' — padrão no código,
// verificação visual real feita à parte via harness Playwright).
import { describe, it, expect } from 'vitest';
import { getChartLayerZIndex, CHART_NATIVE_CANVAS_Z_INDEX } from '../src/chart/chart-layer-depth';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const plugin = read('../src/chart/OrderFlowHeatmapPlugin.tsx');
const worker = read('../src/workers/orderflow-heatmap-worker.ts');

describe('OrderFlowHeatmapPlugin: lê l2History/orderflowHistory direto da store (nunca prop-drilling, nunca uma segunda fonte)', () => {
  it('usa os hooks reais useL2History/useOrderflowHistory já travados por teste na store', () => {
    expect(plugin).toContain('useL2History("BINANCE")');
    expect(plugin).toContain('useOrderflowHistory()');
  });
});

describe('OrderFlowHeatmapPlugin: geometria real via lightweight-charts, Fail-Closed igual ao LiquidityZonesPlugin', () => {
  it('resolve preço→pixel e tempo→pixel via priceToCoordinate/timeToCoordinate reais da própria lib', () => {
    expect(plugin).toContain('series.priceToCoordinate(');
    expect(plugin).toContain('timeScale.timeToCoordinate(');
  });

  it('amostra fora da janela visível (coordenada null) nunca é desenhada — nunca extrapolada', () => {
    expect(plugin).toMatch(/if \(x1 === null\) continue;/);
    expect(plugin).toMatch(/if \(y === null\) continue;/);
    expect(plugin).toMatch(/if \(x === null \|\| y === null\) continue;/);
  });

  it('nunca usa Math.random nem qualquer dado sintético (Regra de Ouro 1)', () => {
    expect(plugin).not.toMatch(/Math\.random/);
    expect(worker).not.toMatch(/Math\.random/);
  });

  it('alpha/raio vêm das funções reais computeCellAlpha/computeBubbleRadius, nunca um número mágico solto no componente', () => {
    expect(plugin).toContain('computeCellAlpha(');
    expect(plugin).toContain('computeBubbleRadius(');
  });
});

describe('OrderFlowHeatmapPlugin: ciclo de vida real (Diretriz Final de Lapidação Visual, Partes 3/4) — sem corte abrupto na evicção do ring buffer', () => {
  it('pondera cada célula/bolha pela posição real no ring buffer via computeRecencyWeight, nunca um segundo cálculo de idade', () => {
    expect(plugin).toContain('computeRecencyWeight(');
    expect(plugin).toMatch(/computeCellAlpha\(lvl\.size, maxBid\) \* recency/);
    expect(plugin).toMatch(/computeCellAlpha\(lvl\.size, maxAsk\) \* recency/);
  });

  it('itera l2/orderflowHistory por índice (não for..of puro) para ter a posição real no buffer disponível', () => {
    expect(plugin).toMatch(/for \(let i = 0; i < l2\.length; i\+\+\)/);
    expect(plugin).toMatch(/for \(let i = 0; i < of\.length; i\+\+\)/);
  });
});

describe('OrderFlowHeatmapPlugin: "Fio de Seda" também vale para bolhas em Canvas 2D (Regra de Ouro 2)', () => {
  it('a primitiva de desenho compartilhada nunca chama setLineDash', () => {
    const draw = read('../src/nexus/orderflow-heatmap-draw.ts');
    expect(draw).not.toMatch(/\.setLineDash\(/);
    expect(draw).toContain('ctx.lineWidth = 1;');
  });
});

describe('OrderFlowHeatmapPlugin: dirty-flag + requestAnimationFrame, nunca um loop perpétuo (Blueprint §3.2)', () => {
  it('agenda redraw via requestAnimationFrame, guardado por uma flag', () => {
    expect(plugin).toContain('requestAnimationFrame(');
    expect(plugin).toMatch(/if \(rafScheduled\) return;/);
  });

  it('reage a mudança de range visível (pan/zoom) via subscribeVisibleLogicalRangeChange real da lib', () => {
    expect(plugin).toContain('subscribeVisibleLogicalRangeChange(');
  });

  it('acompanha o tamanho real dos canvases via ResizeObserver, nunca um listener de resize próprio', () => {
    expect(plugin).toContain('new ResizeObserver(');
  });

  it('desmonta limpo: cancela a assinatura de range, desconecta o ResizeObserver e termina o Worker (evita leaks)', () => {
    expect(plugin).toContain('unsubscribeVisibleLogicalRangeChange(');
    expect(plugin).toContain('resizeObserver.disconnect()');
    expect(plugin).toContain('worker?.terminate()');
  });
});

describe('OrderFlowHeatmapPlugin: OffscreenCanvas + fallback via handshake real, nunca uma suposição de suporte (Blueprint §3.2)', () => {
  it('feature-detecta transferControlToOffscreen + Worker antes de tentar qualquer coisa', () => {
    expect(plugin).toContain('transferControlToOffscreen');
    expect(plugin).toMatch(/typeof Worker !== "undefined"/);
  });

  it('só confia no caminho OffscreenCanvas depois de um handshake real (ready/ok) do Worker, com timeout honesto', () => {
    expect(plugin).toContain('HANDOFF_TIMEOUT_MS');
    expect(plugin).toContain('ev.data?.type === "ready"');
    expect(plugin).toContain('ev.data.ok');
  });

  it('falha/timeout do handshake cai para o fallback main-thread — nunca fica sem heatmap', () => {
    expect(plugin).toMatch(/setMode\("main"\)/);
    expect(plugin).toMatch(/resolve\(false\)/);
  });

  it('nunca recria o Worker por causa da própria decisão de modo — efeito de setup não depende de `mode`', () => {
    expect(plugin).toMatch(/\}, \[chart, series\]\);/);
    expect(plugin).not.toMatch(/\}, \[chart, series, mode\]\);/);
  });

  it('o Worker real só executa desenho — nunca chama timeToCoordinate/priceToCoordinate (esse estado não existe lá)', () => {
    expect(worker).not.toContain('timeToCoordinate');
    expect(worker).not.toContain('priceToCoordinate');
    expect(worker).toContain('drawHeatmapFrame(');
  });

  it('o Worker reporta o resultado REAL de getContext("2d") — nunca assume sucesso', () => {
    expect(worker).toContain('canvas.getContext("2d")');
    expect(worker).toContain('post({ type: "ready", ok: !!ctx });');
  });
});

describe('EnhancedChart_110_Percent: monta o heatmap ANTES do container do chart (atrás das velas, fundo transparent)', () => {
  // ESTE TESTE MUDOU DE MECANISMO, NÃO DE INTENÇÃO.
  //
  // Ele afirmava "atrás das velas" travando a ORDEM DE DOM (heatmap montado
  // antes do container). Isso era o único controle disponível quando foi
  // escrito — e é exatamente o defeito que chart-layer-depth.ts existe para
  // acabar: empilhamento por ordem acidental de montagem, que muda se alguém
  // reordenar o JSX.
  //
  // Agora o container do chart tem z-index EXPLÍCITO
  // (CHART_NATIVE_CANVAS_Z_INDEX) e o heatmap é do nível CAMPO. "Atrás das
  // velas" passa a ser uma consequência da profundidade DECLARADA, que a
  // ordem do JSX não consegue mais quebrar. Invariante mais forte, não mais
  // fraco: o teste antigo passaria com o z-index errado, este não.
  it('monta OrderFlowHeatmapPlugin e fica atrás das velas pela PROFUNDIDADE declarada, não pela ordem do JSX', () => {
    const chartFile = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chartFile).toContain('import { OrderFlowHeatmapPlugin } from "./OrderFlowHeatmapPlugin";');
    expect(chartFile.indexOf('<OrderFlowHeatmapPlugin')).toBeGreaterThan(-1);
    expect(getChartLayerZIndex('order_flow_heatmap')).toBeLessThan(CHART_NATIVE_CANVAS_Z_INDEX);
  });

  it('passa chart/série reais (nunca null fabricado por padrão)', () => {
    const chartFile = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chartFile).toContain('chart={chartReady?.chart ?? null}');
    expect(chartFile).toContain('series={chartReady?.series ?? null}');
  });
});
