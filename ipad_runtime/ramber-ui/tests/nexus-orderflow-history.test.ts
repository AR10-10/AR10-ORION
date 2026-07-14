// nexus-orderflow-history.test.ts — V-MAX Fase 1.2: trava a detecção real
// de trades grandes (percentil real da amostra observada, nunca um limiar
// fixo) e o ring de histórico CVD+bolhas. Lógica pura, sem rede.
import { describe, it, expect } from 'vitest';
import {
  computeLargeTradeThreshold,
  ingestTradesForLargeDetection,
  pushOrderflowHistory,
  computeOrderflowTrend,
  EMPTY_THRESHOLD_STATE,
  ORDERFLOW_HISTORY_CAPACITY,
  type OrderflowTrade,
  type OrderflowHistoryEntry,
} from '../src/nexus/orderflow-history';

const trade = (volume: number, t = 1000, side: 'BUY' | 'SELL' = 'BUY'): OrderflowTrade => ({
  time: t, price: 100, volume, side,
});

describe('computeLargeTradeThreshold: percentil real da amostra observada, nunca um número fixo', () => {
  it('devolve null honesto com amostra curta demais — nunca um limiar de exemplo', () => {
    const small = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(computeLargeTradeThreshold(small)).toBeNull();
  });

  it('com amostra suficiente, devolve um valor real presente na própria amostra (percentil ~90)', () => {
    const volumes = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    const threshold = computeLargeTradeThreshold(volumes);
    expect(threshold).not.toBeNull();
    expect(volumes).toContain(threshold); // sempre um valor REAL da amostra, nunca interpolado/sintetizado
    expect(threshold).toBeGreaterThanOrEqual(89);
    expect(threshold).toBeLessThanOrEqual(91);
  });

  it('amostra toda igual devolve esse mesmo valor real (nunca quebra em caso degenerado)', () => {
    const volumes = Array.from({ length: 50 }, () => 5);
    expect(computeLargeTradeThreshold(volumes)).toBe(5);
  });
});

describe('ingestTradesForLargeDetection: um trade nunca influencia o próprio julgamento de significância', () => {
  it('sem amostra suficiente ainda, nenhum trade é marcado grande — nunca um chute antes de dado real', () => {
    const { large } = ingestTradesForLargeDetection(EMPTY_THRESHOLD_STATE, [trade(999999)]);
    expect(large).toEqual([]);
  });

  it('depois de amostra real suficiente, um trade real acima do percentil é marcado grande', () => {
    let state = EMPTY_THRESHOLD_STATE;
    // Constrói amostra real: 30 trades pequenos (volume 1) primeiro.
    for (let i = 0; i < 30; i++) {
      const r = ingestTradesForLargeDetection(state, [trade(1)]);
      state = r.nextState;
    }
    const r = ingestTradesForLargeDetection(state, [trade(1000)]); // real trade muito maior que a amostra recente
    expect(r.large).toEqual([trade(1000)]);
  });

  it('trades reais pequenos (abaixo do percentil observado) nunca são marcados grandes', () => {
    let state = EMPTY_THRESHOLD_STATE;
    // Amostra real com variância: volumes de 1 a 30 (não todos iguais —
    // um trade exatamente no percentil de uma amostra uniforme SERIA
    // "grande" por definição, então o teste precisa de variância real
    // para verificar a exclusão de verdade).
    for (let i = 1; i <= 30; i++) {
      const r = ingestTradesForLargeDetection(state, [trade(i)]);
      state = r.nextState;
    }
    const r = ingestTradesForLargeDetection(state, [trade(2)]); // bem abaixo do percentil 90 real (~27)
    expect(r.large).toEqual([]);
  });

  it('a amostra de volumes respeita o teto real (VOLUME_SAMPLE_WINDOW=200), nunca acumula sem limite', () => {
    let state = EMPTY_THRESHOLD_STATE;
    for (let i = 0; i < 250; i++) {
      const r = ingestTradesForLargeDetection(state, [trade(i)]);
      state = r.nextState;
    }
    expect(state.recentVolumes.length).toBe(200);
  });
});

