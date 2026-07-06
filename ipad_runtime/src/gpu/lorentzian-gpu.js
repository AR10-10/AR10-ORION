// lorentzian-gpu.js — Fundação do pipeline WebGPU de cômputo (Fase I /
// V15 Cap. 16.3, diretriz 2). O alvo natural é a parte O(n·d) mais pesada
// do k-NN Lorentziano: a matriz de distâncias query×candidatos — cada
// linha é independente, paralelismo perfeito para GPU (Apple Silicon no
// iPad).
//
// STATUS HONESTO — FUNDAÇÃO, NÃO ADOÇÃO: o classificador graduado
// (src/research/engines/lorentzian-classifier.js) NÃO foi re-fiado para
// este pipeline nesta fase. A trava de governança da Fase G exige
// evidência objetiva antes de substituir o caminho de um algoritmo
// consolidado, e trocar uma função síncrona pura por um caminho GPU
// assíncrono é mudança de comportamento — não só de velocidade. O que a
// Fase I entrega, testado: (1) a matemática de referência CPU IDÊNTICA à
// do motor real (provado por teste contra a própria lorentzianDistance do
// classificador); (2) o kernel WGSL que computa a mesma fórmula; (3) a
// detecção de capacidade e o seletor de backend com fallback SILENCIOSO
// (diretriz 4). A adoção no classificador (com janelas maiores, k maior)
// é uma ordem futura com benchmark antes/depois.
//
// Fórmula (a MESMA do motor real): d(q, c) = Σ_j ln(1 + |q_j − c_j|).

// Kernel WGSL: 1 invocação por candidato; features achatadas row-major
// (candidato i ocupa [i·dim, (i+1)·dim)). f32 na GPU — precisão simples é
// o padrão WGSL; a suite de paridade CPU×GPU (quando a adoção acontecer)
// definirá a tolerância aceitável. Nada aqui roda em node; o teste cobre
// a integridade da fonte do kernel e toda a lógica pura.
export const WGSL_LORENTZIAN_DISTANCES = /* wgsl */ `
struct Params { count: u32, dim: u32 };

@group(0) @binding(0) var<storage, read> query: array<f32>;
@group(0) @binding(1) var<storage, read> features: array<f32>;
@group(0) @binding(2) var<storage, read_write> distances: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  var total: f32 = 0.0;
  let base = i * params.dim;
  for (var j: u32 = 0u; j < params.dim; j = j + 1u) {
    total = total + log(1.0 + abs(query[j] - features[base + j]));
  }
  distances[i] = total;
}
`;

/** Referência CPU — bit-idêntica à matemática do classificador real
 *  (ver teste que compara com a própria lorentzianDistance exportada).
 *  features: array de vetores candidatos; retorna Float64Array. */
export function cpuLorentzianDistances(query, features) {
    const out = new Float64Array(features.length);
    for (let i = 0; i < features.length; i++) {
        const candidate = features[i];
        let total = 0;
        for (let j = 0; j < query.length; j++) {
            total += Math.log(1 + Math.abs(query[j] - candidate[j]));
        }
        out[i] = total;
    }
    return out;
}

/** Detecção de capacidade WebGPU — silenciosa por contrato (diretriz 4):
 *  navegador sem navigator.gpu, adapter negado ou exceção => null, nunca
 *  um throw que degrade o app. Recebe o objeto navigator por parâmetro
 *  para ser testável fora do browser. */
export async function detectGpuAdapter(nav) {
    try {
        if (!nav || !nav.gpu || typeof nav.gpu.requestAdapter !== 'function') return null;
        const adapter = await nav.gpu.requestAdapter();
        return adapter ?? null;
    } catch {
        return null;
    }
}

/** Seleção de backend de cômputo (pura): a cadeia oficial de fallback da
 *  Fase I — WebGPU quando o adapter real existe; senão WASM SIMD quando a
 *  sonda aprova; senão o caminho escalar de sempre. Nunca lança. */
export function selectComputeBackend({ gpuAdapter = null, simdSupported = false } = {}) {
    if (gpuAdapter) return 'webgpu';
    if (simdSupported) return 'wasm-simd';
    return 'scalar';
}

/** Execução real do kernel numa GPUDevice (browser only — não roda em
 *  node/vitest; coberto pela fundação, exercitado quando a adoção
 *  acontecer). Mantido pequeno e literal: buffers de storage para query/
 *  features/distances + uniform de dimensões, 1 dispatch, leitura de
 *  volta. Qualquer falha => null (fallback silencioso do chamador). */
export async function computeLorentzianDistancesGpu(device, query, features) {
    try {
        const dim = query.length;
        const count = features.length;
        const queryData = new Float32Array(query);
        const featureData = new Float32Array(count * dim);
        for (let i = 0; i < count; i++) featureData.set(features[i], i * dim);

        const mkStorage = (data, usage) => {
            const buffer = device.createBuffer({ size: Math.max(16, data.byteLength), usage, mappedAtCreation: true });
            new Float32Array(buffer.getMappedRange()).set(data);
            buffer.unmap();
            return buffer;
        };
        const queryBuf = mkStorage(queryData, GPUBufferUsage.STORAGE);
        const featBuf = mkStorage(featureData, GPUBufferUsage.STORAGE);
        const distBuf = device.createBuffer({ size: Math.max(16, count * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
        const paramBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(paramBuf, 0, new Uint32Array([count, dim, 0, 0]));

        const module = device.createShaderModule({ code: WGSL_LORENTZIAN_DISTANCES });
        const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: queryBuf } },
                { binding: 1, resource: { buffer: featBuf } },
                { binding: 2, resource: { buffer: distBuf } },
                { binding: 3, resource: { buffer: paramBuf } },
            ],
        });

        const readBuf = device.createBuffer({ size: Math.max(16, count * 4), usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
        pass.end();
        encoder.copyBufferToBuffer(distBuf, 0, readBuf, 0, Math.max(16, count * 4));
        device.queue.submit([encoder.finish()]);

        await readBuf.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(readBuf.getMappedRange().slice(0, count * 4));
        readBuf.unmap();
        return result;
    } catch {
        return null; // fallback silencioso — o chamador usa a referência CPU
    }
}
