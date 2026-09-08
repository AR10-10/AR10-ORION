// model-governance.ts — MASTER ORDER Phase G: "Pode ser promovido?"
//
//     CANDIDATE → SHADOW → OOS → VALIDATION → PROMOTION
//
// ── ESTE MÓDULO NÃO CALCULA NADA ───────────────────────────────────────
// É a coisa mais importante a dizer sobre ele, e está primeiro de
// propósito. Cada um dos quatro portões abaixo já tem um veredito REAL,
// medido por um módulo que existe e é testado. O que não existia era
// alguém que os LESSE JUNTOS e respondesse a pergunta do §75.
//
// Um módulo de governança que inventasse os próprios critérios seria a
// pior coisa possível aqui: daria autoridade de decisão a números que
// ninguém mediu. Então a regra é dura — este arquivo não tem uma única
// fórmula, um único limiar e uma única constante estatística. Só
// composição. Um teste trava isso.
//
// ── A LACUNA REAL, E POR QUE ELA É A MESMA DE SEMPRE ────────────────────
// Auditoria da Phase E antes de construir: dos 6 itens, 4 já existiam
// inteiros (rolling windows e walk-forward em walk-forward-calibration.ts,
// drift em drift-detector.ts, shadow em shadow-calibration.ts) e 2 —
// candidate e incumbent comparison — já existiam IMPLÍCITOS: o próprio
// cabeçalho de shadow-calibration.ts chama a versão congelada de
// "(incumbent)" e a ao vivo de "(challenger)".
//
// Ou seja: a evidência dos quatro portões estava construída e testada, e
// morria espalhada em quatro módulos que nunca se falavam. Oitava
// ocorrência da mesma família de defeito desta sessão — só que aqui a
// fronteira onde o dado morria não era dentro de uma função, era ENTRE
// módulos.
//
// ── PROMOÇÃO AQUI NUNCA É UMA TROCA DE MODELO ──────────────────────────
// §71 da MASTER ORDER: "Nunca permitir Candidate alterar Core
// silenciosamente". LEI 24: nenhuma camada de confluência decide.
//
// Por isso o estado final se chama ELEGIVEL, e não PROMOVIDO: este módulo
// diz ao Operador que um candidato passou por todos os portões reais —
// nunca troca coisa alguma sozinho. Não existe caminho de código daqui
// para o Core Engine, para o Trade Plan ou para a probabilidade exibida, e
// um teste garante que continue assim.
//
// ── FAIL-CLOSED É O PADRÃO, NÃO UMA EXCEÇÃO ────────────────────────────
// Todo portão que NÃO PUDER ser avaliado reprova (Regra de Ouro 3).
// Ausência de evidência nunca é evidência de aprovação — e num módulo de
// promoção essa confusão seria exatamente o defeito que ele existe para
// impedir.
import type { ShadowCalibrationReport } from "./shadow-calibration";
import type { WalkForwardReport } from "./walk-forward-calibration";
import type { CalibrationFreshness } from "./calibration-freshness";
import type { DriftReading } from "./drift-detector";

/** Os estágios da esteira do §76, em ordem. `BLOQUEADO` não é um estágio
 *  da esteira: é onde um candidato para quando um portão reprova. */
export type PromotionStage = "CANDIDATE" | "SHADOW" | "OOS" | "VALIDATION" | "ELEGIVEL" | "BLOQUEADO";

export interface GovernanceGate {
  /** Nome do portão, na ordem da esteira. */
  stage: Exclude<PromotionStage, "ELEGIVEL" | "BLOQUEADO">;
  /** true só com evidência REAL de aprovação. Ausência reprova. */
  passed: boolean;
  /** Por que passou ou por que não — sempre a razão do módulo de origem,
   *  nunca uma frase genérica deste arquivo. */
  reason: string;
  /** Qual módulo real produziu este veredito. Torna auditável de onde
   *  cada decisão veio, sem precisar ler este código. */
  source: string;
}

