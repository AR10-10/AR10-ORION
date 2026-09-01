// Fronteira eixo×gráfico — testes de EXECUÇÃO REAL (convenção deste repo:
// lógica pura de fronteira ganha execução real; a fiação nos plugins ganha
// teste de padrão, mais abaixo neste mesmo arquivo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  resolvePlotArea,
  resolveAxisWidthForLabels,
  PLOT_AXIS_GAP_PX,
  PLOT_AXIS_FALLBACK_WIDTH_PX,
  AXIS_WIDTH_STEP_PX,
  AXIS_WIDTH_MAX_PX,
} from '../src/chart/chart-plot-area';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(here, p), 'utf8');

describe('resolvePlotArea: a fronteira real, medida e não suposta', () => {
  // Os números vêm da medição real em Chromium (viewport iPad 834px, mesmas
  // opções de rightPriceScale da produção), documentada no cabeçalho do
  // módulo. Travar o caso medido impede que uma "simplificação" futura
  // volte a mandar o desenho até a borda do container.
  it('caso medido (iPad 834px, eixo real 72px)', () => {
    const a = resolvePlotArea(834, 72);
    expect(a.axisWidth).toBe(72);
    expect(a.axisLeft).toBe(762);
    expect(a.plotRight).toBe(762 - PLOT_AXIS_GAP_PX);
  });

  it('o eixo REAL é mais largo que o minimumWidth — medir importa', () => {
    // 72 medido vs. 65 configurado: a lib cresce o eixo pra caber os
    // dígitos. Um plugin que assumisse o minimumWidth erraria por 7px.
    expect(72).toBeGreaterThan(PLOT_AXIS_FALLBACK_WIDTH_PX);
    expect(resolvePlotArea(834, 72).axisLeft).toBeLessThan(
      resolvePlotArea(834, PLOT_AXIS_FALLBACK_WIDTH_PX).axisLeft,
    );
  });

  it('plotRight fica sempre à ESQUERDA de axisLeft — o desenho nunca alcança o eixo', () => {
    for (const [w, a] of [[834, 72], [1440, 65], [2560, 75], [390, 65]] as const) {
      const r = resolvePlotArea(w, a);
      expect(r.plotRight).toBeLessThan(r.axisLeft);
      expect(r.axisLeft + r.axisWidth).toBe(w);
    }
  });

  // Fail-closed (Regra de Ouro 3): a ausência de medição real nunca pode
  // virar "o gráfico vai até a borda", que é o defeito original.
  it('largura de eixo inválida cai no fallback, NUNCA em 0', () => {
    for (const ruim of [0, -1, NaN, Infinity, undefined as unknown as number]) {
      const r = resolvePlotArea(834, ruim);
      expect(r.axisWidth).toBe(PLOT_AXIS_FALLBACK_WIDTH_PX);
      expect(r.plotRight).toBeLessThan(834);
    }
  });

  it('container inválido não produz coordenada negativa', () => {
    for (const ruim of [0, -100, NaN]) {
      const r = resolvePlotArea(ruim, 72);
      expect(r.plotRight).toBeGreaterThanOrEqual(0);
      expect(r.axisLeft).toBeGreaterThanOrEqual(0);
    }
  });

  it('eixo mais largo que o container: área de plotagem 0, nunca negativa', () => {
    const r = resolvePlotArea(50, 200);
    expect(r.axisWidth).toBe(50);
    expect(r.axisLeft).toBe(0);
    expect(r.plotRight).toBe(0);
  });

  it('a folga padrão é real e maior que zero (a "medida padrão" pedida)', () => {
    expect(PLOT_AXIS_GAP_PX).toBeGreaterThan(0);
    const r = resolvePlotArea(834, 72);
    expect(r.axisLeft - r.plotRight).toBe(PLOT_AXIS_GAP_PX);
  });
});

