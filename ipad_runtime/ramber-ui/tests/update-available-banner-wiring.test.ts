// update-available-banner-wiring.test.ts — trava a fiação real em App.tsx
// do aviso "versão nova disponível" (pedido do Operador: "eu quero sentir
// a evolução rodando"). Padrão no código-fonte (CLAUDE.md: o bug mais
// provável aqui é "esqueceram de conectar A com B"); a lógica pura já tem
// execução real em pwa-update-signal.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSrc = () => readFileSync(resolve(__dirname, "../src/App.tsx"), "utf-8");

describe("App.tsx: UpdateAvailableBanner sempre montado, usa o sinal real do Service Worker", () => {
  it("importa subscribeToServiceWorkerUpdate do módulo puro — nunca uma segunda implementação inline", () => {
    expect(appSrc()).toMatch(/import\s*\{\s*subscribeToServiceWorkerUpdate\s*\}\s*from\s*"\.\/pwa-update-signal"/);
  });

  it("<UpdateAvailableBanner /> é montado incondicionalmente em App() — nunca atrás de um toggle de Laboratório", () => {
    const src = appSrc();
    expect(src).toMatch(/<UpdateAvailableBanner\s*\/>/);
    expect(src).not.toMatch(/\w+\s*&&\s*<UpdateAvailableBanner/);
  });

  it("assina o sinal real via navigator.serviceWorker, com guarda \"serviceWorker\" in navigator (nunca assume o SW existir)", () => {
    const src = appSrc();
    const start = src.indexOf("function UpdateAvailableBanner()");
    const end = src.indexOf("function AlertToastStack(");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).toContain('if (!("serviceWorker" in navigator)) return;');
    expect(body).toContain("return subscribeToServiceWorkerUpdate(navigator.serviceWorker, () => setUpdateAvailable(true));");
  });

  it("retorna null quando não há atualização — nunca ocupa espaço no caminho comum (fail-closed ao contrário do resto do app)", () => {
    const src = appSrc();
    const start = src.indexOf("function UpdateAvailableBanner()");
    const end = src.indexOf("function AlertToastStack(");
    const body = src.slice(start, end);
    expect(body).toMatch(/if\s*\(!updateAvailable\)\s*return null;/);
  });

  it("o botão real recarrega a página (window.location.reload()) — a mesma ação que fechar/reabrir o app produziria", () => {
    const src = appSrc();
    const start = src.indexOf("function UpdateAvailableBanner()");
    const end = src.indexOf("function AlertToastStack(");
    const body = src.slice(start, end);
    expect(body).toContain("onClick={() => window.location.reload()}");
  });

  it("não duplica DataFreshnessBanner: posição vertical diferente (top-9 vs top-1), mesmo canto (right-2)", () => {
    const src = appSrc();
    const start = src.indexOf("function UpdateAvailableBanner()");
    const end = src.indexOf("function AlertToastStack(");
    const body = src.slice(start, end);
    expect(body).toContain("top-9 right-2");
  });
});
