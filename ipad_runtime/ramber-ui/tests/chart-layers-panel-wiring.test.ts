// chart-layers-panel-wiring.test.ts — "Camadas do Gráfico" (Finding M,
// FASE Ω Priority 3, Backlog Evolutivo): painel novo e aditivo, mesmo
// padrão do Workspace Manager (App.tsx) mas para os overlays do CANVAS
// do gráfico (6 desde a Fase Ω, mais "ema" desde a Diretriz Camada de
// Decisão Profissional — 7 no total). Source-level wiring locks — a
// lógica em si é só visibilidade boolean por id (nada para testar em
// execução real além do que TypeScript já garante via o union type
// ChartLayerId).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('EnhancedChart_110_Percent.tsx: lista canônica única de camadas, todas visíveis por padrão', () => {
  it('exporta CHART_LAYER_IDS com exatamente os 8 overlays reais do canvas (Auditoria do painel do gráfico adiciona "trend_channel")', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('export const CHART_LAYER_IDS = [');
    for (const id of [
      '"liquidity_zones"',
      '"structure_breaks"',
      '"order_flow_heatmap"',
      '"volume_profile"',
      '"trade_plan_zone"',
      '"neural_market_aura"',
      '"ema"',
      '"trend_channel"',
    ]) {
      expect(chart).toContain(id);
    }
  });

  it('DEFAULT_CHART_LAYER_VISIBILITY liga as 8 camadas por padrão — o painel nunca esconde nada sem ação explícita do Operador', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const defMatch = chart.match(/export const DEFAULT_CHART_LAYER_VISIBILITY: ChartLayerVisibility = \{([\s\S]*?)\};/);
    expect(defMatch, 'DEFAULT_CHART_LAYER_VISIBILITY não encontrado').not.toBeNull();
    const body = defMatch![1];
    for (const key of ['liquidity_zones', 'structure_breaks', 'order_flow_heatmap', 'volume_profile', 'trade_plan_zone', 'neural_market_aura', 'ema', 'trend_channel']) {
      expect(body).toContain(`${key}: true,`);
    }
  });

  it('layerVisibility é opcional e fail-closed: ausente cai no default (todas visíveis), nunca quebra um chamador antigo', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('layerVisibility?: ChartLayerVisibility;');
    expect(chart).toContain('const visibility = layerVisibility ?? DEFAULT_CHART_LAYER_VISIBILITY;');
  });

  it('esconder uma camada DESMONTA o plugin (JSX condicional), nunca só passa chart=null — um plugin dirty-flag só redesenha quando algo muda, então chart=null congelaria o último frame em vez de escondê-lo', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('{visibility.order_flow_heatmap && (');
    expect(chart).toContain('{visibility.liquidity_zones && (');
    expect(chart).toContain('{visibility.structure_breaks && (');
    expect(chart).toContain('{visibility.volume_profile && (');
    expect(chart).toContain('{visibility.neural_market_aura && (');
    expect(chart).toContain('{visibility.trade_plan_zone && (');
  });

  it('"ema" e "trend_channel" são a exceção deliberada: séries NATIVAS (não um plugin de canvas), então esconder alterna visible via applyOptions em vez de desmontar JSX — dado real já computado nunca se perde', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('emaSeriesRef.current.applyOptions({ visible: visibility.ema });');
    expect(chart).toContain('trendChannelMidRef.current.applyOptions({ visible: visibility.trend_channel });');
    expect(chart).toContain('trendChannelUpperRef.current.applyOptions({ visible: visibility.trend_channel });');
    expect(chart).toContain('trendChannelLowerRef.current.applyOptions({ visible: visibility.trend_channel });');
  });

  it('Trend Channel: zero rótulo novo na borda de preço (lastValueVisible/priceLineVisible desligados nas 3 séries) — o canal se lê pela posição, nunca compete com CHOCH/VWAP/NL/EMA já empilhados', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const idx = chart.indexOf('const trendChannelSeriesOptions = {');
    expect(idx).toBeGreaterThan(-1);
    const block = chart.slice(idx, idx + 600);
    expect(block).toContain('priceLineVisible: false');
    expect(block).toContain('lastValueVisible: false');
    // fio de seda: sólida, nunca tracejada
    expect(block).toContain('lineStyle: LineStyle.Solid');
  });

  it('Trend Channel deriva SEMPRE da mesma `data` de candles do gráfico (zero segunda fonte), computeTrendChannel importado do motor puro real', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('import { computeTrendChannel, TREND_CHANNEL_DEFAULT_WINDOW } from "../nexus/trend-channel-engine";');
    expect(chart).toContain('const reading = computeTrendChannel(');
    expect(chart).toContain('data.map((c) => ({ time: c.time, close: c.close })),');
  });
});

