// shadow-calibration.ts — MODO SHADOW (§53 da §2 de "EVOLUÇÃO COMPLETA").
//
// ── O QUE SHADOW SIGNIFICA AQUI ────────────────────────────────────────
// Em produção de ML, "shadow mode" é rodar um modelo CANDIDATO ao lado do
// modelo em uso, sobre os mesmos dados reais, registrando as duas
// previsões — mas deixando só o modelo em uso decidir. Depois se compara.
//
// A tradução honesta para este projeto: a calibração de Platt
// (platt-calibration.ts) é REAJUSTADA continuamente conforme trades
// resolvem. Isso levanta uma pergunta que ninguém estava fazendo:
//
//     "reajustar está MELHORANDO a previsão, ou só perseguindo ruído?"
//
// É a pergunta da §55 (anti-overfitting) e a contraparte POR EVIDÊNCIA da
// §52: calibration-freshness.ts responde "a amostra está velha?" por uma
// regra auto-referente (heurística honesta, mas heurística); aqui se
// responde "o reajuste ajudou?" por MEDIÇÃO, sobre dados que nenhum dos
// dois ajustes viu.
//
// ── O DESENHO, E POR QUE ELE NÃO VAZA FUTURO ───────────────────────────
// Sobre a amostra real, em ordem cronológica (mesma ordem verificada e
// documentada em App.tsx para o walk-forward):
//
//   [0 .............................. N-E) [N-E ........ N)
//    └─ CONGELADA: treina só nos 30 mais antigos
//    └─────────── AO VIVO: treina em tudo antes da janela
//                                          └─ AVALIAÇÃO: nenhum dos dois viu
//
//   CONGELADA (incumbent) = ajuste sobre os primeiros
//     MIN_TRADES_FOR_VALID_EXPECTANCY trades — a menor amostra que este
//     repositório declara válida, deliberadamente parada no tempo.
//   AO VIVO (challenger)  = ajuste sobre TUDO que precede a janela de
//     avaliação — o ajuste mais fresco possível sem olhar o futuro.
//   Ambos são pontuados por Brier Score sobre a MESMA janela de avaliação,
//   que fica fora do treino dos dois. Zero look-ahead nos dois lados.
//
// O candidato nunca decide nada — nenhum consumidor lê daqui uma direção,
// um filtro ou uma probabilidade exibida. É exatamente o que faz disto
// shadow, e não uma troca de modelo pela porta dos fundos (LEI 24).
//
// ── ZERO LIMIAR INVENTADO ──────────────────────────────────────────────
// Os dois números que definem o desenho já existem ou se derivam dele:
//   - 30 para o treino congelado e 30 para a avaliação são o mesmo
//     MIN_TRADES_FOR_VALID_EXPECTANCY importado de expectancy.ts;
//   - o mínimo total é 2×30+1: o "+1" não é escolha estética, é a
//     condição para a comparação existir. Se o AO VIVO treinasse com os
//     mesmos 30 do CONGELADO, os dois ajustes seriam idênticos e a
//     pergunta seria vazia. Ele precisa de pelo menos um trade a mais.
//
// ── O QUE ISTO NÃO É ───────────────────────────────────────────────────
// Não é um teste de significância. A janela de avaliação tem 30 trades e
// TRACK_RECORD_HISTORY_CAP limita o histórico a 100 — a diferença entre
// dois Brier sobre 30 pontos carrega incerteza larga, e este módulo NUNCA
// a apresenta como prova. Ele reporta os dois números reais, o tamanho de
// cada treino e da avaliação, e um veredito que é literalmente "qual dos
// dois errou menos nesta janela". A leitura honesta é direcional, não
// conclusiva — por isso o relatório carrega os n em toda parte.
//
// LEI 24: diagnóstico. Zero direção, zero decisão.
import { MIN_TRADES_FOR_VALID_EXPECTANCY } from "./expectancy";
import { trainPlattScaling, applyPlattScaling, type PlattCalibrationSample } from "./platt-calibration";
import type { TradeCostResult } from "./trade-simulation";

/** Treino da versão CONGELADA e tamanho da janela de avaliação — o mesmo
 *  piso já declarado por expectancy.ts, nunca uma 2ª constante. */
export const SHADOW_FROZEN_TRAIN = MIN_TRADES_FOR_VALID_EXPECTANCY;
export const SHADOW_EVAL_WINDOW = MIN_TRADES_FOR_VALID_EXPECTANCY;
/** O "+1" é a condição de existência da comparação (ver header), não um
 *  número escolhido. */
export const MIN_SHADOW_SAMPLE = SHADOW_FROZEN_TRAIN + SHADOW_EVAL_WINDOW + 1;

export type ShadowVerdict = "REFIT_MELHOROU" | "REFIT_NAO_MELHOROU" | "DADOS_INSUFICIENTES";

export interface ShadowCalibrationReport {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  /** Trades com leitura de modelo real (mesma regra de usável do
   *  walk-forward e do Platt: modelAgreement ausente NUNCA vira 0). */
  usableTrades: number;
  /** Brier da versão CONGELADA sobre a janela de avaliação. Menor é melhor. */
  brierFrozen: number | null;
  /** Brier da versão AO VIVO sobre a MESMA janela. Menor é melhor. */
  brierLive: number | null;
  /** brierFrozen − brierLive. Positivo = o reajuste ajudou nesta janela. */
  brierDelta: number | null;
  frozenTrainSize: number;
  liveTrainSize: number;
  evalSize: number;
  verdict: ShadowVerdict;
}

