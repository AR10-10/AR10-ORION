// visual-confidence-trace-wiring.test.ts — MD-7 (Visual Confidence Trace),
// pedido direto do Operador. Teste de PADRÃO no código-fonte (readFileSync
// + regex), mesma convenção de smc-harmonic-fusion-wiring.test.ts: prova
// que os módulos estão conectados do jeito certo — nunca reimplementa a
// lógica de novo, nunca renderiza canvas de verdade (isso é trabalho do
// harness Playwright real, ver relatório de entrega).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

// Mesma técnica de canvas-palette.test.ts: um comentário explicando "isto
// NUNCA faz X" contém a palavra X na prosa — checar o arquivo bruto faria
// o próprio comentário honesto derrubar o teste. A trava tem de governar
// CÓDIGO, nunca prosa.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const t = line.trimStart();
      if (t.startsWith('//') || t.startsWith('*')) return '';
      const idx = line.indexOf('//');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

const structureTrace = read('../src/chart/StructureTracePlugin.tsx');
const confidenceArrow = read('../src/chart/ConfidenceDirectionArrowPlugin.tsx');
const confidenceArrowCode = stripComments(confidenceArrow);
const engineBridge = read('../src/engine-bridge.ts');
const appTsx = read('../src/App.tsx');
const enhancedChart = read('../src/chart/EnhancedChart_110_Percent.tsx');
const chartLayerDepth = read('../src/chart/chart-layer-depth.ts');

