// ciborgue-vivo-wiring.test.ts — Ordem "Ciborgue Vivo" (anotações
// temporárias no gráfico, cabeçalho com indicador de risco/saúde,
// autocura/autoanálise): source-level wiring locks for the real
// integration points. Pure logic (bos-choch-engine.js, ageAlpha,
// buildDiagnosticReport) is covered by real execution in its own test
// files — same split already used throughout this session.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('QUARANTINE.md: bos-choch-engine.js documentado como graduado (mesma disciplina dos outros 4 engines)', () => {
  it('aparece na árvore e na lista de "Engines graduados", nunca um import não documentado', () => {
    const quarantine = read('../../src/research/QUARANTINE.md');
    expect(quarantine).toContain('bos-choch-engine.js            ACTIVE_READ_ONLY (graduado 2026-07-12)');
    expect(quarantine).toContain('**`engines/bos-choch-engine.js`**');
    expect(quarantine).toContain('Zero `fetch()` novo, zero credencial, zero `order_send`.');
  });
});

describe('engine-bridge.ts: computeBosChoch — mesmo array de candles do gráfico que computeSmcZones já usa', () => {
  it('importa analyze de bos-choch-engine.js, devolve break/structureLabel honestos em falha', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("import { analyze as analyzeBosChoch } from '../../src/research/engines/bos-choch-engine.js';");
    const fnMatch = bridge.match(/export function computeBosChoch\(([\s\S]*?)\n\}/);
    expect(fnMatch, 'computeBosChoch não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('const result = analyzeBosChoch({ ohlcv_series: candles });');
    expect(body).toContain("if (result.status !== 'OK') return { break: null, structureLabel: null };");
  });
});

describe('App.tsx: bosChoch computado antes de voiceSnapshot (dependência real de ordem de declaração)', () => {
  it('bosChoch usa computeBosChoch(chartData), voiceSnapshot referencia bosChoch.break', () => {
    const app = read('../src/App.tsx');
    const bosChochIdx = app.indexOf('const bosChoch = useMemo(');
    const voiceSnapshotIdx = app.indexOf('const voiceSnapshot = useMemo<TerminalSnapshot>(');
    expect(bosChochIdx).toBeGreaterThan(-1);
    expect(voiceSnapshotIdx).toBeGreaterThan(-1);
    expect(bosChochIdx).toBeLessThan(voiceSnapshotIdx); // ordem real de declaração, nunca TDZ
    expect(app).toContain('computeBosChoch(chartData) : { break: null, structureLabel: null }');
    expect(app).toContain("structureBreakKey: bosChoch.break ? `${bosChoch.break.type}:${bosChoch.break.index}` : null,");
  });

  it('smcZones e bosChoch entram em contextValue (WidgetContext) para o ChartWidget consumir', () => {
    const app = read('../src/App.tsx');
    // A mesma chave aparece no objeto de valor E no array de deps do useMemo.
    // tradePlanStructureZones (Diretriz Restauração/Inteligência Visual §6)
    // viaja hoje na mesma posição — reaproveitado pelo destaque de
    // obstáculos no gráfico, mesma disciplina de zero segunda fonte.
    const occurrences = app.match(/\bsmcZones,\n\s*tradePlanStructureZones,\n\s*bosChoch,/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});

describe('App.tsx → EnhancedChart_110_Percent: structureBreak passa ponta a ponta até o plugin', () => {
  it('ChartWidget lê bosChoch do contexto e repassa structureBreak={bosChoch?.break ?? null}', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const { smcZones, tradePlanStructureZones, bosChoch, selectedAsset, engine, chartTimeframe, setChartTimeframe, convictionReading, chartLayerVisibility, emaPeriod, confidenceZone, nexusDecision, vwapCtx, nlState } = useContext(WidgetContext) || {};');
    expect(app).toContain('structureBreak={bosChoch?.break ?? null}');
  });

  it('EnhancedChart_110_Percent aceita structureBreak e monta StructureBreakMarkersPlugin com o mesmo array `data` do LiquidityZonesPlugin', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('structureBreak?: StructureBreak | null;');
    expect(chart).toContain('import { StructureBreakMarkersPlugin } from "./StructureBreakMarkersPlugin";');
    const mountMatch = chart.match(/<StructureBreakMarkersPlugin([\s\S]*?)\/>/);
    expect(mountMatch, 'StructureBreakMarkersPlugin não montado').not.toBeNull();
    expect(mountMatch![1]).toContain('data={data}');
    expect(mountMatch![1]).toContain('structureBreak={structureBreak ?? null}');
  });
});

describe('LiquidityZonesPlugin.tsx: decaimento real por idade + labels elegantes, nunca sobrescreve o fio de seda', () => {
  it('importa ageAlpha do módulo compartilhado (zero duplicação), pula o desenho quando alpha<=0', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('import { ageAlpha, type DecayConfig } from "./annotation-decay";');
    expect(plugin).toContain('const ZONE_DECAY: DecayConfig = { fadeStartCandles: 30, expireCandles: 100, minAlpha: 0.15 };');
    expect(plugin).toContain('if (alpha <= 0) return;');
    // Fio de Seda (Regra de Ouro 2) continua 1px sólida real — o decay usa
    // globalAlpha, nunca setLineDash.
    expect(plugin).not.toContain('.setLineDash(');
    expect(plugin).toContain('ctx.lineWidth = 1;');
  });

  it('label do tipo de zona (FVG/OB) desenhado só quando a zona é grande o bastante pra caber texto legível', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    expect(plugin).toContain('if (rectWidth > 24 && rectHeight > 10) {');
    // Diretriz Restauração/Inteligência Visual §6: label ganha "⚠" e a
    // paleta ganha o 3º argumento isObstacle(z) quando a MESMA zona é um
    // obstáculo real do plano ativo — mesma chamada de sempre, só honesta
    // sobre a nova informação opcional.
    expect(plugin).toContain('fvgs.forEach((z) => drawZone(z, paletteFor("FVG", z.type, isObstacle(z)), isObstacle(z) ? "FVG ⚠" : "FVG"));');
    expect(plugin).toContain('obs.forEach((z) => drawZone(z, paletteFor("OB", z.type, isObstacle(z)), isObstacle(z) ? "OB ⚠" : "OB"));');
  });
});

