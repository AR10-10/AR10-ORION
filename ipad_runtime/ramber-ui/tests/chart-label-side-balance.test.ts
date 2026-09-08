// chart-label-side-balance.test.ts — §2/§3 da ordem "NÚCLEO +
// POSICIONAMENTO INTELIGENTE": o sistema deve DECIDIR o lado por medição,
// e o gatilho real citado pelo Operador é o ativo de preço alto
// ("79,405.00 aperta a lateral").
//
// Execução real: a pergunta aqui é "os números estão certos?" (orçamento,
// qual migra, quantas migram), nunca "esqueceram de ligar A com B".
import { describe, it, expect } from "vitest";
import {
  resolveLabelSideBalance,
  LABEL_COLUMN_BUDGET_FRACTION,
  type SideBalanceLabel,
} from "../src/chart/chart-label-side-balance";
import { CHART_LEFT_EDGE_FRACTION } from "../src/chart/chart-profile-lanes";

const PLOT = 800; // px desenháveis
const BUDGET = PLOT * LABEL_COLUMN_BUDGET_FRACTION; // 112px

const label = (id: string, widthPx: number, tier: SideBalanceLabel["tier"]): SideBalanceLabel => ({ id, widthPx, tier });

describe("o orçamento reusa um limiar já declarado — nunca um número novo", () => {
  it("LABEL_COLUMN_BUDGET_FRACTION é exatamente CHART_LEFT_EDGE_FRACTION", () => {
    expect(LABEL_COLUMN_BUDGET_FRACTION).toBe(CHART_LEFT_EDGE_FRACTION);
    expect(LABEL_COLUMN_BUDGET_FRACTION).toBe(0.14);
  });
});

describe("caso comum: coluna dentro do orçamento não mexe em nada", () => {
  it("nada migra e a razão diz por quê", () => {
    const d = resolveLabelSideBalance(
      [label("live", 60, "live"), label("s1", 55, "context")],
      [label("choch", 40, "context")],
      PLOT,
    );
    expect(d.migrateToLeft).toEqual([]);
    expect(d.reason).toContain("dentro do orçamento");
    expect(d.rightDemandPx).toBe(60);
    expect(d.budgetPx).toBeCloseTo(BUDGET, 10);
  });
});

describe("§3: o cenário literal do Operador — preço alto aperta a lateral", () => {
  it("o contexto largo migra quando a esquerda JÁ paga aquela largura (carona grátis)", () => {
    // O caso real do AR10: a esquerda já carrega 15 etiquetas estruturais,
    // então ela já ocupa largura — absorver mais uma não custa coluna nova.
    const right = [
      label("preco_vivo", 105, "live"),
      label("vwap", 100, "primary"),
      label("vpoc_79405", 150, "context"), // a mais larga: é ela que estoura
    ];
    const d = resolveLabelSideBalance(right, [label("estrutura", 160, "context")], PLOT);
    expect(d.rightDemandPx).toBe(150);
    expect(d.rightDemandPx).toBeGreaterThan(d.budgetPx);
    // 150 <= largura que a esquerda já ocupa (160) => migra de graça.
    expect(d.migrateToLeft).toEqual(["vpoc_79405"]);
    expect(d.migrateToLeft).not.toContain("preco_vivo");
    expect(d.migrateToLeft).not.toContain("vwap");
  });

  it("ataca sempre a MAIS LARGA — migrar qualquer outra não encolheria a coluna em 1px", () => {
    const d = resolveLabelSideBalance(
      [label("estreita", 120, "context"), label("larguissima", 200, "context"), label("media", 140, "context")],
      [label("ja_la", 220, "context")], // esquerda já paga 220
      PLOT,
    );
    // Ordem real de ataque: sempre a maior que restou.
    expect(d.migrateToLeft).toEqual(["larguissima", "media", "estreita"]);
  });

  it("para assim que o que SOBRA cabe — nunca esvazia a direita à toa", () => {
    const d = resolveLabelSideBalance(
      [label("gigante", 300, "context"), label("cabe_bem", 80, "context"), label("cabe_tambem", 70, "context")],
      [label("ja_la", 300, "context")],
      PLOT,
    );
    // Só a gigante precisa sair: sem ela a demanda cai para 80 (< 112).
    expect(d.migrateToLeft).toEqual(["gigante"]);
  });

  it("com a esquerda VAZIA, só migra quem cabe no próprio orçamento — abrir uma coluna nova de 150px seria trocar de problema", () => {
    const d = resolveLabelSideBalance(
      [label("vpoc_larga", 150, "context"), label("outra", 130, "context")],
      [],
      PLOT,
    );
    expect(d.migrateToLeft).toEqual([]);
    expect(d.reason).toContain("estouraria a esquerda");
  });
});

