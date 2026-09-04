// candlestick-patterns.js — Motor de PADRÕES DE VELA (Japanese Candlestick
// Patterns). Pedido direto do Operador: "no gráfico tem que refletir os
// padrão das vela também — quando dá tipo tantas velas fazem um padrão, ele
// tem de analisar tudo isso aí... existe um tal de padrão de vela que muda
// o sentido do mercado, não sei como se fala isso, mas o sistema tem que
// ser inteligente pra saber isso".
//
// ═══ AUDITORIA ANTES DE CONSTRUIR (CLAUDE.md, Disciplina item 1) ═══
//
// `grep -rlin "engolf|marubozu|doji|hammer|harami|shooting.star|inside.bar"`
// em `src/`, `ramber-ui/src/` e `js/` não retornou NADA. Gap genuíno: o
// sistema lê ESTRUTURA (swings, HH/HL, BOS/CHOCH), ZONAS (FVG/OB/void),
// REGIME (ADX/ATR) e FLUXO (CVD/absorção) — mas nunca leu a FORMA DA VELA
// em si. Motores vizinhos conferidos e deliberadamente NÃO reaproveitados
// como substitutos: `bos-choch-engine.js` mede rompimento de NÍVEL (onde o
// preço fechou em relação a um swing), `zigzag-engine.js` mede PERNAS de
// preço — nenhum dos dois olha a relação corpo/sombra dentro de uma vela,
// que é exatamente o que um padrão de vela é.
//
// ═══ PESQUISA REAL DAS DEFINIÇÕES (CLAUDE.md, Disciplina item 2) ═══
//
// Definições confirmadas via WebSearch ANTES de escrever código (Nison é a
// referência clássica ocidental; conferidas contra ProRealTime, Babypips,
// Zerodha Varsity, StockCharts e o cheat-sheet do TheChartGuys):
//
//  - ENGOLFO: a regra clássica é de CORPO, nunca de pavio — o corpo da 2ª
//    vela cobre inteiro o corpo da 1ª. Implementado exatamente assim; usar
//    o range (com pavios) daria uma detecção sistematicamente diferente da
//    definição real.
//  - MARTELO: corpo pequeno no topo do range, sombra inferior >= 2x o
//    corpo, sombra superior curta ou ausente.
//  - DOJI: corpo <= 10% do range total (limiar padrão publicado).
//  - PIERCING/DARK CLOUD: a 2ª vela penetra ALÉM DE 50% do corpo da 1ª —
//    a "regra do ponto médio", o que separa esses padrões de um simples
//    fechamento contrário.
//  - ESTRELA DA MANHÃ/NOITE (3 velas): a 3ª fecha pelo menos 50% dentro do
//    corpo da 1ª.
//
// ═══ O ACHADO QUE MUDA O DESENHO DO MOTOR ═══
//
// Martelo e ENFORCADO (hanging man) são a MESMA FORMA GEOMÉTRICA. Estrela
// cadente e martelo invertido também. O que os separa não é a vela — é a
// TENDÊNCIA ANTERIOR: a mesma silhueta é reversão de ALTA no fim de uma
// queda e reversão de BAIXA no fim de uma subida. Um detector que olhasse
// só a forma da vela emitiria o sinal exatamente invertido em metade dos
// casos — a classe de defeito mais cara deste terminal (a mesma que
// direction-semantics.ts existe para impedir).
//
// Por isso este motor NUNCA classifica um padrão de reversão sem contexto
// real de tendência, e o contexto vem de `market-structure-engine.js` (já
// graduado) — zero segunda leitura de tendência inventada aqui, mesmo
// precedente exato que `bos-choch-engine.js` já usa para separar BOS de
// CHOCH com o mesmo `structure_label`.
//
// ═══ HONESTIDADE (Regra de Ouro 2) ═══
//
// Nenhum padrão carrega "probabilidade de acerto". A literatura publica
// taxas de acerto (~60-65% para alguns), mas medidas em OUTROS mercados,
// OUTROS períodos e OUTRAS regras de saída — copiar esse número para cá e
// exibi-lo ao Operador seria inventar uma calibração que este repositório
// não tem. O que o motor reporta é `bodyAtr` (o tamanho REAL do corpo em
// unidades de ATR) e `confirmed` (a vela seguinte fechou a favor, sim ou
// não) — dois fatos medidos, nunca uma previsão.
import { computeAtrPercent } from './lorentzian-classifier.js';
import { analyze as analyzeMarketStructure } from './market-structure-engine.js';

