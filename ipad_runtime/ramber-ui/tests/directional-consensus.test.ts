// Execução real — a pergunta aqui é aritmética e de contrato ("o denominador
// conta silêncio como voto?"), então o motor é chamado de verdade.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeDirectionalConsensus,
  describeDirectionalConsensus,
  normalizeSide,
  sideFromSigned,
  computeLiquidityMap,
  liquidityBias,
  type DirectionalSource,
} from "../src/nexus/directional-consensus";

const src = (code: string, side: DirectionalSource["side"]): DirectionalSource => ({
  code,
  name: code,
  side,
  measures: "teste",
});

describe("normalizeSide — os 4 vocabulários reais viram um só", () => {
  it("traduz toda variante real de ALTA para LONG", () => {
    for (const v of ["LONG", "ALTA", "ESTRUTURA_ALTA", "COMPRADOR", "BULLISH", "alta", "Long"]) {
      expect(normalizeSide(v), v).toBe("LONG");
    }
  });

  it("traduz toda variante real de BAIXA para SHORT", () => {
    for (const v of ["SHORT", "BAIXA", "ESTRUTURA_BAIXA", "VENDEDOR", "BEARISH", "baixa"]) {
      expect(normalizeSide(v), v).toBe("SHORT");
    }
  });

  it("traduz as variantes de lateralidade para NEUTRO", () => {
    for (const v of ["NEUTRO", "NEUTRAL", "ESTRUTURA_LATERAL", "LATERAL"]) {
      expect(normalizeSide(v), v).toBe("NEUTRO");
    }
  });

  it("fail-closed: vocabulário desconhecido NUNCA vira um lado chutado", () => {
    // ABSTAIN/WAIT/DADOS_INSUFICIENTES são ausência de leitura, não neutro.
    // Tratá-los como NEUTRO os colocaria no denominador — mentira estatística.
    for (const v of ["ABSTAIN", "WAIT", "DADOS_INSUFICIENTES", "?", "", "QUALQUER_COISA_NOVA"]) {
      expect(normalizeSide(v), v).toBeNull();
    }
    expect(normalizeSide(null)).toBeNull();
    expect(normalizeSide(undefined)).toBeNull();
  });
});

describe("sideFromSigned — número com sinal vira direção", () => {
  it("positivo é LONG, negativo é SHORT", () => {
    expect(sideFromSigned(1.5)).toBe("LONG");
    expect(sideFromSigned(-1.5)).toBe("SHORT");
  });

  it("a zona morta impede que ruído vire voto", () => {
    // Sem zona morta, um desequilíbrio de 0.001 viraria "LONG" — um voto que
    // não significa nada e contamina o alinhamento.
    expect(sideFromSigned(0.001, 0.05)).toBe("NEUTRO");
    expect(sideFromSigned(-0.001, 0.05)).toBe("NEUTRO");
    expect(sideFromSigned(0.2, 0.05)).toBe("LONG");
  });

  it("exatamente zero é NEUTRO, nunca LONG", () => {
    expect(sideFromSigned(0)).toBe("NEUTRO");
  });

  it("fail-closed em não-números", () => {
    expect(sideFromSigned(null)).toBeNull();
    expect(sideFromSigned(undefined)).toBeNull();
    expect(sideFromSigned(NaN)).toBeNull();
    expect(sideFromSigned(Infinity)).toBeNull();
  });
});

