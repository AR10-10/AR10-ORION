// omnibox.test.ts — Overhaul Cross-Market (Missão 2): trava as partes
// PURAS do Smart Omnibox — extração/curadoria dos tickers reais da
// Binance e a taxonomia TradFi hardcoded. A busca em si (SmartOmnibox.tsx)
// é UI e não é testada aqui, no mesmo espírito do resto da suíte (testa-se
// a lógica de dados, não a renderização React).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractUsdtSymbols,
  partitionCryptoSymbols,
  fetchBinanceUsdtSymbols,
  KNOWN_MEME_BASES,
} from '../src/omnibox/binance-symbols';
import {
  TRADFI_ASSETS,
  TRADFI_CATEGORY_ORDER,
  TRADFI_CATEGORY_LABELS,
} from '../src/omnibox/tradfi-assets';

describe('binance-symbols: extractUsdtSymbols — só pares spot/USDT realmente negociáveis agora', () => {
  it('aceita um par TRADING/USDT/spot-permitido', () => {
    const raw = { symbols: [{ symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true }] };
    expect(extractUsdtSymbols(raw)).toEqual([{ symbol: 'BTCUSDT', baseAsset: 'BTC' }]);
  });

  it('rejeita status != TRADING (par pausado/deslistado)', () => {
    const raw = { symbols: [{ symbol: 'XUSDT', baseAsset: 'X', quoteAsset: 'USDT', status: 'BREAK' }] };
    expect(extractUsdtSymbols(raw)).toEqual([]);
  });

  it('rejeita quoteAsset != USDT (ex.: par BTC ou BUSD)', () => {
    const raw = { symbols: [{ symbol: 'ETHBTC', baseAsset: 'ETH', quoteAsset: 'BTC', status: 'TRADING' }] };
    expect(extractUsdtSymbols(raw)).toEqual([]);
  });

  it('rejeita isSpotTradingAllowed === false explicitamente (ex.: par só de futuros)', () => {
    const raw = { symbols: [{ symbol: 'XUSDT', baseAsset: 'X', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: false }] };
    expect(extractUsdtSymbols(raw)).toEqual([]);
  });

  it('campo ausente (undefined) não é o mesmo que false — a API real às vezes omite o campo para pares spot normais', () => {
    const raw = { symbols: [{ symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING' }] };
    expect(extractUsdtSymbols(raw)).toEqual([{ symbol: 'BTCUSDT', baseAsset: 'BTC' }]);
  });

  it('linhas malformadas (symbol/baseAsset não-string) são descartadas silenciosamente, nunca fabricadas', () => {
    const raw = { symbols: [{ symbol: 123, baseAsset: 'X', quoteAsset: 'USDT', status: 'TRADING' }, null, undefined] };
    expect(extractUsdtSymbols(raw)).toEqual([]);
  });

  it('payload sem array symbols (ou null/undefined) => [] honesto, nunca lança exceção', () => {
    expect(extractUsdtSymbols(null)).toEqual([]);
    expect(extractUsdtSymbols(undefined)).toEqual([]);
    expect(extractUsdtSymbols({})).toEqual([]);
    expect(extractUsdtSymbols({ symbols: 'não é array' })).toEqual([]);
  });
});

describe('binance-symbols: partitionCryptoSymbols — meme coins são um FILTRO sobre a lista real, nunca uma lista inventada', () => {
  it('separa bases conhecidas de meme coin do resto', () => {
    const all = [
      { symbol: 'BTCUSDT', baseAsset: 'BTC' },
      { symbol: 'DOGEUSDT', baseAsset: 'DOGE' },
      { symbol: 'PEPEUSDT', baseAsset: 'PEPE' },
      { symbol: 'ETHUSDT', baseAsset: 'ETH' },
    ];
    const { crypto, meme } = partitionCryptoSymbols(all);
    expect(crypto.map((s) => s.baseAsset).sort()).toEqual(['BTC', 'ETH']);
    expect(meme.map((s) => s.baseAsset).sort()).toEqual(['DOGE', 'PEPE']);
  });

  it('uma base da curadoria de meme que a Binance não lista agora simplesmente não aparece em nenhuma das duas listas', () => {
    const all = [{ symbol: 'BTCUSDT', baseAsset: 'BTC' }]; // SHIB não está presente
    const { crypto, meme } = partitionCryptoSymbols(all);
    expect(meme).toEqual([]);
    expect(crypto).toHaveLength(1);
    expect(KNOWN_MEME_BASES.has('SHIB')).toBe(true); // a curadoria menciona SHIB...
    // ...mas ele não aparece fabricado em lugar nenhum da saída real.
  });

  it('lista vazia (fetch falhou) particiona para duas listas vazias, nunca lança', () => {
    expect(partitionCryptoSymbols([])).toEqual({ crypto: [], meme: [] });
  });
});

describe('binance-symbols: fetchBinanceUsdtSymbols — fail-closed real', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('erro de rede (fetch lança) => [] honesto, nunca uma exceção não tratada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await fetchBinanceUsdtSymbols()).toEqual([]);
  });

  it('resposta HTTP não-ok (ex.: 451/500) => [] honesto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchBinanceUsdtSymbols()).toEqual([]);
  });

  it('resposta ok real é extraída pela mesma função pura extractUsdtSymbols', async () => {
    const payload = { symbols: [{ symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', status: 'TRADING' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
    expect(await fetchBinanceUsdtSymbols()).toEqual([{ symbol: 'SOLUSDT', baseAsset: 'SOL' }]);
  });
});

describe('tradfi-assets: a taxonomia hardcoded da diretriz 3 — exata, congelada, para conexão futura', () => {
  it('as 4 categorias e a ordem são exatamente as da ordem de ignição', () => {
    expect(TRADFI_CATEGORY_ORDER).toEqual(['INDICES_GLOBAIS', 'ACOES_BIG_TECH', 'COMMODITIES', 'FOREX']);
    expect(Object.keys(TRADFI_CATEGORY_LABELS).sort()).toEqual([...TRADFI_CATEGORY_ORDER].sort());
  });

  it('ÍNDICES GLOBAIS: SPX, NDX, RUT, US30, GER40', () => {
    const symbols = TRADFI_ASSETS.filter((a) => a.category === 'INDICES_GLOBAIS').map((a) => a.symbol);
    expect(symbols).toEqual(['SPX', 'NDX', 'RUT', 'US30', 'GER40']);
  });

  it('AÇÕES (BIG TECHS): TSLA, NVDA, AAPL, MSFT, META', () => {
    const symbols = TRADFI_ASSETS.filter((a) => a.category === 'ACOES_BIG_TECH').map((a) => a.symbol);
    expect(symbols).toEqual(['TSLA', 'NVDA', 'AAPL', 'MSFT', 'META']);
  });

  it('COMMODITIES: USOIL, UKOIL, XAUUSD, XAGUSD', () => {
    const symbols = TRADFI_ASSETS.filter((a) => a.category === 'COMMODITIES').map((a) => a.symbol);
    expect(symbols).toEqual(['USOIL', 'UKOIL', 'XAUUSD', 'XAGUSD']);
  });

  it('FOREX: EUR/USD, GBP/USD, USD/JPY', () => {
    const symbols = TRADFI_ASSETS.filter((a) => a.category === 'FOREX').map((a) => a.symbol);
    expect(symbols).toEqual(['EURUSD', 'GBPUSD', 'USDJPY']);
  });

  it('17 ativos ao todo, cada um com nome não-vazio, tudo congelado (Object.freeze)', () => {
    expect(TRADFI_ASSETS).toHaveLength(17);
    for (const a of TRADFI_ASSETS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(Object.isFrozen(a)).toBe(true);
    }
    expect(Object.isFrozen(TRADFI_ASSETS)).toBe(true);
  });
});
