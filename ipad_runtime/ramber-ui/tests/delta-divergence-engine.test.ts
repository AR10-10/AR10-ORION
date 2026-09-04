// Suíte de EXECUÇÃO REAL do motor de divergência de delta.
//
// POR QUE O MOTOR EXISTE (comparação com plataformas concorrentes pedida
// pelo Operador): `grep -ri "divergen"` no repositório inteiro só achava
// divergência ENTRE CORRETORAS (trust score). Divergência de DELTA — preço
// e fluxo líquido discordando — não existia, e é o item que todas as
// plataformas de order flow consultadas destacam.
//
// DEFINIÇÃO PESQUISADA, não inventada:
//   BAIXISTA  preço TOPO MAIS ALTO  + CVD TOPO MAIS BAIXO  = exaustão compradora
//   ALTISTA   preço FUNDO MAIS BAIXO + CVD FUNDO MAIS ALTO = exaustão vendedora
//
// Aqui o bug provável é "a regra está sutilmente errada" (um sinal
// trocado, um swing não confirmado usado, o CVD lido no índice errado) —
// então tudo abaixo executa o motor de verdade.
//
// FIXTURES EXPLÍCITOS, NUNCA GERADOS: a confirmação fractal é ESTRITA
// (`cmp >= v` derruba a confirmação). Séries por rampa ou senóide produzem
// empates e o motor corretamente não vê swing nenhum — o teste passaria
// sem exercitar nada. Cada topo/fundo abaixo é cravado à mão.
import { describe, it, expect } from "vitest";
import {
  analyze,
  metadata,
  mapCvdToCandles,
  coveredSuffix,
  MIN_COVERED_CANDLES,
} from "../../src/research/engines/delta-divergence-engine.js";
import { findSwings, FRACTAL_K } from "../../src/research/engines/fractal-swings.js";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const T0 = 1_700_000_000; // segundos
const PASSO = 60; // 1 minuto por vela

/** Série plana com topos/fundos cravados nos índices pedidos. */
function serie(
  n: number,
  picos: Record<number, number> = {},
  vales: Record<number, number> = {},
): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const alto = picos[i] ?? 100;
    const baixo = vales[i] ?? 99;
    return { time: T0 + i * PASSO, open: 99.5, high: alto, low: baixo, close: 99.5 };
  });
}

/** Uma amostra de CVD por vela, no meio dela (tempo em MILISSEGUNDOS). */
function amostras(candles: Candle[], valores: number[]): { time: number; cvd: number }[] {
  return candles.map((c, i) => ({ time: (c.time + 1) * 1000, cvd: valores[i] ?? 0 }));
}

describe("a definição pesquisada, executada de verdade", () => {
  it("BAIXISTA: preço faz topo mais ALTO e CVD faz topo mais BAIXO", () => {
    // Topos confirmados em 5 e 12. Preço sobe (105 → 108), CVD cai.
    const candles = serie(20, { 5: 105, 12: 108 });
    const cvd = Array.from({ length: 20 }, (_, i) => (i >= 12 ? 40 : i >= 5 ? 90 : 10));
    const r = analyze({ ohlcv_series: candles, cvd_samples: amostras(candles, cvd) });
    expect(r.status).toBe("OK");
    expect(r.divergence, "nenhuma divergência detectada").not.toBeNull();
    expect(r.divergence.type).toBe("BAIXISTA");
    expect(r.divergence.fromIndex).toBe(5);
    expect(r.divergence.toIndex).toBe(12);
    expect(r.divergence.toPrice).toBeGreaterThan(r.divergence.fromPrice);
    expect(r.divergence.toCvd).toBeLessThan(r.divergence.fromCvd);
  });

  it("ALTISTA: preço faz fundo mais BAIXO e CVD faz fundo mais ALTO", () => {
    const candles = serie(20, {}, { 5: 94, 12: 91 });
    const cvd = Array.from({ length: 20 }, (_, i) => (i >= 12 ? -20 : i >= 5 ? -80 : 0));
    const r = analyze({ ohlcv_series: candles, cvd_samples: amostras(candles, cvd) });
    expect(r.status).toBe("OK");
    expect(r.divergence.type).toBe("ALTISTA");
    expect(r.divergence.toPrice).toBeLessThan(r.divergence.fromPrice);
    expect(r.divergence.toCvd).toBeGreaterThan(r.divergence.fromCvd);
  });

  it("preço e CVD subindo JUNTOS não é divergência — é confirmação", () => {
    // O erro mais fácil de cometer aqui é detectar "movimento" em vez de
    // DISCORDÂNCIA. Preço sobe, CVD sobe: nada a reportar.
    const candles = serie(20, { 5: 105, 12: 108 });
    const cvd = Array.from({ length: 20 }, (_, i) => (i >= 12 ? 150 : i >= 5 ? 90 : 10));
    const r = analyze({ ohlcv_series: candles, cvd_samples: amostras(candles, cvd) });
    expect(r.status).toBe("OK");
    expect(r.divergence).toBeNull();
  });

  it("preço fazendo topo mais BAIXO não é divergência baixista, mesmo com CVD caindo", () => {
    // A regra exige topo mais ALTO. Sem isso é só o mercado caindo.
    const candles = serie(20, { 5: 108, 12: 105 });
    const cvd = Array.from({ length: 20 }, (_, i) => (i >= 12 ? 40 : i >= 5 ? 90 : 10));
    const r = analyze({ ohlcv_series: candles, cvd_samples: amostras(candles, cvd) });
    expect(r.divergence).toBeNull();
  });
});

