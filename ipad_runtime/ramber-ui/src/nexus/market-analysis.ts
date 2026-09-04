// market-analysis.ts — Ordem "Market Analysis & Publication Engine" §1/§15:
// "Não criar um novo cérebro de análise... A nova capacidade deve ser uma
// camada de apresentação/publicação que consome os resultados reais já
// produzidos." Este módulo é PURA MONTAGEM/FORMATAÇÃO — zero direção nova,
// zero Entry/Stop/Target novos, zero confiança nova. Toda leitura vem de:
//   - NexusDecision (decision-layer.ts): o contrato único já fundido —
//     `operation` é passthrough literal do Core Engine (LEI 24).
//   - operational-readability.ts: os eixos BIAS/SETUP/ENTRY/RISCO/
//     CONFLUÊNCIA já derivados, já testados, reusados aqui tal e qual.
// A ÚNICA decisão nova deste módulo é "qual nível vira Zona de Interesse"
// (§3) — e mesmo essa reusa o mesmo gate de força (FORTE, >=2 toques)
// que o eixo do gráfico já usa para a mesma pergunta, zero limiar novo.
//
// Fail-closed (§6): sem NexusDecision real, ou com BIAS === "INSUFFICIENT_
// DATA" (o próprio Core Engine sem leitura agora), a análise inteira é
// `null` — "DADOS INSUFICIENTES", nunca uma leitura parcial fabricada
// para parecer completa. Campos individuais (retest/zona/plano) somem
// quando a evidência real específica não existe, nunca um traço/zero.
import {
  buildNarrativeSummary,
  deriveBiasLabel,
  deriveConfluenceState,
  deriveEntryState,
  deriveOutcomeLabel,
  deriveRiskState,
  ENTRY_CLAUSE,
  type NexusBiasLabel,
  type NexusConfluenceState,
  type NexusOutcomeLabel,
  type NexusRiskState,
} from "./operational-readability";
import type { NexusDecision } from "./decision-layer";
import { NEXUS_PLAN_GAP_LABEL } from "./decision-layer";
import { formatPrice as sharedFormatPrice } from "./price-format";

export const MARKET_ANALYSIS_CONTRACT_VERSION = 1 as const;

export interface MarketAnalysisTarget {
  index: number; // 0-based; UI decide o rótulo (TP1/"Target 1"/etc.)
  price: number;
  riskReward: number | null;
  reached: boolean;
}

export interface MarketAnalysisRetest {
  low: number;
  high: number;
  // Mesma cláusula real de operational-readability.ts (ENTRY_CLAUSE.
  // WAITING_FOR_RETEST) — nunca uma segunda redação do mesmo conceito.
  condition: string;
  context: string; // entry.basis real do Trade Plan
}

export interface MarketAnalysisZone {
  price: number;
  label: "S1" | "R1";
  touches: number;
}

export interface MarketAnalysisPlan {
  entryLow: number;
  entryHigh: number;
  entryBasis: string;
  invalidationPrice: number;
  invalidationBasis: string;
  targets: MarketAnalysisTarget[];
}

// Ordem "Correção Definitiva do Market Analysis / Social Card" §5
// (achado real do Operador, capturas reais de ZEC 2H: Conselho neutro
// exibia SÓ "sem plano acionável", mesmo quando o Núcleo — LEI 24, único
// emissor real de LONG/SHORT/WAIT — já tinha direção e stop/target
// próprios reais, exatamente o que o gráfico ao vivo já desenha como
// fallback (engineFallbackLevels, App.tsx) há várias entregas). Nunca
// substitui plan (Conselho sempre vence — mesma prioridade já usada em
// toda a fiação do gráfico); ENTRY fica de fora de propósito (é o preço
// vivo já exibido, mesmo motivo do fallback do gráfico).
export interface MarketAnalysisCorePlan {
  direction: "LONG" | "SHORT";
  stop: number;
  target1: number;
  target2: number | null;
  target3: number | null;
  riskRewardRatio: number | null;
}

