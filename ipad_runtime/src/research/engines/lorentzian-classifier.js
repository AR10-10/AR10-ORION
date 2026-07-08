// lorentzian-classifier.js — k-Nearest-Neighbors classifier using
// Lorentzian distance instead of Euclidean, over real technical features
// derived from real candles (RSI/ROC/ATR%, computed on a Fourier-smoothed
// close series). Same style/contract as the other engines in this
// directory: a pure function, zero fetch, zero state, DADOS_INSUFICIENTES
// instead of a fabricated classification when the sample is too small.
//
// This is NOT a trained neural network and does not need one: unlike
// ONNX (which requires pre-trained weights this project doesn't have),
// a k-NN classifier builds its "model" at call time, directly from the
// same real candle window already being fetched — every neighbor it
// votes with is a real historical bar and a real subsequent price move,
// never a fabricated label.
//
// Lorentzian distance: d(a,b) = sum_i log(1 + |a_i - b_i|). Same general
// approach as the widely-documented "Machine Learning: Lorentzian
// Classification" technique (public, MIT-licensed methodology) — using
// log-distance instead of squared Euclidean compresses the effect of
// large regime-shift outliers on the distance metric, so a single volatile
// bar doesn't dominate which historical neighbors get selected.
//
// Honesty constraints specific to this engine: with only ~100 real
// candles available in this app (one REST probe's worth), the usable
// labeled training set after warmup/horizon trimming is small (typically
// 60-80 points.) That is a real, disclosed limitation — reported in
// `sample_size` — not a hidden one. This engine deliberately does NOT gate
// or override the real WASM engine's own LONG/SHORT/WAIT signal
// (engine-bridge.ts's runRealAnalysisCycle); it is exposed as an
// independent, separately-labeled confluence signal.

export const metadata = {
    engine: 'lorentzian-classifier',
    description: 'Classificador k-NN com distância Lorentziana sobre features reais (RSI/ROC/ATR%) extraídas de candles reais, com suavização de Fourier (passa-baixa) no preço de fechamento.',
    concepts: ['Lorentzian distance k-NN', 'Fourier low-pass smoothing', 'RSI', 'Rate of Change', 'ATR normalizado'],
    required_data: ['ohlcv_series'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'k-NN construído em tempo real sobre a janela de candles disponível nesta sessão (tipicamente ~100) — não é um modelo pré-treinado, e o conjunto de treino rotulado utilizável é pequeno (~60-80 pontos após warmup/horizonte). sample_size sempre reportado, nunca escondido.',
        'É um sinal de confluência independente — não substitui nem sobrepõe o sinal LONG/SHORT/WAIT da heurística de tendência real (engine-bridge.ts) — esse sinal vem de SMA/EMA em JS puro, não do WASM (Auditoria Mestra 360°, secao 3).',
        'Sem candles suficientes para o warmup dos indicadores + horizonte de rótulo + k vizinhos, cai em DADOS_INSUFICIENTES.',
    ],
};

// ─────────────────────────────────────────────────────────────────────────
// Fourier (DFT) low-pass smoothing — naive O(n^2), fine for n~100.
// ─────────────────────────────────────────────────────────────────────────

/** Discrete Fourier Transform. Retorna { re[], im[] }, ambos length N. */
export function dft(signal) {
    const N = signal.length;
    const re = new Array(N).fill(0);
    const im = new Array(N).fill(0);
    for (let k = 0; k < N; k++) {
        let sumRe = 0;
        let sumIm = 0;
        for (let n = 0; n < N; n++) {
            const theta = (2 * Math.PI * k * n) / N;
            sumRe += signal[n] * Math.cos(theta);
            sumIm -= signal[n] * Math.sin(theta);
        }
        re[k] = sumRe;
        im[k] = sumIm;
    }
    return { re, im };
}

/** Inverse Discrete Fourier Transform a partir de { re[], im[] } -> sinal real. */
export function idft(re, im) {
    const N = re.length;
    const out = new Array(N).fill(0);
    for (let n = 0; n < N; n++) {
        let sum = 0;
        for (let k = 0; k < N; k++) {
            const theta = (2 * Math.PI * k * n) / N;
            sum += re[k] * Math.cos(theta) - im[k] * Math.sin(theta);
        }
        out[n] = sum / N;
    }
    return out;
}

/** Filtro passa-baixa real: mantém as `keepComponents` frequências mais
 *  baixas (e seu espelho conjugado, para o sinal reconstruído continuar
 *  real) e zera o resto, depois reconstrói via IDFT. keepComponents=N
 *  equivale a nenhum filtro (round-trip exato, usado no self-test).
 *  Filtragem via DFT trata a janela como periodica — se o inicio e o fim
 *  da janela nao "encaixam" (descontinuidade), o Gibbs phenomenon distorce
 *  mais forte perto das bordas do que no meio. Por isso esta funcao NUNCA
 *  e' chamada com a serie inteira (ver smoothCausal abaixo): a borda mais
 *  distorcida ficaria exatamente no candle mais recente, o unico que
 *  realmente importa para uma classificacao ao vivo. */
