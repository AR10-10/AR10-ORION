// delta-divergence-plugin-label-language-font.test.ts — Frente 2 §17/§14
// (auditoria de labels/fontes do gráfico): DeltaDivergencePlugin.tsx tinha
// dois achados reais isolados, ambos corrigidos nesta rodada:
//
//   1. O único rótulo em português ainda desenhado direto no canvas
//      ("DIV · EXAUSTÃO COMPRADORA/VENDEDORA") — todo o resto do sistema de
//      rótulos de canvas migrou pra English Technical antes desta rodada.
//   2. O único ctx.font hardcoded ("10px ui-monospace, monospace") que não
//      acompanhava a largura real do viewport — os outros 7/7 usos de
//      ctx.font em chart/*.tsx (auditados) já roteiam por
//      activeCanvasLabelFont()/resolveCanvasLabelFontPx (canvas-label.ts),
//      9-11px conforme a tela.
//
// Trava por padrão de código (canvas não é montável neste repo).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const plugin = readFileSync(resolve(__dirname, "../src/chart/DeltaDivergencePlugin.tsx"), "utf8");

describe("DeltaDivergencePlugin: rótulo do canvas traduzido pra English Technical", () => {
  it("nenhum texto em português sobrevive no rótulo desenhado", () => {
    expect(plugin).not.toContain("EXAUSTÃO COMPRADORA");
    expect(plugin).not.toContain("EXAUSTÃO VENDEDORA");
  });

  it("o novo texto preserva o prefixo DIV · e o sentido bullish/bearish, só em inglês", () => {
    expect(plugin).toContain('"DIV · BUYER EXHAUSTION"');
    expect(plugin).toContain('"DIV · SELLER EXHAUSTION"');
  });
});

describe("DeltaDivergencePlugin: fonte do rótulo passa a acompanhar a tela real, como o resto de chart/*.tsx", () => {
  it("importa e usa activeCanvasLabelFont() em vez do 10px congelado", () => {
    expect(plugin).toContain('import { activeCanvasLabelFont } from "../nexus/canvas-label";');
    expect(plugin).toContain("ctx.font = activeCanvasLabelFont();");
    expect(plugin).not.toContain('ctx.font = "10px ui-monospace, monospace"');
  });
});
