// hmm-regime-model.test.ts — execução REAL do motor puro HMM (Entrega 43,
// Laboratório de Evolução). Cada expectativa numérica de forward/Viterbi
// abaixo foi derivada à mão ANTES de rodar (mesma disciplina de
// tpo-profile.test.ts/zigzag-engine.test.ts), nunca hand-trace assumido
// como correto sem conferência.
import { describe, it, expect } from 'vitest';
import {
  forwardScaled,
  backwardScaled,
  baumWelch,
  viterbi,
  extractFeatureSeries,
  discretizeObservation,
  labelHmmStates,
  HMM_SYMBOL_COUNT,
  O1_BIN_EDGES,
  O2_BIN_EDGES,
  O3_BIN_EDGES,
} from '../../src/research/engines/hmm-regime-model.js';
import { computeAdx, classifyMarketRegime } from '../../src/market-regime/regime-engine.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

type Candle = { t: number; o: number; h: number; l: number; c: number };

// Uptrend real e determinístico (sem Math.random — reprodutível sempre):
// cada candle sobe `step` a partir do close anterior, pavio fixo.
function trendingCandles(n: number, start = 100, step = 0.6, wick = 0.3): Candle[] {
  const out: Candle[] = [];
  let prevClose = start;
  for (let i = 0; i < n; i++) {
    const open = prevClose;
    const close = open + step;
    const high = Math.max(open, close) + wick;
    const low = Math.min(open, close) - wick;
    out.push({ t: i * 60_000, o: open, h: high, l: low, c: close });
    prevClose = close;
  }
  return out;
}

// Sequência determinística de símbolos (0..M-1) sem Math.random — padrão
// fixo reprodutível, usada só para provar estabilidade numérica em
// sequências longas (nunca para hand-verificar um valor exato).
function deterministicSymbols(length: number, m: number): number[] {
  return Array.from({ length }, (_, i) => (i * 7 + 3) % m);
}

describe('forwardScaled: caso 2 estados / 2 símbolos hand-derivado à mão', () => {
  // A = [[0.7,0.3],[0.3,0.7]]; B = [[0.9,0.1],[0.1,0.9]]; pi=[0.5,0.5]; obs=[0,1]
  // alpha_0 (unscaled) = [0.45, 0.05], soma=0.5 -> alphaHat_0 = [0.9, 0.1]
  // alpha_1 pre-escala = [ (0.9*0.7+0.1*0.3)*0.1, (0.9*0.3+0.1*0.7)*0.9 ] = [0.066, 0.306]
  // soma=0.372 -> alphaHat_1 = [0.066/0.372, 0.306/0.372] = [11/62, 51/62]
  // logLikelihood = ln(raw0 * raw1) = ln(0.5 * 0.372) = ln(0.186)
  const A = [[0.7, 0.3], [0.3, 0.7]];
  const B = [[0.9, 0.1], [0.1, 0.9]];
  const pi = [0.5, 0.5];
  const obs = [0, 1];

  it('alphaHat soma 1.0 em cada instante t (propriedade real do escalonamento)', () => {
    const { alpha } = forwardScaled(obs, A, B, pi);
    expect(alpha[0][0] + alpha[0][1]).toBeCloseTo(1, 10);
    expect(alpha[1][0] + alpha[1][1]).toBeCloseTo(1, 10);
  });

  it('alphaHat[0] = [0.9, 0.1] (hand-derivado)', () => {
    const { alpha } = forwardScaled(obs, A, B, pi);
    expect(alpha[0][0]).toBeCloseTo(0.9, 10);
    expect(alpha[0][1]).toBeCloseTo(0.1, 10);
  });

  it('alphaHat[1] = [11/62, 51/62] (hand-derivado)', () => {
    const { alpha } = forwardScaled(obs, A, B, pi);
    expect(alpha[1][0]).toBeCloseTo(11 / 62, 10);
    expect(alpha[1][1]).toBeCloseTo(51 / 62, 10);
  });

  it('logLikelihood = ln(0.186) (hand-derivado via alpha bruto: 0.5 * 0.372)', () => {
    const { logLikelihood } = forwardScaled(obs, A, B, pi);
    expect(logLikelihood).toBeCloseTo(Math.log(0.186), 10);
  });

  it('sequência vazia devolve alpha/c vazios e logLikelihood null (fail-closed)', () => {
    const r = forwardScaled([], A, B, pi);
    expect(r.alpha).toEqual([]);
    expect(r.logLikelihood).toBeNull();
  });
});

