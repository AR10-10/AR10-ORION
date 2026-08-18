// floating-widget-origin.ts — onde um painel FLUTUANTE nasce na tela.
//
// ACHADO MEDIDO (reclamação direta do Operador: "tem uma barrinha aqui, as
// ordens de compra e venda, que fica flutuante e atrapalha o campo de visão
// do operador... nada pode atrapalhar, tem que ter uma visão perfeita"):
//
//   Widget (App.tsx), modo flutuante:
//     <Rnd default={{ x: 100, y: 100, width: 400, height: 350 }} ... />
//
//   x: 100, y: 100 — LITERAL, IGUAL PARA TODOS. Consequências reais:
//
//   1. (100, 100) cai em cima do canto superior esquerdo do gráfico, que é
//      exatamente onde moram a faixa de Market Sessions (topo), o aviso
//      "SEM PLANO DO CONSELHO" (left-2 top-7) e o início da série de velas.
//      É o pior ponto possível da tela para largar um painel opaco de
//      400×350.
//   2. TODO painel flutuante nasce no MESMO pixel. Dois flutuantes abertos
//      ficam perfeitamente empilhados, e o de baixo desaparece por completo
//      até o Operador arrastar o de cima.
//   3. É constante: não sabe se a tela é um iPad de 834px ou um monitor de
//      3440px. No iPad, 100 + 400 = 500 de 834 — mais de metade da largura
//      útil coberta.
//
// A REGRA (convenção de terminal profissional, não invenção): painel
// flutuante nasce ANCORADO NO CANTO INFERIOR DIREITO da área útil, que é o
// canto de menor densidade de informação neste layout — o eixo de preço fica
// à direita mas ocupa uma faixa estreita, e a ação recente das velas cresce
// da esquerda para a direita na METADE SUPERIOR. Nasce fora do caminho e o
// Operador move para onde quiser (Rnd continua livre; isto é só o ponto de
// partida, nunca uma prisão).
//
// E cada painel ganha um DESLOCAMENTO próprio, derivado do seu id, para dois
// flutuantes nunca nascerem no mesmo pixel — o defeito 2 acima.

/** Tamanho padrão do painel flutuante — o mesmo já em produção no Rnd. */
export const FLOATING_WIDGET_WIDTH = 400;
export const FLOATING_WIDGET_HEIGHT = 350;

/** Respiro até a borda da janela. */
const EDGE_MARGIN = 16;

/** Altura real da barra de comando (TopBar: h-[46px] + a 2ª linha do Trade
 *  Plan). Um flutuante nunca deve nascer por cima dela — é a leitura mais
 *  essencial da tela (preço + CoreSignalBadge). */
const HEADER_SAFE_TOP = 96;

/** Largura da régua de navegação esquerda (SideBar). Nascer por cima dela
 *  esconderia os próprios botões que abrem/fecham painéis. */
const RAIL_SAFE_LEFT = 64;

/** Passo do escalonamento entre painéis diferentes. 28px é o suficiente para
 *  a barra de título do painel de baixo aparecer (cyber-header tem ~24px) —
 *  ou seja, o Operador VÊ que existe um segundo painel e consegue agarrá-lo,
 *  em vez de ele sumir por completo atrás do primeiro. */
const STAGGER_STEP = 28;

/** Quantas posições distintas antes de repetir. 4 mantém o último degrau
 *  (3 × 28 = 84px) bem dentro da área útil mesmo num iPad em retrato. */
const STAGGER_SLOTS = 4;

/** Deslocamento determinístico a partir do id — mesmo painel, mesmo lugar,
 *  toda sessão (nada de aleatório: Regra de Ouro 1, e um painel que pula de
 *  lugar a cada abertura seria pior que o defeito original). Soma simples
 *  dos códigos dos caracteres: só precisa espalhar ids curtos e distintos
 *  ("orderbook", "orderflow", "heatmap"), não ser uma hash criptográfica. */
export function floatingWidgetSlot(id: string | null | undefined, slots = STAGGER_SLOTS): number {
  if (typeof id !== "string" || id.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return sum % slots;
}

export interface FloatingWidgetOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Canto superior esquerdo REAL onde este painel flutuante deve nascer.
 *
 * Fail-closed: viewport inválida (SSR, teste, medida ainda não disponível)
 * cai no ponto seguro de sempre — nunca devolve NaN nem uma coordenada
 * negativa que jogaria o painel para fora da tela.
 */
export function resolveFloatingWidgetOrigin(
  id: string | null | undefined,
  viewportWidth: number,
  viewportHeight: number,
  width = FLOATING_WIDGET_WIDTH,
  height = FLOATING_WIDGET_HEIGHT,
): FloatingWidgetOrigin {
  const validW = Number.isFinite(viewportWidth) && viewportWidth > 0;
  const validH = Number.isFinite(viewportHeight) && viewportHeight > 0;
  if (!validW || !validH) {
    return { x: RAIL_SAFE_LEFT + EDGE_MARGIN, y: HEADER_SAFE_TOP, width, height };
  }

  const slot = floatingWidgetSlot(id);
  const offset = slot * STAGGER_STEP;

  // Âncora: canto inferior direito, subindo/andando para a esquerda a cada
  // degrau do escalonamento — nunca para a direita/baixo, que sairia da tela.
  const anchoredX = viewportWidth - width - EDGE_MARGIN - offset;
  const anchoredY = viewportHeight - height - EDGE_MARGIN - offset;

  // As duas travas de segurança, nesta ordem: nunca por cima da régua
  // esquerda, nunca por cima da barra de comando. Em telas pequenas demais
  // para o painel inteiro, o clamp vence a âncora — melhor um painel
  // parcialmente fora da borda inferior/direita (que o Operador arrasta) do
  // que um painel cobrindo o preço e os controles.
  const x = Math.max(RAIL_SAFE_LEFT + EDGE_MARGIN, anchoredX);
  const y = Math.max(HEADER_SAFE_TOP, anchoredY);

  return { x, y, width, height };
}
