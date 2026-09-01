// pivot-points-fetch.test.ts — getPivotPoints (engine-bridge.ts): a fronteira
// de rede real que alimenta o motor puro pivot-points-engine.js. Mocka só o
// Bus (mesma convenção de engine-bridge-tradfi.test.ts), nunca reimplementa
// a lógica do Bus. Símbolos ÚNICOS por teste — o cache é module-level
// singleton keyed por symbol, então testes com símbolos diferentes nunca
// colidem (evita precisar de vi.resetModules a cada caso).
import { describe, it, expect, vi, afterEach } from 'vitest';

const requestSnapshotMock = vi.fn();

vi.mock('../../src/market-data-bus/index.js', () => ({
  getMarketDataBus: () => ({ requestSnapshot: requestSnapshotMock }),
  collectBinanceFuturesKlines: vi.fn(),
  collectMexcFuturesKlines: vi.fn(),
  collectTradfiDelayedKlines: vi.fn(),
}));

import { getPivotPoints } from '../src/engine-bridge';

const DIA_MS = 24 * 60 * 60_000;

function fakeSnapshot(candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>) {
  return { ok: true, candles, symbol: 'BTC-PERP', timeframe: '1d', asOf: Date.now(), fetchedAt: Date.now(), ageMs: 0, quality: 'EXCELENTE' };
}

// Flush do microtask pendente dentro do IIFE fire-and-forget de
// refreshPivotPointsInBackground — getPivotPoints é síncrono por contrato
// (nunca bloqueia o ciclo principal), então o teste precisa dar uma volta
// de macrotask pro `await requestFuturesCandleSnapshot(...)` resolver antes
// de conferir o resultado.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('getPivotPoints: síncrono com cache, dispara refresh em segundo plano', () => {
  afterEach(() => {
    requestSnapshotMock.mockReset();
  });

  it('primeira chamada: DADOS_INSUFICIENTES honesto (cache ainda vazio), nunca um pivot fabricado', () => {
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([]));
    const r = getPivotPoints('PRIMEIRA_CHAMADA');
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.pp).toBeNull();
  });

  it('só usa candle diário REALMENTE fechado (t + 24h <= agora), nunca o dia ainda em formação por posição no array', async () => {
    const agora = Date.now();
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([
      { t: agora - 2 * DIA_MS, o: 90, h: 95, l: 85, c: 92, v: 100 }, // anteontem, fechado
      { t: agora - 1 * DIA_MS, o: 100, h: 110, l: 90, c: 100, v: 100 }, // ontem, fechado (é ESTE que vale)
      { t: agora - 1000, o: 9999, h: 9999, l: 9999, c: 9999, v: 1 }, // hoje, EM FORMAÇÃO — nunca deve entrar
    ]));
    getPivotPoints('SIMBOLO_FILTRO_TEMPO');
    await flush();
    const r = getPivotPoints('SIMBOLO_FILTRO_TEMPO');
    expect(r.status).toBe('OK');
    // PP de ontem: (110+90+100)/3 = 100 — se o dia em formação (9999) tivesse
    // vazado, o PP explodiria para um valor absurdo.
    expect(r.pp).toBeCloseTo(100, 6);
  });

  it('pede ao Bus timeframe 1d, símbolo-PERP, via requestFuturesCandleSnapshot', async () => {
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([]));
    getPivotPoints('SIMBOLO_REQUISICAO');
    await flush();
    expect(requestSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'SIMBOLO_REQUISICAO-PERP', timeframe: '1d', collect: expect.any(Function) }),
    );
  });

  it('snapshot.ok:false => DADOS_INSUFICIENTES honesto, nunca pivots de um snapshot ruim', async () => {
    requestSnapshotMock.mockResolvedValue({ ok: false, candles: [], symbol: 'X-PERP', timeframe: '1d', asOf: null, fetchedAt: Date.now(), ageMs: null, quality: 'DADOS_INSUFICIENTES' });
    getPivotPoints('SIMBOLO_FALHA');
    await flush();
    const r = getPivotPoints('SIMBOLO_FALHA');
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });

  it('sem NENHUM dia realmente fechado na janela (só o dia em formação) => DADOS_INSUFICIENTES, nunca usa o dia incompleto', async () => {
    const agora = Date.now();
    requestSnapshotMock.mockResolvedValue(fakeSnapshot([
      { t: agora - 1000, o: 100, h: 105, l: 95, c: 102, v: 10 }, // só hoje, ainda em formação
    ]));
    getPivotPoints('SIMBOLO_SO_HOJE');
    await flush();
    const r = getPivotPoints('SIMBOLO_SO_HOJE');
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });

  it('rede lançando exceção real => DADOS_INSUFICIENTES honesto, nunca propaga e quebra o chamador síncrono', async () => {
    requestSnapshotMock.mockRejectedValue(new Error('rede fora'));
    expect(() => getPivotPoints('SIMBOLO_EXCECAO')).not.toThrow();
    await flush();
    const r = getPivotPoints('SIMBOLO_EXCECAO');
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });
});
