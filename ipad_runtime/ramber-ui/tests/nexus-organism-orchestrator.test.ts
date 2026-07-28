// nexus-organism-orchestrator.test.ts — Ordem "Próxima Evolução do
// Organismo": prova a SINCRONIZAÇÃO entre os componentes da camada central
// de orquestração (Nexus Core + Typed Event Bus + UnifiedGlobalSnapshot):
//
//   escrita de fatia na store  →  exatamente UM evento tipado no bus,
//   com payload = a MESMA referência escrita (zero cópia, zero tradução);
//   getSnapshotForEngine() = visão versionada/sequenciada do organismo.
//
// Regras da suíte: payloads produzidos pelos MOTORES REAIS (buildCouncilDecision,
// buildScenarioProjection, detectInstitutionalTraps, recordAffectiveEvent) —
// nunca objetos de decisão inventados; e NENHUMA asserção dentro de handler
// do bus (o emit engole exceção de assinante por design — um expect que
// falhasse lá dentro viraria falso-verde): handlers só coletam, asserções
// sempre depois.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TypedEventBus } from '../src/nexus/event-bus';
import {
  OrganismOrchestrator,
  getOrganismOrchestrator,
  getSnapshotForEngine,
  ENGINE_SNAPSHOT_CONTRACT_VERSION,
  __resetOrganismOrchestratorForTests,
} from '../src/nexus/organism-orchestrator';
import { useUnifiedSnapshotStore } from '../src/store/unified-snapshot-store';
import { buildCouncilDecision } from '../src/nexus/council';
import { buildScenarioProjection, type ScenarioLevel } from '../src/nexus/scenario-engine';
import { detectInstitutionalTraps } from '../src/nexus/trap-detection';
import { buildTradePlan } from '../src/nexus/trade-plan';
import { computeSmcZones, type OrderflowSignal } from '../src/engine-bridge';
import { computeConfluenceCorridor } from '../src/nexus/confluence-corridor';
import { buildNexusDecision } from '../src/nexus/decision-layer';
import { computeInstitutionalScore } from '../src/nexus/institutional-score';
import { computeHeatScore } from '../src/nexus/heat-score';
import { gmilOrchestrator } from '../src/gmil/gmil-orchestrator';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

// Decisão 100% real do próprio motor do conselho com insumos honestamente
// vazios — o ABSTAIN fail-closed (riskGated) que o organismo produz de
// verdade no boot, nunca um objeto de decisão fabricado à mão.
const realCouncilDecision = () =>
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

const SCENARIO_LEVELS: ScenarioLevel[] = [
  { price: 50_500, sourceKind: 'SR_RESISTANCE_1' },
  { price: 49_500, sourceKind: 'SR_SUPPORT_1' },
];

let bus: TypedEventBus;
let orch: OrganismOrchestrator | null = null;

beforeEach(() => {
  __resetOrganismOrchestratorForTests();
  // Reset das fatias tocadas por esta suíte VIA AS PRÓPRIAS ACTIONS (nenhum
  // orquestrador vivo aqui — os writes de reset não geram eventos).
  const s = useUnifiedSnapshotStore.getState();
  s.setCouncil(null);
  s.setScenario(null);
  s.setTrapSignals([]);
  s.setTradePlan(null);
  s.setSmc(null);
  s.setCvd(null);
  s.setOrderflowSignals([]);
  s.setConfluenceCorridor(null);
  s.setNexusDecision(null);
  s.setInstitutionalScoreReading(null);
  s.setHeatScoreReading(null);
  s.setGmil(null);
  s.setSymbol('BTC');
  s.setActiveTimeframe('15m');
  s.setOffline(false);
  bus = new TypedEventBus();
});

afterEach(() => {
  orch?.stop();
  orch = null;
});

