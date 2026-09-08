// terminal-design-tokens.ts — A ESCALA CANÔNICA DO TERMINAL.
//
// PEDIDO DO OPERADOR (ordem "EVOLUÇÃO COMPLETA", §1): "tipografia precisa",
// "hierarquia clara", "cores mais profissionais e consistentes", "zero
// elementos desnecessários".
//
// ── O DEFEITO REAL, MEDIDO (Disciplina §1) ──────────────────────────────
// Varredura do app inteiro, antes desta rodada:
//
//   • 12 tamanhos tipográficos distintos: 0.3 0.32 0.35 0.4 0.42 0.45 0.46
//     0.48 0.5 0.55 0.6 0.62 0.65 0.7 0.75rem (os 3 primeiros já corrigidos
//     na rodada do piso de legibilidade).
//   • 40 cores hex distintas, em 1330 ocorrências.
//   • ZERO arquivo de tokens. Nenhum lugar declarava o que é "um degrau".
//
// Doze tamanhos não são uma escala — são acúmulo. 0.45, 0.46 e 0.48rem
// diferem em 0.16px e 0.32px: nenhum olho humano distingue, mas cada um
// foi uma decisão separada que ninguém podia revisar como conjunto. É
// exatamente o oposto de "tipografia precisa": a imprecisão não está em
// nenhum tamanho isolado, está em não existir sistema.
//
// ── A ESCALA, DERIVADA E NÃO INVENTADA ─────────────────────────────────
// Os degraus abaixo NÃO foram escolhidos por gosto: são os tamanhos que o
// app já usava em massa (0.40 / 0.45 / 0.50 / 0.55 / 0.60 concentram 295
// dos 350 usos), estendidos com passo CONSTANTE de 0.05rem até cobrir os
// raros maiores. O que sai são só os degraus intermediários que ninguém
// consegue ver (0.42, 0.46, 0.48, 0.62) e um extremo solto (0.75).
//
// Cada migração move no MÁXIMO 0.05rem (0.8px) — imperceptível numa
// etiqueta isolada, decisivo no conjunto: 12 tamanhos arbitrários viram 7
// degraus regulares, e a hierarquia passa a ser legível como sistema.
//
// ── O PISO NÃO SE MEXE ─────────────────────────────────────────────────
// 0.40rem (6.4px) continua sendo o menor degrau, pelo mesmo motivo já
// documentado em typography-legibility-floor.test.ts e no
// PriceLabelStackPlugin: "no iPad (a superfície real deste app) fica no
// limite do legível". A escala começa NO piso; nunca abaixo dele.
//
// LEI 24: isto é vocabulário de apresentação. Zero decisão, zero cálculo
// de mercado, zero acesso a dado real.

/** Degraus tipográficos canônicos, em rem. Passo constante de 0.05rem.
 *  Ordem crescente — o índice É a hierarquia. */
export const TYPE_SCALE_REM = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7] as const;

export type TypeScaleStep = (typeof TYPE_SCALE_REM)[number];

/** Menor degrau permitido. Igual ao piso de legibilidade já declarado —
 *  a escala não pode começar abaixo dele. */
export const TYPE_SCALE_MIN_REM = TYPE_SCALE_REM[0];

/** Passo entre degraus. Constante de propósito: uma escala com passos
 *  irregulares volta a ser a lista arbitrária que esta rodada desfez. */
export const TYPE_SCALE_STEP_REM = 0.05;

/** Os 5 tamanhos fora-de-escala que existiam antes desta rodada, com o
 *  degrau canônico para o qual cada um foi arredondado (sempre o mais
 *  próximo — a migração minimiza a mudança visual, nunca a maximiza).
 *
 *  Preservado no código, e não só no commit, porque é o registro de POR
 *  QUE cada valor mudou: uma sessão futura que encontre `text-[0.48rem]`
 *  num trecho antigo tem aqui a resposta, em vez de reintroduzi-lo. */
export const TYPE_SCALE_MIGRATIONS: ReadonlyArray<{ from: number; to: TypeScaleStep; uses: number }> = [
  { from: 0.42, to: 0.4, uses: 35 },
  { from: 0.46, to: 0.45, uses: 1 },
  { from: 0.48, to: 0.5, uses: 12 },
  { from: 0.62, to: 0.6, uses: 3 },
  { from: 0.75, to: 0.7, uses: 1 },
];

/** O degrau canônico mais próximo de um tamanho qualquer. Fail-closed:
 *  entrada não-finita devolve o piso, nunca NaN numa classe CSS. */
export function nearestTypeStep(rem: number): TypeScaleStep {
  if (!Number.isFinite(rem)) return TYPE_SCALE_MIN_REM;
  let best: TypeScaleStep = TYPE_SCALE_REM[0];
  let bestDist = Math.abs(rem - best);
  for (const step of TYPE_SCALE_REM) {
    const d = Math.abs(rem - step);
    // `<` estrito: num empate exato fica o degrau MENOR (já visitado),
    // decisão determinística em vez de depender da ordem do array.
    if (d < bestDist) {
      best = step;
      bestDist = d;
    }
  }
  return best;
}

/** Um tamanho está na escala? Comparação com tolerância porque
 *  0.1+0.2 !== 0.3 em ponto flutuante — nunca `===` cru. */
export function isOnTypeScale(rem: number): boolean {
  if (!Number.isFinite(rem)) return false;
  return TYPE_SCALE_REM.some((s) => Math.abs(s - rem) < 1e-9);
}
