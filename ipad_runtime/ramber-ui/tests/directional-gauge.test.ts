import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  gaugeTrackGeometry,
  computeGaugeReading,
  formatGaugePercent,
  GAUGE_ARC_DEGREES,
  GAUGE_START_DEGREES,
} from "../src/nexus/directional-gauge";
import { computeDirectionalConsensus, type DirectionalSource } from "../src/nexus/directional-consensus";
import { DIRECTION_COLOR } from "../src/nexus/direction-semantics";

const src = (code: string, side: DirectionalSource["side"]): DirectionalSource => ({
  code,
  name: code,
  side,
  measures: "teste",
});

describe("gaugeTrackGeometry — geometria pura de círculo", () => {
  it("a circunferência é a fórmula real de círculo (2πr)", () => {
    const g = gaugeTrackGeometry(40);
    expect(g.circumference).toBeCloseTo(2 * Math.PI * 40, 10);
  });

  it("o comprimento do arco é exatamente a fração de 270/360 da circunferência", () => {
    const g = gaugeTrackGeometry(40);
    expect(g.trackLength).toBeCloseTo(g.circumference * (270 / 360), 10);
    expect(GAUGE_ARC_DEGREES).toBe(270);
  });

  it("a rotação nasce no ângulo documentado (velocímetro real)", () => {
    expect(gaugeTrackGeometry().rotationDegrees).toBe(GAUGE_START_DEGREES);
    expect(GAUGE_START_DEGREES).toBe(-225);
  });

  it("raio diferente escala a circunferência proporcionalmente", () => {
    const pequeno = gaugeTrackGeometry(10);
    const grande = gaugeTrackGeometry(40);
    expect(grande.circumference / pequeno.circumference).toBeCloseTo(4, 10);
  });
});

describe("computeGaugeReading — a MESMA leitura, nunca uma segunda fonte", () => {
  it("consenso 5/7 LONG vira preenchimento de 5/7 do arco, cor de LONG", () => {
    const r = computeDirectionalConsensus("LONG", [
      src("A", "LONG"), src("B", "LONG"), src("C", "LONG"), src("D", "LONG"), src("E", "LONG"),
      src("F", "SHORT"), src("G", "SHORT"),
    ]);
    const g = computeGaugeReading(r);
    expect(g.status).toBe("OK");
    expect(g.side).toBe("LONG");
    expect(g.percent).toBeCloseTo((5 / 7) * 100, 10);
    expect(g.color).toBe(DIRECTION_COLOR.LONG);
    expect(g.geometry.fillLength).toBeCloseTo(g.geometry.trackLength * (5 / 7), 10);
  });

  it("SHORT usa a cor de SHORT, nunca a de LONG (a mesma guarda de inversão importa aqui)", () => {
    const r = computeDirectionalConsensus("SHORT", [src("A", "SHORT"), src("B", "LONG")]);
    const g = computeGaugeReading(r);
    expect(g.color).toBe(DIRECTION_COLOR.SHORT);
    expect(g.color).not.toBe(DIRECTION_COLOR.LONG);
  });

  it("consenso 100% preenche o arco inteiro", () => {
    const r = computeDirectionalConsensus("LONG", [src("A", "LONG"), src("B", "LONG")]);
    const g = computeGaugeReading(r);
    expect(g.percent).toBe(100);
    expect(g.geometry.fillLength).toBeCloseTo(g.geometry.trackLength, 10);
  });

  it("consenso 0% não preenche nada (mas o anel de fundo continua desenhado)", () => {
    const r = computeDirectionalConsensus("LONG", [src("A", "SHORT"), src("B", "SHORT")]);
    const g = computeGaugeReading(r);
    expect(g.percent).toBe(0);
    expect(g.geometry.fillLength).toBe(0);
    expect(g.geometry.trackLength).toBeGreaterThan(0); // o anel de fundo não desaparece
  });

  it("fail-closed: sem Núcleo com direção real, geometria vazia e cor neutra", () => {
    for (const core of [null, "NEUTRO" as const]) {
      const r = computeDirectionalConsensus(core, [src("A", "LONG")]);
      const g = computeGaugeReading(r);
      expect(g.status).toBe("DADOS_INSUFICIENTES");
      expect(g.percent).toBeNull();
      expect(g.geometry.fillLength).toBe(0);
      expect(g.color).toBe(DIRECTION_COLOR.NEUTRO);
    }
  });

  it("fail-closed: nenhuma fonte reportando também não preenche", () => {
    const r = computeDirectionalConsensus("LONG", [src("A", null), src("B", null)]);
    const g = computeGaugeReading(r);
    expect(g.status).toBe("DADOS_INSUFICIENTES");
    expect(g.geometry.fillLength).toBe(0);
  });

  it("null/undefined na entrada não quebra — vira gauge vazio", () => {
    for (const input of [null, undefined]) {
      const g = computeGaugeReading(input);
      expect(g.status).toBe("DADOS_INSUFICIENTES");
      expect(g.geometry.fillLength).toBe(0);
    }
  });
});

describe("formatGaugePercent", () => {
  it("piso '<1%' evita confundir com 'zero real'", () => {
    expect(formatGaugePercent(0.4)).toBe("<1%");
    expect(formatGaugePercent(0.4)).not.toBe("0%");
  });

  it("zero exato é '0%'", () => {
    expect(formatGaugePercent(0)).toBe("0%");
  });

  it("arredonda para inteiro (percentual grande, sem casas decimais)", () => {
    expect(formatGaugePercent(71.4)).toBe("71%");
    expect(formatGaugePercent(71.6)).toBe("72%");
  });

  it("entrada inválida vira travessão", () => {
    expect(formatGaugePercent(null)).toBe("—");
    expect(formatGaugePercent(NaN)).toBe("—");
  });
});

describe("directional-gauge — disciplina do módulo", () => {
  const source = readFileSync(resolve(__dirname, "../src/nexus/directional-gauge.ts"), "utf8");

  it("é puro: zero rede, zero DOM, zero aleatório", () => {
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\bwindow\./);
  });

  it("a cor vem SEMPRE de directionColor, nunca um hex solto neste arquivo", () => {
    // Única forma segura de garantir que este anel nunca diverge da guarda
    // de inversão: nenhum "#00ffaa"/"#ff0055" escrito à mão aqui.
    expect(source).not.toMatch(/#00ffaa/);
    expect(source).not.toMatch(/#ff0055/);
    expect(source).toMatch(/directionColor\(/);
  });

  it("nunca menciona probabilidade — é consistência interna, dito explicitamente", () => {
    expect(source).toMatch(/nunca uma probabilidade calibrada/);
    expect(source).toMatch(/CONSIST[ÊE]NCIA INTERNA/);
  });
});
