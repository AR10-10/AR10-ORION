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
  it('BULLISH continua rgba(8, 153, 129, ...) e BEARISH continua rgba(242, 54, 69, ...) — mesma paleta de sempre', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('rgba(8, 153, 129,');
    expect(plugin).toContain('rgba(242, 54, 69,');
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
    expect(p).toContain('const FVG_BULLISH_OBSTACLE: ZonePalette = { fill: "rgba(8, 153, 129, 0.10)", border: "rgba(8, 153, 129, 0.85)" };');
    expect(p).toContain('const FVG_BEARISH_OBSTACLE: ZonePalette = { fill: "rgba(242, 54, 69, 0.10)", border: "rgba(242, 54, 69, 0.85)" };');
    expect(p).toContain('const OB_BULLISH_OBSTACLE: ZonePalette = { fill: "rgba(8, 153, 129, 0.15)", border: "rgba(8, 153, 129, 0.85)" };');
    expect(p).toContain('const OB_BEARISH_OBSTACLE: ZonePalette = { fill: "rgba(242, 54, 69, 0.15)", border: "rgba(242, 54, 69, 0.85)" };');
  });

  it('hierarquia fill<border continua valendo para TODAS as paletas do arquivo, incluindo as de obstáculo e as de Liquidity Void (regex cega, mesma trava do teste de cor acima)', () => {
    const p = plugin();
    const fillOpacities = [...p.matchAll(/fill: "rgba\([^)]+, ([0-9.]+)\)"/g)].map((m) => Number(m[1]));
    const borderOpacities = [...p.matchAll(/border: "rgba\([^)]+, ([0-9.]+)\)"/g)].map((m) => Number(m[1]));
    // 4 FVG/OB normais + 4 FVG/OB de obstáculo + 2 VOID normais + 2 VOID de
    // obstáculo + 4 BREAKER + 4 MITIGATION (graduação de
    // institutional-blocks.js — 4º e 5º kinds reais).
    expect(fillOpacities.length).toBe(20);
    expect(borderOpacities.length).toBe(fillOpacities.length);
    fillOpacities.forEach((fillOpacity, i) => expect(fillOpacity).toBeLessThan(borderOpacities[i]));
  });

  it('Liquidity Void usa uma família de cor PRÓPRIA (ciano/magenta), nunca o verde/vermelho de FVG/OB — um Void tipicamente CONTÉM vários FVGs, reusar a cor recriaria a "parede de cor" que a Ordem de Fechamento corrigiu', () => {
    const p = plugin();
    expect(p).toContain('const VOID_BULLISH: ZonePalette = { fill: "rgba(0, 98, 255, 0.10)", border: "rgba(0, 98, 255, 0.35)" };');
    expect(p).toContain('const VOID_BEARISH: ZonePalette = { fill: "rgba(236, 81, 205, 0.10)", border: "rgba(236, 81, 205, 0.35)" };');
    // paletteFor resolve TODOS os kinds reais — nunca cai no ramo de OB por
    // engano. A união virou um tipo nomeado (ZoneKind) quando Breaker e
    // Mitigation entraram; o que importa aqui é que cada kind tenha o SEU
    // ramo explícito.
    expect(p).toContain('export type ZoneKind = "FVG" | "OB" | "VOID" | "BREAKER" | "MITIGATION";');
    expect(p).toContain('function paletteFor(kind: ZoneKind, type: "BULLISH" | "BEARISH", isObstacle: boolean): ZonePalette {');
    for (const kind of ['VOID', 'BREAKER', 'MITIGATION']) {
      expect(p, `kind ${kind} sem ramo próprio em paletteFor`).toContain(`if (kind === "${kind}") {`);
    }
  });

  it('pergunta do Operador ("era pra cima ou pra baixo?"): o rótulo da zona carrega a DIREÇÃO por glifo ↑/↓, nunca só a cor — BULLISH=↑ (demanda), BEARISH=↓ (oferta), o glifo vem de type real do motor SMC', () => {
    const p = plugin();
    expect(p).toContain('const dir = (t: "BULLISH" | "BEARISH") => (t === "BULLISH" ? "↑" : "↓");');
    // Ordem de Fechamento ("não ficar poluído... marca certeira"): o rótulo
    // por zona bruta virou rótulo por GRUPO fundido (drawGroup) — mesmo
    // glifo de direção, ganhou "×N" quando várias zonas reais se fundem e
    // preservou o "⚠" de obstáculo, nunca escondido pela fusão.
    // O kind passa por uma forma curta (BRK/MIT) antes de entrar no rótulo —
    // mesma disciplina de "o tamanho das etiquetas" pedida pelo Operador.
    // O glifo de direção e a contagem ×N seguem exatamente iguais.
    expect(p).toContain('const label = `${kindLabel}${dir(type)}${group.memberCount > 1 ? ` ×${group.memberCount}` : ""}${group.isObstacle ? " ⚠" : ""}`;');
    expect(p).toContain('const kindLabel = kind === "BREAKER" ? "BRK" : kind === "MITIGATION" ? "MIT" : kind;');
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
    // Ordem Nº 04 (MAIN_LIQUIDITY): fvgVisualWeights/obVisualWeights entram
    // no MESMO ref/dep array por exatamente o mesmo motivo — nunca stale
    // quando o orçamento visual cruzado resolve um peso novo.
    // liquidityVoids/voidVisualWeights (liquidity-void-engine.js) entram no
    // MESMO ref/dep array pelo mesmo motivo — um void novo detectado nunca
    // fica invisível esperando outro prop mudar.
    // equalLevels (EQH/EQL) entra no MESMO ref/dep array pelo mesmo motivo:
    // a camada migrou de price line de largura total para este canvas, e um
    // pool novo nunca pode ficar invisível esperando outra prop mudar.
    // Assertiva por PROP, não pela linha literal inteira — a lista cresce a
    // cada camada que passa a dividir este canvas, e travar a string
    // completa transformava toda adição aditiva em vermelho sem nenhum fio
    // realmente rompido.
    const refInicial = p.match(/const zonesRef = useRef\(\{([^}]*)\}/)?.[1] ?? '';
    const espelho = p.match(/zonesRef\.current = \{([^}]*)\}/)?.[1] ?? '';
    const deps = p.match(/markDirtyRef\.current\?\.\(\);\s*\}, \[([^\]]*)\]/)?.[1] ?? '';
    for (const prop of ['fairValueGaps', 'orderBlocks', 'liquidityVoids', 'data', 'obstacleZones', 'fvgVisualWeights', 'obVisualWeights', 'voidVisualWeights', 'equalLevels']) {
      expect(refInicial, `${prop} fora do ref inicial`).toContain(prop);
      expect(espelho, `${prop} fora do espelho por render`).toContain(prop);
      expect(deps, `${prop} fora do dep array do dirty-flag`).toContain(prop);
    }
  });
});

