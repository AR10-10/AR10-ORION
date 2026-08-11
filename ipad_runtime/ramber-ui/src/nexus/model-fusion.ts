// model-fusion.ts — Escopo Cirúrgico (Operador, Fase 2, confirmada via
// AskUserQuestion após reenvio do documento): fusão de sinal entre os
// motores nomeados no documento do Operador (SMC, Order Flow, Regime) —
// reusa os agentes REAIS já testados do Council (liquidityAgentVote/
// manipulationAgentVote/orderflowAgentVote) em vez de reimplementar a
// mesma agregação.
//
// Correção de nomenclatura sobre o documento do Operador: ele chama isso
// de "Fusão Bayesiana" e a saída de "probability"/"posterior" — mas a
// fórmula proposta (soma ponderada de confidence, dividida pela soma dos
// pesos) não faz atualização Bayesiana real (sem prior, sem razão de
// verossimilhança): é matematicamente um POOL LINEAR DE OPINIÃO (Stone
// 1961/DeGroot 1974), a MESMA metodologia que council.ts já usa (ver
// header daquele arquivo) — generalizada aqui pelos MOTORES nomeados em
// vez dos 7 agentes fixos do Conselho. Renomeado honestamente pela mesma
// razão que "Corredor de Probabilidade" virou "Corredor de Confluência"
// (Fusion §5, confluence-corridor.ts) — Regra de Ouro 2: confiança nunca
// é probabilidade calibrada de acerto de mercado sem backtest real que
// sustente essa afirmação.
//
// Cobertura real (auditoria antes de codar — Agent report, ver PR): dos 5
// modelos do documento (SMC, Order Flow, Volume, Regime, Microstructure),
// só 3 têm hoje {direção, confiança} real ou honestamente convertível:
// - SMC: liquidityAgentVote/manipulationAgentVote (council.ts) já
//   agregam zonas de liquidez reais em direção+confiança — reusados aqui,
//   zero segunda implementação da mesma matemática.
// - Order Flow: orderflowAgentVote (council.ts) já agrega CVD+OFI em
//   direção+confiança real — reusado aqui.
// - Regime: direção real (classifyMarketRegime), mas confiança NÃO existe
//   graduada em lugar nenhum — conversão nova e documentada abaixo
//   (adx/100, clamped), nunca fabricada como se já fosse uma medição.
// Volume (Profile/TPO) fica de fora: geometria pura (POC/Value Area/
// histograma), zero opinião direcional própria em qualquer lugar do
// repositório (confirmado por auditoria) — incluir seria inventar uma
// leitura nova, não reaproveitar uma real. Mesmo critério já usado para
// cortar sweepDirection/volumeProfileShape em scenario-fingerprint.ts.
// "Microstructure" fica de fora: não é um 5º modelo real — é o próprio
// Order Flow Engine se autodescrevendo ("Sinais de microestrutura...",
// orderflow/signal-engine.js) — incluí-lo separado duplicaria a mesma
// fonte sob dois nomes.
//
// Pesos: o documento pede "pesos dinâmicos por performance real (win
// rate recente por modelo)". Não existe HOJE nenhum registro de acerto/
// erro POR MOTOR individual em lugar nenhum do repositório — só agregado,
// por symbol:timeframe (signal-track-record.ts) e por scenario-fingerprint
// (scenario-fingerprint.ts), nunca por modelo isolado. Construir pesos
// "dinâmicos" agora fabricaria uma amostra que não existe (violaria
// Regra de Ouro 1). Pesos aqui são FIXOS, iguais, e documentados como
// julgamento de engenharia — mesmo precedente já usado por
// market-regime/weight-matrix.js::REGIME_WEIGHT_MATRIX ("NÃO são
// aprendidos... esta base não tem backtest/histórico rotulado"). Pesos
// dinâmicos por performance real ficam como pendência documentada: nascem
// quando existir uma amostra real de acerto por modelo para sustentá-los
// — não antes.
import type { CouncilStance, CouncilLiquidityZone, CouncilOrderflowSignal } from "./council";
import { liquidityAgentVote, manipulationAgentVote, orderflowAgentVote } from "./council";

export type ModelId = "SMC_LIQUIDITY" | "SMC_MANIPULATION" | "ORDERFLOW" | "REGIME";

export interface ModelVote {
  model: ModelId;
  stance: CouncilStance;
  // 0..1 real, mesma honestidade de CouncilVote.confidence — força do
  // desequilíbrio do PRÓPRIO dado do modelo, nunca probabilidade de
  // acerto. null só quando ABSTAIN (sem dado real para este modelo).
  confidence: number | null;
}

