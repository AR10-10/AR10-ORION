// index.js — ponto de entrada único do Market Regime Engine (Fase D).
// Consumidores (engine-bridge.ts, futuras fases F/G) importam só daqui.
export {
    REGIMES,
    REGIME_DIRECTION,
    ADX_PERIOD,
    BOLLINGER_PERIOD,
    BOLLINGER_K,
    BANDWIDTH_HISTORY,
    SQUEEZE_PERCENTILE,
    ADX_STRONG,
    ADX_MODERATE,
    MIN_CANDLES_FOR_REGIME,
    computeAdx,
    computeBandwidthSeries,
    percentileRank,
    classifyMarketRegime,
} from './regime-engine.js';
export { MODULE_FAMILIES, REGIME_WEIGHT_MATRIX, getRegimeWeights, getSensitivity } from './weight-matrix.js';
export { RegimeHistory } from './regime-history.js';
