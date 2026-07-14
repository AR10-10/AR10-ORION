// institutional-score.ts — Diretriz V-MAX de Refinamento Institucional
// (item 5, "Score Institucional") + Diretriz de Refinamento Operacional
// (Camada de Decisão Profissional): UM único Score Geral 0-100 no header.
//
// AUDITORIA ANTES DE CONSTRUIR (a própria Regra Final da diretriz exige:
// "Integra-se ao Nexus Core sem duplicar lógica?"): os insumos que a
// diretriz lista (Estrutura, Liquidez, Fluxo, Volume, Volatilidade,
// Tendência, Momentum, GMIL, Risk) JÁ alimentam os três pools reais de
// opinião (Ensemble/Council/Multi-Timeframe) que o Confluence Engine
// (Phase Ω Priority 2) JÁ combina num único número real 0..1 via o mesmo
// linear opinion pool de sempre (Stone 1961/DeGroot 1974), já amortecido
// pelo TrustScore real (convictionAdjusted). Criar aqui uma SEGUNDA
// fórmula de combinação violaria simultaneamente a regra da própria
// diretriz e o princípio "zero segunda matemática de consenso" desta
// base. Este módulo é, portanto, um CONTRATO DE APRESENTAÇÃO honesto
// sobre a leitura pooled já real: escala 0-100, gate de oportunidade
// configurável, gate de risco — zero matemática nova de consenso.
//
// HONESTIDADE (Regra de Ouro 2): o Score é massa de confluência real
// entre subsistemas (0 = todos discordam, 100 = concordância integral),
// NUNCA uma probabilidade calibrada de acerto — este repositório não tem
// backtest real que sustente essa afirmação. A diretriz pede "qual a
// probabilidade estatística da leitura" — a resposta honesta é este
// número real de confluência, rotulado como confluência.
//
// LEI 24: o Score nunca decide nada — `opportunity` é um gate de
// COMUNICAÇÃO ("somente após atingir o nível mínimo configurado o sistema
// comunica oportunidade", texto da diretriz): controla o que o Assistente
// Operacional FALA, nunca bloqueia/altera o LONG/SHORT/WAIT do Core
// Engine, que continua exibido integralmente como sempre.
import type { ConvictionReading } from "./confluence-engine";

export interface InstitutionalScoreReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  // 0-100 (confluência real, nunca probabilidade). null quando não há
  // oportunidade direcional a pontuar (WAIT) — pontuar o nada seria
  // fabricação.
  score: number | null;
  // true somente quando: direção ativa real + score >= minScore + risco
  // não travado. Gate de comunicação (display/voz), nunca de decisão.
  opportunity: boolean;
  computedAt: number;
}

// Nível mínimo padrão para comunicar oportunidade — parâmetro documentado
// (mesma natureza dos limiares 70/30 do RSI), não uma medição: 60/100
// exige maioria real de massa de opinião alinhada, sem exigir unanimidade.
export const DEFAULT_MIN_OPPORTUNITY_SCORE = 60;

export interface InstitutionalScoreInput {
  engineStatus: "pending" | "ok" | "error";
  coreDirection: "LONG" | "SHORT" | "WAIT" | null;
  conviction: ConvictionReading | null;
  riskGated: boolean;
  minScore?: number;
  now?: number;
}

