// signal-engine.test.ts — permanent regression suite for the real Order
// Flow Engine (OFI/Absorption/Exhaustion, src/orderflow/signal-engine.js)
// that feeds the Council's OrderflowAgent, trap-detection.ts's stop-hunt
// corroboration, and the operator-visible "MEXC ORDERFLOW" signal feed.
//
// Ordem EPC-05 ("Lapidação de Elite"): audited this engine against real
// microstructure literature (Cont/Kukanov/Stoikov 2014 — see the honesty
// note added to signal-engine.js's own header) and found it had ZERO
// direct execution tests despite being live, decision-adjacent code —
// the exact class of gap this Ordem's own test ("isso aumenta a confiança
// da decisão?") exists to catch. Same "execução real" convention as
// lorentzian-classifier.test.ts: processSignals() is a pure function over
// ticks/state/settings, so it gets real-execution tests, not just a
// source-pattern check.
//
// Timing-sensitive assertions (OFI cooldown, Absorption's real time
// window) use vi.useFakeTimers()/vi.setSystemTime() — same convention as
// nexus-health-monitor.test.ts — never real sleeps.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEngineState, processSignals, defaultSettings } from '../../src/orderflow/signal-engine.js';
import { Side, SignalType, Tick } from '../../src/orderflow/value-objects.js';

function tick(timestamp: number, price: number, volume: number, side: 'BUY' | 'SELL'): Tick {
  return new Tick({ timestamp, price, volume, side: side === 'BUY' ? Side.BUY : Side.SELL });
}

describe('signal-engine: defaultSettings', () => {
  it('is deeply frozen — value objects immutable by construction, same discipline as Tick/Signal', () => {
    expect(Object.isFrozen(defaultSettings)).toBe(true);
    expect(Object.isFrozen(defaultSettings.ofi)).toBe(true);
    expect(Object.isFrozen(defaultSettings.absorption)).toBe(true);
    expect(Object.isFrozen(defaultSettings.exhaustion)).toBe(true);
  });
});

describe('signal-engine: createEngineState', () => {
  it('starts every accumulator at a real, honest zero — never a fabricated warm value', () => {
    const state = createEngineState();
    expect(state.cvd.value).toBe(0);
    expect(state.ofi).toEqual({ buyVol: 0, sellVol: 0, count: 0, lastSig: 0 });
    expect(state.absorption.active).toBe(false);
    expect(state.exhaustion.deltaHist).toEqual([]);
    expect(state.exhaustion.priceHist).toEqual([]);
  });
});

describe('signal-engine: CVD (Cumulative Volume Delta)', () => {
  it('accumulates +volume for BUY and -volume for SELL, never resetting across calls', () => {
    const state = createEngineState();
    processSignals([tick(1, 100, 10, 'BUY'), tick(2, 100, 4, 'SELL')], state);
    expect(state.cvd.value).toBe(6);
    processSignals([tick(3, 100, 3, 'SELL')], state);
    expect(state.cvd.value).toBe(3);
  });
});

