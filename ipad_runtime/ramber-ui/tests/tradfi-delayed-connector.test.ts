// tradfi-delayed-connector.test.ts — irmão direto de binance-futures-
// candle-connector.test.ts/mexc-futures-candle-connector.test.ts: mocka só
// a fronteira de rede (tradfi-delayed-yahoo.js), exercita a lógica REAL de
// resolução de instrumento (instrument-registry.js, sem mock — é puro) e
// de propagação de erro do conector Bus-facing.
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../js/real-data/tradfi-delayed-yahoo.js', () => ({
  probe: vi.fn(),
}));

import { probe } from '../../js/real-data/tradfi-delayed-yahoo.js';
import { collectTradfiDelayedKlines } from '../../src/market-data-bus/tradfi-delayed-connector.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';

const mockedProbe = probe as unknown as ReturnType<typeof vi.fn>;

function fakeCandles() {
  return [{ t: 1_700_000_000, o: 4500, h: 4505, l: 4495, c: 4502, v: 1000 }];
}

describe('tradfi-delayed-connector: resolve symbol via instrument-registry.js real (nunca monta um símbolo Yahoo à mão)', () => {
  afterEach(() => {
    mockedProbe.mockReset();
  });

  it('symbol="CME_ES" (instrument_id) resolve para yahooSymbol="ES=F" e symbolLabel="CME_ES"', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectTradfiDelayedKlines({ symbol: 'CME_ES', timeframe: '1h', limit: 100 });
    expect(mockedProbe).toHaveBeenCalledWith({ yahooSymbol: 'ES=F', symbolLabel: 'CME_ES', timeframe: '1h', limit: 100, endTimeMs: undefined });
  });

  it('symbol="NQ" (contract_code puro, por conveniência) resolve pro mesmo instrumento (CME_NQ / NQ=F)', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectTradfiDelayedKlines({ symbol: 'NQ', timeframe: '15m', limit: 50 });
    expect(mockedProbe).toHaveBeenCalledWith({ yahooSymbol: 'NQ=F', symbolLabel: 'CME_NQ', timeframe: '15m', limit: 50, endTimeMs: undefined });
  });

  it('endTime (epoch ms, mesma semântica dos conectores irmãos) é repassado como endTimeMs', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles: fakeCandles() } });
    await collectTradfiDelayedKlines({ symbol: 'CME_GC', timeframe: '1d', limit: 30, endTime: 1_700_000_000_123 });
    expect(mockedProbe.mock.calls[0][0].endTimeMs).toBe(1_700_000_000_123);
  });

  it('símbolo desconhecido no catálogo => lança fail-closed, ZERO chamada a probe() (nunca adivinha um símbolo Yahoo)', async () => {
    await expect(
      collectTradfiDelayedKlines({ symbol: 'NAO_EXISTE_NO_CATALOGO', timeframe: '1h', limit: 100 }),
    ).rejects.toThrow(/conector_tradfi_delayed_instrumento_desconhecido:NAO_EXISTE_NO_CATALOGO/);
    expect(mockedProbe).not.toHaveBeenCalled();
  });

  it('instrumento real mas SEM continuous_symbol_hint cadastrado (ex. CME_BTC, futuro CME distinto do perpétuo Binance) => lança fail-closed, zero chamada a probe()', async () => {
    await expect(
      collectTradfiDelayedKlines({ symbol: 'CME_BTC', timeframe: '1h', limit: 100 }),
    ).rejects.toThrow(/conector_tradfi_delayed_sem_simbolo_continuo_cadastrado:CME_BTC/);
    expect(mockedProbe).not.toHaveBeenCalled();
  });

  it('devolve os candles reais da evidência quando o estado é ACTIVE_READ_ONLY', async () => {
    const candles = fakeCandles();
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence: { candles } });
    const result = await collectTradfiDelayedKlines({ symbol: 'CME_ES', timeframe: '1h', limit: 100 });
    expect(result).toBe(candles);
  });

  it('lança um erro honesto (nunca candles fabricados) quando o estado real não é ACTIVE_READ_ONLY, incluindo o motivo real', async () => {
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.DADOS_INSUFICIENTES, evidence: { candles: 'DADOS_INSUFICIENTES' }, reason: 'timeframe_nao_suportado_por_esta_fonte:4h' });
    await expect(
      collectTradfiDelayedKlines({ symbol: 'CME_ES', timeframe: '4h', limit: 100 }),
    ).rejects.toThrow(/conector_tradfi_delayed_estado:DADOS_INSUFICIENTES:timeframe_nao_suportado_por_esta_fonte:4h/);
  });

  it('returnEvidence:true devolve o Evidence Object completo; o default continua devolvendo só o array de candles', async () => {
    const evidence = { candles: fakeCandles(), fetched_at: '2026-08-05T00:00:00.000Z', source_id: 'tradfi-delayed-yahoo-adapter' };
    mockedProbe.mockResolvedValue({ state: CONNECTOR_STATES.ACTIVE_READ_ONLY, evidence });
    const withEvidence = await collectTradfiDelayedKlines({ symbol: 'CME_ES', timeframe: '1h', limit: 100, returnEvidence: true });
    expect(withEvidence).toBe(evidence);
    const withoutEvidence = await collectTradfiDelayedKlines({ symbol: 'CME_ES', timeframe: '1h', limit: 100 });
    expect(withoutEvidence).toBe(evidence.candles);
  });
});
