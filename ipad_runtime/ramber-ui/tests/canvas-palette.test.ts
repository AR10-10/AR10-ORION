// canvas-palette.test.ts — Falha #4 (AR10_AUDITORIA_ECOSSISTEMA.md /
// AR10_ORDEM_POS_AUDITORIA.md): 2 funções puras, 1 linha cada, zero teste
// até agora. Execução real (mesmo padrão de ema.test.ts para lógica pura de
// fronteira), não teste de padrão de código — aqui faz sentido chamar a
// função de verdade.
import { describe, it, expect } from 'vitest';
import { chartBullishRgba, chartBearishRgba, CHART_BULLISH_HEX, CHART_BEARISH_HEX } from '../src/chart/canvas-palette';

describe('canvas-palette: par universal bullish/bearish (achado B12 da auditoria técnica)', () => {
  it('chartBullishRgba(0.5) retorna rgba(0, 255, 170, 0.5)', () => {
    expect(chartBullishRgba(0.5)).toBe('rgba(0, 255, 170, 0.5)');
  });

  it('chartBearishRgba(0.5) retorna rgba(255, 0, 85, 0.5)', () => {
    expect(chartBearishRgba(0.5)).toBe('rgba(255, 0, 85, 0.5)');
  });

  it('os hex exportados são a mesma cor-base das funções rgba (zero par duplicado por acidente)', () => {
    expect(CHART_BULLISH_HEX).toBe('#00ffaa');
    expect(CHART_BEARISH_HEX).toBe('#ff0055');
  });
});
