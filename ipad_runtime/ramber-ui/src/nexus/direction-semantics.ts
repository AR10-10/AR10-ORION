// direction-semantics.ts — a LEI de como LONG e SHORT aparecem na tela.
//
// PEDIDO DO OPERADOR: "lá em cima os short está invertido ou não? ... não pode
// estar errado nada, porque se tiver errado a direção a gente vai achar que
// vai subir e vem pro outro lado."
//
// ═══ POR QUE ESTE ARQUIVO EXISTE ═══
//
// A auditoria desta rodada varreu TODO mapeamento direção→cor do App.tsx e do
// diretório chart/. Resultado honesto: ZERO inversões. Nenhuma. O sistema
// estava correto.
//
// Mas "eu conferi e está certo hoje" não é uma resposta durável para essa
// pergunta. Inversão de direção é a classe de defeito mais cara deste
// terminal — não trava, não avisa, não aparece em nenhum log: simplesmente
// faz o Operador entrar no lado errado. E o repositório tinha ~30 pontos
// espalhados escrevendo o mesmo mapeamento à mão, cada um passível de sair
// trocado num commit distraído.
//
// Então a resposta certa não é "conferi": é tornar a inversão IMPOSSÍVEL de
// passar em silêncio. Este módulo declara o contrato uma vez, e
// tests/direction-inversion.test.ts varre o código real contra ele. Um ✗ no
// lugar errado passa a quebrar o build, não a conta do Operador.
//
// ═══ O CONTRATO ═══
//
// A convenção não é arbitrária nem estética — é a mesma de qualquer terminal
// profissional, e o Operador já a lê sem pensar:
//
//   LONG  → verde  → seta para CIMA   → o preço sobe
//   SHORT → vermelho → seta para BAIXO → o preço cai
//   NEUTRO/sem leitura → azul acinzentado → nem um nem outro
//
// A cor NUNCA é o único canal: toda superfície que usa estas cores também
// escreve a palavra (LONG/SHORT) ou desenha a seta. Cor sozinha falha para
// quem tem daltonismo e falha num monitor mal calibrado — e aqui o custo do
// erro é entrar invertido.

export type Direction = "LONG" | "SHORT" | "NEUTRO";

/** Cor canônica da UI (DOM). Estes são os MESMOS hex já usados em toda a
 *  interface — este módulo não inventa cor nenhuma, só nomeia o que já é. */
export const DIRECTION_COLOR: Record<Direction, string> = {
  LONG: "#00ffaa",
  SHORT: "#ff0055",
  NEUTRO: "#8ab4f8",
};

/** Seta canônica. Sobe = LONG, desce = SHORT. Esta é a linha que, invertida,
 *  faz o Operador operar o lado contrário. */
export const DIRECTION_ARROW: Record<Direction, string> = {
  LONG: "▲",
  SHORT: "▼",
  NEUTRO: "·",
};

/** Para onde o preço vai, em uma palavra — o vocabulário do rótulo. */
export const DIRECTION_WORD: Record<Direction, string> = {
  LONG: "CIMA",
  SHORT: "BAIXO",
  NEUTRO: "LATERAL",
};

/** Os pares PROIBIDOS: qualquer código que associe estes dois valores está
 *  invertido, por definição. O teste de inversão varre o código real
 *  procurando exatamente por eles. */
export const FORBIDDEN_PAIRS: ReadonlyArray<{ direction: Direction; forbidden: string; why: string }> = [
  { direction: "LONG", forbidden: DIRECTION_COLOR.SHORT, why: "LONG pintado de vermelho" },
  { direction: "SHORT", forbidden: DIRECTION_COLOR.LONG, why: "SHORT pintado de verde" },
  { direction: "LONG", forbidden: DIRECTION_ARROW.SHORT, why: "LONG com seta para baixo" },
  { direction: "SHORT", forbidden: DIRECTION_ARROW.LONG, why: "SHORT com seta para cima" },
];

/** Cor real desta direção. Entrada desconhecida cai em NEUTRO — nunca chuta
 *  verde ou vermelho, que seriam uma afirmação direcional falsa. */
export function directionColor(d: string | null | undefined): string {
  if (d === "LONG" || d === "SHORT" || d === "NEUTRO") return DIRECTION_COLOR[d];
  return DIRECTION_COLOR.NEUTRO;
}

/** Seta real desta direção. Mesmo fail-closed da cor. */
export function directionArrow(d: string | null | undefined): string {
  if (d === "LONG" || d === "SHORT" || d === "NEUTRO") return DIRECTION_ARROW[d];
  return DIRECTION_ARROW.NEUTRO;
}