describe('StructureBreakMarkersPlugin.tsx: mesma arquitetura de overlay do LiquidityZonesPlugin, fio de seda 1px sólido', () => {
  it('dirty-flag + rAF + ResizeObserver, unsubscribe real no cleanup', () => {
    const plugin = read('../src/chart/StructureBreakMarkersPlugin.tsx');
    expect(plugin).toContain('chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);');
    expect(plugin).toContain('chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);');
    expect(plugin).toContain('new ResizeObserver(() => markDirty());');
    expect(plugin).not.toContain('.setLineDash(');
    expect(plugin).toContain('ctx.lineWidth = 1;');
  });

  it('sem rompimento real (structureBreak null) não desenha nada — honesto, nunca um palpite', () => {
    const plugin = read('../src/chart/StructureBreakMarkersPlugin.tsx');
    expect(plugin).toContain('if (!brk) return; // sem rompimento real na amostra — nada a desenhar, honesto.');
  });
});

describe('App.tsx: SystemStatusBadge — indicador compacto de risco/saúde sempre visível (não reabre a barra densa)', () => {
  it('reaproveita classifyFps/classifyCycleLatency/riskSuggestion reais, nunca uma segunda classificação', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function SystemStatusBadge\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'SystemStatusBadge não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('const fpsClass = classifyFps(fps);');
    expect(body).toContain('const cycleClass = classifyCycleLatency(cycleLatencyMs);');
    expect(body).toContain('riskSuggestion?.status === "OK" ? `${riskSuggestion.effective_risk_pct.toFixed(1)}%` : null');
  });

  it('montado no cluster direito da TopBar, só em modo CRYPTO', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('{marketMode === "CRYPTO" && <SystemStatusBadge />}');
  });
});

describe('voice-dispatcher.ts: alerta real de BOS/CHOCH reaproveita o MESMO pipeline (zero segundo mecanismo de alerta)', () => {
  it('CHOCH dispara ALERT, BOS dispara INFO, só numa transição real (chave muda)', () => {
    const dispatcher = read('../src/voice/voice-dispatcher.ts');
    expect(dispatcher).toContain("if (next.structureBreakKey && next.structureBreakKey !== prev.structureBreakKey) {");
    expect(dispatcher).toContain("if (next.structureBreakType === 'CHOCH') {");
    expect(dispatcher).toContain("priority: 'ALERT'");
  });
});

describe('voice-intents.ts: TerminalSnapshot ganha os 3 campos reais de estrutura, aditivo', () => {
  it('structureBreakKey/Type/Direction declarados', () => {
    const intents = read('../src/voice/voice-intents.ts');
    expect(intents).toContain('structureBreakKey: string | null;');
    expect(intents).toContain("structureBreakType: 'BOS' | 'CHOCH' | null;");
    expect(intents).toContain("structureBreakDirection: 'ALTA' | 'BAIXA' | null;");
  });
});

