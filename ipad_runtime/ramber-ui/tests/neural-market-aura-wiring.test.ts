// neural-market-aura-wiring.test.ts — Neural Market Aura (especificação do
// Operador): source-level wiring locks. A matemática pura já tem cobertura
// de execução real em aura-lifecycle.test.ts — este arquivo tranca a
// fiação: import certo, arquitetura de plugin igual às irmãs, Fio de Seda
// preservado literalmente, montagem correta, eventos de voz reais, LEI 24
// (nunca escreve de volta em TradePlan/TrackRecordState/engine).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('chart/NeuralMarketAuraPlugin.tsx: mesma arquitetura de overlay das irmãs, Fio de Seda literal', () => {
  it('dirty-flag + rAF + ResizeObserver, unsubscribe real no cleanup (mesmo padrão de StructureBreakMarkersPlugin)', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);');
    expect(plugin).toContain('chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);');
    expect(plugin).toContain('new ResizeObserver(() => markDirty());');
  });

  it('nunca setLineDash, nunca lineWidth diferente de 1 — convicção fala pelo preenchimento, nunca pela linha', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).not.toContain('.setLineDash(');
    const lineWidthAssignments = plugin.match(/ctx\.lineWidth = [^;]+;/g) ?? [];
    expect(lineWidthAssignments.length).toBeGreaterThan(0);
    for (const assignment of lineWidthAssignments) {
      expect(assignment).toBe('ctx.lineWidth = 1;');
    }
  });

  it('sem leitura real (status != OK, sem plano, ou fadeAlpha 0) não desenha nada — honesto, nunca um palpite', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('if (!reading || reading.status !== "OK" || !reading.plan || reading.fadeAlpha <= 0) return;');
  });

  it('largura do corredor vem de corridorWidthFactor (convicção real), nunca uma largura fixa arbitrária', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('function corridorWidthPx(widthFactor: number | null): number {');
    expect(plugin).toContain('const bandWidth = Math.min(cssWidth, corridorWidthPx(corridorWidthFactor));');
  });

  it('resolução (TARGET_HIT/STOP_HIT) usa cor de RESULTADO real, não de direção — um SHORT que bate o alvo é sucesso (verde), não "vermelho porque é short"', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    const fnMatch = plugin.match(/function phaseRgb\([\s\S]*?\n\}/);
    expect(fnMatch, 'phaseRgb não encontrada').not.toBeNull();
    const body = fnMatch![0];
    expect(body).toContain('if (phase === "TARGET_HIT") return LONG_RGB;');
    expect(body).toContain('if (phase === "STOP_HIT") return SHORT_RGB;');
  });

  it('BIRTH/ESTABLISHED/REPLACED (sem resultado real ainda) usa cor NEUTRA, nunca por direção do plano — corrige a colisão com alvo/stop nativos (achado real de auditoria, FASE Ω Priority 3, Finding I)', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('function phaseRgb(phase: AuraReading["phase"]): string {');
    const fnMatch = plugin.match(/function phaseRgb\([\s\S]*?\n\}/);
    const body = fnMatch![0];
    expect(body).not.toContain('direction');
    expect(body).toContain('return NEUTRAL_RGB;');
    expect(plugin).toContain('const rgb = phaseRgb(phase);');
  });

  it('STOP_HIT ganha marcador real na coordenada real do stop (achado real de auditoria, FASE Ω Priority 3, Finding J) — antes nenhum marcador aparecia nessa fase', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('if (phase === "STOP_HIT") {');
    expect(plugin).toContain('const yStop = series.priceToCoordinate(plan.stop.price);');
  });
});

