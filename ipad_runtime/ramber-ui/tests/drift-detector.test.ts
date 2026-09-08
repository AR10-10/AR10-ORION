// drift-detector.test.ts — execução REAL.
//
// A pergunta central: a régua é MESMO a variabilidade da própria base? Se
// for, a MESMA diferença de médias tem que mudar de veredito quando a base
// fica mais ou menos volátil. Vários testes existem só para travar isso.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  detectDrift,
  describeDrift,
  DRIFT_BAND_WATCH,
  DRIFT_BAND_POSSIBLE,
  DRIFT_BAND_CONFIRMED,
} from '../src/nexus/drift-detector';
import { RECENT_TRADES_WINDOW, RECENT_TRADES_MIN_SAMPLE } from '../src/nexus/expectancy';
import type { TradeCostResult } from '../src/nexus/trade-simulation';

const t = (netR: number): TradeCostResult =>
  ({
    status: netR > 0 ? 'TARGET_HIT' : 'STOP_HIT',
    direction: 'LONG',
    entryMid: 100,
    riskPoints: 10,
    grossR: netR,
    commissionR: 0,
    slippageR: 0,
    fundingR: 0,
    netR,
    holdingMs: 60_000,
    resolvedAt: 1_700_000_000_000,
    regime: null,
    fingerprint: null,
    institutionalScore: null,
    volatilityAtOpen: null,
    observedMfeR: null,
    observedMaeR: null,
    firstTargetR: null,
    modelAgreement: null,
  }) as TradeCostResult;

/** Série alternada em torno de `centro` com amplitude `amp` — média
 *  controlada e dispersão controlada, que é exatamente o que estes testes
 *  precisam manipular de forma independente. */
const serie = (n: number, centro: number, amp: number) =>
  Array.from({ length: n }, (_, i) => t(centro + (i % 2 === 0 ? amp : -amp)));

describe('drift: fail-closed', () => {
  it('amostra vazia / nula => DADOS_INSUFICIENTES', () => {
    for (const e of [[], null, undefined]) {
      const r = detectDrift(e as never);
      expect(r.status).toBe('DADOS_INSUFICIENTES');
      expect(r.state).toBe('INSUFFICIENT_DATA');
      expect(r.deviations).toBeNull();
    }
  });

  it('janela recente rasa demais => recusa, com a razão real', () => {
    const r = detectDrift(serie(RECENT_TRADES_MIN_SAMPLE - 1, 0.5, 0.2));
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toContain('Janela recente');
  });

  it('sem base DISJUNTA suficiente => recusa (não empresta os próprios recentes)', () => {
    // 25 trades: 20 vão para a recente, sobram 5 de base — abaixo do mínimo.
    const r = detectDrift(serie(RECENT_TRADES_WINDOW + 5, 0.5, 0.2));
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toContain('Linha de base');
    expect(r.baselineTrades).toBe(5);
    expect(r.recentTrades).toBe(RECENT_TRADES_WINDOW);
  });

  it('base sem dispersão => recusa em vez de dividir por ~0', () => {
    // Base constante: qualquer diferença pareceria infinitamente grande.
    const base = Array.from({ length: 15 }, () => t(0.5));
    const recente = Array.from({ length: RECENT_TRADES_WINDOW }, () => t(0.9));
    const r = detectDrift([...base, ...recente]);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toContain('dispersão');
  });

  it('netR não-finito é descartado, nunca lido como 0', () => {
    const sujo = [...serie(20, 0.5, 0.2), t(Number.NaN), ...serie(20, 0.5, 0.2)];
    const r = detectDrift(sujo);
    expect(r.baselineTrades + r.recentTrades).toBe(40);
  });
});

describe('drift: a base e a recente NUNCA se sobrepõem', () => {
  it('a base é tudo ANTES da janela — nunca a amostra inteira', () => {
    const r = detectDrift(serie(60, 0.5, 0.3));
    expect(r.recentTrades).toBe(RECENT_TRADES_WINDOW);
    expect(r.baselineTrades).toBe(40);
    // Se a base incluísse os recentes, seriam 60.
    expect(r.baselineTrades + r.recentTrades).toBe(60);
  });
});

