// chart-plot-area.ts — a FRONTEIRA entre o gráfico e o eixo de preço.
//
// ACHADO QUE ORIGINOU ESTE MÓDULO (medido, pedido direto do Operador sobre
// "a barra da lateral que fica a numeração dos ativos... os objetos ficar
// saindo do início deles pra entrar dentro do gráfico, e tem uma medida
// padrão ali"):
//
//   NENHUM dos 18 plugins de canvas deste projeto jamais mediu a largura do
//   eixo de preço. Todos desenham de `0` até `cssWidth` — e `cssWidth` é a
//   largura do CONTAINER INTEIRO, que inclui a faixa do eixo.
//
// Medição real (Chromium, viewport iPad 834px, mesmas opções de
// `rightPriceScale` que EnhancedChart_110_Percent usa em produção):
//
//   largura do container ............ 834 px
//   largura REAL do eixo ............  72 px   ← não é o minimumWidth 65:
//                                              a lib cresce o eixo para
//                                              caber os dígitos do preço
//   fim real da área de plotagem .... 762 px
//
// Consequência real, em duas formas:
//
//   1. TODA zona/faixa/linha de 6 plugins (InstitutionalZone,
//      LiquidityZones, NeuralMarketAura, SessionKeyLevels,
//      StructureBreakMarkers, TradePlanZone) corre 72 px POR BAIXO dos
//      números do eixo. Num terminal profissional a área de plotagem
//      termina na borda do eixo e nada vaza por baixo da numeração.
//
//   2. As etiquetas do eixo (PriceLabelStackPlugin) são alinhadas à borda
//      do CONTAINER (`cssWidth - 2 - boxWidth`), então cada uma começa num
//      X diferente conforme o texto — borda esquerda serrilhada — e as
//      largas invadem as velas. Medido com a fonte real do plugin:
//
//        "VWAP 68.412,5"  invade  20,3 px de vela
//        "R1 69.180,0"    invade   8,2 px de vela
//        "CHOCH"          invade      0 px  (mas começa 48 px à direita
//                                            da VWAP — daí o serrilhado)
//
// A REGRA (convenção de terminal, não invenção): o eixo é uma FAIXA, e
// tudo que pertence ao eixo se alinha à mesma borda esquerda dela. O que
// pertence ao gráfico termina nessa mesma borda. Uma linha só, dois lados.
//
// Este arquivo é a 4ª dimensão declarada do layout do gráfico, junto de:
//   chart-profile-lanes.ts      → faixas HORIZONTAIS (x)
//   chart-time-ribbon-lanes.ts  → faixas VERTICAIS (y)
//   chart-layer-depth.ts        → PROFUNDIDADE (z)
//   chart-plot-area.ts          → a FRONTEIRA com o eixo  ← este
//
// ── SEGUNDA FRONTEIRA, achada auditando o pedido do Operador sobre "o
//    livro de oferta aparecendo em cima do valor... cada item no seu
//    canto" ────────────────────────────────────────────────────────────
// chart-profile-lanes.ts já declara (getChartBodyBounds, header do
// arquivo) que "quem ancora no tempo deve clipar aqui em vez de desenhar
// de ponta a ponta" — mas medindo de verdade (harness Playwright,
// getImageData nos dois canvases): só OrderFlowHeatmapPlugin usava
// getChartBodyBounds. Os outros 9 plugins que chamam measurePlotArea
// (LiquidityZones/HarmonicGeometry/LiquiditySweepLines/AndrewsPitchfork/
// NeuralMarketAura/TradePlanZone/StructureBreakMarkers/SessionKeyLevels/
// InstitutionalZone) iam até plotRight, que só exclui o EIXO — nunca as
// lanes de perfil (Volume Profile/TPO/Order Book Depth, até 34% da
// largura quando as três estão ativas, o padrão). Medido: com as 3 lanes
// ativas, uma linha de SessionKeyLevelsPlugin desenhava de x=498 a
// x=837 num canvas de 900px, cobrindo por completo a lane do livro de
// ofertas (x=594-708) — a MESMA classe de sobreposição que motivou
// chart-profile-lanes.ts originalmente, só que entre um plugin de fora
// da família de perfis e os três de dentro dela.
//
// `measurePlotArea` ganha um 3º parâmetro OPCIONAL (`activeLanes`) —
// quando presente, `plotRight` já exclui a reserva real das lanes
// ativas, e todo consumidor que já chama `measurePlotArea(chart,
// cssWidth)` continua funcionando sem mudança nenhuma (aditivo, nunca
// uma mudança de contrato pros que não passarem o novo argumento).
import type { IChartApi } from "lightweight-charts";
import { getChartRightEdgeFraction, type ChartProfileLaneId } from "./chart-profile-lanes";