export const metadata = {
    engine: 'candlestick-patterns',
    description: 'Detecta padrões de vela japoneses reais (engolfo, martelo/enforcado, estrela cadente/martelo invertido, doji, harami, piercing/dark cloud, estrela da manhã/noite, marubozu) sobre candles reais, sempre com o contexto de tendência de market-structure-engine.js — nunca a forma da vela isolada.',
    concepts: ['Japanese Candlestick Patterns', 'Reversal Patterns', 'Market Structure Context'],
    required_data: ['ohlcv_series', 'timeframe'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Padrões de REVERSÃO exigem contexto de tendência real (structure_label de market-structure-engine.js). Sem estrutura confirmada, nenhum padrão de reversão é emitido — nunca a forma da vela sozinha, que classificaria Martelo e Enforcado (mesma silhueta) de forma invertida.',
        'O structure_label descreve a estrutura da AMOSTRA inteira, não a tendência local de cada candle. Por isso a varredura fica restrita a uma janela recente (PATTERN_SCAN_WINDOW) onde esse rótulo ainda descreve o mercado de fato — mesmo compromisso já aceito por bos-choch-engine.js ao classificar BOS/CHOCH com esse mesmo rótulo.',
        'Sem ATR real (aquecimento de 14 candles), retorna DADOS_INSUFICIENTES — o tamanho de corpo "grande" é relativo à volatilidade do ativo, nunca um valor absoluto em dólares.',
        'NUNCA reporta probabilidade de acerto. bodyAtr e confirmed são medições reais; taxas de acerto publicadas descrevem outros mercados/períodos/regras de saída e não são copiadas para cá (Regra de Ouro 2).',
        'Display only (LEI 24) — confluência/contexto para o Operador, nunca uma segunda decisão de trading.',
    ],
};

/** Corpo <= 10% do range total = doji. Limiar padrão publicado (o mesmo
 *  default de 10% usado por bibliotecas de padrões de vista de mercado). */
export const DOJI_BODY_RATIO = 0.10;

/** Sombra dominante >= 2x o corpo — o mínimo clássico de martelo/estrela
 *  cadente. Vários textos pedem 2-3x; 2x é o piso da definição original e
 *  o mais conservador em NÃO descartar um padrão real. */
export const SHADOW_BODY_RATIO = 2.0;

/** A sombra OPOSTA (o lado curto) não pode passar do tamanho do corpo —
 *  codificação quantitativa de "sombra superior curta ou ausente". Sem esta
 *  regra, um pião (spinning top, sombras dos dois lados) passaria por
 *  martelo, que é um padrão totalmente diferente. */
export const OPPOSITE_SHADOW_MAX_BODY = 1.0;

/** Corpo mínimo, em ATR, para uma vela contar como "grande/decisiva" nos
 *  padrões que exigem isso (engolfo, marubozu, as velas 1 e 3 das estrelas).
 *  Heurística de mesa documentada (mesma classe de decisão de
 *  MIN_ZONE_ATR_FRACTION em liquidity-significance.ts) — NUNCA um número
 *  mágico: meio ATR é o piso onde uma vela deixa de ser respiro normal do
 *  ativo e passa a ser um movimento que o mercado registra. */
export const SIGNIFICANT_BODY_ATR = 0.5;

/** Penetração mínima no corpo da vela anterior para Piercing/Dark Cloud e
 *  para a 3ª vela das estrelas — a "regra do ponto médio" real (50%). */
export const MIDPOINT_PENETRATION = 0.5;

/** Marubozu: sombras somadas <= 5% do range — vela "careca" real. */
export const MARUBOZU_SHADOW_MAX_RATIO = 0.05;

/** Janela recente varrida. Ver limitations[1]: além disso, o rótulo de
 *  estrutura da amostra deixa de descrever a tendência local. */
export const PATTERN_SCAN_WINDOW = 40;

// Tolerância de forma: {o,h,l,c} (Bus/ciclo de análise) e
// {open,high,low,close} (candle do gráfico) são o MESMO preço real — mesma
// convenção já usada por fractal-swings.js e bos-choch-engine.js.
const O = (c) => c.o ?? c.open;
const H = (c) => c.h ?? c.high;
const L = (c) => c.l ?? c.low;
const C = (c) => c.c ?? c.close;
const T = (c) => c.t ?? c.time;

