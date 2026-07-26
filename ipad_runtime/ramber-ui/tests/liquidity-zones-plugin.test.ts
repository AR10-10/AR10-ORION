// liquidity-zones-plugin.test.ts — V-MAX Fase 0.7: trava o
// LiquidityZonesPlugin (Blueprint §3.1) no nível de código-fonte — mesmo
// padrão já estabelecido para EnhancedChart_110_Percent.tsx (lib de canvas
// real, sem DOM/canvas real neste ambiente de teste 'node'): padrão no
// código, nunca render. Verificação visual real (cores/posição/pan/zoom)
// já foi feita via harness Playwright isolado, descartado antes do commit.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('LiquidityZonesPlugin: "Fio de Seda" também vale para a borda desenhada em Canvas 2D (Regra de Ouro 2)', () => {
  it('nunca CHAMA setLineDash (o equivalente Canvas de pontilhado/tracejado) — comentários que só citam o nome não contam', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).not.toMatch(/\.setLineDash\(/);
  });

  it('a borda é sempre lineWidth = 1 (o traço mais fino), nunca um valor maior', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('ctx.lineWidth = 1');
    expect(plugin).not.toMatch(/ctx\.lineWidth = [2-9]/);
  });
});

describe('LiquidityZonesPlugin: reaproveita exatamente a identidade de cor real já usada (nunca remove cor do gráfico)', () => {
  it('BULLISH continua rgba(0, 255, 170, ...) e BEARISH continua rgba(255, 0, 85, ...) — mesma paleta de sempre', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('rgba(0, 255, 170,');
    expect(plugin).toContain('rgba(255, 0, 85,');
  });

  it('a área preenchida (fill) é mais translúcida que a borda (border) para cada zona — hierarquia visual honesta', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    const fillOpacities = [...plugin.matchAll(/fill: "rgba\([^)]+, ([0-9.]+)\)"/g)].map((m) => Number(m[1]));
    const borderOpacities = [...plugin.matchAll(/border: "rgba\([^)]+, ([0-9.]+)\)"/g)].map((m) => Number(m[1]));
    expect(fillOpacities.length).toBeGreaterThan(0);
    expect(borderOpacities.length).toBe(fillOpacities.length);
    fillOpacities.forEach((fillOpacity, i) => {
      expect(fillOpacity).toBeLessThan(borderOpacities[i]);
    });
  });
});

describe('LiquidityZonesPlugin: destaque de obstáculo (Diretriz Restauração/Inteligência Visual §6) — mesma cor de tipo, só a borda em ênfase', () => {
  const plugin = () => read('../src/chart/LiquidityZonesPlugin.tsx');

  it('as 4 paletas de obstáculo reaproveitam o MESMO fill das paletas normais — "não é pra tirar as cor do gráfico" continua valendo', () => {
    const p = plugin();
    expect(p).toContain('const FVG_BULLISH_OBSTACLE: ZonePalette = { fill: "rgba(0, 255, 170, 0.10)", border: "rgba(0, 255, 170, 0.85)" };');
    expect(p).toContain('const FVG_BEARISH_OBSTACLE: ZonePalette = { fill: "rgba(255, 0, 85, 0.10)", border: "rgba(255, 0, 85, 0.85)" };');
    expect(p).toContain('const OB_BULLISH_OBSTACLE: ZonePalette = { fill: "rgba(0, 255, 170, 0.15)", border: "rgba(0, 255, 170, 0.85)" };');
    expect(p).toContain('const OB_BEARISH_OBSTACLE: ZonePalette = { fill: "rgba(255, 0, 85, 0.15)", border: "rgba(255, 0, 85, 0.85)" };');
  });

  it('hierarquia fill<border continua valendo para TODAS as paletas do arquivo, incluindo as 4 novas de obstáculo (regex cega, mesma trava do teste de cor acima)', () => {
    const p = plugin();
    const fillOpacities = [...p.matchAll(/fill: "rgba\([^)]+, ([0-9.]+)\)"/g)].map((m) => Number(m[1]));
    const borderOpacities = [...p.matchAll(/border: "rgba\([^)]+, ([0-9.]+)\)"/g)].map((m) => Number(m[1]));
    expect(fillOpacities.length).toBe(8); // 4 normais + 4 de obstáculo
    expect(borderOpacities.length).toBe(fillOpacities.length);
    fillOpacities.forEach((fillOpacity, i) => expect(fillOpacity).toBeLessThan(borderOpacities[i]));
  });

  it('pergunta do Operador ("era pra cima ou pra baixo?"): o rótulo da zona carrega a DIREÇÃO por glifo ↑/↓, nunca só a cor — BULLISH=↑ (demanda), BEARISH=↓ (oferta), o glifo vem de z.type real do motor SMC', () => {
    const p = plugin();
    expect(p).toContain('const dir = (t: "BULLISH" | "BEARISH") => (t === "BULLISH" ? "↑" : "↓");');
    expect(p).toContain('`FVG${dir(z.type)}${isObstacle(z) ? " ⚠" : ""}`');
    expect(p).toContain('`OB${dir(z.type)}${isObstacle(z) ? " ⚠" : ""}`');
    // o glifo nunca substitui a marca de obstáculo (⚠), só a acompanha
    expect(p).toContain('" ⚠"');
  });

  it('a identidade do obstáculo é por low/high REAL (mesmos números que já formam a zona) — nunca por índice/posição', () => {
    const p = plugin();
    expect(p).toContain('const isObstacle = (zone: FillableZone) =>\n        (obstacles ?? []).some((o) => o.low === zone.bottom && o.high === zone.top);');
  });

  it('sem obstacleZones (undefined/vazio), o desenho é idêntico ao de sempre — fail-closed, zero mudança visual sem plano ativo', () => {
    const p = plugin();
    expect(p).toContain('obstacleZones?: { low: number; high: number }[];');
    expect(p).toContain('(obstacles ?? []).some(');
  });

  it('prop obstacleZones entra no mirror ref e no dep array do dirty-flag — nunca fica stale ao trocar de plano', () => {
    const p = plugin();
    expect(p).toContain('const zonesRef = useRef({ fairValueGaps, orderBlocks, data, obstacleZones });');
    expect(p).toContain('zonesRef.current = { fairValueGaps, orderBlocks, data, obstacleZones };');
    expect(p).toContain('}, [fairValueGaps, orderBlocks, data, obstacleZones]);');
  });
});

