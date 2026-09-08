// calibration-freshness.test.ts — execução REAL: a pergunta é "a idade e o
// alcance estão certos, e o veredito sai da própria amostra?".
import { describe, it, expect } from "vitest";
import {
  measureCalibrationFreshness,
  describeCalibrationFreshness,
} from "../src/nexus/calibration-freshness";
import { TIMEFRAME_MS } from "../src/nexus/aura-lifecycle";
import type { TradeCostResult } from "../src/nexus/trade-simulation";

const DIA = 86_400_000;

/** Trade real mínimo: só o campo que este módulo lê. */
const em = (resolvedAt: number): TradeCostResult => ({
  status: "TARGET_HIT",
  direction: "LONG",
  entryMid: 100,
  riskPoints: 1,
  grossR: 1,
  commissionR: 0,
  slippageR: 0,
  fundingR: 0,
  netR: 1,
  holdingMs: 1000,
  resolvedAt,
  regime: null,
  fingerprint: null,
  modelAgreement: 0.5,
  institutionalScore: null,
  volatilityAtOpen: null,
});

describe("o veredito sai da PRÓPRIA amostra — zero constante inventada", () => {
  it("lacuna MENOR que o alcance medido = dentro do medido", () => {
    // Amostra cobre 30 dias, parou há 10.
    const agora = 100 * DIA;
    const f = measureCalibrationFreshness([em(60 * DIA), em(90 * DIA)], agora, "1h");
    expect(f.status).toBe("DENTRO_DO_MEDIDO");
    expect(f.spanMs).toBe(30 * DIA);
    expect(f.ageMs).toBe(10 * DIA);
  });

  it("lacuna MAIOR que o alcance medido = extrapolando", () => {
    // Amostra cobre 10 dias, parou há 30: projeta 3x além do que mediu.
    const agora = 100 * DIA;
    const f = measureCalibrationFreshness([em(60 * DIA), em(70 * DIA)], agora, "1h");
    expect(f.status).toBe("EXTRAPOLANDO");
    expect(f.ageMs!).toBeGreaterThan(f.spanMs!);
  });

  it("a fronteira exata (lacuna === alcance) ainda conta como dentro", () => {
    const agora = 100 * DIA;
    const f = measureCalibrationFreshness([em(80 * DIA), em(90 * DIA)], agora, "1h");
    expect(f.spanMs).toBe(10 * DIA);
    expect(f.ageMs).toBe(10 * DIA);
    expect(f.status).toBe("DENTRO_DO_MEDIDO");
  });

  it("o veredito NÃO depende de quantos trades há, só das duas pontas", () => {
    const agora = 100 * DIA;
    const duas = measureCalibrationFreshness([em(60 * DIA), em(70 * DIA)], agora, null);
    const muitas = measureCalibrationFreshness(
      [em(60 * DIA), em(63 * DIA), em(66 * DIA), em(70 * DIA)],
      agora,
      null,
    );
    expect(muitas.status).toBe(duas.status);
    expect(muitas.spanMs).toBe(duas.spanMs);
    expect(muitas.sampleSize).toBe(4);
  });
});

describe("idade em BARRAS — a unidade em que o Operador pensa", () => {
  it("converte pelo TIMEFRAME_MS real do prazo selecionado", () => {
    const agora = 100 * DIA;
    const f = measureCalibrationFreshness([em(60 * DIA), em(90 * DIA)], agora, "1h");
    expect(f.ageBars).toBe(Math.floor((10 * DIA) / TIMEFRAME_MS["1h"]));
    expect(f.spanBars).toBe(Math.floor((30 * DIA) / TIMEFRAME_MS["1h"]));
  });

  it("o MESMO intervalo dá mais barras num prazo menor", () => {
    const agora = 100 * DIA;
    const a = measureCalibrationFreshness([em(60 * DIA), em(90 * DIA)], agora, "5m");
    const b = measureCalibrationFreshness([em(60 * DIA), em(90 * DIA)], agora, "4h");
    expect(a.ageBars!).toBeGreaterThan(b.ageBars!);
  });

  it("timeframe desconhecido/ausente devolve null em barras — nunca um número chutado", () => {
    const agora = 100 * DIA;
    for (const tf of [null, undefined, "42x"]) {
      const f = measureCalibrationFreshness([em(60 * DIA), em(90 * DIA)], agora, tf);
      expect(f.ageBars).toBeNull();
      expect(f.spanBars).toBeNull();
      // Mas a medição em ms continua real.
      expect(f.ageMs).toBe(10 * DIA);
    }
  });
});

