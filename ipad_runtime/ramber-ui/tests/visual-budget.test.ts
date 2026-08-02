// visual-budget.test.ts — Diretriz Nº 02 ("Camada de Inteligência
// Visual", seção "BUDGET VISUAL"): execução real do motor puro
// resolveVisualBudget. Convenção deste repo para lógica de fronteira
// (matemática nova ganha teste de execução real, não de padrão de fonte).
import { describe, it, expect } from 'vitest';
import {
  resolveVisualBudget,
  VISUAL_BUDGET_PRIORITY_ORDER,
  VISUAL_BUDGET_FLOOR_WEIGHT,
  DEFAULT_VISUAL_BUDGET,
  type VisualBudgetCandidate,
} from '../src/nexus/visual-budget';

describe('VISUAL_BUDGET_PRIORITY_ORDER: os 7 níveis reais declarados pela diretiva, na ordem exata', () => {
  it('7 categorias reais, ordem exata (Trade Plan > Zona Institucional > Alvos > Invalidação > Radar > Liquidez Principal > Estrutura)', () => {
    expect(VISUAL_BUDGET_PRIORITY_ORDER).toEqual([
      'TRADE_PLAN',
      'INSTITUTIONAL_ZONE',
      'TARGET',
      'INVALIDATION',
      'RADAR',
      'MAIN_LIQUIDITY',
      'STRUCTURE',
    ]);
  });
});

describe('resolveVisualBudget: dentro do orçamento real => peso pleno, zero redução (Regra de Ouro 4: nada perde ênfase sem competição real)', () => {
  it('candidatos cujo peso somado cabe no orçamento real: cada um recebe exatamente seu baseWeight', () => {
    const candidates: VisualBudgetCandidate[] = [
      { id: 'plan', category: 'TRADE_PLAN', baseWeight: 1 },
      { id: 'zone1', category: 'INSTITUTIONAL_ZONE', baseWeight: 0.8 },
    ];
    const results = resolveVisualBudget(candidates, 4);
    expect(results.find((r) => r.id === 'plan')).toEqual({ id: 'plan', category: 'TRADE_PLAN', visualWeight: 1, reduced: false });
    expect(results.find((r) => r.id === 'zone1')).toEqual({ id: 'zone1', category: 'INSTITUTIONAL_ZONE', visualWeight: 0.8, reduced: false });
  });

  it('lista vazia real => resultado vazio, nunca um objeto fabricado', () => {
    expect(resolveVisualBudget([], 4)).toEqual([]);
  });
});

describe('resolveVisualBudget: competição real por orçamento — prioridade mais alta (declarada pela diretiva) sempre vence', () => {
  it('três categorias de peso pleno (baseWeight 1, o máximo real) excedendo o orçamento: a de prioridade mais baixa perde ênfase, nunca a mais alta', () => {
    const candidates: VisualBudgetCandidate[] = [
      { id: 'plan', category: 'TRADE_PLAN', baseWeight: 1 },
      { id: 'zone', category: 'INSTITUTIONAL_ZONE', baseWeight: 1 },
      { id: 'target1', category: 'TARGET', baseWeight: 1 },
    ];
    const results = resolveVisualBudget(candidates, 2.5);
    const plan = results.find((r) => r.id === 'plan')!;
    const zone = results.find((r) => r.id === 'zone')!;
    const target = results.find((r) => r.id === 'target1')!;
    expect(plan.visualWeight).toBe(1);
    expect(plan.reduced).toBe(false);
    expect(zone.visualWeight).toBe(1);
    expect(zone.reduced).toBe(false);
    expect(target.reduced).toBe(true);
    expect(target.visualWeight).toBeLessThan(1);
  });

  it('ordem de ENTRADA nunca importa — o resultado depende só da prioridade real declarada, nunca da ordem do array', () => {
    const candidates: VisualBudgetCandidate[] = [
      { id: 'structure', category: 'STRUCTURE', baseWeight: 1 },
      { id: 'plan', category: 'TRADE_PLAN', baseWeight: 1 },
      { id: 'liquidity', category: 'MAIN_LIQUIDITY', baseWeight: 1 },
    ];
    const forward = resolveVisualBudget(candidates, 2);
    const backward = resolveVisualBudget([...candidates].reverse(), 2);
    const sortById = (arr: typeof forward) => [...arr].sort((a, b) => a.id.localeCompare(b.id));
    expect(sortById(forward)).toEqual(sortById(backward));
  });

  it('dentro da MESMA categoria real, o candidato de maior baseWeight real vence o de menor', () => {
    const candidates: VisualBudgetCandidate[] = [
      { id: 'zoneWeak', category: 'INSTITUTIONAL_ZONE', baseWeight: 0.5 },
      { id: 'zoneStrong', category: 'INSTITUTIONAL_ZONE', baseWeight: 1 },
    ];
    const results = resolveVisualBudget(candidates, 1.2);
    const strong = results.find((r) => r.id === 'zoneStrong')!;
    const weak = results.find((r) => r.id === 'zoneWeak')!;
    expect(strong.visualWeight).toBe(1);
    expect(strong.reduced).toBe(false);
    expect(weak.reduced).toBe(true);
  });
});