describe('affective-memory.ts: estrutura contradizendo/confirmando o sinal ativo — só com posição direcional real', () => {
  it('novos eventos declarados com pesos reais, mais leves que PLAN_TARGET_HIT/STOP_HIT (evidência nova != resultado resolvido)', () => {
    const mem = read('../src/nexus/affective-memory.ts');
    expect(mem).toContain('| "STRUCTURE_BREAK_CONFIRMS_SIGNAL"');
    expect(mem).toContain('| "STRUCTURE_BREAK_CONTRADICTS_SIGNAL";');
    expect(mem).toContain('STRUCTURE_BREAK_CONFIRMS_SIGNAL: { kind: "REWARD", weight: 0.3 },');
    expect(mem).toContain('STRUCTURE_BREAK_CONTRADICTS_SIGNAL: { kind: "PAIN", weight: 0.4 },');
  });

  it('App.tsx só grava o evento afetivo quando há voiceSnapshot.direction real (WAIT/null nunca alimenta a memória afetiva)', () => {
    const app = read('../src/App.tsx');
    const block = app.match(/if \(\s*voiceSnapshot\.structureBreakKey &&\s*voiceSnapshot\.structureBreakKey !== prevSnapshot\?\.structureBreakKey &&\s*voiceSnapshot\.direction\s*\) \{([\s\S]*?)\n {4}\}/);
    expect(block, 'bloco de gravação afetiva do rompimento não encontrado').not.toBeNull();
    expect(block![1]).toContain('STRUCTURE_BREAK_CONFIRMS_SIGNAL');
    expect(block![1]).toContain('STRUCTURE_BREAK_CONTRADICTS_SIGNAL');
  });
});

describe('App.tsx: TelemetryHealthWidget ganha o gerador de relatório de autodiagnóstico sob demanda', () => {
  it('botão real chama buildDiagnosticReport com os MESMOS sinais já lidos pelas Rows existentes', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function TelemetryHealthWidget\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'TelemetryHealthWidget não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('buildDiagnosticReport({');
    expect(body).toContain('offline,');
    expect(body).toContain('isDataFresh,');
    expect(body).toContain('health,');
    expect(body).toContain('connections,');
    expect(body).toContain('formatDiagnosticReportMarkdown(diagnosticReport)');
  });
});

describe('Diretriz Restauração/Inteligência Visual §6: obstáculos do Trade Plan destacados no gráfico — zero segundo cálculo das zonas', () => {
  it('tradePlanStructureZones é hoisted logo após smcZones e REAPROVEITADO pelo efeito de buildTradePlan (nunca recomputado ali dentro)', () => {
    const app = read('../src/App.tsx');
    const memoIdx = app.indexOf('const tradePlanStructureZones = useMemo<TradePlanStructureZone[]>(() => {');
    expect(memoIdx, 'tradePlanStructureZones não encontrado').toBeGreaterThan(-1);
    expect(app).toContain('zones.push({ low: z.bottom, high: z.top, kind: `OB_${z.type}` });');
    expect(app).toContain('zones.push({ low: z.bottom, high: z.top, kind: `FVG_${z.type}` });');
    // o efeito de buildTradePlan usa a referência, nunca reconstrói o array
    expect(app).toContain('const zones = tradePlanStructureZones;');
    // a transformação OB_${type}/FVG_${type} aparece só UMA vez no arquivo inteiro
    expect(app.split('zones.push({ low: z.bottom, high: z.top, kind: `OB_${z.type}` });')).toHaveLength(2);
  });

  it('chartObstacleZones cruza obstacleZonesInPath contra TODOS os alvos do plano ativo (união, nunca só o 1º) e nunca contra um plano nulo', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const chartObstacleZones = useMemo(() => {');
    expect(idx, 'chartObstacleZones não encontrado').toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 700);
    expect(block).toContain('if (!chartTradePlan || !tradePlanStructureZones) return [];');
    expect(block).toContain('for (const target of chartTradePlan.targets) {');
    expect(block).toContain('obstacleZonesInPath(tradePlanStructureZones, chartTradePlan.entry, target.price, long)');
  });

  it('chega ao gráfico via obstacleZones={chartObstacleZones} — mesmo padrão de prop-threading de tradePlan/scenario/aura', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('obstacleZones={chartObstacleZones}');
  });
});
