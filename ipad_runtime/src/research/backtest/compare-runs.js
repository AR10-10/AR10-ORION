// compare-runs.js — Diretriz de Evolução Quantitativa e Aprendizado Real,
// Fase 9 ("Autoevolução Controlada"): o mecanismo de COMPARAÇÃO explícito
// que a diretriz pede — VERSÃO N → captura de evidência → hipótese →
// TESTE OFFLINE → COMPARAÇÃO → MELHOROU/PIOROU/NEUTRO/DADOS_INSUFICIENTES
// → só então VERSÃO N+1. Nunca uma mudança automática em produção — este
// módulo só produz um VEREDITO estatístico sobre dois resultados já
// medidos, nunca aplica nada sozinho.
//
// O QUE ISTO É: compara a taxaAlvoAmostra (fração real de alvo/stop entre
// os trials RESOLVIDOS) de duas execuções reais de runStructuralBacktest —
// um "baseline" (versão/hipótese atual) contra um "candidate" (versão/
// hipótese nova) — via teste estatístico de duas proporções (z-test
// agrupado, "two-proportion z-test", método padrão de inferência
// estatística — não uma fórmula inventada; a mesma usada para comparar
// taxa de conversão A/B em qualquer manual de estatística introdutória).
//
// O QUE ISTO NUNCA É: um segundo motor de decisão, um gatilho de
// recalibração automática, ou uma prova de que qualquer resultado
// generaliza para o mercado ao vivo — LABORATÓRIO puro (LEI 24, mesma
// fronteira travada por teste dos outros módulos desta pasta). Ele
// também NUNCA promove nada sozinho: devolve um veredito para leitura
// humana (Operador), a "APROVAÇÃO" da Fase 9 continua manual.
//
// HONESTIDADE: amostra pequena demais (abaixo de MIN_RESOLVED_PER_GROUP
// em qualquer um dos dois lados) => DADOS_INSUFICIENTES sempre, nunca um
// veredito fabricado sobre 3 ou 4 trials. |z| abaixo do limiar de 95% =>
// NEUTRO honesto ("a diferença observada não é estatisticamente
// distinguível de ruído amostral"), nunca arredondado para MELHOROU só
// porque candidate.rate > baseline.rate numericamente.

export const COMPARE_RUNS_FORMAT_VERSION = 1;

// Convenção declarada (mesma natureza do piso R:R 1:2 e do RSI 70/30):
// abaixo deste teto por grupo, a aproximação normal do z-test de duas
// proporções fica pouco confiável (regra de bolso comum: n·p >= 5 e
// n·(1-p) >= 5 por grupo) — 20 dá folga real para amostras historicamente
// realistas de backtest, nunca "quanto menor, melhor" para produzir um
// veredito mais cedo.
export const MIN_RESOLVED_PER_GROUP = 20;

// Valor crítico padrão da normal para 95% de confiança bicaudal (z real,
// tabelado — 1.959964..., arredondado na convenção usual de 2 casas).
// Não é um limiar inventado: é a mesma constante de qualquer teste de
// hipótese com alfa=0.05 bicaudal.
export const Z_CRITICAL_95 = 1.96;

export const COMPARE_RUNS_AVISO =
    'VEREDITO ESTATÍSTICO SOBRE DUAS AMOSTRAS DE LABORATÓRIO — nunca uma ' +
    'previsão de desempenho futuro, nunca uma aprovação automática de ' +
    'mudança em produção. A Fase 9 (Autoevolução Controlada) exige ' +
    'aprovação humana mesmo com veredito MELHOROU.';

function rateOf(result) {
    if (!result || result.status !== 'OK') return null;
    const { targetHits, resolved } = result.aggregate;
    if (!Number.isFinite(resolved) || resolved <= 0) return null;
    return { targetHits, resolved, rate: targetHits / resolved };
}

