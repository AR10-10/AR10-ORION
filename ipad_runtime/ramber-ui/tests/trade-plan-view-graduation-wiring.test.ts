// trade-plan-view-graduation-wiring.test.ts — Ordem 2 §4 (Trade Plan
// unificado), graduação: fiação real entre nexus/trade-plan-view.ts e o
// painel "Trade Plan" em App.tsx (SecondaryModuleView, aba ANALYSIS). Teste
// de PADRÃO NO CÓDIGO-FONTE — SecondaryModuleView não é exportável
// isoladamente, mesmo espírito de terminal-event-log-graduation-wiring.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: painel Trade Plan usa composeTradePlanView() para o campo Status, zero segunda medição', () => {
  it('importa composeTradePlanView de nexus/trade-plan-view, nunca uma 2ª implementação inline', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { composeTradePlanView } from "./nexus/trade-plan-view";');
  });

  it('a chamada usa as MESMAS leituras já reais de outros painéis desta view — zero campo fabricado', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const tradePlanView = composeTradePlanView({');
    expect(idx, 'chamada a composeTradePlanView não encontrada').toBeGreaterThan(-1);
    const call = app.slice(idx, idx + 550);
    expect(call).toContain('plan: tradePlan,');
    expect(call).toContain('trackedStatus: trackRecord.active?.status ?? null,');
    expect(call).toContain('setupState: nexusDecision ? deriveSetupState(nexusDecision) : null,');
    expect(call).toContain('entryState: nexusDecision ? deriveEntryState(nexusDecision) : null,');
    expect(call).toContain('scenario: scenario ?? null,');
    expect(call).toContain('reversal: reversalAlert ?? null,');
    expect(call).toContain('confidenceScore: institutionalScore?.score ?? null,');
  });

  it('institutionalScore e reversalAlert chegam via WidgetContext, mesmo padrão de todo outro campo já lido por SecondaryModuleView', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('function SecondaryModuleView({ tab }: { tab: string }) {');
    expect(idx, 'SecondaryModuleView não encontrado').toBeGreaterThan(-1);
    const body = app.slice(idx, idx + 1800);
    expect(body).toContain('institutionalScore,');
    expect(body).toContain('reversalAlert,');
  });

  it('o painel Trade Plan mostra tradePlanView.status como o PRIMEIRO stat, com tom real (nunca sempre neutro)', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('<ModulePanel title="Trade Plan · real structure only (advisory, read-only)">');
    expect(idx, 'ModulePanel Trade Plan não encontrado').toBeGreaterThan(-1);
    const panel = app.slice(idx, idx + 1700);
    const statusIdx = panel.indexOf('label="Status"');
    expect(statusIdx, 'ModuleStat Status não encontrado dentro do painel').toBeGreaterThan(-1);
    expect(panel.indexOf('label="Direction"')).toBeGreaterThan(statusIdx); // Status antes de Direction
    expect(panel).toContain('value={tradePlanView.status}');
    expect(panel).toContain('tradePlanView.status === "TARGET_REACHED" || tradePlanView.status === "ACTIVE"');
    expect(panel).toContain('tradePlanView.status === "INVALIDATED"');
  });

  it('o painel Trade Plan continua mostrando Entry/Stop/Targets direto de `tradePlan` — a graduação não duplica esses campos', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('<ModulePanel title="Trade Plan · real structure only (advisory, read-only)">');
    const panel = app.slice(idx, idx + 2600);
    expect(panel).toContain('value={tradePlan.direction}');
    expect(panel).toContain('tradePlan.entry.low.toFixed(0)');
    expect(panel).toContain('tradePlan.stop.price.toFixed(0)');
    expect(panel).toContain('tradePlan.targets.map(');
    // Nunca lido de tradePlanView.entry/invalidation/targets — seriam a
    // MESMA leitura sob um nome diferente (o compositor é passthrough puro).
    expect(panel).not.toContain('tradePlanView.entry');
    expect(panel).not.toContain('tradePlanView.invalidation');
    expect(panel).not.toContain('tradePlanView.targets');
  });
});
