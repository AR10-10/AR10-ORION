// trade-plan-view.test.ts — Ordem 2 §4 ("Trade Plan"): execução real do
// compositor puro. Zero motor novo aqui, então o teste cobre exatamente o
// que o módulo faz — mapear/passar adiante saídas já reais de outros
// sistemas — nunca uma segunda fórmula.
import { describe, it, expect } from "vitest";
import { composeTradePlanView, type TradePlanView } from "../src/nexus/trade-plan-view";
import type { TradePlan } from "../src/nexus/trade-plan";
import type { ScenarioProjection } from "../src/nexus/scenario-engine";
import type { ReversalReading } from "../src/nexus/reversal-detector";

const REAL_PLAN: TradePlan = {
  contractVersion: 2,
  direction: "LONG",
  entry: { low: 78200, high: 78350, basis: "OB_BULLISH" },
  stop: { price: 77850, basis: "SR_SUPPORT_1" },
  targets: [
    { price: 78900, basis: "SR_RESISTANCE_1", obstacleCount: 0 },
    { price: 79600, basis: "EQH", obstacleCount: 1 },
  ],
  riskRewardRatios: [2, 3.5],
  computedAt: 1000,
};

const REAL_SCENARIO: ScenarioProjection = {
  contractVersion: 2,
  basis: "COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY",
  price: 78300,
  pathA: {
    direction: "LONG",
    targets: [{ price: 78900, sourceKind: "SR_RESISTANCE_1" }],
    invalidation: { price: 77850, sourceKind: "SR_SUPPORT_1" },
    opinionWeight: 0.7,
  },
  pathB: {
    direction: "SHORT",
    targets: [{ price: 77500, sourceKind: "SR_SUPPORT_2" }],
    invalidation: { price: 79000, sourceKind: "SR_RESISTANCE_2" },
    opinionWeight: 0.3,
  },
  computedAt: 1000,
};

const REAL_REVERSAL: ReversalReading = {
  status: "OK",
  reason: null,
  direction: "SHORT",
  evidence: [{ source: "CHOCH", direction: "SHORT", atIndex: 40, barsAgo: 2 }],
  agreeingCount: 1,
  totalReadable: 2,
  strength: 0.5,
  barsAgo: 2,
  contradictsCore: true,
};

const emptyInput = {
  plan: null,
  trackedStatus: null,
  setupState: null,
  entryState: null,
  scenario: null,
  reversal: null,
  confidenceScore: null,
};

describe("composeTradePlanView: STATUS resolve por qual sistema real tem leitura agora", () => {
  it("sem plano, sem setup real → WAIT", () => {
    const v = composeTradePlanView({ ...emptyInput, setupState: "NO_VALID_SETUP" });
    expect(v.status).toBe("WAIT");
    expect(v.direction).toBeNull();
  });

  it("sem plano, setupState nulo (Núcleo em AGUARDAR) → WAIT, nunca DATA_INSUFFICIENT fabricado", () => {
    const v = composeTradePlanView({ ...emptyInput });
    expect(v.status).toBe("WAIT");
  });

  it("sem plano, estrutura formando mas timing ainda ausente → SETUP_FORMING", () => {
    const v = composeTradePlanView({ ...emptyInput, setupState: "LONG_SETUP", entryState: "WAITING_FOR_RETEST" });
    expect(v.status).toBe("SETUP_FORMING");
  });

  it("trackedStatus OPEN → ACTIVE, mesmo com plano presente", () => {
    const v = composeTradePlanView({ ...emptyInput, plan: REAL_PLAN, trackedStatus: "OPEN" });
    expect(v.status).toBe("ACTIVE");
  });

  it("plano real existe mas ainda sem tracked status (1º ciclo) → ACTIVE, nunca WAIT", () => {
    const v = composeTradePlanView({ ...emptyInput, plan: REAL_PLAN, trackedStatus: null });
    expect(v.status).toBe("ACTIVE");
  });

  it("TARGET_HIT e PARTIAL_HIT → TARGET_REACHED", () => {
    expect(composeTradePlanView({ ...emptyInput, plan: REAL_PLAN, trackedStatus: "TARGET_HIT" }).status).toBe("TARGET_REACHED");
    expect(composeTradePlanView({ ...emptyInput, plan: REAL_PLAN, trackedStatus: "PARTIAL_HIT" }).status).toBe("TARGET_REACHED");
  });

  it("STOP_HIT e REPLACED → INVALIDATED", () => {
    expect(composeTradePlanView({ ...emptyInput, plan: REAL_PLAN, trackedStatus: "STOP_HIT" }).status).toBe("INVALIDATED");
    expect(composeTradePlanView({ ...emptyInput, plan: REAL_PLAN, trackedStatus: "REPLACED" }).status).toBe("INVALIDATED");
  });

  it("sem plano, entryState ENTRY_INVALIDATED (premissa quebrada) → INVALIDATED", () => {
    const v = composeTradePlanView({ ...emptyInput, entryState: "ENTRY_INVALIDATED", setupState: "INVALIDATED" });
    expect(v.status).toBe("INVALIDATED");
  });
});