describe("causalidade: nunca usa um swing que ainda não existia", () => {
  // ESTE BLOCO MUDOU DEPOIS DE UM TESTE DE MUTAÇÃO, e a razão fica
  // registrada porque ela é o achado: o motor tinha um filtro próprio
  // (`s.index + FRACTAL_K <= ultimo`) e remover esse filtro NÃO quebrava
  // nenhum teste. Investigando, o filtro era um no-op — `findSwings` já
  // varre apenas `k <= i < length - k`, então todo swing que ele devolve
  // tem K candles à direita e já está confirmado.
  //
  // Um guard que não guarda é pior que nenhum: passa a impressão de
  // proteção onde não há. Foi removido, e a garantia REAL passou a ser
  // travada aqui, em cima de findSwings — onde ela de fato vive.
  it("findSwings NUNCA devolve um swing sem K candles à direita — a garantia real", () => {
    for (const n of [12, 20, 40]) {
      const candles = serie(n, { 5: 105, [n - 2]: 108, [n - 1]: 120 });
      for (const alto of [true, false]) {
        for (const s of findSwings(candles, FRACTAL_K, alto)) {
          expect(s.index + FRACTAL_K, `n=${n} alto=${alto} index=${s.index}`).toBeLessThanOrEqual(n - 1);
        }
      }
    }
  });

  it("um topo nas últimas K velas simplesmente não existe para o motor", () => {
    // Usá-lo seria look-ahead — o motor "acertaria" com informação que não
    // existia no momento.
    const n = 20;
    const candles = serie(n, { 5: 105, [n - 2]: 108 });
    const cvd = Array.from({ length: n }, (_, i) => (i >= n - 2 ? 40 : i >= 5 ? 90 : 10));
    expect(findSwings(candles, FRACTAL_K, true).some((s) => s.index === n - 2)).toBe(false);
    const r = analyze({ ohlcv_series: candles, cvd_samples: amostras(candles, cvd) });
    expect(r.status).toBe("OK");
    expect(r.divergence).toBeNull();
  });

  it("o MESMO topo, uma vez confirmado por velas à direita, passa a valer", () => {
    // Prova que o teste acima mede confirmação, e não outra coisa.
    const candles = serie(20, { 5: 105, 12: 108 });
    const cvd = Array.from({ length: 20 }, (_, i) => (i >= 12 ? 40 : i >= 5 ? 90 : 10));
    expect(analyze({ ohlcv_series: candles, cvd_samples: amostras(candles, cvd) }).divergence).not.toBeNull();
  });
});

