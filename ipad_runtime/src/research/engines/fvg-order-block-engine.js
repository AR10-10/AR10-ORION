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
//
// Equal Highs / Equal Lows (zonas de liquidez / "caca a stops"): mesmo
// metodo fractal de swing high/low que support-resistance-engine.js usa
// (K=2 candles de cada lado), agrupando swings cujo preco fica dentro de
// EQUAL_TOLERANCE_PCT do primeiro swing do grupo (ancora fixa — nunca
// "deriva" comparando com uma media rodante, que poderia encadear swings
// afastados entre si um a um). Grupos com >=2 swings reais viram uma zona;
// `swept` = true quando um candle POSTERIOR real ja' rompeu o nivel
// (o proprio evento de "stop hunt" acontecendo, nao uma previsao dele).

// findSwings/FRACTAL_K vivem em fractal-swings.js (remediacao da Auditoria
// Mestra 360°, secao 7): o mesmo algoritmo estava triplicado neste arquivo,
// em support-resistance-engine.js e em market-structure-engine.js.
import { FRACTAL_K, findSwings } from './fractal-swings.js';

export const metadata = {
    engine: 'fvg-order-block-engine',
    description: 'Fair Value Gaps, Order Blocks e zonas de liquidez (Equal Highs/Lows) — Smart Money Concepts — detectados por padrao geometrico determinístico sobre candles reais.',
    concepts: ['Fair Value Gap (imbalance de 3 candles)', 'Order Block (ultima vela oposta antes de deslocamento)', 'Equal Highs/Lows (zonas de liquidez / caca a stops)'],
    required_data: ['ohlcv_series'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Order Block usa a definicao mais comum e checavel objetivamente (ultima vela oposta + deslocamento de close), nao a unica definicao possivel do conceito.',
        'Equal Highs/Lows usa uma tolerancia fixa de preco (0.15%) para agrupar swings — um valor razoavel, nao uma constante universal da literatura SMC.',
        'Sem candles suficientes, cai em DADOS_INSUFICIENTES — nunca inventa uma zona.',
    ],
};

const MIN_CANDLES = 5;
const EQUAL_TOLERANCE_PCT = 0.0015;

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

/** Agrupa swings cujo preco fica dentro de EQUAL_TOLERANCE_PCT do PRIMEIRO
 *  swing do grupo (ancora fixa, nunca media rodante — evita encadear
 *  swings afastados um a um). Grupos com < 2 membros nao viram zona: uma
 *  "equal high/low" real precisa de pelo menos 2 toques reais no nivel. */
function clusterEqualLevels(swings, type, candles) {
    const sorted = [...swings].sort((a, b) => a.price - b.price);
    const zones = [];
    let cluster = [];
    const flush = () => {
        if (cluster.length < 2) return;
        const avgPrice = cluster.reduce((sum, c) => sum + c.price, 0) / cluster.length;
        const lastIndex = Math.max(...cluster.map((c) => c.index));
        // Aditivo (defeito relatado pelo Operador sobre a tela real: "elas
        // antigamente nao atravessavam o grafico todo, so marcava um pedaco
        // da linha... marcava quantas vezes ela testou naquela mesma zona").
        // O cluster SEMPRE soube em quais candles os toques reais
        // aconteceram — so o ultimo indice era exportado, entao a camada
        // visual nao tinha como desenhar o TRECHO real do nivel e desenhava
        // largura total. firstIndex/touchIndices sao leitura direta do mesmo
        // cluster, zero calculo novo, zero mudanca em price/touches/swept.
        const firstIndex = Math.min(...cluster.map((c) => c.index));
        const touchIndices = cluster.map((c) => c.index).sort((a, b) => a - b);
        let swept = false;
        for (let j = lastIndex + 1; j < candles.length; j++) {
            const c = candles[j];
            const hi = c.h ?? c.high;
            const lo = c.l ?? c.low;
            if (type === 'EQUAL_HIGH' && Number.isFinite(hi) && hi > avgPrice) {
                swept = true;
                break;
            }
            if (type === 'EQUAL_LOW' && Number.isFinite(lo) && lo < avgPrice) {
                swept = true;
                break;
            }
        }
        zones.push({ type, price: avgPrice, touches: cluster.length, index: lastIndex, firstIndex, touchIndices, swept });
    };
    for (const s of sorted) {
        if (cluster.length === 0) {
            cluster.push(s);
            continue;
        }
        const anchor = cluster[0].price;
        if (anchor !== 0 && Math.abs(s.price - anchor) / anchor <= EQUAL_TOLERANCE_PCT) {
            cluster.push(s);
        } else {
            flush();
            cluster = [s];
        }
    }
    flush();
    return zones;
}

/** Zonas de liquidez reais: Equal Highs (acima = onde stops de vendedores
 *  a descoberto/take-profits de compradores se acumulam) e Equal Lows
 *  (abaixo = onde stops de compradores se acumulam). */
function findLiquidityZones(candles) {
    const equalHighs = clusterEqualLevels(findSwings(candles, FRACTAL_K, true), 'EQUAL_HIGH', candles);
    const equalLows = clusterEqualLevels(findSwings(candles, FRACTAL_K, false), 'EQUAL_LOW', candles);
    return [...equalHighs, ...equalLows].sort((a, b) => b.index - a.index);
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
    const liquidityZones = findLiquidityZones(candles);

    return {
        status: 'OK',
        engine: metadata.engine,
        fair_value_gaps: fairValueGaps,
        order_blocks: orderBlocks,
        liquidity_zones: liquidityZones,
        unmitigated_fvg_count: fairValueGaps.filter((g) => !g.mitigated).length,
        unmitigated_order_block_count: orderBlocks.filter((b) => !b.mitigated).length,
        unswept_liquidity_zone_count: liquidityZones.filter((z) => !z.swept).length,
    };
}