describe('"Ciclone de Convicção" (pedido do Operador): Worker dedicado, nunca uma animação perpétua enxertada no main thread', () => {
  it('duas <canvas> reais (ciclone animado + corredor estático de fallback), nenhuma outra arquitetura de canvas', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('const cycloneCanvasRef = useRef<HTMLCanvasElement | null>(null);');
    expect(plugin).toContain('const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);');
  });

  it('handshake real igual ao já provado por OrderFlowHeatmapPlugin — transferControlToOffscreen + postMessage("ready") antes de confiar no Worker', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('new Worker(new URL("../workers/conviction-cyclone-worker.ts", import.meta.url), { type: "module" });');
    expect(plugin).toContain('transferControlToOffscreen: () => OffscreenCanvas');
    expect(plugin).toContain('candidateWorker.postMessage({ type: "init", canvas: offscreen }, [offscreen]);');
    expect(plugin).toContain("if (ev.data?.type === \"ready\") {");
  });

  it('corredor ESTÁTICO sempre desenha primeiro em draw() — garantia real de fallback nunca mostra frame desatualizado ao trocar de canvas', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    const drawFn = plugin.match(/const draw = \(\) => \{([\s\S]*?)\n    \};/);
    expect(drawFn, 'draw() não encontrada').not.toBeNull();
    const body = drawFn![1];
    expect(body.indexOf('drawStatic();')).toBeGreaterThan(-1);
    expect(body.indexOf('drawStatic();')).toBeLessThan(body.indexOf('buildCycloneReal()'));
  });

  it('Ciclone só existe durante a PERSEGUIÇÃO real (BIRTH/ESTABLISHED) — nunca durante resolução/dissolução (TARGET_HIT/STOP_HIT/REPLACED)', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('if (reading.phase !== "BIRTH" && reading.phase !== "ESTABLISHED") return null;');
  });

  it('visibilidade das duas <canvas> é 100% imperativa (applyVisibility), nunca via useState/JSX — evita corrida entre dois donos do mesmo style.display', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).not.toContain('useState');
    expect(plugin).toContain('const applyVisibility = (showCyclone: boolean) => {');
    expect(plugin).toContain('applyVisibility(real !== null);');
  });

  it('largura do corredor do Ciclone reaproveita a MESMA corridorWidthPx do corredor estático — nunca duas larguras diferentes pro mesmo dado real', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    const fnMatch = plugin.match(/const buildCycloneReal = \(\): CycloneRealParams \| null => \{([\s\S]*?)\n    \};/);
    expect(fnMatch, 'buildCycloneReal não encontrada').not.toBeNull();
    expect(fnMatch![1]).toContain('corridorWidthPx(corridorWidthFactor)');
  });

  it('Worker é terminado no cleanup real do efeito — nunca vaza um Worker rodando fora do ciclo de vida do plugin', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('worker?.terminate();');
  });

  it('respeita prefers-reduced-motion real do sistema — nunca tenta o Ciclone quando o Operador pediu menos movimento (auto-auditoria Ω-INFINITY: "aumentar compreensão, nunca só efeito estético")', () => {
    const plugin = read('../src/chart/NeuralMarketAuraPlugin.tsx');
    expect(plugin).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
    expect(plugin).toContain('if (supportsOffscreenWorker() && !prefersReducedMotion()) {');
  });
});

describe('workers/conviction-cyclone-worker.ts: laço de animação inteiramente dentro do Worker (achado real: Main Thread sagrada exigia isolamento)', () => {
  it('reaproveita computeCycloneFrame/drawCycloneFrame puros — zero segunda implementação de desenho', () => {
    const worker = read('../src/workers/conviction-cyclone-worker.ts');
    expect(worker).toContain('import {\n  computeCycloneFrame,\n  drawCycloneFrame,');
  });

  it('possui laço próprio (setInterval) que só roda com dado real — nunca posta frame sem "update" real recebido antes', () => {
    const worker = read('../src/workers/conviction-cyclone-worker.ts');
    expect(worker).toContain('intervalId = setInterval(() => {');
    expect(worker).toContain('if (!ctx || !lastReal) return;');
  });

  it('real=null (sem plano/status/fadeAlpha real) para o laço e limpa o canvas — nunca desenha um ciclone fabricado sem operação real por trás', () => {
    const worker = read('../src/workers/conviction-cyclone-worker.ts');
    expect(worker).toContain('if (lastReal === null) {');
    expect(worker).toContain('stopTicking();');
    expect(worker).toContain('ctx.clearRect(0, 0, canvas.width, canvas.height);');
  });

  it('handshake honesto: reporta ready:false quando getContext("2d") falha, nunca supõe suporte real', () => {
    const worker = read('../src/workers/conviction-cyclone-worker.ts');
    expect(worker).toContain('post({ type: "ready", ok: !!ctx });');
  });
});

