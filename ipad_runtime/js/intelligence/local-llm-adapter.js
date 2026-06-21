// local-llm-adapter.js — resolve qual camada do fallback_chain declarado em
// pack/manifest.models.json estaria ativa agora, a partir do estado real de
// deteccao de feature (feature-detect.js) e de se algum modelo foi de fato
// instalado (hoje sempre false: nenhum fluxo de download de modelo existe
// nesta versao — ver manifest.models.json > blocking_reason). Nunca chama
// rede, nunca chama IA externa, nunca decide ordem. Quando a camada
// resolvida e' FALLBACK_TEXT_ONLY (sempre, nesta versao), o chamador usa as
// respostas pre-definidas de siriform-explainer.js — este modulo so decide
// qual camada esta ativa, nunca gera o texto em si.
//
// FALLBACK_CHAIN espelha manifest.models.json > models[0].fallback_chain
// (familia WebLLM/MLC-LLM / Meta Llama) — mantenha os dois em sincronia
// manualmente se o manifesto mudar.

export const FALLBACK_CHAIN = Object.freeze([
    'WEBLLM_WEBGPU',
    'WEBLLM_WASM_CPU',
    'SMALLER_FAMILY_MODEL',
    'FALLBACK_TEXT_ONLY',
]);

function evaluateTier(tier, f, modelInstalled) {
    if (tier === 'FALLBACK_TEXT_ONLY') {
        return { tier, eligible: true, reason: 'sem modelo: respostas pre-definidas do Siriform (siriform-explainer.js)' };
    }
    if (!modelInstalled) {
        return { tier, eligible: false, reason: 'nenhum modelo instalado (sem fluxo de download nesta versao)' };
    }
    if (tier === 'WEBLLM_WEBGPU') {
        if (f.webgpu !== 'OK') return { tier, eligible: false, reason: 'WebGPU indisponivel' };
        if (f.webllm !== 'OK') return { tier, eligible: false, reason: 'engine WebLLM indisponivel' };
        return { tier, eligible: true, reason: 'elegivel' };
    }
    if (tier === 'WEBLLM_WASM_CPU' || tier === 'SMALLER_FAMILY_MODEL') {
        if (f.webllm !== 'OK') return { tier, eligible: false, reason: 'engine WebLLM indisponivel' };
        return { tier, eligible: true, reason: 'elegivel' };
    }
    return { tier, eligible: false, reason: 'camada desconhecida' };
}

/**
 * @param {{ webgpu?: string, webllm?: string }} featureFlags resultado de
 *   feature-detect.js (runAllFeatureDetections())
 * @param {boolean} modelInstalled hoje sempre false nesta versao
 * @returns {{ active_tier: string, reason: string, chain_evaluated: Array<{tier: string, eligible: boolean, reason: string}> }}
 */
export function resolveActiveLlmTier(featureFlags, modelInstalled = false) {
    const f = featureFlags || {};
    const chainEvaluated = FALLBACK_CHAIN.map((tier) => evaluateTier(tier, f, modelInstalled));
    const active = chainEvaluated.find((entry) => entry.eligible) || chainEvaluated[chainEvaluated.length - 1];
    return { active_tier: active.tier, reason: active.reason, chain_evaluated: chainEvaluated };
}
