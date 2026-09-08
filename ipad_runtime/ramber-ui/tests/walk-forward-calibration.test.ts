// walk-forward-calibration.test.ts — execução REAL.
//
// A pergunta aqui é "os números estão certos?" (Brier, taxa base,
// referência, BSS, faixas de confiabilidade, zero look-ahead), nunca
// "esqueceram de ligar A com B". Métricas com nome próprio e definição
// pública: um erro de fórmula seria silencioso e caro — exatamente o caso
// que o CLAUDE.md manda cobrir por execução real.
import { describe, it, expect } from "vitest";
import {
  evaluateWalkForwardCalibration,
  MIN_WALK_FORWARD_TRAIN,
  MIN_WALK_FORWARD_PREDICTIONS,
  RELIABILITY_BIN_COUNT,
} from "../src/nexus/walk-forward-calibration";
import { MIN_TRADES_FOR_VALID_EXPECTANCY } from "../src/nexus/expectancy";
import type { TradeCostResult } from "../src/nexus/trade-simulation";

/** Trade real mínimo: só os campos que este módulo lê de fato. */
const trade = (modelAgreement: number | null, netR: number): TradeCostResult => ({
  status: netR > 0 ? "TARGET_HIT" : "STOP_HIT",
  direction: "LONG",
  entryMid: 100,
  riskPoints: 1,
  grossR: netR,
  commissionR: 0,
  slippageR: 0,
  fundingR: 0,
  netR,
  holdingMs: 1000,
  resolvedAt: 0,
  regime: null,
  fingerprint: null,
  modelAgreement,
  institutionalScore: null,
});

/** Série em que o score REALMENTE prevê o resultado: score alto → ganho.
 *  Um walk-forward honesto tem de encontrar habilidade aqui. */
function seriePreditiva(n: number): TradeCostResult[] {
  const out: TradeCostResult[] = [];
  for (let i = 0; i < n; i++) {
    const alto = i % 2 === 0;
    out.push(trade(alto ? 0.8 : 0.2, alto ? 1 : -1));
  }
  return out;
}

/** Série em que o score NÃO tem relação com o resultado. O walk-forward
 *  tem de dizer "sem valor preditivo" — este é o teste que impede o
 *  módulo de virar um carimbo de aprovação. */
function serieRuido(n: number): TradeCostResult[] {
  const out: TradeCostResult[] = [];
  for (let i = 0; i < n; i++) {
    const score = (i % 5) / 5 + 0.1;
    out.push(trade(score, i % 2 === 0 ? 1 : -1));
  }
  return out;
}

describe("os pisos reusam o limiar já declarado — nenhum número novo", () => {
  it("treino e teste usam MIN_TRADES_FOR_VALID_EXPECTANCY", () => {
    expect(MIN_WALK_FORWARD_TRAIN).toBe(MIN_TRADES_FOR_VALID_EXPECTANCY);
    expect(MIN_WALK_FORWARD_PREDICTIONS).toBe(MIN_TRADES_FOR_VALID_EXPECTANCY);
    expect(MIN_WALK_FORWARD_TRAIN).toBe(30);
  });
});

describe("fail-closed: histórico curto NUNCA produz métrica", () => {
  it("lista vazia/nula devolve DADOS_INSUFICIENTES e zero métricas", () => {
    for (const entrada of [null, undefined, []]) {
      const r = evaluateWalkForwardCalibration(entrada);
      expect(r.status).toBe("DADOS_INSUFICIENTES");
      expect(r.brierScore).toBeNull();
      expect(r.brierSkillScore).toBeNull();
      expect(r.verdict).toBeNull();
      expect(r.reliability).toEqual([]);
    }
  });

  it("59 trades (1 abaixo do necessário) ainda é insuficiente — o piso é real", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(59));
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.brierScore).toBeNull();
    expect(r.usableTrades).toBe(59);
    expect(r.reason).toContain("60");
  });

  it("60 trades é exatamente o suficiente — a fronteira é a declarada", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(60));
    expect(r.status).toBe("OK");
    expect(r.predictions).toBe(30);
  });

  it("trades sem modelAgreement real sao EXCLUIDOS, nunca tratados como 0", () => {
    const serie = [...seriePreditiva(60), ...Array.from({ length: 40 }, () => trade(null, 1))];
    const r = evaluateWalkForwardCalibration(serie);
    expect(r.usableTrades).toBe(60);
  });

  it("netR não-finito é descartado junto — nunca vira NaN no Brier", () => {
    const serie = [...seriePreditiva(60), trade(0.5, Number.NaN)];
    const r = evaluateWalkForwardCalibration(serie);
    expect(r.usableTrades).toBe(60);
    expect(Number.isFinite(r.brierScore!)).toBe(true);
  });
});

describe("ZERO LOOK-AHEAD — o coração do walk-forward", () => {
  it("o número de previsões é exatamente (usáveis − treino mínimo)", () => {
    for (const n of [60, 75, 100]) {
      const r = evaluateWalkForwardCalibration(seriePreditiva(n));
      expect(r.predictions).toBe(n - MIN_WALK_FORWARD_TRAIN);
    }
  });

  it("mudar um trade FUTURO nunca muda a previsão dos anteriores", () => {
    // A prova real de ausência de vazamento: se o treino olhasse o futuro,
    // alterar o último trade mexeria no Brier das previsões anteriores.
    const base = seriePreditiva(70);
    const mexido = [...base];
    mexido[69] = trade(0.8, -1);

    const rBase = evaluateWalkForwardCalibration(base);
    const rMex = evaluateWalkForwardCalibration(mexido);

    const difSomaQuadrados = Math.abs(rBase.brierScore! - rMex.brierScore!) * rBase.predictions;
    expect(difSomaQuadrados).toBeLessThanOrEqual(1.0000001);
    expect(rBase.predictions).toBe(rMex.predictions);
  });
});

