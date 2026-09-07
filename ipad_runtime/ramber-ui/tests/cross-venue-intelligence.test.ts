// cross-venue-intelligence.test.ts — Ordem A2.2 (Cross-Venue Intelligence,
// Binance×MEXC). Execução real de cada peça pura + testes de isolamento
// explícitos (o princípio central da Ordem: "COMPARAR VENUES, NÃO FUNDIR
// VENUES") — Bybit/OKX nunca entram no core mesmo com dado presente,
// Binance/MEXC continuam individualmente inspecionáveis em toda leitura.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  VENUE_CAPABILITY,
  describeVenueDataQuality,
  computeLiquidityComparison,
  computeLeadLag,
  composeCrossVenueIntelligence,
  describeCrossVenueIntelligence,
  CROSS_VENUE_KNOWN_GAPS,
  LEAD_LAG_MIN_SAMPLES,
  LEAD_LAG_MOVE_THRESHOLD_PCT,
} from "../src/nexus/cross-venue-intelligence";
import type { L2Snapshot } from "../src/nexus/types";
import type { L2HistoryEntry } from "../src/nexus/l2-history";
import type { CrossExchangeCheck } from "../src/cross-exchange/shared";

const NOW = 1_800_000_000_000;

const book = (bids: [number, number][], asks: [number, number][], updatedAt = NOW): L2Snapshot => ({
  bids: bids.map(([price, size]) => ({ price, size })),
  asks: asks.map(([price, size]) => ({ price, size })),
  updatedAt,
});

const check = (ok: boolean, priceDeltaPct: number | null = null, consensus: CrossExchangeCheck["consensus"] = "INDISPONIVEL"): CrossExchangeCheck =>
  ({ ok, priceDeltaPct, consensus } as CrossExchangeCheck);

describe("VENUE_CAPABILITY / describeVenueDataQuality — Regra de Honestidade da Ordem A2.2", () => {
  it("BINANCE e MEXC são FULL_MICROSTRUCTURE; BYBIT e OKX são PRICE_ONLY — exatamente a tabela da Ordem", () => {
    expect(VENUE_CAPABILITY.BINANCE).toBe("FULL_MICROSTRUCTURE");
    expect(VENUE_CAPABILITY.MEXC).toBe("FULL_MICROSTRUCTURE");
    expect(VENUE_CAPABILITY.BYBIT).toBe("PRICE_ONLY");
    expect(VENUE_CAPABILITY.OKX).toBe("PRICE_ONLY");
  });

  it("BINANCE com preço disponível: orderBook/trades AVAILABLE (estrutural, nunca medido)", () => {
    expect(describeVenueDataQuality("BINANCE", true)).toEqual({
      exchange: "BINANCE",
      capability: "FULL_MICROSTRUCTURE",
      price: "AVAILABLE",
      orderBook: "AVAILABLE",
      trades: "AVAILABLE",
    });
  });

  it("BYBIT: mesmo com preço disponível, orderBook/trades continuam NOT_AVAILABLE — nunca promovido a microestrutura por causa do preço estar ok", () => {
    expect(describeVenueDataQuality("BYBIT", true)).toEqual({
      exchange: "BYBIT",
      capability: "PRICE_ONLY",
      price: "AVAILABLE",
      orderBook: "NOT_AVAILABLE",
      trades: "NOT_AVAILABLE",
    });
  });

  it("OKX sem preço disponível: os 3 campos NOT_AVAILABLE", () => {
    expect(describeVenueDataQuality("OKX", false)).toEqual({
      exchange: "OKX",
      capability: "PRICE_ONLY",
      price: "NOT_AVAILABLE",
      orderBook: "NOT_AVAILABLE",
      trades: "NOT_AVAILABLE",
    });
  });
});

