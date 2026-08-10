// paper-trading.test.ts — execução REAL do módulo de posição simulada
// manual (v16.0 PRO MAX §9.1/§9.4, escopo decidido pelo Operador: SÓ
// painel manual, ZERO automação). Prova especificamente que nenhuma
// função aqui fecha ou reabre nada sozinha — toda transição exige os
// argumentos de uma ação explícita (preço + reason), nunca um relógio ou
// tick próprio.
import { describe, it, expect } from 'vitest';
import {
  openPaperPosition,
  closePaperPosition,
  unrealizedPnl,
  unrealizedPnlPct,
  paperPositionContext,
  rehydratePaperTrading,
  EMPTY_PAPER_TRADING_STATE,
  PAPER_TRADING_CONTRACT_VERSION,
  PAPER_TRADING_HISTORY_CAP,
  PAPER_NEAR_THRESHOLD_PCT,
  type PaperTradingState,
  type SimulatedPosition,
} from '../src/nexus/paper-trading';
import type { TradePlan } from '../src/nexus/trade-plan';

function makePlan(direction: 'LONG' | 'SHORT', entryLow: number, entryHigh: number, stopPrice: number, targetPrices: number[]): TradePlan {
  return {
    contractVersion: 2,
    direction,
    entry: { low: entryLow, high: entryHigh, basis: 'SR_SUPPORT_1' },
    stop: { price: stopPrice, basis: 'SR_SUPPORT_1' },
    targets: targetPrices.map((price) => ({ price, basis: 'SR_RESISTANCE_1' })),
    riskRewardRatios: targetPrices.map(() => 1),
    computedAt: 1_700_000_000_000,
  };
}

const LONG_PLAN = makePlan('LONG', 99, 101, 90, [110, 120]);
const SHORT_PLAN = makePlan('SHORT', 99, 101, 110, [90, 80]);

describe('paper-trading: openPaperPosition', () => {
  it('abre a partir de um plano real, entryPrice = midpoint da zona de entrada', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1_700_000_100_000);
    expect(s.position).not.toBeNull();
    expect(s.position!.entryPrice).toBe(100); // (99+101)/2
    expect(s.position!.direction).toBe('LONG');
    expect(s.position!.sizeUsdt).toBe(1000);
    expect(s.position!.openedAt).toBe(1_700_000_100_000);
    expect(s.position!.closedAt).toBeNull();
  });

  it('NUNCA substitui uma posição já aberta — devolve o estado ORIGINAL (a UI decide avisar o Operador)', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const second = openPaperPosition(opened, SHORT_PLAN, 500, 2);
    expect(second).toBe(opened); // mesma referência — nada mudou
    expect(second.position!.direction).toBe('LONG');
    expect(second.position!.sizeUsdt).toBe(1000);
  });

  it('sem plano (null) => estado ORIGINAL', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, null, 1000, 1);
    expect(s).toBe(EMPTY_PAPER_TRADING_STATE);
  });

  it('size inválido (<=0, NaN, Infinity) => estado ORIGINAL, nunca abre com tamanho fabricado', () => {
    expect(openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 0, 1).position).toBeNull();
    expect(openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, -100, 1).position).toBeNull();
    expect(openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, NaN, 1).position).toBeNull();
    expect(openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, Infinity, 1).position).toBeNull();
  });
});

describe('paper-trading: unrealizedPnlPct / unrealizedPnl — sinal e magnitude', () => {
  it('LONG: preço sobe => P&L positivo; preço desce => P&L negativo', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    expect(unrealizedPnlPct(s.position, 110)).toBeCloseTo(10, 10); // +10% de 100 -> 110
    expect(unrealizedPnl(s.position, 110)).toBeCloseTo(100, 10); // 10% de 1000 USDT
    expect(unrealizedPnlPct(s.position, 90)).toBeCloseTo(-10, 10);
    expect(unrealizedPnl(s.position, 90)).toBeCloseTo(-100, 10);
  });

  it('SHORT: preço desce => P&L positivo; preço sobe => P&L negativo (sinal invertido)', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, SHORT_PLAN, 1000, 1);
    expect(unrealizedPnlPct(s.position, 90)).toBeCloseTo(10, 10); // preço caiu 10% -> a favor do SHORT
    expect(unrealizedPnl(s.position, 90)).toBeCloseTo(100, 10);
    expect(unrealizedPnlPct(s.position, 110)).toBeCloseTo(-10, 10);
    expect(unrealizedPnl(s.position, 110)).toBeCloseTo(-100, 10);
  });

  it('sem posição aberta, ou preço não finito => null (nunca um zero fabricado)', () => {
    expect(unrealizedPnl(null, 100)).toBeNull();
    expect(unrealizedPnlPct(null, 100)).toBeNull();
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    expect(unrealizedPnl(s.position, NaN)).toBeNull();
    expect(unrealizedPnlPct(s.position, Infinity)).toBeNull();
  });
});

