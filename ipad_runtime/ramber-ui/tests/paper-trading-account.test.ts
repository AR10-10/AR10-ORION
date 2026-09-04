// paper-trading-account.test.ts — execução REAL da conta simulada do
// contrato v2: preço médio (DCA), alavancagem/margem/liquidação, equity,
// curva de capital e drawdown.
//
// Categoria de teste deliberada (convenção do CLAUDE.md): tudo aqui é
// EXECUÇÃO REAL, porque em todos estes casos o bug provável é "a
// matemática está sutilmente errada" — não "esqueceram de ligar A com B".
// O caso mais importante do arquivo é justamente esse: a média ponderada
// de DCA tem uma forma errada que PARECE certa (ver primeiro describe).
import { describe, it, expect } from 'vitest';
import {
  openPaperPosition,
  addPaperEntry,
  closePaperPosition,
  weightedAveragePrice,
  paperMarginUsed,
  paperLiquidationPrice,
  paperLiquidationStatus,
  unrealizedPnl,
  paperEquity,
  paperDrawdown,
  recordPaperEquity,
  rehydratePaperTrading,
  EMPTY_PAPER_TRADING_STATE,
  PAPER_INITIAL_BALANCE_USDT,
  PAPER_MAINTENANCE_MARGIN_RATE,
  PAPER_MAX_LEVERAGE,
  PAPER_EQUITY_CURVE_CAP,
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

// Entrada exatamente em 100 (midpoint de 99/101) para as contas ficarem legíveis.
const LONG_PLAN = makePlan('LONG', 99, 101, 90, [110, 120]);
const SHORT_PLAN = makePlan('SHORT', 99, 101, 110, [90, 80]);

describe('DCA: preço médio é custo/unidades, NUNCA média ponderada pelo nocional', () => {
  it('O CASO QUE PEGA O ERRO SUTIL: $1000 a 100 + $1000 a 50 => 66,67 (não 75)', () => {
    // Média ponderada pelo nocional daria (100*1000 + 50*1000)/2000 = 75.
    // Mas $1000 a 100 compra 10 unidades e $1000 a 50 compra 20 = 30
    // unidades por $2000 => 66,67. Este teste falha se alguém "simplificar"
    // a fórmula para a versão que parece óbvia.
    const avg = weightedAveragePrice([
      { price: 100, sizeUsdt: 1000, at: 1 },
      { price: 50, sizeUsdt: 1000, at: 2 },
    ]);
    expect(avg).toBeCloseTo(2000 / 30, 10);
    expect(avg).toBeCloseTo(66.6667, 3);
    expect(avg).not.toBeCloseTo(75, 1);
  });

  it('aporte único devolve o próprio preço', () => {
    expect(weightedAveragePrice([{ price: 100, sizeUsdt: 500, at: 1 }])).toBeCloseTo(100, 10);
  });

  it('fail-closed: lista vazia, preço/nocional inválidos => null, nunca um número fabricado', () => {
    expect(weightedAveragePrice([])).toBeNull();
    expect(weightedAveragePrice([{ price: 0, sizeUsdt: 100, at: 1 }])).toBeNull();
    expect(weightedAveragePrice([{ price: -5, sizeUsdt: 100, at: 1 }])).toBeNull();
    expect(weightedAveragePrice([{ price: 100, sizeUsdt: 0, at: 1 }])).toBeNull();
    expect(weightedAveragePrice([{ price: NaN, sizeUsdt: 100, at: 1 }])).toBeNull();
  });

  it('addPaperEntry recalcula preço médio e soma o nocional total', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const after = addPaperEntry(opened, 50, 1000, 2);
    expect(after.position?.entries).toHaveLength(2);
    expect(after.position?.sizeUsdt).toBe(2000);
    expect(after.position?.entryPrice).toBeCloseTo(2000 / 30, 10);
  });

  it('fail-closed: aporte sem posição aberta, ou com preço/tamanho inválido => estado ORIGINAL', () => {
    expect(addPaperEntry(EMPTY_PAPER_TRADING_STATE, 100, 500, 1)).toBe(EMPTY_PAPER_TRADING_STATE);
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    expect(addPaperEntry(opened, 0, 500, 2)).toBe(opened);
    expect(addPaperEntry(opened, 100, -1, 2)).toBe(opened);
    expect(addPaperEntry(opened, NaN, 500, 2)).toBe(opened);
  });
});

