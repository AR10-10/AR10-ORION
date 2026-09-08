// drift-detector.ts — CONCEPT DRIFT (§29 da MASTER ORDER).
//
// ── A SEMENTE JÁ ESTAVA ÓRFÃ ───────────────────────────────────────────
// `evaluateSignalFilter` (expectancy.ts) já recorta os últimos
// RECENT_TRADES_WINDOW (20) trades e devolve `recentStats` — e a auditoria
// por AST (§6.115) o classificou em **C: produzido e PERDIDO**. Ninguém
// lia. O insumo do detector de drift estava construído e jogado fora.
//
// Este módulo não recomputa nada disso: pega a MESMA amostra já simulada e
// pergunta o que ninguém perguntava — *a janela recente ainda se parece
// com a linha de base?* (§68: comparar RECENT contra BASELINE).
//
// ── O CORTE: RECENTE vs BASE, E AS DUAS NÃO SE SOBREPÕEM ───────────────
// A base é tudo ANTES da janela recente. Isso importa: comparar os últimos
// 20 contra "todos os trades" incluiria os próprios 20 dentro da
// referência, diluindo exatamente o sinal que se procura. Aqui as duas
// partes são disjuntas por construção.
//
// ── A ESCALA É A VARIABILIDADE DA PRÓPRIA BASE ─────────────────────────
// Quanto uma diferença precisa ser para valer? Este projeto proíbe
// fabricar limiar, e não existe "ΔR grande" universal: 0.2R é ruído numa
// estratégia volátil e um terremoto numa estável.
//
// Então a régua é a própria base: `erro padrão = σ_base / √n_recente` — o
// desvio que se ESPERA numa média de n sorteios da distribuição da base.
// A leitura vira "a janela recente está a X erros padrão da base",
// adaptando-se sozinha à volatilidade real da estratégia. Quarta aplicação
// da mesma técnica auto-referente nesta sessão (calibration-freshness,
// independent-reference-price, mediana de volatilidade).
//
// ── AS BANDAS SÃO CONVENÇÃO DECLARADA, NÃO MEDIÇÃO ─────────────────────
// 1σ / 2σ / 3σ são as bandas estatísticas ORDINÁRIAS, e este módulo as usa
// como CONVENÇÃO EXPLÍCITA — exatamente como o repositório já faz com
// slippageRFraction, WALL_VOLUME_MULTIPLIER e PROXIMITY_FULL_PCT
// ("convenção documentada, nunca uma medição"). Não são limiares
// calibrados contra o desempenho deste sistema, e o módulo nunca afirma
// que sejam. Chamar 3σ de "drift confirmado" é uma NOMEAÇÃO de banda, não
// um teste de hipótese com p-valor — e a distinção está aqui de propósito.
//
// LEI 24: diagnóstico. Zero direção, zero decisão, nada suprime o Núcleo.
import { RECENT_TRADES_WINDOW, RECENT_TRADES_MIN_SAMPLE } from "./expectancy";
import type { TradeCostResult } from "./trade-simulation";

/** Bandas em erros padrão. Convenção declarada (ver cabeçalho) — as bandas
 *  estatísticas ordinárias, nunca calibradas contra este sistema. */
export const DRIFT_BAND_WATCH = 1;
export const DRIFT_BAND_POSSIBLE = 2;
export const DRIFT_BAND_CONFIRMED = 3;

export type DriftState =
  | "STABLE"
  | "WATCH"
  | "POSSIBLE_DRIFT"
  | "DRIFT_CONFIRMED"
  | "DEGRADED"
  | "RECOVERING"
  | "INSUFFICIENT_DATA";

export interface DriftReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  state: DriftState;
  /** Média real de netR na base (tudo ANTES da janela recente). */
  baselineMeanR: number | null;
  /** Média real de netR na janela recente. */
  recentMeanR: number | null;
  /** Quantos erros padrão a janela recente está da base. Sempre >= 0. */
  deviations: number | null;
  /** true quando a janela recente está PIOR que a base. */
  worse: boolean | null;
  baselineTrades: number;
  recentTrades: number;
}

const INSUFICIENTE = (reason: string, baselineTrades: number, recentTrades: number): DriftReading => ({
  status: "DADOS_INSUFICIENTES",
  reason,
  state: "INSUFFICIENT_DATA",
  baselineMeanR: null,
  recentMeanR: null,
  deviations: null,
  worse: null,
  baselineTrades,
  recentTrades,
});

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Desvio padrão AMOSTRAL (n-1): a base é uma amostra do comportamento da
 *  estratégia, não a população inteira dela. Com n<2 não existe dispersão
 *  medível — e ausência de dispersão nunca vira zero, que faria qualquer
 *  diferença parecer infinitamente significativa. */
