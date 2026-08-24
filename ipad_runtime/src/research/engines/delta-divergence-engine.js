// delta-divergence-engine.js — DIVERGENCIA DE DELTA (preco x CVD).
//
// POR QUE ESTE MOTOR EXISTE (auditoria antes de construir, Disciplina §1,
// e comparacao real com plataformas concorrentes pedida pelo Operador):
// `grep -ri "divergen"` no repositorio inteiro so' encontrou divergencia
// ENTRE CORRETORAS (trust score, cross-exchange) e o nome da palavra em
// macd.ts. Divergencia de DELTA — preco e fluxo liquido discordando — nao
// existia, e e' o item que TODAS as plataformas de order flow consultadas
// destacam (Sierra Chart nomeia "Delta Divergence" explicitamente; ATAS,
// Tape Delta, GoCharting e Bookmap trazem o mesmo conceito).
//
// DEFINICAO PESQUISADA, NAO INVENTADA (CLAUDE.md item 2 — confirmada via
// WebSearch em multiplas fontes independentes antes de escrever codigo):
//
//   BAIXISTA  preco faz TOPO MAIS ALTO, CVD faz TOPO MAIS BAIXO.
//             Exaustao compradora: o preco sobe sem que a agressao
//             compradora acompanhe.
//   ALTISTA   preco faz FUNDO MAIS BAIXO, CVD faz FUNDO MAIS ALTO.
//             Exaustao vendedora: o espelho exato.
//
// EXAUSTAO NAO E' ABSORCAO (as fontes separam os dois, e este repositorio
// ja' tem absorcao em src/orderflow/signal-engine.js): exaustao e' AUSENCIA
// de pressao (menos gente disposta a comprar no topo novo); absorcao e'
// pressao BATENDO NUMA PAREDE (agressao existe, mas nao move o preco). Sao
// leituras diferentes e este motor calcula so' a primeira.
//
// LEI 24 — e aqui a pesquisa e a lei do projeto dizem a MESMA coisa, o que
// e' raro o bastante para registrar: as fontes afirmam que a divergencia
// "marca um LOCAL de possivel exaustao, nao um GATILHO — espere o preco
// confirmar". E' literalmente a definicao de camada de confluencia
// display-only. Este motor nunca emite LONG/SHORT.
//
// ZERO MATEMATICA NOVA: os swings vem de fractal-swings.js (o mesmo
// K=2 compartilhado por todos os motores). O CVD vem da serie real ja'
// retida pelo poller (nexus/orderflow-history.ts) — este motor nao coleta
// nada, nao estima nada e nao interpola nada.
//
// CAUSALIDADE REAL: um swing fractal so' e' CONFIRMADO K candles depois de
// acontecer. Este motor so' compara swings ja' confirmados no ultimo
// candle da janela — nunca um swing que so' se tornaria visivel no futuro.
// Sem isso a divergencia "acertaria" no backtest usando informacao que nao
// existia no momento.
//
// LIMITACAO REAL E DECISIVA, DECLARADA (nao um detalhe): o CVD retido cobre
// uma janela CURTA de tempo real (ver ORDERFLOW_HISTORY_CAPACITY em
// nexus/orderflow-history.ts). Em timeframes altos isso pode nao cobrir
// nem um punhado de velas, e nesse caso este motor devolve
// DADOS_INSUFICIENTES — nunca uma divergencia calculada sobre CVD
// extrapolado. A mesma limitacao ja' esta documentada em
// nexus/multi-timeframe-engine.ts para Order Flow por timeframe; e' a
// mesma causa raiz, nao duas.

import { FRACTAL_K, findSwings } from './fractal-swings.js';

