// excursion-stats.test.ts — execução REAL das três camadas do Phase D
// §6/§7: a gravação tick a tick (signal-track-record), a conversão para R
// (trade-simulation) e a agregação (excursion-stats).
//
// A pergunta central de cada bloco:
//   1. a excursão é o que o preço REALMENTE fez, na direção do PLANO?
//   2. gravar isso custa um render por tick? (tem de custar ZERO)
//   3. ausência de medição vira 0R em algum lugar? (não pode)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  trackPlanTransition,
  trackPriceTick,
  accumulateExcursion,
  EMPTY_TRACK_RECORD,
  type TrackRecordState,
  type PlanExcursion,
} from '../src/nexus/signal-track-record';
import { simulateTradeCosts, simulateTradeCostsBatch, DEFAULT_EXECUTION_COST_CONFIG } from '../src/nexus/trade-simulation';
import { computeExcursionStats, describeExcursionStats } from '../src/nexus/excursion-stats';
import type { TradePlan } from '../src/nexus/trade-plan';
import type { TradeCostResult } from '../src/nexus/trade-simulation';

const T0 = 1_700_000_000_000;

/** LONG: entrada 99..101 (mid 100), stop 90 => R = 10 pontos. */
function planLong(targets: number[] = [110, 120]): TradePlan {
  return {
    contractVersion: 2,
    direction: 'LONG',
    entry: { low: 99, high: 101, basis: 'SR_SUPPORT_1' },
    stop: { price: 90, basis: 'SR_SUPPORT_1' },
    targets: targets.map((price) => ({ price, basis: 'SR_RESISTANCE_1' })),
    riskRewardRatios: targets.map(() => 1),
    computedAt: T0,
  };
}

/** SHORT espelhado: mid 100, stop 110 => R = 10 pontos. */
function planShort(targets: number[] = [90, 80]): TradePlan {
  return {
    contractVersion: 2,
    direction: 'SHORT',
    entry: { low: 99, high: 101, basis: 'SR_RESISTANCE_1' },
    stop: { price: 110, basis: 'SR_RESISTANCE_1' },
    targets: targets.map((price) => ({ price, basis: 'SR_SUPPORT_1' })),
    riskRewardRatios: targets.map(() => 1),
    computedAt: T0,
  };
}

/** Abre o plano e reproduz um caminho REAL de preço, tick a tick —
 *  exatamente na ordem que a store usa (acumula, depois avalia). */
function playPath(plan: TradePlan, path: number[]): { state: TrackRecordState; excursion: PlanExcursion | null } {
  let s = trackPlanTransition(EMPTY_TRACK_RECORD, plan, T0);
  let exc: PlanExcursion | null = null;
  path.forEach((price, i) => {
    exc = accumulateExcursion(exc, s.active, price);
    s = trackPriceTick(s, price, T0 + (i + 1) * 1000, exc);
  });
  return { state: s, excursion: exc };
}

