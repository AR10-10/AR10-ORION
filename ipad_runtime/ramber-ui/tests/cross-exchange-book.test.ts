// cross-exchange-book.test.ts — Ponta Solta 1 da Auditoria do Ecossistema.
// Execução real (CLAUDE.md: lógica pura de fronteira), porque o bug provável
// aqui é "a matemática/o gate está sutilmente errado", nunca fiação.
import { describe, it, expect } from 'vitest';
import {
  computeCrossExchangeBook,
  describeCrossExchangeBook,
  CROSS_EXCHANGE_MAX_BOOK_AGE_MS,
  CROSS_EXCHANGE_MIN_VENUES,
} from '../src/nexus/cross-exchange-book';
import type { Exchange, L2Snapshot } from '../src/nexus/types';

const NOW = 1_700_000_000_000;
const book = (bid: number, ask: number, updatedAt = NOW, size = 5): L2Snapshot => ({
  bids: [{ price: bid, size }, { price: bid - 1, size }],
  asks: [{ price: ask, size }, { price: ask + 1, size }],
  updatedAt,
});

describe('computeCrossExchangeBook: fail-closed real (Regra de Ouro 3)', () => {
  it('sem nenhuma corretora => DADOS_INSUFICIENTES, nunca zero fabricado', () => {
    const r = computeCrossExchangeBook({}, NOW);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.bestBid).toBeNull();
    expect(r.consolidatedSpread).toBeNull();
    expect(r.medianMid).toBeNull();
    expect(r.reason).toContain('0 corretora');
  });

  it('uma corretora só => DADOS_INSUFICIENTES: "consenso" com uma praça não existe', () => {
    const r = computeCrossExchangeBook({ BINANCE: book(100, 101) }, NOW);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.quotes).toHaveLength(0);
    expect(CROSS_EXCHANGE_MIN_VENUES).toBe(2);
  });

  it('livro velho demais é EXCLUÍDO, nunca "corrigido" — comparar 30s atrás com agora inventaria desalinhamento', () => {
    const r = computeCrossExchangeBook(
      { BINANCE: book(100, 101), MEXC: book(100, 101, NOW - CROSS_EXCHANGE_MAX_BOOK_AGE_MS - 1) },
      NOW,
    );
    expect(r.status).toBe('DADOS_INSUFICIENTES'); // sobrou 1 praça válida
  });

  it('praça com null (nunca conectada) é ignorada sem quebrar a leitura das outras', () => {
    const r = computeCrossExchangeBook({ BINANCE: book(100, 101), BYBIT: null, OKX: book(100, 101) }, NOW);
    expect(r.status).toBe('OK');
    expect(r.quotes.map((q) => q.exchange).sort()).toEqual(['BINANCE', 'OKX']);
  });

  it('nível fantasma (size<=0 ou preço não finito) nunca vira topo de livro', () => {
    const ghost: L2Snapshot = {
      bids: [{ price: 999, size: 0 }, { price: 100, size: 3 }],
      asks: [{ price: Number.NaN, size: 4 }, { price: 101, size: 2 }],
      updatedAt: NOW,
    };
    const r = computeCrossExchangeBook({ BINANCE: ghost, MEXC: book(100, 101) }, NOW);
    expect(r.status).toBe('OK');
    const binance = r.quotes.find((q) => q.exchange === 'BINANCE')!;
    expect(binance.bestBid).toBe(100); // 999 tinha size 0
    expect(binance.bestAsk).toBe(101); // NaN descartado
  });

  it('um lado inteiro vazio não é cotação — a praça sai da comparação', () => {
    const oneSided: L2Snapshot = { bids: [{ price: 100, size: 2 }], asks: [], updatedAt: NOW };
    const r = computeCrossExchangeBook({ BINANCE: oneSided, MEXC: book(100, 101), OKX: book(100, 101) }, NOW);
    expect(r.quotes.map((q) => q.exchange).sort()).toEqual(['MEXC', 'OKX']);
  });
});

