// organism-health-wiring.test.ts — ADITIVO V-MAX Etapa 19: fiação real
// entre nexus/organism-health.ts e App.tsx (Row SEMPRE VISÍVEL "SAÚDE DO
// ORGANISMO" no topo do painel SYSTEM HEALTH). Teste de PADRÃO NO
// CÓDIGO-FONTE — TelemetryHealthWidget não é exportável isoladamente,
// mesmo espírito de chart-integrity-wiring.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: SAÚDE DO ORGANISMO usa o mesmo motor puro, zero segunda medição', () => {
  it('importa computeOrganismHealth de nexus/organism-health, nunca uma 2ª implementação inline', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { computeOrganismHealth, type OrganismHealthVerdict } from "./nexus/organism-health";');
  });

  it('os inputs são os MESMOS estados já nomeados para as Rows individuais (busQualityState/sufficiencyState/gmilQualityState/CHART_INTEGRITY_QUALITY/fpsClass/cycleClass) — zero recálculo', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const organismHealth = computeOrganismHealth({');
    expect(idx, 'chamada a computeOrganismHealth não encontrada').toBeGreaterThan(-1);
    const call = app.slice(idx, idx + 400);
    expect(call).toContain('offline,');
    expect(call).toContain('workersAlive: health.workersAlive,');
    expect(call).toContain('busQuality: busQualityState,');
    expect(call).toContain('sufficiencyQuality: sufficiencyState,');
    expect(call).toContain('gmilQuality: gmilQualityState,');
    expect(call).toContain('chartIntegrityQuality: CHART_INTEGRITY_QUALITY[chartIntegrity.status],');
    expect(call).toContain('fpsClass,');
    expect(call).toContain('cycleClass,');
  });

  it('busQualityState/sufficiencyState/gmilQualityState são nomeados uma única vez e reusados nas Rows existentes (mesma variável, nunca uma leitura divergente)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const busQualityState = classifyBusQuality(quality?.classification ?? null);');
    expect(app).toContain('const qualityColor = DATA_QUALITY_COLOR[busQualityState];');
    expect(app).toContain('const sufficiencyColor = DATA_QUALITY_COLOR[sufficiencyState];');
    expect(app).toContain('const gmilColor = DATA_QUALITY_COLOR[gmilQualityState];');
  });

  it('a cor da linha reusa a MESMA paleta DATA_QUALITY_COLOR — nunca uma 3ª paleta', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const organismHealthColor = DATA_QUALITY_COLOR[ORGANISM_HEALTH_QUALITY[organismHealth.verdict]];');
  });

  it('a Row "SAÚDE DO ORGANISMO" é a primeira do painel SYSTEM HEALTH (antes de QUALIDADE DA FONTE)', () => {
    const app = read('../src/App.tsx');
    const healthRowIdx = app.indexOf('label="SAÚDE DO ORGANISMO"');
    const firstOldRowIdx = app.indexOf('label="QUALIDADE DA FONTE (BUS)"');
    expect(healthRowIdx, 'Row SAÚDE DO ORGANISMO não encontrada').toBeGreaterThan(-1);
    expect(firstOldRowIdx, 'Row QUALIDADE DA FONTE (BUS) não encontrada').toBeGreaterThan(-1);
    expect(healthRowIdx).toBeLessThan(firstOldRowIdx);
  });

  it('os 4 estados reais de OrganismHealthVerdict têm rótulo E mapeamento de cor — nenhum estado sem cobertura', () => {
    const app = read('../src/App.tsx');
    const statuses = ['OK', 'WARN', 'CRITICAL', 'AGUARDANDO'];
    const labelBlock = app.slice(app.indexOf('const ORGANISM_HEALTH_LABEL'), app.indexOf('const ORGANISM_HEALTH_QUALITY'));
    const qualityBlock = app.slice(app.indexOf('const ORGANISM_HEALTH_QUALITY'), app.indexOf('function TelemetryHealthWidget'));
    for (const status of statuses) {
      expect(labelBlock, `ORGANISM_HEALTH_LABEL sem ${status}`).toContain(`${status}:`);
      expect(qualityBlock, `ORGANISM_HEALTH_QUALITY sem ${status}`).toContain(`${status}:`);
    }
  });
});