describe('Phase D §6/§7: a excursão é o caminho real, na direção do plano', () => {
  it('LONG: guarda o MAIOR preço a favor e o MENOR contra, mesmo sem resolver', () => {
    const { state, excursion } = playPath(planLong(), [100, 104, 96, 102, 97]);
    expect(state.active).not.toBeNull();
    expect(excursion!.mfePrice).toBe(104);
    expect(excursion!.maePrice).toBe(96);
    expect(state.history).toEqual([]); // nada resolveu: 104 < TP1(110), 96 > stop(90)
  });

  it('SHORT: o sinal inverte — preço CAINDO é MFE, subindo é MAE', () => {
    const { excursion } = playPath(planShort(), [100, 96, 104, 98]);
    expect(excursion!.mfePrice).toBe(96); // o melhor para um SHORT é o mais BAIXO
    expect(excursion!.maePrice).toBe(104);
  });

  it('o tick que RESOLVE também conta na excursão — excluí-lo faria o MFE de um vencedor ignorar o alvo que ele bateu', () => {
    const { state } = playPath(planLong([110]), [103, 111]);
    expect(state.history).toHaveLength(1);
    const resolvido = state.history[0];
    expect(resolvido.status).toBe('TARGET_HIT');
    expect(resolvido.observedMfePrice).toBe(111); // o próprio tick de resolução
    expect(resolvido.observedMaePrice).toBe(103);
  });

  it('a excursão sobrevive ao avanço parcial da escada (o trade é o mesmo)', () => {
    // TP1=110 tocado (fica OPEN rumo ao TP2), depois cai a 104.
    const { state, excursion } = playPath(planLong([110, 130]), [95, 112, 104]);
    expect(state.active).not.toBeNull();
    expect(state.active!.targetsHit).toBe(1);
    expect(excursion!.mfePrice).toBe(112);
    expect(excursion!.maePrice).toBe(95);
    // e o acumulador continua ancorado no MESMO trade
    expect(excursion!.openedAt).toBe(T0);
  });

  it('registro nunca medido continua ausente — jamais 0', () => {
    const semTick = trackPlanTransition(EMPTY_TRACK_RECORD, planLong(), T0);
    expect(semTick.active!.observedMfePrice).toBeUndefined();
    expect(accumulateExcursion(null, null, 100)).toBeNull();
  });

  it('o primeiro tick real inicializa as duas pontas com o PREÇO, nunca com 0', () => {
    const { excursion } = playPath(planLong(), [100]);
    expect(excursion!.mfePrice).toBe(100);
    expect(excursion!.maePrice).toBe(100);
  });

  it('trocar de trade REINICIA o acumulador — o caminho de um plano nunca vaza para o seguinte', () => {
    let s = trackPlanTransition(EMPTY_TRACK_RECORD, planLong(), T0);
    let exc = accumulateExcursion(null, s.active, 100);
    exc = accumulateExcursion(exc, s.active, 108); // MFE 108 no trade 1
    expect(exc!.mfePrice).toBe(108);

    // Um plano materialmente diferente abre um trade NOVO (openedAt novo).
    const outro = { ...planLong([115]), stop: { price: 92, basis: 'SR_SUPPORT_1' as const } };
    s = trackPlanTransition(s, outro, T0 + 10_000);
    expect(s.active!.openedAt).toBe(T0 + 10_000);
    exc = accumulateExcursion(exc, s.active, 101);
    expect(exc!.openedAt).toBe(T0 + 10_000);
    expect(exc!.mfePrice).toBe(101); // reiniciou; 108 do trade anterior sumiu
    expect(exc!.maePrice).toBe(101);
  });

  it('preço não-finito nunca entra no acumulador', () => {
    const s = trackPlanTransition(EMPTY_TRACK_RECORD, planLong(), T0);
    const bom = accumulateExcursion(null, s.active, 100);
    expect(accumulateExcursion(bom, s.active, Number.NaN)).toBe(bom);
    expect(accumulateExcursion(bom, s.active, Number.POSITIVE_INFINITY)).toBe(bom);
  });
});

describe('Phase D: medir a excursão custa ZERO render (o invariante preservado)', () => {
  // Este bloco é a razão de o acumulador viver num campo IRMÃO. A primeira
  // versão desta rodada acumulava dentro do plano ativo, e três testes de
  // nexus-signal-track-record.test.ts reprovaram na hora, com razão: em
  // TENDÊNCIA quase todo tick bate um extremo, então o custo teria sido
  // ~1 render por atualização de preço. Estes testes travam a correção.
  it('NENHUM tick sem resolução produz trackRecord novo — nem batendo recorde', () => {
    const abertura = trackPlanTransition(EMPTY_TRACK_RECORD, planLong(), T0);
    let s = abertura;
    let exc: PlanExcursion | null = null;
    // Tendência monotônica: TODO tick bate um MFE novo. É o pior caso real.
    for (let i = 0; i < 200; i++) {
      const price = 100 + i * 0.02; // sobe sempre, sem chegar ao TP1 (110)
      exc = accumulateExcursion(exc, s.active, price);
      const antes = s;
      s = trackPriceTick(s, price, T0 + i * 1000, exc);
      expect(s).toBe(antes); // identidade preservada em TODOS os 200 ticks
    }
    expect(s).toBe(abertura);
    // ...e mesmo assim a medição aconteceu, no campo irmão.
    expect(exc!.mfePrice).toBeCloseTo(100 + 199 * 0.02, 10);
    expect(exc!.maePrice).toBe(100);
  });

  it('o acumulador devolve a MESMA referência quando nada avança (escrita no-op no Immer)', () => {
    const s = trackPlanTransition(EMPTY_TRACK_RECORD, planLong(), T0);
    const e1 = accumulateExcursion(null, s.active, 100);
    const e2 = accumulateExcursion(e1, s.active, 100); // mesmo preço
    expect(e2).toBe(e1);
    const e3 = accumulateExcursion(e1, s.active, 105); // recorde real
    expect(e3).not.toBe(e1);
    const e4 = accumulateExcursion(e3, s.active, 102); // dentro da faixa
    expect(e4).toBe(e3);
  });

  it('a store escreve o acumulador num campo IRMÃO, nunca dentro de trackRecord', () => {
    const store = readFileSync(new URL('../src/store/unified-snapshot-store.ts', import.meta.url), 'utf-8');
    expect(store).toContain('planExcursion: PlanExcursion | null;');
    expect(store).toContain('s.planExcursion = excursion;');
    // O acumulador NUNCA é escrito para dentro da fatia observada.
    expect(store).not.toMatch(/s\.trackRecord\.active\.observed/);
  });
});

