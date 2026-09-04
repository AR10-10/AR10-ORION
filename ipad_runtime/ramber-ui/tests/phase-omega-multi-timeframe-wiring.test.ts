// phase-omega-multi-timeframe-wiring.test.ts — Fase Ω Priority 1 (Adaptive
// Multi-Timeframe Intelligence): source-level wiring locks for the 3 real
// integration points (engine-bridge.ts orchestration, the store slice,
// App.tsx's periodic effect + widget). The pure engine itself
// (analyzeTimeframe/computeTimeframeConfidence) is covered by real
// execution in multi-timeframe-engine.test.ts — same split already used by
// chart-history-pagination.test.ts (real execution for the pure boundary
// logic, source pattern for the real wiring around it).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('engine-bridge.ts: buildMultiTimeframeContext — mesmo Bus, cadência própria, fail-closed honesto', () => {
  it('busca os prazos via MULTI_TIMEFRAME_LIST + requestFuturesCandleSnapshot (mesmo Bus, zero segunda fonte)', () => {
    const bridge = read('../src/engine-bridge.ts');
    const fnMatch = bridge.match(/export async function buildMultiTimeframeContext\(symbol = 'BTC'\): Promise<MultiTimeframeMatrix \| null> \{([\s\S]*?)\n\}/);
    expect(fnMatch, 'buildMultiTimeframeContext não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('MULTI_TIMEFRAME_LIST.map(async (tf)');
    expect(body).toContain('await requestFuturesCandleSnapshot({');
    expect(body).toContain('symbol, timeframe: tf, limit: MTF_CANDLE_LIMIT, maxAgeMs: MTF_MAX_AGE_MS,');
    expect(body).toContain('analyzeTimeframe(tf, snapshot.ok ? snapshot.candles : [])');
    // Nunca uma segunda fonte de rede fora do Bus (getOlderChartCandles é o
    // único caminho legítimo que bypassa o Bus, e é para paginação
    // histórica, não para este contexto).
    expect(body).not.toContain('collectBinanceFuturesKlines');
  });

  it('try/catch real ao redor da chamada de rede: exceção do Bus cai no MESMO caminho honesto de "sem candles"', () => {
    const bridge = read('../src/engine-bridge.ts');
    const fnMatch = bridge.match(/export async function buildMultiTimeframeContext\(symbol = 'BTC'\): Promise<MultiTimeframeMatrix \| null> \{([\s\S]*?)\n\}/);
    const body = fnMatch![1];
    expect(body).toContain('} catch {');
    expect(body).toContain('return [tf, analyzeTimeframe(tf, [])];');
  });

  it('todos os prazos sem NENHUMA leitura real => null honesto (nunca uma matriz de linhas vazias)', () => {
    const bridge = read('../src/engine-bridge.ts');
    const fnMatch = bridge.match(/export async function buildMultiTimeframeContext\(symbol = 'BTC'\): Promise<MultiTimeframeMatrix \| null> \{([\s\S]*?)\n\}/);
    const body = fnMatch![1];
    expect(body).toContain("const anyOk = entries.some(([, ctx]) => ctx.status === 'OK');");
    expect(body).toContain('if (!anyOk) return null;');
    expect(body).toContain('return Object.fromEntries(entries) as MultiTimeframeMatrix;');
  });

  it('cadência própria (MTF_MAX_AGE_MS/MTF_CANDLE_LIMIT) — nunca reaproveita as constantes do ciclo principal por acidente', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain('const MTF_CANDLE_LIMIT = 100;');
    expect(bridge).toContain('const MTF_MAX_AGE_MS = 50_000;');
  });

  it('importa analyzeTimeframe/MULTI_TIMEFRAME_LIST do motor puro — zero segunda implementação dos motores reais', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("import {\n  analyzeTimeframe,\n  MULTI_TIMEFRAME_LIST,");
    expect(bridge).toContain("} from './nexus/multi-timeframe-engine';");
  });
});

