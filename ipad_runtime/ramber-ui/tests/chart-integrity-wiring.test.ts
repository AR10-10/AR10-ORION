// chart-integrity-wiring.test.ts — ADITIVO V-MAX Etapa 17: fiação real
// entre engine-bridge.ts (passthrough symbol/timeframe/candleAgeMs) e
// App.tsx (TelemetryHealthWidget mostra o veredito real, mesma paleta
// DATA_QUALITY_COLOR das outras linhas do painel). Teste de PADRÃO NO
// CÓDIGO-FONTE — TelemetryHealthWidget não é uma função exportável
// isoladamente, mesmo espírito de chart-layers-panel-wiring.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('engine-bridge.ts: RealCycleResult expõe symbol/timeframe/candleAgeMs — o gancho real que faltava para verificar sincronia', () => {
  it('a interface declara os 3 campos novos como passthrough puro', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain('symbol?: string;');
    expect(bridge).toContain('timeframe?: string;');
    expect(bridge).toContain('candleAgeMs?: number;');
  });

  it('o return real de runRealAnalysisCycle preenche os 3 campos com os MESMOS valores já usados no ciclo (nunca uma 2ª leitura)', () => {
    const bridge = read('../src/engine-bridge.ts');
    const start = bridge.indexOf('export async function runRealAnalysisCycle');
    const end = bridge.indexOf('// Fase B (Market Data Bus): candles do gráfico da UI', start);
    expect(start, 'runRealAnalysisCycle não encontrada').toBeGreaterThan(-1);
    expect(end, 'fim de runRealAnalysisCycle não encontrado').toBeGreaterThan(start);
    const body = bridge.slice(start, end);
    expect(body).toContain('symbol,');
    expect(body).toContain('timeframe: snapshot.timeframe,');
    expect(body).toContain('candleAgeMs: snapshot.ageMs,');
  });
});

describe('App.tsx: TelemetryHealthWidget mostra o veredito real do Chart Integrity Engine', () => {
  it('importa computeChartIntegrity de nexus/chart-integrity, nunca uma 2ª implementação inline', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { computeChartIntegrity, type ChartIntegrityStatus } from "./nexus/chart-integrity";');
  });

  it('TelemetryHealthWidget lê selectedAsset do MESMO WidgetContext (nenhuma segunda fonte de símbolo selecionado)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain(
      'const { engine, realCycle, cycleLatencyMs, fps, chartTimeframe, engineStatus, gmilProviders, selectedAsset } = useContext(WidgetContext) || {};',
    );
  });

  it('chartIntegrity é calculado a partir de realCycle.symbol/timeframe/candleAgeMs vs. a seleção atual — mesmos campos, zero recálculo', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const chartIntegrity = computeChartIntegrity({');
    expect(idx, 'chamada a computeChartIntegrity não encontrada').toBeGreaterThan(-1);
    const call = app.slice(idx, idx + 400);
    expect(call).toContain('selectedSymbol: selectedAsset ?? null,');
    expect(call).toContain('selectedTimeframe: chartTimeframe ?? null,');
    expect(call).toContain('cycleSymbol: realCycle?.symbol ?? null,');
    expect(call).toContain('cycleTimeframe: realCycle?.timeframe ?? null,');
    expect(call).toContain('candleAgeMs: realCycle?.candleAgeMs ?? null,');
  });

  it('a cor da linha reusa a MESMA paleta DATA_QUALITY_COLOR das outras 3 linhas de qualidade — nunca uma 2ª paleta', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const chartIntegrityColor = DATA_QUALITY_COLOR[CHART_INTEGRITY_QUALITY[chartIntegrity.status]];');
  });

  it('a Row real aparece no painel SYSTEM HEALTH', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('<Row label="INTEGRIDADE DO GRÁFICO" value={CHART_INTEGRITY_LABEL[chartIntegrity.status]} valueClass={chartIntegrityColor} />');
  });

  it('os 4 estados reais de ChartIntegrityStatus têm rótulo E mapeamento de cor — nenhum estado sem cobertura', () => {
    const app = read('../src/App.tsx');
    const statuses = ['SYNCED', 'SYMBOL_MISMATCH', 'STALE_DATA', 'DADOS_INSUFICIENTES'];
    const labelBlock = app.slice(app.indexOf('const CHART_INTEGRITY_LABEL'), app.indexOf('const CHART_INTEGRITY_QUALITY'));
    const qualityBlock = app.slice(app.indexOf('const CHART_INTEGRITY_QUALITY'), app.indexOf('function TelemetryHealthWidget'));
    for (const status of statuses) {
      expect(labelBlock, `CHART_INTEGRITY_LABEL sem ${status}`).toContain(`${status}:`);
      expect(qualityBlock, `CHART_INTEGRITY_QUALITY sem ${status}`).toContain(`${status}:`);
    }
  });
});
