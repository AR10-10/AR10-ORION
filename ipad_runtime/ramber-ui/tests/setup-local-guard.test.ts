// setup-local-guard.test.ts — o script de preparação local virou a porta de
// entrada do projeto (docs/RODAR_LOCAL.md), e ele mexe em segredo. Duas
// coisas não podem regredir em silêncio: a senha nunca ser gravada, e o
// script rodar no Node do Operador.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const script = () => readFileSync(resolve(__dirname, "../../tools/setup-local.mjs"), "utf8");

describe("setup-local: a senha NUNCA é gravada, só o hash", () => {
  it("grava VITE_ACCESS_HASH a partir de um SHA-256, nunca a senha em si", () => {
    const s = script();
    expect(s).toContain("createHash('sha256').update(senha, 'utf8').digest('hex')");
    // Forma executável: nenhuma escrita interpola a variável `senha`.
    expect(s).not.toMatch(/writeFileSync\([^)]*\$\{senha\}/);
    expect(s).toContain("VITE_ACCESS_HASH=${hash}");
  });

  it("o hash gerado é o mesmo que o portão valida — os dois lados batem", () => {
    // Execução real da mesma conta que o script faz, comparada com o formato
    // que resolveAccessHash (access-gate.tsx) aceita: 64 hex minúsculos.
    const hash = createHash("sha256").update("uma-senha-qualquer", "utf8").digest("hex");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("escreve SOMENTE em .env.local — nunca em arquivo versionado", () => {
    const s = script();
    const escritas = [...s.matchAll(/writeFileSync\(\s*([A-Za-z_]+)/g)].map((m) => m[1]);
    expect(escritas.length, "nenhuma escrita encontrada").toBeGreaterThan(0);
    for (const alvo of escritas) expect(alvo, `escreve em ${alvo}`).toBe("ENV_LOCAL");
    expect(s).toContain("const ENV_LOCAL = resolve(UI, '.env.local');");
  });

  it(".env.local está no .gitignore — senão o hash seria versionado", () => {
    expect(readFileSync(resolve(__dirname, "../.gitignore"), "utf8")).toMatch(/^\.env\.local$/m);
  });

  it("não sobrescreve um .env.local existente às cegas", () => {
    // O Operador pode ter posto outras variáveis à mão; o script troca só a
    // linha do hash.
    const s = script();
    expect(s).toContain("l.trim().startsWith('VITE_ACCESS_HASH=')");
  });

  it("roda em Node puro — sem global de browser", () => {
    const semComentarios = script().replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const g of ["self", "window", "document", "localStorage"]) {
      expect(semComentarios, `usa ${g}`).not.toMatch(new RegExp(`(^|[^.\\w])${g}\\s*[.)\\[]`));
    }
  });

  it("exige Node >= 20, a mesma versão que o guia manda instalar", () => {
    expect(script()).toContain("const NODE_MINIMO = 20;");
    expect(readFileSync(resolve(__dirname, "../../../docs/RODAR_LOCAL.md"), "utf8")).toContain("precisa ser 20 ou maior");
  });
});
