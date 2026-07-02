// llm-bridge.ts — RAMBER's connection to a LOCAL Llama 3 model
// (@mlc-ai/web-llm, real published package + real published model
// weights — mlc-ai/web-llm on npm, Llama-3-8B-Instruct-q4f32_1-MLC in
// WebLLM's own prebuilt catalog). Unlike the earlier ONNX request this
// session (declined — no trained model existed to run), a real model
// exists here and is downloadable; the constraints below exist because
// running an 8B-parameter model fully client-side, on an iPad, inside a
// browser tab, has real, current, well-documented limits that this file
// is built to respect rather than silently hit:
//
//   - The q4f32_1 quantized weights are several GB. This is NEVER
//     downloaded automatically on page load — only when the user
//     explicitly opts in (see ACTIVATE in the UI). The core terminal's
//     instant boot is completely unaffected unless a user deliberately
//     turns this on.
//   - WebGPU support on Safari/iPadOS is real but newer and less
//     battle-tested against WebLLM than Chrome's Dawn backend. This
//     module feature-detects `navigator.gpu` before ever attempting to
//     load anything, and fails closed with an honest message if it's
//     absent — it does not attempt and crash.
//   - iOS enforces a stricter per-tab memory ceiling than desktop
//     browsers. An 8B model can plausibly exceed it on some devices. This
//     is a real, disclosed risk (see the README note this ships with),
//     not something client-side code can fully rule out in advance — the
//     worker/engine's own errors are caught and surfaced honestly rather
//     than the tab being left to crash silently.
//
// The model never gets to invent market data: buildTacticalContext()
// below serializes ONLY real fields already computed by engine-bridge.ts
// (WASM engine signal, Lorentzian classification, SMC zones, order flow)
// into the prompt, and the system prompt explicitly forbids inventing
// price levels and forbids any language implying an order was or should
// be sent — this app has no execution path, and the model must never
// imply otherwise.
import {
  CreateWebWorkerMLCEngine,
  type MLCEngineInterface,
  type InitProgressReport,
} from '@mlc-ai/web-llm';

// Exactly the model requested — kept as a single named constant so it's
// trivially swappable for a lighter one (e.g. Llama-3.2-3B-Instruct-*,
// also in WebLLM's prebuilt catalog) without touching call sites.
export const LLM_MODEL_ID = 'Llama-3-8B-Instruct-q4f32_1-MLC';

export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export interface LlmLoadProgress {
  progress: number; // 0..1
  text: string;
}

export interface LlmEngineResult {
  ok: boolean;
  engine: MLCEngineInterface | null;
  reason: string | null;
}

// Both `engine` and `reason` are always present (one null) rather than a
// discriminated union keyed on `ok` — this project's tsconfig doesn't set
// strict/strictNullChecks, under which TS's control-flow narrowing on a
// boolean discriminant (`if (!result.ok)`) does not eliminate the other
// union member the way it would under strict mode (verified directly:
// the same pattern narrows correctly with --strict, not without it).
// Always-present fields sidestep that entirely, with no dependency on a
// stricter compiler config this codebase doesn't use.
export async function createLocalLlmEngine(
  onProgress: (report: LlmLoadProgress) => void,
): Promise<LlmEngineResult> {
  if (!isWebGpuSupported()) {
    return { ok: false, engine: null, reason: 'webgpu_indisponivel_neste_navegador' };
  }
  try {
    const worker = new Worker(new URL('./llm-worker.ts', import.meta.url), { type: 'module' });
    const engine = await CreateWebWorkerMLCEngine(worker, LLM_MODEL_ID, {
      initProgressCallback: (report: InitProgressReport) => {
        onProgress({ progress: report.progress, text: report.text });
      },
    });
    return { ok: true, engine, reason: null };
  } catch (err: any) {
    return { ok: false, engine: null, reason: `carregamento_do_modelo_falhou: ${err?.message || err}` };
  }
}

