// target-hit-rate.test.ts — execução REAL (a pergunta aqui é "os números
// estão certos?", não "ligaram A com B" — convenção mista do CLAUDE.md).
//
// O ponto de prova principal é o DENOMINADOR: um plano de 2 alvos nunca
// poderia alcançar o TP3, e contá-lo no denominador do TP3 afundaria a
// taxa com planos que jamais ofereceram aquele alvo. Vários testes abaixo
// existem só para travar isso — é o erro que a conta ingênua comete, e
// erra sempre para o mesmo lado (pessimista no alvo mais distante).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeTargetHitRates, describeTargetHitRates } from '../src/nexus/target-hit-rate';
import type { TrackedPlan } from '../src/nexus/signal-track-record';
import { MAX_TARGETS, type TradePlan } from '../src/nexus/trade-plan';

function makePlan(targetPrices: number[]): TradePlan {
  return {
    contractVersion: 2,
    direction: 'LONG',
    entry: { low: 99, high: 101, basis: 'SR_SUPPORT_1' },
    stop: { price: 90, basis: 'SR_SUPPORT_1' },
    targets: targetPrices.map((price) => ({ price, basis: 'SR_RESISTANCE_1' })),
    riskRewardRatios: targetPrices.map(() => 1),
    computedAt: 1_700_000_000_000,
  };
}

/** Um plano resolvido de verdade, com N alvos oferecidos e H realmente
 *  alcançados — os dois eixos que este módulo cruza. */
function resolved(
  status: TrackedPlan['status'],
  targetCount: number,
  targetsHit: number,
): TrackedPlan {
  const prices = Array.from({ length: targetCount }, (_, i) => 110 + i * 10);
  return {
    plan: makePlan(prices),
    openedAt: 1_700_000_000_000,
    status,
    resolvedAt: 1_700_000_500_000,
    resolvedPrice: 111,
    targetsHit,
    breakEvenSuggested: false,
  };
}

describe('target-hit-rate: fail-closed antes de qualquer número', () => {
  it('histórico vazio => DADOS_INSUFICIENTES, nunca uma tabela de zeros', () => {
    const r = computeTargetHitRates([]);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.rates).toEqual([]);
    expect(r.resolvedPlans).toBe(0);
    expect(r.reason).toBeTruthy();
  });

  it('null/undefined => DADOS_INSUFICIENTES (nunca lança)', () => {
    expect(computeTargetHitRates(null).status).toBe('DADOS_INSUFICIENTES');
    expect(computeTargetHitRates(undefined).status).toBe('DADOS_INSUFICIENTES');
  });

  it('só planos OPEN/REPLACED => DADOS_INSUFICIENTES (não são trades)', () => {
    const r = computeTargetHitRates([
      { ...resolved('TARGET_HIT', 3, 3), status: 'OPEN', resolvedAt: null, resolvedPrice: null, targetsHit: 0 },
      { ...resolved('TARGET_HIT', 3, 3), status: 'REPLACED', resolvedAt: null, resolvedPrice: null, targetsHit: 0 },
    ]);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.resolvedPlans).toBe(0);
  });

  it('planos não-resolvidos são descartados, os resolvidos ao lado continuam contando', () => {
    const r = computeTargetHitRates([
      { ...resolved('TARGET_HIT', 2, 2), status: 'OPEN', resolvedAt: null, resolvedPrice: null, targetsHit: 0 },
      resolved('TARGET_HIT', 2, 2),
    ]);
    expect(r.status).toBe('OK');
    expect(r.resolvedPlans).toBe(1);
    expect(r.rates[0]).toMatchObject({ target: 1, offered: 1, reached: 1, rate: 1 });
  });
});

