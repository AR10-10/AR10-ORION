// institutional-zone-core.test.ts — execução REAL do núcleo da Zona
// Institucional (coreTop/coreBottom).
//
// Defeito de origem, reportado pelo Operador ("a faixa roxa é larga demais,
// atrapalha muito o campo de visão") e MEDIDO antes de qualquer mudança:
// o agrupamento só exige que as ÂNCORAS caiam dentro de
// INSTITUTIONAL_ZONE_PROXIMITY_PCT (0.35%), mas `top`/`bottom` eram a UNIÃO
// dos extents dos membros. Um FVG/Order Block alto cujo ponto médio cai
// perto de uma EMA contribuía a sua altura INTEIRA — medição real:
// **6.00% de altura a partir de uma tolerância de 0.35% (17.1x)**, pintada
// em largura total do gráfico.
//
// O teste central abaixo é essa medição, virada invariante: a faixa
// desenhada nunca pode reivindicar mais que o critério que a produziu.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  computeInstitutionalZones,
  institutionalZonesEqual,
  INSTITUTIONAL_ZONE_PROXIMITY_PCT,
  type InstitutionalZone,
  type InstitutionalZoneInput,
} from '../src/nexus/institutional-zones';

const input = (over: Partial<InstitutionalZoneInput>): InstitutionalZoneInput =>
  ({
    ema: null,
    vwap: null,
    nexusLine: null,
    support: null,
    resistance: null,
    fairValueGaps: [],
    orderBlocks: [],
    liquidityZones: [],
    ...over,
  }) as InstitutionalZoneInput;

const alturaPct = (z: InstitutionalZone, top: number, bottom: number) => ((top - bottom) * 100) / z.centerPrice;

describe('zona institucional: o núcleo nunca excede o critério que agrupou', () => {
  // O caso exato que foi medido antes da correção.
  const zonas = computeInstitutionalZones(
    input({
      ema: { value: 100, period: 21 },
      vwap: 100.1,
      fairValueGaps: [{ top: 103, bottom: 97, type: 'BULLISH' }] as never,
    }),
  );

  it('o cenário real forma UMA zona com 3 ferramentas distintas', () => {
    expect(zonas).toHaveLength(1);
    expect(zonas[0].distinctSourceCount).toBe(3);
  });

  it('o ENVELOPE continua sendo a união dos extents — dado real preservado', () => {
    const z = zonas[0];
    expect(z.top).toBe(103);
    expect(z.bottom).toBe(97);
    // É este número que a faixa desenhava antes: ~6% a partir de 0.35%.
    // (5.998, não 6 exato: centerPrice é a MÉDIA das âncoras, 100.033.)
    expect(alturaPct(z, z.top, z.bottom)).toBeCloseTo(5.998, 3);
    // A razão que motivou a correção, travada como número real.
    expect(alturaPct(z, z.top, z.bottom) / INSTITUTIONAL_ZONE_PROXIMITY_PCT).toBeGreaterThan(17);
  });

  it('o NÚCLEO cabe dentro da tolerância de agrupamento — a invariante', () => {
    const z = zonas[0];
    const altura = alturaPct(z, z.coreTop, z.coreBottom);
    expect(altura).toBeLessThanOrEqual(INSTITUTIONAL_ZONE_PROXIMITY_PCT);
    // E é dramaticamente menor que o envelope que se desenhava antes.
    expect(altura).toBeLessThan(alturaPct(z, z.top, z.bottom));
  });

  it('o núcleo é o intervalo real das ÂNCORAS, nunca um valor fabricado', () => {
    const z = zonas[0];
    const ancoras = z.members.map((m) => m.price);
    expect(z.coreTop).toBe(Math.max(...ancoras));
    expect(z.coreBottom).toBe(Math.min(...ancoras));
    // O FVG entra pelo seu ponto médio real (97+103)/2 = 100, não pelo topo.
    expect(ancoras).toContain(100);
  });

  it('a invariante vale para QUALQUER grupo, não só para o caso medido', () => {
    const casos: InstitutionalZoneInput[] = [
      input({ ema: { value: 50, period: 9 }, vwap: 50.05, orderBlocks: [{ top: 62, bottom: 41, type: 'BEARISH' }] as never }),
      input({ support: 2000, nexusLine: 2003, fairValueGaps: [{ top: 2400, bottom: 1600, type: 'BULLISH' }] as never }),
      input({
        resistance: 1.2345,
        vwap: 1.2349,
        ema: { value: 1.2341, period: 200 },
        orderBlocks: [{ top: 1.5, bottom: 1.0, type: 'BULLISH' }] as never,
      }),
    ];
    for (const caso of casos) {
      for (const z of computeInstitutionalZones(caso)) {
        expect(alturaPct(z, z.coreTop, z.coreBottom)).toBeLessThanOrEqual(INSTITUTIONAL_ZONE_PROXIMITY_PCT);
        // O núcleo nunca sai de dentro do envelope real.
        expect(z.coreTop).toBeLessThanOrEqual(z.top);
        expect(z.coreBottom).toBeGreaterThanOrEqual(z.bottom);
      }
    }
  });

  it('grupo só de membros pontuais: núcleo == envelope (nada a estreitar)', () => {
    const z = computeInstitutionalZones(input({ ema: { value: 100, period: 21 }, vwap: 100.2, support: 100.1 }))[0];
    expect(z.coreTop).toBe(z.top);
    expect(z.coreBottom).toBe(z.bottom);
    expect(z.coreTop).toBeGreaterThan(z.coreBottom); // faixa real, nunca degenerada aqui
  });

  it('núcleo degenerado (âncoras idênticas) não vira NaN nem faixa invertida', () => {
    const z = computeInstitutionalZones(input({ ema: { value: 100, period: 21 }, vwap: 100 }))[0];
    expect(z.coreTop).toBe(100);
    expect(z.coreBottom).toBe(100);
    expect(Number.isFinite(z.coreTop) && Number.isFinite(z.coreBottom)).toBe(true);
  });
});

