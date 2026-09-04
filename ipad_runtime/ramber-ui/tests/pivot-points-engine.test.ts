// pivot-points-engine.test.ts — execução REAL do motor puro de Pivot
// Points (Classic/Floor Trader). Valores esperados calculados à mão a
// partir da fórmula pesquisada (CrossTrade/TC2000/TradingView/Mudrex/
// TradingSim/TradeAlgo), nunca copiados de uma calculadora de terceiros
// sem conferência — cada expectativa abaixo é a fórmula aplicada
// diretamente aos números do fixture.
import { describe, it, expect } from 'vitest';
import { computePivotPoints, metadata } from '../../src/research/engines/pivot-points-engine.js';

describe('pivot-points-engine: fórmula clássica bate exatamente', () => {
  it('High=110, Low=90, Close=100 — todos os 7 níveis pela fórmula pesquisada', () => {
    // PP = (110+90+100)/3 = 100
    // R1 = 2*100-90 = 110      S1 = 2*100-110 = 90
    // R2 = 100+(110-90) = 120  S2 = 100-(110-90) = 80
    // R3 = 110+2*(100-90) = 130   S3 = 90-2*(110-100) = 70
    const r = computePivotPoints([{ high: 110, low: 90, close: 100, time: 1000 }]);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.pp).toBeCloseTo(100, 10);
    expect(r.r1).toBeCloseTo(110, 10);
    expect(r.s1).toBeCloseTo(90, 10);
    expect(r.r2).toBeCloseTo(120, 10);
    expect(r.s2).toBeCloseTo(80, 10);
    expect(r.r3).toBeCloseTo(130, 10);
    expect(r.s3).toBeCloseTo(70, 10);
    expect(r.referenceCandle).toEqual({ high: 110, low: 90, close: 100, time: 1000 });
  });

  it('R1/S1 são ANCORADOS em Low/High, não simétricos ao redor de PP — invariante real da fórmula', () => {
    // PP = (200+150+195)/3 = 181.666...
    // R1-PP = PP-Low (âncora em Low); PP-S1 = High-PP (âncora em High) —
    // os dois só coincidem quando PP é o ponto médio exato de High/Low,
    // o que Close geralmente impede. Este teste prova a fórmula REAL, não
    // a simetria ingênua que uma implementação errada poderia assumir.
    const r = computePivotPoints([{ high: 200, low: 150, close: 195 }]);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.pp).toBeCloseTo((200 + 150 + 195) / 3, 10);
    expect(r.r1 - r.pp).toBeCloseTo(r.pp - 150, 10); // R1-PP = PP-Low
    expect(r.pp - r.s1).toBeCloseTo(200 - r.pp, 10); // PP-S1 = High-PP
  });

  it('aceita tanto {h,l,c} quanto {high,low,close} — mesma tolerância de campo do resto da pasta', () => {
    const viaLongo = computePivotPoints([{ high: 110, low: 90, close: 100 }]);
    const viaCurto = computePivotPoints([{ h: 110, l: 90, c: 100 }]);
    expect(viaLongo.status).toBe('OK');
    expect(viaCurto.status).toBe('OK');
    if (viaLongo.status !== 'OK' || viaCurto.status !== 'OK') return;
    expect(viaCurto.pp).toBeCloseTo(viaLongo.pp, 10);
    expect(viaCurto.r3).toBeCloseTo(viaLongo.r3, 10);
    expect(viaCurto.s3).toBeCloseTo(viaLongo.s3, 10);
  });

  it('usa SEMPRE o ÚLTIMO candle do array — nunca o primeiro nem uma média', () => {
    const r = computePivotPoints([
      { high: 500, low: 400, close: 450 }, // ignorado — não é o último
      { high: 110, low: 90, close: 100 }, // é este que deve valer
    ]);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.pp).toBeCloseTo(100, 10);
  });
});

describe('pivot-points-engine: fail-closed (Regra de Ouro 3)', () => {
  it('array vazio => DADOS_INSUFICIENTES, nunca pivots fabricados', () => {
    expect(computePivotPoints([])).toEqual({ status: 'DADOS_INSUFICIENTES', reason: 'sem_candle_diario_real' });
  });

  it('não-array => DADOS_INSUFICIENTES', () => {
    expect(computePivotPoints(null as unknown as []).status).toBe('DADOS_INSUFICIENTES');
    expect(computePivotPoints(undefined as unknown as []).status).toBe('DADOS_INSUFICIENTES');
  });

  it('high/low/close ausentes ou não-finitos => DADOS_INSUFICIENTES, nunca NaN vazando pro chamador', () => {
    expect(computePivotPoints([{ high: 110, low: 90 }] as unknown as []).status).toBe('DADOS_INSUFICIENTES');
    expect(computePivotPoints([{ high: NaN, low: 90, close: 100 }]).status).toBe('DADOS_INSUFICIENTES');
    expect(computePivotPoints([{ high: Infinity, low: 90, close: 100 }]).status).toBe('DADOS_INSUFICIENTES');
  });

  it('candle inconsistente (high < low) => DADOS_INSUFICIENTES, nunca uma conta sem sentido', () => {
    expect(computePivotPoints([{ high: 90, low: 110, close: 100 }]).status).toBe('DADOS_INSUFICIENTES');
  });

  it('high === low (candle degenerado, range zero) ainda produz PP real — não é erro, é um dia sem faixa', () => {
    const r = computePivotPoints([{ high: 100, low: 100, close: 100 }]);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.pp).toBeCloseTo(100, 10);
    expect(r.r1).toBeCloseTo(100, 10);
    expect(r.s1).toBeCloseTo(100, 10);
  });
});

describe('pivot-points-engine: metadata honesta', () => {
  it('declara a variante CLÁSSICA apenas — nunca finge cobrir Woodie/Camarilla/Fibonacci Pivots', () => {
    expect(metadata.status).toBe('ACTIVE_READ_ONLY');
    expect(metadata.limitations.join(' ')).toContain('CLÁSSICA');
  });
});
