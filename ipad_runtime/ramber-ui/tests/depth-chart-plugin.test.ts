// depth-chart-plugin.test.ts — Falha #3 (AR10_AUDITORIA_ECOSSISTEMA.md /
// AR10_ORDEM_POS_AUDITORIA.md): DepthChartPlugin era o outro dos 2 únicos
// plugins de 15 sem teste de padrão no código-fonte — e foi EDITADO nesta
// mesma sessão (etiqueta WALL BID/ASK passa a reusar canvas-palette.ts) sem
// essa rede de segurança. Mesmo padrão dos outros 13 plugins de teste.
// Não testa o motor puro (detectWalls já coberto por order-book-depth.test.ts)
// — só a fiação: import, montagem, CHART_LAYER_IDS, visibility gate, cores.
import { describe, it, expect } from 'vitest';
import { resolveWallLabels, MAX_WALL_LABELS } from '../src/chart/DepthChartPlugin';
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
    // Achado 3.2: este teste travava a POSIÇÃO ERRADA. A asserção anterior era
    // `drawCanvasLabel(ctx, laneRight - w - size.width - 4, ...)` — à esquerda
    // da barra, isto é, para dentro da área dos candles. As 2 capturas ao vivo
    // do Operador mostraram o efeito: caixas largas atravessando a ação do
    // preço. O x agora é ancorado na própria lane (ver o describe do Achado
    // 3.2 no fim deste arquivo); a cor da etiqueta, que é o que ESTE teste
    // existe para travar, segue exatamente igual.
    expect(s).toContain('const WALL_BORDER = "rgba(240, 193, 111, 0.9)";');
    expect(s).toContain('ctx.strokeStyle = WALL_BORDER;');
  });

  it('task #285: etiqueta WALL carrega o preço real do nível (fmtWallPrice), nunca só o lado — mesmo gap de classe já fechado para POC/VAH/VAL/IB (task #341)', () => {
    const s = src();
    expect(s).toContain('const text = `WALL ${sideLabel} ${fmtWallPrice(lvl.price)}`;');
    const fnMatch = s.match(/function fmtWallPrice\(v: number\): string \{([\s\S]*?)\n\}/);
    expect(fnMatch, 'fmtWallPrice não encontrada').not.toBeNull();
    // Mesma regra de fmtAxisLabelPrice (EnhancedChart_110_Percent.tsx):
    // preço >= 1000 vira inteiro (BTC/ETH), senão 2 casas com ".00" podado.
    // Duplicada aqui de propósito (nunca importada) — aquele arquivo já
    // importa DepthChartPlugin, o sentido contrário criaria um ciclo real.
    expect(fnMatch![1]).toContain('if (v >= 1000) return v.toFixed(0);');
    expect(fnMatch![1]).toContain('return withDecimals.endsWith(".00") ? v.toFixed(0) : withDecimals;');
    expect(s).not.toMatch(/import \{[^}]*fmtAxisLabelPrice[^}]*\} from "\.\/EnhancedChart_110_Percent"/);
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

