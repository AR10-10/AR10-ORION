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

describe('Wolfe Waves (§9): cunha canônica com ponto 5 na sweet zone', () => {
  // Bullish: 1=1000(L) 2=1080(H) 3=980(L, abaixo de 1) 4=1040(H, <2 e >1)
  // 5 = na/além da linha 1→3 no tempo de 5. Pivôs a cada 5 barras:
  // slope13 = (980−1000)/10 = −2/barra; linha 1→3 em t5 (20 barras após 1):
  // 1000 − 40 = 960. Sweet zone: 5 um pouco ABAIXO de 960 (overshoot > 0).
  // Altura da cunha em t5: linha 2→4 slope = (1040−1080)/10 = −4;
  // valor em t5 = 1080 − 4×15 = 1020; altura = 1020 − 960 = 60.
  // 5 = 954 => overshoot = (960−954)/60 = 0.1 (dentro do ideal 0–0.25). ✓
  // Convergência = |−4|/|−2| = 2 => FORA de (0,1)! A cunha canônica
  // CONVERGE quando a linha 2→4 cai MAIS DEVAGAR (topos comprimindo).
  // Ajuste real: 2=1080, 4=1050 => slope24 = −3... ainda 1.5. A geometria
  // certa: |slope24| < |slope13| exige slope13 mais íngreme: 3=960 =>
  // slope13=−4; linha13(t5)=1000−80=920; 4=1060 => slope24=−2 (conv 0.5 ✓);
  // linha24(t5)=1080−2×15=1050; altura=130; 5=907 => overshoot=(920−907)/130=0.1 ✓
  const bullishWolfe = [1000, 1080, 960, 1060, 907];

  it('bullish Wolfe detectada com fit alto; EPA = linha 1→4 avaliada em t5', () => {
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots(bullishWolfe, 1), maxPatterns: 5 });
    const w = hits.find((h) => h.pattern === 'WOLFE');
    expect(w, JSON.stringify(hits.map((h) => h.pattern))).toBeDefined();
    expect(w!.direction).toBe('BULLISH');
    expect(w!.fitScore).toBeGreaterThanOrEqual(MIN_FIT_SCORE);
    expect(w!.ratios.WOLFE_OVERSHOOT).toBeGreaterThan(0);
    expect(w!.ratios.WOLFE_CONVERGENCE).toBeLessThan(1);
    // EPA: slope14 = (1060−1000)/15 = 4; em t5 (20 barras) => 1000+80 = 1080
    expect(w!.epaPrice).toBeCloseTo(1080, 6);
  });

  it('bearish Wolfe espelhada também detecta', () => {
    const bearish = bullishWolfe.map((p) => 2000 - p); // espelho em torno de 1000
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots(bearish, -1), maxPatterns: 5 });
    const w = hits.find((h) => h.pattern === 'WOLFE');
    expect(w).toBeDefined();
    expect(w!.direction).toBe('BEARISH');
  });

  it('ponto 5 SEM overshoot suficiente (bem acima da linha 1→3) => sem Wolfe', () => {
    // 5=940: overshoot = (920−940)/130 ≈ −0.154 < −0.05 => rejeita
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1080, 960, 1060, 940], 1), maxPatterns: 5 });
    expect(hits.find((h) => h.pattern === 'WOLFE')).toBeUndefined();
  });

  it('cunha que NÃO converge (linha 2→4 mais íngreme que 1→3) => sem Wolfe', () => {
    // slope13 = −2 (3=980), slope24 = −6 (4=1020): conv = 3 > 1 => rejeita
    const hits = detectHarmonicPatterns({ candles: zigzagFromPivots([1000, 1080, 980, 1020, 935], 1), maxPatterns: 5 });
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
