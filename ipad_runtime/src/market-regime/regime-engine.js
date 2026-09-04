// regime-engine.js — Market Regime Engine, classificação pura (Fase D /
// V15 Cap. 20 Fase D; Cap. 5 da Parte 2). Função pura sobre a MESMA série
// canônica de candles {t,o,h,l,c,v} que o Market Data Bus distribui — zero
// rede, zero estado, zero relógio: mesmo padrão dos engines graduados de
// src/research/engines/ (ver QUARANTINE.md). O histórico de transições
// (estado) vive em regime-history.js; a matriz de pesos em
// weight-matrix.js.
//
// O QUE ESTE MOTOR É: um rótulo descritivo do estado ATUAL do mercado,
// calculado por matemática clássica e auditável (Wilder ADX/DI 14 +
// largura de banda de Bollinger 20/2 em percentil da própria história
// recente). O QUE ELE NUNCA É: um sinal de entrada, uma probabilidade de
// acerto, ou um gate sobre o LONG/SHORT/WAIT do Core Engine — regime é
// CONTEXTO, mesma regra do Lorentziano e da estrutura HTF (exibido ao
// lado, nunca por cima).
//
// Matemática (toda clássica, nenhuma inventada):
//
//   ADX/DI (Wilder, período 14) — força e direção da tendência:
//     TR_i  = max(h−l, |h−c_prev|, |l−c_prev|)
//     +DM_i = h_i−h_prev  se for > l_prev−l_i e > 0, senão 0
//     −DM_i = l_prev−l_i  se for > h_i−h_prev e > 0, senão 0
//     Suavização de Wilder: S_i = S_{i−1} − S_{i−1}/P + X_i
//     +DI = 100·S(+DM)/S(TR); −DI = 100·S(−DM)/S(TR)
//     DX  = 100·|+DI − −DI| / (+DI + −DI);  ADX = média de Wilder do DX
//
//   Compressão (squeeze) — auto-calibrada, sem limiar absoluto por ativo:
//     largura de banda de Bollinger BW_i = (upper−lower)/SMA20 = 4·σ20/SMA20
//     percentil = fração dos últimos BANDWIDTH_HISTORY valores de BW ≤ BW
//     atual. Compressão = percentil ≤ 0.25 (a banda está no quartil mais
//     estreito da SUA PRÓPRIA história recente — funciona igual para BTC
//     e XRP sem constante mágica por ativo; V15 "Auto Calibração").
//
//   Breakout — DETECÇÃO honesta, nunca previsão: o candle atual FECHOU
//     fora das bandas (acima da superior ou abaixo da inferior) vindo de
//     um candle anterior em compressão (percentil anterior ≤ 0.25). É o
//     momento real de escape de uma compressão, já observado — este motor
//     não promete que o rompimento vai continuar (não há backtest nesta
//     base para sustentar essa afirmação; mesma regra do R:R da Fase 6).
//
// Árvore de decisão (precedência documentada, 1 regime por leitura):
//   1. escape de compressão (acima)                  -> BREAKOUT (ALTA/BAIXA)
//   2. ADX >= 30                                     -> TENDENCIA_FORTE (dir por +DI/−DI)
//   3. compressão atual (percentil <= 0.25)          -> COMPRESSAO
//   4. ADX >= 20                                     -> TENDENCIA_MODERADA (dir)
//   5. resto                                         -> CONSOLIDACAO
//
// Amostra mínima: 60 candles (ADX(14) precisa de 2P+1 = 29; o percentil de
// banda precisa de >= 20 larguras + folga). Abaixo disso o estado honesto é
// DADOS_INSUFICIENTES — nunca um regime calculado sobre amostra rasa. O
// ciclo real (engine-bridge.ts) pede 100 candles ao Bus.

export const ADX_PERIOD = 14;
export const BOLLINGER_PERIOD = 20;
export const BOLLINGER_K = 2;
export const BANDWIDTH_HISTORY = 40;
export const SQUEEZE_PERCENTILE = 0.25;
export const ADX_STRONG = 30;
export const ADX_MODERATE = 20;
export const MIN_CANDLES_FOR_REGIME = 60;

// Vocabulário fechado (padrão CONNECTOR_STATES/QUALITY_CLASSIFICATION).
// Direção (ALTA/BAIXA/null) viaja num campo separado: a matriz de pesos
// não depende do lado da tendência, só do tipo de regime.
export const REGIMES = Object.freeze({
    TENDENCIA_FORTE: 'TENDENCIA_FORTE',
    TENDENCIA_MODERADA: 'TENDENCIA_MODERADA',
    CONSOLIDACAO: 'CONSOLIDACAO',
    COMPRESSAO: 'COMPRESSAO',
    BREAKOUT: 'BREAKOUT',
    DADOS_INSUFICIENTES: 'DADOS_INSUFICIENTES',
});