describe('resolveAxisWidthForLabels: o eixo ganha a largura do próprio conteúdo', () => {
  // O caso real medido: a etiqueta mais larga do conjunto ("VWAP 68.412,5")
  // tem 90,3px e o eixo mede 72 — 20,3px de invasão nas velas. Alinhar a
  // coluna não resolvia isso; só alargar o eixo resolve.
  it('caso medido: 90,3px de etiqueta num eixo de 72px pede um eixo maior', () => {
    const alvo = resolveAxisWidthForLabels(90.3, 72, 2);
    expect(alvo).not.toBeNull();
    expect(alvo!).toBeGreaterThanOrEqual(90.3 + 2);
    // e o resultado é um degrau inteiro, nunca um número quebrado
    expect(alvo! % AXIS_WIDTH_STEP_PX).toBe(0);
  });

  it('null quando já cabe — o caso comum, e o que evita um applyOptions por frame', () => {
    expect(resolveAxisWidthForLabels(40, 72, 2)).toBeNull();
  });

  // Sem histerese, uma etiqueta oscilando em volta de um degrau faria o eixo
  // (e portanto o gráfico inteiro) alternar de largura sem parar.
  it('histerese: só encolhe quando sobra um degrau INTEIRO', () => {
    // Sobra 4px (76 atual, 72 necessário) — MENOS de um degrau => não mexe.
    // (A primeira versão deste teste usava 80 como largura atual e afirmava
    //  o mesmo; 80-72 é exatamente UM degrau, então o código encolhia e
    //  estava certo. Erro de aritmética meu, não do código.)
    expect(resolveAxisWidthForLabels(70, 76, 2)).toBeNull();
    // Sobra um degrau inteiro ou mais => encolhe.
    expect(resolveAxisWidthForLabels(70, 80, 2)).toBe(72);
    const alvo = resolveAxisWidthForLabels(40, 96, 2);
    expect(alvo).not.toBeNull();
    expect(alvo!).toBeLessThan(96);
  });

  it('teto real: etiqueta patológica não come o gráfico', () => {
    expect(resolveAxisWidthForLabels(5000, 72, 2)).toBe(AXIS_WIDTH_MAX_PX);
  });

  it('piso real: nunca abaixo da largura mínima já configurada em produção', () => {
    const alvo = resolveAxisWidthForLabels(10, 200, 2);
    expect(alvo).toBe(PLOT_AXIS_FALLBACK_WIDTH_PX);
  });

  it('fail-closed: entrada inválida nunca mexe no eixo', () => {
    for (const ruim of [0, -5, NaN, Infinity]) {
      expect(resolveAxisWidthForLabels(ruim, 72, 2)).toBeNull();
    }
    // Margem: só NEGATIVA/não-finita é inválida. Zero é uma margem legítima
    // (colar no canto é uma escolha, não um erro) — e por isso produz um
    // alvo real, nunca null.
    for (const ruim of [-5, NaN, Infinity]) {
      expect(resolveAxisWidthForLabels(90, 72, ruim as number)).toBeNull();
    }
    expect(resolveAxisWidthForLabels(90, 72, 0)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FIAÇÃO — teste de padrão. O bug provável aqui não é "a conta está errada"
// (a conta está travada acima), é "esqueceram de ligar um plugin".
// ---------------------------------------------------------------------------
const PLUGINS_QUE_DESENHAM_ATE_A_BORDA = [
  'InstitutionalZonePlugin.tsx',
  'LiquidityZonesPlugin.tsx',
  'NeuralMarketAuraPlugin.tsx',
  'SessionKeyLevelsPlugin.tsx',
  'StructureBreakMarkersPlugin.tsx',
  'TradePlanZonePlugin.tsx',
  'PriceLabelStackPlugin.tsx',
];

describe('todo plugin que desenha até a borda direita usa a fronteira medida', () => {
  it.each(PLUGINS_QUE_DESENHAM_ATE_A_BORDA)('%s importa e usa measurePlotArea', (arquivo) => {
    const src = read(`../src/chart/${arquivo}`);
    expect(src, `${arquivo} não importa chart-plot-area`).toContain('chart-plot-area');
    expect(src, `${arquivo} não chama measurePlotArea`).toContain('measurePlotArea');
  });

  // Guarda anti-vacuidade: se alguém renomear os arquivos, a lista acima
  // vira uma varredura que não acha nada e passaria calada.
  it('a lista acima aponta para arquivos que existem de verdade', () => {
    expect(PLUGINS_QUE_DESENHAM_ATE_A_BORDA.length).toBeGreaterThanOrEqual(7);
    for (const arquivo of PLUGINS_QUE_DESENHAM_ATE_A_BORDA) {
      expect(read(`../src/chart/${arquivo}`).length).toBeGreaterThan(500);
    }
  });

  // O defeito original, travado pelo nome: desenhar até `cssWidth` é
  // exatamente correr por baixo dos números do eixo.
  it('nenhum deles ainda desenha uma borda direita em cssWidth cru', () => {
    for (const arquivo of PLUGINS_QUE_DESENHAM_ATE_A_BORDA) {
      const src = read(`../src/chart/${arquivo}`);
      for (const padrao of [/lineTo\(cssWidth[,)]/, /fillRect\(0,[^)]*cssWidth[,)]/, /=\s*cssWidth\s*-\s*rectX/]) {
        expect(padrao.test(src), `${arquivo} ainda usa ${padrao} — volta a vazar sob o eixo`).toBe(false);
      }
    }
  });
});
