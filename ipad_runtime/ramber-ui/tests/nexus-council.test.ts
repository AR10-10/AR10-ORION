// nexus-council.test.ts — V-MAX Fase 1 item 4: trava o Conselho
// Multi-Agente. Cada agente é puro: sem dado real => ABSTAIN honesto,
// nunca um voto fabricado. O Meta-Agent delega a agregação ao linear
// opinion pool REAL da Fase F (zero repetição) e aplica quórum + gate de
// risco fail-closed por cima.
import { describe, it, expect } from 'vitest';
import {
  liquidityAgentVote,
  structureAgentVote,
  orderflowAgentVote,
  riskAgentVote,
  manipulationAgentVote,
  fibonacciAgentVote,
  aggregateCouncil,
  buildCouncilDecision,
  COUNCIL_CONTRACT_VERSION,
  type CouncilVote,
  type CouncilLiquidityZone,
} from '../src/nexus/council';
import type { FibonacciConfluenceMatrix } from '../src/nexus/fibonacci-confluence';

const eqh = (price: number, swept = false): CouncilLiquidityZone => ({ type: 'EQUAL_HIGH', price, swept });
const eql = (price: number, swept = false): CouncilLiquidityZone => ({ type: 'EQUAL_LOW', price, swept });

const healthyRisk = { offline: false, isDataFresh: true, engineStatus: 'ok' as const };

const vote = (agent: CouncilVote['agent'], stance: CouncilVote['stance'], confidence: number | null): CouncilVote => ({
  agent, stance, confidence, rationale: 'fixture', evidence: [],
});

describe('LiquidityAgent: draw on liquidity real (pools EQH/EQL não varridos vs preço)', () => {
  it('ABSTAIN sem preço real de referência', () => {
    expect(liquidityAgentVote([eqh(110)], null).stance).toBe('ABSTAIN');
  });

  it('ABSTAIN sem nenhum pool intacto mapeado', () => {
    expect(liquidityAgentVote([], 100).stance).toBe('ABSTAIN');
    // pools varridos não contam como intactos
    expect(liquidityAgentVote([eqh(110, true), eql(90, true)], 100).stance).toBe('ABSTAIN');
  });

  it('mais EQH intactos acima => LONG com confiança do desequilíbrio real', () => {
    const v = liquidityAgentVote([eqh(110), eqh(115), eql(90)], 100);
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBeCloseTo(1 / 3, 10); // |2-1|/3
  });

  it('mais EQL intactos abaixo => SHORT; equilíbrio exato => NEUTRAL conf 0', () => {
    expect(liquidityAgentVote([eql(90), eql(85)], 100).stance).toBe('SHORT');
    const n = liquidityAgentVote([eqh(110), eql(90)], 100);
    expect(n.stance).toBe('NEUTRAL');
    expect(n.confidence).toBe(0);
  });
});

describe('StructureAgent: rótulos reais 15m+1H, confiança = desequilíbrio entre leituras', () => {
  it('ABSTAIN sem nenhum rótulo real', () => {
    expect(structureAgentVote(null, null).stance).toBe('ABSTAIN');
  });

  it('duas leituras concordando => confiança 1', () => {
    const v = structureAgentVote('ALTA', 'ALTA');
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBe(1);
  });

  it('conflito direto de timeframes reais => NEUTRAL conf 0', () => {
    const v = structureAgentVote('ALTA', 'BAIXA');
    expect(v.stance).toBe('NEUTRAL');
    expect(v.confidence).toBe(0);
  });

  it('uma única leitura real disponível vota sozinha com confiança 1', () => {
    const v = structureAgentVote('BAIXA', null);
    expect(v.stance).toBe('SHORT');
    expect(v.confidence).toBe(1);
  });

  it('LATERAL real => NEUTRAL, nunca inventa direção', () => {
    expect(structureAgentVote('LATERAL', 'LATERAL').stance).toBe('NEUTRAL');
  });
});

