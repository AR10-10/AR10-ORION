// support-resistance-engine.js — Motor de suporte/resistência (graduado,
// ver QUARANTINE.md secao "Engines graduados").
// Identifica niveis reais a partir de Pivots/Swing High-Low (metodo
// fractal: maximo/minimo local confirmado por K candles de cada lado) e
// projeta extensao de Fibonacci (61.8%) sobre a ultima perna confirmada —
// sempre niveis derivados de candles reais (ohlcv_series), nunca uma
// instrucao de compra/venda. Pura funcao de calculo: zero fetch, zero
// rede, zero estado global.
//
// Volume Profile (HVN/LVN) continua listado em `concepts` como conceito
// documentado do dominio, mas NAO esta implementado nesta fase: nenhum
// conector de volume profile real esta conectado a este motor ainda —
// melhor declarar DADOS_INSUFICIENTES do que fabricar uma confirmacao de
// volume que nao existe.

export const metadata = {
    engine: 'support-resistance-engine',
    description: 'Niveis de suporte/resistência (2 por lado) e extensão de Fibonacci a partir de pivots/swing high-low sobre candles reais.',
    concepts: ['Pivots', 'Swing High/Low', 'Fibonacci retracement/extension', 'Volume Profile'],
    required_data: ['ohlcv_series', 'timeframe', 'volume_profile'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Volume Profile (HVN/LVN) nao tem conector real conectado nesta arvore: niveis vem so de pivots/swing/Fibonacci sobre preco, nunca de volume.',
        'Sem swing high/low confirmados o suficiente na amostra, cai em DADOS_INSUFICIENTES — nunca extrapola um nivel.',
    ],
};

const MIN_CANDLES = 15;
const FRACTAL_K = 2;

function findSwings(candles, k, isHigh) {
    const out = [];
    for (let i = k; i < candles.length - k; i++) {
        const v = isHigh ? candles[i].h : candles[i].l;
        if (!Number.isFinite(v)) continue;
        let confirmed = true;
        for (let j = i - k; j <= i + k; j++) {
            if (j === i) continue;
            const cmp = isHigh ? candles[j].h : candles[j].l;
            if (!Number.isFinite(cmp) || (isHigh ? cmp >= v : cmp <= v)) { confirmed = false; break; }
        }
        if (confirmed) out.push({ index: i, price: v });
    }
    return out;
}

/**
 * @param {{ ohlcv_series: Array<{t:number,o:number,h:number,l:number,c:number,v:number}>, timeframe?: string, volume_profile?: unknown }} input
 * @returns {object} status 'OK' com niveis reais, ou 'DADOS_INSUFICIENTES' com motivo — nunca um nivel inventado.
 */
export function analyze(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    if (candles.length < MIN_CANDLES) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: `apenas_${candles.length}_candles_abaixo_do_minimo_${MIN_CANDLES}` };
    }

    const swingHighs = findSwings(candles, FRACTAL_K, true).sort((a, b) => b.index - a.index);
    const swingLows = findSwings(candles, FRACTAL_K, false).sort((a, b) => b.index - a.index);

    if (swingHighs.length < 1 || swingLows.length < 1) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: 'nenhum_swing_high_low_confirmado_nesta_amostra' };
    }

    const highPrices = [...new Set(swingHighs.map((s) => s.price))].sort((a, b) => b - a);
    const lowPrices = [...new Set(swingLows.map((s) => s.price))].sort((a, b) => a - b);

    const lastHigh = swingHighs[0];
    const lastLow = swingLows[0];
    const legRange = Math.abs(lastHigh.price - lastLow.price);
    const lastLegIsUp = lastHigh.index > lastLow.index;

    return {
        status: 'OK',
        engine: metadata.engine,
        resistance_1: highPrices[0],
        resistance_2: highPrices.length > 1 ? highPrices[1] : 'DADOS_INSUFICIENTES',
        support_1: lowPrices[0],
        support_2: lowPrices.length > 1 ? lowPrices[1] : 'DADOS_INSUFICIENTES',
        // Extensao de Fibonacci (61.8%) projetada a partir da ultima perna
        // confirmada — so' preenche o lado cuja ultima perna real confirma a
        // direcao (subida confirma projecao de alta, queda confirma projecao
        // de baixa); o outro lado fica DADOS_INSUFICIENTES de proposito em vez
        // de forcar uma projecao sobre a perna errada.
        fib_extension_long_target: (legRange > 0 && lastLegIsUp) ? lastHigh.price + legRange * 0.618 : 'DADOS_INSUFICIENTES',
        fib_extension_short_target: (legRange > 0 && !lastLegIsUp) ? lastLow.price - legRange * 0.618 : 'DADOS_INSUFICIENTES',
        swings_used: { highs: swingHighs.length, lows: swingLows.length },
    };
}