describe("composeTradePlanView: entry/invalidation/targets são PASSTHROUGH real do plano, nunca recalculados", () => {
  it("entry, invalidation (stop) e targets vêm exatamente do TradePlan real", () => {
    const v = composeTradePlanView({ ...emptyInput, plan: REAL_PLAN, trackedStatus: "OPEN" });
    expect(v.direction).toBe("LONG");
    expect(v.entry).toEqual(REAL_PLAN.entry);
    expect(v.invalidation).toEqual(REAL_PLAN.stop);
    expect(v.targets).toEqual(REAL_PLAN.targets);
    expect(v.riskRewardRatios).toEqual(REAL_PLAN.riskRewardRatios);
  });

  it("sem plano: entry/invalidation nulos, targets vazio — nunca um valor fabricado", () => {
    const v = composeTradePlanView({ ...emptyInput });
    expect(v.entry).toBeNull();
    expect(v.invalidation).toBeNull();
    expect(v.targets).toEqual([]);
    expect(v.riskRewardRatios).toEqual([]);
  });
});

describe("composeTradePlanView: CONFIDENCE STATE é qualitativo real, nunca % fabricada (Ordem 2 §12)", () => {
  it("score real alto → tier MUITO_FORTE/FORTE, nunca um percentual no contrato", () => {
    const v = composeTradePlanView({ ...emptyInput, confidenceScore: 92 });
    expect(v.confidenceState).toBe("MUITO_FORTE");
    // @ts-expect-error contrato não tem campo de percentual algum
    expect(v.confidencePercent).toBeUndefined();
  });

  it("score real baixo → tier FRACA/INVALIDA", () => {
    expect(composeTradePlanView({ ...emptyInput, confidenceScore: 55 }).confidenceState).toBe("FRACA");
    expect(composeTradePlanView({ ...emptyInput, confidenceScore: 10 }).confidenceState).toBe("INVALIDA");
  });

  it("score ausente (null) → DADOS_INSUFICIENTES, nunca uma banda fabricada", () => {
    expect(composeTradePlanView({ ...emptyInput, confidenceScore: null }).confidenceState).toBe("DADOS_INSUFICIENTES");
  });
});

describe("composeTradePlanView: REVERSAL é passthrough integral de reversal-detector.ts, nunca reinterpretado", () => {
  it("leitura real repassada por identidade de valor", () => {
    const v = composeTradePlanView({ ...emptyInput, reversal: REAL_REVERSAL });
    expect(v.reversal).toEqual(REAL_REVERSAL);
  });

  it("ausência de leitura é null honesto — nunca tratado como 'sem reversão'", () => {
    const v = composeTradePlanView({ ...emptyInput, reversal: null });
    expect(v.reversal).toBeNull();
  });
});

describe("composeTradePlanView: SCENARIO — BASE é o caminho que bate com a direção do plano real", () => {
  it("plano LONG real: base = pathA (LONG), alternative = pathB (SHORT)", () => {
    const v = composeTradePlanView({ ...emptyInput, plan: REAL_PLAN, trackedStatus: "OPEN", scenario: REAL_SCENARIO });
    expect(v.scenario?.base.direction).toBe("LONG");
    expect(v.scenario?.alternative.direction).toBe("SHORT");
    expect(v.scenario?.base.invalidation).toEqual({ price: 77850, basis: "SR_SUPPORT_1" });
    expect(v.scenario?.base.targets).toEqual([{ price: 78900, basis: "SR_RESISTANCE_1" }]);
  });

  it("plano SHORT real (pathB é quem bate): base = pathB, alternative = pathA", () => {
    const shortPlan: TradePlan = { ...REAL_PLAN, direction: "SHORT" };
    const v = composeTradePlanView({ ...emptyInput, plan: shortPlan, trackedStatus: "OPEN", scenario: REAL_SCENARIO });
    expect(v.scenario?.base.direction).toBe("SHORT");
    expect(v.scenario?.alternative.direction).toBe("LONG");
  });

  it("sem plano (WAIT): base é sempre pathA, mesma convenção real de scenario-engine.ts", () => {
    const v = composeTradePlanView({ ...emptyInput, scenario: REAL_SCENARIO });
    expect(v.scenario?.base.direction).toBe(REAL_SCENARIO.pathA.direction);
  });

  it("sem scenario real fornecido → null honesto, nunca um cenário vazio fabricado", () => {
    const v = composeTradePlanView({ ...emptyInput, scenario: null });
    expect(v.scenario).toBeNull();
  });
});

describe("composeTradePlanView: pureza real — mesma entrada, mesma saída, zero mutação", () => {
  it("chamadas repetidas com o mesmo input produzem resultados equivalentes", () => {
    const input = { ...emptyInput, plan: REAL_PLAN, trackedStatus: "OPEN" as const, scenario: REAL_SCENARIO, reversal: REAL_REVERSAL, confidenceScore: 77 };
    const a = composeTradePlanView(input);
    const b = composeTradePlanView(input);
    expect(a).toEqual(b);
  });

  it("nunca muta o TradePlan de entrada", () => {
    const planCopy = JSON.parse(JSON.stringify(REAL_PLAN));
    composeTradePlanView({ ...emptyInput, plan: REAL_PLAN, trackedStatus: "OPEN" });
    expect(REAL_PLAN).toEqual(planCopy);
  });
});

describe("composeTradePlanView: contrato versionado, mesmo padrão dos outros compositores desta sessão", () => {
  it("contractVersion presente e estável", () => {
    const v: TradePlanView = composeTradePlanView({ ...emptyInput });
    expect(v.contractVersion).toBe(1);
  });
});
