// scenario-engine.ts — V-MAX Fase 2 (Supremacia): Motor de Cenários
// "Path A vs Path B".
//
// HONESTIDADE ESTRUTURAL (a mesma da Fase F, agora ao nível de cenário):
// este motor NÃO prevê o mercado e NÃO emite probabilidades. O que ele
// monta é 100% derivado de dado real já existente:
//   - os ALVOS de cada caminho são NÍVEIS REAIS já mapeados pelos motores
//     (pools de liquidez não varridos, S1/R1, níveis Fibonacci com
//     confluência real, POC/HVN do Volume Profile) — o próximo nível real
//     acima e abaixo do preço real;
//   - os PESOS de cada caminho são a massa de OPINIÃO direcional real do
//     Conselho (pool linear da Fase F via CouncilDecision.opinionMass) —
//     rotulados explicitamente como opinião de comitê (`basis`), NUNCA
//     probabilidade de mercado. Calibrar probabilidade real exigiria
//     histórico de acertos que esta base não tem (mesma nota da Fase F).
// Sem preço real => null. Sem nível real de um lado => target null honesto
// daquele lado. Conselho abstido => pesos null (caminhos existem como
// geografia real de níveis, sem opinião direcional).
//
// Camada de análise/exibição — LEI 24 intacta: nunca alimenta o Core
// Engine, nunca gera ordem.
import type { CouncilDecision } from "./council";

export const SCENARIO_CONTRACT_VERSION = 1 as const;

/** Um nível real candidato a alvo — preço + de qual motor real veio. */
export interface ScenarioLevel {
  price: number;
  sourceKind: string; // ex.: 'EQH', 'SR_RESISTANCE_1', 'FIB_61.8', 'VP_POC'
}

export interface ScenarioPath {
  direction: "LONG" | "SHORT";
  // O PRÓXIMO nível real no caminho (o mais perto do preço daquele lado);
  // null honesto quando nenhum motor mapeou nível real daquele lado.
  target: ScenarioLevel | null;
  // Massa de opinião real do conselho nesta direção (0..1) — opinião de
  // comitê, nunca probabilidade. null com conselho abstido/travado.
  opinionWeight: number | null;
}

export interface ScenarioProjection {
  contractVersion: typeof SCENARIO_CONTRACT_VERSION;
  basis: "COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY"; // rótulo permanente da natureza dos pesos
  price: number; // preço real usado como origem dos caminhos
  pathA: ScenarioPath; // direção da postura do conselho (LONG por convenção quando NEUTRAL)
  pathB: ScenarioPath; // o caminho oposto
  computedAt: number;
}

/** Projeta os dois caminhos a partir do preço real + níveis reais + opinião
 *  real do conselho. FAIL_CLOSED: sem preço real => null. */
export function buildScenarioProjection(
  price: number | null,
  levels: ScenarioLevel[],
  council: CouncilDecision | null,
  computedAt: number = Date.now(),
): ScenarioProjection | null {
  if (price === null || !Number.isFinite(price)) return null;

  const valid = levels.filter((l) => Number.isFinite(l.price));
  // Próximo nível real ACIMA (menor entre os maiores) e ABAIXO (maior
  // entre os menores) — a geografia real imediata, nunca um alvo projetado.
  const above = valid.filter((l) => l.price > price).sort((a, b) => a.price - b.price)[0] ?? null;
  const below = valid.filter((l) => l.price < price).sort((a, b) => b.price - a.price)[0] ?? null;

  const mass = council && !council.riskGated ? council.opinionMass : null;
  const longWeight = mass ? mass.long : null;
  const shortWeight = mass ? mass.short : null;

  const longPath: ScenarioPath = { direction: "LONG", target: above, opinionWeight: longWeight };
  const shortPath: ScenarioPath = { direction: "SHORT", target: below, opinionWeight: shortWeight };

  // Path A = direção da postura real do conselho; NEUTRAL/ABSTAIN => LONG
  // por convenção fixa documentada (ordem estável para a UI, não um viés:
  // os pesos continuam dizendo a verdade sobre a opinião).
  const aIsLong = council?.stance !== "SHORT";
  return {
    contractVersion: SCENARIO_CONTRACT_VERSION,
    basis: "COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY",
    price,
    pathA: aIsLong ? longPath : shortPath,
    pathB: aIsLong ? shortPath : longPath,
    computedAt,
  };
}
