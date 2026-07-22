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
// Omega Core §7/§9 (contrato de linhas v2+): "A direção e o timing não
// devem ser tratados como a mesma coisa" + "Separar: BIAS de: ENTRY —
// BIAS = LONG, ENTRY = AGUARDAR... preferir LONG + entrada confirmada a
// LONG + entrada forçada". BIAS/SETUP/ENTRY (abaixo) são três eixos
// PRÓPRIOS e independentes — cada um sua função dedicada, cada uma pura
// (zero input novo, zero matemática nova, só releitura de campos já
// reais do NexusDecision); deriveOutcomeLabel() é a SÍNTESE dos três num
// rótulo de bate-olho, nunca uma quarta fonte de verdade.
import { NEXUS_PLAN_GAP_LABEL, type NexusDecision } from "./decision-layer";
import { formatEtaRange } from "./eta-engine";
// v6: piso declarado de R:R (fecho da pendência "R:R mínimo") — anota o
// alvo cujo R:R real fica abaixo da convenção 1:2; ver rr-quality.ts para
// a natureza honesta do número (parâmetro declarado, nunca medição).
import { rrBelowFloor, rrFloorSuffix } from "./rr-quality";

export const READABILITY_CONTRACT_VERSION = 7 as const;

const DASH = "—"; // mesmo caractere honesto de ausência usado em todo o header

// Preços grandes (>= 1000) sem casas; pequenos com 2 — a mesma convenção
// visual do resto do cockpit (fmt do App), replicada aqui como formatação
// pura (o módulo não importa React nem App).
const f = (v: number) => v.toFixed(v >= 1000 ? 0 : 2);

/** Omega Core §5/§6: sufixo honesto de obstacleCount (trade-plan.ts) — só
 *  aparece quando há de fato >=1 zona real no caminho até o alvo; nunca
 *  invalida o alvo, só anota. Exportado (mesmo padrão de rrFloorSuffix)
 *  para o painel ANALYSIS reusar a MESMA frase, nunca uma segunda. */
export function obstacleSuffix(count: number | undefined): string {
  if (!count || count <= 0) return "";
  return ` · ${count} ${count === 1 ? "zona estrutural" : "zonas estruturais"} no caminho`;
}

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

// Evolução Profunda §2/§3: terceiro eixo, explicitamente SEPARADO de BIAS
// (acima) e de ENTRY (abaixo) — "existe uma ESTRUTURA que poderia
// permitir uma operação?". Puro: deriva só de decision.plan/planGap, já
// reais — zero input novo, zero segunda fonte de verdade (o Trade Plan
// continua sendo o único lugar que decide se uma estrutura é real). A
// direção usa stopPrice vs entryLow (nunca `decision.operation`): plan
// pode existir com operation="AGUARDAR" quando o Conselho ainda segura um
// plano de um ciclo anterior ao Núcleo — SETUP reporta a direção da
// ESTRUTURA em si, não presume a do Núcleo.
//
// Fase Final de Evolução Operacional (correção real de auditoria): a
// versão anterior exigia TIMING confirmado (operationalState EXECUTAVEL/
// GERENCIANDO) para retornar LONG_SETUP/SHORT_SETUP — mas a própria
// diretriz define, textualmente e duas vezes em cartas diferentes, "um
// setup pode existir sem que a entrada esteja autorizada" / "SETUP não
// significa que o operador deve entrar imediatamente". SETUP agora
// reflete só a EXISTÊNCIA real da estrutura (plan !== null) — o timing
// vira responsabilidade exclusiva de ENTRY, abaixo, nunca duplicado aqui.
export type NexusSetupState =
  | "LONG_SETUP"
  | "SHORT_SETUP"
  | "WAITING_FOR_RETEST"
  | "WAITING_FOR_CONFIRMATION"
  | "INVALIDATED"
  | "NO_VALID_SETUP";

export function deriveSetupState(decision: NexusDecision): NexusSetupState {
  if (decision.plan) {
    return decision.plan.stopPrice < decision.plan.entryLow ? "LONG_SETUP" : "SHORT_SETUP";
  }
  if (decision.planGap === "DIRECTION_CONFLICT") return "INVALIDATED";
  if (decision.planGap === "AWAITING_COUNCIL" || decision.planGap === "RISK_GATED" || decision.planGap === "COUNCIL_NEUTRAL") {
    return "WAITING_FOR_CONFIRMATION";
  }
  return "NO_VALID_SETUP"; // NO_STRUCTURE, ou sem plano e sem gap (Núcleo em AGUARDAR)
}