describe('Alavancagem, margem e liquidação — sem fantasia de posição imortal', () => {
  it('margem = nocional / alavancagem; em 1x a margem é o próprio nocional', () => {
    const dezX = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1, 'BTCUSDT', 10);
    expect(paperMarginUsed(dezX.position)).toBeCloseTo(100, 10);
    const umX = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    expect(paperMarginUsed(umX.position)).toBeCloseTo(1000, 10);
  });

  it('alavancagem inválida cai em 1x — nunca um valor inventado', () => {
    const casos = [0, -5, NaN, Infinity, undefined];
    for (const lev of casos) {
      const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1, 'BTCUSDT', lev as number);
      expect(s.position?.leverage).toBe(1);
    }
  });

  it('alavancagem acima do teto declarado é limitada ao teto', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1, 'BTCUSDT', 9999);
    expect(s.position?.leverage).toBe(PAPER_MAX_LEVERAGE);
  });

  it('preço de liquidação LONG fica ABAIXO da entrada, na fórmula declarada', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1, 'BTCUSDT', 10);
    // entrada 100, 10x => 100 * (1 - (0.1 - 0.005)) = 90.5
    expect(paperLiquidationPrice(s.position)).toBeCloseTo(100 * (1 - (1 / 10 - PAPER_MAINTENANCE_MARGIN_RATE)), 10);
    expect(paperLiquidationPrice(s.position)!).toBeLessThan(100);
  });

  it('preço de liquidação SHORT fica ACIMA da entrada (espelho exato)', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, SHORT_PLAN, 1000, 1, 'BTCUSDT', 10);
    expect(paperLiquidationPrice(s.position)).toBeCloseTo(100 * (1 + (1 / 10 - PAPER_MAINTENANCE_MARGIN_RATE)), 10);
    expect(paperLiquidationPrice(s.position)!).toBeGreaterThan(100);
  });

  it('em 1x o nível de liquidação é praticamente zero — posição sem alavancagem não liquida', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    expect(paperLiquidationPrice(s.position)!).toBeCloseTo(100 * PAPER_MAINTENANCE_MARGIN_RATE, 10);
    expect(paperLiquidationPrice(s.position)!).toBeLessThan(1);
  });

  it('status de liquidação detecta o cruzamento nos dois sentidos, e NÃO fecha a posição', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1, 'BTCUSDT', 10);
    expect(paperLiquidationStatus(s.position, 95).breached).toBe(false);
    expect(paperLiquidationStatus(s.position, 90).breached).toBe(true);
    // a leitura é derivada: o estado continua com a posição ABERTA
    expect(s.position).not.toBeNull();
    expect(s.position?.closedAt).toBeNull();

    const short = openPaperPosition(EMPTY_PAPER_TRADING_STATE, SHORT_PLAN, 1000, 1, 'BTCUSDT', 10);
    expect(paperLiquidationStatus(short.position, 105).breached).toBe(false);
    expect(paperLiquidationStatus(short.position, 110).breached).toBe(true);
  });

  it('A TRAVA QUE IMPEDE A FANTASIA: perda não-realizada nunca passa da margem', () => {
    // 10x, nocional 1000 => margem 100. Preço cai 50% => a conta ingênua
    // daria -500, impossível em margem isolada (a posição teria sido
    // liquidada muito antes). O teto é -100.
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1, 'BTCUSDT', 10);
    expect(unrealizedPnl(s.position, 50)).toBeCloseTo(-100, 10);
    // o lucro NÃO é travado — só a perda
    expect(unrealizedPnl(s.position, 150)).toBeCloseTo(500, 10);
  });

  it('em 1x o P&L continua idêntico ao comportamento do contrato v1', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    expect(unrealizedPnl(s.position, 110)).toBeCloseTo(100, 10);
    expect(unrealizedPnl(s.position, 90)).toBeCloseTo(-100, 10);
  });
});

