// risk-sizing-reason-wiring.test.ts — ORDEM DE SERVIÇO (Frente 1, §2.2):
// os 3 pontos reais em App.tsx onde "0% · sem sugestão"/"AWAITING REAL
// DATA" apareciam sem motivo, mesmo com riskSuggestion.reason já
// computado (risk-engine.js's semSugestao) no MESMO objeto lido pro
// número. Trava por padrão de código (App.tsx não é montável neste repo).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

describe("MarketBiasDecisionCard e DecisionValidationWidget: riskReason real no tooltip do selo de tamanho", () => {
  it("as duas definições de riskReason usam humanizeReasonCode(riskSuggestion?.reason) — mesmo campo, zero segunda leitura", () => {
    const ocorrencias = app.split("const riskReason = !riskOk ? humanizeReasonCode(riskSuggestion?.reason) : null;").length - 1;
    expect(ocorrencias).toBe(2);
  });

  it("o tooltip do selo TAMANHO SUGERIDO usa riskReason", () => {
    expect(app).toMatch(/title=\{riskReason \?\? undefined\}\s*\n?\s*className=\{`text-\[0\.5rem\] font-bold px-2 py-0\.5 rounded border \$\{riskOk/);
  });

  it("o tooltip do card TAMANHO SUGERIDO (RISK ENGINE) usa riskReason", () => {
    expect(app).toMatch(/title=\{riskReason \?\? undefined\} className=\{`text-\[0\.55rem\] font-mono font-black \$\{riskColor\}`\}>\{riskLabel\}/);
  });
});

describe("SecondaryModuleView (aba RISK): checagem de truthiness corrigida — riskSuggestion nunca é null de verdade", () => {
  it("usa riskSuggestion?.status === \"OK\", nunca só `riskSuggestion ?`", () => {
    // Âncora estrutural: dentro do ModulePanel de Position Sizing, nunca
    // deve sobrar a checagem antiga `riskSuggestion ? ... : MODULE_EMPTY`
    // (sempre verdadeira, porque buildRiskSuggestion nunca devolve null).
    const idx = app.indexOf('title="Position Sizing · Risk Engine (real, advisory only)"');
    expect(idx, "ModulePanel de Position Sizing não encontrado").toBeGreaterThan(-1);
    const bloco = app.slice(idx, idx + 1200);
    expect(bloco).toMatch(/riskSuggestion\?\.status === "OK" \? `\$\{riskSuggestion\.suggested_position_pct\.toFixed\(1\)\}% equity` : MODULE_EMPTY/);
    expect(bloco).toMatch(/riskSuggestion\?\.status === "OK" \? `\$\{riskSuggestion\.effective_risk_pct\.toFixed\(2\)\}%` : MODULE_EMPTY/);
    expect(bloco).not.toContain("riskSuggestion ? `${riskSuggestion.suggested_position_pct");
    expect(bloco).not.toContain("riskSuggestion ? `${riskSuggestion.effective_risk_pct");
    // O motivo real vai pro tooltip do próprio ModuleStat.
    expect(bloco).toMatch(/title=\{riskSuggestion\?\.status !== "OK" \? humanizeReasonCode\(riskSuggestion\?\.reason\) : undefined\}/);
  });

  it("ModuleStat aceita e aplica um title opcional — não é decoração morta", () => {
    expect(app).toMatch(/function ModuleStat\(\{ label, value, tone, title \}: \{ label: string; value: string; tone\?: "long" \| "short" \| "neutral"; title\?: string \| null \}\)/);
    expect(app).toMatch(/<div className="flex justify-between items-center gap-2" title=\{title \?\? undefined\}>/);
  });
});

describe("import real de humanizeReasonCode existe (zero segunda tradução de motivo)", () => {
  it("App.tsx importa de nexus/reason-vocabulary", () => {
    expect(app).toContain('import { humanizeReasonCode } from "./nexus/reason-vocabulary";');
  });
});
