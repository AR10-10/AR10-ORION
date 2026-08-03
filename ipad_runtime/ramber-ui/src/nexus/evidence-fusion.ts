// evidence-fusion.ts — Carta Branca ("ative e finalize os motores de
// inteligência pendentes... como o Evidence Fusion Engine"): o consumidor
// real que engine-signal-contract.ts esperava desde EPC OMEGA FINAL —
// SYSTEM_HANDBOOK §6.72/§6.74/§6.76 classificaram isto, em 3 rodadas
// anteriores, como "iniciativa de arquitetura própria" (recomendado, nunca
// construído). Esta é essa iniciativa, escopada honestamente como v1.
//
// O QUE ISTO É: agregação REAL, porém ESTRITAMENTE NÃO-DIRECIONAL, de
// EngineSignal[] vindas de múltiplas fontes JÁ reais e JÁ independentes
// (Conselho + Zonas Institucionais hoje — engine-signal-contract.ts;
// qualquer motor futuro que ganhe seu próprio montador soma aqui de
// graça, zero mudança nesta função). Contagens/médias sobre o que já
// existe: quantos sinais reais estão sendo rastreados agora, quantos são
// válidos, confiança média entre os válidos, e — o retrato mais honesto
// de todos — COBERTURA real de cada um dos 10 campos do próprio contrato
// (a pergunta que SYSTEM_HANDBOOK vem repetindo há 3 rodadas: "quantos
// dos 10 campos têm montador real HOJE" — agora é um número AO VIVO, não
// uma contagem manual num relatório).
//
// O QUE ISTO NUNCA É (mesma linha vermelha do cabeçalho de
// engine-signal-contract.ts, repetida aqui de propósito): uma segunda
// pool/matemática de DIREÇÃO. fuseEvidence NUNCA produz stance/score/
// probabilidade combinada — combinar opinião em uma direção real (LEI 24)
// continua sendo trabalho exclusivo de aggregateCouncil (Stone 1961/
// DeGroot 1974). EvidenceFusionReading não tem nenhum campo LONG/SHORT/
// confidence-combinada — só estatística real sobre COBERTURA e VOLUME.
//
// Fonte deliberadamente EXCLUÍDA (documentado, não esquecido): Scenario
// Engine NÃO vira uma 3ª fonte aqui. ScenarioPath.opinionWeight
// (scenario-engine.ts) já É a mesma massa de opinião do Conselho —
// buildScenarioProjection recebe `council` como insumo direto. Somar as
// duas contaria a MESMA evidência duas vezes sob nomes diferentes,
// exatamente a redundância que a Carta Branca pediu para eliminar, não
// multiplicar. Uma 3ª fonte real e genuinamente independente (Radar de
// Qualificação, GMIL, etc.) é evolução futura honesta, não construída
// agora sem um montador próprio real primeiro.
import type { EngineSignal } from "./engine-signal-contract";

export const EVIDENCE_FUSION_CONTRACT_VERSION = 1 as const;

export interface EvidenceFusionSourceGroup {
  source: string;
  signals: EngineSignal[];
}

export interface EvidenceFusionSourceBreakdown {
  source: string;
  total: number;
  valid: number;
  // Média real do `weight` entre os sinais que TÊM peso não-nulo desta
  // fonte — null honesto quando nenhum sinal desta fonte tem peso.
  meanWeight: number | null;
}

// As 9 chaves reais de EngineSignal além de `id` (que nunca é null por
// construção — sempre um identificador real, não faz sentido "cobertura"
// dela). `as const` preserva o literal de cada chave para o Record abaixo.
const SIGNAL_FIELDS = [
  "weight",
  "confidence",
  "relevance",
  "validity",
  "context",
  "justification",
  "priority",
  "quality",
  "temporalHorizon",
  "lifespanCandles",
] as const;

export interface EvidenceFusionReading {
  contractVersion: typeof EVIDENCE_FUSION_CONTRACT_VERSION;
  totalSignals: number;
  validSignals: number;
  // Média real de confidence só entre os sinais VÁLIDOS com confidence
  // não-nulo — null honesto quando nenhum sinal válido tem confidence.
  meanConfidence: number | null;
  // 0..1 real por campo: fração de TODOS os sinais rastreados agora que
  // têm este campo específico preenchido (não-nulo) — a instrumentação
  // real do contrato de 10 campos, viva.
  fieldCoverage: Record<(typeof SIGNAL_FIELDS)[number], number>;
  bySource: EvidenceFusionSourceBreakdown[];
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

/** Motor puro: agrega EngineSignal[] de múltiplas fontes JÁ reais em uma
 *  leitura honesta de COBERTURA/VOLUME de evidência — nunca uma direção,
 *  nunca um score combinado. Determinístico, zero rede/estado. Nenhuma
 *  fonte real ainda montada => contadores 0/fieldCoverage 0, fail-closed
 *  honesto, nunca um valor fabricado. */
export function fuseEvidence(groups: EvidenceFusionSourceGroup[]): EvidenceFusionReading {
  const allSignals = groups.flatMap((g) => g.signals);
  const validSignals = allSignals.filter((s) => s.validity === true);
  const validConfidences = validSignals
    .map((s) => s.confidence)
    .filter((c): c is number => c !== null);

  const fieldCoverage = Object.fromEntries(
    SIGNAL_FIELDS.map((field) => [
      field,
      allSignals.length > 0
        ? allSignals.filter((s) => s[field] !== null && s[field] !== undefined).length / allSignals.length
        : 0,
    ]),
  ) as EvidenceFusionReading["fieldCoverage"];

  const bySource: EvidenceFusionSourceBreakdown[] = groups.map((g) => ({
    source: g.source,
    total: g.signals.length,
    valid: g.signals.filter((s) => s.validity === true).length,
    meanWeight: mean(g.signals.map((s) => s.weight).filter((w): w is number => w !== null)),
  }));

  return {
    contractVersion: EVIDENCE_FUSION_CONTRACT_VERSION,
    totalSignals: allSignals.length,
    validSignals: validSignals.length,
    meanConfidence: mean(validConfidences),
    fieldCoverage,
    bySource,
  };
}