describe('EnhancedChart_110_Percent → LiquidityZonesPlugin: obstacleZones passa ponta a ponta (App.tsx já cruza tradePlanStructureZones)', () => {
  it('a prop chega ao plugin com fallback honesto para array vazio (nunca undefined quebrando .some acima)', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('obstacleZones?: { low: number; high: number }[];');
    expect(chart).toContain('obstacleZones={obstacleZones ?? []}');
  });
});

describe('LiquidityZonesPlugin: geometria real via lightweight-charts, nunca posição fabricada em pixel fixo', () => {
  it('resolve preço→pixel via priceToCoordinate/timeToCoordinate reais da própria lib', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('series.priceToCoordinate(');
    expect(plugin).toContain('timeScale.timeToCoordinate(');
  });

  it('zona sem candle real no índice (fora da janela atual) nunca é desenhada — Fail-Closed, nunca um palpite', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toMatch(/if \(!point\) return;/);
    expect(plugin).toMatch(/if \(x1 === null \|\| y1 === null \|\| y2 === null\) return;/);
  });

  it('nunca usa Math.random nem qualquer dado sintético (Regra de Ouro 1)', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).not.toMatch(/Math\.random/);
  });
});

describe('LiquidityZonesPlugin: dirty-flag + requestAnimationFrame (Blueprint §3.2), nunca um loop perpétuo', () => {
  it('agenda redraw via requestAnimationFrame, guardado por uma flag (nunca redesenha sem necessidade)', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('requestAnimationFrame(');
    expect(plugin).toMatch(/if \(rafScheduled\) return;/);
  });

  it('reage a mudança de range visível (pan/zoom) via subscribeVisibleLogicalRangeChange real da lib', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('subscribeVisibleLogicalRangeChange(');
  });

  it('acompanha o tamanho real do canvas via ResizeObserver (Blueprint §3.3), nunca um listener de resize próprio', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('new ResizeObserver(');
  });

  it('desmonta limpo: cancela a assinatura de range e desconecta o ResizeObserver (Plugin Registry — evita leaks)', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('unsubscribeVisibleLogicalRangeChange(');
    expect(plugin).toContain('resizeObserver.disconnect()');
  });
});

describe('EnhancedChart_110_Percent: LiquidityZonesPlugin substitui as price lines de FVG/OB (nunca desenha as duas coisas ao mesmo tempo)', () => {
  it('importa e monta LiquidityZonesPlugin com o chart/série reais (nunca null fabricado por padrão) e as zonas reais', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('import { LiquidityZonesPlugin, type FillableZone } from "./LiquidityZonesPlugin";');
    expect(chart).toContain('<LiquidityZonesPlugin');
    expect(chart).toContain('chart={chartReady?.chart ?? null}');
    expect(chart).toContain('series={chartReady?.series ?? null}');
    expect(chart).toContain('fairValueGaps={(fairValueGaps ?? []) as FillableZone[]}');
    expect(chart).toContain('orderBlocks={(orderBlocks ?? []) as FillableZone[]}');
  });

  it('não cria mais price lines com title "FVG"/"OB" — a área colorida é a única representação agora', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).not.toContain('title: "FVG"');
    expect(chart).not.toContain('title: "OB"');
  });

  it('liquidez (EQH/EQL) continua como price line real — LiquidityZone não tem top/bottom, uma linha continua honesta', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('EQUAL_HIGH');
    expect(chart).toContain('rgba(200, 107, 255, 0.45)');
    expect(chart).toContain('series.createPriceLine({');
  });

  it('EnhancedChartZone ganhou index: number (necessário para a borda esquerda real da área)', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const zoneMatch = chart.match(/export interface EnhancedChartZone \{([\s\S]*?)\n\}/);
    expect(zoneMatch, 'EnhancedChartZone não encontrado').not.toBeNull();
    expect(zoneMatch![1]).toContain('index: number');
  });

  it('setChartReady dispara junto da criação real do chart (o plugin nunca depende de um re-render incidental para começar a desenhar)', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toMatch(/setChartReady\(\{ chart, series \}\);/);
    expect(chart).toMatch(/setChartReady\(null\);/);
  });
});