describe('backwardScaled: gamma (alpha*beta normalizado) soma 1.0 em cada t', () => {
  it('propriedade real (Rabiner): gamma_t é uma distribuição de probabilidade real', () => {
    const A = [[0.6, 0.4], [0.4, 0.6]];
    const B = [[0.8, 0.2], [0.2, 0.8]];
    const pi = [0.5, 0.5];
    const obs = [0, 0, 1, 1, 0];
    const { alpha, c } = forwardScaled(obs, A, B, pi);
    const beta = backwardScaled(obs, A, B, c);
    for (let t = 0; t < obs.length; t++) {
      let denom = 0;
      for (let j = 0; j < 2; j++) denom += alpha[t][j] * beta[t][j];
      const gamma0 = (alpha[t][0] * beta[t][0]) / denom;
      const gamma1 = (alpha[t][1] * beta[t][1]) / denom;
      expect(gamma0 + gamma1).toBeCloseTo(1, 8);
    }
  });
});

describe('viterbi: mesmo A/B/pi hand-derivado do forward, obs=[0,1]', () => {
  const A = [[0.7, 0.3], [0.3, 0.7]];
  const B = [[0.9, 0.1], [0.1, 0.9]];
  const pi = [0.5, 0.5];

  it('caminho ótimo é [0,1] — evidência de emissão no t=1 supera a penalidade de transição (hand-derivado)', () => {
    // delta_1(0) = ln(0.315*0.1) = ln(0.0315); delta_1(1) = ln(0.135*0.9) = ln(0.1215)
    // 0.1215 > 0.0315 -> estado 1 vence, veio de i=0
    const { states, logProbability } = viterbi([0, 1], A, B, pi);
    expect(states).toEqual([0, 1]);
    expect(logProbability).toBeCloseTo(Math.log(0.1215), 10);
  });

  it('1 única observação: argmax(pi_i * B_i(obs0)) = estado 0 (0.45 > 0.05, hand-derivado)', () => {
    const { states, logProbability } = viterbi([0], A, B, pi);
    expect(states).toEqual([0]);
    expect(logProbability).toBeCloseTo(Math.log(0.45), 10);
  });

  it('sequência vazia devolve states=[] e logProbability null (fail-closed)', () => {
    const r = viterbi([], A, B, pi);
    expect(r.states).toEqual([]);
    expect(r.logProbability).toBeNull();
  });
});

