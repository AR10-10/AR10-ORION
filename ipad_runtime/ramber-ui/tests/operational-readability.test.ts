// operational-readability.test.ts — Evolução Integrativa §7: execução REAL
// da Operational Readability Layer, de ponta a ponta — inputs reais →
// buildNexusDecision (contrato único) → buildOperationalSummary (linhas).
// Antes da extração, esta montagem vivia inline no JSX do badge e só tinha
// teste de padrão de fonte; agora o conteúdo é provado por execução.
import { describe, it, expect } from 'vitest';
import { buildNexusDecision } from '../src/nexus/decision-layer';
import {
  buildOperationalSummary,
  READABILITY_FALLBACK_LINE,
} from '../src/nexus/operational-readability';
import type { TradePlan } from '../src/nexus/trade-plan';
import type { EtaReading } from '../src/nexus/eta-engine';

const plan: TradePlan = {
  contractVersion: 2,
  direction: 'LONG',
  entry: { low: 99, high: 100, basis: 'OB_BULLISH' },
  stop: { price: 95, basis: 'SR_SUPPORT_1' },
  targets: [
    { price: 105, basis: 'VP_POC' },
    { price: 64100, basis: 'EQH' },
  ],
  riskRewardRatios: [1.22, 2.44],
  computedAt: 0,
};

const eta: EtaReading = {
  status: 'OK',
  reason: null,
  etas: [{ targetIndex: 0, bars: 10, ms: 600_000, barsMin: 5, msMin: 300_000, basis: 'real' }, null],
  directionalEfficiency: 0.5,
  atrAbsolute: 1,
  computedAt: 0,
};

const inputs = {
  coreDirection: 'LONG' as const,
  coreConfidence: 'ALTA',
  plan,
  targetsHit: 1,
  etaReading: eta,
  score: 72,
  scoreZoneLabel: 'ZONA FORTE',
  scoreTrend: 'FORTALECENDO',
  councilStance: 'LONG' as const,
  councilRiskGated: false,
  assistantMessage: { text: 'Compra favorecida.', basis: 'conselho LONG + fluxo real' },
  inEntryZone: false,
  lastResolvedAt: null,
  councilVotes: [{ agent: 'STRUCTURE', stance: 'LONG', rationale: 'estrutura real de alta' }],
  convictionMembers: [{ id: 'MULTI_TIMEFRAME', agreesWithCore: false, detail: '3/9 prazos concordam' }],
  heatTier: 'QUENTE',
  premiumDiscountZone: 'DISCOUNT' as const,
  vwapState: 'BULLISH' as const,
  nexusLineState: 'NEUTRAL' as const,
};

describe('buildOperationalSummary: o "bateu o olho" (§6) por execução real', () => {
  it('LONG completo: operação+estado, confiança com o aviso honesto, entrada/stop, um TP por linha (R:R/ETA/ATINGIDO), motivo e justificativas', () => {
    const lines = buildOperationalSummary(buildNexusDecision(inputs));
    expect(lines[0]).toBe('NEXUS DECISION · Operação: LONG (fonte: Core Engine — LEI 24) · Estado: GERENCIANDO');
    expect(lines[1]).toContain('Confiança: ALTA · Score 72 (ZONA FORTE) · FORTALECENDO — confluência real, nunca probabilidade');
    expect(lines[2]).toBe('Entrada: 99.00–100.00 (OB_BULLISH) · Stop: 95.00 (SR_SUPPORT_1)');
    // f(): < 1000 com 2 casas, >= 1000 sem casas — a convenção do cockpit
    expect(lines[3]).toBe('TP1: 105.00 (VP_POC) · R:R 1:1.22 · ETA ≈ 5m–10m · ATINGIDO');
    expect(lines[4]).toBe('TP2: 64100 (EQH) · R:R 1:2.44'); // sem ETA real => sem sufixo fabricado
    expect(lines[5]).toBe('Motivo: Compra favorecida. (conselho LONG + fluxo real)');
    expect(lines.find((l) => l.startsWith('Favoráveis:'))).toContain('estrutura real de alta (Conselho·STRUCTURE)');
    expect(lines.find((l) => l.startsWith('Contrários:'))).toContain('3/9 prazos concordam (Conviction·MULTI_TIMEFRAME)');
  });

  it('AGUARDAR sem plano: a linha de plano carrega o motivo NOMEADO do gap (nunca dash mudo com causa conhecida)', () => {
    const d = buildNexusDecision({ ...inputs, coreDirection: null, plan: null, councilRiskGated: true, targetsHit: 0 });
    const lines = buildOperationalSummary(d);
    expect(lines[0]).toContain('Operação: AGUARDAR');
    expect(lines.find((l) => l.startsWith('Plano:'))).toBe('Plano: Conselho travado por risco (fail-closed)');
  });

  it('sem decisão (motor sem ciclo): a linha única honesta de fallback', () => {
    expect(buildOperationalSummary(null)).toEqual([READABILITY_FALLBACK_LINE]);
    expect(buildOperationalSummary(undefined)).toEqual([READABILITY_FALLBACK_LINE]);
  });

  it('linhas ausentes são OMITIDAS (sem motivo/justificativa => sem linha), nunca placeholder fabricado', () => {
    const d = buildNexusDecision({
      ...inputs,
      assistantMessage: null,
      councilVotes: [],
      convictionMembers: [],
      premiumDiscountZone: null,
      vwapState: null,
      nexusLineState: null,
      heatTier: null,
    });
    const lines = buildOperationalSummary(d);
    expect(lines.some((l) => l.startsWith('Motivo:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('Favoráveis:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('Contrários:'))).toBe(false);
  });

  it('camada é apresentação PURA: o fonte nunca fala em probabilidade nem decide nada (LEI 24 no nível do módulo)', () => {
    const src = require('node:fs').readFileSync(require.resolve('../src/nexus/operational-readability.ts'), 'utf8');
    expect(src).not.toMatch(/probabilit(y|ies)|probabilidade de acerto|chance de subir/i);
    expect(src).not.toMatch(/buildTradePlan|computeTargetEtas|buildNexusDecision/); // nunca recomputa decisão
  });
});
