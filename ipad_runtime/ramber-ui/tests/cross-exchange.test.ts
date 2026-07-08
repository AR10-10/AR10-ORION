// cross-exchange.test.ts — Master Panel handoff (Multi-Source Market Data
// Fusion): trava as partes PURAS de todos os cross-checks de exchange —
// Bybit (src/cross-exchange/bybit-futures.ts) e OKX
// (src/cross-exchange/okx-futures.ts) — extração dos payloads reais de
// cada API e a comparação de preço genérica contra a Binance
// (src/cross-exchange/shared.ts). Mesmo espírito do resto da suíte:
// testa-se a lógica de dados, nunca a rede real.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractBybitPerpTicker,
  fetchBybitPerpTicker,
  compareCrossExchange,
  DIVERGENCE_THRESHOLD_PCT,
} from '../src/cross-exchange/bybit-futures';
import { extractOkxPerpTicker, fetchOkxPerpTicker } from '../src/cross-exchange/okx-futures';

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

describe('okx-futures: extractOkxPerpTicker — payload real de /api/v5/public/mark-price (instType=SWAP)', () => {
  it('extrai markPx de um payload bem formado', () => {
    const raw = { code: '0', msg: '', data: [{ instType: 'SWAP', instId: 'BTC-USDT-SWAP', markPx: '65012.3', ts: '1700000000000' }] };
    expect(extractOkxPerpTicker(raw)).toEqual({ ok: true, price: 65012.3, fundingRate: null, openInterest: null });
  });

  it('fundingRate/openInterest sempre null — a OKX não é consultada para eles (nenhum consumidor os lê)', () => {
    const raw = { data: [{ markPx: '150.25' }] };
    expect(extractOkxPerpTicker(raw)).toEqual({ ok: true, price: 150.25, fundingRate: null, openInterest: null });
  });

  it('markPx ausente/não-numérico => ok:false honesto', () => {
    const raw = { data: [{ instId: 'BTC-USDT-SWAP' }] };
    expect(extractOkxPerpTicker(raw)).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
  });

  it('data vazio ou ausente => ok:false, nunca lança exceção', () => {
    expect(extractOkxPerpTicker({ data: [] })).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
    expect(extractOkxPerpTicker({})).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
    expect(extractOkxPerpTicker(null)).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
    expect(extractOkxPerpTicker(undefined)).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
  });
});

describe('okx-futures: fetchOkxPerpTicker — fail-closed real, nunca bloqueia o caminho da Binance ou da Bybit', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('erro de rede (fetch lança) => ok:false honesto, nunca uma exceção não tratada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await fetchOkxPerpTicker('BTC')).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
  });

  it('resposta HTTP não-ok (ex.: 451/500) => ok:false honesto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchOkxPerpTicker('BTC')).toEqual({ ok: false, price: null, fundingRate: null, openInterest: null });
  });

  it('resposta ok real é extraída pela mesma função pura extractOkxPerpTicker, e a URL usa o instId esperado', async () => {
    const payload = { data: [{ instId: 'SOL-USDT-SWAP', markPx: '150.25' }] };
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain('SOL-USDT-SWAP');
      expect(url).toContain('www.okx.com');
      return { ok: true, json: async () => payload };
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchOkxPerpTicker('SOL')).toEqual({ ok: true, price: 150.25, fundingRate: null, openInterest: null });
  });
});

describe('okx-futures + shared: compareCrossExchange também funciona com um ticker da OKX (mesma lógica genérica da Bybit)', () => {
  it('OKX alinhada com a Binance => ALINHADO', () => {
    const result = compareCrossExchange(65000, { ok: true, price: 65010, fundingRate: null, openInterest: null });
    expect(result.consensus).toBe('ALINHADO');
  });

  it('OKX indisponível (ok:false) => INDISPONIVEL — nunca bloqueia nem afeta Binance ou Bybit', () => {
    const result = compareCrossExchange(65000, { ok: false, price: null, fundingRate: null, openInterest: null });
    expect(result).toEqual({ ok: false, priceDeltaPct: null, consensus: 'INDISPONIVEL' });
  });
});
