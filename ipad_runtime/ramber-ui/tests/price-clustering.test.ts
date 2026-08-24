// Suíte de EXECUÇÃO REAL do agrupamento por âncora fixa
// (research/engines/price-clustering.js).
//
// POR QUE O MÓDULO EXISTE (auditoria pedida pelo Operador: "não tiver coisa
// repetida"). O MESMO algoritmo estava escrito TRÊS vezes:
//
//   src/research/engines/fvg-order-block-engine.js  clusterEqualLevels()
//   ramber-ui/src/nexus/institutional-zones.ts      agrupamento de membros
//   ramber-ui/src/nexus/trap-detection.ts           clusterSweptPrices()
//
// Mesma remediação, e o mesmo lugar, que `fractal-swings.js` já tinha
// recebido quando `findSwings` estava triplicado nesta pasta.
//
// A ARMADILHA REAL encontrada ao extrair: as três cópias não usavam a mesma
// UNIDADE. O motor comparava `|p−a| / a <= 0.0015` (fração) numa constante
// chamada EQUAL_TOLERANCE_**PCT**; as outras duas comparavam
// `|p−a| * 100 / a <= 0.35` (percentual). Mesmo tipo de número, três vezes
// menos óbvio — e impossível comparar as tolerâncias entre si sem converter
// de cabeça. A fonte única aceita PERCENTUAL, a unidade das duas constantes
// já exportadas do projeto.
//
// Aqui o bug provável é "a regra de agrupamento está sutilmente errada" —
// então tudo abaixo executa a função de verdade.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clusterByPriceProximity } from "../../src/research/engines/price-clustering.js";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const preco = (x: { price: number }) => x.price;
const precos = (grupos: { price: number }[][]) => grupos.map((g) => g.map((x) => x.price));

describe("âncora FIXA, nunca média rodante — a propriedade que define o algoritmo", () => {
  it("um grupo nunca fica mais largo que a própria tolerância", () => {
    // Com média rodante, esta cadeia viraria UM grupo só: cada item está a
    // 0,1% do anterior. Com âncora fixa, o grupo para onde a tolerância
    // manda. É exatamente a diferença que os três comentários originais
    // descreviam ("evita encadear swings afastados um a um").
    const itens = [{ price: 100 }, { price: 100.1 }, { price: 100.2 }, { price: 100.3 }, { price: 100.4 }];
    const grupos = clusterByPriceProximity(itens, preco, 0.15);
    expect(grupos.length).toBeGreaterThan(1);
    for (const g of grupos) {
      const largura = ((g[g.length - 1].price - g[0].price) * 100) / g[0].price;
      expect(largura).toBeLessThanOrEqual(0.15 + 1e-9);
    }
  });

  it("a âncora é o PRIMEIRO do grupo, e o grupo reinicia quando ela é ultrapassada", () => {
    const itens = [{ price: 100 }, { price: 100.1 }, { price: 100.2 }];
    // 100.1 está a 0,1% de 100 (entra). 100.2 está a 0,2% de 100 (sai).
    expect(precos(clusterByPriceProximity(itens, preco, 0.15))).toEqual([[100, 100.1], [100.2]]);
  });

  it("ordena por preço antes de agrupar — entrada fora de ordem dá o mesmo resultado", () => {
    const a = clusterByPriceProximity([{ price: 100.2 }, { price: 100 }, { price: 100.1 }], preco, 0.15);
    const b = clusterByPriceProximity([{ price: 100 }, { price: 100.1 }, { price: 100.2 }], preco, 0.15);
    expect(precos(a)).toEqual(precos(b));
  });
});

describe("a unidade é PERCENTUAL — a armadilha que motivou a extração", () => {
  it("0.15 significa 0,15%, nunca 15%", () => {
    // Se a função interpretasse fração, 100 e 110 (10% de distância)
    // cairiam no mesmo grupo com tolerância 0.15.
    expect(precos(clusterByPriceProximity([{ price: 100 }, { price: 110 }], preco, 0.15))).toEqual([[100], [110]]);
  });

  it("o valor do motor equivale exatamente à fração antiga", () => {
    // 0.0015 fração === 0.15 percentual. Um par CONFORTAVELMENTE dentro da
    // tolerância continua junto; um fora continua separado.
    expect(precos(clusterByPriceProximity([{ price: 100 }, { price: 100.1 }], preco, 0.15))).toEqual([
      [100, 100.1],
    ]);
    expect(precos(clusterByPriceProximity([{ price: 100 }, { price: 100.2 }], preco, 0.15))).toEqual([
      [100],
      [100.2],
    ]);
  });

  it("o limite EXATO cai do mesmo lado que caía antes — nunca foi um contrato", () => {
    // Escrito depois de o teste anterior falhar na versão errada. Um par a
    // "exatamente" 0,15% NÃO fica junto: (100.15−100)*100/100 dá
    // 0.15000000000000568 em ponto flutuante. A régua ANTIGA fazia a mesma
    // conta na outra unidade (0.0015000000000000568 <= 0.0015, também
    // falso) — comportamento idêntico, e o probe diferencial de 200 séries
    // confirmou zero divergência. Fica travado aqui para que uma mudança
    // futura nessa borda seja uma decisão, nunca um acidente.
    expect(precos(clusterByPriceProximity([{ price: 100 }, { price: 100.15 }], preco, 0.15))).toEqual([
      [100],
      [100.15],
    ]);
  });
});