/** Folga entre o fim do desenho e a borda do eixo. É a "medida padrão"
 *  que o Operador descreveu: sem ela uma zona encosta no número do preço e
 *  os dois se leem como uma coisa só. 4px é o mesmo respiro que a própria
 *  lib deixa entre o tick e a borda do eixo — não um número a gosto. */
export const PLOT_AXIS_GAP_PX = 4;

/** Largura de eixo usada quando a medição real não está disponível (chart
 *  ainda não montou, eixo invisível, teste sem DOM). É o `minimumWidth`
 *  real configurado em EnhancedChart_110_Percent — o mesmo valor que a lib
 *  usaria como piso — nunca um zero, que faria o desenho voltar a vazar
 *  por baixo do eixo justamente no primeiro frame. */
export const PLOT_AXIS_FALLBACK_WIDTH_PX = 65;

// ── LARGURA DO EIXO SOB DEMANDA ────────────────────────────────────────
// SEGUNDO ACHADO, medido depois de alinhar a coluna: alinhar não bastou.
// A etiqueta mais larga do conjunto real ("VWAP 68.412,5" = 90,3 px) NÃO
// CABE num eixo de 72 px, então a coluna inteira desliza 20,3 px para
// dentro das velas. Antes eram 4 bordas serrilhadas invadindo em medidas
// diferentes; depois da coluna virou uma borda só invadindo 20,3 px — mais
// arrumado, mas ainda por cima do gráfico.
//
// A causa raiz: a lib dimensiona o eixo para caber os DÍGITOS DO PREÇO. Ela
// não tem como saber que este app desenha por cima "VWAP ", "R1 ", "CHOCH"
// — prefixos que só o PriceLabelStackPlugin conhece. O eixo é estreito
// demais para o conteúdo real que ele carrega neste terminal.
//
// A correção é a que qualquer terminal profissional aplica: o eixo tem a
// largura do seu próprio conteúdo. O plugin já mede a etiqueta mais larga a
// cada frame (precisa disso para a coluna); essa medida passa a alimentar o
// `minimumWidth` real do eixo.
//
// DUAS TRAVAS, porque mexer no eixo durante o desenho pode oscilar:
//   1. QUANTIZAÇÃO em degraus de 8 px — um preço que ganha/perde um dígito
//      não faz o gráfico tremer a cada tick. Terminal profissional nenhum
//      re-larga o eixo a cada atualização de preço.
//   2. TETO de 140 px — uma etiqueta patológica não pode comer o gráfico.
//      Acima do teto ela volta a invadir, e isso é o comportamento certo:
//      preferir uma invasão pequena a um gráfico espremido.
export const AXIS_WIDTH_STEP_PX = 8;
export const AXIS_WIDTH_MAX_PX = 140;

/**
 * Largura de eixo que comporta a etiqueta mais larga realmente desenhada.
 * PURA — o `applyOptions` real vive no plugin, aqui só a decisão.
 *
 * Devolve `null` quando nada precisa mudar: entrada inválida, ou a largura
 * necessária já cabe no eixo atual. `null` é o caso comum e significa
 * "não toque no eixo" — nunca um valor igual ao atual, que ainda assim
 * dispararia um applyOptions inútil a cada frame.
 */
export function resolveAxisWidthForLabels(
  larguraDaEtiquetaMaisLarga: number,
  larguraAtualDoEixo: number,
  margemDireita: number,
): number | null {
  if (!Number.isFinite(larguraDaEtiquetaMaisLarga) || larguraDaEtiquetaMaisLarga <= 0) return null;
  if (!Number.isFinite(margemDireita) || margemDireita < 0) return null;
  const necessaria = larguraDaEtiquetaMaisLarga + margemDireita;
  const emDegraus = Math.ceil(necessaria / AXIS_WIDTH_STEP_PX) * AXIS_WIDTH_STEP_PX;
  const alvo = Math.min(
    AXIS_WIDTH_MAX_PX,
    Math.max(PLOT_AXIS_FALLBACK_WIDTH_PX, emDegraus),
  );
  const atual = Number.isFinite(larguraAtualDoEixo) ? larguraAtualDoEixo : 0;
  // Histerese: cresce assim que falta espaço; só encolhe quando sobra um
  // degrau INTEIRO. Sem isso, uma etiqueta oscilando em volta de um degrau
  // faria o eixo alternar de largura sem parar.
  if (alvo > atual) return alvo;
  if (alvo <= atual - AXIS_WIDTH_STEP_PX) return alvo;
  return null;
}

