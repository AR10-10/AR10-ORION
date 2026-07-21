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
  it('exporta CHART_LAYER_IDS com exatamente os 15 overlays reais do canvas (Auditoria de pendências adiciona VWAP/Nexus Line/CVD/Fibonacci/Premium-Discount/harmônico/EQH-EQL aos 8 anteriores)', () => {
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
      '"vwap"',
      '"nexus_line"',
      '"cvd"',
      '"fibonacci"',
      '"premium_discount"',
      '"harmonics"',
      '"equal_highs_lows"',
    ]) {
      expect(chart).toContain(id);
    }
  });

  it('DEFAULT_CHART_LAYER_VISIBILITY liga as 15 camadas por padrão — o painel nunca esconde nada sem ação explícita do Operador', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const defMatch = chart.match(/export const DEFAULT_CHART_LAYER_VISIBILITY: ChartLayerVisibility = \{([\s\S]*?)\};/);
    expect(defMatch, 'DEFAULT_CHART_LAYER_VISIBILITY não encontrado').not.toBeNull();
    const body = defMatch![1];
    for (const key of ['liquidity_zones', 'structure_breaks', 'order_flow_heatmap', 'volume_profile', 'trade_plan_zone', 'neural_market_aura', 'ema', 'trend_channel', 'vwap', 'nexus_line', 'cvd', 'fibonacci', 'premium_discount', 'harmonics', 'equal_highs_lows']) {
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
    expect(chart).toContain('import { computeTrendChannel, TREND_CHANNEL_DEFAULT_WINDOW, TREND_CHANNEL_STDDEV_MULTIPLIER, type TrendChannelDirection } from "../nexus/trend-channel-engine";');
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

  it('CHART_LAYER_PANEL_MODULES lista exatamente as 15 camadas reais, cada id um ChartLayerId válido (o próprio TypeScript trava isso — este teste só confirma que a lista não encolheu/cresceu silenciosamente)', () => {
    const app = read('../src/App.tsx');
    const listMatch = app.match(/const CHART_LAYER_PANEL_MODULES: \{ id: ChartLayerId; label: string \}\[\] = \[([\s\S]*?)\];/);
    expect(listMatch, 'CHART_LAYER_PANEL_MODULES não encontrado').not.toBeNull();
    const entries = listMatch![1].trim().split('\n').filter((l) => l.trim().length > 0);
    expect(entries).toHaveLength(15);
    expect(listMatch![1]).toContain('{ id: "trend_channel", label: "TREND CHANNEL" }');
  });

  it('Auditoria de pendências: os 7 toggles novos (VWAP/Nexus Line/CVD/Fibonacci/Premium-Discount/harmônico/EQH-EQL) entram no painel — nenhum elemento nativo do gráfico fica sem controle', () => {
    const app = read('../src/App.tsx');
    const listMatch = app.match(/const CHART_LAYER_PANEL_MODULES: \{ id: ChartLayerId; label: string \}\[\] = \[([\s\S]*?)\];/);
    expect(listMatch, 'CHART_LAYER_PANEL_MODULES não encontrado').not.toBeNull();
    const body = listMatch![1];
    expect(body).toContain('{ id: "vwap", label: "VWAP" }');
    expect(body).toContain('{ id: "nexus_line", label: "NEXUS LINE" }');
    expect(body).toContain('{ id: "cvd", label: "CVD" }');
    expect(body).toContain('{ id: "fibonacci", label: "FIBONACCI" }');
    expect(body).toContain('{ id: "premium_discount", label: "PREMIUM / DISCOUNT" }');
    expect(body).toContain('{ id: "harmonics", label: "HARMÔNICOS" }');
    expect(body).toContain('{ id: "equal_highs_lows", label: "EQH / EQL" }');
  });

  it('Auditoria de pendências: os 7 toggles novos entram no Modo Inteligência (leitura de mercado/estrutura, nenhum específico do plano ativo) — nunca no Modo Operacional (que fica enxuto de propósito)', () => {
    const app = read('../src/App.tsx');
    const intelMatch = app.match(/const CHART_LAYERS_INTELLIGENCE_PRESET = new Set<ChartLayerId>\(\[([\s\S]*?)\]\);/);
    expect(intelMatch, 'CHART_LAYERS_INTELLIGENCE_PRESET não encontrado').not.toBeNull();
    const intelBody = intelMatch![1];
    for (const id of ['"vwap"', '"nexus_line"', '"cvd"', '"fibonacci"', '"premium_discount"', '"harmonics"', '"equal_highs_lows"']) {
      expect(intelBody).toContain(id);
    }
    const opIdx = app.indexOf('const CHART_LAYERS_OPERATIONAL_PRESET = new Set<ChartLayerId>([');
    const opEnd = app.indexOf(']);', opIdx);
    const opBody = app.slice(opIdx, opEnd);
    expect(opBody).toEqual(expect.not.stringContaining('"vwap"'));
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

  it('Diretriz de Evolução Autônoma Integral §11: Modo Operacional/Auditoria — preset real sobre o mesmo estado do toggle individual, nunca uma segunda fonte de visibilidade', () => {
    const app = read('../src/App.tsx');
    const presetMatch = app.match(/const CHART_LAYERS_OPERATIONAL_PRESET = new Set<ChartLayerId>\(\[([\s\S]*?)\]\);/);
    expect(presetMatch, 'CHART_LAYERS_OPERATIONAL_PRESET não encontrado').not.toBeNull();
    // as 3 camadas que desenham o PLANO/direção de relance — nunca as de
    // estrutura/contexto (prioridades 7-8 da diretriz).
    expect(presetMatch![1]).toContain('"trade_plan_zone"');
    expect(presetMatch![1]).toContain('"neural_market_aura"');
    expect(presetMatch![1]).toContain('"ema"');
    expect(presetMatch![1]).not.toContain('"liquidity_zones"');
    expect(presetMatch![1]).not.toContain('"structure_breaks"');
    expect(presetMatch![1]).not.toContain('"order_flow_heatmap"');
    expect(presetMatch![1]).not.toContain('"volume_profile"');
    expect(presetMatch![1]).not.toContain('"trend_channel"');

    const fnMatch = app.match(/const applyChartLayerPreset = useCallback\(\(preset: "operational" \| "audit" \| "intelligence"\) => \{([\s\S]*?)\n {2}\}, \[\]\);/);
    expect(fnMatch, 'applyChartLayerPreset não encontrada').not.toBeNull();
    const body = fnMatch![1];
    // audit = o MESMO default de sempre (todas ligadas), nunca uma segunda lista
    expect(body).toContain('setChartLayerVisibility(DEFAULT_CHART_LAYER_VISIBILITY);');
    // operational/intelligence = reduz sobre CHART_LAYER_IDS (a lista canônica única), nunca hardcoded
    expect(body).toContain('CHART_LAYER_IDS.reduce(');
    expect(body).toContain('activeSet.has(id)');
    expect(body).toContain('preset === "intelligence" ? CHART_LAYERS_INTELLIGENCE_PRESET : CHART_LAYERS_OPERATIONAL_PRESET');

    // exposto no contexto e consumido pelo painel — nunca um segundo painel
    expect(app).toContain('applyChartLayerPreset,');
    expect(app).toContain('toggleChartLayer, applyChartLayerPreset, emaPeriod, setEmaPeriod } =');
    expect(app).toContain('onClick={() => applyChartLayerPreset?.("operational")}');
    expect(app).toContain('onClick={() => applyChartLayerPreset?.("audit")}');
    // o botão continua sendo um atalho — o toggle individual não foi removido
    expect(app).toContain('onClick={() => toggleChartLayer?.(id)}');
  });

  it('Diretriz Suprema de Evolução Integrativa §8 ("Modo Inteligência"): 3º preset real — todas as camadas de leitura estrutural/contexto, SEM as duas que só existem para o plano ATIVO', () => {
    const app = read('../src/App.tsx');
    const presetMatch = app.match(/const CHART_LAYERS_INTELLIGENCE_PRESET = new Set<ChartLayerId>\(\[([\s\S]*?)\]\);/);
    expect(presetMatch, 'CHART_LAYERS_INTELLIGENCE_PRESET não encontrado').not.toBeNull();
    const body = presetMatch![1];
    expect(body).toContain('"liquidity_zones"');
    expect(body).toContain('"structure_breaks"');
    expect(body).toContain('"order_flow_heatmap"');
    expect(body).toContain('"volume_profile"');
    expect(body).toContain('"ema"');
    expect(body).toContain('"trend_channel"');
    // as duas camadas do plano ATIVO nunca entram no Modo Inteligência —
    // análise profunda do MERCADO, não do plano em si.
    expect(body).not.toContain('"trade_plan_zone"');
    expect(body).not.toContain('"neural_market_aura"');

    expect(app).toContain('onClick={() => applyChartLayerPreset?.("intelligence")}');
    expect(app).toContain('const isIntelligencePreset = CHART_LAYER_IDS.every((id) => visibility[id] === CHART_LAYERS_INTELLIGENCE_PRESET.has(id));');
    expect(app).toContain('Modo Inteligência');
  });
});

describe('Diretriz de Refinamento Visual §5: Trend Channel reposicionado para a lateral do eixo de preço (mesmo sistema anti-colisão de R1/NL/VWAP/EMA/S1)', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('o <div> solto no canto superior (identidade v1, commit anterior) foi removido — nunca mais um título flutuando fora do eixo', () => {
    const c = chart();
    expect(c).not.toContain('left-2 top-2');
    expect(c).not.toContain('{visibility.trend_channel && trendChannelInfo && (');
  });

  it('trendChannelInfo agora carrega midPrice (ponta real da linha mid) — o dado que ancora o rótulo no eixo', () => {
    const c = chart();
    expect(c).toContain('const [trendChannelInfo, setTrendChannelInfo] = useState<{ direction: TrendChannelDirection; windowSize: number; midPrice: number } | null>(null);');
  });

  it('midPrice vem da ÚLTIMA leitura real da linha mid do motor — nunca um valor hardcoded ou derivado de outra série', () => {
    const c = chart();
    expect(c).toContain('const midTail = reading && reading.mid.length > 0 ? reading.mid[reading.mid.length - 1].value : null;');
    expect(c).toContain('setTrendChannelInfo(reading && midTail !== null ? { direction: reading.direction, windowSize: reading.windowSize, midPrice: midTail } : null);');
  });

  it('regressão: as 3 séries do Trend Channel continuam com title vazio — o rótulo não volta a poluir o eixo NATIVO da lib', () => {
    const c = chart();
    const midIdx = c.indexOf('const trendChannelMid = chart.addSeries(LineSeries, {');
    const lowerIdx = c.indexOf('const trendChannelLower = chart.addSeries(LineSeries, {');
    expect(c.slice(midIdx, lowerIdx).match(/title: ""/g)).not.toBeNull();
  });

  it('a identidade do canal entra em priceAxisLabels — mesmo array/sistema anti-colisão de R1/NL/VWAP/EMA/último preço, nunca uma segunda implementação', () => {
    const c = chart();
    const idx = c.indexOf('if (visibility.trend_channel && trendChannelInfo) {');
    expect(idx, 'push condicional em priceAxisLabels não encontrado').toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 400);
    expect(block).toContain('price: trendChannelInfo.midPrice');
    expect(block).toContain('text: `TREND · OLS ${trendChannelInfo.windowSize} · ±${TREND_CHANNEL_STDDEV_MULTIPLIER}σ · ${trendChannelInfo.direction} ${trendChannelInfo.midPrice.toFixed(2)}`');
    // cor = a MESMA cor real da linha mid (definida na criação da série,
    // acima) — nunca uma cor nova inventada só para o rótulo.
    expect(block).toContain('color: "rgba(148, 163, 184, 0.55)"');
  });

  it('fail-closed: só entra em priceAxisLabels com leitura real E a camada trend_channel visível — nunca sem origem', () => {
    const c = chart();
    const idx = c.indexOf('if (visibility.trend_channel && trendChannelInfo) {');
    expect(idx).toBeGreaterThan(-1);
    // o push fica DENTRO do useMemo de priceAxisLabels, antes do
    // `return out;` final — nunca um caminho paralelo fora do array real
    // que alimenta PriceLabelStackPlugin.
    const returnIdx = c.indexOf('return out;\n  }, [support, resistance,', idx);
    expect(returnIdx, 'push do Trend Channel não está dentro do useMemo de priceAxisLabels').toBeGreaterThan(idx);
  });

  it('priceAxisLabels recalcula sempre que visibility.trend_channel ou trendChannelInfo mudam — nunca uma etiqueta desatualizada', () => {
    const c = chart();
    const depsIdx = c.indexOf('}, [support, resistance, supportStrength, resistanceStrength, supportBreakouts, resistanceBreakouts, vwapLastValue, vwapState, visibility.vwap, nlLastValue, nexusLineState, visibility.nexus_line, emaLastValue, activeEmaPeriod, visibility.ema, data, visibility.trend_channel, trendChannelInfo, livePrice]);');
    expect(depsIdx, 'dependency array de priceAxisLabels não encontrado ou não inclui trend_channel/trendChannelInfo/livePrice').toBeGreaterThan(-1);
  });
});

