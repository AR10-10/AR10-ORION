// market-structure-engine.js — Motor de estrutura de mercado (graduado,
// ver QUARANTINE.md secao "Engines graduados").
// Rotula a estrutura observada comparando os 2 swing highs e os 2 swing
// lows mais recentes (mesmo metodo fractal do support-resistance-engine.js
// — maximo/minimo local confirmado por K candles de cada lado): HH+HL =
// estrutura de alta, LH+LL = estrutura de baixa, qualquer outra combinacao
// = lateral/indefinida. Rotulo puramente descritivo do estado estrutural
// observado nos dados de entrada — nunca uma ordem ou recomendacao. Pura
// funcao de calculo: zero fetch, zero rede, zero estado global.

// findSwings/FRACTAL_K vivem em fractal-swings.js (remediacao da Auditoria
// Mestra 360°, secao 7): o mesmo algoritmo estava triplicado neste arquivo,
// em support-resistance-engine.js e em fvg-order-block-engine.js.
import { FRACTAL_K, findSwings } from './fractal-swings.js';

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
    const lowerHigh = swingHighs[0].price < swingHighs[1].price;
    const higherLow = swingLows[0].price > swingLows[1].price;
    const lowerLow = swingLows[0].price < swingLows[1].price;

    // Igualdade (double top/bottom) nao confirma alta nem baixa — exige os
    // dois lados estritamente mais altos (alta) ou estritamente mais baixos
    // (baixa); qualquer outra combinacao, incluindo empate, cai em lateral.
    let structure_label;
    if (higherHigh && higherLow) structure_label = 'ESTRUTURA_ALTA';
    else if (lowerHigh && lowerLow) structure_label = 'ESTRUTURA_BAIXA';
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
