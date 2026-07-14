// institutional-decision-layer.test.ts — Diretriz V-MAX de Refinamento
// Institucional (itens 5 e 6): execução real de institutional-score.ts e
// operation-assistant.ts. Fixtures no formato REAL de saída de cada
// subsistema — nunca reimplementa a matemática esperada à parte (o pool
// em si já tem suíte própria; aqui testa-se só o contrato de apresentação
// e a tradução determinística das frases).
import { describe, it, expect } from 'vitest';
import { computeInstitutionalScore, DEFAULT_MIN_OPPORTUNITY_SCORE } from '../src/nexus/institutional-score';
import { buildAssistantMessages, ASSISTANT_MAX_MESSAGES } from '../src/nexus/operation-assistant';
import type { ConvictionReading } from '../src/nexus/confluence-engine';
import type { CouncilDecision, CouncilVote } from '../src/nexus/council';
import type { OrderflowTrend, OrderflowTrendReading } from '../src/nexus/orderflow-history';

function conviction(over: Partial<ConvictionReading> = {}): ConvictionReading {
  return {
    status: 'OK',
    reason: null,
    coreDirection: 'LONG',
    conviction: 0.72,
    convictionAdjusted: null,
    verdict: 'CONFIRMS',
    agreeingCount: 3,
    totalReadable: 3,
    members: [],
    computedAt: 1,
    ...over,
  };
}

function vote(agent: CouncilVote['agent'], stance: CouncilVote['stance']): CouncilVote {
  return { agent, stance, confidence: stance === 'ABSTAIN' ? null : 0.5, rationale: 'fixture', evidence: [] };
}

function council(over: Partial<CouncilDecision> = {}, votes: CouncilVote[] = []): CouncilDecision {
  return {
    contractVersion: 2,
    stance: 'LONG',
    agreement: 0.6,
    opinionMass: { long: 0.6, short: 0.2, neutral: 0.2 },
    quorum: 4,
    riskGated: false,
    votes,
    computedAt: 1,
    ...over,
  };
}

function trend(t: OrderflowTrend | null): OrderflowTrendReading {
  return t === null
    ? { status: 'DADOS_INSUFICIENTES', reason: 'fixture', trend: null, recentSlope: null, priorSlope: null, computedAt: 1 }
    : { status: 'OK', reason: null, trend: t, recentSlope: 1, priorSlope: 0.5, computedAt: 1 };
}

describe('computeInstitutionalScore: contrato de apresentação sobre a confluência real — zero segunda matemática', () => {
  it('score = round(100 * convictionAdjusted ?? conviction) — nunca uma fórmula nova', () => {
    const r = computeInstitutionalScore({ engineStatus: 'ok', coreDirection: 'LONG', conviction: conviction({ conviction: 0.72 }), riskGated: false, now: 5 });
    expect(r.status).toBe('OK');
    expect(r.score).toBe(72);
    expect(r.opportunity).toBe(true); // 72 >= 60 padrão
  });

  it('prefere convictionAdjusted (amortecida por TrustScore real) quando medida', () => {
    const r = computeInstitutionalScore({ engineStatus: 'ok', coreDirection: 'SHORT', conviction: conviction({ conviction: 0.9, convictionAdjusted: 0.45 }), riskGated: false });
    expect(r.score).toBe(45);
    expect(r.opportunity).toBe(false); // 45 < 60
  });

  it('WAIT do Core Engine => score null honesto (sem oportunidade a pontuar), nunca um 0 fabricado', () => {
    const r = computeInstitutionalScore({ engineStatus: 'ok', coreDirection: 'WAIT', conviction: null, riskGated: false });
    expect(r.status).toBe('OK');
    expect(r.score).toBeNull();
    expect(r.opportunity).toBe(false);
    expect(r.reason).toContain('WAIT');
  });

  it('risco travado (fail-closed) => opportunity false mesmo com score alto — gate de comunicação, nunca de decisão (LEI 24)', () => {
    const r = computeInstitutionalScore({ engineStatus: 'ok', coreDirection: 'LONG', conviction: conviction({ conviction: 0.95 }), riskGated: true });
    expect(r.score).toBe(95); // o número real continua exibido
    expect(r.opportunity).toBe(false);
  });

  it('minScore configurável muda só o gate de comunicação, nunca o número real', () => {
    const base = { engineStatus: 'ok' as const, coreDirection: 'LONG' as const, conviction: conviction({ conviction: 0.5 }), riskGated: false };
    expect(computeInstitutionalScore({ ...base, minScore: 40 }).opportunity).toBe(true);
    expect(computeInstitutionalScore({ ...base, minScore: 60 }).opportunity).toBe(false);
    expect(DEFAULT_MIN_OPPORTUNITY_SCORE).toBe(60);
  });

  it('motor pending/error => DADOS_INSUFICIENTES — nunca pontua sem motor real', () => {
    expect(computeInstitutionalScore({ engineStatus: 'pending', coreDirection: 'LONG', conviction: conviction(), riskGated: false }).status).toBe('DADOS_INSUFICIENTES');
    expect(computeInstitutionalScore({ engineStatus: 'error', coreDirection: 'LONG', conviction: conviction(), riskGated: false }).status).toBe('DADOS_INSUFICIENTES');
  });

  it('direção real mas confluência indisponível => DADOS_INSUFICIENTES, nunca um score chutado', () => {
    const r = computeInstitutionalScore({ engineStatus: 'ok', coreDirection: 'LONG', conviction: null, riskGated: false });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.score).toBeNull();
  });
});

