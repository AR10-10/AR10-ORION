// nexus-trade-plan.test.ts — Signal Precision order (phase 4) + Diretriz
// Complementar (Nexus Predictive Engine) §2 v2 multi-target extension:
// locks the Trade Plan engine's fail-closed rules and structure-only
// geometry, including up to MAX_TARGETS real opposing levels. Pure logic,
// no network, no store.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
import { buildTradePlan, effectiveStopForTargetsHit, obstacleZonesInPath, TRADE_PLAN_CONTRACT_VERSION, MAX_TARGETS, MIN_STOP_ATR_MULTIPLE, type TradePlanInputs, type TradePlanStructureZone } from '../src/nexus/trade-plan';

const BASE: TradePlanInputs = {
  stance: 'LONG',
  riskGated: false,
  price: 50_000,
  zones: [
    { low: 49_200, high: 49_500, kind: 'OB_BULLISH' },   // demand below price
    { low: 51_500, high: 51_800, kind: 'OB_BEARISH' },   // supply above price
  ],
  levels: [
    { price: 48_800, kind: 'SR_SUPPORT_1' },
    { price: 51_000, kind: 'SR_RESISTANCE_1' },
    { price: 52_200, kind: 'EQH' },
    { price: 47_900, kind: 'EQL' },
  ],
};

describe('buildTradePlan: fail-closed guards — no stance/no structure means NO plan, never a guess', () => {
  it('NEUTRAL, ABSTAIN and null stances never produce a plan', () => {
    expect(buildTradePlan({ ...BASE, stance: 'NEUTRAL' })).toBeNull();
    expect(buildTradePlan({ ...BASE, stance: 'ABSTAIN' })).toBeNull();
    expect(buildTradePlan({ ...BASE, stance: null })).toBeNull();
  });

  it('risk gate locked (council fail-closed) never produces a plan, even with a directional stance', () => {
    expect(buildTradePlan({ ...BASE, riskGated: true })).toBeNull();
  });

  it('no real price (null/NaN) never produces a plan', () => {
    expect(buildTradePlan({ ...BASE, price: null })).toBeNull();
    expect(buildTradePlan({ ...BASE, price: NaN })).toBeNull();
  });

  it('no supportive structure on the entry side => null (never an invented entry)', () => {
    expect(buildTradePlan({ ...BASE, zones: [], levels: BASE.levels.filter((l) => l.price > 50_000) })).toBeNull();
  });

  it('no real level beyond the entry (no coherent invalidation) => null', () => {
    expect(buildTradePlan({
      ...BASE,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
      levels: [{ price: 51_000, kind: 'SR_RESISTANCE_1' }], // nothing below the entry
    })).toBeNull();
  });

  it('no opposing real level (no target) => null', () => {
    expect(buildTradePlan({
      ...BASE,
      levels: BASE.levels.filter((l) => l.price < 50_000), // nothing above for a LONG
    })).toBeNull();
  });
});

