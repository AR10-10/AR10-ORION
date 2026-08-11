// alert-center-sweep.test.ts — execução REAL de deriveSweepAlert/
// sweepIdentity (achado B/Seção F da AUDITORIA TÉCNICA COMPLETA: Liquidity
// Sweep já tinha publicador real — BRAIN.TRAPS.UPDATED — mas nunca
// alertava). Prova em especial o motivo de usar sweepIdentity (candle+preço
// do nível varrido) em vez de `trap.at`: trap-detection.ts carimba `at:
// inputs.now` de NOVO em CADA chamada de detectInstitutionalTraps, mesmo
// para o MESMO sweep real ainda dentro da janela de corroboração — um teste
// ingênuo por `at` alertaria de novo a cada recomputo (spam), exatamente o
// bug que esta identidade evita.
import { describe, it, expect } from 'vitest';
import { deriveSweepAlert, sweepIdentity } from '../src/nexus/alert-center';
import { TRAP_CONTRACT_VERSION, type TrapSignal } from '../src/nexus/trap-detection';

function makeSweep(kind: 'STOP_HUNT_TOPO' | 'STOP_HUNT_FUNDO', price: number, index: number, opts: Partial<TrapSignal> = {}): TrapSignal {
  return {
    contractVersion: TRAP_CONTRACT_VERSION,
    kind,
    confidence: 0.8,
    evidence: ['EQH_VARRIDO'],
    at: Date.now(),
    sweptLevels: [{ price, index }],
    ...opts,
  };
}

function makeAbsorption(opts: Partial<TrapSignal> = {}): TrapSignal {
  return {
    contractVersion: TRAP_CONTRACT_VERSION,
    kind: 'ABSORCAO_ANOMALA',
    confidence: 0.7,
    evidence: ['ABSORPTION_REAL'],
    at: Date.now(),
    sweptLevels: [],
    ...opts,
  };
}

describe('alert-center: sweepIdentity', () => {
  it('mesma combinação candle+preço => mesma identidade, sempre', () => {
    const a = sweepIdentity({ price: 50000, index: 120 });
    const b = sweepIdentity({ price: 50000, index: 120 });
    expect(a).toBe(b);
  });

  it('preço ou índice diferentes => identidades diferentes', () => {
    expect(sweepIdentity({ price: 50000, index: 120 })).not.toBe(sweepIdentity({ price: 50001, index: 120 }));
    expect(sweepIdentity({ price: 50000, index: 120 })).not.toBe(sweepIdentity({ price: 50000, index: 121 }));
  });
});

describe('alert-center: deriveSweepAlert', () => {
  it('lista vazia => null (nunca um alerta fabricado sem sweep real)', () => {
    expect(deriveSweepAlert(new Set(), [])).toBeNull();
  });

  it('sweep novo (STOP_HUNT_TOPO) => alerta info com preço/confiança/viés reais', () => {
    const trap = makeSweep('STOP_HUNT_TOPO', 51000, 300, { confidence: 0.92 });
    const alert = deriveSweepAlert(new Set(), [trap]);
    expect(alert).not.toBeNull();
    expect(alert!.tone).toBe('info');
    expect(alert!.title).toBe('SWEEP · TOPO VARRIDO');
    expect(alert!.message).toContain('51000.00');
    expect(alert!.message).toContain('92%');
    expect(alert!.message).toContain('viés baixa'); // topo varrido = liquidez compradora tomada, viés de reversão pra baixo
  });

  it('sweep novo (STOP_HUNT_FUNDO) => título e viés opostos ao TOPO', () => {
    const trap = makeSweep('STOP_HUNT_FUNDO', 49000, 200);
    const alert = deriveSweepAlert(new Set(), [trap]);
    expect(alert!.title).toBe('SWEEP · FUNDO VARRIDO');
    expect(alert!.message).toContain('viés alta');
  });

  it('mesmo sweep (mesma identidade) na 2ª chamada => null, mesmo com seenIds do chamador reaproveitado', () => {
    const seen = new Set<string>();
    const trap = makeSweep('STOP_HUNT_TOPO', 51000, 300);
    expect(deriveSweepAlert(seen, [trap])).not.toBeNull();
    expect(deriveSweepAlert(seen, [trap])).toBeNull();
  });

  it('regressão do bug real que esta identidade evita: MESMO sweep, `at` diferente a cada recomputo (como o motor real faz) => só alerta 1 vez', () => {
    const seen = new Set<string>();
    const recompute1 = makeSweep('STOP_HUNT_TOPO', 51000, 300, { at: 1_700_000_000_000 });
    const recompute2 = makeSweep('STOP_HUNT_TOPO', 51000, 300, { at: 1_700_000_004_000 }); // recomputado 4s depois, MESMO nível real
    const recompute3 = makeSweep('STOP_HUNT_TOPO', 51000, 300, { at: 1_700_000_008_000 });
    expect(deriveSweepAlert(seen, [recompute1])).not.toBeNull();
    expect(deriveSweepAlert(seen, [recompute2])).toBeNull(); // um teste ingênuo por `at` alertaria de novo aqui
    expect(deriveSweepAlert(seen, [recompute3])).toBeNull();
  });

  it('ABSORCAO_ANOMALA nunca alerta — sem preço-âncora real (sweptLevels sempre []), nunca uma identidade fabricada', () => {
    const seen = new Set<string>();
    const absorption = makeAbsorption();
    expect(deriveSweepAlert(seen, [absorption])).toBeNull();
    // mesmo com outro sinal de absorção "diferente" (evidence distinta) — ainda sem anchor real.
    expect(deriveSweepAlert(seen, [absorption, makeAbsorption({ confidence: 0.99 })])).toBeNull();
  });

  it('2 sweeps novos na mesma chamada: os DOIS ficam marcados como vistos, só o mais recente vira alerta (uma transição real, um evento)', () => {
    const seen = new Set<string>();
    const trap1 = makeSweep('STOP_HUNT_TOPO', 51000, 300);
    const trap2 = makeSweep('STOP_HUNT_FUNDO', 49000, 200);
    const alert = deriveSweepAlert(seen, [trap1, trap2]);
    expect(alert).not.toBeNull();
    expect(alert!.title).toBe('SWEEP · FUNDO VARRIDO'); // trap2 é o último da lista => "mais recente"
    // Nenhum dos dois vaza como "ainda novo" na próxima chamada.
    expect(deriveSweepAlert(seen, [trap1, trap2])).toBeNull();
  });

  it('vários níveis varridos no MESMO trap: cada nível é uma identidade própria', () => {
    const seen = new Set<string>();
    const trap: TrapSignal = {
      contractVersion: TRAP_CONTRACT_VERSION,
      kind: 'STOP_HUNT_TOPO',
      confidence: 0.85,
      evidence: ['EQH_VARRIDO'],
      at: Date.now(),
      sweptLevels: [
        { price: 51000, index: 300 },
        { price: 51050, index: 301 },
      ],
    };
    const alert1 = deriveSweepAlert(seen, [trap]);
    expect(alert1).not.toBeNull();
    // Ambos níveis marcados vistos na mesma passada — chamar de novo com o
    // MESMO trap (2 níveis já vistos) não repete nenhum alerta.
    expect(deriveSweepAlert(seen, [trap])).toBeNull();
  });
});
