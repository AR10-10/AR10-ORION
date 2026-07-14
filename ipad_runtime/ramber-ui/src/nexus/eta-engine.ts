// eta-engine.ts — Diretriz Complementar (Nexus Predictive Engine) §3:
// "Tempo Estimado de Chegada" por alvo do Trade Plan, como ESTIMATIVA
// DINÂMICA recomputada a cada ciclo real — nunca fixa, nunca uma promessa.
//
// METODOLOGIA REAL (pesquisada antes de implementar, disciplina CLAUDE.md):
// não existe fórmula canônica de "ETA de preço" na literatura para
// reaproveitar (diferente de RSI/ADX/EMA). A composição honesta usa dois
// blocos REAIS e nomeados:
//   1. ATR (Average True Range, Wilder) — já medido pelo Market Regime
//     Engine (Fase D) como atrPercent; convertido aqui para preço absoluto.
//     É o alcance médio real de uma barra neste timeframe agora.
//   2. Efficiency Ratio de Kaufman (Perry Kaufman, KAMA) — fração do
//     movimento total que virou progresso líquido DIRECIONAL:
//     ER = (close_now − close_{n atrás}) / Σ|close_i − close_{i−1}|,
//     assinado aqui (o KAMA clássico usa |·| no numerador; o sinal importa
//     para ETA porque eficiência AFASTANDO-SE do alvo não é progresso).
//     Confirmado contra as definições publicadas (StrategyQuant/
//     TrendSpider): faixa |ER| ∈ [0,1], 1 = mercado perfeitamente
//     direcional, 0 = puro ruído sem progresso líquido.
//
// A estimativa por alvo: velocidade líquida esperada por barra =
// ATR_abs × ER_direcional (quanto do alcance médio vira progresso na
// direção do plano, à taxa REAL medida agora), e então
//   barras ≈ distância_real / velocidade_líquida
//   tempo  ≈ barras × duração_real_da_barra (timeframe ativo).
//
// HONESTIDADE (§8 da própria diretriz: "Nunca afirmar que o mercado 'vai'
// atingir determinado alvo"):
//   - ER direcional <= 0 (mercado parado ou afastando-se do alvo) => a
//     leitura existe mas a estimativa é NULL honesto — um número aqui
//     seria fabricado/infinito, nunca uma leitura.
//   - barras > MAX_ETA_BARS => null (além desse horizonte a extrapolação
//     linear de uma taxa instantânea não significa nada).
//   - Sem ATR real medido / closes insuficientes / sem plano =>
//     DADOS_INSUFICIENTES explícito.
//   - A diretriz §3 também lista "liquidez, força do fluxo, momentum,
//     regime" como insumos. NÃO foram dobrados na fórmula: não existe
//     composição validada desses fatores num tempo estimado sem backtest
//     real (mesma resolução honesta do "Probability Engine" → confluência).
//     Desvio documentado, não omissão silenciosa.
//
// LEI 24: display/contexto puro — nunca altera plano/engine/decisão.
// Função pura de (inputs, now) — zero I/O, zero relógio próprio.
import type { TradePlan } from "./trade-plan";

// Período padrão do próprio Kaufman (KAMA usa ER de 10 períodos).
export const EFFICIENCY_RATIO_PERIOD = 10;

// Horizonte honesto: acima disso a extrapolação linear de uma taxa
// instantânea deixa de significar qualquer coisa (parâmetro documentado,
// mesma natureza dos limiares 70/30 do RSI — não uma medição).
export const MAX_ETA_BARS = 500;

export interface TargetEta {
  targetIndex: number;
  bars: number; // barras estimadas até o alvo, à taxa real atual
  ms: number; // bars × duração real da barra (o tempo PROVÁVEL do modelo)
  // Diretriz Mestra §6 ("Tempo mínimo"): piso do PRÓPRIO modelo — barras
  // com ER=1 (mercado perfeitamente direcional: cada barra avança o ATR
  // inteiro na direção do alvo). É um limite matemático real do modelo,
  // não um segundo modelo. barsMin <= bars sempre (|ER| <= 1).
  // "Tempo máximo" NÃO existe honestamente neste modelo (ER→0 ⇒ ∞): a
  // faixa exibida é [mínimo, provável] — desvio documentado, nunca um
  // teto fabricado (mesma disciplina do cabeçalho sobre liquidez/momentum).
  barsMin: number;
  msMin: number;
  basis: string; // origem real verificável da estimativa
}

export interface EtaReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  // Alinhado 1:1 com plan.targets — null por alvo quando não estimável
  // (já atingido, sem progresso direcional, ou além do horizonte honesto).
  etas: (TargetEta | null)[];
  // ER assinado real usado (positivo = progresso líquido na direção do
  // plano) — exposto para a UI mostrar a base, nunca recalculado por ela.
  directionalEfficiency: number | null;
  atrAbsolute: number | null;
  computedAt: number;
}

function insufficient(reason: string, computedAt: number): EtaReading {
  return { status: "DADOS_INSUFICIENTES", reason, etas: [], directionalEfficiency: null, atrAbsolute: null, computedAt };
}

/** Efficiency Ratio de Kaufman, ASSINADO: (último close − close de
 *  `period` barras atrás) / Σ|Δclose|. null com histórico insuficiente;
 *  0 honesto num mercado exatamente parado (denominador 0). */
