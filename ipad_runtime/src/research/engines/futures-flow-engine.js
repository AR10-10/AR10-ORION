// futures-flow-engine.js — Motor de fluxo de futuros (FUTURE).
// Descrevera o fluxo agregado de ordens em mercados futuros (CVD, expansao
// ou contracao de Open Interest) como leitura de contexto, nunca como
// gatilho de ordem ou recomendacao de posicionamento.
//
// Conceitos financeiros que este motor usara: CVD, OI expansion/contraction,
// Volume Profile.

export const metadata = {
    engine: 'futures-flow-engine',
    description: 'Leitura descritiva de fluxo agregado em futuros (CVD/OI).',
    concepts: ['CVD', 'OI expansion/contraction', 'Volume Profile'],
    required_data: ['futures_trades', 'open_interest_series', 'volume_series'],
    status: 'FUTURE',
};

/**
 * Stub de leitura de fluxo. Nao implementado: nao calcula nada real.
 * @param {{ futures_trades: unknown, open_interest_series: unknown, volume_series: unknown }} _input
 * @returns {{ status: 'FUTURE', engine: string }}
 */
export function analyze(_input) {
    return { status: 'FUTURE', engine: metadata.engine };
}