describe('getSnapshotForEngine(): a visão versionada do organismo para todo motor', () => {
  it('contractVersion=1, takenAt real, e snapshot é a REFERÊNCIA viva do estado da store (zero cópia)', () => {
    const before = Date.now();
    const view = getSnapshotForEngine();
    const after = Date.now();
    expect(view.contractVersion).toBe(1);
    expect(ENGINE_SNAPSHOT_CONTRACT_VERSION).toBe(1);
    expect(view.takenAt).toBeGreaterThanOrEqual(before);
    expect(view.takenAt).toBeLessThanOrEqual(after);
    expect(view.snapshot).toBe(useUnifiedSnapshotStore.getState());
  });

  it('fail-closed só no contador, nunca no conteúdo: sem orquestrador rodando, seq fica em 0 e os DADOS continuam reais', () => {
    const decision = realCouncilDecision();
    useUnifiedSnapshotStore.getState().setCouncil(decision);
    const view = getSnapshotForEngine();
    expect(view.seq).toBe(0); // contador parado (orquestrador off)
    expect(view.snapshot.council).toBe(decision); // leitura real mesmo assim
  });

  it('seq incrementa a cada transição REAL da store com o orquestrador vivo — contador de geração do organismo', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const s0 = getSnapshotForEngine().seq;
    useUnifiedSnapshotStore.getState().setCouncil(realCouncilDecision());
    const s1 = getSnapshotForEngine().seq;
    useUnifiedSnapshotStore.getState().setScenario(
      buildScenarioProjection(50_000, SCENARIO_LEVELS, useUnifiedSnapshotStore.getState().council),
    );
    const s2 = getSnapshotForEngine().seq;
    expect(s1 - s0).toBe(1);
    expect(s2 - s1).toBe(1);
  });

  it('mesmo seq = mesmo estado: duas leituras sem transição entre elas veem exatamente o mesmo snapshot', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    useUnifiedSnapshotStore.getState().setCouncil(realCouncilDecision());
    const v1 = getSnapshotForEngine();
    const v2 = getSnapshotForEngine();
    expect(v1.seq).toBe(v2.seq);
    expect(v1.snapshot).toBe(v2.snapshot);
  });
});

