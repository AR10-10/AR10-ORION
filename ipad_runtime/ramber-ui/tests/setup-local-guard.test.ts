// setup-local-guard.test.ts — o script de preparação local (docs/RODAR_LOCAL.md)
// perdeu a etapa de senha (ordem "remover password gate temporário",
// 2026-09-07): o portão em si saiu do caminho crítico (main.tsx não monta
// mais AccessGate), então não existe segredo nenhum para o script preparar.
// O que não pode regredir agora: o script continua checando o Node certo, e
// continua sem escrever NADA em disco (zero segredo, zero .env.local).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const script = () => readFileSync(resolve(__dirname, "../../tools/setup-local.mjs"), "utf8");

describe("setup-local: a etapa de senha foi removida — zero segredo, zero escrita em disco", () => {
  it("não gera hash, não pede senha, não grava arquivo nenhum em disco", () => {
    // Forma EXECUTÁVEL, nunca a string solta: o próprio comentário do
    // arquivo cita ".env.local" ao explicar o que foi removido — travar a
    // string bruta reprovaria o comentário, não o comportamento real.
    const s = script();
    expect(s).not.toContain("VITE_ACCESS_HASH=");
    expect(s).not.toContain("createHash");
    expect(s).not.toContain("writeFileSync");
    expect(s).not.toMatch(/resolve\([^)]*['"]\.env\.local['"]\)/);
    expect(s).not.toMatch(/process\.argv\[2\]/); // não lê mais senha como argumento
  });

  it("continua puramente informativo: só console.log, nenhuma escrita em disco", () => {
    const s = script();
    expect(s).not.toMatch(/\bfs\.write|writeFile/);
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

  it("a mensagem de próximos passos não promete mais 'use a senha que você definiu'", () => {
    const s = script();
    expect(s).not.toMatch(/use a senha/i);
    expect(s).toContain("O painel abre direto — sem senha.");
  });
});