describe('Auditoria de pendências: os 7 elementos nativos do gráfico ainda sem controle (VWAP/Nexus Line/CVD/Fibonacci/Premium-Discount/harmônico/EQH-EQL) ganham visibility real', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('VWAP/Nexus Line/CVD são séries NATIVAS (mesmo padrão de EMA/Trend Channel) — visible via applyOptions, dado real nunca recalcula ao esconder', () => {
    const c = chart();
    expect(c).toContain('vwapSeriesRef.current.applyOptions({ visible: visibility.vwap });');
    expect(c).toContain('nexusLineSeriesRef.current.applyOptions({ visible: visibility.nexus_line });');
    expect(c).toContain('cvdSeriesRef.current.applyOptions({ visible: visibility.cvd });');
  });

  it('EQH/EQL: fail-closed real — sem visibility.equal_highs_lows, zero price line desenhada (mesmo padrão de "sem dado real, zero linhas")', () => {
    const c = chart();
    const idx = c.indexOf('zoneLinesRef.current.forEach((line) => series.removePriceLine(line));');
    expect(idx).toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 300);
    expect(block).toContain('if (!visibility.equal_highs_lows) return;');
    const depsIdx = c.indexOf('}, [liquidityZones, visibility.equal_highs_lows]);');
    expect(depsIdx).toBeGreaterThan(-1);
  });

  it('Fibonacci: fail-closed real — sem visibility.fibonacci, zero price line desenhada', () => {
    const c = chart();
    const idx = c.indexOf('fibLinesRef.current.forEach((line) => series.removePriceLine(line));');
    expect(idx).toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 200);
    expect(block).toContain('if (!visibility.fibonacci) return;');
    const depsIdx = c.indexOf('}, [fibonacciLevels, visibility.fibonacci]);');
    expect(depsIdx).toBeGreaterThan(-1);
  });

  it('Premium/Discount: fail-closed real — sem visibility.premium_discount (E sem leitura real), zero price line desenhada', () => {
    const c = chart();
    expect(c).toContain('if (!premiumDiscount || !visibility.premium_discount) return;');
    const depsIdx = c.indexOf('}, [premiumDiscount, visibility.premium_discount]);');
    expect(depsIdx).toBeGreaterThan(-1);
  });

  it('Harmônico: fail-closed real — sem visibility.harmonics, zero price line E zero polilinha (limpa ANTES do early-return, mesma disciplina das outras camadas)', () => {
    const c = chart();
    const idx = c.indexOf('harmonicPolylineRef.current?.setData([]);');
    expect(idx).toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 150);
    expect(block).toContain('if (!visibility.harmonics) return;');
    const depsIdx = c.indexOf('}, [harmonicHits, data, visibility.harmonics]);');
    expect(depsIdx).toBeGreaterThan(-1);
  });

  it('esconder uma camada nunca apaga o dado computado — só a exibição (Regra de Ouro 4): nenhum dos 7 novos gates remove um setData/computeXxx real, só envolve o desenho em early-return/applyOptions', () => {
    const c = chart();
    // VWAP/NL continuam computados incondicionalmente (mesmo efeito de
    // sempre, setData nunca fica atrás de um if de visibilidade).
    expect(c).toContain('vwapSeriesRef.current.setData(');
    expect(c).toContain('nexusLineSeriesRef.current.setData(');
    expect(c).toContain('cvdSeriesRef.current.setData(');
  });
});