describe('drift: a régua é a variabilidade da PRÓPRIA base', () => {
  const base = (amp: number) => serie(40, 0.5, amp);
  const recente = Array.from({ length: RECENT_TRADES_WINDOW }, () => t(0.8));

  it('a MESMA diferença de médias muda de veredito quando a base muda de volatilidade', () => {
    // Diferença idêntica (0.5 -> 0.8) nos dois casos.
    const baseEstavel = detectDrift([...base(0.05), ...recente]);
    const baseVolatil = detectDrift([...base(3), ...recente]);
    expect(baseEstavel.status).toBe('OK');
    expect(baseVolatil.status).toBe('OK');
    expect(baseEstavel.recentMeanR).toBeCloseTo(baseVolatil.recentMeanR!, 10);
    expect(baseEstavel.baselineMeanR).toBeCloseTo(baseVolatil.baselineMeanR!, 10);
    // ... e ainda assim os desvios são muito diferentes. É o ponto.
    expect(baseEstavel.deviations!).toBeGreaterThan(baseVolatil.deviations!);
  });

  it('base estável + salto grande => banda alta', () => {
    const r = detectDrift([...base(0.05), ...recente]);
    expect(r.deviations!).toBeGreaterThanOrEqual(DRIFT_BAND_CONFIRMED);
    expect(r.worse).toBe(false);
  });

  it('base muito volátil + mesmo salto => ESTÁVEL (o salto cabe no ruído dela)', () => {
    const r = detectDrift([...base(20), ...recente]);
    expect(r.deviations!).toBeLessThan(DRIFT_BAND_WATCH);
    expect(r.state).toBe('STABLE');
  });
});

describe('drift: os estados distinguem "mudou" de "piorou"', () => {
  it('melhora grande => RECUPERANDO, nunca DRIFT (mudou a favor do Operador)', () => {
    const r = detectDrift([...serie(40, -0.3, 0.05), ...Array.from({ length: 20 }, () => t(0.9))]);
    expect(r.worse).toBe(false);
    expect(r.deviations!).toBeGreaterThanOrEqual(DRIFT_BAND_POSSIBLE);
    expect(r.state).toBe('RECOVERING');
  });

  it('piora grande PARA O NEGATIVO => DEGRADADO (não só mudou: passou a perder)', () => {
    const r = detectDrift([...serie(40, 0.6, 0.05), ...Array.from({ length: 20 }, () => t(-0.5))]);
    expect(r.worse).toBe(true);
    expect(r.recentMeanR!).toBeLessThan(0);
    expect(r.state).toBe('DEGRADED');
  });

  it('piora grande mas ainda POSITIVA => DRIFT, não DEGRADADO', () => {
    const r = detectDrift([...serie(40, 1.5, 0.05), ...Array.from({ length: 20 }, () => t(0.4))]);
    expect(r.worse).toBe(true);
    expect(r.recentMeanR!).toBeGreaterThan(0);
    expect(r.state).toBe('DRIFT_CONFIRMED');
  });

  it('sem mudança real => ESTÁVEL', () => {
    const r = detectDrift(serie(60, 0.5, 0.3));
    expect(r.state).toBe('STABLE');
    expect(r.deviations!).toBeLessThan(DRIFT_BAND_WATCH);
  });
});

describe('drift: pureza e apresentação', () => {
  it('não muta a amostra', () => {
    const amostra = serie(60, 0.5, 0.3);
    const antes = JSON.parse(JSON.stringify(amostra));
    detectDrift(amostra);
    expect(JSON.parse(JSON.stringify(amostra))).toEqual(antes);
  });

  it('determinística', () => {
    const amostra = serie(60, 0.5, 0.3);
    expect(detectDrift(amostra)).toEqual(detectDrift(amostra));
  });

  it('a linha mostra as duas médias, os dois n e o desvio', () => {
    const linha = describeDrift(detectDrift(serie(60, 0.5, 0.3)));
    expect(linha).toContain('recente');
    expect(linha).toContain('base');
    expect(linha).toContain('σ');
    expect(linha).toContain(`(${RECENT_TRADES_WINDOW})`);
  });

  it('sem amostra => razão real, nunca um estado', () => {
    expect(describeDrift(detectDrift([]))).not.toContain('σ');
  });
});