export function fourierLowPassSmooth(signal, keepComponents) {
    const N = signal.length;
    const { re, im } = dft(signal);
    const keep = Math.max(1, Math.min(keepComponents, Math.ceil(N / 2)));
    const reFiltered = new Array(N).fill(0);
    const imFiltered = new Array(N).fill(0);
    for (let k = 0; k < N; k++) {
        const mirrored = N - k;
        if (k < keep || mirrored < keep) {
            reFiltered[k] = re[k];
            imFiltered[k] = im[k];
        }
    }
    return idft(reFiltered, imFiltered);
}

/** Suavizacao CAUSAL: para cada indice i >= window-1, aplica
 *  fourierLowPassSmooth numa janela retrocedente de `window` amostras
 *  terminando em i, e usa so' o ULTIMO valor suavizado dessa janela como
 *  smoothed[i]. Isso garante que TODO ponto (historico ou atual) e'
 *  tratado exatamente da mesma forma — como o ultimo ponto da sua propria
 *  janela — em vez de um unico DFT acausal sobre a serie inteira, onde os
 *  pontos centrais tem contexto dos dois lados mas a borda (o candle atual)
 *  fica sistematicamente mais distorcida. Mais caro (uma DFT por indice em
 *  vez de uma so'), mas trivial para as janelas pequenas usadas aqui
 *  (dezenas de candles). Os primeiros `window-1` indices ficam NaN — sem
 *  janela completa ainda, nunca um valor inventado. */
