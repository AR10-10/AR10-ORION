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

// v3 (Evolução Integrativa §6): o contrato passa a CARREGAR heatTier —
// passthrough literal do tier real já recebido nos inputs (que até aqui
// só alimentava reasonsAgainst). Fonte do eixo RISCO da Readability Layer;
// este módulo continua não decidindo nada com ele (LEI 24).
export const NEXUS_DECISION_CONTRACT_VERSION = 3 as const;

// V2 §3 — Estado operacional padronizado, derivado SÓ de leituras reais
// (prioridades documentadas em deriveOperationalState):
//   OBSERVANDO   Núcleo em WAIT, sem plano — só observação.
//   PREPARANDO   Núcleo direcional, mas o Conselho ainda não sustenta um
//                plano (gap real presente) — cenário em preparação.
//   CONFIRMANDO  Plano real existe; preço FORA da zona de entrada e nenhum
//                alvo provado — aguardando o mercado confirmar/chegar.
//   EXECUTAVEL   Plano real existe e o preço está DENTRO da zona de entrada
//                agora (mesma leitura inEntryZone com histerese do App).
//   GERENCIANDO  >=1 alvo real provado (ratchet ativo — stop em B/E+).
//   ENCERRADO    Sem plano ativo e a ÚLTIMA resolução real (alvo/stop)
//                aconteceu dentro da janela recente — pós-operação.
// "EXECUTÁVEL" aqui é rótulo de ESTADO DE LEITURA (preço na zona do plano
// consultivo) — este terminal continua permanentemente read-only, nunca
// executa nada (FAIL_CLOSED do projeto inteiro).
export type NexusOperationalState =
  | "OBSERVANDO"
  | "PREPARANDO"
  | "CONFIRMANDO"
  | "EXECUTAVEL"
  | "GERENCIANDO"
  | "ENCERRADO";

// Janela documentada do estado ENCERRADO (parâmetro declarado, mesma
// natureza dos limiares 70/30 do RSI — não uma medição).
export const NEXUS_CLOSED_WINDOW_MS = 5 * 60_000;

// V2 §4 — teto documentado de cada lista de justificativa (leitura <5s;
// o debate completo dos 7 agentes continua no widget do Conselho).
export const NEXUS_MAX_REASONS = 4;

export type NexusOperation = "LONG" | "SHORT" | "AGUARDAR";

export type NexusPlanGap =
  | "AWAITING_COUNCIL" // Conselho ainda sem primeira leitura real
  | "RISK_GATED" // RiskAgent travou o Conselho (fail-closed)
  | "COUNCIL_NEUTRAL" // Conselho neutro/sem quórum (pode divergir do Núcleo — honesto)
  | "NO_STRUCTURE" // stance direcional mas sem estrutura real p/ entrada/stop/alvo
  | "DIRECTION_CONFLICT"; // plano do Conselho na direção OPOSTA à operação do Núcleo (§16-8)

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
  // V2 §3: estado operacional único — alimenta header/assistente/tooltip.
  operationalState: NexusOperationalState;
  // V2 §4: justificativa estruturada — SÓ leituras reais já computadas
  // (rationale literal dos votos do Conselho, subsistemas do Conviction,
  // Heat extremo, zona Premium/Discount). Cap NEXUS_MAX_REASONS por lista;
  // listas vazias são o estado honesto comum.
  reasonsFor: string[];
  reasonsAgainst: string[];
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
  // v3: tier real do Heat Score (passthrough dos inputs) — consumido pelo
  // eixo RISCO da Readability; null honesto quando o motor não tem leitura.
  heatTier: string | null;
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
  // ── V2 ──
  // Preço dentro da zona de entrada AGORA (mesma leitura com histerese
  // já computada no App — nunca re-derivada aqui).
  inEntryZone: boolean | null;
  // Última resolução real do track record (alvo/stop), para ENCERRADO.
  lastResolvedAt: number | null;
  // Votos reais do Conselho (subset: agente/stance/rationale literais).
  councilVotes: Array<{ agent: string; stance: string; rationale: string }> | null;
  // Subsistemas do Conviction Engine (agree/disagree reais).
  convictionMembers: Array<{ id: string; agreesWithCore: boolean | null; detail: string }> | null;
  // Tier real do Heat Score (EXTREMO => "volatilidade/atividade elevada").
  heatTier: string | null;
  // Zona Premium/Discount real do último fechamento.
  premiumDiscountZone: "PREMIUM" | "EQUILIBRIUM" | "DISCOUNT" | null;
  // Cockpit de Leitura §4/§5-sexto: estados reais das duas linhas de
  // equilíbrio (histerese de vwap-state.ts) — entram na justificativa
  // estruturada como fontes nomeadas. Display-only: informam conflito,
  // NUNCA bloqueiam/alteram a operação (LEI 24). Optional/fail-closed:
  // null/NEUTRAL não fabrica lado nenhum.
  vwapState?: "BULLISH" | "BEARISH" | "NEUTRAL" | null;
  nexusLineState?: "BULLISH" | "BEARISH" | "NEUTRAL" | null;
}

function deriveOperationalState(
  operation: NexusOperation,
  hasPlan: boolean,
  targetsHit: number,
  inEntryZone: boolean | null,
  lastResolvedAt: number | null,
  now: number,
): NexusOperationalState {
  if (hasPlan) {
    if (targetsHit >= 1) return "GERENCIANDO";
    if (inEntryZone === true) return "EXECUTAVEL";
    return "CONFIRMANDO";
  }
  if (lastResolvedAt !== null && now - lastResolvedAt <= NEXUS_CLOSED_WINDOW_MS && now >= lastResolvedAt) {
    return "ENCERRADO";
  }
  return operation === "AGUARDAR" ? "OBSERVANDO" : "PREPARANDO";
}

