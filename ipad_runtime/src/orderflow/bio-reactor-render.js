// bio-reactor-render.js — "Nucleo Biologico" / Reator Biologico: esfera
// neural 3D (80 nodos em distribuicao por proporcao aurea + 9 aneis
// concentricos inclinados), WebGPU-first com fallback automatico para
// Canvas2D. O layout matematico (golden-ratio sphere + aneis) e fiel a
// Skill 11 de golden-master.html — la' a renderizacao em si e puro
// Canvas2D (nenhum WebGPU existe no arquivo original); o pipeline WebGPU
// abaixo e codigo novo, escrito direto contra a spec WGSL/WebGPU para
// atender o requisito explicito de hardware acceleration no iPad.
//
// HONESTIDADE DE SANDBOX: este container nao expoe nenhum device de GPU
// (sem /dev/dri). No Chromium headless usado para validar este arquivo,
// `navigator.gpu` existe como objeto (API exposta), mas
// `requestAdapter()` resolve `null` — ou seja, o guard `if (!adapter)
// throw` abaixo e o que dispara o fallback, nao o guard `if
// (!navigator.gpu)`. Em builds/flags diferentes ja observamos tambem
// `navigator.gpu === undefined` direto. Os dois casos sao cobertos por
// try/catch explicito, entao o pipeline WebGPU foi escrito e revisado
// contra a especificacao mas NAO pode ser executado de ponta a ponta
// (draw calls reais) nesta sessao. Cada etapa de init (adapter, device,
// shader, pipeline) e guardada por try/catch e por
// shaderModule.getCompilationInfo(); qualquer falha em qualquer hardware
// real cai automaticamente para o Canvas2D abaixo, que esta verificado
// pintando pixels reais (com variancia de alpha e regioes de brilho
// distintas, nao um frame plano) em headless Chromium nesta sessao,
// incluindo apos resize() e destroy().

const NODE_COUNT = 80;
const RING_COUNT = 9;
const GOLDEN_ANGLE = 1.618033988749895;
const COLOR_RGB = Object.freeze({
    cyan: [0, 0.961, 1],
    purple: [0.753, 0.518, 0.988],
    orange: [0.976, 0.451, 0.086],
});

export function buildSphereNodes(count = NODE_COUNT, rng = Math.random) {
    const nodes = [];
    for (let i = 0; i < count; i++) {
        const phi = Math.acos((2 * i) / count - 1);
        const theta = 2 * Math.PI * i * GOLDEN_ANGLE;
        nodes.push({
            x: Math.sin(phi) * Math.cos(theta),
            y: Math.sin(phi) * Math.sin(theta),
            z: Math.cos(phi),
            r: 0.015 + rng() * 0.035,
            pulse: rng() * Math.PI * 2,
            color: rng() > 0.7 ? 'purple' : 'cyan',
        });
    }
    return nodes;
}

export function buildSynapses(nodes, maxDist = 0.5) {
    const synapses = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const dz = nodes[i].z - nodes[j].z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < maxDist) synapses.push({ a: i, b: j, alpha: 0.1 + 0.4 * (1 - dist / maxDist) });
        }
    }
    return synapses;
}

export function buildRings(count = RING_COUNT) {
    const rings = [];
    for (let ring = 0; ring < count; ring++) {
        const radius = 0.3 + ring * 0.07;
        const tilt = (ring - 4) * 0.15;
        const segments = 40 + ring * 8;
        const nodes = [];
        for (let s = 0; s < segments; s++) {
            const angle = (2 * Math.PI * s) / segments;
            nodes.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius * Math.cos(tilt),
                z: Math.sin(angle) * radius * Math.sin(tilt),
            });
        }
        rings.push({ nodes, radius, tilt, color: ring < 3 ? 'cyan' : ring < 6 ? 'purple' : 'orange', speed: 0.002 + ring * 0.0005 });
    }
    return rings;
}

