// horizontal-level-lines-plugin.test.ts — GRADUAÇÃO (2026-09-07): trava as
// invariantes reais de HorizontalLevelLinesPlugin.tsx por padrão de código
// (mesma convenção de StructureTracePlugin/ConfidenceDirectionArrowPlugin —
// nenhum dos dois tem suíte própria porque não há infraestrutura de DOM/
// canvas real neste projeto; o desenho em si depende de HTMLCanvasElement/
// ResizeObserver reais, que só existem no navegador — verificado ao vivo via
// Playwright, não aqui). O que importa travar aqui é o CONTRATO: fail-closed
// sobre preço não-finito, largura total real, "Fio de Seda" (nunca
// setLineDash), 1px sempre.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = () => readFileSync(resolve(__dirname, "../src/chart/HorizontalLevelLinesPlugin.tsx"), "utf-8");

describe("HorizontalLevelLinesPlugin: contrato real de desenho", () => {
  it("fail-closed: preço não-finito nunca vira uma linha desenhada (Regra de Ouro 3)", () => {
    expect(src()).toContain("if (!Number.isFinite(level.price)) continue;");
  });

  it("fail-closed: y fora da faixa de preço visível (priceToCoordinate null) nunca extrapola (Regra de Ouro 3)", () => {
    expect(src()).toContain("if (y === null) continue;");
  });

  it('"Fio de Seda" (Regra de Ouro 5): 1px sólido, zero setLineDash em todo o arquivo', () => {
    const s = src();
    expect(s).toContain("ctx.lineWidth = 1;");
    expect(s).not.toMatch(/setLineDash/);
  });

  it("largura TOTAL continua sendo o PADRÃO — quem não entrega toques desenha de ponta a ponta", () => {
    // Atualizado na GRADUAÇÃO §4: o traço deixou de ser incondicionalmente
    // `0 → cssWidth` e passou a ser o VALOR INICIAL, sobrescrito só quando
    // o chamador entrega evidência de toque. Os 3 consumidores originais
    // (premium_discount/scenario_projection/pivot_points) não entregam
    // nada, então continuam byte a byte como antes — que é o comportamento
    // correto para eles (pivô/faixa/projeção valem para a janela inteira).
    const s = src();
    expect(s).toContain("let x1 = 0;");
    expect(s).toContain("let x2 = cssWidth;");
    expect(s).toContain("ctx.moveTo(x1, yCrisp);");
    expect(s).toContain("ctx.lineTo(x2, yCrisp);");
  });

  it("o modo TRECHO é opt-in por evidência real — nunca liga sozinho", () => {
    const s = src();
    // Só entra em modo trecho com (a) índices de toque reais E (b) candles
    // para traduzi-los em X. Faltando qualquer um, cai na largura total.
    expect(s).toContain("resolveLevelTouchWindow(level.touchIndices)");
    expect(s).toContain("if (window && seriesCandles && seriesCandles.length > 0)");
    // A geometria do trecho é a que já existe para EQH/EQL, nunca uma
    // segunda implementação da mesma conta.
    expect(s).toContain("resolveEqualLevelSegment(xFirst, xLast, cssWidth)");
  });

  it("mesma arquitetura de canvas dos irmãos: dirty-flag + rAF, ResizeObserver, subscribeVisibleLogicalRangeChange", () => {
    const s = src();
    expect(s).toContain("requestAnimationFrame(() => {");
    expect(s).toContain("new ResizeObserver(");
    expect(s).toContain("chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);");
    expect(s).toContain("chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);");
  });

  it("z-index computado por getChartLayerZIndex(layerId) DENTRO do próprio plugin — mesmo padrão de todo canvas irmão, travado por chart-layer-depth.test.ts (FIAÇÃO: todo plugin consome a profundidade)", () => {
    const s = src();
    expect(s).toContain('import { getChartLayerZIndex } from "./chart-layer-depth";');
    expect(s).toMatch(/zIndex:\s*getChartLayerZIndex\(layerId\)/);
    expect(s).not.toMatch(/zIndex:\s*\d/);
  });

  it("nunca desenha texto (as 3 fontes originais eram axisLabelVisible:false — nenhum rótulo novo)", () => {
    const s = src();
    expect(s).not.toMatch(/fillText|strokeText/);
  });
});
