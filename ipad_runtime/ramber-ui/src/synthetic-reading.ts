// synthetic-reading.ts — deterministic, rule-based tactical reading.
//
// Companion to llm-bridge.ts's real Llama-3 reading, not a replacement:
// same input shape (TacticalContextInput), same real fields already
// computed elsewhere in engine-bridge.ts/App.tsx, zero fabrication. The
// difference is *how* the text is produced — pure if/else composition
// instead of a generative model — which means it needs no WebGPU, no
// multi-gigabyte download, and no activation step. It is always available,
// so NeuralCoreWidget always has a real reading to show even before the
// LLM is turned on, while it is loading, or if it errors out.
//
// This exists because @mlc-ai/web-llm's prebuilt catalog (checked directly
// against the installed 0.2.84 package: prebuiltAppConfig.model_list) tops
// out at Llama-3.1/3.2 — there is no Llama-4 entry to switch to. Llama 4
// (Scout/Maverick) ships as a mixture-of-experts family with well over
// 100B total parameters even in its smallest variant; no one has published
// an MLC/WebGPU-quantized build of it, and even if one existed it would
// not fit an iPad's per-tab memory ceiling. That is a real, current
// limitation of client-side browser inference, not a bug in this file —
// this synthetic engine is the honest answer to "what helps when the real
// model can't load."
import type { TacticalContextInput } from './llm-bridge';

const DASH = 'AGUARDANDO';
const SMALL_SAMPLE_THRESHOLD = 20;

/** Pure, deterministic — same input always yields the same output. Every
 *  sentence is gated on the real field(s) it describes being present;
 *  nothing here is invented when data is missing. */
export function buildSyntheticReading(input: TacticalContextInput): string {
  const lines: string[] = [];

  if (input.wasmSignal && input.lorentzianClassification) {
    const converge = input.wasmSignal === input.lorentzianClassification;
    lines.push(
      converge
        ? `Motor WASM e classificador k-NN convergem em ${input.wasmSignal}.`
        : `Divergência entre sinais: motor WASM aponta ${input.wasmSignal}, k-NN aponta ${input.lorentzianClassification}.`,
    );
  } else if (input.wasmSignal) {
    lines.push(
      `Motor WASM: ${input.wasmSignal}${input.wasmConfidence ? ` (confiança ${input.wasmConfidence})` : ''}. Classificador k-NN sem leitura no momento.`,
    );
  } else if (input.lorentzianClassification) {
    lines.push(`Classificador k-NN: ${input.lorentzianClassification}. Motor WASM sem leitura no momento.`);
  } else {
    lines.push('Nenhum classificador direcional com leitura disponível no momento.');
  }

  if (input.lorentzianClassification && input.lorentzianSampleSize !== null) {
    const small = input.lorentzianSampleSize < SMALL_SAMPLE_THRESHOLD;
    lines.push(
      `Confiança k-NN de ${input.lorentzianConfidencePct ?? DASH}% sobre amostra de ${input.lorentzianSampleSize} ponto(s)` +
        (small ? ' — amostra pequena, tratar com cautela estatística.' : '.'),
    );
  }

  if (input.cvd !== null && Number.isFinite(input.cvd)) {
    const bias = input.cvd > 0 ? 'compradora' : input.cvd < 0 ? 'vendedora' : 'neutra';
    lines.push(`CVD da sessão indica pressão ${bias} (${input.cvd.toFixed(2)}).`);
  }
  if (input.recentOrderflowSignalTypes.length > 0) {
    lines.push(`Sinais de order flow recentes: ${input.recentOrderflowSignalTypes.join(', ')}.`);
  }

  const zoneTotal =
    input.unmitigatedFvgCount + input.unmitigatedOrderBlockCount + input.unsweptLiquidityZoneCount;
  if (zoneTotal > 0) {
    lines.push(
      `Estrutura SMC não resolvida por perto: ${input.unmitigatedOrderBlockCount} Order Block, ` +
        `${input.unmitigatedFvgCount} FVG, ${input.unsweptLiquidityZoneCount} zona de liquidez.`,
    );
  }

  if (input.support !== null || input.resistance !== null) {
    lines.push(
      `Referências de estrutura: suporte ${input.support !== null ? input.support.toFixed(2) : DASH} · ` +
        `resistência ${input.resistance !== null ? input.resistance.toFixed(2) : DASH}.`,
    );
  }

  return lines.join(' ');
}
