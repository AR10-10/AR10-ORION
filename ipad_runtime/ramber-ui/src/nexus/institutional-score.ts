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
