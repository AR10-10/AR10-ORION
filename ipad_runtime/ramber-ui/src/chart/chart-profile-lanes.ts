// chart-profile-lanes.ts — achado real (reclamação direta do Operador:
// "o sistema agora tem camada duplicada... tipo o volume profile, o
// volume"): VolumeProfilePlugin, TpoProfilePlugin e DepthChartPlugin
// desenhavam TODOS a partir do mesmo `cssWidth` (barras/POC/paredes
// ancoradas à borda direita do canvas) — mesma faixa exata de pixels
// sempre que mais de um estivesse visível ao mesmo tempo. Isso não é
// raro: os 3 defaults (DEFAULT_CHART_LAYER_VISIBILITY e
// DEFAULT_CHART_LAYER_AUTO_MODE em EnhancedChart_110_Percent.tsx) são
// `true`, e a relevância automática de cada um (nexus/layer-relevance.ts)
// é independente das outras duas — `order_book_depth` fica relevante
// assim que há um livro real conectado, `tpo_profile` assim que a sessão
// tem candles suficientes (os dois são checagens de EXISTÊNCIA, quase
// sempre verdadeiras), e `volume_profile` só quando o preço vivo está
// perto de um POC/HVN real (checagem de PROXIMIDADE, mais rara mas real).
// Nenhuma das três sabia da existência das outras — três plugins
// desenhando cada um pensando que era dono exclusivo do lado direito.
//
// Precedente já existente no próprio código: LiquidationHeatmapPlugin já
// ancora à ESQUERDA de propósito, comentário original (OMEGA CORE V-MAX
// Fase 8.1) — "de propósito, para os dois heatmaps por preço coexistirem
// sem se sobrepor visualmente". O mesmo raciocínio nunca tinha sido
// aplicado ENTRE os três perfis do lado direito.
//
// Este módulo dá a cada plugin da família uma lane própria e exclusiva —
// nunca cruza pra lane vizinha — em vez de cada um assumir sozinho que
// `cssWidth` é seu próprio limite direito. Ordem real (rightmost = mais
// perto do eixo de preço): Volume Profile (métrica mais universal — POC
// de volume é o que todo terminal profissional já mostra por padrão,
// preserva o exato comportamento visual de hoje, offset 0), TPO Profile
// (2ª lane), Order Book Depth (3ª lane, mais larga — só 8 níveis reais
// por lado, cada um precisa de espaço legível, ver header de
// DepthChartPlugin.tsx). Frações reduzidas frente aos valores antigos e
// independentes (VP 0.16 inalterado, TPO 0.16→0.14, Depth 0.22→0.18)
// para manter as 3 lanes somadas num orçamento real de tela (0.48 no
// pior caso, os 3 relevantes ao mesmo tempo) em vez de empilhar os
// valores antigos sem repensar nenhum (0.54).
//
// Nota honesta de escopo: isto resolve a COLISÃO GEOMÉTRICA (nunca mais
// pixels de um perfil cobrem pixels de outro) — nunca decide SE os três
// devem aparecer juntos (isso é papel do Relevance Engine/visibilidade
// manual, uma decisão de conteúdo, não de geometria; misturar as duas
// destruiria dado real — Regra de Ouro 4).
export type ChartProfileLaneId = "volume_profile" | "tpo_profile" | "order_book_depth";

// Ordem = ordem de empilhamento a partir da borda direita. Mudar a ordem
// aqui move todas as lanes automaticamente — nenhum plugin hardcoda a
// posição das outras.
const LANE_ORDER: readonly ChartProfileLaneId[] = ["volume_profile", "tpo_profile", "order_book_depth"];

const LANE_WIDTH_FRACTION: Record<ChartProfileLaneId, number> = {
  volume_profile: 0.16,
  tpo_profile: 0.14,
  order_book_depth: 0.18,
};

/** Largura máxima real (fração do cssWidth) que a MAIOR barra/nível desta
 *  lane pode ocupar — mesmo papel do antigo MAX_BAR_WIDTH_FRACTION local
 *  de cada plugin, agora de fonte única (nunca duas cópias do mesmo
 *  número podendo divergir). */
export function getProfileLaneWidthFraction(id: ChartProfileLaneId): number {
  return LANE_WIDTH_FRACTION[id];
}

/** Distância real (fração do cssWidth) entre a borda direita do canvas e
 *  o início da lane deste plugin — soma a largura de todas as lanes que
 *  vêm ANTES dele em LANE_ORDER. Fail-closed: id não cadastrado devolve 0
 *  (nunca NaN/undefined) — no pior caso um plugin novo desconhecido
 *  volta ao comportamento antigo (ancorado no próprio cssWidth) em vez
 *  de quebrar o desenho. */
export function getProfileLaneOffsetFraction(id: ChartProfileLaneId): number {
  const index = LANE_ORDER.indexOf(id);
  if (index < 0) return 0;
  let offset = 0;
  for (let i = 0; i < index; i++) offset += LANE_WIDTH_FRACTION[LANE_ORDER[i]];
  return offset;
}

/** Borda direita real (em px CSS) da lane deste plugin, dado o cssWidth
 *  real do canvas — cada plugin usa este valor no lugar do `cssWidth`
 *  puro em TODO desenho ancorado à direita (fillRect/strokeRect/moveTo/
 *  lineTo/posição de label). Para volume_profile (offset 0) o valor é
 *  idêntico a cssWidth — zero mudança visual para essa lane. */
export function getProfileLaneRightEdgePx(id: ChartProfileLaneId, cssWidth: number): number {
  return cssWidth - getProfileLaneOffsetFraction(id) * cssWidth;
}

/** Largura máxima real (em px CSS) da maior barra/nível desta lane, dado
 *  o cssWidth real do canvas — substitui `cssWidth * MAX_BAR_WIDTH_FRACTION`. */
export function getProfileLaneMaxBarWidthPx(id: ChartProfileLaneId, cssWidth: number): number {
  return getProfileLaneWidthFraction(id) * cssWidth;
}
