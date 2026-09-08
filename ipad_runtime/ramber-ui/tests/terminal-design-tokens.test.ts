// terminal-design-tokens.test.ts — a escala tipográfica canônica.
//
// Convenção mista do CLAUDE.md, os dois lados de propósito:
//  • execução REAL para nearestTypeStep/isOnTypeScale (a pergunta é "a
//    conta de proximidade está certa?");
//  • padrão-no-código-fonte para a conformidade do app (a pergunta é
//    "alguém escreveu um tamanho fora da escala?").
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import {
  TYPE_SCALE_REM,
  TYPE_SCALE_MIN_REM,
  TYPE_SCALE_STEP_REM,
  TYPE_SCALE_MIGRATIONS,
  nearestTypeStep,
  isOnTypeScale,
} from "../src/nexus/terminal-design-tokens";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../src");

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("a escala é regular — é isso que a torna uma escala, e não uma lista", () => {
  it("passo constante de 0.05rem entre degraus vizinhos", () => {
    for (let i = 1; i < TYPE_SCALE_REM.length; i++) {
      expect(TYPE_SCALE_REM[i] - TYPE_SCALE_REM[i - 1]).toBeCloseTo(TYPE_SCALE_STEP_REM, 10);
    }
  });

  it("é crescente e sem repetição — o índice É a hierarquia", () => {
    for (let i = 1; i < TYPE_SCALE_REM.length; i++) {
      expect(TYPE_SCALE_REM[i]).toBeGreaterThan(TYPE_SCALE_REM[i - 1]);
    }
    expect(new Set(TYPE_SCALE_REM).size).toBe(TYPE_SCALE_REM.length);
  });

  it("começa exatamente no piso de legibilidade já documentado (0.4rem = 6.4px)", () => {
    expect(TYPE_SCALE_MIN_REM).toBe(0.4);
    expect(TYPE_SCALE_MIN_REM * 16).toBeCloseTo(6.4, 10);
  });

  it("o piso do canvas continua >= o piso do DOM (hierarquia coerente entre os dois mundos)", () => {
    const plugin = readFileSync(resolve(srcDir, "chart/PriceLabelStackPlugin.tsx"), "utf8");
    const m = plugin.match(/const FONT_COMPACT_BASE_PX = (\d+)/);
    expect(m, "FONT_COMPACT_BASE_PX não encontrado").not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(TYPE_SCALE_MIN_REM * 16);
  });
});

describe("nearestTypeStep — a conta que decidiu cada migração", () => {
  it("um degrau da escala devolve ele mesmo", () => {
    for (const s of TYPE_SCALE_REM) expect(nearestTypeStep(s)).toBe(s);
  });

  it("reproduz EXATAMENTE as 5 migrações reais desta rodada", () => {
    // Se alguém mudar a escala e uma migração deixar de ser a mais
    // próxima, este teste denuncia — a tabela é registro, não decoração.
    for (const { from, to } of TYPE_SCALE_MIGRATIONS) {
      expect(nearestTypeStep(from), `${from}rem deveria arredondar para ${to}rem`).toBe(to);
    }
  });

  it("nunca devolve valor fora da escala", () => {
    for (const v of [0, 0.01, 0.33, 0.44, 0.49, 0.58, 0.9, 3, 1000]) {
      expect(isOnTypeScale(nearestTypeStep(v))).toBe(true);
    }
  });

  it("satura nos extremos em vez de extrapolar", () => {
    expect(nearestTypeStep(0.01)).toBe(TYPE_SCALE_REM[0]);
    expect(nearestTypeStep(99)).toBe(TYPE_SCALE_REM[TYPE_SCALE_REM.length - 1]);
  });

  it("fail-closed: entrada não-finita cai no piso, nunca NaN numa classe CSS", () => {
    for (const ruim of [Number.NaN, Infinity, -Infinity]) {
      expect(nearestTypeStep(ruim)).toBe(TYPE_SCALE_MIN_REM);
    }
  });

  it("empate exato resolve para o degrau MENOR (determinístico)", () => {
    // 0.425 é equidistante de 0.40 e 0.45.
    expect(nearestTypeStep(0.425)).toBe(0.4);
  });
});