describe("mapeamento CVD → vela (a parte fácil de errar em silêncio)", () => {
  it("cada amostra cai na vela que a contém", () => {
    const candles = serie(5);
    const cob = mapCvdToCandles(candles, [
      { time: (T0 + 0) * 1000, cvd: 1 },
      { time: (T0 + PASSO) * 1000, cvd: 2 },
      { time: (T0 + 2 * PASSO + 30) * 1000, cvd: 3 },
    ]);
    expect(cob).toEqual([1, 2, 3, null, null]);
  });

  it("com várias amostras na mesma vela, vale a ÚLTIMA", () => {
    // O CVD é cumulativo: o valor da vela é o estado ao FIM dela.
    const candles = serie(3);
    const cob = mapCvdToCandles(candles, [
      { time: (T0 + 5) * 1000, cvd: 10 },
      { time: (T0 + 30) * 1000, cvd: 25 },
      { time: (T0 + 55) * 1000, cvd: 40 },
    ]);
    expect(cob[0]).toBe(40);
  });

  it("vela sem amostra NUNCA herda o valor da vizinha", () => {
    // Herdar seria fabricar um ponto de CVD que nunca foi medido.
    const candles = serie(4);
    const cob = mapCvdToCandles(candles, [{ time: (T0 + 5) * 1000, cvd: 10 }]);
    expect(cob).toEqual([10, null, null, null]);
  });

  it("amostra anterior a toda a série é descartada, nunca ancorada na primeira vela", () => {
    const candles = serie(3);
    expect(mapCvdToCandles(candles, [{ time: (T0 - 999) * 1000, cvd: 7 }])).toEqual([null, null, null]);
  });

  it("amostra com tempo ou cvd inválido é ignorada", () => {
    const candles = serie(3);
    const cob = mapCvdToCandles(candles, [
      { time: NaN, cvd: 5 },
      { time: (T0 + 5) * 1000, cvd: NaN },
      { time: (T0 + PASSO + 5) * 1000, cvd: 9 },
    ]);
    expect(cob).toEqual([null, 9, null]);
  });
});

describe("janela coberta: sufixo contíguo, nunca costurada por cima de um buraco", () => {
  it("pega a faixa contígua que termina no dado mais recente", () => {
    expect(coveredSuffix([null, 1, 2, null, 5, 6, 7])).toEqual({ from: 4, to: 6 });
  });

  it("velas futuras ainda sem amostra não quebram a janela", () => {
    expect(coveredSuffix([1, 2, 3, null])).toEqual({ from: 0, to: 2 });
  });

  it("um buraco no meio NÃO é costurado — a série do outro lado nunca existiu junto", () => {
    // Costurar produziria uma série de CVD que nunca foi medida como uma
    // coisa só, e a divergência sairia de dois regimes diferentes.
    const j = coveredSuffix([1, 2, 3, 4, 5, null, 9, 10]);
    expect(j).toEqual({ from: 6, to: 7 });
  });

  it("sem nenhuma cobertura devolve null", () => {
    expect(coveredSuffix([null, null, null])).toBeNull();
    expect(coveredSuffix([])).toBeNull();
  });
});

