// weight-matrix.js — Matriz dinâmica de pesos adaptativos por regime
// (Fase D / V15 Cap. 5: "Cada regime utilizará automaticamente uma matriz
// distinta de ponderação"). API de consulta para os módulos quantitativos
// secundários ajustarem a própria sensibilidade conforme o regime vigente.
//
// CONTRATO DE HONESTIDADE (o mesmo da hierarquia de decisão inteira):
//   1. Os pesos são multiplicadores CONSULTIVOS em [0,1] — um módulo
//      consumidor decide se e como usa; nada aqui reescreve o comportamento
//      de nenhum engine existente por baixo dos panos. Nesta fase NENHUM
//      engine foi re-ponderado silenciosamente: a API existe e está
//      testada; a adoção pelos consumidores é trabalho explícito das fases
//      F/G (Consensus/Core), nunca um efeito colateral escondido desta.
//   2. Os valores iniciais são julgamento de engenharia DOCUMENTADO (qual
//      família de leitura é mais/menos informativa em cada regime) — NÃO
//      são aprendidos: esta base não tem backtest/histórico rotulado para
//      sustentar pesos "ótimos". Quando o autoaprendizado estatístico da
//      V15 (Cap. 12/13) existir, ele recalibra ESTA tabela com evidência
//      real — a API não muda.
//   3. Regime desconhecido/DADOS_INSUFICIENTES => null (nunca um peso
//      neutro fabricado): sem regime real, não há ponderação a aplicar.
//
// Racional por linha (resumo):
//   TENDENCIA_FORTE   momentum e fluxo mandam; apostar em reversão à média
//                     contra tendência forte é a leitura menos informativa.
//   TENDENCIA_MODERADA versão suavizada da anterior; filtros estatísticos
//                     voltam a importar (tendência pode ser ruído).
//   CONSOLIDACAO      reversão à média e filtros estatísticos mandam;
//                     momentum dentro de range é o que menos informa.
//   COMPRESSAO        leituras de rompimento e fluxo de ordens ganham
//                     prioridade máxima (energia acumulando); momentum
//                     quase não existe por definição de squeeze.
//   BREAKOUT          rompimento/fluxo/momentum no talo; reversão à média
//                     é a leitura mais perigosa no candle de escape.
import { REGIMES } from './regime-engine.js';

// Famílias nomeadas pelos módulos REAIS desta base que cada uma descreve —
// não categorias abstratas: momentum (k-NN Lorentziano, leituras de CVD),
// reversao_media (z-score do WASM Quant Core), rompimento (FVG/order
// blocks, rompimento de S/R), filtros_estatisticos (data-sufficiency,
// caps de confiança), fluxo_ordens (OFI/Absorption/Exhaustion).
export const MODULE_FAMILIES = Object.freeze([
    'momentum',
    'reversao_media',
    'rompimento',
    'filtros_estatisticos',
    'fluxo_ordens',
]);

export const REGIME_WEIGHT_MATRIX = Object.freeze({
    [REGIMES.TENDENCIA_FORTE]: Object.freeze({
        momentum: 1.0, reversao_media: 0.2, rompimento: 0.7, filtros_estatisticos: 0.4, fluxo_ordens: 0.9,
    }),
    [REGIMES.TENDENCIA_MODERADA]: Object.freeze({
        momentum: 0.8, reversao_media: 0.4, rompimento: 0.6, filtros_estatisticos: 0.6, fluxo_ordens: 0.8,
    }),
    [REGIMES.CONSOLIDACAO]: Object.freeze({
        momentum: 0.3, reversao_media: 1.0, rompimento: 0.4, filtros_estatisticos: 1.0, fluxo_ordens: 0.6,
    }),
    [REGIMES.COMPRESSAO]: Object.freeze({
        momentum: 0.2, reversao_media: 0.5, rompimento: 1.0, filtros_estatisticos: 0.8, fluxo_ordens: 1.0,
    }),
    [REGIMES.BREAKOUT]: Object.freeze({
        momentum: 0.9, reversao_media: 0.1, rompimento: 1.0, filtros_estatisticos: 0.3, fluxo_ordens: 1.0,
    }),
});

/** Linha completa da matriz para o regime vigente, ou null se o regime não
 *  é um regime real classificado (DADOS_INSUFICIENTES, typo, etc.). */
export function getRegimeWeights(regime) {
    return REGIME_WEIGHT_MATRIX[regime] ?? null;
}

/** Sensibilidade de UMA família de módulo no regime vigente — a API que a
 *  diretriz da Fase D pede para os módulos secundários consultarem.
 *  null (nunca 1.0 implícito) quando regime ou família não existem. */
export function getSensitivity(regime, moduleFamily) {
    const row = getRegimeWeights(regime);
    if (!row) return null;
    return row[moduleFamily] ?? null;
}
