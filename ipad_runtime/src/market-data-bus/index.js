// index.js — ponto de entrada único do Market Data Bus (Fase B / V15
// Cap. 2). engine-bridge.ts e App.tsx importam só daqui, nunca de bus.js/
// normalizer.js/etc. diretamente, para que o contrato externo do módulo
// fique num só lugar.
export { MarketDataBus, getMarketDataBus } from './bus.js';
// O conector Spot original (binance-candle-connector.js) foi removido —
// superseded pelo Futures abaixo desde a Diretriz 2 ("extinguindo
// qualquer roteamento de gráficos para mercado Spot", já travado por
// tests/diretriz3-fixes.test.ts); zero import real restava em produção.
export { collectBinanceFuturesKlines } from './binance-futures-candle-connector.js';
// ADITIVO V-MAX Etapa 1 (Market Data Adapter): irmão MEXC do conector
// acima, mesmo contrato de collect() — ver mexc-futures-candle-connector.js.
export { collectMexcFuturesKlines } from './mexc-futures-candle-connector.js';
// Ordem Market Data Fabric, Fase 1: irmão TradFi/CME dos dois acima —
// mesmo contrato de collect(), fonte delayed (Yahoo, não-oficial) em vez
// de exchange cripto, ver tradfi-delayed-connector.js.
export { collectTradfiDelayedKlines } from './tradfi-delayed-connector.js';
export {
    ASSET_CLASS,
    PRIORITY_TIER,
    TRADFI_FUTURES_INSTRUMENT_TYPE,
    INSTRUMENT_REGISTRY,
    listInstruments,
    listByPriorityTier,
    listByAssetClass,
    findByInstrumentId,
    findByContractCode,
    findByContinuousSymbolHint,
    findByLegacyTradFiAssetSymbol,
    listAssetClasses,
    listDesignatedContractMarkets,
    buildCascadingSelectorTree,
} from './instrument-registry.js';
export { normalizeCandles } from './normalizer.js';
export { validateCandleSeries } from './integrity-validator.js';
export { computeAsOf, computeAgeMs, isStale } from './time-synchronizer.js';
export { CandleRingBuffer } from './candle-ring-buffer.js';
export { QualityMonitor } from './quality-monitor.js';
export {
    QUALITY_CLASSIFICATION,
    QUALITY_WINDOW,
    LATENCY_GOOD_MS,
    LATENCY_BAD_MS,
    CONSISTENCY_TOLERANCE,
    MIN_SAMPLES_FOR_STABILITY,
    QUARANTINE_THRESHOLD,
    FAILURE_STREAK_QUARANTINE,
    EMA_ALPHA,
    timeframeToSeconds,
    scoreLatency,
    scoreAvailability,
    computeConsistency,
    scoreStability,
    classifyScore,
    tailFailureStreak,
    composeQualityReport,
} from './quality-engine.js';