export interface GovernanceReport {
  /** Onde o candidato está parado AGORA. */
  stage: PromotionStage;
  /** Os quatro portões, sempre todos presentes e sempre na ordem da
   *  esteira — inclusive os que nem chegaram a ser alcançados. Esconder
   *  os posteriores daria a impressão de que não existem. */
  gates: GovernanceGate[];
  /** O primeiro portão que reprovou, ou null quando todos passaram. */
  blockedBy: GovernanceGate | null;
  /** Uma frase: o que falta para o candidato avançar. */
  nextRequirement: string;
}

/**
 * Compõe os quatro vereditos reais na esteira do §76. Função pura, sem
 * nenhuma estatística própria.
 *
 * Os portões são AVALIADOS todos, sempre — mas a esteira é SEQUENCIAL: o
 * estágio reportado é o do primeiro que reprovou. Um candidato que não
 * bate o incumbente no shadow não "está em validação", mesmo que a
 * amostra esteja fresca.
 */
export function evaluatePromotion(
  shadow: ShadowCalibrationReport | null | undefined,
  walkForward: WalkForwardReport | null | undefined,
  freshness: CalibrationFreshness | null | undefined,
  drift: DriftReading | null | undefined,
): GovernanceReport {
  const gates: GovernanceGate[] = [
    gateCandidate(shadow),
    gateShadow(shadow),
    gateOos(walkForward),
    gateValidation(freshness, drift),
  ];

  const blockedBy = gates.find((g) => !g.passed) ?? null;
  const stage: PromotionStage = blockedBy === null ? "ELEGIVEL" : blockedBy.stage;

  return {
    stage,
    gates,
    // BLOQUEADO nunca é reportado como estágio: dizer QUAL portão prendeu
    // o candidato é sempre mais útil do que dizer que ele está preso.
    blockedBy,
    nextRequirement:
      blockedBy === null
        ? "Todos os portões reais passaram. O candidato está ELEGÍVEL — a promoção em si é decisão do Operador, nunca automática (§71)."
        : blockedBy.reason,
  };
}

/** CANDIDATE — existe um desafiante? Abaixo do mínimo do shadow os dois
 *  ajustes seriam idênticos e não há sequer o que comparar. */
function gateCandidate(shadow: ShadowCalibrationReport | null | undefined): GovernanceGate {
  const base = { stage: "CANDIDATE" as const, source: "nexus/shadow-calibration.ts" };
  if (!shadow || shadow.status !== "OK") {
    return {
      ...base,
      passed: false,
      reason: shadow?.reason ?? "Sem leitura de shadow: nenhum candidato existe ainda para ser avaliado.",
    };
  }
  return {
    ...base,
    passed: true,
    reason: `Existe um desafiante real: ${shadow.liveTrainSize} trades no ajuste ao vivo contra ${shadow.frozenTrainSize} no congelado.`,
  };
}

/** SHADOW — o desafiante bateu o incumbente em dados que NENHUM dos dois
 *  viu? Empate conta como não-bateu (nunca se arredonda a favor da
 *  mudança — mesma convenção do próprio shadow-calibration). */
function gateShadow(shadow: ShadowCalibrationReport | null | undefined): GovernanceGate {
  const base = { stage: "SHADOW" as const, source: "nexus/shadow-calibration.ts" };
  if (!shadow || shadow.status !== "OK") {
    return { ...base, passed: false, reason: "Sem comparação shadow concluída: o desafiante ainda não foi medido contra o incumbente." };
  }
  if (shadow.verdict !== "REFIT_MELHOROU") {
    return {
      ...base,
      passed: false,
      reason: `O reajuste NÃO melhorou a previsão na janela retida (Brier congelado ${fmt(shadow.brierFrozen)} vs ao vivo ${fmt(shadow.brierLive)}). Promover aqui seria perseguir ruído.`,
    };
  }
  return {
    ...base,
    passed: true,
    reason: `O desafiante errou menos que o incumbente em ${shadow.evalSize} trades retidos (Brier ${fmt(shadow.brierLive)} vs ${fmt(shadow.brierFrozen)}).`,
  };
}

