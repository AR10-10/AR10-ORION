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
// chart-ultrawide-scale.ts, não retestado aqui): barSpacing (conflitaria
// com nexus/chart-viewport.ts, já em produção) e densidade de grid (não
// existe como opção real da lib — confirmado contra os typings).
//
// Achado real, task #341 (auditoria "Estratégia de Evolução Elite"
// 2026-08-16): a função foi extraída de EnhancedChart_110_Percent.tsx
// para chart-ultrawide-scale.ts, módulo próprio — PriceLabelStackPlugin
// passou a precisar da MESMA escala (etiquetas do eixo ficavam com fonte
// fixa mesmo em monitor 4K) e importar direto do componente do gráfico
// criaria um ciclo real (aquele arquivo já importa o plugin).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveChartUltraWideScale, resolveCanvasLabelFontPx, resolveCanvasLabelFont } from '../src/chart/chart-ultrawide-scale';

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

  it('importa resolveChartUltraWideScale do módulo próprio (nunca redefine localmente — evita o ciclo real com PriceLabelStackPlugin)', () => {
    const s = chart();
    expect(s).toContain('import { resolveChartUltraWideScale } from "./chart-ultrawide-scale";');
    expect(s).not.toContain('export function resolveChartUltraWideScale');
  });

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

// ============================================================================
// ETIQUETA DE CANVAS — escala por tela (pedido do Operador: "tamanho padrão
// de qualquer terminal pra qualquer tela, qualquer monitor, iPad")
// ============================================================================
describe('resolveCanvasLabelFontPx: uma decisão de tamanho, não duas', () => {
  it('PISO: nunca desce abaixo do valor que já estava em produção (9px)', () => {
    // Regressão de tamanho em QUALQUER tela é proibida — mesma disciplina do
    // helper do eixo. Varre as faixas reais e as bordas.
    for (const w of [0, 320, 768, 1024, 1366, 1439, 1440, 2559, 2560, 3840, 5120]) {
      expect(resolveCanvasLabelFontPx(w)).toBeGreaterThanOrEqual(9);
    }
  });

  it('iPad (alvo primário real do app) mantém exatamente o tamanho atual', () => {
    // Regra de Ouro 7: iPad Safari é o alvo primário. 1024 e 1366 são as
    // larguras reais de iPad/iPad Pro em paisagem.
    expect(resolveCanvasLabelFontPx(1024)).toBe(9);
    expect(resolveCanvasLabelFontPx(1366)).toBe(9);
  });

  it('monitor grande e 4K crescem de verdade — era aqui que a etiqueta ficava congelada', () => {
    expect(resolveCanvasLabelFontPx(1440)).toBe(10);
    expect(resolveCanvasLabelFontPx(2560)).toBe(11);
    expect(resolveCanvasLabelFontPx(3840)).toBe(11);
  });

  it('fail-closed: largura inválida cai no piso, nunca em NaN na fonte', () => {
    for (const bad of [Number.NaN, Infinity, -1, -9999]) {
      expect(resolveCanvasLabelFontPx(bad)).toBe(9);
      expect(resolveCanvasLabelFont(bad)).toBe('9px -apple-system, sans-serif');
    }
  });

  it('HIERARQUIA: a etiqueta de contexto fica sempre ABAIXO da fonte do eixo', () => {
    // A etiqueta de zona é contexto; o eixo é leitura principal. Se um dia
    // alguém igualar os dois, o contexto passa a competir com o preço — a
    // hierarquia que a Parte 13 da diretiva de lapidação estabeleceu.
    for (const w of [1024, 1366, 1440, 2560, 3840]) {
      expect(resolveCanvasLabelFontPx(w)).toBeLessThan(resolveChartUltraWideScale(w).fontSize);
    }
  });

  it('monotônica: tela maior nunca devolve fonte menor', () => {
    const widths = [320, 768, 1024, 1366, 1440, 1920, 2560, 3840, 5120];
    for (let i = 1; i < widths.length; i++) {
      expect(resolveCanvasLabelFontPx(widths[i])).toBeGreaterThanOrEqual(resolveCanvasLabelFontPx(widths[i - 1]));
    }
  });

  it('a família tipográfica é a MESMA do resto do canvas — só o corpo varia', () => {
    for (const w of [1024, 1440, 2560]) {
      expect(resolveCanvasLabelFont(w)).toBe(`${resolveCanvasLabelFontPx(w)}px -apple-system, sans-serif`);
    }
  });
});
