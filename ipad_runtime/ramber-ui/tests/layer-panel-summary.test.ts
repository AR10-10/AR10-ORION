// Suíte de EXECUÇÃO REAL do resumo do painel de camadas.
//
// PEDIDO DO OPERADOR: "eu quero só UM modo, e ele é o modo inteligente...
// que apareça só as ferramentas necessárias pra o operador bater o olho e
// saber".
//
// DEFEITO REAL ENCONTRADO AO ATENDER: o painel e o CANVAS usavam resoluções
// DIFERENTES do que está visível —
//
//   painel  →  relevance.relevant     (só o gate de relevância)
//   canvas  →  autoDecision.show      (gate + TETO de competição)
//
// Em mercado ativo a maioria das camadas passa no gate e o teto derruba
// quase todas: o painel listava ~20 como "VISÍVEL" enquanto o gráfico
// desenhava 6. Nenhum erro, nenhum log — o painel mentindo sobre a própria
// tela. O teste mais importante deste arquivo é o primeiro: ele reproduz
// exatamente essa divergência e exige que ela não volte.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { summarizeLayerPanel, describeLayerPanel } from "../src/nexus/layer-panel-summary";
import { resolveAutoLayerVisibility, AUTO_LAYER_MAX_SIMULTANEOUS, AUTO_LAYER_PRECISION_ORDER } from "../src/nexus/layer-relevance";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const mods = (ids: string[]) => ids.map((id) => ({ id, label: id.toUpperCase() }));
const todosAuto = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, true]));
const nadaManual = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, false]));

describe("o defeito relatado — o painel dizia mais do que o gráfico desenhava", () => {
  it("com TODAS as camadas relevantes, o painel anuncia exatamente o teto, nunca todas", () => {
    const ids = [...AUTO_LAYER_PRECISION_ORDER];
    const relevancia = Object.fromEntries(
      ids.map((id) => [id, { relevant: true, emphasis: "normal" as const, reason: "leitura real" }]),
    );
    // A MESMA decisão que o canvas recebe.
    const decision = resolveAutoLayerVisibility(relevancia);
    const s = summarizeLayerPanel(mods(ids), decision, todosAuto(ids), nadaManual(ids));

    expect(s.ativas).toHaveLength(AUTO_LAYER_MAX_SIMULTANEOUS);
    // E o resto NÃO some da vista: aparece como "cedeu espaço".
    expect(s.cederam.length).toBeGreaterThan(0);
    expect(s.ativas.length + s.cederam.length + s.manuais.length + s.semLeitura.length).toBe(ids.length);
  });

  it("a régua ANTIGA (só relevance.relevant) anunciaria TODAS — a diferença que causava a queixa", () => {
    const ids = [...AUTO_LAYER_PRECISION_ORDER];
    const relevancia = Object.fromEntries(
      ids.map((id) => [id, { relevant: true, emphasis: "normal" as const, reason: "leitura real" }]),
    );
    const antigo = ids.filter((id) => relevancia[id].relevant).length;
    const agora = summarizeLayerPanel(mods(ids), resolveAutoLayerVisibility(relevancia), todosAuto(ids), nadaManual(ids)).ativas.length;
    expect(antigo).toBe(ids.length);
    expect(agora).toBeLessThan(antigo);
  });
});

describe("'cedeu espaço' NÃO é 'sem leitura real' — a distinção que sustenta a confiança", () => {
  it("suprimida pelo teto vai para `cederam`, nunca para `semLeitura`", () => {
    const s = summarizeLayerPanel(
      mods(["a", "b"]),
      {
        a: { show: false, reason: "perdeu a competição", suppressedByCap: true },
        b: { show: false, reason: "sem leitura real", suppressedByCap: false },
      },
      todosAuto(["a", "b"]),
      nadaManual(["a", "b"]),
    );
    expect(s.cederam.map((m) => m.id)).toEqual(["a"]);
    expect(s.semLeitura.map((m) => m.id)).toEqual(["b"]);
    expect(s.ativas).toHaveLength(0);
  });

  it("uma camada nunca aparece em duas listas ao mesmo tempo", () => {
    const ids = ["a", "b", "c", "d"];
    const s = summarizeLayerPanel(
      mods(ids),
      {
        a: { show: true, reason: "", suppressedByCap: false },
        b: { show: false, reason: "", suppressedByCap: true },
        c: { show: false, reason: "", suppressedByCap: false },
      },
      { a: true, b: true, c: true, d: false },
      { a: false, b: false, c: false, d: true },
    );
    const todos = [...s.ativas, ...s.cederam, ...s.manuais, ...s.semLeitura].map((m) => m.id);
    expect(new Set(todos).size).toBe(todos.length);
    expect(todos.sort()).toEqual(ids);
  });
});

