// microstructure-snapshot.test.ts — Ordem A2.1 (MICROSTRUCTURE EVENT
// ENGINE), escopo "consolidar sob 1 contrato tipado". Mesma convenção
// mista de sempre: a matemática real (quality/absorptionState/event
// intensity/depth evidence) ganha teste de EXECUÇÃO REAL; a fiação com
// App.tsx/a store ganha teste de PADRÃO no código-fonte.
//
// §27/§28 da Ordem A2.1 (testes unitários + testes semânticos) cobertos
// abaixo, adaptados ao que este projeto realmente calcula (ver header de
// microstructure-snapshot.ts para os 2 gaps reais de dado — sem livro
// incremental com sequence ID, sem Evidence Graph/Five Pillars ainda).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  composeDepthEvidence,
  classifyAbsorptionState,
  composeTradeFlowEvidence,
  computeEventIntensity,
  composeMicrostructureSnapshot,
  DEPTH_STALE_THRESHOLD_MS,
  EVENT_INTENSITY_WINDOW_MS,
  EVENT_INTENSITY_MEDIUM_MIN,
  EVENT_INTENSITY_HIGH_MIN,
  type MicrostructureSnapshotInputs,
} from '../src/nexus/microstructure-snapshot';
import type { OrderflowSignal } from '../src/engine-bridge';
import type { TrapSignal } from '../src/nexus/trap-detection';
import type { L2Snapshot } from '../src/nexus/types';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const ofi = (overrides: Partial<OrderflowSignal> = {}): OrderflowSignal => ({
  type: 'OFI',
  confidence: 0.8,
  price: 100,
  timestamp: Date.now(),
  metadata: {},
  ...overrides,
});

const absorption = (overrides: Partial<OrderflowSignal> = {}): OrderflowSignal => ({
  type: 'ABSORPTION',
  confidence: 0.75,
  price: 100,
  timestamp: Date.now(),
  metadata: {},
  ...overrides,
});

const trap = (overrides: Partial<TrapSignal> = {}): TrapSignal => ({
  contractVersion: 3,
  kind: 'STOP_HUNT_TOPO',
  confidence: 0.66,
  evidence: ['sweep real'],
  at: Date.now(),
  sweptLevels: [],
  ...overrides,
});

const book = (overrides: Partial<L2Snapshot> = {}): L2Snapshot => ({
  bids: [{ price: 99, size: 10 }],
  asks: [{ price: 101, size: 10 }],
  updatedAt: Date.now(),
  ...overrides,
});

describe('composeDepthEvidence: passthrough real de order-book-depth.ts, qualidade por idade real do book', () => {
  it('book null/undefined: null honesto, nunca fabricado', () => {
    expect(composeDepthEvidence(null, Date.now())).toBeNull();
    expect(composeDepthEvidence(undefined, Date.now())).toBeNull();
  });

  it('book com os 2 lados vazios: null (nada real pra medir)', () => {
    expect(composeDepthEvidence({ bids: [], asks: [], updatedAt: Date.now() }, Date.now())).toBeNull();
  });

  it('book fresco (idade <= DEPTH_STALE_THRESHOLD_MS): quality VALID, imbalance/bidAskRatio/walls reais', () => {
    const now = 10_000;
    const b = book({ bids: [{ price: 99, size: 30 }], asks: [{ price: 101, size: 10 }], updatedAt: now - 500 });
    const ev = composeDepthEvidence(b, now)!;
    expect(ev.quality).toBe('VALID');
    expect(ev.imbalance).toBeCloseTo((30 - 10) / 40, 5);
    expect(ev.bidAskRatio).toBeCloseTo(3, 5);
  });

  it('book velho (idade > DEPTH_STALE_THRESHOLD_MS): quality STALE — nunca escondido, nunca tratado como VALID', () => {
    const now = 100_000;
    const b = book({ updatedAt: now - (DEPTH_STALE_THRESHOLD_MS + 1) });
    expect(composeDepthEvidence(b, now)!.quality).toBe('STALE');
  });

  it('fronteira exata: idade === DEPTH_STALE_THRESHOLD_MS ainda VALID (só ultrapassar vira STALE)', () => {
    const now = 100_000;
    const b = book({ updatedAt: now - DEPTH_STALE_THRESHOLD_MS });
    expect(composeDepthEvidence(b, now)!.quality).toBe('VALID');
  });

  it('updatedAt não-finito: quality VALID cai para não-STALE só por fail-closed do próprio cálculo de idade (Infinity nunca finge fresco)', () => {
    const b = book({ updatedAt: NaN as unknown as number });
    const ev = composeDepthEvidence(b, Date.now())!;
    expect(ev.updatedAt).toBeNull();
    expect(ev.quality).toBe('STALE'); // idade = Infinity > threshold — nunca VALID por acidente
  });
});

