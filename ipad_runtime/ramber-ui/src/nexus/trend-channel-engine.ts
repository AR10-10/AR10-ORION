// trend-channel-engine.ts — Auditoria do painel do gráfico: gap real e já
// documentado em rodadas anteriores ("canais de tendência" — pendente).
// Um analista profissional de futuros, ao abrir qualquer ativo/timeframe,
// desenha um canal de tendência sobre a estrutura recente — este motor é
// a versão determinística e honesta disso, nunca um desenho subjetivo.
//
// Pesquisa real antes de implementar (CLAUDE.md, "pesquise de verdade
// quando a tarefa toca um método com nome próprio"): "Linear Regression
// Channel" é uma ferramenta de análise técnica com definição PADRÃO e
// bem documentada (Babypips/Forexpedia, ThinkOrSwim RegressionChannel,
// Commodity.com) — não a alternativa mais subjetiva de conectar dois
// swing highs/lows escolhidos à mão (essa exigiria uma heurística de
// seleção de pivôs sem definição única, mais perto de "inventar uma
// variante própria" do que confirmar uma definição real). A definição:
// 1. Regressão linear (OLS) sobre os closes de uma janela recente de N
//    candles, eixo X = posição da barra (não o timestamp bruto — a
//    convenção padrão para candles igualmente espaçados).
// 2. Desvio padrão AMOSTRAL dos resíduos: sqrt(Σ(close-regressão)² / (n-1)).
// 3. Bandas superior/inferior = linha central ± k×desvio padrão, k=2 por
//    convenção da indústria (~95% de cobertura estatística real, nunca
//    uma probabilidade calibrada de acerto de mercado — Regra de Ouro 2).
//
// Fail-closed: histórico insuficiente (< MIN_CANDLES) ou todos os pontos
// no mesmo eixo X (variância zero, nunca deveria acontecer com candles
// reais) devolve null — nunca um canal fabricado sobre ruído. As linhas
// cobrem EXATAMENTE a janela analisada, nunca extrapoladas para o futuro:
// extrapolar uma regressão OLS além dos dados que a sustentam é prática
// estatística conhecida como não-confiável, e este repositório não fabrica
// certeza que os dados reais não sustentam.
export interface TrendChannelCandle {
  time: number; // Unix segundos real
  close: number;
}

export interface TrendChannelPoint {
  time: number;
  value: number;
}

export type TrendChannelDirection = "ASCENDING" | "DESCENDING" | "FLAT";

export interface TrendChannelReading {
  mid: TrendChannelPoint[];
  upper: TrendChannelPoint[];
  lower: TrendChannelPoint[];
  /** Inclinação real por barra (preço/candle) — positiva = ascendente. */
  slopePerBar: number;
  /** Desvio padrão amostral real dos resíduos da regressão. */
  stdDev: number;
  direction: TrendChannelDirection;
  windowSize: number;
}

// 50 candles: mesma ordem de grandeza do período EMA50 já exposto no
// painel Camadas do Gráfico (nexus/ema.ts, EMA_PERIODS) — não um número
// arbitrário novo, uma janela de "tendência recente" internamente
// consistente com o resto do sistema.
export const TREND_CHANNEL_DEFAULT_WINDOW = 50;
// k=2 desvios padrão: convenção padrão da indústria para o Linear
// Regression Channel (~95% de cobertura estatística real dos preços na
// amostra — nunca uma probabilidade calibrada de acerto futuro).
export const TREND_CHANNEL_STDDEV_MULTIPLIER = 2;
// Abaixo disto, uma "reta" conectando quase nada não é um canal real —
// fail-closed em vez de desenhar uma linha estatisticamente vazia.
const MIN_CANDLES = 10;
// Inclinação por barra menor que isto (fração do preço médio da janela)
// é tratada como FLAT — nunca um rótulo ASCENDING/DESCENDING fabricado
// sobre ruído de ponto flutuante em um mercado lateral real.
const FLAT_SLOPE_THRESHOLD_FRACTION = 0.0005;

/**
 * Linear Regression Channel real sobre os closes de uma janela recente.
 * Histórico insuficiente ou variância nula no eixo X => null, honesto.
 */
export function computeTrendChannel(
  candles: TrendChannelCandle[],
  windowSize: number = TREND_CHANNEL_DEFAULT_WINDOW,
): TrendChannelReading | null {
  if (!Number.isFinite(windowSize) || windowSize < MIN_CANDLES) return null;
  const valid = candles.filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close));
  if (valid.length < MIN_CANDLES) return null;

  const window = valid.slice(-Math.min(windowSize, valid.length));
  const n = window.length;

  const xMean = (n - 1) / 2; // eixo X = posição 0..n-1, média fechada
  const yMean = window.reduce((sum, c) => sum + c.close, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (window[i].close - yMean);
    den += dx * dx;
  }
  if (den === 0) return null; // fail-closed: variância zero no eixo X (não deveria ocorrer com candles reais)

  const slope = num / den;
  const intercept = yMean - slope * xMean;
  const regressionAt = (i: number) => intercept + slope * i;

  let sumSquaredResidual = 0;
  for (let i = 0; i < n; i++) {
    const residual = window[i].close - regressionAt(i);
    sumSquaredResidual += residual * residual;
  }
  const stdDev = n > 2 ? Math.sqrt(sumSquaredResidual / (n - 1)) : 0;
  const band = TREND_CHANNEL_STDDEV_MULTIPLIER * stdDev;

  const mid: TrendChannelPoint[] = [];
  const upper: TrendChannelPoint[] = [];
  const lower: TrendChannelPoint[] = [];
  for (let i = 0; i < n; i++) {
    const value = regressionAt(i);
    const time = window[i].time;
    mid.push({ time, value });
    upper.push({ time, value: value + band });
    lower.push({ time, value: value - band });
  }

  const flatThreshold = yMean !== 0 ? Math.abs(yMean) * FLAT_SLOPE_THRESHOLD_FRACTION : 0;
  const direction: TrendChannelDirection =
    Math.abs(slope) <= flatThreshold ? "FLAT" : slope > 0 ? "ASCENDING" : "DESCENDING";

  return { mid, upper, lower, slopePerBar: slope, stdDev, direction, windowSize: n };
}
