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
// O QUE ISTO NUNCA É: uma segunda pool/matemática de combinação (LEI 24 +
// "zero segunda matemática", ver council.ts/ensemble-engine.js). Nenhuma
// função aqui combina, pondera ou decide nada — cada montador só
// REEMPACOTA um resultado que outro motor já calculou. Combinar continua
// sendo trabalho exclusivo de aggregateCouncil (Stone 1961/DeGroot 1974).
//
// Honestidade de auditoria (ver docs/RELATORIO_EPC_OMEGA_FINAL.md, Parte
// 1): hoje só ~4 dos 10 campos são rastreados de verdade por motor
// existente (peso uniforme do Conselho, confidence, rationale/evidence).
// Os montadores abaixo preenchem SÓ o que é real e deixam o resto null
// explícito — nunca um valor fabricado pra "completar" o contrato (Regra
// de Ouro 3, fail-closed). Os campos null hoje são o mapa real do que uma
// evolução futura precisaria instrumentar, não um placeholder qualquer.
import type { CouncilDecision } from "./council";

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
