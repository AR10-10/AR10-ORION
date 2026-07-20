// structural-backtest.js — Fase 1 da iniciativa "histórico real + backtest
// honesto" (a única evolução nomeada como mais importante na conclusão da
// Diretriz de Evolução de Produto, autorizada pelo Operador).
//
// O QUE ISTO É: um medidor de DESFECHOS ESTRUTURAIS em walk-forward sobre
// uma série de candles — reusa o Motor de Replay REAL (src/replay/, o Bus
// de verdade com fonte plugada) e os motores graduados REAIS candle-only
// (market-structure-engine + support-resistance-engine, via fractal-swings
// compartilhado). Zero matemática de mercado nova: a "regra estrutural"
// abaixo é uma REGRA DE MEDIÇÃO do laboratório (qual cenário contar e
// como resolver), nunca um novo indicador.
//
// O QUE ISTO NUNCA É (LEI 24, inegociável): um segundo emissor de decisão.
// Este módulo vive no laboratório (research/backtest/), roda OFFLINE sobre
// séries fornecidas, e NENHUM módulo de produção importa daqui (travado
// por teste de fronteira, mesmo padrão do replay). Ele não opina sobre o
// mercado de agora — ele CONTA o que os níveis estruturais reais teriam
// feito numa amostra histórica.
//
// HONESTIDADE (Regra de Ouro 2, o motivo desta fase existir): o resultado
// é CONTAGEM de eventos da amostra (alvos tocados, stops tocados, não
// resolvidos) — aritmética verificável, com aviso gravado no próprio
// contrato. NUNCA probabilidade futura, NUNCA "desempenho do sistema
// completo ao vivo": o pipeline vivo inclui Conselho/fluxo/L2 que não
// existem numa série de candles — este backtest mede o SUBCONJUNTO
// estrutural candle-only, e diz isso em campo próprio.
//
// REGRA DE MEDIÇÃO (documentada, determinística, espelhada LONG/SHORT):
//   Abertura (por frame do walk-forward, janela real do replay):
//     ESTRUTURA_ALTA  + S/R OK + (support_1 < close < resistance_1)
//       => trial LONG  { entry: close, stop: support_1, target: resistance_1 }
//     ESTRUTURA_BAIXA + S/R OK + (support_1 < close < resistance_1)
//       => trial SHORT { entry: close, stop: resistance_1, target: support_1 }
//     ESTRUTURA_LATERAL ou qualquer DADOS_INSUFICIENTES => nada (fail-closed).
//     No máximo UM trial aberto por direção — barras adjacentes repetem o
//     mesmo cenário estrutural; contá-lo N vezes inflaria a amostra com
//     eventos correlacionados (regra de deduplicação, não de mercado).
//   Resolução (candle a candle, só com candles POSTERIORES à decisão):
//     LONG:  low <= stop e high >= target no MESMO candle => AMBOS => conta
//            STOP (conservador — sem dado intrabar, o empate nunca vira
//            acerto); low <= stop => STOP; high >= target => TARGET.
//     SHORT: espelhado exato (high >= stop / low <= target).
//     Sem toque dentro de horizonBars => NAO_RESOLVIDO (nunca acerto).
//
// PARÂMETROS DECLARADOS (mesma natureza do RSI 70/30 e do piso R:R 1:2 —
// convenções documentadas e ajustáveis, nunca medições):
//   windowSize  default do replay (120) — janela de análise por frame.
//   horizonBars default 48 — em 15m, ~12h para o cenário se resolver.
import { createReplaySession, REPLAY_DEFAULT_WINDOW } from '../../replay/replay-engine.js';
import { analyze as analyzeStructure } from '../engines/market-structure-engine.js';
import { analyze as analyzeSupportResistance } from '../engines/support-resistance-engine.js';

export const BACKTEST_DEFAULT_HORIZON_BARS = 48;

export const BACKTEST_AVISO =
    'CONTAGEM HISTORICA DA AMOSTRA — subconjunto estrutural candle-only; ' +
    'NUNCA probabilidade futura, NUNCA o desempenho do sistema completo ao vivo';

function resolveTrialWithCandle(trial, candle) {
    const long = trial.direction === 'LONG';
    const stopTouched = long ? candle.l <= trial.stop : candle.h >= trial.stop;
    const targetTouched = long ? candle.h >= trial.target : candle.l <= trial.target;
    if (stopTouched && targetTouched) return 'AMBOS_STOP_CONSERVADOR';
    if (stopTouched) return 'STOP';
    if (targetTouched) return 'TARGET';
    return null;
}

function emptyBucket() {
    return { trials: 0, targetHits: 0, stopHits: 0, bothTouchedCountedAsStop: 0, unresolved: 0 };
}

function accumulate(bucket, outcome) {
    bucket.trials += 1;
    if (outcome === 'TARGET') bucket.targetHits += 1;
    else if (outcome === 'STOP') bucket.stopHits += 1;
    else if (outcome === 'AMBOS_STOP_CONSERVADOR') { bucket.stopHits += 1; bucket.bothTouchedCountedAsStop += 1; }
    else bucket.unresolved += 1;
}

/**
 * Walk-forward estrutural completo sobre uma série real de candles
 * (schema canônico do Bus: {t,o,h,l,c,v}, t em segundos).
 * @param {{ candles: Array, symbol?: string, timeframe?: string,
 *   windowSize?: number, horizonBars?: number, maxSteps?: number }} opts
 * @returns {Promise<object>} contrato congelado com trials + agregados +
 *   aviso de honestidade; DADOS_INSUFICIENTES quando a série não sustenta
 *   nem um frame de análise (nunca um resultado fabricado).
 */
