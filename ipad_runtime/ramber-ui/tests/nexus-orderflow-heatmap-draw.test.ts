// nexus-orderflow-heatmap-draw.test.ts — V-MAX Fase 1.2: trava a
// primitiva de desenho REAL do OrderFlowHeatmapPlugin (lógica pura, sem
// canvas real — o mesmo espírito de nexus-orderflow-history.test.ts:
// matemática travada por teste, verificação visual real feita à parte via
// harness Playwright).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  drawHeatmapFrame,
  computeCellAlpha,
  computeBubbleRadius,
  computeRecencyWeight,
  RECENCY_FADE_FLOOR,
  type DrawableContext2D,
  type HeatmapFrame,
} from '../src/nexus/orderflow-heatmap-draw';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

function fakeCtx(): DrawableContext2D & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    setTransform: (...args) => { calls.push(`setTransform(${args.join(',')})`); },
    clearRect: (...args) => { calls.push(`clearRect(${args.join(',')})`); },
    fillRect: (...args) => { calls.push(`fillRect(${args.join(',')})`); },
    beginPath: () => { calls.push('beginPath()'); },
    arc: (...args) => { calls.push(`arc(${args.join(',')})`); },
    fill: () => { calls.push('fill()'); },
    stroke: () => { calls.push('stroke()'); },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  };
}

describe('computeCellAlpha: opacidade real proporcional ao tamanho DENTRO do frame, nunca um limiar fixo (Regra de Ouro 1)', () => {
  it('nível no máximo real observado recebe a maior opacidade da janela', () => {
    expect(computeCellAlpha(100, 100)).toBeCloseTo(0.30, 5);
  });

  it('metade do máximo real recebe opacidade proporcional real, nunca arredondada a um valor de exemplo', () => {
    expect(computeCellAlpha(50, 100)).toBeCloseTo(0.04 + 0.5 * (0.30 - 0.04), 5);
  });

  it('sem profundidade real (size<=0) nunca desenha — zero alpha honesto, nunca um piso fabricado', () => {
    expect(computeCellAlpha(0, 100)).toBe(0);
    expect(computeCellAlpha(-5, 100)).toBe(0);
  });

  it('sem máximo real ainda (maxSize<=0, amostra vazia) nunca desenha', () => {
    expect(computeCellAlpha(10, 0)).toBe(0);
  });

  it('nunca ultrapassa o teto real mesmo se size > maxSize por alguma inconsistência de amostragem', () => {
    expect(computeCellAlpha(500, 100)).toBeCloseTo(0.30, 5);
  });
});

describe('computeBubbleRadius: raio real proporcional ao volume — trade grande real nunca fica invisível', () => {
  it('volume no máximo real observado recebe o maior raio da janela', () => {
    expect(computeBubbleRadius(1000, 1000)).toBeCloseTo(11, 5);
  });

  it('caso degenerado (maxVolume indisponível) devolve o raio MÍNIMO visível, nunca 0 — o trade já é real', () => {
    expect(computeBubbleRadius(50, 0)).toBe(3);
  });

  it('volume inválido (<=0) também cai no raio mínimo, nunca um raio negativo/NaN', () => {
    expect(computeBubbleRadius(0, 1000)).toBe(3);
    expect(computeBubbleRadius(-10, 1000)).toBe(3);
  });
});

describe('computeRecencyWeight: fade real por posição no ring buffer (Diretriz Final de Lapidação Visual, Partes 3/4)', () => {
  it('amostra mais recente (último índice) recebe peso máximo real (1)', () => {
    expect(computeRecencyWeight(9, 10)).toBe(1);
  });

  it('amostra mais antiga (índice 0) recebe exatamente RECENCY_FADE_FLOOR, nunca 0 — dado real nunca é apagado', () => {
    expect(computeRecencyWeight(0, 10)).toBeCloseTo(RECENCY_FADE_FLOOR, 5);
    expect(computeRecencyWeight(0, 10)).toBeGreaterThan(0);
  });

  it('amostra no meio do buffer recebe peso real interpolado linearmente', () => {
    // índice 4 de 0..9 (10 amostras) => fraction = 4/9
    const expected = RECENCY_FADE_FLOOR + (4 / 9) * (1 - RECENCY_FADE_FLOOR);
    expect(computeRecencyWeight(4, 10)).toBeCloseTo(expected, 5);
  });

  it('buffer com 1 única amostra real => peso máximo (nada pra interpolar, honesto)', () => {
    expect(computeRecencyWeight(0, 1)).toBe(1);
  });

  it('buffer vazio (length 0) => peso máximo por convenção segura, nunca NaN/divisão por zero', () => {
    expect(computeRecencyWeight(0, 0)).toBe(1);
    expect(Number.isFinite(computeRecencyWeight(0, 0))).toBe(true);
  });

  it('peso é monotonicamente crescente com o índice — mais recente nunca pesa menos que uma amostra mais antiga', () => {
    const weights = Array.from({ length: 10 }, (_, i) => computeRecencyWeight(i, 10));
    for (let i = 1; i < weights.length; i++) expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1]);
  });
});

describe('drawHeatmapFrame: primitiva compartilhada real entre Worker e fallback main-thread (zero repetição)', () => {
  it('sempre limpa o canvas real (setTransform pelo DPR real + clearRect) antes de desenhar', () => {
    const ctx = fakeCtx();
    const frame: HeatmapFrame = { cssWidth: 300, cssHeight: 150, dpr: 2, cells: [], bubbles: [] };
    drawHeatmapFrame(ctx, frame);
    expect(ctx.calls[0]).toBe('setTransform(2,0,0,2,0,0)');
    expect(ctx.calls[1]).toBe('clearRect(0,0,300,150)');
  });

  it('desenha cada célula real via fillRect com a cor já resolvida do descritor', () => {
    const ctx = fakeCtx();
    const frame: HeatmapFrame = {
      cssWidth: 100, cssHeight: 100, dpr: 1,
      cells: [{ x: 10, y: 20, w: 5, h: 3, color: 'rgba(0, 255, 170, 0.12)' }],
      bubbles: [],
    };
    drawHeatmapFrame(ctx, frame);
    expect(ctx.calls).toContain('fillRect(10,20,5,3)');
  });

  it('desenha cada bolha real via arc+fill+stroke, sempre lineWidth=1 sólido (Fio de Seda, Regra de Ouro 2)', () => {
    const ctx = fakeCtx();
    const frame: HeatmapFrame = {
      cssWidth: 100, cssHeight: 100, dpr: 1,
      cells: [],
      bubbles: [{ x: 50, y: 50, r: 7, fill: 'rgba(0,255,170,0.35)', stroke: 'rgba(0,255,170,0.85)' }],
    };
    drawHeatmapFrame(ctx, frame);
    expect(ctx.calls).toContain(`arc(50,50,7,0,${Math.PI * 2})`);
    expect(ctx.calls).toContain('fill()');
    expect(ctx.calls).toContain('stroke()');
    expect(ctx.lineWidth).toBe(1);
  });

  it('nunca chama setLineDash (equivalente Canvas de pontilhado) — nem o fake ctx precisa do método', () => {
    const src = read('../src/nexus/orderflow-heatmap-draw.ts');
    expect(src).not.toMatch(/\.setLineDash\(/);
  });
});
