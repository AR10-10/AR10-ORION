// nexus-candles-cache.test.ts — DIRETRIZES AVANÇADAS (auditoria de
// ecossistema): trava por execução real o teto de memória de
// touchCandlesSymbol — LRU real por ordem de inserção, nunca acumula
// símbolos sem limite.
import { describe, it, expect } from 'vitest';
import { touchCandlesSymbol, CANDLES_SYMBOL_CAPACITY } from '../src/nexus/candles-cache';

describe('touchCandlesSymbol: LRU real por símbolo, nunca acumula sem teto', () => {
  it('símbolo novo dentro da capacidade é só adicionado, nada é despejado', () => {
    const next = touchCandlesSymbol({ BTC: 1, ETH: 2 }, 'SOL', 3, 5);
    expect(next).toEqual({ BTC: 1, ETH: 2, SOL: 3 });
  });

  it('reescrever um símbolo já existente atualiza o valor e o move pro fim (mais recente)', () => {
    const before = { BTC: 1, ETH: 2, SOL: 3 };
    const next = touchCandlesSymbol(before, 'BTC', 99, 5);
    expect(Object.keys(next)).toEqual(['ETH', 'SOL', 'BTC']); // BTC saiu do início, voltou no fim
    expect(next.BTC).toBe(99);
  });

  it('exceder a capacidade real despeja exatamente o símbolo menos recentemente tocado', () => {
    const before = { BTC: 1, ETH: 2, SOL: 3 };
    const next = touchCandlesSymbol(before, 'BNB', 4, 3); // capacidade 3, 4 chaves ficaria acima
    expect(Object.keys(next)).toEqual(['ETH', 'SOL', 'BNB']); // BTC (o mais antigo, nunca tocado de novo) foi despejado
    expect(next.BTC).toBeUndefined();
  });

  it('tocar um símbolo já existente na capacidade máxima nunca despeja ele mesmo (LRU real, não FIFO cego)', () => {
    const before = { BTC: 1, ETH: 2, SOL: 3 };
    const next = touchCandlesSymbol(before, 'BTC', 99, 3); // BTC é o mais antigo, mas foi TOCADO agora
    expect(Object.keys(next)).toEqual(['ETH', 'SOL', 'BTC']);
    expect(next.BTC).toBe(99); // sobrevive — LRU real despejaria ETH na próxima escrita, nunca BTC agora
  });

  it('CANDLES_SYMBOL_CAPACITY é o tamanho real do universo curado (ASSETS, App.tsx) — 12', () => {
    expect(CANDLES_SYMBOL_CAPACITY).toBe(12);
  });

  it('nunca cresce além do teto mesmo com muitos símbolos distintos em sequência', () => {
    let state: Record<string, number> = {};
    const symbols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
    for (const s of symbols) {
      state = touchCandlesSymbol(state, s, 1, 5);
    }
    expect(Object.keys(state).length).toBe(5);
    expect(Object.keys(state)).toEqual(['K', 'L', 'M', 'N', 'O']); // só os 5 últimos sobrevivem
  });
});
