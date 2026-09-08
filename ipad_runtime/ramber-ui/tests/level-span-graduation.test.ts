// level-span-graduation.test.ts — fiação da GRADUAÇÃO §4 ("as linhas não
// devem atravessar o gráfico inteiro").
//
// Padrão-no-código-fonte de propósito (convenção do CLAUDE.md): a
// matemática de QUAIS toques entram já tem execução real em
// level-touch-window.test.ts. O bug provável AQUI é o outro: "esqueceram
// de ligar A com B" — o motor devolver os índices e ninguém os repassar,
// ou S1/R1 continuar em createPriceLine nativo.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getChartLayerZIndex, getChartLayerTier } from "../src/chart/chart-layer-depth";

const here = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(resolve(here, "../src", p), "utf8");
const engine = readFileSync(
  resolve(here, "../../src/research/engines/support-resistance-engine.js"),
  "utf8",
);

describe("o motor para de descartar os índices que sempre teve", () => {
  it("computeLevelStrength devolve touch_indices, e não só o .length", () => {
    expect(engine).toContain("touch_indices:");
    // O defeito exato: contar e jogar os objetos fora na mesma linha.
    expect(engine).not.toContain(".filter((s) => Math.abs(s.price - levelPrice) <= band).length");
  });

  it("touches continua sendo a MESMA contagem de antes (zero matemática nova)", () => {
    expect(engine).toContain("const touches = touching.length;");
    expect(engine).toContain("touches >= STRONG_TOUCH_THRESHOLD ? 'FORTE' : 'FRACA'");
  });

  it("os índices saem em ordem crescente — uma janela de 'recentes' exige tempo", () => {
    expect(engine).toContain("touching.map((s) => s.index).sort((a, b) => a - b)");
  });
});

describe("a ponte traduz snake→camel na MESMA fronteira que já fazia isso", () => {
  const bridge = src("engine-bridge.ts");

  it("readLevelStrength existe e é quem alimenta support/resistanceStrength", () => {
    expect(bridge).toContain("function readLevelStrength(");
    expect(bridge).toContain("supportStrength: readLevelStrength(frame.support_1_strength)");
    expect(bridge).toContain("resistanceStrength: readLevelStrength(frame.resistance_1_strength)");
  });

  it("fail-closed: índice não-inteiro ou negativo nunca vira posição de traço", () => {
    expect(bridge).toContain("Number.isInteger(i) && i >= 0");
  });
});

describe("S1/R1 saíram da price line nativa — a primitiva que causava o defeito", () => {
  const chart = src("chart/EnhancedChart_110_Percent.tsx");

  it("nenhum createPriceLine sobrou para support/resistance", () => {
    expect(chart).not.toContain("supportLineRef");
    expect(chart.includes("resistanceLineRef.current =")).toBe(false);
  });

  it("as duas passam pelo plugin de canvas, com os toques reais", () => {
    expect(chart).toContain("const supportResistanceLevels = useMemo<HorizontalLevel[]>");
    expect(chart).toContain("touchIndices: supportStrength?.touchIndices");
    expect(chart).toContain("touchIndices: resistanceStrength?.touchIndices");
    expect(chart).toContain('layerId="support_resistance"');
    // Sem candles o plugin não consegue traduzir índice → x, e cairia de
    // volta na largura total sem ninguém perceber.
    expect(chart).toContain("candles={data}");
  });

  it("Regra de Ouro 4: cor e alpha reais preservados byte a byte", () => {
    // O âmbar da Especificação Visual Profissional v1 e o alpha do
    // orçamento visual continuam exatamente os de antes da migração.
    //
    // São 4 ocorrências, não 2, e isso é CORRETO: a LINHA (2, no memo
    // migrado) e a ETIQUETA do eixo (2, no PriceLabelStackPlugin) usam
    // deliberadamente a mesma expressão de cor — é o que faz o rótulo
    // pertencer visualmente ao traço que ele nomeia. Travar em 2 aqui
    // esconderia justamente essa coerência.
    const ocorrencias = chart.match(
      /rgba\(245, 158, 11, \$\{levelLineAlpha\((support|resistance)VisualWeight\)\.toFixed\(3\)\}\)/g,
    );
    expect(ocorrencias).toHaveLength(4);
  });

  it("Regra de Ouro 4: o rótulo real de S1/R1 (levelTitle) continua no eixo", () => {
    // levelTitle nunca foi visível na price line (axisLabelVisible:false);
    // quem o mostra é o PriceLabelStackPlugin, e isso NÃO pode ter sumido
    // junto com a migração.
    expect(chart).toContain('levelTitle("", supportStrength, supportBreakouts)');
    expect(chart).toContain('levelTitle("", resistanceStrength, resistanceBreakouts)');
  });
});

describe("o plugin desenha trecho SÓ quando há evidência — nunca por padrão", () => {
  const plugin = src("chart/HorizontalLevelLinesPlugin.tsx");

  it("reusa a geometria que já existe, nunca uma segunda implementação", () => {
    expect(plugin).toContain('from "./equal-level-span"');
    expect(plugin).toContain('from "./level-touch-window"');
    // A conta de trecho/piso/recorte NÃO se reescreve aqui.
    expect(plugin).not.toContain("EQUAL_LEVEL_MIN_SEGMENT_PX =");
  });

  it("sem touchIndices o desenho é a largura total de sempre (3 consumidores originais intactos)", () => {
    expect(plugin).toContain("let x1 = 0;");
    expect(plugin).toContain("let x2 = cssWidth;");
  });

  it("Fio de Seda (Regra de Ouro 5): 1px sólida, zero tracejado", () => {
    expect(plugin).toContain("ctx.lineWidth = 1;");
    expect(plugin).not.toContain("setLineDash");
  });
});

describe("profundidade declarada da camada nova", () => {
  it("support_resistance é 'line' — preenchimento por cima apagaria o traço", () => {
    expect(getChartLayerTier("support_resistance")).toBe("line");
  });

  it("fica acima das camadas que PINTAM ÁREA", () => {
    for (const zona of ["liquidity_zones", "institutional_zones", "ichimoku"]) {
      expect(getChartLayerZIndex("support_resistance")).toBeGreaterThan(getChartLayerZIndex(zona));
    }
  });

  it("no MESMO nível das irmãs de linha — hierarquia coerente, não um caso especial", () => {
    for (const irma of ["session_key_levels", "equal_highs_lows", "pivot_points"]) {
      expect(getChartLayerZIndex("support_resistance")).toBe(getChartLayerZIndex(irma));
    }
  });
});
