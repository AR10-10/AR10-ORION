// fractal-swings.js — Deteccao fractal de swing high/low compartilhada por
// support-resistance-engine.js, market-structure-engine.js e
// fvg-order-block-engine.js.
//
// Extraido nesta remediacao (Auditoria Mestra 360°, secao 7 "Codigo"): o
// mesmo algoritmo — maximo/minimo local confirmado por K candles de cada
// lado — estava implementado de forma quase identica nos 3 motores, cada
// um redeclarando sua propria constante FRACTAL_K = 2. Pura funcao de
// calculo: zero fetch, zero estado global, mesmo contrato dos 3 motores
// que a usam.
//
// Aceita tanto {h,l} (nomes curtos, usados por support-resistance-engine.js
// e market-structure-engine.js) quanto {high,low} (usado por
// fvg-order-block-engine.js) sem alterar nenhum comportamento existente:
// os dois motores que so' populam {h,l} continuam recebendo exatamente os
// mesmos valores de antes — o fallback ?? so' importa pra quem nunca tinha
// {h,l} preenchido.

export const FRACTAL_K = 2;

/** @param {Array<{h?:number,l?:number,high?:number,low?:number}>} candles
 *  @param {number} k
 *  @param {boolean} isHigh
 *  @returns {Array<{index:number, price:number}>} swings confirmados, na
 *  mesma ordem dos candles de entrada (do mais antigo pro mais novo) —
 *  quem chama decide se quer reordenar por indice ou por preco. */
export function findSwings(candles, k, isHigh) {
    const out = [];
    for (let i = k; i < candles.length - k; i++) {
        const v = isHigh ? (candles[i].h ?? candles[i].high) : (candles[i].l ?? candles[i].low);
        if (!Number.isFinite(v)) continue;
        let confirmed = true;
        for (let j = i - k; j <= i + k; j++) {
            if (j === i) continue;
            const cmp = isHigh ? (candles[j].h ?? candles[j].high) : (candles[j].l ?? candles[j].low);
            if (!Number.isFinite(cmp) || (isHigh ? cmp >= v : cmp <= v)) {
                confirmed = false;
                break;
            }
        }
        if (confirmed) out.push({ index: i, price: v });
    }
    return out;
}
