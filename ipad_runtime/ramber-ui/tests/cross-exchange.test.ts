// cross-exchange.test.ts — Master Panel handoff (Multi-Source Market Data
// Fusion, escopo reduzido): trava as partes PURAS do cross-check Bybit
// (src/cross-exchange/bybit-futures.ts) — extração do payload real da
// Bybit v5 e a comparação de preço contra a Binance. Mesmo espírito do
// resto da suíte: testa-se a lógica de dados, nunca a rede real.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractBybitPerpTicker,
  fetchBybitPerpTicker,
  compareCrossExchange,
  DIVERGENCE_THRESHOLD_PCT,
} from '../src/cross-exchange/bybit-futures';

describe('bybit-futures: extractBybitPerpTicker — payload real de /v5/market/tickers (category=linear)', () => {
  it('extrai markPrice/fundingRate/openInterest de um payload bem formado', () => {
    const raw = { result: { list: [{ symbol: 'BTCUSDT', markPrice: '65000.5', fundingRate: '0.0001', openInterest: '12345.6' }] } };
    expect(extractBybitPerpTicker(raw)).toEqual({ ok: true, price: 65000.5, fundingRate: 0.0001, openInterest: 12345.6 });
  });

  it('funding/openInterest ausentes não derrubam o ticker inteiro (melhor-esforço, markPrice basta)', () => {
    const raw = { result: { list: [{ symbol: 'BTCUSDT', markPrice: '65000.5' }] } };
    expect(extractBybitPerpTicker(raw)).toEqual({ ok: true, price: 65000.5, fundingRate: null, openInterest: null });
  });

  it('markPrice ausente/não-numérico => ok:false honesto (preço é o único campo obrigatório)', () => {
    const raw = { result: { list: [{ symbol: 'BTCUSDT', fundingRate: '0.0001' }] } };
    expect(extractBybitPerpTicker(raw)).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
  });

  it('result.list vazio ou ausente => ok:false, nunca lança exceção', () => {
    expect(extractBybitPerpTicker({ result: { list: [] } })).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
    expect(extractBybitPerpTicker({ result: {} })).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
    expect(extractBybitPerpTicker(null)).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
    expect(extractBybitPerpTicker(undefined)).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
    expect(extractBybitPerpTicker({})).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
  });
});

describe('bybit-futures: fetchBybitPerpTicker — fail-closed real, nunca bloqueia o caminho da Binance', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('erro de rede (fetch lança) => ok:false honesto, nunca uma exceção não tratada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await fetchBybitPerpTicker('BTC')).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
  });

  it('resposta HTTP não-ok (ex.: 451/500) => ok:false honesto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchBybitPerpTicker('BTC')).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
  });

  it('resposta ok real é extraída pela mesma função pura extractBybitPerpTicker, e a URL usa o símbolo pedido', async () => {
    const payload = { result: { list: [{ symbol: 'SOLUSDT', markPrice: '150.25', fundingRate: '0.00005', openInterest: '999' }] } };
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain('SOLUSDT');
      expect(url).toContain('api.bybit.com');
      return { ok: true, json: async () => payload };
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchBybitPerpTicker('SOL')).toEqual({ ok: true, price: 150.25, fundingRate: 0.00005, openInterest: 999 });
  });
});

describe('bybit-futures: compareCrossExchange — puramente informativo, nunca decide sinal/direção', () => {
  it('preços praticamente iguais => ALINHADO, com o delta real calculado', () => {
    const result = compareCrossExchange(65000, { ok: true, price: 65010, fundingRate: null, openInterest: null });
    expect(result.ok).toBe(true);
    expect(result.consensus).toBe('ALINHADO');
    expect(result.priceDeltaPct).toBeCloseTo((10 / 65000) * 100, 6);
  });

  it('divergência real acima do limiar => DIVERGENTE', () => {
    const binancePrice = 65000;
    const bybitPrice = binancePrice * (1 + (DIVERGENCE_THRESHOLD_PCT + 0.1) / 100);
    const result = compareCrossExchange(binancePrice, { ok: true, price: bybitPrice, fundingRate: null, openInterest: null });
    expect(result.consensus).toBe('DIVERGENTE');
  });

  it('delta exatamente no limiar é ALINHADO (fronteira é <=, não <)', () => {
    const binancePrice = 65000;
    const bybitPrice = binancePrice * (1 + DIVERGENCE_THRESHOLD_PCT / 100);
    const result = compareCrossExchange(binancePrice, { ok: true, price: bybitPrice, fundingRate: null, openInterest: null });
    expect(result.consensus).toBe('ALINHADO');
  });

  it('preço da Binance ausente (null) => INDISPONIVEL honesto, nunca um delta inventado', () => {
    const result = compareCrossExchange(null, { ok: true, price: 65000, fundingRate: null, openInterest: null });
    expect(result).toEqual({ ok: false, priceDeltaPct: null, consensus: 'INDISPONIVEL' });
  });

  it('Bybit indisponível (ok:false) => INDISPONIVEL — nunca bloqueia nem afeta o dado real da Binance', () => {
    const result = compareCrossExchange(65000, { ok: false, price: null, fundingRate: null, openInterest: null });
    expect(result).toEqual({ ok: false, priceDeltaPct: null, consensus: 'INDISPONIVEL' });
  });
});
