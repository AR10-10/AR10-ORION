// Suíte do `basis` — a lacuna nomeada na Camada B do AR10 Research Book.
//
// SITUAÇÃO ANTERIOR (achado real, docs/MAPA_LACUNAS_RESEARCH_BOOK_2026-08-18.md):
// o basis era CALCULADO de verdade no provedor GMIL (mark vs index) e ao
// mesmo tempo devolvido como DADOS_INSUFICIENTES pelo research-engine, com
// o comentário "nenhum conector compara spot vs futuros nesta fase" — que
// tinha envelhecido: o conector passou a existir e já consultava
// premiumIndex, só descartava o indexPrice.
//
// Ligar os dois lados tinha uma armadilha óbvia: copiar a fórmula para o
// segundo lugar. Estes testes existem para provar que isso NÃO aconteceu —
// existe uma definição, com dois consumidores.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeBasisPct } from "../../js/real-data/derivatives-math.js";

describe("computeBasisPct — matemática real", () => {
  it("perpétuo acima do índice = prêmio positivo", () => {
    // mark 101 sobre index 100 = +1%
    expect(computeBasisPct(101, 100)).toBeCloseTo(1, 10);
  });

  it("perpétuo abaixo do índice = desconto negativo", () => {
    expect(computeBasisPct(99, 100)).toBeCloseTo(-1, 10);
  });

  it("par exato = zero real (não é o mesmo que ausência de leitura)", () => {
    expect(computeBasisPct(100, 100)).toBe(0);
  });

  it("preços grandes mantêm precisão proporcional", () => {
    expect(computeBasisPct(68_500, 68_000)).toBeCloseTo((500 / 68_000) * 100, 10);
  });
});

describe("computeBasisPct — fail-closed", () => {
  it("preço ausente devolve null, NUNCA zero", () => {
    // Zero se leria como "perpétuo no par com o spot"; o que houve foi
    // "sem leitura". A diferença é a Regra de Ouro 3 inteira.
    for (const [m, i] of [
      [null, 100],
      [100, null],
      [undefined, undefined],
      [NaN, 100],
      [100, NaN],
    ] as Array<[unknown, unknown]>) {
      expect(computeBasisPct(m as number, i as number)).toBeNull();
    }
  });

  it("preço não-positivo é leitura inválida, não um número a dividir", () => {
    expect(computeBasisPct(0, 100)).toBeNull();
    expect(computeBasisPct(100, 0)).toBeNull(); // divisão por zero jamais acontece
    expect(computeBasisPct(-5, 100)).toBeNull();
    expect(computeBasisPct(100, -5)).toBeNull();
  });

  it("string numérica é aceita (o JSON da exchange vem assim)", () => {
    expect(computeBasisPct("101" as unknown as number, "100" as unknown as number)).toBeCloseTo(1, 10);
  });
});

describe("basis — uma definição, dois consumidores", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

  it("o conector por ativo importa a fórmula, não a recopia", () => {
    const conector = read("../../js/real-data/binance-futures-public.js");
    expect(conector).toContain("computeBasisPct");
    expect(conector).toContain("derivatives-math.js");
    // A conta em si não pode aparecer aqui.
    expect(conector).not.toMatch(/markPrice\s*-\s*indexPrice/);
  });

  it("o provedor GMIL importa a mesma fórmula, não a recopia", () => {
    const gmil = read("../src/gmil/providers/derivatives-provider.ts");
    expect(gmil).toContain("computeBasisPct");
    expect(gmil).toContain("derivatives-math.js");
    expect(gmil).not.toMatch(/\(\s*markPrice\s*-\s*indexPrice\s*\)\s*\/\s*indexPrice/);
  });

  it("o conector publica index_price e basis_pct no Evidence Object", () => {
    const conector = read("../../js/real-data/binance-futures-public.js");
    expect(conector).toContain("index_price:");
    expect(conector).toContain("basis_pct:");
  });

  it("research-engine consome o basis real e não devolve mais DADOS_INSUFICIENTES fixo", () => {
    const engine = read("../../js/research/research-engine.js");
    expect(engine).toContain("evidence.funding.basis_pct");
    // O comentário obsoleto tem de ter saído junto com a linha morta.
    expect(engine).not.toContain("nenhum conector compara spot vs futuros");
  });
});
