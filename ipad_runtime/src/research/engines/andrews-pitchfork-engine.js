// andrews-pitchfork-engine.js — ANDREWS PITCHFORK (Median Line Analysis,
// Alan H. Andrews).
//
// POR QUE ESTE MOTOR EXISTE. Auditoria do ecossistema de indicadores
// (pedido direto do Operador: "qual ferramenta que esta faltando"). Depois
// de Pivot Points e Ichimoku entrarem, o Pitchfork ficou como o UNICO
// desenho de grafico com nome proprio ainda ausente que nao estava
// bloqueado por disponibilidade de dado (como o Footprint) nem por decisao
// pendente do Operador. `grep -ri "pitchfork|andrews|median line"` no
// repositorio inteiro voltou ZERO ocorrencia antes deste arquivo.
//
// DEFINICAO PESQUISADA, NAO INVENTADA (CLAUDE.md item 2 — confirmada em
// fontes independentes antes de escrever codigo: StockCharts ChartSchool,
// Optuma "Median Line Analysis", GoCharting, Coghlan Capital):
//
//   Tres pivos ALTERNADOS consecutivos:
//     P0=fundo, P1=topo, P2=fundo   (garfo ascendente)
//     P0=topo,  P1=fundo, P2=topo   (garfo descendente)
//
//   MEDIAN LINE (ML) ... parte de P0 e passa pelo PONTO MEDIO de P1-P2.
//                        E' ela que define a inclinacao de tudo.
//   PARALELA SUPERIOR .. paralela a ML passando por P1 (garfo ascendente)
//                        ou por P2 (garfo descendente).
//   PARALELA INFERIOR .. a outra das duas.
//
// A INCLINACAO E' EM INDICE DE BARRA, NAO EM TEMPO DE RELOGIO — e essa e'
// uma decisao real, nao um detalhe de implementacao. O eixo x deste grafico
// (lightweight-charts) espaca BARRAS uniformemente, ignorando fim de semana,
// pregao fechado e buraco de dado. Uma inclinacao calculada em milissegundos
// produziria um garfo que ENTORTA visivelmente em cada vao — as tres linhas
// deixariam de ser paralelas na tela, que e' a unica coisa que o Pitchfork
// promete. Toda plataforma de charting resolve assim; aqui fica escrito.
//
// O QUE ESTE MOTOR SE RECUSA A FAZER, e por que. A literatura de Median
// Line repete uma afirmacao atribuida ao proprio Andrews: "o preco retorna a
// linha mediana em cerca de 80% das vezes". Esse numero NAO aparece em lugar
// nenhum deste motor, nem como constante, nem como campo de saida, nem como
// texto. Regra de Ouro 2: este repositorio nao tem backtest real que
// sustente uma probabilidade calibrada, e repetir um numero de terceiro como
// se fosse medicao propria e' exatamente a fabricacao que a regra proibe. O
// motor devolve GEOMETRIA REAL — tres retas a partir de tres pivos reais — e
// nada mais.
//
// LEI 24: o garfo nao emite direcao. A orientacao (ascendente/descendente) e'
// um FATO dos pivos que o formaram, do mesmo tipo de "ESTRUTURA_ALTA" do
// market-structure-engine, nunca um LONG/SHORT. O unico emissor continua
// sendo o Core Engine.
//
// ZERO MATEMATICA NOVA de swing: os pivos vem de fractal-swings.js, o mesmo
// K=2 compartilhado por todos os motores deste diretorio.

import { FRACTAL_K, findSwings } from './fractal-swings.js';

export const metadata = {
    engine: 'andrews-pitchfork-engine',
    description: 'Andrews Pitchfork (Median Line Analysis) sobre tres pivos fractais alternados reais — linha mediana + duas paralelas, inclinacao em indice de barra.',
    concepts: [
        'Median Line: de P0 pelo ponto medio de P1-P2 (Alan H. Andrews)',
        'Paralelas superior/inferior por P1 e P2',
        'Pivos alternados confirmados (fractal K=2 compartilhado)',
        'Inclinacao em INDICE DE BARRA, nunca em tempo de relogio',
    ],
    required_data: ['ohlcv_series com high/low reais'],
    status: 'LABORATORIO',
    limitations: [
        'Usa os 3 pivos alternados mais RECENTES. Escolher outro P0 muda a inclinacao do garfo inteiro — e a escolha manual de P0 e uma decisao do operador humano em toda plataforma, nao um automatismo. Aqui a escolha e declarada e fixa: os 3 ultimos confirmados.',
        'Variantes NAO implementadas: Schiff Pitchfork (P0 deslocado para o ponto medio de P0-P1) e Modified Schiff. Sao construcoes diferentes, nao "o mesmo garfo ajustado".',
        'A afirmacao de ~80% de retorno a mediana, atribuida a Andrews, NAO esta implementada nem exposta — ver o cabecalho. Sem backtest real neste repositorio, seria uma probabilidade fabricada.',
        'Este motor descreve geometria; nao emite direcao (LEI 24).',
    ],
};

/** Minimo real: 3 pivos alternados so' existem com folga de confirmacao dos
 *  dois lados. Abaixo disso o motor devolve DADOS_INSUFICIENTES honesto. */
export const MIN_CANDLES = 3 * (2 * FRACTAL_K + 1);

/**
 * Funde swings de topo e de fundo numa unica sequencia cronologica e devolve
 * a maior CAUDA alternada (…topo, fundo, topo… ou o espelho).
 *
 * Alternancia importa: dois topos seguidos sem um fundo entre eles nao
 * formam garfo nenhum — a construcao exige high-low-high ou low-high-low.
 * Quando dois pivos do MESMO tipo aparecem em sequencia, vence o mais
 * EXTREMO (o topo mais alto, o fundo mais baixo): e' o que a leitura visual
 * de "pivo significativo" faz, e evita que um ruido de 1 candle sequestre o
 * garfo inteiro.
 *
 * @returns {Array<{index:number, price:number, isHigh:boolean}>}
 */
