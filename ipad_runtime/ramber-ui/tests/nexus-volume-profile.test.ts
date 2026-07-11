// nexus-volume-profile.test.ts — V-MAX Fase 1.3: trava a camada pura de
// análise do Volume Profile (HVN/LVN por percentil real da distribuição
// observada, preço por bucket, recorte de sessão UTC). A matemática pesada
// do histograma é do WASM (wasm-quant-core.test.ts + paridade); aqui só a
// derivação leve.
import { describe, it, expect } from 'vitest';
import { detectHvnLvn, bucketMidPrice, filterSessionCandles } from '../src/nexus/volume-profile';

describe('detectHvnLvn: máximos/mínimos locais gated por percentil REAL da distribuição observada', () => {
  it('histograma curto demais (<3) devolve listas vazias honestas — sem vizinhança não há "local"', () => {
    expect(detectHvnLvn([])).toEqual({ hvn: [], lvn: [] });
    expect(detectHvnLvn([5])).toEqual({ hvn: [], lvn: [] });
    expect(detectHvnLvn([5, 9])).toEqual({ hvn: [], lvn: [] });
  });

  it('todo zero (nenhuma negociação) devolve vazio — vazio não é nó de nada', () => {
    expect(detectHvnLvn([0, 0, 0, 0])).toEqual({ hvn: [], lvn: [] });
  });

  it('pico local dominante vira HVN; vale local não-vazio vira LVN', () => {
    //           0   1    2   3   4    5   6
    const hist = [10, 30, 100, 30, 4, 30, 90];
    const { hvn, lvn } = detectHvnLvn(hist);
    expect(hvn).toContain(2); // 100: máximo local e topo da distribuição
    expect(lvn).toContain(4); // 4: mínimo local e piso da distribuição
  });

  it('máximo local fraco (abaixo do percentil 75 real) NÃO vira HVN — local sozinho não basta', () => {
    // 12 em i=1 é máximo local, mas a distribuição real tem 100/90/80 no topo.
    const hist = [10, 12, 10, 100, 90, 100, 80, 95, 100, 85];
    const { hvn } = detectHvnLvn(hist);
    expect(hvn).not.toContain(1);
  });

  it('buckets zerados nunca entram como LVN nem contaminam o percentil', () => {
    const hist = [0, 50, 20, 60, 0];
    const { lvn } = detectHvnLvn(hist);
    expect(lvn).not.toContain(0);
    expect(lvn).not.toContain(4);
  });

  it('platô perfeitamente plano não gera nó — sem forma local, sem sinal', () => {
    const hist = [50, 50, 50, 50, 50];
    const { hvn, lvn } = detectHvnLvn(hist);
    expect(hvn).toEqual([]);
    expect(lvn).toEqual([]);
  });
});

describe('bucketMidPrice: centro real do bucket na faixa real', () => {
  it('mapeia índice → preço central', () => {
    // faixa [100, 110] com 10 buckets: bucket 0 = [100,101] → centro 100.5
    expect(bucketMidPrice(0, 100, 110, 10)).toBeCloseTo(100.5, 10);
    expect(bucketMidPrice(9, 100, 110, 10)).toBeCloseTo(109.5, 10);
    expect(bucketMidPrice(4, 100, 110, 10)).toBeCloseTo(104.5, 10);
  });
});

describe('filterSessionCandles: sessão = desde a meia-noite UTC do dia do candle MAIS RECENTE', () => {
  const mk = (time: number) => ({ time });

  it('vazio permanece vazio', () => {
    expect(filterSessionCandles([])).toEqual([]);
  });

  it('corta candles do dia UTC anterior, mantém os do dia corrente do dado', () => {
    // 2026-07-10T23:45:00Z e 2026-07-11T00:15:00Z / 01:00:00Z
    const prev = Math.floor(Date.UTC(2026, 6, 10, 23, 45) / 1000);
    const after1 = Math.floor(Date.UTC(2026, 6, 11, 0, 15) / 1000);
    const after2 = Math.floor(Date.UTC(2026, 6, 11, 1, 0) / 1000);
    const out = filterSessionCandles([mk(prev), mk(after1), mk(after2)]);
    expect(out.map((c) => c.time)).toEqual([after1, after2]);
  });

  it('candle exatamente na meia-noite UTC pertence à sessão corrente', () => {
    const midnight = Math.floor(Date.UTC(2026, 6, 11, 0, 0) / 1000);
    const later = Math.floor(Date.UTC(2026, 6, 11, 2, 0) / 1000);
    const out = filterSessionCandles([mk(midnight), mk(later)]);
    expect(out).toHaveLength(2);
  });

  it('a fronteira vem do dia UTC do ÚLTIMO candle (o "hoje" do dado, não o relógio local)', () => {
    // Todos os candles de um dia antigo: nada é cortado — a sessão é a do dado.
    const d1 = Math.floor(Date.UTC(2026, 5, 1, 10, 0) / 1000);
    const d2 = Math.floor(Date.UTC(2026, 5, 1, 11, 0) / 1000);
    expect(filterSessionCandles([mk(d1), mk(d2)])).toHaveLength(2);
  });
});