describe('Auditoria de pendências (achado real via harness Playwright, duas instâncias comparadas): esconder VWAP/Nexus Line/EMA no painel escondia a SÉRIE mas a ETIQUETA do eixo continuava aparecendo', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('as 3 entradas de priceAxisLabels (VWAP/NL/EMA) agora checam visibility antes de empurrar a etiqueta — mesma condição que já escondia a série', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const block = c.slice(idx, idx + 1800);
    expect(block).toContain('if (visibility.vwap && vwapLastValue !== null && Number.isFinite(vwapLastValue)) {');
    expect(block).toContain('if (visibility.nexus_line && nlLastValue !== null && Number.isFinite(nlLastValue)) {');
    expect(block).toContain('if (visibility.ema && emaLastValue !== null && Number.isFinite(emaLastValue)) {');
  });

  it('priceAxisLabels recalcula quando visibility.vwap/nexus_line/ema mudam — sem isso a etiqueta ficaria presa no valor/estado de visibilidade do primeiro render', () => {
    const c = chart();
    const depsIdx = c.indexOf('}, [support, resistance, supportStrength, resistanceStrength, supportBreakouts, resistanceBreakouts, vwapLastValue, vwapState, visibility.vwap, nlLastValue, nexusLineState, visibility.nexus_line, emaLastValue, activeEmaPeriod, visibility.ema, data, visibility.trend_channel, trendChannelInfo, livePrice]);');
    expect(depsIdx, 'dependency array de priceAxisLabels não inclui visibility.vwap/nexus_line/ema').toBeGreaterThan(-1);
  });

  it('S1/R1/último preço/Trend Channel NÃO ganham essa checagem — nenhum toggle existe pra eles (S1/R1/último preço) ou já tinham a checagem própria (Trend Channel) — nenhuma regressão nas entradas que já funcionavam', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const block = c.slice(idx, idx + 400);
    // S1/R1 continuam incondicionais (só checam Number.isFinite do preço).
    expect(block).toContain('if (Number.isFinite(support)) {');
    expect(block).toContain('if (Number.isFinite(resistance)) {');
  });
});

