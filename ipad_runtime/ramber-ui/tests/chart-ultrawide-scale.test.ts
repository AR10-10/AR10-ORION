// chart-ultrawide-scale.test.ts — AR10_ORDEM_ULTRA_LED_v3.md (Fase A):
// fontSize/minimumWidth/rightOffset do gráfico principal eram fixos
// (11/65/8) em qualquer resolução — auditoria confirmou os 3 valores reais
// hardcoded em EnhancedChart_110_Percent.tsx. Duas partes: (1) a função
// pura resolveChartUltraWideScale testada por execução real (fronteira de
// breakpoint é fácil de acertar errado silenciosamente — off-by-one no
// operador de comparação, direção invertida etc.); (2) padrão no
// código-fonte confirmando a fiação real (createChart usa os 3 valores
// computados, o listener de resize existe e é limpo na desmontagem).
//
// Fora do escopo desta função (documentado no próprio header dela em
// EnhancedChart_110_Percent.tsx, não retestado aqui): barSpacing
// (conflitaria com nexus/chart-viewport.ts, já em produção) e densidade de
// grid (não existe como opção real da lib — confirmado contra os typings).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveChartUltraWideScale } from '../src/chart/EnhancedChart_110_Percent';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('resolveChartUltraWideScale: piso nunca abaixo do que já está em produção', () => {
  it('iPad Pro retrato/paisagem (1024/1366) e qualquer largura < 1440: baseline exata já em produção (11/65/8)', () => {
    expect(resolveChartUltraWideScale(1024)).toEqual({ fontSize: 11, minimumWidth: 65, rightOffset: 8 });
    expect(resolveChartUltraWideScale(1366)).toEqual({ fontSize: 11, minimumWidth: 65, rightOffset: 8 });
    expect(resolveChartUltraWideScale(1439)).toEqual({ fontSize: 11, minimumWidth: 65, rightOffset: 8 });
  });

  it('desktop 1440-2559: fontSize sobe pra 12; minimumWidth/rightOffset continuam no piso (o próprio documento pedia os mesmos valores atuais nesta faixa)', () => {
    expect(resolveChartUltraWideScale(1440)).toEqual({ fontSize: 12, minimumWidth: 65, rightOffset: 8 });
    expect(resolveChartUltraWideScale(1920)).toEqual({ fontSize: 12, minimumWidth: 65, rightOffset: 8 });
    expect(resolveChartUltraWideScale(2559)).toEqual({ fontSize: 12, minimumWidth: 65, rightOffset: 8 });
  });

  it('4K/UltraWide >= 2560: os 3 valores sobem (13/75/12)', () => {
    expect(resolveChartUltraWideScale(2560)).toEqual({ fontSize: 13, minimumWidth: 75, rightOffset: 12 });
    expect(resolveChartUltraWideScale(3440)).toEqual({ fontSize: 13, minimumWidth: 75, rightOffset: 12 }); // UltraWide 21:9
    expect(resolveChartUltraWideScale(3840)).toEqual({ fontSize: 13, minimumWidth: 75, rightOffset: 12 }); // 4K
  });

  it('fail-closed: largura não-finita cai na baseline (nunca no tier 4K por acidente)', () => {
    expect(resolveChartUltraWideScale(NaN)).toEqual({ fontSize: 11, minimumWidth: 65, rightOffset: 8 });
    expect(resolveChartUltraWideScale(Infinity)).toEqual({ fontSize: 11, minimumWidth: 65, rightOffset: 8 });
  });

  it('nenhum valor jamais fica abaixo da baseline (monotônico não-decrescente nos 3 campos)', () => {
    const widths = [320, 768, 1024, 1366, 1439, 1440, 1920, 2559, 2560, 3440, 3840, 5120];
    let prev = resolveChartUltraWideScale(widths[0]);
    for (const w of widths.slice(1)) {
      const cur = resolveChartUltraWideScale(w);
      expect(cur.fontSize).toBeGreaterThanOrEqual(prev.fontSize);
      expect(cur.minimumWidth).toBeGreaterThanOrEqual(prev.minimumWidth);
      expect(cur.rightOffset).toBeGreaterThanOrEqual(prev.rightOffset);
      prev = cur;
    }
  });
});

describe('EnhancedChart: os 3 valores responsivos realmente alimentam createChart, e o resize é ouvido e limpo', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('initialScale computado uma vez por montagem e usado nos 3 pontos reais (layout/rightPriceScale/timeScale)', () => {
    const s = chart();
    expect(s).toContain('const initialScale = resolveChartUltraWideScale(window.innerWidth);');
    expect(s).toContain('fontSize: initialScale.fontSize,');
    expect(s).toContain('minimumWidth: initialScale.minimumWidth,');
    expect(s).toContain('rightOffset: initialScale.rightOffset,');
  });

  it('listener de resize real (debounced) recomputa e só chama applyOptions quando o breakpoint muda de fato', () => {
    const s = chart();
    const block = s.slice(s.indexOf('handleUltraWideResize = ()'), s.indexOf('window.addEventListener("resize", handleUltraWideResize);'));
    expect(block).toContain('const nextScale = resolveChartUltraWideScale(window.innerWidth);');
    expect(block).toContain('nextScale.fontSize === currentScale.fontSize');
    expect(block).toContain('chart.applyOptions({');
    expect(s).toContain('window.addEventListener("resize", handleUltraWideResize);');
  });

  it('listener e timeout são limpos na desmontagem, junto do resto do cleanup real do chart', () => {
    const s = chart();
    const cleanupBlock = s.slice(s.indexOf('window.removeEventListener("resize", handleUltraWideResize);'), s.indexOf('chart.remove();') + 20);
    expect(cleanupBlock).toContain('window.removeEventListener("resize", handleUltraWideResize);');
    expect(cleanupBlock).toContain('if (resizeTimeout) clearTimeout(resizeTimeout);');
    expect(cleanupBlock).toContain('chart.remove();');
  });
});
