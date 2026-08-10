import { describe, expect, it } from 'vitest';
import { computeTpoProfile } from '../src/nexus/tpo-profile';

// Candles cronológicos ascendentes, t=0 = 1970-01-01T00:00:00Z (uma
// meia-noite UTC real) — todo candle abaixo de t=86400 cai no mesmo dia
// UTC, então filterSessionCandles (reaproveitado dentro do motor) nunca
// exclui nenhum deles neste arquivo de teste.
interface C { time: number; high: number; low: number }

describe('computeTpoProfile: fail-closed', () => {
  it('candles vazio => DADOS_INSUFICIENTES', () => {
    const r = computeTpoProfile([]);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });

  it('periodMinutes inválido (0/negativo/NaN) => DADOS_INSUFICIENTES', () => {
    const candles: C[] = [{ time: 0, high: 101, low: 100 }];
    expect(computeTpoProfile(candles, 0).status).toBe('DADOS_INSUFICIENTES');
    expect(computeTpoProfile(candles, -30).status).toBe('DADOS_INSUFICIENTES');
    expect(computeTpoProfile(candles, NaN).status).toBe('DADOS_INSUFICIENTES');
  });

  it('rowCount inválido (<2/NaN) => DADOS_INSUFICIENTES', () => {
    const candles: C[] = [{ time: 0, high: 101, low: 100 }];
    expect(computeTpoProfile(candles, 30, 1).status).toBe('DADOS_INSUFICIENTES');
    expect(computeTpoProfile(candles, 30, 0).status).toBe('DADOS_INSUFICIENTES');
    expect(computeTpoProfile(candles, 30, NaN).status).toBe('DADOS_INSUFICIENTES');
  });

  it('faixa de preço degenerada (todo candle no mesmo preço exato) => DADOS_INSUFICIENTES', () => {
    const candles: C[] = [
      { time: 0, high: 100, low: 100 },
      { time: 1800, high: 100, low: 100 },
    ];
    const r = computeTpoProfile(candles);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    if (r.status === 'DADOS_INSUFICIENTES') expect(r.reason).toContain('degenerada');
  });

  it('candle de um dia UTC anterior é excluído pela MESMA filterSessionCandles do Volume Profile', () => {
    const candles: C[] = [
      { time: -3600, high: 999, low: 998 }, // dia UTC anterior (1969-12-31)
      { time: 0, high: 101, low: 100 },
      { time: 1800, high: 106, low: 105 },
    ];
    const r = computeTpoProfile(candles);
    expect(r.status).toBe('OK');
    if (r.status === 'OK') {
      expect(r.result.candleCount).toBe(2); // só os 2 candles do dia UTC do último candle
      expect(r.result.rangeMax).toBeLessThan(999); // o candle "de fora" nunca contamina o range real
    }
  });
});