/**
 * Geometria pura de uma vela. Exportada porque é exatamente o que os testes
 * precisam checar isoladamente — e porque qualquer consumidor futuro deve
 * reusar ESTA medição em vez de recalcular corpo/sombra à mão.
 */
export function candleGeometry(candle) {
    const open = O(candle);
    const high = H(candle);
    const low = L(candle);
    const close = C(candle);
    if (![open, high, low, close].every((v) => Number.isFinite(v))) return null;
    const range = high - low;
    const body = Math.abs(close - open);
    return {
        open,
        high,
        low,
        close,
        range,
        body,
        upperShadow: high - Math.max(open, close),
        lowerShadow: Math.min(open, close) - low,
        bullish: close > open,
        bearish: close < open,
        // Range zero (vela totalmente plana, acontece em ativo sem liquidez
        // no timeframe): bodyRatio fica null em vez de virar uma divisão
        // por zero disfarçada de leitura real.
        bodyRatio: range > 0 ? body / range : null,
    };
}

/** Doji real: corpo desprezível diante do range. Não é reversão por si —
 *  é INDECISÃO, e o motor o rotula assim (nunca como sinal direcional). */
export function isDoji(g) {
    return g !== null && g.bodyRatio !== null && g.bodyRatio <= DOJI_BODY_RATIO;
}

/** Silhueta de martelo/enforcado: corpo pequeno no ALTO do range, sombra
 *  inferior longa. NOTA: esta função responde só "que forma é esta?" — o
 *  NOME (martelo vs enforcado) depende da tendência e é decidido em
 *  classifyAt, nunca aqui. */
export function hasHammerShape(g) {
    if (g === null || g.body <= 0) return false;
    return g.lowerShadow >= SHADOW_BODY_RATIO * g.body && g.upperShadow <= OPPOSITE_SHADOW_MAX_BODY * g.body;
}

/** Silhueta invertida: sombra SUPERIOR longa, corpo no fundo do range
 *  (estrela cadente numa alta, martelo invertido numa queda). */
export function hasInvertedHammerShape(g) {
    if (g === null || g.body <= 0) return false;
    return g.upperShadow >= SHADOW_BODY_RATIO * g.body && g.lowerShadow <= OPPOSITE_SHADOW_MAX_BODY * g.body;
}

/** Marubozu: corpo grande, praticamente sem sombra — continuação forte. */
export function isMarubozu(g) {
    if (g === null || g.range <= 0) return false;
    return (g.upperShadow + g.lowerShadow) / g.range <= MARUBOZU_SHADOW_MAX_RATIO;
}

/** Engolfo por CORPO (a regra clássica real — nunca por pavio). */
export function isEngulfing(prev, cur) {
    if (prev === null || cur === null) return false;
    const prevTop = Math.max(prev.open, prev.close);
    const prevBottom = Math.min(prev.open, prev.close);
    const curTop = Math.max(cur.open, cur.close);
    const curBottom = Math.min(cur.open, cur.close);
    // Corpos de direção OPOSTA e o atual cobrindo o anterior por inteiro.
    const opposite = (prev.bullish && cur.bearish) || (prev.bearish && cur.bullish);
    return opposite && curTop >= prevTop && curBottom <= prevBottom && cur.body > prev.body;
}

/** Harami: o inverso do engolfo — corpo pequeno CONTIDO no corpo grande
 *  anterior, de direção oposta. */
export function isHarami(prev, cur) {
    if (prev === null || cur === null) return false;
    const prevTop = Math.max(prev.open, prev.close);
    const prevBottom = Math.min(prev.open, prev.close);
    const curTop = Math.max(cur.open, cur.close);
    const curBottom = Math.min(cur.open, cur.close);
    const opposite = (prev.bullish && cur.bearish) || (prev.bearish && cur.bullish);
    return opposite && curTop <= prevTop && curBottom >= prevBottom && cur.body < prev.body;
}

/** Fração do corpo da vela anterior que a atual penetrou, no sentido
 *  contrário à anterior. Base real de Piercing/Dark Cloud (>50%). */
export function penetrationRatio(prev, cur) {
    if (prev === null || cur === null || prev.body <= 0) return null;
    if (prev.bearish && cur.bullish) return (cur.close - prev.close) / prev.body;
    if (prev.bullish && cur.bearish) return (prev.close - cur.close) / prev.body;
    return null;
}

