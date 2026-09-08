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
 *  estatísticas ordinárias, nunca calibradas contra este sistema.
 *
 *  Preservadas (Regra de Ouro 4) mesmo depois de o limite de Hoeffding
 *  entrar: elas respondem uma pergunta que o bound NÃO responde. O bound
 *  é binário ("a diferença passa do que o acaso explica?"); as bandas dão
 *  a MAGNITUDE graduada (1σ/2σ/3σ), que é o que separa "começou a se
 *  mexer" de "mudou completamente". São complementares, não redundantes. */
export const DRIFT_BAND_WATCH = 1;
export const DRIFT_BAND_POSSIBLE = 2;
export const DRIFT_BAND_CONFIRMED = 3;

/** Probabilidade de FALSO POSITIVO admitida pelo teste de Hoeffding
 *  (§74-B / ADWIN, Bifet & Gavaldà 2007).
 *
 *  ── HONESTIDADE SOBRE "PARAMETER-FREE" ────────────────────────────────
 *  A literatura descreve ADWIN como parameter-free, e
 *  docs/PESQUISA_REFERENCIAS_EXTERNAS.md repetiu isso. É preciso
 *  qualificar: o que ADWIN elimina é o LIMIAR escolhido à mão — δ
 *  continua sendo uma escolha. O ganho é real e grande, mas é uma troca,
 *  não uma eliminação: δ tem SIGNIFICADO OPERACIONAL (a taxa de falso
 *  alarme que se aceita), enquanto "2σ" é só um número de desvios. Trocar
 *  uma convenção sem significado por um parâmetro com significado é a
 *  melhoria; dizer que a convenção sumiu seria falso.
 *
 *  0.05 é a convenção estatística ordinária de 5%. */
export const DRIFT_HOEFFDING_DELTA = 0.05;

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
  /** §74-B — LIMITE DE HOEFFDING (ADWIN, Bifet & Gavaldà 2007), em R.
   *
   *  O corte acima do qual a diferença entre as duas médias deixa de ser
   *  explicável pelo acaso, DERIVADO em vez de escolhido:
   *
   *      ε_cut = amplitude · √( ln(4/δ') / 2m )
   *
   *  com m = média harmônica dos dois tamanhos e δ' = δ/n (correção de
   *  Bonferroni pelos cortes possíveis) — exatamente a fórmula do artigo.
   *
   *  ── A CORREÇÃO QUE A FÓRMULA PUBLICADA ESCONDE ────────────────────
   *  A desigualdade de Hoeffding SÓ VALE para variável LIMITADA, e o
   *  ε_cut publicado assume valores em [0,1], onde a amplitude é 1 e
   *  some da fórmula. R-múltiplo NÃO é limitado em [0,1]: um trade pode
   *  render −1R ou +4R. Copiar o ε_cut literal aqui daria um corte
   *  calibrado para uma escala que não é esta — apertado demais, com
   *  falso alarme muito acima do δ prometido.
   *
   *  Por isso a `amplitude` volta explicitamente: é a amplitude REAL
   *  observada na base (max − min). Quinta aplicação da técnica
   *  auto-referente deste projeto — a régua sai dos próprios dados, e não
   *  de um número meu. */
  hoeffdingBound: number | null;
  /** |média recente − média base| > ε_cut? O veredito DERIVADO. null
   *  quando não pôde ser calculado — nunca `false` fabricado, que se
   *  leria como "testado e não há drift". */
  hoeffdingExceeded: boolean | null;
  /** Amplitude real da base (max − min), em R. É o que torna o bound
   *  válido para uma variável fora de [0,1] (ver `hoeffdingBound`). */
  baselineRange: number | null;
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
  hoeffdingBound: null,
  hoeffdingExceeded: null,
  baselineRange: null,
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
 * Limite de Hoeffding no formato do ADWIN (Bifet & Gavaldà 2007,
 * "Learning from Time-Changing Data with Adaptive Windowing"):
 *
 *     ε_cut = amplitude · √( ln(4/δ') / 2m ),  m = 1/(1/n₀ + 1/n₁),  δ' = δ/n
 *
 * `m` é a média harmônica dos dois tamanhos, e δ' aplica a correção de
 * Bonferroni sobre os n pontos de corte possíveis — as duas coisas vêm do
 * artigo, não são invenção daqui.
 *
 * `amplitude` é a adaptação declarada: o ε_cut publicado assume valores em
 * [0,1] (amplitude 1, que some da fórmula), e Hoeffding SÓ vale para
 * variável limitada. R-múltiplo não é limitado em [0,1], então a amplitude
 * real da amostra volta como fator — ver o comentário de `hoeffdingBound`.
 *
 * Devolve null quando qualquer insumo é degenerado, nunca um corte
 * fabricado (Regra de Ouro 3).
 */
function hoeffdingCut(n0: number, n1: number, amplitude: number, delta: number): number | null {
  if (!(n0 > 0) || !(n1 > 0) || !(amplitude > 0) || !(delta > 0) || !(delta < 1)) return null;
  const n = n0 + n1;
  const m = 1 / (1 / n0 + 1 / n1); // média harmônica, como no artigo
  const deltaLinha = delta / n; // Bonferroni sobre os cortes possíveis
  const cut = amplitude * Math.sqrt(Math.log(4 / deltaLinha) / (2 * m));
  return Number.isFinite(cut) && cut > 0 ? cut : null;
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

  // §74-B: o veredito DERIVADO, ao lado da magnitude convencional acima.
  // A amplitude sai da BASE (a distribuição de referência), não da janela
  // recente: é o comportamento conhecido que define a escala do que é
  // surpresa. Usar a amplitude da janela recente deixaria o próprio
  // evento sendo medido esticar a régua que deveria julgá-lo.
  const baselineRange = Math.max(...baseR) - Math.min(...baseR);
  const hoeffdingBound = hoeffdingCut(baseline.length, recent.length, baselineRange, DRIFT_HOEFFDING_DELTA);
  const hoeffdingExceeded =
    hoeffdingBound === null ? null : Math.abs(recentMeanR - baselineMeanR) > hoeffdingBound;

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
    hoeffdingBound,
    hoeffdingExceeded,
    baselineRange: Number.isFinite(baselineRange) && baselineRange > 0 ? baselineRange : null,
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
  // O veredito DERIVADO (Hoeffding) viaja junto da magnitude convencional
  // (σ). Quando os dois discordam, isso é informação real sobre o quanto a
  // leitura depende da convenção — e some se só um dos dois for exibido.
  const derivado =
    r.hoeffdingExceeded === null
      ? ""
      : ` · Hoeffding ${r.hoeffdingExceeded ? "passou" : "não passou"} (ε=${r.hoeffdingBound!.toFixed(3)}R)`;
  return `${STATE_LABEL[r.state]} · recente ${sinal}${r.recentMeanR!.toFixed(3)}R (${r.recentTrades}) vs base ${r.baselineMeanR! >= 0 ? "+" : ""}${r.baselineMeanR!.toFixed(3)}R (${r.baselineTrades}) · ${r.deviations!.toFixed(1)}σ${derivado}`;
}
