// ═══ A GUARDA DE INVERSÃO ═══
//
// "os short está invertido ou não? ... não pode estar errado nada, porque se
// tiver errado a direção a gente vai achar que vai subir e vem pro outro lado"
// (Operador).
//
// Inversão de direção é a classe de defeito mais cara deste terminal: não
// trava, não avisa, não aparece em log nenhum — só faz o Operador entrar no
// lado errado. Um teste que roda uma vez e diz "conferi" não resolve isso.
// Este arquivo varre o CÓDIGO REAL a cada build, então uma inversão
// introduzida num commit futuro quebra a suíte em vez da conta.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";
import {
  DIRECTION_COLOR,
  DIRECTION_ARROW,
  directionColor,
  directionArrow,
  FORBIDDEN_PAIRS,
} from "../src/nexus/direction-semantics";

const SRC = resolve(__dirname, "../src");
const app = readFileSync(resolve(SRC, "App.tsx"), "utf8");

/** Só linhas de CÓDIGO — comentários explicam defeitos e citariam os pares
 *  proibidos, dando falso positivo (armadilha já vista 3x neste repositório;
 *  a solução é mirar melhor, nunca afrouxar a guarda). */
function codeLines(src: string): string[] {
  return src.split("\n").filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  });
}

describe("contrato de direção — a convenção canônica", () => {
  it("LONG é verde e sobe; SHORT é vermelho e desce", () => {
    expect(DIRECTION_COLOR.LONG).toBe("#00ffaa");
    expect(DIRECTION_COLOR.SHORT).toBe("#ff0055");
    expect(DIRECTION_ARROW.LONG).toBe("▲");
    expect(DIRECTION_ARROW.SHORT).toBe("▼");
  });

  it("as três direções têm cores DISTINTAS (senão a distinção não existe)", () => {
    const cores = new Set(Object.values(DIRECTION_COLOR));
    expect(cores.size).toBe(3);
    const setas = new Set(Object.values(DIRECTION_ARROW));
    expect(setas.size).toBe(3);
  });

  it("fail-closed: entrada desconhecida nunca vira verde nem vermelho", () => {
    // Chutar uma cor direcional para um valor que o sistema não entende seria
    // afirmar uma direção que ninguém calculou.
    for (const v of [null, undefined, "", "WAIT", "ABSTAIN", "DADOS_INSUFICIENTES", "qualquer"]) {
      expect(directionColor(v as string), String(v)).toBe(DIRECTION_COLOR.NEUTRO);
      expect(directionArrow(v as string), String(v)).toBe(DIRECTION_ARROW.NEUTRO);
    }
  });

  it("os pares proibidos cobrem as 4 inversões possíveis (cor e seta, nos 2 lados)", () => {
    expect(FORBIDDEN_PAIRS).toHaveLength(4);
    for (const p of FORBIDDEN_PAIRS) {
      // Um par proibido nunca pode coincidir com o valor correto daquela
      // direção — se coincidisse, a guarda estaria proibindo o certo.
      expect(p.forbidden).not.toBe(DIRECTION_COLOR[p.direction]);
      expect(p.forbidden).not.toBe(DIRECTION_ARROW[p.direction]);
    }
  });
});

