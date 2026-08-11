// nexus-scenario-fingerprint.test.ts — Escopo Cirúrgico (Operador, Fase 1
// confirmada em docs/AUDITORIA_SINCRONIZACAO_DADOS.md §5.3): execução real
// de computeScenarioFingerprint/groupResultsByFingerprint.
import { describe, it, expect } from 'vitest';
import { computeScenarioFingerprint, groupResultsByFingerprint } from '../src/nexus/scenario-fingerprint';
import type { PlanOpenContext } from '../src/nexus/signal-track-record';
import type { TradeCostResult } from '../src/nexus/trade-simulation';

function ctx(overrides: Partial<PlanOpenContext> = {}): PlanOpenContext {
  return {
    etaMsAtOpen: null,
    etaMsMinAtOpen: null,
    vwapState: null,
    nexusLineState: null,
    score: null,
    regime: null,
    ...overrides,
  };
}

describe('computeScenarioFingerprint: string legível, tags fixas, zero segunda fonte', () => {
  it('todos os 4 fatores reais => string determinística com as 4 tags', () => {
    const fp = computeScenarioFingerprint(
      ctx({ regime: 'TENDENCIA_FORTE', structureLabel: 'ESTRUTURA_ALTA', vwapState: 'BULLISH', nexusLineState: 'BULLISH' }),
    );
    expect(fp).toBe('regime:TENDENCIA_FORTE|structure:ESTRUTURA_ALTA|vwap:BULLISH|nl:BULLISH');
  });

  it('mesmos 4 fatores => mesma fingerprint (determinístico); fatores diferentes => fingerprint diferente', () => {
    const a = computeScenarioFingerprint(ctx({ regime: 'TENDENCIA_FORTE', vwapState: 'BULLISH' }));
    const b = computeScenarioFingerprint(ctx({ regime: 'TENDENCIA_FORTE', vwapState: 'BULLISH' }));
    const c = computeScenarioFingerprint(ctx({ regime: 'CONSOLIDACAO', vwapState: 'BULLISH' }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('fator ausente vira placeholder explícito — nunca compacta a string (posição sempre preservada)', () => {
    const fp = computeScenarioFingerprint(ctx({ regime: 'TENDENCIA_FORTE' }));
    expect(fp).toBe('regime:TENDENCIA_FORTE|structure:—|vwap:—|nl:—');
  });

  it('regime sozinho não colide com structure sozinho (fatores diferentes, mesmo "valor" bruto)', () => {
    const regimeOnly = computeScenarioFingerprint(ctx({ regime: 'BULLISH' }));
    const structureOnly = computeScenarioFingerprint(ctx({ structureLabel: 'BULLISH' }));
    expect(regimeOnly).not.toBe(structureOnly);
  });

  it('contexto ausente (undefined/null) => null honesto', () => {
    expect(computeScenarioFingerprint(undefined)).toBeNull();
    expect(computeScenarioFingerprint(null)).toBeNull();
  });

  it('os 4 fatores ausentes (registro anterior a esta entrega) => null honesto, nunca uma fingerprint vazia fabricada', () => {
    expect(computeScenarioFingerprint(ctx())).toBeNull();
  });
});

function tradeResult(fingerprint: string | null, netR: number): TradeCostResult {
  return {
    status: 'TARGET_HIT',
    direction: 'LONG',
    entryMid: 100,
    riskPoints: 1,
    grossR: netR,
    commissionR: 0,
    slippageR: 0,
    fundingR: 0,
    netR,
    holdingMs: 0,
    regime: null,
    fingerprint,
    modelAgreement: null,
  };
}

describe('groupResultsByFingerprint: reagrupa amostra JÁ simulada, zero recálculo', () => {
  it('agrupa resultados com a MESMA fingerprint no mesmo balde', () => {
    const fp = 'regime:TENDENCIA_FORTE|structure:—|vwap:—|nl:—';
    const results = [tradeResult(fp, 1.2), tradeResult(fp, -0.8), tradeResult('regime:CONSOLIDACAO|structure:—|vwap:—|nl:—', 0.5)];
    const groups = groupResultsByFingerprint(results);
    expect(groups.size).toBe(2);
    expect(groups.get(fp)).toHaveLength(2);
  });

  it('fingerprint null nunca entra em nenhum grupo — misturar seria fabricar semelhança não observada', () => {
    const results = [tradeResult(null, 1), tradeResult(null, -1)];
    const groups = groupResultsByFingerprint(results);
    expect(groups.size).toBe(0);
  });

  it('lista vazia => mapa vazio', () => {
    expect(groupResultsByFingerprint([]).size).toBe(0);
  });
});
