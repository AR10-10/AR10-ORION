// expectancy.ts — Entrega 42 ("Profitability Engine", Parte 2): estatística
// real de expectativa sobre uma amostra de TradeCostResult (trade-
// simulation.ts) — nunca hitRate() sozinho (Regra de Ouro 2: confiança
// nunca é probabilidade; expectativa em R é a métrica honesta que hitRate
// sozinho esconde — 68% de acerto com R:R 1:0.4 ainda perde dinheiro).
//
// LEI 24 — exceção pontual autorizada (ver CLAUDE.md, seção "LEI 24"):
// evaluateSignalFilter() pode devolver show=false, e App.tsx usa esse
// veredito pra exibir NEUTRO em vez do LONG/SHORT real do Core Engine no
// badge principal quando a expectativa líquida histórica é negativa. Essa
// é uma mudança REAL e deliberada da hierarquia "Core Engine é o único
// emissor" — autorizada explicitamente pelo Operador (AskUserQuestion,
// nesta mesma rodada) só para este caso específico, nunca um precedente
// geral pra qualquer outra camada de confluência. O Core Engine em si
// nunca é mutado — a supressão acontece só na camada de apresentação
// (CoreSignalBadge computa o rótulo EFETIVO), mesmo padrão arquitetural
// já usado pelo Relevance Engine pra decidir visibilidade sem tocar o
// dado real por trás.
import type { TradeCostResult } from "./trade-simulation";

export const MIN_TRADES_FOR_VALID_EXPECTANCY = 30;
export const RECENT_TRADES_WINDOW = 20;
export const RECENT_TRADES_MIN_SAMPLE = 10; // metade da janela — nunca julga "recente" com amostra rasa demais

// Limiares declarados (mesmo espírito de LIQUIDITY_PROXIMITY_PCT em
// layer-relevance.ts) — convenção documentada, nunca uma medição
// estatística real (este projeto não tem capital real em jogo pra
// calibrar "drawdown aceitável").
export const EXPECTANCY_GREEN_MIN_R = 1.0;
export const EXPECTANCY_CYAN_MIN_R = 0.5;
export const WIN_RATE_RISK_THRESHOLD = 0.3;
export const MAX_DRAWDOWN_RISK_THRESHOLD_R = 5;

export interface ExpectancyStats {
  totalTrades: number;
  winRate: number;
  avgWinR: number;
  avgLossR: number; // sempre >= 0 (magnitude, não sinal)
  expectancyR: number; // (winRate × avgWinR) − ((1−winRate) × avgLossR)
  profitFactor: number | null; // null quando não há nenhuma perda real na amostra
  sharpeRatio: number | null; // null quando desvio padrão da amostra é 0
  maxDrawdownR: number; // pico a vale real da equity curve (soma cumulativa de netR)
  maxConsecutiveLosses: number;
  recoveryFactor: number | null; // null quando maxDrawdownR é 0
  commissionImpactR: number; // custo médio de comissão por trade, em R
  slippageImpactR: number; // custo médio de slippage por trade, em R
  fundingImpactR: number; // custo médio de funding por trade, em R
}

/** null só quando a amostra está vazia — SEM piso de 30 aqui (esse piso é
 *  responsabilidade de evaluateSignalFilter, que decide o que FAZER com
 *  uma amostra pequena; esta função sempre calcula o que a amostra real
 *  permite, honestamente, mesmo que seja só 1 trade). */
export function computeExpectancy(results: TradeCostResult[]): ExpectancyStats | null {
  if (results.length === 0) return null;

  const wins = results.filter((r) => r.netR > 0);
  const losses = results.filter((r) => r.netR <= 0);
  const winRate = wins.length / results.length;
  const avgWinR = wins.length > 0 ? wins.reduce((s, r) => s + r.netR, 0) / wins.length : 0;
  const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, r) => s + r.netR, 0) / losses.length) : 0;
  const expectancyR = winRate * avgWinR - (1 - winRate) * avgLossR;

  const grossProfit = wins.reduce((s, r) => s + r.netR, 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + r.netR, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

  const mean = results.reduce((s, r) => s + r.netR, 0) / results.length;
  const variance = results.reduce((s, r) => s + (r.netR - mean) ** 2, 0) / results.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? mean / stdDev : null;

  // Equity curve real: soma cumulativa de netR na ORDEM real de resolução
  // (results já chega em ordem cronológica — mesma disciplina de
  // signal-track-record.ts, history sempre "newest last").
  let equity = 0;
  let peak = 0;
  let maxDrawdownR = 0;
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  for (const r of results) {
    equity += r.netR;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
    if (r.netR <= 0) {
      consecutiveLosses += 1;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
    } else {
      consecutiveLosses = 0;
    }
  }
  const netProfitR = equity;
  const recoveryFactor = maxDrawdownR > 0 ? netProfitR / maxDrawdownR : null;

  const commissionImpactR = results.reduce((s, r) => s + r.commissionR, 0) / results.length;
  const slippageImpactR = results.reduce((s, r) => s + r.slippageR, 0) / results.length;
  const fundingImpactR = results.reduce((s, r) => s + r.fundingR, 0) / results.length;

  return {
    totalTrades: results.length,
    winRate,
    avgWinR,
    avgLossR,
    expectancyR,
    profitFactor,
    sharpeRatio,
    maxDrawdownR,
    maxConsecutiveLosses,
    recoveryFactor,
    commissionImpactR,
    slippageImpactR,
    fundingImpactR,
  };
}