// ─── Canvas2D backend (porta direta de drawSphere(), verificada nesta sessao) ───

class Canvas2DReactor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        this.nodes = buildSphereNodes();
        this.synapses = buildSynapses(this.nodes);
        this.rings = buildRings();
        this.rotation = 0;
        this.pulse = 0;
    }

    render(timestamp, zScore) {
        zScore = zScore || 0;
        const ctx = this.ctx;
        const w = this.canvas.width, h = this.canvas.height;
        if (!w || !h) return;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(2,6,23,0.5)';
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.4;
        this.rotation += 0.004 + Math.abs(zScore) * 0.001;
        this.pulse += 0.05;
        const cosA = Math.cos(this.rotation), sinA = Math.sin(this.rotation);
        const proj = (n) => {
            const rx = n.x * cosA - n.z * sinA;
            const rz = n.x * sinA + n.z * cosA;
            return { x: cx + rx * scale, y: cy + n.y * scale, z: rz, r: n.r, color: n.color };
        };

        const colorMap = { cyan: '0,245,255', purple: '192,132,252', orange: '249,115,22' };
        for (const ring of this.rings) {
            const projectedRing = ring.nodes.map(proj);
            const alpha = 0.25 + 0.1 * Math.sin(this.pulse * ring.speed * 10);
            ctx.strokeStyle = `rgba(${colorMap[ring.color]},${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            projectedRing.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.closePath();
            ctx.stroke();
        }

        const projected = this.nodes.map(proj);
        projected.sort((a, b) => b.z - a.z);

        ctx.lineWidth = 0.4;
        for (const s of this.synapses) {
            const A = projected[s.a], B = projected[s.b];
            const alphaMod = 0.3 + 0.2 * Math.sin(this.pulse + s.a * 0.1);
            ctx.strokeStyle = `rgba(0,245,255,${s.alpha * alphaMod})`;
            ctx.beginPath();
            ctx.moveTo(A.x, A.y);
            ctx.lineTo(B.x, B.y);
            ctx.stroke();
        }

        for (const p of projected) {
            const nodePulse = 0.5 + 0.5 * Math.sin(timestamp * 0.003 + p.r * 12 + this.pulse);
            const intensity = 0.6 + 0.4 * Math.abs(zScore) / 5;
            const radius = p.r * scale * 1.4;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
            const c = p.color === 'purple' ? '192,132,252' : '0,245,255';
            grad.addColorStop(0, `rgba(${c},${0.9 * nodePulse * intensity})`);
            grad.addColorStop(0.6, `rgba(${c},${0.3 * nodePulse * intensity})`);
            grad.addColorStop(1, 'rgba(0,245,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        const stressAlpha = Math.min(1, Math.abs(zScore) / 4);
        if (stressAlpha > 0.5) {
            const stressGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.5);
            stressGrad.addColorStop(0, `rgba(249,115,22,${stressAlpha * 0.4})`);
            stressGrad.addColorStop(1, 'rgba(249,115,22,0)');
            ctx.fillStyle = stressGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, scale * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    onResize() {}
    destroy() {}
}

// ─── WebGPU backend (codigo novo; nao executavel neste sandbox, ver header) ───

const NODE_SHADER_WGSL = `
struct Uniforms { data: vec4<f32> }; // x=time(s) y=zScore z=rotation w=aspect(w/h)
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) colorFlag: f32,
  @location(2) intensity: f32,
};

