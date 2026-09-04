// unified-presentation.ts — "Evolução Incremental da Inteligência Central"
// (carta do Operador em resposta a docs/historico/AUDITORIA_MARKETBRAIN.md), Fase 1:
// UnifiedPresentation. Função pura que LÊ os aggregators já reais
// (decision-layer.ts, council.ts, regime-engine.js, aura-lifecycle.ts) e
// monta um `PresentationState` único com proveniência explícita por campo
// — zero segunda fonte, zero decisão nova. LEI 24: o Operador confirmou
// por escrito (mesmo texto usado nos 6 módulos já existentes) que isto é
// informativo/passthrough — nunca bloqueia, nunca decide, nunca gera uma
// segunda emissão de LONG/SHORT.
//
// Correção sobre o documento do Operador (§3.2/§8): "regime" NÃO vem de
// aura-lifecycle.ts — esse módulo é sobre CONVICÇÃO (corridorWidthFactor,
// massa de opinião real do Confluence Engine, 0-1), não sobre regime de
// mercado. O regime real (TENDENCIA_FORTE/MODERADA/CONSOLIDACAO/
// COMPRESSAO/BREAKOUT + direção ALTA/BAIXA) vem de
// market-regime/regime-engine.js::classifyMarketRegime. Corrigido aqui —
// aura-lifecycle alimenta `conviction`, regime-engine alimenta `regime`.
//
// Também: `direction` usa o vocabulário REAL do passthrough (NexusOperation
// = "LONG"|"SHORT"|"AGUARDAR", decision-layer.ts) em vez do WAIT/NEUTRAL em
// inglês do documento — inventar uma distinção que o Core Engine não faz
// seria uma segunda fonte disfarçada.
//
// Escopo desta fatia (Fase 1): `verdict` + `displayConflicts` — os dois
// campos do contrato do documento (§3.2) para os quais já existe leitura
// real, completa, sem gap. `probability` (3 camadas — já existe em
// expectancy.ts, Entrega 42/44, falta só compor aqui), `scenarios` (já
// existe em scenario-engine.ts), `risk` (já existe em risk-engine.js/
// RiskSuggestion), `trend` (precisa memória de ciclo anterior — natureza
// stateful, não cabe numa função pura de leitura única) e `output`/
// `memory` (Fase 2-4 do próprio plano do Operador: Header, Painel, Voz)
// ficam de fora deste corte por decisão explícita, não por esquecimento —
// cada um é uma composição real de módulos já existentes, não matemática
// nova, e cada um merece sua própria fatia pequena e testada em vez de
// entrar todos juntos aqui.
//
// "Conectar aos aggregators existentes via Event Bus" (checklist do
// documento, Fase 1): o Event Bus (nexus/event-bus.ts) já publica
// BRAIN.NEXUS_DECISION.UPDATED e BRAIN.COUNCIL.UPDATED com o publicador
// único de sempre (organism-orchestrator.ts) — mas NÃO publica regime nem
// aura/conviction hoje. Adicionar esses dois eventos mexe num arquivo
// compartilhado e sensível (o único publicador real de todo o barramento)
// — isso fica para quando este módulo for de fato ligado a um consumidor
// vivo (Fase 2+), não empacotado aqui. Por ora este módulo recebe os
// valores já computados como parâmetros — o mesmo padrão de todo motor
// puro deste repositório (função de entrada→saída determinística).
import type { NexusDecision, NexusOperation } from "./decision-layer";
import type { CouncilDecision } from "./council";
import type { AuraReading } from "./aura-lifecycle";
import {
  regimeStructureVerdict,
  riskConfluenceVerdict,
  collectConflicts,
  type DetectedConflict,
} from "./conflict-detector";

export const PRESENTATION_STATE_CONTRACT_VERSION = 1 as const;

// Mesmo shape real de classifyMarketRegime() (regime-engine.js) — não
// reimportado (módulo .js sem tipos), replicado aqui como o CONTRATO que
// o chamador (App.tsx, que já roda o motor) deve passar.
export interface RegimeReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  regime: string;
  direction: "ALTA" | "BAIXA" | null;
}

export type ConvictionLabel = "FORTE" | "MODERADA" | "FRACA" | null;

