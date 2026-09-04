// fib-extension-notation.test.ts — trava a IDENTIDADE do alvo estendido de
// Fibonacci contra o nome que ele carrega.
//
// Por que este teste existe: `support-resistance-engine.js` calcula
// `lastHigh + legRange * 0.618` e descrevia isso como "extensão de Fibonacci
// (61.8%)". A matemática sempre esteve certa; o NOME estava errado em notação
// profissional — uma extensão de 61.8% cairia DENTRO da perna, o que é
// retração, não extensão. O nível real é o de 161.8% medido da ORIGEM da
// perna, que é como qualquer terminal profissional o rotula.
//
// Execução real (não teste de padrão): o risco aqui é "a matemática está
// sutilmente errada", exatamente o caso em que a convenção do projeto pede
// executar o motor de verdade. O campo alimenta `extendedTarget` em
// engine-bridge.ts, ou seja, é um alvo que o Operador enxerga — se alguém
// "corrigir" o 0.618 para 1.618 achando que conserta o nome, o alvo pula de
// lugar e este teste falha alto.
//
// A perna real é reconstruída importando `findSwings`/`FRACTAL_K` de
// fractal-swings.js — o MESMO módulo que o motor importa, nunca uma segunda
// definição de swing (regra explícita do projeto).

import { describe, it, expect } from 'vitest';
import { analyze } from '../../src/research/engines/support-resistance-engine.js';
import { FRACTAL_K, findSwings } from '../../src/research/engines/fractal-swings.js';

/** Série determinística com swings fractais confirmados dos dois lados. */
function serie() {
  const precos = [
    100, 102, 104, 101, 99, 103, 107, 112, 118, 125,
    121, 117, 114, 118, 124, 131, 139, 148, 158, 169,
    165, 161, 158, 162, 168, 175, 183, 192, 202, 213,
  ];
  return precos.map((c, i) => ({
    t: 1_700_000_000 + i * 3600,
    o: c - 0.5,
    h: c + 1.5,
    l: c - 1.5,
    c,
    v: 1000 + i * 10,
  }));
}

/** A perna do motor, pelo mesmo caminho que ele usa. */
function pernaReal(candles: ReturnType<typeof serie>) {
  const highs = findSwings(candles, FRACTAL_K, true).sort((a, b) => b.index - a.index);
  const lows = findSwings(candles, FRACTAL_K, false).sort((a, b) => b.index - a.index);
  const lastHigh = highs[0];
  const lastLow = lows[0];
  return {
    lastHigh,
    lastLow,
    legRange: Math.abs(lastHigh.price - lastLow.price),
    lastLegIsUp: lastHigh.index > lastLow.index,
  };
}

describe('Extensão de Fibonacci: o nome bate com a matemática', () => {
  it('o alvo é o nível de 161.8% medido da origem da perna — nunca 61.8%', () => {
    const candles = serie();
    const r = analyze({ ohlcv_series: candles, timeframe: '1h' });
    expect(r.status).toBe('OK');

    const { lastHigh, lastLow, legRange, lastLegIsUp } = pernaReal(candles);
    expect(legRange).toBeGreaterThan(0);

    // Só o lado que a última perna real confirma é preenchido.
    const alvo = lastLegIsUp ? r.fib_extension_long_target : r.fib_extension_short_target;
    expect(typeof alvo).toBe('number');

    // Origem da perna = de onde ela partiu; extremo = onde ela terminou.
    const origem = lastLegIsUp ? lastLow.price : lastHigh.price;
    const extremo = lastLegIsUp ? lastHigh.price : lastLow.price;

    // A identidade que o nome afirma:
    //   extremo ± range*0.618  ===  origem ± range*1.618
    const razaoDaOrigem = Math.abs((alvo as number) - origem) / legRange;
    expect(razaoDaOrigem).toBeCloseTo(1.618, 6);

    // E é EXTENSÃO, não retração: o alvo fica além do extremo da perna,
    // nunca dentro dela. Esta asserção quebra se alguém medir o 0.618 da
    // origem achando que "conserta" a notação.
    if (lastLegIsUp) {
      expect(alvo as number).toBeGreaterThan(extremo);
    } else {
      expect(alvo as number).toBeLessThan(extremo);
    }
  });

  it('o lado que a última perna não confirma fica DADOS_INSUFICIENTES, nunca uma projeção forçada', () => {
    const candles = serie();
    const r = analyze({ ohlcv_series: candles, timeframe: '1h' });
    const { lastLegIsUp } = pernaReal(candles);
    const ladoNaoConfirmado = lastLegIsUp ? r.fib_extension_short_target : r.fib_extension_long_target;
    expect(ladoNaoConfirmado).toBe('DADOS_INSUFICIENTES');
  });
});
