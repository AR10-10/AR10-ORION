// nexus-l2-history.test.ts — V-MAX Fase 1.1: trava o ring de histórico L2
// real que o OrderFlowHeatmapPlugin vai consumir. Lógica pura, sem rede —
// mesmo espírito do resto da suíte.
import { describe, it, expect } from 'vitest';
import { maybeSampleL2History, L2_HISTORY_CAPACITY, type L2HistoryEntry } from '../src/nexus/l2-history';

const entry = (t: number, price = 100): L2HistoryEntry => ({
  time: t,
  bids: [{ price, size: 1 }],
  asks: [{ price: price + 1, size: 1 }],
});

describe('maybeSampleL2History: retém amostras reais na cadência certa, nunca fabrica uma entrada', () => {
  it('ring vazio sempre aceita a primeira entrada real', () => {
    const result = maybeSampleL2History([], entry(1000));
    expect(result).toEqual([entry(1000)]);
  });

  it('uma segunda atualização real chegando ANTES do intervalo é descartada do histórico (mesma referência do ring, não fabricada)', () => {
    const ring = maybeSampleL2History([], entry(1000), 2000);
    const result = maybeSampleL2History(ring, entry(1500), 2000); // só 500ms depois
    expect(result).toBe(ring); // mesma referência — nunca um novo array por nada
    expect(result).toHaveLength(1);
  });

  it('uma atualização real chegando exatamente no limite do intervalo é aceita', () => {
    const ring = maybeSampleL2History([], entry(1000), 2000);
    const result = maybeSampleL2History(ring, entry(3000), 2000); // exatamente +2000ms
    expect(result).toHaveLength(2);
  });

  it('uma atualização real após o intervalo é retida como nova amostra', () => {
    const ring = maybeSampleL2History([], entry(1000), 2000);
    const result = maybeSampleL2History(ring, entry(4000), 2000);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(entry(4000));
  });

  it('respeita o teto de capacidade real: entrada mais antiga cai, nunca acumula sem limite', () => {
    let ring: L2HistoryEntry[] = [];
    for (let i = 0; i < 5; i++) {
      ring = maybeSampleL2History(ring, entry(i * 2000), 2000, 3);
    }
    expect(ring).toHaveLength(3);
    expect(ring.map((e) => e.time)).toEqual([4000, 6000, 8000]);
  });

  it('usa o teto real (L2_HISTORY_CAPACITY) por padrão quando nenhum é passado', () => {
    let ring: L2HistoryEntry[] = [];
    for (let i = 0; i < L2_HISTORY_CAPACITY + 10; i++) {
      ring = maybeSampleL2History(ring, entry(i * 2000));
    }
    expect(ring).toHaveLength(L2_HISTORY_CAPACITY);
  });

  it('cada entrada no ring resultante é exatamente uma das entradas reais passadas — nunca um valor sintetizado no meio do caminho', () => {
    let ring: L2HistoryEntry[] = [];
    const real = [entry(0), entry(3000), entry(6000)];
    for (const e of real) ring = maybeSampleL2History(ring, e, 2000);
    ring.forEach((e) => expect(real).toContainEqual(e));
  });
});
