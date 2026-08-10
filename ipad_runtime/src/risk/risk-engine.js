// risk-engine.js — Risk Engine / Position Sizing (Fase H / V15 Cap. 11 e
// Cap. 20 Fase H). PRIMEIRA saída do sistema que constitui sugestão em
// substância — implementada sob a exceção explícita do Operador pós-Fase A
// ("A exceção prevalece") e sob as 4 diretrizes da ordem de ignição da
// Fase H. Todo resultado carrega o selo obrigatório (DISCLAIMER abaixo) e
// a UI o exibe permanentemente ao lado dos números.
//
// ZERO imports de propósito: função pura autocontida que recebe NÚMEROS já
// computados pelos domínios reais (entry/stop do target-tracker, ATR% do
// Market Regime Engine, direção/força do Comitê da Fase F, R:R real) — o
// Risk Engine é um CONSUMIDOR terminal; nada aqui lê rede, estado ou
// saldo. Diretriz 2: o sistema não conhece o capital do operador — toda
// saída é % do capital (equity) e % de risco, nunca um valor monetário.
//
// MATEMÁTICA (clássica, documentada, conservadora por construção):
//
//   1. Dimensionamento por volatilidade (Risk/ATR — diretriz 1):
//        stop_dist% = |entry − stop| / entry × 100      (stop REAL da rota)
//        unidade_de_risco% = max(stop_dist%, ATR%)
//          — um stop mais apertado que 1 ATR está dentro do ruído da vela;
//            dimensioná-lo pelo stop nominal SUPERESTIMARIA a segurança.
//            Usar o maior dos dois é o acoplamento "Risk/ATR" pedido.
//        tamanho_vol% = risco_por_trade% / unidade_de_risco% × 100
//          (ex.: risco 1% com unidade 2% => 50% do equity, sem alavancagem)
//
//   2. Capping por Kelly fracionado conservador (diretriz 1):
//        Sem histórico vivo, NENHUMA probabilidade é fabricada: a taxa de
//        acerto assumida é FIXA em p₀ = 0.5 (moeda honesta — o motor não
//        reivindica edge direcional nenhum). Com payoff b = R:R real:
//          Kelly_pleno = p₀ − (1−p₀)/b = 0.5 − 0.5/b
//        => positivo SÓ quando b > 1: sob p₀=0.5, a única fonte de
//        expectativa positiva é a assimetria do payoff. b ≤ 1 => Kelly ≤ 0
//        => SEM SUGESTÃO (0%). A fração de Kelly vem de MULTIPLICADORES
//        FIXOS por faixa de Força do Comitê (Fase F), como a ordem de
//        ignição determinou — nunca uma probabilidade contínua inventada:
//          força ≥ 0.60 => 1/2-Kelly   (0.50)
//          força ≥ 0.30 => 1/4-Kelly   (0.25)
//          força >  0   => 1/8-Kelly   (0.125)
//          força ≤ 0    => 0           (comitê dividido => 0%)
//        teto_kelly% = fração × Kelly_pleno × 100
//
//   3. Sugestão final = min(tamanho_vol%, teto_kelly%, 100)
//        — teto duro de 100%: este motor NUNCA sugere alavancagem.
//      risco_efetivo% = sugestão% × unidade_de_risco% / 100
//        — sempre ≤ risco_por_trade% pedido (o capping só reduz).
//
//   FAIL-CLOSED (diretriz 4), sem exceção: qualquer insumo não-finito,
//   sinal ausente, comitê sem direção OU com direção CONTRÁRIA ao sinal do
//   Core Engine => 0% com motivo explícito. Um número ausente nunca vira
//   um tamanho chutado.
//
//   HIERARQUIA: o Core Engine continua intocado — este motor dimensiona o
//   cenário que o sinal real já descreveu; nunca gera/altera/bloqueia o
//   sinal. read_only:true em toda saída.
//
//   Entrega 44 (taxa de acerto REAL, quando existe amostra): p₀=0.5 acima
//   continua o FALLBACK — mas agora, se o chamador passar realWinRate +
//   realWinRateSampleSize (do Profitability Engine real, Entrega 42:
//   nexus/expectancy.ts, computeExpectancy().winRate/.totalTrades) com
//   amostra >= MIN_SAMPLE_FOR_REAL_WIN_RATE trades reais resolvidos deste
//   symbol:timeframe, o Kelly_pleno usa essa taxa de acerto REAL no lugar
//   de 0.5 — mais honesto que a moeda-honesta assumida quando já existe
//   histórico de verdade suficiente. Abaixo do mínimo, ou sem os
//   parâmetros, o comportamento é EXATAMENTE o de antes (0.5 fixo) —
//   nenhuma mudança para quem não passa os novos parâmetros. A saída
//   ecoa qual taxa foi de fato usada (effective_win_rate/win_rate_source)
//   — nunca escondida. MIN_SAMPLE_FOR_REAL_WIN_RATE espelha
//   MIN_TRADES_FOR_VALID_EXPECTANCY de nexus/expectancy.ts — duplicado
//   deliberadamente (este módulo continua zero-import por design,
//   síncrono e autocontido); mantenha os dois numericamente iguais se um
//   mudar.

