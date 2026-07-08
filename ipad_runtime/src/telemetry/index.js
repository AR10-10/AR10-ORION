// index.js — ponto de entrada único da telemetria de sistema (Fase J).
export {
    FPS_CLASSIFICATION,
    CYCLE_CLASSIFICATION,
    classifyFps,
    classifyCycleLatency,
    memoryUsedMB,
    wasmVariantLabel,
} from './system-health.js';
