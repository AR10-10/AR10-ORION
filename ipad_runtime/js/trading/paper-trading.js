// paper-trading.js — Paper Trading real (preço real quando informado por uma
// fonte ACTIVE_READ_ONLY; nunca preço inventado). Toda ordem passa primeiro
// pelo Risk Gate (trading/risk-gate.js), incluindo NO_STOP_NO_TRADE. Isto
// NUNCA envia ordem para nenhuma exchange: é um livro de posições simulado,
// gravado localmente, separado por completo da rota de Live Trading
// (trading/live-status.js, que permanece LIVE_LOCKED nesta versão). Quem
// chama (app.js) é responsável por fornecer entryPrice/exitPrice reais — este
// módulo nunca faz fetch de preço sozinho, para não duplicar a sonda de rede
// do Real Data Layer.

import { setMeta, getMeta } from '../storage.js';
import * as riskGate from './risk-gate.js';
import { emit, SEVERITY } from '../core/event-bus.js';
import * as evidenceLedger from '../memory/evidence-ledger.js';

const LEDGER_KEY = 'ar10_paper_trading_ledger_v1';
const MAX_TRADES = 100;

async function getLedger() {
    const v = await getMeta(LEDGER_KEY);
    return Array.isArray(v) ? v : [];
}

export async function getOpenPositions() {
    return (await getLedger()).filter((t) => t.status === 'OPEN');
}

export async function getTradeHistory() {
    return getLedger();
}

function computeDrawdownPct(ledger) {
    const closed = ledger.filter((t) => t.status === 'CLOSED' && typeof t.realizedPnlQuote === 'number');
    if (closed.length === 0) return 0;
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const t of closed.slice().reverse()) {
        equity += t.realizedPnlQuote;
        peak = Math.max(peak, equity);
        const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
        maxDrawdown = Math.max(maxDrawdown, dd);
    }
    return maxDrawdown;
}

/** @param {{side:'LONG'|'SHORT', sizeQuote:number, stopLoss:number, entryPrice:number, sourceConnectorId:string, sourceDataQuality:string}} order */
export async function openPaperPosition(order) {
    const ledger = await getLedger();
    const decision = await riskGate.evaluateOrder(order, { currentDrawdownPct: computeDrawdownPct(ledger) });

    if (decision.decision !== 'ALLOW') {
        await evidenceLedger.appendEvidence({ kind: 'paper_trade_blocked', order, decision, recorded_at: new Date().toISOString() });
        emit('paper_trade_blocked', { dataMode: 'PAPER', severity: SEVERITY.WARN, payload: { order, decision } });
        return { opened: false, decision, trade: null };
    }

    const trade = {
        trade_id: `PAPER_${Date.now()}`,
        mode: 'PAPER',
        status: 'OPEN',
        side: order.side,
        sizeQuote: order.sizeQuote,
        stopLoss: order.stopLoss,
        entryPrice: order.entryPrice,
        sourceConnectorId: order.sourceConnectorId || null,
        sourceDataQuality: order.sourceDataQuality || 'DADOS_INSUFICIENTES',
        opened_at: new Date().toISOString(),
        closed_at: null,
        exitPrice: null,
        realizedPnlQuote: null,
    };
    ledger.unshift(trade);
    if (ledger.length > MAX_TRADES) ledger.length = MAX_TRADES;
    await setMeta(LEDGER_KEY, ledger);
    await evidenceLedger.appendEvidence({ kind: 'paper_trade_opened', trade });
    emit('paper_trade_opened', { dataMode: 'PAPER', severity: SEVERITY.OK, payload: { trade } });
    return { opened: true, decision, trade };
}

export async function closePaperPosition(tradeId, exitPrice) {
    const ledger = await getLedger();
    const trade = ledger.find((t) => t.trade_id === tradeId && t.status === 'OPEN');
    if (!trade) return { closed: false, reason: 'posicao_nao_encontrada_ou_ja_fechada', trade: null };

    const direction = trade.side === 'LONG' ? 1 : -1;
    const priceDeltaPct = (exitPrice - trade.entryPrice) / trade.entryPrice;
    trade.realizedPnlQuote = trade.sizeQuote * priceDeltaPct * direction;
    trade.exitPrice = exitPrice;
    trade.status = 'CLOSED';
    trade.closed_at = new Date().toISOString();

    await setMeta(LEDGER_KEY, ledger);
    await evidenceLedger.appendEvidence({ kind: 'paper_trade_closed', trade });
    emit('paper_trade_closed', { dataMode: 'PAPER', severity: SEVERITY.OK, payload: { trade } });
    return { closed: true, reason: null, trade };
}

export async function getPaperSummary() {
    const ledger = await getLedger();
    const open = ledger.filter((t) => t.status === 'OPEN');
    const closed = ledger.filter((t) => t.status === 'CLOSED');
    return {
        mode: 'PAPER',
        open_positions: open.length,
        closed_trades: closed.length,
        realized_pnl_quote: closed.reduce((sum, t) => sum + (t.realizedPnlQuote || 0), 0),
        current_drawdown_pct: computeDrawdownPct(ledger),
    };
}

export async function clearPaperLedger() {
    await setMeta(LEDGER_KEY, []);
}