export const RISK_PER_TRADE_PCT_DEFAULT = 1.0; // % do equity em risco por operação (política, ajustável por chamada)
export const ASSUMED_WIN_RATE = 0.5;           // fallback — nenhuma probabilidade fabricada quando não há amostra real suficiente
export const MIN_SAMPLE_FOR_REAL_WIN_RATE = 30; // espelha MIN_TRADES_FOR_VALID_EXPECTANCY (nexus/expectancy.ts)
export const MAX_POSITION_PCT = 100;           // teto duro: nunca sugerir alavancagem
export const DISCLAIMER = 'SUGESTAO_ALGORITMICA_NAO_E_CONSELHO_FINANCEIRO';

// Multiplicadores FIXOS de fração de Kelly por faixa de força do comitê
// (ordem de ignição da Fase H, diretriz 1). Vocabulário fechado auditável.
export const KELLY_FRACTION_TIERS = Object.freeze([
    Object.freeze({ min_forca: 0.60, fraction: 0.5 }),
    Object.freeze({ min_forca: 0.30, fraction: 0.25 }),
    Object.freeze({ min_forca: Number.EPSILON, fraction: 0.125 }),
]);

export function kellyFractionForForca(forca) {
    if (!Number.isFinite(forca) || forca <= 0) return 0;
    for (const tier of KELLY_FRACTION_TIERS) {
        if (forca >= tier.min_forca) return tier.fraction;
    }
    return 0;
}

const DIRECTION_MATCH = Object.freeze({ LONG: 'ALTA', SHORT: 'BAIXA' });

function semSugestao(reason, inputsEcho) {
    return Object.freeze({
        status: 'SEM_SUGESTAO',
        reason,
        suggested_position_pct: 0,
        effective_risk_pct: 0,
        vol_size_pct: null,
        kelly_cap_pct: null,
        kelly_fraction_tier: null,
        assumed_win_rate: ASSUMED_WIN_RATE,
        effective_win_rate: null,
        win_rate_source: null,
        effective_risk_unit_pct: null,
        inputs: Object.freeze(inputsEcho ?? {}),
        disclaimer: DISCLAIMER,
        read_only: true,
    });
}

/** @param {{
 *   signal: 'LONG'|'SHORT'|null|undefined,       // sinal REAL do Core Engine (nunca alterado aqui)
 *   entry: number|null, stop: number|null,        // rota real do target-tracker
 *   atrPercent: number|null,                      // ATR% real (Market Regime Engine)
 *   riskRewardRatio: number|null,                 // R:R real (target-tracker)
 *   ensembleDirection: 'ALTA'|'BAIXA'|'NEUTRO'|null,  // Comitê Fase F
 *   ensembleForca: number|null,                   // força do Comitê [0,1]
 *   riskPerTradePct?: number,                     // política: % do equity em risco (default 1.0)
 *   realWinRate?: number|null,                    // Entrega 44: winRate real (nexus/expectancy.ts computeExpectancy())
 *   realWinRateSampleSize?: number|null,          // Entrega 44: totalTrades da mesma amostra — precisa ser >= MIN_SAMPLE_FOR_REAL_WIN_RATE
 * }} input */
