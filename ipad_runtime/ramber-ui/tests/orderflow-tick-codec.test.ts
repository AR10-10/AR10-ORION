// orderflow-tick-codec.test.ts — Fase I (Zero-Copy, diretriz 3): o codec
// que substitui o clone de N objetos Tick por 1 Float64Array transferido
// na fronteira main-thread↔orderflow-worker. Importa os módulos REAIS —
// os Ticks reconstruídos são instâncias da MESMA classe congelada de
// src/orderflow/value-objects.js que o RingBuffer/signal-engine sempre
// consumiram.
import { describe, it, expect } from 'vitest';
import { packTicks, unpackTicks, TICK_FIELDS } from '../../js/orderflow-tick-codec.js';
import { Tick, Side } from '../../src/orderflow/value-objects.js';

const tick = (timestamp: number, price: number, volume: number, side: string) =>
  new Tick({ timestamp, price, volume, side, exchange: 'MEXC_SPOT_LIVE' });

describe('tick-codec: roundtrip sem perda', () => {
  it('preserva timestamp/price/volume/side e a ORDEM do lote', () => {
    const batch = [
      tick(1_700_000_000_001, 50_000.5, 0.25, Side.BUY),
      tick(1_700_000_000_002, 50_001.25, 1.75, Side.SELL),
      tick(1_700_000_000_003, 49_999.75, 0.033, Side.BUY),
    ];
    const packed = packTicks(batch);
    expect(packed).toBeInstanceOf(Float64Array);
    expect(packed.length).toBe(batch.length * TICK_FIELDS);

    const out = unpackTicks(packed);
    expect(out).toHaveLength(3);
    out.forEach((t, i) => {
      expect(t.timestamp).toBe(batch[i].timestamp);
      expect(t.price).toBe(batch[i].price);
      expect(t.volume).toBe(batch[i].volume);
      expect(t.side).toBe(batch[i].side);
    });
  });

  it('os ticks reconstruídos são instâncias Tick REAIS e congeladas (mesma classe do engine)', () => {
    const out = unpackTicks(packTicks([tick(1, 100, 1, Side.SELL)]));
    expect(out[0]).toBeInstanceOf(Tick);
    expect(Object.isFrozen(out[0])).toBe(true);
    expect(out[0].side).toBe(Side.SELL);
  });

  it('o mapeamento de lado é o MESMO de Tick.toRingEntry (+1 BUY / −1 SELL)', () => {
    const buy = tick(1, 100, 1, Side.BUY);
    const sell = tick(2, 100, 1, Side.SELL);
    const packed = packTicks([buy, sell]);
    expect(packed[3]).toBe(buy.toRingEntry().sideFlag);
    expect(packed[7]).toBe(sell.toRingEntry().sideFlag);
  });
});

describe('tick-codec: bordas defensivas (nunca um tick inventado)', () => {
  it('lote vazio / entrada não-array => Float64Array vazio / lista vazia', () => {
    expect(packTicks([]).length).toBe(0);
    expect(unpackTicks(packTicks([]))).toEqual([]);
    expect(packTicks(null as any).length).toBe(0);
    expect(unpackTicks(null as any)).toEqual([]);
  });

  it('um resto de floats que não completa um tick é ignorado, nunca vira tick parcial', () => {
    const packed = packTicks([tick(1, 100, 1, Side.BUY)]);
    const truncated = packed.subarray(0, TICK_FIELDS + 2); // 1 tick + 2 floats órfãos
    const out = unpackTicks(truncated);
    expect(out).toHaveLength(1);
  });

  it('lote grande (500 ticks — o teto real do poller) roundtripa íntegro', () => {
    const batch = Array.from({ length: 500 }, (_, i) =>
      tick(1_700_000_000_000 + i, 50_000 + (i % 7) * 0.5, (i % 11) * 0.01 + 0.001, i % 3 === 0 ? Side.SELL : Side.BUY),
    );
    const out = unpackTicks(packTicks(batch));
    expect(out).toHaveLength(500);
    expect(out[499].timestamp).toBe(batch[499].timestamp);
    expect(out[499].side).toBe(batch[499].side);
  });
});
