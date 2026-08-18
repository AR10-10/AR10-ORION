// chart-layer-depth.test.ts — a TERCEIRA dimensão do layout.
// Reclamação direta do Operador: "o FVG verde fica por baixo da outra camada,
// aí o azul... as camadas ficam atrapalhando a outra; elas sempre têm de
// realçar". Causa medida: 14 dos 15 plugins não declaravam z-index nenhum,
// então o empilhamento vinha da ordem ACIDENTAL de montagem no DOM.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getChartLayerZIndex,
  getChartLayerTier,
  CHART_LABEL_Z_INDEX,
  CHART_DEPTH_REGISTERED_IDS,
} from '../src/chart/chart-layer-depth';

const chartSrc = readFileSync(resolve(__dirname, '../src/chart/EnhancedChart_110_Percent.tsx'), 'utf-8');
const layerIds = (() => {
  const i = chartSrc.indexOf('CHART_LAYER_IDS = [');
  const j = chartSrc.indexOf('] as const', i);
  return [...chartSrc.slice(i, j).matchAll(/^\s*"([a-z_0-9]+)",/gm)].map((m) => m[1]);
})();

describe('Profundidade declarada: nada mais depende da ordem acidental do DOM', () => {
  it('COBERTURA 1:1 — toda camada real tem profundidade declarada', () => {
    // Se alguém adicionar camada nova e esquecer da profundidade, ela cai no
    // fallback ("zone") e o teste avisa aqui, não na tela do Operador.
    expect(layerIds.length).toBeGreaterThan(20);
    const semProfundidade = layerIds.filter((id) => !CHART_DEPTH_REGISTERED_IDS.includes(id));
    expect(semProfundidade).toEqual([]);
  });

  it('A REGRA: preenchimento NUNCA fica acima de linha — era isso que apagava o FVG', () => {
    // Uma linha de 1px coberta por área pintada simplesmente SOME. É o
    // sintoma exato que o Operador relatou.
    const campo = ['market_sessions', 'kill_zones', 'neural_market_aura', 'order_flow_heatmap', 'liquidation_heatmap'];
    const zonas = ['liquidity_zones', 'institutional_zones', 'premium_discount'];
    const linhas = ['ema', 'vwap', 'nexus_line', 'fibonacci', 'trend_channel', 'zigzag', 'session_key_levels', 'equal_highs_lows'];
    for (const c of campo) for (const z of zonas) expect(getChartLayerZIndex(c)).toBeLessThan(getChartLayerZIndex(z));
    for (const z of zonas) for (const l of linhas) expect(getChartLayerZIndex(z)).toBeLessThan(getChartLayerZIndex(l));
  });

  it('EVENTO acima de linha: "aconteceu aqui" nunca pode ser encoberto', () => {
    const eventos = ['structure_breaks', 'liquidity_sweep', 'harmonics'];
    for (const e of eventos) {
      expect(getChartLayerZIndex(e)).toBeGreaterThan(getChartLayerZIndex('vwap'));
      expect(getChartLayerZIndex(e)).toBeGreaterThan(getChartLayerZIndex('fibonacci'));
    }
  });

  it('PLANO acima de tudo que é análise — é a única camada acionável agora', () => {
    for (const id of layerIds) {
      if (id === 'trade_plan_zone') continue;
      expect(getChartLayerZIndex('trade_plan_zone')).toBeGreaterThanOrEqual(getChartLayerZIndex(id));
    }
  });

  it('ETIQUETA no topo absoluto — texto ilegível não é informação', () => {
    for (const id of layerIds) {
      expect(CHART_LABEL_Z_INDEX).toBeGreaterThan(getChartLayerZIndex(id));
    }
  });

  it('fail-closed: camada desconhecida cai no MEIO, nunca some nem cobre o plano', () => {
    const z = getChartLayerZIndex('camada_que_ainda_nao_existe');
    expect(getChartLayerTier('camada_que_ainda_nao_existe')).toBe('zone');
    expect(z).toBeGreaterThan(getChartLayerZIndex('market_sessions')); // não some no fundo
    expect(z).toBeLessThan(getChartLayerZIndex('trade_plan_zone'));    // não cobre o plano
    expect(z).toBeLessThan(CHART_LABEL_Z_INDEX);
  });

  it('FIAÇÃO: todo plugin de canvas consome a profundidade — nenhum ficou de fora', () => {
    // O defeito original era exatamente "14 de 15 sem z-index". Este teste
    // impede a recaída.
    const dir = resolve(__dirname, '../src/chart');
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    const plugins = readdirSync(dir).filter((f) => f.endsWith('Plugin.tsx'));
    expect(plugins.length).toBeGreaterThanOrEqual(15);
    for (const p of plugins) {
      const src = readFileSync(resolve(dir, p), 'utf-8');
      expect(src, `${p} sem profundidade declarada`).toContain('chart-layer-depth');
      expect(src, `${p} não aplica zIndex no canvas`).toMatch(/zIndex:\s*(getChartLayerZIndex|CHART_LABEL_Z_INDEX)/);
    }
  });

  it('nenhum z-index numérico solto sobrou nos plugins (fonte única)', () => {
    const dir = resolve(__dirname, '../src/chart');
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    for (const p of readdirSync(dir).filter((f) => f.endsWith('Plugin.tsx'))) {
      const src = readFileSync(resolve(dir, p), 'utf-8');
      expect(src, `${p} tem zIndex literal`).not.toMatch(/zIndex:\s*\d+/);
    }
  });
});
