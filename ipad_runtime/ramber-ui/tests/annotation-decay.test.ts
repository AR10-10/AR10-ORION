// annotation-decay.test.ts — Ordem "Ciborgue Vivo" §1: real-execution
// tests for the shared age-based fade function (LiquidityZonesPlugin +
// StructureBreakMarkersPlugin both import this same function — locking it
// here locks both callers at once).
import { describe, it, expect } from 'vitest';
import { ageAlpha, type DecayConfig } from '../src/chart/annotation-decay';

const CONFIG: DecayConfig = { fadeStartCandles: 30, expireCandles: 100, minAlpha: 0.15 };

describe('ageAlpha: decaimento real por idade em candles', () => {
  it('idade 0 e qualquer idade <= fadeStartCandles => opacidade total (1)', () => {
    expect(ageAlpha(0, CONFIG)).toBe(1);
    expect(ageAlpha(15, CONFIG)).toBe(1);
    expect(ageAlpha(30, CONFIG)).toBe(1); // fronteira inclusiva
  });

  it('idade >= expireCandles => 0 (esquecida)', () => {
    expect(ageAlpha(100, CONFIG)).toBe(0); // fronteira inclusiva
    expect(ageAlpha(150, CONFIG)).toBe(0);
  });

  it('meio do caminho entre fadeStart e expire => opacidade a meio caminho entre 1 e minAlpha', () => {
    const mid = (CONFIG.fadeStartCandles + CONFIG.expireCandles) / 2; // 65
    const expected = 1 - 0.5 * (1 - CONFIG.minAlpha);
    expect(ageAlpha(mid, CONFIG)).toBeCloseTo(expected, 10);
  });

  it('monotonicamente decrescente entre fadeStart e expire — nunca sobe com o tempo', () => {
    let prev = ageAlpha(CONFIG.fadeStartCandles, CONFIG);
    for (let age = CONFIG.fadeStartCandles + 1; age <= CONFIG.expireCandles; age++) {
      const current = ageAlpha(age, CONFIG);
      expect(current).toBeLessThanOrEqual(prev);
      prev = current;
    }
  });

  it('nunca desce abaixo de minAlpha antes de expireCandles (piso real, não um zero prematuro)', () => {
    const justBeforeExpire = CONFIG.expireCandles - 1;
    expect(ageAlpha(justBeforeExpire, CONFIG)).toBeGreaterThanOrEqual(CONFIG.minAlpha - 1e-9);
  });

  it('configs diferentes (StructureBreakMarkersPlugin usa fadeStart=20) produzem curvas diferentes de forma independente', () => {
    const breakConfig: DecayConfig = { fadeStartCandles: 20, expireCandles: 100, minAlpha: 0.15 };
    // Na mesma idade (25), a zona (fadeStart 30) ainda está em opacidade
    // total; o rompimento (fadeStart 20) já começou a esmaecer.
    expect(ageAlpha(25, CONFIG)).toBe(1);
    expect(ageAlpha(25, breakConfig)).toBeLessThan(1);
  });
});