export function computeInstitutionalScore(input: InstitutionalScoreInput): InstitutionalScoreReading {
  const computedAt = input.now ?? Date.now();
  const minScore = input.minScore ?? DEFAULT_MIN_OPPORTUNITY_SCORE;

  if (input.engineStatus !== "ok") {
    return {
      status: "DADOS_INSUFICIENTES",
      reason: input.engineStatus === "pending" ? "motor_real_ainda_sem_primeiro_ciclo" : "motor_real_em_falha",
      score: null,
      opportunity: false,
      computedAt,
    };
  }

  const direction = input.coreDirection === "LONG" || input.coreDirection === "SHORT" ? input.coreDirection : null;
  if (direction === null) {
    // WAIT real do Core Engine: não existe oportunidade direcional a
    // pontuar — score null honesto, nunca um zero fabricado que pareceria
    // "oportunidade péssima" em vez de "sem oportunidade".
    return {
      status: "OK",
      reason: "core_engine_em_WAIT_sem_oportunidade_a_pontuar",
      score: null,
      opportunity: false,
      computedAt,
    };
  }

  if (!input.conviction || input.conviction.status !== "OK" || input.conviction.conviction === null) {
    return {
      status: "DADOS_INSUFICIENTES",
      reason: "confluencia_real_indisponivel_nesta_janela",
      score: null,
      opportunity: false,
      computedAt,
    };
  }

  // convictionAdjusted (amortecida pelo TrustScore real) quando medida;
  // fallback honesto para a massa bruta — mesmo contrato do Confluence
  // Engine, nunca uma escala nova.
  const mass = input.conviction.convictionAdjusted ?? input.conviction.conviction;
  const score = Math.round(100 * Math.max(0, Math.min(1, mass)));

  return {
    status: "OK",
    reason: input.riskGated ? "risco_travado_pelo_conselho_fail_closed" : null,
    score,
    opportunity: !input.riskGated && score >= minScore,
    computedAt,
  };
}

// Diretriz Complementar §16 ("Zona de Confiança Institucional"): banda de
// APRESENTAÇÃO honesta sobre o mesmo score real acima — zero matemática
// nova, zero segunda fonte. Os 5 cortes/rótulos vêm literais da diretriz
// (parâmetros documentados, mesma natureza dos limiares 70/30 do RSI).
// "Inválida" (< 50) não é um erro: é a leitura honesta de que a massa de
// confluência real não sustenta uma leitura confiável agora.
export type InstitutionalConfidenceTier = "MUITO_FORTE" | "FORTE" | "MODERADA" | "FRACA" | "INVALIDA";

export interface InstitutionalConfidenceZone {
  tier: InstitutionalConfidenceTier;
  label: string;
  emoji: string;
  colorClass: string;
}

const CONFIDENCE_TIERS: readonly { min: number; tier: InstitutionalConfidenceTier; label: string; emoji: string; colorClass: string }[] = [
  { min: 90, tier: "MUITO_FORTE", label: "Muito Forte", emoji: "🟢", colorClass: "text-[#00ffaa]" },
  { min: 80, tier: "FORTE", label: "Forte", emoji: "🟢", colorClass: "text-[#00ffaa]" },
  { min: 65, tier: "MODERADA", label: "Moderada", emoji: "🟡", colorClass: "text-[#f0d06f]" },
  { min: 50, tier: "FRACA", label: "Fraca", emoji: "🟠", colorClass: "text-[#ff9f40]" },
  { min: -Infinity, tier: "INVALIDA", label: "Inválida", emoji: "🔴", colorClass: "text-[#ff0055]" },
];

/** Banda o score real 0-100 em uma das 5 zonas da diretriz §16. null
 *  honesto (sem oportunidade a bandar) quando o score em si é null — nunca
 *  uma banda fabricada para um WAIT. */
export function institutionalConfidenceZone(score: number | null): InstitutionalConfidenceZone | null {
  if (score === null || !Number.isFinite(score)) return null;
  const clamped = Math.max(0, Math.min(100, score));
  const match = CONFIDENCE_TIERS.find((t) => clamped >= t.min)!;
  return { tier: match.tier, label: match.label, emoji: match.emoji, colorClass: match.colorClass };
}

// Diretriz Complementar §18 ("tendência de convicção"): não existia, em
// todo o codebase, nenhuma SÉRIE real do Score Geral — só a leitura
// instantânea acima. Um consumidor real (store) alimenta esta janela toda
// vez que um score REAL é computado (WAIT/DADOS_INSUFICIENTES nunca
// entram — pontuar o nada seria fabricação, mesma regra de sempre).
export interface ConvictionScoreSample {
  score: number;
  at: number;
}

