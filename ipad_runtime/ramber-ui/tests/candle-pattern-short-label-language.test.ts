// candle-pattern-short-label-language.test.ts — Frente 2 §17/§14 (auditoria
// de labels do gráfico): a tabela SHORT_LABEL de CandlePatternMarkersPlugin.tsx
// derivava 6 das 15 siglas do NOME EM PORTUGUÊS do padrão (NUV="Nuvem",
// EST="Estrela" x2, MAR="Martelo", ENF="Enforcado", ESC="Estrela cadente",
// MRI="Martelo invertido"), enquanto as outras 9 sempre derivaram da
// constante em inglês (ENGULFING→ENG, HARAMI→HAR, etc.) — inconsistência de
// idioma achada só nesta auditoria, porque o resultado (3 letras maiúsculas)
// não denuncia a diferença a olho nu. Trava por padrão de código (mesma
// disciplina do resto do repo para tabelas de apresentação em App.tsx/chart).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const plugin = readFileSync(resolve(__dirname, "../src/chart/CandlePatternMarkersPlugin.tsx"), "utf8");

describe("SHORT_LABEL: as 6 siglas de origem portuguesa migraram para derivação em inglês", () => {
  it("nenhuma sigla derivada do nome em português sobrevive", () => {
    for (const antiga of ['"NUV"', '"MAR"', '"ENF"', '"ESC"', '"MRI"']) {
      expect(plugin).not.toContain(antiga);
    }
  });

  it("as novas siglas derivam da MESMA constante em inglês do padrão, mesma disciplina das 9 que já eram corretas", () => {
    expect(plugin).toContain('DARK_CLOUD: "DCC"');
    expect(plugin).toContain('HAMMER: "HMR"');
    expect(plugin).toContain('HANGING_MAN: "HNM"');
    expect(plugin).toContain('SHOOTING_STAR: "SST"');
    expect(plugin).toContain('INVERTED_HAMMER: "IHM"');
  });
});

describe("MORNING_STAR e EVENING_STAR (viés OPOSTO) não colapsam mais para a mesma sigla 'EST'", () => {
  it("cada um tem sua própria sigla de 3 letras, distinguível pelo próprio texto — não só por cor/posição", () => {
    expect(plugin).toContain('MORNING_STAR: "MST"');
    expect(plugin).toContain('EVENING_STAR: "EVS"');
    expect(plugin).not.toMatch(/MORNING_STAR: "EST"/);
    expect(plugin).not.toMatch(/EVENING_STAR: "EST"/);
  });
});

describe("os pares bull/bear que SÃO o mesmo padrão nos dois sentidos continuam com a mesma sigla — nunca virou dois padrões diferentes", () => {
  it("ENGULFING (viés distinguido por cor/posição, não pelo texto — mesmo padrão real)", () => {
    expect(plugin).toContain('BULLISH_ENGULFING: "ENG"');
    expect(plugin).toContain('BEARISH_ENGULFING: "ENG"');
  });

  it("HARAMI e MARUBOZU seguem a mesma regra", () => {
    expect(plugin).toContain('BULLISH_HARAMI: "HAR"');
    expect(plugin).toContain('BEARISH_HARAMI: "HAR"');
    expect(plugin).toContain('MARUBOZU_BULL: "MBZ"');
    expect(plugin).toContain('MARUBOZU_BEAR: "MBZ"');
  });
});
