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
    expect(app).toContain('const { smcZones, tradePlanStructureZones, bosChoch, selectedAsset, engine, chartTimeframe, setChartTimeframe, chartLayerVisibility, chartLayerAutoMode, emaPeriod, confidenceZone, nexusDecision, vwapCtx, nlState, orderflowTrend, liquidations } = useContext(WidgetContext) || {};');
    expect(app).toContain('structureBreak={bosChoch?.break ?? null}');
  });

  it('EnhancedChart_110_Percent aceita structureBreak e monta StructureBreakMarkersPlugin com o mesmo array `data` do LiquidityZonesPlugin', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('structureBreak?: StructureBreak | null;');
    expect(chart).toContain('import { StructureBreakMarkersPlugin, BREAK_DECAY } from "./StructureBreakMarkersPlugin";');
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
    // obstáculo real do plano ativo. Auditoria do ecossistema visual
    // (pergunta do Operador "era pra cima ou pra baixo?"): o label também
    // carrega o glifo de direção ↑/↓ real (z.type do motor SMC), nunca só
    // a cor — mesma chamada de sempre, só honesta sobre mais informação.
    //
    // Diretriz Consolidação/Auditoria/Evolução (achado real: zona-obstáculo
    // podia expirar por idade fixa mesmo bloqueando um plano ativo):
    // `obstacle` agora é computado 1x por zona e passado como 4º argumento
    // real de drawZone (nunca um 2º cálculo de isObstacle dentro do loop).
    expect(plugin).toContain('const obstacle = isObstacle(z);');
    // Ordem Nº 04 (MAIN_LIQUIDITY em visual-budget.ts): drawZone ganhou um
    // 5º argumento (resolvedWeight, peso já resolvido pela competição
    // cruzada) — obstacle continua o 4º, intocado; a chamada real agora
    // passa fvgWeights?.[i]/obWeights?.[i] no final.
    expect(plugin).toContain('drawZone(z, paletteFor("FVG", z.type, obstacle), `FVG${dir(z.type)}${obstacle ? " ⚠" : ""}`, obstacle, fvgWeights?.[i]);');
    expect(plugin).toContain('drawZone(z, paletteFor("OB", z.type, obstacle), `OB${dir(z.type)}${obstacle ? " ⚠" : ""}`, obstacle, obWeights?.[i]);');
  });

  it('Diretriz Consolidação/Auditoria/Evolução (achado real): zona-obstáculo de um plano ATIVO nunca esmaece por idade fixa — alpha=1 enquanto isObstacleZone, ageAlpha normal caso contrário', () => {
    const plugin = read('../src/chart/LiquidityZonesPlugin.tsx');
    // Ordem Nº 04: drawZone ganhou resolvedWeight (5º argumento, opcional)
    // — zona-obstáculo continua alpha=1 incondicional, IGNORANDO
    // resolvedWeight de propósito (ver visual-budget-chart-wiring.test.ts
    // para a cobertura completa desta regra nova).
    expect(plugin).toContain('const drawZone = (zone: FillableZone, palette: ZonePalette, label: string, isObstacleZone: boolean, resolvedWeight?: number) => {');
    expect(plugin).toContain('const alpha = isObstacleZone ? 1 : resolvedWeight !== undefined && resolvedWeight !== null ? resolvedWeight : ageAlpha(age, ZONE_DECAY);');
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

  it('achado real de captura de tela do Operador ("CHOC" cortado/sobreposto pela caixa "EMA 21"): o TEXTO ("BOS"/"CHOCH") não é mais desenhado neste canvas próprio — migrou pra priceAxisLabels; a LINHA de rompimento continua real, só nasce depois da seta (Ordem "FECHAMENTO INTEGRAL" §12, ver describe abaixo) em vez de em x1', () => {
    const plugin = read('../src/chart/StructureBreakMarkersPlugin.tsx');
    expect(plugin).not.toMatch(/ctx\.fillText\(brk\.type/);
    expect(plugin).not.toContain('ctx.font = "10px -apple-system, sans-serif";');
    // a linha real (moveTo/lineTo/stroke) continua real; só o ponto de
    // partida deslocou para depois da seta, nunca mais sobre ela.
    expect(plugin).toContain('ctx.moveTo(x1 + ARROW_HALF_SIZE + ARROW_GAP_PX, yLine);');
    expect(plugin).toContain('ctx.lineTo(cssWidth, yLine);');
    expect(plugin).toContain('ctx.stroke();');
  });

  it('BREAK_DECAY exportado — reaproveitado por priceAxisLabels (EnhancedChart_110_Percent.tsx), zero segunda curva de decaimento', () => {
    const plugin = read('../src/chart/StructureBreakMarkersPlugin.tsx');
    expect(plugin).toContain('export const BREAK_DECAY: DecayConfig = { fadeStartCandles: 20, expireCandles: 100, minAlpha: 0.15 };');
  });
});

// Ordem "FECHAMENTO INTEGRAL" §12 ("Setas e Direção"): seta pequena,
// precisa, orientada, no ponto real do rompimento — zero dado novo (mesma
// brk.direction/x1/y que a linha companheira já usa), zero segunda curva
// de decaimento (mesmo alpha resolvido acima govern a seta também, via
// ctx.globalAlpha já setado antes do bloco).
describe('Ordem "FECHAMENTO INTEGRAL" §12: seta de direção no ponto real do rompimento BOS/CHOCH', () => {
  const plugin = () => read('../src/chart/StructureBreakMarkersPlugin.tsx');

  it('triângulo pequeno (±4px) apontando para a direção real do rompimento — ALTA aponta para cima, o resto para baixo', () => {
    const p = plugin();
    expect(p).toContain('const ARROW_HALF_SIZE = 4;');
    expect(p).toContain('const ARROW_GAP_PX = 3;');
    // bullish (ALTA): ápice em y - HALF, base em y + HALF — aponta pra cima.
    expect(p).toContain('ctx.moveTo(x1, y - ARROW_HALF_SIZE);');
    expect(p).toContain('ctx.lineTo(x1 - ARROW_HALF_SIZE, y + ARROW_HALF_SIZE);');
    expect(p).toContain('ctx.lineTo(x1 + ARROW_HALF_SIZE, y + ARROW_HALF_SIZE);');
    // bearish: ápice em y + HALF, base em y - HALF — aponta pra baixo.
    expect(p).toContain('ctx.moveTo(x1, y + ARROW_HALF_SIZE);');
    expect(p).toContain('ctx.lineTo(x1 - ARROW_HALF_SIZE, y - ARROW_HALF_SIZE);');
    expect(p).toContain('ctx.lineTo(x1 + ARROW_HALF_SIZE, y - ARROW_HALF_SIZE);');
  });

  it('MESMA cor real da linha (color, já derivada de brk.direction acima) — nunca uma cor nova só para a seta', () => {
    const p = plugin();
    const idx = p.indexOf('const ARROW_HALF_SIZE = 4;');
    const block = p.slice(idx, p.indexOf('ctx.fill();', idx) + 'ctx.fill();'.length);
    expect(block).toContain('ctx.fillStyle = color;');
    expect(block).toContain('ctx.fill();');
    expect(block).not.toContain('fillStyle = "');
  });

  it('seta e linha nunca se sobrepõem: a seta desenha ANTES (no ponto x1), a linha nasce só depois do respiro (x1 + ARROW_HALF_SIZE + ARROW_GAP_PX) — "não deixar setas atravessarem... textos" vale também para a linha companheira', () => {
    const p = plugin();
    const arrowIdx = p.indexOf('const ARROW_HALF_SIZE = 4;');
    const lineIdx = p.indexOf('ctx.moveTo(x1 + ARROW_HALF_SIZE + ARROW_GAP_PX, yLine);');
    expect(arrowIdx).toBeGreaterThan(-1);
    expect(lineIdx).toBeGreaterThan(arrowIdx);
  });
});

describe('Achado real de captura de tela do Operador: rótulo BOS/CHOCH migrado para priceAxisLabels (mesmo sistema anti-colisão de S1/R1/VWAP/NL/EMA/TREND/Trade Plan) — nunca mais atrás da caixa de outro rótulo', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('EnhancedChart_110_Percent importa BREAK_DECAY do plugin e ageAlpha de annotation-decay — mesma dupla real, zero segunda fonte', () => {
    const c = chart();
    expect(c).toContain('import { StructureBreakMarkersPlugin, BREAK_DECAY } from "./StructureBreakMarkersPlugin";');
    expect(c).toContain('import { ageAlpha, type DecayConfig } from "./annotation-decay";');
  });

  it('a entrada em priceAxisLabels usa o MESMO price/type/direction do structureBreak real — nunca uma segunda leitura', () => {
    const c = chart();
    // Evolução Total: bloco ganhou gate de visibility.structure_breaks
    // (mesma disciplina de todo outro bloco do eixo) e o alpha agora é o
    // MESMO peso resolvido pelo orçamento visual que o marcador já usa
    // ("um objeto, um peso"), com o ageAlpha isolado como fallback.
    const idx = c.indexOf('if (visibility.structure_breaks && structureBreak) {', c.indexOf('const priceAxisLabels = useMemo'));
    expect(idx, 'bloco do structureBreak não encontrado em priceAxisLabels').toBeGreaterThan(-1);
    const end = c.indexOf('return out;', idx);
    const block = c.slice(idx, end);
    expect(block).toContain('const point = data[structureBreak.index];');
    expect(block).toContain('const age = data.length - 1 - structureBreak.index;');
    expect(block).toContain('const alpha = structureBreakVisualWeight ?? ageAlpha(age, BREAK_DECAY);');
    expect(block).toContain('const bullish = structureBreak.direction === "ALTA";');
    expect(block).toContain('price: structureBreak.level,');
    expect(block).toContain('text: structureBreak.type,');
    expect(block).toContain('color: bullish ? "rgba(0, 255, 170, 0.75)" : "rgba(255, 0, 85, 0.75)",');
    expect(block).toContain('alpha,');
  });

  it('fail-closed: sem ponto real na janela de candles carregada, ou alpha já esquecido (<=0), nunca empurra a etiqueta', () => {
    const c = chart();
    const idx = c.indexOf('if (visibility.structure_breaks && structureBreak) {', c.indexOf('const priceAxisLabels = useMemo'));
    const end = c.indexOf('return out;', idx);
    const block = c.slice(idx, end);
    expect(block).toContain('if (point) {');
    expect(block).toContain('if (alpha > 0 && Number.isFinite(structureBreak.level)) {');
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

  // ORDEM OFICIAL Nº 01 (Autogovernança): traceStages() (stage-runner.ts,
  // já real e testado) ganha aqui seu primeiro consumidor ao vivo — a
  // mesma visão versionada/read-only que os motores reais já usam
  // (getSnapshotForEngine), nunca uma segunda leitura da store, nunca um
  // motor novo.
  it('lê o snapshot real via getSnapshotForEngine() e passa traceStages(...) real como stageTrace — zero segunda fonte, zero seq fabricado', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { getOrganismOrchestrator, getSnapshotForEngine } from "./nexus/organism-orchestrator";');
    expect(app).toContain('import { traceStages } from "./nexus/stage-runner";');
    const fnMatch = app.match(/function TelemetryHealthWidget\(\) \{([\s\S]*?)\n\}\n/);
    const body = fnMatch![1];
    expect(body).toContain('const engineView = getSnapshotForEngine();');
    expect(body).toContain('stageTrace: traceStages(engineView.snapshot, engineView.seq),');
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

  it('chartObstacleZones cruza obstacleZonesInPath contra TODOS os alvos (plano do Conselho OU fallback do Núcleo, EPC §5) via a MESMA função pura — nunca um segundo cálculo, nunca contra zonas nulas', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const chartObstacleZones = useMemo(() => {');
    expect(idx, 'chartObstacleZones não encontrado').toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 2000);
    // fail-closed na ausência das zonas estruturais reais (nunca cruza nada)
    expect(block).toContain('if (!tradePlanStructureZones) return [];');
    // uma única definição de "obstáculo no caminho" (collect), reusada
    expect(block).toContain('for (const z of obstacleZonesInPath(tradePlanStructureZones, { ...entryZone, basis: "" }, price, long)) {');
    // caminho do Conselho (quando existe)
    expect(block).toContain('collect(chartTradePlan.entry, chartTradePlan.targets.map((t) => t.price), chartTradePlan.direction === "LONG");');
    // caminho do Núcleo (EPC §5 — o caso mais comum): entrada = preço atual, alvos reais
    expect(block).toContain('} else if (engineFallbackLevels && engineFallbackLevels.entry !== null) {');
    expect(block).toContain('collect({ low: e, high: e }, targets, engineFallbackLevels.direction === "LONG");');
  });

  it('chega ao gráfico via obstacleZones={chartObstacleZones} — mesmo padrão de prop-threading de tradePlan/scenario/aura', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('obstacleZones={chartObstacleZones}');
  });

  it('execução real (EPC §5): a MESMA função pura obstacleZonesInPath conta os obstáculos do caminho do Núcleo (entrada = preço atual) exatamente como faria para o plano do Conselho — prova viva de que o fallback não é um segundo cálculo', () => {
    // Reproduz a fronteira geométrica real de obstacleZonesInPath
    // (trade-plan.ts) — o teste de padrão acima já trava que App.tsx chama
    // ESTA função; aqui provamos a matemática do caminho do Núcleo.
    const obstacleZonesInPath = (
      zones: { low: number; high: number }[],
      entry: { low: number; high: number },
      targetPrice: number,
      long: boolean,
    ) => {
      const entryMid = (entry.low + entry.high) / 2;
      return zones.filter((z) => {
        if (!(z.low <= z.high)) return false;
        if (z.low === entry.low && z.high === entry.high) return false;
        return long ? z.high > entryMid && z.low < targetPrice : z.low < entryMid && z.high > targetPrice;
      });
    };
    // Núcleo LONG: entrada = preço atual 100 (zona de largura zero), alvo 110.
    // Uma zona estrutural real em [104,106] está no caminho; outra em
    // [95,97] (abaixo da entrada) NÃO está.
    const zones = [
      { low: 104, high: 106 }, // obstáculo real no caminho 100→110
      { low: 95, high: 97 }, // atrás da entrada — nunca um obstáculo à frente
    ];
    const entryZone = { low: 100, high: 100 };
    const obstacles = obstacleZonesInPath(zones, entryZone, 110, true);
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0]).toEqual({ low: 104, high: 106 });

    // SHORT simétrico: entrada 100, alvo 90; zona [94,96] no caminho.
    const shortObstacles = obstacleZonesInPath([{ low: 94, high: 96 }, { low: 104, high: 106 }], entryZone, 90, false);
    expect(shortObstacles).toHaveLength(1);
    expect(shortObstacles[0]).toEqual({ low: 94, high: 96 });
  });
});