export function computeSignedEfficiencyRatio(closes: number[], period: number = EFFICIENCY_RATIO_PERIOD): number | null {
  if (!Number.isFinite(period) || period <= 0) return null;
  const valid = closes.filter((c) => Number.isFinite(c));
  if (valid.length < period + 1) return null;
  const window = valid.slice(valid.length - (period + 1));
  const net = window[window.length - 1] - window[0];
  let volatilitySum = 0;
  for (let i = 1; i < window.length; i++) volatilitySum += Math.abs(window[i] - window[i - 1]);
  if (volatilitySum === 0) return 0; // mercado exatamente parado — eficiência 0 real, não um erro
  return net / volatilitySum; // ∈ [-1, 1] por construção
}

export interface TargetEtaInputs {
  plan: TradePlan | null;
  targetsHit: number; // ratchet real do signal-track-record (0 sem progresso)
  livePrice: number | null;
  atrPercent: number | null; // Market Regime Engine (Fase D), já real
  closes: number[]; // closes reais do timeframe ativo do gráfico
  timeframeMs: number; // duração real de uma barra (TIMEFRAME_MS)
  now?: number;
}

/** ETA dinâmica por alvo restante do plano real. Fail-closed em toda
 *  parte — ver cabeçalho para cada regra de honestidade. */
export function computeTargetEtas(inputs: TargetEtaInputs): EtaReading {
  const computedAt = inputs.now ?? Date.now();
  const { plan, livePrice, atrPercent, timeframeMs } = inputs;
  if (!plan) return insufficient("sem_trade_plan_real_ativo", computedAt);
  if (!Number.isFinite(livePrice as number)) return insufficient("sem_preco_real", computedAt);
  if (!Number.isFinite(atrPercent as number) || (atrPercent as number) <= 0) {
    return insufficient("atr_real_ainda_nao_medido", computedAt);
  }
  if (!Number.isFinite(timeframeMs) || timeframeMs <= 0) {
    return insufficient("timeframe_real_indisponivel", computedAt);
  }
  const er = computeSignedEfficiencyRatio(inputs.closes);
  if (er === null) return insufficient("closes_insuficientes_para_efficiency_ratio", computedAt);

  const price = livePrice as number;
  const atrAbsolute = ((atrPercent as number) / 100) * price;
  const long = plan.direction === "LONG";
  // Eficiência NA DIREÇÃO do plano: ER assinado é positivo quando o preço
  // sobe; para um SHORT, progresso é o ER negativo.
  const directionalEfficiency = long ? er : -er;

  const targetsHit = Math.max(0, Math.min(inputs.targetsHit, plan.targets.length));
  const etas: (TargetEta | null)[] = plan.targets.map((target, i) => {
    if (i < targetsHit) return null; // alvo já provado — nada a estimar
    if (directionalEfficiency <= 0) return null; // sem progresso líquido real na direção — número aqui seria fabricado
    const distance = long ? target.price - price : price - target.price;
    if (!Number.isFinite(distance)) return null;
    if (distance <= 0) {
      // Preço já no/além do alvo neste tick (o ratchet do track record pode
      // ainda não ter registrado) — 0 barras é a leitura real, não um chute.
      return { targetIndex: i, bars: 0, ms: 0, barsMin: 0, msMin: 0, basis: "preço real já no alvo neste tick" };
    }
    const speedPerBar = atrAbsolute * directionalEfficiency;
    const bars = distance / speedPerBar;
    if (!Number.isFinite(bars) || bars > MAX_ETA_BARS) return null; // além do horizonte honesto
    const barsMin = distance / atrAbsolute; // piso do modelo: ER = 1 (ver TargetEta)
    return {
      targetIndex: i,
      bars,
      ms: bars * timeframeMs,
      barsMin,
      msMin: barsMin * timeframeMs,
      basis: `distância real ${distance.toFixed(2)} / (ATR ${atrAbsolute.toFixed(2)} × ER ${directionalEfficiency.toFixed(2)}) — estimativa dinâmica, nunca garantia; mínimo = mesmo modelo com ER=1`,
    };
  });

  return { status: "OK", reason: directionalEfficiency <= 0 ? "sem_progresso_direcional_real_na_janela" : null, etas, directionalEfficiency, atrAbsolute, computedAt };
}

/** Diretriz Mestra §6 ("TP1 → 12–20 min"): faixa [mínimo, provável] do
 *  MESMO modelo (ver TargetEta.barsMin). Colapsa para o formato simples
 *  quando os dois arredondam igual. null se o provável não é formatável. */
export function formatEtaRange(msMin: number | null, msLikely: number | null): string | null {
  const likely = formatEtaDuration(msLikely);
  if (likely === null) return null;
  const min = formatEtaDuration(msMin);
  if (min === null || min === likely) return likely;
  // "≈ 12m"/"≈ 20m" => "≈ 12–20m" (um único ≈, leitura de faixa)
  return `${min}–${likely.replace("≈ ", "")}`;
}

/** "≈ 35m" / "≈ 1h40" / "≈ 2d 4h" — o formato dos próprios exemplos da
 *  diretriz (§3). null/não-finito => null (o chamador mostra o DASH). */
export function formatEtaDuration(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null;
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return "<1m";
  if (totalMinutes < 60) return `≈ ${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return restMinutes === 0 ? `≈ ${totalHours}h` : `≈ ${totalHours}h${String(restMinutes).padStart(2, "0")}`;
  }
  const days = Math.floor(totalHours / 24);
  const restHours = totalHours % 24;
  return restHours === 0 ? `≈ ${days}d` : `≈ ${days}d ${restHours}h`;
}
