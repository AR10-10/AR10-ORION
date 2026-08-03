// triangle-pattern.test.ts — Carta Branca (Reconhecimento de Padrões):
// execução real do motor de Triângulos. Fixture própria (diferente do
// zigzag alternado dos harmônicos): constrói uma "baseline" real que
// nunca produz picos/fundos espúrios (achatada/monotônica exatamente na
// mesma direção da linha-alvo, sempre a uma distância fixa dela), e
// insere os TOQUES reais (exatamente sobre a linha-alvo) nos índices
// escolhidos — os únicos pontos que o fractal K=2 confirma como swing.
import { describe, it, expect } from 'vitest';
import {
  detectTrianglePattern,
  MIN_TRIANGLE_FIT_SCORE,
  TRIANGLE_CONTRACT_VERSION,
} from '../src/nexus/triangle-pattern';

function buildTriangleCandles(opts: {
  length: number;
  resistanceLine: (i: number) => number;
  supportLine: (i: number) => number;
  resistanceTouchIndices: number[];
  supportTouchIndices: number[];
}): Array<{ high: number; low: number }> {
  const { length, resistanceLine, supportLine, resistanceTouchIndices, supportTouchIndices } = opts;
  const resSet = new Set(resistanceTouchIndices);
  const supSet = new Set(supportTouchIndices);
  const out: Array<{ high: number; low: number }> = [];
  for (let i = 0; i < length; i++) {
    // Baseline sempre 200 pontos afastada da linha-alvo NA MESMA direção
    // dela (nunca constante em valor absoluto) — garante que a baseline
    // em si é monotônica/plana na mesma forma da linha real, então nunca
    // cria um pico/fundo local espúrio fora dos toques escolhidos (prova
    // no cabeçalho do arquivo original do motor). 200 (não um valor menor
    // como 40) é deliberado: para as linhas de slope=20 usadas abaixo,
    // um offset de exatamente 2×slope colidiria numericamente com o
    // vizinho fractal (k=2) do próprio toque, empatando a comparação
    // estrita de findSwings (empate desqualifica, não é só violação) e
    // apagando silenciosamente o toque pretendido — confirmado via script
    // de depuração direto contra fractal-swings.js. 200 fica bem longe de
    // qualquer colisão desse tipo para todas as slopes usadas neste arquivo.
    const high = resSet.has(i) ? resistanceLine(i) : resistanceLine(i) - 200;
    const low = supSet.has(i) ? supportLine(i) : supportLine(i) + 200;
    out.push({ high, low });
  }
  return out;
}

describe('detectTrianglePattern: ASCENDENTE (resistência flat + suporte subindo) => BULLISH', () => {
  it('geometria exata: 3 toques por linha, R²=1.0 nas duas, ápice real à frente', () => {
    const candles = buildTriangleCandles({
      length: 90,
      resistanceLine: () => 65000,
      supportLine: (i) => 63000 + 20 * i,
      resistanceTouchIndices: [50, 65, 80],
      supportTouchIndices: [55, 70, 85],
    });
    const hit = detectTrianglePattern({ candles });
    expect(hit, 'nenhum triângulo detectado').not.toBeNull();
    expect(hit!.contractVersion).toBe(TRIANGLE_CONTRACT_VERSION);
    expect(hit!.kind).toBe('ASCENDING');
    expect(hit!.direction).toBe('BULLISH');
    expect(hit!.fitScore).toBeCloseTo(1.0, 6);
    expect(hit!.resistanceAtLastCandle).toBeCloseTo(65000, 6);
    // supportLine(89) = 63000 + 20*89 = 64780
    expect(hit!.supportAtLastCandle).toBeCloseTo(64780, 6);
    // ápice real: interseção de y=65000 (flat) com y=63000+20x => x=100
    expect(hit!.apexIndex).not.toBeNull();
    expect(hit!.apexIndex!).toBeCloseTo(100, 6);
    expect(hit!.resistancePoints.length).toBe(3);
    expect(hit!.supportPoints.length).toBe(3);
  });
});

