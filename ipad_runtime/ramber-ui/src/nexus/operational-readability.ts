// operational-readability.ts — Evolução Integrativa §7: a Operational
// Readability Layer como camada NOMEADA e pura.
//
// O que ela É: a transformação do NexusDecision (contrato único de
// decisão) em APRESENTAÇÃO legível — hierarquia, compactação, rótulos.
// O que ela NUNCA é: uma segunda fonte de decisão. Zero matemática de
// direção, zero recomputação de entrada/stop/alvo/ETA — só formatação de
// valores que o contrato já carrega (LEI 24 por construção: esta camada
// não pode nem alterar nem bloquear nada, ela só escreve texto).
//
// Origem real (Regra de Ouro 4 — realocar, nunca apagar): esta é a
// montagem multi-linha que vivia inline no CoreSignalBadge (App.tsx,
// "fusedTitle") desde a Diretriz da Fusão — movida para cá para a camada
// ter nome, contrato e EXECUÇÃO REAL de teste (antes só havia teste de
// padrão de fonte sobre o JSX). Conteúdo idêntico linha a linha.
//
// Fluxo (§7): NexusDecision → Operational Readability → Header/Chart/
// Assistente. Consumidores exibem as linhas; nunca as reinterpretam.
//
// Omega Core §7/§9 (v2 do contrato de linhas): "A direção e o timing não
// devem ser tratados como a mesma coisa" + "Separar: BIAS de: ENTRY —
// BIAS = LONG, ENTRY = AGUARDAR... preferir LONG + entrada confirmada a
// LONG + entrada forçada". deriveOutcomeLabel() é a tradução PURA disso:
// nenhum input novo, nenhuma matemática nova — só recombina operation
// (BIAS real, passthrough do Núcleo, LEI 24) com operationalState (ENTRY
// real, já derivado em decision-layer.ts) num rótulo de 6 valores que o
// Operador reconhece de bate-olho sem precisar cruzar duas leituras.
import { NEXUS_PLAN_GAP_LABEL, type NexusDecision } from "./decision-layer";
import { formatEtaRange } from "./eta-engine";

export const READABILITY_CONTRACT_VERSION = 4 as const;

const DASH = "—"; // mesmo caractere honesto de ausência usado em todo o header

// Preços grandes (>= 1000) sem casas; pequenos com 2 — a mesma convenção
// visual do resto do cockpit (fmt do App), replicada aqui como formatação
// pura (o módulo não importa React nem App).
const f = (v: number) => v.toFixed(v >= 1000 ? 0 : 2);

/** Linha única honesta quando a fusão ainda não existe (motor sem ciclo). */
export const READABILITY_FALLBACK_LINE =
  "Core Engine — primary directional read (mathematical S/R + structure classifier)";

// Evolução Profunda §4 (Diretriz de Continuidade): BIAS como eixo NOMEADO
// próprio, distinto da síntese LONG/SHORT×timing de deriveOutcomeLabel —
// "Qual é a direção estrutural dominante?" puro, sem nenhuma leitura de
// timing misturada. Deriva só de operation (passthrough real do Núcleo,
// LEI 24) e planGap==="DIRECTION_CONFLICT" (o único sinal real e
// inequívoco de que a estrutura mapeada contradiz o viés — nunca um
// "conflito" inventado a partir de reasonsAgainst, que também acumula
// fatores de RISCO como Heat EXTREMO, não de direção). NEUTRAL_BIAS vs
// INSUFFICIENT_DATA usa a mesma distinção fail-closed já usada em toda a
// base: confidenceLabel/score nulos = o Núcleo não tem leitura real
// nenhuma agora (dado ausente); presentes com operation AGUARDAR = o
// Núcleo LEU o mercado e concluiu, com dado real, que não há direção.
export type NexusBiasLabel = "LONG_BIAS" | "SHORT_BIAS" | "NEUTRAL_BIAS" | "CONFLICTED_BIAS" | "INSUFFICIENT_DATA";

export function deriveBiasLabel(decision: NexusDecision): NexusBiasLabel {
  if (decision.planGap === "DIRECTION_CONFLICT") return "CONFLICTED_BIAS";
  if (decision.operation === "LONG") return "LONG_BIAS";
  if (decision.operation === "SHORT") return "SHORT_BIAS";
  return decision.confidenceLabel === null && decision.score === null ? "INSUFFICIENT_DATA" : "NEUTRAL_BIAS";
}

// §7 Omega Core: o vocabulário de seis rótulos — LONG/SHORT só quando o
// TIMING (operationalState) já confirma execução; AGUARDAR LONG/AGUARDAR
// SHORT quando o BIAS existe mas o timing ainda não (§9, BIAS ≠ ENTRY);
// OBSERVAR/SEM OPERAÇÃO quando o Núcleo não tem direção real (AGUARDAR).
export type NexusOutcomeLabel = "LONG" | "SHORT" | "AGUARDAR LONG" | "AGUARDAR SHORT" | "OBSERVAR" | "SEM OPERAÇÃO";

