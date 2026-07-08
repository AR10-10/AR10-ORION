// binance-futures-public.test.ts — trava o achado real da auditoria
// autônoma (Master Panel handoff, "Runtime Stability: API efficiency"):
// probe() buscava depth/funding/open_interest/long_short SEMPRE, mesmo
// para o único chamador de produção (collectBinanceFuturesKlines) que só
// lê evidence.candles — 4 round-trips de rede reais descartados a cada
// ciclo, atrasando o caminho crítico do gráfico. includeDerivatives:false
// pula essas 4 sondas; o comportamento default (true) fica bit-a-bit
// idêntico ao original para qualquer outro chamador. Mocka só fetch() —
// a mesma convenção do resto da suíte (probe.js real, não substituído).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probe } from '../../js/real-data/binance-futures-public.js';

function klinesPayload() {
  // [openTime, open, high, low, close, volume, ...] — só os 6 primeiros
  // campos são lidos por validateKlinesShape/probe().
  return [[1700000000000, '100', '105', '95', '102', '10']];
}

function jsonResponse(body: unknown) {
  return { ok: true, text: async () => JSON.stringify(body), json: async () => body };
}

describe('binance-futures-public: includeDerivatives:false pula as 4 sondas descartadas (achado real de eficiência de API)', () => {
  // probe.js (probeJsonEndpoint) checa `'AbortController' in self` — um
  // global de browser/worker que o ambiente 'node' do vitest.config.ts não
  // define. Alias mínimo para exercitar o probe.js REAL (não substituído),
  // mesma convenção do resto da suíte — nunca mockar o que não precisa.
  beforeEach(() => {
    vi.stubGlobal('self', globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includeDerivatives:false faz exatamente 1 chamada de rede (klines) e marca as 4 derivadas + liquidations como DADOS_INSUFICIENTES honesto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(klinesPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ symbol: 'BTC', interval: '15m', limit: 1, includeDerivatives: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/fapi/v1/klines');
    expect(result.state).toBe('ACTIVE_READ_ONLY');
    expect(result.evidence.candles).toHaveLength(1);
    for (const field of ['order_book', 'funding', 'open_interest', 'long_short_ratio', 'liquidations']) {
      expect(result.evidence[field]).toBe('DADOS_INSUFICIENTES');
      expect(result.evidence.missing_fields).toContain(field);
    }
  });

  it('includeDerivatives:true (default) preserva o comportamento original — 5 chamadas de rede', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/fapi/v1/klines')) return jsonResponse(klinesPayload());
      if (url.includes('/fapi/v1/depth')) return jsonResponse({ bids: [['99', '1']], asks: [['101', '1']] });
      if (url.includes('/fapi/v1/premiumIndex')) return jsonResponse({ lastFundingRate: '0.0001', markPrice: '101' });
      if (url.includes('/fapi/v1/openInterest')) return jsonResponse({ openInterest: '12345' });
      if (url.includes('globalLongShortAccountRatio')) return jsonResponse([{ longShortRatio: '1.2', longAccount: '0.55', shortAccount: '0.45' }]);
      throw new Error(`URL inesperada no teste: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ symbol: 'BTC', interval: '15m', limit: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.evidence.order_book).not.toBe('DADOS_INSUFICIENTES');
    expect(result.evidence.funding).not.toBe('DADOS_INSUFICIENTES');
    expect(result.evidence.open_interest).not.toBe('DADOS_INSUFICIENTES');
    expect(result.evidence.long_short_ratio).not.toBe('DADOS_INSUFICIENTES');
  });

  it('falha de klines é fail-closed independente de includeDerivatives — nunca chega a decidir se pula as derivadas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ symbol: 'BTC', interval: '15m', limit: 1, includeDerivatives: false });

    expect(result.state).not.toBe('ACTIVE_READ_ONLY');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
