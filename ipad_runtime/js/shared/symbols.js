// symbols.js — mapeamento canônico symbol curto (BTC/ETH/...) -> par real
// da API (BTCUSDT/...). Era o mesmo objeto literal duplicado byte-a-byte
// em 3 conectores (binance-public.js, binance-futures-public.js, mexc-
// trades-stream.js) — Binance e MEXC usam a mesma convenção XXXUSDT para
// estes 5 pares, então uma única fonte real basta para os três.
export const SYMBOL_TO_USDT_PAIR = Object.freeze({
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
    SOL: 'SOLUSDT',
    BNB: 'BNBUSDT',
    XRP: 'XRPUSDT',
});