describe('OrganismOrchestrator: escrita na store É a publicação — um write real, um evento tipado', () => {
  it('setCouncil(decisão real) publica BRAIN.COUNCIL.UPDATED com a MESMA referência escrita na store', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.COUNCIL.UPDATED', (p) => received.push(p.decision));
    const decision = realCouncilDecision();
    useUnifiedSnapshotStore.getState().setCouncil(decision);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(decision);
    expect(received[0]).toBe(useUnifiedSnapshotStore.getState().council);
  });

  it('setScenario(projeção real do motor) publica BRAIN.SCENARIO.UPDATED com a mesma referência', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.SCENARIO.UPDATED', (p) => received.push(p.projection));
    const projection = buildScenarioProjection(50_000, SCENARIO_LEVELS, realCouncilDecision());
    expect(projection).not.toBeNull(); // sanidade: o motor real produziu projeção
    useUnifiedSnapshotStore.getState().setScenario(projection);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(projection);
  });

  it('setTrapSignals(saída real do detector) publica BRAIN.TRAPS.UPDATED com a mesma referência', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.TRAPS.UPDATED', (p) => received.push(p.traps));
    const traps = detectInstitutionalTraps({
      liquidityZones: [{ type: 'EQUAL_HIGH', price: 51_000, index: 10, swept: true }],
      orderflowSignals: [],
      now: Date.now(),
    });
    useUnifiedSnapshotStore.getState().setTrapSignals(traps);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(traps);
  });

  it('setTradePlan (real engine output) publishes BRAIN.TRADE_PLAN.UPDATED with the same reference', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.TRADE_PLAN.UPDATED', (p) => received.push(p.plan));
    const plan = buildTradePlan({
      stance: 'LONG',
      riskGated: false,
      price: 50_000,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
      levels: [
        { price: 48_800, kind: 'SR_SUPPORT_1' },
        { price: 51_000, kind: 'SR_RESISTANCE_1' },
      ],
    });
    expect(plan).not.toBeNull(); // sanity: the real engine produced a plan
    useUnifiedSnapshotStore.getState().setTradePlan(plan);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(plan);
  });

  it('null explícito (fail-closed na troca de ativo) é transição REAL e publicada — assinante sabe que o dado se foi', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.COUNCIL.UPDATED', (p) => received.push(p.decision));
    const decision = realCouncilDecision();
    useUnifiedSnapshotStore.getState().setCouncil(decision);
    useUnifiedSnapshotStore.getState().setCouncil(null);
    expect(received).toEqual([decision, null]);
  });

  it('recordAffectiveEvent real = UMA transição atômica (memória+cpi juntos) = UM evento ORGANISM.AFFECT.UPDATED', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: Array<{ cpi: number | null; memory: unknown }> = [];
    bus.on('ORGANISM.AFFECT.UPDATED', (p) => received.push(p));
    const seqBefore = getSnapshotForEngine().seq;
    useUnifiedSnapshotStore.getState().recordAffectiveEvent('ENGINE_CYCLE_OK');
    const seqAfter = getSnapshotForEngine().seq;
    expect(received).toHaveLength(1);
    expect(seqAfter - seqBefore).toBe(1); // memória+cpi no MESMO write — uma geração
    const state = useUnifiedSnapshotStore.getState();
    expect(received[0].memory).toBe(state.affectiveMemory);
    expect(received[0].cpi).toBe(state.cpi);
    expect(received[0].cpi).toBe(1); // reward puro sem pain: CPI real = 1
  });

  it('o orquestrador é o publicador REAL dos eventos de UI/offline declarados na Fase 0', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const log: string[] = [];
    bus.on('UI.SYMBOL_CHANGED', (p) => log.push(`symbol:${p.symbol}`));
    bus.on('UI.TIMEFRAME_CHANGED', (p) => log.push(`tf:${p.tf}`));
    bus.on('OFFLINE.CHANGED', (p) => log.push(`offline:${p.offline}`));
    const s = useUnifiedSnapshotStore.getState();
    s.setSymbol('ETH');
    s.setActiveTimeframe('1h');
    s.setOffline(true);
    expect(log).toEqual(['symbol:ETH', 'tf:1h', 'offline:true']);
  });

  it('escrita com o MESMO valor/referência nunca vira evento nem geração — zero notificações espúrias', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const log: string[] = [];
    bus.on('BRAIN.TRAPS.UPDATED', () => log.push('traps'));
    bus.on('UI.SYMBOL_CHANGED', () => log.push('symbol'));
    const seqBefore = getSnapshotForEngine().seq;
    const sameTraps = useUnifiedSnapshotStore.getState().trapSignals;
    useUnifiedSnapshotStore.getState().setTrapSignals(sameTraps); // mesma referência
    useUnifiedSnapshotStore.getState().setSymbol('BTC'); // mesmo valor já vigente
    expect(log).toEqual([]);
    expect(getSnapshotForEngine().seq - seqBefore).toBe(0);
  });

  it('um write de UMA fatia gera exatamente UM evento — as outras fatias ficam mudas', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const log: string[] = [];
    bus.on('BRAIN.COUNCIL.UPDATED', () => log.push('council'));
    bus.on('BRAIN.SCENARIO.UPDATED', () => log.push('scenario'));
    bus.on('QUANT.VOLUME_PROFILE.UPDATED', () => log.push('vp'));
    useUnifiedSnapshotStore.getState().setCouncil(realCouncilDecision());
    expect(log).toEqual(['council']);
  });

  it('o bus preserva a causalidade das escritas: eventos chegam na ordem exata dos writes', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const log: string[] = [];
    bus.on('BRAIN.COUNCIL.UPDATED', () => log.push('council'));
    bus.on('BRAIN.SCENARIO.UPDATED', () => log.push('scenario'));
    const decision = realCouncilDecision();
    useUnifiedSnapshotStore.getState().setCouncil(decision);
    useUnifiedSnapshotStore.getState().setScenario(buildScenarioProjection(50_000, SCENARIO_LEVELS, decision));
    expect(log).toEqual(['council', 'scenario']);
  });

  it('HEALTH.CHANGED nunca ganha um segundo emissor: escrever health na store NÃO publica pelo orquestrador', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const log: string[] = [];
    bus.on('HEALTH.CHANGED', () => log.push('health'));
    const seqBefore = getSnapshotForEngine().seq;
    useUnifiedSnapshotStore.getState().setHealth({
      fps: 60, cycleLatencyMs: 10, memoryMb: null, workersAlive: 1, isOnline: true, lastUpdatedAt: Date.now(),
    });
    expect(log).toEqual([]); // publicador único continua o Health Monitor
    expect(getSnapshotForEngine().seq - seqBefore).toBe(1); // mas a geração conta
  });

  it('start() é idempotente (StrictMode-safe): duas chamadas nunca duplicam a assinatura nem os eventos', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.COUNCIL.UPDATED', (p) => received.push(p.decision));
    useUnifiedSnapshotStore.getState().setCouncil(realCouncilDecision());
    expect(received).toHaveLength(1);
  });

  it('stop() encerra a publicação limpa; a LEITURA via gateway segue real; start() de novo retoma', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.COUNCIL.UPDATED', (p) => received.push(p.decision));
    orch.stop();
    const decision = realCouncilDecision();
    useUnifiedSnapshotStore.getState().setCouncil(decision);
    expect(received).toHaveLength(0); // publicação parada
    expect(getSnapshotForEngine().snapshot.council).toBe(decision); // leitura nunca para
    orch.start();
    useUnifiedSnapshotStore.getState().setCouncil(null);
    expect(received).toEqual([null]); // retomou
  });

  it('getOrganismOrchestrator: um único orquestrador real por página (mesmo padrão getNexusCore/getHealthMonitor)', () => {
    const a = getOrganismOrchestrator(bus);
    const b = getOrganismOrchestrator(new TypedEventBus());
    expect(a).toBe(b);
  });
});

