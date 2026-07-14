// conviction-cyclone-draw.test.ts — "Ciclone de Convicção" (evolução
// visual da Neural Market Aura, pedido direto do Operador). Execução real
// da matemática pura: nenhum mock de tempo/RNG — o módulo é determinístico
// por design (ver cabeçalho de conviction-cyclone-draw.ts).
import { describe, it, expect } from 'vitest';
import {
  computeCycloneFrame,
  drawCycloneFrame,
  type CycloneRealParams,
  type CycloneDrawableContext2D,
} from '../src/nexus/conviction-cyclone-draw';

function realParams(overrides: Partial<CycloneRealParams> = {}): CycloneRealParams {
  return {
    bandX: 100,
    cssWidth: 300,
    cssHeight: 200,
    dpr: 2,
    top: 50,
    bottom: 150,
    edgeY: 90,
    color: '0, 255, 170',
    conviction: 0.6,
    turbulence: 0.3,
    fadeAlpha: 1,
    collapse: 0,
    ...overrides,
  };
}

describe('computeCycloneFrame: determinístico, zero Math.random() (mesmos parâmetros => mesmo frame)', () => {
  it('duas chamadas idênticas (mesmo tMs) devolvem pontos byte-idênticos', () => {
    const a = computeCycloneFrame(realParams(), 12345);
    const b = computeCycloneFrame(realParams(), 12345);
    expect(a.points).toEqual(b.points);
  });

  it('tMs diferente avança a animação de verdade (pelo menos um ponto muda)', () => {
    const a = computeCycloneFrame(realParams(), 0);
    const b = computeCycloneFrame(realParams(), 5000);
    const changed = a.points.some((p, i) => p.x !== b.points[i].x || p.y !== b.points[i].y);
    expect(changed).toBe(true);
  });
});

describe('computeCycloneFrame: convicção real controla a quantidade de partículas (nunca um número fixo arbitrário)', () => {
  it('conviction=0 => MIN_PARTICLES (8)', () => {
    const frame = computeCycloneFrame(realParams({ conviction: 0 }), 0);
    expect(frame.points).toHaveLength(8);
  });

  it('conviction=1 => MAX_PARTICLES (40)', () => {
    const frame = computeCycloneFrame(realParams({ conviction: 1 }), 0);
    expect(frame.points).toHaveLength(40);
  });

  it('conviction fora de [0,1] (dado defensivo) é sempre clampado, nunca gera contagem inválida', () => {
    expect(computeCycloneFrame(realParams({ conviction: -1 }), 0).points).toHaveLength(8);
    expect(computeCycloneFrame(realParams({ conviction: 2 }), 0).points).toHaveLength(40);
  });
});

describe('computeCycloneFrame: collapse real = proximidade do alvo — nunca uma contagem regressiva inventada, só geometria ao vivo', () => {
  it('collapse=1 (TARGET_HIT) colapsa TODAS as partículas exatamente no ponto do alvo (x=cssWidth, y=midY)', () => {
    const params = realParams({ collapse: 1, turbulence: 0.9, conviction: 0.8 });
    const frame = computeCycloneFrame(params, 777);
    const midY = (params.top + params.bottom) / 2;
    for (const pt of frame.points) {
      expect(pt.x).toBe(params.cssWidth);
      expect(pt.y).toBe(midY);
    }
  });

  it('collapse=0 (WAITING) espalha as partículas por um range real de x, nunca todas no mesmo ponto', () => {
    const frame = computeCycloneFrame(realParams({ collapse: 0, conviction: 1 }), 0);
    const xs = frame.points.map((p) => p.x);
    const spread = Math.max(...xs) - Math.min(...xs);
    expect(spread).toBeGreaterThan(50); // real dispersão ao longo do corredor, não um punhado de pixels
  });
});

