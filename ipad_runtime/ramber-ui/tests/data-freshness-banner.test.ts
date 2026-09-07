// data-freshness-banner.test.ts — trava o módulo puro (SE/O QUÊ mostrar) e
// a fiação real do aviso sempre-visível em App.tsx (pedido do Operador:
// "eu queria que o sistema fosse inteligente... ele não sente que ele não
// tá rodando dado real"). Metade execução real (a lógica pura), metade
// padrão no código-fonte (a fiação entre módulos — CLAUDE.md: o bug mais
// provável ali é "esqueceram de conectar A com B", não matemática).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  shouldShowFreshnessBanner,
  formatFreshnessBannerLabel,
  type DataFreshnessState,
} from "../src/nexus/data-freshness-banner";

const FRESH: DataFreshnessState = { offline: false, isDataFresh: true, dataFreshSince: 1_000_000 };

describe("shouldShowFreshnessBanner — SE mostra, derivado 100% de offline/isDataFresh reais", () => {
  it("nunca mostra quando online e fresco (caminho saudável, o caso comum)", () => {
    expect(shouldShowFreshnessBanner(FRESH)).toBe(false);
  });

  it("mostra quando isDataFresh vira false, mesmo online", () => {
    expect(shouldShowFreshnessBanner({ ...FRESH, isDataFresh: false })).toBe(true);
  });

  it("mostra quando offline, mesmo que isDataFresh ainda não tenha expirado (a conexão já caiu; não espera o limiar de 60s do Health Monitor)", () => {
    expect(shouldShowFreshnessBanner({ ...FRESH, offline: true, isDataFresh: true })).toBe(true);
  });

  it("mostra quando os dois estão ruins ao mesmo tempo", () => {
    expect(shouldShowFreshnessBanner({ offline: true, isDataFresh: false, dataFreshSince: null })).toBe(true);
  });
});

describe("formatFreshnessBannerLabel — O QUÊ mostra, `now` sempre injetado (determinístico, nunca Date.now() direto)", () => {
  it("sem dataFreshSince real (boot, nenhum dado chegou ainda): omite o tempo decorrido em vez de fabricar um número", () => {
    const label = formatFreshnessBannerLabel({ offline: false, isDataFresh: false, dataFreshSince: null }, 5_000);
    expect(label).toBe("SEM DADO REAL — reconectando");
    expect(label).not.toMatch(/\d/); // nenhum dígito: zero número inventado
  });

  it("offline sem dataFreshSince: mesma omissão honesta, rótulo de conexão", () => {
    const label = formatFreshnessBannerLabel({ offline: true, isDataFresh: false, dataFreshSince: null }, 5_000);
    expect(label).toBe("SEM CONEXÃO — dado real parado");
  });

  it("mostra segundos reais decorridos (< 60s) quando online mas obsoleto", () => {
    const label = formatFreshnessBannerLabel({ offline: false, isDataFresh: false, dataFreshSince: 10_000 }, 40_000);
    expect(label).toBe("SEM DADO REAL HÁ 30s — reconectando");
  });

  it("mostra minutos reais decorridos (>= 60s) — nunca segundos de 3 dígitos", () => {
    const label = formatFreshnessBannerLabel({ offline: false, isDataFresh: false, dataFreshSince: 0 }, 150_000);
    expect(label).toBe("SEM DADO REAL HÁ 2min — reconectando");
    expect(label).not.toMatch(/HÁ \d{3,}s/);
  });

  it("rótulo de offline usa o texto de conexão, mesmo cálculo de tempo", () => {
    const label = formatFreshnessBannerLabel({ offline: true, isDataFresh: false, dataFreshSince: 0 }, 90_000);
    expect(label).toBe("SEM CONEXÃO — dado real parado há 1min");
  });

  it("clamp defensivo: now anterior a dataFreshSince (clock skew) nunca produz um decorrido negativo", () => {
    const label = formatFreshnessBannerLabel({ offline: false, isDataFresh: false, dataFreshSince: 10_000 }, 5_000);
    expect(label).toBe("SEM DADO REAL HÁ 0s — reconectando");
  });

  it("fronteira exata dos 60s cai em minuto, não em segundos de 3 dígitos", () => {
    const label = formatFreshnessBannerLabel({ offline: false, isDataFresh: false, dataFreshSince: 0 }, 60_000);
    expect(label).toBe("SEM DADO REAL HÁ 1min — reconectando");
  });
});

