// Suíte da forma curta dos membros de Zona Institucional.
//
// DEFEITO RELATADO (Operador, duas mensagens sobre a mesma coisa): "nome
// Grandão, um monte de letra... mais padrão, mais profissional" e, sobre a
// tela atual, "o tamanho das etiquetas".
//
// MEDIDO NAS CAPTURAS REAIS: 43 caracteres em ZEC/USDT 15m, 40 em
// WLFI/USDT 15m — a etiqueta atravessava as velas na horizontal.
//
// A regra que mais importa neste arquivo NÃO é "ficou curto": é que NADA
// foi apagado (Regra de Ouro 4). Encurtar rótulo é fácil; encurtar sem
// esconder ferramenta nenhuma é o que precisa de teste.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { zoneMemberCode, formatZoneMemberList } from "../src/nexus/zone-member-codes";

describe("o defeito relatado — a etiqueta atravessava as velas", () => {
  it("o caso real da captura ZEC/USDT encurta bem mais que a metade", () => {
    const antes = "VWAP + FVG Baixa ×2 + Sweep ×2 + Nexus Line";
    const depois = formatZoneMemberList(["VWAP", "FVG Baixa", "FVG Baixa", "Sweep", "Sweep", "Nexus Line"]);
    expect(depois).toBe("VWAP + FVG↓×2 + SWP×2 + NL");
    expect(depois.length).toBeLessThan(antes.length * 0.7);
  });

  it("o caso real da captura WLFI/USDT também", () => {
    const depois = formatZoneMemberList(["EMA21", "Sweep", "VWAP", "POC", "Sessão Alta"]);
    expect(depois).toBe("EMA21 + SWP + VWAP + POC + SES↑");
    expect(depois.length).toBeLessThan("EMA21 + Sweep + VWAP + POC + Sessão Alta".length);
  });
});

describe("NADA é apagado — a parte que realmente precisa de teste", () => {
  const todos = [
    "VWAP", "Nexus Line", "S1", "R1", "FVG Alta", "FVG Baixa", "OB Alta",
    "OB Baixa", "EQH", "EQL", "POC", "Sessão Alta", "Sessão Baixa", "Sweep",
    "Swing H", "Swing L", "EMA21",
  ];

  it("a quantidade de itens exibidos é sempre a de ferramentas distintas", () => {
    const saida = formatZoneMemberList(todos);
    expect(saida.split(" + ")).toHaveLength(todos.length);
  });

  it("nenhum código colide com outro — duas ferramentas nunca viram o mesmo texto", () => {
    // Uma colisão faria duas ferramentas distintas agregarem como se fossem
    // a mesma ("×2"), inventando uma confluência que não existe.
    const codigos = todos.map(zoneMemberCode);
    expect(new Set(codigos).size).toBe(todos.length);
  });

  it("nunca existe um '+N outros' escondendo ferramenta", () => {
    const saida = formatZoneMemberList(todos);
    expect(saida).not.toMatch(/\+\s*\d+\s*(outros|mais|more)/i);
    expect(saida).not.toContain("…");
    expect(saida).not.toContain("...");
  });

  it("a ordem é a que o motor produziu — nunca reordenada aqui", () => {
    const saida = formatZoneMemberList(["POC", "VWAP", "S1"]);
    expect(saida).toBe("POC + VWAP + S1");
  });

  it("a agregação por contagem continua idêntica ao comportamento anterior", () => {
    expect(formatZoneMemberList(["Sweep", "Sweep", "Sweep"])).toBe("SWP×3");
    expect(formatZoneMemberList(["Sweep"])).toBe("SWP");
  });
});

describe("direção nunca se perde no encurtamento", () => {
  it("alta e baixa continuam distinguíveis em todo par direcional", () => {
    for (const [alta, baixa] of [
      ["FVG Alta", "FVG Baixa"],
      ["OB Alta", "OB Baixa"],
      ["Sessão Alta", "Sessão Baixa"],
      ["Swing H", "Swing L"],
    ] as const) {
      expect(zoneMemberCode(alta)).not.toBe(zoneMemberCode(baixa));
      expect(zoneMemberCode(alta)).toContain("↑");
      expect(zoneMemberCode(baixa)).toContain("↓");
    }
  });

  it("EQH e EQL não ganham seta — a própria sigla já carrega a direção", () => {
    expect(zoneMemberCode("EQH")).toBe("EQH");
    expect(zoneMemberCode("EQL")).toBe("EQL");
  });

  it("o período da EMA nunca é removido — a informação está no número", () => {
    expect(zoneMemberCode("EMA21")).toBe("EMA21");
    expect(zoneMemberCode("EMA200")).toBe("EMA200");
  });
});

describe("fail-closed", () => {
  it("rótulo desconhecido volta INTEIRO, nunca cortado no meio", () => {
    // Um motor novo cujo label ainda não foi mapeado aparece por extenso —
    // longo, porém correto — em vez de virar uma sigla inventada.
    expect(zoneMemberCode("Ferramenta Nova Qualquer")).toBe("Ferramenta Nova Qualquer");
    expect(zoneMemberCode("")).toBe("");
  });

  it("lista vazia devolve string vazia, nunca um placeholder", () => {
    expect(formatZoneMemberList([])).toBe("");
  });
});

describe("fiação — o gráfico usa a fonte única, não uma segunda régua", () => {
  const chart = () =>
    readFileSync(resolve(__dirname, "../src/chart/EnhancedChart_110_Percent.tsx"), "utf-8");

  it("a composição inline morreu", () => {
    const src = chart();
    expect(src).not.toMatch(/const labelCounts = new Map<string, number>\(\);/);
    expect(src).toContain("formatZoneMemberList(zone.members.map((m) => m.label))");
  });

  it("a contagem de fontes (o Nível 1 da etiqueta) não foi tocada", () => {
    // O encurtamento é só do Nível 2. "4F" continua vindo do mesmo
    // distinctSourceCount real.
    expect(chart()).toContain("text: `${zone.distinctSourceCount}F`");
  });
});
