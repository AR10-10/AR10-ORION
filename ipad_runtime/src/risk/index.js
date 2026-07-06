// index.js — ponto de entrada único do Risk Engine (Fase H).
export {
    RISK_PER_TRADE_PCT_DEFAULT,
    ASSUMED_WIN_RATE,
    MAX_POSITION_PCT,
    DISCLAIMER,
    KELLY_FRACTION_TIERS,
    kellyFractionForForca,
    buildRiskSuggestion,
} from './risk-engine.js';
