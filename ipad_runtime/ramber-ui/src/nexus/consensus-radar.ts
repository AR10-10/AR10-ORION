// consensus-radar.ts — Diretriz Complementar (Evolução da Inteligência
// Operacional §8, "Radar de Consenso"): agregador PURO que reempacota
// magnitudes 0..1 REAIS já computadas em outros motores — zero
// matemática nova de consenso, zero dado fabricado (Regra de Ouro 1).
//
// AUDITORIA REAL (antes de escrever este arquivo, via agente de
// exploração dedicado): das 7 categorias que a diretriz supõe, 6 já
// existem como magnitude real em algum lugar do código:
//   Estrutura    -> council.ts StructureAgent (votes[STRUCTURE].confidence), 0..1
//   Liquidez     -> council.ts LiquidityAgent (votes[LIQUIDITY].confidence), 0..1
//   Fluxo        -> council.ts OrderflowAgent (votes[ORDERFLOW].confidence), 0..1
//   Momentum     -> council.ts MomentumAgent (votes[MOMENTUM].confidence),
//                   RSI de Wilder real, 0..1
//   Volatilidade -> regime-engine.js bandwidth_percentile, threaded via
//                   engine-bridge.ts (engine.marketRegime.bandwidthPercentile)
//                   — real, já computado, mas achado real de auditoria:
//                   NUNCA antes lido em App.tsx (dado morto até este commit).
//   GMIL         -> gmil/consensus-engine.ts computeConsensus().score,
//                   -1..1 SINALIZADO (não 0..1 como as outras 5) — este
//                   radar usa Math.abs(score) como MAGNITUDE de consenso
//                   (a direção já é mostrada em outro lugar do Contexto
//                   Global; aqui só "quão forte", nunca "pra que lado").
//
// A SÉTIMA categoria que a diretriz supõe ("Risk Engine") NÃO EXISTE como
// magnitude contínua em lugar nenhum deste repositório: risk-engine.js só
// devolve percentuais de dimensionamento de posição (suggested_position_pct
// etc.) e um gate binário OK/SEM_SUGESTAO; o próprio voto do RiskAgent no
// Conselho é binário (confidence 1 quando viável, null quando ABSTAIN —
// nunca um valor intermediário real). Fabricar um número contínuo aqui só
// para preencher um 7º raio violaria a Regra de Ouro 1. Esta categoria
// fica FORA do radar de propósito — omissão documentada, não um buraco
// silencioso.
//
// GMIL x Liquidez/Fluxo (nuance honesta, não um bug): o institutionalConsensus
// do GMIL mistura engine.imbalance/engine.flowImbalance (leituras BRUTAS de
// livro de ofertas/fluxo, as mesmas que também alimentam o badge "DESEQ./
// PRESSÃO" já exibido em outro widget) com 3 provedores externos — números
// DIFERENTES dos usados aqui para Liquidez/Fluxo (que vêm da leitura
// independente do Conselho: imbalance de pools EQH/EQL varridos e
// concordância CVD+OFI). Ainda assim GMIL é parcialmente sobreposto em
// DOMÍNIO (mesmo fenômeno de mercado, contas diferentes) — nunca tratar as
// 6 categorias como 6 fontes 100% independentes.
import type { CouncilAgentId, CouncilDecision } from "./council";

export type ConsensusRadarCategory =
  | "ESTRUTURA"
  | "LIQUIDEZ"
  | "FLUXO"
  | "MOMENTUM"
  | "VOLATILIDADE"
  | "GMIL";

// Ordem fixa (mesma disciplina de CouncilDecision.votes): sempre as 6, na
// mesma sequência, nunca reordenadas por valor.
export const CONSENSUS_RADAR_CATEGORIES: readonly ConsensusRadarCategory[] = [
  "ESTRUTURA",
  "LIQUIDEZ",
  "FLUXO",
  "MOMENTUM",
  "VOLATILIDADE",
  "GMIL",
];

export interface ConsensusRadarSpoke {
  category: ConsensusRadarCategory;
  // 0..1 real. null = DADOS_INSUFICIENTES honesto (ABSTAIN do Conselho,
  // regime ainda sem leitura, ou GMIL sem provedor utilizável) — nunca um
  // 0 fabricado disfarçado de leitura real.
  value: number | null;
}

export interface ConsensusRadarReading {
  spokes: ConsensusRadarSpoke[]; // sempre as 6 de CONSENSUS_RADAR_CATEGORIES, nesta ordem
  computedAt: number;
}

function voteMagnitude(votes: CouncilDecision["votes"] | null | undefined, agent: CouncilAgentId): number | null {
  const vote = votes?.find((v) => v.agent === agent);
  // confidence pode ser 0 real (voto NEUTRAL sem desequilíbrio) — ?? só cai
  // para null quando o próprio voto não existe ou confidence é null (ABSTAIN).
  return vote?.confidence ?? null;
}

export interface ConsensusRadarInputs {
  council: CouncilDecision | null;
  bandwidthPercentile: number | null; // 0..1 real, regime-engine.js
  gmilScore: number | null; // -1..1 sinalizado real, institutionalConsensus.score
  computedAt?: number;
}

export function computeConsensusRadar(input: ConsensusRadarInputs): ConsensusRadarReading {
  const votes = input.council?.votes ?? null;
  const gmilMagnitude =
    input.gmilScore !== null && Number.isFinite(input.gmilScore) ? Math.abs(input.gmilScore) : null;
  const volatilidade =
    input.bandwidthPercentile !== null && Number.isFinite(input.bandwidthPercentile)
      ? input.bandwidthPercentile
      : null;
  return {
    spokes: [
      { category: "ESTRUTURA", value: voteMagnitude(votes, "STRUCTURE") },
      { category: "LIQUIDEZ", value: voteMagnitude(votes, "LIQUIDITY") },
      { category: "FLUXO", value: voteMagnitude(votes, "ORDERFLOW") },
      { category: "MOMENTUM", value: voteMagnitude(votes, "MOMENTUM") },
      { category: "VOLATILIDADE", value: volatilidade },
      { category: "GMIL", value: gmilMagnitude },
    ],
    computedAt: input.computedAt ?? Date.now(),
  };
}