describe("override do Operador nunca é reclassificado por heurística", () => {
  it("camada fixada à mão entra em `manuais`, mesmo com o teto cheio", () => {
    const s = summarizeLayerPanel(
      mods(["fixa", "auto"]),
      { auto: { show: true, reason: "", suppressedByCap: false } },
      { fixa: false, auto: true },
      { fixa: true, auto: false },
    );
    expect(s.manuais.map((m) => m.id)).toEqual(["fixa"]);
    expect(s.ativas.map((m) => m.id)).toEqual(["auto"]);
  });

  it("camada DESLIGADA à mão não é anunciada como ativa", () => {
    const s = summarizeLayerPanel(
      mods(["off"]),
      { off: { show: true, reason: "", suppressedByCap: false } }, // a decisão automática diria sim
      { off: false }, // mas o Operador assumiu o controle
      { off: false }, // e desligou
    );
    expect(s.ativas).toHaveLength(0);
    expect(s.manuais).toHaveLength(0);
    expect(s.semLeitura.map((m) => m.id)).toEqual(["off"]);
  });
});

describe("fail-closed", () => {
  it("sem decisão real ainda, NADA é anunciado como ativo", () => {
    // Anunciar seria exatamente o tipo de mentira que este módulo corrige.
    const ids = ["a", "b"];
    const s = summarizeLayerPanel(mods(ids), null, todosAuto(ids), nadaManual(ids));
    expect(s.ativas).toHaveLength(0);
    expect(s.semLeitura).toHaveLength(2);
  });

  it("camada sem entrada na decisão não vira ativa por omissão", () => {
    const s = summarizeLayerPanel(mods(["a", "nova"]), { a: { show: true, reason: "", suppressedByCap: false } }, todosAuto(["a", "nova"]), nadaManual(["a", "nova"]));
    expect(s.ativas.map((m) => m.id)).toEqual(["a"]);
    expect(s.semLeitura.map((m) => m.id)).toEqual(["nova"]);
  });

  it("lista de módulos vazia ou inválida nunca lança", () => {
    expect(() => summarizeLayerPanel([], null, {}, {})).not.toThrow();
    expect(summarizeLayerPanel([], null, {}, {}).ativas).toEqual([]);
  });
});

describe("a frase de estado diz a verdade, de relance", () => {
  it("conta o que está no gráfico", () => {
    const s = summarizeLayerPanel(
      mods(["a", "b"]),
      { a: { show: true, reason: "", suppressedByCap: false }, b: { show: true, reason: "", suppressedByCap: false } },
      todosAuto(["a", "b"]),
      nadaManual(["a", "b"]),
    );
    expect(describeLayerPanel(s)).toBe("2 no gráfico");
  });

  it("menciona fixadas e cedidas só quando existem", () => {
    const s = summarizeLayerPanel(
      mods(["a", "fixa", "cedeu"]),
      { a: { show: true, reason: "", suppressedByCap: false }, cedeu: { show: false, reason: "", suppressedByCap: true } },
      { a: true, fixa: false, cedeu: true },
      { a: false, fixa: true, cedeu: false },
    );
    const frase = describeLayerPanel(s);
    expect(frase).toContain("1 no gráfico");
    expect(frase).toContain("1 fixada por você");
    expect(frase).toContain("1 cedeu espaço");
  });
});

// ---------------------------------------------------------------------------
// FIAÇÃO: um modo só por padrão, e a mesma resolução dos dois lados.
// ---------------------------------------------------------------------------
describe("o painel virou UMA leitura, não uma parede de interruptores", () => {
  const app = () => read("../src/App.tsx");

  it("a parede de 26 camadas só existe dentro do avançado", () => {
    // Pedido literal: "eu quero só UM modo". O controle continua inteiro
    // (Regra de Ouro 4), um clique abaixo.
    expect(app()).toContain("{advancedPresetsOpen && CHART_LAYER_PANEL_MODULES.map(");
  });

  it("o painel lê a decisão do CANVAS, nunca resolve por conta própria", () => {
    const src = app();
    expect(src).toContain("const layerDecision = useChartLayerDecisionSnapshot();");
    expect(src).toContain("const on = isAuto ? (decisao?.show ?? false) : visibility[id];");
    // A régua antiga não pode ressuscitar em paralelo.
    expect(src).not.toContain("const on = isAuto ? (relevance?.relevant ?? true) : visibility[id];");
  });

  it("quem já computa a decisão é quem a publica — zero segundo cálculo", () => {
    const src = app();
    expect(src).toContain("setChartLayerDecision(autoDecision)");
    expect(src.match(/resolveAutoLayerVisibility\(/g)).toHaveLength(1);
  });

  it("o rótulo distingue 'cedeu espaço' de 'oculta' na própria tela", () => {
    expect(app()).toContain('{on ? "visível" : cedeuEspaco ? "cedeu espaço" : "oculta"}');
  });
});
