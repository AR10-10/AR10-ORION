// fvg-order-block-engine.js — Motor de Fair Value Gaps (FVG) e Order
// Blocks (Smart Money Concepts) sobre candles reais. Pura funcao de
// calculo: zero fetch, zero rede, zero estado global, mesmo padrao de
// support-resistance-engine.js/market-structure-engine.js nesta mesma
// pasta. Nao e' machine learning nem probabilidade estimada — as duas
// estruturas abaixo sao deteccao deterministica de padrao geometrico
// sobre OHLC real, a mesma categoria de calculo que pivots/swing-high-low
// ja fazem para suporte/resistencia.
//
// Fair Value Gap (imbalance de 3 candles): a vela do meio desloca preco
// tao rapido que a vela anterior e a seguinte nao se sobrepoem —
// bullish: candle[i-1].high < candle[i+1].low (o "buraco" fica entre
// esses dois precos); bearish: candle[i-1].low > candle[i+1].high.
//
// Order Block (ultima vela oposta antes de um movimento de deslocamento):
// bullish: uma vela de baixa (close < open) imediatamente seguida por uma
// vela de alta cujo close rompe o high da vela de baixa (deslocamento
// real, nao so' uma vela verde qualquer); bearish e' o espelho. Esta e' a
// definicao mais comum e mais deterministica do conceito (nao ha uma
// unica definicao "oficial" de Order Block na literatura de SMC/ICT —
// esta implementacao usa a variante checavel objetivamente a partir de
// OHLC puro, sem inferir intenção de "smart money").

export const metadata = {
    engine: 'fvg-order-block-engine',
    description: 'Fair Value Gaps e Order Blocks (Smart Money Concepts) detectados por padrao geometrico determinístico sobre candles reais.',
    concepts: ['Fair Value Gap (imbalance de 3 candles)', 'Order Block (ultima vela oposta antes de deslocamento)'],
    required_data: ['ohlcv_series'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Order Block usa a definicao mais comum e checavel objetivamente (ultima vela oposta + deslocamento de close), nao a unica definicao possivel do conceito.',
        'Sem candles suficientes, cai em DADOS_INSUFICIENTES — nunca inventa uma zona.',
    ],
};

const MIN_CANDLES = 5;

/** Fair Value Gaps: uma por trinca de candles consecutivos. `mitigated`
 *  = true se algum candle POSTERIOR ja' voltou a tocar dentro da zona
 *  (preco real "preencheu" o gap) — calculado sobre os mesmos candles
 *  reais, nunca um preco futuro hipotetico. */
function findFairValueGaps(candles) {
    const gaps = [];
    for (let i = 1; i < candles.length - 1; i++) {
        const prev = candles[i - 1];
        const next = candles[i + 1];
        if (!Number.isFinite(prev.high ?? prev.h) || !Number.isFinite(next.low ?? next.l)) continue;
        const prevHigh = prev.h ?? prev.high;
        const prevLow = prev.l ?? prev.low;
        const nextHigh = next.h ?? next.high;
        const nextLow = next.l ?? next.low;

        if (prevHigh < nextLow) {
            gaps.push({ type: 'BULLISH', index: i, top: nextLow, bottom: prevHigh });
        } else if (prevLow > nextHigh) {
            gaps.push({ type: 'BEARISH', index: i, top: prevLow, bottom: nextHigh });
        }
    }
    return gaps.map((g) => {
        let mitigated = false;
        for (let j = g.index + 2; j < candles.length; j++) {
            const c = candles[j];
            const lo = c.l ?? c.low;
            const hi = c.h ?? c.high;
            if (Number.isFinite(lo) && Number.isFinite(hi) && lo <= g.top && hi >= g.bottom) {
                mitigated = true;
                break;
            }
        }
        return { ...g, mitigated };
    });
}

/** Order Blocks: ultima vela oposta antes de um deslocamento real (o
 *  candle seguinte fecha alem do extremo da vela oposta). `mitigated` =
 *  true se algum candle posterior ja' voltou a entrar na zona. */
function findOrderBlocks(candles) {
    const blocks = [];
    for (let i = 0; i < candles.length - 1; i++) {
        const c = candles[i];
        const n = candles[i + 1];
        const cOpen = c.o ?? c.open;
        const cClose = c.c ?? c.close;
        const cHigh = c.h ?? c.high;
        const cLow = c.l ?? c.low;
        const nClose = n.c ?? n.close;
        if (![cOpen, cClose, cHigh, cLow, nClose].every(Number.isFinite)) continue;

        const isDown = cClose < cOpen;
        const isUp = cClose > cOpen;

        if (isDown && nClose > cHigh) {
            blocks.push({ type: 'BULLISH', index: i, top: cHigh, bottom: cLow });
        } else if (isUp && nClose < cLow) {
            blocks.push({ type: 'BEARISH', index: i, top: cHigh, bottom: cLow });
        }
    }
    return blocks.map((b) => {
        let mitigated = false;
        for (let j = b.index + 2; j < candles.length; j++) {
            const c = candles[j];
            const lo = c.l ?? c.low;
            const hi = c.h ?? c.high;
            if (Number.isFinite(lo) && Number.isFinite(hi) && lo <= b.top && hi >= b.bottom) {
                mitigated = true;
                break;
            }
        }
        return { ...b, mitigated };
    });
}

/**
 * @param {{ ohlcv_series: Array<{t?:number,o?:number,h?:number,l?:number,c?:number,open?:number,high?:number,low?:number,close?:number}> }} input
 * @returns {object} status 'OK' com zonas reais (mais recentes primeiro), ou 'DADOS_INSUFICIENTES'.
 */
export function analyze(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    if (candles.length < MIN_CANDLES) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: `apenas_${candles.length}_candles_abaixo_do_minimo_${MIN_CANDLES}` };
    }

    const fairValueGaps = findFairValueGaps(candles).reverse();
    const orderBlocks = findOrderBlocks(candles).reverse();

    return {
        status: 'OK',
        engine: metadata.engine,
        fair_value_gaps: fairValueGaps,
        order_blocks: orderBlocks,
        unmitigated_fvg_count: fairValueGaps.filter((g) => !g.mitigated).length,
        unmitigated_order_block_count: orderBlocks.filter((b) => !b.mitigated).length,
    };
}