/** OOS — fora da amostra, o modelo bate a taxa base? Um candidato que
 *  vence o incumbente mas perde para "repetir a taxa base" venceu uma
 *  corrida que não valia a pena correr. */
function gateOos(wf: WalkForwardReport | null | undefined): GovernanceGate {
  const base = { stage: "OOS" as const, source: "nexus/walk-forward-calibration.ts" };
  if (!wf || wf.status !== "OK" || wf.verdict === null) {
    return {
      ...base,
      passed: false,
      reason: wf?.reason ?? "Sem walk-forward concluído: o valor preditivo fora-da-amostra ainda não foi medido.",
    };
  }
  if (wf.verdict !== "MELHOR_QUE_A_TAXA_BASE") {
    return {
      ...base,
      passed: false,
      reason: `Fora-da-amostra o modelo não bate a taxa base (Brier Skill Score ${fmt(wf.brierSkillScore)}). Vencer o incumbente não basta se nenhum dos dois vale mais que repetir a média.`,
    };
  }
  return {
    ...base,
    passed: true,
    reason: `Fora-da-amostra o modelo bate a taxa base (Brier Skill Score ${fmt(wf.brierSkillScore)}).`,
  };
}

/** VALIDATION — a evidência acima ainda vale AGORA? Duas formas
 *  independentes de deixar de valer, e qualquer uma reprova:
 *  a amostra envelheceu, ou o mundo mudou por baixo dela. */
function gateValidation(
  freshness: CalibrationFreshness | null | undefined,
  drift: DriftReading | null | undefined,
): GovernanceGate {
  const base = { stage: "VALIDATION" as const, source: "nexus/calibration-freshness.ts + nexus/drift-detector.ts" };
  if (!freshness || freshness.status === "DADOS_INSUFICIENTES") {
    return { ...base, passed: false, reason: freshness?.reason ?? "Sem leitura de frescor: não dá para afirmar que a evidência ainda vale." };
  }
  if (freshness.status === "EXTRAPOLANDO") {
    return {
      ...base,
      passed: false,
      reason: freshness.reason ?? "A amostra já está além do alcance medido — promover seria projetar para fora da evidência.",
    };
  }
  if (!drift || drift.status !== "OK") {
    return { ...base, passed: false, reason: drift?.reason ?? "Sem leitura de drift: não dá para afirmar que o comportamento recente ainda se parece com a base." };
  }
  // DEGRADED e DRIFT_CONFIRMED reprovam. RECOVERING não: mudou A FAVOR do
  // Operador, e drift-detector.ts distingue os dois exatamente por isto —
  // tratar "melhorou muito" como bloqueio seria punir o candidato pelo
  // motivo errado.
  if (drift.state === "DRIFT_CONFIRMED" || drift.state === "DEGRADED") {
    return {
      ...base,
      passed: false,
      reason: drift.reason ?? `Drift ${drift.state}: o comportamento recente deixou de se parecer com a base em que o candidato foi medido.`,
    };
  }
  return {
    ...base,
    passed: true,
    reason: `Evidência ainda válida: amostra ${freshness.status.toLowerCase().replace(/_/g, " ")} e drift ${drift.state}.`,
  };
}

/** Número com 4 casas, ou a ausência dita por extenso — nunca um "0.0000"
 *  fabricado no lugar de "não medido" (Regra de Ouro 3). */
function fmt(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(4) : "não medido";
}

/** Linha curta para a UI: o estágio e o que falta. */
export function describeGovernance(report: GovernanceReport): string {
  const passados = report.gates.filter((g) => g.passed).length;
  if (report.stage === "ELEGIVEL") return `ELEGÍVEL · ${passados}/${report.gates.length} portões — promoção é decisão do Operador`;
  return `parado em ${report.stage} · ${passados}/${report.gates.length} portões`;
}
