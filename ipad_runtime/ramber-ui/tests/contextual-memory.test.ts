// Suíte de EXECUÇÃO REAL da memória contextual (nexus/contextual-memory.ts).
//
// Este módulo devolve NÚMEROS que o Operador vai ler ao lado de uma decisão
// — então o bug mais provável não é fiação, é "a leitura está sutilmente
// errada" ou "a memória falou com amostra que não sustenta". Por isso tudo
// aqui executa o módulo de verdade.
//
// A asserção que mais importa é a que prova o silêncio: com amostra rasa,
// a memória não devolve estatística nenhuma.
import { describe, it, expect } from "vitest";
import {
  recallContext,
  describeRecall,
  fingerprintFactors,
  MEMORY_MIN_SAMPLE,
} from "../src/nexus/contextual-memory";
import { MIN_TRADES_FOR_VALID_EXPECTANCY } from "../src/nexus/expectancy";
import type { TradeCostResult } from "../src/nexus/trade-simulation";

const FP_A = "regime:TENDENCIA_FORTE|structure:ESTRUTURA_ALTA|vwap:BULLISH|nl:ABOVE";
const FP_B = "regime:TENDENCIA_FORTE|structure:ESTRUTURA_ALTA|vwap:BEARISH|nl:BELOW";
const FP_C = "regime:CONSOLIDACAO|structure:ESTRUTURA_LATERAL|vwap:NEUTRAL|nl:NEUTRAL";

/** Resultado real mínimo: o que computeExpectancy consome. netR positivo =
 *  ganho real depois de comissão/slippage/funding. */
const trade = (fingerprint: string | null, netR: number): TradeCostResult =>
  ({
    fingerprint,
    netR,
    grossR: netR,
    commissionR: 0,
    slippageR: 0,
    fundingR: 0,
  }) as unknown as TradeCostResult;

const many = (fp: string, n: number, netR: number) =>
  Array.from({ length: n }, () => trade(fp, netR));

describe("recallContext — ausência honesta", () => {
  it("sem fingerprint não há o que lembrar", () => {
    expect(recallContext(many(FP_A, 10, 1), null)).toBeNull();
  });

  it("sem histórico não há o que lembrar", () => {
    expect(recallContext([], FP_A)).toBeNull();
  });

  it("histórico sem nenhum contexto comparável devolve null, nunca um objeto vazio", () => {
    // FP_C não compartilha nenhum fator real com FP_A.
    expect(recallContext(many(FP_C, 20, 1), FP_A)).toBeNull();
  });

  it("resultados sem fingerprint (registros antigos) nunca entram em grupo nenhum", () => {
    const semContexto = Array.from({ length: 40 }, () => trade(null, 1));
    expect(recallContext(semContexto, FP_A)).toBeNull();
  });
});

describe("recallContext — match exato", () => {
  it("amostra suficiente no contexto idêntico devolve leitura EXATA com estatística real", () => {
    const out = recallContext(many(FP_A, 12, 1.5), FP_A);
    expect(out).not.toBeNull();
    expect(out!.matchLevel).toBe("EXATO");
    expect(out!.sample).toBe(12);
    expect(out!.matchedFactors).toHaveLength(4);
    expect(out!.stats).not.toBeNull();
    expect(out!.stats!.totalTrades).toBe(12);
  });

  it("força da amostra segue os pisos declarados, nunca uma escala inventada", () => {
    expect(recallContext(many(FP_A, MEMORY_MIN_SAMPLE, 1), FP_A)!.strength).toBe("AMOSTRA_PRELIMINAR");
    expect(
      recallContext(many(FP_A, MIN_TRADES_FOR_VALID_EXPECTANCY, 1), FP_A)!.strength,
    ).toBe("AMOSTRA_VALIDA");
  });

  it("a estatística vem de computeExpectancy — nunca recontada aqui", () => {
    // 6 ganhos de +2R e 6 perdas de -1R: expectância = 0.5*2 − 0.5*1 = 0.5R
    const mix = [...many(FP_A, 6, 2), ...many(FP_A, 6, -1)];
    const out = recallContext(mix, FP_A)!;
    expect(out.stats!.winRate).toBeCloseTo(0.5, 10);
    expect(out.stats!.expectancyR).toBeCloseTo(0.5, 10);
  });
});

describe("recallContext — o silêncio com amostra rasa", () => {
  it("abaixo do piso a memória informa a contagem mas NÃO devolve estatística", () => {
    // 3 trades: existe grupo, mas 3 não é memória, é anedota.
    const out = recallContext(many(FP_A, 3, 5), FP_A);
    expect(out).not.toBeNull();
    expect(out!.sample).toBe(3);
    expect(out!.strength).toBe("AMOSTRA_INSUFICIENTE");
    expect(out!.stats).toBeNull(); // fail-closed: sem número frágil sem aviso
  });

  it("um único trade espetacular não vira leitura", () => {
    const out = recallContext([trade(FP_A, 12)], FP_A)!;
    expect(out.strength).toBe("AMOSTRA_INSUFICIENTE");
    expect(out.stats).toBeNull();
  });
});