describe('detectTrianglePattern: DESCENDENTE (suporte flat + resistência descendo) => BEARISH', () => {
  it('geometria exata espelhada', () => {
    const candles = buildTriangleCandles({
      length: 90,
      resistanceLine: (i) => 66000 - 20 * i,
      supportLine: () => 63000,
      resistanceTouchIndices: [50, 65, 80],
      supportTouchIndices: [55, 70, 85],
    });
    const hit = detectTrianglePattern({ candles });
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe('DESCENDING');
    expect(hit!.direction).toBe('BEARISH');
    expect(hit!.fitScore).toBeCloseTo(1.0, 6);
    expect(hit!.supportAtLastCandle).toBeCloseTo(63000, 6);
  });
});

describe('detectTrianglePattern: SIMÉTRICO (as 2 linhas convergem) => direção HONESTAMENTE null', () => {
  it('geometria de convergência real, mas a literatura confirma que o lado do rompimento não é geométrico — nunca uma direção fabricada', () => {
    const candles = buildTriangleCandles({
      length: 90,
      resistanceLine: (i) => 67000 - 15 * i,
      supportLine: (i) => 62000 + 15 * i,
      resistanceTouchIndices: [50, 65, 80],
      supportTouchIndices: [55, 70, 85],
    });
    const hit = detectTrianglePattern({ candles });
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe('SYMMETRICAL');
    expect(hit!.direction).toBeNull();
    expect(hit!.fitScore).toBeCloseTo(1.0, 6);
  });
});

describe('detectTrianglePattern: fail-closed real (Regra de Ouro 3 — nunca fabrica um triângulo)', () => {
  it('linhas paralelas subindo juntas (nunca convergem) => null, não é nenhum dos 3 tipos', () => {
    const candles = buildTriangleCandles({
      length: 90,
      resistanceLine: (i) => 65000 + 25 * i,
      supportLine: (i) => 63000 + 25 * i,
      resistanceTouchIndices: [50, 65, 80],
      supportTouchIndices: [55, 70, 85],
    });
    expect(detectTrianglePattern({ candles })).toBeNull();
  });

  it('só 1 toque na resistência (abaixo do mínimo real de 2 por linha) => null', () => {
    const candles = buildTriangleCandles({
      length: 90,
      resistanceLine: () => 65000,
      supportLine: (i) => 63000 + 20 * i,
      resistanceTouchIndices: [80],
      supportTouchIndices: [55, 70, 85],
    });
    expect(detectTrianglePattern({ candles })).toBeNull();
  });

  it('toque mais recente fora da tolerância de frescor (padrão velho) => null', () => {
    const candles = buildTriangleCandles({
      length: 90,
      resistanceLine: () => 65000,
      supportLine: (i) => 63000 + 20 * i,
      resistanceTouchIndices: [10, 25, 40], // nada depois do índice 40 — muito longe do candle 89
      supportTouchIndices: [15, 30, 45],
    });
    expect(detectTrianglePattern({ candles })).toBeNull();
  });

  it('amostra insuficiente => null sem tentar detectar', () => {
    expect(detectTrianglePattern({ candles: [{ high: 100, low: 99 }, { high: 101, low: 100 }] })).toBeNull();
  });

  it('exatamente 2 toques por linha (mínimo real da definição): R² satura em 1.0 por definição matemática — documentado, não é fabricação', () => {
    const candles = buildTriangleCandles({
      length: 90,
      resistanceLine: () => 65000,
      supportLine: (i) => 63000 + 20 * i,
      resistanceTouchIndices: [65, 82],
      supportTouchIndices: [68, 85],
    });
    const hit = detectTrianglePattern({ candles });
    expect(hit).not.toBeNull();
    expect(hit!.resistancePoints.length).toBe(2);
    expect(hit!.fitScore).toBeCloseTo(1.0, 6);
  });

  it('MIN_TRIANGLE_FIT_SCORE é o piso real documentado (0.75, mesmo padrão dos outros motores de padrão)', () => {
    expect(MIN_TRIANGLE_FIT_SCORE).toBe(0.75);
  });
});