describe("computeLiquidityComparison — profundidade real (soma de tamanho válido), fail-closed", () => {
  it("DADOS_INSUFICIENTES com só 1 praça válida", () => {
    const reading = computeLiquidityComparison({ BINANCE: book([[100, 5]], [[101, 5]]) }, NOW);
    expect(reading.status).toBe("DADOS_INSUFICIENTES");
    expect(reading.deeperVenue).toBeNull();
  });

  it("soma real de tamanho válido por lado, ignorando nível fantasma (preço/tamanho não finito ou <= 0)", () => {
    const reading = computeLiquidityComparison(
      {
        BINANCE: book([[100, 5], [99, NaN], [98, -1]], [[101, 3], [102, 0]]),
        MEXC: book([[100, 10]], [[101, 10]]),
      },
      NOW,
    );
    expect(reading.status).toBe("OK");
    const binance = reading.byVenue.find((v) => v.exchange === "BINANCE")!;
    expect(binance.bidLiquidity).toBe(5); // só o nível válido conta
    expect(binance.askLiquidity).toBe(3);
  });

  it("identifica a praça mais líquida (bid+ask) corretamente", () => {
    const reading = computeLiquidityComparison(
      { BINANCE: book([[100, 5]], [[101, 5]]), MEXC: book([[100, 50]], [[101, 50]]) },
      NOW,
    );
    expect(reading.status).toBe("OK");
    expect(reading.deeperVenue).toBe("MEXC");
  });

  it("livro presente mas com os dois lados somando zero é tratado como ausente (nunca conta como praça válida)", () => {
    const reading = computeLiquidityComparison(
      { BINANCE: book([], []), MEXC: book([[100, 10]], [[101, 10]]) },
      NOW,
    );
    expect(reading.status).toBe("DADOS_INSUFICIENTES");
  });

  it("livro velho demais (> maxAgeMs) é excluído, nunca comparado com um livro atrasado", () => {
    const reading = computeLiquidityComparison(
      { BINANCE: book([[100, 5]], [[101, 5]], NOW - 60_000), MEXC: book([[100, 10]], [[101, 10]], NOW) },
      NOW,
    );
    expect(reading.status).toBe("DADOS_INSUFICIENTES");
  });

  it('ISOLAMENTO: BYBIT/OKX no input nunca entram na comparação, mesmo com livro "válido" presente — core é sempre só Binance×MEXC', () => {
    const reading = computeLiquidityComparison(
      {
        BINANCE: book([[100, 5]], [[101, 5]]),
        BYBIT: book([[100, 999]], [[101, 999]]), // hipotético — nunca deveria existir na prática
      } as any,
      NOW,
    );
    expect(reading.status).toBe("DADOS_INSUFICIENTES"); // BYBIT nunca conta como a 2ª praça
    expect(reading.byVenue.some((v) => v.exchange === "BYBIT")).toBe(false);
  });
});

