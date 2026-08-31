// fib-leg-timeframe.test.ts — a perna do Fibonacci escala com o tempo gráfico,
// e o cache do Bus obedece o que promete.
//
// Dois achados desta rodada, ambos de execução real porque em ambos o risco é
// "a matemática/semântica está sutilmente errada", não "esqueceram de ligar":
//
// 1. A perna do Fibonacci vinha de `findSwings(candles, FRACTAL_K=2)` — a
//    MENOR ondulação possível, com o mesmo critério em 1m e em 1W. A pesquisa
//    do padrão da categoria (TradingView Auto Fib Retracement e derivados)
//    mostra ZigZag com limiar de significância escalado por ATR, projetado
//    sobre o último swing CONFIRMADO. Aqui isso é reaproveitamento puro:
//    zigzag-engine.js já existia graduado e o ATR% de Wilder já era calculado.
//
// 2. `isStale(0, 0)` devolvia false — `maxAgeMs: 0` não significava "nunca
//    sirva do cache". Isso quebrava uma garantia escrita em replay-engine.js e
//    causava uma falha intermitente real em data-quality.test.ts.

import { describe, it, expect } from 'vitest';
import {
  computeRealFibonacciConfluence,
  fibLegDeviationPct,
  FIB_LEG_ATR_MULTIPLE,
  FIB_LEG_MIN_DEVIATION_PCT,
  FIB_LEG_MAX_DEVIATION_PCT,
} from '../src/engine-bridge';
import { isStale } from '../../src/market-data-bus/time-synchronizer.js';
import { ZIGZAG_DEFAULT_DEVIATION_PCT } from '../../src/research/engines/zigzag-engine.js';

const vela = (c: number) => ({ open: c, high: c + 0.2, low: c - 0.2, close: c });

/** Série com UMA perna grande (100 -> 200 -> 120) seguida de ondulações
 *  pequenas. É a forma exata do defeito: o fractal K=2 enxergava só os
 *  tremores do fim; a perna estrutural é a de 100 pontos no começo. */
function serieComPernaGrandeEDepoisTremores() {
  const precos: number[] = [];
  for (let p = 100; p <= 200; p += 5) precos.push(p); // subida real
  for (let p = 195; p >= 120; p -= 5) precos.push(p); // queda real
  // tremores de ~2% em cima do fundo — nada estrutural
  for (const p of [122, 120.5, 123, 121, 124, 122, 125, 123]) precos.push(p);
  return precos.map(vela);
}

describe('Perna do Fibonacci: o limiar escala com o ATR real do período', () => {
  it('ATR maior => limiar maior, na razão declarada', () => {
    // Âncora documentada: ATR% = 1 reproduz exatamente o default clássico do
    // indicador (5%), então o comportamento conhecido é o caso base.
    expect(fibLegDeviationPct(1)).toBeCloseTo(ZIGZAG_DEFAULT_DEVIATION_PCT, 10);
    expect(fibLegDeviationPct(2)).toBeCloseTo(2 * FIB_LEG_ATR_MULTIPLE, 10);
  });

  it('sem ATR real cai no default CLÁSSICO do motor — nunca num número fabricado', () => {
    for (const semAtr of [null, undefined, 0, -1, Number.NaN]) {
      expect(fibLegDeviationPct(semAtr as number | null | undefined)).toBe(ZIGZAG_DEFAULT_DEVIATION_PCT);
    }
  });

  it('piso e teto reais: ATR degenerado não vira pivô a cada vela, ATR absurdo não estoura', () => {
    expect(fibLegDeviationPct(0.0001)).toBe(FIB_LEG_MIN_DEVIATION_PCT);
    expect(fibLegDeviationPct(999)).toBe(FIB_LEG_MAX_DEVIATION_PCT);
  });

  it('A PROVA: a MESMA série devolve pernas DIFERENTES conforme o ATR do período', () => {
    const candles = serieComPernaGrandeEDepoisTremores();

    // ATR baixo (ex.: tempo gráfico curto) -> limiar apertado -> a perna
    // acompanha os tremores recentes.
    const curto = computeRealFibonacciConfluence(candles, [], 0.3);
    // ATR alto (ex.: tempo gráfico longo) -> limiar largo -> os tremores não
    // confirmam pivô, e a perna volta a ser a estrutural.
    const longo = computeRealFibonacciConfluence(candles, [], 4);

    expect(curto).not.toBeNull();
    expect(longo).not.toBeNull();

    const alturaCurto = curto!.legHigh - curto!.legLow;
    const alturaLongo = longo!.legHigh - longo!.legLow;

    // Este é o teste que falha se alguém devolver o fractal fixo: com K=2 o
    // resultado seria IDÊNTICO nos dois, porque nada olhava o período.
    expect(alturaLongo).toBeGreaterThan(alturaCurto);
  });

  it('fail-closed: sem candles não inventa perna', () => {
    expect(computeRealFibonacciConfluence([], [], 1)).toBeNull();
  });
});

describe('isStale: maxAgeMs <= 0 significa "nunca sirva do cache"', () => {
  it('o caso que estava errado: idade 0 com limiar 0 é STALE', () => {
    // Antes: `0 > 0` === false => cache hit. replay-engine.js documentava a
    // garantia oposta, e data-quality.test.ts falhava quando duas chamadas
    // caíam na mesma milissegundo.
    expect(isStale(0, 0)).toBe(true);
    expect(isStale(5, 0)).toBe(true);
    expect(isStale(0, -1)).toBe(true);
  });

  it('nenhum outro valor mudou de comportamento', () => {
    expect(isStale(24_999, 25_000)).toBe(false);
    expect(isStale(25_000, 25_000)).toBe(false); // fronteira: idade igual ao limiar segue fresca
    expect(isStale(25_001, 25_000)).toBe(true);
    expect(isStale(1e9, Number.POSITIVE_INFINITY)).toBe(false); // "nunca vence" preservado
  });

  it('fail-closed em entrada sem sentido', () => {
    expect(isStale(Number.NaN, 25_000)).toBe(true);
    expect(isStale(Number.POSITIVE_INFINITY, 25_000)).toBe(true);
    expect(isStale(100, Number.NaN)).toBe(true);
  });
});