export interface MarketAnalysis {
  contractVersion: typeof MARKET_ANALYSIS_CONTRACT_VERSION;
  symbol: string;
  timeframe: string;
  generatedAt: number; // ms epoch real — decision.computedAt, nunca Date.now() da UI
  regimeLabel: string | null;
  structureLabel: string | null;
  bias: NexusBiasLabel;
  outcome: NexusOutcomeLabel;
  confluence: NexusConfluenceState;
  risk: { state: NexusRiskState; basis: string } | null;
  confidenceLabel: string | null;
  score: number | null;
  zoneOfInterest: MarketAnalysisZone | null;
  retest: MarketAnalysisRetest | null;
  plan: MarketAnalysisPlan | null;
  // Quando plan === null, o motivo real nomeado (mesmo vocabulário de
  // NEXUS_PLAN_GAP_LABEL já usado em toda a UI) — nunca um silêncio que o
  // leitor não consegue distinguir de um bug.
  planGapLabel: string | null;
  // §5 da Ordem "Correção Definitiva": só existe quando plan é null E o
  // Núcleo tem stop/target1 reais agora — nunca os dois ao mesmo tempo
  // (mesma regra de exclusividade mútua já documentada no gráfico ao vivo).
  corePlan: MarketAnalysisCorePlan | null;
  // Evolução Final §11 ("leitura consolidada"): MESMA sentença real do
  // painel "LEITURA CONSOLIDADA" (App.tsx, NarrativeSummaryCard) — reusa
  // buildNarrativeSummary tal e qual, nunca uma segunda redação. `decision`
  // já é garantido não-nulo neste ponto (guard acima), então sempre uma
  // frase real, nunca null.
  narrative: string;
}

export interface StrengthReading {
  label: "FORTE" | "FRACA";
  touches: number;
}

export interface MarketAnalysisInput {
  symbol: string;
  timeframe: string;
  decision: NexusDecision | null | undefined;
  regimeLabel: string | null;
  structureLabel: string | null;
  support: number | null | undefined;
  supportStrength: StrengthReading | null | undefined;
  resistance: number | null | undefined;
  resistanceStrength: StrengthReading | null | undefined;
  livePrice: number | null | undefined;
  // Opcional/fail-closed (?? null internamente): MESMO sinal de CVD que
  // NarrativeSummaryCard já usa para a mesma frase de fluxo — quando o
  // chamador ainda não repassa, a narrativa simplesmente omite a frase de
  // fluxo (buildNarrativeSummary já trata null como "sem essa frase").
  flow?: "COMPRADOR" | "VENDEDOR" | null;
  // §5 da Ordem "Correção Definitiva": os MESMOS campos brutos que
  // App.tsx já lê de `engine` para montar engineFallbackLevels (o fallback
  // do gráfico ao vivo) — repassados crus de propósito. A validação
  // (finito, direção real) acontece uma vez só, aqui dentro de
  // buildMarketAnalysis, igual a support/resistance/livePrice acima; nunca
  // duplica a leitura de campo, só a validação estrutural (typeof/isFinite
  // determinístico — não uma segunda fórmula/decisão).
  coreFallback?: {
    direction: "LONG" | "SHORT" | "WAIT" | null | undefined;
    stop: number | null | undefined;
    target1: number | null | undefined;
    target2: number | null | undefined;
    target3: number | null | undefined;
    riskRewardRatio: number | null | undefined;
  } | null;
}

/**
 * Zona de Interesse (§3): entre S1/R1 reais, só os FORTES (>=2 toques
 * independentes — mesmo gate STRONG_TOUCH_THRESHOLD que o eixo do gráfico
 * já aplica para a mesma pergunta) entram na disputa; vence o mais perto
 * do preço vivo. Sem preço vivo, mantém a ordem determinística (S1 antes
 * de R1) em vez de inventar uma distância — mesmo princípio fail-closed
 * de selectRelevantLabels (price-label-stack.ts).
 */