describe('Phase D: conversão para R usa o MESMO R de grossR', () => {
  it('LONG: MFE/MAE em R saem do mesmo entryMid e riskPoints', () => {
    const { state } = playPath(planLong([110]), [95, 111]);
    const r = simulateTradeCosts(state.history[0])!;
    expect(r.entryMid).toBe(100);
    expect(r.riskPoints).toBe(10);
    // MFE 111 => (111-100)/10 = +1.1R ; MAE 95 => (95-100)/10 = -0.5R
    expect(r.observedMfeR).toBeCloseTo(1.1, 10);
    expect(r.observedMaeR).toBeCloseTo(-0.5, 10);
    // TP1 em 110 => (110-100)/10 = 1.0R
    expect(r.firstTargetR).toBeCloseTo(1.0, 10);
  });

  it('SHORT: o mesmo sinal, espelhado', () => {
    const { state } = playPath(planShort([90]), [104, 89]);
    const r = simulateTradeCosts(state.history[0])!;
    expect(r.observedMfeR).toBeCloseTo(1.1, 10); // 89 => (100-89)/10
    expect(r.observedMaeR).toBeCloseTo(-0.4, 10); // 104 => (100-104)/10
    expect(r.firstTargetR).toBeCloseTo(1.0, 10);
  });

  it('plano resolvido SEM excursão medida => null nos três, nunca 0R', () => {
    // Constrói o resolvido à mão, como um registro persistido antigo.
    const r = simulateTradeCosts({
      plan: planLong([110]),
      openedAt: T0,
      status: 'TARGET_HIT',
      resolvedAt: T0 + 60_000,
      resolvedPrice: 110,
      targetsHit: 1,
      breakEvenSuggested: false,
    })!;
    expect(r.observedMfeR).toBeNull();
    expect(r.observedMaeR).toBeNull();
    expect(r.grossR).toBeCloseTo(1.0, 10); // o resto do registro continua real
  });

  it('MFE pode ser NEGATIVO — um trade que nunca esteve a favor é leitura real, não erro', () => {
    const { state } = playPath(planLong([110]), [98, 96, 89]); // só andou contra até stopar
    const r = simulateTradeCosts(state.history[0])!;
    expect(r.status).toBe('STOP_HIT');
    expect(r.observedMfeR!).toBeLessThan(0);
  });
});

// ─── agregação ────────────────────────────────────────────────────────────
const base = (over: Partial<TradeCostResult>): TradeCostResult => ({
  status: 'TARGET_HIT',
  direction: 'LONG',
  entryMid: 100,
  riskPoints: 10,
  grossR: 1,
  commissionR: 0,
  slippageR: 0,
  fundingR: 0,
  netR: 1,
  holdingMs: 60_000,
  resolvedAt: T0,
  regime: null,
  fingerprint: null,
  institutionalScore: null,
  volatilityAtOpen: null,
  modelAgreement: null,
  observedMfeR: null,
  observedMaeR: null,
  firstTargetR: null,
  ...over,
});