describe('buildTradePlan: LONG geometry — every price is a real mapped level', () => {
  it('entry = nearest demand below price; stop = next real level beyond entry; targets = every real opposing level, nearest first; R:R exact per target', () => {
    const plan = buildTradePlan(BASE, 1_000)!;
    expect(plan).not.toBeNull();
    expect(plan.contractVersion).toBe(TRADE_PLAN_CONTRACT_VERSION);
    expect(plan.direction).toBe('LONG');
    expect(plan.entry).toEqual({ low: 49_200, high: 49_500, basis: 'OB_BULLISH' });
    expect(plan.stop).toEqual({ price: 48_800, basis: 'SR_SUPPORT_1' }); // nearest real level below entry.low
    // Two real opposing levels exist above price (51,000 and 52,200) —
    // both become real targets, nearest first, never truncated to one.
    // obstacleCount (Omega Core §5/§6): a zona OB_BEARISH real do fixture
    // (51,500–51,800) fica entre o 1º e o 2º alvo — 0 obstáculos para
    // chegar no 1º, 1 obstáculo real no caminho até o 2º.
    expect(plan.targets).toEqual([
      { price: 51_000, basis: 'SR_RESISTANCE_1', obstacleCount: 0 },
      { price: 52_200, basis: 'EQH', obstacleCount: 1 },
    ]);
    const entryMid = (49_200 + 49_500) / 2;
    expect(plan.riskRewardRatios).toHaveLength(2);
    expect(plan.riskRewardRatios[0]).toBeCloseTo((51_000 - entryMid) / (entryMid - 48_800), 10);
    expect(plan.riskRewardRatios[1]).toBeCloseTo((52_200 - entryMid) / (entryMid - 48_800), 10);
    expect(plan.computedAt).toBe(1_000);
  });

  it('liquidity pools are NEVER entry basis (sweep magnets), but ARE valid targets', () => {
    const plan = buildTradePlan({
      ...BASE,
      zones: [],
      levels: [
        { price: 49_700, kind: 'EQL' },           // liquidity below — must NOT become the entry
        { price: 49_400, kind: 'SR_SUPPORT_1' },  // real support — the honest entry
        { price: 48_900, kind: 'FIB_61.8' },      // invalidation anchor below
        { price: 52_200, kind: 'EQH' },           // resting liquidity above — valid target
      ],
    })!;
    expect(plan.entry.basis).toBe('SR_SUPPORT_1');
    // zones: [] neste teste — zero zonas reais para cruzar, obstacleCount sempre 0.
    expect(plan.targets).toEqual([{ price: 52_200, basis: 'EQH', obstacleCount: 0 }]);
  });

  it('deterministic: same inputs always produce the same plan', () => {
    expect(buildTradePlan(BASE, 5)).toEqual(buildTradePlan(BASE, 5));
  });
});

describe('buildTradePlan v2 (Diretriz Complementar §2): multi-target ceiling and honesty', () => {
  it('caps at MAX_TARGETS (3) even with more real opposing levels mapped — never fabricates a 4th', () => {
    const plan = buildTradePlan({
      ...BASE,
      levels: [
        ...BASE.levels,
        { price: 53_000, kind: 'FIB_161.8' },
        { price: 54_000, kind: 'VP_HVN' },
      ],
    })!;
    expect(plan.targets).toHaveLength(MAX_TARGETS);
    expect(plan.targets.map((t) => t.price)).toEqual([51_000, 52_200, 53_000]); // nearest 3, sorted
    expect(plan.riskRewardRatios).toHaveLength(MAX_TARGETS);
  });

  it('honest shortfall: only 1 real opposing level mapped => targets has length 1, never a fabricated 2nd/3rd', () => {
    const plan = buildTradePlan({
      ...BASE,
      levels: BASE.levels.filter((l) => l.price !== 52_200), // remove the 2nd LONG target candidate
    })!;
    expect(plan.targets).toEqual([{ price: 51_000, basis: 'SR_RESISTANCE_1', obstacleCount: 0 }]);
  });

  it('two real sources mapping the EXACT same price count as ONE target, never a duplicate', () => {
    const plan = buildTradePlan({
      ...BASE,
      levels: [
        ...BASE.levels,
        { price: 51_000, kind: 'FIB_61.8' }, // same price as the existing SR_RESISTANCE_1 target
      ],
    })!;
    const prices = plan.targets.map((t) => t.price);
    expect(prices.filter((p) => p === 51_000)).toHaveLength(1);
  });
});