describe('unified-snapshot-store.ts: multiTimeframeContext segue o padrão de 4 locais do council/tradePlan', () => {
  it('aparece exatamente nos 4 locais canônicos (state, action, default, seletor) dentro do domínio §4 CÉREBRO', () => {
    const store = read('../src/store/unified-snapshot-store.ts');
    expect(store).toContain('import type { MultiTimeframeMatrix } from "../nexus/multi-timeframe-engine";');
    expect(store).toContain('multiTimeframeContext: MultiTimeframeMatrix | null;');
    expect(store).toContain('setMultiTimeframeContext: (matrix: MultiTimeframeMatrix | null) => void;');
    expect(store).toContain('multiTimeframeContext: null,');
    expect(store).toContain('setMultiTimeframeContext: (matrix) => set((s) => { s.multiTimeframeContext = matrix; }),');
    expect(store).toContain(
      'export const useMultiTimeframeSnapshot = (): MultiTimeframeMatrix | null =>\n  useUnifiedSnapshotStore((s) => s.multiTimeframeContext);',
    );
  });

  it('o slice vive depois de tradePlan (mesma ordem cronológica §4 CÉREBRO já estabelecida), nunca fora do domínio', () => {
    const store = read('../src/store/unified-snapshot-store.ts');
    const stateBlock = store.match(/tradePlan: TradePlan \| null;\n([\s\S]*?)multiTimeframeContext: MultiTimeframeMatrix \| null;/);
    expect(stateBlock, 'multiTimeframeContext não está logo após tradePlan no bloco de estado').not.toBeNull();
    const defaultsBlock = store.match(/tradePlan: null,\n\s*multiTimeframeContext: null,/);
    expect(defaultsBlock, 'multiTimeframeContext não está logo após tradePlan nos defaults').not.toBeNull();
  });
});

describe('App.tsx: ciclo periódico de 60s independente do ciclo principal de 30s', () => {
  it('runMultiTimeframeCycle: busca, sempre escreve o resultado (mesmo null), nunca lança para fora do effect', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/const runMultiTimeframeCycle = async \(\): Promise<boolean> => \{([\s\S]*?)\n {4}\};/);
    expect(fnMatch, 'runMultiTimeframeCycle não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('const matrix = await buildMultiTimeframeContext(selectedAsset);');
    expect(body).toContain('useUnifiedSnapshotStore.getState().setMultiTimeframeContext(matrix);');
    expect(body).toContain('return matrix !== null;');
  });

  it('cadência PRÓPRIA de 60s (setInterval), boot inicial via o MESMO retryBoot do ciclo principal', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('retryBoot(runMultiTimeframeCycle, () => cancelled);');
    expect(app).toContain('const mtfInterval = setInterval(runMultiTimeframeCycle, 60000);');
    expect(app).toContain('clearInterval(mtfInterval);');
  });

  it('deps [bootGeneration, selectedAsset] — deliberadamente SEM chartTimeframe (os prazos não dependem de qual está selecionado no gráfico)', () => {
    const app = read('../src/App.tsx');
    // Isola o efeito específico do MTF (não o ciclo principal, que tem as
    // mesmas duas deps + chartTimeframe) ancorando no corpo único que só
    // este efeito contém (mtfInterval).
    const effectMatch = app.match(/useEffect\(\(\) => \{\s*let cancelled = false;\s*const runMultiTimeframeCycle[\s\S]*?\n {2}\}, \[([^\]]*)\]\);/);
    expect(effectMatch, 'efeito do Multi-Timeframe Context não encontrado').not.toBeNull();
    expect(effectMatch![1]).toBe('bootGeneration, selectedAsset');
  });

  it('import de buildMultiTimeframeContext (engine-bridge) e useMultiTimeframeSnapshot (store)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('buildMultiTimeframeContext,');
    expect(app).toContain('useMultiTimeframeSnapshot');
    expect(app).toContain("from \"./nexus/multi-timeframe-engine\";");
  });
});