describe('pushOrderflowHistory: ring real de CVD+bolhas, respeita o teto, nunca fabrica uma entrada', () => {
  const entry = (t: number, cvd: number): OrderflowHistoryEntry => ({ time: t, cvd, largeTrades: [] });

  it('ring vazio aceita a primeira entrada real', () => {
    expect(pushOrderflowHistory([], entry(1000, 5))).toEqual([entry(1000, 5)]);
  });

  it('respeita o teto real de capacidade — entrada mais antiga cai', () => {
    let ring: OrderflowHistoryEntry[] = [];
    for (let i = 0; i < 5; i++) ring = pushOrderflowHistory(ring, entry(i, i), 3);
    expect(ring).toHaveLength(3);
    expect(ring.map((e) => e.time)).toEqual([2, 3, 4]);
  });

  it('usa ORDERFLOW_HISTORY_CAPACITY por padrão quando nenhum teto é passado', () => {
    let ring: OrderflowHistoryEntry[] = [];
    for (let i = 0; i < ORDERFLOW_HISTORY_CAPACITY + 5; i++) ring = pushOrderflowHistory(ring, entry(i, i));
    expect(ring).toHaveLength(ORDERFLOW_HISTORY_CAPACITY);
  });
});

describe('computeOrderflowTrend: tendência real de força do fluxo (Diretriz Complementar §18) — inclinação recente vs. anterior da MESMA série de CVD já real', () => {
  const entry = (t: number, cvd: number): OrderflowHistoryEntry => ({ time: t, cvd, largeTrades: [] });

  it('FAIL_CLOSED: histórico curto demais (< 10 entradas) => DADOS_INSUFICIENTES, nunca uma tendência fabricada', () => {
    const short = Array.from({ length: 9 }, (_, i) => entry(i, i));
    const r = computeOrderflowTrend(short);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('historico_real_insuficiente_para_tendencia');
    expect(r.trend).toBeNull();
  });

  it('FORTALECENDO: a metade recente acelera bem além da zona-morta real', () => {
    const history: OrderflowHistoryEntry[] = [
      ...Array.from({ length: 10 }, (_, i) => entry(i, i)), // slope ~0.9 na metade anterior
      ...Array.from({ length: 10 }, (_, i) => entry(10 + i, 9 + (i + 1) * 10)), // slope 10 na metade recente
    ];
    const r = computeOrderflowTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('FORTALECENDO');
    expect(r.recentSlope).toBeGreaterThan(r.priorSlope!);
  });

  it('ENFRAQUECENDO: a metade recente desacelera bem além da zona-morta real', () => {
    const history: OrderflowHistoryEntry[] = [
      ...Array.from({ length: 10 }, (_, i) => entry(i, i * 10)), // slope 10 na metade anterior
      ...Array.from({ length: 10 }, (_, i) => entry(10 + i, 90 + (i + 1))), // slope 1 na metade recente
    ];
    const r = computeOrderflowTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('ENFRAQUECENDO');
    expect(r.recentSlope).toBeLessThan(r.priorSlope!);
  });

  it('ESTAVEL: inclinação real constante em toda a janela — a diferença fica dentro da zona-morta', () => {
    const history = Array.from({ length: 20 }, (_, i) => entry(i, i)); // slope 1 constante
    const r = computeOrderflowTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('ESTAVEL');
  });

  it('CVD real completamente parado (amplitude 0) => ESTAVEL honesto, nunca NaN/erro', () => {
    const history = Array.from({ length: 15 }, (_, i) => entry(i, 100));
    const r = computeOrderflowTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('ESTAVEL');
    expect(Number.isFinite(r.recentSlope)).toBe(true);
    expect(Number.isFinite(r.priorSlope)).toBe(true);
  });

  it('determinística: mesma série real, mesma leitura', () => {
    const history = Array.from({ length: 20 }, (_, i) => entry(i, i * (i % 2 === 0 ? 3 : 1)));
    expect(computeOrderflowTrend(history, 5_000)).toEqual(computeOrderflowTrend(history, 5_000));
  });

  it('a palavra "probabilidade" não aparece — tendência de fluxo é inclinação real, nunca chance de acerto (Regra de Ouro 2)', () => {
    const history = Array.from({ length: 20 }, (_, i) => entry(i, i));
    const r = computeOrderflowTrend(history);
    expect(JSON.stringify(r).toLowerCase()).not.toContain('probabilidade');
  });
});