/**
 * Compara duas execuções reais de runStructuralBacktest pela taxa de alvo
 * entre trials resolvidos, via two-proportion z-test agrupado (método
 * estatístico padrão, não inventado).
 * @param {object} baseline resultado de runStructuralBacktest (status OK)
 * @param {object} candidate resultado de runStructuralBacktest (status OK)
 * @param {{ minResolvedPerGroup?: number }} [opts]
 * @returns {object} contrato congelado com veredito + números completos
 *   (nunca só o veredito — sempre auditável).
 */
export function compareBacktestRuns(baseline, candidate, { minResolvedPerGroup = MIN_RESOLVED_PER_GROUP } = {}) {
    const base = rateOf(baseline);
    const cand = rateOf(candidate);

    if (!base || !cand) {
        return Object.freeze({
            formatVersion: COMPARE_RUNS_FORMAT_VERSION,
            verdict: 'DADOS_INSUFICIENTES',
            reason: !base ? 'baseline_sem_amostra_resolvida' : 'candidate_sem_amostra_resolvida',
            metric: 'taxaAlvoAmostra',
            baseline: base,
            candidate: cand,
            delta: null,
            zScore: null,
            confidenceLevel: 0.95,
            sameContext: null,
            aviso: COMPARE_RUNS_AVISO,
        });
    }

    if (base.resolved < minResolvedPerGroup || cand.resolved < minResolvedPerGroup) {
        return Object.freeze({
            formatVersion: COMPARE_RUNS_FORMAT_VERSION,
            verdict: 'DADOS_INSUFICIENTES',
            reason: `amostra_resolvida_abaixo_do_minimo_declarado_${minResolvedPerGroup}`,
            metric: 'taxaAlvoAmostra',
            baseline: base,
            candidate: cand,
            delta: cand.rate - base.rate,
            zScore: null,
            confidenceLevel: 0.95,
            sameContext: sameContextOf(baseline, candidate),
            aviso: COMPARE_RUNS_AVISO,
        });
    }

    const pooled = (base.targetHits + cand.targetHits) / (base.resolved + cand.resolved);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / base.resolved + 1 / cand.resolved));
    const delta = cand.rate - base.rate;
    // se === 0 só quando pooled é 0 ou 1 (toda a amostra combinada acertou
    // ou errou 100%) — variância nula real, não uma divisão por zero a
    // esconder: o veredito correto aqui é DADOS_INSUFICIENTES honesto (o
    // teste não consegue distinguir nada sem variância nenhuma).
    if (se === 0) {
        return Object.freeze({
            formatVersion: COMPARE_RUNS_FORMAT_VERSION,
            verdict: 'DADOS_INSUFICIENTES',
            reason: 'variancia_pooled_nula_amostra_sem_dispersao',
            metric: 'taxaAlvoAmostra',
            baseline: base,
            candidate: cand,
            delta,
            zScore: null,
            confidenceLevel: 0.95,
            sameContext: sameContextOf(baseline, candidate),
            aviso: COMPARE_RUNS_AVISO,
        });
    }
    const zScore = delta / se;
    const verdict = zScore >= Z_CRITICAL_95 ? 'MELHOROU' : zScore <= -Z_CRITICAL_95 ? 'PIOROU' : 'NEUTRO';

    return Object.freeze({
        formatVersion: COMPARE_RUNS_FORMAT_VERSION,
        verdict,
        reason: null,
        metric: 'taxaAlvoAmostra',
        baseline: base,
        candidate: cand,
        delta,
        zScore,
        confidenceLevel: 0.95,
        sameContext: sameContextOf(baseline, candidate),
        aviso: COMPARE_RUNS_AVISO,
    });
}

// Aviso não-bloqueante (nunca recusa a comparação — o Operador pode
// genuinamente querer comparar contextos diferentes, ex.: "esta regra
// generaliza para outro ativo?"), mas nunca esconde a diferença de
// contexto de quem lê o veredito.
function sameContextOf(baseline, candidate) {
    if (!baseline?.provenance || !candidate?.provenance) return null;
    return baseline.provenance.symbol === candidate.provenance.symbol &&
        baseline.provenance.timeframe === candidate.provenance.timeframe;
}
