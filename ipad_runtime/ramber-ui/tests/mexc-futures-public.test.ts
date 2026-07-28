// mexc-futures-public.test.ts — ADITIVO V-MAX Etapa 1 (Market Data
// Adapter): trava o parsing real do schema MEXC Contract (objeto de
// arrays paralelos, `time` em SEGUNDOS — assimetria real documentada no
// header do módulo, distinta do array-de-arrays da Binance) e o
// mapeamento de timeframe → enum MEXC (Min15/Hour4/...). Mocka só
// fetch() — mesma convenção de binance-futures-public.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probe } from '../../js/real-data/mexc-futures-public.js';

function klinesPayload(overrides: Partial<Record<'time' | 'open' | 'high' | 'low' | 'close' | 'vol', unknown[]>> = {}) {
  return {
    success: true,
    code: 0,
    data: {
      time: [1700000000, 1700000900],
      open: ['100', '102'],
      high: ['105', '106'],
      low: ['95', '101'],
      close: ['102', '104'],
      vol: ['10', '12'],
      amount: ['1000', '1200'],
      ...overrides,
    },
  };
}

function jsonResponse(body: unknown) {
  return { ok: true, text: async () => JSON.stringify(body), json: async () => body };
}

describe('mexc-futures-public: schema real (objeto de arrays paralelos, time em segundos)', () => {
  beforeEach(() => {
    vi.stubGlobal('self', globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parseia data.{time,open,high,low,close,vol} em candles {t,o,h,l,c,v} — t continua em segundos, nunca reescalado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(klinesPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ symbol: 'BTC', interval: '15m', limit: 10 });

    expect(result.state).toBe('ACTIVE_READ_ONLY');
    expect(result.evidence.candles).toEqual([
      { t: 1700000000, o: 100, h: 105, l: 95, c: 102, v: 10 },
      { t: 1700000900, o: 102, h: 106, l: 101, c: 104, v: 12 },
    ]);
  });

  it('símbolo BTC vira BTC_USDT (underscore) na URL real, mesma convenção de cross-exchange/mexc-futures.ts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(klinesPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await probe({ symbol: 'BTC', interval: '15m', limit: 10 });

    expect(fetchMock.mock.calls[0][0]).toContain('/contract/kline/BTC_USDT');
  });

  it('interval "15m" mapeia para o enum real MEXC "Min15" — nunca o valor cru do resto do app', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(klinesPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await probe({ symbol: 'BTC', interval: '15m', limit: 10 });

    expect(fetchMock.mock.calls[0][0]).toContain('interval=Min15');
  });

  it('interval "4h" mapeia para "Hour4" — mesma tabela cobre os timeframes reais do app, não só os de teste', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(klinesPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await probe({ symbol: 'BTC', interval: '4h', limit: 10 });

    expect(fetchMock.mock.calls[0][0]).toContain('interval=Hour4');
  });

  it('timeframe sem mapeamento real falha fechado (BLOCKED_BY_SCHEMA) — nunca adivinha um enum que não existe, zero chamada de rede', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ symbol: 'BTC', interval: '2h', limit: 10 });

    expect(result.state).toBe('BLOCKED_BY_SCHEMA');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('limit corta do lado mais recente (a MEXC não tem parâmetro `limit` documentado, só start/end)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(klinesPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ symbol: 'BTC', interval: '15m', limit: 1 });

    expect(result.evidence.candles).toHaveLength(1);
    expect(result.evidence.candles[0].t).toBe(1700000900); // o mais recente dos 2, nunca o mais antigo
  });

  it('endTime real (epoch ms) vira o parâmetro `end` (ms, documentado) na URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(klinesPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await probe({ symbol: 'BTC', interval: '15m', limit: 10, endTime: 1700000900123 });

    expect(fetchMock.mock.calls[0][0]).toContain('&end=1700000900123');
  });

  it('resposta com success:false falha fechado — nunca tenta ler data mesmo assim', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: false, code: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ symbol: 'BTC', interval: '15m', limit: 10 });

    expect(result.state).not.toBe('ACTIVE_READ_ONLY');
  });

  it('arrays paralelos com tamanhos diferentes (schema real diferente do esperado) falha fechado, nunca zip parcial silencioso', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(klinesPayload({ open: ['100'] })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ symbol: 'BTC', interval: '15m', limit: 10 });

    expect(result.state).toBe('BLOCKED_BY_SCHEMA');
  });

  it('falha de rede/HTTP é fail-closed, mesmo vocabulário CONNECTOR_STATES do resto do Real Data Layer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ symbol: 'BTC', interval: '15m', limit: 10 });

    expect(result.state).not.toBe('ACTIVE_READ_ONLY');
  });
});