describe('buildTradePlan: SHORT geometry — exact mirror of LONG', () => {
  const SHORT: TradePlanInputs = { ...BASE, stance: 'SHORT' };

  it('entry = nearest supply above price; stop = next real level above entry; targets = real levels below, nearest first', () => {
    const plan = buildTradePlan(SHORT, 2_000)!;
    expect(plan).not.toBeNull();
    expect(plan.direction).toBe('SHORT');
    // Nearest supply above 50,000 is R1 @ 51,000 (nearer than the OB at
    // 51,500-51,800) — zero-width entry zone from a real level.
    expect(plan.entry).toEqual({ low: 51_000, high: 51_000, basis: 'SR_RESISTANCE_1' });
    // Next real anchor above the entry is the bearish OB's far edge (51,800).
    expect(plan.stop).toEqual({ price: 51_800, basis: 'OB_BEARISH' });
    // Two real levels below price: S1 @ 48,800 (nearer) and EQL @ 47,900.
    // obstacleCount: a zona OB_BULLISH real do fixture (49,200–49,500) fica
    // entre a entrada (51,000) e OS DOIS alvos abaixo dela — 1 obstáculo
    // real para cada um (a OB_BEARISH, acima da entrada, nunca conta aqui).
    expect(plan.targets).toEqual([
      { price: 48_800, basis: 'SR_SUPPORT_1', obstacleCount: 1 },
      { price: 47_900, basis: 'EQL', obstacleCount: 1 },
    ]);
    const entryMid = 51_000;
    expect(plan.riskRewardRatios[0]).toBeCloseTo((entryMid - 48_800) / (51_800 - entryMid), 10);
    expect(plan.riskRewardRatios[1]).toBeCloseTo((entryMid - 47_900) / (51_800 - entryMid), 10);
  });

  it('SR_RESISTANCE_1 above price works as a zero-width entry zone for SHORT', () => {
    const plan = buildTradePlan({
      ...SHORT,
      zones: [],
      levels: [
        { price: 50_600, kind: 'SR_RESISTANCE_1' },
        { price: 51_400, kind: 'FIB_78.6' }, // invalidation above
        { price: 49_000, kind: 'SR_SUPPORT_1' }, // target below
      ],
    })!;
    expect(plan.entry).toEqual({ low: 50_600, high: 50_600, basis: 'SR_RESISTANCE_1' });
    expect(plan.stop.price).toBe(51_400);
    expect(plan.targets[0].price).toBe(49_000);
    expect(plan.riskRewardRatios[0]).toBeGreaterThan(0);
  });
});

describe('obstacleCount (Omega Core, rodada 2, §5/§6): "até onde existe espaço real antes de uma barreira" — cruza inputs.zones (nunca usadas para seleção de alvo) contra o caminho até cada alvo', () => {
  it('sem nenhuma zona real entre entrada e alvo => obstacleCount 0, campo sempre presente (nunca omitido quando computável)', () => {
    const plan = buildTradePlan({
      ...BASE,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }], // só a própria zona de entrada
    })!;
    expect(plan.targets[0].obstacleCount).toBe(0);
    expect(plan.targets[1].obstacleCount).toBe(0);
  });

  it('a própria zona de ENTRADA nunca conta como obstáculo do próprio plano, mesmo com preço exatamente igual', () => {
    // zona de entrada real coincide em preço com onde uma zona "obstáculo"
    // poderia ser confundida — a exclusão é por identidade (low/high), não
    // só por não estar no caminho.
    const plan = buildTradePlan({
      ...BASE,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
    })!;
    expect(plan.entry).toEqual({ low: 49_200, high: 49_500, basis: 'OB_BULLISH' });
    expect(plan.targets[0].obstacleCount).toBe(0);
  });

  it('duas zonas reais empilhadas no caminho até o mesmo alvo contam as DUAS — nunca satura em 1', () => {
    const plan = buildTradePlan({
      ...BASE,
      zones: [
        { low: 49_200, high: 49_500, kind: 'OB_BULLISH' }, // entrada
        { low: 50_000, high: 50_200, kind: 'FVG_BEARISH' }, // obstáculo real 1, antes do 1º alvo
        { low: 50_400, high: 50_600, kind: 'OB_BEARISH' },  // obstáculo real 2, antes do 1º alvo
      ],
    })!;
    expect(plan.targets[0].price).toBe(51_000);
    expect(plan.targets[0].obstacleCount).toBe(2);
  });

  it('zona que fica ANTES da entrada (nunca no caminho até nenhum alvo) não conta', () => {
    const plan = buildTradePlan({
      ...BASE,
      zones: [
        { low: 49_200, high: 49_500, kind: 'OB_BULLISH' }, // entrada
        { low: 47_000, high: 47_200, kind: 'FVG_BULLISH' }, // abaixo da entrada — nunca no caminho para cima
      ],
    })!;
    expect(plan.targets[0].obstacleCount).toBe(0);
    expect(plan.targets[1].obstacleCount).toBe(0);
  });

  it('SIMETRIA LONG/SHORT: a mesma geometria espelhada em preço produz a MESMA contagem de obstáculos, direção invertida', () => {
    const K = 100_000;
    const mirrorZone = (z: TradePlanStructureZone) => ({ low: 2 * K - z.high, high: 2 * K - z.low, kind: z.kind.includes('BULLISH') ? z.kind.replace('BULLISH', 'BEARISH') : z.kind.replace('BEARISH', 'BULLISH') });
    // Espelhar preço não basta: SR_SUPPORT_1/SR_RESISTANCE_1 são rótulos de
    // LADO (achado real ao escrever este teste — a 1ª versão espelhava só o
    // preço e o plano SHORT saía null, porque um support espelhado cai do
    // lado da resistência mas continuava rotulado support, falhando o
    // filtro de kind por lado em LONG_TARGET_KINDS/SHORT_TARGET_KINDS).
    const mirrorLevel = (l: { price: number; kind: string }) => ({
      price: 2 * K - l.price,
      kind: l.kind === 'SR_SUPPORT_1' ? 'SR_RESISTANCE_1' : l.kind === 'SR_RESISTANCE_1' ? 'SR_SUPPORT_1' : l.kind,
    });
    const longInputs: TradePlanInputs = {
      stance: 'LONG',
      riskGated: false,
      price: 50_000,
      zones: [
        { low: 49_200, high: 49_500, kind: 'OB_BULLISH' },
        { low: 50_000, high: 50_200, kind: 'FVG_BEARISH' },
      ],
      levels: [
        { price: 48_800, kind: 'SR_SUPPORT_1' },
        { price: 51_000, kind: 'SR_RESISTANCE_1' },
      ],
    };
    const shortInputs: TradePlanInputs = {
      stance: 'SHORT',
      riskGated: false,
      price: 2 * K - 50_000,
      zones: longInputs.zones.map(mirrorZone),
      levels: longInputs.levels.map(mirrorLevel),
    };
    const longPlan = buildTradePlan(longInputs)!;
    const shortPlan = buildTradePlan(shortInputs)!;
    expect(longPlan.targets).toHaveLength(1);
    expect(shortPlan.targets).toHaveLength(1);
    expect(longPlan.targets[0].obstacleCount).toBe(1); // a FVG_BEARISH real fica entre a entrada e o alvo
    expect(shortPlan.targets[0].obstacleCount).toBe(longPlan.targets[0].obstacleCount);
  });
});

