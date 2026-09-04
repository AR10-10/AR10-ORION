// alert-presentation.ts — SENSIBILIDADE VISUAL do alerta: como a urgência
// que o evento já carrega vira diferença que o olho pega.
//
// POR QUE ESTE ARQUIVO EXISTE (achado medido): a unificação dos alertas deu
// a todo `AlertEvent` um campo `priority` (CRITICAL/ALERT/INFO) — mas o
// toast estilizava SÓ por `tone`. Resultado real na tela: um
// "VETOR CONFIRMADO" (CRITICAL) e um "PLANO SUBSTITUÍDO" (INFO) são ambos
// `tone: "info"` e ficavam **visualmente idênticos**. A informação de
// urgência existia no dado e não existia na tela.
//
// OS DOIS EIXOS, e por que eles não podem ser o mesmo:
//
//   tone     = O QUE ACONTECEU   → verde/ciano/vermelho (bom/neutro/ruim)
//   priority = QUANTO IMPORTA    → peso, ordem, presença
//
// Colapsar os dois num só (pintar CRITICAL de vermelho) seria mentir sobre
// o primeiro eixo: "vetor de alta confirmado" é CRITICAL e é uma boa
// notícia. Por isso a urgência é codificada em FORMA — espessura do trilho,
// anel, opacidade, posição na pilha — nunca roubando a cor que já significa
// outra coisa.
//
// ORDEM DA PILHA: o mais urgente fica em cima. Num terminal a posição é
// informação, não estética — quando 3 toasts sobem juntos, o olho vai no
// primeiro, e o primeiro tem de ser o que mais importa.
//
// Puro e testável: zero React, zero DOM. A UI só lê estes tokens.
import type { AlertEvent, AlertPriority } from "./alert-center";

/** Peso de urgência. Maior = mais urgente = mais acima na pilha. */
export const ALERT_PRIORITY_WEIGHT: Record<AlertPriority, number> = {
  CRITICAL: 3,
  ALERT: 2,
  INFO: 1,
};

export interface AlertEmphasis {
  /** Espessura do trilho lateral, em px. É o sinal mais forte e o mais
   *  barato de ler de canto de olho. */
  railPx: number;
  /** Opacidade do corpo do toast. INFO recua sem sumir — continua legível,
   *  só para de competir com o que é urgente. */
  opacity: number;
  /** Anel externo só no CRITICAL: a única coisa na pilha que ganha
   *  presença além do trilho. Se tudo tivesse anel, o anel não diria nada. */
  ring: boolean;
  /** Marcador textual antes do título — redundância deliberada com a
   *  forma, para quem lê a tela em condição ruim (sol no iPad) ou não
   *  distingue bem espessura. */
  marker: string;
}

const EMPHASIS: Record<AlertPriority, AlertEmphasis> = {
  CRITICAL: { railPx: 4, opacity: 1, ring: true, marker: "!!" },
  ALERT: { railPx: 2, opacity: 1, ring: false, marker: "!" },
  INFO: { railPx: 1, opacity: 0.8, ring: false, marker: "" },
};

/** Tokens visuais da urgência. Nunca devolve cor — cor é do `tone`. */
export function alertEmphasis(priority: AlertPriority): AlertEmphasis {
  return EMPHASIS[priority] ?? EMPHASIS.INFO;
}

/**
 * Mais urgente primeiro. Entre iguais, o MAIS RECENTE primeiro — dois
 * CRITICAL na mesma leva significam que o segundo é a notícia mais nova.
 *
 * Estável e não-destrutiva: devolve um array novo, nunca reordena o estado
 * de quem chamou (a lista original continua sendo a ordem de chegada, que
 * é o que o auto-dismiss usa).
 */
export function sortAlertsByUrgency(alerts: AlertEvent[]): AlertEvent[] {
  return [...alerts].sort((a, b) => {
    const w = ALERT_PRIORITY_WEIGHT[b.priority] - ALERT_PRIORITY_WEIGHT[a.priority];
    if (w !== 0) return w;
    return b.createdAt - a.createdAt;
  });
}