describe('StructureTracePlugin: fonte real, nunca um segundo ZigZag', () => {
  it('importa computeStructuralSwings de engine-bridge.ts — nunca reimplementa fractal-swings', () => {
    expect(structureTrace).toContain('computeStructuralSwings');
    expect(structureTrace).toMatch(/from ["']\.\.\/engine-bridge["']/);
  });

  it('NUNCA importa zigzag-engine.js/computeZigZag — item 19 do memo ("não reativar o zigzag completo")', () => {
    expect(structureTrace).not.toMatch(/zigzag-engine/i);
    expect(structureTrace).not.toContain('computeZigZag');
  });

  it('cor vem da paleta canônica travada por teste — nunca um rgba roxo redigitado (quebraria canvas-palette.test.ts)', () => {
    expect(structureTrace).toContain('chartPaletteRgba("projection"');
    expect(structureTrace).not.toMatch(/rgba\(\s*1[0-9]{2}\s*,\s*[0-9]+\s*,\s*2[0-9]{2}/); // nenhum triplo lavanda redigitado à mão
  });

  it('Fio de Seda (Regra de Ouro 5): lineWidth 1, nunca ctx.setLineDash(', () => {
    expect(structureTrace).toContain('ctx.lineWidth = 1');
    expect(structureTrace).not.toContain('ctx.setLineDash(');
  });

  it('sem preenchimento, sem etiqueta, sem seta — só a linha (item 2 do memo)', () => {
    expect(structureTrace).not.toContain('ctx.fill(');
    expect(structureTrace).not.toContain('drawCanvasLabel');
  });

  it('arquitetura de canvas real: rAF + ResizeObserver + subscribeVisibleLogicalRangeChange, mesmo padrão de ZigZagPlugin', () => {
    expect(structureTrace).toContain('requestAnimationFrame');
    expect(structureTrace).toContain('ResizeObserver');
    expect(structureTrace).toContain('subscribeVisibleLogicalRangeChange');
  });

  it('usa getChartLayerZIndex("structure_trace") — profundidade declarada, nunca ordem acidental do DOM', () => {
    expect(structureTrace).toContain('getChartLayerZIndex("structure_trace")');
  });
});

describe('chart-layer-depth.ts: structure_trace/confidence_direction registrados corretamente', () => {
  it('structure_trace é "line" — mesma precisão de 1px que zigzag/EMA/VWAP, nunca abaixo de preenchimento', () => {
    expect(chartLayerDepth).toMatch(/structure_trace:\s*"line"/);
  });

  it('confidence_direction é "event" — marca pontual que nunca pode ser encoberta, nunca "plan" (não é Entry/Stop/Target)', () => {
    expect(chartLayerDepth).toMatch(/confidence_direction:\s*"event"/);
  });
});

describe('ConfidenceDirectionArrowPlugin: fonte ÚNICA, nunca uma regra paralela (item 6 do memo)', () => {
  it('NUNCA calcula "suppressed"/lê expectancyFilter/engine.direction por conta própria — só recebe `direction` já resolvido', () => {
    // Checa o CÓDIGO real (comentários removidos) — o próprio cabeçalho do
    // arquivo EXPLICA em prosa que ele não recalcula supressão, e citar as
    // palavras numa explicação honesta não conta como recalculá-la.
    expect(confidenceArrowCode).not.toContain('suppressed');
    expect(confidenceArrowCode).not.toContain('expectancyFilter');
    expect(confidenceArrowCode).not.toMatch(/\bengine\??\.\w+/);
  });

  it('NUNCA referencia Entry/tradePlan — a seta não representa ENTRY (item 7), e não pode alterar nenhum valor de Entry', () => {
    expect(confidenceArrow).not.toMatch(/tradePlan/i);
    expect(confidenceArrow).not.toMatch(/[Ee]ntry/);
  });

  it('fail-closed: sem LONG nem SHORT, a função de desenho retorna cedo — nenhuma seta inventada para WAIT/undefined', () => {
    expect(confidenceArrow).toMatch(/if\s*\(\s*dir\s*!==\s*"LONG"\s*&&\s*dir\s*!==\s*"SHORT"\s*\)\s*return;/);
  });

  it('sem label desenhado — LONG/SHORT já aparece no CoreSignalBadge, repetir seria poluição (item 12)', () => {
    expect(confidenceArrow).not.toContain('drawCanvasLabel');
    expect(confidenceArrow).not.toContain('fillText');
  });

  it('cor vem da paleta canônica — bullish/bearish, mesma família de direção usada no resto do canvas', () => {
    expect(confidenceArrow).toContain('chartPaletteRgba("bullish"');
    expect(confidenceArrow).toContain('chartPaletteRgba("bearish"');
  });

  it('offset/H maiores que os de HarmonicConfluenceArrowPlugin — anti-colisão determinística (item 10), maior prioridade da hierarquia (item 11)', () => {
    const harmonicArrow = read('../src/chart/HarmonicConfluenceArrowPlugin.tsx');
    const harmonicOffset = Number(harmonicArrow.match(/const OFFSET = (\d+);/)?.[1]);
    const harmonicH = Number(harmonicArrow.match(/const H = (\d+);/)?.[1]);
    const confidenceOffset = Number(confidenceArrow.match(/const OFFSET = (\d+);/)?.[1]);
    const confidenceH = Number(confidenceArrow.match(/const H = (\d+);/)?.[1]);
    expect([harmonicOffset, harmonicH, confidenceOffset, confidenceH].every(Number.isFinite)).toBe(true);
    // Clareia o footprint máximo da irmã (offset+H) por uma folga real —
    // nunca desenha por cima quando as duas caem na mesma vela.
    expect(confidenceOffset - confidenceH).toBeGreaterThan(harmonicOffset + harmonicH);
  });

  it('posicionamento OPOSTO de plan-markers.ts de propósito — DIRECTION ≠ ENTRY (item 7)', () => {
    // LONG aponta pra cima E fica ACIMA (yAnchor - OFFSET); plan-markers.ts
    // ancora LONG abaixo da vela (origem do movimento) — convenções opostas.
    expect(confidenceArrow).toContain('yAnchor - OFFSET');
    expect(confidenceArrow).toContain('yAnchor + OFFSET');
  });

  it('arquitetura de canvas real: rAF + ResizeObserver + getChartLayerZIndex("confidence_direction")', () => {
    expect(confidenceArrow).toContain('requestAnimationFrame');
    expect(confidenceArrow).toContain('ResizeObserver');
    expect(confidenceArrow).toContain('getChartLayerZIndex("confidence_direction")');
  });
});

describe('engine-bridge.ts: computeStructuralSwings usa fractal-swings.js real, nunca reimplementa', () => {
  it('importa findSwings/FRACTAL_K de fractal-swings.js', () => {
    expect(engineBridge).toMatch(/import\s*{\s*FRACTAL_K,\s*findSwings\s*}\s*from\s*['"]\.\.\/\.\.\/src\/research\/engines\/fractal-swings\.js['"]/);
  });

  it('devolve o MESMO shape ZigZagPoint já usado pelo ZigZag — zero segundo tipo', () => {
    expect(engineBridge).toMatch(/export function computeStructuralSwings\([\s\S]{0,200}\):\s*ZigZagPoint\[\]/);
  });
});

describe('App.tsx: confidenceDirection é a MESMA fórmula de effectiveDirection (CoreSignalBadge) — nunca uma regra paralela', () => {
  const SUPPRESSION_CLAUSE = 'expectancyFilter?.show === false';

  it('CoreSignalBadge (fonte da verdade) ainda usa esta cláusula — se isto quebrar, o resto do teste está comparando contra algo desatualizado', () => {
    expect(appTsx).toContain(`) && ${SUPPRESSION_CLAUSE};`);
  });

  it('o useMemo de confidenceDirection usa a MESMA cláusula literal de supressão — nunca um número/condição reinventada', () => {
    const idx = appTsx.indexOf('const confidenceDirection: "LONG" | "SHORT" | null = useMemo(');
    expect(idx, 'useMemo de confidenceDirection não encontrado em App.tsx').toBeGreaterThan(-1);
    const block = appTsx.slice(idx, idx + 600);
    expect(block).toContain(SUPPRESSION_CLAUSE);
    expect(block).toContain('engine?.direction');
    // A cláusula precisa aparecer pelo menos 2 vezes no arquivo (CoreSignal
    // Badge + o useMemo) — não trava num total exato porque ExpectancyCard
    // já usa a mesma condição de forma legítima e independente (pré-
    // existente, exibição do motivo da supressão), então um número fixo
    // fragilizaria o teste contra código não relacionado a este memo.
    const occurrences = appTsx.split(SUPPRESSION_CLAUSE).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('EnhancedChart recebe confidenceDirection={confidenceDirection} — mesmo valor computado, nunca engine?.direction bruto', () => {
    expect(appTsx).toContain('confidenceDirection={confidenceDirection}');
    expect(appTsx).not.toContain('confidenceDirection={engine?.direction}');
  });
});

describe('EnhancedChart_110_Percent.tsx: os 2 plugins montados sem visibility.x — sempre disponíveis por padrão (item 22 do memo)', () => {
  it('StructureTracePlugin e ConfidenceDirectionArrowPlugin NÃO estão em CHART_LAYER_IDS — mesmo precedente de PriceLabelStackPlugin', () => {
    const chartLayerIdsBlock = enhancedChart.slice(
      enhancedChart.indexOf('export const CHART_LAYER_IDS = ['),
      enhancedChart.indexOf('] as const;', enhancedChart.indexOf('export const CHART_LAYER_IDS = [')),
    );
    expect(chartLayerIdsBlock).not.toContain('structure_trace');
    expect(chartLayerIdsBlock).not.toContain('confidence_direction');
  });

  it('nenhum dos dois está atrás de `visibility.x &&` — montagem incondicional de verdade', () => {
    expect(enhancedChart).not.toContain('visibility.structure_trace');
    expect(enhancedChart).not.toContain('visibility.confidence_direction');
  });

  it('StructureTracePlugin monta com a MESMA `data` real dos demais overlays de estrutura', () => {
    const idx = enhancedChart.indexOf('<StructureTracePlugin');
    expect(idx).toBeGreaterThan(-1);
    const block = enhancedChart.slice(idx, idx + 200);
    expect(block).toContain('data={data}');
  });

  it('ConfidenceDirectionArrowPlugin recebe direction={confidenceDirection ?? null} — fail-closed no prop opcional', () => {
    const idx = enhancedChart.indexOf('<ConfidenceDirectionArrowPlugin');
    expect(idx).toBeGreaterThan(-1);
    const block = enhancedChart.slice(idx, idx + 250);
    expect(block).toContain('direction={confidenceDirection ?? null}');
  });
});