describe('computeCrossExchangeBook: a leitura real que o dado capturado permitia', () => {
  it('melhor bid e melhor ask são achados ATRAVÉS das praças, não dentro de uma só', () => {
    const r = computeCrossExchangeBook(
      { BINANCE: book(100.0, 100.5), MEXC: book(100.2, 100.9), OKX: book(99.8, 100.3) },
      NOW,
    );
    expect(r.status).toBe('OK');
    expect(r.bestBid).toEqual({ exchange: 'MEXC', price: 100.2 }); // maior bid
    expect(r.bestAsk).toEqual({ exchange: 'OKX', price: 100.3 }); // menor ask
  });

  it('spread consolidado NEGATIVO expõe desalinhamento real entre praças — impossível de ver numa só', () => {
    // MEXC paga 101 enquanto OKX vende a 100.4: o melhor bid está ACIMA do
    // melhor ask. É o sinal mais forte que este dado pode dar.
    const r = computeCrossExchangeBook({ MEXC: book(101, 101.5), OKX: book(100.0, 100.4) }, NOW);
    expect(r.consolidatedSpread).toBeCloseTo(100.4 - 101, 10);
    expect(r.consolidatedSpread!).toBeLessThan(0);
    expect(describeCrossExchangeBook(r)).toContain('desalinhadas');
  });

  it('livro sadio: spread consolidado é >= 0 e nunca maior que o spread da praça mais estreita', () => {
    const r = computeCrossExchangeBook(
      { BINANCE: book(100.0, 100.6), MEXC: book(100.1, 100.5), OKX: book(99.9, 100.7) },
      NOW,
    );
    const tightest = Math.min(...r.quotes.map((q) => q.spread));
    expect(r.consolidatedSpread!).toBeGreaterThanOrEqual(0);
    expect(r.consolidatedSpread!).toBeLessThanOrEqual(tightest);
  });

  it('referência é MEDIANA, não média — uma praça com feed travado não arrasta o consenso', () => {
    // 2 praças coerentes em ~100, uma absurda em ~200 (feed travado/errado).
    const r = computeCrossExchangeBook(
      { BINANCE: book(100, 100.2), MEXC: book(100.1, 100.3), OKX: book(200, 200.2) },
      NOW,
    );
    // média seria ~133; a mediana fica junto das praças coerentes.
    expect(r.medianMid!).toBeGreaterThan(99);
    expect(r.medianMid!).toBeLessThan(101);
    // e a praça absurda é justamente quem aparece como maior desvio
    expect(r.maxDeviation!.exchange).toBe('OKX');
    expect(r.maxDeviation!.percent).toBeGreaterThan(50);
  });

  it('praças idênticas => desvio zero em todas (sanidade da métrica)', () => {
    const r = computeCrossExchangeBook({ BINANCE: book(100, 101), MEXC: book(100, 101) }, NOW);
    expect(r.medianMid).toBeCloseTo(100.5, 10);
    expect(r.maxDeviation!.percent).toBeCloseTo(0, 10);
  });

  it('quotes vêm ordenadas por melhor bid (maior primeiro) — a praça mais vantajosa para vender aparece antes', () => {
    const r = computeCrossExchangeBook(
      { BINANCE: book(99.5, 101), MEXC: book(100.5, 101), OKX: book(100.0, 101) },
      NOW,
    );
    expect(r.quotes.map((q) => q.exchange)).toEqual(['MEXC', 'OKX', 'BINANCE']);
  });

  it('idade real de cada snapshot é preservada por praça — o Operador vê qual feed está atrasando', () => {
    const r = computeCrossExchangeBook(
      { BINANCE: book(100, 101, NOW - 200), MEXC: book(100, 101, NOW - 4000) },
      NOW,
    );
    expect(r.quotes.find((q) => q.exchange === 'BINANCE')!.ageMs).toBe(200);
    expect(r.quotes.find((q) => q.exchange === 'MEXC')!.ageMs).toBe(4000);
  });

  it('pureza: mesma entrada, mesma saída — zero rede, zero Date.now() interno', () => {
    const books = { BINANCE: book(100, 101), MEXC: book(100.1, 101.1) };
    expect(computeCrossExchangeBook(books, NOW)).toEqual(computeCrossExchangeBook(books, NOW));
  });

  it('as 4 corretoras reais do sistema cabem na leitura ao mesmo tempo', () => {
    const all: Partial<Record<Exchange, L2Snapshot>> = {
      BINANCE: book(100.0, 100.4),
      BYBIT: book(100.1, 100.5),
      OKX: book(99.9, 100.3),
      MEXC: book(100.2, 100.6),
    };
    const r = computeCrossExchangeBook(all, NOW);
    expect(r.status).toBe('OK');
    expect(r.quotes).toHaveLength(4);
    expect(r.bestBid!.exchange).toBe('MEXC');
    expect(r.bestAsk!.exchange).toBe('OKX');
  });
});

describe('describeCrossExchangeBook: frase honesta, nunca número inventado', () => {
  it('sem dado suficiente devolve a RAZÃO real, não um texto genérico', () => {
    const r = computeCrossExchangeBook({ BINANCE: book(100, 101) }, NOW);
    expect(describeCrossExchangeBook(r)).toBe(r.reason);
    expect(describeCrossExchangeBook(r)).toContain('corretora');
  });

  it('leitura sadia nomeia as praças reais do melhor bid e do melhor ask', () => {
    const r = computeCrossExchangeBook({ BINANCE: book(100.2, 100.9), OKX: book(99.8, 100.3) }, NOW);
    const txt = describeCrossExchangeBook(r);
    expect(txt).toContain('2 praças');
    expect(txt).toContain('melhor bid BINANCE');
    expect(txt).toContain('melhor ask OKX');
  });
});