describe('target-hit-rate: o denominador só conta quem OFERECEU o alvo', () => {
  it('plano de 2 alvos não entra no denominador do TP3', () => {
    // 4 planos de 2 alvos (todos alcançaram os 2) + 1 plano de 3 alvos que
    // parou no TP1. A conta INGÊNUA daria TP3 = 0/5 = 0%; a conta honesta
    // dá TP3 = 0/1, porque só 1 plano jamais propôs um TP3.
    const hist = [
      resolved('TARGET_HIT', 2, 2),
      resolved('TARGET_HIT', 2, 2),
      resolved('TARGET_HIT', 2, 2),
      resolved('TARGET_HIT', 2, 2),
      resolved('PARTIAL_HIT', 3, 1),
    ];
    const r = computeTargetHitRates(hist);
    expect(r.status).toBe('OK');
    expect(r.resolvedPlans).toBe(5);
    expect(r.rates[0]).toMatchObject({ target: 1, offered: 5, reached: 5, rate: 1 });
    expect(r.rates[1]).toMatchObject({ target: 2, offered: 5, reached: 4 });
    expect(r.rates[1].rate).toBeCloseTo(4 / 5, 12);
    // O ponto: denominador 1, não 5.
    expect(r.rates[2]).toMatchObject({ target: 3, offered: 1, reached: 0, rate: 0 });
  });

  it('alvo nunca oferecido => rate null, nunca 0 ("nunca propôs" ≠ "nunca chega")', () => {
    const r = computeTargetHitRates([resolved('TARGET_HIT', 1, 1), resolved('STOP_HIT', 1, 0)]);
    expect(r.rates[0]).toMatchObject({ target: 1, offered: 2, reached: 1, rate: 0.5 });
    expect(r.rates[1]).toMatchObject({ target: 2, offered: 0, reached: 0, rate: null });
    expect(r.rates[2]).toMatchObject({ target: 3, offered: 0, reached: 0, rate: null });
  });

  it('sempre reporta MAX_TARGETS linhas — a escada inteira, mesmo a parte ainda vazia', () => {
    const r = computeTargetHitRates([resolved('TARGET_HIT', 1, 1)]);
    expect(r.rates).toHaveLength(MAX_TARGETS);
    expect(r.rates.map((x) => x.target)).toEqual(
      Array.from({ length: MAX_TARGETS }, (_, i) => i + 1),
    );
  });
});

describe('target-hit-rate: "alcançou" é targetsHit > i, nada mais', () => {
  it('STOP_HIT com zero alvo provado conta no denominador e não no numerador', () => {
    const r = computeTargetHitRates([resolved('STOP_HIT', 3, 0), resolved('TARGET_HIT', 3, 3)]);
    expect(r.rates[0]).toMatchObject({ offered: 2, reached: 1, rate: 0.5 });
    expect(r.rates[1]).toMatchObject({ offered: 2, reached: 1, rate: 0.5 });
    expect(r.rates[2]).toMatchObject({ offered: 2, reached: 1, rate: 0.5 });
  });

  it('PARTIAL_HIT credita só os alvos realmente provados, não a escada toda', () => {
    // targetsHit=2 => alcançou TP1 e TP2, nunca o TP3.
    const r = computeTargetHitRates([resolved('PARTIAL_HIT', 3, 2)]);
    expect(r.rates[0].reached).toBe(1);
    expect(r.rates[1].reached).toBe(1);
    expect(r.rates[2].reached).toBe(0);
    expect(r.rates[2].rate).toBe(0);
  });

  it('a taxa é monotonicamente não-crescente quando todos os planos têm a mesma escada', () => {
    // Propriedade real da definição: quem alcançou o TP2 necessariamente
    // alcançou o TP1 (targetsHit é ordinal). Se esta invariante quebrar,
    // o numerador parou de ser "alvos provados em ordem".
    const hist = [
      resolved('TARGET_HIT', 3, 3),
      resolved('PARTIAL_HIT', 3, 2),
      resolved('PARTIAL_HIT', 3, 1),
      resolved('STOP_HIT', 3, 0),
    ];
    const r = computeTargetHitRates(hist);
    expect(r.rates.map((x) => x.reached)).toEqual([3, 2, 1]);
    for (let i = 1; i < r.rates.length; i++) {
      expect(r.rates[i].rate!).toBeLessThanOrEqual(r.rates[i - 1].rate!);
    }
  });

  it('targetsHit acima do número de alvos não inventa uma 4ª linha', () => {
    // Defensivo: mesmo com um registro inconsistente, o laço para em
    // MAX_TARGETS e o alvo inexistente segue sem denominador.
    const r = computeTargetHitRates([resolved('TARGET_HIT', 2, 9)]);
    expect(r.rates).toHaveLength(MAX_TARGETS);
    expect(r.rates[2]).toMatchObject({ offered: 0, reached: 0, rate: null });
  });

  it('registro corrompido (targetsHit não-finito, targets ausente) é descartado, não fabricado', () => {
    const semTargets = resolved('TARGET_HIT', 2, 2);
    // Simula registro persistido antigo/corrompido (o cast é o ponto: em
    // runtime este objeto EXISTE, vindo do localStorage de uma versão
    // anterior do contrato — o tipo não protege a fronteira de rehydrate).
    semTargets.plan = { ...semTargets.plan, targets: undefined as unknown as TradePlan['targets'] };
    const nanHits = { ...resolved('TARGET_HIT', 2, 2), targetsHit: Number.NaN };
    const r = computeTargetHitRates([semTargets, nanHits, resolved('TARGET_HIT', 2, 2)]);
    expect(r.resolvedPlans).toBe(1);
    expect(r.rates[0]).toMatchObject({ offered: 1, reached: 1, rate: 1 });
  });
});