export type ExpectancyBadge = "green" | "cyan" | "amber" | "red" | "neutral";

export interface FilterResult {
  // false = supressão real autorizada (LEI 24, ver header) — o chamador
  // mostra NEUTRO no lugar do LONG/SHORT real. true SEMPRE quando a
  // amostra é insuficiente (ausência de prova nunca é prova de
  // inviabilidade — fail-closed no sentido correto: nunca esconde um
  // sinal real por falta de dado, só por evidência real negativa).
  show: boolean;
  badge: ExpectancyBadge;
  label: string;
  stats: ExpectancyStats | null;
  recentStats: ExpectancyStats | null;
  warning: string | null;
}

const BADGE_LADDER: ExpectancyBadge[] = ["red", "amber", "cyan", "green"];
function downgradeOneLevel(b: ExpectancyBadge): ExpectancyBadge {
  const i = BADGE_LADDER.indexOf(b);
  return i <= 0 ? "red" : BADGE_LADDER[i - 1];
}

/** `results` já deve vir filtrado pelo chamador para o escopo desejado
 *  (ex.: só o ativo/timeframe atual, ou só um regime) — esta função nunca
 *  faz sua própria estratificação, mesmo espírito de composição pura já
 *  usado no resto de nexus/. */
export function evaluateSignalFilter(results: TradeCostResult[]): FilterResult {
  const stats = computeExpectancy(results);

  if (!stats || stats.totalTrades < MIN_TRADES_FOR_VALID_EXPECTANCY) {
    return {
      show: true,
      badge: "neutral",
      label: "DADOS INSUFICIENTES",
      stats,
      recentStats: null,
      warning: `Amostra real de ${stats?.totalTrades ?? 0} trades — mínimo ${MIN_TRADES_FOR_VALID_EXPECTANCY} para uma leitura de expectativa válida.`,
    };
  }

  let badge: ExpectancyBadge =
    stats.expectancyR > EXPECTANCY_GREEN_MIN_R
      ? "green"
      : stats.expectancyR >= EXPECTANCY_CYAN_MIN_R
        ? "cyan"
        : stats.expectancyR >= 0
          ? "amber"
          : "red";

  if (stats.winRate < WIN_RATE_RISK_THRESHOLD && badge !== "red") badge = downgradeOneLevel(badge);
  if (stats.maxDrawdownR > MAX_DRAWDOWN_RISK_THRESHOLD_R && badge !== "red") badge = downgradeOneLevel(badge);

  const recentSlice = results.slice(-RECENT_TRADES_WINDOW);
  const recentStats = recentSlice.length >= RECENT_TRADES_MIN_SAMPLE ? computeExpectancy(recentSlice) : null;
  let warning: string | null = null;
  if (recentStats) {
    const recentNetR = recentSlice.reduce((s, r) => s + r.netR, 0);
    if (recentNetR < 0) {
      badge = "red";
      warning = `Últimos ${recentSlice.length} trades reais: ${recentNetR >= 0 ? "+" : ""}${recentNetR.toFixed(2)}R — performance recente abaixo da média. CUIDADO.`;
    }
  }

  const label =
    badge === "green"
      ? "ALTA EXPECTATIVA"
      : badge === "cyan"
        ? "EXPECTATIVA MODERADA"
        : badge === "amber"
          ? "BAIXA EXPECTATIVA"
          : "EXPECTATIVA NEGATIVA";

  return { show: stats.expectancyR >= 0, badge, label, stats, recentStats, warning };
}
