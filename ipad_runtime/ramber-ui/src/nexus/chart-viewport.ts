// chart-viewport.ts — quantas velas o enquadre automático do gráfico
// principal deve mostrar, dado o espaço real disponível.
//
// Ordem "FECHAMENTO DO AR10 CYBORG" §5 ("PRESERVAR CAMPO DE VISÃO"):
// "Manter uma janela visual equilibrada de aproximadamente 60-200 candles,
// adaptando dinamicamente conforme: timeframe; tamanho do viewport;
// resolução; iPad; desktop; densidade de dados; zoom atual."
//
// Achado real que motivou este módulo: `SMART_ZOOM_CANDLES = 120` era uma
// constante FIXA — o mesmo enquadre no iPad Mini retrato (~700px de
// gráfico, ~5,8px por vela: apertado) e num desktop 1920 (~1750px,
// ~14,6px por vela: esparso, metade da tela virando espaço morto). 120
// está DENTRO da faixa pedida, mas não é "adaptando dinamicamente".
//
// ── O QUE ESTE MÓDULO ADAPTA, E O QUE DELIBERADAMENTE NÃO ADAPTA ──────
// A pergunta real é geométrica: quantas velas cabem com largura legível?
// Isso depende só de PIXELS DISPONÍVEIS e da densidade de dados real —
// não do timeframe. Uma vela de 1m e uma de 4H ocupam exatamente a mesma
// largura na tela; o que o timeframe muda é QUANTO TEMPO a janela cobre,
// nunca quantas velas cabem. Introduzir um termo de timeframe aqui seria
// inventar uma regra sem justificativa real (§17 da mesma Ordem: "isso
// aumenta inteligência, precisão ou legibilidade — ou apenas aumenta
// complexidade?"). Os termos REAIS da Ordem que este módulo honra:
//   • "tamanho do viewport"/"resolução"/"iPad"/"desktop" → widthPx.
//   • "densidade de dados" → availableCandles (nunca enquadrar 150 velas
//     quando só existem 80 reais — enquadrar o vazio comprime as velas
//     que existem contra a borda).
//   • "zoom atual" → NÃO é entrada desta função por design: o pan/zoom
//     manual do Operador é soberano, e este cálculo só roda em troca de
//     contexto ou no toque explícito de RECENTRALIZAR (que existe
//     justamente para DESCARTAR o zoom atual). Ler o zoom aqui faria o
//     botão de recuperação herdar o enquadre ruim do qual o Operador
//     está tentando escapar.
export interface ViewportCandlesInput {
  /** Largura real (CSS px) da área de plotagem do gráfico. */
  widthPx: number;
  /** Quantas velas REAIS existem na série agora. */
  availableCandles: number;
}

// Largura-alvo por vela (px). Não é um número inventado: é a densidade em
// que corpo + pavio de uma vela continuam distinguíveis a olho no iPad
// (a superfície-alvo real deste app) — a mesma faixa que terminais
// profissionais usam por padrão. Abaixo de ~4px a vela vira um traço;
// acima de ~12px o gráfico lê como "poucos dados, muito espaço".
export const TARGET_PX_PER_CANDLE = 7;
// Faixa literal pedida pela Ordem §5.
export const MIN_VIEWPORT_CANDLES = 60;
export const MAX_VIEWPORT_CANDLES = 200;

/** Quantas velas o enquadre automático deve mostrar.
 *
 *  Fail-closed: largura não-finita/não-positiva (container ainda não
 *  medido — acontece de verdade no primeiro render, antes do
 *  ResizeObserver) cai no piso da faixa em vez de produzir NaN ou um
 *  enquadre absurdo. Nunca devolve mais velas do que realmente existem. */
export function computeViewportCandles({ widthPx, availableCandles }: ViewportCandlesInput): number {
  const usable = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 0;
  const byWidth = Math.round(usable / TARGET_PX_PER_CANDLE);
  const clamped = Math.min(MAX_VIEWPORT_CANDLES, Math.max(MIN_VIEWPORT_CANDLES, byWidth));
  // Densidade de dados real: enquadrar 150 velas com 80 reais na série
  // empurraria as velas existentes contra a borda direita, com 70 slots
  // de nada à esquerda — exatamente o "excesso de espaço vazio" que a
  // Ordem §5 lista como defeito.
  if (!Number.isFinite(availableCandles) || availableCandles <= 0) return clamped;
  return Math.min(clamped, Math.floor(availableCandles));
}