describe("isOnTypeScale — comparação com tolerância, nunca === cru", () => {
  it("aceita os degraus reais mesmo com erro de ponto flutuante", () => {
    expect(isOnTypeScale(0.1 + 0.35)).toBe(true); // 0.45000000000000007
    expect(isOnTypeScale(0.2 + 0.3)).toBe(true); // 0.5
  });

  it("rejeita os tamanhos que esta rodada eliminou", () => {
    for (const { from } of TYPE_SCALE_MIGRATIONS) {
      expect(isOnTypeScale(from), `${from}rem não deveria estar na escala`).toBe(false);
    }
  });

  it("rejeita entrada inválida", () => {
    for (const ruim of [Number.NaN, Infinity]) expect(isOnTypeScale(ruim)).toBe(false);
  });
});

describe("CONFORMIDADE: o app inteiro usa só a escala canônica", () => {
  it("nenhum text-[Nrem] fora dos 7 degraus", () => {
    const violacoes: string[] = [];
    for (const file of tsxFiles(srcDir)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        // Só a forma EXECUTÁVEL: comentários citam tamanhos antigos de
        // propósito (o registro de por que mudaram) e casá-los seria
        // falso positivo — mesma disciplina do teste do piso.
        const t = line.trimStart();
        if (t.startsWith("//") || t.startsWith("*")) return;
        for (const m of line.matchAll(/text-\[(0?\.[0-9]+)rem\]/g)) {
          const rem = Number(m[1]);
          if (!isOnTypeScale(rem)) {
            violacoes.push(
              `${file.replace(srcDir, "src")}:${i + 1} → ${m[0]} (use text-[${nearestTypeStep(rem)}rem])`,
            );
          }
        }
      });
    }
    expect(violacoes, `tamanhos fora da escala:\n${violacoes.join("\n")}`).toEqual([]);
  });

  it("os 5 tamanhos eliminados não voltam como classe real", () => {
    const todos = tsxFiles(srcDir).map((f) => readFileSync(f, "utf8")).join("\n");
    for (const { from } of TYPE_SCALE_MIGRATIONS) {
      // Conta só ocorrências em linha executável.
      const emClasse = todos
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
        .some((l) => l.includes(`text-[${from}rem]`));
      expect(emClasse, `text-[${from}rem] voltou como classe real`).toBe(false);
    }
  });
});