describe('baumWelch: propriedades reais do EM (Rabiner §III-C), nunca supostas', () => {
  it('log-likelihood não decresce com mais iterações disponíveis (tolerance=0 força rodar até o teto)', () => {
    const obs = deterministicSymbols(60, 9);
    const r1 = baumWelch(obs, 3, 9, { maxIterations: 1, tolerance: 0 });
    const r20 = baumWelch(obs, 3, 9, { maxIterations: 20, tolerance: 0 });
    expect(r20!.logLikelihood).toBeGreaterThanOrEqual(r1!.logLikelihood! - 1e-9);
  });

  it('converge dentro do maxIterations declarado', () => {
    const obs = deterministicSymbols(80, 9);
    const r = baumWelch(obs, 3, 9, { maxIterations: 100 });
    expect(r!.iterations).toBeLessThanOrEqual(100);
    expect(r!.iterations).toBeGreaterThan(0);
  });

  it('A, B e pi continuam distribuições de probabilidade reais após o treino (cada linha soma 1)', () => {
    const obs = deterministicSymbols(60, 9);
    const r = baumWelch(obs, 3, 9, { maxIterations: 15 });
    const piSum = r!.pi.reduce((a, b) => a + b, 0);
    expect(piSum).toBeCloseTo(1, 6);
    for (const row of r!.A) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    for (const row of r!.B) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('REGRESSÃO (achado real do documento externo rejeitado): sequência longa (500 observações) não sofre underflow — logLikelihood finito, zero NaN em A/B/pi', () => {
    // O forward/backward NÃO escalonado do documento externo (HMMAlgorithms.ts
    // rejeitado) some para 0 por volta de 150-200 passos com esta mesma
    // distribuição quase uniforme de símbolos — Baum-Welch reportava
    // "convergência" falsa (log-likelihood grudado numa constante) sem
    // aprender nada. Esta é a prova de que o escalonamento real (Rabiner
    // §V-A) usado aqui corrige isso.
    const obs = deterministicSymbols(500, HMM_SYMBOL_COUNT);
    const r = baumWelch(obs, 3, HMM_SYMBOL_COUNT, { maxIterations: 10 });
    expect(Number.isFinite(r!.logLikelihood)).toBe(true);
    expect(r!.pi.every((v) => Number.isFinite(v))).toBe(true);
    for (const row of r!.A) expect(row.every((v) => Number.isFinite(v))).toBe(true);
    for (const row of r!.B) expect(row.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('sequência vazia devolve null (fail-closed, nunca um modelo fabricado)', () => {
    expect(baumWelch([], 3, 9)).toBeNull();
  });
});

describe('extractFeatureSeries: reusa computeAdx/computeAtrPercent JÁ graduados — zero segunda curva', () => {
  it('candles insuficientes (< 2*adxPeriod+2) -> [] honesto, nunca uma feature fabricada', () => {
    expect(extractFeatureSeries(trendingCandles(10))).toEqual([]);
  });

  it('o3 de um índice real bate EXATAMENTE com computeAdx(...).adx/100 na mesma janela — prova de reuso, não reimplementação', () => {
    const candles = trendingCandles(120);
    const features = extractFeatureSeries(candles);
    expect(features.length).toBeGreaterThan(0);
    const first = features[0];
    const adxWindow = 2 * 14 + 1;
    const windowSlice = candles.slice(first.index - adxWindow + 1, first.index + 1);
    const direct = computeAdx(windowSlice, 14);
    expect(first.o3).toBeCloseTo(direct!.adx / 100, 10);
  });

  it('série real de uptrend produz o3 (ADX/100) positivo e finito em todos os pontos (tendência real detectada)', () => {
    const features = extractFeatureSeries(trendingCandles(150));
    expect(features.length).toBeGreaterThan(50);
    for (const f of features) {
      expect(Number.isFinite(f.o3)).toBe(true);
      expect(f.o3).toBeGreaterThanOrEqual(0);
    }
  });

  it('candles vazios ou não-array -> [] honesto', () => {
    expect(extractFeatureSeries([])).toEqual([]);
    expect(extractFeatureSeries(null as any)).toEqual([]);
  });
});

describe('discretizeObservation: binning 3x3x3 = 27 símbolos, limiares documentados', () => {
  it('valor exatamente no limiar inferior de cada eixo cai no bin 1 (>=), nunca no bin 0', () => {
    const sym = discretizeObservation({ o1: O1_BIN_EDGES[0], o2: O2_BIN_EDGES[0], o3: O3_BIN_EDGES[0] });
    // b1=1 (o1 no limiar -> não é < edge[0]), idem b2/b3 -> símbolo = 1*9+1*3+1 = 13
    expect(sym).toBe(13);
  });

  it('valores bem abaixo de todos os limiares -> bin 0 em cada eixo -> símbolo 0', () => {
    expect(discretizeObservation({ o1: -10, o2: -10, o3: -10 })).toBe(0);
  });

  it('valores bem acima de todos os limiares -> bin 2 em cada eixo -> símbolo máximo 26', () => {
    expect(discretizeObservation({ o1: 10, o2: 10, o3: 10 })).toBe(HMM_SYMBOL_COUNT - 1);
  });
});

describe('labelHmmStates: rótulo por CONCORDÂNCIA empírica real com regime-engine.js, nunca suposição de índice', () => {
  it('estado com candles reais consistentemente no mesmo regime real é rotulado com ESSE regime (nunca um índice fixo assumido)', () => {
    const candles = trendingCandles(150);
    const features = extractFeatureSeries(candles);
    // Todos os candles atribuídos ao estado 0 (hand-construído, não um
    // Viterbi real) — a votação deve convergir para o regime real que
    // classifyMarketRegime de fato devolve nessas janelas.
    const states = features.map(() => 0);
    const labels = labelHmmStates(candles, features, states);
    expect(labels).toHaveLength(1);
    const lastWindow = candles.slice(Math.max(0, features[features.length - 1].index - 99), features[features.length - 1].index + 1);
    const real = classifyMarketRegime({ ohlcv_series: lastWindow });
    expect(real.status).toBe('OK');
    expect(labels[0]).toBe(real.regime);
  });

  it('estado sem nenhum candle atribuído (nunca aparece em states) fica null — nunca um rótulo fabricado', () => {
    const candles = trendingCandles(150);
    const features = extractFeatureSeries(candles);
    const states = features.map(() => 0);
    states[0] = 2; // só 1 candle no estado 2, resto no estado 0 -> estado 1 nunca aparece
    const labels = labelHmmStates(candles, features, states);
    expect(labels).toHaveLength(3);
    expect(labels[1]).toBeNull();
  });
});

describe('hmm-regime-model: FRONTEIRA (Laboratório de Evolução) — nenhum módulo de produção importa ainda', () => {
  it('hmm-regime-model.js não é importado por engine-bridge.ts nem qualquer outro caminho de produção — só testes (ver QUARANTINE.md)', () => {
    const roots = [resolve(here, '../src'), resolve(here, '../../src')];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(p);
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && p !== resolve(here, '../../src/research/engines/hmm-regime-model.js')) {
          const src = readFileSync(p, 'utf8');
          if (src.includes('research/engines/hmm-regime-model')) offenders.push(p);
        }
      }
    };
    for (const root of roots) walk(root);
    expect(offenders).toEqual([]);
  });
});
