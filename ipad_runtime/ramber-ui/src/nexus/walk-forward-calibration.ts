// walk-forward-calibration.ts — O TESTE FORA-DA-AMOSTRA DA PRÓPRIA
// PROBABILIDADE.
//
// PEDIDO DO OPERADOR (ordem "EVOLUÇÃO COMPLETA", §2): "concentre a evolução
// principalmente no núcleo central e na camada de inteligência... o sistema
// precisa ficar mais forte, mais preciso e mais sofisticado".
//
// ── O DEFEITO REAL, MEDIDO (Disciplina §1: auditar antes de construir) ──
// `calibrateConfidence()` (platt-calibration.ts) faz isto:
//
//     const samples = usable.map(...);          // TODOS os trades
//     const params  = trainPlattScaling(samples);
//     const p       = applyPlattScaling(rawScore, params);
//
// Ou seja: treina o Platt Scaling em TODOS os trades resolvidos e depois
// usa esse mesmo ajuste para produzir a probabilidade exibida. Isso é
// calibração IN-SAMPLE — o modelo é avaliado nos mesmos dados em que
// aprendeu. Um ajuste in-sample SEMPRE parece melhor do que é: no limite,
// um modelo que apenas memorizasse a amostra teria erro zero e valor
// preditivo zero. Nada no repositório media essa diferença.
//
// Isso não torna `calibrateConfidence()` errada — ela faz exatamente o que
// diz, e o número que ela produz continua sendo o melhor ajuste disponível
// sobre o histórico real. O que faltava era a pergunta seguinte, que é a
// que decide se aquele número vale alguma coisa: **quando o modelo previu
// sem ter visto o resultado, ele acertou melhor do que simplesmente
// repetir a taxa base?**
//
// ── O QUE ESTE MÓDULO FAZ ───────────────────────────────────────────────
// Walk-forward (origem móvel): percorre os trades em ordem cronológica,
// treina no que veio ANTES e prevê o próximo — nunca o contrário. Cada
// previsão é, por construção, fora-da-amostra: o resultado previsto não
// participou do treino que o previu. Zero look-ahead, pela mesma
// disciplina que o resto do projeto já aplica ao gráfico.
//
// Sobre esse conjunto retido, calcula métricas com nome próprio e
// definição pública confirmada (Disciplina §2), nunca uma métrica caseira:
//
//   • BRIER SCORE (Brier 1950) — erro quadrático médio de uma previsão
//     probabilística: BS = (1/N) Σ (p_i − o_i)², com o_i ∈ {0,1}.
//     Menor é melhor; 0 é perfeito.
//
//   • BRIER SKILL SCORE — BSS = 1 − BS / BS_ref, onde a referência é a
//     estratégia trivial de repetir a taxa base ("climatologia", na
//     literatura de verificação de previsão). BSS = 0 significa
//     literalmente "não é melhor do que repetir a taxa base"; BSS < 0,
//     "é PIOR que isso"; 1 é perfeito.
//
//     Identidade usada na referência: prevendo sempre a taxa base b sobre
//     a mesma amostra em que b é a média, BS_ref = b(1−b) exatamente.
//     Está derivada e travada em teste — não é uma aproximação.
//
//   • CURVA DE CONFIABILIDADE — das vezes em que o sistema disse "70%",
//     quantas de fato deram certo? É a pergunta que o Operador faria, e
//     nenhuma média global responde.
//
// ── POR QUE ISTO É A FUNDAÇÃO, E NÃO UM ENFEITE ─────────────────────────
// A Regra de Ouro 2 proíbe chamar confluência de probabilidade porque "este
// repositório não tem histórico de backtest real que sustente essa
// afirmação honestamente". Este módulo é o instrumento que, um dia, pode
// derrubar essa limitação — não por decreto, mas por medição: com BSS > 0
// fora-da-amostra sobre uma amostra real, a palavra "probabilidade" passa
// a ser defensável para AQUELE escopo. Com BSS ≤ 0, o sistema é obrigado a
// dizer isso em voz alta em vez de exibir um número bonito.
//
// FAIL-CLOSED, e o mais importante do módulo: com histórico curto ele
// devolve DADOS_INSUFICIENTES e NENHUMA métrica. Nunca um Brier calculado
// sobre 4 previsões — um número desses seria pior que a ausência dele,
// porque pareceria evidência.
//
// LEI 24: zero decisão de trading. Isto MEDE a qualidade de uma leitura
// que já existe; não emite direção, não bloqueia, não altera o Núcleo.
import { trainPlattScaling, type PlattCalibrationSample } from "./platt-calibration";
import { MIN_TRADES_FOR_VALID_EXPECTANCY } from "./expectancy";
import type { TradeCostResult } from "./trade-simulation";

/** Treino mínimo antes da PRIMEIRA previsão fora-da-amostra. Reusa o piso
 *  de significância que este projeto já declarou (`expectancy.ts`) — zero
 *  número novo inventado. */
