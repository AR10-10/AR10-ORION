// target-tracker.test.ts — permanent regression suite for the Target
// Tracker (Alvo 1/2, invalidação, Risk:Reward, progress_pct). Imports the
// REAL module (never a mock) by the same relative path engine-bridge.ts
// uses. Reconstructs, as a versioned suite, the ad-hoc verification done
// for the V11.5 Fase 6 (R:R + strength) and Protocolo Mestre (Alvo 1
// precision fix) changes.
import { describe, it, expect } from 'vitest';
import { buildTargetTracker, TARGET_STATUS } from '../../js/research/target-tracker.js';
import { DADOS_INSUFICIENTES } from '../../js/real-data/schema.js';

function baseFrame(overrides: Record<string, unknown> = {}) {
  return {
    status: 'OK',
    last_price: 50000,
    support: 49000,
    resistance: 51000,
    resistance_1_strength: { label: 'FORTE', touches: 3 },
    support_1_strength: { label: 'FRACA', touches: 1 },
    resistance_2: 52000,
    resistance_2_strength: { label: 'FORTE', touches: 2 },
    support_2: 48000,
    support_2_strength: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('target-tracker: missing inputs never fabricate a reading', () => {
  it('returns the empty tracker when there is no valid snapshot', () => {
    const result = buildTargetTracker({ snapshot: { frame: { status: DADOS_INSUFICIENTES }, research: {} }, livePrice: { value: 50000, mode: 'REAL' } });
    expect(result.current_price).toBe(DADOS_INSUFICIENTES);
    expect(result.reanalyze_reasons).toEqual(['sem_snapshot_de_analise_real_nesta_sessao']);
    expect(result.rota_a_long.status).toBe(TARGET_STATUS.DADOS_INSUFICIENTES);
    expect(result.rota_a_long.target_1_strength).toBeNull();
  });

  it('returns the empty tracker when there is no live price', () => {
    const result = buildTargetTracker({ snapshot: { frame: baseFrame(), research: {} }, livePrice: { value: NaN, mode: 'REAL' } });
    expect(result.reanalyze_reasons).toEqual(['sem_preco_vivo_nesta_sessao']);
  });
});

describe('target-tracker: real LONG route (price between support and resistance)', () => {
  const frame = baseFrame();
  const result = buildTargetTracker({
    snapshot: { frame, research: { generated_at: new Date().toISOString() } },
    livePrice: { value: 50000, mode: 'REAL' },
  });

  it('target_1/invalidation map to resistance/support for the LONG route', () => {
    expect(result.rota_a_long.target_1).toBe(51000);
    expect(result.rota_a_long.invalidation).toBe(49000);
  });

  it('passes through target_1_strength/target_2_strength from the frame untouched', () => {
    expect(result.rota_a_long.target_1_strength).toEqual({ label: 'FORTE', touches: 3 });
    expect(result.rota_a_long.target_2_strength).toEqual({ label: 'FORTE', touches: 2 });
    expect(result.rota_b_short.target_1_strength).toEqual({ label: 'FRACA', touches: 1 });
    expect(result.rota_b_short.target_2_strength).toBeNull();
  });

  it('is WAITING when price has neither touched the target nor breached invalidation', () => {
    expect(result.rota_a_long.status).toBe(TARGET_STATUS.WAITING);
  });

  it('computes risk_reward_ratio as the real ratio of the two real distances', () => {
    const distToTarget = Math.abs((51000 - 50000) / 50000) * 100;
    const distToInvalidation = Math.abs((49000 - 50000) / 50000) * 100;
    expect(result.rota_a_long.risk_reward_ratio).toBeCloseTo(distToTarget / distToInvalidation, 6);
  });

  it('progress_pct is within [0,100] and reflects position between invalidation and target', () => {
    expect(result.rota_a_long.progress_pct).toBeGreaterThanOrEqual(0);
    expect(result.rota_a_long.progress_pct).toBeLessThanOrEqual(100);
  });
});

describe('target-tracker: TARGET_TOUCHED / INVALIDATED are real facts, never soft-pedaled', () => {
  it('marks LONG as TARGET_TOUCHED once price reaches resistance, progress_pct exactly 100', () => {
    const frame = baseFrame();
    const result = buildTargetTracker({
      snapshot: { frame, research: {} },
      livePrice: { value: 51500, mode: 'REAL' },
    });
    expect(result.rota_a_long.status).toBe(TARGET_STATUS.TARGET_TOUCHED);
    expect(result.rota_a_long.progress_pct).toBe(100);
  });

  it('marks LONG as INVALIDATED once price closes below support, progress_pct exactly 0', () => {
    const frame = baseFrame();
    const result = buildTargetTracker({
      snapshot: { frame, research: {} },
      livePrice: { value: 48500, mode: 'REAL' },
    });
    expect(result.rota_a_long.status).toBe(TARGET_STATUS.INVALIDATED);
    expect(result.rota_a_long.progress_pct).toBe(0);
  });

  it('never downgrades TARGET_TOUCHED/INVALIDATED to STALE_REANALYZE even when the snapshot is old', () => {
    const frame = baseFrame({ timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString() });
    const result = buildTargetTracker({
      snapshot: { frame, research: { generated_at: frame.timestamp } },
      livePrice: { value: 51500, mode: 'REAL' },
    });
    expect(result.reanalyze_recommended).toBe(true);
    expect(result.rota_a_long.status).toBe(TARGET_STATUS.TARGET_TOUCHED);
  });
});

describe('target-tracker: risk_reward_ratio never divides by zero', () => {
  it('is DADOS_INSUFICIENTES when price sits exactly on the invalidation level', () => {
    const frame = baseFrame();
    const result = buildTargetTracker({
      snapshot: { frame, research: {} },
      livePrice: { value: 49000, mode: 'REAL' }, // exactly at support == invalidation for the LONG route
    });
    expect(result.rota_a_long.risk_reward_ratio).toBe(DADOS_INSUFICIENTES);
  });
});

describe('target-tracker: STALE_REANALYZE only ever downgrades a WAITING route', () => {
  it('flags reanalyze when the snapshot is older than 15 minutes and downgrades WAITING to STALE_REANALYZE', () => {
    const oldTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const frame = baseFrame({ timestamp: oldTimestamp });
    const result = buildTargetTracker({
      snapshot: { frame, research: { generated_at: oldTimestamp } },
      livePrice: { value: 50000, mode: 'REAL' }, // still WAITING territory
    });
    expect(result.reanalyze_recommended).toBe(true);
    expect(result.reanalyze_reasons).toContain('snapshot_mais_velho_que_15min');
    expect(result.rota_a_long.status).toBe(TARGET_STATUS.STALE_REANALYZE);
  });
});