function pickZoneOfInterest(input: MarketAnalysisInput): MarketAnalysisZone | null {
  const candidates: MarketAnalysisZone[] = [];
  if (
    typeof input.support === "number" &&
    Number.isFinite(input.support) &&
    input.supportStrength?.label === "FORTE"
  ) {
    candidates.push({ price: input.support, label: "S1", touches: input.supportStrength.touches });
  }
  if (
    typeof input.resistance === "number" &&
    Number.isFinite(input.resistance) &&
    input.resistanceStrength?.label === "FORTE"
  ) {
    candidates.push({ price: input.resistance, label: "R1", touches: input.resistanceStrength.touches });
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const p = input.livePrice;
  if (typeof p !== "number" || !Number.isFinite(p)) return candidates[0];
  return candidates.reduce((a, b) => (Math.abs(a.price - p) <= Math.abs(b.price - p) ? a : b));
}

export function buildMarketAnalysis(input: MarketAnalysisInput): MarketAnalysis | null {
  const decision = input.decision;
  if (!decision) return null;
  const bias = deriveBiasLabel(decision);
  // O próprio Core Engine sem leitura real agora — fail-closed total, não
  // uma leitura parcial. Todo o resto deste construtor assume `decision`
  // como uma fotografia real de mercado a partir daqui.
  if (bias === "INSUFFICIENT_DATA") return null;

  const entryState = deriveEntryState(decision);
  const retest: MarketAnalysisRetest | null =
    decision.plan && entryState === "WAITING_FOR_RETEST"
      ? {
          low: decision.plan.entryLow,
          high: decision.plan.entryHigh,
          condition: ENTRY_CLAUSE.WAITING_FOR_RETEST,
          context: decision.plan.entryBasis,
        }
      : null;

  const plan: MarketAnalysisPlan | null = decision.plan
    ? {
        entryLow: decision.plan.entryLow,
        entryHigh: decision.plan.entryHigh,
        entryBasis: decision.plan.entryBasis,
        invalidationPrice: decision.plan.stopPrice,
        invalidationBasis: decision.plan.stopBasis,
        targets: decision.plan.targets.map((t, i) => ({
          index: i,
          price: t.price,
          riskReward: t.riskReward,
          reached: t.hit,
        })),
      }
    : null;

  // §5 da Ordem "Correção Definitiva": plano do Núcleo só entra quando o
  // Conselho não tem plano — MESMA prioridade Conselho > Núcleo já
  // estabelecida em todo o resto do sistema (price-lines do gráfico,
  // priceAxisLabels, autoFitLevelsRef). Guards na MESMA ordem/condição do
  // engineFallbackLevels real (App.tsx): direção LONG/SHORT + stop/target1
  // finitos são o mínimo para um plano do Núcleo ser honesto o bastante
  // pra publicar.
  const corePlan: MarketAnalysisCorePlan | null = (() => {
    if (plan) return null;
    const cf = input.coreFallback;
    if (!cf) return null;
    const dir = cf.direction;
    if (dir !== "LONG" && dir !== "SHORT") return null;
    if (typeof cf.stop !== "number" || !Number.isFinite(cf.stop)) return null;
    if (typeof cf.target1 !== "number" || !Number.isFinite(cf.target1)) return null;
    return {
      direction: dir,
      stop: cf.stop,
      target1: cf.target1,
      target2: typeof cf.target2 === "number" && Number.isFinite(cf.target2) ? cf.target2 : null,
      target3: typeof cf.target3 === "number" && Number.isFinite(cf.target3) ? cf.target3 : null,
      riskRewardRatio: typeof cf.riskRewardRatio === "number" && Number.isFinite(cf.riskRewardRatio) ? cf.riskRewardRatio : null,
    };
  })();

  return {
    contractVersion: MARKET_ANALYSIS_CONTRACT_VERSION,
    symbol: input.symbol,
    timeframe: input.timeframe,
    generatedAt: decision.computedAt,
    regimeLabel: input.regimeLabel,
    structureLabel: input.structureLabel,
    bias,
    outcome: deriveOutcomeLabel(decision),
    confluence: deriveConfluenceState(decision),
    risk: deriveRiskState(decision),
    confidenceLabel: decision.confidenceLabel,
    score: decision.score,
    zoneOfInterest: pickZoneOfInterest(input),
    retest,
    plan,
    planGapLabel: !decision.plan && decision.planGap ? NEXUS_PLAN_GAP_LABEL[decision.planGap] : null,
    corePlan,
    narrative: buildNarrativeSummary(decision, { regimeLabel: input.regimeLabel, flow: input.flow ?? null }),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLICAÇÃO (§7/§8/§9): mesma MarketAnalysis, apresentação pública. §7
// proíbe expor arquitetura interna/nomes de agentes/jargão proprietário —
// os rótulos internos (LONG_BIAS/deriveOutcomeLabel/etc.) nunca vazam
// literalmente; cada um tem uma tradução pública curta abaixo. §9 exige
// vocabulário que nunca soe como garantia — "ALVO/CENÁRIO", "CENÁRIO DE
// RETESTE", "INVALIDAÇÃO DO CENÁRIO", nunca "vai bater aqui".
export const PUBLIC_BIAS_LABEL: Record<NexusBiasLabel, string> = {
  LONG_BIAS: "ALTA",
  SHORT_BIAS: "BAIXA",
  NEUTRAL_BIAS: "NEUTRO",
  CONFLICTED_BIAS: "CONFLITANTE",
  INSUFFICIENT_DATA: "DADOS INSUFICIENTES", // nunca alcançado (buildMarketAnalysis já barra antes), mantido só pra Record ser total
};

function fmtPrice(v: number): string {
  // Delega à fonte única — esta função era uma das TRÊS cópias byte a byte
  // de `v.toFixed(v >= 1000 ? 0 : 2)` espalhadas pelo app.
  return sharedFormatPrice(v);
}

/**
 * Texto curto para X (§8) — direto, sem jargão interno. Fail-closed por
 * construção: cada seção só aparece quando o campo real existe em
 * `analysis` (nunca um placeholder "—" para preencher espaço).
 */
export function formatMarketAnalysisForX(analysis: MarketAnalysis): string {
  const lines: string[] = [`${analysis.symbol} · ${analysis.timeframe.toUpperCase()}`, ""];

  lines.push(`Viés: ${PUBLIC_BIAS_LABEL[analysis.bias]}`);
  if (analysis.regimeLabel) lines.push(`Regime: ${analysis.regimeLabel}`);
  if (analysis.structureLabel) lines.push(`Estrutura: ${analysis.structureLabel}`);
  lines.push(`Confluência: ${analysis.confluence}`);
  if (analysis.zoneOfInterest) {
    lines.push(`Zona de interesse: ${analysis.zoneOfInterest.label} ${fmtPrice(analysis.zoneOfInterest.price)}`);
  }

  if (analysis.plan) {
    lines.push("");
    lines.push(`Entry: ${fmtPrice(analysis.plan.entryLow)}–${fmtPrice(analysis.plan.entryHigh)}`);
    lines.push(`Invalidação do cenário: ${fmtPrice(analysis.plan.invalidationPrice)}`);
    analysis.plan.targets.forEach((t) => {
      const rr = t.riskReward !== null ? ` · R:R 1:${t.riskReward.toFixed(2)}` : "";
      lines.push(`Alvo/Cenário ${t.index + 1}: ${fmtPrice(t.price)}${rr}${t.reached ? " · ATINGIDO" : ""}`);
    });
  } else if (analysis.corePlan) {
    // §5 da Ordem "Correção Definitiva": rótulo "(Núcleo)" explícito —
    // MESMA distinção honesta que o gráfico ao vivo já faz entre plano do
    // Conselho e fallback do Núcleo, nunca apresentado como se fosse a
    // mesma coisa.
    lines.push("");
    lines.push(`Plano (Núcleo, sem estrutura do Conselho ainda): Stop ${fmtPrice(analysis.corePlan.stop)}`);
    const coreTargets = [analysis.corePlan.target1, analysis.corePlan.target2, analysis.corePlan.target3].filter(
      (v): v is number => v !== null,
    );
    coreTargets.forEach((price, i) => {
      const rr = i === 0 && analysis.corePlan!.riskRewardRatio !== null ? ` · R:R 1:${analysis.corePlan!.riskRewardRatio!.toFixed(2)}` : "";
      lines.push(`Alvo (Núcleo) ${i + 1}: ${fmtPrice(price)}${rr}`);
    });
  } else if (analysis.planGapLabel) {
    lines.push("");
    lines.push(`Plano: ${analysis.planGapLabel}`);
  }

  if (analysis.retest) {
    lines.push("");
    lines.push(`Cenário de reteste: ${fmtPrice(analysis.retest.low)}–${fmtPrice(analysis.retest.high)}`);
    lines.push(`(${analysis.retest.context})`);
  }

  lines.push("");
  lines.push(`Status da leitura: ${analysis.outcome}`);
  if (analysis.confidenceLabel) {
    lines.push(`Confiança: ${analysis.confidenceLabel} (confluência real, nunca probabilidade)`);
  }

  lines.push("");
  lines.push("Leitura gerada por AR10 CYBORG · não é recomendação de investimento.");

  return lines.join("\n");
}
