// momentum-engine.js — Motor de momentum (FUTURE).
// Avaliara forca/exaustao de movimento via RSI e MACD, retornando apenas
// um rotulo descritivo de momentum (ex.: "momentum: enfraquecendo"),
// nunca um gatilho de entrada/saida.
//
// Conceitos financeiros que este motor usara: RSI, MACD, EMA.

export const metadata = {
    engine: 'momentum-engine',
    description: 'Leitura descritiva de forca/exaustao de momentum (RSI/MACD).',
    concepts: ['RSI', 'MACD', 'EMA'],
    required_data: ['ohlcv_series', 'timeframe'],
    status: 'FUTURE',
};

/**
 * Stub de leitura de momentum. Nao implementado: nao calcula nada real.
 * @param {{ ohlcv_series: unknown, timeframe: unknown }} _input
 * @returns {{ status: 'FUTURE', engine: string }}
 */
export function analyze(_input) {
    return { status: 'FUTURE', engine: metadata.engine };
}
