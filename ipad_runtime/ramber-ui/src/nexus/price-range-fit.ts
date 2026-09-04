// nexus/price-range-fit.ts — Evolução Final §5 ("Enquadramento Automático"):
// núcleo puro compartilhado do Smart Auto-Fit. Extraído de
// publication/mini-chart.ts (computeChartPriceRange) para que o gráfico AO
// VIVO (EnhancedChart_110_Percent.tsx, via autoscaleInfoProvider) e o
// mini-gráfico de EXPORTAÇÃO (publication/mini-chart.ts) usem a MESMA
// fórmula de "até onde esticar a escala de preço para caber Entry/Stop/
// Target" — zero segunda fórmula, só dois pontos de entrada (candles reais
// vs. autoscale nativo da lib) alimentando o mesmo núcleo.
export interface PriceRange {
  min: number;
  max: number;
}

export interface AutoFitLevels {
  entryLow: number | null;
  entryHigh: number | null;
  stopPrice: number | null;
  targetPrices: number[];
  livePrice: number | null;
}

export interface AutoFitOptions {
  // Alvo só estica a escala se a faixa resultante ficar dentro deste
  // múltiplo da amplitude "núcleo" (candles + Entry/Stop/preço vivo) —
  // achado real da verificação visual da Publication Studio (ver comentário
  // em mini-chart.ts): 4x deixa 3 alvos R:R igualmente espaçados (o caso
  // mais comum de um Trade Plan real) sempre visíveis, sem deixar um alvo
  // isolado e distante esmagar os candles recentes.
  targetCapMultiplier?: number;
  // 0 = nenhum padding extra aplicado aqui (uso pretendido: gráfico AO VIVO,
  // que já tem scaleMargins nativo da lightweight-charts cuidando do
  // respiro visual — aplicar os dois juntos dobraria o padding). > 0 = uso
  // pretendido: exportação estática (mini-chart.ts), que não tem nenhum
  // scaleMargins de biblioteca por trás.
  paddingRatio?: number;
}

const DEFAULT_TARGET_CAP_MULTIPLIER = 4;
const DEFAULT_PADDING_RATIO = 0;

export function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Recebe uma faixa "núcleo" já resolvida pelo chamador (candles reais no
 * caso da exportação; o autoscale nativo da lightweight-charts no caso do
 * gráfico ao vivo) e devolve a faixa esticada para caber Entry/Stop/preço
 * vivo sempre, e Target até o teto de `targetCapMultiplier`.
 */
export function computeAutoFitPriceRange(
  base: PriceRange,
  levels: AutoFitLevels,
  options: AutoFitOptions = {},
): PriceRange {
  let { min, max } = base;

  for (const v of [levels.entryLow, levels.entryHigh, levels.stopPrice, levels.livePrice]) {
    if (isFiniteNum(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const targetCapMultiplier = options.targetCapMultiplier ?? DEFAULT_TARGET_CAP_MULTIPLIER;
  const coreRange = max - min || Math.abs(max) * 0.01 || 1;
  const cap = coreRange * targetCapMultiplier;
  for (const t of levels.targetPrices) {
    if (!isFiniteNum(t)) continue;
    const candidateMin = Math.min(min, t);
    const candidateMax = Math.max(max, t);
    if (candidateMax - candidateMin <= cap) {
      min = candidateMin;
      max = candidateMax;
    }
  }

  const paddingRatio = options.paddingRatio ?? DEFAULT_PADDING_RATIO;
  if (paddingRatio > 0) {
    const pad = (max - min) * paddingRatio || Math.abs(max) * 0.01 || 1;
    min -= pad;
    max += pad;
  }

  return { min, max };
}
