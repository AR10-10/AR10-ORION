// snapshot-alerts.ts — PRODUTOR ÚNICO dos alertas derivados de transição
// de estado do terminal.
//
// POR QUE ESTE ARQUIVO EXISTE (achado medido da auditoria de duplicação,
// docs/MAPA_DUPLICACAO_2026-08-18.md): o sistema tinha DOIS motores de
// alerta independentes com cobertura quase disjunta.
//
//   alert-center.ts  → Track Record e Sweep  → viravam TOAST
//   voice-dispatcher → 11 regras de transição → viravam só FALA
//
// Resultado real para o Operador: ele OUVIA um CHoCH e não via alerta
// nenhum dele na tela; VIA um sweep que nunca era falado. Mesma verdade,
// dois canais desalinhados, duas graduações de severidade.
//
// Este módulo é o `EVENTO` da cadeia que a arquitetura já queria ter:
//
//   EVENTO (aqui) → IMPORTÂNCIA → COOLDOWN → PRIORIDADE → FALA / TOAST
//
// A voz deixa de DETECTAR e passa a CONSUMIR: voice-dispatcher.ts vira um
// adaptador fino que filtra os eventos com `speech` e os entrega à fila do
// voice-engine, mantendo intactas prioridade e anti-repetição. A UI de
// toast consome exatamente a mesma lista.
//
// REGRA ARQUITETURAL PRESERVADA (travada por alert-voice-wiring.test.ts):
// nada em nexus/ importa de voice/. Por isso `AlertSnapshot` é declarada
// aqui como o subconjunto ESTRUTURAL de campos que estas regras leem —
// `TerminalSnapshot` (voice-intents.ts) a satisfaz sem que exista qualquer
// import entre os dois lados.
//
// ZERO MATEMÁTICA NOVA: as 11 regras abaixo são as MESMAS de
// voice-dispatcher.computeAlerts(), com os mesmos limiares, as mesmas
// chaves anti-repetição e as mesmas sentenças faladas — palavra por
// palavra. Esta entrega move a detecção de lugar e dá a cada evento um
// corpo visual (id/tone/title/message); não muda nenhum critério.
import type { AlertEvent, AlertPriority, AlertTone } from "./alert-center";

/** Subconjunto estrutural do TerminalSnapshot que estas regras leem.
 *  Declarado aqui (e não importado de voice/) para manter nexus/ livre de
 *  dependência da camada de voz — ver header. */
export interface AlertSnapshot {
  direction: "LONG" | "SHORT" | null;
  engineStatus: "ok" | "error" | "pending";
  lorentzianOk: boolean;
  lorentzianClassification: string | null;
  recentOrderflowTypes: string[];
  recentLiquidationCount: number;
  structureBreakKey: string | null;
  structureBreakType: "BOS" | "CHOCH" | null;
  structureBreakDirection: "ALTA" | "BAIXA" | null;
  tradePlanOpenKey: string | null;
  tradePlanDirection: "LONG" | "SHORT" | null;
  tradePlanResolutionKey: string | null;
  tradePlanResolutionStatus: "TARGET_HIT" | "PARTIAL_HIT" | "STOP_HIT" | "REPLACED" | null;
  tradePlanTargetProgressKey: string | null;
  tradePlanTargetsHit: number;
  inEntryZone: boolean;
  convictionVerdict: "CONFIRMS" | "CONTRADICTS" | "MIXED" | null;
}

/** CONFIRMS > MIXED > CONTRADICTS — a mesma ordem já usada pelo
 *  voice-dispatcher para detectar convicção REDUZIDA. */
const VERDICT_RANK: Record<"CONFIRMS" | "MIXED" | "CONTRADICTS", number> = {
  CONFIRMS: 2,
  MIXED: 1,
  CONTRADICTS: 0,
};

function ev(
  id: string,
  tone: AlertTone,
  priority: AlertPriority,
  title: string,
  message: string,
  speech: string,
  createdAt: number,
): AlertEvent {
  return { id, tone, priority, title, message, speech, createdAt };
}

/**
 * Todos os alertas que uma TRANSIÇÃO REAL entre dois snapshots justifica.
 *
 * Anti-ruído (regra original preservada): um alerta por transição, nunca
 * por repetição do mesmo estado. Sem snapshot anterior não há transição —
 * devolve lista vazia, nunca um alerta de boot.
 *
 * @param now injetável para teste; o módulo não tem relógio próprio.
 */
