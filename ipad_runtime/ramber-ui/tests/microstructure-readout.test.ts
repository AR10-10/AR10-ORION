// microstructure-readout.test.ts — execução REAL.
//
// MÓDULO DE LABORATÓRIO: NÃO está ligado à UI (MASTER ORDER §12 —
// aprendizado nasce em Laboratory, Core protegido; e §73 — Phase A é
// auditoria, a graduação é Phase B e depende do aval do Operador).
// Estes testes provam o comportamento ANTES de qualquer graduação, que é
// exatamente a disciplina do CLAUDE.md ("isolar antes de integrar").
import { describe, it, expect } from 'vitest';
import { buildMicrostructureReadout, describeMicrostructureReadout } from '../src/nexus/microstructure-readout';
import type { MicrostructureSnapshot } from '../src/nexus/microstructure-snapshot';
import { MICROSTRUCTURE_SNAPSHOT_CONTRACT_VERSION } from '../src/nexus/microstructure-snapshot';

const snap = (over: Partial<MicrostructureSnapshot> = {}): MicrostructureSnapshot =>
  ({
    contractVersion: MICROSTRUCTURE_SNAPSHOT_CONTRACT_VERSION,
    computedAt: 1_700_000_000_000,
    quality: 'VALID',
    tradeFlow: null,
    depth: {},
    sweep: [],
    eventIntensity: { level: 'LOW', eventCount: 0, windowMs: 60_000 },
    ...over,
  }) as MicrostructureSnapshot;

const depth = (over: Record<string, unknown> = {}) =>
  ({ quality: 'VALID', updatedAt: 1_700_000_000_000, imbalance: 0, bidAskRatio: 1, bidWalls: [], askWalls: [], ...over }) as never;

describe('microstructure-readout: fail-closed (Regra de Ouro 3)', () => {
  it('sem snapshot => invisível, nunca um bloco vazio ocupando espaço', () => {
    for (const entrada of [null, undefined]) {
      const r = buildMicrostructureReadout(entrada);
      expect(r.visible).toBe(false);
      expect(r.absorption).toBeNull();
      expect(r.walls).toEqual([]);
      expect(r.intensity).toBeNull();
    }
  });

  it('INSUFFICIENT_DATA => invisível, e a qualidade real é preservada', () => {
    const r = buildMicrostructureReadout(snap({ quality: 'INSUFFICIENT_DATA' }));
    expect(r.visible).toBe(false);
    expect(r.quality).toBe('INSUFFICIENT_DATA');
  });

  it('snapshot real mas sem NENHUMA leitura acima do trivial => invisível', () => {
    // Absorção NONE + zero muros + zero eventos: nada conquistou a tela.
    const r = buildMicrostructureReadout(
      snap({ tradeFlow: { absorptionState: 'NONE' } as never, depth: { BINANCE: depth() } as never }),
    );
    expect(r.visible).toBe(false);
    expect(describeMicrostructureReadout(r)).toBe('');
  });
});

describe('microstructure-readout: venues NUNCA somadas (Ordem A2.1 §16)', () => {
  it('duas venues com muros => duas linhas independentes, com o nome de cada', () => {
    const r = buildMicrostructureReadout(
      snap({
        depth: {
          BINANCE: depth({ bidWalls: [true, false, true], askWalls: [true] }),
          MEXC: depth({ bidWalls: [true], askWalls: [] }),
        } as never,
      }),
    );
    expect(r.visible).toBe(true);
    expect(r.walls).toEqual([
      { venue: 'BINANCE', bid: 2, ask: 1 },
      { venue: 'MEXC', bid: 1, ask: 0 },
    ]);
    // O ponto: 2+1 na Binance e 1 na MEXC NUNCA viram "4 muros".
    const linha = describeMicrostructureReadout(r);
    expect(linha).toContain('muros BINANCE 2 compra/1 venda');
    expect(linha).toContain('muros MEXC 1 compra');
    expect(linha).not.toContain('4');
  });

  it('ordem por venue é estável entre renders com o mesmo dado', () => {
    const entrada = snap({
      depth: { MEXC: depth({ bidWalls: [true] }), BINANCE: depth({ askWalls: [true] }) } as never,
    });
    const a = buildMicrostructureReadout(entrada);
    const b = buildMicrostructureReadout(entrada);
    expect(a.walls.map((w) => w.venue)).toEqual(['BINANCE', 'MEXC']);
    expect(a).toEqual(b);
  });

  it('venue com book STALE não conta muro — um muro de 20s atrás pode não existir mais', () => {
    const r = buildMicrostructureReadout(
      snap({
        depth: {
          BINANCE: depth({ quality: 'STALE', bidWalls: [true, true] }),
          MEXC: depth({ bidWalls: [true] }),
        } as never,
      }),
    );
    expect(r.walls).toEqual([{ venue: 'MEXC', bid: 1, ask: 0 }]);
  });

  it('venue null/ausente é pulada, nunca lida como zero muros medidos', () => {
    const r = buildMicrostructureReadout(
      snap({ depth: { BINANCE: null, MEXC: depth({ askWalls: [true] }) } as never }),
    );
    expect(r.walls).toEqual([{ venue: 'MEXC', bid: 0, ask: 1 }]);
  });
});

