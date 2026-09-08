// risk-suggestion-label.test.ts — Frente 3 §3 (auditoria de duplicidade):
// formatRiskSuggestionLabel() substitui o texto do selo "TAMANHO SUGERIDO"
// que estava redigitado byte a byte em 2 lugares de App.tsx
// (MarketBiasDecisionCard e DecisionValidationWidget). Execução real
// (função pura) + padrão de código (App.tsx chama o helper, não redigita).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatRiskSuggestionLabel } from "../src/nexus/risk-suggestion-label";
import type { RiskSuggestion, RiskSuggestionOk, RiskSuggestionInputs } from "../src/engine-bridge";

const INPUTS: RiskSuggestionInputs = {
  signal: "LONG",
  entry: 100,
  stop: 98,
  atr_percent: 2,
  rr: 2,
  ensemble_direction: "ALTA",
  ensemble_forca: 0.8,
  risk_per_trade_pct: 1,
};

const OK: RiskSuggestionOk = {
  status: "OK",
  reason: "ok",
  suggested_position_pct: 2.345,
  effective_risk_pct: 1.2,
  vol_size_pct: 2,
  kelly_cap_pct: 3,
  kelly_fraction_tier: 1,
  assumed_win_rate: 0.5,
  effective_win_rate: 0.5,
  win_rate_source: "assumed_0.5",
  effective_risk_unit_pct: 1,
  inputs: INPUTS,
  disclaimer: "",
  read_only: true,
};

describe("formatRiskSuggestionLabel: execução real", () => {
  it("status OK formata posição% + risco%, arredondados igual ao formato original", () => {
    expect(formatRiskSuggestionLabel(OK)).toBe("2.3% eq · risk 1.20%");
  });

  it("status diferente de OK (SEM_SUGESTAO) nunca fabrica um número — mesmo texto honesto de sempre", () => {
    expect(formatRiskSuggestionLabel({ status: "SEM_SUGESTAO" } as unknown as RiskSuggestion)).toBe("0% · sem sugestão");
  });

  it("null/undefined (ainda sem leitura real) também cai no texto honesto, nunca lança", () => {
    expect(formatRiskSuggestionLabel(null)).toBe("0% · sem sugestão");
    expect(formatRiskSuggestionLabel(undefined)).toBe("0% · sem sugestão");
  });
});

describe("App.tsx: os 2 call sites reais chamam o helper, nunca redigitam o formato", () => {
  const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

  it("importa formatRiskSuggestionLabel de nexus/risk-suggestion-label", () => {
    expect(app).toContain('import { formatRiskSuggestionLabel } from "./nexus/risk-suggestion-label";');
  });

  it("nenhuma redigitação do formato sobrevive em App.tsx (a fonte agora é só o helper)", () => {
    expect(app).not.toMatch(/suggested_position_pct\.toFixed\(1\)\}% eq · risk/);
  });

  it("as 2 ocorrências reais (MarketBiasDecisionCard + DecisionValidationWidget) usam o helper", () => {
    const hits = app.match(/const riskLabel = formatRiskSuggestionLabel\(riskSuggestion\);/g);
    expect(hits).not.toBeNull();
    expect(hits!.length).toBe(2);
  });
});
