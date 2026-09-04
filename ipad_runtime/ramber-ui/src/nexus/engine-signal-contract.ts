// engine-signal-contract.ts — EPC OMEGA FINAL Parte 1 ("Meta Engine",
// §6/§8): forma única que qualquer motor/agente pode preencher para
// descrever sua própria contribuição de confluência.
//
// O QUE ISTO É: um CONTRATO (tipo + montadores) sobre leituras que os
// motores JÁ produzem. Os 10 campos pedidos pelo Operador (peso/confiança/
// relevância/validade/contexto/justificativa/prioridade/qualidade/
// horizonte temporal/vida útil) viram um único tipo — EngineSignal — para
// que um futuro painel/relatório possa ler QUALQUER motor pela mesma forma
// em vez de conhecer o formato interno de cada um.
//
// O QUE ISTO NUNCA É: uma segunda pool/matemática de combinação DIRECIONAL
// (LEI 24 + "zero segunda matemática", ver council.ts/ensemble-engine.js).
// Nenhuma função aqui combina, pondera ou decide nada — cada montador só
// REEMPACOTA um resultado que outro motor já calculou. Combinar em uma
// DIREÇÃO (LONG/SHORT/WAIT) continua sendo trabalho exclusivo de
// aggregateCouncil (Stone 1961/DeGroot 1974). Carta Branca (Evidence
// Fusion Engine, nexus/evidence-fusion.ts): agrega EngineSignal[] de
// múltiplas fontes em estatística real de COBERTURA/VOLUME de evidência
// — nunca uma direção, nunca um score combinado — a mesma linha vermelha
// desta regra, repetida no cabeçalho daquele arquivo de propósito.
//
// Honestidade de auditoria (ver docs/historico/RELATORIO_EPC_OMEGA_FINAL.md, Parte
// 1, e SYSTEM_HANDBOOK §6.72/§6.74/§6.76): hoje só ~5 dos 10 campos são
// rastreados de verdade pelos 2 montadores reais (peso, confidence,
// validity, context, justification — rationale/evidence do Conselho +
// membros/confluenceWeight das Zonas Institucionais). Os montadores
// abaixo preenchem SÓ o que é real e deixam o resto null explícito —
// nunca um valor fabricado pra "completar" o contrato (Regra de Ouro 3,
// fail-closed). Os campos null hoje são o mapa real do que uma evolução
// futura precisaria instrumentar, não um placeholder qualquer.
import type { CouncilDecision } from "./council";
import type { InstitutionalZone } from "./institutional-zones";
// Reaproveita a MESMA fórmula real já usada pelo destaque visual da faixa
// no gráfico (zero segunda fórmula) — precedente já real de nexus/*.ts
// importando um utilitário puro de chart/*.ts (ver ageAlpha em
// aura-lifecycle.ts/liquidation-heatmap.ts, mesma disciplina).
import { confluenceWeight } from "../chart/InstitutionalZonePlugin";

export interface EngineSignal {
  id: string; // nome do motor/agente (ex.: "Conselho·LIQUIDITY")
  weight: number | null;
  // 0..1 real — nunca probabilidade de mercado (Regra de Ouro 2).
  confidence: number | null;
  relevance: "alta" | "media" | "baixa" | null;
  validity: boolean | null;
  context: string | null;
  justification: string | null;
  priority: number | null;
  quality: string | null;
  temporalHorizon: string | null;
  lifespanCandles: number | null;
}

/** Council já tem, por voto real: agente, stance, confidence (0..1|null),
 *  rationale/evidence (justificativa/contexto reais). `weight` reflete o
 *  peso REAL já usado por aggregateCouncil (council.ts:453-459): RISK
 *  nunca entra no pool (é um portão fail-closed, não um voto direcional —
 *  weight null, não zero fabricado); um voto ABSTAIN também fica fora do
 *  pool (weight null); todo outro voto pesa 1 (uniforme, sem modulação
 *  por família — mesmo valor literal do pool, não uma segunda leitura).
 *  `validity` usa a mesma regra: ABSTAIN é a leitura honesta de "sem
 *  opinião direcional válida agora", não uma invalidação nova.
 *  relevance/priority/quality/temporalHorizon/lifespanCandles: o Conselho
 *  não rastreia nenhum destes por voto individual hoje — null real. */
export function deriveEngineSignalsFromCouncil(decision: CouncilDecision | null): EngineSignal[] {
  if (!decision) return [];
  return decision.votes.map((vote) => ({
    id: `Conselho·${vote.agent}`,
    weight: vote.agent === "RISK" || vote.stance === "ABSTAIN" ? null : 1,
    confidence: vote.confidence,
    relevance: null,
    validity: vote.stance !== "ABSTAIN",
    context: vote.evidence.length > 0 ? vote.evidence.join("; ") : null,
    justification: vote.rationale,
    priority: null,
    quality: null,
    temporalHorizon: null,
    lifespanCandles: null,
  }));
}

/** Zonas Institucionais já reais (computeInstitutionalZones,
 *  nexus/institutional-zones.ts) — fonte INDEPENDENTE do Conselho (EMA/
 *  VWAP/FVG/OB/liquidez/estrutura, zero voto de agente envolvido).
 *  `weight` reusa confluenceWeight(distinctSourceCount), a MESMA
 *  normalização 0..1 já usada pelo destaque visual da faixa no gráfico —
 *  zero segunda fórmula. `validity` é sempre true: toda zona que chega
 *  aqui já passou o piso real de MIN_DISTINCT_SOURCES_FOR_ZONE dentro do
 *  próprio motor (uma zona que não bateu o piso nunca é retornada, então
 *  não existe uma zona "inválida" neste array — não é um valor fabricado,
 *  é a garantia real do motor de origem). `context` = os labels reais dos
 *  membros que formam a zona (ex.: "EMA21; VWAP; FVG Alta").
 *  confidence/priority/quality/temporalHorizon/lifespanCandles: o motor de
 *  zonas não rastreia nenhum destes por zona hoje — null real, mesmo
 *  padrão de honestidade de deriveEngineSignalsFromCouncil acima.
 *  `relevance`: também null aqui — layer-relevance.ts computa relevância
 *  por CAMADA inteira (institutional_zones liga/desliga em bloco), nunca
 *  por zona individual; atribuir uma aqui seria uma leitura fabricada. */
export function deriveEngineSignalsFromInstitutionalZones(zones: InstitutionalZone[]): EngineSignal[] {
  return zones.map((zone) => ({
    id: `Zona Institucional·${zone.centerPrice.toFixed(0)}`,
    weight: confluenceWeight(zone.distinctSourceCount),
    confidence: null,
    relevance: null,
    validity: true,
    context: zone.members.map((m) => m.label).join("; "),
    justification: null,
    priority: null,
    quality: null,
    temporalHorizon: null,
    lifespanCandles: null,
  }));
}