describe('microstructure-readout: absorção preserva a distinção que o motor faz', () => {
  it('NONE nunca vira linha — "nenhuma absorção" não merece espaço', () => {
    const r = buildMicrostructureReadout(snap({ tradeFlow: { absorptionState: 'NONE' } as never }));
    expect(r.absorption).toBeNull();
  });

  it('OBSERVED e CONFIRMED são rótulos DIFERENTES (a corroboração é o ponto)', () => {
    const obs = buildMicrostructureReadout(snap({ tradeFlow: { absorptionState: 'ABSORPTION_OBSERVED' } as never }));
    const conf = buildMicrostructureReadout(snap({ tradeFlow: { absorptionState: 'ABSORPTION_CONFIRMED' } as never }));
    expect(obs.visible).toBe(true);
    expect(conf.visible).toBe(true);
    expect(describeMicrostructureReadout(obs)).toContain('OBSERVADA');
    expect(describeMicrostructureReadout(conf)).toContain('CONFIRMADA');
    expect(describeMicrostructureReadout(obs)).not.toBe(describeMicrostructureReadout(conf));
  });

  it('tradeFlow ausente => sem absorção, nunca um NONE fabricado', () => {
    expect(buildMicrostructureReadout(snap({ tradeFlow: null })).absorption).toBeNull();
  });
});

describe('microstructure-readout: intensidade (intensidade ≠ direção)', () => {
  it('zero eventos => null, nunca "0 eventos (LOW)" ocupando a linha', () => {
    const r = buildMicrostructureReadout(snap({ eventIntensity: { level: 'LOW', eventCount: 0, windowMs: 60_000 } }));
    expect(r.intensity).toBeNull();
    expect(r.visible).toBe(false);
  });

  it('eventos reais => nível + contagem + janela real, todos visíveis', () => {
    const r = buildMicrostructureReadout(snap({ eventIntensity: { level: 'HIGH', eventCount: 7, windowMs: 60_000 } }));
    expect(r.intensity).toEqual({ level: 'HIGH', eventCount: 7, windowMs: 60_000 });
    expect(describeMicrostructureReadout(r)).toBe('7 eventos/60s (HIGH)');
  });

  it('contagem não-finita é ausência, nunca uma leitura', () => {
    const r = buildMicrostructureReadout(snap({ eventIntensity: { level: 'HIGH', eventCount: Number.NaN, windowMs: 60_000 } }));
    expect(r.intensity).toBeNull();
  });
});

describe('microstructure-readout: pureza e composição', () => {
  it('não muta o snapshot recebido', () => {
    const entrada = snap({ depth: { BINANCE: depth({ bidWalls: [true] }) } as never });
    const antes = JSON.parse(JSON.stringify(entrada));
    buildMicrostructureReadout(entrada);
    expect(JSON.parse(JSON.stringify(entrada))).toEqual(antes);
  });

  it('as três leituras coexistem numa linha só, na ordem declarada', () => {
    const r = buildMicrostructureReadout(
      snap({
        tradeFlow: { absorptionState: 'ABSORPTION_CONFIRMED' } as never,
        depth: { BINANCE: depth({ bidWalls: [true, true] }) } as never,
        eventIntensity: { level: 'MEDIUM', eventCount: 3, windowMs: 60_000 },
      }),
    );
    expect(describeMicrostructureReadout(r)).toBe(
      'ABSORÇÃO CONFIRMADA · muros BINANCE 2 compra · 3 eventos/60s (MEDIUM)',
    );
  });
});

describe('microstructure-readout: NÃO graduado (trava de fase)', () => {
  it('nenhum consumidor em src/ ainda — graduação é Phase B, depende do Operador', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const arquivos: string[] = [];
    (function walk(d: string) {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(p) && !p.endsWith('microstructure-readout.ts')) arquivos.push(p);
      }
    })(new URL('../src', import.meta.url).pathname);
    const consumidores = arquivos.filter((f) => readFileSync(f, 'utf8').includes('microstructure-readout'));
    expect(consumidores).toEqual([]);
  });
});