@vertex
fn vs_main(
  @location(0) corner: vec2<f32>,
  @location(1) nodePos: vec3<f32>,
  @location(2) nodeSize: f32,
  @location(3) colorFlag: f32,
  @location(4) pulseSeed: f32,
) -> VsOut {
  let cosA = cos(u.data.z);
  let sinA = sin(u.data.z);
  let rx = nodePos.x * cosA - nodePos.z * sinA;
  let rz = nodePos.x * sinA + nodePos.z * cosA;
  let ry = nodePos.y;

  let pulse = 0.5 + 0.5 * sin(u.data.x * 3.0 + nodeSize * 12.0 + pulseSeed);
  let intensity = 0.6 + 0.4 * abs(u.data.y) / 5.0;
  let depthScale = 1.0 / (2.2 - rz * 0.6);
  let size = nodeSize * 1.4 * depthScale * (0.85 + 0.3 * pulse);

  let aspectFix = vec2<f32>(1.0 / u.data.w, 1.0);
  let centerNDC = vec2<f32>(rx, ry) * 0.8 * aspectFix;
  let offsetNDC = corner * size * aspectFix;

  var out: VsOut;
  out.position = vec4<f32>(centerNDC + offsetNDC, 0.0, 1.0);
  out.uv = corner;
  out.colorFlag = colorFlag;
  out.intensity = pulse * intensity;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let d = length(in.uv);
  let glow = clamp(1.0 - d, 0.0, 1.0);
  let alpha = pow(glow, 1.6) * in.intensity * 0.9;
  let cyan = vec3<f32>(0.0, 0.961, 1.0);
  let purple = vec3<f32>(0.753, 0.518, 0.988);
  let color = mix(cyan, purple, in.colorFlag);
  return vec4<f32>(color * alpha, alpha);
}
`;

const RING_SHADER_WGSL = `
struct Uniforms { data: vec4<f32> }; // x=time(s) y=zScore z=rotation w=aspect(w/h)
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) speed: f32,
};

