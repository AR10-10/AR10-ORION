// stage-runner.test.ts — OMEGA CORE V-MAX Fase 3. Prova as 4 regras exigidas
// pela diretiva: (1) ordem causal — nenhum estágio ok=true depois de um
// ok=false; (2) stages não se falam diretamente — traceStages() só lê o
// snapshot, nunca chama um motor (fiação de import); (3) fail-closed entre
// etapas — reachedIndex nunca "pula" um estágio quebrado; (4) um Trade Plan
// ausente por decisão honesta do Conselho (NEUTRAL/ABSTAIN) não é reportado
// como falha de estágio.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { useUnifiedSnapshotStore } from '../src/store/unified-snapshot-store';
import { buildCouncilDecision, type CouncilDecision } from '../src/nexus/council';
import { buildNexusDecision } from '../src/nexus/decision-layer';
import { traceStages, STAGE_ORDER } from '../src/nexus/stage-runner';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const NO_PRICE = { price: null, delta: null, deltaPct: null, high: null, low: null, volume: null, direction: null, updatedAt: null };
const PENDING_CORE = { engineStatus: 'pending' as const, direction: null, confidence: null, lastUpdateAt: null, cycleLatencyMs: null };

beforeEach(() => {
  useUnifiedSnapshotStore.setState({ price: NO_PRICE, core: PENDING_CORE, council: null, nexusDecision: null });
});

// Contrato único real (nunca fabricado à mão) com insumos honestamente
// vazios — mesmo espírito de realAbstainCouncil abaixo.
const realEmptyNexusDecision = () =>
  buildNexusDecision({
    coreDirection: null,
    coreConfidence: null,
    plan: null,
    targetsHit: 0,
    etaReading: null,
    score: null,
    scoreZoneLabel: null,
    scoreTrend: null,
    councilStance: null,
    councilRiskGated: null,
    assistantMessage: null,
    inEntryZone: null,
    lastResolvedAt: null,
    councilVotes: null,
    convictionMembers: null,
    heatTier: null,
    premiumDiscountZone: null,
  });

// Decisão real do próprio motor do conselho (nunca um objeto fabricado à
// mão) — insumos honestamente vazios produzem o ABSTAIN fail-closed real.
const realAbstainCouncil = (): CouncilDecision =>
  buildCouncilDecision({
    price: null,
    liquidityZones: [],
    structure15: null,
    structure1h: null,
    cvd: null,
    orderflowSignals: [],
    offline: true,
    isDataFresh: false,
    engineStatus: 'pending',
    fibonacci: null,
    rsi: null,
  });

describe('traceStages: DATA', () => {
  it('não-ok quando price.updatedAt é null (boot ou troca de ativo recente)', () => {
    const trace = traceStages(useUnifiedSnapshotStore.getState(), 1);
    expect(trace.stages[0]).toEqual({ id: 'DATA', ok: false, reason: expect.stringContaining('sem tick real') });
    expect(trace.reachedIndex).toBe(-1);
  });

  it('ok quando um preço real já chegou', () => {
    useUnifiedSnapshotStore.getState().setPrice({ price: 50_000, delta: 100, deltaPct: 0.2, high: 51_000, low: 49_000, volume: 1000, direction: 'LONG' });
    const trace = traceStages(useUnifiedSnapshotStore.getState(), 1);
    expect(trace.stages[0].ok).toBe(true);
  });
});

