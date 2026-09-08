// excursion-stats.ts — MASTER ORDER Phase D §6/§7: o que o CAMINHO do
// trade diz, e que o resultado final nunca dirá.
//
// ── POR QUE ISTO NÃO É "MAIS UMA MÉTRICA" ──────────────────────────────
// `netR` responde "quanto rendeu". Não responde as duas perguntas que
// mudam decisão de verdade:
//
//   1. "Quanto calor eu tive que aguentar?"  Dois planos +2R são coisas
//      diferentes se um nunca andou 0.1R contra e o outro chegou a −0.9R
//      antes de virar. O segundo é um plano que o Operador provavelmente
//      teria abandonado no meio — e o histórico, mostrando só +2R, diz
//      que foi tranquilo. MAE é a correção dessa mentira por omissão.
//
//   2. "O alvo estava no lugar errado, ou a leitura estava errada?"  Um
//      perdedor que chegou a 85% do caminho até o TP1 antes de reverter
//      não é o mesmo defeito que um perdedor que nunca saiu de 10%. O
//      primeiro é ALVO longe demais (estrutural, corrigível); o segundo é
//      LEITURA errada (direcional). Sem MFE de perdedor, os dois têm
//      exatamente a mesma aparência: "STOP_HIT, −1R".
//
// ── O QUE ESTE MÓDULO DELIBERADAMENTE NÃO CALCULA ──────────────────────
// MAE dos PERDEDORES. É degenerado por construção: um perdedor resolveu
// tocando o stop, então o MAE dele é ≈ −1R sempre. Reportá-lo daria a
// aparência de uma medição quando é só a definição de stop de volta. Fica
// registrado aqui para que uma sessão futura não o "adicione por
// simetria".
//
// ── SEM PISO DE AMOSTRA INVENTADO ──────────────────────────────────────
// Este módulo não tem um MIN_TRADES próprio. Estatística descritiva de
// histórico já resolvido não é a mesma afirmação que expectancy/Platt
// (que projetam), e inventar um 30 aqui seria um limiar sem origem real.
// Em vez disso vale o padrão de target-hit-rate.ts: o `n` viaja SEMPRE
// junto do número, na estrutura e na linha de UI, então uma mediana de 3
// vencedores se lê literalmente como "3 vencedores" — o leitor calibra
// sozinho, com o dado à vista, em vez de confiar num corte arbitrário.
//
// Regra de Ouro 2: isto é FREQUÊNCIA/EXTREMO OBSERVADO sobre histórico
// real, nunca uma previsão do próximo trade.
// Regra de Ouro 3: ausência de medição é null explícito, nunca 0 — um MAE
// 0 se leria como "nunca andou contra", que é a afirmação mais forte
// possível, e não como "não medido".
// LEI 24: leitura de histórico. Zero direção, zero decisão.
import type { TradeCostResult } from "./trade-simulation";
// Mediana = percentil 0.5 do MESMO módulo compartilhado que orderflow-history
// e volume-profile já usam. Achado real desta rodada (auditoria antes de
// construir): outcome-matrix.ts tinha escrito a SUA própria mediana, e ela
// violava o contrato declarado de percentile.ts ("valor SEMPRE um ponto real
// da própria amostra ordenada — nunca interpolado") ao tirar a média dos
// dois centrais numa amostra par, sintetizando um número que nunca foi
// observado. Escrever uma TERCEIRA aqui seria o mesmo padrão que
// price-clustering.js já teve de resolver depois de o algoritmo existir em
// três lugares. Consolidado: outcome-matrix.ts passou a usar esta função.
import { realPercentile } from "./percentile";

export interface ExcursionStats {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  /** Trades resolvidos na amostra (medidos ou não). */
  totalTrades: number;
  /** Destes, quantos têm excursão REALMENTE medida. Registros anteriores
   *  ao carimbo ficam de fora — nunca contados como excursão zero. */
  measuredTrades: number;
  /** Vencedores (netR > 0) com MAE medido. */
  winnerCount: number;
  /** Mediana do MAE dos vencedores, em R. Negativo = andou contra antes
   *  de funcionar. Este é o "calor típico". */
  winnerMaeMedianR: number | null;
  /** O PIOR MAE entre os vencedores. É o número que decide se um stop é
   *  sobrevivível na prática — a mediana esconde justamente o caso que
   *  teria tirado o Operador do trade. */
  winnerMaeWorstR: number | null;
  /** Perdedores (netR <= 0) com MFE medido E um TP1 real para comparar. */
  loserCount: number;
  /** Mediana de (MFE ÷ distância do TP1) entre os perdedores. ~0.85 diz
   *  "o alvo estava logo ali"; ~0.10 diz "a leitura estava errada". */
  loserMfeFractionMedian: number | null;
}

