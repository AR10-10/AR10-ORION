// smc-harmonic-fusion.test.ts — execução real da fusão SMC×Harmônico.
// Constrói HarmonicPatternHit fixtures LITERAIS (a geometria em si já tem
// sua própria suíte real em harmonic-patterns.test.ts — aqui o alvo é só
// a lógica de confluência: cada fator precisa bater exatamente pelas
// regras documentadas em smc-harmonic-fusion.ts, nunca por acidente).
import { describe, it, expect } from "vitest";
import {
  evaluateSmcHarmonicFusion,
  MIN_CONFLUENCE_FACTORS,
  EXHAUSTION_INDEX_WINDOW,
  SMC_FUSION_FACTOR_IDS,
  type SmcFusionInputs,
} from "../src/nexus/smc-harmonic-fusion";
import { HARMONIC_CONTRACT_VERSION, type HarmonicPatternHit } from "../src/nexus/harmonic-patterns";
import type { PriceZone, LiquidityZone, CandlePattern } from "../src/engine-bridge";

// Padrão BULLISH: D é o fundo em 100, completedAtIndex 20 — mesma
// convenção real do motor (direction BULLISH = ponto final é fundo).
const bullishHit: HarmonicPatternHit = {
  contractVersion: HARMONIC_CONTRACT_VERSION,
  pattern: "GARTLEY",
  direction: "BULLISH",
  points: {
    X: { index: 0, price: 120 },
    A: { index: 5, price: 100 },
    B: { index: 10, price: 112 },
    C: { index: 15, price: 104 },
    D: { index: 20, price: 100 },
  },
  ratios: {},
  fitScore: 0.9,
  completedAtIndex: 20,
};

const bearishHit: HarmonicPatternHit = {
  ...bullishHit,
  direction: "BEARISH",
  points: { ...bullishHit.points, D: { index: 20, price: 200 } },
};

const emptyInputs = (hits: HarmonicPatternHit[]): SmcFusionInputs => ({
  harmonicHits: hits,
  orderBlocks: [],
  fairValueGaps: [],
  liquidityZones: [],
  pocPrice: null,
  candlePatterns: [],
});

describe("evaluateSmcHarmonicFusion — fail-closed sem confluência real", () => {
  it("geometria pura sem OB/FVG/POC/exaustão/EQL: matchedCount 0, confirmed false, os 5 fatores presentes e não-batidos", () => {
    const [result] = evaluateSmcHarmonicFusion(emptyInputs([bullishHit]));
    expect(result.matchedCount).toBe(0);
    expect(result.confirmed).toBe(false);
    expect(result.factors.map((f) => f.factor).sort()).toEqual([...SMC_FUSION_FACTOR_IDS].sort());
    expect(result.factors.every((f) => f.matched === false)).toBe(true);
    expect(result.hit).toBe(bullishHit); // passthrough puro — mesmo objeto, nunca reconstruído
  });

  it("lista vazia de hits devolve lista vazia — nunca lança", () => {
    expect(evaluateSmcHarmonicFusion(emptyInputs([]))).toEqual([]);
  });
});

