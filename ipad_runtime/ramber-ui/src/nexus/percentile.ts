// percentile.ts — percentil real compartilhado (Regra de Ouro 1: nunca um
// limiar fixo arbitrário inventado). Extraído de orderflow-history.ts
// ("trade grande") e volume-profile.ts (HVN/LVN) — achado real de
// auditoria (FASE Ω Priority 3): as duas já implementavam a MESMA fórmula
// de forma independente, mesma classe de duplicação que fractal-swings.js
// já resolveu para detecção de swing high/low.
//
// Valor SEMPRE um ponto real da própria amostra ordenada — nunca
// interpolado entre dois candidatos, nunca sintetizado. `sorted` deve
// chegar já ordenado ascendente (o chamador decide o critério de ordenação
// real do seu próprio domínio); esta função não reordena.
export function realPercentile(sorted: number[], p: number): number {
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx];
}