const VAZIO = (totalTrades: number, measuredTrades: number, reason: string): ExcursionStats => ({
  status: "DADOS_INSUFICIENTES",
  reason,
  totalTrades,
  measuredTrades,
  winnerCount: 0,
  winnerMaeMedianR: null,
  winnerMaeWorstR: null,
  loserCount: 0,
  loserMfeFractionMedian: null,
});

/** Mediana real da amostra, pelo contrato de percentile.ts (ponto real,
 *  nunca interpolado). Ordena uma CÓPIA — `sort` é destrutivo e a amostra
 *  chega por referência de outro memo. */
function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return realPercentile([...values].sort((a, b) => a - b), 0.5);
}

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Estatística de excursão sobre trades JÁ resolvidos e JÁ custeados
 * (saída de simulateTradeCostsBatch). Função pura.
 */
export function computeExcursionStats(
  sample: readonly TradeCostResult[] | null | undefined,
): ExcursionStats {
  const todos = Array.isArray(sample) ? sample : [];
  if (todos.length === 0) {
    return VAZIO(0, 0, "Nenhum trade resolvido ainda — sem caminho real para medir.");
  }

  // "Medido" = tem PELO MENOS uma das duas pontas. Um plano que resolveu
  // no primeiro tick tem MFE e MAE iguais ao próprio preço de resolução —
  // é uma medição real, ainda que curta.
  const medidos = todos.filter((r) => finite(r.observedMfeR) || finite(r.observedMaeR));
  if (medidos.length === 0) {
    return VAZIO(
      todos.length,
      0,
      `Nenhum dos ${todos.length} trades resolvidos tem excursão medida — todos são anteriores ao carimbo, e ausência nunca é lida como excursão zero.`,
    );
  }

  // Vencedor/perdedor pelo resultado LÍQUIDO (mesma definição de
  // expectancy.ts). A excursão em si é bruta: é um fato do caminho do
  // preço, não do custo — e misturar as duas coisas faria o MAE "piorar"
  // por causa de funding, o que seria falso.
  const maeVencedores = medidos
    .filter((r) => r.netR > 0)
    .map((r) => r.observedMaeR)
    .filter(finite);

  const fracoesPerdedores = medidos
    .filter((r) => r.netR <= 0)
    .map((r) => {
      const mfe = r.observedMfeR;
      const alvo = r.firstTargetR;
      // Só compara quando existe um TP1 real e ele fica de fato à frente
      // da entrada (alvo <= 0 seria um plano degenerado; dividir por ele
      // devolveria uma fração sem significado).
      if (!finite(mfe) || !finite(alvo) || !(alvo > 0)) return null;
      return mfe / alvo;
    })
    .filter(finite);

  return {
    status: "OK",
    reason: null,
    totalTrades: todos.length,
    measuredTrades: medidos.length,
    winnerCount: maeVencedores.length,
    winnerMaeMedianR: medianOf(maeVencedores),
    // O "pior" é o MENOR valor: o sinal já é negativo quando andou contra.
    winnerMaeWorstR: maeVencedores.length > 0 ? Math.min(...maeVencedores) : null,
    loserCount: fracoesPerdedores.length,
    loserMfeFractionMedian: medianOf(fracoesPerdedores),
  };
}

/** Linha curta para a UI. O `n` viaja sempre junto do número — é o que
 *  substitui um piso de amostra inventado (ver cabeçalho). */
export function describeExcursionStats(stats: ExcursionStats): string {
  if (stats.status !== "OK") return stats.reason ?? "sem caminho medido";
  const partes: string[] = [];
  if (stats.winnerMaeMedianR !== null) {
    partes.push(
      `calor típico ${stats.winnerMaeMedianR.toFixed(2)}R (pior ${stats.winnerMaeWorstR!.toFixed(2)}R) em ${stats.winnerCount} vencedor${stats.winnerCount === 1 ? "" : "es"}`,
    );
  }
  if (stats.loserMfeFractionMedian !== null) {
    partes.push(
      `perdedores chegaram a ${(stats.loserMfeFractionMedian * 100).toFixed(0)}% do TP1 em ${stats.loserCount} caso${stats.loserCount === 1 ? "" : "s"}`,
    );
  }
  if (partes.length === 0) {
    return `${stats.measuredTrades} trade(s) com caminho medido, nenhum ainda em condição de comparar`;
  }
  return partes.join(" · ");
}
