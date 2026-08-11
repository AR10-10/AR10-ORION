// alert-center.ts — v16.0 DEFINITIVO §9 ("Alertas e Notificações — Sistema
// de Sobrevivência"): primeiro assinante real do evento
// ORGANISM.TRACK_RECORD.UPDATED (event-bus.ts) — declarado e emitido pelo
// OrganismOrchestrator desde a introdução do Track Record
// (signal-track-record.ts), mas sem nenhum consumidor até aquela entrega.
//
// Achado da AUDITORIA TÉCNICA COMPLETA (Seção F): deriveTrackRecordAlert
// era o ÚNICO produtor de AlertEvent no código inteiro — VWAP cross, POC
// touch, Liquidity Sweep e BOS/CHoCH são detectados e desenhados no
// gráfico, mas nunca alertavam. Auditados os 4 antes de tocar em qualquer
// coisa (CLAUDE.md, Disciplina item 1):
//   - Liquidity Sweep TEM publicador real (BRAIN.TRAPS.UPDATED, a mesma
//     fatia trapSignals que CouncilWidget/canvas já leem) — deriveSweepAlert
//     abaixo usa exatamente esse evento, zero segunda coleta.
//   - VWAP cross (vwapState/nlState, vwap-state.ts) e BOS/CHoCH (bosChoch,
//     computeBosChoch) NÃO têm fatia na unified-snapshot-store nem evento
//     no bus hoje — são computados só localmente em App.tsx/ChartWidget e
//     passados por WidgetContext/props. Dar-lhes um publicador real
//     (nova fatia na store + tradução no OrganismOrchestrator + migrar os
//     consumidores atuais a ler da store) é mudança arquitetural própria,
//     que toca store/orquestrador/múltiplos consumidores — fora do escopo
//     desta entrega, registrado aqui em vez de forçado às pressas.
//   - POC touch é de natureza diferente dos outros três: não é uma
//     transição de estado discreta, é a PROXIMIDADE entre dois valores
//     contínuos (preço vivo × POC do Volume Profile) — exigiria um motor
//     de detecção de cruzamento próprio, não só um publicador. Mesmo
//     raciocínio de "fora de escopo, registrado honestamente".
//
// Pure function, zero I/O, zero clock próprio — mesma disciplina do resto
// de nexus/.
//
// Achado da auditoria de evolução (voz contínua, pedido direto do
// Operador): voice/voice-dispatcher.ts já narra proativamente por voz —
// inclusive o ciclo de vida do Trade Plan (abertura/zona de entrada/alvo
// provado/resolução) — mas por um SEGUNDO diff independente sobre
// TerminalSnapshot, nunca lendo os AlertEvent daqui. Resultado real: o
// Sweep (deriveSweepAlert abaixo) é hoje só toast, nunca falado, embora a
// voz já exista e já narre eventos institucionais parecidos (liquidação,
// absorção). `speech` é o campo que fecha esse buraco — a versão em
// linguagem natural do MESMO evento, opcional (nem todo AlertEvent
// precisa de uma). deriveTrackRecordAlert deliberadamente NÃO ganha
// `speech` nesta entrega: já é falado pelo voice-dispatcher (duplicar
// aqui faria o Operador ouvir a MESMA resolução duas vezes) — registrado
// como duplicação real e conhecida, não escondida, não resolvida às
// pressas (consolidar exigiria reconciliar uma diferença real: o
// voice-dispatcher também narra REPLACED, que este arquivo
// deliberadamente NUNCA alerta — decisão própria, fora do escopo desta
// entrega).
import type { TrackedPlan, TrackRecordState } from "./signal-track-record";
import type { TrapSignal, SweptLevel } from "./trap-detection";

export type AlertTone = "success" | "info" | "danger";

