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
// (Core Engine trend-bias heuristic signal, Lorentzian classification, SMC
// zones, order flow) into the prompt, and the system prompt explicitly
// forbids inventing price levels and forbids any language implying an
// order was or should be sent — this app has no execution path, and the
// model must never imply otherwise.
//
// Auditoria Mestra 360° (secao 3): o campo abaixo chamava-se wasmSignal,
// mas o LONG/SHORT/WAIT exibido NAO vem do WASM — vem de uma heuristica
// SMA/EMA em JS puro (research-engine.js:trendBias -> trade-setup-
// matrix.js). O WASM (cyborg_quant_core.wasm) so' calcula SMA/EMA/stddev/
// zscore em analysis-frame.js, nunca o proprio sinal direcional. Renomeado
// para heuristicSignal/heuristicConfidence para refletir a origem real.
import {
  CreateWebWorkerMLCEngine,
  type MLCEngineInterface,
  type InitProgressReport,
} from '@mlc-ai/web-llm';

// V11.5 Fase 7 (AI Orchestration): 3 níveis reais da família Llama, do
// maior/melhor para o menor/mais leve — todos confirmados existentes no
// catálogo prebuilt da versão instalada (verificado diretamente contra
// node_modules/@mlc-ai/web-llm@0.2.84/lib/index.js, o mesmo método já usado
// por synthetic-reading.ts para descartar Llama 4). O disclaimer no topo
// deste arquivo já documentava o risco real de um modelo de 8B exceder o
// teto de memória por aba do iOS; antes disso, a ÚNICA opção quando isso
// acontecia era "tentar de novo" o mesmo modelo que acabou de provar não
// caber. Agora a orquestração cai automaticamente para o próximo nível mais
// leve — nunca fabrica sucesso, nunca trava esperando o modelo errado.
export const LLM_MODEL_TIERS = [
  'Llama-3-8B-Instruct-q4f32_1-MLC',
  'Llama-3.2-3B-Instruct-q4f32_1-MLC',
  'Llama-3.2-1B-Instruct-q4f32_1-MLC',
] as const;

export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export interface LlmLoadProgress {
  progress: number; // 0..1
  text: string;
  modelId: string;
  tier: number; // 1-based, posição em LLM_MODEL_TIERS
  tierCount: number;
}

export interface LlmEngineResult {
  ok: boolean;
  engine: MLCEngineInterface | null;
  // Auditoria Mestra 360° (secao 6, "vazamento de memória em IA local"): o
  // Worker cru precisa ser exposto para quem chama poder terminate() nele
  // (unload() do MLCEngineInterface libera o modelo/pesos, mas não é
  // documentado como encerrando a própria thread do Worker) — sem isso,
  // reativações repetidas do Núcleo Neural acumulavam workers nunca
  // finalizados.
  worker: Worker | null;
  modelId: string | null;
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
    return { ok: false, engine: null, worker: null, modelId: null, reason: 'webgpu_indisponivel_neste_navegador' };
  }
  const failures: string[] = [];
  for (let i = 0; i < LLM_MODEL_TIERS.length; i++) {
    const modelId = LLM_MODEL_TIERS[i];
    // Auditoria Mestra 360° (secao 6): declarado fora do try para o catch
    // conseguir terminate() o worker desta tentativa se ela falhar — antes,
    // um worker criado para um nível que falhasse nunca era finalizado, e a
    // orquestração seguia para o próximo nível deixando-o para trás vivo.
    let worker: Worker | undefined;
    try {
      worker = new Worker(new URL('./llm-worker.ts', import.meta.url), { type: 'module' });
      const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
        initProgressCallback: (report: InitProgressReport) => {
          onProgress({ progress: report.progress, text: report.text, modelId, tier: i + 1, tierCount: LLM_MODEL_TIERS.length });
        },
      });
      return { ok: true, engine, worker, modelId, reason: null };
    } catch (err: any) {
      worker?.terminate();
      failures.push(`${modelId}: ${err?.message || err}`);
      // Continua para o próximo nível, mais leve — uma falha (ex.: OOM,
      // rede) neste nível não impede o próximo de funcionar.
    }
  }
  return {
    ok: false,
    engine: null,
    worker: null,
    modelId: null,
    reason: `todos_os_${LLM_MODEL_TIERS.length}_niveis_falharam: ${failures.join(' | ')}`,
  };
}

const SYSTEM_PROMPT = `Você é o "S.E." (Sistema Estratégico), o núcleo analítico do terminal RAMBER — um assistente de ANÁLISE de mercado, estritamente somente leitura (READ_ONLY). Você não tem e nunca terá acesso a execução de ordens, saldo ou conta real; nenhuma chave de API existe neste sistema.

Regras estritas, sem exceção:
1. Baseie-se ESTRITAMENTE nos dados reais fornecidos na mensagem do usuário. Nunca invente preço, nível, probabilidade ou dado que não esteja explicitamente ali.
2. Nunca use frases como "gatilho autorizado", "execute agora", "ordem enviada" ou qualquer linguagem que implique que uma ordem foi ou deveria ser disparada automaticamente. A decisão final é sempre de um humano, fora deste sistema.
3. Se os sinais fornecidos forem insuficientes, ausentes ou conflitantes entre si, diga isso explicitamente em vez de forçar uma conclusão confiante.
4. Sempre que mencionar o classificador k-NN Lorentziano, cite o tamanho da amostra fornecido — nunca implique mais confiança estatística do que uma amostra pequena sustenta.
5. Responda em português, em no máximo 4 frases curtas, tom técnico e direto.`;

export interface TacticalContextInput {
  heuristicSignal: string | null;
  heuristicConfidence: string | null;
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
- Heurística de Tendência (Core Engine, estrutura de mercado real): sinal=${input.heuristicSignal ?? DASH}, confiança=${input.heuristicConfidence ?? DASH}, estrutura=${input.marketStructure ?? DASH}, suporte=${fmtNum(input.support)}, resistência=${fmtNum(input.resistance)}
- Classificador k-NN Lorentziano (sinal INDEPENDENTE, não é a Heurística de Tendência): classificação=${input.lorentzianClassification ?? DASH}, confiança=${input.lorentzianConfidencePct ?? DASH}%, amostra=${input.lorentzianSampleSize ?? DASH} pontos históricos
- SMC (Smart Money Concepts): ${input.unmitigatedOrderBlockCount} Order Block(s) não mitigado(s), ${input.unmitigatedFvgCount} Fair Value Gap(s) não mitigado(s), ${input.unsweptLiquidityZoneCount} zona(s) de liquidez (Equal High/Low) não varrida(s)
- Order Flow real (MEXC): CVD da sessão=${fmtNum(input.cvd)}, sinais recentes=${input.recentOrderflowSignalTypes.length ? input.recentOrderflowSignalTypes.join(', ') : 'nenhum'}

Gere uma leitura tática curta (máximo 4 frases) sintetizando estes sinais reais. Se a Heurística de Tendência e o classificador k-NN divergirem, mencione isso explicitamente.`;
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