describe('computeTpoProfile: caso controlado, verificado à mão (7 períodos, rowCount=5)', () => {
  // Design (ver commit para a derivação completa):
  //   Período A (t=0,     idx0): low=100,   high=100.5 -> row0 só
  //   Período B (t=1800,  idx1): low=104.5, high=105.5 -> row2 só
  //   Período C (t=3600,  idx2): low=104.2, high=105.8 -> row2 só
  //   Período D (t=5400,  idx3): low=104.9, high=105.1 -> row2 só
  //   Período E (t=7200,  idx4): low=109.5, high=110   -> row4 só
  //   Período F (t=9000,  idx5): low=102.5, high=103   -> row1 só
  //   Período G (t=10800, idx6): low=102.5, high=103   -> row1 só
  // rangeMin=100 (A), rangeMax=110 (E) -> rowWidth=2, rows: [100,102) [102,104) [104,106) [106,108) [108,110]
  // counts: row0=1(A) row1=2(F,G) row2=3(B,C,D) row3=0 row4=1(E) -> total=7
  const candles: C[] = [
    { time: 0, high: 100.5, low: 100 },
    { time: 1800, high: 105.5, low: 104.5 },
    { time: 3600, high: 105.8, low: 104.2 },
    { time: 5400, high: 105.1, low: 104.9 },
    { time: 7200, high: 110, low: 109.5 },
    { time: 9000, high: 103, low: 102.5 },
    { time: 10800, high: 103, low: 102.5 },
  ];

  it('range real (min/max) e grade de linhas derivados só do OHLC observado', () => {
    const r = computeTpoProfile(candles, 30, 5);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.result.rangeMin).toBe(100);
    expect(r.result.rangeMax).toBe(110);
    expect(r.result.rows).toHaveLength(5);
    expect(r.result.candleCount).toBe(7);
    expect(r.result.periodCount).toBe(7);
  });

  it('letras por linha refletem exatamente quais períodos tocaram, em ordem cronológica', () => {
    const r = computeTpoProfile(candles, 30, 5);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.result.rows[0].letters).toEqual(['A']);
    expect(r.result.rows[1].letters).toEqual(['F', 'G']);
    expect(r.result.rows[2].letters).toEqual(['B', 'C', 'D']);
    expect(r.result.rows[3].letters).toEqual([]);
    expect(r.result.rows[4].letters).toEqual(['E']);
    expect(r.result.totalTpoCount).toBe(7);
  });

  it('POC = linha com mais TPOs (row2, count=3) — nunca a linha de maior VOLUME (motor não usa volume)', () => {
    const r = computeTpoProfile(candles, 30, 5);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.result.pocIndex).toBe(2);
    expect(r.result.pocPrice).toBe(105);
  });

  it('Value Area expande para o lado com MAIS TPOs (row1=2 > row3=0) até somar >=70%', () => {
    const r = computeTpoProfile(candles, 30, 5);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.result.valueAreaLowIndex).toBe(1);
    expect(r.result.valueAreaHighIndex).toBe(2);
    expect(r.result.valueAreaLowPrice).toBe(103);
    expect(r.result.valueAreaHighPrice).toBe(105);
    const vaTotal = r.result.rows
      .slice(r.result.valueAreaLowIndex, r.result.valueAreaHighIndex + 1)
      .reduce((s, row) => s + row.letters.length, 0);
    expect(vaTotal / r.result.totalTpoCount).toBeGreaterThanOrEqual(0.7);
  });

  it('single prints = linhas tocadas por exatamente 1 período (row0 e row4)', () => {
    const r = computeTpoProfile(candles, 30, 5);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.result.singlePrintIndices).toEqual([0, 4]);
  });

  it('Initial Balance = high/low real dos 2 primeiros períodos (A e B), nunca do grid de linhas', () => {
    const r = computeTpoProfile(candles, 30, 5);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.result.initialBalanceHigh).toBe(105.5); // max(100.5, 105.5)
    expect(r.result.initialBalanceLow).toBe(100); // min(100, 104.5)
    expect(r.result.initialBalanceComplete).toBe(true);
  });

  it('determinístico: mesma entrada produz o mesmo resultado (exceto computedAt)', () => {
    const r1 = computeTpoProfile(candles, 30, 5);
    const r2 = computeTpoProfile(candles, 30, 5);
    expect(r1.status).toBe('OK');
    expect(r2.status).toBe('OK');
    if (r1.status !== 'OK' || r2.status !== 'OK') return;
    const { computedAt: _c1, ...rest1 } = r1.result;
    const { computedAt: _c2, ...rest2 } = r2.result;
    expect(rest1).toEqual(rest2);
  });
});

describe('computeTpoProfile: Initial Balance parcial nunca é apresentado como final', () => {
  it('sessão com só 1 período => initialBalanceComplete=false', () => {
    const candles: C[] = [{ time: 0, high: 101, low: 100 }];
    const r = computeTpoProfile(candles, 30, 5);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.result.periodCount).toBe(1);
    expect(r.result.initialBalanceComplete).toBe(false);
  });
});

describe('computeTpoProfile: esquema de letras dobradas para sessões >26 períodos (mercado 24h)', () => {
  it('período 26 (o 27º período) recebe a letra dobrada "AA", nunca undefined/crash', () => {
    const candles: C[] = [
      { time: 0, high: 100.5, low: 100 }, // período 0 -> 'A'
      { time: 26 * 1800, high: 108.5, low: 108 }, // período 26 -> 'AA'
    ];
    const r = computeTpoProfile(candles, 30, 5);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.result.periodCount).toBe(27);
    const allLetters = r.result.rows.flatMap((row) => row.letters);
    expect(allLetters).toContain('A');
    expect(allLetters).toContain('AA');
  });
});
