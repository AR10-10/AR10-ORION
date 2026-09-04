// supertrend-engine.js — SuperTrend (Olivier Seban) sobre candles reais.
// Pura funcao de calculo: zero fetch, zero rede, zero estado global,
// mesmo padrao de liquidity-void-engine.js/fvg-order-block-engine.js
// nesta mesma pasta.
//
// AUDITORIA ANTES DE CONSTRUIR (CLAUDE.md, Disciplina de trabalho item 1):
// grep real por "supertrend" em src/ e ramber-ui/src/ nao encontrou NADA —
// gap genuino, diferente de varios outros itens do mesmo documento de
// pesquisa que ja existiam ha entregas (CVD/Cumulative Delta em
// nexus/market-analysis.ts, Absorption em src/orderflow/signal-engine.js,
// walk-forward no laboratorio de backtest estrutural — caminho nao citado
// literal aqui de proposito: existe um guarda de fronteira real (LEI 24,
// tests/structural-backtest.test.ts) que varre src/ atras da string do
// caminho para provar que nenhum modulo de producao importa daquele
// laboratorio, e uma mencao em COMENTARIO dispararia o guarda igual a um
// import de verdade. Achado real desta entrega, nao suposicao). Motores
// vizinhos conferidos e deliberadamente NAO reaproveitados como
// substitutos: regime-engine.js classifica REGIME (ADX/DI + largura de
// banda), trend-channel-engine.ts ajusta um canal de REGRESSAO (OLS +-
// sigma) — nenhum dos dois produz um stop que TRILHA o preco e trava,
// que e' exatamente o que o SuperTrend e'.
//
// PESQUISA REAL DO CALCULO (CLAUDE.md item 2 — confirmado via WebSearch
// antes de escrever uma linha; TradingView "Supertrend" support doc,
// LiteFinance, Strike.money, CrossTrade). O documento de pesquisa que
// motivou este motor trazia a formula INCOMPLETA — so as bandas basicas:
//     Upper = (H+L)/2 + mult*ATR ; Lower = (H+L)/2 - mult*ATR
//     Trend = close > Upper anterior ? UP : DOWN
// Sem a REGRA DE TRAVAMENTO das bandas isso nao e' SuperTrend: seria um
// par de bandas tipo Keltner que oscila junto com o preco e inverte a
// cada respiro do mercado. A regra real, confirmada na pesquisa ("the
// upper band only moves down or stays flat when price is above it, and
// the lower band only moves up or stays flat when price is below it"), e'
// a catraca que transforma a banda num TRAILING STOP:
//     finalUpper[i] = (basicUpper[i] < finalUpper[i-1] || close[i-1] > finalUpper[i-1])
//                       ? basicUpper[i] : finalUpper[i-1]
//     finalLower[i] = (basicLower[i] > finalLower[i-1] || close[i-1] < finalLower[i-1])
//                       ? basicLower[i] : finalLower[i-1]
// E o flip de tendencia so acontece por FECHAMENTO alem da banda final
// oposta — nunca por pavio (o que geraria flip fantasma em cada sweep de
// liquidez, justamente o evento que trap-detection.ts ja trata a parte).
//
// ZERO SEGUNDA MATEMATICA (Regra de Ouro 4): o ATR de Wilder ja existe,
// exportado e testado, em lorentzian-classifier.js (computeAtrPercent) —
// reusado aqui tal qual. Aquela funcao devolve ATR como % do close; o
// SuperTrend precisa de ATR em unidade de PRECO, entao o valor e'
// convertido de volta por atr = (atrPct/100) * close. Isso e' recuperacao
// EXATA (a propria funcao computa (atr/close)*100), nunca uma segunda
// suavizacao de Wilder rodando em paralelo — travado por teste.
//
// LEI 24: display only. SuperTrend e' contexto/confluencia de tendencia e
// um nivel de trailing stop VISUAL — nunca um segundo emissor de LONG/
// SHORT/WAIT. O unico emissor real continua sendo o Core Engine.
import { computeAtrPercent } from './lorentzian-classifier.js';

export const metadata = {
    engine: 'supertrend-engine',
    description: 'SuperTrend (Olivier Seban) — banda ATR travada em catraca que trilha o preco como stop dinamico e inverte por fechamento real alem da banda oposta.',
    concepts: ['SuperTrend', 'ATR de Wilder (computeAtrPercent, lorentzian-classifier.js)', 'Trailing stop por catraca de banda final', 'Flip por fechamento (nunca por pavio)'],
    required_data: ['ohlcv_series com high/low/close reais por candle'],
    // CORRIGIDO: ficou 'LABORATORIO' por 8 dias depois da graduacao real
    // (2026-08-23) — o engine-bridge.ts ja o importava, ele ja tinha camada
    // propria no grafico e custo no orcamento visual. Mesmo defeito que a
    // arvore-resumo do QUARANTINE.md tinha, na terceira fonte de verdade.
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'period=10 / multiplier=3 sao os defaults REAIS de mercado (TradingView e a maioria das plataformas), nao uma calibracao deste repositorio — nenhum backtest local sustenta que sejam otimos para cripto/USDT-M.',
        'O primeiro ponto avaliavel e um SEED, nao um flip confirmado: a direcao inicial e decidida por close vs. o ponto medio do proprio candle (decisao declarada, ver SEED abaixo). Cada ponto carrega flipped:false ate o primeiro cruzamento real, e o consumidor nunca deve ler o seed como sinal.',
        'Exige aquecimento real do ATR de Wilder (period candles) antes do primeiro candle avaliavel.',
        'Indicador de SEGUIMENTO: em mercado lateral produz flips frequentes por desenho — e uma propriedade conhecida do metodo, nunca um defeito desta implementacao.',
    ],
};