describe('drift: nada inventado, e as convenções estão declaradas', () => {
  const src = readFileSync(new URL('../src/nexus/drift-detector.ts', import.meta.url), 'utf-8');

  it('a janela e o piso vêm de expectancy.ts, nunca redeclarados', () => {
    expect(src).toContain('from "./expectancy"');
    expect(src).not.toMatch(/const\s+RECENT_TRADES_\w+\s*=/);
  });

  it('as bandas são as estatísticas ordinárias, e o módulo diz que são convenção', () => {
    expect(DRIFT_BAND_WATCH).toBe(1);
    expect(DRIFT_BAND_POSSIBLE).toBe(2);
    expect(DRIFT_BAND_CONFIRMED).toBe(3);
    expect(src).toContain('CONVENÇÃO');
    // Nunca reivindica teste de hipótese / p-valor.
    expect(src).not.toMatch(/p-?valor\s*[<=]/i);
  });

  it('LEI 24: não emite direção nem lê decisão', () => {
    expect(src).not.toMatch(/\b(LONG|SHORT|WAIT)\b/);
  });
});

describe('drift: fiação real em App.tsx', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');

  it('roda sobre a MESMA amostra dos outros memos, uma vez só', () => {
    expect(app).toContain('detectDrift(trackRecordResults)');
    expect(app.split('detectDrift(').length - 1).toBe(1);
  });

  it('a escassez entra na linha de maturidade — nunca vira frase solta', () => {
    expect(app).toContain('const driftGate = {');
    expect(app).toContain('walkForwardGate, shadowGate, driftGate]');
    expect(app).toContain('reasonStillNeeded(driftReading?.reason, driftGate)');
  });

  it('o gate exige as DUAS amostras (recente + base), não uma', () => {
    expect(app).toContain('need: RECENT_TRADES_MIN_SAMPLE * 2');
    expect(app).toContain('(driftReading?.baselineTrades ?? 0) + (driftReading?.recentTrades ?? 0)');
  });

  it('LEI 24: drift não alimenta Núcleo, Trade Plan nem risco', () => {
    expect(app).not.toMatch(/driftReading[^\n]*\b(engine\.|tradePlan|buildTradePlan|riskSuggestion|direction)\b/);
  });

  it('só desenha com status OK', () => {
    expect(app).toContain('driftReading?.status === "OK"');
    expect(app).toContain('describeDrift(driftReading)');
  });
});

