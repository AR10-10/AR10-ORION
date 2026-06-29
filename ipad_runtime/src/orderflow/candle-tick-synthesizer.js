// candle-tick-synthesizer.js — deriva uma sequencia de Tick (trade-level,
// com lado BUY/SELL) a partir de candles OHLCV agregados.
//
// HONESTIDADE: isto NAO e uma fita de negociacao real. Nenhum conector
// publico sem chave usado nesta sessao (mexc-public.js, binance-public.js,
// etc.) nem o dataset de replay (data/btcusdt_replay.json) expoe trade-a-
// trade com lado do agressor — isso exigiria o stream de trades real da
// task #37 (ainda nao construido). Esta funcao caminha deterministicamente
// open->...->close dentro de cada candle (ordem do caminho escolhida pela
// direcao do candle, convencao comum em sintetizadores de replay de
// candle) e marca o lado de cada perna pela direcao do movimento de preco
// dessa perna — um proxy aproximado, nunca apresentado na UI como dado
// vivo (sempre DataState.REPLAY, ver value-objects.js). Funcao pura: zero
// rede, zero estado global, mesma entrada sempre produz a mesma saida.

import { Tick, Side } from './value-objects.js';

export const metadata = {
    module: 'candle-tick-synthesizer',
    description: 'Deriva ticks com lado (BUY/SELL) a partir de candles OHLCV agregados, para alimentar o Order Flow Engine quando so existe dado agregado (REPLAY ou klines publicos).',
    status: 'SYNTHETIC_DERIVED',
    limitations: [
        'Nao e trade tape real: o lado de cada tick e inferido da direcao do preco dentro do candle, nunca observado de um agressor real.',
        'Volume de cada perna e proporcional ao range dessa perna (estilo close-location-value), nao o tamanho real de nenhum trade individual.',
        'Limitacao matematica verificada nesta sessao: como cada candle sempre "visita" os dois extremos (high E low) antes do close, o desequilibrio agregado de qualquer janela fica estruturalmente abaixo do que um stream de trades real produziria — testado com 60 candles sinteticos em tendencia forte e sustentada (+0.4%/candle) e o imbalance fica em ~0.57, nunca cruzando o limiar default de OFI (0.6) do signal-engine. Por isso 0 sinais organicos durante um replay e um resultado ESPERADO e HONESTO deste dataset, nao uma falha de wiring — a prova deterministica de que o motor funciona e o client.selfTest() do worker (ticks sinteticos desenhados de proposito para cruzar cada limiar), exposto como badge separado na UI.',
        'Deve ser usado apenas em DataState.REPLAY; nunca rotulado como LIVE na UI.',
    ],
};

const DEFAULT_TICKS_PER_CANDLE = 12;
const LEGS = 3; // open->mid1, mid1->mid2, mid2->close

function buildPath(candle) {
    const { o, h, l, c } = candle;
    return c >= o ? [o, l, h, c] : [o, h, l, c];
}

/**
 * @param {Array<{t:number,o:number,h:number,l:number,c:number,v:number}>} candles
 * @param {{ticksPerCandle?: number, intervalMs?: number, exchange?: string}} [opts]
 * @returns {Tick[]}
 */
export function synthesizeTicksFromCandles(candles, opts = {}) {
    const perLeg = Math.max(1, Math.round((opts.ticksPerCandle || DEFAULT_TICKS_PER_CANDLE) / LEGS));
    const exchange = opts.exchange || 'REPLAY_SYNTHETIC';
    const fallbackSpanMs = opts.intervalMs || 60000;
    const totalSteps = perLeg * LEGS;
    const ticks = [];
    let prevPrice = null;

    for (let ci = 0; ci < candles.length; ci++) {
        const candle = candles[ci];
        const path = buildPath(candle);
        const startMs = candle.t * 1000;
        const nextMs = ci + 1 < candles.length ? candles[ci + 1].t * 1000 : startMs + fallbackSpanMs;
        const spanMs = Math.max(1, nextMs - startMs);

        // Volume de cada perna e' proporcional ao tamanho do movimento de
        // preco dessa perna (nao dividido em partes iguais entre as 3
        // pernas) — assim um candle fortemente direcional (close perto do
        // high ou do low) concentra a maior parte do volume sintetico na
        // perna que efetivamente caminhou na direcao dominante, em vez de
        // produzir sempre a mesma proporcao fixa de ticks por perna
        // independente da forca real da tendencia.
        const legRanges = [];
        let totalRange = 0;
        for (let leg = 0; leg < LEGS; leg++) {
            const r = Math.abs(path[leg + 1] - path[leg]);
            legRanges.push(r);
            totalRange += r;
        }

        let step = 0;
        for (let leg = 0; leg < LEGS; leg++) {
            const from = path[leg];
            const to = path[leg + 1];
            const legVolume = totalRange > 0 ? candle.v * (legRanges[leg] / totalRange) : candle.v / LEGS;
            const volumePerTick = legVolume / perLeg;
            for (let s = 1; s <= perLeg; s++) {
                step++;
                const price = from + (to - from) * (s / perLeg);
                const timestamp = Math.round(startMs + (step / totalSteps) * spanMs);
                const side = prevPrice === null || price >= prevPrice ? Side.BUY : Side.SELL;
                ticks.push(new Tick({ timestamp, price, volume: volumePerTick, side, exchange }));
                prevPrice = price;
            }
        }
    }
    return ticks;
}