export function buildRiskSuggestion({
    signal,
    entry,
    stop,
    atrPercent,
    riskRewardRatio,
    ensembleDirection,
    ensembleForca,
    riskPerTradePct = RISK_PER_TRADE_PCT_DEFAULT,
    realWinRate = null,
    realWinRateSampleSize = null,
} = {}) {
    const inputsEcho = { signal: signal ?? null, entry: entry ?? null, stop: stop ?? null, atr_percent: atrPercent ?? null, rr: riskRewardRatio ?? null, ensemble_direction: ensembleDirection ?? null, ensemble_forca: ensembleForca ?? null, risk_per_trade_pct: riskPerTradePct };

    if (signal !== 'LONG' && signal !== 'SHORT') {
        return semSugestao('sem_sinal_direcional_do_core_engine_nesta_leitura', inputsEcho);
    }
    if (![entry, stop, atrPercent, riskRewardRatio, ensembleForca, riskPerTradePct].every(Number.isFinite)) {
        return semSugestao('insumo_nao_finito_ou_ausente_fail_closed', inputsEcho);
    }
    if (entry <= 0 || entry === stop || riskPerTradePct <= 0 || atrPercent < 0) {
        return semSugestao('insumo_degenerado_fail_closed', inputsEcho);
    }
    if (ensembleDirection !== DIRECTION_MATCH[signal]) {
        return semSugestao('comite_sem_direcao_ou_contrario_ao_sinal_do_core', inputsEcho);
    }

    const stopDistPct = (Math.abs(entry - stop) / entry) * 100;
    const effectiveRiskUnitPct = Math.max(stopDistPct, atrPercent);
    if (!Number.isFinite(effectiveRiskUnitPct) || effectiveRiskUnitPct <= 0) {
        return semSugestao('unidade_de_risco_degenerada_fail_closed', inputsEcho);
    }

    const volSizePct = (riskPerTradePct / effectiveRiskUnitPct) * 100;

    // Entrega 44: taxa de acerto REAL (Track Record, >= amostra mínima)
    // substitui o p₀=0.5 assumido quando existe; comportamento idêntico ao
    // de antes quando os parâmetros novos ficam ausentes (ver header).
    const hasRealWinRate =
        Number.isFinite(realWinRate) && realWinRate >= 0 && realWinRate <= 1 &&
        Number.isFinite(realWinRateSampleSize) && realWinRateSampleSize >= MIN_SAMPLE_FOR_REAL_WIN_RATE;
    const effectiveWinRate = hasRealWinRate ? realWinRate : ASSUMED_WIN_RATE;
    const winRateSource = hasRealWinRate ? 'track_record_real' : 'assumed_0.5';

    const b = riskRewardRatio;
    const fullKelly = effectiveWinRate - (1 - effectiveWinRate) / b;
    if (fullKelly <= 0) {
        return semSugestao('rr_sem_assimetria_de_payoff_kelly_nao_positivo', inputsEcho);
    }
    const kellyFraction = kellyFractionForForca(ensembleForca);
    if (kellyFraction === 0) {
        return semSugestao('comite_sem_forca_direcional_suficiente', inputsEcho);
    }
    const kellyCapPct = kellyFraction * fullKelly * 100;

    const suggestedPositionPct = Math.min(volSizePct, kellyCapPct, MAX_POSITION_PCT);
    const effectiveRiskPct = (suggestedPositionPct * effectiveRiskUnitPct) / 100;

    return Object.freeze({
        status: 'OK',
        reason: 'dimensionamento_vol_atr_com_capping_de_kelly_fracionado',
        suggested_position_pct: suggestedPositionPct,
        effective_risk_pct: effectiveRiskPct,
        vol_size_pct: volSizePct,
        kelly_cap_pct: kellyCapPct,
        kelly_fraction_tier: kellyFraction,
        assumed_win_rate: ASSUMED_WIN_RATE,
        effective_win_rate: effectiveWinRate,
        win_rate_source: winRateSource,
        effective_risk_unit_pct: effectiveRiskUnitPct,
        inputs: Object.freeze(inputsEcho),
        disclaimer: DISCLAIMER,
        read_only: true,
    });
}