describe('zona institucional: a guarda de igualdade enxerga o núcleo', () => {
  const base = computeInstitutionalZones(
    input({ ema: { value: 100, period: 21 }, vwap: 100.1, fairValueGaps: [{ top: 103, bottom: 97, type: 'BULLISH' }] as never }),
  );

  it('mesma leitura => iguais', () => {
    expect(institutionalZonesEqual(base, base.map((z) => ({ ...z, members: [...z.members] })))).toBe(true);
  });

  it('MESMO envelope com núcleo diferente => DIFERENTES (senão a faixa congela no lugar errado)', () => {
    const mexido = base.map((z) => ({ ...z, coreTop: z.coreTop + 1 }));
    expect(institutionalZonesEqual(base, mexido)).toBe(false);
    // Prova que o envelope realmente não mudou — é só o núcleo.
    expect(mexido[0].top).toBe(base[0].top);
    expect(mexido[0].bottom).toBe(base[0].bottom);
  });
});

describe('zona institucional: fiação do desenho', () => {
  it('o plugin desenha o NÚCLEO, nunca o envelope', () => {
    const src = readFileSync(new URL('../src/chart/InstitutionalZonePlugin.tsx', import.meta.url), 'utf-8');
    expect(src).toContain('series.priceToCoordinate(zone.coreTop)');
    expect(src).toContain('series.priceToCoordinate(zone.coreBottom)');
    expect(src).not.toContain('series.priceToCoordinate(zone.top)');
    expect(src).not.toContain('series.priceToCoordinate(zone.bottom)');
  });

  it('o rótulo ancora no MESMO núcleo — nunca se descola da faixa que nomeia', () => {
    const src = readFileSync(new URL('../src/chart/EnhancedChart_110_Percent.tsx', import.meta.url), 'utf-8');
    expect(src).toContain('price: (zone.coreTop + zone.coreBottom) / 2,');
    expect(src).not.toContain('price: (zone.top + zone.bottom) / 2,');
  });

  it('o extent completo do FVG/OB continua desenhado pelo plugin dele (Regra de Ouro 4)', () => {
    const src = readFileSync(new URL('../src/chart/LiquidityZonesPlugin.tsx', import.meta.url), 'utf-8');
    expect(src).toContain('FVG_BULLISH');
    expect(src).toContain('OB_BULLISH');
  });
});