export const SUPERTREND_DEFAULT_PERIOD = 10;
export const SUPERTREND_DEFAULT_MULTIPLIER = 3;

/** Le high/low/close aceitando as duas convencoes de candle ja usadas
 *  neste repositorio (h/l/c cru do conector, high/low/close do grafico) —
 *  mesma tolerancia que computeAtrPercent ja pratica. */
function ohlc(candle) {
    const high = candle.h ?? candle.high;
    const low = candle.l ?? candle.low;
    const close = candle.c ?? candle.close;
    return { high, low, close };
}

/**
 * @typedef {{ index: number, line: number, trend: 'UP' | 'DOWN', flipped: boolean }} SuperTrendPoint
 * @typedef {{ status: 'OK' | 'DADOS_INSUFICIENTES', points: SuperTrendPoint[], period: number, multiplier: number }} SuperTrendResult
 *
 * SuperTrend real sobre a serie recebida.
 *
 * @param {Array<{h?: number, l?: number, c?: number, high?: number, low?: number, close?: number}>} candles
 * @param {number} [period] periodo do ATR de Wilder (default real de mercado: 10)
 * @param {number} [multiplier] multiplicador do ATR (default real de mercado: 3)
 * @returns {SuperTrendResult}
 */
export function computeSuperTrend(candles, period = SUPERTREND_DEFAULT_PERIOD, multiplier = SUPERTREND_DEFAULT_MULTIPLIER) {
    const EMPTY = { status: 'DADOS_INSUFICIENTES', points: [], period, multiplier };
    if (!Array.isArray(candles)) return EMPTY;
    if (!Number.isFinite(period) || period <= 0) return EMPTY;
    if (!Number.isFinite(multiplier) || multiplier <= 0) return EMPTY;
    // computeAtrPercent so produz valor a partir do indice `period`
    // (aquecimento real de Wilder) — sem pelo menos period+1 candles nao
    // existe nenhum ponto avaliavel. Fail-closed, nunca um ponto fabricado.
    if (candles.length <= period) return EMPTY;

    const atrPct = computeAtrPercent(candles, period);

    /** @type {SuperTrendPoint[]} */
    const points = [];
    let finalUpper = NaN;
    let finalLower = NaN;
    let trend = null;
    let prevClose = NaN;

    for (let i = 0; i < candles.length; i++) {
        const pct = atrPct[i];
        if (!Number.isFinite(pct)) continue; // ainda em aquecimento do ATR.
        const { high, low, close } = ohlc(candles[i]);
        if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) continue; // candle corrompido — nunca extrapola.

        // ATR de volta em unidade de PRECO. Recuperacao exata do valor que
        // computeAtrPercent computou como (atr/close)*100 — zero segunda
        // suavizacao de Wilder.
        const atr = (pct / 100) * close;
        const mid = (high + low) / 2;
        const basicUpper = mid + multiplier * atr;
        const basicLower = mid - multiplier * atr;

        if (trend === null) {
            // SEED (ver limitations): primeiro candle com ATR real. Nao ha
            // banda anterior para travar nem fechamento anterior para
            // cruzar, entao a catraca comeca nas bandas basicas e a
            // direcao sai do proprio candle (close vs. ponto medio) — uma
            // leitura real do dado, nunca uma constante arbitraria. Marcado
            // flipped:false: e' ponto de partida, nao cruzamento.
            finalUpper = basicUpper;
            finalLower = basicLower;
            trend = close >= mid ? 'UP' : 'DOWN';
            points.push({ index: i, line: trend === 'UP' ? finalLower : finalUpper, trend, flipped: false });
            prevClose = close;
            continue;
        }

        // CATRACA (a regra que o documento de pesquisa omitia): a banda
        // superior so desce ou fica parada; a inferior so sobe ou fica
        // parada — exceto quando o fechamento ANTERIOR ja rompeu a banda,
        // caso em que ela e' relancada a partir da banda basica.
        finalUpper = basicUpper < finalUpper || prevClose > finalUpper ? basicUpper : finalUpper;
        finalLower = basicLower > finalLower || prevClose < finalLower ? basicLower : finalLower;

        // FLIP so por FECHAMENTO alem da banda final oposta — nunca por
        // pavio (evita flip fantasma em cada sweep de liquidez).
        const prevTrend = trend;
        if (trend === 'DOWN' && close > finalUpper) trend = 'UP';
        else if (trend === 'UP' && close < finalLower) trend = 'DOWN';

        points.push({
            index: i,
            line: trend === 'UP' ? finalLower : finalUpper,
            trend,
            flipped: trend !== prevTrend,
        });
        prevClose = close;
    }

    if (points.length === 0) return EMPTY; // serie inteira corrompida/insuficiente — honesto.
    return { status: 'OK', points, period, multiplier };
}
