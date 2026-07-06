// binance-candle-connector.js — Conector real (Fase B / V15 Cap. 2: "Raw
// Connectors", primeiro estágio do pipeline). Esta é a ÚNICA função em toda
// a base autorizada a chamar js/real-data/binance-public.js diretamente
// para candles. A partir da Fase B, engine-bridge.ts e App.tsx não chamam
// mais binance-public.js nem fetch() de klines por conta própria — pedem
// sempre ao Market Data Bus (bus.js), que injeta esta função como o
// `collect` de cada requestSnapshot(). Um futuro segundo conector de
// candles (MEXC/Bybit/OKX klines, V15 Cap. 3) ganha seu próprio arquivo
// irmão aqui, nunca uma ramificação dentro do Bus.
import { probe as probeBinance } from '../../js/real-data/binance-public.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';

/** @param {{symbol: string, timeframe: string, limit: number}} opts
 *  @returns {Promise<Array<{t:number,o:number,h:number,l:number,c:number,v:number}>>} */
export async function collectBinanceKlines({ symbol, timeframe, limit }) {
    const result = await probeBinance({ symbol, interval: timeframe, limit });
    if (result.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        throw new Error(`conector_binance_estado:${result.state}`);
    }
    return result.evidence.candles;
}
