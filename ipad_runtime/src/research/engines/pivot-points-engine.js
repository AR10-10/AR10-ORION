// pivot-points-engine.js — Pivot Points (Classic / Floor Trader), a partir
// do ÚLTIMO CANDLE DIÁRIO FECHADO. Pura função de cálculo: zero fetch, zero
// rede, zero estado global, mesmo padrão de todo motor nesta pasta.
//
// AUDITORIA ANTES DE CONSTRUIR (CLAUDE.md, Disciplina §1 — pedido direto do
// Operador: "qual ferramenta que está faltando"): auditoria do ecossistema
// de indicadores desta sessão (ver QUARANTINE.md) confirmou 7 ferramentas
// clássicas ausentes por grep verificado (CCI, Stochastic, Williams %R,
// MFI, Ichimoku, Pivot Points, Keltner). Deste conjunto, Pivot Points é o
// único gap real e não-redundante pra um terminal de FUTUROS intradiário:
// CCI/Stochastic/Williams%R/MFI são substituíveis pelo RSI de Wilder + CVD/
// Delta/Volume Profile já reais neste sistema; Keltner é redundante com o
// Bollinger Bandwidth (regime-engine.js) + SuperTrend (trailing ATR) já
// existentes; Ichimoku é um sistema completo de 5 linhas + nuvem com
// projeção pra frente/trás — escopo visual grande o suficiente pra merecer
// sua PRÓPRIA rodada de Laboratório, não uma entrega apressada junto desta.
//
// DEFINIÇÃO PESQUISADA, NÃO INVENTADA (CLAUDE.md item 2 — WebSearch antes
// de escrever código, cruzada em CrossTrade, TC2000, TradingView, Mudrex,
// TradingSim, TradeAlgo): fórmula CLÁSSICA (Floor Trader / Standard), a
// mais amplamente usada, pesos iguais de H+L+C:
//
//   PP = (High + Low + Close) / 3
//   R1 = (2 × PP) − Low          S1 = (2 × PP) − High
//   R2 = PP + (High − Low)       S2 = PP − (High − Low)
//   R3 = High + 2 × (PP − Low)   S3 = Low − 2 × (High − PP)
//
// PERÍODO DE REFERÊNCIA: o candle DIÁRIO anterior, fronteira 00:00 UTC —
// a mesma fronteira que o candle diário da própria Binance Futures usa
// (pesquisa real confirma este é o padrão declarado em plataformas cripto,
// distinto do rollover de NY usado em forex). Este motor NÃO decide qual
// candle é "o de ontem": recebe candles diários já resolvidos e usa
// SEMPRE o ÚLTIMO do array — quem chama (engine-bridge.ts) é responsável
// por excluir o dia ainda em formação, mesmo contrato que todo outro
// motor desta pasta (zero heurística de "está fechado?" aqui dentro).
//
// ZERO SEGUNDA MATEMÁTICA: nenhuma outra parte deste repositório calcula
// Pivot Points — auditoria (`grep -ri "pivot point"`) não achou nenhuma
// ocorrência antes deste motor.

export const metadata = {
    engine: 'pivot-points-engine',
    description: 'Pivot Points clássicos (Floor Trader) — PP/R1-R3/S1-S3 a partir do candle diário anterior fechado, fórmula padrão pesquisada.',
    concepts: ['Pivot Point clássico: PP=(H+L+C)/3', 'R1/R2/R3, S1/S2/S3 (fórmula Floor Trader)', 'Fronteira diária 00:00 UTC'],
    required_data: ['candle diário ANTERIOR já fechado (high/low/close reais)'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Recebe o candle de referência já resolvido pelo chamador — este motor não decide "qual dia é ontem" nem consulta relógio algum (fail-closed puro: candle ausente/inválido = DADOS_INSUFICIENTES).',
        'Variante CLÁSSICA apenas (pesos iguais H+L+C). Variantes Woodie/Camarilla/Fibonacci Pivots usam fórmulas REAIS diferentes — não são "a mesma conta com nome trocado" — e não estão implementadas aqui.',
        'Pivots diários fixos não se ajustam intra-dia: são um nível ESTÁTICO até o próximo fechamento diário, natureza real do indicador, não uma limitação de implementação.',
    ],
};

function fieldOf(c, short, long) {
    return c[short] ?? c[long];
}

/** Pivot Points clássicos a partir do ÚLTIMO candle do array (o candle
 *  diário de referência, já fechado — responsabilidade do chamador). */
export function computePivotPoints(dailyCandles) {
    if (!Array.isArray(dailyCandles) || dailyCandles.length === 0) {
        return { status: 'DADOS_INSUFICIENTES', reason: 'sem_candle_diario_real' };
    }
    const ref = dailyCandles[dailyCandles.length - 1];
    const high = fieldOf(ref, 'h', 'high');
    const low = fieldOf(ref, 'l', 'low');
    const close = fieldOf(ref, 'c', 'close');
    if (![high, low, close].every((v) => typeof v === 'number' && Number.isFinite(v))) {
        return { status: 'DADOS_INSUFICIENTES', reason: 'candle_de_referencia_invalido' };
    }
    if (high < low) {
        return { status: 'DADOS_INSUFICIENTES', reason: 'candle_de_referencia_inconsistente' };
    }

    const pp = (high + low + close) / 3;
    const range = high - low;
    const r1 = 2 * pp - low;
    const s1 = 2 * pp - high;
    const r2 = pp + range;
    const s2 = pp - range;
    const r3 = high + 2 * (pp - low);
    const s3 = low - 2 * (high - pp);

    return {
        status: 'OK',
        pp, r1, r2, r3, s1, s2, s3,
        referenceCandle: { high, low, close, time: fieldOf(ref, 't', 'time') ?? null },
    };
}