export function deriveOutcomeLabel(decision: NexusDecision): NexusOutcomeLabel {
  const timingConfirmed = decision.operationalState === "EXECUTAVEL" || decision.operationalState === "GERENCIANDO";
  if (decision.operation === "LONG") return timingConfirmed ? "LONG" : "AGUARDAR LONG";
  if (decision.operation === "SHORT") return timingConfirmed ? "SHORT" : "AGUARDAR SHORT";
  // operation === "AGUARDAR": Núcleo sem direção real agora. OBSERVANDO é
  // o estado de repouso genuíno (nada real para acompanhar); qualquer
  // outro estado (ex.: ENCERRADO — resolução recente) ainda vale observar.
  return decision.operationalState === "OBSERVANDO" ? "SEM OPERAÇÃO" : "OBSERVAR";
}

const OUTCOME_CLAUSE: Record<NexusOutcomeLabel, string> = {
  LONG: "",
  SHORT: "",
  "AGUARDAR LONG": " — viés real do Núcleo; entrada ainda não confirmada (BIAS ≠ ENTRY)",
  "AGUARDAR SHORT": " — viés real do Núcleo; entrada ainda não confirmada (BIAS ≠ ENTRY)",
  OBSERVAR: " — sem viés direcional ativo agora; leitura recente para acompanhar",
  "SEM OPERAÇÃO": " — nenhum viés e nenhum plano neste momento",
};

// Evolução Profunda §2/§3: terceiro eixo, explicitamente SEPARADO de BIAS
// (deriveOutcomeLabel acima) e de ENTRY (operationalState em decision-
// layer.ts) — "existe uma ESTRUTURA que poderia permitir uma operação?".
// Puro: deriva só de decision.plan/planGap/operationalState, já reais —
// zero input novo, zero segunda fonte de verdade (o Trade Plan continua
// sendo o único lugar que decide se uma estrutura é real). A direção usa
// stopPrice vs entryLow (nunca `decision.operation`): plan pode existir
// com operation="AGUARDAR" quando o Conselho ainda segura um plano de um
// ciclo anterior ao Núcleo — SETUP reporta a direção da ESTRUTURA em si,
// não presume a do Núcleo.
export type NexusSetupState =
  | "LONG_SETUP"
  | "SHORT_SETUP"
  | "WAITING_FOR_RETEST"
  | "WAITING_FOR_CONFIRMATION"
  | "INVALIDATED"
  | "NO_VALID_SETUP";

export function deriveSetupState(decision: NexusDecision): NexusSetupState {
  if (decision.plan) {
    const timingConfirmed = decision.operationalState === "EXECUTAVEL" || decision.operationalState === "GERENCIANDO";
    if (!timingConfirmed) return "WAITING_FOR_RETEST";
    return decision.plan.stopPrice < decision.plan.entryLow ? "LONG_SETUP" : "SHORT_SETUP";
  }
  if (decision.planGap === "DIRECTION_CONFLICT") return "INVALIDATED";
  if (decision.planGap === "AWAITING_COUNCIL" || decision.planGap === "RISK_GATED" || decision.planGap === "COUNCIL_NEUTRAL") {
    return "WAITING_FOR_CONFIRMATION";
  }
  return "NO_VALID_SETUP"; // NO_STRUCTURE, ou sem plano e sem gap (Núcleo em AGUARDAR)
}

const SETUP_CLAUSE: Record<NexusSetupState, string> = {
  LONG_SETUP: "estrutura real de compra ativa (entrada/stop/alvo mapeados)",
  SHORT_SETUP: "estrutura real de venda ativa (entrada/stop/alvo mapeados)",
  WAITING_FOR_RETEST: "estrutura real formada — aguardando o preço voltar à zona",
  WAITING_FOR_CONFIRMATION: "viés presente, mas confluência/estrutura ainda insuficiente",
  INVALIDATED: "estrutura formada contradiz o viés do Núcleo — invalidada",
  NO_VALID_SETUP: "nenhuma estrutura real mapeada agora",
};

