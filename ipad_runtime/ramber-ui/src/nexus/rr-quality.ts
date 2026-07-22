// rr-quality.ts — fecho da pendência "R:R mínimo" (nomeada em 4 PRs desta
// trilha como "precisa de decisão do Operador").
//
// O que destravou: a ordem explícita do Operador de fechar todas as
// pendências, executada da única forma honesta que este repositório
// permite — um PARÂMETRO DECLARADO, nunca uma medição. 1:2 é a convenção
// de mesa mais comum da indústria (recompensa mínima de 2 unidades por
// unidade de risco), exatamente a mesma natureza dos limiares 70/30 do
// RSI e do TARGET_LABEL_COMPACT_PCT já usados nesta base: um número de
// convenção documentado e ajustável AQUI pelo Operador, não uma
// probabilidade calibrada (Regra de Ouro 2 — este repositório não tem
// backtest real que sustente "R:R abaixo de X perde dinheiro").
//
// O que isto NUNCA faz (LEI 24 / FAIL_CLOSED): esconder, bloquear ou
// alterar um Trade Plan. O plano real continua renderizado por inteiro —
// isto só ANOTA, nos lugares que já mostram o R:R, quando o primeiro alvo
// fica abaixo do piso declarado. Aviso, nunca decisão.
export const RR_QUALITY_FLOOR = 2;

/**
 * true quando um R:R REAL existe e está abaixo do piso declarado.
 * null/não-finito => false (fail-closed: ausência de R:R já é comunicada
 * como ausência nos consumidores — nunca reinterpretada como "ruim").
 */
export function rrBelowFloor(riskReward: number | null | undefined, floor: number = RR_QUALITY_FLOOR): boolean {
  return typeof riskReward === "number" && Number.isFinite(riskReward) && riskReward > 0 && riskReward < floor;
}

/** Sufixo pronto de exibição — string vazia quando não há o que anotar. */
export function rrFloorSuffix(riskReward: number | null | undefined): string {
  return rrBelowFloor(riskReward) ? ` (abaixo do piso 1:${RR_QUALITY_FLOOR})` : "";
}