export interface AlertEvent {
  id: string;
  tone: AlertTone;
  title: string;
  message: string;
  createdAt: number;
  // Sentença em português natural para TTS (voice-engine.ts) — nunca o
  // title/message (pontuados com "·" e MAIÚSCULAS pensados pro toast
  // visual, não pra fala). Ausente = este alerta não tem versão falada
  // (por decisão registrada no cabeçalho acima, não por omissão).
  speech?: string;
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

/** Identidade real e estável de um nível varrido — o candle/preço reais em
 *  que o pool EQH/EQL foi originalmente detectado (fvg-order-block-engine.js
 *  via trap-detection.ts), NUNCA `trap.at` (carimbado de novo em CADA
 *  chamada de detectInstitutionalTraps, mesmo para o MESMO sweep real ainda
 *  dentro da janela de corroboração — usar `at` como identidade alertaria
 *  de novo a cada recomputo, spam constante). Mesmo anchor que o canvas já
 *  usa para dedupe (EnhancedChart_110_Percent.tsx's sweepLinesRef effect,
 *  `seenSweepPrices`) — zero segunda regra de identidade inventada. */
export function sweepIdentity(level: SweptLevel): string {
  return `${level.index}:${level.price}`;
}

/** Compara os traps reais desta chamada contra `seenIds` (mutado in-place
 *  pelo chamador, mesmo espírito de watermark que `lastTrackRecordEntryRef`
 *  já usa para o Track Record — o estado "o que já foi visto" pertence a
 *  quem assina o bus, nunca a esta função pura).
 *
 *  Só STOP_HUNT_TOPO/STOP_HUNT_FUNDO: ABSORCAO_ANOMALA tem
 *  `sweptLevels: []` por design (trap-detection.ts — "não tem um
 *  preço-âncora único real"), então não tem identidade estável pra
 *  comparar — a mesma restrição que o canvas já aplica ao desenho do
 *  price line de sweep, reaproveitada aqui, nunca uma segunda regra.
 *
 *  Vários níveis novos na mesma chamada (raro, mas possível): todos
 *  marcados como vistos (nunca vaza um "ainda novo" pra próxima chamada),
 *  mas só o mais recente vira alerta — mesma filosofia de "uma transição
 *  real, um evento" do Track Record acima. */
export function deriveSweepAlert(seenIds: Set<string>, traps: TrapSignal[]): AlertEvent | null {
  let newest: { level: SweptLevel; kind: "STOP_HUNT_TOPO" | "STOP_HUNT_FUNDO"; confidence: number } | null = null;
  for (const trap of traps) {
    if (trap.kind !== "STOP_HUNT_TOPO" && trap.kind !== "STOP_HUNT_FUNDO") continue;
    for (const level of trap.sweptLevels) {
      const id = sweepIdentity(level);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      newest = { level, kind: trap.kind, confidence: trap.confidence };
    }
  }
  if (!newest) return null;

  const { level, kind, confidence } = newest;
  const bullishBias = kind === "STOP_HUNT_FUNDO"; // fundo varrido = liquidez vendedora tomada, viés de reversão pra cima
  return {
    id: `sweep-${sweepIdentity(level)}`,
    tone: "info",
    title: kind === "STOP_HUNT_TOPO" ? "SWEEP · TOPO VARRIDO" : "SWEEP · FUNDO VARRIDO",
    message: `${formatPrice(level.price)} · confiança real ${(confidence * 100).toFixed(0)}% · viés ${bullishBias ? "alta" : "baixa"}`,
    createdAt: Date.now(),
    // Sentença qualitativa (sem número lido em voz alta), mesmo estilo dos
    // eventos institucionais já falados por voice-dispatcher.ts
    // ("Liquidez institucional detectada...", "Absorção institucional
    // detectada..."): confiança/preço exatos continuam só no toast, que é
    // pra ler, não pra ouvir.
    speech: kind === "STOP_HUNT_TOPO"
      ? "Varredura de liquidez no topo. Viés de reversão para baixa."
      : "Varredura de liquidez no fundo. Viés de reversão para alta.",
  };
}
