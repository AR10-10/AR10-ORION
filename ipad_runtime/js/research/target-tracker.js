// target-tracker.js — Target Tracker / Level Tracker (mission AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1).
// Compara o preco atual (vivo, ultima sonda real desta sessao) contra o
// snapshot fixado no momento em que o Research Engine rodou por ultimo —
// nunca recalcula alvo/suporte/resistencia a partir do preco vivo, porque
// ROTA A/B e invalidacao sao decisoes do snapshot (ver
// docs/ANALYSIS_OUTPUT_CONTRACT.md e research-engine.js). So' compara dois
// numeros reais e classifica a distancia entre eles — nunca um sinal, nunca
// uma ordem.
//
// "Nao e execucao. Nao e ordem. Nao e recomendacao. E acompanhamento visual
// de niveis." — mesmo texto exposto ao usuario via DISCLAIMER abaixo.

import { DADOS_INSUFICIENTES } from '../real-data/schema.js';

export const TARGET_STATUS = Object.freeze({
    WAITING: 'WAITING',
    APPROACHING_TARGET: 'APPROACHING_TARGET',
    TARGET_TOUCHED: 'TARGET_TOUCHED',
    INVALIDATED: 'INVALIDATED',
    STALE_REANALYZE: 'STALE_REANALYZE',
    DADOS_INSUFICIENTES: 'DADOS_INSUFICIENTES',
});

export const DISCLAIMER = 'Leitura descritiva — não é recomendação. Não é execução. Não é ordem. É acompanhamento visual de níveis.';

// % de proximidade do alvo para virar APPROACHING_TARGET antes de tocar.
const APPROACH_PCT = 0.3;
// % de divergencia entre preco atual e preco do snapshot que sozinha ja
// recomenda reavaliar a analise, mesmo sem nenhuma rota invalidada.
const DRIFT_REANALYZE_PCT = 1.5;
// Idade maxima do snapshot antes de recomendar reavaliar, independente do
// preco ter ou nao se movido muito.
const SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;

function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }

/** Diferenca percentual SINALIZADA de value frente a base (preco atual vs
 *  preco do snapshot) — positivo quando value > base. */
function signedPctDiff(value, base) {
    if (!isFiniteNum(value) || !isFiniteNum(base) || base === 0) return DADOS_INSUFICIENTES;
    return ((value - base) / base) * 100;
}

/** Distancia percentual ABSOLUTA entre um nivel (alvo/invalidacao) e o preco
 *  atual — sempre nao-negativa, mais simples para a UI de "quao perto". */
function pctGap(level, price) {
    if (!isFiniteNum(level) || !isFiniteNum(price) || price === 0) return DADOS_INSUFICIENTES;
    return Math.abs((level - price) / price) * 100;
}

/** @param {{price: number, target: number, invalidation: number, direction: 'LONG'|'SHORT'}} */
function routeStatus({ price, target, invalidation, direction }) {
    if (!isFiniteNum(price) || !isFiniteNum(target) || !isFiniteNum(invalidation)) {
        return { status: TARGET_STATUS.DADOS_INSUFICIENTES, distance_to_target_pct: DADOS_INSUFICIENTES, distance_to_invalidation_pct: DADOS_INSUFICIENTES, progress_pct: DADOS_INSUFICIENTES, risk_reward_ratio: DADOS_INSUFICIENTES };
    }
    const invalidated = direction === 'LONG' ? price < invalidation : price > invalidation;
    const touched = direction === 'LONG' ? price >= target : price <= target;
    const distanceToTarget = pctGap(target, price);
    const distanceToInvalidation = pctGap(invalidation, price);
    // Risk:Reward real (V11.5 Fase 6): razão determinística entre a distância
    // percentual até o alvo e até a invalidação — NUNCA uma probabilidade
    // estatística de acerto (este repositório não tem backtest para sustentar
    // essa afirmação honestamente). É a mesma matemática de R:R usada em
    // gestão de risco institucional: 2.0 significa "o alvo está 2x mais longe
    // que a invalidação", nada além disso.
    const riskRewardRatio = (isFiniteNum(distanceToTarget) && isFiniteNum(distanceToInvalidation) && distanceToInvalidation > 0)
        ? distanceToTarget / distanceToInvalidation
        : DADOS_INSUFICIENTES;

    let status;
    if (invalidated) status = TARGET_STATUS.INVALIDATED;
    else if (touched) status = TARGET_STATUS.TARGET_TOUCHED;
    else if (isFiniteNum(distanceToTarget) && distanceToTarget <= APPROACH_PCT) status = TARGET_STATUS.APPROACHING_TARGET;
    else status = TARGET_STATUS.WAITING;

    // progress_pct: posicao percentual do preco atual no trajeto entre
    // invalidacao (0%) e alvo (100%) — pura visualizacao derivada das duas
    // distancias reais acima (mesmos numeros de distance_to_*_pct), nunca um
    // novo nivel/sinal: so' reexpressa a mesma comparacao como 1 barra.
    let progressPct;
    if (touched) progressPct = 100;
    else if (invalidated) progressPct = 0;
    else {
        const totalRange = distanceToTarget + distanceToInvalidation;
        progressPct = totalRange > 0 ? Math.max(0, Math.min(100, (distanceToInvalidation / totalRange) * 100)) : DADOS_INSUFICIENTES;
    }

    return { status, distance_to_target_pct: distanceToTarget, distance_to_invalidation_pct: distanceToInvalidation, progress_pct: progressPct, risk_reward_ratio: riskRewardRatio };
}

