// bos-choch-engine.js — Motor de rompimento de estrutura: BOS (Break of
// Structure — rompimento REAL do último swing confirmado na MESMA direção
// da tendência vigente, continuação) e CHOCH (Change of Character —
// rompimento na direção OPOSTA à tendência vigente, primeiro sinal real de
// possível reversão). Reaproveita integralmente o mesmo swing high/low
// fractal (fractal-swings.js) e o mesmo rótulo de estrutura
// (market-structure-engine.js) já graduados — zero segunda implementação
// de detecção de swing ou de comparação HH/HL/LH/LL. Pura função de
// cálculo: zero fetch, zero rede, zero estado global.
import { FRACTAL_K, findSwings } from './fractal-swings.js';
import { analyze as analyzeMarketStructure } from './market-structure-engine.js';

export const metadata = {
    engine: 'bos-choch-engine',
    description: 'Detecta o rompimento REAL mais recente do último swing high/low confirmado — BOS quando na mesma direção da estrutura vigente, CHOCH quando na direção oposta — sobre candles reais.',
    concepts: ['Break of Structure', 'Change of Character', 'Market Structure', 'Swing High/Low'],
    required_data: ['ohlcv_series', 'timeframe'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Depende do mesmo mínimo de 2 swing highs e 2 swing lows confirmados que market-structure-engine.js já exige — sem isso, DADOS_INSUFICIENTES (nunca infere um rompimento sem estrutura real por trás).',
        'Reporta só o rompimento mais recente na amostra (o evento "vivo" agora), nunca um histórico completo — é uma anotação temporária, não um replay.',
        'Rompimento é por FECHAMENTO além do nível, nunca por mecha/wick — mesmo critério conservador já usado por fvg-order-block-engine.js para mitigação.',
    ],
};

/**
 * @param {{ ohlcv_series: Array<{t?:number,o?:number,h?:number,l?:number,c?:number,v?:number,time?:number,open?:number,high?:number,low?:number,close?:number}>, timeframe?: string }} input
 * @returns {object} status 'OK' com `break` real (objeto) ou `break: null`
 *  honesto (nenhum rompimento nesta amostra), ou 'DADOS_INSUFICIENTES'.
 */
export function analyze(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    const structureResult = analyzeMarketStructure(input);
    if (structureResult.status !== 'OK') {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: structureResult.reason };
    }

    const swingHighs = findSwings(candles, FRACTAL_K, true).sort((a, b) => b.index - a.index);
    const swingLows = findSwings(candles, FRACTAL_K, false).sort((a, b) => b.index - a.index);
    // structureResult.status === 'OK' já garante >= 2 confirmados de cada
    // lado (mesmo gate de market-structure-engine.js) — [0] é seguro aqui.
    const lastSwingHigh = swingHighs[0];
    const lastSwingLow = swingLows[0];
    const { structure_label } = structureResult;

    // Varre candle a candle depois do swing mais recente de cada lado;
    // como o loop avança do mais antigo pro mais novo e sempre sobrescreve
    // no match, o valor final é sempre o rompimento REAL mais recente
    // desse lado — nunca o primeiro, que já teria sido "esquecido".
    // Fecho real: mesma tolerância de forma que fractal-swings.js já aplica
    // a h/l — {c} (Bus/ciclo de análise) e {close} (candle do gráfico,
    // computeSmcZones já é chamado com esta forma) representam o mesmo
    // preço real, nunca dois dados diferentes.
    const closeOf = (c) => c.c ?? c.close;
    const timeOf = (c) => c.t ?? c.time;

    let latestBreak = null;
    for (let i = lastSwingHigh.index + 1; i < candles.length; i++) {
        if (closeOf(candles[i]) > lastSwingHigh.price) {
            latestBreak = {
                type: structure_label === 'ESTRUTURA_ALTA' ? 'BOS' : 'CHOCH',
                direction: 'ALTA',
                level: lastSwingHigh.price,
                index: i,
                time: timeOf(candles[i]),
            };
        }
    }
    for (let i = lastSwingLow.index + 1; i < candles.length; i++) {
        if (closeOf(candles[i]) < lastSwingLow.price) {
            const candidate = {
                type: structure_label === 'ESTRUTURA_BAIXA' ? 'BOS' : 'CHOCH',
                direction: 'BAIXA',
                level: lastSwingLow.price,
                index: i,
                time: timeOf(candles[i]),
            };
            // Entre um rompimento de alta e um de baixa na mesma amostra
            // (raro, mercado bem choppy), só o de índice mais recente é o
            // evento "vivo" agora — o outro já foi superado pelo preço.
            if (!latestBreak || candidate.index > latestBreak.index) latestBreak = candidate;
        }
    }

    return {
        status: 'OK',
        engine: metadata.engine,
        break: latestBreak,
        structure_label,
    };
}
