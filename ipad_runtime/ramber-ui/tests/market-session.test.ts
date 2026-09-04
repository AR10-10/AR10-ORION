// market-session.test.ts — Refinamento Final §1: execução real da derivação
// pura de sessão (a matemática de fronteira de janela é exatamente o tipo
// de coisa fácil de errar em silêncio — convenção: lógica pura => teste de
// execução real).
import { describe, it, expect } from 'vitest';
import { marketSessionFromUtc, computeSessionBoundaries, computeSessionKeyLevels, MARKET_SESSION_CONTRACT_VERSION } from '../src/nexus/market-session';

const at = (hourUtc: number, minute = 0) => new Date(Date.UTC(2026, 6, 14, hourUtc, minute, 0));
// candle.time real é em segundos (mesma convenção de todo o resto do app —
// lightweight-charts/Binance klines), nunca ms.
const candleAt = (dayOffset: number, hourUtc: number, minute = 0) =>
  Math.floor(new Date(Date.UTC(2026, 6, 14 + dayOffset, hourUtc, minute, 0)).getTime() / 1000);
// Candle OHLC real (só high/low importam para computeSessionKeyLevels).
const candleHL = (dayOffset: number, hourUtc: number, high: number, low: number, minute = 0) => ({
  time: candleAt(dayOffset, hourUtc, minute),
  high,
  low,
});

describe('marketSessionFromUtc: janelas fixas UTC, 24h cobertas sem buraco', () => {
  it('00:00 => ÁSIA (borda inicial inclusiva)', () => {
    expect(marketSessionFromUtc(at(0))?.id).toBe('ASIA');
  });

  it('06:59 => ÁSIA; 07:00 => LONDRES (borda exclusiva/inclusiva correta)', () => {
    expect(marketSessionFromUtc(at(6, 59))?.id).toBe('ASIA');
    expect(marketSessionFromUtc(at(7))?.id).toBe('LONDRES');
  });

  it('12:00 => LONDRES+NY (o overlap real de maior volume)', () => {
    expect(marketSessionFromUtc(at(12))?.id).toBe('LONDRES_NY');
    expect(marketSessionFromUtc(at(15, 59))?.id).toBe('LONDRES_NY');
  });

  it('16:00 => NOVA YORK; 20:59 ainda NOVA YORK', () => {
    expect(marketSessionFromUtc(at(16))?.id).toBe('NOVA_YORK');
    expect(marketSessionFromUtc(at(20, 59))?.id).toBe('NOVA_YORK');
  });

  it('21:00 => PACÍFICO; 23:59 => PACÍFICO (fecha o ciclo de 24h)', () => {
    expect(marketSessionFromUtc(at(21))?.id).toBe('PACIFICO');
    expect(marketSessionFromUtc(at(23, 59))?.id).toBe('PACIFICO');
  });

  it('todas as 24 horas devolvem alguma sessão — zero buraco', () => {
    for (let h = 0; h < 24; h++) {
      expect(marketSessionFromUtc(at(h)), `hora ${h}`).not.toBeNull();
    }
  });

  it('Date inválida => null honesto, nunca uma sessão fabricada', () => {
    expect(marketSessionFromUtc(new Date(NaN))).toBeNull();
  });

  it('contrato versionado + janela verificável divulgando a aproximação DST no texto', () => {
    const r = marketSessionFromUtc(at(9));
    expect(r?.contractVersion).toBe(MARKET_SESSION_CONTRACT_VERSION);
    expect(r?.windowUtc).toContain('UTC');
    expect(r?.windowUtc).toContain('DST');
  });
});

describe('EPC OMEGA FINAL Etapa 10: computeSessionBoundaries — só TRANSIÇÕES reais, nunca uma sessão por candle', () => {
  it('série vazia => []', () => {
    expect(computeSessionBoundaries([])).toEqual([]);
  });

  it('primeiro candle nunca conta como transição — não há "mudança" sem um candle anterior real', () => {
    const candles = [{ time: candleAt(0, 8) }]; // já nasce em LONDRES, sozinho
    expect(computeSessionBoundaries(candles)).toEqual([]);
  });

  it('todos os candles na MESMA sessão (ex. 1h/1h/1h dentro de ÁSIA) => [] honesto, nenhum ruído', () => {
    const candles = [{ time: candleAt(0, 0) }, { time: candleAt(0, 2) }, { time: candleAt(0, 4) }, { time: candleAt(0, 6) }];
    expect(computeSessionBoundaries(candles)).toEqual([]);
  });

  it('uma transição real (ÁSIA→LONDRES às 07h) é reportada no índice/tempo/sessão corretos', () => {
    const candles = [{ time: candleAt(0, 5) }, { time: candleAt(0, 7) }];
    const boundaries = computeSessionBoundaries(candles);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].index).toBe(1);
    expect(boundaries[0].time).toBe(candles[1].time);
    expect(boundaries[0].session.id).toBe('LONDRES');
  });

  it('candles 4h alinhados (00/04/08/12/16/20 UTC) cruzam 3 transições reais em 1 dia (PACÍFICO nunca é atingido por essa grade — honesto, não um bug)', () => {
    const candles = [0, 4, 8, 12, 16, 20].map((h) => ({ time: candleAt(0, h) }));
    const boundaries = computeSessionBoundaries(candles);
    expect(boundaries.map((b) => b.session.id)).toEqual(['LONDRES', 'LONDRES_NY', 'NOVA_YORK']);
    expect(boundaries.map((b) => b.index)).toEqual([2, 3, 4]);
  });

  it('propriedade emergente honesta: candles diários (open sempre 00:00 UTC, Binance real) nunca geram marca — mesma sessão candle a candle, sem limiar de timeframe hardcoded', () => {
    const candles = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ time: candleAt(d, 0) }));
    expect(computeSessionBoundaries(candles)).toEqual([]);
  });

  it('candle com Date inválida (NaN) é pulado honestamente — nunca quebra a varredura nem conta como transição própria', () => {
    const candles = [{ time: candleAt(0, 5) }, { time: NaN }, { time: candleAt(0, 8) }];
    const boundaries = computeSessionBoundaries(candles);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].index).toBe(2); // compara contra a última sessão REAL (índice 0), não contra o NaN pulado
    expect(boundaries[0].session.id).toBe('LONDRES');
  });
});