export const metadata = {
    engine: 'delta-divergence-engine',
    description: 'Divergencia entre preco e CVD (Cumulative Volume Delta) — exaustao compradora/vendedora detectada por swings confirmados nas duas series.',
    concepts: [
        'Divergencia baixista (preco topo mais alto + CVD topo mais baixo = exaustao compradora)',
        'Divergencia altista (preco fundo mais baixo + CVD fundo mais alto = exaustao vendedora)',
    ],
    required_data: ['ohlcv_series', 'cvd_samples'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Depende da janela real de CVD retida pelo poller — sem cobertura suficiente devolve DADOS_INSUFICIENTES, nunca extrapola.',
        'Exaustao NAO e absorcao: este motor mede ausencia de pressao, nao pressao batendo numa parede (absorcao vive em src/orderflow/signal-engine.js).',
        'Divergencia e um LOCAL de possivel exaustao, nunca um gatilho — display only (LEI 24), o preco ainda precisa confirmar.',
        'So compara swings ja CONFIRMADOS (index + K <= ultimo indice coberto) — nunca um swing visivel so no futuro.',
    ],
};

/** Minimo de velas com cobertura REAL de CVD para uma leitura valer. Abaixo
 *  disso nao ha' nem como confirmar dois swings fractais (K=2 de cada lado
 *  exige 5 velas por swing, e a divergencia compara DOIS). */
export const MIN_COVERED_CANDLES = 12;

function candleTime(c) {
    return c?.time ?? c?.t ?? null;
}

/**
 * Valor de CVD ao FIM de cada vela.
 *
 * Cada amostra real cai na vela que a contem; o valor da vela e' a ULTIMA
 * amostra dentro dela (o CVD e' cumulativo, entao a ultima amostra e' o
 * estado ao fim daquela vela). Vela sem nenhuma amostra fica sem cobertura
 * — nunca recebe o valor da vizinha, que seria um ponto inventado.
 *
 * @param {Array<{time:number}>} candles velas com `time` em SEGUNDOS
 * @param {Array<{time:number, cvd:number}>} samples amostras com `time` em MILISSEGUNDOS
 * @returns {(number|null)[]} paralelo a `candles`; null = sem cobertura real
 */
