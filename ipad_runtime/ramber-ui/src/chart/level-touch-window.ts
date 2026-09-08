// level-touch-window.ts — §4 da ordem "NÚCLEO + POSICIONAMENTO
// INTELIGENTE".
//
// PEDIDO LITERAL DO OPERADOR:
//   "as linhas não devem atravessar o gráfico inteiro — limitar a 2-3
//    toques relevantes ou N candles".
//
// ── AUDITORIA ANTES DE CONSTRUIR (Disciplina §1) ───────────────────────
// Este projeto JÁ resolveu metade deste problema uma vez, para EQH/EQL:
// `equal-level-span.ts` transforma "primeiro toque × último toque" em um
// trecho de pixels, e o `LiquidityZonesPlugin` já o desenha ao vivo. A
// GEOMETRIA, portanto, não se reescreve aqui — este módulo importa nada
// dela e o chamador reusa `resolveEqualLevelSegment` exatamente como o
// plugin de liquidez já faz.
//
// O que NÃO existia é a etapa anterior: QUAIS toques entram no trecho.
// EQH/EQL usa todos (um pool de liquidez é um cluster curto por
// definição). Um nível S1/R1 não é: `support-resistance-engine.js` conta
// os toques contra TODOS os swings da amostra, então "primeiro × último"
// pode cobrir a janela inteira — e aí o trecho voltaria a ser exatamente
// a linha de largura total que a §4 pede para acabar.
//
// ── O ACHADO REAL QUE DESTRAVA ISTO ────────────────────────────────────
// `computeLevelStrength()` (support-resistance-engine.js) filtra os swings
// dentro da banda de tolerância e devolve só `.length`. Os OBJETOS de
// swing — que carregam `.index`, a posição real do candle — são jogados
// fora na mesma linha em que são contados. É a MESMA classe de achado já
// registrada para EQH/EQL em EnhancedChart_110_Percent.tsx ("nem o índice
// do último toque, que o motor sempre teve"): a informação existia no
// motor e morria na primitiva de desenho escolhida.
//
// ── POR QUE "OS N MAIS RECENTES" É HONESTO ─────────────────────────────
// Um nível é evidência de onde o preço REVERTEU. Os toques antigos
// aconteceram, mas o que sustenta o nível como leitura ATUAL são as
// reversões recentes — a mesma disciplina de frescor que este projeto já
// aplica em `RECENT_TOUCH_TOLERANCE_CANDLES` (triangle-pattern.ts: "o
// toque mais recente precisa estar dentro desta distância do candle mais
// novo") e em `MARKET_SESSION_RECENT_BOUNDARY_CANDLES` (layer-relevance.ts).
//
// NUNCA apaga o toque antigo (Regra de Ouro 4): ele continua contado em
// `strength.touches`, que é o que alimenta o rótulo e o peso visual do
// nível. Este módulo decide só ONDE O TRAÇO COMEÇA — quantos toques ele
// deixou para trás sai em `omittedOlder`, para o chamador poder dizê-lo.
//
// ── O QUE FICOU DE FORA, DE PROPÓSITO (Disciplina §5) ──────────────────
// A ordem oferece duas formulações ("2-3 toques relevantes" OU "N
// candles"). Só a primeira está implementada, e a razão é a Regra de Ouro
// de sempre: "2-3 toques" É a especificação do Operador, enquanto o "N"
// de "N candles" teria de ser inventado aqui — não existe no projeto
// nenhum limiar declarado de "um nível de S/R para de valer depois de N
// candles", e fabricar um encurtaria o traço ABAIXO da evidência real
// medida. O trecho já nunca ultrapassa a tela (equal-level-span.ts recorta
// no canvas), então o objetivo real da §4 — a linha deixar de nascer em
// x=0 e passar a nascer num toque real — é atingido sem o número inventado.
//
// Zero decisão de trading, zero direção, zero score (LEI 24): geometria de
// apresentação, mesma família de chart-plot-area.ts / equal-level-span.ts.

/** Quantos toques REAIS o traço cobre, contados do mais recente para trás.
 *  3 é a especificação literal do Operador ("2-3 toques relevantes") —
 *  tomado no limite superior para nunca mostrar MENOS evidência do que a
 *  ordem autoriza. Não é uma medição nem uma calibração. */
export const LEVEL_MAX_RELEVANT_TOUCHES = 3;

export interface LevelTouchWindow {
  /** Índice do candle do toque mais ANTIGO ainda dentro da janela — é aqui
   *  que o traço começa (em vez de x=0). */
  firstIndex: number;
  /** Índice do candle do toque mais RECENTE — onde o traço termina (mais a
   *  sobra curta de legibilidade que equal-level-span.ts já aplica). */
  lastIndex: number;
  /** Toques desenhados (≤ LEVEL_MAX_RELEVANT_TOUCHES). */
  touchesShown: number;
  /** Toques reais distintos que o motor mediu, a janela inteira. */
  touchesTotal: number;
  /** Toques reais mais antigos que a janela. Nunca apagados do sistema —
   *  continuam em `strength.touches`; só não puxam o traço para trás. */
  omittedOlder: number;
}

/**
 * Escolhe a janela de toques que o traço de um nível deve cobrir.
 *
 * Função PURA e determinística. Fail-closed (Regra de Ouro 3): sem índice
 * real utilizável devolve `null`, e o chamador mantém o desenho de hoje —
 * nunca um trecho inventado a partir de um índice que o motor não mediu.
 *
 * @param touchIndices índices de candle dos toques reais, em qualquer ordem
 */
export function resolveLevelTouchWindow(
  touchIndices: readonly number[] | null | undefined,
): LevelTouchWindow | null {
  if (!Array.isArray(touchIndices)) return null;

  // Índices inteiros e não-negativos apenas: um índice fracionário ou
  // negativo não aponta para candle nenhum. Dedupe porque dois swings
  // podem cair no MESMO candle — geometricamente é um só ponto de partida,
  // e contá-lo duas vezes consumiria a janela sem alargar o traço.
  const seen = new Set<number>();
  for (const raw of touchIndices) {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) continue;
    seen.add(raw);
  }
  if (seen.size === 0) return null;

  const ordered = [...seen].sort((a, b) => a - b);
  const touchesTotal = ordered.length;
  // Os mais RECENTES são o fim do array ordenado.
  const window = ordered.slice(-LEVEL_MAX_RELEVANT_TOUCHES);

  return {
    firstIndex: window[0],
    lastIndex: window[window.length - 1],
    touchesShown: window.length,
    touchesTotal,
    omittedOlder: touchesTotal - window.length,
  };
}
