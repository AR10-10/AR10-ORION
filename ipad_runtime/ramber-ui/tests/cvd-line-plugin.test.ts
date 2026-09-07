// cvd-line-plugin.test.ts — GRADUAÇÃO (2026-09-07): trava as invariantes
// reais de CvdLinePlugin.tsx por padrão de código (mesma convenção de
// StructureTracePlugin/SupertrendPlugin/HorizontalLevelLinesPlugin — nenhum
// tem suíte própria com DOM real porque não há infraestrutura de canvas real
// neste projeto; verificado ao vivo via Playwright, não aqui). O que importa
// travar aqui é o CONTRATO: fail-closed sobre coordenada não resolvida, "Fio
// de Seda" (nunca setLineDash), 1px sempre, e a MESMA série nativa (nunca
// uma segunda) usada só pela conversão de coordenada da escala 'cvd'.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = () => readFileSync(resolve(__dirname, "../src/chart/CvdLinePlugin.tsx"), "utf-8");

describe("CvdLinePlugin: contrato real de desenho", () => {
  it("fail-closed: x ou y não resolvido (fora da janela real) nunca extrapola nem reconecta através do gap", () => {
    const s = src();
    expect(s).toContain("if (x === null || y === null) {");
    expect(s).toContain("started = false;");
  });

  it("fail-closed: histórico vazio não desenha nada", () => {
    expect(src()).toContain("if (pointsRef.current.length === 0) return;");
  });

  it('"Fio de Seda" (Regra de Ouro 5): 1px sólido, zero setLineDash executável em todo o arquivo', () => {
    const s = src();
    expect(s).toContain("ctx.lineWidth = 1;");
    expect(s).not.toMatch(/\.setLineDash\(/);
  });

  it("mesma arquitetura de canvas dos irmãos: dirty-flag + rAF, ResizeObserver, subscribeVisibleLogicalRangeChange, limpeza no unmount", () => {
    const s = src();
    expect(s).toContain("requestAnimationFrame(() => {");
    expect(s).toContain("new ResizeObserver(");
    expect(s).toContain("chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);");
    expect(s).toContain("chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);");
    expect(s).toContain("resizeObserver.disconnect();");
  });

  it("z-index computado por getChartLayerZIndex(\"cvd\") DENTRO do próprio plugin — mesmo padrão de todo canvas irmão", () => {
    const s = src();
    expect(s).toContain('import { getChartLayerZIndex } from "./chart-layer-depth";');
    expect(s).toMatch(/zIndex:\s*getChartLayerZIndex\("cvd"\)/);
    expect(s).not.toMatch(/zIndex:\s*\d/);
  });

  it("a conversão de coordenada usa scaleSeries.priceToCoordinate — nunca calcula a escala 'cvd' do zero (zero segunda matemática)", () => {
    const s = src();
    expect(s).toContain("scaleSeries.priceToCoordinate(point.value)");
    // Nenhuma segunda série/escala criada aqui — o plugin recebe a série
    // nativa já existente como prop, nunca chama addSeries/priceScale.
    expect(s).not.toMatch(/addSeries|priceScale\(/);
  });

  it("nunca desenha texto — o traço é a única informação, mesma cor de sempre preservada byte a byte", () => {
    const s = src();
    expect(s).not.toMatch(/fillText|strokeText/);
    expect(s).toContain('const CVD_COLOR = "rgba(138, 180, 248, 0.85)";');
  });
});