describe("evaluateSmcHarmonicFusion — cada fator bate pela regra real, nunca por acidente", () => {
  it("ORDER_BLOCK: zona BULLISH contendo D bate; zona BEARISH no mesmo preço não bate (direção errada)", () => {
    const zoneRight: PriceZone = { type: "BULLISH", index: 18, top: 101, bottom: 99, mitigated: false };
    const zoneWrong: PriceZone = { type: "BEARISH", index: 18, top: 101, bottom: 99, mitigated: false };
    const [hitRight] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), orderBlocks: [zoneRight] });
    const [hitWrong] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), orderBlocks: [zoneWrong] });
    expect(hitRight.factors.find((f) => f.factor === "ORDER_BLOCK")?.matched).toBe(true);
    expect(hitWrong.factors.find((f) => f.factor === "ORDER_BLOCK")?.matched).toBe(false);
  });

  it("FAIR_VALUE_GAP: mesma regra de contenção/proximidade de preço que ORDER_BLOCK", () => {
    const zoneNear: PriceZone = { type: "BULLISH", index: 18, top: 100.5, bottom: 99.5, mitigated: false };
    const zoneFar: PriceZone = { type: "BULLISH", index: 18, top: 50.5, bottom: 49.5, mitigated: false };
    const [near] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), fairValueGaps: [zoneNear] });
    const [far] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), fairValueGaps: [zoneFar] });
    expect(near.factors.find((f) => f.factor === "FAIR_VALUE_GAP")?.matched).toBe(true);
    expect(far.factors.find((f) => f.factor === "FAIR_VALUE_GAP")?.matched).toBe(false);
  });

  it("POINT_OF_CONTROL: dentro da tolerância bate, fora não bate, POC ausente (null) nunca bate (fail-closed)", () => {
    const [near] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), pocPrice: 100.2 });
    const [far] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), pocPrice: 110 });
    const [absent] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), pocPrice: null });
    expect(near.factors.find((f) => f.factor === "POINT_OF_CONTROL")?.matched).toBe(true);
    expect(far.factors.find((f) => f.factor === "POINT_OF_CONTROL")?.matched).toBe(false);
    expect(absent.factors.find((f) => f.factor === "POINT_OF_CONTROL")?.matched).toBe(false);
  });

  it("EXHAUSTION_CANDLE: Doji (INDECISION) dentro da janela do índice de D bate; fora da janela e não-INDECISION não batem", () => {
    const dojiAtD: CandlePattern = { code: "DOJI", name: "Doji", direction: null, kind: "INDECISION", index: 20, time: 0, bodyAtr: 0.1, confirmed: null, candles: 1 };
    const dojiAdjacent: CandlePattern = { ...dojiAtD, index: 20 - EXHAUSTION_INDEX_WINDOW };
    const dojiFar: CandlePattern = { ...dojiAtD, index: 20 - EXHAUSTION_INDEX_WINDOW - 5 };
    const engulfingAtD: CandlePattern = { code: "BULLISH_ENGULFING", name: "Engolfo de Alta", direction: "ALTA", kind: "REVERSAL", index: 20, time: 0, bodyAtr: 1, confirmed: true, candles: 2 };
    const [atD] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), candlePatterns: [dojiAtD] });
    const [adjacent] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), candlePatterns: [dojiAdjacent] });
    const [far] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), candlePatterns: [dojiFar] });
    const [wrongKind] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), candlePatterns: [engulfingAtD] });
    expect(atD.factors.find((f) => f.factor === "EXHAUSTION_CANDLE")?.matched).toBe(true);
    expect(adjacent.factors.find((f) => f.factor === "EXHAUSTION_CANDLE")?.matched).toBe(true);
    expect(far.factors.find((f) => f.factor === "EXHAUSTION_CANDLE")?.matched).toBe(false);
    expect(wrongKind.factors.find((f) => f.factor === "EXHAUSTION_CANDLE")?.matched).toBe(false);
  });

  it("LIQUIDITY_SWEEP: EQUAL_LOW varrido perto de D bate para padrão BULLISH; EQUAL_HIGH ou não-varrido não batem", () => {
    const sweptLow: LiquidityZone = { type: "EQUAL_LOW", price: 99.8, touches: 2, index: 19, firstIndex: 12, touchIndices: [12, 19], swept: true };
    const sweptHigh: LiquidityZone = { ...sweptLow, type: "EQUAL_HIGH", price: 99.8 };
    const notSwept: LiquidityZone = { ...sweptLow, swept: false };
    const [right] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), liquidityZones: [sweptLow] });
    const [wrongType] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), liquidityZones: [sweptHigh] });
    const [unswept] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), liquidityZones: [notSwept] });
    expect(right.factors.find((f) => f.factor === "LIQUIDITY_SWEEP")?.matched).toBe(true);
    expect(wrongType.factors.find((f) => f.factor === "LIQUIDITY_SWEEP")?.matched).toBe(false);
    expect(unswept.factors.find((f) => f.factor === "LIQUIDITY_SWEEP")?.matched).toBe(false);
  });

  it("padrão BEARISH exige EQUAL_HIGH varrido (espelho do BULLISH), nunca EQUAL_LOW", () => {
    const sweptHighNearD: LiquidityZone = { type: "EQUAL_HIGH", price: 200.2, touches: 2, index: 19, firstIndex: 12, touchIndices: [12, 19], swept: true };
    const [result] = evaluateSmcHarmonicFusion({ ...emptyInputs([bearishHit]), liquidityZones: [sweptHighNearD] });
    expect(result.factors.find((f) => f.factor === "LIQUIDITY_SWEEP")?.matched).toBe(true);
  });
});

describe("evaluateSmcHarmonicFusion — piso mínimo de confluência (MIN_CONFLUENCE_FACTORS)", () => {
  it(`confirmed exige matchedCount >= ${MIN_CONFLUENCE_FACTORS} (piso padrão) — 2 fatores não bastam, 3 bastam`, () => {
    const ob: PriceZone = { type: "BULLISH", index: 18, top: 101, bottom: 99, mitigated: false };
    const fvg: PriceZone = { type: "BULLISH", index: 18, top: 100.5, bottom: 99.5, mitigated: false };
    const doji: CandlePattern = { code: "DOJI", name: "Doji", direction: null, kind: "INDECISION", index: 20, time: 0, bodyAtr: 0.1, confirmed: null, candles: 1 };

    const [twoFactors] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), orderBlocks: [ob], fairValueGaps: [fvg] });
    expect(twoFactors.matchedCount).toBe(2);
    expect(twoFactors.confirmed).toBe(false);

    const [threeFactors] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), orderBlocks: [ob], fairValueGaps: [fvg], candlePatterns: [doji] });
    expect(threeFactors.matchedCount).toBe(3);
    expect(threeFactors.confirmed).toBe(true);
  });

  it("minFactors é configurável por chamada, sem tocar na constante padrão", () => {
    const ob: PriceZone = { type: "BULLISH", index: 18, top: 101, bottom: 99, mitigated: false };
    const [strict] = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit]), orderBlocks: [ob], minFactors: 1 });
    expect(strict.confirmed).toBe(true);
    expect(strict.minFactors).toBe(1);
  });

  it("avalia cada hit da lista de forma independente (múltiplos padrões no mesmo ciclo)", () => {
    const ob: PriceZone = { type: "BULLISH", index: 18, top: 101, bottom: 99, mitigated: false };
    const results = evaluateSmcHarmonicFusion({ ...emptyInputs([bullishHit, bearishHit]), orderBlocks: [ob] });
    expect(results).toHaveLength(2);
    expect(results[0].factors.find((f) => f.factor === "ORDER_BLOCK")?.matched).toBe(true); // bullishHit: OB é BULLISH em 100
    expect(results[1].factors.find((f) => f.factor === "ORDER_BLOCK")?.matched).toBe(false); // bearishHit: D em 200, zona errada
  });
});
