// funding-oi-engine.js — Motor de funding e open interest (FUTURE).
// Descrevera extremos de funding rate e variacao de Open Interest como
// contexto de mercado (ex.: "funding em extremo positivo"), nunca como
// sinal de abertura/fechamento de posicao.
//
// Conceitos financeiros que este motor usara: Funding extremes,
// OI expansion/contraction.

export const metadata = {
    engine: 'funding-oi-engine',
    description: 'Leitura descritiva de extremos de funding e variacao de OI.',
    concepts: ['Funding extremes', 'OI expansion/contraction'],
    required_data: ['funding_rate_series', 'open_interest_series'],
    status: 'FUTURE',
};

/**
 * Stub de leitura de funding/OI. Nao implementado: nao calcula nada real.
 * @param {{ funding_rate_series: unknown, open_interest_series: unknown }} _input
 * @returns {{ status: 'FUTURE', engine: string }}
 */
export function analyze(_input) {
    return { status: 'FUTURE', engine: metadata.engine };
}