describe('EnhancedChart_110_Percent.tsx: aura montada ANTES da caixa de entrada (TradePlanZonePlugin), nunca redesenha a mesma caixa', () => {
  it('importa NeuralMarketAuraPlugin + AuraReading, prop aura opcional e fail-closed', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('import { NeuralMarketAuraPlugin } from "./NeuralMarketAuraPlugin";');
    expect(chart).toContain('aura?: AuraReading | null;');
  });

  it('NeuralMarketAuraPlugin aparece no JSX antes de TradePlanZonePlugin (corredor difuso fica atrás da caixa nítida)', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const auraIdx = chart.indexOf('<NeuralMarketAuraPlugin');
    const zoneIdx = chart.indexOf('<TradePlanZonePlugin');
    expect(auraIdx).toBeGreaterThan(-1);
    expect(zoneIdx).toBeGreaterThan(-1);
    expect(auraIdx).toBeLessThan(zoneIdx);
  });
});

describe('App.tsx: ChartWidget computa auraReading reaproveitando trackRecord real + convictionReading compartilhada', () => {
  it('importa computeAuraReading/TIMEFRAME_MS de nexus/aura-lifecycle', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { computeAuraReading, TIMEFRAME_MS } from "./nexus/aura-lifecycle";');
  });

  it('usa useTrackRecordSnapshot (mesma fatia real do Signal Track Record) + convictionReading do contexto, nunca um segundo cálculo de convicção', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const auraTrackRecord = useTrackRecordSnapshot();');
    const fnMatch = app.match(/const auraReading = useMemo\(\s*\(\) =>\s*computeAuraReading\(\{([\s\S]*?)\}\),/);
    expect(fnMatch, 'computeAuraReading não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('trackRecord: auraTrackRecord,');
    expect(body).toContain('conviction: convictionReading?.status === "OK" ? (convictionReading.convictionAdjusted ?? convictionReading.conviction) : null,');
    expect(body).toContain('atrPercent: engine?.marketRegime?.atrPercent ?? null,');
  });

  it('aura={auraReading} passado para EnhancedChart_110_Percent', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('aura={auraReading}');
  });
});

describe('voice-intents.ts + voice-dispatcher.ts: eventos reais do ciclo de vida do Trade Plan, mesma convenção de chave-muda de structureBreakKey', () => {
  it('TerminalSnapshot ganha os campos reais (aditivo)', () => {
    const intents = read('../src/voice/voice-intents.ts');
    expect(intents).toContain('tradePlanOpenKey: string | null;');
    expect(intents).toContain("tradePlanResolutionStatus: 'TARGET_HIT' | 'STOP_HIT' | 'REPLACED' | null;");
    expect(intents).toContain('inEntryZone: boolean;');
    expect(intents).toContain("convictionVerdict: 'CONFIRMS' | 'CONTRADICTS' | 'MIXED' | null;");
  });

  it('computeAlerts dispara em transição real de abertura/resolução/zona/convicção, nunca por repetição', () => {
    const dispatcher = read('../src/voice/voice-dispatcher.ts');
    expect(dispatcher).toContain('if (next.tradePlanOpenKey && next.tradePlanOpenKey !== prev.tradePlanOpenKey) {');
    expect(dispatcher).toContain('if (!prev.inEntryZone && next.inEntryZone) {');
    expect(dispatcher).toContain('if (next.tradePlanResolutionKey && next.tradePlanResolutionKey !== prev.tradePlanResolutionKey) {');
  });

  it('convicção reduzida só entre DUAS leituras reais (nunca a partir de null = "indisponível" tratado como "reduzida")', () => {
    const dispatcher = read('../src/voice/voice-dispatcher.ts');
    expect(dispatcher).toContain('prev.convictionVerdict && next.convictionVerdict &&');
  });
});

