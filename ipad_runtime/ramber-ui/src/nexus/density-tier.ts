// density-tier.ts — Ordem 3 "PROFESSIONAL MARKET TERMINAL" §40 (TERMINAL
// DENSITY): "O terminal deve possuir níveis: COMPACT / STANDARD / EXPANDED.
// STANDARD deve ser o padrão." Puro, Laboratório de Evolução — classifica a
// largura real do viewport, ainda não ligado a nenhum componente visível.
//
// Os DOIS limiares abaixo não são números novos: são os MESMOS já reais e
// testados em produção, reaproveitados em vez de inventar um terceiro
// critério (mesma disciplina de `resolveChartUltraWideScale`, que este
// arquivo cita como precedente direto):
//   • 1120px — `min-[1120px]:` já alterna terminal-strip/terminal-grid/
//     cyber-panel entre estreito e largo em App.tsx (Ordem "UX Audit"),
//     hoje um interruptor binário nunca nomeado como "densidade". Abaixo
//     disso é exatamente a faixa real de iPad Mini/iPad Pro em retrato
//     (768-1024px) e paisagem estreita.
//   • 1440px — o mesmo piso onde `resolveChartUltraWideScale`
//     (chart/chart-ultrawide-scale.ts) já classifica a tela como "monitor
//     grande" e começa a escalar fonte/offset do próprio gráfico.
// O meio-termo entre os dois (1120-1439px) é onde iPad landscape e a
// maioria dos laptops caem — por isso é o padrão STANDARD, nunca um dos
// extremos.
export type DensityTier = "COMPACT" | "STANDARD" | "EXPANDED";

/** Último px ainda "estreito" pelo interruptor já real de App.tsx. */
export const DENSITY_COMPACT_MAX_PX = 1119;
/** Mesmo piso de `resolveChartUltraWideScale` para "monitor grande". */
export const DENSITY_EXPANDED_MIN_PX = 1440;

/** Nível de densidade real para esta largura de viewport.
 *
 *  Fail-closed: largura não-finita/não-positiva (container ainda não
 *  medido, acontece de verdade no primeiro render antes do
 *  ResizeObserver/window.innerWidth resolver) cai em STANDARD — o
 *  meio-termo, nunca o extremo mais apertado nem o mais largo, para nunca
 *  sub- ou super-comprimir a UI antes da 1ª medição real. */
export function resolveDensityTier(viewportWidthPx: number): DensityTier {
  if (!Number.isFinite(viewportWidthPx) || viewportWidthPx <= 0) return "STANDARD";
  if (viewportWidthPx <= DENSITY_COMPACT_MAX_PX) return "COMPACT";
  if (viewportWidthPx >= DENSITY_EXPANDED_MIN_PX) return "EXPANDED";
  return "STANDARD";
}