// Limiares documentados sobre corridorWidthFactor (0-1) — mesma natureza
// dos 70/30 do RSI de Wilder: convenção declarada, não uma medição.
export const CONVICTION_STRONG_MIN = 0.7;
export const CONVICTION_MODERATE_MIN = 0.4;

function deriveConvictionLabel(corridorWidthFactor: number | null): ConvictionLabel {
  if (corridorWidthFactor === null || !Number.isFinite(corridorWidthFactor)) return null;
  if (corridorWidthFactor >= CONVICTION_STRONG_MIN) return "FORTE";
  if (corridorWidthFactor >= CONVICTION_MODERATE_MIN) return "MODERADA";
  return "FRACA";
}

export interface PresentationVerdictProvenance {
  direction: "core-engine";
  score: "decision-layer";
  regime: "regime-engine";
  conviction: "aura-lifecycle";
}

export interface PresentationVerdict {
  // Passthrough literal de NexusDecision.operation — o Core Engine
  // continua o único emissor real (LEI 24). AGUARDAR é o vocabulário
  // real do contrato existente, não um WAIT/NEUTRAL inventado.
  direction: NexusOperation;
  // Score de confluência 0-100 (decision-layer.ts) — nunca probabilidade
  // (Regra de Ouro 2). null honesto quando o Núcleo não tem leitura.
  score: number | null;
  confidenceLabel: string | null;
  // Regime real (ADX + Bollinger Bandwidth) — regime-engine.js. String
  // literal do motor (ex.: "TENDENCIA_FORTE", "DADOS_INSUFICIENTES").
  regime: string;
  regimeDirection: "ALTA" | "BAIXA" | null;
  // Categorização de corridorWidthFactor (aura-lifecycle.ts) — massa de
  // opinião real do Confluence Engine, nunca probabilidade de acerto.
  conviction: ConvictionLabel;
  provenance: PresentationVerdictProvenance;
}

export interface PresentationState {
  contractVersion: typeof PRESENTATION_STATE_CONTRACT_VERSION;
  computedAt: number;
  verdict: PresentationVerdict;
  // Lista central nomeada de conflitos reais entre motores (§3.2 do
  // documento) — reusa conflict-detector.ts (Fase 1 anterior desta mesma
  // frente) em vez de reimplementar a comparação aqui.
  displayConflicts: DetectedConflict[];
}

export interface UnifiedPresentationInput {
  decision: NexusDecision | null;
  council: CouncilDecision | null;
  regime: RegimeReading | null;
  aura: AuraReading | null;
  // Structure (market-structure-engine.js) e status do Risk Engine
  // (risk-engine.js) entram como leituras já resolvidas — mesmo padrão de
  // conflict-detector.ts, zero recálculo aqui.
  structureLabel: "ESTRUTURA_ALTA" | "ESTRUTURA_BAIXA" | "ESTRUTURA_LATERAL" | null;
  riskStatus: "OK" | "SEM_SUGESTAO" | null;
}

export function computePresentationState(
  input: UnifiedPresentationInput,
  computedAt: number = Date.now(),
): PresentationState {
  const direction: NexusOperation = input.decision?.operation ?? "AGUARDAR";
  const regime = input.regime?.status === "OK" ? input.regime.regime : "DADOS_INSUFICIENTES";
  const regimeDirection = input.regime?.status === "OK" ? input.regime.direction : null;

  const verdict: PresentationVerdict = {
    direction,
    score: input.decision?.score ?? null,
    confidenceLabel: input.decision?.confidenceLabel ?? null,
    regime,
    regimeDirection,
    conviction: deriveConvictionLabel(input.aura?.corridorWidthFactor ?? null),
    provenance: {
      direction: "core-engine",
      score: "decision-layer",
      regime: "regime-engine",
      conviction: "aura-lifecycle",
    },
  };

  const regimeStructure = regimeStructureVerdict(regimeDirection, input.structureLabel);
  const riskConfluence = riskConfluenceVerdict(
    input.riskStatus,
    input.council?.stance ?? null,
    input.council?.agreement ?? null,
  );

  return {
    contractVersion: PRESENTATION_STATE_CONTRACT_VERSION,
    computedAt,
    verdict,
    displayConflicts: collectConflicts({ regimeStructure, riskConfluence }),
  };
}
