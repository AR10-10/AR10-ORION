// ichimoku-engine.js — Ichimoku Kinko Hyo (Goichi Hosoda). Pura funcao de
// calculo: zero fetch, zero rede, zero estado global, mesmo padrao de todo
// motor desta pasta.
//
// AUDITORIA ANTES DE CONSTRUIR (CLAUDE.md, Disciplina §1): a auditoria do
// ecossistema de indicadores desta trilha confirmou por grep real que
// Ichimoku era uma das 7 ferramentas classicas ausentes, e a UNICA que
// sobreviveu ao julgamento de redundancia junto com Pivot Points (ja
// graduado): CCI/Stochastic/Williams %R/MFI sao substituiveis pelo RSI de
// Wilder + CVD/Delta/Volume Profile ja reais; Keltner e' redundante com o
// Bollinger Bandwidth (regime-engine.js) + SuperTrend. Ichimoku nao e'
// substituivel por nada aqui: nenhum motor deste repositorio projeta nivel
// PARA FRENTE no tempo, e nenhum mede equilibrio por ponto medio de
// extremos. Ficou de fora da rodada dos Pivot Points por escopo (5 linhas
// + nuvem + deslocamento nos dois sentidos), nao por falta de valor.
//
// DEFINICAO PESQUISADA, NAO INVENTADA (CLAUDE.md item 2 — WebSearch antes
// de escrever codigo, cruzada em MQL5 Traders' Blogs, manual do pacote R
// `ichimoku` (CRAN), IFC Markets, AvaTrade e Naga Academy):
//
//   Tenkan-sen  (Conversao) = (maxima 9  + minima 9 ) / 2
//   Kijun-sen   (Base)      = (maxima 26 + minima 26) / 2
//   Senkou A    (Lider A)   = (Tenkan + Kijun) / 2   ... deslocado 26 A FRENTE
//   Senkou B    (Lider B)   = (maxima 52 + minima 52) / 2 ... 26 A FRENTE
//   Chikou      (Atrasada)  = fechamento atual        ... deslocado 26 ATRAS
//   Kumo (nuvem) = a area entre Senkou A e Senkou B
//
// O ERRO CLASSICO QUE ESTE MOTOR NAO COMETE: as fontes sao unanimes em que
// as cinco linhas sao PONTOS MEDIOS DE MAXIMA/MINIMA, nunca medias moveis
// de fechamento. Uma implementacao com SMA de close produz curvas parecidas
// e valores diferentes — e seria outro indicador com o mesmo nome.
//
// CONTRATO DE DESLOCAMENTO (a parte que mais se erra em integracao): este
// motor devolve as series JA POSICIONADAS NO INDICE ONDE SE DESENHA, para
// o consumidor nao ter que reaplicar o shift (e errar o sinal). Ou seja:
//   senkouA[i] / senkouB[i]  = valor calculado em (i - 26)  -> NaN antes disso
//   chikou[i]                = fechamento de (i + 26)       -> NaN no fim
// E como a nuvem legitimamente avanca 26 barras ALEM do ultimo candle (nao
// existe candle onde pendura-la), esses 26 pontos saem separados em
// `futureSenkouA`/`futureSenkouB` — nunca empurrados para dentro do array
// alinhado, o que fabricaria candle que nao existe.

export const metadata = {
    engine: 'ichimoku-engine',
    description: 'Ichimoku Kinko Hyo completo (Tenkan/Kijun/Senkou A/Senkou B/Chikou + nuvem Kumo) sobre candles reais, com deslocamento real para frente e para tras.',
    concepts: ['Ichimoku Kinko Hyo (Hosoda)', 'Ponto medio de extremos (nunca media movel de close)', 'Kumo (nuvem) projetada 26 periodos a frente', 'Chikou Span deslocada 26 periodos atras'],
    required_data: ['ohlcv_series com high/low/close reais'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Periodos classicos 9/26/52 com deslocamento 26 — os parametros originais de Hosoda. Variantes de cripto 24h (ex. 10/30/60, 20/60/120) existem na comunidade e NAO estao implementadas: sao escolhas diferentes, nao "a mesma conta ajustada".',
        'A nuvem historica so aparece a partir do indice 78 (52 de aquecimento + 26 de deslocamento). Antes disso as series alinhadas trazem NaN honesto — nunca um valor extrapolado para preencher o comeco do grafico.',
        'A Chikou Span termina 26 candles ANTES do ultimo: por definicao ela mostra o fechamento de 26 barras a frente, que ainda nao existe no fim da serie. NaN ali e o resultado correto, nao uma falha.',
        'Este motor descreve equilibrio/estrutura; nao emite direcao. Cruzamentos (Tenkan x Kijun, preco x nuvem) sao leitura do Operador — LEI 24: o unico emissor de LONG/SHORT/WAIT continua sendo o Core Engine.',
    ],
};

export const ICHIMOKU_TENKAN_PERIOD = 9;
export const ICHIMOKU_KIJUN_PERIOD = 26;
export const ICHIMOKU_SENKOU_B_PERIOD = 52;
/** Deslocamento classico, usado nos DOIS sentidos: Senkou A/B para frente,
 *  Chikou para tras. E' o mesmo 26 do Kijun por desenho original de Hosoda,
 *  nao coincidencia — por isso uma constante so. */
export const ICHIMOKU_DISPLACEMENT = 26;

/** Minimo para o motor produzir as cinco linhas no ultimo candle. A nuvem
 *  HISTORICA precisa de mais (ver limitations), mas a projetada — a parte
 *  que o Operador mais olha — ja e' real com 52. */
const MIN_CANDLES = ICHIMOKU_SENKOU_B_PERIOD;

