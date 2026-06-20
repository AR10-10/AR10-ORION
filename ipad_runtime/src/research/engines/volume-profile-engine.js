// volume-profile-engine.js — Motor de perfil de volume (FUTURE).
// Construira o perfil de volume por faixa de preco (HVN/LVN) a partir da
// serie OHLCV + volume, retornando apenas a descricao das zonas de maior
// e menor negociacao, nunca uma instrucao de entrada/saida.
//
// Conceitos financeiros que este motor usara: Volume Profile, HVN, LVN,
// VWAP (como referencia de valor justo no periodo).

export const metadata = {
    engine: 'volume-profile-engine',
    description: 'Perfil de volume descritivo por faixa de preco (HVN/LVN/VWAP).',
    concepts: ['Volume Profile', 'HVN', 'LVN', 'VWAP'],
    required_data: ['ohlcv_series', 'volume_series', 'timeframe'],
    status: 'FUTURE',
};

/**
 * Stub de calculo de perfil de volume. Nao implementado: nao calcula nada real.
 * @param {{ ohlcv_series: unknown, volume_series: unknown, timeframe: unknown }} _input
 * @returns {{ status: 'FUTURE', engine: string }}
 */
export function analyze(_input) {
    return { status: 'FUTURE', engine: metadata.engine };
}