describe('traceStages: ordem causal (fail-closed) — regra central da Fase 3', () => {
  it('DATA quebrado derruba CORE_ENGINE, COUNCIL e TRADE_PLAN em cascata, mesmo que os dados deles pareçam presentes', () => {
    // Cenário adversarial: core/council TÊM dado real, mas DATA não — a
    // causalidade exige que nada depois de DATA seja reportado ok mesmo
    // assim, porque um motor não pode ter rodado honestamente sem preço.
    useUnifiedSnapshotStore.setState({
      core: { engineStatus: 'ok', direction: 'LONG', confidence: 'ALTA', lastUpdateAt: Date.now(), cycleLatencyMs: 10 },
      council: realAbstainCouncil(),
    });
    const trace = traceStages(useUnifiedSnapshotStore.getState(), 1);
    expect(trace.stages.map((s) => s.ok)).toEqual([false, false, false, false, false]);
    expect(trace.reachedIndex).toBe(-1);
  });

  it('CORE_ENGINE pendente/erro derruba COUNCIL, TRADE_PLAN e NEXUS_DECISION mesmo com DATA ok', () => {
    useUnifiedSnapshotStore.getState().setPrice({ price: 50_000, delta: 0, deltaPct: 0, high: 50_000, low: 50_000, volume: 0, direction: null });
    useUnifiedSnapshotStore.getState().setCouncil(realAbstainCouncil()); // insumo presente mas não deveria contar
    const trace = traceStages(useUnifiedSnapshotStore.getState(), 1);
    expect(trace.stages.map((s) => s.ok)).toEqual([true, false, false, false, false]);
    expect(trace.reachedIndex).toBe(0);
  });

  it('COUNCIL null (ainda não rodou) derruba TRADE_PLAN e NEXUS_DECISION mesmo com CORE_ENGINE ok', () => {
    useUnifiedSnapshotStore.getState().setPrice({ price: 50_000, delta: 0, deltaPct: 0, high: 50_000, low: 50_000, volume: 0, direction: null });
    useUnifiedSnapshotStore.getState().setCore({ engineStatus: 'ok', direction: null, confidence: null, lastUpdateAt: Date.now(), cycleLatencyMs: 10 });
    const trace = traceStages(useUnifiedSnapshotStore.getState(), 1);
    expect(trace.stages.map((s) => s.ok)).toEqual([true, true, false, false, false]);
    expect(trace.reachedIndex).toBe(1);
  });

  it('TRADE_PLAN ok mas NEXUS_DECISION ainda null (contrato ainda não montado) fica honesto, nunca inferido', () => {
    useUnifiedSnapshotStore.getState().setPrice({ price: 50_000, delta: 0, deltaPct: 0, high: 50_000, low: 50_000, volume: 0, direction: null });
    useUnifiedSnapshotStore.getState().setCore({ engineStatus: 'ok', direction: null, confidence: null, lastUpdateAt: Date.now(), cycleLatencyMs: 10 });
    useUnifiedSnapshotStore.getState().setCouncil(realAbstainCouncil());
    const trace = traceStages(useUnifiedSnapshotStore.getState(), 1);
    expect(trace.stages.map((s) => s.ok)).toEqual([true, true, true, true, false]);
    expect(trace.reachedIndex).toBe(3);
  });

  it('cadeia inteira ok quando DATA→CORE_ENGINE→COUNCIL→NEXUS_DECISION têm insumo real, mesmo que a decisão real seja ABSTAIN', () => {
    useUnifiedSnapshotStore.getState().setPrice({ price: 50_000, delta: 0, deltaPct: 0, high: 50_000, low: 50_000, volume: 0, direction: null });
    useUnifiedSnapshotStore.getState().setCore({ engineStatus: 'ok', direction: null, confidence: null, lastUpdateAt: Date.now(), cycleLatencyMs: 10 });
    const decision = realAbstainCouncil();
    expect(decision.riskGated).toBe(true); // sanidade: insumos vazios REALMENTE travam por risco
    useUnifiedSnapshotStore.getState().setCouncil(decision);
    useUnifiedSnapshotStore.getState().setNexusDecision(realEmptyNexusDecision());
    const trace = traceStages(useUnifiedSnapshotStore.getState(), 1);
    expect(trace.stages.map((s) => s.ok)).toEqual([true, true, true, true, true]);
    expect(trace.reachedIndex).toBe(4);
    // TRADE_PLAN/NEXUS_DECISION reportaram ok mesmo com a decisão real
    // sendo ABSTAIN — a prova central de que "sem plano" não é conflado
    // com "estágio quebrado". (Prefixo real de todo motivo de bloqueio
    // nas razões acima é "estágio anterior" — ausência dele aqui prova
    // que estes NÃO são motivo de bloqueio, sem depender de uma palavra
    // solta que também aparece na prosa honesta do caso de sucesso.)
    expect(trace.stages[3].reason).not.toMatch(/^estágio anterior/);
    expect(trace.stages[4].reason).not.toMatch(/^estágio anterior/);
  });

  it('nenhuma combinação real produz um ok=true depois de um ok=false (invariante monotônica)', () => {
    const scenarios: Array<() => void> = [
      () => {},
      () => useUnifiedSnapshotStore.getState().setPrice({ price: 1, delta: 0, deltaPct: 0, high: 1, low: 1, volume: 0, direction: null }),
      () => useUnifiedSnapshotStore.getState().setCore({ engineStatus: 'error', direction: null, confidence: null, lastUpdateAt: null, cycleLatencyMs: null }),
      () => useUnifiedSnapshotStore.getState().setCouncil(realAbstainCouncil()),
    ];
    for (const apply of scenarios) {
      useUnifiedSnapshotStore.setState({ price: NO_PRICE, core: PENDING_CORE, council: null });
      apply();
      const oks = traceStages(useUnifiedSnapshotStore.getState(), 1).stages.map((s) => s.ok);
      const firstFalse = oks.indexOf(false);
      if (firstFalse !== -1) {
        expect(oks.slice(firstFalse)).toEqual(oks.slice(firstFalse).map(() => false));
      }
    }
  });
});

describe('traceStages: seq passthrough e forma do STAGE_ORDER', () => {
  it('devolve o mesmo seq recebido, sem inventar um segundo contador', () => {
    expect(traceStages(useUnifiedSnapshotStore.getState(), 42).seq).toBe(42);
  });

  it('STAGE_ORDER e a saída de stages[] estão na mesma ordem causal declarada', () => {
    expect(STAGE_ORDER).toEqual(['DATA', 'CORE_ENGINE', 'COUNCIL', 'TRADE_PLAN', 'NEXUS_DECISION']);
    const trace = traceStages(useUnifiedSnapshotStore.getState(), 1);
    expect(trace.stages.map((s) => s.id)).toEqual([...STAGE_ORDER]);
  });
});

describe('Fiação real no código-fonte: stage-runner.ts nunca recalcula, nunca fala com outro motor (LEI Permanente 5)', () => {
  it('zero import de qualquer motor/engine — só o TIPO do snapshot (import type, apagado na compilação)', () => {
    const s = read('../src/nexus/stage-runner.ts');
    const importLines = s
      .split('\n')
      .filter((line) => /^\s*import[\s{("']/.test(line))
      .filter((line) => !/^\s*\/\//.test(line));
    expect(importLines).toHaveLength(1);
    expect(importLines[0]).toContain('import type { UnifiedSnapshotState } from "../store/unified-snapshot-store"');
  });

  it('traceStages nunca chama buildCouncilDecision/buildTradePlan/runRealAnalysisCycle — read-only puro', () => {
    const s = read('../src/nexus/stage-runner.ts');
    expect(s).not.toMatch(/buildCouncilDecision|buildTradePlan|runRealAnalysisCycle|buildScenarioProjection/);
  });
});