describe('excursion-stats: as duas perguntas reais', () => {
  it('amostra vazia => DADOS_INSUFICIENTES com razão real', () => {
    const s = computeExcursionStats([]);
    expect(s.status).toBe('DADOS_INSUFICIENTES');
    expect(s.winnerMaeMedianR).toBeNull();
    expect(s.loserMfeFractionMedian).toBeNull();
    expect(s.reason).toBeTruthy();
  });

  it('null/undefined nunca lançam', () => {
    expect(computeExcursionStats(null).status).toBe('DADOS_INSUFICIENTES');
    expect(computeExcursionStats(undefined).status).toBe('DADOS_INSUFICIENTES');
  });

  it('trades resolvidos SEM excursão medida => recusa, e diz que ausência não é zero', () => {
    const s = computeExcursionStats([base({}), base({}), base({})]);
    expect(s.status).toBe('DADOS_INSUFICIENTES');
    expect(s.totalTrades).toBe(3);
    expect(s.measuredTrades).toBe(0);
    expect(s.reason).toContain('nunca é lida como excursão zero');
  });

  it('CALOR: a mediana do MAE dos vencedores é um ponto REAL da amostra', () => {
    const s = computeExcursionStats([
      base({ netR: 2, observedMaeR: -0.1, observedMfeR: 2 }),
      base({ netR: 2, observedMaeR: -0.5, observedMfeR: 2 }),
      base({ netR: 2, observedMaeR: -0.9, observedMfeR: 2 }),
    ]);
    expect(s.status).toBe('OK');
    expect(s.winnerCount).toBe(3);
    expect(s.winnerMaeMedianR).toBe(-0.5);
    // O PIOR é o menor valor — é ele que decide se o stop é sobrevivível.
    expect(s.winnerMaeWorstR).toBe(-0.9);
  });

  it('a mediana nunca sintetiza um valor: amostra par escolhe um ponto REAL', () => {
    const s = computeExcursionStats([
      base({ netR: 1, observedMaeR: -0.2 }),
      base({ netR: 1, observedMaeR: -0.4 }),
    ]);
    // -0.3 (a média) NUNCA foi observado; o contrato de percentile.ts proíbe.
    expect([-0.2, -0.4]).toContain(s.winnerMaeMedianR);
    expect(s.winnerMaeMedianR).not.toBeCloseTo(-0.3, 6);
  });

  it('ALVO vs LEITURA: perdedores que quase chegaram têm fração alta', () => {
    const s = computeExcursionStats([
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.9, firstTargetR: 1 }),
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.8, firstTargetR: 1 }),
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.85, firstTargetR: 1 }),
    ]);
    expect(s.loserCount).toBe(3);
    expect(s.loserMfeFractionMedian).toBeCloseTo(0.85, 10);
  });

  it('...e perdedores que nunca saíram do lugar têm fração baixa — o defeito é OUTRO', () => {
    const s = computeExcursionStats([
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.1, firstTargetR: 1 }),
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.05, firstTargetR: 1 }),
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.12, firstTargetR: 1 }),
    ]);
    expect(s.loserMfeFractionMedian!).toBeLessThan(0.2);
  });

  it('perdedor sem TP1 real (ou TP1 <= entrada) fica FORA — dividir por ele não teria significado', () => {
    const s = computeExcursionStats([
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.5, firstTargetR: null }),
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.5, firstTargetR: 0 }),
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.5, firstTargetR: -1 }),
      base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.5, firstTargetR: 1 }),
    ]);
    expect(s.loserCount).toBe(1);
    expect(s.loserMfeFractionMedian).toBeCloseTo(0.5, 10);
  });

  it('vencedor e perdedor são separados pelo netR (mesma definição de expectancy)', () => {
    const s = computeExcursionStats([
      base({ netR: 0.5, observedMaeR: -0.3, observedMfeR: 1, firstTargetR: 1 }),
      base({ netR: -0.5, observedMaeR: -1, observedMfeR: 0.4, firstTargetR: 1 }),
      // netR exatamente 0 conta como NÃO-vencedor (empate nunca se arredonda a favor)
      base({ netR: 0, observedMaeR: -1, observedMfeR: 0.6, firstTargetR: 1 }),
    ]);
    expect(s.winnerCount).toBe(1);
    expect(s.loserCount).toBe(2);
  });

  it('pura: não muta nem reordena a amostra recebida', () => {
    const amostra = [
      base({ netR: 1, observedMaeR: -0.9 }),
      base({ netR: 1, observedMaeR: -0.1 }),
      base({ netR: 1, observedMaeR: -0.5 }),
    ];
    const antes = JSON.parse(JSON.stringify(amostra));
    computeExcursionStats(amostra);
    expect(JSON.parse(JSON.stringify(amostra))).toEqual(antes);
    expect(amostra[0].observedMaeR).toBe(-0.9); // ordem original intacta
  });

  it('determinística', () => {
    const a = [base({ netR: 1, observedMaeR: -0.4 }), base({ netR: -1, observedMfeR: 0.5, firstTargetR: 1 })];
    expect(computeExcursionStats(a)).toEqual(computeExcursionStats(a));
  });
});

