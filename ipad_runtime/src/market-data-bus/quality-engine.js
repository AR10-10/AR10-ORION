// quality-engine.js — Data Quality Layer, matemática pura (Fase C / V15
// Cap. 4 e Cap. 20 Fase C). Nenhum estado, nenhuma rede, nenhum relógio:
// cada função recebe medições reais já observadas e devolve um número (ou
// null). O estado por fonte vive em quality-monitor.js; a coleta das
// medições vive em bus.js. Mesma separação já usada pelo GMIL
// (ramber-ui/src/gmil/quality-engine.ts) — este módulo é o equivalente para
// o Market Data Bus e NÃO substitui nem toca o do GMIL: domínios distintos
// (conectores de candle vs provedores de contexto global), vocabulários e
// pesos próprios.
//
// Princípio de honestidade (o mesmo de schema.js/probe.js): null significa
// "não medido ainda" — nunca é tratado como 0 ("medido e péssimo") nem como
// 1 ("medido e perfeito"). Dimensões null ficam FORA da média (renormaliza-
// ção explícita); só quando nenhuma dimensão existe o score inteiro é null
// e a classificação é DADOS_INSUFICIENTES.
//
// As 4 dimensões (todas em [0,1]) e sua matemática:
//
//   Latência        L = EMA das latências reais de coleta (só sucessos).
//                   D_lat = clamp((L_bad − L) / (L_bad − L_good), 0, 1)
//                   L_good = 500ms; L_bad = 8000ms — 8000ms é o timeout
//                   real de probe.js, ou seja, o ponto em que a plataforma
//                   já teria classificado a sonda como DEGRADED.
//
//   Disponibilidade D_avail = sucessos / tentativas, janela deslizante das
//                   últimas QUALITY_WINDOW tentativas. null sem tentativas.
//
//   Consistência    passo esperado Δ (do timeframe real, ex.: 15m = 900s);
//                   intervalos δ_i = t_{i+1} − t_i da última série validada;
//                   D_cons = #{ i : |δ_i − Δ| ≤ 0.01·Δ } / (n−1).
//                   Detecta lacuna temporal (candle faltando => δ = 2Δ) sem
//                   depender do relógio local. null se o timeframe não for
//                   parseável ou a série tiver < 2 candles.
//
//   Estabilidade    coeficiente de variação das latências de sucesso na
//                   janela (k ≥ 3): CV = σ/μ; D_stab = 1 − min(1, CV).
//                   Fonte rápida mas errática pontua baixo aqui mesmo com
//                   D_lat alto. null com menos de 3 amostras.
//
//   Score           média aritmética das dimensões NÃO-nulas.
//   Peso            W = 0 se score < 0.25 (QUARENTENA), senão W = score.
//
//   Circuito de sequência de falhas: se as últimas
//   FAILURE_STREAK_QUARANTINE tentativas foram TODAS falhas, W = 0 e
//   classificação QUARENTENA independente do score composto. Sem isso,
//   uma fonte que morreu de vez ficaria protegida pelas suas PRÓPRIAS
//   medições antigas: latência/consistência congeladas do último sucesso
//   seguram o composto em ~0.7 enquanto só a disponibilidade cai — o
//   streak detecta "morta agora" sem esperar a janela inteira virar.
//   A saída da quarentena é igualmente automática: 1 sucesso real zera o
//   streak e o peso volta a ser o score (zero intervenção humana nos dois
//   sentidos). Nenhuma UI/config pode sobrescrever W — por design (V15
//   Cap. 4: "Nenhum operador poderá alterar manualmente esse peso").

export const QUALITY_WINDOW = 20;
export const LATENCY_GOOD_MS = 500;
export const LATENCY_BAD_MS = 8000;
export const CONSISTENCY_TOLERANCE = 0.01;
export const MIN_SAMPLES_FOR_STABILITY = 3;
export const QUARANTINE_THRESHOLD = 0.25;
export const FAILURE_STREAK_QUARANTINE = 5;
export const EMA_ALPHA = 0.3;

// Vocabulário fechado, mesmo padrão de CONNECTOR_STATES (schema.js).
export const QUALITY_CLASSIFICATION = Object.freeze({
    EXCELENTE: 'EXCELENTE',
    SAUDAVEL: 'SAUDAVEL',
    DEGRADADA: 'DEGRADADA',
    QUARENTENA: 'QUARENTENA',
    DADOS_INSUFICIENTES: 'DADOS_INSUFICIENTES',
});

/** '15m' -> 900, '1h' -> 3600, '1d' -> 86400. null para formato
 *  desconhecido — consistência vira null (não medida), nunca chutada. */
/** Passo em segundos de um timeframe de passo FIXO.
 *
 *  O 'M' MAIÚSCULO (mensal) fica DELIBERADAMENTE fora da gramática, e isto
 *  é uma decisão, não um esquecimento — a versão anterior devolvia null
 *  para '1M' por acidente (o regex simplesmente não tinha o M) e ninguém
 *  tinha registrado o porquê nem travado com teste.
 *
 *  A razão real: mês não tem passo fixo (28 a 31 dias). Como
 *  computeConsistency compara cada delta contra o passo com tolerância de
 *  CONSISTENCY_TOLERANCE (1%), um passo fixo de 30 dias marcaria como
 *  INCONSISTENTE todo mês que não tivesse exatamente 30 dias — 8 dos 12 —
 *  sobre um dado perfeitamente íntegro. Trocaria "dimensão ausente"
 *  (honesto) por "dimensão errada" (pior). Enquanto a consistência aqui
 *  for baseada em passo fixo, null é a resposta correta para mensal, e
 *  composeQualityReport já exclui dimensão null da média em vez de
 *  puni-la com zero.
 *
 *  Cuidado permanente: 'm' minúsculo é MINUTO e 'M' maiúsculo é MÊS. Esta
 *  função é case-sensitive de propósito — a mesma colisão já causou um bug
 *  real neste projeto (gráfico mensal lido como de 1 minuto), corrigido em
 *  nexus/timeframe-layer-profile.ts com busca por chave exata primeiro. */
