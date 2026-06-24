// scenario-matcher.js — compara o SetupScore atual com leituras anteriores
// guardadas no memory-store (mesma sessao ou sessoes passadas, ja que o
// Evidence Ledger persiste em IndexedDB). Similaridade e' so distancia
// euclidiana normalizada sobre 4 eixos descritivos — nao e' um modelo
// treinado, e' geometria simples e auditavel. "past_outcome" usa o
// final_label que a leitura passada realmente teve, nunca um resultado de
// PnL inventado (este motor nao teria como saber se aquele setup "teria
// dado certo").

import { getSetupScoreHistory } from './memory-store.js';

function round2(v) {
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

function toVector(score) {
    return [score.volatility_score, score.trend_score, score.range_score, score.risk_score]
        .map((v) => (typeof v === 'number' ? v : 0));
}

function similarityPct(a, b) {
    const va = toVector(a);
    const vb = toVector(b);
    const dist = Math.sqrt(va.reduce((sum, v, i) => sum + (v - vb[i]) ** 2, 0));
    const maxDist = Math.sqrt(va.length * 100 * 100);
    return round2(Math.max(0, 1 - dist / maxDist) * 100);
}

function describeSimilar(a, b) {
    const points = [];
    if (a.trend_direction === b.trend_direction) points.push(`tendencia ${a.trend_direction || 'semelhante'}`);
    if (Math.abs((a.volatility_score || 0) - (b.volatility_score || 0)) < 10) points.push('volatilidade parecida');
    if (a.final_label === b.final_label) points.push(`mesmo rotulo (${a.final_label})`);
    return points.length ? points.join(', ') : 'poucos pontos em comum identificados';
}

function describeDifferent(a, b) {
    const points = [];
    if ((a.source_quality || 0) !== (b.source_quality || 0)) points.push(`qualidade de fonte ${a.source_quality ?? 'n/d'} vs ${b.source_quality ?? 'n/d'}`);
    if (a.final_label !== b.final_label) points.push(`rotulo diferente (${a.final_label} vs ${b.final_label})`);
    return points.length ? points.join(', ') : 'condicoes muito parecidas';
}

/** @param {object|null} currentScore @param {number} limit
 *  @returns {Promise<Array<object>>} lista de MemoryMatch, mais similar primeiro. */
export async function findSimilarScenarios(currentScore, limit = 3) {
    if (!currentScore || currentScore.final_label === 'DADOS_INSUFICIENTES') return [];

    const past = (await getSetupScoreHistory(50))
        .filter((p) => p.setup_id && p.setup_id !== currentScore.setup_id && p.final_label !== 'DADOS_INSUFICIENTES');

    const scored = past.map((p) => ({ past: p, sim: similarityPct(currentScore, p) }));
    scored.sort((a, b) => (b.sim || 0) - (a.sim || 0));

    return scored.slice(0, limit).map(({ past, sim }) => ({
        match_id: `match_${Date.now()}_${past.setup_id}`,
        current_context_hash: null,
        past_event_id: past.setup_id,
        similarity_score: sim,
        what_was_similar: describeSimilar(currentScore, past),
        what_was_different: describeDifferent(currentScore, past),
        past_outcome: past.final_label,
        lesson: sim >= 70
            ? 'Condicoes numericamente parecidas ja foram observadas e gravadas na memoria local deste dispositivo.'
            : 'Poucas semelhancas relevantes encontradas na memoria local ate agora.',
        usable_now: sim >= 50,
    }));
}
