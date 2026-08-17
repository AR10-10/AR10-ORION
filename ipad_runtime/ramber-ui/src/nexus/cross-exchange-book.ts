// cross-exchange-book.ts — Ponta Solta 1 (Auditoria do Ecossistema, 2ª
// passada). Ordem do Operador: "habilitar tudo que tem de ser habilitado,
// principalmente das corretoras, das fontes de dados todas, pra ficar 100%
// sincronizado, nada pendente".
//
// ACHADO QUE ORIGINOU ESTE MÓDULO: a fatia `orderBooks` da store era
// WRITE-ONLY. Três escritores reais — `App.tsx:3395`,
// `cross-exchange-service.ts:199` (BINANCE) e `:246` (MEXC) — gravavam o livro
// L2 de cada corretora a cada tick, e o único leitor exposto
// (`useExchangeOrderBooks`) nunca era importado em lugar nenhum. O livro de 3
// corretaras era capturado e descartado.
//
// Isso NÃO era lixo: era uma feature construída até a metade. A captura é a
// parte cara (rede, parsing, memória); faltava só a leitura. O que este motor
// faz é fechar essa metade — comparar os livros REAIS que já estão na store.
//
// O que ele mede, e por quê:
//   - MELHOR BID / MELHOR ASK entre corretoras. Um trader que opera numa
//     corretora precisa saber se OUTRA está com preço melhor: é a diferença
//     entre executar no topo do livro e executar atrás dele.
//   - SPREAD CONSOLIDADO (melhor ask − melhor bid, cruzando corretoras). Se
//     ficar NEGATIVO, existe desalinhamento real entre praças — o sinal mais
//     forte que este dado pode dar, e impossível de ver olhando uma só.
//   - DESVIO do meio-preço de cada corretora contra a mediana das praças.
//     Mediana e não média: uma corretora com feed travado não pode arrastar a
//     referência (mesmo cuidado da mediana usada no Achado 3.3).
//
// LEI 24: display only. Isto é contexto de execução para o Operador humano —
// nunca vira decisão de trading, nunca toca o Core Engine.
//
// Regra de Ouro 3 (fail-closed): corretora sem livro real, sem bid, sem ask,
// ou com preço/tamanho não finito é EXCLUÍDA da leitura, nunca preenchida com
// zero. Menos de 2 corretoras válidas => DADOS_INSUFICIENTES honesto, porque
// "consenso" com uma praça só não existe.
import type { Exchange, L2Snapshot } from "./types";

/** Leitura de UMA corretora, já validada. */
export interface CrossExchangeBookQuote {
  exchange: Exchange;
  bestBid: number;
  bestAsk: number;
  /** (bestBid + bestAsk) / 2 — o preço justo daquela praça neste instante. */
  mid: number;
  /** bestAsk − bestBid da própria corretora. Nunca negativo num livro sadio. */
  spread: number;
  /** Idade real do snapshot em ms no instante da leitura. */
  ageMs: number;
}

export type CrossExchangeBookStatus = "OK" | "DADOS_INSUFICIENTES";

export interface CrossExchangeBookReading {
  status: CrossExchangeBookStatus;
  /** Preenchido só quando status === "DADOS_INSUFICIENTES". */
  reason: string | null;
  /** Corretoras válidas, ordenadas por melhor bid (maior primeiro). */
  quotes: CrossExchangeBookQuote[];
  /** Maior bid entre TODAS as praças, e onde ele está. */
  bestBid: { exchange: Exchange; price: number } | null;
  /** Menor ask entre TODAS as praças, e onde ele está. */
  bestAsk: { exchange: Exchange; price: number } | null;
  /** bestAsk.price − bestBid.price. NEGATIVO = praças desalinhadas. */
  consolidatedSpread: number | null;
  /** Mediana dos mid de todas as praças válidas. */
  medianMid: number | null;
  /** Maior desvio absoluto (%) de um mid contra a mediana, e de quem. */
  maxDeviation: { exchange: Exchange; percent: number } | null;
  computedAt: number;
}

/** Idade máxima aceita para um snapshot de livro entrar na comparação.
 *  Acima disto a praça é excluída: comparar um livro de 30s atrás com um de
 *  agora produziria um "desalinhamento" que é só atraso, não mercado. */
export const CROSS_EXCHANGE_MAX_BOOK_AGE_MS = 15_000;

/** Mínimo de praças para a palavra "consenso" significar alguma coisa. */
export const CROSS_EXCHANGE_MIN_VENUES = 2;

function insufficient(reason: string, computedAt: number): CrossExchangeBookReading {
  return {
    status: "DADOS_INSUFICIENTES",
    reason,
    quotes: [],
    bestBid: null,
    bestAsk: null,
    consolidatedSpread: null,
    medianMid: null,
    maxDeviation: null,
    computedAt,
  };
}

