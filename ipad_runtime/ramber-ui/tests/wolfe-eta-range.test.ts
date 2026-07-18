// wolfe-eta-range.test.ts — Diretriz Mestra §9 (Wolfe Waves) + §6 (faixa
// mínimo–provável da ETA): execução real das duas extensões.
import { describe, it, expect } from 'vitest';
import { detectHarmonicPatterns, MIN_FIT_SCORE } from '../src/nexus/harmonic-patterns';
import { computeTargetEtas, formatEtaRange } from '../src/nexus/eta-engine';
import type { TradePlan } from '../src/nexus/trade-plan';

const c = (v: number) => ({ high: v, low: v });

// Mesma técnica de fixture dos XABCD (lead-in + 5 candles/perna + cauda).
function zigzagFromPivots(pivots: number[], tailDirection: 1 | -1 = 1): Array<{ high: number; low: number }> {
  const out: Array<{ high: number; low: number }> = [];
  const firstStep = Math.abs(pivots[1] - pivots[0]) / 5;
  const leadSign = pivots[1] > pivots[0] ? 1 : -1;
  out.push(c(pivots[0] + leadSign * firstStep * 2), c(pivots[0] + leadSign * firstStep));
  for (let i = 0; i < pivots.length; i++) {
    if (i === 0) { out.push(c(pivots[0])); continue; }
    const from = pivots[i - 1];
    const to = pivots[i];
    for (let step = 1; step <= 5; step++) out.push(c(from + ((to - from) * step) / 5));
  }
  const last = pivots[pivots.length - 1];
  const away = tailDirection * Math.abs(last) * 0.001 || tailDirection;
  out.push(c(last + away), c(last + away * 2), c(last + away * 3));
  return out;
}

describe('Wolfe Waves (§9, geometria CORRIGIDA na Consolidação Final §6): cunha convergente real + ETA no ápice', () => {
  // CORREÇÃO REAL documentada no módulo: a v1 exigia |s24|/|s13| em (0,1),
  // mas o gap entre as linhas é L24−L13 com derivada s24−s13 — com as duas
  // descendo, ele só ENCOLHE quando a 2→4 é mais íngreme (razão > 1). A
  // fixture antiga [1000,1080,960,1060,907] (conv 0.5) era uma formação que
  // ALARGA — virou o caso de rejeição abaixo (flip de regressão proposital).
  //
  // Fixture canônica (pivôs a cada 5 barras; 1 em idx 2, 5 em idx 22):
  //   1=1000(L) 2=1090(H) 3=980(L<1) 4=1040(H<2, >1) 5=954.5(L)
  //   s13 = (980−1000)/10 = −2 · s24 = (1040−1090)/10 = −5 · conv = 2.5 ✓
  //   L13@22 = 1000−2·20 = 960 · L24@22 = 1090−5·15 = 1015 · altura = 55
  //   overshoot = (960−954.5)/55 = 0.1 (ideal 0–0.25) ✓ → fit 1.0
  //   EPA: s14 = (1040−1000)/15 = 8/3 · EPA@22 = 1000 + (8/3)·20 = 1053.33
  //   ETA (ápice 1→3 × 2→4): t = (1090+35−1000−4)/(−2+5) = 121/3 ≈ 40.333
  const bullishWolfe = [1000, 1090, 980, 1040, 954.5];

  it('bullish Wolfe canônica: fit 1.0, EPA e ETA (ápice À FRENTE do ponto 5) exatos', () => {
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots(bullishWolfe, 1), maxPatterns: 5 });
    const w = hits.find((h) => h.pattern === 'WOLFE');
    expect(w, JSON.stringify(hits.map((h) => h.pattern))).toBeDefined();
    expect(w!.direction).toBe('BULLISH');
    expect(w!.fitScore).toBeCloseTo(1, 5);
    expect(w!.ratios.WOLFE_OVERSHOOT).toBeCloseTo(0.1, 6);
    expect(w!.ratios.WOLFE_CONVERGENCE).toBeCloseTo(2.5, 6);
    expect(w!.epaPrice).toBeCloseTo(1053.3333333, 5);
    expect(w!.etaIndex).toBeCloseTo(121 / 3, 5);
    expect(w!.etaIndex!).toBeGreaterThan(w!.points.D.index); // ápice sempre à frente do 5
  });

  it('bearish Wolfe espelhada também detecta, com a mesma geometria', () => {
    const bearish = bullishWolfe.map((p) => 2100 - p); // espelho
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots(bearish, -1), maxPatterns: 5 });
    const w = hits.find((h) => h.pattern === 'WOLFE');
    expect(w).toBeDefined();
    expect(w!.direction).toBe('BEARISH');
    expect(w!.ratios.WOLFE_CONVERGENCE).toBeCloseTo(2.5, 6);
  });

  it('ponto 5 SEM overshoot (acima da linha 1→3 além da folga) => sem Wolfe', () => {
    // 5=970: overshoot = (960−970)/55 ≈ −0.18 < −0.05 => rejeita
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1090, 980, 1040, 970], 1), maxPatterns: 5 });
    expect(hits.find((h) => h.pattern === 'WOLFE')).toBeUndefined();
  });

  it('REGRESSÃO DA CORREÇÃO: cunha que ALARGA (razão < 1, a fixture antiga) => sem Wolfe', () => {
    // s13 = −4, s24 = −2 => conv 0.5: gap cresce para frente, ápice no
    // passado — exatamente o que a v1 aceitava por engano.
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1080, 960, 1060, 907], 1), maxPatterns: 5 });
    expect(hits.find((h) => h.pattern === 'WOLFE')).toBeUndefined();
  });
});

describe('ETA §6: faixa [mínimo, provável] do MESMO modelo (piso = ER 1)', () => {
  const plan: TradePlan = {
    contractVersion: 2,
    direction: 'LONG',
    entry: { low: 99, high: 100, basis: 'OB_BULLISH' },
    stop: { price: 95, basis: 'SR_SUPPORT_1' },
    targets: [{ price: 110, basis: 'EQH' }],
    riskRewardRatios: [2],
    computedAt: 0,
  };
  // closes com progresso direcional: ER < 1 real
  const closes = [90, 92, 91, 94, 93, 96, 95, 98, 97, 100, 99, 100];

  it('msMin <= ms sempre, e barsMin = distância/ATR exato', () => {
    const r = computeTargetEtas({ plan, targetsHit: 0, livePrice: 100, atrPercent: 2, closes, timeframeMs: 60_000 });
    expect(r.status).toBe('OK');
    const eta = r.etas[0]!;
    expect(eta.msMin).toBeLessThanOrEqual(eta.ms);
    // ATR abs = 2, distância = 10 => barsMin = 5 exato
    expect(eta.barsMin).toBeCloseTo(5, 10);
    expect(eta.msMin).toBeCloseTo(5 * 60_000, 6);
  });

  it('formatEtaRange: "≈ 5m–?" quando difere; colapsa para o simples quando arredonda igual; null honesto', () => {
    expect(formatEtaRange(5 * 60_000, 20 * 60_000)).toBe('≈ 5m–20m');
    expect(formatEtaRange(7 * 60_000, 7 * 60_000)).toBe('≈ 7m');
    expect(formatEtaRange(null, 20 * 60_000)).toBe('≈ 20m'); // sem min => só o provável
    expect(formatEtaRange(5 * 60_000, null)).toBeNull(); // sem provável => nada (nunca só um piso solto)
  });
});
