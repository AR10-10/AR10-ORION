// voice-dispatcher.ts — IRON-VOICE camada 4: ADAPTADOR da fila de fala.
//
// O QUE MUDOU E POR QUÊ (achado medido, docs/MAPA_DUPLICACAO_2026-08-18.md):
// este arquivo era o SEGUNDO produtor de alertas do sistema. Ele detectava
// 11 transições por conta própria e as transformava direto em fala, enquanto
// alert-center.ts detectava outras duas e as transformava em toast. Cobertura
// quase disjunta: o Operador OUVIA um CHoCH que nunca aparecia na tela e VIA
// um sweep que nunca era falado.
//
// Agora existe UM produtor — nexus/snapshot-alerts.ts — e este arquivo é o
// que ele sempre deveria ter sido: o adaptador que pega os eventos e entrega
// à fila de voz. A detecção saiu daqui; a apresentação falada continua aqui.
//
//   EVENTO (snapshot-alerts) → IMPORTÂNCIA → COOLDOWN → PRIORIDADE → FALA
//                                                                  ↘ TOAST
//
// NENHUM CRITÉRIO MUDOU: os limiares, as chaves anti-repetição e as
// sentenças faladas são as mesmas, palavra por palavra — a suíte existente
// deste módulo é a prova de que não houve regressão.
//
// Continua FUNÇÃO PURA, sem rede, DOM ou timer — por isso segue testável em
// node e incapaz de bloquear renderização, WebGPU ou WebSocket.

import type { TerminalSnapshot } from './voice-intents';
import type { VoicePriority } from './voice-engine';
import { deriveSnapshotAlerts } from '../nexus/snapshot-alerts';
import type { AlertEvent } from '../nexus/alert-center';

export interface VoiceAlert {
  text: string;
  priority: VoicePriority;
}

/**
 * Os alertas que uma TRANSIÇÃO REAL de estado justifica FALAR.
 *
 * Um evento sem `speech` existe, é real e vira toast — só não é falado.
 * Essa é a diferença entre os dois canais, e ela agora é uma decisão de
 * APRESENTAÇÃO sobre um evento único, nunca duas detecções concorrentes.
 */
export function computeAlerts(
  prev: TerminalSnapshot | null,
  next: TerminalSnapshot,
): VoiceAlert[] {
  return toVoiceAlerts(deriveSnapshotAlerts(prev, next));
}

/** Converte eventos em falas. Exportada porque o mesmo mapeamento serve a
 *  qualquer AlertEvent — inclusive os que chegam pelo bus (Track Record,
 *  Sweep), que não passam por `computeAlerts`. */
export function toVoiceAlerts(events: AlertEvent[]): VoiceAlert[] {
  const out: VoiceAlert[] = [];
  for (const e of events) {
    if (!e.speech) continue; // sem versão falada = evento só visual, por decisão
    out.push({ text: e.speech, priority: e.priority });
  }
  return out;
}
