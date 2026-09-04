// liquidity-void-engine.js — Liquidity Voids (Smart Money Concepts) sobre
// candles reais. Pura funcao de calculo: zero fetch, zero rede, zero
// estado global, mesmo padrao de fvg-order-block-engine.js/
// support-resistance-engine.js nesta mesma pasta.
//
// AUDITORIA ANTES DE CONSTRUIR (CLAUDE.md, Disciplina de trabalho item 1):
// zero engine existente detecta isto. fvg-order-block-engine.js detecta
// Fair Value Gaps (imbalance de 3 candles) — um conceito relacionado mas
// DIFERENTE em escala: pesquisa real (WebSearch) confirma que um
// Liquidity Void e' um deslocamento MAIOR, de VARIOS candles, com
// participacao de volume anormalmente baixa para o alcance percorrido —
// muitas vezes CONTEM varios FVGs dentro dele, mas e' a propria zona
// contigua, nao um novo FVG (fontes: fxopen.com/blog/fair-value-gaps-vs-
// liquidity-voids-in-trading, writofinance.com/ict-liquidity-void-smc).
//
// PESQUISA REAL DO CALCULO (CLAUDE.md item 2): implementacoes reais de
// mercado (TradingView, ex.: "Liquidity Void Zone Detector") usam uma
// Volume Efficiency Ratio = (volume/avgVolume) / (range/ATR) — um candle
// "fino" (void) e' aquele que percorreu MUITO alcance (range/ATR alto)
// com POUCO volume relativo (volume/avgVolume baixo), isto e', eficiencia
// baixa. Reaproveitada aqui exatamente essa formula real, nunca uma
// variante inventada.
//
// ZERO SEGUNDA MATEMATICA: ATR de Wilder ja existe, exportado e testado,
// em lorentzian-classifier.js (computeAtrPercent) — reusado aqui tal
// qual, nunca uma segunda curva de volatilidade.
import { computeAtrPercent } from './lorentzian-classifier.js';

export const metadata = {
    engine: 'liquidity-void-engine',
    description: 'Liquidity Voids (Smart Money Concepts) — deslocamento real de multiplos candles com participacao de volume anormalmente baixa para o alcance percorrido, via Volume Efficiency Ratio sobre candles reais.',
    concepts: ['Liquidity Void (displacement multi-candle)', 'Volume Efficiency Ratio = (volume/avgVolume) / (range/ATR)', 'ATR de Wilder (computeAtrPercent, lorentzian-classifier.js)'],
    required_data: ['ohlcv_series com volume real por candle'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Volume Efficiency Ratio usa um limiar declarado (0.5) e um piso de deslocamento (range >= 1x ATR) — convencoes documentadas, nao uma formula "oficial" unica da literatura SMC/ICT (mesmo espirito das outras convencoes ja declaradas neste repositorio, ex. EQUAL_TOLERANCE_PCT).',
        'Sem volume real por candle na janela avaliada, nenhum candle qualifica (fail-closed) — o motor nunca aproxima volume a partir de outro dado.',
        'Exige aquecimento real do ATR de Wilder (ATR_PERIOD candles) antes do primeiro candle avaliavel.',
    ],
};

const ATR_PERIOD = 14; // mesmo period do ATR de Wilder — reusado tambem como janela de volume medio, evita uma 2a janela arbitraria.
const MIN_CANDLES = ATR_PERIOD + 5; // aquecimento do ATR + folga real minima pra avaliar candles e conseguir agrupar >=2 consecutivos.
const VOID_EFFICIENCY_THRESHOLD = 0.5; // convencao declarada: candle "fino" quando o volume-por-alcance fica <= metade do esperado.
const VOID_MIN_DISPLACEMENT_RATIO = 1; // alcance do candle precisa ser >= 1x ATR — so desloc reais contam, nunca um candle mediano de baixo volume.
const VOID_MIN_RUN_LENGTH = 2; // 1 candle fino isolado nao forma zona real — pesquisa real: void e' um deslocamento de VARIOS candles.

function fieldOf(c, short, long) {
    return c[short] ?? c[long];
}

/** Media real de volume na janela [i-period, i-1] — nunca inclui o
 *  proprio candle i (evitaria o candle influenciar sua propria base de
 *  comparacao). null (fail-closed) se qualquer candle da janela nao tiver
 *  volume real finito. */
function rollingAvgVolume(candles, i, period) {
    if (i < period) return null;
    let sum = 0;
    for (let j = i - period; j < i; j++) {
        const v = fieldOf(candles[j], 'v', 'volume');
        if (!Number.isFinite(v)) return null;
        sum += v;
    }
    return sum / period;
}