describe('buildAssistantMessages: tradução determinística de leituras reais — LEI 24, frases curtas, base verificável', () => {
  const okScore = computeInstitutionalScore({ engineStatus: 'ok', coreDirection: 'LONG', conviction: conviction({ conviction: 0.72 }), riskGated: false, now: 1 });

  it('Core LONG + CONFIRMS => "Compra favorecida" com basis citando os subsistemas reais', () => {
    const msgs = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'LONG', structureLabel: 'ALTA', conviction: conviction(), scoreReading: okScore, council: council(), inEntryZone: false, orderflowTrend: null });
    expect(msgs[0].text).toBe('Compra favorecida');
    expect(msgs[0].tone).toBe('POSITIVE');
    expect(msgs[0].basis).toContain('3/3');
  });

  it('Core SHORT + CONTRADICTS => "Venda perde força" (cautela real, nunca opinião própria)', () => {
    const msgs = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'SHORT', structureLabel: 'BAIXA', conviction: conviction({ coreDirection: 'SHORT', verdict: 'CONTRADICTS' }), scoreReading: null, council: null, inEntryZone: false, orderflowTrend: null });
    expect(msgs[0].text).toBe('Venda perde força');
    expect(msgs[0].tone).toBe('CAUTION');
  });

  it('WAIT + estrutura LATERAL => "Mercado lateral"; WAIT sem lateral => "Aguarde confirmação" — sempre espelho do Core', () => {
    const lateral = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'WAIT', structureLabel: 'LATERAL', conviction: null, scoreReading: null, council: null, inEntryZone: false, orderflowTrend: null });
    expect(lateral[0].text).toBe('Mercado lateral');
    const wait = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'WAIT', structureLabel: 'ALTA', conviction: null, scoreReading: null, council: null, inEntryZone: false, orderflowTrend: null });
    expect(wait[0].text).toBe('Aguarde confirmação');
  });

  it('risco travado vem PRIMEIRO ("Risco elevado") — a verdade mais urgente', () => {
    const msgs = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'LONG', structureLabel: 'ALTA', conviction: conviction(), scoreReading: okScore, council: council({ riskGated: true }), inEntryZone: false, orderflowTrend: null });
    expect(msgs[0].text).toBe('Risco elevado');
    expect(msgs[0].tone).toBe('RISK');
  });

  it('frases de score usam "confluência", nunca "probabilidade" (Regra de Ouro 2 — desvio documentado dos exemplos da diretriz)', () => {
    const msgs = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'LONG', structureLabel: 'ALTA', conviction: conviction(), scoreReading: okScore, council: null, inEntryZone: false, orderflowTrend: null });
    const scoreMsg = msgs.find((m) => m.text === 'Alta confluência');
    expect(scoreMsg).toBeDefined();
    for (const m of msgs) {
      expect(m.text.toLowerCase()).not.toContain('probabilidade');
    }
  });

  it('"Liquidez acima/abaixo" e "Fluxo comprador/vendedor" vêm dos votos REAIS do Conselho, nunca recalculados', () => {
    const c = council({}, [vote('LIQUIDITY', 'LONG'), vote('ORDERFLOW', 'SHORT')]);
    const msgs = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'WAIT', structureLabel: 'ALTA', conviction: null, scoreReading: null, council: c, inEntryZone: false, orderflowTrend: null });
    expect(msgs.map((m) => m.text)).toContain('Liquidez acima');
    expect(msgs.map((m) => m.text)).toContain('Fluxo vendedor');
  });

  it('§9/§18: "Fluxo comprador" ganha "fortalecendo"/"perdendo força" da tendência REAL — honra o exemplo literal da diretriz sem 2ª medida', () => {
    const cLong = council({}, [vote('ORDERFLOW', 'LONG')]);
    const strengthening = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'WAIT', structureLabel: 'ALTA', conviction: null, scoreReading: null, council: cLong, inEntryZone: false, orderflowTrend: trend('FORTALECENDO') });
    expect(strengthening.map((m) => m.text)).toContain('Fluxo comprador fortalecendo');

    const weakening = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'WAIT', structureLabel: 'ALTA', conviction: null, scoreReading: null, council: cLong, inEntryZone: false, orderflowTrend: trend('ENFRAQUECENDO') });
    expect(weakening.map((m) => m.text)).toContain('Fluxo comprador perdendo força');
  });

  it('§9/§18: para "Fluxo vendedor" o rótulo se INVERTE — ENFRAQUECENDO (da pressão compradora) = venda fortalecendo', () => {
    const cShort = council({}, [vote('ORDERFLOW', 'SHORT')]);
    const strengthening = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'WAIT', structureLabel: 'ALTA', conviction: null, scoreReading: null, council: cShort, inEntryZone: false, orderflowTrend: trend('ENFRAQUECENDO') });
    expect(strengthening.map((m) => m.text)).toContain('Fluxo vendedor fortalecendo');

    const weakening = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'WAIT', structureLabel: 'ALTA', conviction: null, scoreReading: null, council: cShort, inEntryZone: false, orderflowTrend: trend('FORTALECENDO') });
    expect(weakening.map((m) => m.text)).toContain('Fluxo vendedor perdendo força');
  });

  it('FAIL_CLOSED: ESTAVEL ou tendência indisponível => sem qualificador — nunca "fortalecendo" forçado', () => {
    const cLong = council({}, [vote('ORDERFLOW', 'LONG')]);
    const stable = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'WAIT', structureLabel: 'ALTA', conviction: null, scoreReading: null, council: cLong, inEntryZone: false, orderflowTrend: trend('ESTAVEL') });
    expect(stable.map((m) => m.text)).toContain('Fluxo comprador');
    const insufficient = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'WAIT', structureLabel: 'ALTA', conviction: null, scoreReading: null, council: cLong, inEntryZone: false, orderflowTrend: trend(null) });
    expect(insufficient.map((m) => m.text)).toContain('Fluxo comprador');
  });

  it('teto real de 3 mensagens mesmo com muitas verdades simultâneas — "nunca utilizar textos longos"', () => {
    const c = council({ riskGated: true }, [vote('LIQUIDITY', 'LONG'), vote('ORDERFLOW', 'LONG')]);
    const msgs = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'LONG', structureLabel: 'ALTA', conviction: conviction(), scoreReading: okScore, council: c, inEntryZone: true, orderflowTrend: null });
    expect(msgs.length).toBeLessThanOrEqual(ASSISTANT_MAX_MESSAGES);
  });

  it('motor pending/error => uma única mensagem de saúde, nenhuma frase operacional fabricada', () => {
    const pending = buildAssistantMessages({ engineStatus: 'pending', coreDirection: 'LONG', structureLabel: 'ALTA', conviction: conviction(), scoreReading: okScore, council: council(), inEntryZone: true, orderflowTrend: null });
    expect(pending).toHaveLength(1);
    expect(pending[0].text).toBe('Aguardando dados reais');
    const error = buildAssistantMessages({ engineStatus: 'error', coreDirection: 'LONG', structureLabel: 'ALTA', conviction: null, scoreReading: null, council: null, inEntryZone: false, orderflowTrend: null });
    expect(error).toHaveLength(1);
    expect(error[0].tone).toBe('RISK');
  });

  it('toda mensagem carrega basis real não-vazia — "nunca gerar recomendações sem justificativa"', () => {
    const c = council({}, [vote('LIQUIDITY', 'SHORT'), vote('ORDERFLOW', 'LONG')]);
    const msgs = buildAssistantMessages({ engineStatus: 'ok', coreDirection: 'LONG', structureLabel: 'ALTA', conviction: conviction({ verdict: 'MIXED' }), scoreReading: okScore, council: c, inEntryZone: true, orderflowTrend: null });
    for (const m of msgs) expect(m.basis.length).toBeGreaterThan(10);
  });
});
