import { describe, expect, it } from 'vitest';
import { simulateTradeCosts, simulateTradeCostsBatch, DEFAULT_EXECUTION_COST_CONFIG } from '../src/nexus/trade-simulation';
import { TRADE_PLAN_CONTRACT_VERSION, type TradePlan } from '../src/nexus/trade-plan';
import type { TrackedPlan } from '../src/nexus/signal-track-record';

function mkPlan(direction: 'LONG' | 'SHORT', entryMid: number, stopPrice: number, targetPrice: number): TradePlan {
  return {
    contractVersion: TRADE_PLAN_CONTRACT_VERSION,
    direction,
    entry: { low: entryMid, high: entryMid, basis: 'TEST' },
    stop: { price: stopPrice, basis: 'TEST' },
    targets: [{ price: targetPrice, basis: 'TEST' }],
    riskRewardRatios: [null],
    computedAt: 0,
  };
}

function mkTracked(
  status: TrackedPlan['status'],
  plan: TradePlan,
  resolvedPrice: number | null,
  openedAt: number,
  resolvedAt: number | null,
  regime: string | null = null,
  structureLabel: string | null = null,
): TrackedPlan {
  return {
    plan,
    openedAt,
    status,
    resolvedAt,
    resolvedPrice,
    targetsHit: status === 'TARGET_HIT' ? 1 : 0,
    breakEvenSuggested: false,
    contextAtOpen: {
      etaMsAtOpen: null,
      etaMsMinAtOpen: null,
      vwapState: null,
      nexusLineState: null,
      score: null,
      regime,
      structureLabel,
    },
  };
}

describe('simulateTradeCosts: fail-closed', () => {
  it('OPEN nunca é um trade — devolve null', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const tracked = mkTracked('OPEN', plan, null, 0, null);
    expect(simulateTradeCosts(tracked)).toBeNull();
  });

  it('REPLACED nunca é um trade — devolve null', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const tracked = mkTracked('REPLACED', plan, null, 0, 1000);
    expect(simulateTradeCosts(tracked)).toBeNull();
  });

  it('resolvedPrice/resolvedAt nulo em status resolvido nunca é um trade real — devolve null (defensivo)', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const tracked = { ...mkTracked('TARGET_HIT', plan, null, 0, 1000) };
    expect(simulateTradeCosts(tracked)).toBeNull();
  });

  it('risco degenerado (entry === stop) nunca divide por zero — devolve null', () => {
    const plan = mkPlan('LONG', 100, 100, 103);
    const tracked = mkTracked('STOP_HIT', plan, 100, 0, 1000);
    expect(simulateTradeCosts(tracked)).toBeNull();
  });
});

describe('simulateTradeCosts: resultado bruto real (grossR) antes de custos', () => {
  it('LONG TARGET_HIT: entry=100 stop=99 (R=1) resolvido em 103 -> grossR=3', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const tracked = mkTracked('TARGET_HIT', plan, 103, 0, 1000);
    const r = simulateTradeCosts(tracked, { ...DEFAULT_EXECUTION_COST_CONFIG, takerFeeRate: 0, slippageRFraction: 0, fundingRatePerSettlement: 0 });
    expect(r).not.toBeNull();
    expect(r!.riskPoints).toBe(1);
    expect(r!.grossR).toBe(3);
    expect(r!.netR).toBe(3); // custos zerados neste teste isola só o bruto
  });

  it('LONG STOP_HIT: entry=100 stop=99 resolvido em 99 -> grossR=-1', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const tracked = mkTracked('STOP_HIT', plan, 99, 0, 1000);
    const r = simulateTradeCosts(tracked, { ...DEFAULT_EXECUTION_COST_CONFIG, takerFeeRate: 0, slippageRFraction: 0, fundingRatePerSettlement: 0 });
    expect(r!.grossR).toBe(-1);
  });

  it('SHORT TARGET_HIT: entry=100 stop=101 (R=1) resolvido em 97 -> grossR=3 (espelhado)', () => {
    const plan = mkPlan('SHORT', 100, 101, 97);
    const tracked = mkTracked('TARGET_HIT', plan, 97, 0, 1000);
    const r = simulateTradeCosts(tracked, { ...DEFAULT_EXECUTION_COST_CONFIG, takerFeeRate: 0, slippageRFraction: 0, fundingRatePerSettlement: 0 });
    expect(r!.grossR).toBe(3);
  });

  it('SHORT STOP_HIT: entry=100 stop=101 resolvido em 101 -> grossR=-1', () => {
    const plan = mkPlan('SHORT', 100, 101, 97);
    const tracked = mkTracked('STOP_HIT', plan, 101, 0, 1000);
    const r = simulateTradeCosts(tracked, { ...DEFAULT_EXECUTION_COST_CONFIG, takerFeeRate: 0, slippageRFraction: 0, fundingRatePerSettlement: 0 });
    expect(r!.grossR).toBe(-1);
  });
});

