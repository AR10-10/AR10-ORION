// scenario-builder.js — Construtor de cenarios descritivos (FUTURE).
// Montara cenarios hipoteticos de leitura (ex.: "se romper $X com volume,
// proxima zona de liquidez em $Y-$Z") combinando estrutura, liquidez e
// retracao, sempre como narrativa descritiva — nunca como ordem
// condicional de execucao real.
//
// Conceitos financeiros que este motor usara: Market Structure,
// Swing High/Low, Fibonacci retracement/extension, Liquidity sweep,
// Volume Profile.

export const metadata = {
    engine: 'scenario-builder',
    description: 'Cenarios hipoteticos descritivos combinando estrutura/liquidez/retracao.',
    concepts: ['Market Structure', 'Swing High/Low', 'Fibonacci retracement/extension', 'Liquidity sweep', 'Volume Profile'],
    required_data: ['ohlcv_series', 'volume_profile', 'liquidation_data'],
    status: 'FUTURE',
};

/**
 * Stub de construcao de cenarios. Nao implementado: nao calcula nada real.
 * @param {{ ohlcv_series: unknown, volume_profile: unknown, liquidation_data: unknown }} _input
 * @returns {{ status: 'FUTURE', engine: string }}
 */
export function build(_input) {
    return { status: 'FUTURE', engine: metadata.engine };
}
