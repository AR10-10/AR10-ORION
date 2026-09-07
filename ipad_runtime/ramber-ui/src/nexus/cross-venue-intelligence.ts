// cross-venue-intelligence.ts — Ordem A2.2 (Cross-Venue Intelligence).
// Ajuste obrigatório de escopo do próprio Operador, depois da auditoria
// inicial (Regra Zero da Ordem): "CROSS-VENUE CORE: BINANCE × MEXC" +
// "BYBIT/OKX: PRICE CROSS-CHECK". Princípio central da Ordem:
//
//   COMPARAR VENUES. NÃO FUNDIR VENUES.
//
// Este módulo NUNCA calcula um "livro global" nem uma média entre
// corretoras — cada praça continua individualmente identificável em toda
// leitura que ele produz.
//
// AUDITORIA (Regra Zero, feita antes de escrever qualquer linha aqui):
//   - cross-exchange-book.ts JÁ compara Binance×MEXC ao vivo (melhor bid/
//     ask, spread consolidado, mediana, desvio) — reaproveitado aqui
//     inteiro, nunca reimplementado.
//   - orderBooks.MEXC nunca era escrito em produção (só pelo start()
//     completo de CrossExchangeService, nunca chamado) — fechado por
//     CrossExchangeService.startMexcDepthOnly() (ver seu próprio
//     cabeçalho), sem duplicar o WS Binance nem o ticker MEXC.
//   - Bybit/OKX: só markPrice real via REST (bybit-futures.ts/
//     okx-futures.ts), já comparado contra a Binance via
//     compareCrossExchange()/CrossExchangeCheck — reaproveitado aqui como
//     "price cross-check only", nunca promovido a microestrutura.
//
// REGRA DE HONESTIDADE (Ordem A2.2): VENUE_CAPABILITY abaixo é uma
// constante ESTRUTURAL, não uma medição em runtime — reflete o que os
// conectores reais deste código entregam hoje, e só muda quando um
// conector novo for construído de verdade (ordem própria, nunca
// automático a partir desta Ordem).
//
// GAP DECLARADO (Ordem A2.2, "Critério de Parada" — nunca fabricar dado
// que não existe): Bybit e OKX NÃO têm order book nem trade stream reais
// neste código — CROSS_VENUE_KNOWN_GAPS abaixo registra isso
// explicitamente, nunca escondido.
import type { Exchange, L2Snapshot, L2Level } from "./types";
import {
  computeCrossExchangeBook,
  describeCrossExchangeBook,
  bestLevel,
  CROSS_EXCHANGE_MAX_BOOK_AGE_MS,
  type CrossExchangeBookReading,
} from "./cross-exchange-book";
import type { L2HistoryEntry } from "./l2-history";
import type { CrossExchangeCheck } from "../cross-exchange/shared";

export type VenueCapability = "FULL_MICROSTRUCTURE" | "PRICE_ONLY";

/** As 4 venues reais deste código (nexus/types.ts, Exchange) e o que cada
 *  uma de fato entrega hoje — nunca o Blueprint aspiracional. */
export const VENUE_CAPABILITY: Record<Exchange, VenueCapability> = {
  BINANCE: "FULL_MICROSTRUCTURE",
  MEXC: "FULL_MICROSTRUCTURE",
  BYBIT: "PRICE_ONLY",
  OKX: "PRICE_ONLY",
};

/** Venues que participam do CORE (order book/depth/liquidez/lead-lag) —
 *  nunca uma lista computada, sempre as 2 únicas com VENUE_CAPABILITY
 *  FULL_MICROSTRUCTURE. Se um conector novo mudar isso um dia, muda aqui
 *  também — nunca silenciosamente por conta de outro código escrever em
 *  orderBooks.BYBIT/OKX por engano. */
const CORE_VENUES: readonly Exchange[] = ["BINANCE", "MEXC"];

export type DataAvailability = "AVAILABLE" | "NOT_AVAILABLE";

export interface VenueDataQuality {
  exchange: Exchange;
  capability: VenueCapability;
  price: DataAvailability;
  orderBook: DataAvailability;
  trades: DataAvailability;
}

/** `priceAvailable` é o único campo medido em runtime (a praça respondeu
 *  agora); orderBook/trades vêm 100% de VENUE_CAPABILITY — nunca
 *  "disponível" só porque uma leitura antiga ficou em cache. */