describe('excursion-stats: describeExcursionStats carrega SEMPRE o n', () => {
  it('a linha traz a contagem junto do número — é o que substitui um piso inventado', () => {
    const linha = describeExcursionStats(
      computeExcursionStats([
        base({ netR: 2, observedMaeR: -0.4 }),
        base({ status: 'STOP_HIT', netR: -1, observedMfeR: 0.8, firstTargetR: 1 }),
      ]),
    );
    expect(linha).toContain('1 vencedor');
    expect(linha).toContain('1 caso');
    expect(linha).toContain('R');
  });

  it('sem medição => devolve a razão real, nunca um número', () => {
    const linha = describeExcursionStats(computeExcursionStats([]));
    expect(linha).not.toMatch(/\d+(\.\d+)?R/);
    expect(linha.length).toBeGreaterThan(0);
  });
});

describe('Phase D: contrato do módulo (Regra de Ouro 2 e LEI 24)', () => {
  const src = readFileSync(new URL('../src/nexus/excursion-stats.ts', import.meta.url), 'utf-8');

  it('não expõe nada com cara de probabilidade nem de direção', () => {
    // Trava o CONTRATO, não a prosa: o cabeçalho fala de probabilidade
    // justamente para PROIBIR essa leitura, e procurar a palavra acusaria
    // um falso positivo (lição já paga duas vezes nesta base).
    expect(src).not.toMatch(/^\s*(probability|confidence|winRate|direction)\s*[?]?:/m);
  });

  it('reusa realPercentile — zero terceira mediana no repositório', () => {
    expect(src).toContain('realPercentile');
    expect(src).not.toMatch(/vals\.length % 2 === 0/);
  });

  it('outcome-matrix.ts foi consolidado no MESMO percentil compartilhado', () => {
    const om = readFileSync(new URL('../src/nexus/outcome-matrix.ts', import.meta.url), 'utf-8');
    expect(om).toContain('realPercentile(vals, 0.5)');
    expect(om).not.toMatch(/\(vals\[mid - 1\] \+ vals\[mid\]\) \/ 2/);
  });
});

describe('Phase D: caminho ponta a ponta, do tick real à estatística', () => {
  it('dois trades reais, jogados tick a tick, chegam medidos na agregação', () => {
    // Vencedor que sofreu: cai a 93 (-0.7R) antes de bater o TP1 em 110.
    const venc = playPath(planLong([110]), [100, 93, 105, 111]).state;
    // Perdedor que quase chegou: sobe a 108 (0.8R de um TP1 a 1.0R) e stopa.
    const perd = playPath(planLong([110]), [100, 108, 95, 89]).state;

    const resultados = simulateTradeCostsBatch(
      [...venc.history, ...perd.history],
      DEFAULT_EXECUTION_COST_CONFIG,
    );
    expect(resultados).toHaveLength(2);

    const stats = computeExcursionStats(resultados);
    expect(stats.status).toBe('OK');
    expect(stats.measuredTrades).toBe(2);
    expect(stats.winnerCount).toBe(1);
    expect(stats.winnerMaeWorstR).toBeCloseTo(-0.7, 10);
    expect(stats.loserCount).toBe(1);
    expect(stats.loserMfeFractionMedian).toBeCloseTo(0.8, 10);
  });
});

describe('Phase D: fiação real em App.tsx — display only (LEI 24)', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');

  it('roda sobre a MESMA amostra já custeada, uma vez só', () => {
    expect(app).toContain('computeExcursionStats(trackRecordResults)');
    expect(app.split('computeExcursionStats(').length - 1).toBe(1);
  });

  it('NÃO decide nada: nenhum consumidor além da exibição', () => {
    // excursionStats só pode aparecer no memo, no contexto, no
    // destructure/tipo do card e no bloco de exibição. Nunca dentro de
    // engine.direction, do plano, do filtro de expectativa ou do risco.
    expect(app).not.toMatch(/excursionStats[^\n]*\b(direction|engine\.|tradePlan|riskSuggestion)\b/);
  });

  it('o n aparece na tela junto do número, nunca só a mediana', () => {
    expect(app).toContain('describeExcursionStats(excursionStats)');
    expect(app).toContain('excursionStats.measuredTrades');
    expect(app).toContain('excursionStats.totalTrades');
  });

  it('a leitura é rotulada OBSERVADA na própria UI, nunca como o caminho verdadeiro', () => {
    const bloco = app.slice(app.indexOf('Caminho · '), app.indexOf('Caminho · ') + 200);
    expect(bloco.length).toBeGreaterThan(0);
    expect(app).toMatch(/Excursão OBSERVADA sobre \$\{excursionStats\.measuredTrades\}/);
  });
});