const SETUP_CLAUSE: Record<NexusSetupState, string> = {
  LONG_SETUP: "estrutura real de compra mapeada (entrada/stop/alvo reais)",
  SHORT_SETUP: "estrutura real de venda mapeada (entrada/stop/alvo reais)",
  // Não produzido pelos motores reais atuais nesta camada de leitura — o
  // dado real disponível não distingue "estrutura que já existiu e foi
  // perdida, aguardando reformar" de "nenhuma estrutura ainda"; mantido
  // no vocabulário para não quebrar o contrato de tipos, documentado
  // honestamente como não-alcançável até essa distinção ter uma fonte
  // real (nunca fabricada).
  WAITING_FOR_RETEST: "estrutura anterior perdida — aguardando nova formação",
  WAITING_FOR_CONFIRMATION: "viés presente, mas confluência/estrutura ainda insuficiente",
  INVALIDATED: "estrutura formada contradiz o viés do Núcleo — invalidada",
  NO_VALID_SETUP: "nenhuma estrutura real mapeada agora",
};

// Fase Final de Evolução Operacional §3: ENTRY como eixo NOMEADO e
// INDEPENDENTE — "existe confirmação suficiente para uma entrada AGORA?"
// — nunca mais um espelho de SETUP (a versão anterior colapsava as duas
// perguntas; a diretriz mostra explicitamente SETUP e ENTRY divergindo no
// mesmo instante: "SETUP: SHORT_SETUP" + "ENTRY: WAITING_FOR_RETEST").
// Vocabulário desta carta (renomeado da carta anterior: ENTRY_READY →
// ENTRY_CONFIRMED; ENTRY_WAIT_RETEST/ENTRY_WAIT_CONFIRMATION →
// WAITING_FOR_RETEST/WAITING_FOR_CONFIRMATION, sem prefixo). Puro: deriva
// só de plan/operationalState/planGap, já reais — zero input novo.
export type NexusEntryState = "ENTRY_CONFIRMED" | "WAITING_FOR_RETEST" | "WAITING_FOR_CONFIRMATION" | "ENTRY_INVALIDATED" | "NO_ENTRY";

export function deriveEntryState(decision: NexusDecision): NexusEntryState {
  if (decision.plan) {
    const timingConfirmed = decision.operationalState === "EXECUTAVEL" || decision.operationalState === "GERENCIANDO";
    // Estrutura real existe (SETUP já confirmou); o único sinal real de
    // timing que resta é se o preço está OU NÃO na zona de entrada agora
    // — tecnicamente um reteste (o preço precisa alcançar/retornar ao
    // nível real mapeado), por isso "WAITING_FOR_RETEST" aqui, mesmo
    // quando um exemplo isolado da diretriz escreveu "WAITING_FOR_
    // CONFIRMATION" para este caso: os dados reais só sustentam UM sinal
    // de timing pendente com plano já formado, nunca dois distintos —
    // fabricar essa segunda distinção violaria a Regra de Ouro 2/3.
    return timingConfirmed ? "ENTRY_CONFIRMED" : "WAITING_FOR_RETEST";
  }
  if (decision.planGap === "DIRECTION_CONFLICT") return "ENTRY_INVALIDATED";
  if (decision.planGap === "AWAITING_COUNCIL" || decision.planGap === "RISK_GATED" || decision.planGap === "COUNCIL_NEUTRAL") {
    return "WAITING_FOR_CONFIRMATION";
  }
  return "NO_ENTRY";
}

const ENTRY_CLAUSE: Record<NexusEntryState, string> = {
  ENTRY_CONFIRMED: "confirmação estrutural — timing agora",
  WAITING_FOR_RETEST: "aguardando o preço retornar ao nível real mapeado",
  WAITING_FOR_CONFIRMATION: "estrutura ainda insuficiente — timing ausente",
  ENTRY_INVALIDATED: "premissa quebrada — plano contraditório",
  NO_ENTRY: "nenhuma estrutura real para avaliar timing",
};