export function alternatingPivots(candles, k = FRACTAL_K) {
    if (!Array.isArray(candles)) return [];
    const highs = findSwings(candles, k, true).map((s) => ({ ...s, isHigh: true }));
    const lows = findSwings(candles, k, false).map((s) => ({ ...s, isHigh: false }));
    const todos = [...highs, ...lows].sort((a, b) => a.index - b.index);

    const out = [];
    for (const p of todos) {
        const ultimo = out[out.length - 1];
        if (!ultimo) {
            out.push(p);
            continue;
        }
        if (ultimo.isHigh === p.isHigh) {
            // mesmo tipo em sequencia: fica o mais extremo
            const substituir = p.isHigh ? p.price > ultimo.price : p.price < ultimo.price;
            if (substituir) out[out.length - 1] = p;
            continue;
        }
        out.push(p);
    }
    return out;
}

/**
 * Andrews Pitchfork sobre os 3 pivos alternados mais recentes.
 *
 * As tres retas voltam como {index, price} + slope em PRECO POR BARRA — quem
 * desenha extrapola para onde quiser (inclusive alem do ultimo candle, que e'
 * o uso normal do garfo) sem que este motor precise saber nada de tela.
 *
 * @param {{ohlcv_series?: Array}} input
 */
export function analyze(input = {}) {
    // `input = {}` cobre `undefined`, NAO cobre `null` — passar null aqui
    // estourava num TypeError em vez de devolver DADOS_INSUFICIENTES. Achado
    // pela suite de fail-closed deste motor, antes de qualquer ligacao com o
    // app. Um motor que explode nao e' fail-closed, e' so' quebrado.
    const entrada = input && typeof input === 'object' ? input : {};
    const candles = Array.isArray(entrada.ohlcv_series) ? entrada.ohlcv_series : [];
    const k = Number.isInteger(entrada.k) && entrada.k > 0 ? entrada.k : FRACTAL_K;

    const insuficiente = (reason) => ({
        status: 'DADOS_INSUFICIENTES',
        engine: metadata.engine,
        reason,
        pitchfork: null,
    });

    if (candles.length < MIN_CANDLES) {
        return insuficiente(`apenas_${candles.length}_candles_abaixo_do_minimo_${MIN_CANDLES}`);
    }

    const pivos = alternatingPivots(candles, k);
    if (pivos.length < 3) {
        return insuficiente(`apenas_${pivos.length}_pivos_alternados_confirmados_minimo_3`);
    }

    const [p0, p1, p2] = pivos.slice(-3);

    // Ponto medio de P1-P2 — o coracao da construcao. Em indice de barra, ver
    // o cabecalho.
    const medio = {
        index: (p1.index + p2.index) / 2,
        price: (p1.price + p2.price) / 2,
    };

    const dx = medio.index - p0.index;
    if (!(dx > 0)) {
        // P0 no mesmo ponto (ou depois) do ponto medio: reta vertical, sem
        // inclinacao definida. Fail-closed em vez de dividir por zero e
        // devolver Infinity disfarcado de leitura.
        return insuficiente('ponto_medio_nao_esta_a_frente_de_p0_sem_inclinacao_definida');
    }
    const slope = (medio.price - p0.price) / dx;
    if (!Number.isFinite(slope)) return insuficiente('inclinacao_nao_finita');

    // Garfo ASCENDENTE quando P0 e' fundo (low-high-low). E' um fato dos
    // pivos, nunca uma direcao emitida (LEI 24).
    const ascending = !p0.isHigh;

    // As duas paralelas: mesma inclinacao, ancoradas em P1 e P2. Qual delas e'
    // a superior sai da ORIENTACAO, nao de comparar precos num ponto
    // arbitrario — comparar num x qualquer daria respostas diferentes
    // conforme o x escolhido, o que seria uma armadilha silenciosa.
    const upperAnchor = ascending ? p1 : p2;
    const lowerAnchor = ascending ? p2 : p1;

    return {
        status: 'OK',
        engine: metadata.engine,
        reason: null,
        pitchfork: {
            p0,
            p1,
            p2,
            /** Preco por BARRA (nunca por milissegundo) — ver cabecalho. */
            slope,
            ascending,
            /** Origem de cada uma das 3 retas. A reta e'
             *  price(i) = anchor.price + slope * (i - anchor.index). */
            median: { index: p0.index, price: p0.price },
            upper: { index: upperAnchor.index, price: upperAnchor.price },
            lower: { index: lowerAnchor.index, price: lowerAnchor.price },
            /** O ponto medio real de P1-P2, exposto porque e' o que explica a
             *  inclinacao ao Operador — e o que uma inspecao visual confere. */
            midpoint: medio,
        },
    };
}

/**
 * Preco de uma das retas do garfo num indice de barra qualquer, inclusive
 * ALEM do ultimo candle real (que e' o uso normal — o garfo se projeta para
 * frente). Funcao pura de reta; devolve null com entrada invalida.
 */
export function pitchforkPriceAt(anchor, slope, barIndex) {
    if (!anchor || !Number.isFinite(anchor.index) || !Number.isFinite(anchor.price)) return null;
    if (!Number.isFinite(slope) || !Number.isFinite(barIndex)) return null;
    const p = anchor.price + slope * (barIndex - anchor.index);
    return Number.isFinite(p) ? p : null;
}