// §4: monta as duas listas a partir de leituras reais nomeadas. Cada item
// carrega a FONTE entre parênteses — verificável, nunca uma frase solta.
function buildReasons(
  operation: NexusOperation,
  inputs: NexusDecisionInputs,
): { reasonsFor: string[]; reasonsAgainst: string[] } {
  const reasonsFor: string[] = [];
  const reasonsAgainst: string[] = [];
  if (operation !== "AGUARDAR") {
    for (const v of inputs.councilVotes ?? []) {
      if (v.stance !== "LONG" && v.stance !== "SHORT") continue; // NEUTRAL/ABSTAIN não é a favor nem contra
      (v.stance === operation ? reasonsFor : reasonsAgainst).push(`${v.rationale} (Conselho·${v.agent})`);
    }
    for (const m of inputs.convictionMembers ?? []) {
      if (m.agreesWithCore === null) continue; // sem leitura real => nem a favor nem contra
      (m.agreesWithCore ? reasonsFor : reasonsAgainst).push(`${m.detail} (Conviction·${m.id})`);
    }
    if (inputs.premiumDiscountZone === "DISCOUNT" || inputs.premiumDiscountZone === "PREMIUM") {
      const favors = (operation === "LONG") === (inputs.premiumDiscountZone === "DISCOUNT");
      (favors ? reasonsFor : reasonsAgainst).push(
        `Preço em ${inputs.premiumDiscountZone} do range (Premium/Discount)`,
      );
    }
    // Cockpit de Leitura §4: os equilíbrios entram na justificativa — o
    // exemplo canônico da diretriz ("Tendência LONG + VWAP vendedora")
    // vira um contrário VISÍVEL e nomeado, nunca um bloqueio (LEI 24).
    // NEUTRAL fica de fora (sem desvio direcional confirmado, sem lado).
    if (inputs.vwapState === "BULLISH" || inputs.vwapState === "BEARISH") {
      const favors = (operation === "LONG") === (inputs.vwapState === "BULLISH");
      (favors ? reasonsFor : reasonsAgainst).push(
        `Preço ${inputs.vwapState === "BULLISH" ? "acima" : "abaixo"} da VWAP — estado ${inputs.vwapState === "BULLISH" ? "comprador" : "vendedor"} (VWAP)`,
      );
    }
    if (inputs.nexusLineState === "BULLISH" || inputs.nexusLineState === "BEARISH") {
      const favors = (operation === "LONG") === (inputs.nexusLineState === "BULLISH");
      (favors ? reasonsFor : reasonsAgainst).push(
        `Nexus Line ${inputs.nexusLineState === "BULLISH" ? "compradora" : "vendedora"} (Nexus Line)`,
      );
    }
  }
  // Atividade extrema é fator CONTRÁRIO independente de direção (§4 da
  // diretriz: "volatilidade elevada") — leitura real do Heat Score.
  if (inputs.heatTier === "EXTREMO") {
    reasonsAgainst.push("Atividade/volatilidade extrema agora (Heat Score)");
  }
  return {
    reasonsFor: reasonsFor.slice(0, NEXUS_MAX_REASONS),
    reasonsAgainst: reasonsAgainst.slice(0, NEXUS_MAX_REASONS),
  };
}

export function buildNexusDecision(inputs: NexusDecisionInputs, computedAt: number = Date.now()): NexusDecision {
  const operation: NexusOperation =
    inputs.coreDirection === "LONG" ? "LONG" : inputs.coreDirection === "SHORT" ? "SHORT" : "AGUARDAR";

  let plan: NexusDecision["plan"] = null;
  let planGap: NexusPlanGap | null = null;
  // §16-8 (Omega Core, "não permite LONG e SHORT simultâneos"): trade-plan.ts
  // trava pela leitura do CONSELHO, não pela do Core Engine (LEI 24) — as
  // duas podem divergir por um ciclo real (já documentado no
  // TradePlanTopStrip). Sem esta guarda, um plano SHORT sobreviveria um
  // render fundido como "Operação: LONG" — a mesma tela mostrando as duas
  // direções ao mesmo tempo. A guarda NUNCA barra o Núcleo (operation
  // continua passthrough literal); só impede RENDERIZAR um plano cuja
  // direção contradiz a operação — o gap fica nomeado, nunca um plano
  // silenciosamente incoerente.
  if (inputs.plan && operation !== "AGUARDAR" && inputs.plan.direction !== operation) {
    planGap = "DIRECTION_CONFLICT";
  } else if (inputs.plan) {
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

  const { reasonsFor, reasonsAgainst } = buildReasons(operation, inputs);
  return {
    contractVersion: NEXUS_DECISION_CONTRACT_VERSION,
    operation,
    operationalState: deriveOperationalState(
      operation,
      plan !== null,
      Math.max(0, Math.min(inputs.targetsHit, inputs.plan?.targets.length ?? 0)),
      inputs.inEntryZone,
      inputs.lastResolvedAt,
      computedAt,
    ),
    reasonsFor,
    reasonsAgainst,
    operationSource: "CORE_ENGINE",
    confidenceLabel: inputs.coreConfidence ?? null,
    score: typeof inputs.score === "number" && Number.isFinite(inputs.score) ? inputs.score : null,
    scoreZone: inputs.scoreZoneLabel ?? null,
    scoreTrend: inputs.scoreTrend ?? null,
    plan,
    planGap,
    reason: inputs.assistantMessage?.text ?? null,
    reasonBasis: inputs.assistantMessage?.basis ?? null,
    heatTier: inputs.heatTier ?? null,
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
  DIRECTION_CONFLICT: "Plano do Conselho na direção oposta ao Núcleo — aguardando realinhamento",
};