describe('EnhancedChart_110_Percent → LiquidityZonesPlugin: obstacleZones passa ponta a ponta (App.tsx já cruza tradePlanStructureZones)', () => {
  it('a prop chega ao plugin com fallback honesto para array vazio (nunca undefined quebrando .some acima)', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('obstacleZones?: { low: number; high: number }[];');
    // O `?? []` inline virou constante de módulo: um array literal novo a
    // cada render marcava o canvas como sujo eternamente. O fallback
    // honesto (nunca undefined) continua travado.
    expect(chart).toContain('obstacleZones={obstacleZones ?? EMPTY_OBSTACLE_ZONES}');
    expect(chart).toMatch(/const EMPTY_OBSTACLE_ZONES: \{ low: number; high: number \}\[\] = \[\];/);
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
    // Ordem Nº 04: import ganhou ZONE_DECAY (reusado para montar o
    // candidato MAIN_LIQUIDITY — zero segunda curva de decaimento).
    expect(chart).toMatch(/import \{ LiquidityZonesPlugin, ZONE_DECAY, type FillableZone[^}]*\} from "\.\/LiquidityZonesPlugin";/);
    expect(chart).toContain('<LiquidityZonesPlugin');
    expect(chart).toContain('chart={chartReady?.chart ?? null}');
    expect(chart).toContain('series={chartReady?.series ?? null}');
    expect(chart).toMatch(/fairValueGaps=\{.*fairValueGaps \?\? NO_FILLABLE_ZONES.*\}/);
    expect(chart).toMatch(/orderBlocks=\{.*orderBlocks \?\? NO_FILLABLE_ZONES.*\}/);
  });

  it('não cria mais price lines com title "FVG"/"OB" — a área colorida é a única representação agora', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).not.toContain('title: "FVG"');
    expect(chart).not.toContain('title: "OB"');
  });

  // ESTE TESTE MUDOU DE LADO DE PROPÓSITO — e a razão fica registrada aqui
  // porque a versão anterior afirmava o contrário ("uma linha continua
  // honesta").
  //
  // Defeito relatado pelo Operador sobre a tela real: "aquela linha amarela
  // — antigamente elas não atravessavam o gráfico todo, ela só marcava um
  // pedaço da linha, não ficava grandona, marcava quantas vezes ela testou
  // naquela mesma zona". A premissa antiga estava certa sobre o DADO
  // (LiquidityZone não tem top/bottom, então não é uma área) e errada sobre
  // a EXTENSÃO: `createPriceLine` atravessa o gráfico inteiro por construção
  // — a lib não tem parâmetro de início/fim — e o `title` que carregava a
  // contagem nunca foi renderizado no painel de velas.
  //
  // A representação honesta é um TRECHO sobre o intervalo real de toques,
  // desenhado no MESMO canvas de FVG/OB. Ver equal-level-span.ts.
  it('liquidez (EQH/EQL) deixou de ser price line de largura total — virou trecho no canvas, com a contagem visível', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    // A assinatura exata da price line removida.
    expect(chart).not.toContain('title: `${z.type === "EQUAL_HIGH" ? "EQH" : "EQL"} x${z.touches}`');
    expect(chart).toContain('equalLevels={');
    // Mesmo âmbar unificado de S1/R1 — só a primitiva mudou, nunca a cor.
    expect(plugin).toContain('rgba(245, 158, 11, 0.45)');
    expect(plugin).toContain('resolveEqualLevelSegment');
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