/** Melhor nível real de um lado do livro. `side` decide o critério: bid quer o
 *  MAIOR preço, ask quer o MENOR. Ignora nível com preço/tamanho não finito ou
 *  tamanho <= 0 — nível fantasma não é topo de livro. */
function bestLevel(levels: { price: number; size: number }[], side: "bid" | "ask"): number | null {
  let best: number | null = null;
  for (const l of levels) {
    if (!Number.isFinite(l.price) || !Number.isFinite(l.size) || l.size <= 0 || l.price <= 0) continue;
    if (best === null) best = l.price;
    else if (side === "bid" ? l.price > best : l.price < best) best = l.price;
  }
  return best;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Compara os livros L2 reais já capturados por corretora. Puro: mesma entrada,
 * mesma saída, zero rede, zero estado.
 *
 * `nowMs` é parâmetro (não `Date.now()` interno) para que a idade do snapshot
 * seja determinística em teste — mesma disciplina dos outros motores daqui.
 */
export function computeCrossExchangeBook(
  books: Partial<Record<Exchange, L2Snapshot | null>>,
  nowMs: number,
  maxAgeMs: number = CROSS_EXCHANGE_MAX_BOOK_AGE_MS,
): CrossExchangeBookReading {
  const quotes: CrossExchangeBookQuote[] = [];

  for (const [key, snapshot] of Object.entries(books)) {
    const exchange = key as Exchange;
    if (!snapshot) continue; // praça nunca conectada nesta sessão
    if (!Number.isFinite(snapshot.updatedAt)) continue;
    const ageMs = nowMs - snapshot.updatedAt;
    if (ageMs < 0 || ageMs > maxAgeMs) continue; // atrasado demais (ou relógio à frente) — excluído, nunca "corrigido"
    const bestBid = bestLevel(snapshot.bids ?? [], "bid");
    const bestAsk = bestLevel(snapshot.asks ?? [], "ask");
    if (bestBid === null || bestAsk === null) continue; // um lado vazio não é cotação
    quotes.push({
      exchange,
      bestBid,
      bestAsk,
      mid: (bestBid + bestAsk) / 2,
      spread: bestAsk - bestBid,
      ageMs,
    });
  }

  if (quotes.length < CROSS_EXCHANGE_MIN_VENUES) {
    return insufficient(
      `apenas ${quotes.length} corretora(s) com livro real e recente (<${Math.round(maxAgeMs / 1000)}s) — consenso exige ${CROSS_EXCHANGE_MIN_VENUES}`,
      nowMs,
    );
  }

  quotes.sort((a, b) => b.bestBid - a.bestBid);

  const topBid = quotes.reduce((best, q) => (q.bestBid > best.bestBid ? q : best), quotes[0]);
  const topAsk = quotes.reduce((best, q) => (q.bestAsk < best.bestAsk ? q : best), quotes[0]);
  const medianMid = median(quotes.map((q) => q.mid));

  let maxDeviation: { exchange: Exchange; percent: number } | null = null;
  if (medianMid > 0) {
    for (const q of quotes) {
      const percent = ((q.mid - medianMid) / medianMid) * 100;
      if (maxDeviation === null || Math.abs(percent) > Math.abs(maxDeviation.percent)) {
        maxDeviation = { exchange: q.exchange, percent };
      }
    }
  }

  return {
    status: "OK",
    reason: null,
    quotes,
    bestBid: { exchange: topBid.exchange, price: topBid.bestBid },
    bestAsk: { exchange: topAsk.exchange, price: topAsk.bestAsk },
    consolidatedSpread: topAsk.bestAsk - topBid.bestBid,
    medianMid,
    maxDeviation,
    computedAt: nowMs,
  };
}

/** Frase curta e honesta para a UI. Nunca inventa número: quando o dado não
 *  existe, diz que não existe. */
export function describeCrossExchangeBook(reading: CrossExchangeBookReading): string {
  if (reading.status !== "OK" || reading.bestBid === null || reading.bestAsk === null) {
    return reading.reason ?? "sem livro real suficiente";
  }
  const spread = reading.consolidatedSpread ?? 0;
  if (spread < 0) {
    return `praças desalinhadas · ${reading.bestBid.exchange} paga acima do ask de ${reading.bestAsk.exchange}`;
  }
  const dev = reading.maxDeviation;
  const devTxt = dev !== null ? ` · maior desvio ${dev.percent >= 0 ? "+" : ""}${dev.percent.toFixed(3)}% (${dev.exchange})` : "";
  return `${reading.quotes.length} praças · melhor bid ${reading.bestBid.exchange} · melhor ask ${reading.bestAsk.exchange}${devTxt}`;
}
