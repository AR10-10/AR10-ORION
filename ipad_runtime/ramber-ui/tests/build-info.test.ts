// build-info.test.ts — Ordem P0 (RUNTIME PARITY, 2026-09-07): trava a
// cadeia MAIN COMMIT → BUILD ID → RUNTIME que a ordem exige (§8). O
// próprio vitest não passa pelo `define` de vite.config.ts (config
// totalmente separada, ver vitest.config.ts) — então rodar esta suíte É a
// prova viva do fail-closed: sem o `define`, BUILD_COMMIT cai em
// "unknown", nunca um SHA fabricado.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_COMMIT, BUILD_COMMIT_SHORT } from "../src/build-info";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

describe("build-info.ts: fail-closed sem o define de build (exatamente o ambiente do vitest)", () => {
  it("BUILD_COMMIT cai em 'unknown' quando __AR10_BUILD_COMMIT__ não foi injetado — nunca um SHA fabricado", () => {
    expect(BUILD_COMMIT).toBe("unknown");
    expect(BUILD_COMMIT_SHORT).toBe("unknown");
  });
});

describe("vite.config.ts: o commit vem do HEAD real no instante do build, nunca escrito à mão", () => {
  it("resolveBuildCommit() usa `git rev-parse HEAD`, fail-closed em 'unknown' se o git falhar", () => {
    const cfg = read("../vite.config.ts");
    expect(cfg).toContain("execSync('git rev-parse HEAD'");
    expect(cfg).toContain("return 'unknown';");
  });

  it("o valor resolvido é injetado como __AR10_BUILD_COMMIT__ via `define`", () => {
    const cfg = read("../vite.config.ts");
    expect(cfg).toContain("__AR10_BUILD_COMMIT__: JSON.stringify(resolveBuildCommit())");
  });
});

describe("App.tsx: a UI mostra o COMMIT ao lado do selo de versão (BUILD), nunca substituindo-o", () => {
  it('linha "COMMIT" existe, logo depois da linha "BUILD" já travada por production-seal.test.ts', () => {
    const app = read("../src/App.tsx");
    expect(app).toContain('import { BUILD_COMMIT_SHORT } from "./build-info"');
    const buildIdx = app.indexOf('<Row label="BUILD" value={APP_SEAL}');
    expect(buildIdx).toBeGreaterThan(-1);
    const commitIdx = app.indexOf('label="COMMIT"', buildIdx);
    expect(commitIdx, 'linha COMMIT não encontrada logo após BUILD').toBeGreaterThan(buildIdx);
    expect(app.slice(commitIdx, commitIdx + 200)).toContain("value={BUILD_COMMIT_SHORT}");
  });

  it("nunca reaproveita/edita APP_SEAL — production-seal.test.ts continua a única fonte de verdade sobre aquele selo", () => {
    const app = read("../src/App.tsx");
    // A trava de zero-repetição de production-seal.test.ts conta 2
    // ocorrências de APP_SEAL (1 import + 1 render); esta feature nova
    // não pode ter mexido nisso.
    expect(app.match(/APP_SEAL/g)!.length).toBe(2);
  });
});
