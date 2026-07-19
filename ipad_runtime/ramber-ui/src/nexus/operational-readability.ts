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
import { NEXUS_PLAN_GAP_LABEL, type NexusDecision } from "./decision-layer";
import { formatEtaRange } from "./eta-engine";

export const READABILITY_CONTRACT_VERSION = 1 as const;

const DASH = "—"; // mesmo caractere honesto de ausência usado em todo o header

// Preços grandes (>= 1000) sem casas; pequenos com 2 — a mesma convenção
// visual do resto do cockpit (fmt do App), replicada aqui como formatação
// pura (o módulo não importa React nem App).
const f = (v: number) => v.toFixed(v >= 1000 ? 0 : 2);

/** Linha única honesta quando a fusão ainda não existe (motor sem ciclo). */
export const READABILITY_FALLBACK_LINE =
  "Core Engine — primary directional read (mathematical S/R + structure classifier)";

/** Resumo operacional multi-linha do contrato fundido — a resposta do
 *  "bateu o olho" (§6): operação+estado, confiança (com o aviso real
 *  "nunca probabilidade"), plano (entrada/stop OU o motivo nomeado do
 *  gap), um TP por linha (R:R/ETA/ATINGIDO reais), motivo do assistente
 *  e as duas listas de justificativa estruturada. Linhas ausentes são
 *  omitidas — nunca preenchidas com placeholder fabricado. */
export function buildOperationalSummary(decision: NexusDecision | null | undefined): string[] {
  if (!decision) return [READABILITY_FALLBACK_LINE];
  return [
    `NEXUS DECISION · Operação: ${decision.operation} (fonte: Core Engine — LEI 24) · Estado: ${decision.operationalState}`,
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