describe('OMEGA CORE V-MAX (Fase 1.1): smc/cvd/orderflowSignals — insumos pré-store migrados, mesmo padrão QUANT.*', () => {
  it('setSmc(saída real de computeSmcZones) publica QUANT.SMC.UPDATED com a MESMA referência escrita na store', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('QUANT.SMC.UPDATED', (p) => received.push(p.zones));
    const zones = computeSmcZones([]); // motor real; amostra vazia = zonas vazias honestas, não fabricado
    useUnifiedSnapshotStore.getState().setSmc(zones);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(zones);
    expect(received[0]).toBe(useUnifiedSnapshotStore.getState().smc);
  });

  it('setCvd(valor real) publica QUANT.CVD.UPDATED; null explícito (troca de ativo) também é transição publicada', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: Array<number | null> = [];
    bus.on('QUANT.CVD.UPDATED', (p) => received.push(p.cvd));
    useUnifiedSnapshotStore.getState().setCvd(125.5);
    useUnifiedSnapshotStore.getState().setCvd(null);
    expect(received).toEqual([125.5, null]);
  });

  it('setOrderflowSignals(sinal real OFI/Absorção/Exaustão) publica QUANT.ORDERFLOW_SIGNALS.UPDATED com a mesma referência', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('QUANT.ORDERFLOW_SIGNALS.UPDATED', (p) => received.push(p.signals));
    const signals: OrderflowSignal[] = [
      { type: 'ABSORPTION', confidence: 0.8, price: 50_000, timestamp: Date.now(), metadata: {} },
    ];
    useUnifiedSnapshotStore.getState().setOrderflowSignals(signals);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(signals);
  });

  it('setConfluenceCorridor(saída real de computeConfluenceCorridor) publica QUANT.CONFLUENCE_CORRIDOR.UPDATED com a MESMA referência', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('QUANT.CONFLUENCE_CORRIDOR.UPDATED', (p) => received.push(p.reading));
    const reading = computeConfluenceCorridor({
      direction: 'LONG',
      conviction: {
        status: 'OK',
        reason: null,
        coreDirection: 'LONG',
        conviction: 0.75,
        convictionAdjusted: null,
        verdict: 'CONFIRMS',
        agreeingCount: 1,
        totalReadable: 1,
        members: [],
        computedAt: Date.now(),
      },
      activeObstacleCount: 0,
    });
    expect(reading.status).toBe('OK'); // sanidade: o motor real produziu uma leitura
    useUnifiedSnapshotStore.getState().setConfluenceCorridor(reading);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(reading);
    expect(received[0]).toBe(useUnifiedSnapshotStore.getState().confluenceCorridor);
  });
});

