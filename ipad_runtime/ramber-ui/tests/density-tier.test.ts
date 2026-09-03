// density-tier.test.ts — Ordem 3 §40 (TERMINAL DENSITY): execução real de
// resolveDensityTier contra os limiares já reais (1120/1440) e larguras de
// dispositivo reais, mesmo espírito de chart-ultrawide-scale.test.ts.
import { describe, it, expect } from 'vitest';
import { resolveDensityTier, DENSITY_COMPACT_MAX_PX, DENSITY_EXPANDED_MIN_PX } from '../src/nexus/density-tier';

describe('resolveDensityTier: fronteiras exatas, reusando os limiares já reais do app (1120/1440)', () => {
  it('COMPACT até o último px estreito de App.tsx (1119)', () => {
    expect(resolveDensityTier(1)).toBe('COMPACT');
    expect(resolveDensityTier(768)).toBe('COMPACT'); // iPad Mini portrait
    expect(resolveDensityTier(834)).toBe('COMPACT'); // iPad Pro 11" portrait
    expect(resolveDensityTier(1024)).toBe('COMPACT'); // iPad Mini landscape / iPad Pro portrait largo
    expect(resolveDensityTier(1119)).toBe('COMPACT');
  });

  it('STANDARD no meio-termo real (1120 até 1439) — onde iPad landscape e laptops caem', () => {
    expect(resolveDensityTier(1120)).toBe('STANDARD'); // exatamente onde min-[1120px]: liga
    expect(resolveDensityTier(1194)).toBe('STANDARD'); // iPad Pro 11" landscape
    expect(resolveDensityTier(1366)).toBe('STANDARD'); // laptop comum
    expect(resolveDensityTier(1439)).toBe('STANDARD'); // último px antes do piso de resolveChartUltraWideScale
  });

  it('EXPANDED a partir do mesmo piso de resolveChartUltraWideScale (1440)', () => {
    expect(resolveDensityTier(1440)).toBe('EXPANDED');
    expect(resolveDensityTier(1920)).toBe('EXPANDED'); // desktop comum
    expect(resolveDensityTier(2560)).toBe('EXPANDED'); // 4K
    expect(resolveDensityTier(3440)).toBe('EXPANDED'); // ultrawide 21:9
  });

  it('fail-closed: largura inválida cai em STANDARD, nunca num extremo', () => {
    expect(resolveDensityTier(NaN)).toBe('STANDARD');
    expect(resolveDensityTier(0)).toBe('STANDARD');
    expect(resolveDensityTier(-100)).toBe('STANDARD');
    expect(resolveDensityTier(Infinity)).toBe('STANDARD');
  });

  it('as constantes exportadas batem exatamente com a lógica (nenhum número redigitado à parte)', () => {
    expect(resolveDensityTier(DENSITY_COMPACT_MAX_PX)).toBe('COMPACT');
    expect(resolveDensityTier(DENSITY_COMPACT_MAX_PX + 1)).toBe('STANDARD');
    expect(resolveDensityTier(DENSITY_EXPANDED_MIN_PX - 1)).toBe('STANDARD');
    expect(resolveDensityTier(DENSITY_EXPANDED_MIN_PX)).toBe('EXPANDED');
  });

  it('monotônico: aumentar a largura nunca reduz a densidade (COMPACT→STANDARD→EXPANDED, nunca ao contrário)', () => {
    const order: Record<string, number> = { COMPACT: 0, STANDARD: 1, EXPANDED: 2 };
    const widths = [1, 320, 768, 1024, 1119, 1120, 1194, 1366, 1439, 1440, 1920, 2560, 3440, 5120];
    let prevRank = -1;
    for (const w of widths) {
      const rank = order[resolveDensityTier(w)];
      expect(rank).toBeGreaterThanOrEqual(prevRank);
      prevRank = rank;
    }
  });
});