export function describeVenueDataQuality(exchange: Exchange, priceAvailable: boolean): VenueDataQuality {
  const capability = VENUE_CAPABILITY[exchange];
  const full = capability === "FULL_MICROSTRUCTURE";
  return {
    exchange,
    capability,
    price: priceAvailable ? "AVAILABLE" : "NOT_AVAILABLE",
    orderBook: full ? "AVAILABLE" : "NOT_AVAILABLE",
    trades: full ? "AVAILABLE" : "NOT_AVAILABLE",
  };
}

export type LiquidityStatus = "OK" | "DADOS_INSUFICIENTES";

export interface VenueLiquidity {
  exchange: Exchange;
  /** Soma real de `size` dos níveis válidos (preço/tamanho finitos e > 0)
   *  do lado de bid/ask — nunca a contagem de níveis, a profundidade real. */
  bidLiquidity: number;
  askLiquidity: number;
}

export interface LiquidityReading {
  status: LiquidityStatus;
  reason: string | null;
  byVenue: VenueLiquidity[];
  /** Praça com maior liquidez total (bid+ask) entre as válidas — só
   *  preenchido com status OK. */
  deeperVenue: Exchange | null;
}

const MIN_VENUES_FOR_COMPARISON = 2;

function sumValidSize(levels: L2Level[]): number {
  let sum = 0;
  for (const l of levels) {
    if (Number.isFinite(l.price) && Number.isFinite(l.size) && l.price > 0 && l.size > 0) sum += l.size;
  }
  return sum;
}

/** Compara a PROFUNDIDADE real (soma de tamanho válido, não só topo de
 *  livro) entre as venues do CORE. Mesma disciplina de idade/fail-closed
 *  de computeCrossExchangeBook — nunca reimplementada, só aplicada de
 *  novo aqui porque o cálculo em si (soma de liquidez) é outro. */
export function computeLiquidityComparison(
  books: Partial<Record<Exchange, L2Snapshot | null>>,
  nowMs: number,
  maxAgeMs: number = CROSS_EXCHANGE_MAX_BOOK_AGE_MS,
): LiquidityReading {
  const byVenue: VenueLiquidity[] = [];
  for (const exchange of CORE_VENUES) {
    const snap = books[exchange];
    if (!snap || !Number.isFinite(snap.updatedAt)) continue;
    const ageMs = nowMs - snap.updatedAt;
    if (ageMs < 0 || ageMs > maxAgeMs) continue;
    const bidLiquidity = sumValidSize(snap.bids ?? []);
    const askLiquidity = sumValidSize(snap.asks ?? []);
    if (bidLiquidity === 0 && askLiquidity === 0) continue; // livro presente mas vazio — não é profundidade real
    byVenue.push({ exchange, bidLiquidity, askLiquidity });
  }

  if (byVenue.length < MIN_VENUES_FOR_COMPARISON) {
    return {
      status: "DADOS_INSUFICIENTES",
      reason: `apenas ${byVenue.length} praça(s) com livro real e recente — comparação de liquidez exige ${MIN_VENUES_FOR_COMPARISON}`,
      byVenue,
      deeperVenue: null,
    };
  }

  let deeperVenue: Exchange | null = null;
  let maxTotal = -Infinity;
  for (const v of byVenue) {
    const total = v.bidLiquidity + v.askLiquidity;
    if (total > maxTotal) {
      maxTotal = total;
      deeperVenue = v.exchange;
    }
  }
  return { status: "OK", reason: null, byVenue, deeperVenue };
}

export type LeadLagStatus = "OK" | "INSUFFICIENT_EVIDENCE";

export interface LeadLagReading {
  status: LeadLagStatus;
  reason: string | null;
  /** Praça cujo mid se moveu primeiro — só preenchido com status OK. */
  leadingExchange: Exchange | null;
  /** Atraso real observado (ms) até a outra praça acompanhar o mesmo
   *  movimento — só preenchido com status OK. */
  lagMs: number | null;
}

/** Mínimo real de amostras retidas por praça pra sequer TENTAR detectar
 *  algo — abaixo disso qualquer "líder" seria ruído lido como sinal.
 *  Documentado sem suavizar: como a MEXC hoje só atualiza a cada
 *  restPollMs (60s, REST) contra o WebSocket sub-segundo da Binance
 *  (ver cross-exchange-service.ts), este piso normalmente só é alcançado
 *  depois de vários minutos reais de sessão — lead/lag vai reportar
 *  INSUFFICIENT_EVIDENCE na maior parte do tempo, por desenho, não por
 *  bug. Isso É a Ordem A2.2 cumprida ("lead/lag somente onde houver
 *  evidência"), não uma falha dela. */