describe("fail-closed — a parte que mais importa neste motor", () => {
  it("sem amostra de CVD nenhuma, DADOS_INSUFICIENTES explícito", () => {
    const r = analyze({ ohlcv_series: serie(30), cvd_samples: [] });
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.reason).toBe("sem_amostras_reais_de_cvd");
    expect(r.divergence).toBeNull();
  });

  it("CVD cobrindo poucas velas: recusa E DIZ quantas cobriu", () => {
    // Este é o caso NORMAL em timeframe alto, não uma exceção. A UI precisa
    // do número real para explicar ao Operador o que falta, em vez de só
    // sumir da tela.
    const candles = serie(40, { 5: 105, 12: 108 });
    const poucas = candles.slice(-4).map((c) => ({ time: (c.time + 1) * 1000, cvd: 50 }));
    const r = analyze({ ohlcv_series: candles, cvd_samples: poucas });
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.coveredCandles).toBe(4);
    expect(r.reason).toContain("cvd_cobre_apenas_4_velas");
  });

  it("NUNCA extrapola CVD para preencher a janela", () => {
    // Se o motor "completasse" as velas sem amostra, o teste acima daria OK
    // com uma divergência calculada sobre pontos inventados. Esta é a
    // garantia central da Regra de Ouro 1/3 neste motor.
    const candles = serie(40, { 5: 105, 12: 108 });
    const poucas = candles.slice(-4).map((c) => ({ time: (c.time + 1) * 1000, cvd: 50 }));
    expect(analyze({ ohlcv_series: candles, cvd_samples: poucas }).divergence).toBeNull();
  });

  it("série curta demais nem chega a olhar o CVD", () => {
    const curta = serie(5);
    const r = analyze({ ohlcv_series: curta, cvd_samples: amostras(curta, [1, 2, 3, 4, 5]) });
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.reason).toContain("abaixo_do_minimo");
  });

  it("entrada ausente ou inválida nunca lança", () => {
    for (const entrada of [{}, { ohlcv_series: null }, { ohlcv_series: [], cvd_samples: null }]) {
      expect(() => analyze(entrada as never)).not.toThrow();
      expect(analyze(entrada as never).status).toBe("DADOS_INSUFICIENTES");
    }
  });

  it("menos de dois swings confirmados não vira divergência", () => {
    const candles = serie(20, { 5: 105 }); // um topo só
    const cvd = Array.from({ length: 20 }, () => 50);
    expect(analyze({ ohlcv_series: candles, cvd_samples: amostras(candles, cvd) }).divergence).toBeNull();
  });
});

describe("índices devolvidos são os da série ORIGINAL, não os da janela interna", () => {
  it("com cobertura parcial, o índice aponta para a vela certa na tela", () => {
    // O motor trabalha numa fatia (o sufixo coberto). Devolver índices da
    // fatia faria a UI desenhar a divergência no lugar errado do gráfico —
    // um erro que passaria despercebido até alguém conferir a olho.
    const candles = serie(40, { 25: 105, 32: 108 });
    const cvd = Array.from({ length: 40 }, (_, i) => (i >= 32 ? 40 : 90));
    const cobertas = candles.slice(20).map((c, i) => ({ time: (c.time + 1) * 1000, cvd: cvd[20 + i] }));
    const r = analyze({ ohlcv_series: candles, cvd_samples: cobertas });
    expect(r.status).toBe("OK");
    expect(r.divergence.fromIndex).toBe(25);
    expect(r.divergence.toIndex).toBe(32);
    expect(candles[r.divergence.toIndex].high).toBe(108);
  });
});

describe("LEI 24 e honestidade declarada", () => {
  it("o motor nunca devolve direção de trade", () => {
    const candles = serie(20, { 5: 105, 12: 108 });
    const cvd = Array.from({ length: 20 }, (_, i) => (i >= 12 ? 40 : 90));
    const r = analyze({ ohlcv_series: candles, cvd_samples: amostras(candles, cvd) });
    const texto = JSON.stringify(r);
    expect(texto).not.toContain("LONG");
    expect(texto).not.toContain("SHORT");
    expect(texto).not.toContain("BUY");
    expect(texto).not.toContain("SELL");
  });

  it("nenhuma probabilidade fabricada — Regra de Ouro 2", () => {
    const candles = serie(20, { 5: 105, 12: 108 });
    const cvd = Array.from({ length: 20 }, (_, i) => (i >= 12 ? 40 : 90));
    const r = analyze({ ohlcv_series: candles, cvd_samples: amostras(candles, cvd) });
    const texto = JSON.stringify(r).toLowerCase();
    expect(texto).not.toContain("probabil");
    expect(texto).not.toContain("chance");
    expect(texto).not.toContain("accuracy");
  });

  it("as limitações reais estão declaradas no próprio motor", () => {
    const lim = metadata.limitations.join(" ").toLowerCase();
    expect(lim).toContain("dados_insuficientes");
    expect(lim).toContain("absor"); // exaustão não é absorção
    expect(lim).toContain("lei 24");
    expect(MIN_COVERED_CANDLES).toBeGreaterThanOrEqual(2 * 2 + 1); // pelo menos um swing fractal
  });
});
