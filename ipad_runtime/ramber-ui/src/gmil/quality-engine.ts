// quality-engine.ts — GMIL LEI 05 (Data Quality Engine): converte a saúde
// observada de um provedor (latência, idade da última leitura boa, falhas
// consecutivas, estado do circuito) num peso 0..1 usado pelo
// consensus-engine. Degradação real reduz o peso automaticamente — nunca
// precisa de intervenção manual, e um provedor com circuito ABERTO tem
// peso zero (não contamina o consenso enquanto não provar recuperação).

import type { CircuitState } from './circuit-breaker';

export interface ProviderMetrics {
  latencyMs: number | null;
  consecutiveFailures: number;
  ageMs: number | null; // now - timestamp da última leitura BEM-SUCEDIDA
  circuitState: CircuitState;
}

export interface QualityScore {
  latencyScore: number;
  freshnessScore: number;
  reliabilityScore: number;
  weight: number;
}

const LATENCY_BUDGET_MS = 5_000; // acima disso, score de latência satura em 0
const FRESHNESS_BUDGET_MS = 5 * 60_000; // leitura com +5min vira irrelevante
const FAILURE_BUDGET = 5; // 5 falhas consecutivas satura reliability em 0

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function computeQuality(metrics: ProviderMetrics): QualityScore {
  // Circuito aberto = provedor comprovadamente instável agora; peso zero
  // independente das outras métricas até ele passar pela sonda HALF_OPEN.
  if (metrics.circuitState === 'OPEN') {
    return { latencyScore: 0, freshnessScore: 0, reliabilityScore: 0, weight: 0 };
  }

  const latencyScore = metrics.latencyMs === null ? 0.5 : clamp01(1 - metrics.latencyMs / LATENCY_BUDGET_MS);
  const freshnessScore = metrics.ageMs === null ? 0 : clamp01(1 - metrics.ageMs / FRESHNESS_BUDGET_MS);
  const reliabilityScore = clamp01(1 - metrics.consecutiveFailures / FAILURE_BUDGET);
  const weight = clamp01((latencyScore + freshnessScore + reliabilityScore) / 3);

  return { latencyScore, freshnessScore, reliabilityScore, weight };
}
