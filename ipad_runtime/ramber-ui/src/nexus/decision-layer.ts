// decision-layer.ts — Diretriz Final ("Fusão da Inteligência Operacional"):
// o Nexus Decision Layer como CONTRATO ÚNICO que funde as leituras já
// existentes numa só resposta operacional — Operação, Confiança, Entrada,
// Stop, TP1-3 (com ETA e R:R), Motivo resumido.
//
// O QUE ISTO É: agregação PURA de leituras que outros motores já
// computaram — zero matemática nova, zero segunda fonte (mesma resolução
// do Radar de Consenso e do Heat Score: reempacotar magnitudes reais).
//
// O QUE ISTO NUNCA É (LEI 24, inegociável): um segundo emissor de decisão.
// `operation` é PASSTHROUGH literal da direção do Core Engine — o único
// emissor real de LONG/SHORT/WAIT do sistema. Este módulo não pondera,
// não vota, não bloqueia e não altera nada: se o Core Engine diz LONG,
// aqui sai LONG; se diz WAIT/null, aqui sai AGUARDAR. A "Confiança" são
// os rótulos/scores reais já existentes (confidence categórica do motor +
// Score de confluência + tendência) — NUNCA probabilidade (Regra de
// Ouro 2).
//
// planGap: quando o Core Engine é direcional mas o Trade Plan (que é
// travado pelo CONSELHO, regra própria do trade-plan.ts) ainda não
// existe, o contrato carrega o MOTIVO real em código estruturado — a
// mesma divergência honesta que o TradePlanTopStrip já explica em texto.
// Fail-closed em toda parte: sem leitura => null explícito, nunca um
// campo fabricado para "completar" a resposta.
import type { TradePlan } from "./trade-plan";
import type { EtaReading } from "./eta-engine";

export const NEXUS_DECISION_CONTRACT_VERSION = 1 as const;

export type NexusOperation = "LONG" | "SHORT" | "AGUARDAR";

export type NexusPlanGap =
  | "AWAITING_COUNCIL" // Conselho ainda sem primeira leitura real
  | "RISK_GATED" // RiskAgent travou o Conselho (fail-closed)
  | "COUNCIL_NEUTRAL" // Conselho neutro/sem quórum (pode divergir do Núcleo — honesto)
  | "NO_STRUCTURE"; // stance direcional mas sem estrutura real p/ entrada/stop/alvo

export interface NexusDecisionTarget {
  price: number;
  basis: string;
  riskReward: number | null;
  // ETA real do alvo (faixa [mín, provável] em ms) — null honesto quando
  // não estimável; a UI formata (formatEtaRange), nunca este módulo.
  etaMsMin: number | null;
  etaMs: number | null;
  hit: boolean; // ratchet REAL do track record — nunca re-derivado do tick
}

export interface NexusDecision {
  contractVersion: typeof NEXUS_DECISION_CONTRACT_VERSION;
  operation: NexusOperation;
  operationSource: "CORE_ENGINE"; // constante deliberada: prova no contrato quem decide
  confidenceLabel: string | null; // rótulo categórico real do Core Engine (ALTA/MÉDIA/BAIXA)
  score: number | null; // Score de confluência 0-100 (nunca probabilidade)
  scoreZone: string | null; // rótulo da Zona de Confiança Institucional
  scoreTrend: string | null; // FORTALECENDO/ENFRAQUECENDO/ESTAVEL (Conviction)
  plan: {
    entryLow: number;
    entryHigh: number;
    entryBasis: string;
    stopPrice: number;
    stopBasis: string;
    targets: NexusDecisionTarget[];
  } | null;
  planGap: NexusPlanGap | null; // só quando plan === null
  reason: string | null; // frase curta REAL do Assistente Operacional (1ª prioridade)
  reasonBasis: string | null; // base verificável da frase
  computedAt: number;
}

export interface NexusDecisionInputs {
  coreDirection: "LONG" | "SHORT" | null;
  coreConfidence: string | null;
  plan: TradePlan | null;
  targetsHit: number;
  etaReading: EtaReading | null;
  score: number | null;
  scoreZoneLabel: string | null;
  scoreTrend: string | null;
  councilStance: "LONG" | "SHORT" | "NEUTRAL" | "ABSTAIN" | null; // null = sem leitura ainda
  councilRiskGated: boolean | null;
  assistantMessage: { text: string; basis: string } | null;
}

export function buildNexusDecision(inputs: NexusDecisionInputs, computedAt: number = Date.now()): NexusDecision {
  const operation: NexusOperation =
    inputs.coreDirection === "LONG" ? "LONG" : inputs.coreDirection === "SHORT" ? "SHORT" : "AGUARDAR";

  let plan: NexusDecision["plan"] = null;
  let planGap: NexusPlanGap | null = null;
  if (inputs.plan) {
    const p = inputs.plan;
    const targetsHit = Math.max(0, Math.min(inputs.targetsHit, p.targets.length));
    plan = {
      entryLow: p.entry.low,
      entryHigh: p.entry.high,
      entryBasis: p.entry.basis,
      stopPrice: p.stop.price,
      stopBasis: p.stop.basis,
      targets: p.targets.map((t, i) => {
        const eta = inputs.etaReading?.status === "OK" ? (inputs.etaReading.etas[i] ?? null) : null;
        return {
          price: t.price,
          basis: t.basis,
          riskReward: p.riskRewardRatios[i] ?? null,
          etaMsMin: eta ? eta.msMin : null,
          etaMs: eta ? eta.ms : null,
          hit: i < targetsHit,
        };
      }),
    };
  } else {
    // As MESMAS 4 causas reais e mutuamente exclusivas que o
    // TradePlanTopStrip explica em texto — aqui como código estruturado.
    planGap =
      inputs.councilStance === null
        ? "AWAITING_COUNCIL"
        : inputs.councilRiskGated
          ? "RISK_GATED"
          : inputs.councilStance === "NEUTRAL" || inputs.councilStance === "ABSTAIN"
            ? "COUNCIL_NEUTRAL"
            : "NO_STRUCTURE";
  }

  return {
    contractVersion: NEXUS_DECISION_CONTRACT_VERSION,
    operation,
    operationSource: "CORE_ENGINE",
    confidenceLabel: inputs.coreConfidence ?? null,
    score: typeof inputs.score === "number" && Number.isFinite(inputs.score) ? inputs.score : null,
    scoreZone: inputs.scoreZoneLabel ?? null,
    scoreTrend: inputs.scoreTrend ?? null,
    plan,
    planGap,
    reason: inputs.assistantMessage?.text ?? null,
    reasonBasis: inputs.assistantMessage?.basis ?? null,
    computedAt,
  };
}

// Rótulos curtos dos gaps para a UI — uma frase por código, aqui para o
// texto viver ao lado do contrato (e não espalhado em cada consumidor).
export const NEXUS_PLAN_GAP_LABEL: Record<NexusPlanGap, string> = {
  AWAITING_COUNCIL: "Aguardando primeira leitura do Conselho",
  RISK_GATED: "Conselho travado por risco (fail-closed)",
  COUNCIL_NEUTRAL: "Conselho neutro — sem plano acionável",
  NO_STRUCTURE: "Sem estrutura real para entrada/stop/alvo",
};