describe('target-hit-rate: pureza', () => {
  it('não muta o histórico nem os planos recebidos', () => {
    const hist = [resolved('TARGET_HIT', 3, 3), resolved('STOP_HIT', 2, 0)];
    const antes = JSON.parse(JSON.stringify(hist));
    computeTargetHitRates(hist);
    expect(JSON.parse(JSON.stringify(hist))).toEqual(antes);
    expect(hist).toHaveLength(2);
  });

  it('mesma entrada => mesma saída (determinística)', () => {
    const hist = [resolved('TARGET_HIT', 3, 2), resolved('STOP_HIT', 3, 0)];
    expect(computeTargetHitRates(hist)).toEqual(computeTargetHitRates(hist));
  });
});

describe('target-hit-rate: describeTargetHitRates', () => {
  it('mostra contagem real (acertos/oferecidos), nunca porcentagem sozinha', () => {
    const r = computeTargetHitRates([
      resolved('TARGET_HIT', 3, 3),
      resolved('PARTIAL_HIT', 3, 1),
      resolved('STOP_HIT', 2, 0),
    ]);
    expect(describeTargetHitRates(r)).toBe('TP1 2/3 · TP2 1/3 · TP3 1/2');
  });

  it('omite alvo nunca oferecido em vez de escrever "0/0"', () => {
    const r = computeTargetHitRates([resolved('TARGET_HIT', 1, 1)]);
    const linha = describeTargetHitRates(r);
    expect(linha).toBe('TP1 1/1');
    expect(linha).not.toContain('TP2');
    expect(linha).not.toContain('TP3');
  });

  it('sem histórico => devolve a razão real, nunca uma linha de alvos vazia', () => {
    const linha = describeTargetHitRates(computeTargetHitRates([]));
    expect(linha).not.toContain('TP1');
    expect(linha.length).toBeGreaterThan(0);
  });
});

// ── FIAÇÃO (padrão no código-fonte) ───────────────────────────────────────
// Aqui o bug provável não é "a matemática está errada" (isso os testes de
// execução acima já travam), e sim "esqueceram de ligar A com B" — a
// convenção mista do CLAUDE.md.
describe('target-hit-rate: fiação real em App.tsx', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');

  it('computa uma única vez, a partir do histórico REAL do Track Record', () => {
    expect(app).toContain('computeTargetHitRates(trackRecordSlice.history)');
    // Uma chamada só: um 2º computeTargetHitRates seria uma 2ª amostra.
    // Uma chamada só (o import é `computeTargetHitRates,` — sem parêntese).
    const chamadas = app.split('computeTargetHitRates(').length - 1;
    expect(chamadas).toBe(1);
  });

  it('a fonte é o histórico bruto, NUNCA trackRecordResults (perde targets/targetsHit)', () => {
    expect(app).not.toContain('computeTargetHitRates(trackRecordResults');
  });

  it('atravessa o WidgetContext e chega ao ExpectancyCard', () => {
    // valor + deps do useMemo do contexto + destructure do card
    const ocorrencias = app.split(/^\s*targetHitRates,$/m).length - 1;
    expect(ocorrencias).toBeGreaterThanOrEqual(3);
    expect(app).toContain('targetHitRates?: TargetHitRateReport;');
  });

  it('só desenha com status OK e algum alvo realmente oferecido (fail-closed)', () => {
    expect(app).toContain('targetHitRates?.status === "OK"');
    expect(app).toContain('targetHitRates.rates.some((r) => r.offered > 0)');
    expect(app).toContain('describeTargetHitRates(targetHitRates)');
  });
});