describe('Auditoria de pendências: obstacleCount (sem teto) reconciliado com o .slice(0,3) de FVG/OB desenhados no gráfico', () => {
  const app = () => read('../src/App.tsx');

  it('unmitigatedFvgs/unmitigatedBlocks incluem os 3 mais recentes E qualquer obstáculo real do plano ativo — nunca um obstáculo citado no texto que fica invisível no gráfico', () => {
    const a = app();
    expect(a).toContain('const isRealObstacle = (z: PriceZone) => chartObstacleZones.some((o) => o.low === z.bottom && o.high === z.top);');
    expect(a).toContain('const unmitigatedFvgsAll = (smcZones?.fairValueGaps ?? []).filter((z: PriceZone) => !z.mitigated);');
    expect(a).toContain('const unmitigatedBlocksAll = (smcZones?.orderBlocks ?? []).filter((z: PriceZone) => !z.mitigated);');
    expect(a).toContain('const unmitigatedFvgs = unmitigatedFvgsAll.filter((z, i) => i < 3 || isRealObstacle(z));');
    expect(a).toContain('const unmitigatedBlocks = unmitigatedBlocksAll.filter((z, i) => i < 3 || isRealObstacle(z));');
  });

  it('isRealObstacle referencia chartObstacleZones (a MESMA lista sem teto que já alimenta obstacleCount/LiquidityZonesPlugin) — nunca um segundo cálculo de obstáculo', () => {
    const a = app();
    const isRealObstacleIdx = a.indexOf('const isRealObstacle = ');
    const chartObstacleZonesIdx = a.indexOf('const chartObstacleZones = useMemo(');
    expect(chartObstacleZonesIdx, 'chartObstacleZones não encontrado').toBeGreaterThan(-1);
    expect(isRealObstacleIdx, 'isRealObstacle não encontrado').toBeGreaterThan(chartObstacleZonesIdx);
  });

  it('sem plano ativo (chartObstacleZones vazio), o comportamento é IDÊNTICO ao .slice(0,3) de sempre — isRealObstacle nunca é true para nada, união é um no-op', () => {
    const a = app();
    // chartObstacleZones já é fail-closed (retorna [] sem chartTradePlan/
    // tradePlanStructureZones) — a união com um array vazio nunca inclui
    // zonas além dos 3 primeiros, preservando o decluttering de sempre
    // quando não há nenhum obstáculo real para destacar.
    expect(a).toContain('if (!chartTradePlan || !tradePlanStructureZones) return [];');
  });
});
