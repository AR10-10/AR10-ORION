// recenter-chart-wiring.test.ts — Ordem "Lapidação Visual Final + Nova
// Linguagem de Gráfico" §8/§9 (RECENTRALIZAR): trava que o botão reusa o
// MESMO enquadre real do zoom inteligente (zero segunda fórmula) e nunca
// toca em dado/decisão/símbolo/timeframe. Fiação (não matemática nova) —
// teste de padrão no código-fonte, convenção deste repositório.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const chart = readFileSync(join(__dirname, '../src/chart/EnhancedChart_110_Percent.tsx'), 'utf8');

describe('recenterChart: mesmo enquadre real do zoom inteligente, disparado por toque', () => {
  // Ordem "FECHAMENTO DO AR10 CYBORG" §5/§6: o enquadre restaurado deixou
  // de ser a constante fixa 120 e passou a ser a MESMA janela adaptativa
  // real do zoom inteligente (computeViewportCandles, 60-200 por largura
  // real de plotagem + densidade de dados). A invariante travada aqui
  // continua sendo a mesma de sempre — uma única fórmula de enquadre no
  // arquivo inteiro — só que agora ela é uma função, não um número.
  it('reusa computeViewportCandles/SMART_ZOOM_RIGHT_PAD_BARS — nunca uma segunda fórmula de enquadre', () => {
    const start = chart.indexOf('const recenterChart = useCallback(');
    expect(start, 'recenterChart não encontrado').toBeGreaterThan(-1);
    const end = chart.indexOf('}, [data]);', start);
    const body = chart.slice(start, end);
    expect(body).toContain('const candles = computeViewportCandles({');
    expect(body).toContain('widthPx: chart.timeScale().width(),');
    expect(body).toContain('availableCandles: data.length,');
    expect(body).toContain('from: Math.max(0, data.length - candles),');
    expect(body).toContain('to: data.length - 1 + SMART_ZOOM_RIGHT_PAD_BARS,');
    // regressão: a constante fixa nunca volta a decidir o enquadre.
    expect(body).not.toContain('SMART_ZOOM_CANDLES');
    // Só timeScale() — nunca setData/setSymbol/setTimeframe/recompute.
    expect(body).not.toContain('setData(');
    expect(body).not.toContain('setSymbol');
    expect(body).not.toContain('setActiveTimeframe');
  });

  it('fail-closed: sem chart pronto ou sem candles, a função retorna sem tocar em nada', () => {
    const start = chart.indexOf('const recenterChart = useCallback(');
    const end = chart.indexOf('}, [data]);', start);
    const body = chart.slice(start, end);
    expect(body).toContain('if (!chart || !data || data.length === 0) return;');
  });

  it('o botão existe, chama recenterChart, e tem aria-label real (tooltip nativo não aparece em toque no iPad Safari)', () => {
    const start = chart.indexOf('aria-label="Recentralizar gráfico"');
    expect(start, 'botão Recentralizar não encontrado').toBeGreaterThan(-1);
    const block = chart.slice(Math.max(0, start - 300), start + 500);
    expect(block).toContain('onClick={recenterChart}');
    expect(block).toContain('<Crosshair size={11} />');
    // pointer-events-auto: o botão precisa ser clicável mesmo dentro da
    // pilha de overlays pointer-events-none do resto do canvas.
    expect(block).toContain('pointer-events-auto');
    // z-10 (achado real via harness Playwright, elementFromPoint no
    // centro do próprio botão): os canvases INTERNOS da lightweight-
    // charts (sem className, geridos pela lib) usam z-index próprio e
    // ficavam ACIMA do botão sem um z-index explícito aqui — DOM order
    // sozinha não vence um z-index explícito de terceiros.
    expect(block).toContain('z-10');
  });
});