describe('signal-engine: OFI (Order Flow Imbalance)', () => {
  function imbalancedWindow(buys: number, sells: number, startT = 0): Tick[] {
    const out: Tick[] = [];
    for (let i = 0; i < buys; i++) out.push(tick(startT + i, 100, 1, 'BUY'));
    for (let i = 0; i < sells; i++) out.push(tick(startT + buys + i, 100, 1, 'SELL'));
    return out;
  }

  it('fires exactly on the tick that completes the real window, with the real signed imbalance ratio', () => {
    const state = createEngineState();
    // 400 = real windowSize; 350 BUY / 50 SELL -> imb = 300/400 = 0.75 > 0.6.
    const signals = processSignals(imbalancedWindow(350, 50), state);
    const ofi = signals.filter((s) => s.type === SignalType.OFI);
    expect(ofi.length).toBe(1);
    expect(ofi[0].metadata.imbalance).toBeCloseTo(0.75, 10);
    // confidence is |imbalance| — a real desequilíbrio ratio, never a
    // calibrated probability (Regra de Ouro 2).
    expect(ofi[0].confidence).toBeCloseTo(0.75, 10);
  });

  it('never fires below the real imbalance threshold, even with a full window', () => {
    const state = createEngineState();
    // 220 buy / 180 sell -> imb = 40/400 = 0.10, well under the real 0.6 gate.
    const signals = processSignals(imbalancedWindow(220, 180), state);
    expect(signals.filter((s) => s.type === SignalType.OFI).length).toBe(0);
  });

  it('never fires below the real minimum volume, even at 100% imbalance', () => {
    const state = createEngineState();
    const settings = { ...defaultSettings, ofi: { ...defaultSettings.ofi, windowSize: 5, minVolume: 1000 } };
    const allBuy = [1, 2, 3, 4, 5].map((t) => tick(t, 100, 1, 'BUY')); // tot=5, imb=1.0, but tot << minVolume=1000.
    const signals = processSignals(allBuy, state, settings);
    expect(signals.filter((s) => s.type === SignalType.OFI).length).toBe(0);
  });

  // Fake time starts at a large, realistic epoch-like value — never 0.
  // `ofi.lastSig` (createEngineState) starts at the real sentinel 0, and
  // the cooldown gate is `now - lastSig > cooldownMs`; starting fake time
  // at 0 would recreate a degenerate case real production never hits
  // (Date.now() is always a huge epoch number, so the very first signal's
  // "now - 0" is trivially > any real cooldown).
  const REALISTIC_EPOCH = 1_700_000_000_000;

  it('respects the real cooldown — a second full window right after the first does not re-fire', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(REALISTIC_EPOCH);
      const state = createEngineState();
      const first = processSignals(imbalancedWindow(350, 50, 0), state);
      expect(first.filter((s) => s.type === SignalType.OFI).length).toBe(1);
      vi.setSystemTime(REALISTIC_EPOCH + defaultSettings.ofi.cooldownMs - 1); // still inside the real cooldown window
      const second = processSignals(imbalancedWindow(350, 50, 1000), state);
      expect(second.filter((s) => s.type === SignalType.OFI).length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fires again once the real cooldown window has genuinely elapsed', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(REALISTIC_EPOCH);
      const state = createEngineState();
      const first = processSignals(imbalancedWindow(350, 50, 0), state);
      expect(first.filter((s) => s.type === SignalType.OFI).length).toBe(1);
      vi.setSystemTime(REALISTIC_EPOCH + defaultSettings.ofi.cooldownMs + 1);
      const second = processSignals(imbalancedWindow(350, 50, 1000), state);
      expect(second.filter((s) => s.type === SignalType.OFI).length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('signal-engine: ABSORPTION', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires when real volume stays high while price barely moves across the full real time window', () => {
    const state = createEngineState();
    // Priming tick opens the window. Its own volume is discarded by the
    // engine's own reset-right-after-activate order (real behavior,
    // byte-identical port from golden-master.html — not a test artifact).
    processSignals([tick(0, 100, 10, 'BUY')], state);
    expect(state.absorption.active).toBe(true);
    vi.setSystemTime(defaultSettings.absorption.timeWindowMs + 1);
    const signals = processSignals([tick(1, 100.05, 600, 'SELL')], state); // 0.05% move, real volume 600.
    const absorption = signals.filter((s) => s.type === SignalType.ABSORPTION);
    expect(absorption.length).toBe(1);
    expect(absorption[0].confidence).toBeGreaterThan(0);
    expect(absorption[0].confidence).toBeLessThanOrEqual(1);
    expect(absorption[0].metadata.totalVolume).toBe(600);
  });

  it('never fires when the real price moved beyond the honest negligible-movement gate', () => {
    const state = createEngineState();
    processSignals([tick(0, 100, 10, 'BUY')], state);
    vi.setSystemTime(defaultSettings.absorption.timeWindowMs + 1);
    const signals = processSignals([tick(1, 100.2, 600, 'SELL')], state); // 0.2% move, past the 0.1% gate.
    expect(signals.filter((s) => s.type === SignalType.ABSORPTION).length).toBe(0);
  });

  it('never fires when real volume stays under the honest minimum, even with zero price movement', () => {
    const state = createEngineState();
    processSignals([tick(0, 100, 10, 'BUY')], state);
    vi.setSystemTime(defaultSettings.absorption.timeWindowMs + 1);
    const signals = processSignals([tick(1, 100, 10, 'SELL')], state); // flat price, volume well under 500.
    expect(signals.filter((s) => s.type === SignalType.ABSORPTION).length).toBe(0);
  });
});

describe('signal-engine: EXHAUSTION', () => {
  // Compact settings (smaller deltaLookback/minDeltaVolume) so the test
  // doesn't need 500 real ticks to reach the real formula's evaluation
  // point — same technique already used above for OFI's windowSize.
  // reversalConfirmation kept explicit (not the production default) so the
  // scenario is legible; the production default is audited separately
  // below without asserting a brittle fire/no-fire on it.
  const settings = {
    ...defaultSettings,
    exhaustion: { ...defaultSettings.exhaustion, deltaLookback: 20, minDeltaVolume: 10, reversalConfirmation: 0.05 },
  };

  function calmHistory(n: number, startT = 0): Tick[] {
    // Tiny, alternating volume -> currentDelta stays near 0 with low
    // variance, a realistic "quiet market" baseline for the z-score.
    const out: Tick[] = [];
    for (let i = 0; i < n; i++) out.push(tick(startT + i, 100, 0.001, i % 2 === 0 ? 'BUY' : 'SELL'));
    return out;
  }

  it('fires only once BOTH real gates hold: an extreme one-sided delta (z-score) AND a real price reversal', () => {
    const state = createEngineState();
    processSignals(calmHistory(19), state, settings);
    // One-sided BUY pressure at declining prices — delta climbs (z-score
    // extreme) while price simultaneously fails to follow (real reversal
    // building in the same window).
    let fired: ReturnType<typeof processSignals> = [];
    for (let i = 0; i < 4 && fired.length === 0; i++) {
      fired = processSignals([tick(19 + i, 100 - i * 2, 80, 'BUY')], state, settings);
    }
    const exhaustion = fired.filter((s) => s.type === SignalType.EXHAUSTION);
    expect(exhaustion.length).toBe(1);
    expect(exhaustion[0].metadata.direction).toBe('BUY_EXHAUSTED'); // one-sided BUY delta exhausting, price failing to rise
    expect(Math.abs(exhaustion[0].metadata.zScore)).toBeGreaterThan(settings.exhaustion.exhaustionThreshold);
    expect(exhaustion[0].confidence).toBeGreaterThan(0);
    expect(exhaustion[0].confidence).toBeLessThanOrEqual(1);
  });

  it('does not fire on the delta spike alone, before any real price reversal has happened', () => {
    const state = createEngineState();
    processSignals(calmHistory(19), state, settings);
    // First BUY-heavy tick: delta is already extreme (z-score-wise) but
    // price has not moved yet in this same window — must NOT fire.
    const signals = processSignals([tick(19, 100, 80, 'BUY')], state, settings);
    expect(signals.filter((s) => s.type === SignalType.EXHAUSTION).length).toBe(0);
  });

  it('never fires on a calm, flat series — no spike, no reversal, no fabricated signal', () => {
    const state = createEngineState();
    const signals = processSignals(calmHistory(60), state, settings);
    expect(signals.filter((s) => s.type === SignalType.EXHAUSTION).length).toBe(0);
  });

  // Achado real de auditoria (Ordem EPC-05, "pesquisar a matemática"): o
  // valor de PRODUÇÃO de reversalConfirmation é 0.2 — comparado direto
  // contra pc2 (retorno fracionário bruto de preço nos últimos 10 ticks),
  // isso exige um movimento de PREÇO de 20% dentro de só 10 trades para
  // confirmar uma reversão. Não há dado real de estatística de tick da
  // MEXC neste sandbox para julgar se 20% é calibrado ou herdado sem
  // ajuste do replay sintético de golden-master.html — mudar o número
  // seria "tentativa e erro", que esta própria Ordem proíbe. Registrado
  // como achado honesto, não como bug: o teste abaixo só documenta que o
  // valor de produção é o que está congelado, nunca deriva um veredito de
  // "certo" ou "errado" sobre ele.
  it('documents the real production reversalConfirmation value without asserting it is well-calibrated', () => {
    expect(defaultSettings.exhaustion.reversalConfirmation).toBe(0.2);
  });
});