// Pesos iguais e documentados (ver header) — nenhum modelo tem hoje
// evidência real de ser mais confiável que outro.
export const MODEL_FUSION_WEIGHTS: Record<ModelId, number> = {
  SMC_LIQUIDITY: 1,
  SMC_MANIPULATION: 1,
  ORDERFLOW: 1,
  REGIME: 1,
};

function toModelVote(model: ModelId, vote: { stance: CouncilStance; confidence: number | null }): ModelVote {
  return { model, stance: vote.stance, confidence: vote.confidence };
}

/** Reusa liquidityAgentVote (council.ts) — zero segunda implementação. */
export function smcLiquidityModelVote(zones: CouncilLiquidityZone[], price: number | null): ModelVote {
  return toModelVote("SMC_LIQUIDITY", liquidityAgentVote(zones, price));
}

/** Reusa manipulationAgentVote (council.ts) — zero segunda implementação. */
export function smcManipulationModelVote(zones: CouncilLiquidityZone[]): ModelVote {
  return toModelVote("SMC_MANIPULATION", manipulationAgentVote(zones));
}

/** Reusa orderflowAgentVote (council.ts) — zero segunda implementação. */
export function orderflowModelVote(cvd: number | null, signals: CouncilOrderflowSignal[]): ModelVote {
  return toModelVote("ORDERFLOW", orderflowAgentVote(cvd, signals));
}

// ADX é 0-100 (Wilder) — conversão declarada pra escala 0-1, mesmo
// espírito de REGIME_WEIGHT_MATRIX (weight-matrix.js): julgamento de
// engenharia documentado, nunca uma calibração estatística real.
export const REGIME_CONFIDENCE_ADX_SCALE = 100;

/** direction/adx vêm de classifyMarketRegime (regime-engine.js) —
 *  passthrough literal, zero segunda classificação. ABSTAIN honesto
 *  quando falta qualquer um dos dois (nunca um voto fabricado). */
export function regimeModelVote(direction: "ALTA" | "BAIXA" | null, adx: number | null): ModelVote {
  if (direction === null || adx === null || !Number.isFinite(adx)) {
    return { model: "REGIME", stance: "ABSTAIN", confidence: null };
  }
  const confidence = Math.max(0, Math.min(1, adx / REGIME_CONFIDENCE_ADX_SCALE));
  return { model: "REGIME", stance: direction === "ALTA" ? "LONG" : "SHORT", confidence };
}

export interface FusedReading {
  stance: "LONG" | "SHORT" | "NEUTRAL";
  // Pool linear ponderado das confidences reais (Stone/DeGroot) — NUNCA
  // probabilidade de acerto de mercado (Regra de Ouro 2).
  fusedConfidence: number;
  // fusedConfidence descontada pelo desacordo real entre modelos — mesma
  // convenção declarada do documento original, honesta aqui porque é só
  // uma combinação de números já reais, não uma nova medição.
  effectiveConfidence: number;
  // 0 = todos os votos direcionais reais concordam; 1 = divididos ao
  // meio. Mesma fórmula de imbalanceConfidence (council.ts), invertida.
  disagreement: number;
  // Todos os votos reais recebidos, incluindo ABSTAIN — transparência
  // total (mesmo padrão de CouncilDecision.votes).
  votes: ModelVote[];
}

/** null quando NENHUM modelo tem voto real (todos ABSTAIN) — fail-closed
 *  honesto, nunca uma leitura fabricada sobre dado ausente. */
export function fuseModelVotes(
  votes: ModelVote[],
  weights: Record<ModelId, number> = MODEL_FUSION_WEIGHTS,
): FusedReading | null {
  const real = votes.filter((v): v is ModelVote & { confidence: number } => v.stance !== "ABSTAIN" && v.confidence !== null);
  if (real.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;
  let longCount = 0;
  let shortCount = 0;
  for (const v of real) {
    const w = weights[v.model] ?? 1;
    const sign = v.stance === "LONG" ? 1 : v.stance === "SHORT" ? -1 : 0;
    weightedSum += sign * v.confidence * w;
    weightTotal += w;
    if (v.stance === "LONG") longCount++;
    else if (v.stance === "SHORT") shortCount++;
  }

  const pooled = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const stance: FusedReading["stance"] = pooled > 0 ? "LONG" : pooled < 0 ? "SHORT" : "NEUTRAL";
  const fusedConfidence = Math.min(1, Math.abs(pooled));

  const directional = longCount + shortCount;
  const agreement = directional > 0 ? Math.abs(longCount - shortCount) / directional : 0;
  const disagreement = 1 - agreement;

  return {
    stance,
    fusedConfidence,
    effectiveConfidence: fusedConfidence * (1 - disagreement),
    disagreement,
    votes,
  };
}