const SYSTEM_PROMPT = `Você é o "S.E." (Sistema Estratégico), o núcleo analítico do terminal RAMBER — um assistente de ANÁLISE de mercado, estritamente somente leitura (READ_ONLY). Você não tem e nunca terá acesso a execução de ordens, saldo ou conta real; nenhuma chave de API existe neste sistema.

Regras estritas, sem exceção:
1. Baseie-se ESTRITAMENTE nos dados reais fornecidos na mensagem do usuário. Nunca invente preço, nível, probabilidade ou dado que não esteja explicitamente ali.
2. Nunca use frases como "gatilho autorizado", "execute agora", "ordem enviada" ou qualquer linguagem que implique que uma ordem foi ou deveria ser disparada automaticamente. A decisão final é sempre de um humano, fora deste sistema.
3. Se os sinais fornecidos forem insuficientes, ausentes ou conflitantes entre si, diga isso explicitamente em vez de forçar uma conclusão confiante.
4. Sempre que mencionar o classificador k-NN Lorentziano, cite o tamanho da amostra fornecido — nunca implique mais confiança estatística do que uma amostra pequena sustenta.
5. Responda em português, em no máximo 4 frases curtas, tom técnico e direto.`;

export interface TacticalContextInput {
  wasmSignal: string | null;
  wasmConfidence: string | null;
  marketStructure: string | null;
  support: number | null;
  resistance: number | null;
  lorentzianClassification: string | null;
  lorentzianConfidencePct: number | null;
  lorentzianSampleSize: number | null;
  unmitigatedFvgCount: number;
  unmitigatedOrderBlockCount: number;
  unsweptLiquidityZoneCount: number;
  cvd: number | null;
  recentOrderflowSignalTypes: string[];
}

const DASH = 'AGUARDANDO';
const fmtNum = (v: number | null) => (v === null || !Number.isFinite(v) ? DASH : v.toFixed(2));

/** Serializa SOMENTE campos reais já computados em engine-bridge.ts/App.tsx
 *  para uma mensagem de contexto — nenhum valor é inventado aqui; campos
 *  ausentes viram AGUARDANDO, nunca um número fabricado. */
export function buildTacticalContext(input: TacticalContextInput): string {
  return `DADOS REAIS ATUAIS DO TERMINAL RAMBER:
- Motor WASM (estrutura de mercado real): sinal=${input.wasmSignal ?? DASH}, confiança=${input.wasmConfidence ?? DASH}, estrutura=${input.marketStructure ?? DASH}, suporte=${fmtNum(input.support)}, resistência=${fmtNum(input.resistance)}
- Classificador k-NN Lorentziano (sinal INDEPENDENTE, não é o motor WASM): classificação=${input.lorentzianClassification ?? DASH}, confiança=${input.lorentzianConfidencePct ?? DASH}%, amostra=${input.lorentzianSampleSize ?? DASH} pontos históricos
- SMC (Smart Money Concepts): ${input.unmitigatedOrderBlockCount} Order Block(s) não mitigado(s), ${input.unmitigatedFvgCount} Fair Value Gap(s) não mitigado(s), ${input.unsweptLiquidityZoneCount} zona(s) de liquidez (Equal High/Low) não varrida(s)
- Order Flow real (MEXC): CVD da sessão=${fmtNum(input.cvd)}, sinais recentes=${input.recentOrderflowSignalTypes.length ? input.recentOrderflowSignalTypes.join(', ') : 'nenhum'}

Gere uma leitura tática curta (máximo 4 frases) sintetizando estes sinais reais. Se o motor WASM e o classificador k-NN divergirem, mencione isso explicitamente.`;
}

export interface StreamResult {
  ok: boolean;
  text: string;
  reason: string | null;
}

export async function streamTacticalReading(
  engine: MLCEngineInterface,
  contextMessage: string,
  onChunk: (textSoFar: string) => void,
): Promise<StreamResult> {
  try {
    const stream = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contextMessage },
      ],
      stream: true,
      temperature: 0.4,
    });
    let text = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        text += delta;
        onChunk(text);
      }
    }
    return { ok: true, text, reason: null };
  } catch (err: any) {
    return { ok: false, text: '', reason: `inferencia_falhou: ${err?.message || err}` };
  }
}