describe('classifyAbsorptionState: Ordem A2.1 §7 (OBSERVED vs CONFIRMED) sobre os motores reais já existentes, zero recálculo', () => {
  it('nenhum sinal real de absorção: NONE', () => {
    expect(classifyAbsorptionState([], [])).toBe('NONE');
    expect(classifyAbsorptionState([ofi()], [])).toBe('NONE');
  });

  it('sinal cru de ABSORPTION (signal-engine.js) sem corroboração: ABSORPTION_OBSERVED', () => {
    expect(classifyAbsorptionState([absorption()], [])).toBe('ABSORPTION_OBSERVED');
  });

  it('trap-detection.ts já corroborou (ABSORCAO_ANOMALA): ABSORPTION_CONFIRMED — mesma barra do motor real, nunca uma segunda', () => {
    expect(classifyAbsorptionState([absorption()], [trap({ kind: 'ABSORCAO_ANOMALA' })])).toBe('ABSORPTION_CONFIRMED');
  });

  it('CONFIRMED vence mesmo sem o sinal cru correspondente na mesma amostra (trap-detection já fez a corroboração)', () => {
    expect(classifyAbsorptionState([], [trap({ kind: 'ABSORCAO_ANOMALA' })])).toBe('ABSORPTION_CONFIRMED');
  });

  it('§28 semântico: ABSORPTION != AUTOMATIC REVERSAL — o tipo devolvido nunca é um veredito de direção/reversão', () => {
    const state = classifyAbsorptionState([absorption()], []);
    expect(['NONE', 'ABSORPTION_OBSERVED', 'ABSORPTION_CONFIRMED']).toContain(state);
    expect(state).not.toMatch(/LONG|SHORT|REVERSAL|BULLISH|BEARISH/i);
  });
});

describe('composeTradeFlowEvidence: CVD/OFI/Absorption/Exhaustion — passthrough real de signal-engine.js', () => {
  it('nem cvd nem sinais: null honesto (nunca 0/estado fabricado)', () => {
    expect(composeTradeFlowEvidence([], [], null)).toBeNull();
  });

  it('só cvd (ainda sem Signal discreto emitido): PARTIAL — estado real de "poucos ticks até agora"', () => {
    const ev = composeTradeFlowEvidence([], [], 42)!;
    expect(ev.quality).toBe('PARTIAL');
    expect(ev.cvd).toBe(42);
  });

  it('com sinais reais: VALID, contagens corretas por tipo, latestOfi real', () => {
    const signals = [ofi({ price: 105 }), absorption(), absorption()];
    const ev = composeTradeFlowEvidence(signals, [], 10)!;
    expect(ev.quality).toBe('VALID');
    expect(ev.ofiCount).toBe(1);
    expect(ev.absorptionCount).toBe(2);
    expect(ev.exhaustionCount).toBe(0);
    expect(ev.latestOfi?.price).toBe(105);
  });

  it('§28 semântico: CVD != INDEPENDENT SOURCE — o campo é um passthrough do MESMO signal-engine.js, nunca uma segunda fonte/motor', () => {
    const src = read('../src/nexus/microstructure-snapshot.ts');
    expect(src).not.toMatch(/function\s+computeCvd|function\s+calculateCvd/i);
  });
});

describe('computeEventIntensity: Ordem A2.1 §9 — "intensidade != direção", contagem real numa janela real', () => {
  it('zero eventos: LOW', () => {
    expect(computeEventIntensity([], [], 100_000).level).toBe('LOW');
  });

  it('eventos fora da janela (mais velhos que windowMs) não contam', () => {
    const now = 1_000_000;
    const old = [ofi({ timestamp: now - EVENT_INTENSITY_WINDOW_MS - 1 })];
    expect(computeEventIntensity(old, [], now).eventCount).toBe(0);
  });

  it('fronteira MEDIUM/HIGH real', () => {
    const now = 1_000_000;
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ofi({ timestamp: now - i }));
    expect(computeEventIntensity(mk(EVENT_INTENSITY_MEDIUM_MIN - 1), [], now).level).toBe('LOW');
    expect(computeEventIntensity(mk(EVENT_INTENSITY_MEDIUM_MIN), [], now).level).toBe('MEDIUM');
    expect(computeEventIntensity(mk(EVENT_INTENSITY_HIGH_MIN - 1), [], now).level).toBe('MEDIUM');
    expect(computeEventIntensity(mk(EVENT_INTENSITY_HIGH_MIN), [], now).level).toBe('HIGH');
  });

  it('conta orderflowSignals + trapSignals juntos (os dois são "eventos" reais)', () => {
    const now = 1_000_000;
    const reading = computeEventIntensity([ofi({ timestamp: now }), ofi({ timestamp: now })], [trap({ at: now })], now);
    expect(reading.eventCount).toBe(3);
  });

  it('§28 semântico: EventIntensityReading nunca carrega direção/sinal — só nível+contagem+janela', () => {
    const reading = computeEventIntensity([ofi()], [], Date.now());
    expect(Object.keys(reading).sort()).toEqual(['eventCount', 'level', 'windowMs']);
  });
});