// Vocabulário único de saída. `direction` é o VIÉS que o padrão sugere —
// nunca uma ordem, nunca uma decisão (LEI 24): quem decide LONG/SHORT
// continua sendo só o Core Engine.
function pattern(code, name, direction, kind, index, candle, bodyAtr, extra = {}) {
    return { code, name, direction, kind, index, time: T(candle), bodyAtr, ...extra };
}

/**
 * Classifica o padrão que TERMINA no candle `i`, se houver.
 *
 * `structureLabel` é o contexto real de tendência já resolvido por
 * market-structure-engine.js — obrigatório para todo padrão de reversão.
 *
 * Só UM padrão por candle: a varredura vai do mais específico/informativo
 * (3 velas) para o menos (1 vela) e para no primeiro match. Emitir
 * "engolfo + martelo + doji" no mesmo candle encheria a tela de rótulos
 * concorrentes descrevendo o mesmo evento.
 */
export function classifyAt(candles, i, atrSeries, structureLabel) {
    const cur = candleGeometry(candles[i]);
    if (cur === null) return null;
    const atrPct = atrSeries[i];
    if (!Number.isFinite(atrPct) || atrPct <= 0 || cur.close <= 0) return null;
    // Corpo em unidades de ATR — a única medida honesta de "vela grande",
    // porque 200 dólares é enorme num ativo calmo e ruído num agitado.
    const atrPrice = (atrPct / 100) * cur.close;
    const bodyAtr = atrPrice > 0 ? cur.body / atrPrice : null;
    const bigBody = bodyAtr !== null && bodyAtr >= SIGNIFICANT_BODY_ATR;

    const prev = i >= 1 ? candleGeometry(candles[i - 1]) : null;
    const prev2 = i >= 2 ? candleGeometry(candles[i - 2]) : null;

    const downtrend = structureLabel === 'ESTRUTURA_BAIXA';
    const uptrend = structureLabel === 'ESTRUTURA_ALTA';

    // ── 3 velas: estrelas ────────────────────────────────────────────────
    // Vela 1 grande a favor da tendência, vela 2 de corpo pequeno
    // (indecisão), vela 3 grande no sentido contrário fechando além do
    // ponto médio do corpo da vela 1.
    if (prev !== null && prev2 !== null && bigBody) {
        const smallMiddle = prev.bodyRatio !== null && prev.body < prev2.body * 0.5;
        const midOf1 = (prev2.open + prev2.close) / 2;
        if (downtrend && prev2.bearish && smallMiddle && cur.bullish && cur.close >= midOf1) {
            return pattern('MORNING_STAR', 'Estrela da Manhã', 'ALTA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 3 });
        }
        if (uptrend && prev2.bullish && smallMiddle && cur.bearish && cur.close <= midOf1) {
            return pattern('EVENING_STAR', 'Estrela da Noite', 'BAIXA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 3 });
        }
    }

    // ── 2 velas ──────────────────────────────────────────────────────────
    if (prev !== null) {
        if (isEngulfing(prev, cur) && bigBody) {
            // Engolfo é reversão — exige a tendência que ele reverte.
            if (cur.bullish && downtrend) {
                return pattern('BULLISH_ENGULFING', 'Engolfo de Alta', 'ALTA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 2 });
            }
            if (cur.bearish && uptrend) {
                return pattern('BEARISH_ENGULFING', 'Engolfo de Baixa', 'BAIXA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 2 });
            }
        }

        const pen = penetrationRatio(prev, cur);
        // Piercing/Dark Cloud: penetra ALÉM da metade, mas SEM engolfar
        // (se engolfasse, já teria casado acima — são padrões distintos e
        // o engolfo é o mais forte dos dois).
        if (pen !== null && pen > MIDPOINT_PENETRATION && pen < 1 && bigBody) {
            if (cur.bullish && downtrend) {
                return pattern('PIERCING_LINE', 'Linha Perfurante', 'ALTA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 2, penetration: pen });
            }
            if (cur.bearish && uptrend) {
                return pattern('DARK_CLOUD', 'Nuvem Negra', 'BAIXA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 2, penetration: pen });
            }
        }

        if (isHarami(prev, cur)) {
            if (cur.bullish && downtrend) {
                return pattern('BULLISH_HARAMI', 'Harami de Alta', 'ALTA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 2 });
            }
            if (cur.bearish && uptrend) {
                return pattern('BEARISH_HARAMI', 'Harami de Baixa', 'BAIXA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 2 });
            }
        }
    }

    // ── 1 vela ───────────────────────────────────────────────────────────
    // A MESMA silhueta com nomes e direções opostas conforme a tendência —
    // o achado central deste motor (ver cabeçalho).
    if (hasHammerShape(cur)) {
        if (downtrend) return pattern('HAMMER', 'Martelo', 'ALTA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 1 });
        if (uptrend) return pattern('HANGING_MAN', 'Enforcado', 'BAIXA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 1 });
    }
    if (hasInvertedHammerShape(cur)) {
        if (uptrend) return pattern('SHOOTING_STAR', 'Estrela Cadente', 'BAIXA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 1 });
        if (downtrend) return pattern('INVERTED_HAMMER', 'Martelo Invertido', 'ALTA', 'REVERSAL', i, candles[i], bodyAtr, { candles: 1 });
    }

    // Marubozu é CONTINUAÇÃO, não reversão — não depende de tendência
    // anterior para existir, e por isso não é bloqueado por ela.
    if (isMarubozu(cur) && bigBody) {
        return cur.bullish
            ? pattern('MARUBOZU_BULL', 'Marubozu de Alta', 'ALTA', 'CONTINUATION', i, candles[i], bodyAtr, { candles: 1 })
            : pattern('MARUBOZU_BEAR', 'Marubozu de Baixa', 'BAIXA', 'CONTINUATION', i, candles[i], bodyAtr, { candles: 1 });
    }

    // Doji é INDECISÃO — direction null de propósito. Rotulá-lo de ALTA ou
    // BAIXA seria exatamente a fabricação que a Regra de Ouro 3 proíbe.
    if (isDoji(cur)) {
        return pattern('DOJI', 'Doji', null, 'INDECISION', i, candles[i], bodyAtr, { candles: 1 });
    }

    return null;
}

/**
 * `ohlcv_series` é opcional no TIPO de propósito: a função aceita entrada
 * vazia/ausente e devolve DADOS_INSUFICIENTES — fail-closed real, travado
 * por teste. Declará-lo obrigatório mentiria sobre o contrato e forçaria
 * quem chama a checar antes o que este motor já checa por dentro.
 *
 * @param {{ ohlcv_series?: Array<object>|null, timeframe?: string }} [input]
 * @returns {object} status 'OK' com `patterns` (janela recente) e `latest`
 *  (o mais recente, ou null honesto), ou 'DADOS_INSUFICIENTES'.
 */
export function analyze(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    // Aquecimento real do ATR de Wilder (14) + as 2 velas de contexto que o
    // padrão de 3 velas precisa.
    if (candles.length < 17) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine, reason: 'candles insuficientes para ATR real + contexto de padrão' };
    }

    const structureResult = analyzeMarketStructure(input);
    // Sem estrutura confirmada o motor NÃO para: padrões de continuação/
    // indecisão (marubozu, doji) continuam válidos, porque não dependem de
    // tendência anterior. Só os de REVERSÃO ficam bloqueados — e ficam
    // bloqueados de propósito (ver cabeçalho: sem tendência, Martelo e
    // Enforcado são indistinguíveis, e chutar entre os dois seria emitir o
    // lado errado em metade dos casos).
    const structureLabel = structureResult.status === 'OK' ? structureResult.structure_label : null;

    const atrSeries = computeAtrPercent(candles);
    const start = Math.max(2, candles.length - PATTERN_SCAN_WINDOW);
    const patterns = [];
    for (let i = start; i < candles.length; i++) {
        const found = classifyAt(candles, i, atrSeries, structureLabel);
        if (found === null) continue;
        // Confirmação real: a vela SEGUINTE fechou a favor do viés do
        // padrão? A pesquisa é explícita em que o padrão sozinho é fraco e
        // a confirmação importa. `null` quando não existe vela seguinte
        // ainda (o padrão acabou de se formar) — nunca um `false` que se
        // leria como "foi negado".
        const next = i + 1 < candles.length ? candleGeometry(candles[i + 1]) : null;
        let confirmed = null;
        if (next !== null && found.direction !== null) {
            confirmed = found.direction === 'ALTA' ? next.bullish : next.bearish;
        }
        patterns.push({ ...found, confirmed });
    }

    return {
        status: 'OK',
        engine: metadata.engine,
        structureContext: structureLabel,
        patterns,
        latest: patterns.length > 0 ? patterns[patterns.length - 1] : null,
    };
}
