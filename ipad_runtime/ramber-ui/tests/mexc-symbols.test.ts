// mexc-symbols.test.ts — ADITIVO V-MAX Etapa 9: irmão direto de
// omnibox.test.ts (binance-symbols) — mesma disciplina, extração pura
// testável sem rede; só fetchMexcUsdtSymbols mocka fetch().
import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractMexcUsdtSymbols, fetchMexcUsdtSymbols } from '../src/omnibox/mexc-symbols';

function contractRow(overrides: Record<string, unknown> = {}) {
  return {
    symbol: 'BTC_USDT',
    baseCoin: 'BTC',
    quoteCoin: 'USDT',
    settleCoin: 'USDT',
    isHidden: false,
    apiAllowed: true,
    ...overrides,
  };
}

describe('mexc-symbols: extractMexcUsdtSymbols — só contratos USDT-M reais e negociáveis agora', () => {
  it('linha real e completa vira {symbol, baseAsset}', () => {
    const raw = { success: true, code: 0, data: [contractRow()] };
    expect(extractMexcUsdtSymbols(raw)).toEqual([{ symbol: 'BTC_USDT', baseAsset: 'BTC' }]);
  });

  it('settleCoin diferente de USDT (ex. um contrato liquidado em outra moeda) é excluído', () => {
    const raw = { success: true, code: 0, data: [contractRow({ settleCoin: 'USDC' })] };
    expect(extractMexcUsdtSymbols(raw)).toEqual([]);
  });

  it('quoteCoin cobre o caso de settleCoin ausente (fallback real, nunca um par inventado)', () => {
    const raw = { success: true, code: 0, data: [contractRow({ settleCoin: undefined, quoteCoin: 'USDT' })] };
    expect(extractMexcUsdtSymbols(raw)).toEqual([{ symbol: 'BTC_USDT', baseAsset: 'BTC' }]);
  });

  it('isHidden:true é excluído (contrato oculto/delistado)', () => {
    const raw = { success: true, code: 0, data: [contractRow({ isHidden: true })] };
    expect(extractMexcUsdtSymbols(raw)).toEqual([]);
  });

  it('apiAllowed:false é excluído (não negociável via API)', () => {
    const raw = { success: true, code: 0, data: [contractRow({ apiAllowed: false })] };
    expect(extractMexcUsdtSymbols(raw)).toEqual([]);
  });

  it('linha sem symbol/baseCoin real (tipos errados) é excluída', () => {
    const raw = { success: true, code: 0, data: [{ ...contractRow(), symbol: null }, { ...contractRow(), baseCoin: 42 }] };
    expect(extractMexcUsdtSymbols(raw)).toEqual([]);
  });

  it('success:false devolve [] mesmo com data presente — nunca lê um payload de erro como se fosse dado real', () => {
    const raw = { success: false, code: 1, data: [contractRow()] };
    expect(extractMexcUsdtSymbols(raw)).toEqual([]);
  });

  it('shapes malformados nunca lançam, sempre [] honesto', () => {
    expect(extractMexcUsdtSymbols(null)).toEqual([]);
    expect(extractMexcUsdtSymbols(undefined)).toEqual([]);
    expect(extractMexcUsdtSymbols({})).toEqual([]);
    expect(extractMexcUsdtSymbols({ success: true, data: 'não é array' })).toEqual([]);
  });

  it('múltiplos contratos reais preservam ordem e nunca deduplicam silenciosamente (dedupe é responsabilidade de quem consome, não desta extração)', () => {
    const raw = { success: true, code: 0, data: [contractRow(), contractRow({ symbol: 'ETH_USDT', baseCoin: 'ETH' })] };
    expect(extractMexcUsdtSymbols(raw)).toEqual([
      { symbol: 'BTC_USDT', baseAsset: 'BTC' },
      { symbol: 'ETH_USDT', baseAsset: 'ETH' },
    ]);
  });
});

describe('mexc-symbols: fetchMexcUsdtSymbols — fail-closed real de rede', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resposta HTTP ok real devolve os símbolos extraídos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, code: 0, data: [contractRow({ symbol: 'SOL_USDT', baseCoin: 'SOL' })] }),
    }));
    expect(await fetchMexcUsdtSymbols()).toEqual([{ symbol: 'SOL_USDT', baseAsset: 'SOL' }]);
  });

  it('HTTP não-ok devolve [] honesto, nunca lança', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(await fetchMexcUsdtSymbols()).toEqual([]);
  });

  it('fetch rejeitado (rede indisponível) devolve [] honesto, nunca lança', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await fetchMexcUsdtSymbols()).toEqual([]);
  });
});
