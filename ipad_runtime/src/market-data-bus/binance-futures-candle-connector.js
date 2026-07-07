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

// BUG REAL (achado por captura de tela do Operador em dispositivo real —
// nunca detectável no sandbox sem rede desta sessão de implementação):
// engine-bridge.ts chama o Bus com `symbol: \`${symbol}-PERP\`` (sufixo
// -PERP é só a CHAVE DE CACHE do Bus, ver header acima); o Bus repassa
// esse MESMO valor para collect(), então este conector recebia
// "BTC-PERP" e o mandava direto para probeBinanceFutures(), cujo
// SYMBOL_TO_PAIR não conhece esse sufixo e cai no template
// `${symbol}USDT` => "BTC-PERPUSDT" — um par que não existe na Binance.
// Resultado: TODA chamada real de futuros falhava (símbolo inválido),
// 100% das vezes, em qualquer rede real — mascarado pelo fallback
// automático para Spot (Estabilização desta sessão), que fazia a UI
// parecer funcionar mostrando o badge "SPOT" em vez de "Futures/Perp",
// nunca satisfazendo de fato a Diretriz 2. Antes do fallback existir,
// esta mesma causa raiz produzia o "AGUARDANDO CANDLES" permanente
// originalmente reportado. Correção: o sufixo de cache nunca pode
// vazar para o parâmetro real de símbolo enviado à API — é removido
// aqui, na fronteira entre o Bus e o conector real.
/** @param {{symbol: string, timeframe: string, limit: number}} opts
 *  @returns {Promise<Array<{t:number,o:number,h:number,l:number,c:number,v:number}>>} */
export async function collectBinanceFuturesKlines({ symbol, timeframe, limit }) {
    const realSymbol = symbol.endsWith('-PERP') ? symbol.slice(0, -'-PERP'.length) : symbol;
    const result = await probeBinanceFutures({ symbol: realSymbol, interval: timeframe, limit });
    if (result.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        throw new Error(`conector_binance_futures_estado:${result.state}`);
    }
    return result.evidence.candles;
}
