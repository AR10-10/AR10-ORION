// nucleo-gravitacional-fusion.test.ts — NÚCLEO GRAVITACIONAL AUTÔNOMO §1/
// §6/§7 (diretiva do Operador, respondida em 2 perguntas antes de
// construir: Fusion Engine display-only, LEI 24 intacta; os 15 toggles
// manuais continuam existindo como override real, o padrão novo é o
// comportamento automático por trás deles). Padrão de fonte — fiação
// entre módulos, mesma convenção dos outros testes de wiring deste
// arquivo (o motor puro em si já tem execução real própria em
// layer-relevance.test.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = () => readFileSync(resolve(here, '../src/App.tsx'), 'utf8');
const store = () => readFileSync(resolve(here, '../src/store/unified-snapshot-store.ts'), 'utf8');
const chart = () => readFileSync(resolve(here, '../src/chart/EnhancedChart_110_Percent.tsx'), 'utf8');

describe('LEI 24 (resposta explícita do Operador): Fusion Engine é display-only — nunca gera/altera Entry/Stop/Target/Risco', () => {
  it('layer-relevance.ts nunca é importado por trade-plan.ts nem por qualquer caminho de cálculo do Trade Plan', () => {
    const tradePlan = readFileSync(resolve(here, '../src/nexus/trade-plan.ts'), 'utf8');
    expect(tradePlan).not.toContain('layer-relevance');
  });
  it('computeLayerRelevance devolve só { relevant, reason, emphasis } — nunca um campo de preço/nível/risco', () => {
    const src = readFileSync(resolve(here, '../src/nexus/layer-relevance.ts'), 'utf8');
    const idx = src.indexOf('export interface LayerRelevanceResult {');
    const block = src.slice(idx, src.indexOf('}', idx));
    expect(block).toContain('relevant: boolean;');
    expect(block).toContain('reason: string;');
    expect(block).toContain('emphasis: "normal" | "highlight";');
    expect(block).not.toMatch(/price|level|risk|stop|target|entry/i);
  });
});

describe('Modelo paralelo de visibilidade (resposta do Operador: toggles continuam como override real)', () => {
  it('chartLayerAutoMode é um estado PARALELO — ChartLayerVisibility (o boolean manual) continua com a MESMA forma de sempre, zero migração', () => {
    const a = app();
    expect(a).toContain('const [chartLayerVisibility, setChartLayerVisibility] = useState<ChartLayerVisibility>(() => restoredSession.chartLayers);');
    expect(a).toContain('const [chartLayerAutoMode, setChartLayerAutoMode] = useState<ChartLayerVisibility>(() => restoredSession.chartLayerAutoMode);');
  });

  it('toggleChartLayer (o toggle individual que sempre existiu) agora TAMBÉM sai do automático — clicar é um override explícito', () => {
    const a = app();
    const idx = a.indexOf('const toggleChartLayer = useCallback((id: ChartLayerId) => {');
    const block = a.slice(idx, a.indexOf('}, []);', idx));
    expect(block).toContain('setChartLayerAutoMode((prev) => ({ ...prev, [id]: false }));');
    expect(block).toContain('setChartLayerVisibility((prev) => ({ ...prev, [id]: !prev[id] }));');
  });

  it('resetChartLayerToAuto devolve 1 camada ao automático sem tocar as outras 14', () => {
    const a = app();
    expect(a).toContain('const resetChartLayerToAuto = useCallback((id: ChartLayerId) => {');
    expect(a).toContain('setChartLayerAutoMode((prev) => ({ ...prev, [id]: true }));');
  });

  it('DEFAULT_CHART_LAYER_AUTO_MODE começa tudo automático — "eliminar a necessidade de ativar" é o padrão novo', () => {
    const c = chart();
    const idx = c.indexOf('export const DEFAULT_CHART_LAYER_AUTO_MODE: ChartLayerVisibility = {');
    expect(idx).toBeGreaterThan(-1);
    const body = c.slice(idx, c.indexOf('};', idx));
    for (const id of ['liquidity_zones', 'structure_breaks', 'order_flow_heatmap', 'volume_profile', 'trade_plan_zone', 'neural_market_aura', 'ema', 'trend_channel', 'vwap', 'nexus_line', 'cvd', 'fibonacci', 'premium_discount', 'harmonics', 'equal_highs_lows']) {
      expect(body).toContain(`${id}: true,`);
    }
  });

  it('persistência: campo NOVO e aditivo em RestoredSession — sessão antiga (sem a chave) cai no default automático, nunca quebra/inventa', () => {
    const a = app();
    const idx = a.indexOf('function readRestoredSession(): RestoredSession {');
    const block = a.slice(idx, a.indexOf('function persistSessionState('));
    expect(block).toContain('const chartLayerAutoMode: ChartLayerVisibility = { ...DEFAULT_CHART_LAYER_AUTO_MODE };');
    expect(block).toContain('if (parsed?.chartLayerAutoMode && typeof parsed.chartLayerAutoMode === "object") {');
  });
});