export const LEAD_LAG_MIN_SAMPLES = 5;

/** Variação mínima do mid (%) pra contar como "um movimento real" —
 *  abaixo disso é jitter de centavo/arredondamento, não um movimento que
 *  uma praça pudesse genuinamente "liderar". */
export const LEAD_LAG_MOVE_THRESHOLD_PCT = 0.05;

function midOf(entry: L2HistoryEntry): number | null {
  const bid = bestLevel(entry.bids, "bid");
  const ask = bestLevel(entry.asks, "ask");
  if (bid === null || ask === null) return null;
  return (bid + ask) / 2;
}

/** Primeiro instante em que o mid se afasta do mid da primeira amostra
 *  real por >= LEAD_LAG_MOVE_THRESHOLD_PCT. Null quando a série é curta
 *  demais ou nenhum movimento real aconteceu na janela retida — nunca
 *  "o último ponto", que fabricaria um movimento que não existiu. */
function firstRealMove(entries: L2HistoryEntry[]): { time: number } | null {
  if (entries.length === 0) return null;
  const base = midOf(entries[0]);
  if (base === null || base === 0) return null;
  for (let i = 1; i < entries.length; i++) {
    const mid = midOf(entries[i]);
    if (mid === null) continue;
    const pct = Math.abs(((mid - base) / base) * 100);
    if (pct >= LEAD_LAG_MOVE_THRESHOLD_PCT) return { time: entries[i].time };
  }
  return null;
}

/** Heurística simples e honesta, deliberadamente NÃO um modelo estatístico
 *  de correlação cruzada: "qual praça teve o primeiro movimento real
 *  (>= threshold) na janela retida, e com que atraso a outra seguiu".
 *  Suficiente pra responder "alguém liderou aqui?" sem prometer rigor que
 *  este código não tem evidência pra sustentar (Regra de Ouro 2: nunca
 *  inventar uma variante estatística própria sem necessidade real). */
export function computeLeadLag(
  binanceHistory: L2HistoryEntry[],
  mexcHistory: L2HistoryEntry[],
): LeadLagReading {
  if (binanceHistory.length < LEAD_LAG_MIN_SAMPLES || mexcHistory.length < LEAD_LAG_MIN_SAMPLES) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      reason: `histórico real curto demais (BINANCE: ${binanceHistory.length}, MEXC: ${mexcHistory.length} amostras — mínimo ${LEAD_LAG_MIN_SAMPLES} cada)`,
      leadingExchange: null,
      lagMs: null,
    };
  }
  const moveBinance = firstRealMove(binanceHistory);
  const moveMexc = firstRealMove(mexcHistory);
  if (!moveBinance || !moveMexc) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      reason: `nenhum movimento real (>= ${LEAD_LAG_MOVE_THRESHOLD_PCT}%) observado em uma das praças na janela retida`,
      leadingExchange: null,
      lagMs: null,
    };
  }
  if (moveBinance.time === moveMexc.time) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      reason: "movimentos simultâneos dentro da resolução de amostragem — sem líder real observável",
      leadingExchange: null,
      lagMs: null,
    };
  }
  return moveBinance.time < moveMexc.time
    ? { status: "OK", reason: null, leadingExchange: "BINANCE", lagMs: moveMexc.time - moveBinance.time }
    : { status: "OK", reason: null, leadingExchange: "MEXC", lagMs: moveBinance.time - moveMexc.time };
}

export interface CrossVenueCoreReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  book: CrossExchangeBookReading;
  liquidity: LiquidityReading;
  leadLag: LeadLagReading;
}

export interface CrossVenueIntelligenceSnapshot {
  computedAt: number;
  /** BINANCE × MEXC — a única comparação real de microestrutura. */
  core: CrossVenueCoreReading;
  /** BYBIT/OKX — PRICE CROSS-CHECK ONLY, nunca microestrutura (Regra de
   *  Honestidade da Ordem A2.2). */
  priceOnly: Partial<Record<Exchange, CrossExchangeCheck>>;
  dataQuality: Record<Exchange, VenueDataQuality>;
}

