// l2-history.ts — V-MAX Fase 1.1: buffer real de histórico de L2, o
// pré-requisito que faltava para o OrderFlowHeatmapPlugin (Blueprint
// §3.1) desenhar uma densidade ao longo do TEMPO — até aqui, a store
// (Fase 0.4) só guardava o snapshot L2 MAIS RECENTE por exchange
// (`orderBooks`), suficiente para o livro de ofertas ao vivo, mas
// insuficiente para um heatmap real (que precisa de uma série real, não
// um único ponto).
//
// Nenhuma rede nova: este módulo só decide QUANDO um snapshot L2 que já
// chega de verdade (mesmo throttle real de 200ms já em produção — ver
// App.tsx) deve ser retido no histórico, e mantém o ring dentro de um
// teto real. Zero mocks: uma amostra nunca é fabricada entre duas
// atualizações reais — se o L2 real não mudou, o ring simplesmente não
// ganha uma entrada nova até a próxima atualização real chegar.
//
// Cadência de amostragem deliberadamente mais grossa que o throttle de
// exibição (200ms): gravar cada atualização throttled encheria o ring em
// segundos, uma janela curta demais para um heatmap útil. 2s de
// amostragem × 180 entradas = 6 minutos reais de histórico — a mesma
// ordem de grandeza que ferramentas de heatmap L2 institucionais
// costumam mostrar por padrão.
import type { L2Level } from "./types";

export interface L2HistoryEntry {
  time: number; // Date.now() real, ms — não segundos (não precisa se alinhar ao eixo de candles).
  bids: L2Level[];
  asks: L2Level[];
}

export const L2_HISTORY_CAPACITY = 180;
export const L2_HISTORY_SAMPLE_INTERVAL_MS = 2_000;

/** Função pura: decide se `entry` deve ser retida no ring, e devolve o
 *  ring resultante — a MESMA referência quando nada muda (evita
 *  re-render de consumidores React que nunca perceberiam diferença).
 *  Nunca fabrica uma entrada: `entry` sempre precisa vir de um L2 real
 *  já recebido pelo chamador. */
export function maybeSampleL2History(
  ring: L2HistoryEntry[],
  entry: L2HistoryEntry,
  intervalMs: number = L2_HISTORY_SAMPLE_INTERVAL_MS,
  capacity: number = L2_HISTORY_CAPACITY,
): L2HistoryEntry[] {
  const last = ring[ring.length - 1];
  if (last && entry.time - last.time < intervalMs) return ring;
  const next = ring.length === 0 ? [entry] : [...ring, entry];
  return next.length > capacity ? next.slice(next.length - capacity) : next;
}
