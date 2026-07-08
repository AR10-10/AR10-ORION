// system-health.js — Telemetria de saúde do SISTEMA (Fase J / V15 Cap. 17).
// Funções puras que classificam medições REAIS da plataforma — nenhuma
// métrica é estimada ou inventada:
//   FPS       medido de verdade por requestAnimationFrame na UI;
//   latência  do ciclo real do motor, cronometrada em volta do await;
//   memória   SÓ quando a plataforma expõe API (performance.memory é
//             Chromium-only; Safari/iPad NÃO expõe uso de heap JS — o
//             honesto é declarar SEM_API, nunca um número fabricado).
// CPU/GPU: nenhuma API web expõe utilização — deliberadamente FORA deste
// painel (Cap. 17 pede monitorar; a plataforma não oferece; fingir seria
// violar a constituição deste código).

export const FPS_CLASSIFICATION = Object.freeze({
    FLUIDO: 'FLUIDO',        // >= 50fps — ProMotion/60Hz saudável
    ACEITAVEL: 'ACEITAVEL',  // >= 30fps
    CRITICO: 'CRITICO',      // abaixo de 30fps
});

export function classifyFps(fps) {
    if (!Number.isFinite(fps) || fps < 0) return null;
    if (fps >= 50) return FPS_CLASSIFICATION.FLUIDO;
    if (fps >= 30) return FPS_CLASSIFICATION.ACEITAVEL;
    return FPS_CLASSIFICATION.CRITICO;
}

export const CYCLE_CLASSIFICATION = Object.freeze({
    RAPIDO: 'RAPIDO',   // < 500ms — sonda + WASM + pipeline inteiro
    OK: 'OK',           // < 1500ms
    LENTO: 'LENTO',     // acima disso (rede degradada domina)
});

export function classifyCycleLatency(ms) {
    if (!Number.isFinite(ms) || ms < 0) return null;
    if (ms < 500) return CYCLE_CLASSIFICATION.RAPIDO;
    if (ms < 1500) return CYCLE_CLASSIFICATION.OK;
    return CYCLE_CLASSIFICATION.LENTO;
}

/** Uso de heap JS em MB — APENAS quando a plataforma expõe
 *  performance.memory (Chromium). Safari => null (SEM_API), nunca chute. */
export function memoryUsedMB(perf) {
    const used = perf?.memory?.usedJSHeapSize;
    if (!Number.isFinite(used) || used < 0) return null;
    return used / (1024 * 1024);
}

/** Rótulo curto da variante WASM realmente carregada (telemetria da
 *  Fase I). Vocabulário fechado; desconhecido => null (AGUARDANDO). */
export function wasmVariantLabel(variant) {
    if (variant === 'simd128') return 'SIMD128';
    if (variant === 'escalar') return 'ESCALAR';
    return null;
}