export interface PlotArea {
  /** x onde o desenho do GRÁFICO deve parar (já com a folga padrão). */
  plotRight: number;
  /** x onde a faixa do EIXO começa. É a borda esquerda compartilhada por
   *  toda etiqueta de eixo — a que acaba com o serrilhado. */
  axisLeft: number;
  /** Largura real do eixo, como medida (ou o fallback). */
  axisWidth: number;
}

/**
 * Fronteira a partir de larguras já medidas. Função PURA — é ela que os
 * testes de execução real exercitam; a medição do chart vive em
 * `measurePlotArea` abaixo.
 *
 * Fail-closed em toda entrada inválida: largura de eixo não-finita ou
 * negativa cai no fallback, nunca em 0 (0 significaria "o gráfico vai até
 * a borda", que é exatamente o defeito que este módulo corrige). Um eixo
 * mais largo que o próprio container também não pode produzir um
 * `plotRight` negativo — nesse caso a área de plotagem é 0, honestamente.
 *
 * `reservedRightPx` (opcional, default 0): reserva ADICIONAL além do
 * eixo — hoje só as lanes de perfil (ver `measurePlotArea`), mas
 * qualquer faixa futura reservada na borda direita passa por aqui, nunca
 * um clip próprio de cada plugin. Negativo é tratado como 0 (nunca
 * EXPANDE plotRight além do que o eixo sozinho já permite).
 */
export function resolvePlotArea(
  cssWidth: number,
  axisWidth: number,
  reservedRightPx: number = 0,
): PlotArea {
  const w = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : 0;
  const rawAxis =
    Number.isFinite(axisWidth) && axisWidth > 0 ? axisWidth : PLOT_AXIS_FALLBACK_WIDTH_PX;
  // Eixo nunca pode comer mais que o container inteiro.
  const axis = Math.min(rawAxis, w);
  const axisLeft = w - axis;
  const reserved = Number.isFinite(reservedRightPx) && reservedRightPx > 0 ? reservedRightPx : 0;
  return {
    axisWidth: axis,
    axisLeft,
    plotRight: Math.max(0, axisLeft - PLOT_AXIS_GAP_PX - reserved),
  };
}

/**
 * Mede a fronteira real no chart vivo. Wrapper fino sobre
 * `priceScale('right').width()` — a API pública que devolve a largura real
 * do eixo (ou 0 quando invisível, caso em que o fallback entra).
 *
 * Existe como função própria, e não inline em cada plugin, pelo mesmo
 * motivo de `chart-layer-depth.ts`: 18 plugins precisando da mesma resposta
 * é uma decisão só, nunca 18 cópias que divergem em silêncio.
 *
 * `activeLanes` (opcional): quando um plugin passa as lanes de perfil
 * REALMENTE ativas agora (o mesmo `activeProfileLanes` que
 * EnhancedChart_110_Percent.tsx já calcula pra VolumeProfile/TPO/Order
 * Book Depth), `plotRight` já vem descontado da reserva real dessas
 * lanes — nunca mais uma linha/zona cruzando por cima do livro de
 * ofertas ou dos perfis de volume. Omitir o argumento preserva o
 * comportamento antigo (só o eixo) — aditivo, nunca uma mudança de
 * contrato pra quem já chamava `measurePlotArea(chart, cssWidth)`.
 */
export function measurePlotArea(
  chart: IChartApi | null,
  cssWidth: number,
  activeLanes?: readonly ChartProfileLaneId[],
): PlotArea {
  let axisWidth = PLOT_AXIS_FALLBACK_WIDTH_PX;
  try {
    const measured = chart?.priceScale("right").width();
    if (typeof measured === "number" && Number.isFinite(measured) && measured > 0) {
      axisWidth = measured;
    }
  } catch {
    // Eixo ainda não montado / id inexistente: o fallback já cobre, e
    // engolir aqui é o certo — um overlay nunca deve derrubar o gráfico
    // por não conseguir medir uma borda.
  }
  const reservedRightPx = activeLanes ? getChartRightEdgeFraction(activeLanes) * cssWidth : 0;
  return resolvePlotArea(cssWidth, axisWidth, reservedRightPx);
}
