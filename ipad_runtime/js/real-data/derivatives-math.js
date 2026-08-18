// derivatives-math.js — matemática pura de derivativos compartilhada.
//
// POR QUE ESTE ARQUIVO EXISTE (achado do mapa de lacunas do Research Book,
// docs/MAPA_LACUNAS_RESEARCH_BOOK_2026-08-18.md): o `basis` estava numa
// situação esquisita — CALCULADO de verdade em
// ramber-ui/src/gmil/providers/derivatives-provider.ts (mark vs index) e
// ao mesmo tempo devolvido como DADOS_INSUFICIENTES por
// js/research/research-engine.js, com o comentário "nenhum conector
// compara spot vs futuros nesta fase". O comentário tinha ficado obsoleto:
// o conector passou a existir.
//
// Ao ligar o basis também ao frame do Core Engine, a saída fácil seria
// copiar a fórmula para o segundo lugar — e criar exatamente a duplicação
// que a auditoria desta trilha passou a sessão inteira eliminando. Daí
// este módulo: UMA definição, dois consumidores.
//
// Consumidores reais:
//   · js/real-data/binance-futures-public.js  (Evidence Object por ativo)
//   · ramber-ui/src/gmil/providers/derivatives-provider.ts  (macro global)
//
// Puro: zero rede, zero estado, zero relógio.

/**
 * Basis do perpétuo sobre a cesta spot, em PERCENTUAL.
 *
 * Positivo = perpétuo negociando ACIMA do índice spot (prêmio, típico de
 * mercado comprado); negativo = desconto. É o feed combinado Spot×Perpetual
 * resumido num número — a mesma definição que a Camada B do Research Book
 * pede e que a Binance expõe via `premiumIndex`.
 *
 * FAIL-CLOSED: qualquer um dos dois preços ausente, não-finito ou <= 0
 * devolve `null` — nunca um zero, que se leria como "sem prêmio" quando o
 * que houve foi "sem leitura".
 *
 * @param {number|null|undefined} markPrice preço de marcação do perpétuo
 * @param {number|null|undefined} indexPrice preço do índice spot
 * @returns {number|null} basis em %, ou null honesto
 */
export function computeBasisPct(markPrice, indexPrice) {
    const mark = Number(markPrice);
    const index = Number(indexPrice);
    if (!Number.isFinite(mark) || mark <= 0) return null;
    if (!Number.isFinite(index) || index <= 0) return null;
    return ((mark - index) / index) * 100;
}
