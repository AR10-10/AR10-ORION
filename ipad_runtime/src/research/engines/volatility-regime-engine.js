// volatility-regime-engine.js — Motor de regime de volatilidade (FUTURE).
// Classificara o regime de volatilidade atual (compressao/expansao) via
// ATR e Bollinger Bands, retornando apenas um rotulo de regime, nunca uma
// instrucao de tamanho de posicao ou entrada.
//
// Conceitos financeiros que este motor usara: ATR, Bollinger Bands,
// Volatility compression/expansion.

export const metadata = {
    engine: 'volatility-regime-engine',
    description: 'Classificacao descritiva do regime de volatilidade (ATR/Bollinger).',
    concepts: ['ATR', 'Bollinger Bands', 'Volatility compression/expansion'],
    required_data: ['ohlcv_series', 'timeframe'],
    status: 'FUTURE',
};

/**
 * Stub de classificacao de regime. Nao implementado: nao calcula nada real.
 * @param {{ ohlcv_series: unknown, timeframe: unknown }} _input
 * @returns {{ status: 'FUTURE', engine: string }}
 */
export function analyze(_input) {
    return { status: 'FUTURE', engine: metadata.engine };
}