export const MIN_WALK_FORWARD_TRAIN = MIN_TRADES_FOR_VALID_EXPECTANCY;

/** Previsões fora-da-amostra mínimas para o relatório reportar QUALQUER
 *  métrica. Mesmo piso, aplicado ao conjunto retido — pela mesma razão
 *  pela qual ele existe do outro lado: abaixo disso, Brier/BSS são ruído
 *  com aparência de evidência.
 *
 *  CONSEQUÊNCIA HONESTA, dita aqui em vez de escondida: são necessários
 *  MIN_WALK_FORWARD_TRAIN + MIN_WALK_FORWARD_PREDICTIONS = 60 trades
 *  resolvidos com leitura de modelo para este relatório existir. É muito
 *  mais do que o Track Record típico tem hoje, e é proposital: a resposta
 *  correta enquanto não houver essa amostra é "ainda não sei", nunca uma
 *  métrica frágil. */
export const MIN_WALK_FORWARD_PREDICTIONS = MIN_TRADES_FOR_VALID_EXPECTANCY;

/** Faixas da curva de confiabilidade. 5 faixas de 20pp — não 10 de 10pp:
 *  com o piso de 30 previsões, decis dariam ~3 amostras por faixa, e uma
 *  frequência observada sobre 3 amostras não é leitura, é ruído. */
export const RELIABILITY_BIN_COUNT = 5;

export interface ReliabilityBin {
  /** Limite inferior/superior da faixa, em probabilidade 0..1. */
  from: number;
  to: number;
  /** Previsões reais que caíram nesta faixa. 0 = faixa nunca usada. */
  count: number;
  /** Média das probabilidades previstas na faixa (o que o sistema DISSE). */
  meanPredicted: number | null;
  /** Fração real de acertos na faixa (o que ACONTECEU). */
  observedFrequency: number | null;
}

export type WalkForwardVerdict =
  /** BSS > 0: bate a taxa base fora-da-amostra. */
  | "MELHOR_QUE_A_TAXA_BASE"
  /** BSS <= 0: não bate. A leitura NÃO deve ser exibida como probabilidade. */
  | "SEM_VALOR_PREDITIVO_DEMONSTRADO";

export interface WalkForwardReport {
  status: "OK" | "DADOS_INSUFICIENTES";
  /** Sempre presente quando status != OK; null quando OK. */
  reason: string | null;
  /** Trades usáveis (com modelAgreement real) que entraram no walk-forward. */
  usableTrades: number;
  /** Previsões fora-da-amostra efetivamente feitas. */
  predictions: number;
  /** Brier Score fora-da-amostra. Menor é melhor. */
  brierScore: number | null;
  /** Taxa base real observada no conjunto retido. */
  baseRate: number | null;
  /** Brier da estratégia de referência (repetir a taxa base). */
  brierReference: number | null;
  /** 1 − BS/BS_ref. > 0 = melhor que a taxa base. */
  brierSkillScore: number | null;
  verdict: WalkForwardVerdict | null;
  reliability: ReliabilityBin[];
}

const INSUFFICIENT = (usableTrades: number, predictions: number, reason: string): WalkForwardReport => ({
  status: "DADOS_INSUFICIENTES",
  reason,
  usableTrades,
  predictions,
  brierScore: null,
  baseRate: null,
  brierReference: null,
  brierSkillScore: null,
  verdict: null,
  reliability: [],
});

function emptyBins(): ReliabilityBin[] {
  const bins: ReliabilityBin[] = [];
  for (let i = 0; i < RELIABILITY_BIN_COUNT; i++) {
    bins.push({
      from: i / RELIABILITY_BIN_COUNT,
      to: (i + 1) / RELIABILITY_BIN_COUNT,
      count: 0,
      meanPredicted: null,
      observedFrequency: null,
    });
  }
  return bins;
}

/**
 * Avalia, FORA DA AMOSTRA, se a probabilidade calibrada tem valor real.
 *
 * CONTRATO DE ORDEM — importante: `results` precisa vir em ordem
 * CRONOLÓGICA de resolução (mais antigo primeiro). `TradeCostResult` não
 * carrega timestamp, então a ordem é responsabilidade do chamador; o Track
 * Record (`signal-track-record.ts`) já acrescenta nessa ordem. Passar a
 * lista embaralhada não quebra a função, mas destrói o sentido do
 * walk-forward — vazaria futuro no treino, exatamente o que ele existe
 * para impedir.
 *
 * Função PURA e determinística.
 */
