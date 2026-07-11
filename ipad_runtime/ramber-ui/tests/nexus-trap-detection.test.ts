// nexus-trap-detection.test.ts — V-MAX Fase 2: trava a detecção de
// armadilhas por CORROBORAÇÃO de eventos reais — sem evento, lista vazia;
// nunca uma armadilha especulativa.
import { describe, it, expect } from 'vitest';
import { detectInstitutionalTraps, TRAP_CORROBORATION_WINDOW_MS } from '../src/nexus/trap-detection';

const NOW = 1_000_000_000;
const eqh = (price: number, swept: boolean) => ({ type: 'EQUAL_HIGH' as const, price, swept });
const eql = (price: number, swept: boolean) => ({ type: 'EQUAL_LOW' as const, price, swept });
const sig = (type: string, ageMs: number) => ({ type, timestamp: NOW - ageMs });

describe('detectInstitutionalTraps: só eventos REAIS contam', () => {
  it('sem sweep e sem sinais => lista vazia honesta', () => {
    expect(detectInstitutionalTraps({ liquidityZones: [eqh(110, false), eql(90, false)], orderflowSignals: [], now: NOW })).toEqual([]);
  });

  it('EQH varrido sozinho => STOP_HUNT_TOPO com confiança 1/3 (evento real, interpretação fraca)', () => {
    const traps = detectInstitutionalTraps({ liquidityZones: [eqh(110, true)], orderflowSignals: [], now: NOW });
    expect(traps).toHaveLength(1);
    expect(traps[0].kind).toBe('STOP_HUNT_TOPO');
    expect(traps[0].confidence).toBeCloseTo(1 / 3, 12);
    expect(traps[0].evidence[0]).toContain('110.00');
  });

  it('sweep + 1 sinal real na janela => 2/3; + 2 sinais => 1.0 (escada documentada)', () => {
    const one = detectInstitutionalTraps({
      liquidityZones: [eql(90, true)],
      orderflowSignals: [sig('ABSORPTION', 5_000)],
      now: NOW,
    });
    expect(one[0].kind).toBe('STOP_HUNT_FUNDO');
    expect(one[0].confidence).toBeCloseTo(2 / 3, 12);

    const two = detectInstitutionalTraps({
      liquidityZones: [eql(90, true)],
      orderflowSignals: [sig('ABSORPTION', 5_000), sig('EXHAUSTION', 10_000)],
      now: NOW,
    });
    expect(two[0].confidence).toBe(1);
  });

  it('sinal FORA da janela real não corrobora', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [eqh(110, true)],
      orderflowSignals: [sig('ABSORPTION', TRAP_CORROBORATION_WINDOW_MS + 1)],
      now: NOW,
    });
    expect(traps[0].confidence).toBeCloseTo(1 / 3, 12);
  });

  it('sinais OFI não contam como corroboração de sweep (só ABSORPTION/EXHAUSTION)', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [eqh(110, true)],
      orderflowSignals: [sig('OFI', 1_000)],
      now: NOW,
    });
    expect(traps[0].confidence).toBeCloseTo(1 / 3, 12);
  });

  it('2+ ABSORPTION reais na janela => ABSORCAO_ANOMALA mesmo sem sweep', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [],
      orderflowSignals: [sig('ABSORPTION', 1_000), sig('ABSORPTION', 8_000)],
      now: NOW,
    });
    expect(traps).toHaveLength(1);
    expect(traps[0].kind).toBe('ABSORCAO_ANOMALA');
    expect(traps[0].confidence).toBeCloseTo(2 / 3, 12);
  });

  it('1 ABSORPTION sozinha NÃO vira armadilha (2+ exigidos — nunca alarme de evento único)', () => {
    expect(detectInstitutionalTraps({
      liquidityZones: [],
      orderflowSignals: [sig('ABSORPTION', 1_000)],
      now: NOW,
    })).toEqual([]);
  });

  it('sweeps dos dois lados => as duas armadilhas reportadas separadas com evidência própria', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [eqh(110, true), eql(90, true)],
      orderflowSignals: [],
      now: NOW,
    });
    expect(traps.map((t) => t.kind).sort()).toEqual(['STOP_HUNT_FUNDO', 'STOP_HUNT_TOPO']);
  });
});
