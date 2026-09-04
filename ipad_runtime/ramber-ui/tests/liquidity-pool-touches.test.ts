// Suíte de EXECUÇÃO REAL do cluster de Equal Highs/Lows
// (fvg-order-block-engine.js), sobre os campos que a camada visual passou a
// precisar.
//
// POR QUE ESTE ARQUIVO EXISTE: o Operador relatou que a linha âmbar de um
// nível testado 2–3 vezes atravessava o gráfico inteiro em vez de marcar só
// o trecho testado, e não mostrava a contagem. A auditoria mostrou que o
// motor SEMPRE soube em quais candles os toques aconteceram — o cluster
// tinha todos os swings — mas exportava apenas `touches` (quantos) e
// `index` (o último). Sem o PRIMEIRO índice não existe trecho, e a única
// primitiva possível era uma linha de largura total.
//
// Aqui o bug provável é "a matemática/leitura do cluster está sutilmente
// errada" (um firstIndex maior que o lastIndex, uma contagem que não bate
// com os índices), então tudo abaixo executa o motor de verdade.
//
// FIXTURES EXPLÍCITOS, NUNCA GERADOS: a confirmação de swing em
// fractal-swings.js é estrita (K=2 de cada lado, `cmp >= v` derruba a
// confirmação). Séries por rampa/senóide produzem empates e o motor
// corretamente não vê swing nenhum — o teste passaria sem exercitar nada.
import { describe, it, expect } from "vitest";
import { analyze } from "../../src/research/engines/fvg-order-block-engine.js";

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

const c = (low: number, high: number): Candle => ({
  open: (low + high) / 2,
  high,
  low,
  close: (low + high) / 2,
});

/**
 * Série com topos iguais cravados à mão nos índices pedidos.
 *
 * Base plana em [98,100] e um topo em 110 exatamente nos índices de `peaks`,
 * com folga de K=2 candles de cada lado para o fractal poder confirmar.
 */
function seriesWithEqualHighs(length: number, peaks: number[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < length; i++) {
    out.push(peaks.includes(i) ? c(105, 110) : c(98, 100));
  }
  return out;
}

const equalHighs = (candles: Candle[]) =>
  (analyze({ ohlcv_series: candles }).liquidity_zones ?? []).filter(
    (z: { type: string }) => z.type === "EQUAL_HIGH",
  );

describe("os índices de toque que a camada visual precisava", () => {
  it("um pool testado 3 vezes reporta os 3 índices reais", () => {
    const zones = equalHighs(seriesWithEqualHighs(40, [10, 20, 30]));
    expect(zones.length, "nenhum pool detectado — fixture inválido").toBe(1);
    expect(zones[0].touches).toBe(3);
    expect(zones[0].touchIndices).toEqual([10, 20, 30]);
  });

  it("firstIndex é o primeiro toque e index continua sendo o último", () => {
    const [z] = equalHighs(seriesWithEqualHighs(40, [10, 20, 30]));
    expect(z.firstIndex).toBe(10);
    expect(z.index).toBe(30);
  });

  it("a contagem e os índices contam a MESMA história — nunca divergem", () => {
    for (const peaks of [[8, 16], [8, 16, 24], [6, 13, 21, 29]]) {
      const [z] = equalHighs(seriesWithEqualHighs(40, peaks));
      expect(z.touches, `picos ${peaks}`).toBe(z.touchIndices.length);
      expect(z.firstIndex).toBe(Math.min(...z.touchIndices));
      expect(z.index).toBe(Math.max(...z.touchIndices));
    }
  });

  it("os índices vêm ordenados — o desenho depende disso para o trecho", () => {
    const [z] = equalHighs(seriesWithEqualHighs(40, [6, 13, 21, 29]));
    const ordenado = [...z.touchIndices].sort((a: number, b: number) => a - b);
    expect(z.touchIndices).toEqual(ordenado);
  });

  it("firstIndex nunca passa de index — um trecho invertido não existe", () => {
    for (const peaks of [[8, 16], [8, 16, 24], [6, 13, 21, 29]]) {
      const [z] = equalHighs(seriesWithEqualHighs(40, peaks));
      expect(z.firstIndex).toBeLessThanOrEqual(z.index);
    }
  });

  it("um pool de 2 toques colapsa firstIndex/index nos dois toques reais", () => {
    const [z] = equalHighs(seriesWithEqualHighs(30, [8, 18]));
    expect(z.touches).toBe(2);
    expect(z.firstIndex).toBe(8);
    expect(z.index).toBe(18);
  });
});

describe("o que já funcionava continua idêntico — a mudança é aditiva", () => {
  it("price, touches e swept não mudaram de comportamento", () => {
    const [z] = equalHighs(seriesWithEqualHighs(40, [10, 20, 30]));
    expect(z.price).toBeCloseTo(110, 6); // média dos topos iguais
    expect(z.touches).toBe(3);
    expect(z.swept).toBe(false); // nada rompeu 110 depois do último toque
  });

  it("um rompimento posterior real continua marcando swept", () => {
    const candles = seriesWithEqualHighs(40, [10, 20]);
    candles[34] = c(115, 120); // rompe o nível bem depois do último toque
    const [z] = equalHighs(candles);
    expect(z.swept).toBe(true);
    // E os índices do trecho continuam sendo os TOQUES, nunca o rompimento.
    expect(z.touchIndices).toEqual([10, 20]);
  });

  it("um único swing nunca vira pool — 'equal high' exige 2 toques reais", () => {
    expect(equalHighs(seriesWithEqualHighs(30, [12])).length).toBe(0);
  });
});