export const REGIME_DIRECTION = Object.freeze({
    ALTA: 'ALTA',
    BAIXA: 'BAIXA',
});

function toOhlc(row) {
    return {
        h: Number(row.h ?? row.high),
        l: Number(row.l ?? row.low),
        c: Number(row.c ?? row.close),
    };
}

/** ADX/+DI/−DI de Wilder — série completa, retorna os valores do ÚLTIMO
 *  candle. Exportada para teste direto da matemática. */
export function computeAdx(candles, period = ADX_PERIOD) {
    if (!Array.isArray(candles) || candles.length < 2 * period + 1) return null;
    const rows = candles.map(toOhlc);

    const tr = [];
    const plusDm = [];
    const minusDm = [];
    for (let i = 1; i < rows.length; i++) {
        const cur = rows[i];
        const prev = rows[i - 1];
        tr.push(Math.max(cur.h - cur.l, Math.abs(cur.h - prev.c), Math.abs(cur.l - prev.c)));
        const upMove = cur.h - prev.h;
        const downMove = prev.l - cur.l;
        plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    let smoothTr = tr.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothPlus = plusDm.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothMinus = minusDm.slice(0, period).reduce((a, b) => a + b, 0);

    const dxSeries = [];
    let plusDi = 0;
    let minusDi = 0;
    for (let i = period; i <= tr.length; i++) {
        plusDi = smoothTr > 0 ? (100 * smoothPlus) / smoothTr : 0;
        minusDi = smoothTr > 0 ? (100 * smoothMinus) / smoothTr : 0;
        const diSum = plusDi + minusDi;
        dxSeries.push(diSum > 0 ? (100 * Math.abs(plusDi - minusDi)) / diSum : 0);
        if (i === tr.length) break;
        smoothTr = smoothTr - smoothTr / period + tr[i];
        smoothPlus = smoothPlus - smoothPlus / period + plusDm[i];
        smoothMinus = smoothMinus - smoothMinus / period + minusDm[i];
    }

    if (dxSeries.length < period) return null;
    let adx = dxSeries.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dxSeries.length; i++) {
        adx = (adx * (period - 1) + dxSeries[i]) / period;
    }
    return { adx, plusDi, minusDi };
}

/** Série de larguras de banda de Bollinger (uma por candle a partir do
 *  índice period−1). Largura = 4σ/SMA — adimensional, comparável só com a
 *  própria história. */
export function computeBandwidthSeries(candles, period = BOLLINGER_PERIOD, k = BOLLINGER_K) {
    if (!Array.isArray(candles) || candles.length < period) return [];
    const closes = candles.map((row) => Number(row.c ?? row.close));
    const out = [];
    for (let i = period - 1; i < closes.length; i++) {
        const window = closes.slice(i - period + 1, i + 1);
        const mean = window.reduce((a, b) => a + b, 0) / period;
        const variance = window.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
        const sd = Math.sqrt(variance);
        out.push({
            index: i,
            sma: mean,
            upper: mean + k * sd,
            lower: mean - k * sd,
            bandwidth: mean !== 0 ? (2 * k * sd) / Math.abs(mean) : 0,
        });
    }
    return out;
}

/** Percentil (fração de valores <= atual) do último valor dentro da sua
 *  própria história recente — auto-calibração real, sem limiar absoluto. */
export function percentileRank(values, current) {
    if (!Array.isArray(values) || values.length === 0 || !Number.isFinite(current)) return null;
    const below = values.filter((v) => v <= current).length;
    return below / values.length;
}

/**
 * Média SIMPLES dos últimos `period` True Ranges, normalizada pelo ÚLTIMO
 * close, em %. Devolve um ESCALAR.
 *
 * NÃO CONFUNDIR com `computeAtrPercent` de research/engines/
 * lorentzian-classifier.js, apesar de os dois serem chamados "ATR%" por aí:
 *
 *   este aqui  → média simples (SMA) dos TR · escalar · normaliza pelo
 *                último close
 *   o outro    → suavização recursiva de Wilder (RMA) · SÉRIE completa ·
 *                normaliza cada ponto pelo próprio close
 *
 * Para os mesmos candles eles dão NÚMEROS DIFERENTES, e isso é esperado —
 * são duas definições legítimas de ATR, não uma duplicação a consolidar.
 * A auditoria de duplicação chegou a marcá-los como "mesma matemática em
 * dois lugares"; a leitura linha a linha desmentiu.
 *
 * Unificar exigiria uma iniciativa isolada, NUNCA um swap de uma linha: o
 * `atr_percent` que sai daqui alimenta o dimensionamento de posição
 * (risk-engine.js) e o ETA (eta-engine.ts). Trocar a fórmula mudaria os
 * dois, e isso precisa de comparação antes/depois própria.
 */
