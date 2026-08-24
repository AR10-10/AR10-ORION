// price-clustering.js — agrupamento de precos por proximidade a uma ANCORA
// FIXA. Fonte unica real.
//
// POR QUE ESTE ARQUIVO EXISTE (auditoria pedida pelo Operador: "nao tiver
// coisa repetida"). O MESMO algoritmo estava escrito TRES vezes, em tres
// linguagens de arquivo diferentes, com a mesma guarda e o mesmo laco:
//
//   src/research/engines/fvg-order-block-engine.js  clusterEqualLevels()
//   ramber-ui/src/nexus/institutional-zones.ts      agrupamento de membros
//   ramber-ui/src/nexus/trap-detection.ts           clusterSweptPrices()
//
// Mesma remediacao, e o mesmo lugar, que fractal-swings.js ja recebeu
// nesta pasta quando findSwings estava triplicado — este arquivo e a
// segunda aplicacao do mesmo precedente, nao uma arquitetura nova.
//
// POR QUE AQUI E NAO EM ramber-ui/src/nexus/: a direcao real de dependencia
// deste repositorio e ramber-ui -> src/research/, nunca o contrario. Um
// motor .js puro nao pode importar de nexus/; este e o unico lugar que os
// TRES chamadores alcancam.
//
// A REGRA (identica nos tres, verificada linha a linha antes de extrair):
// ordena por preco, caminha, e a ancora de comparacao e o PRIMEIRO item do
// grupo em crescimento — nunca uma media rodante. A diferenca importa: com
// media rodante, itens afastados se encadeiam um a um e o grupo "deriva"
// indefinidamente; com ancora fixa, o grupo nunca fica mais largo que a
// propria tolerancia.
//
// ARMADILHA REAL ENCONTRADA AO EXTRAIR: as tres copias nao usavam a mesma
// UNIDADE. fvg-order-block-engine.js comparava `|p - a| / a <= 0.0015`
// (fracao) numa constante chamada EQUAL_TOLERANCE_**PCT**; as outras duas
// comparavam `|p - a| * 100 / a <= 0.35` (percentual). Mesmo numero, tres
// vezes menos obvio. Esta funcao aceita PERCENTUAL — a unidade das duas
// constantes ja exportadas do projeto (LIQUIDITY_PROXIMITY_PCT,
// INSTITUTIONAL_ZONE_PROXIMITY_PCT) — e o motor passou a declarar 0.15 em
// vez de 0.0015. Zero mudanca de comportamento, um nome que deixou de
// mentir.

/**
 * @template T
 * @param {readonly T[]} items itens a agrupar
 * @param {(item: T) => number} priceOf preco real de cada item
 * @param {number} proximityPct tolerancia em PERCENTUAL (0.35 = 0,35%)
 * @returns {T[][]} grupos, cada um ordenado por preco crescente
 */
export function clusterByPriceProximity(items, priceOf, proximityPct) {
    if (!Array.isArray(items) || items.length === 0) return [];
    if (!Number.isFinite(proximityPct) || proximityPct < 0) return [];

    // Itens sem preco real nunca entram num grupo — fail-closed: um NaN
    // arrastaria o grupo inteiro para uma comparacao sempre falsa e o
    // resultado seria silenciosamente diferente do esperado.
    const validos = items.filter((it) => Number.isFinite(priceOf(it)));
    if (validos.length === 0) return [];

    const sorted = [...validos].sort((a, b) => priceOf(a) - priceOf(b));
    const groups = [];
    let current = [];

    const flush = () => {
        if (current.length > 0) groups.push(current);
    };

    for (const item of sorted) {
        if (current.length === 0) {
            current = [item];
            continue;
        }
        // ANCORA FIXA: sempre o primeiro do grupo, nunca uma media rodante.
        const anchor = priceOf(current[0]);
        const closeEnough =
            anchor !== 0 && (Math.abs(priceOf(item) - anchor) * 100) / anchor <= proximityPct;
        if (closeEnough) {
            current.push(item);
        } else {
            flush();
            current = [item];
        }
    }
    flush();

    return groups;
}