describe('obstacleZonesInPath (Diretriz Restauração/Inteligência Visual §6): as ZONAS em si, não só a contagem — reusada pelo destaque visual no gráfico (App.tsx/LiquidityZonesPlugin)', () => {
  it('devolve exatamente as zonas reais que ficam no caminho — mesmo fixture das "duas zonas empilhadas", agora conferindo os objetos, não só o tamanho', () => {
    const entry = { low: 49_200, high: 49_500, basis: 'OB_BULLISH' };
    const zones: TradePlanStructureZone[] = [
      { low: 49_200, high: 49_500, kind: 'OB_BULLISH' }, // a própria entrada
      { low: 50_000, high: 50_200, kind: 'FVG_BEARISH' }, // obstáculo real 1
      { low: 50_400, high: 50_600, kind: 'OB_BEARISH' },  // obstáculo real 2
    ];
    const found = obstacleZonesInPath(zones, entry, 51_000, true);
    expect(found).toEqual([
      { low: 50_000, high: 50_200, kind: 'FVG_BEARISH' },
      { low: 50_400, high: 50_600, kind: 'OB_BEARISH' },
    ]);
  });

  it('a própria zona de entrada nunca aparece na lista devolvida, mesmo com preço idêntico', () => {
    const entry = { low: 49_200, high: 49_500, basis: 'OB_BULLISH' };
    const zones: TradePlanStructureZone[] = [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }];
    expect(obstacleZonesInPath(zones, entry, 51_000, true)).toEqual([]);
  });

  it('zona antes da entrada (nunca no caminho para cima) fica de fora da lista devolvida', () => {
    const entry = { low: 49_200, high: 49_500, basis: 'OB_BULLISH' };
    const zones: TradePlanStructureZone[] = [{ low: 47_000, high: 47_200, kind: 'FVG_BULLISH' }];
    expect(obstacleZonesInPath(zones, entry, 51_000, true)).toEqual([]);
  });

  it('SHORT: mesma geometria, direção invertida (z.low < entryMid && z.high > targetPrice)', () => {
    const entry = { low: 51_000, high: 51_000, basis: 'SR_RESISTANCE_1' };
    const zones: TradePlanStructureZone[] = [
      { low: 49_200, high: 49_500, kind: 'OB_BULLISH' }, // entre a entrada (51k) e o alvo (48.8k) abaixo
    ];
    expect(obstacleZonesInPath(zones, entry, 48_800, false)).toEqual([
      { low: 49_200, high: 49_500, kind: 'OB_BULLISH' },
    ]);
  });

  it('contrato: .length bate exatamente com targets[i].obstacleCount que buildTradePlan já reporta — a extração não mudou o número, só expôs a lista', () => {
    const plan = buildTradePlan(BASE)!;
    for (const target of plan.targets) {
      const long = plan.direction === 'LONG';
      expect(obstacleZonesInPath(BASE.zones, plan.entry, target.price, long).length).toBe(target.obstacleCount);
    }
  });
});

