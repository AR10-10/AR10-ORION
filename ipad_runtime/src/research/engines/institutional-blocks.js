// institutional-blocks.js — BREAKER BLOCKS e MITIGATION BLOCKS reais.
//
// POR QUE ESTE MOTOR EXISTE (auditoria antes de construir, Disciplina §1):
// o ecossistema já detecta Order Block, FVG, Equal Highs/Lows, BOS/CHOCH,
// Kill Zones e Premium/Discount — mas `grep -ri "breaker|mitigation"` em
// todo o repositório voltou ZERO ocorrência do conceito de trading (só
// `circuit-breaker.ts`, que é outra coisa). Breaker e Mitigation Block são
// literalmente os itens de manchete de todo curso pago de SMC/ICT, e eram
// um buraco real aqui.
//
// DEFINIÇÃO PESQUISADA (não inventada). A distinção real entre os dois,
// confirmada em múltiplas fontes públicas de SMC/ICT, é UMA só:
//
//   Um Order Block que FALHOU (preço fechou através dele) vira:
//     · BREAKER    — se ANTES de falhar o preço varreu liquidez, fazendo
//                    uma máxima maior / mínima menor que a referência
//                    estrutural anterior. O bloco INVERTE polaridade: um
//                    OB de alta que quebra vira zona de OFERTA.
//     · MITIGATION — se falhou SEM varrer liquidez antes. O bloco MANTÉM
//                    a polaridade original (ordens institucionais que
//                    ficaram parcialmente preenchidas num movimento que
//                    não vingou).
//
// "A Breaker raids liquidity on its respective timeframes by making a
// higher high or lower low before reversing, whilst a Mitigation Block
// does not do that."
//
// HONESTIDADE SOBRE A DEFINIÇÃO: exatamente como o Order Block do
// fvg-order-block-engine.js já registra, não existe UMA definição oficial
// canônica destes conceitos na literatura de SMC — existe a versão mais
// repetida e objetivamente checável a partir de OHLC puro. É essa que está
// implementada, e a diferença sweep/sem-sweep é o critério que TODAS as
// fontes consultadas concordam ser o divisor de águas.
//
// ZERO MATEMÁTICA NOVA: os Order Blocks vêm do motor que já existe
// (fvg-order-block-engine.js) e os swings de fractal-swings.js. Este motor
// só classifica o que já é detectado — nenhuma segunda implementação de
// OB, nenhuma segunda detecção de swing.
//
// CAUSALIDADE REAL (detalhe que a maioria dos indicadores comerciais
// erra): um swing fractal só é CONFIRMADO K candles depois de acontecer.
// A referência de liquidez usada aqui é o último swing cuja confirmação
// já tinha ocorrido no momento do Order Block (`index + FRACTAL_K <=
// obIndex`) — nunca um swing que só se tornaria visível no futuro. Sem
// isso o motor "acertaria" no backtest usando informação que não existia.

import { FRACTAL_K, findSwings } from './fractal-swings.js';
import { analyze as analyzeOrderFlowZones } from './fvg-order-block-engine.js';

export const metadata = {
    engine: 'institutional-blocks',
    description: 'Breaker Blocks e Mitigation Blocks — Order Blocks que falharam, classificados pela presença ou ausência de varredura de liquidez antes da falha.',
    concepts: ['Breaker Block (OB falhou APÓS varrer liquidez — inverte polaridade)', 'Mitigation Block (OB falhou SEM varrer liquidez — mantém polaridade)'],
    required_data: ['ohlcv_series'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Herda a definição de Order Block do fvg-order-block-engine.js — que é a variante mais comum e checável, não a única possível na literatura SMC.',
        'A referência de liquidez é o último swing fractal JÁ CONFIRMADO no momento do Order Block (K=2 candles de folga), nunca um swing futuro.',
        'A falha do bloco exige FECHAMENTO além da zona, nunca só um pavio — pavio atravessando é ruído, fechamento é decisão.',
        'Sem candles suficientes ou sem Order Block real, devolve lista vazia/DADOS_INSUFICIENTES — nunca inventa um bloco.',
    ],
};

const MIN_CANDLES = 12;

/** Janela de varredura: além disso o bloco é história, não contexto de
 *  decisão. Mesma disciplina do PATTERN_SCAN_WINDOW do motor de padrões
 *  de vela — um breaker de 300 candles atrás não muda a leitura de agora. */
export const BLOCK_SCAN_WINDOW = 120;

const high = (c) => c.h ?? c.high;
const low = (c) => c.l ?? c.low;
const close = (c) => c.c ?? c.close;

/**
 * Último swing fractal cuja CONFIRMAÇÃO já tinha acontecido no candle
 * `atIndex`. Um swing no índice i só é confirmável em i+K (precisa dos K
 * candles à direita), então usar um swing com `i + K > atIndex` seria
 * enxergar o futuro.
 * @param {Array<{index:number, price:number}>} swings
 * @param {number} atIndex
 * @returns {{index:number, price:number}|null}
 */
