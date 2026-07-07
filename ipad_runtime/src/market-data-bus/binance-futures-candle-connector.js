// binance-futures-candle-connector.js — Conector real de candles do
// mercado USDT-M Futures/Perpétuo da Binance (Diretriz 2 do Overhaul
// Cross-Market: "Gráfico e Risk Engine consomem EXCLUSIVAMENTE a API de
// Futuros"). Irmão de binance-candle-connector.js (spot) — exatamente o
// padrão que o header daquele arquivo já previa desde a Fase B: "Um
// futuro segundo conector de candles... ganha seu próprio arquivo irmão
// aqui, nunca uma ramificação dentro do Bus". Esta é a ÚNICA função
// autorizada a chamar js/real-data/binance-futures-public.js para
// candles — o Bus continua agnóstico de mercado, só recebe outro
// `collect` injetado.
//
// js/real-data/binance-futures-public.js já existia (pré-V15, sondas
// públicas sem chave) mas nunca tinha sido ligado ao pipeline real de
// candles do app — só suas leituras de funding/OI/depth eram usadas
// (GMIL, Fase E). Este arquivo o reaproveita para a única peça que
// faltava: klines reais de futuros no schema canônico do Bus.
import { probe as probeBinanceFutures } from '../../js/real-data/binance-futures-public.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';

/** @param {{symbol: string, timeframe: string, limit: number}} opts
 *  @returns {Promise<Array<{t:number,o:number,h:number,l:number,c:number,v:number}>>} */
export async function collectBinanceFuturesKlines({ symbol, timeframe, limit }) {
    const result = await probeBinanceFutures({ symbol, interval: timeframe, limit });
    if (result.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        throw new Error(`conector_binance_futures_estado:${result.state}`);
    }
    return result.evidence.candles;
}