describe('applyChartLayerPreset: 4º valor "automatic" + os 3 presets manuais saem do automático (curadoria deliberada)', () => {
  it('preset "automatic" liga chartLayerAutoMode para as 15 camadas de uma vez, nunca mexe em chartLayerVisibility', () => {
    const a = app();
    const idx = a.indexOf('const applyChartLayerPreset = useCallback((preset: "operational" | "audit" | "intelligence" | "automatic") => {');
    expect(idx).toBeGreaterThan(-1);
    const body = a.slice(idx, a.indexOf('}, []);', idx));
    const autoBranch = body.slice(body.indexOf('if (preset === "automatic") {'), body.indexOf('if (preset === "audit") {'));
    expect(autoBranch).toContain('setChartLayerAutoMode(');
    expect(autoBranch).toContain('acc[id] = true;');
    expect(autoBranch).not.toContain('setChartLayerVisibility');
  });

  it('operational/audit/intelligence saem do automático ANTES de fixar o boolean manual (curadoria = override, sempre)', () => {
    const a = app();
    const idx = a.indexOf('const applyChartLayerPreset = useCallback((preset: "operational" | "audit" | "intelligence" | "automatic") => {');
    const body = a.slice(idx, a.indexOf('}, []);', idx));
    const autoOffIdx = body.indexOf('acc[id] = false;');
    const auditIdx = body.indexOf('if (preset === "audit") {');
    expect(autoOffIdx).toBeGreaterThan(-1);
    expect(autoOffIdx).toBeLessThan(auditIdx); // desliga o automático antes de qualquer branch de preset
  });
});

describe('Store: layerRelevance segue o mesmo padrão de 5 lugares do domínio §3 MOTORES QUANT (harmonicPatterns é o precedente mais recente)', () => {
  it('interface + ação + default + implementação + seletor — todos presentes', () => {
    const s = store();
    expect(s).toContain('layerRelevance: LayerRelevanceReading | null;');
    expect(s).toContain('setLayerRelevance: (reading: LayerRelevanceReading | null) => void;');
    expect(s).toContain('layerRelevance: null,');
    expect(s).toContain('setLayerRelevance: (reading) => set((s) => { s.layerRelevance = reading; }),');
    expect(s).toContain('export const useLayerRelevanceSnapshot = (): LayerRelevanceReading | null =>');
  });
});