describe("Fiação real em App.tsx — sempre montado, nunca atrás de um toggle de Laboratório", () => {
  const appSrc = () => readFileSync(resolve(__dirname, "../src/App.tsx"), "utf-8");

  it("DataFreshnessBanner é importado do módulo puro, nunca uma segunda implementação inline", () => {
    expect(appSrc()).toMatch(
      /import\s*\{\s*shouldShowFreshnessBanner,\s*formatFreshnessBannerLabel\s*\}\s*from\s*"\.\/nexus\/data-freshness-banner"/,
    );
  });

  it("useDataFreshSinceSnapshot é importado da store real (mesma fonte de isDataFresh/offline)", () => {
    expect(appSrc()).toMatch(/useDataFreshSinceSnapshot/);
  });

  it("<DataFreshnessBanner /> é montado incondicionalmente em App() — nunca `{algumToggle && <DataFreshnessBanner`", () => {
    const src = appSrc();
    expect(src).toMatch(/<DataFreshnessBanner\s*\/>/);
    expect(src).not.toMatch(/\w+\s*&&\s*<DataFreshnessBanner/);
  });

  it("o componente é aria-hidden — não duplica a região aria-live real de LiveRegionAnnouncer.tsx", () => {
    const src = appSrc();
    const start = src.indexOf("function DataFreshnessBanner()");
    const end = src.indexOf("// UpdateAvailableBanner —");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).toContain('aria-hidden="true"');
    expect(body).not.toContain("aria-live");
  });

  it("o tick de 1s só roda enquanto visível (setInterval dentro do guard de `visible`) — zero custo no caminho saudável", () => {
    const src = appSrc();
    const start = src.indexOf("function DataFreshnessBanner()");
    const end = src.indexOf("// UpdateAvailableBanner —");
    const body = src.slice(start, end);
    expect(body).toMatch(/if\s*\(!visible\)\s*return;\s*\n\s*const id = setInterval/);
  });

  it("retorna null quando não visível — nunca ocupa espaço no caminho saudável (fail-closed ao contrário do resto do app)", () => {
    const src = appSrc();
    const start = src.indexOf("function DataFreshnessBanner()");
    const end = src.indexOf("// UpdateAvailableBanner —");
    const body = src.slice(start, end);
    expect(body).toMatch(/if\s*\(!visible\)\s*return null;/);
  });
});

describe("Fiação real em unified-snapshot-store.ts — dataFreshSince nos 4 lugares de sempre", () => {
  const storeSrc = () => readFileSync(resolve(__dirname, "../src/store/unified-snapshot-store.ts"), "utf-8");

  it("estado, ação, default e seletor — todos presentes", () => {
    const src = storeSrc();
    expect(src).toMatch(/dataFreshSince:\s*number\s*\|\s*null;/); // interface de estado
    expect(src).toMatch(/setDataFreshSince:\s*\(ts:\s*number\s*\|\s*null\)\s*=>\s*void;/); // interface de ação
    expect(src).toMatch(/setDataFreshSince:\s*\(ts\)\s*=>\s*set\(\(s\)\s*=>\s*\{\s*s\.dataFreshSince = ts;\s*\}\)/); // impl
    expect(src).toMatch(/dataFreshSince:\s*null,/); // default
    expect(src).toMatch(/export const useDataFreshSinceSnapshot = \(\): number \| null => useUnifiedSnapshotStore\(\(s\) => s\.dataFreshSince\);/); // seletor
  });
});

describe("Fiação real em health-monitor.ts — setDataFreshSince chamado ao lado de setDataFresh, mesmo `freshest`", () => {
  it("nunca um segundo relógio: usa a mesma variável `freshest` já computada pra isDataFresh", () => {
    const src = readFileSync(resolve(__dirname, "../src/nexus/health-monitor.ts"), "utf-8");
    expect(src).toMatch(/actions\.setDataFresh\(freshest > 0 && Date\.now\(\) - freshest < FRESHNESS_THRESHOLD_MS\);\s*\n[\s\S]{0,300}actions\.setDataFreshSince\(freshest > 0 \? freshest : null\);/);
  });
});