describe('resolveVisualBudget: piso real — nenhum objeto cai abaixo de VISUAL_BUDGET_FLOOR_WEIGHT (nunca "some" por competição)', () => {
  it('orçamento real esgotado por itens de prioridade mais alta: item de prioridade mais baixa nunca cai abaixo do piso', () => {
    const candidates: VisualBudgetCandidate[] = [
      { id: 'plan', category: 'TRADE_PLAN', baseWeight: 1 },
      { id: 'structure', category: 'STRUCTURE', baseWeight: 1 },
    ];
    const results = resolveVisualBudget(candidates, 1);
    const structure = results.find((r) => r.id === 'structure')!;
    expect(structure.visualWeight).toBe(VISUAL_BUDGET_FLOOR_WEIGHT);
    expect(structure.reduced).toBe(true);
  });

  it('orçamento real zero ou negativo (uso indevido): todo candidato real cai no piso, nunca lança nem devolve peso negativo', () => {
    const candidates: VisualBudgetCandidate[] = [{ id: 'plan', category: 'TRADE_PLAN', baseWeight: 1 }];
    expect(() => resolveVisualBudget(candidates, 0)).not.toThrow();
    expect(resolveVisualBudget(candidates, 0)[0].visualWeight).toBe(VISUAL_BUDGET_FLOOR_WEIGHT);
    expect(resolveVisualBudget(candidates, -5)[0].visualWeight).toBe(VISUAL_BUDGET_FLOOR_WEIGHT);
  });

  it('baseWeight real 0 (candidato honestamente sem força real) nunca é inflado até o piso — piso é só para REDUÇÃO por competição, nunca um mínimo artificial', () => {
    const candidates: VisualBudgetCandidate[] = [{ id: 'zero', category: 'STRUCTURE', baseWeight: 0 }];
    const results = resolveVisualBudget(candidates, 4);
    expect(results[0].visualWeight).toBe(0);
    expect(results[0].reduced).toBe(false);
  });
});

describe('resolveVisualBudget: baseWeight real grampeado a [0,1] — nunca um peso final fora de faixa', () => {
  it('baseWeight > 1 é grampeado a 1 antes de qualquer cálculo', () => {
    const results = resolveVisualBudget([{ id: 'over', category: 'TRADE_PLAN', baseWeight: 5 }], 4);
    expect(results[0].visualWeight).toBe(1);
  });

  it('baseWeight negativo é grampeado a 0', () => {
    const results = resolveVisualBudget([{ id: 'neg', category: 'TRADE_PLAN', baseWeight: -3 }], 4);
    expect(results[0].visualWeight).toBe(0);
  });
});

describe('resolveVisualBudget: preserva identidade e categoria reais no resultado — puro passthrough, nunca reinterpretado', () => {
  it('id e category do candidato real aparecem intactos no resultado', () => {
    const results = resolveVisualBudget([{ id: 'radar-BTCUSDT-15m', category: 'RADAR', baseWeight: 0.6 }], 4);
    expect(results[0].id).toBe('radar-BTCUSDT-15m');
    expect(results[0].category).toBe('RADAR');
  });
});

describe('DEFAULT_VISUAL_BUDGET: convenção declarada real, documentada, usada quando o chamador não especifica', () => {
  it('resolveVisualBudget sem 2º argumento usa DEFAULT_VISUAL_BUDGET, mesmo resultado que passá-lo explicitamente', () => {
    const candidates: VisualBudgetCandidate[] = [
      { id: 'a', category: 'TRADE_PLAN', baseWeight: 3 },
      { id: 'b', category: 'STRUCTURE', baseWeight: 3 },
    ];
    expect(resolveVisualBudget(candidates)).toEqual(resolveVisualBudget(candidates, DEFAULT_VISUAL_BUDGET));
  });
});
