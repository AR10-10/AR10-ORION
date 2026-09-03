// benchmark-chart-render.test.ts — memo "Objetivo" (item 17: "Adicionar
// benchmark no iPad/Safari para: 500/1.000/5.000/10.000 candles..."),
// mapeado como gap real em SYSTEM_HANDBOOK.md §6.93. A bancada em si
// (tools/benchmark-chart-render.mjs) precisa de `playwright`/Chromium real
// — fora do escopo de `vitest` — então este teste cobre só a lógica pura
// de fronteira que o script exporta (o gerador de candles sintéticos),
// mesma convenção de execução real já usada por outras suítes de
// fronteira deste repositório (ex.: annotation-decay.test.ts).
import { describe, it, expect } from "vitest";
import { generateSyntheticCandles } from "../../tools/benchmark-chart-render.mjs";

describe("generateSyntheticCandles: passeio aleatório determinístico, nunca dado de mercado real", () => {
  it("devolve exatamente `count` candles, em ordem de tempo estritamente ascendente", () => {
    const candles = generateSyntheticCandles(500, 1);
    expect(candles).toHaveLength(500);
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].time).toBeGreaterThan(candles[i - 1].time);
    }
  });

  it("cada candle respeita a invariante OHLC real: high >= max(open,close), low <= min(open,close)", () => {
    const candles = generateSyntheticCandles(2000, 7);
    for (const c of candles) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
      expect(c.high).toBeGreaterThanOrEqual(c.low);
    }
  });

  it("é determinístico: mesma semente produz exatamente a mesma série", () => {
    const a = generateSyntheticCandles(300, 42);
    const b = generateSyntheticCandles(300, 42);
    expect(a).toEqual(b);
  });

  it("sementes diferentes produzem séries diferentes (passeio aleatório real, não uma constante disfarçada)", () => {
    const a = generateSyntheticCandles(300, 1);
    const b = generateSyntheticCandles(300, 2);
    expect(a).not.toEqual(b);
  });

  it("fail-closed: contagem inválida (0, negativa, NaN) devolve lista vazia, nunca lança nem fabrica um candle", () => {
    expect(generateSyntheticCandles(0)).toEqual([]);
    expect(generateSyntheticCandles(-5)).toEqual([]);
    expect(generateSyntheticCandles(NaN)).toEqual([]);
  });

  it("preço inicial e espaçamento real de tempo são respeitados (contrato do candle, não um formato arbitrário)", () => {
    const candles = generateSyntheticCandles(3, 42, 60000, 60);
    expect(candles[0].open).toBeCloseTo(60000, -1);
    expect(candles[1].time - candles[0].time).toBe(60);
    expect(candles[2].time - candles[1].time).toBe(60);
  });
});