describe('paper-trading: closePaperPosition — SEMPRE ação explícita do Operador', () => {
  it('fecha a posição aberta, move para o histórico com realizedPnl/closedPrice/closeReason/closedAt reais', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const closed = closePaperPosition(opened, 120, 999, 'TARGET');
    expect(closed.position).toBeNull();
    expect(closed.history).toHaveLength(1);
    const rec = closed.history[0];
    expect(rec.closedAt).toBe(999);
    expect(rec.closedPrice).toBe(120);
    expect(rec.closeReason).toBe('TARGET');
    expect(rec.realizedPnl).toBeCloseTo(200, 10); // +20% de 1000
  });

  it('reason documenta só o clique do Operador — MANUAL fecha exatamente como TARGET/STOP, mesma matemática, sem diferença de comportamento', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const closedManual = closePaperPosition(opened, 105, 2, 'MANUAL');
    expect(closedManual.history[0].realizedPnl).toBeCloseTo(50, 10);
    expect(closedManual.history[0].closeReason).toBe('MANUAL');
  });

  it('sem posição aberta => estado ORIGINAL, nunca cria um registro fabricado', () => {
    const s = closePaperPosition(EMPTY_PAPER_TRADING_STATE, 100, 1, 'MANUAL');
    expect(s).toBe(EMPTY_PAPER_TRADING_STATE);
  });

  it('preço não finito => estado ORIGINAL, nunca fecha com um preço inventado', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const s = closePaperPosition(opened, NaN, 2, 'MANUAL');
    expect(s).toBe(opened);
  });

  it('histórico é ring-capped em PAPER_TRADING_HISTORY_CAP — fechamento mais antigo cai primeiro', () => {
    const filler: SimulatedPosition = {
      plan: LONG_PLAN, direction: 'LONG', entryPrice: 100, sizeUsdt: 1,
      openedAt: 0, closedAt: 0, closedPrice: 100, closeReason: 'MANUAL', realizedPnl: 0,
    };
    const preFilled: PaperTradingState = {
      ...EMPTY_PAPER_TRADING_STATE,
      position: { ...filler, closedAt: null, closedPrice: null, closeReason: null, realizedPnl: null, openedAt: 1 },
      history: Array.from({ length: PAPER_TRADING_HISTORY_CAP }, (_, i) => ({ ...filler, openedAt: i })),
    };
    const closed = closePaperPosition(preFilled, 200, 999, 'MANUAL');
    expect(closed.history).toHaveLength(PAPER_TRADING_HISTORY_CAP);
    expect(closed.history[closed.history.length - 1].closedAt).toBe(999); // o novo fechamento sobrevive
    expect(closed.history[0].openedAt).toBe(1); // o mais antigo (openedAt:0) foi descartado
  });
});

describe('paper-trading: paperPositionContext — só informativo, nunca aciona nada', () => {
  it('calcula distância real ao stop e ao alvo 1, e os flags near* no limiar PAPER_NEAR_THRESHOLD_PCT', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1); // stop=90, target1=110
    const far = paperPositionContext(opened.position, 100);
    expect(far.distanceToStopPct).toBeCloseTo(10, 8);
    expect(far.distanceToTarget1Pct).toBeCloseTo(10, 8);
    expect(far.nearStop).toBe(false);
    expect(far.nearTarget).toBe(false);

    const nearTargetPrice = 110 * (1 - PAPER_NEAR_THRESHOLD_PCT / 100 / 2); // bem dentro do limiar de 0.3%
    const near = paperPositionContext(opened.position, nearTargetPrice);
    expect(near.nearTarget).toBe(true);
    expect(near.nearStop).toBe(false);
  });

  it('sem posição aberta, ou preço não finito => tudo null/false, nunca um valor fabricado', () => {
    const empty = paperPositionContext(null, 100);
    expect(empty).toEqual({ distanceToStopPct: null, distanceToTarget1Pct: null, nearStop: false, nearTarget: false });
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const invalid = paperPositionContext(opened.position, NaN);
    expect(invalid.distanceToStopPct).toBeNull();
    expect(invalid.nearStop).toBe(false);
  });
});

describe('paper-trading: rehydratePaperTrading — fail-closed, posição aberta sobrevive ao reload', () => {
  it('estado estruturalmente válido da mesma versão passa direto, incluindo uma posição ABERTA (nunca forçada a fechar)', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const rehydrated = rehydratePaperTrading(opened);
    expect(rehydrated).toEqual(opened);
    expect(rehydrated.position).not.toBeNull();
  });

  it('lixo/versão estranha/shape inválido => estado vazio honesto, nunca um resultado parcialmente confiado', () => {
    expect(rehydratePaperTrading(null)).toEqual(EMPTY_PAPER_TRADING_STATE);
    expect(rehydratePaperTrading(undefined)).toEqual(EMPTY_PAPER_TRADING_STATE);
    expect(rehydratePaperTrading('nao é um objeto')).toEqual(EMPTY_PAPER_TRADING_STATE);
    expect(rehydratePaperTrading({ contractVersion: 999, position: null, history: [] })).toEqual(EMPTY_PAPER_TRADING_STATE);
    expect(rehydratePaperTrading({ contractVersion: PAPER_TRADING_CONTRACT_VERSION, position: null })).toEqual(EMPTY_PAPER_TRADING_STATE); // sem history[]
  });
});