describe('composeMicrostructureSnapshot: integração real, qualidade agregada, multi-venue isolado (Ordem A2.1 §16)', () => {
  const baseInputs = (overrides: Partial<MicrostructureSnapshotInputs> = {}): MicrostructureSnapshotInputs => ({
    orderflowSignals: [],
    trapSignals: [],
    cvd: null,
    orderBooks: {},
    now: 500_000,
    ...overrides,
  });

  it('nada real disponível: INSUFFICIENT_DATA honesto, nunca um snapshot fabricado', () => {
    const snap = composeMicrostructureSnapshot(baseInputs());
    expect(snap.quality).toBe('INSUFFICIENT_DATA');
    expect(snap.tradeFlow).toBeNull();
    expect(Object.keys(snap.depth)).toHaveLength(0);
  });

  it('qualidade agregada = a PIOR entre as fontes reais presentes (trade flow PARTIAL + depth VALID => PARTIAL)', () => {
    const snap = composeMicrostructureSnapshot(
      baseInputs({ cvd: 5, orderBooks: { BINANCE: book({ updatedAt: 500_000 - 100 }) } }),
    );
    expect(snap.tradeFlow?.quality).toBe('PARTIAL');
    expect(snap.depth.BINANCE?.quality).toBe('VALID');
    expect(snap.quality).toBe('PARTIAL');
  });

  it('§16 multi-venue: books de exchanges diferentes ficam em chaves separadas, nunca somados/misturados', () => {
    // Assimétricos de propósito (imbalance diferente em cada lado) — se o
    // agrupamento por exchange vazasse, o imbalance de um contaminaria o
    // outro e os dois números abaixo deixariam de bater.
    const binanceBook = book({ bids: [{ price: 100, size: 30 }], asks: [{ price: 101, size: 10 }] });
    const mexcBook = book({ bids: [{ price: 200, size: 10 }], asks: [{ price: 201, size: 30 }] });
    const snap = composeMicrostructureSnapshot(baseInputs({ orderBooks: { BINANCE: binanceBook, MEXC: mexcBook } }));
    expect(snap.depth.BINANCE?.imbalance).toBeCloseTo((30 - 10) / 40, 5);
    expect(snap.depth.MEXC?.imbalance).toBeCloseTo((10 - 30) / 40, 5); // sinal invertido — nunca contaminado pelo book da Binance
    expect(snap.depth.BINANCE?.imbalance).not.toBeCloseTo(snap.depth.MEXC?.imbalance ?? NaN, 5);
  });

  it('sweep é o MESMO array real de trapSignals (cópia, não recálculo)', () => {
    const t = [trap()];
    const snap = composeMicrostructureSnapshot(baseInputs({ trapSignals: t }));
    expect(snap.sweep).toEqual(t);
    expect(snap.sweep).not.toBe(t); // cópia real, não a mesma referência (ver comentário no source: exigência do Draft<T> do Immer)
  });

  it('determinístico: mesma entrada, mesma saída (exceto computedAt, que reflete `now` explícito e também é determinístico)', () => {
    const inputs = baseInputs({ cvd: 10, orderflowSignals: [ofi()], trapSignals: [trap()] });
    expect(composeMicrostructureSnapshot(inputs)).toEqual(composeMicrostructureSnapshot(inputs));
  });

  it('§28 semântico: MICROSTRUCTURE != DECISION / EVIDENCE != ENTRY — nenhum campo do Snapshot é LONG/SHORT/ENTRY/TARGET/STOP', () => {
    const snap = composeMicrostructureSnapshot(
      baseInputs({ cvd: 10, orderflowSignals: [ofi(), absorption()], trapSignals: [trap()], orderBooks: { BINANCE: book() } }),
    );
    const serialized = JSON.stringify(snap);
    expect(serialized).not.toMatch(/"direction"\s*:\s*"(LONG|SHORT)"/);
    expect(serialized).not.toMatch(/"entry"|"target"|"stop"/i);
  });
});