describe("fail-closed", () => {
  it("lista vazia ou não-array devolve []", () => {
    expect(clusterByPriceProximity([], preco, 0.35)).toEqual([]);
    expect(clusterByPriceProximity(null as unknown as [], preco, 0.35)).toEqual([]);
  });

  it("tolerância inválida nunca vira um agrupamento inventado", () => {
    const itens = [{ price: 100 }, { price: 100.1 }];
    for (const t of [NaN, -1, Infinity]) {
      expect(clusterByPriceProximity(itens, preco, t), `tolerância ${t}`).toEqual([]);
    }
  });

  it("item com preço não-finito é descartado, nunca arrasta o grupo", () => {
    // Um NaN no meio faria TODA comparação seguinte ser falsa, e o
    // resultado seria silenciosamente diferente do esperado.
    const itens = [{ price: 100 }, { price: NaN }, { price: 100.1 }];
    expect(precos(clusterByPriceProximity(itens, preco, 0.15))).toEqual([[100, 100.1]]);
  });

  it("preço zero nunca gera divisão por zero — vira grupo próprio", () => {
    const itens = [{ price: 0 }, { price: 0 }, { price: 100 }];
    const grupos = clusterByPriceProximity(itens, preco, 0.35);
    expect(grupos.every((g) => g.every((x) => Number.isFinite(x.price)))).toBe(true);
    expect(grupos.flat()).toHaveLength(3);
  });

  it("tolerância zero: só preços exatamente iguais ficam juntos", () => {
    const itens = [{ price: 100 }, { price: 100 }, { price: 100.0001 }];
    expect(precos(clusterByPriceProximity(itens, preco, 0))).toEqual([[100, 100], [100.0001]]);
  });
});

describe("nenhum item se perde nem se duplica", () => {
  it("a soma dos grupos é sempre o total de itens válidos", () => {
    const itens = Array.from({ length: 50 }, (_, i) => ({ price: 100 + i * 0.07 }));
    const grupos = clusterByPriceProximity(itens, preco, 0.15);
    expect(grupos.flat()).toHaveLength(itens.length);
    expect(new Set(grupos.flat().map((x) => x.price)).size).toBe(itens.length);
  });

  it("cada grupo sai ordenado por preço crescente", () => {
    const itens = Array.from({ length: 30 }, (_, i) => ({ price: 100 + ((i * 37) % 30) * 0.02 }));
    for (const g of clusterByPriceProximity(itens, preco, 0.15)) {
      for (let i = 1; i < g.length; i++) expect(g[i].price).toBeGreaterThanOrEqual(g[i - 1].price);
    }
  });
});

// ---------------------------------------------------------------------------
// FIAÇÃO: as três cópias morreram de verdade.
// ---------------------------------------------------------------------------
describe("as três cópias do laço morreram", () => {
  const alvos = [
    ["../../src/research/engines/fvg-order-block-engine.js", "motor SMC"],
    ["../src/nexus/institutional-zones.ts", "Zonas Institucionais"],
    ["../src/nexus/trap-detection.ts", "clusters de sweep"],
  ] as const;

  it("nenhum dos três recopia a comparação de âncora", () => {
    for (const [caminho, nome] of alvos) {
      const src = read(caminho);
      // Forma EXECUTÁVEL, nunca a string solta: a regra aparece de propósito
      // nos comentários que explicam por que a cópia morreu.
      expect(src, `${nome} ainda recopia a comparação`).not.toMatch(
        /const closeEnough =\s*anchor !== 0/,
      );
      expect(src, `${nome} ainda compara com âncora inline`).not.toMatch(
        /anchor !== 0 && Math\.abs\(/,
      );
    }
  });

  it("os três importam a fonte única", () => {
    for (const [caminho, nome] of alvos) {
      expect(read(caminho), `${nome} não importa a fonte única`).toContain("price-clustering");
      expect(read(caminho), `${nome} não chama a fonte única`).toContain("clusterByPriceProximity(");
    }
  });

  it("a REDUÇÃO de cada consumidor continua sendo dele — só o agrupamento foi extraído", () => {
    // O que cada um faz com um grupo é específico e não podia ser unificado:
    // o motor calcula preço médio/toques/swept, as zonas calculam
    // top/bottom/fontes distintas, os sweeps calculam latestIndex.
    expect(read("../../src/research/engines/fvg-order-block-engine.js")).toContain("touchIndices");
    expect(read("../src/nexus/institutional-zones.ts")).toContain("distinctSourceCount");
    expect(read("../src/nexus/trap-detection.ts")).toContain("latestIndex: Math.max(");
  });

  it("a constante do motor deixou de mentir sobre a própria unidade", () => {
    const src = read("../../src/research/engines/fvg-order-block-engine.js");
    expect(src).toContain("const EQUAL_TOLERANCE_PCT = 0.15;");
    expect(src).not.toContain("const EQUAL_TOLERANCE_PCT = 0.0015;");
  });
});
