// mexc-futures-candle-connector.js — ADITIVO V-MAX Etapa 1 (Market Data
// Adapter): irmão direto de binance-futures-candle-connector.js, MESMO
// contrato de collect() que o Market Data Bus e o MarketDataAdapter
// (ramber-ui/src/market-data-adapter.ts) esperam — candles reais MEXC
// no schema canônico do Bus ({t,o,h,l,c,v}). Única função autorizada a
// chamar js/real-data/mexc-futures-public.js para candles — o Bus
// continua agnóstico de mercado, só recebe outro `collect` injetado.
import { probe as probeMexcFutures } from '../../js/real-data/mexc-futures-public.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';

/** @param {{symbol: string, timeframe: string, limit: number, endTime?: number, returnEvidence?: boolean}} opts
 *  Mesma semântica de collectBinanceFuturesKlines (ver aquele header
 *  para o contrato completo de endTime/returnEvidence) — o sufixo de
 *  cache `-PERP`/`-MEXC` nunca vaza para o parâmetro real de símbolo
 *  enviado à API, removido aqui na fronteira, mesma disciplina do
 *  irmão Binance.
 *  @returns {Promise<Array<{t:number,o:number,h:number,l:number,c:number,v:number}>> | Promise<object>} */
export async function collectMexcFuturesKlines({ symbol, timeframe, limit, endTime, returnEvidence = false }) {
    const realSymbol = symbol.replace(/-PERP$/, '').replace(/-MEXC$/, '');
    const result = await probeMexcFutures({ symbol: realSymbol, interval: timeframe, limit, endTime });
    if (result.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        throw new Error(`conector_mexc_futures_estado:${result.state}`);
    }
    return returnEvidence ? result.evidence : result.evidence.candles;
}