describe("fail-closed (Regra de Ouro 3)", () => {
  it("menos de 2 trades com instante real = sem medição", () => {
    for (const entrada of [null, undefined, [], [em(DIA)]]) {
      const f = measureCalibrationFreshness(entrada, 100 * DIA, "1h");
      expect(f.status).toBe("DADOS_INSUFICIENTES");
      expect(f.ageMs).toBeNull();
      expect(f.spanMs).toBeNull();
    }
  });

  it("resolvedAt ausente/zero é DESCARTADO, nunca datado em 1970", () => {
    // Um 0 tratado como instante colocaria o trade em 1970 e inflaria o
    // alcance da amostra em 56 anos — o veredito viraria sempre "dentro".
    const antigos = [em(0), em(0), em(0)];
    expect(measureCalibrationFreshness(antigos, 100 * DIA, "1h").status).toBe("DADOS_INSUFICIENTES");

    const misto = measureCalibrationFreshness([em(0), em(60 * DIA), em(90 * DIA)], 100 * DIA, "1h");
    expect(misto.sampleSize).toBe(2);
    expect(misto.spanMs).toBe(30 * DIA);
  });

  it("alcance zero (todos no mesmo instante) recusa vereditar", () => {
    const f = measureCalibrationFreshness([em(90 * DIA), em(90 * DIA)], 100 * DIA, "1h");
    expect(f.status).toBe("DADOS_INSUFICIENTES");
    expect(f.reason).toContain("mesmo instante");
  });

  it("trade no futuro em relação a `now` recusa medir", () => {
    const f = measureCalibrationFreshness([em(60 * DIA), em(200 * DIA)], 100 * DIA, "1h");
    expect(f.status).toBe("DADOS_INSUFICIENTES");
    expect(f.reason).toContain("futuro");
  });

  it("`now` inválido nunca vira NaN na idade", () => {
    for (const mau of [Number.NaN, Infinity]) {
      const f = measureCalibrationFreshness([em(60 * DIA), em(90 * DIA)], mau, "1h");
      expect(f.status).toBe("DADOS_INSUFICIENTES");
    }
  });
});

describe("pureza — nenhum relógio interno", () => {
  it("`now` entra por parâmetro: a mesma entrada dá sempre a mesma saída", () => {
    const amostra = [em(60 * DIA), em(90 * DIA)];
    expect(measureCalibrationFreshness(amostra, 100 * DIA, "1h")).toEqual(
      measureCalibrationFreshness(amostra, 100 * DIA, "1h"),
    );
  });

  it("o módulo não chama Date.now()", () => {
    // Se chamasse, dois `now` diferentes poderiam dar o mesmo resultado.
    const amostra = [em(60 * DIA), em(90 * DIA)];
    const a = measureCalibrationFreshness(amostra, 100 * DIA, "1h");
    const b = measureCalibrationFreshness(amostra, 200 * DIA, "1h");
    expect(a.ageMs).not.toBe(b.ageMs);
  });

  it("não muta a entrada", () => {
    const amostra = [em(60 * DIA), em(90 * DIA)];
    const copia = JSON.parse(JSON.stringify(amostra));
    measureCalibrationFreshness(amostra, 100 * DIA, "1h");
    expect(amostra).toEqual(copia);
  });
});

describe("a frase da UI diz a verdade nos três estados", () => {
  it("extrapolando diz que está projetando além do medido", () => {
    const f = measureCalibrationFreshness([em(60 * DIA), em(70 * DIA)], 100 * DIA, "1h");
    expect(describeCalibrationFreshness(f)).toContain("além do que foi medido");
  });

  it("dentro do medido diz que está dentro", () => {
    const f = measureCalibrationFreshness([em(60 * DIA), em(90 * DIA)], 100 * DIA, "1h");
    expect(describeCalibrationFreshness(f)).toContain("dentro do alcance medido");
  });

  it("sem medição devolve o MOTIVO real, nunca um código cru", () => {
    const f = measureCalibrationFreshness([], 100 * DIA, "1h");
    const txt = describeCalibrationFreshness(f);
    expect(txt).toBe(f.reason);
    expect(txt).not.toMatch(/^[A-Z_]+$/); // nunca DADOS_INSUFICIENTES cru
  });
});

describe("LEI 24 + Regra de Ouro 4", () => {
  it("o relatório não emite direção nem esconde a probabilidade", () => {
    const chaves = Object.keys(measureCalibrationFreshness([em(60 * DIA), em(90 * DIA)], 100 * DIA, "1h"));
    for (const proibida of ["direction", "probability", "suppress", "hide", "show"]) {
      expect(chaves).not.toContain(proibida);
    }
  });
});
