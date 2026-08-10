// signal-fusion-engine.js — Motor de fusao de sinais descritivos (FUTURE).
// Combinara as saidas descritivas dos demais motores (estrutura,
// tendencia, momentum, liquidez, volatilidade) num resumo consolidado de
// leitura, nunca numa decisao de ordem — equivalente conceitual ao
// `decision-frame-panel` do painel principal, que e `STUB CONTROLLED` por
// design (ver README.md).
//
// Conceitos financeiros que este motor usara: Market Structure, EMA, RSI,
// MACD, ATR, Volume Profile (como insumos consolidados, nao recalculados
// aqui).

export const metadata = {
    engine: 'signal-fusion-engine',
    description: 'Resumo descritivo consolidado dos demais motores, sem decisao de ordem.',
    concepts: ['Market Structure', 'EMA', 'RSI', 'MACD', 'ATR', 'Volume Profile'],
    required_data: ['engine_outputs'],
    status: 'FUTURE',
};

/**
 * Stub de fusao de sinais. Nao implementado: nao calcula nada real.
 * Nunca retornara uma ordem ou comando de execucao.
 * @param {{ engine_outputs: unknown }} _input
 * @returns {{ status: 'FUTURE', engine: string }}
 */
export function analyze(_input) {
    return { status: 'FUTURE', engine: metadata.engine };
}
