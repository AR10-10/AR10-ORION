// nexus-model-fusion.test.ts — Escopo Cirúrgico (Operador, Fase 2,
// confirmada via AskUserQuestion): execução real dos adaptadores (reusam
// council.ts, zero segunda implementação) e do pool linear de opinião.
import { describe, it, expect } from 'vitest';
import {
  smcLiquidityModelVote,
  smcManipulationModelVote,
  orderflowModelVote,
  regimeModelVote,
  fuseModelVotes,
  councilVotesToModelVotes,
  alignFusedConfidence,
  REGIME_CONFIDENCE_ADX_SCALE,
  type ModelVote,
  type FusedReading,
} from '../src/nexus/model-fusion';
import type { CouncilLiquidityZone, CouncilOrderflowSignal, CouncilVote } from '../src/nexus/council';

function councilVote(agent: CouncilVote['agent'], stance: CouncilVote['stance'], confidence: number | null): CouncilVote {
  return { agent, stance, confidence, rationale: 'teste', evidence: [] };
}

const eqh = (price: number, swept = false): CouncilLiquidityZone => ({ type: 'EQUAL_HIGH', price, swept });
const eql = (price: number, swept = false): CouncilLiquidityZone => ({ type: 'EQUAL_LOW', price, swept });

describe('smcLiquidityModelVote / smcManipulationModelVote: reusam council.ts, zero segunda matemática', () => {
  it('liquidez: mesma direção/confiança que liquidityAgentVote produziria (EQH intacto acima do preço => LONG, "draw on liquidity")', () => {
    const v = smcLiquidityModelVote([eqh(110), eqh(115)], 100);
    expect(v.model).toBe('SMC_LIQUIDITY');
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBe(1);
  });

  it('liquidez: sem preço real => ABSTAIN honesto', () => {
    expect(smcLiquidityModelVote([eqh(110)], null).stance).toBe('ABSTAIN');
  });

  it('manipulação: sweep real de um lado só => direção real', () => {
    const v = smcManipulationModelVote([eqh(110, true), eqh(115, true)]);
    expect(v.model).toBe('SMC_MANIPULATION');
    expect(v.stance).not.toBe('ABSTAIN');
  });

  it('manipulação: nenhum sweep real => ABSTAIN honesto', () => {
    expect(smcManipulationModelVote([eqh(110), eql(90)]).stance).toBe('ABSTAIN');
  });
});

describe('orderflowModelVote: reusa orderflowAgentVote (council.ts)', () => {
  it('CVD positivo real => LONG', () => {
    const signals: CouncilOrderflowSignal[] = [{ type: 'OFI', metadata: { imbalance: 0.5 } }];
    const v = orderflowModelVote(120, signals);
    expect(v.model).toBe('ORDERFLOW');
    expect(v.stance).toBe('LONG');
  });

  it('sem CVD real => ABSTAIN honesto', () => {
    expect(orderflowModelVote(null, []).stance).toBe('ABSTAIN');
  });
});

describe('regimeModelVote: conversão NOVA e documentada (adx/100), nunca fabricada como medição', () => {
  it('ALTA + ADX real => LONG, confidence = adx/100 clamped', () => {
    const v = regimeModelVote('ALTA', 40);
    expect(v.model).toBe('REGIME');
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBeCloseTo(40 / REGIME_CONFIDENCE_ADX_SCALE, 10);
  });

  it('BAIXA => SHORT', () => {
    expect(regimeModelVote('BAIXA', 30).stance).toBe('SHORT');
  });

  it('ADX acima da escala => confidence clampada em 1, nunca > 1', () => {
    expect(regimeModelVote('ALTA', 150).confidence).toBe(1);
  });

  it('direção ou ADX ausente => ABSTAIN honesto, nunca um voto fabricado', () => {
    expect(regimeModelVote(null, 40).stance).toBe('ABSTAIN');
    expect(regimeModelVote('ALTA', null).stance).toBe('ABSTAIN');
    expect(regimeModelVote('ALTA', NaN).stance).toBe('ABSTAIN');
  });
});

function vote(model: ModelVote['model'], stance: ModelVote['stance'], confidence: number | null): ModelVote {
  return { model, stance, confidence };
}