describe("LEI 24: vocabulário de apresentação, nunca decisão", () => {
  it("o módulo não expõe direção, score nem probabilidade", () => {
    const src = readFileSync(resolve(srcDir, "nexus/terminal-design-tokens.ts"), "utf8");
    for (const proibida of ["direction", "engine.", "probability", "LONG", "SHORT"]) {
      expect(src.includes(`export const ${proibida}`)).toBe(false);
    }
    // E não importa NADA — nem do núcleo, nem de lib. Regex da forma real
    // de import: o substring cru casava com "importante", que aparece de
    // propósito no cabeçalho ("o que é importante aparece mais forte").
    expect(src).not.toMatch(/^\s*import[\s{]/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SUPERFÍCIES (rodada 2) — execução real: a pergunta é "os degraus são
// perceptíveis, na direção certa, e o texto ainda passa no contraste?"
// ═══════════════════════════════════════════════════════════════════════
import {
  SURFACE,
  SURFACE_STEP_DELTA_L,
  SURFACE_MIGRATIONS,
  CONTRAST_MIN_AA,
  relativeLuminance,
  contrastRatio,
} from "../src/nexus/terminal-design-tokens";

/** L* de CIE Lab — o eixo perceptual de claridade. Reimplementado aqui de
 *  propósito: o teste não deve confiar na mesma conta do módulo. */
function lStar(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const r = lin(((n >> 16) & 255) / 255);
  const g = lin(((n >> 8) & 255) / 255);
  const b = lin((n & 255) / 255);
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return Y > 0.008856 ? 116 * Y ** (1 / 3) - 16 : 903.3 * Y;
}

describe("a escala de superfície tem profundidade REAL — o defeito era não ter", () => {
  it("base → panel → raised é crescente em claridade (convenção de UI escura)", () => {
    expect(lStar(SURFACE.base)).toBeLessThan(lStar(SURFACE.panel));
    expect(lStar(SURFACE.panel)).toBeLessThan(lStar(SURFACE.raised));
  });

  it("cada degrau é PERCEPTÍVEL — o sistema antigo inteiro cabia em ΔL* 1.65", () => {
    const d1 = lStar(SURFACE.panel) - lStar(SURFACE.base);
    const d2 = lStar(SURFACE.raised) - lStar(SURFACE.panel);
    for (const d of [d1, d2]) {
      expect(d).toBeGreaterThanOrEqual(SURFACE_STEP_DELTA_L - 0.5);
      // E nunca tanto a ponto de clarear o terminal.
      expect(d).toBeLessThan(SURFACE_STEP_DELTA_L + 1.5);
    }
    // A amplitude total supera com folga o 1.65 medido antes da correção.
    expect(lStar(SURFACE.raised) - lStar(SURFACE.base)).toBeGreaterThan(1.65 * 2);
  });

  it("a base é a âncora — o dominante de 65 usos, cor inalterada", () => {
    expect(SURFACE.base).toBe("#010308");
  });

  it("os degraus preservam o matiz azulado (azul > vermelho em todos)", () => {
    for (const hex of Object.values(SURFACE)) {
      const n = parseInt(hex.slice(1), 16);
      expect((n & 255) > ((n >> 16) & 255), `${hex} deixou de ser azulado`).toBe(true);
    }
  });
});

describe("contraste WCAG verificado contra o PIOR caso, não assumido", () => {
  const TEXTOS = ["#8ab4f8", "#00f0ff", "#00ffaa", "#ff0055", "#f0d06f", "#be37ff"];

  it("toda cor de texto real passa AA sobre a superfície mais clara", () => {
    for (const cor of TEXTOS) {
      const r = contrastRatio(cor, SURFACE.raised)!;
      expect(r, `${cor} sobre ${SURFACE.raised} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        CONTRAST_MIN_AA,
      );
    }
  });

  it("o roxo corrigido passa — o antigo REPROVAVA, e já reprovava antes desta rodada", () => {
    // Registro do defeito real: #b026ff dava 4.49:1 contra o fundo antigo,
    // 0.01 abaixo do mínimo. Não foi esta rodada que o quebrou.
    expect(contrastRatio("#b026ff", "#010308")!).toBeLessThan(CONTRAST_MIN_AA);
    expect(contrastRatio("#be37ff", SURFACE.raised)!).toBeGreaterThanOrEqual(CONTRAST_MIN_AA);
  });

  it("contrastRatio é simétrico e bate com valores conhecidos", () => {
    expect(contrastRatio("#ffffff", "#000000")!).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#ffffff")!).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")!).toBeCloseTo(1, 5);
  });

  it("fail-closed: hex inválido devolve null, nunca um número que pareceria medição", () => {
    for (const ruim of ["", "#fff", "roxo", "#gggggg", "010308"]) {
      expect(relativeLuminance(ruim)).toBeNull();
      expect(contrastRatio(ruim, "#010308")).toBeNull();
    }
  });
});

describe("CONFORMIDADE: as cores redundantes sumiram do app", () => {
  it("nenhuma das 6 migradas volta em código executável", () => {
    const arquivos = tsxFiles(srcDir);
    const violacoes: string[] = [];
    for (const file of arquivos) {
      readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        const t = line.trimStart();
        if (t.startsWith("//") || t.startsWith("*")) return;
        for (const { from } of SURFACE_MIGRATIONS) {
          if (line.toLowerCase().includes(from.toLowerCase())) {
            violacoes.push(`${file.replace(srcDir, "src")}:${i + 1} → ${from}`);
          }
        }
      });
    }
    expect(violacoes, `cores migradas de volta:\n${violacoes.join("\n")}`).toEqual([]);
  });

  it("as 3 superfícies estão de fato em uso no app", () => {
    const todos = tsxFiles(srcDir).map((f) => readFileSync(f, "utf8")).join("\n").toLowerCase();
    for (const hex of Object.values(SURFACE)) {
      expect(todos.includes(hex.toLowerCase()), `${hex} declarado mas não usado`).toBe(true);
    }
  });
});
