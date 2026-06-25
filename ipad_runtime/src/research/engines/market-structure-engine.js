// market-structure-engine.js — Motor de estrutura de mercado (graduado,
// ver QUARANTINE.md secao "Engines graduados").
// Rotula a estrutura observada comparando os 2 swing highs e os 2 swing
// lows mais recentes (mesmo metodo fractal do support-resistance-engine.js
// — maximo/minimo local confirmado por K candles de cada lado): HH+HL =
// estrutura de alta, LH+LL = estrutura de baixa, qualquer outra combinacao
// = lateral/indefinida. Rotulo puramente descritivo do estado estrutural
// observado nos dados de entrada — nunca uma ordem ou recomendacao. Pura
// funcao de calculo: zero fetch, zero rede, zero estado global.

export const metadata = {
    engine: 'market-structure-engine',
    description: 'Rótulo descritivo de estrutura de mercado (HH/HL/LH/LL) a partir de swing high/low confirmados sobre candles reais.',
    concepts: ['Market Structure', 'Swing High/Low', 'Pivots', 'EMA'],
    required_data: ['ohlcv_series', 'timeframe'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'EMA listada em concepts ainda nao e cruzada aqui como confirmacao adicional — rotulo de estrutura vem so de swing high/low nesta fase.',
        'Menos de 2 swing highs ou 2 swing lows confirmados na amostra cai em DADOS_INSUFICIENTES.',
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
 * @param {{ ohlcv_series: Array<{t:number,o:number,h:number,l:number,c:number,v:number}>, timeframe?: string }} input
 * @returns {object} status 'OK' com structure_label real, ou 'DADOS_INSUFICIENTES' com motivo.
 */
export function analyze(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    if (candles.length < MIN_CANDLES) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: `apenas_${candles.length}_candles_abaixo_do_minimo_${MIN_CANDLES}` };
    }

    const swingHighs = findSwings(candles, FRACTAL_K, true).sort((a, b) => b.index - a.index);
    const swingLows = findSwings(candles, FRACTAL_K, false).sort((a, b) => b.index - a.index);

    if (swingHighs.length < 2 || swingLows.length < 2) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: 'menos_de_2_swing_highs_ou_lows_confirmados' };
    }

    const higherHigh = swingHighs[0].price > swingHighs[1].price;
    const higherLow = swingLows[0].price > swingLows[1].price;

    let structure_label;
    if (higherHigh && higherLow) structure_label = 'ESTRUTURA_ALTA';
    else if (!higherHigh && !higherLow) structure_label = 'ESTRUTURA_BAIXA';
    else structure_label = 'ESTRUTURA_LATERAL';

    return {
        status: 'OK',
        engine: metadata.engine,
        structure_label,
        last_swing_high: swingHighs[0].price,
        prev_swing_high: swingHighs[1].price,
        last_swing_low: swingLows[0].price,
        prev_swing_low: swingLows[1].price,
    };
}
