// consensus-engine.ts — GMIL LEI 04 (Multi Source Consensus Engine): combina
// as leituras normalizadas de todos os provedores num único
// GLOBAL_CONSENSUS_SCORE, ponderado por qualidade (quality-engine.ts).
//
// LEI 01 é absoluta aqui: este score é SOMENTE contexto consultivo. Ele
// nunca é lido por engine-bridge.ts, nunca influencia o Core Engine (a
// heurística de tendência que decide LONG/SHORT/WAIT), o classificador
// k-NN Lorentziano ou o Signal Engine — não há nenhum import nessa direção
// em todo o código. sample_size é sempre reportado (mesmo princípio do
// classificador Lorentziano: amostra pequena não vira confiança inflada).

export interface ConsensusInput {
  providerId: string;
  lean: number | null; // -1..1, normalização documentada em cada provider
  weight: number; // 0..1, vindo de quality-engine.computeQuality().weight
}

export interface ConsensusResult {
  score: number | null; // -1..1, null se nenhum provedor utilizável
  sampleSize: number;
  contributingProviders: string[];
}

export function computeConsensus(inputs: ConsensusInput[]): ConsensusResult {
  const usable = inputs.filter(
    (i): i is ConsensusInput & { lean: number } => i.weight > 0 && i.lean !== null && Number.isFinite(i.lean),
  );
  if (!usable.length) return { score: null, sampleSize: 0, contributingProviders: [] };

  const totalWeight = usable.reduce((acc, i) => acc + i.weight, 0);
  if (totalWeight <= 0) return { score: null, sampleSize: 0, contributingProviders: [] };

  const weightedSum = usable.reduce((acc, i) => acc + i.lean * i.weight, 0);
  return {
    score: weightedSum / totalWeight,
    sampleSize: usable.length,
    contributingProviders: usable.map((i) => i.providerId),
  };
}