describe('effectiveStopForTargetsHit: single real source for the trailing-stop ratchet (Diretriz Complementar §18)', () => {
  const plan = buildTradePlan({
    ...BASE,
    zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
  })!; // LONG, entry 49_200-49_500, stop 48_800, targets [51_000, 52_200]
  const entryMid = (49_200 + 49_500) / 2;

  it('no real target proven yet: the ORIGINAL structural stop, untouched', () => {
    expect(effectiveStopForTargetsHit(plan, 0)).toBe(plan.stop.price);
  });

  it('1 real target proven: break-even (entry midpoint) — same convention as before', () => {
    expect(effectiveStopForTargetsHit(plan, 1)).toBe(entryMid);
  });

  it('2+ real targets proven: the stop TRAILS to the PREVIOUS target — locks in gain already validated, never just flat break-even', () => {
    expect(effectiveStopForTargetsHit(plan, 2)).toBe(plan.targets[0].price);
  });

  it('a 3-target ladder trails one more rung: 3 proven => stop at target 2 (index 1)', () => {
    const threeTargetPlan = buildTradePlan({
      ...BASE,
      zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
      levels: [...BASE.levels, { price: 53_000, kind: 'FIB_161.8' }],
    })!;
    expect(threeTargetPlan.targets).toHaveLength(3);
    expect(effectiveStopForTargetsHit(threeTargetPlan, 3)).toBe(threeTargetPlan.targets[1].price);
  });

  it('a negative targetsHit is treated the same as zero — never an out-of-bounds read', () => {
    expect(effectiveStopForTargetsHit(plan, -1)).toBe(plan.stop.price);
  });
});

