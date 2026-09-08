// typography-legibility-floor.test.ts — achado real do escaneamento do
// ecossistema (pedido do Operador: "você é quem melhor conhece o código,
// só escaneando o sistema por dentro você vai identificar o que precisa
// ser corrigido").
//
// O DEFEITO MEDIDO: o widget "Vetor" do header tinha três rótulos a
// 0.35rem (5.6px), 0.32rem (5.12px) e 0.3rem (4.8px). Eram os ÚNICOS do
// app inteiro abaixo de 0.4rem — e roughly metade do piso que este mesmo
// projeto já tinha documentado, com razão escrita, para o eixo do
// gráfico: "o texto era 9px numa caixa de 16px — abaixo do que qualquer
// terminal profissional usa no eixo, e no iPad (a superfície real deste
// app) fica no limite do legível" (PriceLabelStackPlugin.tsx).
//
// Um piso de legibilidade que vale para o canvas mas não para o DOM não é
// um piso — é uma coincidência. Este teste torna a regra real para os
// dois mundos, varrendo o app inteiro em vez de um componente só.
//
// Padrão-no-código-fonte de propósito: o bug provável aqui é "alguém
// escreveu um tamanho novo abaixo do piso", não matemática sutil.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../src");

/** Menor degrau tipográfico REAL da UI — não um número novo: é o menor
 *  tamanho já usado em massa no app (dezenas de ocorrências) antes desta
 *  correção, e o único abaixo dele eram os 3 rótulos do defeito. */
const LEGIBILITY_FLOOR_REM = 0.4;

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("piso de legibilidade tipográfica — vale para o DOM, não só para o canvas", () => {
  it("nenhum texto do app inteiro fica abaixo de 0.4rem (6.4px)", () => {
    const violations: string[] = [];
    for (const file of tsxFiles(srcDir)) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        // Só a forma EXECUTÁVEL (classe real), nunca a menção em
        // comentário — o comentário que explica esta correção cita os
        // tamanhos antigos de propósito, e casá-lo seria falso positivo.
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
        for (const m of line.matchAll(/text-\[(0?\.[0-9]+)rem\]/g)) {
          const rem = Number(m[1]);
          if (Number.isFinite(rem) && rem < LEGIBILITY_FLOOR_REM) {
            violations.push(`${file.replace(srcDir, "src")}:${i + 1} → ${m[0]} (${(rem * 16).toFixed(2)}px)`);
          }
        }
      });
    }
    expect(violations, `tamanhos abaixo do piso de ${LEGIBILITY_FLOOR_REM}rem:\n${violations.join("\n")}`).toEqual([]);
  });

  it("os 3 rótulos do widget Vetor foram realmente corrigidos (regressão travada)", () => {
    const app = readFileSync(resolve(srcDir, "App.tsx"), "utf8");
    // Os tamanhos antigos não voltam em classe real nenhuma.
    for (const antigo of ["text-[0.3rem]", "text-[0.32rem]", "text-[0.35rem]"]) {
      const emClasse = app.includes(`className="${antigo}`) || app.includes(`${antigo} `);
      expect(emClasse, `${antigo} voltou a ser usado como classe real`).toBe(false);
    }
    // E os três rótulos reais continuam existindo, agora no piso.
    expect(app).toContain('<span className="text-[0.4rem] text-[#8ab4f8]/70 tracking-[0.15em] uppercase font-bold whitespace-nowrap">');
    expect(app).toContain('<span className="text-[0.4rem] uppercase tracking-wider font-bold text-[#8ab4f8]/60">');
    expect(app).toContain('<span className="text-[0.4rem] uppercase tracking-wider font-bold text-[#8ab4f8]/50 whitespace-nowrap">');
  });

  it("o piso do DOM nunca fica ABAIXO do piso já documentado do canvas (hierarquia coerente entre os dois mundos)", () => {
    // O canvas declara seu próprio piso em px; o DOM declara em rem. A
    // regra real é que nenhum dos dois pode ser menor que o outro por
    // acidente — este teste amarra os dois números.
    const plugin = readFileSync(resolve(srcDir, "chart/PriceLabelStackPlugin.tsx"), "utf8");
    const m = plugin.match(/const FONT_COMPACT_BASE_PX = (\d+)/);
    expect(m, "FONT_COMPACT_BASE_PX não encontrado — o piso do canvas mudou de forma").not.toBeNull();
    const canvasFloorPx = Number(m![1]);
    const domFloorPx = LEGIBILITY_FLOOR_REM * 16;
    // O canvas pode ser MAIOR (ele compete com velas); o que não pode é o
    // DOM afirmar um piso e o canvas desenhar menor que ele.
    expect(canvasFloorPx).toBeGreaterThanOrEqual(domFloorPx);
  });
});