describe("varredura de inversão no código REAL", () => {
  // Um ternário de direção tem esta forma no código deste repositório:
  //   <algo> === "LONG" ? <valorA> : <algo> === "SHORT" ? <valorB> : <valorC>
  // A inversão acontece quando valorA carrega a cor/seta de SHORT (ou
  // vice-versa). Esta varredura procura exatamente isso.
  const TERNARIO = /===\s*"(LONG|SHORT)"\s*\?\s*([^:?]{0,120}?)\s*:/g;

  const arquivos: Array<[string, string]> = [["App.tsx", app]];
  for (const f of readdirSync(resolve(SRC, "chart"))) {
    if (f.endsWith(".tsx") || f.endsWith(".ts")) {
      arquivos.push([`chart/${f}`, readFileSync(resolve(SRC, "chart", f), "utf8")]);
    }
  }

  it("varre mais de um arquivo de verdade (a varredura não é vazia)", () => {
    expect(arquivos.length).toBeGreaterThan(5);
  });

  for (const [nome, src] of arquivos) {
    it(`${nome}: nenhum ramo de LONG usa cor/seta de SHORT, nem o contrário`, () => {
      const linhas = codeLines(src);
      const violacoes: string[] = [];
      for (const linha of linhas) {
        for (const m of linha.matchAll(TERNARIO)) {
          const direcao = m[1] as "LONG" | "SHORT";
          const ramo = m[2] ?? "";
          const corErrada = direcao === "LONG" ? DIRECTION_COLOR.SHORT : DIRECTION_COLOR.LONG;
          const setaErrada = direcao === "LONG" ? DIRECTION_ARROW.SHORT : DIRECTION_ARROW.LONG;
          if (ramo.includes(corErrada)) violacoes.push(`${direcao} com a cor de ${direcao === "LONG" ? "SHORT" : "LONG"}: ${linha.trim().slice(0, 120)}`);
          if (ramo.includes(setaErrada)) violacoes.push(`${direcao} com a seta de ${direcao === "LONG" ? "SHORT" : "LONG"}: ${linha.trim().slice(0, 120)}`);
        }
      }
      expect(violacoes, violacoes.join("\n")).toEqual([]);
    });
  }

  it("o vocabulário ALTA/BAIXA também não inverte", () => {
    // Os motores em js/ falam ALTA/BAIXA; a UI traduz. Uma inversão nessa
    // tradução é tão cara quanto uma em LONG/SHORT.
    const linhas = codeLines(app);
    const violacoes: string[] = [];
    const RE = /===\s*"(ALTA|BAIXA)"\s*\?\s*([^:?]{0,120}?)\s*:/g;
    for (const linha of linhas) {
      for (const m of linha.matchAll(RE)) {
        const dir = m[1];
        const ramo = m[2] ?? "";
        const corErrada = dir === "ALTA" ? DIRECTION_COLOR.SHORT : DIRECTION_COLOR.LONG;
        if (ramo.includes(corErrada)) violacoes.push(`${dir}: ${linha.trim().slice(0, 120)}`);
      }
    }
    expect(violacoes, violacoes.join("\n")).toEqual([]);
  });
});

describe("cor nunca é o único canal (custo do erro é entrar invertido)", () => {
  it("o painel de sincronia escreve a PALAVRA junto da cor", () => {
    // Se a direção só existisse como cor, um monitor mal calibrado ou
    // daltonismo bastariam para o Operador ler o lado errado.
    const bloco = app.slice(app.indexOf("function DirectionalSyncPanel()"), app.indexOf("function TopBar("));
    expect(bloco).toMatch(/\{s\.side \?\? "—"\}/);
  });

  it("o mapa de liquidez usa seta E rótulo, nunca só a cor", () => {
    expect(app).toMatch(/▲ LIQ/);
    expect(app).toMatch(/LIQ ▼/);
  });

  it("o medidor de distância nomeia o lado (TO LONG / TO SHORT)", () => {
    expect(app).toMatch(/label="TO LONG"/);
    expect(app).toMatch(/label="TO SHORT"/);
  });
});

describe("seletor de timeframe — o beco sem saída medido pelo Operador", () => {
  it("desktop (md+) não tem mais teto de largura: os 14 timeframes cabem", () => {
    // Relato literal: "no computador não tem como arrastar, fica aparecendo
    // até o M8". Conta real com o corpo de 13.5px: 445px necessários vs 340px
    // de teto ⇒ 10 de 14, último alcançável 8H. Exatamente o que ele viu.
    expect(app).toMatch(/max-w-\[220px\] sm:max-w-\[340px\] md:max-w-none/);
  });

  it("o trilho de rolagem é VISÍVEL onde ainda houver overflow", () => {
    // .scrollbar-hide num contêiner rolável sem toque = beco sem saída.
    // Alvo preciso: o className do PRÓPRIO contêiner do seletor. Uma janela
    // de N bytes alcançaria vizinhos que usam scrollbar-hide legitimamente —
    // falso positivo do teste, não defeito do código.
    const m = app.match(/className="ar10-t-body flex items-center gap-0\.5[^"]*"/);
    expect(m, "contêiner do seletor de timeframe não encontrado").not.toBeNull();
    expect(m![0]).toMatch(/ar10-scroll-x/);
    expect(m![0]).not.toMatch(/scrollbar-hide/);
  });

  it("a roda do mouse rola horizontalmente (shift+roda ninguém descobre)", () => {
    expect(app).toMatch(/el\.scrollLeft \+= e\.deltaY;/);
  });

  it("a roda só é interceptada quando há overflow REAL", () => {
    // Interceptar sempre roubaria a rolagem vertical da página sem motivo.
    expect(app).toMatch(/if \(el\.scrollWidth <= el\.clientWidth\) return;/);
  });

  it("o trilho existe no CSS com altura real", () => {
    const css = readFileSync(resolve(SRC, "index.css"), "utf8");
    expect(css).toMatch(/\.ar10-scroll-x\s*\{[\s\S]*?overflow-x:\s*auto/);
    expect(css).toMatch(/\.ar10-scroll-x::-webkit-scrollbar\s*\{\s*height:\s*4px/);
  });
});
