// conflict-detector.ts — Auditoria MarketBrain (docs/AUDITORIA_MARKETBRAIN.md
// §3, Fase 1 real e pequena): generaliza nexusConfluenceVerdict
// (nexus-line.ts:131) para os outros pares de conflito nomeados no
// documento "Arquitetura Central de Inteligência" do Operador (§3.1) —
// MESMO padrão "informado, nunca acionado" (LEI 24): zero segunda fonte
// de dado, só compara leituras que outros motores já resolveram, e
// nunca gera, altera ou bloqueia a decisão do Core Engine.
//
// Por que só 2 pares aqui (Regime×Structure, Risk×Confluência) e não os
// 3+ do documento: Liquidity Sweep × Trend exige uma leitura de direção
// do sweep que ainda não existe como campo único resolvido (ver
// AUDITORIA_MARKETBRAIN.md §2/§3) — nascer aqui hoje seria inventar uma
// leitura nova, não reaproveitar uma real. Fica para quando essa leitura
// existir.
import type { CouncilStance } from "./council";

export type ConflictSeverity = "CRITICO" | "ALTO" | "MEDIO";

export interface DetectedConflict {
  motorA: string;
  motorB: string;
  description: string;
  severity: ConflictSeverity;
}

export type PairVerdict = "ALINHADA" | "CONFLITO_ESTRUTURAL" | null;

/** Regime (ADX+Bollinger, regime-engine.js::classifyMarketRegime) ×
 *  Structure (fractal HH/HL, market-structure-engine.js). null quando
 *  qualquer um dos dois não tem leitura direcional real (regime sem
 *  direção — CONSOLIDACAO/COMPRESSAO/DADOS_INSUFICIENTES — ou estrutura
 *  ESTRUTURA_LATERAL) — nunca um veredito fabricado sobre um lado sem
 *  opinião. */
export function regimeStructureVerdict(
  regimeDirection: "ALTA" | "BAIXA" | null,
  structureLabel: "ESTRUTURA_ALTA" | "ESTRUTURA_BAIXA" | "ESTRUTURA_LATERAL" | null,
): PairVerdict {
  if (regimeDirection === null || structureLabel === null || structureLabel === "ESTRUTURA_LATERAL") return null;
  const structureDirection = structureLabel === "ESTRUTURA_ALTA" ? "ALTA" : "BAIXA";
  return regimeDirection === structureDirection ? "ALINHADA" : "CONFLITO_ESTRUTURAL";
}

// §3.2 Regra 3 do documento do Operador ("R:R ruim anula alta
// confluência"): só compara quando o Conselho tem uma maioria real forte
// — abaixo disso, "concordância moderada + Risk sem sugestão" não é um
// conflito digno de nome, é o comportamento normal do Risk Engine.
const COUNCIL_AGREEMENT_HIGH = 0.7;

/** Risk Engine (buildRiskSuggestion, vol+Kelly) × Conselho (council.ts,
 *  massa de opinião real, nunca probabilidade — Regra de Ouro 2). Só
 *  informa o choque nomeado no documento §3.2 Regra 3; nunca invalida o
 *  cenário (isso seria uma segunda decisão — LEI 24). */
export function riskConfluenceVerdict(
  riskStatus: "OK" | "SEM_SUGESTAO" | null,
  councilStance: CouncilStance | null,
  councilAgreement: number | null,
): PairVerdict {
  if (riskStatus === null || councilStance === null || councilStance === "ABSTAIN" || councilStance === "NEUTRAL") return null;
  if (councilAgreement === null || councilAgreement < COUNCIL_AGREEMENT_HIGH) return null;
  return riskStatus === "OK" ? "ALINHADA" : "CONFLITO_ESTRUTURAL";
}

/** Agrega os pares resolvidos numa lista nomeada — o `evidence.conflicts[]`
 *  estruturado que AUDITORIA_MARKETBRAIN.md §2 identificou como o gap
 *  real (hoje cada par tem seu próprio veredito solto, sem lista
 *  central). ALINHADA nunca vira entrada (não é notícia); null nunca
 *  vira entrada (ausência de leitura não é conflito). */
export function collectConflicts(input: {
  regimeStructure: PairVerdict;
  riskConfluence: PairVerdict;
}): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  if (input.regimeStructure === "CONFLITO_ESTRUTURAL") {
    conflicts.push({
      motorA: "regime",
      motorB: "structure",
      description: "Regime (ADX/Bollinger) e Estrutura (HH/HL fractal) apontam direções opostas",
      severity: "ALTO",
    });
  }
  if (input.riskConfluence === "CONFLITO_ESTRUTURAL") {
    conflicts.push({
      motorA: "risk",
      motorB: "council",
      description: "Conselho fortemente direcional, mas o Risk Engine não valida a sugestão (R:R/insumo insuficiente para a política de risco)",
      severity: "CRITICO",
    });
  }
  return conflicts;
}