/** Marca candles individuais como candidatos a "void" real: deslocamento
 *  >= 1x ATR (nao e' um candle mediano) E Volume Efficiency Ratio real
 *  <= limiar declarado (participacao anormalmente baixa para o alcance). */
function findVoidCandidateFlags(candles, atrPct) {
    const flags = new Array(candles.length).fill(false);
    for (let i = ATR_PERIOD; i < candles.length; i++) {
        const atr = atrPct[i];
        if (!Number.isFinite(atr) || atr <= 0) continue;
        const close = fieldOf(candles[i], 'c', 'close');
        const high = fieldOf(candles[i], 'h', 'high');
        const low = fieldOf(candles[i], 'l', 'low');
        const volume = fieldOf(candles[i], 'v', 'volume');
        if (![close, high, low, volume].every(Number.isFinite) || close === 0) continue;
        const rangePct = ((high - low) / close) * 100;
        if (rangePct < atr * VOID_MIN_DISPLACEMENT_RATIO) continue;
        const avgVol = rollingAvgVolume(candles, i, ATR_PERIOD);
        if (!Number.isFinite(avgVol) || avgVol <= 0) continue;
        const efficiency = (volume / avgVol) / (rangePct / atr);
        if (efficiency <= VOID_EFFICIENCY_THRESHOLD) flags[i] = true;
    }
    return flags;
}

/** Constroi a zona real de um run [startIdx, endIdx] de candles
 *  consecutivos flagados: envelope real de high/low, direcao pelo
 *  deslocamento liquido do run (close final vs open inicial — mesmo
 *  espirito de Order Block: deslocamento real, nao so' 1 candle verde).
 *  `mitigated` = true se algum candle POSTERIOR real ja' voltou a tocar
 *  dentro da zona (mesma definicao/mesmo padrao de varredura que FVG/OB
 *  ja usam). */
function buildZone(candles, startIdx, endIdx) {
    let top = -Infinity;
    let bottom = Infinity;
    for (let i = startIdx; i <= endIdx; i++) {
        const h = fieldOf(candles[i], 'h', 'high');
        const l = fieldOf(candles[i], 'l', 'low');
        if (h > top) top = h;
        if (l < bottom) bottom = l;
    }
    const openStart = fieldOf(candles[startIdx], 'o', 'open');
    const closeEnd = fieldOf(candles[endIdx], 'c', 'close');
    const type = closeEnd >= openStart ? 'BULLISH' : 'BEARISH';

    let mitigated = false;
    for (let j = endIdx + 1; j < candles.length; j++) {
        const hi = fieldOf(candles[j], 'h', 'high');
        const lo = fieldOf(candles[j], 'l', 'low');
        if (Number.isFinite(lo) && Number.isFinite(hi) && lo <= top && hi >= bottom) {
            mitigated = true;
            break;
        }
    }
    return { type, index: startIdx, top, bottom, candleCount: endIdx - startIdx + 1, mitigated };
}

/** Agrupa candidatos CONSECUTIVOS (index contiguo) em zonas reais — runs
 *  com menos de VOID_MIN_RUN_LENGTH candles sao descartados (1 candle
 *  fino isolado nao e' um deslocamento real, so' ruido). */
function clusterConsecutiveRuns(candles, flags) {
    const zones = [];
    let runStart = -1;
    for (let i = 0; i <= flags.length; i++) {
        const isFlagged = i < flags.length && flags[i];
        if (isFlagged && runStart === -1) {
            runStart = i;
        } else if (!isFlagged && runStart !== -1) {
            const runEnd = i - 1;
            if (runEnd - runStart + 1 >= VOID_MIN_RUN_LENGTH) {
                zones.push(buildZone(candles, runStart, runEnd));
            }
            runStart = -1;
        }
    }
    return zones;
}

/**
 * @param {{ ohlcv_series: Array<{t?:number,o?:number,h?:number,l?:number,c?:number,v?:number,open?:number,high?:number,low?:number,close?:number,volume?:number}> }} input
 * @returns {object} status 'OK' com zonas reais (mais recentes primeiro), ou 'DADOS_INSUFICIENTES'.
 */
export function analyze(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    if (candles.length < MIN_CANDLES) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: `apenas_${candles.length}_candles_abaixo_do_minimo_${MIN_CANDLES}` };
    }

    const atrPct = computeAtrPercent(candles, ATR_PERIOD);
    const flags = findVoidCandidateFlags(candles, atrPct);
    const liquidityVoids = clusterConsecutiveRuns(candles, flags).reverse(); // mais recentes primeiro, mesma convencao de findFairValueGaps.

    return {
        status: 'OK',
        engine: metadata.engine,
        liquidity_voids: liquidityVoids,
        unmitigated_void_count: liquidityVoids.filter((v) => !v.mitigated).length,
    };
}