export interface CrossVenueIntelligenceInputs {
  /** Livros L2 reais por exchange (a mesma store — orderBooks). Só
   *  BINANCE/MEXC entram no core mesmo que outra chave venha preenchida —
   *  ver CORE_VENUES acima. */
  books: Partial<Record<Exchange, L2Snapshot | null>>;
  binanceHistory: L2HistoryEntry[];
  mexcHistory: L2HistoryEntry[];
  bybitCheck: CrossExchangeCheck;
  okxCheck: CrossExchangeCheck;
  /** Cross-check de preço real da MEXC (markPrice Futures, mexc-futures.ts)
   *  — usado só pra classificar price:AVAILABLE, nunca pro core L2. */
  mexcPriceCheck: CrossExchangeCheck;
  nowMs: number;
}

/** Compositor real da Ordem A2.2. Zero motor novo: cada peça (book,
 *  liquidez, lead/lag, price-only) já é uma função pura própria acima ou
 *  já existente — este função só ORGANIZA as leituras sob um contrato
 *  único, LEI 24 (display only) preservada por construção: nenhum campo
 *  aqui é LONG/SHORT/WAIT, nenhum toca engine.direction. */
export function composeCrossVenueIntelligence(inputs: CrossVenueIntelligenceInputs): CrossVenueIntelligenceSnapshot {
  const coreBooks: Partial<Record<Exchange, L2Snapshot | null>> = {
    BINANCE: inputs.books.BINANCE ?? null,
    MEXC: inputs.books.MEXC ?? null,
  };
  const book = computeCrossExchangeBook(coreBooks, inputs.nowMs);
  const liquidity = computeLiquidityComparison(coreBooks, inputs.nowMs);
  const leadLag = computeLeadLag(inputs.binanceHistory, inputs.mexcHistory);

  return {
    computedAt: inputs.nowMs,
    core: { status: book.status, book, liquidity, leadLag },
    priceOnly: { BYBIT: inputs.bybitCheck, OKX: inputs.okxCheck },
    dataQuality: {
      BINANCE: describeVenueDataQuality("BINANCE", book.quotes.some((q) => q.exchange === "BINANCE")),
      MEXC: describeVenueDataQuality("MEXC", inputs.mexcPriceCheck.ok || book.quotes.some((q) => q.exchange === "MEXC")),
      BYBIT: describeVenueDataQuality("BYBIT", inputs.bybitCheck.ok),
      OKX: describeVenueDataQuality("OKX", inputs.okxCheck.ok),
    },
  };
}

/** Frase curta e honesta pra UI — mesmo princípio de
 *  describeCrossExchangeBook: nunca inventa número, nunca promete mais
 *  do que o status real permite. */
export function describeCrossVenueIntelligence(snap: CrossVenueIntelligenceSnapshot): string {
  if (snap.core.status !== "OK") {
    return `CROSS-VENUE CORE (Binance×MEXC): ${snap.core.book.reason ?? "dados insuficientes"}`;
  }
  const parts = [describeCrossExchangeBook(snap.core.book)];
  if (snap.core.liquidity.status === "OK" && snap.core.liquidity.deeperVenue) {
    parts.push(`mais líquida: ${snap.core.liquidity.deeperVenue}`);
  }
  if (snap.core.leadLag.status === "OK" && snap.core.leadLag.leadingExchange && snap.core.leadLag.lagMs !== null) {
    parts.push(`${snap.core.leadLag.leadingExchange} liderou por ~${Math.round(snap.core.leadLag.lagMs / 1000)}s`);
  }
  return `CROSS-VENUE CORE (Binance×MEXC) · ${parts.join(" · ")}`;
}

/** Registro explícito da fronteira real de dados (Ordem A2.2, "Gaps
 *  Declarados") — nunca escondido, nunca tratado como falha desta
 *  entrega. Consumível por self-diagnostics.ts ou qualquer relatório
 *  futuro sem precisar reler este arquivo inteiro. */
export const CROSS_VENUE_KNOWN_GAPS = [
  {
    scope: "BYBIT/OKX FULL MICROSTRUCTURE",
    status: "NOT_IMPLEMENTED" as const,
    reason: "ORDER BOOK + TRADE DATA CONNECTORS NOT PRESENT IN CURRENT INFRASTRUCTURE",
  },
] as const;
