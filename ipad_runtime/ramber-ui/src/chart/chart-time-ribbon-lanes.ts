// chart-time-ribbon-lanes.ts — Achado 2.6 (Visual Cleanup & Rendering
// Audit, 5ª rodada). Reclamação direta do Operador, segunda vez sobre o
// MESMO objeto: "aquelas outra vertical descendo... do mercado aberto
// fechado, ela não devia descer não, ela devia aparecer bem pequenininha
// só uma... não precisa poluir tanto o gráfico".
//
// Estado real antes desta rodada: das 2 camadas de CONTEXTO DE TEMPO do
// gráfico, só uma tinha geometria contida.
//   - MarketSessionBandsPlugin: já corrigido 2x (linha de altura total →
//     faixa de 14px no topo). Contido.
//   - KillZoneBandsPlugin: `fillRect(x, 0, w, cssHeight)` + 2 bordas
//     verticais de `0` a `cssHeight` — coluna âmbar de altura TOTAL. O
//     header do próprio arquivo já registrava uma reclamação anterior do
//     Operador com as mesmas palavras ("essas linhas amarelas descendo de
//     cima pra baixo estão atrapalhando o gráfico"), mas a correção
//     daquela vez mexeu só em QUANTAS ocorrências desenhavam (a mais
//     recente por janela), nunca na ALTURA de cada uma. A causa raiz
//     ("desce o gráfico inteiro") seguiu intacta — por isso a mesma
//     reclamação voltou.
//
// Além da altura, havia o problema que este módulo existe para resolver de
// vez: as duas camadas são a MESMA família semântica (onde estamos no dia
// — sessão de mercado e kill zone são ambas JANELAS DE TEMPO, nunca níveis
// de preço), mas cada uma decidia sozinha sua geometria vertical. Nada
// impedia que uma passasse a desenhar por cima da outra na próxima
// evolução — exatamente o bug de classe que chart-profile-lanes.ts já
// resolveu para os 3 perfis do lado direito (Volume Profile/TPO/Depth,
// que colidiam de fato). Este módulo é a mesma técnica, aplicada ao eixo
// VERTICAL da faixa de tempo do topo, ANTES de a colisão acontecer.
//
// Ordem real (topmost primeiro): sessão de mercado (partição contínua —
// sempre há exatamente uma sessão corrente, é o pano de fundo mais
// estável) e depois kill zone (janelas esparsas dentro do dia, contexto
// mais fino). Cada lane conhece só a própria altura; a posição vem da
// soma das anteriores — mudar a ordem aqui move todas automaticamente,
// nenhum plugin hardcoda a posição do vizinho.
//
// LEI 24: puro contexto temporal, display only — nunca uma decisão.
export type ChartTimeRibbonLaneId = "market_session" | "kill_zone";

const LANE_ORDER: readonly ChartTimeRibbonLaneId[] = ["market_session", "kill_zone"];

// market_session: 14px é o valor JÁ real do plugin (BAND_HEIGHT_PX, fixado
//   na "Lapidação por feedback direto do Operador") — precisa comportar a
//   caixa de rótulo de 13px de nexus/canvas-label.ts (9px de fonte +
//   2×CANVAS_LABEL_PAD_Y). Adotar o mesmo número aqui é migração de
//   geometria pura: zero mudança visual nessa camada.
// kill_zone: 6px de propósito — deliberadamente ABAIXO da altura de uma
//   caixa de rótulo, porque esta lane não desenha rótulo nenhum (ver
//   header de KillZoneBandsPlugin.tsx: o nome da janela ativa já vive no
//   badge "Kill Zone ·" do header de App.tsx, então repeti-lo no canvas
//   era a mesma duplicação literal que já tinha sido removida da 2ª linha
//   da faixa de sessões). "Bem pequenininha", nas palavras do pedido —
//   marca QUANDO e POR QUANTO TEMPO (extensão em x, idêntica à de antes)
//   e QUÃO RECENTE (alpha do decaimento real, idêntico ao de antes), que
//   é tudo que uma camada de fundo de tempo precisa carregar.
const LANE_HEIGHT_PX: Record<ChartTimeRibbonLaneId, number> = {
  market_session: 14,
  kill_zone: 6,
};

/** Altura real (px CSS) da faixa desta camada. Fail-closed: id não
 *  cadastrado devolve 0 (nunca NaN/undefined) — no pior caso uma camada
 *  nova desconhecida não desenha nada em vez de desenhar fora do lugar. */
export function getTimeRibbonLaneHeightPx(id: ChartTimeRibbonLaneId): number {
  return LANE_HEIGHT_PX[id] ?? 0;
}

/** Topo real (px CSS, a partir de y=0 do canvas) da faixa desta camada —
 *  soma a altura de todas as lanes que vêm ANTES dela em LANE_ORDER.
 *  Fail-closed: id não cadastrado devolve 0 (mesmo contrato de
 *  getProfileLaneOffsetFraction em chart-profile-lanes.ts). */
export function getTimeRibbonLaneTopPx(id: ChartTimeRibbonLaneId): number {
  const index = LANE_ORDER.indexOf(id);
  if (index < 0) return 0;
  let top = 0;
  for (let i = 0; i < index; i++) top += LANE_HEIGHT_PX[LANE_ORDER[i]];
  return top;
}

/** Base real (px CSS) da faixa desta camada — topo + altura. É o limite
 *  vertical que o desenho da camada NUNCA pode ultrapassar (nem o
 *  preenchimento, nem o traço de 1px das bordas). */
export function getTimeRibbonLaneBottomPx(id: ChartTimeRibbonLaneId): number {
  return getTimeRibbonLaneTopPx(id) + getTimeRibbonLaneHeightPx(id);
}

/** Altura total real da faixa de contexto de tempo (todas as lanes
 *  somadas). Fonte única para qualquer camada futura que precise saber
 *  quanto do topo já está reservado antes de desenhar. */
export const TIME_RIBBON_TOTAL_HEIGHT_PX = LANE_ORDER.reduce((sum, id) => sum + LANE_HEIGHT_PX[id], 0);