describe('fuseModelVotes: pool linear de opinião (Stone/DeGroot) — NUNCA probabilidade', () => {
  it('todos os votos reais LONG e unânimes => stance LONG, disagreement 0', () => {
    const reading = fuseModelVotes([
      vote('SMC_LIQUIDITY', 'LONG', 0.8),
      vote('ORDERFLOW', 'LONG', 0.6),
      vote('REGIME', 'LONG', 0.4),
    ]);
    expect(reading!.stance).toBe('LONG');
    expect(reading!.disagreement).toBe(0);
    expect(reading!.fusedConfidence).toBeCloseTo((0.8 + 0.6 + 0.4) / 3, 10);
    expect(reading!.effectiveConfidence).toBeCloseTo(reading!.fusedConfidence, 10); // sem desacordo, nenhum desconto
  });

  it('votos divididos ao meio (2 LONG, 2 SHORT, mesma confidence) => NEUTRAL, disagreement 1', () => {
    const reading = fuseModelVotes([
      vote('SMC_LIQUIDITY', 'LONG', 0.5),
      vote('SMC_MANIPULATION', 'SHORT', 0.5),
      vote('ORDERFLOW', 'LONG', 0.5),
      vote('REGIME', 'SHORT', 0.5),
    ]);
    expect(reading!.stance).toBe('NEUTRAL');
    expect(reading!.disagreement).toBe(1);
    expect(reading!.effectiveConfidence).toBe(0); // desacordo total => nenhuma confiança efetiva sobra
  });

  it('maioria real LONG com 1 SHORT dissidente => stance segue a maioria, effectiveConfidence < fusedConfidence', () => {
    const reading = fuseModelVotes([
      vote('SMC_LIQUIDITY', 'LONG', 0.9),
      vote('ORDERFLOW', 'LONG', 0.9),
      vote('REGIME', 'SHORT', 0.9),
    ]);
    expect(reading!.stance).toBe('LONG');
    expect(reading!.disagreement).toBeGreaterThan(0);
    expect(reading!.effectiveConfidence).toBeLessThan(reading!.fusedConfidence);
  });

  it('todos ABSTAIN (nenhum voto real) => null honesto, nunca uma leitura fabricada', () => {
    expect(
      fuseModelVotes([vote('SMC_LIQUIDITY', 'ABSTAIN', null), vote('ORDERFLOW', 'ABSTAIN', null)]),
    ).toBeNull();
  });

  it('lista vazia => null honesto', () => {
    expect(fuseModelVotes([])).toBeNull();
  });

  it('pesos diferentes mudam o resultado — modelo de peso maior domina', () => {
    const votes: ModelVote[] = [vote('SMC_LIQUIDITY', 'LONG', 0.3), vote('REGIME', 'SHORT', 0.3)];
    const equalWeights = fuseModelVotes(votes, { SMC_LIQUIDITY: 1, SMC_MANIPULATION: 1, ORDERFLOW: 1, REGIME: 1 });
    const regimeDominant = fuseModelVotes(votes, { SMC_LIQUIDITY: 1, SMC_MANIPULATION: 1, ORDERFLOW: 1, REGIME: 10 });
    expect(equalWeights!.stance).toBe('NEUTRAL'); // empate exato com pesos iguais
    expect(regimeDominant!.stance).toBe('SHORT'); // REGIME domina com peso maior
  });

  it('votos com stance NEUTRAL real contam pro desacordo mas não somam confidence direcional', () => {
    const reading = fuseModelVotes([vote('SMC_LIQUIDITY', 'LONG', 0.5), vote('ORDERFLOW', 'NEUTRAL', 0)]);
    expect(reading!.stance).toBe('LONG');
  });
});

describe('councilVotesToModelVotes: reusa a MESMA CouncilDecision do ciclo, zero segunda chamada aos agentes', () => {
  it('mapeia LIQUIDITY/MANIPULATION/ORDERFLOW para os ModelId reais, preservando stance/confidence', () => {
    const out = councilVotesToModelVotes([
      councilVote('LIQUIDITY', 'LONG', 0.7),
      councilVote('MANIPULATION', 'SHORT', 0.4),
      councilVote('ORDERFLOW', 'NEUTRAL', 0),
    ]);
    expect(out).toEqual<ModelVote[]>([
      { model: 'SMC_LIQUIDITY', stance: 'LONG', confidence: 0.7 },
      { model: 'SMC_MANIPULATION', stance: 'SHORT', confidence: 0.4 },
      { model: 'ORDERFLOW', stance: 'NEUTRAL', confidence: 0 },
    ]);
  });

  it('ignora agentes sem modelo equivalente (STRUCTURE/RISK/FIBONACCI/MOMENTUM) — não fazem parte da cobertura real desta fusão', () => {
    const out = councilVotesToModelVotes([
      councilVote('STRUCTURE', 'LONG', 0.5),
      councilVote('RISK', 'ABSTAIN', null),
      councilVote('FIBONACCI', 'LONG', 0.5),
      councilVote('MOMENTUM', 'SHORT', 0.5),
    ]);
    expect(out).toEqual([]);
  });

  it('ABSTAIN real (sem dado do agente) passa adiante honestamente — quem consome fuseModelVotes já sabe filtrar', () => {
    const out = councilVotesToModelVotes([councilVote('LIQUIDITY', 'ABSTAIN', null)]);
    expect(out).toEqual<ModelVote[]>([{ model: 'SMC_LIQUIDITY', stance: 'ABSTAIN', confidence: null }]);
  });

  it('lista vazia => lista vazia', () => {
    expect(councilVotesToModelVotes([])).toEqual([]);
  });
});

function fusedReading(stance: FusedReading['stance'], effectiveConfidence: number): FusedReading {
  return { stance, fusedConfidence: effectiveConfidence, effectiveConfidence, disagreement: 0, votes: [] };
}

describe('alignFusedConfidence: orienta a fusão (LEI 24, informativa) à direção REAL do plano — nunca a direção que os modelos preferiam', () => {
  it('fused null (nenhum modelo real) => null honesto, nunca 0 fabricado', () => {
    expect(alignFusedConfidence(null, 'LONG')).toBeNull();
  });

  it('fused.stance concorda com a direção do plano => sinal positivo = effectiveConfidence', () => {
    expect(alignFusedConfidence(fusedReading('LONG', 0.65), 'LONG')).toBeCloseTo(0.65, 10);
    expect(alignFusedConfidence(fusedReading('SHORT', 0.65), 'SHORT')).toBeCloseTo(0.65, 10);
  });

  it('fused.stance DIVERGE da direção do plano (LEI 24: estado real esperado, nunca escondido) => sinal negativo', () => {
    expect(alignFusedConfidence(fusedReading('SHORT', 0.65), 'LONG')).toBeCloseTo(-0.65, 10);
    expect(alignFusedConfidence(fusedReading('LONG', 0.65), 'SHORT')).toBeCloseTo(-0.65, 10);
  });

  it('fused.stance NEUTRAL => 0, independente da direção do plano', () => {
    expect(alignFusedConfidence(fusedReading('NEUTRAL', 0), 'LONG')).toBe(0);
    expect(alignFusedConfidence(fusedReading('NEUTRAL', 0), 'SHORT')).toBe(0);
  });
});
