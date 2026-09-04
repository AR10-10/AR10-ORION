// order-book-depth.ts — Entrega 40 (Order Book Depth Overlay, gap real
// nomeado desde a Entrega 35 §4): derivações puras sobre o livro de
// ofertas REAL já ao vivo (App.tsx, WebSocket depth10@100ms → orderBook
// state → store.setOrderBook, mesmo dado que OrderBookWidget já
// desenha). Zero fetch novo, zero segunda leitura — este arquivo só
// deriva SIM/NÃO e números reais de agregação sobre os mesmos
// OrderBookLevel[] que já chegam prontos.
//
// Nota honesta de escopo (auditoria antes de construir): o stream real
// (`${symbol}usdt@depth10@100ms`) mantém só 8 níveis por lado após o
// slice de exibição em App.tsx — não os "top 20" de uma especificação
// externa. "Nível próximo" para detecção de wall aqui é a MÉDIA dos
// níveis reais do mesmo lado (bids entre si, asks entre si), nunca uma
// janela de 10 fixa que este book não tem profundidade para preencher.
import type { OrderBookLevel } from "../store/unified-snapshot-store";

export const WALL_VOLUME_MULTIPLIER = 2;

/** Um nível é "wall" quando seu tamanho é > multiplier × a média dos
 *  DEMAIS níveis do mesmo lado. Fail-closed: array vazio ou com 1 único
 *  nível (sem "demais" para comparar) devolve tudo `false`, nunca uma
 *  wall fabricada por falta de contexto real. */
export function detectWalls(levels: OrderBookLevel[], multiplier: number = WALL_VOLUME_MULTIPLIER): boolean[] {
  const n = levels.length;
  if (n < 2) return levels.map(() => false);
  const total = levels.reduce((sum, l) => sum + l.size, 0);
  return levels.map((l) => {
    const othersAvg = (total - l.size) / (n - 1);
    return othersAvg > 0 && l.size > multiplier * othersAvg;
  });
}

/** Volume total de bids / volume total de asks. null quando qualquer um
 *  dos dois lados está vazio ou sem volume real (nunca Infinity/NaN
 *  disfarçado de leitura). */
export function computeBidAskRatio(bids: OrderBookLevel[], asks: OrderBookLevel[]): number | null {
  const bidVol = bids.reduce((sum, l) => sum + l.size, 0);
  const askVol = asks.reduce((sum, l) => sum + l.size, 0);
  if (bidVol <= 0 || askVol <= 0) return null;
  return bidVol / askVol;
}

/** (bidVol - askVol) / (bidVol + askVol), em -1..1. null quando os dois
 *  lados estão vazios (nada para comparar) — nunca 0 fabricado como se
 *  fosse um "equilíbrio" real medido. */
export function computeImbalance(bids: OrderBookLevel[], asks: OrderBookLevel[]): number | null {
  const bidVol = bids.reduce((sum, l) => sum + l.size, 0);
  const askVol = asks.reduce((sum, l) => sum + l.size, 0);
  const total = bidVol + askVol;
  if (total <= 0) return null;
  return (bidVol - askVol) / total;
}