describe('OrderflowAgent: CVD real dá a direção; OFI reais corroboram a confiança', () => {
  it('ABSTAIN sem CVD real', () => {
    expect(orderflowAgentVote(null, []).stance).toBe('ABSTAIN');
  });

  it('CVD positivo com OFI concordando => LONG com confiança = fração real', () => {
    const v = orderflowAgentVote(120, [
      { type: 'OFI', metadata: { imbalance: 0.4 } },
      { type: 'OFI', metadata: { imbalance: -0.2 } },
      { type: 'OFI', metadata: { imbalance: 0.7 } },
    ]);
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBeCloseTo(2 / 3, 10);
  });

  it('sem OFI na janela => direção nua com confiança 0 honesta (nunca um chute)', () => {
    const v = orderflowAgentVote(-50, [{ type: 'ABSORPTION', metadata: {} }]);
    expect(v.stance).toBe('SHORT');
    expect(v.confidence).toBe(0);
  });

  it('CVD exatamente zero => NEUTRAL', () => {
    expect(orderflowAgentVote(0, []).stance).toBe('NEUTRAL');
  });
});

describe('RiskAgent: nunca vota direção; degradação real => ABSTAIN (gate)', () => {
  it('operação viável => NEUTRAL com confiança 1', () => {
    const v = riskAgentVote(healthyRisk);
    expect(v.stance).toBe('NEUTRAL');
    expect(v.confidence).toBe(1);
  });

  it('offline/stale/motor-erro/pending => ABSTAIN listando as falhas reais', () => {
    expect(riskAgentVote({ ...healthyRisk, offline: true }).stance).toBe('ABSTAIN');
    expect(riskAgentVote({ ...healthyRisk, isDataFresh: false }).stance).toBe('ABSTAIN');
    expect(riskAgentVote({ ...healthyRisk, engineStatus: 'error' }).stance).toBe('ABSTAIN');
    const v = riskAgentVote({ offline: true, isDataFresh: false, engineStatus: 'pending' });
    expect(v.stance).toBe('ABSTAIN');
    expect(v.evidence.length).toBe(3);
  });
});

describe('ManipulationAgent: só sweeps REAIS contam como evidência', () => {
  it('ABSTAIN sem nenhum sweep real na janela', () => {
    expect(manipulationAgentVote([eqh(110), eql(90)]).stance).toBe('ABSTAIN');
  });

  it('EQH varrido (liquidez compradora tomada) => leitura SHORT', () => {
    const v = manipulationAgentVote([eqh(110, true), eql(90)]);
    expect(v.stance).toBe('SHORT');
    expect(v.confidence).toBe(1);
  });

  it('EQL varrido => leitura LONG; sweeps iguais dos dois lados => NEUTRAL', () => {
    expect(manipulationAgentVote([eql(90, true)]).stance).toBe('LONG');
    expect(manipulationAgentVote([eqh(110, true), eql(90, true)]).stance).toBe('NEUTRAL');
  });
});

describe('FibonacciAgent: vota da matriz real (fontes já incluem POC/HVN do WASM)', () => {
  const matrix = (bestScore: number, legIsUp: boolean): FibonacciConfluenceMatrix => ({
    legLow: 100, legHigh: 200, legIsUp, toleranceAbs: 2,
    levels: [
      { ratio: 0.382, price: legIsUp ? 161.8 : 138.2, score: 0, matches: [] },
      {
        ratio: 0.618, price: legIsUp ? 138.2 : 161.8, score: bestScore,
        matches: Array.from({ length: bestScore }, (_, i) => ({ kind: i === 0 ? 'VP_POC' : `SRC_${i}`, priceLow: 0, priceHigh: 0 })),
      },
    ],
    computedAt: 1,
  });

  it('ABSTAIN sem matriz (sem perna real confirmada)', () => {
    expect(fibonacciAgentVote(null).stance).toBe('ABSTAIN');
  });

  it('ABSTAIN com níveis reais mas zero confluência', () => {
    expect(fibonacciAgentVote(matrix(0, true)).stance).toBe('ABSTAIN');
  });

  it('confluência real em perna de alta => LONG; 3+ fontes => confiança plena', () => {
    const v = fibonacciAgentVote(matrix(3, true));
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBe(1);
    expect(v.evidence).toContain('VP_POC'); // o cruzamento transversal com o WASM é visível no debate
  });

  it('perna de baixa => SHORT; 1 fonte => confiança parcial (1/3)', () => {
    const v = fibonacciAgentVote(matrix(1, false));
    expect(v.stance).toBe('SHORT');
    expect(v.confidence).toBeCloseTo(1 / 3, 10);
  });
});

