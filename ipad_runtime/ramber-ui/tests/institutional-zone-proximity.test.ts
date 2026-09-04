// institutional-zone-proximity.test.ts — Ordem "Lapidação Visual Final +
// Nova Linguagem de Gráfico" §3 ("faixa que ganha intensidade apenas
// quando o preço se aproxima"): execução REAL da curva de decaimento por
// distância (matemática nova, não fiação — convenção mista do CLAUDE.md).
import { describe, it, expect } from 'vitest';
import { proximityFactor } from '../src/chart/InstitutionalZonePlugin';

describe('proximityFactor: intensidade real por distância ao preço vivo, nunca some por completo', () => {
  it('fail-closed: sem preço vivo (carregamento inicial), fator neutro 1 — comportamento idêntico ao de antes desta correção', () => {
    expect(proximityFactor(100, null)).toBe(1);
    expect(proximityFactor(100, undefined)).toBe(1);
    expect(proximityFactor(100, NaN)).toBe(1);
    expect(proximityFactor(100, 0)).toBe(1);
    expect(proximityFactor(100, -5)).toBe(1);
  });

  it('dentro de 0.5% de distância: boost pleno (fator 1)', () => {
    expect(proximityFactor(100, 100)).toBe(1); // exatamente no preço
    expect(proximityFactor(100.4, 100)).toBe(1); // 0.4% — dentro do limiar
    expect(proximityFactor(100.5, 100)).toBe(1); // exatamente no limiar
  });

  it('a partir de 3% de distância: piso 0.5 — nunca menos (a zona nunca desaparece só por estar longe)', () => {
    expect(proximityFactor(103, 100)).toBe(0.5);
    expect(proximityFactor(200, 100)).toBe(0.5); // muito longe — mesmo piso, nunca fica negativo/zero
  });

  it('entre 0.5% e 3%: interpolação linear real, nunca um degrau abrupto', () => {
    // meio do caminho (1.75%) => meio do caminho entre 1 e 0.5 => 0.75
    const f = proximityFactor(101.75, 100);
    expect(f).toBeCloseTo(0.75, 10);
  });

  it('distância é sempre absoluta — zona acima ou abaixo do preço recebe o mesmo tratamento', () => {
    expect(proximityFactor(101, 100)).toBe(proximityFactor(99, 100));
  });

  it('nunca produz um fator fora de [0.5, 1] — garantia de faixa, qualquer distância real', () => {
    for (const dist of [0, 0.1, 0.5, 1, 1.75, 3, 5, 50]) {
      const f = proximityFactor(100 + dist, 100);
      expect(f).toBeGreaterThanOrEqual(0.5);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});