describe('"Key Levels" (pedido do Operador): computeSessionKeyLevels — máxima/mínima real de cada sessão, reaproveitando a MESMA partição de SESSIONS', () => {
  it('série vazia => []', () => {
    expect(computeSessionKeyLevels([])).toEqual([]);
  });

  it('1 candle único => 1 nível ainda ABERTO (closed:false), high=low=o próprio candle', () => {
    const candles = [candleHL(0, 1, 105, 95)];
    const levels = computeSessionKeyLevels(candles);
    expect(levels).toHaveLength(1);
    expect(levels[0]).toMatchObject({ sessionId: 'ASIA', high: 105, low: 95, closed: false, startIndex: 0, endIndex: 0 });
  });

  it('3 candles na MESMA sessão real (ÁSIA) => 1 nível só, high/low acumulados por Math.max/Math.min real (nunca o último candle sozinho)', () => {
    const candles = [candleHL(0, 0, 100, 90), candleHL(0, 2, 108, 94), candleHL(0, 4, 103, 85)];
    const levels = computeSessionKeyLevels(candles);
    expect(levels).toHaveLength(1);
    expect(levels[0].high).toBe(108); // do candle do meio, não do último
    expect(levels[0].low).toBe(85); // do último candle, não do primeiro
    expect(levels[0].closed).toBe(false); // série termina dentro da própria ÁSIA
  });

  it('transição real ÁSIA→LONDRES (07h): a ÁSIA fecha com closed:true e extremos finais; LONDRES abre closed:false', () => {
    const candles = [candleHL(0, 5, 100, 90), candleHL(0, 6, 110, 88), candleHL(0, 7, 120, 115)];
    const levels = computeSessionKeyLevels(candles);
    expect(levels).toHaveLength(2);
    expect(levels[0]).toMatchObject({ sessionId: 'ASIA', high: 110, low: 88, closed: true, startIndex: 0, endIndex: 1 });
    expect(levels[1]).toMatchObject({ sessionId: 'LONDRES', high: 120, low: 115, closed: false, startIndex: 2, endIndex: 2 });
  });

  it('4 sessões reais em sequência (ÁSIA/LONDRES/LONDRES+NY/NOVA YORK) — cada uma fecha com seu próprio extremo real, nunca contaminado pela vizinha', () => {
    const candles = [
      candleHL(0, 1, 100, 90), // ÁSIA
      candleHL(0, 8, 105, 95), // LONDRES
      candleHL(0, 13, 112, 108), // LONDRES+NY
      candleHL(0, 17, 99, 92), // NOVA YORK (ainda aberta)
    ];
    const levels = computeSessionKeyLevels(candles);
    expect(levels.map((l) => l.sessionId)).toEqual(['ASIA', 'LONDRES', 'LONDRES_NY', 'NOVA_YORK']);
    expect(levels.slice(0, 3).every((l) => l.closed)).toBe(true);
    expect(levels[3].closed).toBe(false);
    expect(levels[1]).toMatchObject({ high: 105, low: 95 });
  });

  it('candle com Date inválida (NaN) é pulado honestamente — não reseta a sessão corrente nem contamina high/low', () => {
    const candles = [candleHL(0, 1, 100, 90), { time: NaN, high: 999, low: 1 }, candleHL(0, 3, 102, 92)];
    const levels = computeSessionKeyLevels(candles);
    expect(levels).toHaveLength(1);
    expect(levels[0]).toMatchObject({ high: 102, low: 90, closed: false });
  });

  it('mesma zona de risco de computeSessionBoundaries (candles diários, sempre 00:00 UTC) => 1 nível só, ÁSIA, sem quebra artificial', () => {
    const candles = [0, 1, 2].map((d) => candleHL(d, 0, 100 + d, 90 - d));
    const levels = computeSessionKeyLevels(candles);
    expect(levels).toHaveLength(1);
    expect(levels[0]).toMatchObject({ sessionId: 'ASIA', high: 102, low: 88, closed: false });
  });
});