function sampleStdev(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs);
  const varianca = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(varianca);
}

/**
 * Compara a janela recente contra a base disjunta. Função pura.
 *
 * @param results amostra JÁ simulada, em ordem CRONOLÓGICA (mais antigo
 *   primeiro) — mesmo contrato do walk-forward e do shadow.
 */
export function detectDrift(results: readonly TradeCostResult[] | null | undefined): DriftReading {
  const todos = (Array.isArray(results) ? results : []).filter(
    (r) => r && typeof r.netR === "number" && Number.isFinite(r.netR),
  );

  const recent = todos.slice(-RECENT_TRADES_WINDOW);
  // Base DISJUNTA: tudo que a janela recente não cobre.
  const baseline = todos.slice(0, Math.max(0, todos.length - recent.length));

  if (recent.length < RECENT_TRADES_MIN_SAMPLE) {
    return INSUFICIENTE(
      `Janela recente precisa de ${RECENT_TRADES_MIN_SAMPLE} trades resolvidos, há ${recent.length}.`,
      baseline.length,
      recent.length,
    );
  }
  if (baseline.length < RECENT_TRADES_MIN_SAMPLE) {
    return INSUFICIENTE(
      `Linha de base precisa de ${RECENT_TRADES_MIN_SAMPLE} trades ANTES da janela recente, há ${baseline.length}.`,
      baseline.length,
      recent.length,
    );
  }

  const baseR = baseline.map((r) => r.netR);
  const recentR = recent.map((r) => r.netR);
  const baselineMeanR = mean(baseR);
  const recentMeanR = mean(recentR);
  const sigma = sampleStdev(baseR);

  if (sigma === null || !(sigma > 0)) {
    // Base sem dispersão real: qualquer diferença dividiria por ~0 e
    // pareceria infinita. Recusa em vez de fabricar um número enorme.
    return INSUFICIENTE(
      "Linha de base sem dispersão medível — impossível dizer o que é ruído nela.",
      baseline.length,
      recent.length,
    );
  }

  const erroPadrao = sigma / Math.sqrt(recent.length);
  const deviations = Math.abs(recentMeanR - baselineMeanR) / erroPadrao;
  const worse = recentMeanR < baselineMeanR;

  let state: DriftState;
  if (deviations < DRIFT_BAND_WATCH) {
    state = "STABLE";
  } else if (!worse && deviations >= DRIFT_BAND_POSSIBLE) {
    // Mudou de verdade, mas a favor do Operador. §29 lista RECOVERING
    // separado justamente porque "mudou" não é sinônimo de "piorou".
    state = "RECOVERING";
  } else if (deviations < DRIFT_BAND_POSSIBLE) {
    state = "WATCH";
  } else if (deviations < DRIFT_BAND_CONFIRMED) {
    state = "POSSIBLE_DRIFT";
  } else {
    // DEGRADED é o subcaso honesto de DRIFT_CONFIRMED: não só mudou muito,
    // mudou para PERDER dinheiro. É uma distinção real, não um sinônimo.
    state = worse && recentMeanR < 0 ? "DEGRADED" : "DRIFT_CONFIRMED";
  }

  return {
    status: "OK",
    reason: null,
    state,
    baselineMeanR,
    recentMeanR,
    deviations,
    worse,
    baselineTrades: baseline.length,
    recentTrades: recent.length,
  };
}

const STATE_LABEL: Record<DriftState, string> = {
  STABLE: "ESTÁVEL",
  WATCH: "OBSERVANDO",
  POSSIBLE_DRIFT: "POSSÍVEL DRIFT",
  DRIFT_CONFIRMED: "DRIFT",
  DEGRADED: "DEGRADADO",
  RECOVERING: "RECUPERANDO",
  INSUFFICIENT_DATA: "SEM AMOSTRA",
};

/** Linha curta para a UI, com os n sempre junto do número. */
export function describeDrift(r: DriftReading): string {
  if (r.status !== "OK") return r.reason ?? "sem leitura de drift";
  const sinal = r.recentMeanR! >= 0 ? "+" : "";
  return `${STATE_LABEL[r.state]} · recente ${sinal}${r.recentMeanR!.toFixed(3)}R (${r.recentTrades}) vs base ${r.baselineMeanR! >= 0 ? "+" : ""}${r.baselineMeanR!.toFixed(3)}R (${r.baselineTrades}) · ${r.deviations!.toFixed(1)}σ`;
}