export function timeframeToSeconds(timeframe) {
    const match = /^(\d+)(s|m|h|d|w)$/.exec(String(timeframe || '').trim());
    if (!match) return null;
    const n = Number(match[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[match[2]];
    return n * unit;
}

export function scoreLatency(emaLatencyMs) {
    if (!Number.isFinite(emaLatencyMs)) return null;
    if (emaLatencyMs <= LATENCY_GOOD_MS) return 1;
    if (emaLatencyMs >= LATENCY_BAD_MS) return 0;
    return (LATENCY_BAD_MS - emaLatencyMs) / (LATENCY_BAD_MS - LATENCY_GOOD_MS);
}

/** @param {Array<{ok: boolean}>} attempts janela deslizante real */
export function scoreAvailability(attempts) {
    if (!Array.isArray(attempts) || attempts.length === 0) return null;
    const ok = attempts.filter((a) => a.ok).length;
    return ok / attempts.length;
}

/** Fração dos intervalos da série que batem com o passo do timeframe.
 *  Uma lacuna (candle ausente) produz um intervalo de 2Δ e derruba a
 *  fração — exatamente o "ausência de lacunas temporais" da diretiva. */
export function computeConsistency(candles, timeframe) {
    const step = timeframeToSeconds(timeframe);
    if (step === null) return null;
    if (!Array.isArray(candles) || candles.length < 2) return null;
    let consistent = 0;
    for (let i = 1; i < candles.length; i++) {
        const delta = candles[i].t - candles[i - 1].t;
        if (Math.abs(delta - step) <= step * CONSISTENCY_TOLERANCE) consistent++;
    }
    return consistent / (candles.length - 1);
}

/** 1 − min(1, CV) sobre as latências de SUCESSO da janela. Falhas não
 *  entram aqui (já punem disponibilidade); uma fonte que responde rápido
 *  mas com jitter enorme pontua baixo mesmo com latência média boa. */
export function scoreStability(attempts) {
    if (!Array.isArray(attempts)) return null;
    const latencies = attempts.filter((a) => a.ok && Number.isFinite(a.latencyMs)).map((a) => a.latencyMs);
    if (latencies.length < MIN_SAMPLES_FOR_STABILITY) return null;
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (mean === 0) return 1;
    const variance = latencies.reduce((acc, l) => acc + (l - mean) ** 2, 0) / latencies.length;
    const cv = Math.sqrt(variance) / mean;
    return 1 - Math.min(1, cv);
}

export function classifyScore(score) {
    if (score === null || !Number.isFinite(score)) return QUALITY_CLASSIFICATION.DADOS_INSUFICIENTES;
    if (score >= 0.85) return QUALITY_CLASSIFICATION.EXCELENTE;
    if (score >= 0.6) return QUALITY_CLASSIFICATION.SAUDAVEL;
    if (score >= QUARANTINE_THRESHOLD) return QUALITY_CLASSIFICATION.DEGRADADA;
    return QUALITY_CLASSIFICATION.QUARENTENA;
}

/** Sequência de falhas consecutivas no FIM da janela (as tentativas mais
 *  recentes). 1 sucesso real zera — é o que tira uma fonte da quarentena
 *  de streak automaticamente. */
export function tailFailureStreak(attempts) {
    if (!Array.isArray(attempts)) return 0;
    let streak = 0;
    for (let i = attempts.length - 1; i >= 0 && !attempts[i].ok; i--) streak++;
    return streak;
}

/** Relatório completo e imutável de qualidade para uma fonte, a partir das
 *  medições reais acumuladas. weight é derivado EXCLUSIVAMENTE do score e
 *  do streak de falhas — não existe caminho de código para um humano
 *  fixá-lo. */
export function composeQualityReport({ emaLatencyMs, attempts, consistency }) {
    const dimensions = Object.freeze({
        latency: scoreLatency(emaLatencyMs),
        availability: scoreAvailability(attempts),
        consistency: Number.isFinite(consistency) ? consistency : null,
        stability: scoreStability(attempts),
    });
    const available = [dimensions.latency, dimensions.availability, dimensions.consistency, dimensions.stability]
        .filter((d) => d !== null);
    const score = available.length ? available.reduce((a, b) => a + b, 0) / available.length : null;
    const failureStreak = tailFailureStreak(attempts);
    const streakQuarantined = failureStreak >= FAILURE_STREAK_QUARANTINE;
    const weight = score === null
        ? null
        : ((streakQuarantined || score < QUARANTINE_THRESHOLD) ? 0 : score);
    const classification = streakQuarantined && score !== null
        ? QUALITY_CLASSIFICATION.QUARENTENA
        : classifyScore(score);
    return Object.freeze({
        score,
        weight,
        classification,
        dimensions,
        failureStreak,
        sampleSize: Array.isArray(attempts) ? attempts.length : 0,
        emaLatencyMs: Number.isFinite(emaLatencyMs) ? emaLatencyMs : null,
    });
}