// ─── §74-B: LIMITE DE HOEFFDING (ADWIN, Bifet & Gavaldà 2007) ────────────
// A pergunta destes testes não é "o número bate?" — é "o corte é DERIVADO
// dos dados, e não escolhido?". Cada teste ataca uma forma de ele voltar a
// ser uma convenção disfarçada. Reusa o MESMO `serie()` do resto do
// arquivo — nenhuma fixture nova nasce só para o bound.
describe('drift: o corte de Hoeffding é derivado, não escolhido', () => {
  it('a fórmula do artigo, conferida à mão: ε = amplitude·√(ln(4/δ\')/2m)', () => {
    // serie(80, 0.5, 0.3): 60 na base, 20 na recente, ambas alternando
    // simetricamente em torno do mesmo centro — dispersão real na base,
    // sem exigir uma segunda fixture só para o cálculo.
    const r = detectDrift(serie(80, 0.5, 0.3));
    expect(r.status).toBe('OK');

    const n0 = r.baselineTrades;
    const n1 = r.recentTrades;
    const m = 1 / (1 / n0 + 1 / n1);
    const deltaLinha = 0.05 / (n0 + n1);
    const esperado = r.baselineRange! * Math.sqrt(Math.log(4 / deltaLinha) / (2 * m));
    expect(r.hoeffdingBound).toBeCloseTo(esperado, 10);
    expect(r.baselineRange).toBeCloseTo(0.6, 10); // (0.5+0.3) - (0.5-0.3)
  });

  it('o bound ESCALA com a amplitude real da base — a régua sai dos dados', () => {
    // Hoeffding só vale para variável LIMITADA, e o ε_cut publicado assume
    // [0,1]. Se a amplitude não entrasse, duas amostras com dispersões
    // muito diferentes teriam o MESMO corte — que é justamente o erro.
    const estreita = detectDrift(serie(80, 0.5, 0.1));
    const larga = detectDrift(serie(80, 0.5, 1.0));
    expect(estreita.status).toBe('OK');
    expect(larga.status).toBe('OK');
    expect(larga.baselineRange!).toBeGreaterThan(estreita.baselineRange!);
    expect(larga.hoeffdingBound!).toBeGreaterThan(estreita.hoeffdingBound!);
    // E a razão entre os cortes é a razão entre as amplitudes (mesmos n).
    expect(larga.hoeffdingBound! / estreita.hoeffdingBound!).toBeCloseTo(
      larga.baselineRange! / estreita.baselineRange!,
      10,
    );
  });

  it('mais amostra => corte MENOR (mais evidência, menos tolerância ao acaso)', () => {
    // Mesma amplitude (0.3) nas duas — só o TAMANHO da base muda
    // (RECENT_TRADES_WINDOW fica fixo, o resto vira base).
    const pequena = detectDrift(serie(50, 0.5, 0.3));
    const grande = detectDrift(serie(200, 0.5, 0.3));
    expect(pequena.status).toBe('OK');
    expect(grande.status).toBe('OK');
    expect(grande.baselineTrades).toBeGreaterThan(pequena.baselineTrades);
    expect(grande.hoeffdingBound!).toBeLessThan(pequena.hoeffdingBound!);
  });

  it('o veredito derivado é exatamente |Δmédias| > ε, nunca outra coisa', () => {
    // Base centrada em 0.5, recente centrada em 0.7 — Δ real e conhecido.
    const deslocada = [...serie(30, 0.5, 0.3), ...serie(RECENT_TRADES_WINDOW, 0.7, 0.3)];
    const r = detectDrift(deslocada);
    expect(r.status).toBe('OK');
    expect(r.recentMeanR).toBeCloseTo(0.7, 10);
    expect(r.baselineMeanR).toBeCloseTo(0.5, 10);
    const delta = Math.abs(r.recentMeanR! - r.baselineMeanR!);
    expect(r.hoeffdingExceeded).toBe(delta > r.hoeffdingBound!);
  });

  it('uma mudança GRANDE de verdade passa do corte; ruído não', () => {
    // Mesmo centro na base e na recente: Δ é exatamente 0 => nunca excede.
    const soRuido = detectDrift(serie(120, 0.5, 0.3));
    expect(soRuido.status).toBe('OK');
    expect(soRuido.recentMeanR).toBeCloseTo(soRuido.baselineMeanR!, 10);
    expect(soRuido.hoeffdingExceeded).toBe(false);

    // MESMA base (dispersão real), janela recente deslocada para um valor
    // muito distante — inequívoco, bem acima de qualquer corte plausível.
    const deslocada = detectDrift([
      ...serie(100, 0.5, 0.3),
      ...Array.from({ length: RECENT_TRADES_WINDOW }, () => t(5)),
    ]);
    expect(deslocada.status).toBe('OK');
    expect(deslocada.hoeffdingExceeded).toBe(true);
  });

  it('ausência nunca vira `false` — sem leitura, o veredito é null', () => {
    const r = detectDrift([]);
    expect(r.hoeffdingBound).toBeNull();
    expect(r.hoeffdingExceeded).toBeNull(); // nunca false, que se leria como "testado, sem drift"
    expect(r.baselineRange).toBeNull();
  });

  it('as bandas convencionais CONTINUAM existindo (Regra de Ouro 4)', () => {
    const r = detectDrift(serie(80, 0.5, 0.3));
    expect(r.status).toBe('OK');
    expect(r.deviations).not.toBeNull();
    expect(DRIFT_BAND_WATCH).toBe(1);
    expect(DRIFT_BAND_POSSIBLE).toBe(2);
    expect(DRIFT_BAND_CONFIRMED).toBe(3);
    // O bound é binário; as bandas dão a magnitude graduada. Complementares.
    expect(['STABLE', 'WATCH', 'POSSIBLE_DRIFT', 'DRIFT_CONFIRMED', 'DEGRADED', 'RECOVERING']).toContain(r.state);
  });

  it('describeDrift mostra os DOIS: a magnitude em σ e o veredito derivado', () => {
    const linha = describeDrift(detectDrift(serie(80, 0.5, 0.3)));
    expect(linha).toContain('σ');
    expect(linha).toContain('Hoeffding');
    expect(linha).toContain('ε=');
  });

  it('δ é declarado com significado (taxa de falso alarme), não um σ escolhido', () => {
    const src = readFileSync(new URL('../src/nexus/drift-detector.ts', import.meta.url), 'utf-8');
    expect(src).toContain('DRIFT_HOEFFDING_DELTA = 0.05');
    // E o módulo NÃO pode afirmar que virou parameter-free: δ é uma troca,
    // não uma eliminação — dizer o contrário seria a desonestidade exata
    // que este projeto evita.
    expect(src).toContain('é uma troca');
    expect(src).toContain('não uma eliminação');
  });
});