// Achado 3.2 — DUAS capturas reais do terminal ao vivo (BTC/USDT 1H e 15m)
// enviadas pelo Operador. Nenhum teste ou auditoria anterior pegou os 2 bugs
// abaixo porque ambos só aparecem com LIVRO REAL conectado, e o ambiente de
// desenvolvimento desta sessão não alcança a Binance. Execução real das
// funções puras (CLAUDE.md: a matemática de fronteira é o que pode estar
// sutilmente errado aqui, não a fiação).
describe('Achado 3.2: resolveWallLabels — dedup + anti-colisão + teto (execução real)', () => {
  const mk = (text: string, y: number, size: number, height = 13) => ({ text, y, size, height, fill: 'x' });

  it('BUG DA CAPTURA: dois níveis que arredondam para o mesmo preço viram UMA etiqueta — na captura de 15m "WALL BID 63570" aparecia literalmente duas vezes', () => {
    const out = resolveWallLabels([mk('WALL BID 63570', 100, 5), mk('WALL BID 63570', 103, 9)]);
    expect(out).toHaveLength(1);
    expect(out[0].size).toBe(9); // vence o nível mais FORTE, nunca o primeiro da lista
  });

  it('BUG DA CAPTURA: etiquetas de lados OPOSTOS no mesmo preço também colidiam — a competição é global, nunca por lado', () => {
    const out = resolveWallLabels([mk('WALL BID 63570', 200, 4), mk('WALL ASK 63570', 202, 8)]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('WALL ASK 63570');
  });

  it('anti-colisão vertical real: candidata que encostaria numa já aceita é descartada, mesmo com texto diferente', () => {
    const out = resolveWallLabels([mk('WALL BID 63570', 100, 10), mk('WALL BID 63566', 105, 3)]);
    expect(out).toHaveLength(1); // 5px de distância < (13+13)/2 + 2
  });

  it('níveis longe o suficiente coexistem — o filtro nunca esconde wall real que caberia na tela', () => {
    const out = resolveWallLabels([mk('WALL BID 63570', 100, 10), mk('WALL ASK 63700', 160, 8)]);
    expect(out).toHaveLength(2);
  });

  it('teto real de MAX_WALL_LABELS — livro com muitas walls não vira parede de texto', () => {
    const many = Array.from({ length: 12 }, (_, i) => mk(`WALL BID ${63000 + i * 10}`, i * 40, 20 - i));
    const out = resolveWallLabels(many);
    expect(out).toHaveLength(MAX_WALL_LABELS);
    // e as escolhidas são as mais fortes, em ordem decrescente de força
    expect(out.map((o) => o.size)).toEqual([20, 19, 18]);
  });

  it('fail-closed: lista vazia entra, lista vazia sai (nunca uma etiqueta fabricada)', () => {
    expect(resolveWallLabels([])).toEqual([]);
  });

  it('ordem de vitória é sempre a FORÇA real do nível do livro, nunca a ordem de chegada', () => {
    const out = resolveWallLabels([mk('a', 0, 1), mk('b', 100, 99), mk('c', 200, 50)], 2);
    expect(out.map((o) => o.text)).toEqual(['b', 'c']);
  });
});

describe('Achado 3.2: a etiqueta nunca sai da própria lane (padrão de código)', () => {
  const src = () => readFileSync(resolve(here, '../src/chart/DepthChartPlugin.tsx'), 'utf8');

  it('x ancorado em laneRight — nunca mais `laneRight - w - size.width` (era isso que jogava a caixa sobre os candles nas 2 capturas)', () => {
    const s = src();
    expect(s).toContain('drawCanvasLabel(ctx, laneRight - size.width - 2, c.y - c.height / 2,');
    expect(s).not.toContain('laneRight - w - size.width - 4');
  });

  it('o desenho passa pelo resolvedor — nenhuma etiqueta desenhada direto dentro do forEach de níveis', () => {
    const s = src();
    expect(s).toContain('for (const c of resolveWallLabels(wallCandidates)) {');
    expect(s).toContain('wallCandidates.push({ text, y, size: lvl.size, height: size.height, fill: labelFill });');
  });

  it('Regra de Ouro 4: o CONTORNO de destaque continua em toda wall real — só a etiqueta de texto foi filtrada, zero dado escondido', () => {
    const s = src();
    expect(s).toContain('ctx.strokeStyle = WALL_BORDER;');
    const strokeIdx = s.indexOf('ctx.strokeRect(laneRight - w + 0.5');
    const pushIdx = s.indexOf('wallCandidates.push(');
    expect(strokeIdx).toBeGreaterThan(-1);
    expect(pushIdx).toBeGreaterThan(strokeIdx); // contorno desenhado ANTES de a etiqueta sequer competir
  });
});
