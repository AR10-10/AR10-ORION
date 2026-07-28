// nexus-canvas-label.test.ts — Diretriz Final de Lapidação Visual, Adendo,
// Parte 11 ("etiquetas profissionais"): execução real da primitiva de
// desenho de etiqueta em caixa (canto suave + contraste garantido),
// mesmo espírito de nexus-orderflow-heatmap-draw.test.ts (lógica pura,
// sem canvas real neste ambiente 'node').
import { describe, it, expect } from 'vitest';
import {
  drawCanvasLabel,
  measureCanvasLabel,
  CANVAS_LABEL_FONT,
  CANVAS_LABEL_TEXT_COLOR,
  CANVAS_LABEL_PAD_X,
  CANVAS_LABEL_PAD_Y,
  CANVAS_LABEL_RADIUS,
  type DrawableLabelContext2D,
} from '../src/nexus/canvas-label';

function fakeCtx(textWidth: number): DrawableLabelContext2D & { calls: string[]; roundRectCalled: boolean } {
  const calls: string[] = [];
  return {
    calls,
    roundRectCalled: false,
    font: '',
    fillStyle: '',
    textBaseline: '',
    measureText: (text: string) => {
      calls.push(`measureText(${text})`);
      return { width: textWidth };
    },
    beginPath: () => { calls.push('beginPath()'); },
    rect: (x, y, w, h) => { calls.push(`rect(${x},${y},${w},${h})`); },
    roundRect(x, y, w, h, r) {
      this.roundRectCalled = true;
      calls.push(`roundRect(${x},${y},${w},${h},${r})`);
    },
    fill: () => { calls.push('fill()'); },
    fillText: (text, x, y) => { calls.push(`fillText(${text},${x},${y})`); },
  };
}

function fakeCtxNoRoundRect(textWidth: number): DrawableLabelContext2D & { calls: string[] } {
  const ctx = fakeCtx(textWidth) as Partial<DrawableLabelContext2D> & { calls: string[] };
  delete ctx.roundRect;
  return ctx as DrawableLabelContext2D & { calls: string[] };
}

describe('measureCanvasLabel: dimensões reais a partir do texto medido, nunca uma aproximação fixa', () => {
  it('largura real = texto medido + padding dos 2 lados', () => {
    const ctx = fakeCtx(50);
    const size = measureCanvasLabel(ctx, 'FVG↑');
    expect(size.width).toBe(50 + CANVAS_LABEL_PAD_X * 2);
  });

  it('altura real = tamanho de fonte declarado (9px) + padding vertical dos 2 lados', () => {
    const ctx = fakeCtx(50);
    const size = measureCanvasLabel(ctx, 'FVG↑');
    expect(size.height).toBe(9 + CANVAS_LABEL_PAD_Y * 2);
  });

  it('sempre define a fonte institucional real antes de medir — nunca mede com a fonte default do contexto', () => {
    const ctx = fakeCtx(50);
    measureCanvasLabel(ctx, 'texto');
    expect(ctx.font).toBe(CANVAS_LABEL_FONT);
  });

  it('padX/padY custom real são respeitados quando o chamador precisa de um padding diferente', () => {
    const ctx = fakeCtx(50);
    const size = measureCanvasLabel(ctx, 'texto', 10, 5);
    expect(size.width).toBe(50 + 20);
    expect(size.height).toBe(9 + 10);
  });
});

describe('drawCanvasLabel: caixa real com cantos suavizados quando o motor suporta roundRect', () => {
  it('usa roundRect real do Canvas 2D com o raio institucional padrão quando disponível', () => {
    const ctx = fakeCtx(40);
    drawCanvasLabel(ctx, 10, 20, { fill: 'rgba(1,2,3,0.5)', text: 'BOS' });
    expect(ctx.calls).toContain(`roundRect(10,20,${40 + CANVAS_LABEL_PAD_X * 2},${9 + CANVAS_LABEL_PAD_Y * 2},${CANVAS_LABEL_RADIUS})`);
    expect(ctx.calls).not.toContain(expect.stringMatching(/^rect\(/));
  });

  it('cai para retângulo comum honesto quando o motor NÃO suporta roundRect — nunca fica sem etiqueta', () => {
    const ctx = fakeCtxNoRoundRect(40);
    drawCanvasLabel(ctx, 10, 20, { fill: 'rgba(1,2,3,0.5)', text: 'CHOCH' });
    expect(ctx.calls.some((c) => c.startsWith('rect('))).toBe(true);
    expect(ctx.calls.some((c) => c.startsWith('roundRect('))).toBe(false);
    expect(ctx.calls).toContain('fillText(CHOCH,14,' + (20 + (9 + CANVAS_LABEL_PAD_Y * 2) / 2 + 0.5) + ')');
  });

  it('texto sempre desenhado na cor de contraste institucional garantida, nunca a cor de fundo escolhida pelo chamador', () => {
    const ctx = fakeCtx(40);
    drawCanvasLabel(ctx, 0, 0, { fill: 'rgba(255,0,0,0.9)', text: 'OB↓' });
    // A última atribuição de fillStyle antes do fillText real deve ser a cor de contraste, não o fill da caixa.
    expect(ctx.fillStyle).toBe(CANVAS_LABEL_TEXT_COLOR);
  });

  it('textBaseline sempre "middle" — texto verticalmente centrado real na caixa, nunca a base do bloco', () => {
    const ctx = fakeCtx(40);
    drawCanvasLabel(ctx, 0, 0, { fill: 'rgba(0,0,0,1)', text: 'S1' });
    expect(ctx.textBaseline).toBe('middle');
  });

  it('devolve as dimensões reais desenhadas — quem chama pode centralizar/posicionar em cima sem medir de novo', () => {
    const ctx = fakeCtx(40);
    const size = drawCanvasLabel(ctx, 0, 0, { fill: 'rgba(0,0,0,1)', text: 'R1' });
    expect(size.width).toBe(40 + CANVAS_LABEL_PAD_X * 2);
    expect(size.height).toBe(9 + CANVAS_LABEL_PAD_Y * 2);
  });

  it('radius custom real é respeitado (ex.: uma etiqueta que precise de canto mais/menos suave que o padrão)', () => {
    const ctx = fakeCtx(40);
    drawCanvasLabel(ctx, 5, 5, { fill: 'rgba(0,0,0,1)', text: 'x', radius: 6 });
    expect(ctx.calls.some((c) => c.endsWith(',6)'))).toBe(true);
  });
});