function meanTrueRangePercent(candles, period = ADX_PERIOD) {
    if (candles.length < period + 1) return null;
    const rows = candles.map(toOhlc);
    const tr = [];
    for (let i = rows.length - period; i < rows.length; i++) {
        tr.push(Math.max(rows[i].h - rows[i].l, Math.abs(rows[i].h - rows[i - 1].c), Math.abs(rows[i].l - rows[i - 1].c)));
    }
    const lastClose = rows[rows.length - 1].c;
    if (!Number.isFinite(lastClose) || lastClose === 0) return null;
    return (tr.reduce((a, b) => a + b, 0) / period / lastClose) * 100;
}

function insufficient(reason) {
    return Object.freeze({
        status: 'DADOS_INSUFICIENTES',
        status_reason: reason,
        regime: REGIMES.DADOS_INSUFICIENTES,
        direction: null,
        evidence: null,
        read_only: true,
    });
}

/** @param {{ohlcv_series: Array, timeframe?: string}} input */
export function classifyMarketRegime({ ohlcv_series, timeframe } = {}) {
    if (!Array.isArray(ohlcv_series) || ohlcv_series.length < MIN_CANDLES_FOR_REGIME) {
        const got = Array.isArray(ohlcv_series) ? ohlcv_series.length : 0;
        return insufficient(`apenas_${got}_candles_minimo_${MIN_CANDLES_FOR_REGIME}`);
    }

    const adxResult = computeAdx(ohlcv_series);
    const bands = computeBandwidthSeries(ohlcv_series);
    if (!adxResult || bands.length < 2) {
        return insufficient('serie_insuficiente_para_adx_ou_bollinger');
    }

    const current = bands[bands.length - 1];
    const previous = bands[bands.length - 2];
    const history = bands.slice(-BANDWIDTH_HISTORY).map((b) => b.bandwidth);
    const historyPrev = bands.slice(0, -1).slice(-BANDWIDTH_HISTORY).map((b) => b.bandwidth);
    const bandwidthPercentile = percentileRank(history, current.bandwidth);
    const prevBandwidthPercentile = percentileRank(historyPrev, previous.bandwidth);

    const lastClose = Number(ohlcv_series[ohlcv_series.length - 1].c ?? ohlcv_series[ohlcv_series.length - 1].close);
    const closePosition = lastClose > current.upper
        ? 'ACIMA_BANDA_SUPERIOR'
        : lastClose < current.lower
            ? 'ABAIXO_BANDA_INFERIOR'
            : 'DENTRO_DAS_BANDAS';

    const trendDirection = adxResult.plusDi >= adxResult.minusDi ? REGIME_DIRECTION.ALTA : REGIME_DIRECTION.BAIXA;
    const squeezedNow = bandwidthPercentile !== null && bandwidthPercentile <= SQUEEZE_PERCENTILE;
    const squeezedBefore = prevBandwidthPercentile !== null && prevBandwidthPercentile <= SQUEEZE_PERCENTILE;

    let regime;
    let direction = null;
    if (squeezedBefore && closePosition !== 'DENTRO_DAS_BANDAS') {
        regime = REGIMES.BREAKOUT;
        direction = closePosition === 'ACIMA_BANDA_SUPERIOR' ? REGIME_DIRECTION.ALTA : REGIME_DIRECTION.BAIXA;
    } else if (adxResult.adx >= ADX_STRONG) {
        regime = REGIMES.TENDENCIA_FORTE;
        direction = trendDirection;
    } else if (squeezedNow) {
        regime = REGIMES.COMPRESSAO;
    } else if (adxResult.adx >= ADX_MODERATE) {
        regime = REGIMES.TENDENCIA_MODERADA;
        direction = trendDirection;
    } else {
        regime = REGIMES.CONSOLIDACAO;
    }

    return Object.freeze({
        status: 'OK',
        status_reason: 'regime_classificado_sobre_candles_reais_do_bus',
        regime,
        direction,
        evidence: Object.freeze({
            adx: adxResult.adx,
            plus_di: adxResult.plusDi,
            minus_di: adxResult.minusDi,
            bandwidth: current.bandwidth,
            bandwidth_percentile: bandwidthPercentile,
            prev_bandwidth_percentile: prevBandwidthPercentile,
            close_position: closePosition,
            atr_percent: meanTrueRangePercent(ohlcv_series),
        }),
        candles_used: ohlcv_series.length,
        timeframe: timeframe ?? null,
        read_only: true,
    });
}