describe('simulateTradeCosts: custos reais (comissão + slippage + funding)', () => {
  it('comissão = 2 x takerFeeRate x entryMid / R (entrada + saída)', () => {
    const plan = mkPlan('LONG', 100, 99, 103); // R=1
    const tracked = mkTracked('TARGET_HIT', plan, 103, 0, 1000);
    const r = simulateTradeCosts(tracked, { takerFeeRate: 0.0005, slippageRFraction: 0, fundingRatePerSettlement: 0, fundingSettlementHours: 8 });
    // 2 * 0.0005 * 100 / 1 = 0.1R
    expect(r!.commissionR).toBeCloseTo(0.1, 10);
  });

  it('slippage = 2 x slippageRFraction (entrada + saída)', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const tracked = mkTracked('TARGET_HIT', plan, 103, 0, 1000);
    const r = simulateTradeCosts(tracked, { takerFeeRate: 0, slippageRFraction: 0.02, fundingRatePerSettlement: 0, fundingSettlementHours: 8 });
    expect(r!.slippageR).toBeCloseTo(0.04, 10);
  });

  it('funding = 0 quando a posição durou menos que 1 intervalo real de settlement', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const sevenHoursMs = 7 * 3_600_000;
    const tracked = mkTracked('TARGET_HIT', plan, 103, 0, sevenHoursMs);
    const r = simulateTradeCosts(tracked, { takerFeeRate: 0, slippageRFraction: 0, fundingRatePerSettlement: 0.0001, fundingSettlementHours: 8 });
    expect(r!.fundingR).toBe(0);
  });

  it('funding cobra 1 acerto real após cruzar exatamente 1 intervalo de 8h', () => {
    const plan = mkPlan('LONG', 100, 99, 103); // R=1
    const nineHoursMs = 9 * 3_600_000;
    const tracked = mkTracked('TARGET_HIT', plan, 103, 0, nineHoursMs);
    const r = simulateTradeCosts(tracked, { takerFeeRate: 0, slippageRFraction: 0, fundingRatePerSettlement: 0.0001, fundingSettlementHours: 8 });
    // 1 settlement * 0.0001 * 100 / 1 = 0.01R
    expect(r!.fundingR).toBeCloseTo(0.01, 10);
  });

  it('funding cobra 2 acertos reais após cruzar 2 intervalos de 8h (17h de holding)', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const seventeenHoursMs = 17 * 3_600_000;
    const tracked = mkTracked('TARGET_HIT', plan, 103, 0, seventeenHoursMs);
    const r = simulateTradeCosts(tracked, { takerFeeRate: 0, slippageRFraction: 0, fundingRatePerSettlement: 0.0001, fundingSettlementHours: 8 });
    expect(r!.fundingR).toBeCloseTo(0.02, 10);
  });

  it('netR = grossR - commissionR - slippageR - fundingR, sempre subtraindo (nunca um custo a favor)', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const nineHoursMs = 9 * 3_600_000;
    const tracked = mkTracked('TARGET_HIT', plan, 103, 0, nineHoursMs);
    const r = simulateTradeCosts(tracked, DEFAULT_EXECUTION_COST_CONFIG);
    expect(r!.netR).toBeCloseTo(r!.grossR - r!.commissionR - r!.slippageR - r!.fundingR, 10);
    expect(r!.netR).toBeLessThan(r!.grossR); // custos reais sempre reduzem o resultado bruto
  });

  it('regime real carimbado em contextAtOpen chega intacto no resultado; null quando ausente (registro antigo)', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const tracked = mkTracked('TARGET_HIT', plan, 103, 0, 1000, 'TENDENCIA_FORTE');
    const r = simulateTradeCosts(tracked);
    expect(r!.regime).toBe('TENDENCIA_FORTE');

    const trackedNoContext: TrackedPlan = { ...mkTracked('TARGET_HIT', plan, 103, 0, 1000), contextAtOpen: undefined };
    const r2 = simulateTradeCosts(trackedNoContext);
    expect(r2!.regime).toBeNull();
  });

  it('Escopo Cirúrgico (Fase 1): fingerprint real carimbada quando há contexto; null quando ausente', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const tracked = mkTracked('TARGET_HIT', plan, 103, 0, 1000, 'TENDENCIA_FORTE', 'ESTRUTURA_ALTA');
    const r = simulateTradeCosts(tracked);
    expect(r!.fingerprint).toBe('regime:TENDENCIA_FORTE|structure:ESTRUTURA_ALTA|vwap:—|nl:—');

    const trackedNoContext: TrackedPlan = { ...mkTracked('TARGET_HIT', plan, 103, 0, 1000), contextAtOpen: undefined };
    const r2 = simulateTradeCosts(trackedNoContext);
    expect(r2!.fingerprint).toBeNull();
  });
});

describe('simulateTradeCostsBatch', () => {
  it('descarta OPEN/REPLACED silenciosamente, mantém só trades reais resolvidos', () => {
    const plan = mkPlan('LONG', 100, 99, 103);
    const list: TrackedPlan[] = [
      mkTracked('TARGET_HIT', plan, 103, 0, 1000),
      mkTracked('OPEN', plan, null, 0, null),
      mkTracked('REPLACED', plan, null, 0, 1000),
      mkTracked('STOP_HIT', plan, 99, 0, 1000),
    ];
    const results = simulateTradeCostsBatch(list);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('TARGET_HIT');
    expect(results[1].status).toBe('STOP_HIT');
  });
});