export function smoothCausal(signal, window, keepComponents) {
    const out = new Array(signal.length).fill(NaN);
    for (let i = window - 1; i < signal.length; i++) {
        const slice = signal.slice(i - window + 1, i + 1);
        const smoothedSlice = fourierLowPassSmooth(slice, keepComponents);
        out[i] = smoothedSlice[smoothedSlice.length - 1];
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Features reais (RSI/ROC/ATR%) — indicadores tecnicos padrao, formulas
// conhecidas, sobre dados reais.
// ─────────────────────────────────────────────────────────────────────────

/** RSI de Wilder. Retorna array length = closes.length, com NaN nos
 *  primeiros `period` indices (sem historico suficiente ainda). */
export function computeRSI(closes, period = 14) {
    const out = new Array(closes.length).fill(NaN);
    if (closes.length <= period) return out;
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period; i++) {
        const delta = closes[i] - closes[i - 1];
        gainSum += Math.max(delta, 0);
        lossSum += Math.max(-delta, 0);
    }
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;
    out[period] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = period + 1; i < closes.length; i++) {
        const delta = closes[i] - closes[i - 1];
        const gain = Math.max(delta, 0);
        const loss = Math.max(-delta, 0);
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        out[i] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
}

/** Rate of Change percentual. NaN nos primeiros `period` indices. */
export function computeROC(closes, period = 9) {
    const out = new Array(closes.length).fill(NaN);
    for (let i = period; i < closes.length; i++) {
        const base = closes[i - period];
        if (base !== 0) out[i] = ((closes[i] - base) / base) * 100;
    }
    return out;
}

/** ATR de Wilder, normalizado como % do close (comparavel entre regimes
 *  de preco diferentes). Usa high/low/close BRUTOS (nao suavizados) — ATR
 *  mede volatilidade real, suavizar a serie removeria o proprio sinal que
 *  ele existe para medir. NaN nos primeiros `period` indices. */
export function computeAtrPercent(candles, period = 14) {
    const out = new Array(candles.length).fill(NaN);
    if (candles.length <= period) return out;
    const tr = new Array(candles.length).fill(0);
    for (let i = 1; i < candles.length; i++) {
        const c = candles[i];
        const prevClose = candles[i - 1].c ?? candles[i - 1].close;
        const high = c.h ?? c.high;
        const low = c.l ?? c.low;
        tr[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    }
    let atr = 0;
    for (let i = 1; i <= period; i++) atr += tr[i];
    atr /= period;
    const close0 = candles[period].c ?? candles[period].close;
    out[period] = close0 !== 0 ? (atr / close0) * 100 : NaN;
    for (let i = period + 1; i < candles.length; i++) {
        atr = (atr * (period - 1) + tr[i]) / period;
        const close = candles[i].c ?? candles[i].close;
        out[i] = close !== 0 ? (atr / close) * 100 : NaN;
    }
    return out;
}

/** Distância Lorentziana: sum_i log(1 + |a_i - b_i|). */
export function lorentzianDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.log(1 + Math.abs(a[i] - b[i]));
    return sum;
}

const RSI_PERIOD = 14;
const ROC_PERIOD = 9;
const ATR_PERIOD = 14;
const SMOOTH_WINDOW = 32;
const FOURIER_KEEP_COMPONENTS = 6;
const DEFAULT_LABEL_HORIZON = 4;
const DEFAULT_K = 8;

/**
 * @param {{ ohlcv_series: Array<{t?:number,o?:number,h?:number,l?:number,c?:number,open?:number,high?:number,low?:number,close?:number}>, k?: number, horizon?: number }} input
 *   `horizon` (velas à frente usadas no rótulo do treino) permite previsão
 *   multi-horizonte real: o MESMO pipeline, re-rotulado para 4/8/16 velas —
 *   não é extrapolação, é k-NN re-treinado por horizonte. Horizontes maiores
 *   consomem mais candles do fim da série (menos amostra), e isso aparece
 *   honestamente em sample_size/DADOS_INSUFICIENTES.
 * @returns {object} status 'OK' com classificação real, ou 'DADOS_INSUFICIENTES'.
 */
export function classify(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    const k = Number.isFinite(input.k) ? input.k : DEFAULT_K;
    const LABEL_HORIZON = Number.isFinite(input.horizon) && input.horizon >= 1
        ? Math.floor(input.horizon)
        : DEFAULT_LABEL_HORIZON;
    const warmup = SMOOTH_WINDOW - 1 + Math.max(RSI_PERIOD, ROC_PERIOD, ATR_PERIOD) + 1;
    const minNeeded = warmup + LABEL_HORIZON + k + 1;

    if (candles.length < minNeeded) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: `apenas_${candles.length}_candles_abaixo_do_minimo_${minNeeded}` };
    }

    const closes = candles.map((c) => c.c ?? c.close);
    // smoothCausal returns NaN for its first SMOOTH_WINDOW-1 indices (no
    // full trailing window yet). computeRSI/computeROC's Wilder recurrence
    // has no way to "recover" from a NaN once it enters the running
    // average — one NaN in the warmup poisons every value after it
    // forever. So RSI/ROC are computed on the SLICE starting right after
    // that NaN region (a plain, clean array, same contract they're
    // already tested against), and every feature index below is offset by
    // `smoothValidStart` to map back to the original candle index.
    const smoothedCloses = smoothCausal(closes, SMOOTH_WINDOW, FOURIER_KEEP_COMPONENTS);
    const smoothValidStart = SMOOTH_WINDOW - 1;
    const validSmoothedCloses = smoothedCloses.slice(smoothValidStart);
    const rsiValid = computeRSI(validSmoothedCloses, RSI_PERIOD);
    const rocValid = computeROC(validSmoothedCloses, ROC_PERIOD);
    const atrPct = computeAtrPercent(candles, ATR_PERIOD);

    const rsi = (i) => (i >= smoothValidStart ? rsiValid[i - smoothValidStart] : NaN);
    const roc = (i) => (i >= smoothValidStart ? rocValid[i - smoothValidStart] : NaN);
    const features = candles.map((_, i) => [rsi(i), roc(i), atrPct[i]]);
    const isValidFeature = (f) => f.every(Number.isFinite);

    const currentIndex = candles.length - 1;
    const currentFeature = features[currentIndex];
    if (!isValidFeature(currentFeature)) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: 'feature_atual_invalida_apos_warmup' };
    }

    // Conjunto de treino: todo indice i cujo rotulo (i+horizon) já está
    // resolvido E que é estritamente anterior ao candle atual — nunca usa
    // informação futura em relação ao ponto que está sendo classificado.
    const trainingSet = [];
    const lastLabelableIndex = candles.length - 1 - LABEL_HORIZON;
    for (let i = warmup; i <= lastLabelableIndex; i++) {
        if (!isValidFeature(features[i])) continue;
        const label = Math.sign(closes[i + LABEL_HORIZON] - closes[i]);
        if (label === 0) continue; // sem movimento real -> nao adiciona ruido ao voto
        trainingSet.push({ feature: features[i], label });
    }

    if (trainingSet.length < k) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: `treino_insuficiente_${trainingSet.length}_pontos_abaixo_de_k=${k}` };
    }

    const distances = trainingSet.map((t) => ({ label: t.label, distance: lorentzianDistance(currentFeature, t.feature) }));
    distances.sort((a, b) => a.distance - b.distance);
    const neighbors = distances.slice(0, k);
    const voteSum = neighbors.reduce((acc, n) => acc + n.label, 0);

    const classification = voteSum > 0 ? 'LONG' : voteSum < 0 ? 'SHORT' : 'NEUTRAL';
    const confidence = Math.abs(voteSum) / k;

    return {
        status: 'OK',
        engine: metadata.engine,
        classification,
        confidence,
        sample_size: trainingSet.length,
        neighbors_used: neighbors.length,
        horizon_bars: LABEL_HORIZON,
    };
}