describe('microstructure-snapshot.ts: fiação/LEI 24 — padrão no código-fonte (o bug mais provável aqui é "vazou uma segunda decisão", não a aritmética)', () => {
  const src = () => read('../src/nexus/microstructure-snapshot.ts');

  it('nunca importa nem referencia Decision Core/Trade Plan/Risk Engine — evidência pura, nunca uma segunda autoridade (Ordem A2.1 §1/§20)', () => {
    const s = src();
    expect(s).not.toMatch(/from ["']\.\/trade-plan["']/);
    expect(s).not.toMatch(/from ["']\.\/risk/i);
    expect(s).not.toContain('engine.direction');
  });

  it('zero segunda matemática real: CVD/OFI/Absorption/Exhaustion/imbalance/walls vêm só de import, nunca redefinidos aqui', () => {
    const s = src();
    expect(s).toContain('import { computeBidAskRatio, computeImbalance, detectWalls');
    expect(s).not.toMatch(/function\s+detectWalls|function\s+computeImbalance|function\s+computeBidAskRatio/);
  });

  it('os 2 gaps reais (sem sequence ID / sem Evidence Graph-Five Pillars) estão documentados no header, não escondidos', () => {
    const s = src();
    expect(s).toMatch(/GAP 1/);
    expect(s).toMatch(/GAP 2/);
  });

  it('o union real de qualidade nunca declara INVALID_SEQUENCE/RECONCILIATION_REQUIRED como possíveis — só prosa do header explica por quê (GAP 1), a declaração de tipo em si fica menor e honesta', () => {
    const s = src();
    const typeLine = s.slice(s.indexOf('export type MicrostructureDataQuality'), s.indexOf('export type MicrostructureDataQuality') + 120);
    expect(typeLine).not.toContain('INVALID_SEQUENCE');
    expect(typeLine).not.toContain('RECONCILIATION_REQUIRED');
    expect(typeLine).toContain('"VALID"');
    expect(typeLine).toContain('"INSUFFICIENT_DATA"');
  });
});

describe('unified-snapshot-store.ts: microstructureSnapshot nas 4 posições reais (state → actions → defaults → seletor), mesmo padrão de cvd/riskSuggestion', () => {
  const store = () => read('../src/store/unified-snapshot-store.ts');

  it('1) interface de estado', () => {
    expect(store()).toContain('microstructureSnapshot: MicrostructureSnapshot | null;');
  });

  it('2) action (assinatura + implementação real via Immer)', () => {
    const s = store();
    expect(s).toContain('setMicrostructureSnapshot: (snapshot: MicrostructureSnapshot | null) => void;');
    expect(s).toContain('setMicrostructureSnapshot: (snapshot) => set((s) => { s.microstructureSnapshot = snapshot; }),');
  });

  it('3) default real', () => {
    expect(store()).toContain('microstructureSnapshot: null,');
  });

  it('4) seletor real', () => {
    const s = store();
    expect(s).toContain('export const useMicrostructureSnapshot = (): MicrostructureSnapshot | null =>');
    expect(s).toContain('useUnifiedSnapshotStore((s) => s.microstructureSnapshot);');
  });
});

describe('App.tsx: wiring reativo real — zero segunda chamada de detectInstitutionalTraps, zero segunda leitura de book', () => {
  const app = () => read('../src/App.tsx');

  it('trapSignals extraído em useMemo (mesmo resultado reusado por setTrapSignals E pelo Microstructure Snapshot)', () => {
    const a = app();
    expect(a).toContain('const trapSignals = useMemo(');
    expect(a).toContain('useUnifiedSnapshotStore.getState().setTrapSignals(trapSignals);');
  });

  it('exchangeOrderBooks lido via useExchangeOrderBooks() — mesmo book real que OrderBookWidget já usa, zero segunda assinatura', () => {
    expect(app()).toContain('const exchangeOrderBooks = useExchangeOrderBooks();');
  });

  it('efeito real chama composeMicrostructureSnapshot com os 4 inputs reais e persiste via setMicrostructureSnapshot', () => {
    const a = app();
    const idx = a.indexOf('composeMicrostructureSnapshot({');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(Math.max(0, idx - 200), idx + 300);
    expect(block).toContain('setMicrostructureSnapshot(');
    expect(block).toContain('orderflowSignals,');
    expect(block).toContain('trapSignals,');
    expect(block).toContain('cvd,');
    expect(block).toContain('orderBooks: exchangeOrderBooks,');
  });
});
