// trend-engine.js — Motor de tendencia (FUTURE).
// Classificara a direcao de tendencia (alta/baixa/lateral) via EMA, SMA e
// Market Structure, retornando apenas o rotulo descritivo (ex.:
// "tendencia: alta"), nunca uma ordem de compra/venda.
//
// Conceitos financeiros que este motor usara: EMA, SMA, Market Structure,
// Pivots.

export const metadata = {
    engine: 'trend-engine',
    description: 'Classificacao descritiva de direcao de tendencia (EMA/SMA/estrutura).',
    concepts: ['EMA', 'SMA', 'Market Structure', 'Pivots'],
    required_data: ['ohlcv_series', 'timeframe'],
    status: 'FUTURE',
};

/**
 * Stub de classificacao de tendencia. Nao implementado: nao calcula nada real.
 * @param {{ ohlcv_series: unknown, timeframe: unknown }} _input
 * @returns {{ status: 'FUTURE', engine: string }}
 */
export function analyze(_input) {
    return { status: 'FUTURE', engine: metadata.engine };
}
