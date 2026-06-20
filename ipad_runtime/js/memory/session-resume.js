// session-resume.js — Rehidratacao de sessao do Real Data Layer (mission
// AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
// Combina persistent-state.js (ultimo estado por conector/fonte/frame) e
// evidence-ledger.js (historico de evidencias reais) num unico snapshot para
// a UI mostrar "o que sabiamos antes de fechar a aba" sem sondar rede de novo.

import { loadAll } from './persistent-state.js';
import { getLedger } from './evidence-ledger.js';

/** @returns {Promise<{state: object, ledger: array, has_previous_session: boolean}>} */
export async function rehydrateSession() {
    const [state, ledger] = await Promise.all([loadAll(), getLedger()]);
    const hasPreviousSession = Boolean(
        state.lastConnectorTested ||
        state.activeSource ||
        state.lastAnalysisFrame ||
        ledger.length > 0
    );
    return { state, ledger, has_previous_session: hasPreviousSession };
}
