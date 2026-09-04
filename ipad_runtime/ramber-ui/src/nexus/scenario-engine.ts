// scenario-engine.ts — V-MAX Fase 2 (Supremacia) + v2 (Diretriz Suprema de
// Evolução Integrativa §5/§6, "Future Path Map"): Motor de Cenários
// "Path A vs Path B".
//
// HONESTIDADE ESTRUTURAL (a mesma da Fase F, agora ao nível de cenário):
// este motor NÃO prevê o mercado e NÃO emite probabilidades. O que ele
// monta é 100% derivado de dado real já existente:
//   - os ALVOS de cada caminho são NÍVEIS REAIS já mapeados pelos motores
//     (pools de liquidez não varridos, S1/R1, níveis Fibonacci com
//     confluência real, POC/HVN do Volume Profile) — até MAX_SCENARIO_
//     TARGETS níveis reais mais próximos do preço, naquele lado;
//   - a INVALIDAÇÃO de cada caminho é o nível real mais próximo do LADO
//     OPOSTO — a mesma leitura estrutural que já é o alvo mais próximo do
//     caminho contrário (v2: achado de auditoria — "onde a tese fica
//     inválida?" é uma pergunta honesta de responder com o MESMO dado que
//     os alvos já usam, zero cálculo novo: se o preço alcança o próximo
//     nível real do lado oposto, a estrutura que sustentava a continuação
//     deste caminho já não existe mais);
//   - os PESOS de cada caminho são a massa de OPINIÃO direcional real do
//     Conselho (pool linear da Fase F via CouncilDecision.opinionMass) —
//     rotulados explicitamente como opinião de comitê (`basis`), NUNCA
//     probabilidade de mercado. Calibrar probabilidade real exigiria
//     histórico de acertos que esta base não tem (mesma nota da Fase F).
// Sem preço real => null. Sem nível real de um lado => lista de alvos
// vazia e invalidação null, honestos, daquele lado. Conselho abstido =>
// pesos null (caminhos existem como geografia real de níveis, sem opinião
// direcional).
//
// Camada de análise/exibição — LEI 24 intacta: nunca alimenta o Core
// Engine, nunca gera ordem.
import type { CouncilDecision } from "./council";

export const SCENARIO_CONTRACT_VERSION = 2 as const;

// Mesma convenção de MAX_TARGETS em trade-plan.ts: três é o teto real que
// os motores estruturais deste repositório sustentam honestamente sem
// inventar um nível projetado além do que já foi mapeado.
export const MAX_SCENARIO_TARGETS = 3;

/** Um nível real candidato a alvo — preço + de qual motor real veio. */
export interface ScenarioLevel {
  price: number;
  sourceKind: string; // ex.: 'EQH', 'SR_RESISTANCE_1', 'FIB_61.8', 'VP_POC'
}

export interface ScenarioPath {
  direction: "LONG" | "SHORT";
  // v2: até MAX_SCENARIO_TARGETS níveis reais nesta direção, mais perto
  // primeiro — nunca um nível projetado/interpolado, só os que outro
  // motor já mapeou. targets[0] é o antigo `target` único da v1. Lista
  // vazia honesta quando nenhum motor mapeou nível real daquele lado.
  targets: ScenarioLevel[];
  // v2: o nível real mais próximo do lado OPOSTO (ver header do arquivo)
  // — null honesto quando nenhum nível real existe daquele lado.
  invalidation: ScenarioLevel | null;
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
  // Níveis reais ACIMA (mais perto primeiro) e ABAIXO (mais perto
  // primeiro), até o teto declarado — a geografia real imediata, nunca um
  // alvo projetado.
  const above = valid.filter((l) => l.price > price).sort((a, b) => a.price - b.price).slice(0, MAX_SCENARIO_TARGETS);
  const below = valid.filter((l) => l.price < price).sort((a, b) => b.price - a.price).slice(0, MAX_SCENARIO_TARGETS);

  const mass = council && !council.riskGated ? council.opinionMass : null;
  const longWeight = mass ? mass.long : null;
  const shortWeight = mass ? mass.short : null;

  const longPath: ScenarioPath = { direction: "LONG", targets: above, invalidation: below[0] ?? null, opinionWeight: longWeight };
  const shortPath: ScenarioPath = { direction: "SHORT", targets: below, invalidation: above[0] ?? null, opinionWeight: shortWeight };

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

// Diretriz Final — Camada de Cenários Inteligentes §4 ("apresentar uma
// estimativa de confiança... não utilizar porcentagens arbitrárias...
// caso não exista base estatística suficiente, utilizar apenas
// classificações qualitativas"): opinionWeight já é honesto (massa real
// do pool do Conselho, nunca inventada — ver header do arquivo), mas
// esta base não tem backtest real que calibre o que "62%" realmente
// significa em acerto de mercado (Regra de Ouro 2). Mesmo espírito de
// `heatTier` (heat-score.ts): cortes uniformes de 25%, parâmetro
// documentado para leitura rápida, não uma medição/calibração — só a
// APRESENTAÇÃO muda de número para faixa qualitativa, o número real
// continua 100% intacto em `opinionWeight` para quem precisar dele.
export type ScenarioConfidenceLabel = "MUITO_FORTE" | "FORTE" | "MODERADA" | "FRACA";

export function describeScenarioConfidence(weight: number | null): ScenarioConfidenceLabel | null {
  if (weight === null || !Number.isFinite(weight)) return null;
  const w = Math.max(0, Math.min(1, weight));
  return w < 0.25 ? "FRACA" : w < 0.5 ? "MODERADA" : w < 0.75 ? "FORTE" : "MUITO_FORTE";
}

// §3 ("Pontos de Reteste... possível pullback/rejeição/continuação/
// reversão... sempre derivados de cálculos reais"): classificação
// honesta do TIPO de reação esperada num nível real, derivada só do
// `sourceKind` que o próprio nível JÁ carrega (zero motor novo, zero
// inferência nova — mesma disciplina de reaproveitar dado real de todo
// o resto deste arquivo). Prefixo de sourceKind desconhecido (engine
// futuro ainda não mapeado aqui) cai num rótulo genérico honesto, nunca
// lança exceção nem inventa uma categoria específica sem base real.
export function describeScenarioReaction(sourceKind: string): string {
  if (sourceKind.startsWith("EQH") || sourceKind.startsWith("EQL")) return "possível varredura de liquidez";
  if (sourceKind.startsWith("SR_")) return "possível pullback/rejeição";
  if (sourceKind.startsWith("FIB_")) return "possível retração";
  if (sourceKind.startsWith("VP_")) return "possível ímã de volume";
  return "possível reação estrutural";
}

// Diretriz Suprema §5/§6: formata um ScenarioPath para exibição textual
// compacta — alvo real mais próximo + quantos outros existem no caminho +
// invalidação real + confiança real. Único formatador (App.tsx tinha esta
// mesma lógica duplicada em 2 pontos antes desta evolução — Scenario
// Paths panel e CouncilWidget — unificados aqui, zero cálculo duplicado).
export function formatScenarioPathLabel(p: ScenarioPath): string {
  const nearest = p.targets[0];
  const target = nearest
    ? `${nearest.price.toFixed(0)} (${nearest.sourceKind})${p.targets.length > 1 ? ` +${p.targets.length - 1}` : ""}`
    : "no real level";
  const inv = p.invalidation !== null ? ` · inv ${p.invalidation.price.toFixed(0)}` : "";
  const confidence = describeScenarioConfidence(p.opinionWeight);
  const weight = confidence !== null ? ` · opinion ${confidence}` : "";
  return `${p.direction} → ${target}${inv}${weight}`;
}