// Evolução Profunda §4: ENTRY como eixo NOMEADO próprio — "o momento de
// entrada está confirmado AGORA?". Espelho 1:1 de deriveSetupState (zero
// matemática nova, zero input novo): SETUP já responde exatamente esta
// pergunta por trás de outro nome ("existe configuração" vs "é hora
// agora" colapsam na MESMA leitura real — plan/operationalState/planGap),
// mas a diretriz pede os dois como campos INDEPENDENTES e nomeados
// (mesmo par mostrado junto: "SETUP: LONG_SETUP" + "ENTRY: ..."). A
// direção fica implícita em ENTRY_READY (BIAS já carrega a direção — não
// repetir LONG/SHORT aqui evita a mesma informação em dois rótulos).
export type NexusEntryState = "ENTRY_READY" | "ENTRY_WAIT_RETEST" | "ENTRY_WAIT_CONFIRMATION" | "ENTRY_INVALIDATED" | "NO_ENTRY";

const SETUP_TO_ENTRY: Record<NexusSetupState, NexusEntryState> = {
  LONG_SETUP: "ENTRY_READY",
  SHORT_SETUP: "ENTRY_READY",
  WAITING_FOR_RETEST: "ENTRY_WAIT_RETEST",
  WAITING_FOR_CONFIRMATION: "ENTRY_WAIT_CONFIRMATION",
  INVALIDATED: "ENTRY_INVALIDATED",
  NO_VALID_SETUP: "NO_ENTRY",
};

export function deriveEntryState(decision: NexusDecision): NexusEntryState {
  return SETUP_TO_ENTRY[deriveSetupState(decision)];
}

const ENTRY_CLAUSE: Record<NexusEntryState, string> = {
  ENTRY_READY: "confirmação estrutural — timing agora",
  ENTRY_WAIT_RETEST: "aguardando o preço retornar ao nível real mapeado",
  ENTRY_WAIT_CONFIRMATION: "estrutura ainda insuficiente — timing ausente",
  ENTRY_INVALIDATED: "premissa quebrada — plano contraditório",
  NO_ENTRY: "nenhuma estrutura real para avaliar timing",
};

/** Resumo operacional multi-linha do contrato fundido — a resposta do
 *  "bateu o olho" (§6): BIAS/SETUP/ENTRY como três eixos nomeados e
 *  independentes (Evolução Profunda §4), a síntese Leitura (BIAS×ENTRY,
 *  §7/§9 Omega Core), operação+estado, confiança (com o aviso real
 *  "nunca probabilidade"), plano (entrada/stop OU o motivo nomeado do
 *  gap), um TP por linha (R:R/ETA/ATINGIDO reais), motivo do assistente
 *  e as duas listas de justificativa estruturada. Linhas ausentes são
 *  omitidas — nunca preenchidas com placeholder fabricado. */
export function buildOperationalSummary(decision: NexusDecision | null | undefined): string[] {
  if (!decision) return [READABILITY_FALLBACK_LINE];
  const bias = deriveBiasLabel(decision);
  const setup = deriveSetupState(decision);
  const entry = deriveEntryState(decision);
  const outcome = deriveOutcomeLabel(decision);
  return [
    `NEXUS DECISION · Operação: ${decision.operation} (fonte: Core Engine — LEI 24) · Estado: ${decision.operationalState}`,
    `BIAS: ${bias}`,
    `Setup: ${setup} — ${SETUP_CLAUSE[setup]}`,
    `Entry: ${entry} — ${ENTRY_CLAUSE[entry]}`,
    `Leitura: ${outcome}${OUTCOME_CLAUSE[outcome]}`,
    `Confiança: ${decision.confidenceLabel ?? DASH} · Score ${decision.score ?? DASH}${decision.scoreZone ? ` (${decision.scoreZone})` : ""}${decision.scoreTrend ? ` · ${decision.scoreTrend}` : ""} — confluência real, nunca probabilidade`,
    decision.plan
      ? `Entrada: ${f(decision.plan.entryLow)}–${f(decision.plan.entryHigh)} (${decision.plan.entryBasis}) · Stop: ${f(decision.plan.stopPrice)} (${decision.plan.stopBasis})`
      : `Plano: ${decision.planGap ? NEXUS_PLAN_GAP_LABEL[decision.planGap] : DASH}`,
    ...(decision.plan
      ? decision.plan.targets.map(
          (t, i) =>
            `TP${i + 1}: ${f(t.price)} (${t.basis})${t.riskReward !== null ? ` · R:R 1:${t.riskReward.toFixed(2)}` : ""}${formatEtaRange(t.etaMsMin, t.etaMs) ? ` · ETA ${formatEtaRange(t.etaMsMin, t.etaMs)}` : ""}${t.hit ? " · ATINGIDO" : ""}`,
        )
      : []),
    decision.reason ? `Motivo: ${decision.reason} (${decision.reasonBasis ?? "base real"})` : null,
    decision.reasonsFor.length > 0 ? `Favoráveis: ${decision.reasonsFor.join(" · ")}` : null,
    decision.reasonsAgainst.length > 0 ? `Contrários: ${decision.reasonsAgainst.join(" · ")}` : null,
  ].filter((l): l is string => l !== null);
}
