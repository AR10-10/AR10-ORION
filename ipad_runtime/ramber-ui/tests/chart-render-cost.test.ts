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

// ---------------------------------------------------------------------------
// LEGIBILIDADE DE PAINEL FLUTUANTE — achado de captura real (BTC/USDT 15m
// com o painel CAMADAS DO GRÁFICO aberto): dava para LER o texto do gráfico
// através do painel.
//
// Causa: `.cyber-panel` define `background` no atalho, incluindo um
// `linear-gradient` de 72–86% de opacidade que é pintado POR CIMA da cor de
// fundo — a classe utilitária de 98% não vencia. Somado ao
// `backdrop-filter: blur`, o que passava virava borrão.
// ---------------------------------------------------------------------------
describe('painel que flutua sobre o gráfico é opaco', () => {
  const css = () => read("../src/index.css");

  /**
   * className real da casca do dropdown de camadas.
   *
   * ANCORAGEM DELIBERADA (a primeira versão deste helper estava errada e o
   * teste ficou vermelho por isso): "CAMADAS DO GRÁFICO" aparece DUAS vezes
   * em App.tsx — num comentário de seção ~340 linhas antes, e no JSX real.
   * `indexOf` pegava o comentário e a janela caía no meio de outro
   * componente. Ancorar em `>CAMADAS DO GRÁFICO<` só casa o nó de texto JSX,
   * e daí subimos até o className da casca em vez de contar caracteres.
   */
  const cascaDoPainel = (): string => {
    const src = app();
    const i = src.indexOf(">CAMADAS DO GRÁFICO<");
    expect(i, "título do painel de camadas não encontrado no JSX").toBeGreaterThan(-1);
    const antes = src.slice(0, i);
    const j = antes.lastIndexOf('className="!fixed !z-[1001]');
    expect(j, "casca do dropdown de camadas não encontrada").toBeGreaterThan(-1);
    const fim = antes.indexOf('"', j + 'className="'.length);
    return antes.slice(j, fim);
  };

  it('existe um modificador que desliga o gradiente de vidro', () => {
    const src = css();
    expect(src).toContain(".cyber-panel--solid");
    // Sem isto o gradiente do .cyber-panel continua vencendo.
    expect(src).toMatch(/\.cyber-panel--solid \{[^}]*background-image: none/);
    expect(src).toMatch(/\.cyber-panel--solid \{[^}]*background-color:/);
  });

  it('o painel de camadas usa o modificador — é ele que fica sobre as velas', () => {
    expect(cascaDoPainel()).toContain("cyber-panel--solid");
  });

  it('a classe utilitária de opacidade que NÃO funcionava saiu junto', () => {
    // Mantê-la seria deixar no código a impressão de que o painel é 98%
    // opaco quando o gradiente o torna 72–86%.
    expect(cascaDoPainel()).not.toContain("bg-[#010308]/98");
  });

  it('o modificador acompanha a classe base — sozinho ele não tem borda nem padding', () => {
    // `--solid` só desliga o gradiente. Sem `.cyber-panel` junto, o painel
    // perderia borda, sombra e tipografia de painel.
    const casca = cascaDoPainel();
    expect(casca).toContain("cyber-panel ");
    expect(casca.indexOf("cyber-panel ")).toBeLessThan(casca.indexOf("cyber-panel--solid"));
  });
});