// ---------------------------------------------------------------------------
// PISO DE INVALIDAÇÃO DO STOP — pedido do Operador: "os alvos têm que estar
// mais precisos, quando aparecer realmente dar uma chance de bater o alvo".
//
// DEFEITO MEDIDO POR SONDA REAL antes de escrever uma linha: o stop era "o
// nível de invalidação mais PRÓXIMO além da entrada", sem piso de distância.
// Com um nível a 1 centavo da entrada:
//
//     entrada 99.50 · stop 99.49 (VP_POC)  →  R:R 1:550 e 1:1050
//
// O R:R não estava errado aritmeticamente — o STOP é que não era uma
// invalidação. Um centavo é ruído de UMA vela, não a prova de que a tese
// morreu. E como todo alvo é julgado por reward/risk, um risco degenerado
// faz QUALQUER alvo parecer certeza: é exatamente a imprecisão que aparece
// na tela.
//
// A regra é PESQUISADA, não inventada (WebSearch antes de escolher o
// número): a convenção de mesa é "stop ESTRUTURAL com piso de 1× ATR" —
// nunca trocar estrutura por ATR.
// ---------------------------------------------------------------------------
describe('piso de invalidação: o stop nunca é ruído de uma vela', () => {
  const niveis = [
    { price: 99.5, kind: 'SR_SUPPORT_1' },   // entrada
    { price: 99.49, kind: 'VP_POC' },        // "invalidação" a 1 centavo
    { price: 95, kind: 'SR_SUPPORT_2' },     // invalidação estrutural real
    { price: 105, kind: 'SR_RESISTANCE_1' },
    { price: 110, kind: 'EQH' },
  ];
  const base: TradePlanInputs = { stance: 'LONG', riskGated: false, price: 100, zones: [], levels: niveis };

  it('reproduz o defeito: SEM ATR, o stop cola na entrada e o R:R explode', () => {
    const p = buildTradePlan(base)!;
    expect(p.stop.price).toBe(99.49);
    expect(p.riskRewardRatios[0]!).toBeGreaterThan(100); // absurdo real medido
  });

  it('COM ATR real, o stop pula para a invalidação ESTRUTURAL de verdade', () => {
    // ATR = 2 em unidades de preço. 99.49 está a 0.01 da entrada — dentro do
    // ruído. 95 está a 4.5 — invalidação real.
    const p = buildTradePlan({ ...base, atr: 2 })!;
    expect(p.stop.price).toBe(95);
    expect(p.stop.basis).toBe('SR_SUPPORT_2');
  });

  it('e o R:R volta a ser um número que significa alguma coisa', () => {
    const p = buildTradePlan({ ...base, atr: 2 })!;
    for (const rr of p.riskRewardRatios) {
      expect(rr!).toBeGreaterThan(0);
      expect(rr!).toBeLessThan(10); // nada de 1:550
    }
  });

  it('o stop continua ESTRUTURAL — o ATR é piso, nunca substitui o nível', () => {
    // A regra pesquisada é "estrutura COM piso de ATR". Se o motor passasse
    // a usar `entrada − 1×ATR` como preço, o stop perderia a basis real.
    const p = buildTradePlan({ ...base, atr: 2 })!;
    expect(niveis.some((n) => n.price === p.stop.price)).toBe(true);
    expect(p.stop.price).not.toBe(100 - 2);
  });

  it('fail-closed: ATR ausente ou inválido não filtra nada', () => {
    // Nenhum consumidor que ainda não passa ATR pode mudar de comportamento.
    // `computedAt` fixo: o motor já aceita o parâmetro, e sem ele o
    // timestamp difere entre as duas chamadas e mascara a comparação.
    const T = 1_700_000_000_000;
    const semAtr = buildTradePlan(base, T);
    for (const atr of [null, undefined, NaN, 0, -1]) {
      expect(buildTradePlan({ ...base, atr: atr as number }, T), `atr ${String(atr)}`).toEqual(semAtr);
    }
  });

  it('se NENHUMA âncora respeita o piso, não há plano — nunca um stop de mentira', () => {
    // ATR gigante: toda invalidação disponível está dentro do ruído. A
    // resposta honesta é "sem plano", a mesma já dada quando não existe
    // nível de invalidação nenhum.
    expect(buildTradePlan({ ...base, atr: 50 })).toBeNull();
  });

  it('SHORT é o espelho exato', () => {
    const niveisShort = [
      { price: 100.5, kind: 'SR_RESISTANCE_1' }, // entrada
      { price: 100.51, kind: 'VP_POC' },         // ruído
      { price: 105, kind: 'SR_RESISTANCE_2' },   // invalidação real
      { price: 95, kind: 'SR_SUPPORT_1' },
    ];
    const p = buildTradePlan({ stance: 'SHORT', riskGated: false, price: 100, zones: [], levels: niveisShort, atr: 2 })!;
    expect(p.stop.price).toBe(105);
    expect(p.riskRewardRatios[0]!).toBeLessThan(10);
  });

  it('o multiplicador é declarado e ajustável, nunca escondido no meio do código', () => {
    expect(MIN_STOP_ATR_MULTIPLE).toBe(1);
  });

  it('o gráfico recebe o ATR em UNIDADES DE PREÇO, nunca o percentual cru', () => {
    // Passar `atrPercent` direto tornaria o piso ~100x menor e o defeito
    // voltaria em silêncio — a conversão é a parte fácil de errar aqui.
    const app = readFileSync(resolve(here, '../src/App.tsx'), 'utf8');
    expect(app).toContain('(priceFromSnapshot.price * engine.marketRegime.atrPercent) / 100');
  });
});
