// omnibox.test.ts — Overhaul Cross-Market (Missão 2): trava as partes
// PURAS do Smart Omnibox — extração/curadoria dos tickers reais da
// Binance e a taxonomia TradFi hardcoded. A busca em si (SmartOmnibox.tsx)
// é UI e não é testada aqui via execução, no mesmo espírito do resto da
// suíte (testa-se a lógica de dados, não a renderização React) — exceto
// pelo describe de padrão-de-código no fim do arquivo, que trava por
// regex uma regressão de cascata CSS já vista uma vez (ver comentário lá).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  extractUsdtSymbols,
  extractPerpUsdtSymbols,
  partitionCryptoSymbols,
  fetchBinanceUsdtSymbols,
  KNOWN_MEME_BASES,
} from '../src/omnibox/binance-symbols';
import {
  TRADFI_ASSETS,
  TRADFI_CATEGORY_ORDER,
  TRADFI_CATEGORY_LABELS,
} from '../src/omnibox/tradfi-assets';

describe('binance-symbols: extractPerpUsdtSymbols — só contratos perpétuos/USDT realmente negociáveis agora (fonte PREFERIDA)', () => {
  it('aceita um contrato TRADING/USDT/PERPETUAL', () => {
    const raw = { symbols: [{ symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' }] };
    expect(extractPerpUsdtSymbols(raw)).toEqual([{ symbol: 'BTCUSDT', baseAsset: 'BTC', market: 'perp' }]);
  });

  it('rejeita status != TRADING (contrato pausado/deslistado)', () => {
    const raw = { symbols: [{ symbol: 'XUSDT', baseAsset: 'X', quoteAsset: 'USDT', status: 'BREAK', contractType: 'PERPETUAL' }] };
    expect(extractPerpUsdtSymbols(raw)).toEqual([]);
  });

  it('rejeita quoteAsset != USDT (ex.: contrato liquidado em BUSD/coin-margined)', () => {
    const raw = { symbols: [{ symbol: 'BTCUSD_PERP', baseAsset: 'BTC', quoteAsset: 'USD', status: 'TRADING', contractType: 'PERPETUAL' }] };
    expect(extractPerpUsdtSymbols(raw)).toEqual([]);
  });

  it('rejeita contractType != PERPETUAL (ex.: contrato futuro com vencimento, CURRENT_QUARTER)', () => {
    const raw = { symbols: [{ symbol: 'BTCUSDT_240329', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', contractType: 'CURRENT_QUARTER' }] };
    expect(extractPerpUsdtSymbols(raw)).toEqual([]);
  });

  it('linhas malformadas (symbol/baseAsset não-string) são descartadas silenciosamente, nunca fabricadas', () => {
    const raw = { symbols: [{ symbol: 123, baseAsset: 'X', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' }, null, undefined] };
    expect(extractPerpUsdtSymbols(raw)).toEqual([]);
  });

  it('payload sem array symbols (ou null/undefined) => [] honesto, nunca lança exceção', () => {
    expect(extractPerpUsdtSymbols(null)).toEqual([]);
    expect(extractPerpUsdtSymbols(undefined)).toEqual([]);
    expect(extractPerpUsdtSymbols({})).toEqual([]);
    expect(extractPerpUsdtSymbols({ symbols: 'não é array' })).toEqual([]);
  });
});

describe('binance-symbols: extractUsdtSymbols — só pares spot/USDT realmente negociáveis agora (fallback)', () => {
  it('aceita um par TRADING/USDT/spot-permitido', () => {
    const raw = { symbols: [{ symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true }] };
    expect(extractUsdtSymbols(raw)).toEqual([{ symbol: 'BTCUSDT', baseAsset: 'BTC', market: 'spot' }]);
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
    expect(extractUsdtSymbols(raw)).toEqual([{ symbol: 'BTCUSDT', baseAsset: 'BTC', market: 'spot' }]);
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
    const all: import('../src/omnibox/binance-symbols').BinanceUsdtSymbol[] = [
      { symbol: 'BTCUSDT', baseAsset: 'BTC', market: 'perp' },
      { symbol: 'DOGEUSDT', baseAsset: 'DOGE', market: 'perp' },
      { symbol: 'PEPEUSDT', baseAsset: 'PEPE', market: 'perp' },
      { symbol: 'ETHUSDT', baseAsset: 'ETH', market: 'perp' },
    ];
    const { crypto, meme } = partitionCryptoSymbols(all);
    expect(crypto.map((s) => s.baseAsset).sort()).toEqual(['BTC', 'ETH']);
    expect(meme.map((s) => s.baseAsset).sort()).toEqual(['DOGE', 'PEPE']);
  });

  it('uma base da curadoria de meme que a Binance não lista agora simplesmente não aparece em nenhuma das duas listas', () => {
    const all = [{ symbol: 'BTCUSDT', baseAsset: 'BTC', market: 'perp' as const }]; // SHIB não está presente
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

describe('binance-symbols: fetchBinanceUsdtSymbols — Futuros PREFERIDO, Spot como fallback automático (fail-closed real)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Futuros responde com símbolos reais => usa Futuros direto, nunca chama Spot', async () => {
    const perpPayload = { symbols: [{ symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' }] };
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain('fapi.binance.com'); // só o endpoint de Futuros deveria ser chamado
      return { ok: true, json: async () => perpPayload };
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchBinanceUsdtSymbols()).toEqual([{ symbol: 'SOLUSDT', baseAsset: 'SOL', market: 'perp' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Futuros devolve lista vazia (payload sem nenhum contrato perpétuo real) => cai para Spot automaticamente', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('fapi.binance.com')) {
        return { ok: true, json: async () => ({ symbols: [] }) }; // Futuros respondeu, mas sem nada aproveitável
      }
      return {
        ok: true,
        json: async () => ({ symbols: [{ symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', status: 'TRADING' }] }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchBinanceUsdtSymbols()).toEqual([{ symbol: 'SOLUSDT', baseAsset: 'SOL', market: 'spot' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Futuros lança exceção de rede => cai para Spot automaticamente (mesma lógica de requestCandleSnapshotWithFallback em engine-bridge.ts)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('fapi.binance.com')) throw new Error('rede_indisponivel');
      return {
        ok: true,
        json: async () => ({ symbols: [{ symbol: 'ADAUSDT', baseAsset: 'ADA', quoteAsset: 'USDT', status: 'TRADING' }] }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchBinanceUsdtSymbols()).toEqual([{ symbol: 'ADAUSDT', baseAsset: 'ADA', market: 'spot' }]);
  });

  it('AMBAS as fontes falham (rede indisponível) => [] honesto, nunca uma exceção não tratada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await fetchBinanceUsdtSymbols()).toEqual([]);
  });

  it('AMBAS as fontes respondem HTTP não-ok (ex.: 451/500) => [] honesto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchBinanceUsdtSymbols()).toEqual([]);
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

describe('SmartOmnibox.tsx: dropdown precisa vencer a cascata CSS de `.cyber-panel` (regressão real já vista 2x)', () => {
  // Bug real, reproduzido com Playwright (iPad portrait/paisagem): `.cyber-panel`
  // (index.css) define TANTO `overflow: hidden` QUANTO `position: relative`.
  // Como essa classe custom é emitida DEPOIS das utilidades do Tailwind no CSS
  // compilado, ela vence a cascata sobre QUALQUER utilidade Tailwind de mesma
  // especificidade que tente a mesma propriedade — já aconteceu uma vez com
  // `overflow-y-auto` (lista não rolava) e uma segunda vez, de forma bem mais
  // grave, com `absolute` (o dropdown ficava PRESO em fluxo normal, inflava o
  // wrapper `.relative` para a altura do próprio conteúdo, e esse wrapper vive
  // dentro de um contêiner flex de altura FIXA — `h-[70%]` do header, 46px de
  // altura total — com `items-center`; o resultado medido foi o botão de
  // gatilho renderizando a ~350px ACIMA do viewport, efetivamente cortado/
  // invisível). Ambas as correções usam o mesmo escape hatch: `!` força
  // `!important`, que vence independente da ordem de emissão no CSS.
  const src = () => readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/omnibox/SmartOmnibox.tsx'), 'utf8');

  it('dropdown usa !absolute (nunca só `absolute`) para vencer o position:relative de .cyber-panel', () => {
    const s = src();
    const idx = s.indexOf('cyber-panel bg-[#010308]/98');
    expect(idx, 'div do dropdown não encontrada').toBeGreaterThan(-1);
    const classLine = s.slice(Math.max(0, idx - 200), idx);
    expect(classLine).toContain('!absolute');
    expect(classLine).not.toMatch(/(?<!!)\babsolute\b/); // "absolute" sem "!" na frente não pode voltar
  });

  it('dropdown mantém !overflow-y-auto (regressão original, já corrigida — não pode voltar a quebrar junto)', () => {
    const s = src();
    const idx = s.indexOf('cyber-panel bg-[#010308]/98');
    const classLine = s.slice(Math.max(0, idx - 200), idx);
    expect(classLine).toContain('!overflow-y-auto');
  });
});
