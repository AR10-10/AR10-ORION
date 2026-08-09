// mexc-trades-stream.test.ts — trava o bug real corrigido em tradesToTicks()
// (Number(null) === 0 fabricando um Tick com price/timestamp/volume=0 a
// partir de um campo ausente/malformado numa linha real da API MEXC).
// Mesma classe de bug e mesmo padrao de correcao (toFiniteOrNull) ja
// travado em tradfi-delayed-yahoo.test.ts para o conector Yahoo — execucao
// real das funcoes puras, zero rede (tradesToTicks/filterNewTrades/
// validateTradesShape nao chamam fetch).
import { describe, it, expect, vi } from 'vitest';
import { tradesToTicks, filterNewTrades, validateTradesShape, createLivePoller } from '../../js/real-data/mexc-trades-stream.js';
import { Side } from '../../src/orderflow/value-objects.js';

describe('tradesToTicks: linhas reais e validas viram Tick[] correto, ordenado por tempo', () => {
  it('mapeia price/qty/time/isBuyerMaker reais para Tick com side correto', () => {
    const rows = [
      { price: '50000.5', qty: '0.01', time: 1_700_000_000_000, isBuyerMaker: false },
      { price: '50001.0', qty: '0.02', time: 1_700_000_001_000, isBuyerMaker: true },
    ];
    const ticks = tradesToTicks(rows, 'MEXC_SPOT_LIVE');
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toMatchObject({ timestamp: 1_700_000_000_000, price: 50000.5, volume: 0.01, side: Side.BUY, exchange: 'MEXC_SPOT_LIVE' });
    expect(ticks[1]).toMatchObject({ timestamp: 1_700_000_001_000, price: 50001.0, volume: 0.02, side: Side.SELL, exchange: 'MEXC_SPOT_LIVE' });
  });

  it('ordena por tempo ascendente mesmo quando a resposta real chega fora de ordem', () => {
    const rows = [
      { price: '2', qty: '1', time: 200, isBuyerMaker: false },
      { price: '1', qty: '1', time: 100, isBuyerMaker: false },
    ];
    const ticks = tradesToTicks(rows);
    expect(ticks.map((t) => t.timestamp)).toEqual([100, 200]);
  });

  it('exchange default permanece MEXC_SPOT_LIVE quando o chamador nao informa', () => {
    const ticks = tradesToTicks([{ price: '1', qty: '1', time: 1, isBuyerMaker: false }]);
    expect(ticks[0].exchange).toBe('MEXC_SPOT_LIVE');
  });
});

describe('tradesToTicks: BUG REAL evitado — Number(null)===0 nunca fabrica um tick com campo zerado', () => {
  it('price null (campo real ausente/malformado) descarta a linha inteira, nunca vira price:0', () => {
    const rows = [
      { price: null, qty: '1', time: 100, isBuyerMaker: false },
      { price: '1', qty: '1', time: 200, isBuyerMaker: false },
    ];
    const ticks = tradesToTicks(rows);
    expect(ticks).toHaveLength(1);
    expect(ticks[0].timestamp).toBe(200);
  });

  it('time undefined descarta a linha inteira, nunca vira timestamp:0', () => {
    const rows = [
      { price: '1', qty: '1', time: undefined, isBuyerMaker: false },
      { price: '1', qty: '1', time: 200, isBuyerMaker: false },
    ];
    const ticks = tradesToTicks(rows);
    expect(ticks).toHaveLength(1);
  });

  it('qty ausente descarta a linha inteira, nunca vira volume:0', () => {
    const rows = [
      { price: '1', time: 100, isBuyerMaker: false },
      { price: '1', qty: '1', time: 200, isBuyerMaker: false },
    ];
    const ticks = tradesToTicks(rows as never);
    expect(ticks).toHaveLength(1);
  });

  it('price nao-numerico (string lixo) descarta a linha, nao vira NaN nem 0', () => {
    const rows = [
      { price: 'abc', qty: '1', time: 100, isBuyerMaker: false },
      { price: '1', qty: '1', time: 200, isBuyerMaker: false },
    ];
    const ticks = tradesToTicks(rows);
    expect(ticks).toHaveLength(1);
  });

  it('volume negativo (dado real impossivel) e descartado — nunca um Tick com volume<0', () => {
    const rows = [
      { price: '1', qty: '-5', time: 100, isBuyerMaker: false },
      { price: '1', qty: '1', time: 200, isBuyerMaker: false },
    ];
    const ticks = tradesToTicks(rows);
    expect(ticks).toHaveLength(1);
    expect(ticks[0].timestamp).toBe(200);
  });

  it('linhas todas malformadas => [] honesto, nunca ticks fabricados', () => {
    const rows = [
      { price: null, qty: '1', time: 100, isBuyerMaker: false },
      { price: '1', qty: null, time: 200, isBuyerMaker: true },
      { price: '1', qty: '1', time: null, isBuyerMaker: false },
    ];
    expect(tradesToTicks(rows)).toEqual([]);
  });
});

describe('validateTradesShape: fail-closed sobre a forma real da resposta', () => {
  it('array de objetos com os 4 campos esperados => valido', () => {
    expect(validateTradesShape([{ price: '1', qty: '1', time: 1, isBuyerMaker: false }])).toEqual({ valid: true });
  });

  it('nao-array, array vazio ou item sem os campos esperados => invalido com motivo', () => {
    expect(validateTradesShape(null).valid).toBe(false);
    expect(validateTradesShape([]).valid).toBe(false);
    expect(validateTradesShape([{ price: '1' }]).valid).toBe(false);
  });
});

describe('filterNewTrades: dedup real entre ciclos de polling', () => {
  it('lastTradeId=null (primeiro ciclo) admite a janela inteira', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    expect(filterNewTrades(rows, null)).toEqual(rows);
  });

  it('so retorna linhas com id estritamente maior que lastTradeId', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(filterNewTrades(rows, 2)).toEqual([{ id: 3 }]);
  });
});

describe('createLivePoller: BUG real corrigido — cycle() sem catch produzia unhandledrejection real a cada ciclo', () => {
  it('se onResult lança (bug do código chamador), start() não deixa a rejeição escapar sem tratamento (mesmo padrão de gmil-orchestrator.js)', async () => {
    const rows = [{ price: '1', qty: '1', time: 1, isBuyerMaker: false, id: 1 }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(rows), json: async () => rows });
    vi.stubGlobal('fetch', fetchMock);

    const unhandled: unknown[] = [];
    const onUnhandled = (err: unknown) => unhandled.push(err);
    process.on('unhandledRejection', onUnhandled);

    const poller = createLivePoller({
      symbol: 'BTC',
      intervalMs: 100_000, // longo o bastante para não disparar um 2º ciclo durante o teste
      onResult: () => {
        throw new Error('bug proposital do código chamador');
      },
    });
    poller.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    poller.stop();

    process.off('unhandledRejection', onUnhandled);
    vi.unstubAllGlobals();
    expect(unhandled).toEqual([]);
  });
});