describe('App.tsx: estado real do painel + toggle por camada, compartilhado via contextValue', () => {
  it('chartLayerVisibility/chartLayersOpen declarados com DEFAULT_CHART_LAYER_VISIBILITY, toggleChartLayer é um updater funcional real', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const [chartLayersOpen, setChartLayersOpen] = useState(false);');
    // Auditoria Final §6: hidrata da sessão persistida (defaults ON quando ausente)
    expect(app).toContain('const [chartLayerVisibility, setChartLayerVisibility] = useState<ChartLayerVisibility>(() => restoredSession.chartLayers);');
    expect(app).toContain('setChartLayerVisibility((prev) => ({ ...prev, [id]: !prev[id] }));');
  });

  it('contextValue expõe chartLayersOpen/chartLayerVisibility/toggleChartLayer — mesmo padrão de workspaceManagerOpen', () => {
    const app = read('../src/App.tsx');
    const memoMatch = app.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(memoMatch, 'contextValue não encontrado').not.toBeNull();
    const body = memoMatch![1];
    expect(body).toContain('chartLayersOpen,');
    expect(body).toContain('setChartLayersOpen,');
    expect(body).toContain('chartLayerVisibility,');
    expect(body).toContain('toggleChartLayer,');
  });

  it('ChartWidget passa layerVisibility real (do contexto) para EnhancedChart_110_Percent, nunca um segundo estado', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('chartLayerVisibility, emaPeriod, confidenceZone, nexusDecision, vwapCtx, nlState } = useContext(WidgetContext) || {};');
    expect(app).toContain('layerVisibility={chartLayerVisibility}');
    expect(app).toContain('emaPeriod={emaPeriod}');
  });

  it('ChartLayersPanel renderizado ao lado de WorkspaceManagerPanel (mesmo nível do Provider)', () => {
    const app = read('../src/App.tsx');
    const wsIdx = app.indexOf('<WorkspaceManagerPanel />');
    const clIdx = app.indexOf('<ChartLayersPanel />');
    expect(wsIdx).toBeGreaterThan(-1);
    expect(clIdx).toBeGreaterThan(-1);
  });

  it('CHART_LAYER_PANEL_MODULES lista exatamente as 8 camadas reais, cada id um ChartLayerId válido (o próprio TypeScript trava isso — este teste só confirma que a lista não encolheu/cresceu silenciosamente)', () => {
    const app = read('../src/App.tsx');
    const listMatch = app.match(/const CHART_LAYER_PANEL_MODULES: \{ id: ChartLayerId; label: string \}\[\] = \[([\s\S]*?)\];/);
    expect(listMatch, 'CHART_LAYER_PANEL_MODULES não encontrado').not.toBeNull();
    const entries = listMatch![1].trim().split('\n').filter((l) => l.trim().length > 0);
    expect(entries).toHaveLength(8);
    expect(listMatch![1]).toContain('{ id: "trend_channel", label: "TREND CHANNEL" }');
  });

  it('painel expõe o seletor real de período da EMA (4 períodos padrão, controle único, nunca uma pilha de linhas)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { EMA_PERIODS, DEFAULT_EMA_PERIOD, type EmaPeriod } from "./nexus/ema";');
    expect(app).toContain('const [emaPeriod, setEmaPeriod] = useState<EmaPeriod>(() => restoredSession.emaPeriod);');
    expect(app).toContain('{id === "ema" && (');
    expect(app).toContain('onClick={() => setEmaPeriod?.(p)}');
  });

  it('SideBar ganha o segundo entry point (Camadas do Gráfico) no mesmo rodapé do Workspace Manager', () => {
    const app = read('../src/App.tsx');
    const sideBarIdx = app.indexOf('function SideBar(');
    const rightRailIdx = app.indexOf('function RightRail(');
    expect(sideBarIdx).toBeGreaterThan(-1);
    expect(rightRailIdx).toBeGreaterThan(sideBarIdx);
    const sideBarBody = app.slice(sideBarIdx, rightRailIdx);
    expect(sideBarBody).toContain('title="Camadas do Gráfico"');
    expect(sideBarBody).toContain('onClick={() => setChartLayersOpen?.((v: boolean) => !v)}');
  });

  it('Achado real (captura do Operador, BTC 1H ao vivo): as 3 séries do Trend Channel têm title EM BRANCO — a lib desenha title no eixo de preço mesmo com lastValueVisible:false, e três etiquetas "TREND" clutteravam um eixo já disputado por R1/NL/EMA/VWAP/preço', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const midIdx = chart.indexOf('const trendChannelMid = chart.addSeries(LineSeries, {');
    const lowerIdx = chart.indexOf('trendChannelMidRef.current = trendChannelMid;');
    expect(midIdx).toBeGreaterThan(-1);
    expect(lowerIdx).toBeGreaterThan(midIdx);
    const block = chart.slice(midIdx, lowerIdx);
    expect(block.match(/title: ""/g)).toHaveLength(3);
    // regressão: nenhuma das 3 séries pode voltar a rotular o eixo
    expect(block).not.toContain('title: "TREND"');
    expect(block).not.toContain('title: "TREND +2σ"');
    expect(block).not.toContain('title: "TREND -2σ"');
  });
});