describe("recallContext — match parcial, declarado e nunca silencioso", () => {
  it("sem amostra exata, cai para o grupo que compartilha fatores REAIS e diz quais", () => {
    // FP_B compartilha regime e structure com FP_A (2 fatores), mas difere
    // em vwap e nl.
    const out = recallContext(many(FP_B, 20, 1), FP_A);
    expect(out).not.toBeNull();
    expect(out!.matchLevel).toBe("PARCIAL");
    expect(out!.sample).toBe(20);
    expect(out!.matchedFactors.sort()).toEqual([
      "regime:TENDENCIA_FORTE",
      "structure:ESTRUTURA_ALTA",
    ]);
  });

  it("o match exato tem precedência sobre o parcial, mesmo com amostra menor", () => {
    const mixed = [...many(FP_A, 8, 1), ...many(FP_B, 50, -1)];
    const out = recallContext(mixed, FP_A)!;
    expect(out.matchLevel).toBe("EXATO");
    expect(out.sample).toBe(8); // 8 idênticos vencem 50 parecidos
  });

  it("exige o mínimo de fatores compartilhados — 1 fator em comum não é semelhança", () => {
    const soRegime = "regime:TENDENCIA_FORTE|structure:ESTRUTURA_BAIXA|vwap:BEARISH|nl:BELOW";
    expect(recallContext(many(soRegime, 30, 1), FP_A, 2)).toBeNull();
    // Com o mínimo relaxado para 1, aí sim encontra — e a diferença é uma
    // decisão explícita de quem chama, nunca um afrouxamento escondido.
    const relaxado = recallContext(many(soRegime, 30, 1), FP_A, 1);
    expect(relaxado!.matchLevel).toBe("PARCIAL");
    expect(relaxado!.matchedFactors).toEqual(["regime:TENDENCIA_FORTE"]);
  });

  it("fatores AUSENTES não casam entre si — ausência compartilhada não é semelhança", () => {
    const vazio = "regime:—|structure:—|vwap:—|nl:ABOVE";
    const outro = "regime:—|structure:—|vwap:—|nl:BELOW";
    // Os dois têm 3 tags "—" em comum, mas nenhum fator REAL compartilhado.
    expect(recallContext(many(outro, 30, 1), vazio, 2)).toBeNull();
  });
});

describe("describeRecall — a frase que o Operador lê", () => {
  it("sempre carrega o tamanho da amostra junto do resultado", () => {
    const out = recallContext([...many(FP_A, 6, 2), ...many(FP_A, 6, -1)], FP_A);
    const frase = describeRecall(out)!;
    expect(frase).toContain("6 de 12");
    expect(frase).toContain("0.50R");
  });

  it("amostra rasa produz frase que diz exatamente isso, sem número de desempenho", () => {
    const frase = describeRecall(recallContext(many(FP_A, 2, 3), FP_A))!;
    expect(frase).toContain("amostra insuficiente");
    expect(frase).not.toMatch(/\dR\b/);
  });

  it("amostra preliminar é rotulada como tal", () => {
    expect(describeRecall(recallContext(many(FP_A, 6, 1), FP_A))).toContain("preliminar");
  });

  it("match parcial diz 'contexto parecido', nunca finge ser o mesmo contexto", () => {
    expect(describeRecall(recallContext(many(FP_B, 20, 1), FP_A))).toContain("parecido");
    expect(describeRecall(recallContext(many(FP_A, 20, 1), FP_A))).toContain("neste contexto");
  });

  it("sem memória, sem frase", () => {
    expect(describeRecall(null)).toBeNull();
  });
});

describe("memória — nunca uma probabilidade (Regra de Ouro 2)", () => {
  it("nenhuma saída do módulo apresenta percentual de acerto projetado", () => {
    const out = recallContext(many(FP_A, 40, 1), FP_A)!;
    const frase = describeRecall(out)!;
    // Contagem observada e R-múltiplo, sim. "% de chance", nunca.
    expect(frase).not.toMatch(/%/);
    expect(frase).not.toMatch(/chance|probabilidade/i);
  });

  it("fingerprintFactors devolve as tags legíveis, não um hash opaco", () => {
    expect(fingerprintFactors(FP_A)).toEqual([
      "regime:TENDENCIA_FORTE",
      "structure:ESTRUTURA_ALTA",
      "vwap:BULLISH",
      "nl:ABOVE",
    ]);
  });
});
