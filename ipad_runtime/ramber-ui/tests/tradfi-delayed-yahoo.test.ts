// tradfi-delayed-yahoo.test.ts — sonda real de candles TradFi (Ordem Market
// Data Fabric, Fase 1). Mocka só fetch() — mesma convenção exata de
// binance-futures-public.test.ts/mexc-futures-public.test.ts (probe.js REAL
// nunca substituído). Fixture no formato columnar documentado publicamente
// da Yahoo chart API (chart.result[0].timestamp + .indicators.quote[0].
// {open,high,low,close,volume}), incluindo o buraco real (null) que a
// própria fonte produz nas janelas em que o mercado de futuro estava
// fechado — nunca um valor inventado para preencher esse buraco.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probe, resolveYahooInterval, buildChartUrl } from '../../js/real-data/tradfi-delayed-yahoo.js';
import { DATA_FRESHNESS, NAO_APLICAVEL, DADOS_INSUFICIENTES } from '../../js/real-data/schema.js';

function chartPayload(rows: Array<{ t: number; o: number | null; h: number | null; l: number | null; c: number | null; v: number | null }>) {
  return {
    chart: {
      result: [{
        meta: { symbol: 'ES=F' },
        timestamp: rows.map((r) => r.t),
        indicators: { quote: [{ open: rows.map((r) => r.o), high: rows.map((r) => r.h), low: rows.map((r) => r.l), close: rows.map((r) => r.c), volume: rows.map((r) => r.v) }] },
      }],
      error: null,
    },
  };
}

function realCandleRow(t: number, base: number) {
  return { t, o: base, h: base + 1, l: base - 1, c: base + 0.5, v: 1000 };
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
}

describe('resolveYahooInterval/buildChartUrl: mapeamento real de timeframe (funções puras)', () => {
  it('mapeia os timeframes que a Yahoo chart API realmente aceita', () => {
    expect(resolveYahooInterval('1h')).toBe('60m');
    expect(resolveYahooInterval('15m')).toBe('15m');
    expect(resolveYahooInterval('1d')).toBe('1d');
    expect(resolveYahooInterval('1w')).toBe('1wk');
  });

  it('"4h" não é suportado por esta fonte — null explícito, nunca aproximado para 1h/1d', () => {
    expect(resolveYahooInterval('4h')).toBeNull();
  });

  it('buildChartUrl monta period1/period2 reais em segundos (nunca ms) a partir de endTimeMs', () => {
    const url = new URL(buildChartUrl({ yahooSymbol: 'GC=F', yahooInterval: '1d', limit: 10, endTimeMs: 1_700_000_000_000 }));
    expect(decodeURIComponent(url.pathname)).toContain('GC=F');
    expect(url.searchParams.get('interval')).toBe('1d');
    expect(url.searchParams.get('period2')).toBe('1700000000');
    expect(Number(url.searchParams.get('period1'))).toBeLessThan(1_700_000_000);
  });
});

