// operational-readability.test.ts — Evolução Integrativa §7: execução REAL
// da Operational Readability Layer, de ponta a ponta — inputs reais →
// buildNexusDecision (contrato único) → buildOperationalSummary (linhas).
// Antes da extração, esta montagem vivia inline no JSX do badge e só tinha
// teste de padrão de fonte; agora o conteúdo é provado por execução.
import { describe, it, expect } from 'vitest';
import { buildNexusDecision } from '../src/nexus/decision-layer';
import {
  buildOperationalSummary,
  deriveOutcomeLabel,
  deriveSetupState,
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
    // §7/§9 Omega Core: BIAS×ENTRY já reconciliados (GERENCIANDO = timing confirmado) => rótulo puro "LONG", sem cláusula de aguardo
    expect(lines[1]).toBe('Leitura: LONG');
    // Evolução Profunda §2/§3: SETUP separado de BIAS/ENTRY — GERENCIANDO já é ENTRY confirmado, então o eixo SETUP também resolve para o rótulo direcional puro
    expect(lines[2]).toBe('Setup: LONG_SETUP — estrutura real de compra ativa (entrada/stop/alvo mapeados)');
    expect(lines[3]).toContain('Confiança: ALTA · Score 72 (ZONA FORTE) · FORTALECENDO — confluência real, nunca probabilidade');
    expect(lines[4]).toBe('Entrada: 99.00–100.00 (OB_BULLISH) · Stop: 95.00 (SR_SUPPORT_1)');
    // f(): < 1000 com 2 casas, >= 1000 sem casas — a convenção do cockpit
    expect(lines[5]).toBe('TP1: 105.00 (VP_POC) · R:R 1:1.22 · ETA ≈ 5m–10m · ATINGIDO');
    expect(lines[6]).toBe('TP2: 64100 (EQH) · R:R 1:2.44'); // sem ETA real => sem sufixo fabricado
    expect(lines[7]).toBe('Motivo: Compra favorecida. (conselho LONG + fluxo real)');
    expect(lines.find((l) => l.startsWith('Favoráveis:'))).toContain('estrutura real de alta (Conselho·STRUCTURE)');
    expect(lines.find((l) => l.startsWith('Contrários:'))).toContain('3/9 prazos concordam (Conviction·MULTI_TIMEFRAME)');
  });

  it('BIAS ≠ ENTRY (§9): Núcleo LONG mas timing ainda não confirmado (PREPARANDO/CONFIRMANDO) => "AGUARDAR LONG", nunca "LONG" liso', () => {
    const preparing = buildNexusDecision({ ...inputs, plan: null, councilStance: null, targetsHit: 0 });
    expect(preparing.operationalState).toBe('PREPARANDO');
    const lines = buildOperationalSummary(preparing);
    expect(lines[1]).toBe('Leitura: AGUARDAR LONG — viés real do Núcleo; entrada ainda não confirmada (BIAS ≠ ENTRY)');
  });

  it('BIAS ≠ ENTRY (§9) espelhado em SHORT: mesma regra, nunca uma fórmula separada por direção', () => {
    const preparing = buildNexusDecision({ ...inputs, coreDirection: 'SHORT', plan: null, councilStance: null, targetsHit: 0 });
    expect(preparing.operationalState).toBe('PREPARANDO');
    const lines = buildOperationalSummary(preparing);
    expect(lines[1]).toBe('Leitura: AGUARDAR SHORT — viés real do Núcleo; entrada ainda não confirmada (BIAS ≠ ENTRY)');
  });

  it('§7 vocabulário completo: sem direção real do Núcleo e sem qualquer estado notável => "SEM OPERAÇÃO"', () => {
    const idle = buildNexusDecision({ ...inputs, coreDirection: null, plan: null, councilStance: null, targetsHit: 0, lastResolvedAt: null });
    expect(idle.operationalState).toBe('OBSERVANDO');
    expect(deriveOutcomeLabel(idle)).toBe('SEM OPERAÇÃO');
  });

  it('§7 vocabulário completo: sem direção real do Núcleo mas com resolução recente (ENCERRADO) => "OBSERVAR", nunca confundido com repouso total', () => {
    const justResolved = buildNexusDecision(
      { ...inputs, coreDirection: null, plan: null, councilStance: null, targetsHit: 0, lastResolvedAt: 900_000 },
      1_000_000,
    );
    expect(justResolved.operationalState).toBe('ENCERRADO');
    expect(deriveOutcomeLabel(justResolved)).toBe('OBSERVAR');
  });

  it('Evolução Profunda §2/§3: SETUP é um terceiro eixo, separado de BIAS e ENTRY — plano real mas fora da zona (CONFIRMANDO) => WAITING_FOR_RETEST', () => {
    const waiting = buildNexusDecision({ ...inputs, targetsHit: 0, inEntryZone: false });
    expect(waiting.operationalState).toBe('CONFIRMANDO');
    expect(deriveSetupState(waiting)).toBe('WAITING_FOR_RETEST');
  });

  it('SETUP espelhado em SHORT: direção lida da geometria real do plano (stop acima da entrada), nunca de `operation`', () => {
    const shortPlan: TradePlan = {
      contractVersion: 2,
      direction: 'SHORT',
      entry: { low: 100, high: 101, basis: 'OB_BEARISH' },
      stop: { price: 105, basis: 'SR_RESISTANCE_1' },
      targets: [{ price: 95, basis: 'SR_SUPPORT_1' }],
      riskRewardRatios: [1.5],
      computedAt: 0,
    };
    const d = buildNexusDecision({ ...inputs, coreDirection: 'SHORT', plan: shortPlan, councilStance: 'SHORT', targetsHit: 1 });
    expect(d.operationalState).toBe('GERENCIANDO');
    expect(deriveSetupState(d)).toBe('SHORT_SETUP');
  });

  it('SETUP: plano do Conselho na direção oposta ao Núcleo (DIRECTION_CONFLICT) => INVALIDATED', () => {
    const conflictingPlan: TradePlan = {
      contractVersion: 2,
      direction: 'SHORT',
      entry: { low: 100, high: 101, basis: 'OB_BEARISH' },
      stop: { price: 105, basis: 'SR_RESISTANCE_1' },
      targets: [{ price: 95, basis: 'SR_SUPPORT_1' }],
      riskRewardRatios: [1.5],
      computedAt: 0,
    };
    const d = buildNexusDecision({ ...inputs, coreDirection: 'LONG', plan: conflictingPlan });
    expect(d.planGap).toBe('DIRECTION_CONFLICT');
    expect(deriveSetupState(d)).toBe('INVALIDATED');
  });

  it('SETUP: Conselho travado por risco (sem plano ainda) => WAITING_FOR_CONFIRMATION, distinto de NO_VALID_SETUP', () => {
    const gated = buildNexusDecision({ ...inputs, plan: null, councilRiskGated: true, targetsHit: 0 });
    expect(gated.planGap).toBe('RISK_GATED');
    expect(deriveSetupState(gated)).toBe('WAITING_FOR_CONFIRMATION');
  });

  it('SETUP: Conselho real e direcional mas nenhuma estrutura mapeada (NO_STRUCTURE) => NO_VALID_SETUP', () => {
    const noStructure = buildNexusDecision({ ...inputs, plan: null, councilStance: 'LONG', councilRiskGated: false, targetsHit: 0 });
    expect(noStructure.planGap).toBe('NO_STRUCTURE');
    expect(deriveSetupState(noStructure)).toBe('NO_VALID_SETUP');
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