describe('App.tsx: MULTI-TIMEFRAME MATRIX é uma ferramenta secundária opt-in (mesma disciplina de densidade/zero-scroll)', () => {
  it('registrada em DEFAULT_WIDGETS como oculta por padrão (nunca força mais um painel sempre visível)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('multi_timeframe: { visible: false, floating: false, collapsed: false, pinned: false },');
  });

  it('tem rótulo oficial (WIDGET_LABELS) e entrada no Workspace Manager (fechável, não um dos 6 painéis always-docked)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('multi_timeframe: "MULTI-TIMEFRAME MATRIX",');
    expect(app).toContain('{ id: "multi_timeframe", label: "MULTI-TIMEFRAME MATRIX" },');
  });

  it('montada na strip sob a mesma condição de visibilidade dos outros painéis secundários (asset_heatmap/scanner/exposure/events/neural_core)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('widgets.multi_timeframe.visible) && (');
    expect(app).toContain('{widgets.multi_timeframe.visible && <MultiTimeframeMatrixWidget />}');
  });
});

describe('App.tsx: MultiTimeframeMatrixWidget — display only (LEI 24), confluência é contagem real nunca probabilidade', () => {
  it('lê da store real (useMultiTimeframeSnapshot), itera MULTI_TIMEFRAME_LIST — nunca uma lista de prazos duplicada', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function MultiTimeframeMatrixWidget\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'MultiTimeframeMatrixWidget não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('const matrix = useMultiTimeframeSnapshot();');
    expect(body).toContain('MULTI_TIMEFRAME_LIST.map((tf)');
    expect(body).toContain('<Widget id="multi_timeframe" title="MULTI-TIMEFRAME MATRIX" flex="flex-1">');
  });

  it('confluência é uma contagem honesta (longCount/shortCount sobre leituras reais), nunca um rótulo "probabilidade"', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function MultiTimeframeMatrixWidget\(\) \{([\s\S]*?)\n\}\n/);
    const body = fnMatch![1];
    expect(body).toContain("c.status === \"OK\" && c.confidenceStance !== null");
    expect(body).toContain('const longCount = readRows.filter((c) => c.confidenceStance === "LONG").length;');
    expect(body).toContain('const shortCount = readRows.filter((c) => c.confidenceStance === "SHORT").length;');
    expect(body).not.toMatch(/probabilidade calibrada de mercado["'`]?\s*[:=]/i);
  });

  // Achado real de auditoria (sincronismo pós-SMC Harmonic Fusion): o
  // rótulo/tooltip diziam "6 PRAZOS"/"6 prazos" escrito à mão, desde antes
  // da Diretriz Mestra §7 ampliar MULTI_TIMEFRAME_LIST pra 9 — nunca
  // corrigido, nunca pego (nenhum teste comparava contra o array real).
  // Agora deriva de MULTI_TIMEFRAME_LIST.length, nunca mais pode divergir
  // em silêncio se a lista mudar de tamanho de novo.
  it('o rótulo/tooltip de contagem de prazos são derivados de MULTI_TIMEFRAME_LIST.length — nunca um número escrito à mão que pode divergir', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function MultiTimeframeMatrixWidget\(\) \{([\s\S]*?)\n\}\n/);
    const body = fnMatch![1];
    expect(body).toContain('CONFLUÊNCIA · {MULTI_TIMEFRAME_LIST.length} PRAZOS');
    expect(body).toContain('`Contagem real de quantos dos ${MULTI_TIMEFRAME_LIST.length} prazos');
    expect(body).not.toMatch(/6\s*PRAZOS/);
    expect(body).not.toMatch(/dos 6 prazos/);
  });

  // SMC Harmonic Fusion — auditoria de sincronismo (pedido do Operador):
  // Liquidez SMC (OB/FVG/EQL) por prazo, mesmo motor do gráfico principal,
  // some na tooltip de cada linha da Matriz — fail-open honesto: só entra
  // quando o trio veio real (nunca um "0" fabricado pra um prazo sem leitura).
  it('a tooltip por prazo inclui Liquidez SMC real (OB/FVG/EQL) quando o trio existe, fail-open quando ausente', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function MultiTimeframeMatrixWidget\(\) \{([\s\S]*?)\n\}\n/);
    const body = fnMatch![1];
    expect(body).toContain(
      'ctx.unmitigatedOrderBlockCount !== null\n                  ? `OB ${ctx.unmitigatedOrderBlockCount} · FVG ${ctx.unmitigatedFvgCount} · EQL livre ${ctx.unsweptLiquidityZoneCount}`\n                  : null,',
    );
  });
});