describe('tradfi-delayed-yahoo probe(): fail-closed honesto ANTES de qualquer chamada de rede', () => {
  it('timeframe não suportado (ex. "4h") => DADOS_INSUFICIENTES, zero fetch() disparado', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await probe({ yahooSymbol: 'ES=F', symbolLabel: 'CME_ES', timeframe: '4h' });
    expect(result.state).toBe(DADOS_INSUFICIENTES);
    expect(result.reason).toContain('timeframe_nao_suportado_por_esta_fonte');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sem yahooSymbol (instrumento sem continuous_symbol_hint, ex. CME_BTC/SR3) => DADOS_INSUFICIENTES, zero fetch()', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await probe({ yahooSymbol: null as unknown as string, symbolLabel: 'CME_BTC', timeframe: '1h' });
    expect(result.state).toBe(DADOS_INSUFICIENTES);
    expect(result.reason).toContain('sem_continuous_symbol_hint');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('tradfi-delayed-yahoo probe(): caminho real de sucesso', () => {
  beforeEach(() => {
    vi.stubGlobal('self', globalThis);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resposta real e completa => ACTIVE_READ_ONLY, candles extraídos, DATA_FRESHNESS.DELAYED, NAO_APLICAVEL/DADOS_INSUFICIENTES corretos', async () => {
    const rows = [realCandleRow(1_700_000_000, 4500), realCandleRow(1_700_003_600, 4505), realCandleRow(1_700_007_200, 4510)];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(chartPayload(rows)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ yahooSymbol: 'ES=F', symbolLabel: 'CME_ES', timeframe: '1h', limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('interval=60m');
    expect(result.state).toBe('ACTIVE_READ_ONLY');
    expect(result.evidence.candles).toEqual([
      { t: 1_700_000_000, o: 4500, h: 4501, l: 4499, c: 4500.5, v: 1000 },
      { t: 1_700_003_600, o: 4505, h: 4506, l: 4504, c: 4505.5, v: 1000 },
      { t: 1_700_007_200, o: 4510, h: 4511, l: 4509, c: 4510.5, v: 1000 },
    ]);
    expect(result.evidence.data_freshness).toBe(DATA_FRESHNESS.DELAYED);
    expect(result.evidence.symbol).toBe('CME_ES');
    expect(result.evidence.instrument_type).toBe('tradfi_futures');
    expect(result.evidence.funding).toBe(NAO_APLICAVEL);
    expect(result.evidence.liquidations).toBe(NAO_APLICAVEL);
    expect(result.evidence.long_short_ratio).toBe(NAO_APLICAVEL);
    expect(result.evidence.open_interest).toBe(DADOS_INSUFICIENTES);
    expect(result.evidence.order_book).toBe(DADOS_INSUFICIENTES);
    expect(result.evidence.missing_fields).toEqual(expect.arrayContaining(['open_interest', 'order_book']));
    expect(result.evidence.raw_sample_hash).not.toBe(DADOS_INSUFICIENTES);
  });

  it('linhas com OHLC null (sessão fechada, buraco real da própria fonte) são descartadas, nunca preenchidas', async () => {
    const rows = [
      realCandleRow(1_700_000_000, 4500),
      { t: 1_700_003_600, o: null, h: null, l: null, c: null, v: null }, // mercado fechado nesta janela
      realCandleRow(1_700_007_200, 4510),
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(chartPayload(rows)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ yahooSymbol: 'ES=F', symbolLabel: 'CME_ES', timeframe: '1h' });
    expect(result.state).toBe('ACTIVE_READ_ONLY');
    expect(result.evidence.candles).toHaveLength(2);
    expect(result.evidence.candles.map((c: { t: number }) => c.t)).toEqual([1_700_000_000, 1_700_007_200]);
  });

  it('volume ausente/não-finito descarta a linha inteira (mesma disciplina de normalizeCandles — nunca fabrica v:0)', async () => {
    const rows = [realCandleRow(1_700_000_000, 4500), { ...realCandleRow(1_700_003_600, 4505), v: null }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(chartPayload(rows)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ yahooSymbol: 'ES=F', symbolLabel: 'CME_ES', timeframe: '1h' });
    expect(result.evidence.candles).toHaveLength(1);
  });

  it('mais candles reais na janela do que `limit` => corta para os `limit` MAIS RECENTES (contrato ~limit vale pra qualquer fonte)', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => realCandleRow(1_700_000_000 + i * 3600, 4500 + i));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(chartPayload(rows)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ yahooSymbol: 'ES=F', symbolLabel: 'CME_ES', timeframe: '1h', limit: 5 });
    expect(result.evidence.candles).toHaveLength(5);
    expect(result.evidence.candles[4].t).toBe(rows[29].t); // o mais recente é preservado
    expect(result.evidence.candles[0].t).toBe(rows[25].t); // os 5 últimos, não os 5 primeiros
  });

  it('todas as linhas descartadas (resposta tecnicamente válida mas vazia de dado utilizável) => DADOS_INSUFICIENTES honesto, nunca ACTIVE_READ_ONLY com candles:[]', async () => {
    const rows = [{ t: 1_700_000_000, o: null, h: null, l: null, c: null, v: null }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(chartPayload(rows)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probe({ yahooSymbol: 'ES=F', symbolLabel: 'CME_ES', timeframe: '1h' });
    expect(result.state).toBe(DADOS_INSUFICIENTES);
  });
});

describe('tradfi-delayed-yahoo probe(): fail-closed real quando a fonte falha (mesmo probe.js, mesma classificação honesta)', () => {
  beforeEach(() => {
    vi.stubGlobal('self', globalThis);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('HTTP 500 real => estado não-ACTIVE_READ_ONLY, nunca candles fabricados', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    const result = await probe({ yahooSymbol: 'ES=F', symbolLabel: 'CME_ES', timeframe: '1h' });
    expect(result.state).not.toBe('ACTIVE_READ_ONLY');
    expect(result.evidence.candles).toBe(DADOS_INSUFICIENTES);
  });

  it('resposta com schema inesperado (sem chart.result) => BLOCKED_BY_SCHEMA honesto, não finge sucesso', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ chart: { result: null, error: { code: 'Not Found' } } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await probe({ yahooSymbol: 'ZZ=F', symbolLabel: 'CME_ZZ', timeframe: '1h' });
    expect(result.state).toBe('BLOCKED_BY_SCHEMA');
  });
});
