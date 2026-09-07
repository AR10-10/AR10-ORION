// chart-safe-zone.ts — ORDEM 2A ("Fechar gap de notificações / Chart
// Spatial Safety"): geometria PURA que decide onde AlertToastStack pode
// desenhar sem NUNCA invadir a região real do gráfico (candles/price
// axis/TP/stop/Decision Arrow/Structure Trace).
//
// ACHADO MEDIDO (ORDEM 2, item 8, Playwright real, não suposição):
// AlertToastStack vivia em `bottom-3 right-3` (canto inferior direito,
// 256px) — invadindo ~195px do gráfico num viewport 1366×1024 real.
// RightRail só tem 48-56px (`w-12 md:w-14`); o gráfico ocupa toda a
// largura restante — não existe margem livre nesse canto em nenhuma
// resolução testada.
//
// POR QUE NÃO plotRight/chart-plot-area.ts (auditado antes de construir,
// §5 da ordem): aquele módulo mede a fronteira candle×eixo DENTRO do
// sistema de coordenadas do próprio canvas do gráfico (offset relativo
// ao `<div ref={containerRef}>`) — útil para os plugins que já vivem
// dentro dessa árvore. AlertToastStack é `position:fixed` e monta direto
// em App(), fora de qualquer tab/widget — precisa da posição do gráfico
// em coordenadas de VIEWPORT (`getBoundingClientRect` real), que nenhum
// módulo existente calculava. Esta é a peça que faltava, não uma segunda
// versão da mesma conta.
//
// POR QUE NÃO alargar RightRail (§5, também auditado): medido — 48-56px,
// estreito demais pra um toast de 256px. Alargá-la quando há alertas
// faria o GRÁFICO INTEIRO reflow (resize real) a cada alerta transitório
// (5s, auto-dismiss) — mais instabilidade visual do que o problema
// original.
//
// PRECEDENTE JÁ VALIDADO NESTE CÓDIGO (reaproveitado, não redescoberto):
// DataFreshnessBanner/UpdateAvailableBanner já vivem no canto superior
// direito — o comentário original de ambos já documenta "medido ao vivo
// (Playwright) que... o canto superior direito é o único ponto
// confirmado vazio em qualquer largura testada". Este módulo estende
// essa MESMA faixa seguindo o mesmo precedente, mas delimita a altura
// dinamicamente pelo topo REAL do gráfico — nunca um valor fixo, porque
// o gráfico pode ser maximizado (App.tsx já documenta esse modo: "quando
// o gráfico está maximizado cobrindo a barra"), removendo a faixa livre
// por completo.

export interface ToastPlacement {
  /** px do topo real do viewport onde o stack começa. */
  top: number;
  /** px da borda direita real do viewport. */
  right: number;
  /** Altura MÁXIMA que o stack inteiro pode ocupar — garantia real:
   *  `top + maxHeight` nunca alcança o topo do gráfico (item 1/3 da
   *  ordem: nunca cobrir candles/TP/stop/Decision/Structure Trace/price
   *  axis), mesmo com N toasts simultâneos (item 7). */
  maxHeight: number;
  /** Quantos cartões completos cabem de verdade na faixa livre, do mais
   *  urgente pro menos — nunca mais que isso desenha ao mesmo tempo.
   *  Pode ser 0 no caso extremo (gráfico maximizado colando no topo do
   *  viewport): aí a decisão correta é NÃO desenhar nada, nunca sobrepor
   *  (item 3: "nunca simplesmente deixar o toast sobre o gráfico"). Os
   *  alertas não somem do estado — `alerts` continua com o histórico
   *  completo (Regra de Ouro 4); só quantos CARTÕES aparecem ao mesmo
   *  tempo é limitado, mesmo padrão de `selectRelevantLabels`
   *  (price-label-stack.ts) podando por relevância sem apagar dado. */
  maxVisible: number;
  /** true quando a faixa livre não cabe nem um cartão completo (só a
   *  linha compacta de 1 alerta) — o chamador troca a apresentação, a
   *  garantia de posição/altura já vale de qualquer forma. */
  compact: boolean;
}

const MARGIN = 12; // mesmo valor de bottom-3/right-3 original (12px = 0.75rem), só reaplicado no topo.
// DataFreshnessBanner (top-1 ≈ 4px) + UpdateAvailableBanner (top-9 = 36px,
// ~28px de altura própria) já ocupam o topo desta mesma faixa — o stack
// prefere começar abaixo dos dois quando há espaço real pra isso.
const BELOW_EXISTING_BANNERS = 68;
// Altura real de um cartão de alerta completo (título + mensagem +
// padding, medida no JSX de AlertToastStack) — parâmetro documentado
// (mesma natureza dos limiares 70/30 do RSI ou dos tiers de opacidade em
// TradePlanZonePlugin.tsx), não uma medição de pixel exata.
const CARD_HEIGHT = 64;
// Uma linha compacta ("N alertas"), usada só quando nem um cartão
// completo cabe — último degrau antes de não desenhar nada.
const COMPACT_ROW_HEIGHT = 22;

/**
 * Decide onde o stack de alertas pode desenhar sem NUNCA alcançar o
 * gráfico. Pura — mesma entrada, mesma saída, testável sem navegador
 * (mesma disciplina de resolveAdaptiveRightOffset em
 * chart-ultrawide-scale.ts).
 *
 * INVARIANTE PROVADA (ver chart-safe-zone.test.ts): `top + maxHeight`
 * nunca ultrapassa `(chartTop ?? viewportHeight) - MARGIN` — ou seja, o
 * fundo do stack fica sempre pelo menos MARGIN px ACIMA do topo real do
 * gráfico. Quando não há gráfico montado nesta aba (`chartTop === null`
 * — SETTINGS, outro módulo), o piso vira o rodapé real do viewport: não
 * existe região a evitar.
 */
export function computeToastPlacement(chartTop: number | null, viewportHeight: number): ToastPlacement {
  const hasChart = chartTop !== null && Number.isFinite(chartTop) && chartTop >= 0;
  const floor = hasChart ? Math.max(0, (chartTop as number) - MARGIN) : Math.max(0, viewportHeight - MARGIN);

  // Topo PREFERIDO: abaixo dos 2 selos já existentes no mesmo canto. Mas
  // nunca abaixo do piso — quando a faixa livre é curta demais até pra
  // isso, o topo cede na direção do piso (a garantia real é o piso;
  // "abaixo dos banners" é só estética de segunda prioridade, nunca deve
  // forçar o stack pra dentro do gráfico).
  const preferredTop = MARGIN + BELOW_EXISTING_BANNERS;
  const top = Math.min(preferredTop, Math.max(MARGIN, floor - COMPACT_ROW_HEIGHT));

  const maxHeight = Math.max(0, floor - top);
  const fitsFullCard = maxHeight >= CARD_HEIGHT;
  const maxVisible = fitsFullCard
    ? Math.floor(maxHeight / CARD_HEIGHT)
    : maxHeight >= COMPACT_ROW_HEIGHT
      ? 1 // modo compacto: 1 linha só, nunca um cartão completo que não cabe.
      : 0; // nem uma linha cabe — não desenhar nada é a única opção segura.

  return { top, right: MARGIN, maxHeight, maxVisible, compact: !fitsFullCard && maxVisible > 0 };
}
