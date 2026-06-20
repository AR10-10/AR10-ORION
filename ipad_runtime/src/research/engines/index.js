// index.js — Registro central dos motores de pesquisa (FUTURE, INERTE).
// Apenas agrega os modulos individuais em `ipad_runtime/src/research/engines/`
// num unico objeto. Nao e importado por `index.html` nem por `js/app.js` —
// nenhum destes motores esta ligado ao runtime ao vivo. Ver
// `docs/MULTI_ASSET_RESEARCH_LIBRARY.md` para o plano completo.

import * as marketStructure from './market-structure-engine.js';
import * as supportResistance from './support-resistance-engine.js';
import * as liquidity from './liquidity-engine.js';
import * as volumeProfile from './volume-profile-engine.js';
import * as futuresFlow from './futures-flow-engine.js';
import * as fundingOi from './funding-oi-engine.js';
import * as volatilityRegime from './volatility-regime-engine.js';
import * as retracement from './retracement-engine.js';
import * as trend from './trend-engine.js';
import * as momentum from './momentum-engine.js';
import * as risk from './risk-engine.js';
import * as signalFusion from './signal-fusion-engine.js';
import * as scenarioBuilder from './scenario-builder.js';

export const engines = {
    marketStructure,
    supportResistance,
    liquidity,
    volumeProfile,
    futuresFlow,
    fundingOi,
    volatilityRegime,
    retracement,
    trend,
    momentum,
    risk,
    signalFusion,
    scenarioBuilder,
};

export default engines;