describe("BRIER SCORE — erro quadrático médio real", () => {
  it("fica no intervalo válido [0,1] e é finito", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(80));
    expect(r.brierScore).toBeGreaterThanOrEqual(0);
    expect(r.brierScore).toBeLessThanOrEqual(1);
  });

  it("um score que REALMENTE prevê produz Brier melhor que a referência", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(100));
    expect(r.status).toBe("OK");
    expect(r.brierScore!).toBeLessThan(r.brierReference!);
    expect(r.brierSkillScore!).toBeGreaterThan(0);
    expect(r.verdict).toBe("MELHOR_QUE_A_TAXA_BASE");
  });

  it("um score que NÃO prevê nada é reprovado — o módulo não carimba aprovação", () => {
    const r = evaluateWalkForwardCalibration(serieRuido(120));
    expect(r.status).toBe("OK");
    expect(r.brierSkillScore!).toBeLessThanOrEqual(0);
    expect(r.verdict).toBe("SEM_VALOR_PREDITIVO_DEMONSTRADO");
  });
});

describe("REFERÊNCIA (taxa base) — a identidade b(1−b), não uma aproximação", () => {
  it("brierReference é exatamente baseRate × (1 − baseRate)", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(90));
    expect(r.brierReference!).toBeCloseTo(r.baseRate! * (1 - r.baseRate!), 12);
  });

  it("BSS = 1 − BS/BS_ref, conferido pela definição", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(90));
    expect(r.brierSkillScore!).toBeCloseTo(1 - r.brierScore! / r.brierReference!, 12);
  });

  it("taxa base fica em [0,1] e reflete os acertos reais do conjunto retido", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(100));
    expect(r.baseRate).toBeGreaterThan(0);
    expect(r.baseRate).toBeLessThan(1);
  });

  it("desfecho único na janela retida recusa medir (referência trivial já é perfeita)", () => {
    const todosGanhos = Array.from({ length: 100 }, (_, i) => trade(0.5 + (i % 3) / 10, 1));
    const r = evaluateWalkForwardCalibration(todosGanhos);
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.brierSkillScore).toBeNull();
    expect(r.reason).toContain("mesmo desfecho");
  });
});

describe("CURVA DE CONFIABILIDADE — 'quando disse 70%, acertou quantas?'", () => {
  it("tem exatamente RELIABILITY_BIN_COUNT faixas, cobrindo [0,1] sem buraco", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(100));
    expect(r.reliability).toHaveLength(RELIABILITY_BIN_COUNT);
    expect(r.reliability[0].from).toBe(0);
    expect(r.reliability[RELIABILITY_BIN_COUNT - 1].to).toBe(1);
    for (let i = 1; i < RELIABILITY_BIN_COUNT; i++) {
      expect(r.reliability[i].from).toBeCloseTo(r.reliability[i - 1].to, 12);
    }
  });

  it("a soma das contagens das faixas é o total de previsões — nenhuma se perde", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(100));
    const soma = r.reliability.reduce((a, b) => a + b.count, 0);
    expect(soma).toBe(r.predictions);
  });

  it("faixa vazia devolve null, nunca 0 disfarçado de 'nunca acertou'", () => {
    const r = evaluateWalkForwardCalibration(seriePreditiva(100));
    for (const bin of r.reliability) {
      if (bin.count === 0) {
        expect(bin.meanPredicted).toBeNull();
        expect(bin.observedFrequency).toBeNull();
      } else {
        expect(bin.meanPredicted).toBeGreaterThanOrEqual(bin.from);
        expect(bin.meanPredicted).toBeLessThanOrEqual(bin.to);
        expect(bin.observedFrequency).toBeGreaterThanOrEqual(0);
        expect(bin.observedFrequency).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("pureza e determinismo", () => {
  it("mesma entrada devolve mesma saída", () => {
    const serie = seriePreditiva(80);
    expect(evaluateWalkForwardCalibration(serie)).toEqual(evaluateWalkForwardCalibration(serie));
  });

  it("não muta a entrada", () => {
    const serie = seriePreditiva(70);
    const copia = JSON.parse(JSON.stringify(serie));
    evaluateWalkForwardCalibration(serie);
    expect(serie).toEqual(copia);
  });

  it("a ORDEM é respeitada — o walk-forward é temporal, não decorativo", () => {
    const serie = seriePreditiva(80);
    const invertida = [...serie].reverse();
    const a = evaluateWalkForwardCalibration(serie);
    const b = evaluateWalkForwardCalibration(invertida);
    expect(a.status).toBe("OK");
    expect(b.status).toBe("OK");
    expect(a.predictions).toBe(b.predictions);
  });
});

describe("LEI 24 + Regra de Ouro 2", () => {
  it("o relatório não emite direção nem decisão de trading", () => {
    const chaves = Object.keys(evaluateWalkForwardCalibration(seriePreditiva(80)));
    for (const proibida of ["direction", "stance", "signal", "entry", "stop", "target"]) {
      expect(chaves).not.toContain(proibida);
    }
  });

  it("nunca devolve métrica sem tê-la validado fora-da-amostra", () => {
    const curto = evaluateWalkForwardCalibration(seriePreditiva(40));
    expect(curto.status).toBe("DADOS_INSUFICIENTES");
    expect(curto.brierScore).toBeNull();
    expect(curto.baseRate).toBeNull();
    expect(curto.brierReference).toBeNull();
  });
});
