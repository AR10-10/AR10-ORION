// unified-snapshot-store.test.ts — V18 Sprint 1, Tarefa A. Testa a store
// Zustand+Immer real diretamente via getState()/setState() (sem precisar
// montar um componente React) — mesmo espírito do resto da suíte: lógica de
// dados, nunca UI.
import { describe, it, expect, beforeEach } from 'vitest';
import { useUnifiedSnapshotStore } from '../src/store/unified-snapshot-store';

const RESET = {
  symbol: 'BTC',
  price: { price: null, delta: null, deltaPct: null, high: null, low: null, volume: null, direction: null, updatedAt: null },
  orderBook: { bids: [], asks: [], updatedAt: null },
  derivatives: { fundingRate: null, openInterest: null },
  core: { engineStatus: 'pending' as const, direction: null, confidence: null, lastUpdateAt: null, cycleLatencyMs: null },
};

describe('unified-snapshot-store: boots fail-closed (nada fabricado antes do primeiro dado real)', () => {
  beforeEach(() => {
    useUnifiedSnapshotStore.setState(RESET);
  });

  it('estado inicial é honesto: preço/livro/funding/núcleo todos null/vazio, nunca um valor inventado', () => {
    const s = useUnifiedSnapshotStore.getState();
    expect(s.price.price).toBeNull();
    expect(s.orderBook.bids).toEqual([]);
    expect(s.derivatives.fundingRate).toBeNull();
    expect(s.core.engineStatus).toBe('pending');
    expect(s.core.confidence).toBeNull();
  });
});

describe('unified-snapshot-store: setters escrevem exatamente o dado real recebido, com updatedAt real', () => {
  beforeEach(() => {
    useUnifiedSnapshotStore.setState(RESET);
  });

  it('setPrice grava os campos reais e carimba updatedAt (nunca null após um dado real chegar)', () => {
    const before = Date.now();
    useUnifiedSnapshotStore.getState().setPrice({
      price: 65000, delta: 120, deltaPct: 0.18, high: 65500, low: 64200, volume: 12345, direction: 'LONG',
    });
    const s = useUnifiedSnapshotStore.getState();
    expect(s.price.price).toBe(65000);
    expect(s.price.direction).toBe('LONG');
    expect(s.price.updatedAt).not.toBeNull();
    expect(s.price.updatedAt!).toBeGreaterThanOrEqual(before);
  });

  it('setOrderBook grava bids/asks reais e carimba updatedAt', () => {
    useUnifiedSnapshotStore.getState().setOrderBook({
      bids: [{ price: 64990, size: 1.2 }],
      asks: [{ price: 65010, size: 0.8 }],
    });
    const s = useUnifiedSnapshotStore.getState();
    expect(s.orderBook.bids).toEqual([{ price: 64990, size: 1.2 }]);
    expect(s.orderBook.asks).toEqual([{ price: 65010, size: 0.8 }]);
    expect(s.orderBook.updatedAt).not.toBeNull();
  });

  it('setDerivatives grava exatamente o objeto recebido (sem timestamp — funding/OI já carregam sua própria idade em outro lugar)', () => {
    useUnifiedSnapshotStore.getState().setDerivatives({ fundingRate: 0.0001, openInterest: 98765 });
    expect(useUnifiedSnapshotStore.getState().derivatives).toEqual({ fundingRate: 0.0001, openInterest: 98765 });
  });

  it('setCore grava o estado real do motor (engineStatus/direção/confiança categórica), nunca um score inventado', () => {
    useUnifiedSnapshotStore.getState().setCore({
      engineStatus: 'ok', direction: 'SHORT', confidence: 'ALTA', lastUpdateAt: 1700000000000, cycleLatencyMs: 42,
    });
    const s = useUnifiedSnapshotStore.getState();
    expect(s.core).toEqual({
      engineStatus: 'ok', direction: 'SHORT', confidence: 'ALTA', lastUpdateAt: 1700000000000, cycleLatencyMs: 42,
    });
  });

  it('setSymbol troca o símbolo real sem tocar em nenhuma outra fatia', () => {
    useUnifiedSnapshotStore.getState().setPrice({
      price: 3000, delta: 0, deltaPct: 0, high: 3010, low: 2990, volume: 500, direction: null,
    });
    useUnifiedSnapshotStore.getState().setSymbol('ETH');
    const s = useUnifiedSnapshotStore.getState();
    expect(s.symbol).toBe('ETH');
    expect(s.price.price).toBe(3000); // outra fatia intacta
  });
});