describe("computeDirectionalConsensus — o denominador honesto", () => {
  it("fonte sem leitura fica FORA da conta (não vira voto neutro)", () => {
    // Este é o teste central: 3 fontes existem, só 2 opinaram. O resultado
    // tem que dizer 'de 2', nunca 'de 3'.
    const r = computeDirectionalConsensus("LONG", [
      src("A", "LONG"),
      src("B", "SHORT"),
      src("C", null),
    ]);
    expect(r.reporting).toBe(2);
    expect(r.aligned).toBe(1);
    expect(r.opposed).toBe(1);
    expect(r.alignmentRatio).toBeCloseTo(0.5, 10);
  });

  it("NEUTRO opinou, mas não é alinhado nem oposto — é exatamente o que diz", () => {
    const r = computeDirectionalConsensus("LONG", [
      src("A", "LONG"),
      src("B", "NEUTRO"),
      src("C", "NEUTRO"),
    ]);
    expect(r.reporting).toBe(3); // os 3 têm leitura real
    expect(r.aligned).toBe(1);
    expect(r.opposed).toBe(0);
    expect(r.alignmentRatio).toBeCloseTo(1 / 3, 10);
  });

  it("consenso total", () => {
    const r = computeDirectionalConsensus("SHORT", [src("A", "SHORT"), src("B", "SHORT"), src("C", "SHORT")]);
    expect(r.aligned).toBe(3);
    expect(r.opposed).toBe(0);
    expect(r.alignmentRatio).toBe(1);
    expect(r.sources.every((s) => s.agrees === true)).toBe(true);
  });

  it("divergência total é reportada como tal, nunca suavizada", () => {
    const r = computeDirectionalConsensus("LONG", [src("A", "SHORT"), src("B", "SHORT")]);
    expect(r.aligned).toBe(0);
    expect(r.opposed).toBe(2);
    expect(r.alignmentRatio).toBe(0);
  });

  it("sem direção do Núcleo, nada é marcado como concordando (não há referência)", () => {
    for (const core of [null, "NEUTRO" as const]) {
      const r = computeDirectionalConsensus(core, [src("A", "LONG"), src("B", "SHORT")]);
      expect(r.sources.every((s) => s.agrees === null), String(core)).toBe(true);
      expect(r.aligned).toBe(0);
      expect(r.opposed).toBe(0);
      // Mas as fontes CONTINUAM reportando — o ecossistema tem leitura mesmo
      // quando o Núcleo está em WAIT, e essa informação não se perde.
      expect(r.reporting).toBe(2);
    }
  });

  it("nenhuma fonte opinando devolve DADOS_INSUFICIENTES e ratio null", () => {
    const r = computeDirectionalConsensus("LONG", [src("A", null), src("B", null)]);
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.alignmentRatio).toBeNull(); // nunca 0 — "0%" se leria como "ninguém concorda"
  });

  it("lista vazia não quebra", () => {
    const r = computeDirectionalConsensus("LONG", []);
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.sources).toEqual([]);
  });

  it("alinhado + oposto + neutro nunca passa do total que reportou", () => {
    const combos: Array<DirectionalSource["side"]> = ["LONG", "SHORT", "NEUTRO", null];
    for (const a of combos) {
      for (const b of combos) {
        for (const c of combos) {
          const r = computeDirectionalConsensus("LONG", [src("A", a), src("B", b), src("C", c)]);
          expect(r.aligned + r.opposed).toBeLessThanOrEqual(r.reporting);
          if (r.alignmentRatio !== null) {
            expect(r.alignmentRatio).toBeGreaterThanOrEqual(0);
            expect(r.alignmentRatio).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe("describeDirectionalConsensus — honestidade do texto", () => {
  it("diz explicitamente que NÃO é probabilidade de acerto", () => {
    const r = computeDirectionalConsensus("LONG", [src("A", "LONG"), src("B", "LONG")]);
    const t = describeDirectionalConsensus(r);
    expect(t).toMatch(/nunca probabilidade de acerto/i);
    expect(t).toMatch(/consist[êe]ncia interna/i);
  });

  it("reafirma que a decisão é só do Núcleo (LEI 24)", () => {
    const r = computeDirectionalConsensus("SHORT", [src("A", "SHORT")]);
    expect(describeDirectionalConsensus(r)).toMatch(/LEI 24/);
  });

  it("nomeia a divergência quando ela existe, nunca esconde", () => {
    const r = computeDirectionalConsensus("LONG", [src("A", "LONG"), src("B", "SHORT")]);
    expect(describeDirectionalConsensus(r)).toMatch(/lado contr[áa]rio/i);
  });

  it("sem direção do Núcleo, explica que não há referência", () => {
    const r = computeDirectionalConsensus(null, [src("A", "LONG")]);
    expect(describeDirectionalConsensus(r)).toMatch(/não emite direção/i);
  });
});

describe("computeLiquidityMap — onde buscar liquidez, acima e abaixo", () => {
  const alvos = [
    { price: 105, kind: "FVG" },
    { price: 110, kind: "OB" },
    { price: 95, kind: "FVG" },
  ];

  it("separa corretamente acima e abaixo do preço", () => {
    const m = computeLiquidityMap(100, alvos);
    expect(m.status).toBe("OK");
    expect(m.above.count).toBe(2);
    expect(m.below.count).toBe(1);
  });

  it("a mais próxima é a PRIMEIRA que o preço encontraria, não a maior", () => {
    const m = computeLiquidityMap(100, alvos);
    expect(m.above.nearest!.price).toBe(105); // não 110
    expect(m.above.distancePercent).toBeCloseTo(5, 10);
    expect(m.below.nearest!.price).toBe(95);
    expect(m.below.distancePercent).toBeCloseTo(5, 10);
  });

  it("zona exatamente no preço não conta para nenhum lado (já se está dentro)", () => {
    const m = computeLiquidityMap(100, [{ price: 100, kind: "FVG" }]);
    expect(m.above.count).toBe(0);
    expect(m.below.count).toBe(0);
    // E nunca é contada duas vezes.
    expect(m.above.count + m.below.count).toBe(0);
  });

  it("lado vazio é honesto: contagem 0 e distância null, nunca 0%", () => {
    const m = computeLiquidityMap(100, [{ price: 110, kind: "OB" }]);
    expect(m.below.count).toBe(0);
    expect(m.below.nearest).toBeNull();
    expect(m.below.distancePercent).toBeNull(); // 0% se leria como "colado"
  });

  it("descarta zonas com preço inválido em vez de propagar NaN", () => {
    const m = computeLiquidityMap(100, [
      { price: NaN, kind: "FVG" },
      { price: 0, kind: "OB" },
      { price: -5, kind: "FVG" },
      { price: 105, kind: "FVG" },
    ]);
    expect(m.above.count).toBe(1);
    expect(Number.isFinite(m.above.distancePercent!)).toBe(true);
  });

  it("fail-closed sem preço real", () => {
    for (const p of [null, undefined, NaN, 0, -1]) {
      expect(computeLiquidityMap(p as number, alvos).status, String(p)).toBe("DADOS_INSUFICIENTES");
    }
  });
});

describe("liquidityBias — para onde há mais alvo", () => {
  it("aponta o lado com mais zonas reais", () => {
    expect(liquidityBias(computeLiquidityMap(100, [{ price: 105, kind: "F" }, { price: 110, kind: "F" }, { price: 95, kind: "F" }]))).toBe("ACIMA");
    expect(liquidityBias(computeLiquidityMap(100, [{ price: 95, kind: "F" }, { price: 90, kind: "F" }, { price: 105, kind: "F" }]))).toBe("ABAIXO");
  });

  it("empate NÃO anuncia vencedor (seria inventar assimetria)", () => {
    expect(liquidityBias(computeLiquidityMap(100, [{ price: 105, kind: "F" }, { price: 95, kind: "F" }]))).toBeNull();
    expect(liquidityBias(computeLiquidityMap(100, []))).toBeNull();
  });

  it("sem leitura real, sem viés", () => {
    expect(liquidityBias(computeLiquidityMap(null, []))).toBeNull();
  });
});

describe("directional-consensus — disciplina do módulo", () => {
  const source = readFileSync(resolve(__dirname, "../src/nexus/directional-consensus.ts"), "utf8");

  it("é puro: zero rede, zero DOM, zero aleatório", () => {
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\bwindow\./);
    expect(source).not.toMatch(/\bdocument\./);
  });

  it("não recalcula nenhuma direção — só lê as que chegam prontas", () => {
    // Qualquer comparação de preço/média aqui seria uma segunda decisão.
    expect(source).not.toMatch(/\bsma\b/);
    expect(source).not.toMatch(/\bema\b/);
  });
});
