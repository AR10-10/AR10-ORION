// index.js — ponto de entrada único do Market Data Bus (Fase B / V15
// Cap. 2). engine-bridge.ts e App.tsx importam só daqui, nunca de bus.js/
// normalizer.js/etc. diretamente, para que o contrato externo do módulo
// fique num só lugar.
export { MarketDataBus, getMarketDataBus } from './bus.js';
export { collectBinanceKlines } from './binance-candle-connector.js';
export { normalizeCandles } from './normalizer.js';
export { validateCandleSeries } from './integrity-validator.js';
export { computeAsOf, computeAgeMs, isStale } from './time-synchronizer.js';
export { CandleRingBuffer } from './candle-ring-buffer.js';
