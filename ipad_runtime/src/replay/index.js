// index.js — ponto de entrada único do Motor de Replay (Fase K). SÓ a
// suíte de testes consome este domínio; nenhum módulo de produção importa
// daqui (invariante travada por teste de fronteira, no espírito da Fase G).
export { REPLAY_DEFAULT_WINDOW, createReplaySession, runWalkForward } from './replay-engine.js';
