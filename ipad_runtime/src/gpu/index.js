// index.js — ponto de entrada único da fundação WebGPU (Fase I).
export {
    WGSL_LORENTZIAN_DISTANCES,
    cpuLorentzianDistances,
    detectGpuAdapter,
    selectComputeBackend,
    computeLorentzianDistancesGpu,
} from './lorentzian-gpu.js';