function emptyRoute() {
    return {
        status: TARGET_STATUS.DADOS_INSUFICIENTES,
        target_1: DADOS_INSUFICIENTES,
        target_2: DADOS_INSUFICIENTES,
        target_2_strength: null,
        invalidation: DADOS_INSUFICIENTES,
        distance_to_target_pct: DADOS_INSUFICIENTES,
        distance_to_invalidation_pct: DADOS_INSUFICIENTES,
        progress_pct: DADOS_INSUFICIENTES,
        risk_reward_ratio: DADOS_INSUFICIENTES,
    };
}

function emptyTracker(reason) {
    return {
        current_price: DADOS_INSUFICIENTES,
        snapshot_price: DADOS_INSUFICIENTES,
        price_diff: DADOS_INSUFICIENTES,
        price_diff_pct: DADOS_INSUFICIENTES,
        snapshot_generated_at: DADOS_INSUFICIENTES,
        snapshot_age_ms: DADOS_INSUFICIENTES,
        rota_a_long: emptyRoute(),
        rota_b_short: emptyRoute(),
        reanalyze_recommended: false,
        reanalyze_reasons: [reason],
        disclaimer: DISCLAIMER,
        read_only: true,
        execution: 'DISABLED_BY_POLICY',
    };
}

/** Constroi o Target Tracker comparando o preco vivo (pode ser mais novo que
 *  a analise) contra o snapshot fixado quando o Research Engine rodou por
 *  ultimo. Nunca recalcula alvos: so' le os mesmos numeros reais (support/
 *  resistance) que o RealAnalysisFrame ja tinha no momento do snapshot.
 *  @param {{snapshot: {frame: object, research: object}, livePrice: {value:number, mode:string}}} opts */
export function buildTargetTracker({ snapshot, livePrice } = {}) {
    const frame = snapshot && snapshot.frame;
    const hasSnapshot = !!(frame && frame.status === 'OK' && isFiniteNum(frame.last_price) && isFiniteNum(frame.support) && isFiniteNum(frame.resistance));
    const hasLivePrice = !!(livePrice && isFiniteNum(livePrice.value));

    if (!hasSnapshot) return emptyTracker('sem_snapshot_de_analise_real_nesta_sessao');
    if (!hasLivePrice) return emptyTracker('sem_preco_vivo_nesta_sessao');

    const generatedAt = (snapshot.research && snapshot.research.generated_at) || frame.timestamp;
    const currentPrice = livePrice.value;
    const snapshotPrice = frame.last_price;
    const priceDiff = currentPrice - snapshotPrice;
    const priceDiffPct = signedPctDiff(currentPrice, snapshotPrice);
    const snapshotAgeMs = Number.isFinite(Date.parse(generatedAt)) ? Date.now() - Date.parse(generatedAt) : DADOS_INSUFICIENTES;

    const support = frame.support;
    const resistance = frame.resistance;

    const longRoute = routeStatus({ price: currentPrice, target: resistance, invalidation: support, direction: 'LONG' });
    const shortRoute = routeStatus({ price: currentPrice, target: support, invalidation: resistance, direction: 'SHORT' });

    const reanalyzeReasons = [];
    if (isFiniteNum(snapshotAgeMs) && snapshotAgeMs > SNAPSHOT_MAX_AGE_MS) reanalyzeReasons.push('snapshot_mais_velho_que_15min');
    if (isFiniteNum(priceDiffPct) && Math.abs(priceDiffPct) > DRIFT_REANALYZE_PCT) reanalyzeReasons.push(`preco_divergiu_${Math.abs(priceDiffPct).toFixed(2)}pct_do_snapshot`);
    if (livePrice.mode === 'STALE' || livePrice.mode === DADOS_INSUFICIENTES) reanalyzeReasons.push('preco_vivo_stale_ou_insuficiente');
    if (longRoute.status === TARGET_STATUS.INVALIDATED) reanalyzeReasons.push('rota_a_long_invalidada');
    if (shortRoute.status === TARGET_STATUS.INVALIDATED) reanalyzeReasons.push('rota_b_short_invalidada');

    // So' rebaixa para STALE_REANALYZE quando a rota ainda estiver WAITING —
    // nunca sobrescreve TARGET_TOUCHED/INVALIDATED/APPROACHING_TARGET, que sao
    // fatos mais fortes observados diretamente no preco real.
    const applyStaleDowngrade = (route) => (reanalyzeReasons.length && route.status === TARGET_STATUS.WAITING)
        ? { ...route, status: TARGET_STATUS.STALE_REANALYZE }
        : route;

    return {
        current_price: currentPrice,
        snapshot_price: snapshotPrice,
        price_diff: priceDiff,
        price_diff_pct: priceDiffPct,
        snapshot_generated_at: generatedAt,
        snapshot_age_ms: snapshotAgeMs,
        rota_a_long: {
            ...applyStaleDowngrade(longRoute),
            target_1: resistance,
            target_2: isFiniteNum(frame.resistance_2) ? frame.resistance_2 : DADOS_INSUFICIENTES,
            target_2_strength: frame.resistance_2_strength ?? null,
            invalidation: support,
        },
        rota_b_short: {
            ...applyStaleDowngrade(shortRoute),
            target_1: support,
            target_2: isFiniteNum(frame.support_2) ? frame.support_2 : DADOS_INSUFICIENTES,
            target_2_strength: frame.support_2_strength ?? null,
            invalidation: resistance,
        },
        reanalyze_recommended: reanalyzeReasons.length > 0,
        reanalyze_reasons: reanalyzeReasons,
        disclaimer: DISCLAIMER,
        read_only: true,
        execution: 'DISABLED_BY_POLICY',
    };
}