describe('Conta simulada: saldo, equity, curva de capital e drawdown', () => {
  it('estado vazio começa no saldo declarado, sem curva e sem drawdown', () => {
    expect(EMPTY_PAPER_TRADING_STATE.balance).toBe(PAPER_INITIAL_BALANCE_USDT);
    expect(EMPTY_PAPER_TRADING_STATE.equityCurve).toEqual([]);
    expect(EMPTY_PAPER_TRADING_STATE.maxDrawdownPct).toBe(0);
  });

  it('equity = saldo + flutuante; sem posição aberta, equity == saldo', () => {
    expect(paperEquity(EMPTY_PAPER_TRADING_STATE, 12345)).toBe(PAPER_INITIAL_BALANCE_USDT);
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    expect(paperEquity(s, 110)).toBeCloseTo(PAPER_INITIAL_BALANCE_USDT + 100, 10);
  });

  it('fechar credita o resultado no SALDO realizado (o único momento em que ele muda)', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    expect(opened.balance).toBe(PAPER_INITIAL_BALANCE_USDT); // abrir não mexe no saldo
    const closed = closePaperPosition(opened, 110, 2, 'MANUAL');
    expect(closed.balance).toBeCloseTo(PAPER_INITIAL_BALANCE_USDT + 100, 10);
    expect(closed.history[0]?.realizedPnl).toBeCloseTo(100, 10);
  });

  it('prejuízo realizado reduz o saldo e vira drawdown máximo registrado', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const closed = closePaperPosition(opened, 90, 2, 'STOP'); // -100
    expect(closed.balance).toBeCloseTo(PAPER_INITIAL_BALANCE_USDT - 100, 10);
    expect(closed.maxDrawdownPct).toBeGreaterThan(0);
    expect(closed.maxDrawdownPct).toBeCloseTo((100 / PAPER_INITIAL_BALANCE_USDT) * 100, 6);
  });

  it('drawdown máximo NUNCA diminui quando a conta se recupera', () => {
    let s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    s = closePaperPosition(s, 90, 2, 'STOP'); // -100, cria o drawdown
    const piorRegistrado = s.maxDrawdownPct;
    expect(piorRegistrado).toBeGreaterThan(0);
    s = openPaperPosition(s, LONG_PLAN, 1000, 3);
    s = closePaperPosition(s, 130, 4, 'TARGET'); // +300, recupera com folga
    expect(s.balance).toBeGreaterThan(PAPER_INITIAL_BALANCE_USDT);
    expect(s.maxDrawdownPct).toBeGreaterThanOrEqual(piorRegistrado); // memória preservada
    expect(paperDrawdown(s, 130).currentPct).toBe(0); // mas o ATUAL zera no topo novo
  });

  it('drawdown atual enxerga o flutuante da posição ABERTA (leitura ao vivo)', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const dd = paperDrawdown(s, 90); // -100 flutuante
    expect(dd.currentPct).toBeCloseTo((100 / PAPER_INITIAL_BALANCE_USDT) * 100, 6);
  });

  it('recordPaperEquity anota o ponto SEM tocar na posição (observação, nunca transição)', () => {
    const opened = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    const gravado = recordPaperEquity(opened, 110, 1_700_000_000_000);
    expect(gravado.equityCurve).toHaveLength(1);
    expect(gravado.equityCurve[0].equity).toBeCloseTo(PAPER_INITIAL_BALANCE_USDT + 100, 10);
    expect(gravado.equityCurve[0].t).toBe(1_700_000_000_000);
    // a posição segue aberta e intacta — esta função não decide nada
    expect(gravado.position).toEqual(opened.position);
  });

  it('a curva é ring-capped — nunca cresce sem limite na memória', () => {
    let s: typeof EMPTY_PAPER_TRADING_STATE = EMPTY_PAPER_TRADING_STATE;
    for (let i = 0; i < PAPER_EQUITY_CURVE_CAP + 50; i++) {
      s = recordPaperEquity(s, 100, 1_700_000_000_000 + i);
    }
    expect(s.equityCurve).toHaveLength(PAPER_EQUITY_CURVE_CAP);
    // manteve os MAIS RECENTES (o mais antigo caiu fora)
    expect(s.equityCurve[s.equityCurve.length - 1].t).toBe(1_700_000_000_000 + PAPER_EQUITY_CURVE_CAP + 49);
  });

  it('fail-closed: preço/instante não finitos não geram ponto nenhum', () => {
    expect(recordPaperEquity(EMPTY_PAPER_TRADING_STATE, NaN, 1)).toBe(EMPTY_PAPER_TRADING_STATE);
    expect(recordPaperEquity(EMPTY_PAPER_TRADING_STATE, 100, NaN)).toBe(EMPTY_PAPER_TRADING_STATE);
    expect(recordPaperEquity(EMPTY_PAPER_TRADING_STATE, Infinity, 1)).toBe(EMPTY_PAPER_TRADING_STATE);
  });
});

describe('symbol na posição — lacuna real corrigida', () => {
  it('registra o ativo informado pelo chamador', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1, 'ETHUSDT', 5);
    expect(s.position?.symbol).toBe('ETHUSDT');
  });

  it('sem symbol informado fica null HONESTO — nunca um símbolo chutado', () => {
    const s = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1);
    expect(s.position?.symbol).toBeNull();
    const vazio = openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1, '');
    expect(vazio.position?.symbol).toBeNull();
  });
});

describe('rehydratePaperTrading: fail-closed também nos campos de conta do v2', () => {
  it('estado v2 completo sobrevive ao reload', () => {
    const s = recordPaperEquity(openPaperPosition(EMPTY_PAPER_TRADING_STATE, LONG_PLAN, 1000, 1), 110, 2);
    expect(rehydratePaperTrading(s)).toEqual(s);
  });

  it('estado que passou a versão mas veio sem campo de conta => vazio (nunca NaN na curva)', () => {
    const base = { contractVersion: 2, position: null, history: [] };
    expect(rehydratePaperTrading({ ...base, peakEquity: 1, maxDrawdownPct: 0, equityCurve: [] })).toEqual(EMPTY_PAPER_TRADING_STATE); // sem balance
    expect(rehydratePaperTrading({ ...base, balance: 1, maxDrawdownPct: 0, equityCurve: [] })).toEqual(EMPTY_PAPER_TRADING_STATE); // sem peakEquity
    expect(rehydratePaperTrading({ ...base, balance: 1, peakEquity: 1, maxDrawdownPct: 0 })).toEqual(EMPTY_PAPER_TRADING_STATE); // sem equityCurve
    expect(rehydratePaperTrading({ ...base, balance: NaN, peakEquity: 1, maxDrawdownPct: 0, equityCurve: [] })).toEqual(EMPTY_PAPER_TRADING_STATE); // balance NaN
  });

  it('estado do contrato v1 (sem os campos novos) volta vazio — migração honesta declarada', () => {
    const v1 = { contractVersion: 1, position: null, history: [] };
    expect(rehydratePaperTrading(v1)).toEqual(EMPTY_PAPER_TRADING_STATE);
  });
});