const INSUFICIENTE = (usableTrades: number, reason: string): ShadowCalibrationReport => ({
  status: "DADOS_INSUFICIENTES",
  reason,
  usableTrades,
  brierFrozen: null,
  brierLive: null,
  brierDelta: null,
  frozenTrainSize: 0,
  liveTrainSize: 0,
  evalSize: 0,
  verdict: "DADOS_INSUFICIENTES",
});

type UsableTrade = TradeCostResult & { modelAgreement: number };

/** WIN = netR > 0 — a MESMA definição de expectancy.ts, platt-calibration.ts
 *  e walk-forward-calibration.ts. Zero segunda fonte do que conta como
 *  acerto. */
const toSample = (r: UsableTrade): PlattCalibrationSample => ({ score: r.modelAgreement, outcome: r.netR > 0 });

/** Brier Score (Brier 1950) das previsões de `params` sobre `evalSet`, ou
 *  null se alguma previsão não for finita — nunca um número parcial
 *  disfarçado de medição completa. */
function brierOver(evalSet: readonly UsableTrade[], params: { a: number; b: number }): number | null {
  let soma = 0;
  for (const t of evalSet) {
    const p = applyPlattScaling(t.modelAgreement, params);
    if (!Number.isFinite(p)) return null;
    soma += (p - (t.netR > 0 ? 1 : 0)) ** 2;
  }
  return evalSet.length > 0 ? soma / evalSet.length : null;
}

/**
 * Roda o candidato ao lado do incumbente sobre a amostra real já simulada
 * (trade-simulation.ts) e diz qual dos dois errou menos numa janela que
 * nenhum dos dois viu. Função pura.
 *
 * @param results ordem CRONOLÓGICA (mais antigo primeiro) — mesmo contrato
 *   do walk-forward, herdado de TrackRecordState.history ("newest last")
 *   preservado por simulateTradeCostsBatch.
 */
export function evaluateShadowCalibration(
  results: readonly TradeCostResult[] | null | undefined,
): ShadowCalibrationReport {
  const all = Array.isArray(results) ? results : [];
  const usable = all.filter(
    (r): r is UsableTrade =>
      r != null && typeof r.modelAgreement === "number" && Number.isFinite(r.modelAgreement) && Number.isFinite(r.netR),
  );

  if (usable.length < MIN_SHADOW_SAMPLE) {
    return INSUFICIENTE(
      usable.length,
      `Comparação de calibrações exige ${MIN_SHADOW_SAMPLE} trades resolvidos com leitura de modelo (${SHADOW_FROZEN_TRAIN} para a versão congelada + ao menos 1 a mais para a ao vivo + ${SHADOW_EVAL_WINDOW} de avaliação). Há ${usable.length}.`,
    );
  }

  const corte = usable.length - SHADOW_EVAL_WINDOW;
  const avaliacao = usable.slice(corte);
  const treinoAoVivo = usable.slice(0, corte);
  const treinoCongelado = usable.slice(0, SHADOW_FROZEN_TRAIN);

  // Invariante do desenho: se os dois treinos tivessem o mesmo tamanho, os
  // ajustes seriam idênticos e o veredito seria vazio. MIN_SHADOW_SAMPLE já
  // garante isso; a checagem fica porque uma mudança futura naquele mínimo
  // faria o módulo mentir em silêncio em vez de recusar.
  if (treinoAoVivo.length <= treinoCongelado.length) {
    return INSUFICIENTE(
      usable.length,
      "A versão ao vivo não tem nenhum trade a mais que a congelada — não há reajuste para comparar.",
    );
  }

  const paramsCongelado = trainPlattScaling(treinoCongelado.map(toSample));
  const paramsAoVivo = trainPlattScaling(treinoAoVivo.map(toSample));
  if (paramsCongelado === null || paramsAoVivo === null) {
    return INSUFICIENTE(usable.length, "Um dos ajustes de Platt não convergiu — nunca um veredito sobre ajuste ausente.");
  }

  const brierFrozen = brierOver(avaliacao, paramsCongelado);
  const brierLive = brierOver(avaliacao, paramsAoVivo);
  if (brierFrozen === null || brierLive === null) {
    return INSUFICIENTE(usable.length, "Previsão não-finita na janela de avaliação — nunca um Brier parcial.");
  }

  return {
    status: "OK",
    reason: null,
    usableTrades: usable.length,
    brierFrozen,
    brierLive,
    brierDelta: brierFrozen - brierLive,
    frozenTrainSize: treinoCongelado.length,
    liveTrainSize: treinoAoVivo.length,
    evalSize: avaliacao.length,
    // Empate conta como "não melhorou": reajustar tem custo real (o modelo
    // muda sob o Operador) e um empate não o justifica.
    verdict: brierLive < brierFrozen ? "REFIT_MELHOROU" : "REFIT_NAO_MELHOROU",
  };
}

/** Linha curta para a UI, com os n sempre visíveis — a leitura é
 *  direcional, nunca uma prova estatística (ver header). */
export function describeShadowCalibration(report: ShadowCalibrationReport): string {
  if (report.status !== "OK") return report.reason ?? "sem comparação de calibração";
  const sinal = report.verdict === "REFIT_MELHOROU" ? "reajuste ajudou" : "reajuste não ajudou";
  return `${sinal} · congelada ${report.brierFrozen!.toFixed(4)} (${report.frozenTrainSize}) vs ao vivo ${report.brierLive!.toFixed(4)} (${report.liveTrainSize}) em ${report.evalSize} retidos`;
}