export function mapCvdToCandles(candles, samples) {
    const out = new Array(candles.length).fill(null);
    if (!Array.isArray(candles) || !Array.isArray(samples)) return out;

    const times = candles.map(candleTime);
    const ordenadas = samples
        .filter((s) => Number.isFinite(s?.time) && Number.isFinite(s?.cvd))
        .sort((a, b) => a.time - b.time);

    for (const s of ordenadas) {
        const segundos = s.time / 1000;
        // Busca binaria pela ultima vela cujo tempo de abertura <= amostra.
        let lo = 0;
        let hi = candles.length - 1;
        let achou = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const t = times[mid];
            if (!Number.isFinite(t)) break;
            if (t <= segundos) {
                achou = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        if (achou === -1) continue; // amostra anterior a toda a serie — descartada.
        out[achou] = s.cvd; // ordenadas por tempo => a ultima sobrescreve, que e o que queremos.
    }
    return out;
}

/**
 * Maior sufixo CONTIGUO de velas com cobertura real de CVD.
 *
 * Sufixo, e nao "a maior faixa em qualquer lugar", de proposito: o CVD e'
 * uma janela rolante que termina AGORA. Um buraco no meio significa que o
 * terminal ficou sem dado naquele intervalo, e costurar os dois lados
 * produziria uma serie de CVD que nunca existiu.
 *
 * @returns {{from:number, to:number}|null}
 */
export function coveredSuffix(coverage) {
    let to = coverage.length - 1;
    while (to >= 0 && coverage[to] === null) to--; // ignora velas futuras ainda sem amostra
    if (to < 0) return null;
    let from = to;
    while (from - 1 >= 0 && coverage[from - 1] !== null) from--;
    return { from, to };
}

export function analyze(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    const samples = Array.isArray(input.cvd_samples) ? input.cvd_samples : [];

    const insuficiente = (reason) => ({
        status: 'DADOS_INSUFICIENTES',
        engine: metadata.engine,
        reason,
        divergence: null,
        coveredCandles: 0,
    });

    if (candles.length < MIN_COVERED_CANDLES) {
        return insuficiente(`apenas_${candles.length}_candles_abaixo_do_minimo_${MIN_COVERED_CANDLES}`);
    }
    if (samples.length === 0) return insuficiente('sem_amostras_reais_de_cvd');

    const coverage = mapCvdToCandles(candles, samples);
    const janela = coveredSuffix(coverage);
    if (janela === null) return insuficiente('nenhuma_vela_com_cobertura_real_de_cvd');

    const cobertas = janela.to - janela.from + 1;
    if (cobertas < MIN_COVERED_CANDLES) {
        // O caso NORMAL em timeframe alto. Nunca extrapola o CVD para
        // preencher — devolve o numero real de velas cobertas para a UI
        // poder dizer ao Operador exatamente o que falta.
        return {
            status: 'DADOS_INSUFICIENTES',
            engine: metadata.engine,
            reason: `cvd_cobre_apenas_${cobertas}_velas_abaixo_do_minimo_${MIN_COVERED_CANDLES}`,
            divergence: null,
            coveredCandles: cobertas,
        };
    }

    const janelaCandles = candles.slice(janela.from, janela.to + 1);
    const janelaCvd = coverage.slice(janela.from, janela.to + 1);

    // CAUSALIDADE: a garantia de que nenhum swing "do futuro" e' usado vem
    // do PROPRIO findSwings, que so' varre `k <= i < length - k` — todo
    // swing devolvido ja' tem K candles a direita, logo ja' esta
    // confirmado no ultimo candle da janela.
    //
    // A primeira versao deste motor filtrava de novo aqui
    // (`s.index + FRACTAL_K <= ultimo`). Um teste de MUTACAO mostrou que
    // remover esse filtro nao quebrava nada: ele era um no-op. Um guard que
    // nao guarda e' pior que nenhum — passa a impressao de protecao onde
    // nao ha'. Removido, e a garantia real esta travada por teste em cima
    // de findSwings, que e' onde ela de fato vive.
    const topos = findSwings(janelaCandles, FRACTAL_K, true);
    const fundos = findSwings(janelaCandles, FRACTAL_K, false);

    /** Compara os DOIS ultimos swings confirmados de um lado. */
    const comparar = (swings, ehTopo) => {
        if (swings.length < 2) return null;
        const a = swings[swings.length - 2];
        const b = swings[swings.length - 1];
        const cvdA = janelaCvd[a.index];
        const cvdB = janelaCvd[b.index];
        if (!Number.isFinite(cvdA) || !Number.isFinite(cvdB)) return null;

        const precoDivergiu = ehTopo ? b.price > a.price : b.price < a.price;
        const cvdDivergiu = ehTopo ? cvdB < cvdA : cvdB > cvdA;
        if (!precoDivergiu || !cvdDivergiu) return null;

        return {
            type: ehTopo ? 'BAIXISTA' : 'ALTISTA',
            // Indices no array ORIGINAL de candles — quem desenha precisa
            // deles alinhados ao que esta na tela, nao a janela interna.
            fromIndex: janela.from + a.index,
            toIndex: janela.from + b.index,
            fromPrice: a.price,
            toPrice: b.price,
            fromCvd: cvdA,
            toCvd: cvdB,
        };
    };

    // Um topo e um fundo podem divergir na MESMA janela (mercado em
    // compressao). Vence o swing mais RECENTE — e' a leitura viva; a outra
    // ja' foi superada pelos proprios candles seguintes.
    const baixista = comparar(topos, true);
    const altista = comparar(fundos, false);
    let divergence = null;
    if (baixista && altista) divergence = baixista.toIndex >= altista.toIndex ? baixista : altista;
    else divergence = baixista ?? altista;

    return {
        status: 'OK',
        engine: metadata.engine,
        reason: null,
        divergence,
        coveredCandles: cobertas,
    };
}
