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
//
// findSwings/FRACTAL_K vivem em fractal-swings.js (remediacao da Auditoria
// Mestra 360°, secao 7): o mesmo algoritmo estava triplicado neste arquivo,
// em market-structure-engine.js e em fvg-order-block-engine.js.

import { FRACTAL_K, findSwings } from './fractal-swings.js';

export const metadata = {
    engine: 'support-resistance-engine',
    description: 'Niveis de suporte/resistência (2 por lado, com classificação de força por confluência real de swings) e extensão de Fibonacci a partir de pivots/swing high-low sobre candles reais.',
    concepts: ['Pivots', 'Swing High/Low', 'Fibonacci retracement/extension', 'Volume Profile', 'Confluência de nível (força)'],
    required_data: ['ohlcv_series', 'timeframe', 'volume_profile'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Volume Profile (HVN/LVN) nao tem conector real conectado nesta arvore: niveis vem so de pivots/swing/Fibonacci sobre preco, nunca de volume.',
        'Sem swing high/low confirmados o suficiente na amostra, cai em DADOS_INSUFICIENTES — nunca extrapola um nivel.',
        'V11.5 Fase 6: FORTE/FRACA e uma contagem REAL de quantos swings independentes (fractais confirmados) caem dentro da mesma banda de tolerancia de um nivel — nunca uma probabilidade estatistica. Este motor nao estima "chance de o alvo ser atingido": nao ha backtest neste repositorio para sustentar essa afirmacao honestamente (mesmo principio ja documentado em research-engine.js sobre confidence qualitativo vs. probabilidade).',
    ],
};

const MIN_CANDLES = 15;
// Banda de tolerância para contar um swing como "tocando" o mesmo nível —
// 0.15% do próprio preço do nível, não um valor absoluto (funciona igual em
// BTC ~60k e em ativos de preço baixo como XRP).
const STRENGTH_TOLERANCE_FRAC = 0.0015;
const STRONG_TOUCH_THRESHOLD = 2;

/** Conta quantos swings reais (fractais confirmados, incluindo o próprio
 * nível) caem dentro de +-tolerancia% do preço do nível — uma medida real de
 * confluência (quantas vezes o preço reverteu perto desta mesma zona nesta
 * amostra), não uma projeção. >=2 toques independentes = FORTE; 1 = FRACA. */
function computeLevelStrength(levelPrice, swingPoints) {
    if (!Number.isFinite(levelPrice) || swingPoints.length === 0) return null;
    const band = Math.abs(levelPrice) * STRENGTH_TOLERANCE_FRAC;
    const touches = swingPoints.filter((s) => Math.abs(s.price - levelPrice) <= band).length;
    return { label: touches >= STRONG_TOUCH_THRESHOLD ? 'FORTE' : 'FRACA', touches };
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

    // Nivel 1 = swing confirmado mais proximo do preco (hit primeiro); nivel 2
    // = o proximo swing alem do nivel 1 (mais extremo), nunca um valor entre
    // o preco e o nivel 1 — senao o TP2 cairia dentro do TP1 no Target Tracker.
    const resistanceNear = highPrices.length > 1 ? highPrices[1] : highPrices[0];
    const resistanceFar = highPrices.length > 1 ? highPrices[0] : 'DADOS_INSUFICIENTES';
    const supportNear = lowPrices.length > 1 ? lowPrices[1] : lowPrices[0];
    const supportFar = lowPrices.length > 1 ? lowPrices[0] : 'DADOS_INSUFICIENTES';

    // Força por confluência real (V11.5 Fase 6): cada nível é testado contra
    // TODOS os swings do próprio lado (não o deduplicado) — quantos fractais
    // independentes reverteram perto desta mesma zona nesta amostra.
    const resistance1Strength = computeLevelStrength(resistanceNear, swingHighs);
    const resistance2Strength = Number.isFinite(resistanceFar) ? computeLevelStrength(resistanceFar, swingHighs) : null;
    const support1Strength = computeLevelStrength(supportNear, swingLows);
    const support2Strength = Number.isFinite(supportFar) ? computeLevelStrength(supportFar, swingLows) : null;

    return {
        status: 'OK',
        engine: metadata.engine,
        resistance_1: resistanceNear,
        resistance_2: resistanceFar,
        support_1: supportNear,
        support_2: supportFar,
        resistance_1_strength: resistance1Strength,
        resistance_2_strength: resistance2Strength,
        support_1_strength: support1Strength,
        support_2_strength: support2Strength,
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