// Mesmo teto de ordem de grandeza dos outros rings reais desta base
// (l2History/orderflowHistory) — parâmetro documentado, não uma medição.
export const CONVICTION_HISTORY_CAPACITY = 60;

/** Ring real do Score Geral ao longo do tempo — mesmo padrão de teto de
 *  orderflow-history.ts, nunca acumula sem limite. */
export function pushConvictionHistory(
  ring: ConvictionScoreSample[],
  sample: ConvictionScoreSample,
  capacity: number = CONVICTION_HISTORY_CAPACITY,
): ConvictionScoreSample[] {
  const next = ring.length === 0 ? [sample] : [...ring, sample];
  return next.length > capacity ? next.slice(next.length - capacity) : next;
}

export type ConvictionTrend = "FORTALECENDO" | "ENFRAQUECENDO" | "ESTAVEL";

export interface ConvictionTrendReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  trend: ConvictionTrend | null;
  // Média real do Score Geral em cada metade da janela — a base
  // verificável exposta para a UI, nunca recalculada por ela.
  recentAverage: number | null;
  priorAverage: number | null;
  computedAt: number;
}

// Precisa de janela real dos dois lados — parâmetro documentado, mesma
// natureza do MIN_ENTRIES_FOR_TREND de orderflow-history.ts.
const MIN_SAMPLES_FOR_CONVICTION_TREND = 10;
// Zona-morta real em PONTOS de score (0-100), não uma fração relativa: o
// score já vive numa escala fixa e conhecida (ao contrário do CVD), então
// um limiar absoluto aqui é honesto — mesma natureza dos limiares 70/30 do
// RSI, não uma medição.
const CONVICTION_TREND_DEADBAND_POINTS = 3;

function insufficientConvictionTrend(reason: string, computedAt: number): ConvictionTrendReading {
  return { status: "DADOS_INSUFICIENTES", reason, trend: null, recentAverage: null, priorAverage: null, computedAt };
}

/** Tendência real de convicção: compara a MÉDIA do Score Geral entre a
 *  metade mais RECENTE e a metade ANTERIOR da janela retida (nunca uma
 *  inclinação de série cumulativa como o CVD — o score já é uma leitura
 *  direta a cada ciclo, então a média por metade é a comparação honesta).
 *  FORTALECENDO = a confluência real está subindo; ENFRAQUECENDO = o
 *  oposto; ESTAVEL = a diferença não supera a zona-morta real. Nunca uma
 *  "probabilidade" (Regra de Ouro 2) — é a tendência real do mesmo score
 *  de confluência já honesto. */
export function computeConvictionTrend(history: ConvictionScoreSample[], now: number = Date.now()): ConvictionTrendReading {
  const real = Array.isArray(history) ? history.filter((h) => Number.isFinite(h.score)) : [];
  if (real.length < MIN_SAMPLES_FOR_CONVICTION_TREND) {
    return insufficientConvictionTrend("historico_real_insuficiente_para_tendencia", now);
  }
  const mid = Math.floor(real.length / 2);
  const priorSlice = real.slice(0, mid);
  const recentSlice = real.slice(mid);
  const priorAverage = priorSlice.reduce((sum, h) => sum + h.score, 0) / priorSlice.length;
  const recentAverage = recentSlice.reduce((sum, h) => sum + h.score, 0) / recentSlice.length;
  const delta = recentAverage - priorAverage;

  const trend: ConvictionTrend =
    Math.abs(delta) <= CONVICTION_TREND_DEADBAND_POINTS ? "ESTAVEL" : delta > 0 ? "FORTALECENDO" : "ENFRAQUECENDO";
  return { status: "OK", reason: null, trend, recentAverage, priorAverage, computedAt: now };
}