describe('App.tsx: voiceSnapshot relocado após trackRecordSlice/convictionReading (mesmo risco de Temporal Dead Zone já resolvido para bosChoch)', () => {
  it('trackRecordSlice e convictionReading declarados ANTES de voiceSnapshot', () => {
    const app = read('../src/App.tsx');
    const trackRecordIdx = app.indexOf('const trackRecordSlice = useTrackRecordSnapshot();');
    const convictionIdx = app.indexOf('const convictionReading = useMemo(');
    const voiceSnapshotIdx = app.indexOf('const voiceSnapshot = useMemo<TerminalSnapshot>(');
    expect(trackRecordIdx).toBeGreaterThan(-1);
    expect(convictionIdx).toBeGreaterThan(-1);
    expect(voiceSnapshotIdx).toBeGreaterThan(-1);
    expect(trackRecordIdx).toBeLessThan(voiceSnapshotIdx);
    expect(convictionIdx).toBeLessThan(voiceSnapshotIdx);
  });
});

describe('App.tsx: inEntryZone com histerese real, nunca a borda nua (achado real de auditoria, FASE Ω Priority 3, Finding K)', () => {
  it('margem é proporcional ao range REAL da zona (nunca um delta de preço fixo), só se aplica quando já dentro (wasIn)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const ENTRY_ZONE_HYSTERESIS_FACTOR = 0.25;');
    expect(app).toContain('const wasIn = inEntryZoneLatchRef.current;');
    expect(app).toContain('const margin = (rawEntryHigh - rawEntryLow) * ENTRY_ZONE_HYSTERESIS_FACTOR;');
    expect(app).toContain('const low = wasIn ? rawEntryLow - margin : rawEntryLow;');
    expect(app).toContain('const high = wasIn ? rawEntryHigh + margin : rawEntryHigh;');
  });

  it('inEntryZoneLatchRef é escrito só DEPOIS do useMemo (useEffect separado) — nunca mutado durante o próprio render', () => {
    const app = read('../src/App.tsx');
    const refDeclIdx = app.indexOf('const inEntryZoneLatchRef = useRef(false);');
    const memoIdx = app.indexOf('const inEntryZoneNow = useMemo(');
    const writeBackIdx = app.indexOf('inEntryZoneLatchRef.current = inEntryZoneNow;');
    expect(refDeclIdx).toBeGreaterThan(-1);
    expect(memoIdx).toBeGreaterThan(-1);
    expect(writeBackIdx).toBeGreaterThan(-1);
    expect(refDeclIdx).toBeLessThan(memoIdx);
    expect(memoIdx).toBeLessThan(writeBackIdx);
    expect(app).toContain('inEntryZone: inEntryZoneNow,');
  });
});

describe('LEI 24: nexus/aura-lifecycle.ts nunca escreve de volta em TradePlan/TrackRecordState/engine', () => {
  it('computeAuraReading só LÊ TrackRecordState (import type), nenhuma chamada a setTradePlan/setTrackRecord/trackPlanTransition/trackPriceTick', () => {
    const engineSrc = read('../src/nexus/aura-lifecycle.ts');
    expect(engineSrc).toContain('import type { TradePlan } from "./trade-plan";');
    expect(engineSrc).toContain('import type { TrackedPlan, TrackRecordState } from "./signal-track-record";');
    expect(engineSrc).not.toContain('setTradePlan(');
    expect(engineSrc).not.toContain('setTrackRecord(');
    expect(engineSrc).not.toContain('trackPlanTransition(');
    expect(engineSrc).not.toContain('trackPriceTick(');
  });
});
