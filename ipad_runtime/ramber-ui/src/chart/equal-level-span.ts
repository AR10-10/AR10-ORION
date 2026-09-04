// equal-level-span.ts — geometria do TRECHO de um nível de liquidez
// (EQH/EQL), separada do canvas para poder ser testada por execução real.
//
// DEFEITO RELATADO (Operador, sobre a tela real): "aquele risco que fica
// quando o ativo topa faz duas, três vezes no mesmo lugar, aquela linha
// amarela — antigamente elas não atravessavam o gráfico todo, ela só
// marcava um pedaço da linha, não ficava grandona, marcava quantas vezes
// ela testou naquela mesma zona".
//
// CAUSA MEDIDA: EQH/EQL era desenhado com `createPriceLine` da
// lightweight-charts (EnhancedChart_110_Percent.tsx). Essa primitiva SEMPRE
// atravessa o gráfico inteiro — não existe parâmetro de início/fim. O
// `title` ("EQH x3") que carregava a contagem também não aparecia no painel
// de velas. Ou seja: a informação real existia no dado e morria na
// primitiva escolhida.
//
// POR QUE O TRECHO É HONESTO E A LARGURA TOTAL NÃO: um pool de liquidez é
// EVIDÊNCIA — N toques reais, em candles reais, entre o primeiro e o
// último. Esse intervalo é o que o motor efetivamente mediu. Uma linha de
// largura total afirma visualmente algo que o motor nunca calculou (que o
// nível vale igualmente em todo o histórico e em todo o futuro visível).
// O trecho desenha o que foi medido.
//
// A ÚNICA licença tomada aqui é de LEGIBILIDADE, nunca de conteúdo: um
// cluster cujos toques caem em candles vizinhos vira poucos pixels e some.
// Por isso existe um piso de largura e uma sobra curta à direita — ambos
// FIXOS em pixels e pequenos, e explicitamente NÃO uma projeção de que o
// nível continua válido até a borda. Se o piso não coubesse, a alternativa
// seria não desenhar — nunca voltar à largura total.

/** Sobra curta à direita do último toque real. Existe para o rótulo
 *  ("EQH ×3") ter onde pousar sem cobrir o próprio último toque. Fixa e
 *  pequena de propósito: não é projeção de validade futura. */
export const EQUAL_LEVEL_RIGHT_LEAD_PX = 22;

/** Largura mínima legível de um trecho. Abaixo disso, 2 toques em candles
 *  vizinhos viram um ponto invisível num gráfico com zoom afastado. */
export const EQUAL_LEVEL_MIN_SEGMENT_PX = 56;

export interface EqualLevelSegment {
  x1: number;
  x2: number;
}

/**
 * Resolve o trecho horizontal (em pixels de CSS) de um nível de liquidez.
 *
 * @param xFirst coordenada do PRIMEIRO toque real (pode ser negativa: o
 *   toque existe, só está fora da janela visível à esquerda).
 * @param xLast coordenada do ÚLTIMO toque real.
 * @param canvasWidth largura visível do canvas.
 * @returns o trecho já recortado à área visível, ou `null` quando não há
 *   nada real para desenhar (fail-closed — nunca um trecho inventado).
 */
export function resolveEqualLevelSegment(
  xFirst: number,
  xLast: number,
  canvasWidth: number,
): EqualLevelSegment | null {
  if (!Number.isFinite(xFirst) || !Number.isFinite(xLast)) return null;
  if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) return null;

  const left = Math.min(xFirst, xLast);
  let right = Math.max(xFirst, xLast) + EQUAL_LEVEL_RIGHT_LEAD_PX;

  // Piso de legibilidade — cresce SEMPRE para a direita (para o presente),
  // nunca para a esquerda: alargar para trás sugeriria toques mais antigos
  // do que os que o motor mediu.
  if (right - left < EQUAL_LEVEL_MIN_SEGMENT_PX) {
    right = left + EQUAL_LEVEL_MIN_SEGMENT_PX;
  }

  const x1 = Math.max(0, Math.min(left, canvasWidth));
  const x2 = Math.max(0, Math.min(right, canvasWidth));
  // Inteiramente fora da janela (à esquerda ou à direita) — não desenha.
  if (x2 - x1 < 1) return null;
  return { x1, x2 };
}
