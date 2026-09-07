// cross-venue-intelligence-wiring.test.ts — Ordem A2.2: trava a fiação
// real em App.tsx (import, montagem do card, guarda de rede). A lógica
// pura já tem execução real em cross-venue-intelligence.test.ts; aqui o
// bug mais provável é "esqueceram de conectar A com B" (CLAUDE.md).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSrc = () => readFileSync(resolve(__dirname, "../src/App.tsx"), "utf-8");

describe("App.tsx: startMexcDepthOnly() ligado — a única peça de rede nova da Ordem A2.2", () => {
  it("importa CrossExchangeService e o compositor real, nunca uma segunda implementação inline", () => {
    const src = appSrc();
    expect(src).toContain('import { CrossExchangeService } from "./nexus/cross-exchange-service";');
    expect(src).toContain('import { composeCrossVenueIntelligence, describeCrossVenueIntelligence } from "./nexus/cross-venue-intelligence";');
  });

  it("chama startMexcDepthOnly() — NUNCA start() completo (duplicaria o WS Binance já em produção)", () => {
    const src = appSrc();
    expect(src).toContain("service.startMexcDepthOnly();");
    expect(src).not.toMatch(/new CrossExchangeService\([\s\S]{0,300}?\.start\(\)/);
  });

  it("o efeito só roda em modo cripto (isFullCryptoMode) — Binance/MEXC não existem pra ativo TradFi", () => {
    const src = appSrc();
    const idx = src.indexOf("service.startMexcDepthOnly();");
    expect(idx).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, idx - 400), idx);
    expect(before).toContain("if (!isFullCryptoMode) return;");
  });

  it("o cleanup real chama service.stop() — nenhum poller órfão sobrevive ao unmount/troca de ativo", () => {
    const src = appSrc();
    expect(src).toContain("return () => service.stop();");
  });
});

describe("App.tsx: DecisionValidationWidget monta o card CROSS-VENUE INTELLIGENCE com dados reais", () => {
  it("useL2History(\"BINANCE\")/(\"MEXC\") alimentam o lead/lag — mesma fonte real já usada pelo heatmap L2, zero segunda captura", () => {
    const src = appSrc();
    expect(src).toContain('useL2History("BINANCE")');
    expect(src).toContain('useL2History("MEXC")');
  });

  it("composeCrossVenueIntelligence recebe os CrossExchangeCheck reais já existentes (crossExchangeCheck/okxCrossExchangeCheck/mexcCrossExchangeCheck) — nunca recomputados", () => {
    const src = appSrc();
    const start = src.indexOf("const crossVenue = useMemo(");
    const end = src.indexOf("const crossVenueLabel = describeCrossVenueIntelligence(crossVenue);");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).toContain("bybitCheck: crossExchangeCheck");
    expect(body).toContain("okxCheck: okxCrossExchangeCheck");
    expect(body).toContain("mexcPriceCheck: mexcCrossExchangeCheck");
    expect(body).toContain("books: exchangeBooks");
  });

  it('card real "CROSS-VENUE INTELLIGENCE" monta com a legenda da Regra de Honestidade sempre visível', () => {
    const src = appSrc();
    expect(src).toContain("CROSS-VENUE INTELLIGENCE");
    expect(src).toContain("CORE BINANCE·MEXC (microestrutura) · BYBIT/OKX (preço apenas)");
  });
});