describe('EPC OMEGA FINAL Parte 1 ("Meta Engine"): nexusDecision/institutionalScoreReading/heatScoreReading ganham fatia própria', () => {
  it('setNexusDecision(saída real de buildNexusDecision) publica BRAIN.NEXUS_DECISION.UPDATED com a MESMA referência', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.NEXUS_DECISION.UPDATED', (p) => received.push(p.decision));
    const decision = buildNexusDecision({
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
    expect(decision.operation).toBe('AGUARDAR'); // sanidade: passthrough honesto sem direção real do Core Engine
    useUnifiedSnapshotStore.getState().setNexusDecision(decision);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(decision);
    expect(received[0]).toBe(useUnifiedSnapshotStore.getState().nexusDecision);
  });

  it('setInstitutionalScoreReading(saída real de computeInstitutionalScore) publica BRAIN.INSTITUTIONAL_SCORE.UPDATED com a mesma referência', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.INSTITUTIONAL_SCORE.UPDATED', (p) => received.push(p.reading));
    const reading = computeInstitutionalScore({ engineStatus: 'pending', coreDirection: null, conviction: null, riskGated: false });
    useUnifiedSnapshotStore.getState().setInstitutionalScoreReading(reading);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(reading);
  });

  it('setHeatScoreReading(saída real de computeHeatScore) publica BRAIN.HEAT_SCORE.UPDATED com a mesma referência', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.HEAT_SCORE.UPDATED', (p) => received.push(p.reading));
    const reading = computeHeatScore({ bandwidthPercentile: null, deltaPct: null, recentLiquidationCount: null });
    expect(reading.status).toBe('DADOS_INSUFICIENTES'); // sanidade: fail-closed honesto sem componentes reais
    useUnifiedSnapshotStore.getState().setHeatScoreReading(reading);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(reading);
  });

  it('setGmil(snapshot real do gmilOrchestrator) publica BRAIN.GMIL.UPDATED com a mesma referência — já alimentava a UI, agora ganha fatia no organismo', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    const received: unknown[] = [];
    bus.on('BRAIN.GMIL.UPDATED', (p) => received.push(p.snapshot));
    const snapshot = gmilOrchestrator.getSnapshot();
    useUnifiedSnapshotStore.getState().setGmil(snapshot);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(snapshot);
    expect(received[0]).toBe(useUnifiedSnapshotStore.getState().gmil);
  });
});

describe('Sincronização fim-a-fim (a prova da Ordem): conselho ESCREVE → bus NOTIFICA → cenário RELÊ do snapshot', () => {
  it('a cadeia inteira flui pela camada central — nenhum motor toca no outro, e evento/snapshot são o MESMO dado', () => {
    orch = new OrganismOrchestrator(bus);
    orch.start();
    // Handlers só coletam (asserções depois): o consumidor central faz o
    // papel do efeito de cenário do App — relê o conselho do snapshot via
    // gateway, nunca recebe a decisão "em mãos" do conselho.
    const seen: Array<{ ev: string; sameAsStore: boolean }> = [];
    bus.on('BRAIN.COUNCIL.UPDATED', ({ decision }) => {
      const view = getSnapshotForEngine();
      seen.push({ ev: 'council', sameAsStore: decision === view.snapshot.council });
      useUnifiedSnapshotStore.getState().setScenario(
        buildScenarioProjection(50_000, SCENARIO_LEVELS, view.snapshot.council),
      );
    });
    bus.on('BRAIN.SCENARIO.UPDATED', ({ projection }) => {
      seen.push({ ev: 'scenario', sameAsStore: projection === useUnifiedSnapshotStore.getState().scenario });
    });
    useUnifiedSnapshotStore.getState().setCouncil(realCouncilDecision());
    expect(seen).toEqual([
      { ev: 'council', sameAsStore: true },
      { ev: 'scenario', sameAsStore: true },
    ]);
    expect(getSnapshotForEngine().snapshot.scenario).not.toBeNull();
  });
});