export function deriveSnapshotAlerts(
  prev: AlertSnapshot | null,
  next: AlertSnapshot,
  now: number = Date.now(),
): AlertEvent[] {
  const out: AlertEvent[] = [];
  if (!prev) return out;

  // 1. Mudança de vetor confirmada pelo motor real (o evento mais relevante).
  if (next.direction && next.direction !== prev.direction) {
    const alta = next.direction === "LONG";
    out.push(ev(
      `dir-${next.direction}-${now}`,
      "info",
      "CRITICAL",
      "VETOR CONFIRMADO",
      `Núcleo real emitiu ${next.direction}`,
      `Atenção. Vetor ${alta ? "de alta" : "de baixa"} confirmado pelo motor real.`,
      now,
    ));
  } else if (!next.direction && prev.direction) {
    out.push(ev(
      `dir-none-${now}`,
      "info",
      "ALERT",
      "VETOR INVALIDADO",
      "Núcleo voltou a aguardar confirmação",
      "Vetor invalidado. Sistema de volta a aguardar confirmação.",
      now,
    ));
  }

  // 2. Divergência REAL surgindo entre motor e classificador independente.
  const diverges = (s: AlertSnapshot) =>
    !!(s.direction && s.lorentzianOk && s.lorentzianClassification &&
      s.lorentzianClassification !== "NEUTRAL" &&
      s.direction !== s.lorentzianClassification);
  if (diverges(next) && !diverges(prev)) {
    out.push(ev(
      `divergence-${now}`,
      "danger",
      "ALERT",
      "DIVERGÊNCIA",
      "Núcleo e classificador Lorentziano discordam",
      "Divergência entre motor e classificador Lorentziano. Cautela.",
      now,
    ));
  }

  // 3. Liquidações institucionais novas no feed real (forceOrder Binance).
  if (next.recentLiquidationCount > prev.recentLiquidationCount) {
    out.push(ev(
      `liquidation-${next.recentLiquidationCount}-${now}`,
      "info",
      "ALERT",
      "LIQUIDAÇÃO INSTITUCIONAL",
      "Liquidação relevante no feed real",
      "Liquidez institucional detectada. Liquidação relevante no feed real.",
      now,
    ));
  }

  // 4. Absorção surgindo no fluxo real (sinal do motor de order flow).
  const hasAbsorption = (s: AlertSnapshot) => s.recentOrderflowTypes.some((t) => /ABSOR/i.test(t));
  if (hasAbsorption(next) && !hasAbsorption(prev)) {
    out.push(ev(
      `absorption-${now}`,
      "info",
      "ALERT",
      "ABSORÇÃO",
      "Absorção institucional no fluxo real",
      "Absorção institucional detectada no fluxo real.",
      now,
    ));
  }

  // 5. Saúde do sistema — perda e recuperação do motor real.
  if (next.engineStatus === "error" && prev.engineStatus === "ok") {
    out.push(ev(
      `engine-error-${now}`,
      "danger",
      "CRITICAL",
      "MOTOR EM FALHA",
      "Verifique o diagnóstico do sistema",
      "Falha no motor de análise. Verifique o diagnóstico.",
      now,
    ));
  } else if (next.engineStatus === "ok" && prev.engineStatus !== "ok") {
    out.push(ev(
      `engine-ok-${now}`,
      "success",
      "INFO",
      "MOTOR OPERACIONAL",
      "Ciclo de análise real restabelecido",
      "Motor de análise operacional.",
      now,
    ));
  }

  // 6. Rompimento REAL de estrutura (BOS/CHOCH). A chave (tipo+índice) muda
  // só quando um rompimento NOVO acontece; o mesmo evento ainda vivo na
  // tela nunca repete. CHOCH é o evento mais significativo (primeiro sinal
  // real de possível reversão); BOS é confirmatório.
  if (next.structureBreakKey && next.structureBreakKey !== prev.structureBreakKey) {
    const dir = next.structureBreakDirection === "ALTA" ? "de alta" : "de baixa";
    const choch = next.structureBreakType === "CHOCH";
    out.push(ev(
      `structure-${next.structureBreakKey}`,
      "info",
      choch ? "ALERT" : "INFO",
      choch ? "CHOCH · MUDANÇA DE CARÁTER" : "BOS · ROMPIMENTO",
      choch ? `Estrutura ${dir} pode estar revertendo` : `Continuação ${dir} confirmada`,
      choch
        ? `Mudança de caráter ${dir}. Estrutura pode estar revertendo.`
        : `Rompimento de estrutura ${dir} confirma continuação.`,
      now,
    ));
  }

  // 7. Ciclo de vida REAL do Trade Plan — mesma regra anti-ruído de
  // chave-muda-uma-vez-por-evento do item 6.
  if (next.tradePlanOpenKey && next.tradePlanOpenKey !== prev.tradePlanOpenKey) {
    const compra = next.tradePlanDirection === "LONG";
    out.push(ev(
      `plan-open-${next.tradePlanOpenKey}`,
      "info",
      "INFO",
      "PLANO ABERTO",
      `Entrada ${compra ? "de compra" : "de venda"} identificada`,
      `Entrada ${compra ? "de compra" : "de venda"} identificada pelo Trade Plan real.`,
      now,
    ));
  }
  if (!prev.inEntryZone && next.inEntryZone) {
    out.push(ev(
      `entry-zone-${now}`,
      "info",
      "INFO",
      "ZONA DE ENTRADA",
      "Preço real na região ideal do plano ativo",
      "Preço real na região ideal de entrada do plano ativo.",
      now,
    ));
  }
  // Progresso real de alvo ENQUANTO o plano continua aberto — evento
  // distinto da resolução final, dispara uma vez por alvo adicional
  // provado, nunca na abertura do plano (targetsHit = 0 ali).
  if (
    next.tradePlanTargetProgressKey &&
    next.tradePlanTargetProgressKey !== prev.tradePlanTargetProgressKey &&
    next.tradePlanTargetsHit > 0
  ) {
    out.push(ev(
      `plan-progress-${next.tradePlanTargetProgressKey}`,
      "success",
      "ALERT",
      `ALVO ${next.tradePlanTargetsHit} ALCANÇADO`,
      "Stop movido para break-even",
      `Alvo ${next.tradePlanTargetsHit} do Trade Plan alcançado. Stop movido para break-even.`,
      now,
    ));
  }
  // RESOLUÇÃO DO PLANO — reconciliação explícita, e é o TODO que o header
  // de alert-center.ts deixou escrito ("consolidar exigiria reconciliar uma
  // diferença real: o voice-dispatcher também narra REPLACED, que aquele
  // arquivo deliberadamente NUNCA alerta").
  //
  // TARGET_HIT / PARTIAL_HIT / STOP_HIT NÃO são derivados aqui: quem os
  // produz é `deriveTrackRecordAlert` (alert-center.ts), sobre o evento
  // ORGANISM.TRACK_RECORD.UPDATED. Aquela versão é ESTRITAMENTE mais rica —
  // tem o preço real de resolução e a contagem alvos-provados/total, que o
  // snapshot não carrega. Derivar aqui também faria o mesmo resultado real
  // virar dois toasts e duas falas.
  //
  // REPLACED é o oposto: alert-center o exclui POR DECISÃO (é uma leitura
  // consultiva substituída pela estrutura, não um resultado de operação —
  // a mesma exclusão que hitRate() aplica ao denominador). Como a voz
  // sempre o narrou e a informação é real, ele permanece aqui — assim
  // nenhum evento se perde e nenhum é duplicado.
  if (
    next.tradePlanResolutionKey &&
    next.tradePlanResolutionKey !== prev.tradePlanResolutionKey &&
    next.tradePlanResolutionStatus === "REPLACED"
  ) {
    out.push(ev(
      `plan-res-${next.tradePlanResolutionKey}`,
      "info",
      "INFO",
      "PLANO SUBSTITUÍDO",
      "Leitura de estrutura mais recente assumiu",
      "Plano substituído por uma leitura de estrutura mais recente.",
      now,
    ));
  }

  // 8. Convicção real caindo (Confluence Engine) — só entre duas leituras
  // reais (nunca a partir de null/sem-leitura, que não é "reduzida", é
  // "indisponível").
  if (
    prev.convictionVerdict && next.convictionVerdict &&
    VERDICT_RANK[next.convictionVerdict] < VERDICT_RANK[prev.convictionVerdict]
  ) {
    out.push(ev(
      `conviction-${next.convictionVerdict}-${now}`,
      "danger",
      "ALERT",
      "CONVICÇÃO REDUZIDA",
      "Subsistemas de confluência perderam alinhamento",
      "Convicção real reduzida entre os subsistemas de confluência.",
      now,
    ));
  }

  return out;
}