// §7 Omega Core + Fase Final de Evolução Operacional §3: a síntese final
// que combina BIAS×SETUP×ENTRY num só rótulo de leitura rápida. LONG/
// SHORT só quando o TIMING (ENTRY) já confirma execução (ganha o sufixo
// real "— PLANO ATIVO", já que timing confirmado implica plan!==null por
// construção); AGUARDAR LONG/SHORT quando existe BIAS E uma estrutura
// real ainda pendente de timing (SETUP direcional ou aguardando
// confirmação — §9, BIAS ≠ ENTRY); OBSERVAR quando o BIAS existe mas NÃO
// há nenhuma estrutura real por trás (SETUP inválido ou inexistente —
// nunca prometer "aguarde" por algo que não existe); SEM OPERAÇÃO/
// OBSERVAR quando o Núcleo não tem direção real (AGUARDAR).
export type NexusOutcomeLabel = "LONG" | "SHORT" | "AGUARDAR LONG" | "AGUARDAR SHORT" | "OBSERVAR" | "SEM OPERAÇÃO";

export function deriveOutcomeLabel(decision: NexusDecision): NexusOutcomeLabel {
  const timingConfirmed = decision.operationalState === "EXECUTAVEL" || decision.operationalState === "GERENCIANDO";
  if (decision.operation === "LONG" || decision.operation === "SHORT") {
    if (timingConfirmed) return decision.operation;
    const setup = deriveSetupState(decision);
    // BIAS real, mas nenhuma estrutura real por trás dele (nunca
    // invalidada nem inexistente) — "AGUARDAR" prometeria algo concreto
    // que não existe; OBSERVAR é a leitura honesta.
    if (setup === "NO_VALID_SETUP" || setup === "INVALIDATED") return "OBSERVAR";
    return decision.operation === "LONG" ? "AGUARDAR LONG" : "AGUARDAR SHORT";
  }
  // operation === "AGUARDAR": Núcleo sem direção real agora. OBSERVANDO é
  // o estado de repouso genuíno (nada real para acompanhar); qualquer
  // outro estado (ex.: ENCERRADO — resolução recente) ainda vale observar.
  return decision.operationalState === "OBSERVANDO" ? "SEM OPERAÇÃO" : "OBSERVAR";
}

const OUTCOME_CLAUSE: Record<NexusOutcomeLabel, string> = {
  LONG: " — PLANO ATIVO",
  SHORT: " — PLANO ATIVO",
  "AGUARDAR LONG": " — viés real do Núcleo; entrada ainda não confirmada (BIAS ≠ ENTRY)",
  "AGUARDAR SHORT": " — viés real do Núcleo; entrada ainda não confirmada (BIAS ≠ ENTRY)",
  OBSERVAR: " — sem estrutura real para aguardar agora; leitura recente para acompanhar",
  "SEM OPERAÇÃO": " — nenhum viés e nenhum plano neste momento",
};

// Evolução Integrativa §6 (v7 do contrato): os DOIS eixos que faltavam do
// modelo de síntese auditável — RISCO e CONFLUÊNCIA. Mesma lei de sempre:
// derivações PURAS de leituras que o contrato já carrega (heatTier real,
// R:R real vs piso declarado, planGap real, e os próprios eixos BIAS/
// ENTRY já derivados acima) — zero input novo, zero "super-score mágico"
// (§6 veta explicitamente), zero segunda decisão (LEI 24). Cada estado
// nomeia a FONTE real que o disparou — auditável, nunca um veredito solto.
export type NexusRiskState = "ACEITÁVEL" | "ELEVADO" | "INVÁLIDO";

/** Leitura de risco do plano/premissa atual, ou null honesto quando não
 *  há plano nem sinal real de risco a qualificar (linha omitida — nunca
 *  um julgamento fabricado sobre o nada). */
export function deriveRiskState(decision: NexusDecision): { state: NexusRiskState; basis: string } | null {
  if (decision.planGap === "DIRECTION_CONFLICT") {
    return { state: "INVÁLIDO", basis: "estrutura mapeada contradiz o viés do Núcleo (DIRECTION_CONFLICT)" };
  }
  if (decision.planGap === "RISK_GATED") {
    return { state: "ELEVADO", basis: "Conselho travado por risco (fail-closed)" };
  }
  if (decision.plan) {
    const factors: string[] = [];
    if (decision.heatTier === "EXTREMO") factors.push("Heat EXTREMO");
    if (rrBelowFloor(decision.plan.targets[0]?.riskReward ?? null)) factors.push("R:R do TP1 abaixo do piso 1:2");
    if (factors.length > 0) return { state: "ELEVADO", basis: factors.join(" · ") };
    return { state: "ACEITÁVEL", basis: "stop real mapeado · R:R no piso ou acima · sem fator extremo" };
  }
  return null;
}

