// data-sufficiency.js — Data Sufficiency Score para o Research Engine
// (ROTA A/B/C). Pontuacao deterministica 0-100 derivada apenas de campos
// reais ja presentes na Evidence (schema.js) e no RealAnalysisFrame
// (analysis-frame.js) desta sessao — nunca probabilistica, nunca estimada,
// nunca uma media de "confianca". Pesos fixos por categoria (somam 100):
// candles reais=25, preco/frescor=20, volume real=10, order book real=15,
// bundle de derivativos (funding/open_interest/liquidations/long_short_ratio)
// =20 (5 cada), confirmacao multi-fonte=10. paper_validation entra so' na
// matriz informativa (peso 0): nenhum motor de backtest/validacao existe
// nesta fase, entao fica sempre DADOS_INSUFICIENTES, nunca inventado.
//
// Efeito desejado (mission): instrumento spot estruturalmente nunca alcanca
// 100/100, porque funding/OI/liquidacoes/long-short ficam NAO_APLICAVEL para
// crypto_spot (ver STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT em schema.js) — o
// teto baixo e a propria mensagem honesta de "faltam derivativos", nao um bug.
//
// Protocolo Mestre (esclarecimento de auditoria): este score NAO e' o portao
// que impede o WASM/engines de rodar sobre dados insuficientes — cada um
// tem seu proprio minimo independente (analysis-frame.js exige >=10 candles,
// support-resistance-engine.js >=15, lorentzian-classifier.js seu proprio
// warmup+horizonte+k). Este arquivo roda DEPOIS disso, dentro de
// research-engine.js, e so' rebaixa (nunca promove) o rotulo de confianca
// via capConfidenceBySufficiency — um nome mais preciso seria "Confidence
// Cap Score", mas mantido como esta' para nao quebrar o contrato existente
// (ANALYSIS_OUTPUT_CONTRACT.md) sem necessidade.

import { DADOS_INSUFICIENTES, NAO_APLICAVEL } from '../real-data/schema.js';

const DERIVATIVE_FIELDS = Object.freeze(['funding', 'open_interest', 'liquidations', 'long_short_ratio']);
const POINTS_PER_DERIVATIVE_FIELD = 5; // 4 campos x 5 = 20

function isRealValue(v) {
    return v !== undefined && v !== null && v !== DADOS_INSUFICIENTES && v !== NAO_APLICAVEL;
}

/** @param {{frame: object, evidence: object, historical?: boolean, freshSourceCount?: number}} input */
export function computeDataSufficiency({ frame, evidence, historical = false, freshSourceCount } = {}) {
    const breakdown = [];
    let score = 0;

    const candlesOk = !!(frame && frame.status === 'OK');
    const candlesPts = candlesOk ? 25 : 0;
    score += candlesPts;
    breakdown.push({ field: 'candles', label: 'Candles reais', points_possible: 25, points_earned: candlesPts, status: candlesOk ? 'OK' : DADOS_INSUFICIENTES });

    const priceOk = candlesOk && !historical;
    const pricePts = candlesOk ? (historical ? 10 : 20) : 0;
    score += pricePts;
    breakdown.push({
        field: 'price',
        label: 'Preço / frescor',
        points_possible: 20,
        points_earned: pricePts,
        status: !candlesOk ? DADOS_INSUFICIENTES : (priceOk ? 'OK' : 'SESSION_PREVIOUS'),
    });

    const volumeOk = !!(frame && frame.volume_status === 'REAL');
    const volumePts = volumeOk ? 10 : 0;
    score += volumePts;
    breakdown.push({ field: 'volume', label: 'Volume real', points_possible: 10, points_earned: volumePts, status: volumeOk ? 'OK' : DADOS_INSUFICIENTES });

    const orderBookValue = evidence ? evidence.order_book : undefined;
    const orderBookNaoAplicavel = orderBookValue === NAO_APLICAVEL;
    const orderBookOk = isRealValue(orderBookValue);
    const orderBookPts = orderBookOk ? 15 : 0;
    score += orderBookPts;
    breakdown.push({
        field: 'order_book',
        label: 'Order book / profundidade',
        points_possible: 15,
        points_earned: orderBookPts,
        status: orderBookOk ? 'OK' : (orderBookNaoAplicavel ? NAO_APLICAVEL : DADOS_INSUFICIENTES),
    });

    const missingDerivatives = [];
    let derivativesNaoAplicavelCount = 0;
    for (const field of DERIVATIVE_FIELDS) {
        const value = evidence ? evidence[field] : undefined;
        const naoAplicavel = value === NAO_APLICAVEL;
        const ok = isRealValue(value);
        const pts = ok ? POINTS_PER_DERIVATIVE_FIELD : 0;
        score += pts;
        breakdown.push({ field, label: field, points_possible: POINTS_PER_DERIVATIVE_FIELD, points_earned: pts, status: ok ? 'OK' : (naoAplicavel ? NAO_APLICAVEL : DADOS_INSUFICIENTES) });
        if (naoAplicavel) derivativesNaoAplicavelCount += 1;
        else if (!ok) missingDerivatives.push(field);
    }

    const multiSourceOk = Number.isFinite(freshSourceCount) && freshSourceCount >= 2;
    const multiSourcePts = multiSourceOk ? 10 : 0;
    score += multiSourcePts;
    breakdown.push({ field: 'multi_source_confirmation', label: 'Confirmação multi-fonte', points_possible: 10, points_earned: multiSourcePts, status: multiSourceOk ? 'OK' : DADOS_INSUFICIENTES });

    // Informativo apenas — peso 0. Nenhum motor de backtest/validacao em
    // paper trading existe nesta fase; mostrar sempre DADOS_INSUFICIENTES e
    // mais honesto do que inventar um "validado".
    breakdown.push({ field: 'paper_validation', label: 'Validação em Paper Trading', points_possible: 0, points_earned: 0, status: DADOS_INSUFICIENTES });

    const missingFields = breakdown.filter((b) => b.status === DADOS_INSUFICIENTES).map((b) => b.field);

    let limitationReason = 'leitura com cobertura completa para as categorias avaliadas nesta sessão.';
    if (!candlesOk) {
        limitationReason = 'leitura limitada por ausência de candles reais suficientes.';
    } else if (derivativesNaoAplicavelCount === DERIVATIVE_FIELDS.length || missingDerivatives.length === DERIVATIVE_FIELDS.length) {
        limitationReason = 'leitura limitada por ausência de derivativos (funding/open interest/liquidações/long-short ratio).';
    } else if (missingDerivatives.length > 0) {
        limitationReason = `leitura limitada por derivativos parciais (faltam: ${missingDerivatives.join(', ')}).`;
    } else if (!orderBookOk && !orderBookNaoAplicavel) {
        limitationReason = 'leitura limitada por ausência de order book/profundidade real.';
    } else if (!multiSourceOk) {
        limitationReason = 'leitura limitada por ausência de confirmação multi-fonte.';
    } else if (historical) {
        limitationReason = 'leitura limitada por dado ainda não revalidado nesta sessão (memória da sessão anterior).';
    }

    return {
        score,
        max_score: 100,
        breakdown,
        missing_fields: missingFields,
        limitation_reason: limitationReason,
        label: `Data Sufficiency: ${score}/100 — ${limitationReason}`,
    };
}