describe("computeLeadLag — heurística simples de primeiro movimento real, fail-closed sem evidência", () => {
  function series(mids: number[], startTime = NOW, stepMs = 2000): L2HistoryEntry[] {
    return mids.map((mid, i) => ({ time: startTime + i * stepMs, bids: [{ price: mid - 0.5, size: 1 }], asks: [{ price: mid + 0.5, size: 1 }] }));
  }

  it(`INSUFFICIENT_EVIDENCE com menos de ${LEAD_LAG_MIN_SAMPLES} amostras numa das praças`, () => {
    const reading = computeLeadLag(series([100, 100, 100]), series(new Array(10).fill(100)));
    expect(reading.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(reading.leadingExchange).toBeNull();
  });

  it("INSUFFICIENT_EVIDENCE quando nenhuma das duas praças teve um movimento real (>= threshold)", () => {
    const flat = new Array(10).fill(100);
    const reading = computeLeadLag(series(flat), series(flat));
    expect(reading.status).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("detecta BINANCE liderando: seu movimento real acontece antes do da MEXC, com o atraso real correto", () => {
    // Binance se move no índice 2 (t = NOW+4000); MEXC no índice 5 (t = NOW+10000).
    const binance = series([100, 100, 100.2, 100.2, 100.2, 100.2]);
    const mexc = series([100, 100, 100, 100, 100, 100.2]);
    const reading = computeLeadLag(binance, mexc);
    expect(reading.status).toBe("OK");
    expect(reading.leadingExchange).toBe("BINANCE");
    expect(reading.lagMs).toBe(6000); // (NOW+10000) - (NOW+4000)
  });

  it("detecta MEXC liderando quando o movimento real dela acontece antes", () => {
    const binance = series([100, 100, 100, 100, 100, 100.2]);
    const mexc = series([100, 100.2, 100.2, 100.2, 100.2, 100.2]);
    const reading = computeLeadLag(binance, mexc);
    expect(reading.status).toBe("OK");
    expect(reading.leadingExchange).toBe("MEXC");
  });

  it("um movimento menor que LEAD_LAG_MOVE_THRESHOLD_PCT nunca conta como líder (jitter, não sinal)", () => {
    const tinyMove = 100 * (1 + LEAD_LAG_MOVE_THRESHOLD_PCT / 100 / 2); // metade do limiar real
    const binance = series([100, 100, tinyMove, tinyMove, tinyMove, tinyMove]);
    const mexc = new Array(6).fill(0).map((_, i) => ({ time: NOW + i * 2000, bids: [{ price: 99.5, size: 1 }], asks: [{ price: 100.5, size: 1 }] }));
    const reading = computeLeadLag(binance, mexc);
    expect(reading.status).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("composeCrossVenueIntelligence — compositor real, LEI 24 preservada", () => {
  const baseInputs = {
    books: {
      BINANCE: book([[100, 5]], [[101, 5]]),
      MEXC: book([[100, 8]], [[101, 8]]),
    },
    binanceHistory: [] as L2HistoryEntry[],
    mexcHistory: [] as L2HistoryEntry[],
    bybitCheck: check(true, 0.02, "ALINHADO"),
    okxCheck: check(false),
    mexcPriceCheck: check(true, 0.01, "ALINHADO"),
    nowMs: NOW,
  };

  it("core.status OK quando Binance e MEXC têm livro real e recente", () => {
    const snap = composeCrossVenueIntelligence(baseInputs);
    expect(snap.core.status).toBe("OK");
    expect(snap.core.book.quotes.map((q) => q.exchange).sort()).toEqual(["BINANCE", "MEXC"]);
  });

  it("ISOLAMENTO: mesmo se orderBooks trouxer BYBIT/OKX, o core nunca os inclui — só CORE_VENUES (Binance/MEXC)", () => {
    const snap = composeCrossVenueIntelligence({
      ...baseInputs,
      books: { ...baseInputs.books, BYBIT: book([[999, 999]], [[1000, 999]]), OKX: book([[999, 999]], [[1000, 999]]) } as any,
    });
    expect(snap.core.book.quotes.map((q) => q.exchange).sort()).toEqual(["BINANCE", "MEXC"]);
    expect(snap.core.liquidity.byVenue.map((v) => v.exchange).sort()).toEqual(["BINANCE", "MEXC"]);
  });

  it("ISOLAMENTO: Binance e MEXC continuam individualmente inspecionáveis — nunca fundidos numa média única sem identidade", () => {
    const snap = composeCrossVenueIntelligence(baseInputs);
    const exchanges = snap.core.book.quotes.map((q) => q.exchange);
    expect(exchanges).toContain("BINANCE");
    expect(exchanges).toContain("MEXC");
    // cada quote carrega o próprio bestBid/bestAsk — nunca um valor consolidado sem exchange.
    for (const q of snap.core.book.quotes) {
      expect(typeof q.exchange).toBe("string");
      expect(Number.isFinite(q.bestBid)).toBe(true);
    }
  });

  it("priceOnly carrega BYBIT/OKX exatamente como recebido (CrossExchangeCheck já existente) — nunca recomputado", () => {
    const snap = composeCrossVenueIntelligence(baseInputs);
    expect(snap.priceOnly.BYBIT).toEqual(baseInputs.bybitCheck);
    expect(snap.priceOnly.OKX).toEqual(baseInputs.okxCheck);
  });

  it("dataQuality classifica as 4 venues conforme a Regra de Honestidade (tabela da Ordem)", () => {
    const snap = composeCrossVenueIntelligence(baseInputs);
    expect(snap.dataQuality.BINANCE).toMatchObject({ capability: "FULL_MICROSTRUCTURE", orderBook: "AVAILABLE", trades: "AVAILABLE" });
    expect(snap.dataQuality.MEXC).toMatchObject({ capability: "FULL_MICROSTRUCTURE", orderBook: "AVAILABLE", trades: "AVAILABLE" });
    expect(snap.dataQuality.BYBIT).toMatchObject({ capability: "PRICE_ONLY", orderBook: "NOT_AVAILABLE", trades: "NOT_AVAILABLE" });
    expect(snap.dataQuality.OKX).toMatchObject({ capability: "PRICE_ONLY", orderBook: "NOT_AVAILABLE", trades: "NOT_AVAILABLE" });
  });

  it("core.status DADOS_INSUFICIENTES quando MEXC ainda não tem livro real (cenário honesto do dia a dia antes do poll)", () => {
    const snap = composeCrossVenueIntelligence({ ...baseInputs, books: { BINANCE: baseInputs.books.BINANCE } });
    expect(snap.core.status).toBe("DADOS_INSUFICIENTES");
  });
});

describe("describeCrossVenueIntelligence — nunca inventa número, nunca promete mais do que o status permite", () => {
  it("mensagem honesta quando core está insuficiente", () => {
    const snap = composeCrossVenueIntelligence({
      books: { BINANCE: book([[100, 5]], [[101, 5]]) },
      binanceHistory: [],
      mexcHistory: [],
      bybitCheck: check(false),
      okxCheck: check(false),
      mexcPriceCheck: check(false),
      nowMs: NOW,
    });
    const text = describeCrossVenueIntelligence(snap);
    expect(text).toContain("CROSS-VENUE CORE (Binance×MEXC)");
    expect(text).toMatch(/consenso exige 2/); // razão real de computeCrossExchangeBook, nunca reformulada aqui
  });

  it("mensagem OK cita as duas praças reais, nunca um valor consolidado anônimo", () => {
    const snap = composeCrossVenueIntelligence({
      books: { BINANCE: book([[100, 5]], [[101, 5]]), MEXC: book([[100, 8]], [[101, 8]]) },
      binanceHistory: [],
      mexcHistory: [],
      bybitCheck: check(false),
      okxCheck: check(false),
      mexcPriceCheck: check(true),
      nowMs: NOW,
    });
    const text = describeCrossVenueIntelligence(snap);
    expect(text).toContain("CROSS-VENUE CORE (Binance×MEXC)");
    expect(text).toMatch(/BINANCE|MEXC/);
  });
});

describe("CROSS_VENUE_KNOWN_GAPS — Gaps Declarados da Ordem A2.2, nunca escondidos", () => {
  it("registra explicitamente BYBIT/OKX FULL MICROSTRUCTURE como NOT_IMPLEMENTED com a razão real", () => {
    expect(CROSS_VENUE_KNOWN_GAPS).toHaveLength(1);
    expect(CROSS_VENUE_KNOWN_GAPS[0]).toEqual({
      scope: "BYBIT/OKX FULL MICROSTRUCTURE",
      status: "NOT_IMPLEMENTED",
      reason: "ORDER BOOK + TRADE DATA CONNECTORS NOT PRESENT IN CURRENT INFRASTRUCTURE",
    });
  });
});

describe("Zero look-ahead — nowMs sempre injetado, nunca Date.now() interno no motor puro", () => {
  it("cross-venue-intelligence.ts nunca chama Date.now() diretamente (mesma disciplina de cross-exchange-book.ts)", () => {
    const src = readFileSync(resolve(__dirname, "../src/nexus/cross-venue-intelligence.ts"), "utf-8");
    expect(src).not.toMatch(/Date\.now\(\)/);
  });
});