export function evaluateWalkForwardCalibration(
  results: readonly TradeCostResult[] | null | undefined,
): WalkForwardReport {
  const all = Array.isArray(results) ? results : [];
  // Mesma regra de amostra usável de platt-calibration.ts: sem
  // modelAgreement real não há score para calibrar, e ausência NUNCA vira
  // 0/neutro.
  const usable = all.filter(
    (r): r is TradeCostResult & { modelAgreement: number } =>
      r != null && typeof r.modelAgreement === "number" && Number.isFinite(r.modelAgreement) && Number.isFinite(r.netR),
  );

  const needed = MIN_WALK_FORWARD_TRAIN + MIN_WALK_FORWARD_PREDICTIONS;
  if (usable.length < needed) {
    return INSUFFICIENT(
      usable.length,
      0,
      `Validação fora-da-amostra exige ${needed} trades resolvidos com leitura de modelo (${MIN_WALK_FORWARD_TRAIN} para treinar + ${MIN_WALK_FORWARD_PREDICTIONS} para testar). Há ${usable.length}.`,
    );
  }

  // ── WALK-FORWARD (origem móvel) ────────────────────────────────────────
  // Para cada i >= MIN_WALK_FORWARD_TRAIN: treina em [0, i) e prevê i.
  // O resultado de i NUNCA entra no treino que o prevê — é o que torna
  // cada previsão genuinamente fora-da-amostra.
  const predicted: number[] = [];
  const observed: number[] = [];

  for (let i = MIN_WALK_FORWARD_TRAIN; i < usable.length; i++) {
    const train: PlattCalibrationSample[] = [];
    for (let j = 0; j < i; j++) {
      // WIN = netR > 0 — a MESMA definição de expectancy.ts e
      // platt-calibration.ts. Zero segunda fonte do que conta como acerto.
      train.push({ score: usable[j].modelAgreement, outcome: usable[j].netR > 0 });
    }
    const params = trainPlattScaling(train);
    if (params === null) continue; // ajuste não convergiu nesta janela — nunca um chute.

    const p = 1 / (1 + Math.exp(params.a * usable[i].modelAgreement + params.b));
    if (!Number.isFinite(p)) continue;

    predicted.push(p);
    observed.push(usable[i].netR > 0 ? 1 : 0);
  }

  if (predicted.length < MIN_WALK_FORWARD_PREDICTIONS) {
    return INSUFFICIENT(
      usable.length,
      predicted.length,
      `Apenas ${predicted.length} previsões fora-da-amostra convergiram — mínimo ${MIN_WALK_FORWARD_PREDICTIONS}.`,
    );
  }

  const n = predicted.length;

  // BRIER SCORE: erro quadrático médio da previsão probabilística.
  let sq = 0;
  for (let i = 0; i < n; i++) sq += (predicted[i] - observed[i]) ** 2;
  const brierScore = sq / n;

  // REFERÊNCIA ("climatologia"): repetir a taxa base observada.
  const baseRate = observed.reduce((a, b) => a + b, 0) / n;
  // Identidade exata quando a referência é a média da própria amostra:
  //   BS_ref = b(1−b)²+(1−b)b² = b(1−b)[(1−b)+b] = b(1−b).
  const brierReference = baseRate * (1 - baseRate);

  // BSS = 1 − BS/BS_ref. Com taxa base 0 ou 1 (todos os trades no mesmo
  // lado), BS_ref = 0 e a razão é indefinida: a referência trivial já é
  // perfeita, então NÃO existe habilidade a demonstrar. Fail-closed —
  // nunca um Infinity/NaN disfarçado de skill.
  if (brierReference === 0) {
    return INSUFFICIENT(
      usable.length,
      n,
      "Todos os trades da janela retida tiveram o mesmo desfecho — repetir a taxa base já acerta tudo, não há habilidade preditiva a medir.",
    );
  }
  const brierSkillScore = 1 - brierScore / brierReference;

  // CURVA DE CONFIABILIDADE.
  const reliability = emptyBins();
  const sums = new Array<number>(RELIABILITY_BIN_COUNT).fill(0);
  const hits = new Array<number>(RELIABILITY_BIN_COUNT).fill(0);
  for (let i = 0; i < n; i++) {
    // p = 1.0 exato pertence à última faixa, nunca a uma sexta inexistente.
    const idx = Math.min(RELIABILITY_BIN_COUNT - 1, Math.floor(predicted[i] * RELIABILITY_BIN_COUNT));
    reliability[idx].count++;
    sums[idx] += predicted[i];
    hits[idx] += observed[i];
  }
  for (let i = 0; i < RELIABILITY_BIN_COUNT; i++) {
    if (reliability[i].count === 0) continue;
    reliability[i].meanPredicted = sums[i] / reliability[i].count;
    reliability[i].observedFrequency = hits[i] / reliability[i].count;
  }

  return {
    status: "OK",
    reason: null,
    usableTrades: usable.length,
    predictions: n,
    brierScore,
    baseRate,
    brierReference,
    brierSkillScore,
    // O limiar é 0 por DEFINIÇÃO da métrica (BSS = 0 é exatamente a
    // referência trivial), nunca um corte escolhido por conveniência.
    verdict: brierSkillScore > 0 ? "MELHOR_QUE_A_TAXA_BASE" : "SEM_VALOR_PREDITIVO_DEMONSTRADO",
    reliability,
  };
}
