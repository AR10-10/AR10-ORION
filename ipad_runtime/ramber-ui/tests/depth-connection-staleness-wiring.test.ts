// depth-connection-staleness-wiring.test.ts — trava a parte 2/3 do pedido
// do Operador ("reconexão mais agressiva quando a rede cai"). Padrão no
// código-fonte (CLAUDE.md: o bug mais provável aqui é "o valor calibrado
// existe mas ninguém plugou nele", não matemática nova).
//
// A ideia central travada aqui: o ConnectionManager real (connection-
// manager.ts) já suporta staleAfterMs/heartbeatMs configuráveis, mas
// App.tsx usava só os defaults genéricos (10s/20s) pras DUAS conexões —
// mesmo o depth10@100ms, cujo limiar real (20x a cadência real) já estava
// declarado e testado em microstructure-snapshot.ts como
// DEPTH_STALE_THRESHOLD_MS = 2_000. Este teste garante que o depthManager
// REUTILIZA essa constante (nunca duplica o número 2000 solto), e que o
// ticker NÃO foi tocado (nenhuma evidência de que os defaults dele estejam
// errados — mudar sem evidência seria inventar, não medir).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSrc = () => readFileSync(resolve(__dirname, "../src/App.tsx"), "utf-8");

describe("depthManager reaproveita DEPTH_STALE_THRESHOLD_MS (microstructure-snapshot.ts) — nunca um número novo inventado", () => {
  it("importa a constante real, não redeclara um literal", () => {
    expect(appSrc()).toMatch(
      /import\s*\{\s*composeMicrostructureSnapshot,\s*DEPTH_STALE_THRESHOLD_MS\s*\}\s*from\s*"\.\/nexus\/microstructure-snapshot"/,
    );
  });

  it("depthManager passa staleAfterMs/heartbeatMs/heartbeatCheckIntervalMs — nunca fica só nos defaults genéricos do ConnectionManager", () => {
    const src = appSrc();
    const start = src.indexOf("const depthManager = new ConnectionManager({");
    const end = src.indexOf("tickerManager.start();");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);

    expect(body).toMatch(/staleAfterMs:\s*DEPTH_STALE_THRESHOLD_MS,/);
    expect(body).toMatch(/heartbeatMs:\s*DEPTH_STALE_THRESHOLD_MS \* 2,/);
    // precisa ser mais fino que staleAfterMs (invariante documentada em
    // connection-manager.ts) — 400 é mais fino que os 2000 de
    // DEPTH_STALE_THRESHOLD_MS.
    expect(body).toMatch(/heartbeatCheckIntervalMs:\s*400,/);
  });

  it("tickerManager NÃO foi tocado — continua nos defaults genéricos (nenhuma evidência de cadência real errada pra ele)", () => {
    const src = appSrc();
    const start = src.indexOf("const tickerManager = new ConnectionManager({");
    const end = src.indexOf("const depthManager = new ConnectionManager({");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);

    expect(body).not.toMatch(/staleAfterMs/);
    expect(body).not.toMatch(/heartbeatMs/);
    expect(body).not.toMatch(/heartbeatCheckIntervalMs/);
  });
});
