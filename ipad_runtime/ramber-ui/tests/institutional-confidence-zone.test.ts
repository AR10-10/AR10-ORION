// institutional-confidence-zone.test.ts — Diretriz Complementar §16
// ("Zona de Confiança Institucional"): execução real de
// institutionalConfidenceZone() em institutional-score.ts. Banda pura do
// mesmo score real já testado indiretamente via institutional-decision-
// layer — aqui trancam-se os 5 cortes/rótulos literais da diretriz.
import { describe, it, expect } from 'vitest';
import { institutionalConfidenceZone } from '../src/nexus/institutional-score';

describe('institutionalConfidenceZone: os 5 cortes exatos da diretriz §16', () => {
  it('90-100 => MUITO_FORTE', () => {
    expect(institutionalConfidenceZone(90)?.tier).toBe('MUITO_FORTE');
    expect(institutionalConfidenceZone(90)?.label).toBe('Muito Forte');
    expect(institutionalConfidenceZone(100)?.tier).toBe('MUITO_FORTE');
  });

  it('80-89 => FORTE', () => {
    expect(institutionalConfidenceZone(80)?.tier).toBe('FORTE');
    expect(institutionalConfidenceZone(89)?.tier).toBe('FORTE');
  });

  it('65-79 => MODERADA', () => {
    expect(institutionalConfidenceZone(65)?.tier).toBe('MODERADA');
    expect(institutionalConfidenceZone(79)?.tier).toBe('MODERADA');
  });

  it('50-64 => FRACA', () => {
    expect(institutionalConfidenceZone(50)?.tier).toBe('FRACA');
    expect(institutionalConfidenceZone(64)?.tier).toBe('FRACA');
  });

  it('< 50 => INVALIDA (leitura honesta, não um erro)', () => {
    expect(institutionalConfidenceZone(49)?.tier).toBe('INVALIDA');
    expect(institutionalConfidenceZone(0)?.tier).toBe('INVALIDA');
  });

  it('fronteiras exatas: 79.9 ainda MODERADA, 80.0 já FORTE (sem gap/overlap)', () => {
    expect(institutionalConfidenceZone(79.9)?.tier).toBe('MODERADA');
    expect(institutionalConfidenceZone(80.0)?.tier).toBe('FORTE');
  });

  it('cada tier expõe emoji + colorClass reais (nunca string vazia)', () => {
    for (const score of [10, 55, 70, 85, 95]) {
      const zone = institutionalConfidenceZone(score)!;
      expect(zone.emoji.length).toBeGreaterThan(0);
      expect(zone.colorClass).toMatch(/^text-\[#[0-9a-fA-F]{6}\]$/);
    }
  });

  it('score fora de [0,100] é clampado, nunca extrapolado para um tier inexistente', () => {
    expect(institutionalConfidenceZone(150)?.tier).toBe('MUITO_FORTE');
    expect(institutionalConfidenceZone(-20)?.tier).toBe('INVALIDA');
  });

  it('FAIL_CLOSED: score null (WAIT real, nada a bandar) => null honesto, nunca um tier fabricado', () => {
    expect(institutionalConfidenceZone(null)).toBeNull();
  });

  it('score não-finito (NaN/Infinity) => null honesto', () => {
    expect(institutionalConfidenceZone(NaN)).toBeNull();
    expect(institutionalConfidenceZone(Infinity)).toBeNull();
  });

  it('determinística: mesmo score, mesma zona', () => {
    expect(institutionalConfidenceZone(72)).toEqual(institutionalConfidenceZone(72));
  });
});