export function lastConfirmedSwing(swings, atIndex) {
    let best = null;
    for (const s of swings) {
        if (s.index + FRACTAL_K > atIndex) break;
        best = s;
    }
    return best;
}

/**
 * Índice do primeiro candle que faz o bloco FALHAR — fechamento além da
 * zona no sentido contrário ao viés do bloco. Pavio não conta.
 * @returns {number} índice real, ou -1 se o bloco nunca falhou.
 */
export function findFailureIndex(candles, block, fromIndex) {
    for (let j = fromIndex; j < candles.length; j++) {
        const c = close(candles[j]);
        if (!Number.isFinite(c)) continue;
        if (block.type === 'BULLISH' && c < block.bottom) return j;
        if (block.type === 'BEARISH' && c > block.top) return j;
    }
    return -1;
}

/**
 * Houve varredura de liquidez entre o Order Block e a falha dele?
 *
 * Para um OB de ALTA (demanda), o preço subiu antes de quebrar: a
 * varredura é uma MÁXIMA MAIOR que o último swing high confirmado —
 * liquidez de compra acima sendo raspada. Para um OB de BAIXA, é uma
 * MÍNIMA MENOR que o último swing low confirmado.
 *
 * @returns {{swept:boolean, level:number|null, index:number|null}}
 */
export function detectSweep(candles, block, failIndex, swingHighs, swingLows) {
    const bullish = block.type === 'BULLISH';
    const ref = lastConfirmedSwing(bullish ? swingHighs : swingLows, block.index);
    if (ref === null) return { swept: false, level: null, index: null };

    for (let j = block.index + 1; j < failIndex; j++) {
        const v = bullish ? high(candles[j]) : low(candles[j]);
        if (!Number.isFinite(v)) continue;
        if (bullish ? v > ref.price : v < ref.price) {
            return { swept: true, level: ref.price, index: j };
        }
    }
    return { swept: false, level: ref.price, index: null };
}

/**
 * @param {{ ohlcv_series?: Array<object> }} input
 * @returns {object} status 'OK' com `blocks` (mais recentes primeiro), ou 'DADOS_INSUFICIENTES'.
 */
export function analyze(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    if (candles.length < MIN_CANDLES) {
        return {
            status: 'DADOS_INSUFICIENTES',
            engine: metadata.engine,
            reason: `apenas_${candles.length}_candles_abaixo_do_minimo_${MIN_CANDLES}`,
        };
    }

    // Order Blocks vêm do motor real que já existe — nunca redetectados aqui.
    const base = analyzeOrderFlowZones({ ohlcv_series: candles });
    if (base.status !== 'OK') {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: 'order_blocks_indisponiveis' };
    }

    const swingHighs = findSwings(candles, FRACTAL_K, true);
    const swingLows = findSwings(candles, FRACTAL_K, false);
    const scanFrom = Math.max(0, candles.length - BLOCK_SCAN_WINDOW);
    const blocks = [];

    for (const ob of base.order_blocks) {
        if (ob.index < scanFrom) continue;

        // A falha só pode ser procurada DEPOIS do candle de deslocamento
        // que criou o próprio Order Block (index + 1).
        const failIndex = findFailureIndex(candles, ob, ob.index + 2);
        if (failIndex === -1) continue; // bloco ainda vivo — assunto do motor base, não deste.

        const sweep = detectSweep(candles, ob, failIndex, swingHighs, swingLows);
        const kind = sweep.swept ? 'BREAKER' : 'MITIGATION';

        // Breaker inverte polaridade; Mitigation mantém a original.
        const direction = sweep.swept
            ? (ob.type === 'BULLISH' ? 'BAIXA' : 'ALTA')
            : (ob.type === 'BULLISH' ? 'ALTA' : 'BAIXA');

        // O bloco só vale como zona operacional depois que o preço volta
        // para dentro dele — antes disso é uma zona identificada, não testada.
        let retested = false;
        for (let j = failIndex + 1; j < candles.length; j++) {
            const lo = low(candles[j]);
            const hi = high(candles[j]);
            if (Number.isFinite(lo) && Number.isFinite(hi) && lo <= ob.top && hi >= ob.bottom) {
                retested = true;
                break;
            }
        }

        blocks.push({
            kind,
            direction,
            originType: ob.type,
            index: ob.index,
            failIndex,
            top: ob.top,
            bottom: ob.bottom,
            sweptLevel: sweep.swept ? sweep.level : null,
            sweepIndex: sweep.index,
            retested,
        });
    }

    blocks.sort((a, b) => b.failIndex - a.failIndex);

    return {
        status: 'OK',
        engine: metadata.engine,
        blocks,
        breaker_count: blocks.filter((b) => b.kind === 'BREAKER').length,
        mitigation_count: blocks.filter((b) => b.kind === 'MITIGATION').length,
        untested_count: blocks.filter((b) => !b.retested).length,
    };
}