describe('Meta-Agent: quórum + gate de risco + pool real da Fase F', () => {
  it('RiskAgent ABSTAIN trava o conselho inteiro (fail-closed), mas o debate sai completo', () => {
    const votes = [
      vote('LIQUIDITY', 'LONG', 1),
      vote('STRUCTURE', 'LONG', 1),
      vote('ORDERFLOW', 'LONG', 1),
      vote('RISK', 'ABSTAIN', null),
      vote('MANIPULATION', 'LONG', 1),
      vote('FIBONACCI', 'LONG', 1),
    ];
    const d = aggregateCouncil(votes, 123);
    expect(d.stance).toBe('ABSTAIN');
    expect(d.riskGated).toBe(true);
    expect(d.agreement).toBeNull();
    expect(d.votes).toHaveLength(6);
    expect(d.contractVersion).toBe(COUNCIL_CONTRACT_VERSION);
  });

  it('quórum zero (todos os direcionais ABSTAIN) => conselho ABSTAIN mesmo com risco ok', () => {
    const votes = [
      vote('LIQUIDITY', 'ABSTAIN', null),
      vote('STRUCTURE', 'ABSTAIN', null),
      vote('ORDERFLOW', 'ABSTAIN', null),
      vote('RISK', 'NEUTRAL', 1),
      vote('MANIPULATION', 'ABSTAIN', null),
      vote('FIBONACCI', 'ABSTAIN', null),
    ];
    const d = aggregateCouncil(votes, 123);
    expect(d.stance).toBe('ABSTAIN');
    expect(d.riskGated).toBe(false);
    expect(d.quorum).toBe(0);
  });

  it('maioria real LONG => stance LONG com agreement = desequilíbrio do pool', () => {
    const votes = [
      vote('LIQUIDITY', 'LONG', 1),
      vote('STRUCTURE', 'LONG', 1),
      vote('ORDERFLOW', 'SHORT', 0.5),
      vote('RISK', 'NEUTRAL', 1),
      vote('MANIPULATION', 'ABSTAIN', null),
      vote('FIBONACCI', 'LONG', 1),
    ];
    const d = aggregateCouncil(votes, 123);
    expect(d.stance).toBe('LONG');
    expect(d.quorum).toBe(4);
    expect(d.agreement).toBeGreaterThan(0);
    expect(d.agreement).toBeLessThanOrEqual(1);
  });

  it('conselho perfeitamente dividido => NEUTRAL (nunca fabrica direção)', () => {
    const votes = [
      vote('LIQUIDITY', 'LONG', 1),
      vote('STRUCTURE', 'SHORT', 1),
      vote('ORDERFLOW', 'ABSTAIN', null),
      vote('RISK', 'NEUTRAL', 1),
      vote('MANIPULATION', 'ABSTAIN', null),
      vote('FIBONACCI', 'ABSTAIN', null),
    ];
    const d = aggregateCouncil(votes, 123);
    expect(d.stance).toBe('NEUTRAL');
  });
});

describe('buildCouncilDecision: composição de ponta a ponta com dados reais mínimos', () => {
  it('cenário saudável e concordante produz decisão direcional com 6 votos', () => {
    const d = buildCouncilDecision({
      price: 100,
      liquidityZones: [eqh(110), eqh(112), eql(95)],
      structure15: 'ALTA',
      structure1h: 'ALTA',
      cvd: 250,
      orderflowSignals: [{ type: 'OFI', metadata: { imbalance: 0.5 } }],
      offline: false,
      isDataFresh: true,
      engineStatus: 'ok',
      fibonacci: null, // fib ABSTAIN — quórum segue real com os demais
    }, 999);
    expect(d.votes).toHaveLength(6);
    expect(d.stance).toBe('LONG');
    expect(d.riskGated).toBe(false);
    expect(d.computedAt).toBe(999);
  });

  it('boot frio (nada real ainda) => ABSTAIN honesto via gate de risco', () => {
    const d = buildCouncilDecision({
      price: null,
      liquidityZones: [],
      structure15: null,
      structure1h: null,
      cvd: null,
      orderflowSignals: [],
      offline: false,
      isDataFresh: false,
      engineStatus: 'pending',
      fibonacci: null,
    });
    expect(d.stance).toBe('ABSTAIN');
    expect(d.riskGated).toBe(true);
  });
});