describe('Fiação real no código-fonte: App e Health Monitor obedecem a camada central (trava de regressão)', () => {
  it('App.tsx: o Motor de Cenários lê o conselho da STORE (useCouncilSnapshot) — o handoff direto da variável `decision` não existe mais', () => {
    const s = read('../src/App.tsx');
    expect(s).toContain('buildScenarioProjection(priceFromSnapshot.price, levels, councilFromSnapshot)');
    expect(s).not.toMatch(/buildScenarioProjection\(price, levels, decision\)/);
  });

  it('App.tsx: o boot liga o OrganismOrchestrator no bus do Nexus Core (e desliga na desmontagem)', () => {
    const s = read('../src/App.tsx');
    expect(s).toContain('getOrganismOrchestrator(core.bus)');
    expect(s).toContain('orchestrator.start()');
    expect(s).toContain('orchestrator.stop()');
  });

  it('health-monitor.ts: a leitura do organismo passa pelo gateway versionado (getSnapshotForEngine)', () => {
    const s = read('../src/nexus/health-monitor.ts');
    expect(s).toContain('getSnapshotForEngine()');
  });

  it('App.tsx: smcZones/cvd/orderflowSignals são espelhados na store (OMEGA CORE V-MAX Fase 1.1) — mesmo commit, zero segunda computação', () => {
    const s = read('../src/App.tsx');
    expect(s).toContain('useUnifiedSnapshotStore.getState().setSmc(smcZones);');
    expect(s).toContain('useUnifiedSnapshotStore.getState().setCvd(value);');
    expect(s).toContain('useUnifiedSnapshotStore.getState().setOrderflowSignals(orderflowSignals);');
    // Os dois espelhos por useEffect reagem à MESMA fatia que mirroram —
    // nunca escritos dentro de um updater funcional (StrictMode roda um
    // updater funcional 2x; um efeito colateral ali dentro duplicaria o
    // evento no bus, ver comentário real ao lado da declaração).
    expect(s).toContain('}, [smcZones]);');
    expect(s).toContain('}, [orderflowSignals]);');
  });

  it('App.tsx: Corredor de Confluência (OMEGA CORE V-MAX Fase 5) cruza só sinais JÁ reais/já computados, nunca recalcula direção/plano', () => {
    const s = read('../src/App.tsx');
    const idx = s.indexOf('const confluenceCorridor = useMemo(');
    expect(idx, 'computação do Corredor de Confluência não encontrada').toBeGreaterThan(-1);
    const block = s.slice(idx, s.indexOf('useEffect(() => {\n    useUnifiedSnapshotStore.getState().setConfluenceCorridor(confluenceCorridor);\n  }, [confluenceCorridor]);', idx) + 200);
    expect(block).toContain('direction: engine?.direction ?? null,');
    expect(block).toContain('conviction: convictionReading,');
    expect(block).toContain('activeObstacleCount: trackedPlan?.targets?.[0]?.obstacleCount ?? null,');
    expect(block).toContain('useUnifiedSnapshotStore.getState().setConfluenceCorridor(confluenceCorridor);');
  });

  it('App.tsx: EPC OMEGA FINAL Parte 1 — nexusDecision/institutionalScore/heatReading são espelhados na store (mesmo padrão de confluenceCorridor)', () => {
    const s = read('../src/App.tsx');
    expect(s).toContain('useUnifiedSnapshotStore.getState().setNexusDecision(nexusDecision);');
    expect(s).toContain('useUnifiedSnapshotStore.getState().setInstitutionalScoreReading(institutionalScore);');
    expect(s).toContain('useUnifiedSnapshotStore.getState().setHeatScoreReading(heatReading);');
    expect(s).toContain('}, [nexusDecision]);');
    expect(s).toContain('}, [heatReading]);');
  });

  it('App.tsx: Diretriz Final de Integração Total — o MESMO snapshot do GMIL já usado pelos widgets é espelhado na store (zero segunda assinatura de useGmilSnapshot)', () => {
    const s = read('../src/App.tsx');
    expect(s).toContain('const gmilSnapshot = useGmilSnapshot();');
    expect(s).toContain('useUnifiedSnapshotStore.getState().setGmil(gmilSnapshot);');
    expect(s).toContain('}, [gmilSnapshot]);');
    // Nunca uma segunda CHAMADA real ao hook (comentários que citam
    // "useGmilSnapshot()" em prosa não contam — só atribuições reais).
    expect(s.match(/= useGmilSnapshot\(\)/g)?.length).toBe(1);
  });
});
