// risk-engine.js — Motor de risco descritivo (FUTURE).
// Descrevera metricas de risco do contexto atual (ex.: ATR relativo,
// distancia a zonas de liquidacao) como informacao de leitura, nunca como
// calculo de tamanho de posicao ou Risk Gate de execucao real — este
// runtime nao executa ordens (ver README.md, secao "o que continua
// bloqueado").
//
// Conceitos financeiros que este motor usara: ATR, Volatility
// compression/expansion, Liquidation clusters.

export const metadata = {
    engine: 'risk-engine',
    description: 'Leitura descritiva de risco de contexto (ATR/liquidacao), sem execucao.',
    concepts: ['ATR', 'Volatility compression/expansion', 'Liquidation clusters'],
    required_data: ['ohlcv_series', 'liquidation_data', 'timeframe'],
    status: 'FUTURE',
};

/**
 * Stub de leitura de risco. Nao implementado: nao calcula nada real.
 * Nunca retornara tamanho de posicao, ordem ou comando de execucao.
 * @param {{ ohlcv_series: unknown, liquidation_data: unknown, timeframe: unknown }} _input
 * @returns {{ status: 'FUTURE', engine: string }}
 */
export function analyze(_input) {
    return { status: 'FUTURE', engine: metadata.engine };
}
