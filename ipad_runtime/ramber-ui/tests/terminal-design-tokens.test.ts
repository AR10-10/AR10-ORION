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
    // E não importa nada do núcleo.
    expect(src).not.toContain("import");
  });
});