export async function runStructuralBacktest({
    candles,
    symbol = 'BACKTEST-SERIES',
    timeframe = '15m',
    windowSize = REPLAY_DEFAULT_WINDOW,
    horizonBars = BACKTEST_DEFAULT_HORIZON_BARS,
    maxSteps = Infinity,
} = {}) {
    if (!Array.isArray(candles) || candles.length === 0 || windowSize >= candles.length) {
        return Object.freeze({
            status: 'DADOS_INSUFICIENTES',
            reason: 'serie_menor_ou_igual_a_janela_de_analise',
            aviso: BACKTEST_AVISO,
            read_only: true,
        });
    }
    if (!Number.isFinite(horizonBars) || horizonBars < 1) {
        return Object.freeze({
            status: 'DADOS_INSUFICIENTES',
            reason: 'horizonte_invalido',
            aviso: BACKTEST_AVISO,
            read_only: true,
        });
    }

    const session = createReplaySession({ candles, symbol, timeframe, windowSize });
    const openByDirection = { LONG: null, SHORT: null };
    const trials = [];
    let frames = 0;

    const closeTrial = (trial, outcome, barsToResolve) => {
        trial.outcome = outcome;
        trial.barsToResolve = outcome === 'NAO_RESOLVIDO' ? null : barsToResolve;
        trials.push(Object.freeze(trial));
        openByDirection[trial.direction] = null;
    };

    while (!session.done && frames < maxSteps) {
        const frame = await session.step();
        if (!frame) break;
        frames += 1;

        // 1. O candle recém-revelado desta janela (série 0-based) resolve
        //    trials abertos em frames ANTERIORES — nunca o próprio frame da
        //    decisão (zero-lookahead por construção do replay).
        const newCandleIdx = frame.index - 1;
        const newCandle = candles[newCandleIdx];
        for (const dir of ['LONG', 'SHORT']) {
            const trial = openByDirection[dir];
            if (!trial || newCandleIdx < trial.decisionIndex) continue;
            const bars = newCandleIdx - trial.decisionIndex + 1;
            const outcome = resolveTrialWithCandle(trial, newCandle);
            if (outcome) closeTrial(trial, outcome, bars);
            else if (bars >= trial.horizonBars) closeTrial(trial, 'NAO_RESOLVIDO', null);
        }

        // 2. Motores graduados REAIS sobre a MESMA janela real do frame.
        const window = frame.snapshot.candles;
        const structure = analyzeStructure({ ohlcv_series: window, timeframe });
        const sr = analyzeSupportResistance({ ohlcv_series: window, timeframe });
        if (structure.status !== 'OK' || sr.status !== 'OK') continue; // fail-closed
        const close = frame.close;
        const support = sr.support_1;
        const resistance = sr.resistance_1;
        const geometryValid =
            Number.isFinite(close) && Number.isFinite(support) && Number.isFinite(resistance) &&
            support < close && close < resistance;
        if (!geometryValid) continue;

        // 3. Regra de medição estrutural (espelhada) + dedup de 1 aberto/direção.
        let direction = null;
        if (structure.structure_label === 'ESTRUTURA_ALTA') direction = 'LONG';
        else if (structure.structure_label === 'ESTRUTURA_BAIXA') direction = 'SHORT';
        if (!direction || openByDirection[direction]) continue;

        const long = direction === 'LONG';
        const stop = long ? support : resistance;
        const target = long ? resistance : support;
        const risk = Math.abs(close - stop);
        openByDirection[direction] = {
            decisionIndex: frame.index, // primeiro candle de desfecho = candles[frame.index]
            t: frame.t,
            direction,
            entry: close,
            stop,
            target,
            riskReward: risk > 0 ? Math.abs(target - close) / risk : null,
            horizonBars,
            outcome: null,
            barsToResolve: null,
        };
    }

    // Fim da série: abertos sem desfecho viram NAO_RESOLVIDO (nunca acerto).
    for (const dir of ['LONG', 'SHORT']) {
        const trial = openByDirection[dir];
        if (trial) closeTrial(trial, 'NAO_RESOLVIDO', null);
    }
    trials.sort((a, b) => a.decisionIndex - b.decisionIndex);

    const total = emptyBucket();
    const porDirecao = { LONG: emptyBucket(), SHORT: emptyBucket() };
    for (const trial of trials) {
        accumulate(total, trial.outcome);
        accumulate(porDirecao[trial.direction], trial.outcome);
    }
    const resolved = total.targetHits + total.stopHits;

    return Object.freeze({
        status: 'OK',
        provenance: Object.freeze({
            symbol,
            timeframe,
            candles: candles.length,
            windowSize,
            horizonBars,
            frames,
        }),
        trials: Object.freeze(trials),
        aggregate: Object.freeze({
            samples: total.trials,
            targetHits: total.targetHits,
            stopHits: total.stopHits,
            bothTouchedCountedAsStop: total.bothTouchedCountedAsStop,
            unresolved: total.unresolved,
            resolved,
            // Fração REAL da amostra resolvida que tocou o alvo primeiro —
            // aritmética sobre eventos contados, com o aviso ao lado; null
            // honesto sem amostra resolvida (nunca 0 fabricado).
            taxaAlvoAmostra: resolved > 0 ? total.targetHits / resolved : null,
            porDirecao: Object.freeze({
                LONG: Object.freeze(porDirecao.LONG),
                SHORT: Object.freeze(porDirecao.SHORT),
            }),
        }),
        aviso: BACKTEST_AVISO,
        read_only: true,
    });
}