describe('computeCycloneFrame: geometria real nunca escapa do corredor (Fail-Closed geométrico)', () => {
  it('todo x fica dentro de [bandX, cssWidth]', () => {
    const params = realParams({ conviction: 1, turbulence: 1, collapse: 0.4 });
    const frame = computeCycloneFrame(params, 999999);
    for (const pt of frame.points) {
      expect(pt.x).toBeGreaterThanOrEqual(params.bandX - 1e-9);
      expect(pt.x).toBeLessThanOrEqual(params.cssWidth + 1e-9);
    }
  });

  it('todo y fica numa vizinhança real do corredor (nunca escapa pra fora da tela por turbulência)', () => {
    const params = realParams({ conviction: 1, turbulence: 1, collapse: 0 });
    const frame = computeCycloneFrame(params, 123456);
    const bandHeight = params.bottom - params.top;
    for (const pt of frame.points) {
      expect(pt.y).toBeGreaterThan(params.top - bandHeight);
      expect(pt.y).toBeLessThan(params.bottom + bandHeight);
    }
  });

  it('nenhum ponto/alpha é NaN ou Infinity mesmo no caso degenerado bandX===cssWidth', () => {
    const frame = computeCycloneFrame(realParams({ bandX: 300, cssWidth: 300 }), 42);
    for (const pt of frame.points) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
      expect(Number.isFinite(pt.alpha)).toBe(true);
    }
  });
});

describe('computeCycloneFrame: fadeAlpha real (nascimento/dissolução) sempre amortece, nunca amplifica', () => {
  it('fadeAlpha=0 => todo ponto tem alpha 0 (nada desenhado, honesto)', () => {
    const frame = computeCycloneFrame(realParams({ fadeAlpha: 0 }), 0);
    for (const pt of frame.points) expect(pt.alpha).toBe(0);
  });

  it('alpha de cada ponto nunca excede fadeAlpha (nunca mais vívido que a leitura real de nascimento/dissolução)', () => {
    const fadeAlpha = 0.4;
    const frame = computeCycloneFrame(realParams({ fadeAlpha }), 555);
    for (const pt of frame.points) expect(pt.alpha).toBeLessThanOrEqual(fadeAlpha + 1e-9);
  });
});

// Mock mínimo de contexto 2D que grava a sequência real de chamadas — sem
// nenhum DOM/canvas real, só o subconjunto que CycloneDrawableContext2D
// exige (mesmo princípio de teste do orderflow-heatmap-draw.ts).
class RecordingCtx implements CycloneDrawableContext2D {
  calls: string[] = [];
  strokeLineWidths: number[] = [];
  fillCount = 0;
  lineWidth = 0;
  globalAlpha = 1;
  fillStyle: string | CanvasGradient | CanvasPattern = '';
  strokeStyle: string | CanvasGradient | CanvasPattern = '';
  setTransform() { this.calls.push('setTransform'); }
  clearRect() { this.calls.push('clearRect'); }
  beginPath() { this.calls.push('beginPath'); }
  arc() { this.calls.push('arc'); }
  fill() { this.fillCount++; this.calls.push('fill'); }
  moveTo() { this.calls.push('moveTo'); }
  lineTo() { this.calls.push('lineTo'); }
  stroke() { this.strokeLineWidths.push(this.lineWidth); this.calls.push('stroke'); }
}

describe('drawCycloneFrame: Fio de Seda literal — única linha de marcação real (borda do alvo) sempre 1px sólida', () => {
  it('toda chamada real de stroke() acontece com lineWidth exatamente 1', () => {
    const ctx = new RecordingCtx();
    const frame = computeCycloneFrame(realParams({ conviction: 0.9 }), 3000);
    drawCycloneFrame(ctx, frame);
    expect(ctx.strokeLineWidths.length).toBeGreaterThan(0);
    for (const lw of ctx.strokeLineWidths) expect(lw).toBe(1);
  });

  it('edgeY null (sem leitura real de alvo visível) nunca desenha a linha — honesto, nunca extrapola', () => {
    const ctx = new RecordingCtx();
    const frame = computeCycloneFrame(realParams({ edgeY: null }), 0);
    drawCycloneFrame(ctx, frame);
    expect(ctx.strokeLineWidths).toHaveLength(0);
  });

  it('cada partícula com alpha>0 vira exatamente um fill() real — nenhum ponto fabricado além do frame', () => {
    const ctx = new RecordingCtx();
    const frame = computeCycloneFrame(realParams({ fadeAlpha: 1 }), 0);
    drawCycloneFrame(ctx, frame);
    const visiblePoints = frame.points.filter((p) => p.alpha > 0).length;
    expect(ctx.fillCount).toBe(visiblePoints);
  });

  it('sempre limpa o canvas real antes de desenhar (clearRect chamado)', () => {
    const ctx = new RecordingCtx();
    drawCycloneFrame(ctx, computeCycloneFrame(realParams(), 0));
    expect(ctx.calls[0]).toBe('setTransform');
    expect(ctx.calls[1]).toBe('clearRect');
  });
});