describe("hierarquia inviolável: leitura primária nunca sai de perto do eixo", () => {
  it("live/critical/primary NUNCA migram, mesmo estourando o orçamento", () => {
    for (const tier of ["live", "critical", "primary"] as const) {
      const d = resolveLabelSideBalance([label("x", 400, tier)], [], PLOT);
      expect(d.migrateToLeft).toEqual([]);
      expect(d.reason).toContain("nunca migra");
    }
  });

  it("quando a MAIS LARGA é o plano ativo (TP/ST), nada migra — mover o contexto abaixo dela não encolheria a coluna", () => {
    const d = resolveLabelSideBalance(
      [label("TP1", 300, "critical"), label("vpoc", 200, "context")],
      [label("ja_la", 300, "context")], // esquerda até aceitaria a vpoc
      PLOT,
    );
    // Ainda assim não migra: a coluna é ditada pelo TP1 (300), que fica.
    // Migrar a vpoc seria movimento sem 1px de ganho — ruído visual.
    expect(d.migrateToLeft).toEqual([]);
    expect(d.reason).toContain("leitura primária");
    expect(d.rightDemandPx).toBe(300);
  });
});

describe("nunca troca um problema por outro", () => {
  it("não migra se a etiqueta estourar a coluna ESQUERDA vazia", () => {
    // 200px > orçamento de 112px e a esquerda não paga nada ainda: mover
    // só transfere a congestão para o outro lado.
    const d = resolveLabelSideBalance([label("enorme", 200, "context")], [], PLOT);
    expect(d.migrateToLeft).toEqual([]);
    expect(d.reason).toContain("estouraria a esquerda");
  });

  it("a esquerda que JÁ existe é o teto real — o que passa dela não migra", () => {
    // Esquerda paga 110px. c1 (130) passa disso E do orçamento (112) => fica.
    const d = resolveLabelSideBalance(
      [label("c1", 130, "context"), label("c2", 100, "context")],
      [label("ja_esquerda", 110, "context")],
      PLOT,
    );
    expect(d.migrateToLeft).toEqual([]);
    expect(d.reason).toContain("estouraria a esquerda");
  });

  it("PROPRIEDADE do desenho: com a esquerda vazia, migração nunca acontece — e isso é correto, não conservadorismo", () => {
    // Prova aritmética: para migrar é preciso (a) a etiqueta ser a mais
    // larga E exceder o orçamento, e (b) caber em max(esquerda, orçamento).
    // Com a esquerda vazia esse teto É o orçamento — então (a) e (b) são
    // mutuamente exclusivas por construção. Abrir uma coluna esquerda nova
    // maior que o orçamento seria trocar de problema, nunca resolver.
    for (const w of [113, 150, 200, 400]) {
      const d = resolveLabelSideBalance([label("larga", w, "context"), label("ok", 50, "context")], [], PLOT);
      expect(d.migrateToLeft, `largura ${w} não deveria migrar com esquerda vazia`).toEqual([]);
    }
    // No AR10 real isto não é o caso comum: a coluna esquerda já carrega
    // 15 etiquetas estruturais estáticas, então ela já paga largura e a
    // carona sai de graça (ver o teste do cenário do Operador acima).
  });
});

describe("fail-closed e determinismo", () => {
  it("largura de plotagem inválida preserva a distribuição estática de hoje", () => {
    for (const bad of [0, -100, Number.NaN, Infinity]) {
      const d = resolveLabelSideBalance([label("a", 500, "context")], [], bad);
      expect(d.migrateToLeft).toEqual([]);
      expect(d.reason).toContain("não medida");
    }
  });

  it("entrada nula/vazia nunca quebra nem migra", () => {
    expect(resolveLabelSideBalance(null, undefined, PLOT).migrateToLeft).toEqual([]);
    expect(resolveLabelSideBalance([], [], PLOT).migrateToLeft).toEqual([]);
  });

  it("largura não-finita numa etiqueta é ignorada, nunca vira NaN na demanda", () => {
    const d = resolveLabelSideBalance(
      [label("boa", 50, "context"), { id: "ruim", widthPx: Number.NaN, tier: "context" }],
      [],
      PLOT,
    );
    expect(Number.isFinite(d.rightDemandPx)).toBe(true);
    expect(d.rightDemandPx).toBe(50);
  });

  it("empate de largura resolve por id (determinístico, nunca pela ordem de entrada)", () => {
    const a = resolveLabelSideBalance([label("zzz", 200, "context"), label("aaa", 200, "context")], [], 2000);
    const b = resolveLabelSideBalance([label("aaa", 200, "context"), label("zzz", 200, "context")], [], 2000);
    expect(a.migrateToLeft).toEqual(b.migrateToLeft);
  });

  it("mesma entrada => mesma saída, sempre (pura)", () => {
    const right = [label("a", 300, "context"), label("b", 90, "primary")];
    expect(resolveLabelSideBalance(right, [], PLOT)).toEqual(resolveLabelSideBalance(right, [], PLOT));
  });

  it("não muta as entradas", () => {
    const right = [label("a", 300, "context")];
    const left = [label("b", 50, "context")];
    const copiaR = JSON.parse(JSON.stringify(right));
    const copiaL = JSON.parse(JSON.stringify(left));
    resolveLabelSideBalance(right, left, PLOT);
    expect(right).toEqual(copiaR);
    expect(left).toEqual(copiaL);
  });
});

describe("LEI 24: geometria de apresentação, nunca decisão", () => {
  it("a decisão não expõe campo de direção, score ou probabilidade", () => {
    const chaves = Object.keys(resolveLabelSideBalance([label("a", 50, "context")], [], PLOT));
    for (const proibida of ["direction", "stance", "score", "confidence", "probability"]) {
      expect(chaves).not.toContain(proibida);
    }
  });
});