describe('ChartWidget: leitura real → Relevance Engine → store → visibilidade efetiva do canvas (nunca uma 2ª fonte)', () => {
  it('relevanceInput é construído só de sinais reais já existentes (obstáculos/liquidez/harmônicos/volume profile/BOS-CHOCH/premium-discount/vwap/nexus-line/trend-channel/orderflow/livro)', () => {
    const a = app();
    const idx = a.indexOf('const relevanceInput: LayerRelevanceInput = useMemo(() => {');
    expect(idx).toBeGreaterThan(-1);
    const body = a.slice(idx, a.indexOf('}, [livePrice,', idx));
    expect(body).toContain('obstacleZoneCount: chartObstacleZones.length,');
    expect(body).toContain('harmonicBestFitScore: chartHarmonics && chartHarmonics.length > 0 ? chartHarmonics[0].fitScore : null,');
    expect(body).toContain('premiumDiscountZone: chartPremiumDiscount?.zone ?? null,');
    expect(body).toContain('vwapState: vwapCtx?.state ?? null,');
    expect(body).toContain('nexusLineState: nlState ?? null,');
    expect(body).toContain('hasOrderBook: Boolean(engine?.hasBook),');
  });

  it('"HOMOLOGAÇÃO DA ORDEM Nº 03 / ORGANISMO INTELIGENTE ADAPTATIVO": marketRegime (contexto operacional) reusa o MESMO engine.marketRegime.regime já real em uso pelo Risk Engine/Confluência — zero segundo cálculo', () => {
    const a = app();
    const idx = a.indexOf('const relevanceInput: LayerRelevanceInput = useMemo(() => {');
    const body = a.slice(idx, a.indexOf('}, [livePrice,', idx));
    expect(body).toContain('marketRegime: engine?.marketRegime?.regime ?? null,');
    const depsIdx = a.indexOf('}, [livePrice,', idx);
    const depsEnd = a.indexOf(');', depsIdx);
    expect(a.slice(depsIdx, depsEnd)).toContain('engine?.marketRegime');
  });

  it('structureBreakAlpha reusa o MESMO ageAlpha/BREAK_DECAY de StructureBreakMarkersPlugin — mesma idade em candles, zero segunda curva de decaimento', () => {
    const a = app();
    expect(a).toContain('import { BREAK_DECAY } from "./chart/StructureBreakMarkersPlugin";');
    expect(a).toContain('brk && Array.isArray(chartData) ? ageAlpha(chartData.length - 1 - brk.index, BREAK_DECAY) : null;');
  });

  it('trendChannelForRelevance chama o MESMO computeTrendChannel real que o canvas usa para desenhar — função pura determinística, nunca pode divergir', () => {
    const a = app();
    expect(a).toContain('import { computeTrendChannel, TREND_CHANNEL_DEFAULT_WINDOW, TREND_CHANNEL_STDDEV_MULTIPLIER } from "./nexus/trend-channel-engine";');
    expect(a).toContain('computeTrendChannel((chartData ?? []).map((c: any) => ({ time: c.time, close: c.close })), TREND_CHANNEL_DEFAULT_WINDOW)');
  });

  it('layerRelevance é publicado no store (2º consumidor real: o painel de camadas)', () => {
    const a = app();
    expect(a).toContain('useUnifiedSnapshotStore.getState().setLayerRelevance(layerRelevance);');
  });

  it('effectiveChartLayerVisibility resolve auto→Relevance Engine / manual→boolean sempre existente — EnhancedChart_110_Percent recebe só o resultado já pronto', () => {
    const a = app();
    const idx = a.indexOf('const effectiveChartLayerVisibility: ChartLayerVisibility = useMemo(() => {');
    expect(idx).toBeGreaterThan(-1);
    const body = a.slice(idx, a.indexOf('}, [chartLayerAutoMode,', idx));
    // A regra que este teste guarda é o CONTRATO — auto resolve pelo motor,
    // manual resolve pelo booleano do Operador — não a linha literal. O teto
    // de simultaneidade (resolveAutoLayerVisibility) entrou ANTES do fallback
    // de relevância, preservando a cadeia inteira: se o teto não tiver
    // decisão para a camada, cai na relevância; se nem isso, cai em `true`.
    expect(body).toContain('autoMode[id] ?');
    expect(body).toContain('autoDecision[id]?.show');
    expect(body).toContain('layerRelevance[id]?.relevant ?? true'); // fallback anti-crash intacto
    expect(body).toContain(': manual[id];');                        // manual continua mandando sozinho
    expect(a).toContain('layerVisibility={effectiveChartLayerVisibility}');
  });
});

describe('Painel: badge AUTO real + reset por camada + 4º preset — nunca um sumiço silencioso do motivo', () => {
  it('cada camada mostra "auto" com o motivo real (tooltip) quando em modo automático, e um botão real de reset quando manual', () => {
    const a = app();
    expect(a).toContain('const isAuto = autoMode[id];');
    expect(a).toContain('const relevance = layerRelevance?.[id] ?? null;');
    expect(a).toContain('title={relevance?.reason ?? "Relevance Engine ainda sem leitura real neste ciclo."}');
    expect(a).toContain('onClick={() => resetChartLayerToAuto?.(id)}');
  });

  it('botão "Automático" (4º preset) existe e acende só quando as 15 camadas estão realmente em modo automático', () => {
    const a = app();
    expect(a).toContain('onClick={() => applyChartLayerPreset?.("automatic")}');
    expect(a).toContain('const isAutomaticPreset = CHART_LAYER_IDS.every((id) => autoMode[id] === true);');
  });
});

describe('EPC FINAL §3/§12 ("quando destacar"): badge auto do painel mostra o emphasis real, nunca um efeito sem motivo', () => {
  it('badge acende (borda/fundo sólidos) e mostra "· destaque" só quando relevance.emphasis === "highlight" — nunca decorativo', () => {
    const a = app();
    const idx = a.indexOf('{isAuto && (');
    const block = a.slice(idx, a.indexOf(')}', a.indexOf('destaque', idx)) + 2);
    expect(block).toContain('relevance?.emphasis === "highlight"');
    expect(block).toContain('auto{relevance?.emphasis === "highlight" ? " · destaque" : ""}');
  });
});
