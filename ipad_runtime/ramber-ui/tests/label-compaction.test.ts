// label-compaction.test.ts — Diretriz de Evolução Profissional, Fase 10,
// item P ("TP1/TP2/TP3 próximos sem colisão visual"): execução REAL da
// função pura extraída de EnhancedChart_110_Percent.tsx (Continuidade
// §6) — antes só existia como padrão de código inline, nunca provada
// matematicamente por execução.
import { describe, it, expect } from 'vitest';
import { shouldCompactLabels, TARGET_LABEL_COMPACT_PCT } from '../src/chart/label-compaction';

describe('shouldCompactLabels — TP1/TP2/TP3 (+ stop efetivo) próximos entram em modo compacto, nunca deslocam preço', () => {
  it('P: alvos MUITO próximos entre si (< 0.35% do ponto médio) => compacta — nunca haveria espaço real para os rótulos completos', () => {
    // stop 99.00, TP1 100.00, TP2 100.10 (0.10% de gap entre 100.00 e 100.10 — bem abaixo do limiar)
    const levels = [99.0, 100.0, 100.1].sort((a, b) => a - b);
    expect(shouldCompactLabels(levels)).toBe(true);
  });

  it('alvos bem espaçados (R:R real de uma estrutura saudável) => NUNCA compacta — rótulo completo (basis/R:R) permanece', () => {
    const levels = [95.0, 99.0, 105.0, 112.0].sort((a, b) => a - b); // stop 95, TP1 99, TP2 105, TP3 112 — gaps de vários % cada
    expect(shouldCompactLabels(levels)).toBe(false);
  });

  it('exatamente UM par apertado entre 3+ alvos já compacta TODOS os rótulos (decisão global, nunca por-alvo) — evita um TP "cheio" colidindo visualmente com um vizinho "compacto"', () => {
    const levels = [90.0, 95.0, 95.15, 120.0].sort((a, b) => a - b); // só o 2º par é apertado (95.0↔95.15)
    expect(shouldCompactLabels(levels)).toBe(true);
  });

  it('limiar documentado (0.35%, TARGET_LABEL_COMPACT_PCT): gap nitidamente maior não compacta, gap nitidamente menor compacta — nunca uma fronteira de ponto flutuante frágil', () => {
    expect(TARGET_LABEL_COMPACT_PCT).toBe(0.35);
    // gap de 0.5% do ponto médio — folgado o suficiente pro rótulo completo
    expect(shouldCompactLabels([100 - 0.25, 100 + 0.25])).toBe(false);
    // gap de 0.2% do ponto médio — apertado demais, precisa do modo compacto
    expect(shouldCompactLabels([100 - 0.1, 100 + 0.1])).toBe(true);
  });

  it('um único nível (stop sem alvo algum, ou plano de 1 alvo só) nunca compacta — não existe par adjacente para comparar', () => {
    expect(shouldCompactLabels([100])).toBe(false);
    expect(shouldCompactLabels([])).toBe(false);
  });

  it('espelho SHORT: mesma função pura, mesma matemática — direção nunca entra no cálculo (só os PREÇOS reais já ordenados)', () => {
    // SHORT: stop 105.20, TP1 100.00, TP2 99.90 — mesmo gap apertado do TP1↔TP2 do teste LONG acima
    const levels = [99.9, 100.0, 105.2].sort((a, b) => a - b);
    expect(shouldCompactLabels(levels)).toBe(true);
  });

  it('threshold customizado (parâmetro opcional) é honrado — nunca hardcoded na função, só no default exportado', () => {
    const levels = [100, 101]; // 1% de gap
    expect(shouldCompactLabels(levels, 0.5)).toBe(false); // 1% > 0.5% => não compacta
    expect(shouldCompactLabels(levels, 2)).toBe(true); // 1% < 2% => compacta
  });
});
