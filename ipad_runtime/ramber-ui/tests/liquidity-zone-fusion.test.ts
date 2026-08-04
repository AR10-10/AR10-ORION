import { describe, it, expect } from 'vitest';
import { fuseLiquidityZones, type FusableZoneInput } from '../src/nexus/liquidity-zone-fusion';

const zone = (top: number, bottom: number, index: number, alpha = 1, isObstacle = false): FusableZoneInput => ({
  top, bottom, index, alpha, isObstacle,
});

describe('fuseLiquidityZones: interval-merge real (Ordem de Fechamento — "não ficar poluído, só as marca certeira")', () => {
  it('array vazio => array vazio', () => {
    expect(fuseLiquidityZones([], 0.5)).toEqual([]);
  });

  it('uma única zona => grupo de 1, valores passam adiante sem alteração (caso comum, zero mudança de comportamento)', () => {
    const result = fuseLiquidityZones([zone(51_000, 50_800, 10, 0.7, false)], 0.5);
    expect(result).toEqual([{ top: 51_000, bottom: 50_800, index: 10, alpha: 0.7, isObstacle: false, memberCount: 1 }]);
  });

  it('duas zonas com faixas de preço distantes (muito além de proximityPct) permanecem separadas', () => {
    const result = fuseLiquidityZones([zone(51_000, 50_800, 10), zone(60_000, 59_800, 20)], 0.5);
    expect(result).toHaveLength(2);
    expect(result.every((g) => g.memberCount === 1)).toBe(true);
  });

  it('duas zonas com faixas de preço SOBREPOSTAS se fundem em um único grupo — top/bottom = envelope real da união', () => {
    const a = zone(51_000, 50_500, 10, 0.6, false);
    const b = zone(50_800, 50_200, 20, 0.9, false);
    const result = fuseLiquidityZones([a, b], 0.5);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ top: 51_000, bottom: 50_200, memberCount: 2 });
  });

  it('duas zonas SEM sobreposição mas dentro de proximityPct (% real do preço) também se fundem', () => {
    // top da 1ª = 50_000; bottom da 2ª = 50_100 -> gap = 0.1/50_000*100 = 0.2% <= 0.5%
    const a = zone(50_000, 49_800, 10);
    const b = zone(50_300, 50_100, 20);
    const result = fuseLiquidityZones([a, b], 0.5);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ top: 50_300, bottom: 49_800, memberCount: 2 });
  });

  it('duas zonas fora de proximityPct (gap real maior que o limiar) NUNCA se fundem — "fundir quando fizer sentido", não sempre', () => {
    // top da 1ª = 50_000; bottom da 2ª = 51_000 -> gap = 1000/50_000*100 = 2% > 0.5%
    const a = zone(50_000, 49_800, 10);
    const b = zone(51_200, 51_000, 20);
    const result = fuseLiquidityZones([a, b], 0.5);
    expect(result).toHaveLength(2);
  });

  it('cadeia transitiva: A sobrepõe B, B sobrepõe C, mas A e C isoladas NÃO se tocariam — as 3 se fundem em 1 grupo (o algoritmo varre por âncora do GRUPO, nunca só do último item)', () => {
    const a = zone(50_200, 50_000, 10); // topo 50_200
    const b = zone(50_400, 50_100, 20); // sobrepõe A (50_100 <= 50_200), topo sobe pra 50_400
    const c = zone(50_600, 50_350, 30); // sobrepõe o TOPO DO GRUPO (50_350 <= 50_400), mas não tocaria A sozinha (50_350 > 50_200)
    const result = fuseLiquidityZones([a, b, c], 0.5);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ top: 50_600, bottom: 50_000, memberCount: 3 });
  });

  it('index do grupo é o da formação MAIS ANTIGA (menor) — a área existe desde o primeiro membro real', () => {
    const a = zone(51_000, 50_500, 50); // mais recente
    const b = zone(50_800, 50_200, 10); // mais antiga
    const result = fuseLiquidityZones([a, b], 0.5);
    expect(result[0].index).toBe(10);
  });

  it('alpha do grupo é o MAIOR real entre os membros — nunca a média, nunca o mais fraco', () => {
    const a = zone(51_000, 50_500, 10, 0.2);
    const b = zone(50_800, 50_200, 20, 0.9);
    const result = fuseLiquidityZones([a, b], 0.5);
    expect(result[0].alpha).toBe(0.9);
  });

  it('isObstacle do grupo é true se QUALQUER membro real for obstáculo — nunca escondido por estar agrupado com zonas que não são', () => {
    const a = zone(51_000, 50_500, 10, 1, false);
    const b = zone(50_800, 50_200, 20, 1, true);
    const result = fuseLiquidityZones([a, b], 0.5);
    expect(result[0].isObstacle).toBe(true);
  });

  it('isObstacle do grupo é false só quando NENHUM membro real é obstáculo', () => {
    const a = zone(51_000, 50_500, 10, 1, false);
    const b = zone(50_800, 50_200, 20, 1, false);
    expect(fuseLiquidityZones([a, b], 0.5)[0].isObstacle).toBe(false);
  });

  it('fail-closed: zona com bottom > top (geometria quebrada) é descartada, nunca desenha um palpite', () => {
    const broken = zone(50_000, 50_500, 10); // top < bottom
    const good = zone(60_000, 59_800, 20);
    const result = fuseLiquidityZones([broken, good], 0.5);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ top: 60_000, bottom: 59_800 });
  });

  it('fail-closed: preço/index não-finito é descartado', () => {
    const result = fuseLiquidityZones([zone(NaN, 50_000, 10), zone(51_000, 50_500, Infinity)], 0.5);
    expect(result).toHaveLength(0);
  });

  it('cenário real: 5 FVG/OB de um mercado agitado, 2 clusters reais de sobreposição + 1 isolado — resultado é exatamente 3 grupos', () => {
    const zones = [
      zone(65_120, 65_000, 100, 0.8, false), // cluster A
      zone(65_180, 65_080, 105, 0.6, false), // cluster A (sobrepõe)
      zone(64_500, 64_400, 80, 0.3, false),  // isolado
      zone(66_000, 65_900, 120, 0.9, true),  // cluster B
      zone(66_050, 65_950, 122, 0.5, false), // cluster B (sobrepõe, herda isObstacle=true do outro membro)
    ];
    const result = fuseLiquidityZones(zones, 0.5);
    expect(result).toHaveLength(3);
    const byMemberCount = result.map((g) => g.memberCount).sort();
    expect(byMemberCount).toEqual([1, 2, 2]);
    const clusterB = result.find((g) => g.memberCount === 2 && g.isObstacle);
    expect(clusterB).toBeDefined();
    expect(clusterB!.alpha).toBe(0.9);
  });
});
