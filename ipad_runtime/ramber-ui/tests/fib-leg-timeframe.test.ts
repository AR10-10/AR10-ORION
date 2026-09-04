// fib-leg-timeframe.test.ts — a perna do Fibonacci (e o ZigZag visível no
// gráfico) escalam com o tempo gráfico, e o cache do Bus obedece o que
// promete.
//
// Três achados nesta trilha, todos de execução real porque em todos o risco é
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
//
// 3. (Auditoria do ecossistema de indicadores) `fibLegDeviationPct` foi
//    renomeada para `atrScaledZigZagDeviationPct`: a lógica sempre foi
//    genérica, e o ZigZag VISÍVEL no gráfico (ZigZagPlugin.tsx) tinha o
//    MESMO limiar fixo que a perna do Fibonacci já tinha antes do achado 1 —
//    só ainda não corrigido. Os testes abaixo cobrem os dois consumidores.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeRealFibonacciConfluence,
  atrScaledZigZagDeviationPct,
  ZIGZAG_ATR_MULTIPLE,
  ZIGZAG_ATR_DEVIATION_MIN_PCT,
  ZIGZAG_ATR_DEVIATION_MAX_PCT,
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
    expect(atrScaledZigZagDeviationPct(1)).toBeCloseTo(ZIGZAG_DEFAULT_DEVIATION_PCT, 10);
    expect(atrScaledZigZagDeviationPct(2)).toBeCloseTo(2 * ZIGZAG_ATR_MULTIPLE, 10);
  });

  it('sem ATR real cai no default CLÁSSICO do motor — nunca num número fabricado', () => {
    for (const semAtr of [null, undefined, 0, -1, Number.NaN]) {
      expect(atrScaledZigZagDeviationPct(semAtr as number | null | undefined)).toBe(
        ZIGZAG_DEFAULT_DEVIATION_PCT,
      );
    }
  });

  it('piso e teto reais: ATR degenerado não vira pivô a cada vela, ATR absurdo não estoura', () => {
    expect(atrScaledZigZagDeviationPct(0.0001)).toBe(ZIGZAG_ATR_DEVIATION_MIN_PCT);
    expect(atrScaledZigZagDeviationPct(999)).toBe(ZIGZAG_ATR_DEVIATION_MAX_PCT);
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

// Fiação entre módulos (padrão no código-fonte, não execução real): o risco
// aqui é "esqueceram de ligar", não "a matemática está errada" — a matemática
// já está coberta acima. CLAUDE.md (convenção de testes) pede exatamente essa
// categoria pra este tipo de checagem.
describe('ZigZag visível no gráfico: MESMO limiar adaptativo que a perna do Fibonacci', () => {
  const IPAD = resolve(__dirname, '../..');
  const ler = (rel: string) => readFileSync(resolve(IPAD, rel), 'utf-8');

  it('ZigZagPlugin.tsx recebe atrPercent e o usa pra resolver o limiar', () => {
    const src = ler('ramber-ui/src/chart/ZigZagPlugin.tsx');
    expect(src).toContain('atrPercent');
    expect(src).toContain('atrScaledZigZagDeviationPct(atrPercent)');
    // A prova de que o resultado REALMENTE entra no motor, não só é calculado
    // e descartado: computeZigZag precisa receber o valor resolvido.
    expect(src).toMatch(/computeZigZag\(\s*dataRef\.current\s*,\s*deviationRef\.current\s*\)/);
  });

  it('EnhancedChart_110_Percent.tsx repassa chartAtrPercent ao ZigZagPlugin', () => {
    const src = ler('ramber-ui/src/chart/EnhancedChart_110_Percent.tsx');
    expect(src).toMatch(/<ZigZagPlugin[\s\S]{0,200}atrPercent=\{chartAtrPercent\}/);
  });

  it('App.tsx passa o ATR real (marketRegime) pro gráfico, não um valor fixo', () => {
    const src = ler('ramber-ui/src/App.tsx');
    expect(src).toContain('const chartAtrPercent = engine?.marketRegime?.atrPercent ?? null;');
    expect(src).toMatch(/<EnhancedChart_110_Percent[\s\S]{0,3000}chartAtrPercent=\{chartAtrPercent\}/);
  });

  it('a checagem de relevância (hasZigZagPivots) usa o MESMO limiar do desenho — nunca dois cálculos divergentes', () => {
    // Acordo com o Achado institutional_zones/neural_market_aura desta mesma
    // auditoria: "existe" e "é desenhado" têm que vir do MESMO cálculo, ou a
    // camada AUTO pode achar relevante algo que a tela não mostra (ou o
    // oposto). Regex tolerante a formatação, ancorada no nome real da const.
    const src = ler('ramber-ui/src/App.tsx');
    const match = src.match(/const hasZigZagPivots =[\s\S]{0,220}?;/);
    expect(match, 'hasZigZagPivots não encontrado em App.tsx').not.toBeNull();
    expect(match![0]).toContain('atrScaledZigZagDeviationPct(chartAtrPercent)');
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