@vertex
fn vs_main(
  @location(0) pos: vec3<f32>,
  @location(1) color: vec3<f32>,
  @location(2) speed: f32,
) -> VsOut {
  let cosA = cos(u.data.z);
  let sinA = sin(u.data.z);
  let rx = pos.x * cosA - pos.z * sinA;
  let ry = pos.y;
  let aspectFix = vec2<f32>(1.0 / u.data.w, 1.0);

  var out: VsOut;
  out.position = vec4<f32>(vec2<f32>(rx, ry) * 0.8 * aspectFix, 0.0, 1.0);
  out.color = color;
  out.speed = speed;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let alpha = 0.25 + 0.1 * sin(u.data.x * in.speed * 10.0);
  return vec4<f32>(in.color * alpha, alpha);
}
`;

async function assertShaderCompiles(shaderModule, label) {
    if (typeof shaderModule.getCompilationInfo !== 'function') return;
    const info = await shaderModule.getCompilationInfo();
    const errors = info.messages.filter((m) => m.type === 'error');
    if (errors.length) {
        throw new Error(`WGSL compile error in ${label}: ${errors.map((e) => e.message).join('; ')}`);
    }
}

const ADDITIVE_BLEND = {
    color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
};

class WebGPUReactor {
    constructor(canvas) {
        this.canvas = canvas;
        this.rotation = 0;
    }

    async init() {
        if (!navigator.gpu) throw new Error('navigator.gpu indisponivel neste navegador');
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('nenhum GPUAdapter disponivel');
        const device = await adapter.requestDevice();
        const context = this.canvas.getContext('webgpu');
        if (!context) throw new Error('contexto webgpu indisponivel no canvas');

        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'premultiplied' });
        this.device = device;
        this.context = context;
        this.format = format;

        const nodes = buildSphereNodes();
        const rings = buildRings();

        const nodeFloats = new Float32Array(nodes.length * 6);
        nodes.forEach((n, i) => nodeFloats.set([n.x, n.y, n.z, n.r, n.color === 'purple' ? 1 : 0, n.pulse], i * 6));
        this.nodeBuffer = this._createVertexBuffer(nodeFloats);
        this.nodeCount = nodes.length;

        const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
        this.quadBuffer = this._createVertexBuffer(quad);

        this.uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

        const bindGroupLayout = device.createBindGroupLayout({
            entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} }],
        });
        this.bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
        });
        const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        const nodeShader = device.createShaderModule({ code: NODE_SHADER_WGSL });
        await assertShaderCompiles(nodeShader, 'NODE_SHADER_WGSL');
        this.nodePipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: nodeShader,
                entryPoint: 'vs_main',
                buffers: [
                    { arrayStride: 8, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] },
                    {
                        arrayStride: 24,
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 1, offset: 0, format: 'float32x3' },
                            { shaderLocation: 2, offset: 12, format: 'float32' },
                            { shaderLocation: 3, offset: 16, format: 'float32' },
                            { shaderLocation: 4, offset: 20, format: 'float32' },
                        ],
                    },
                ],
            },
            fragment: { module: nodeShader, entryPoint: 'fs_main', targets: [{ format, blend: ADDITIVE_BLEND }] },
            primitive: { topology: 'triangle-list' },
        });

        const ringShader = device.createShaderModule({ code: RING_SHADER_WGSL });
        await assertShaderCompiles(ringShader, 'RING_SHADER_WGSL');
        this.ringPipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: ringShader,
                entryPoint: 'vs_main',
                buffers: [{ arrayStride: 28, stepMode: 'vertex', attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },
                    { shaderLocation: 1, offset: 12, format: 'float32x3' },
                    { shaderLocation: 2, offset: 24, format: 'float32' },
                ] }],
            },
            fragment: { module: ringShader, entryPoint: 'fs_main', targets: [{ format, blend: ADDITIVE_BLEND }] },
            primitive: { topology: 'line-strip' },
        });

        this.rings = rings.map((ring) => {
            const rgb = COLOR_RGB[ring.color];
            const verts = new Float32Array(ring.nodes.length * 7);
            ring.nodes.forEach((n, i) => verts.set([n.x, n.y, n.z, rgb[0], rgb[1], rgb[2], ring.speed], i * 7));
            return { buffer: this._createVertexBuffer(verts), count: ring.nodes.length };
        });
    }

    _createVertexBuffer(floatArray) {
        const buffer = this.device.createBuffer({
            size: floatArray.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(buffer.getMappedRange()).set(floatArray);
        buffer.unmap();
        return buffer;
    }

    render(timestamp, zScore) {
        zScore = zScore || 0;
        this.rotation += 0.004 + Math.abs(zScore) * 0.001;
        const w = this.canvas.width, h = this.canvas.height;
        if (!w || !h) return;
        const aspect = w / h;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([timestamp / 1000, zScore, this.rotation, aspect]));

        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.008, g: 0.024, b: 0.090, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        pass.setBindGroup(0, this.bindGroup);

        pass.setPipeline(this.ringPipeline);
        for (const ring of this.rings) {
            pass.setVertexBuffer(0, ring.buffer);
            pass.draw(ring.count);
        }

        pass.setPipeline(this.nodePipeline);
        pass.setVertexBuffer(0, this.quadBuffer);
        pass.setVertexBuffer(1, this.nodeBuffer);
        pass.draw(6, this.nodeCount);

        pass.end();
        this.device.queue.submit([encoder.finish()]);
    }

    onResize() {
        if (this.device && this.context) {
            this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });
        }
    }

    destroy() {
        this.device?.destroy?.();
    }
}

// ─── Facade: WebGPU-first, Canvas2D-fallback ───

export class BioReactorRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.backend = null;
        this.lastWebGPUError = null;
        this._impl = null;
    }

    async init() {
        const gpuImpl = new WebGPUReactor(this.canvas);
        try {
            await gpuImpl.init();
            this._impl = gpuImpl;
            this.backend = 'webgpu';
            return this.backend;
        } catch (err) {
            this.lastWebGPUError = String((err && err.message) || err);
        }
        this._impl = new Canvas2DReactor(this.canvas);
        this.backend = 'canvas2d';
        return this.backend;
    }

    render(timestamp, zScore) {
        this._impl?.render(timestamp, zScore);
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this._impl?.onResize(width, height);
    }

    destroy() {
        this._impl?.destroy();
    }
}
