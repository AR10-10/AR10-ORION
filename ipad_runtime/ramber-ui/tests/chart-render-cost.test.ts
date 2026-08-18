// Custo de renderização do gráfico — guarda contra a regressão mais cara
// que este app pode sofrer sem ninguém notar.
//
// MEDIÇÃO QUE ORIGINOU ESTE ARQUIVO (relato do Operador: "está muito
// pesado"):
//
//   App.tsx                          ~12.000 linhas, UM componente
//   ORDER_BOOK_THROTTLE_MS           200 → 5 atualizações por segundo
//   React.memo no projeto inteiro    2, ambos em componentes minúsculos
//   EnhancedChart_110_Percent        NÃO era memoizado
//
// Ou seja: o componente mais pesado do app — com 16 plugins de canvas como
// filhos — re-reconciliava cinco vezes por segundo, mesmo quando nenhuma
// prop que ele lê tinha mudado. Num iPad isso é o suficiente para o app
// "parecer travado" sem que exista nenhum erro.
//
// Estes testes não medem FPS (não há dispositivo aqui). Eles travam a
// CONDIÇÃO ESTRUTURAL que torna o memo eficaz — se ela se perder, o ganho
// some silenciosamente e o app fica pesado de novo sem nenhum teste
// vermelho para avisar.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf-8");
const chart = () => read("../src/chart/EnhancedChart_110_Percent.tsx");
const app = () => read("../src/App.tsx");

describe("EnhancedChart_110_Percent é memoizado", () => {
  it("a implementação é privada e o export público passa por memo", () => {
    const src = chart();
    expect(src).toContain("function EnhancedChart_110_PercentImpl(");
    expect(src).toContain("export const EnhancedChart_110_Percent = memo(EnhancedChart_110_PercentImpl)");
  });

  it("o nome público não mudou — nenhum chamador ou teste precisou ser tocado", () => {
    // Se a memoização tivesse renomeado o export, este import quebraria.
    expect(app()).toContain("EnhancedChart_110_Percent");
    expect(chart()).toContain("export const EnhancedChart_110_Percent");
  });

  it("memo vem do react, nunca uma reimplementação caseira de comparação", () => {
    expect(chart()).toMatch(/import \{[^}]*\bmemo\b[^}]*\} from "react"/);
  });
});

describe("a condição que faz o memo funcionar — props referencialmente estáveis", () => {
  /** Extrai as props do call site real do gráfico em App.tsx. */
  const chartProps = (): Array<{ name: string; value: string }> => {
    const src = app();
    const m = src.match(/<EnhancedChart_110_Percent\b([\s\S]*?)\/>/);
    expect(m, "call site do gráfico não encontrado em App.tsx").not.toBeNull();
    return [...m![1].matchAll(/(\w+)=\{([^}]*)\}/g)].map((x) => ({
      name: x[1],
      value: x[2].trim(),
    }));
  };

  it("o call site passa um número real de props (a extração está mesmo funcionando)", () => {
    expect(chartProps().length).toBeGreaterThan(20);
  });

  it("NENHUMA prop cria array ou objeto novo inline — é isso que torna a comparação rasa útil", () => {
    // Uma única prop `algo={[...]}` ou `algo={{...}}` no call site cria
    // identidade nova a cada render do App e ANULA o memo por completo,
    // sem quebrar nada visível. É exatamente a regressão que este teste
    // existe para pegar.
    const culpadas = chartProps().filter(
      (p) => p.value.startsWith("[") || p.value.startsWith("{") || p.value.includes(".map(") || p.value.includes(".filter("),
    );
    expect(culpadas.map((p) => `${p.name}={${p.value}}`)).toEqual([]);
  });

  it("nenhuma prop passa uma arrow criada no lugar — mesma armadilha, forma diferente", () => {
    const arrows = chartProps().filter((p) => p.value.includes("=>"));
    expect(arrows.map((p) => p.name)).toEqual([]);
  });
});

describe("frequência real de atualização que justifica tudo isso", () => {
  it("o livro de ofertas é throttled — sem isso seriam ~10 renders/s, não 5", () => {
    const src = app();
    expect(src).toContain("ORDER_BOOK_THROTTLE_MS");
    const m = src.match(/ORDER_BOOK_THROTTLE_MS = (\d+)/);
    expect(m, "constante de throttle não encontrada").not.toBeNull();
    const ms = Number(m![1]);
    // Se alguém baixar isso, o custo por segundo sobe na mesma proporção.
    expect(ms).toBeGreaterThanOrEqual(200);
  });
});