export type NexusConfluenceState = "ALINHADA" | "MISTA" | "CONFLITANTE" | "INSUFICIENTE";

const CONFLUENCE_CLAUSE: Record<NexusConfluenceState, string> = {
  ALINHADA: "direção, estrutura e timing apontam juntos",
  MISTA: "evidência parcial — nem tudo confirmado ainda",
  CONFLITANTE: "estrutura mapeada contradiz o viés do Núcleo",
  INSUFICIENTE: "sem leitura real suficiente agora",
};

/** Síntese de alinhamento dos próprios eixos (§6): consequência das
 *  regras já existentes, nunca um número arbitrário. CONFLITANTE só nasce
 *  do único sinal real e inequívoco de conflito (DIRECTION_CONFLICT via
 *  CONFLICTED_BIAS) — nunca de reasonsAgainst, que também acumula fatores
 *  de RISCO (precedente já estabelecido em deriveBiasLabel). */
export function deriveConfluenceState(decision: NexusDecision): NexusConfluenceState {
  const bias = deriveBiasLabel(decision);
  if (bias === "INSUFFICIENT_DATA") return "INSUFICIENTE";
  if (bias === "CONFLICTED_BIAS") return "CONFLITANTE";
  const directional = bias === "LONG_BIAS" || bias === "SHORT_BIAS";
  if (directional && deriveEntryState(decision) === "ENTRY_CONFIRMED") return "ALINHADA";
  return "MISTA";
}

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
  const risk = deriveRiskState(decision);
  const confluence = deriveConfluenceState(decision);
  const outcome = deriveOutcomeLabel(decision);
  // v7 (Evolução Integrativa §6): a ordem das linhas é a ordem exata do
  // modelo de síntese — DIREÇÃO, ESTRUTURA, TIMING, RISCO, CONFLUÊNCIA,
  // DECISÃO. Risco sem plano/sinal real é omitido (nunca fabricado).
  return [
    `NEXUS DECISION · Operação: ${decision.operation} (fonte: Core Engine — LEI 24) · Estado: ${decision.operationalState}`,
    `BIAS: ${bias}`,
    `Setup: ${setup} — ${SETUP_CLAUSE[setup]}`,
    `Entry: ${entry} — ${ENTRY_CLAUSE[entry]}`,
    risk ? `Risco: ${risk.state} — ${risk.basis}` : null,
    `Confluência: ${confluence} — ${CONFLUENCE_CLAUSE[confluence]}`,
    `Leitura: ${outcome}${OUTCOME_CLAUSE[outcome]}`,
    `Confiança: ${decision.confidenceLabel ?? DASH} · Score ${decision.score ?? DASH}${decision.scoreZone ? ` (${decision.scoreZone})` : ""}${decision.scoreTrend ? ` · ${decision.scoreTrend}` : ""} — confluência real, nunca probabilidade`,
    decision.plan
      ? `Entrada: ${f(decision.plan.entryLow)}–${f(decision.plan.entryHigh)} (${decision.plan.entryBasis}) · Stop: ${f(decision.plan.stopPrice)} (${decision.plan.stopBasis})`
      : `Plano: ${decision.planGap ? NEXUS_PLAN_GAP_LABEL[decision.planGap] : DASH}`,
    ...(decision.plan
      ? decision.plan.targets.map(
          (t, i) =>
            `TP${i + 1}: ${f(t.price)} (${t.basis})${t.riskReward !== null ? ` · R:R 1:${t.riskReward.toFixed(2)}${rrFloorSuffix(t.riskReward)}` : ""}${formatEtaRange(t.etaMsMin, t.etaMs) ? ` · ETA ${formatEtaRange(t.etaMsMin, t.etaMs)}` : ""}${obstacleSuffix(t.obstacleCount)}${t.hit ? " · ATINGIDO" : ""}`,
        )
      : []),
    decision.reason ? `Motivo: ${decision.reason} (${decision.reasonBasis ?? "base real"})` : null,
    decision.reasonsFor.length > 0 ? `Favoráveis: ${decision.reasonsFor.join(" · ")}` : null,
    decision.reasonsAgainst.length > 0 ? `Contrários: ${decision.reasonsAgainst.join(" · ")}` : null,
  ].filter((l): l is string => l !== null);
}