function fieldOf(c, short, long) {
    return c[short] ?? c[long];
}

/** Ponto medio entre a maxima e a minima da janela que TERMINA em `end`
 *  (inclusive), com `period` candles. null se a janela nao cabe ou se
 *  qualquer extremo da janela nao e' finito — fail-closed, nunca um
 *  meio-caminho calculado sobre dado faltando. */
function midpointOfExtremes(candles, end, period) {
    const start = end - period + 1;
    if (start < 0) return null;
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = start; i <= end; i++) {
        const h = fieldOf(candles[i], 'h', 'high');
        const l = fieldOf(candles[i], 'l', 'low');
        if (!Number.isFinite(h) || !Number.isFinite(l)) return null;
        if (h > hi) hi = h;
        if (l < lo) lo = l;
    }
    return (hi + lo) / 2;
}

/** Ichimoku completo. Devolve as series ALINHADAS AO INDICE DE DESENHO
 *  (ver contrato de deslocamento no cabecalho) mais os 26 pontos de nuvem
 *  que avancam alem do ultimo candle. */
export function computeIchimoku(candles) {
    if (!Array.isArray(candles) || candles.length < MIN_CANDLES) {
        return { status: 'DADOS_INSUFICIENTES', reason: 'candles_insuficientes_para_ichimoku' };
    }
    const n = candles.length;
    const nan = () => new Array(n).fill(NaN);

    // Passo 1 — valores no indice em que sao CALCULADOS.
    const tenkanRaw = nan();
    const kijunRaw = nan();
    const senkouARaw = nan();
    const senkouBRaw = nan();
    for (let i = 0; i < n; i++) {
        const t = midpointOfExtremes(candles, i, ICHIMOKU_TENKAN_PERIOD);
        const k = midpointOfExtremes(candles, i, ICHIMOKU_KIJUN_PERIOD);
        const b = midpointOfExtremes(candles, i, ICHIMOKU_SENKOU_B_PERIOD);
        if (t !== null) tenkanRaw[i] = t;
        if (k !== null) kijunRaw[i] = k;
        if (b !== null) senkouBRaw[i] = b;
        // Senkou A depende das DUAS anteriores: so existe quando ambas existem.
        if (t !== null && k !== null) senkouARaw[i] = (t + k) / 2;
    }

    // Passo 2 — deslocamento real. Tenkan e Kijun nao deslocam (sao lidas no
    // proprio candle); Senkou A/B vao 26 a frente; Chikou vai 26 atras.
    const senkouA = nan();
    const senkouB = nan();
    for (let i = ICHIMOKU_DISPLACEMENT; i < n; i++) {
        senkouA[i] = senkouARaw[i - ICHIMOKU_DISPLACEMENT];
        senkouB[i] = senkouBRaw[i - ICHIMOKU_DISPLACEMENT];
    }

    const chikou = nan();
    for (let i = 0; i + ICHIMOKU_DISPLACEMENT < n; i++) {
        const c = fieldOf(candles[i + ICHIMOKU_DISPLACEMENT], 'c', 'close');
        if (Number.isFinite(c)) chikou[i] = c;
    }

    // Passo 3 — a nuvem que avanca ALEM do ultimo candle. Sao os ultimos 26
    // valores calculados, que ainda nao encontraram o candle onde serao
    // desenhados. Ficam num array proprio de propósito: empurra-los para
    // dentro da serie alinhada inventaria candles inexistentes.
    const futureSenkouA = [];
    const futureSenkouB = [];
    for (let k = 0; k < ICHIMOKU_DISPLACEMENT; k++) {
        const src = n - ICHIMOKU_DISPLACEMENT + k;
        futureSenkouA.push(src >= 0 ? senkouARaw[src] : NaN);
        futureSenkouB.push(src >= 0 ? senkouBRaw[src] : NaN);
    }

    return {
        status: 'OK',
        tenkan: tenkanRaw,
        kijun: kijunRaw,
        senkouA,
        senkouB,
        chikou,
        futureSenkouA,
        futureSenkouB,
        displacement: ICHIMOKU_DISPLACEMENT,
    };
}

/** Leitura descritiva do ultimo candle — posicao do preco em relacao a
 *  nuvem PROJETADA sobre ele (a nuvem que vale "agora" foi calculada 26
 *  barras atras) e a espessura real dela.
 *
 *  LEI 24: isto e' CONTEXTO, nunca direcao. 'ACIMA'/'ABAIXO'/'DENTRO'
 *  descrevem onde o preco esta, exatamente como 'ESTRUTURA_ALTA' do
 *  market-structure-engine descreve — nunca um sinal de entrada. */
export function ichimokuCloudPosition(result, lastClose) {
    if (!result || result.status !== 'OK' || !Number.isFinite(lastClose)) return null;
    const i = result.senkouA.length - 1;
    const a = result.senkouA[i];
    const b = result.senkouB[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const top = Math.max(a, b);
    const bottom = Math.min(a, b);
    const position = lastClose > top ? 'ACIMA' : lastClose < bottom ? 'ABAIXO' : 'DENTRO';
    return {
        position,
        cloudTop: top,
        cloudBottom: bottom,
        // Espessura relativa ao proprio preco — comparavel entre ativos de
        // preco muito diferente, mesma unidade percentual do resto do projeto.
        thicknessPct: lastClose > 0 ? ((top - bottom) / lastClose) * 100 : null,
        // Kumo "torcido" (Senkou A abaixo de B) e' o estado que a literatura
        // classica associa a nuvem de baixa — reportado como FATO observado,
        // nunca como previsao.
        bearishCloud: a < b,
    };
}
