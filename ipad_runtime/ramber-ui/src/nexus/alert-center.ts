// alert-center.ts — v16.0 DEFINITIVO §9 ("Alertas e Notificações — Sistema
// de Sobrevivência"): primeiro assinante real do evento
// ORGANISM.TRACK_RECORD.UPDATED (event-bus.ts) — declarado e emitido pelo
// OrganismOrchestrator desde a introdução do Track Record
// (signal-track-record.ts), mas sem nenhum consumidor até esta entrega.
//
// Escopo desta fatia: só a fonte que já tem publicador real e único no
// barramento ("uma transição real, um evento" — organism-orchestrator.ts).
// chartIntegrity/organismHealth (nexus/chart-integrity.ts,
// nexus/organism-health.ts) continuam computados por render dentro do
// próprio SystemHealthWidget, nunca escritos na store nem publicados no
// bus — alertar sobre eles exigiria antes dar-lhes um publicador real
// (mudança arquitetural própria, fora desta rodada).
//
// Pure function, zero I/O, zero clock próprio — mesma disciplina do resto
// de nexus/.
import type { TrackedPlan, TrackRecordState } from "./signal-track-record";

export type AlertTone = "success" | "info" | "danger";

export interface AlertEvent {
  id: string;
  tone: AlertTone;
  title: string;
  message: string;
  createdAt: number;
}

function formatPrice(price: number): string {
  return price >= 1 ? price.toFixed(2) : price.toFixed(6);
}

/** Compara a última entrada de `record.history` contra a última vista
 *  (`prevLastEntry`, por REFERÊNCIA — pushHistory sempre cria um objeto
 *  novo, mesma disciplina de imutabilidade do resto do arquivo-fonte).
 *
 *  `history` é ring-capped (TRACK_RECORD_HISTORY_CAP): depois que o teto é
 *  atingido, `history.length` PARA DE CRESCER a cada novo push (a mais
 *  antiga é descartada) — por isso o comprimento do array não é um sinal
 *  confiável de "algo novo aconteceu"; a comparação é sempre pela
 *  identidade da ÚLTIMA ENTRADA, nunca pelo tamanho.
 *
 *  REPLACED nunca gera alerta — é uma leitura consultiva substituída pela
 *  estrutura, não um resultado real de operação (mesma exclusão que
 *  hitRate() já aplica ao denominador em signal-track-record.ts). No
 *  máximo 1 plano ativo por vez e o organismo emite exatamente 1 evento
 *  por transição real (ver header de organism-orchestrator.ts), então
 *  olhar só a última entrada nunca perde uma resolução real. */
export function deriveTrackRecordAlert(prevLastEntry: TrackedPlan | null, record: TrackRecordState): AlertEvent | null {
  const history = record.history;
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  if (last === prevLastEntry) return null;
  if (last.status !== "TARGET_HIT" && last.status !== "PARTIAL_HIT" && last.status !== "STOP_HIT") return null;

  const direction = last.plan.direction;
  const price = last.resolvedPrice !== null ? formatPrice(last.resolvedPrice) : "preço indisponível";
  const totalTargets = last.plan.targets.length;
  const createdAt = last.resolvedAt ?? Date.now();
  const id = `track-${last.resolvedAt ?? createdAt}-${last.status}`;

  if (last.status === "TARGET_HIT") {
    return {
      id,
      tone: "success",
      title: "Alvo atingido",
      message: `${direction} — ${totalTargets}/${totalTargets} alvos reais atingidos em ${price}`,
      createdAt,
    };
  }
  if (last.status === "PARTIAL_HIT") {
    return {
      id,
      tone: "info",
      title: "Parcial validado",
      message: `${direction} — ${last.targetsHit}/${totalTargets} alvo(s) real(is) provado(s), encerrado em break-even/além em ${price}`,
      createdAt,
    };
  }
  return {
    id,
    tone: "danger",
    title: "Stop atingido",
    message: `${direction} — encerrado em ${price}, zero alvo real provado`,
    createdAt,
  };
}
