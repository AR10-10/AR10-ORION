// data-quality-vocabulary.ts — ADITIVO V-MAX Etapa 10 (Data Quality Monitor
// unificado): "Unificar todos os motores de qualidade. Criar vocabulário
// único. Estados possíveis: OK / WARNING / FAIL / DADOS_INSUFICIENTES."
//
// Este repositório tem 3 motores de qualidade REAIS e deliberadamente
// separados (domínios distintos, ver header de market-data-bus/quality-
// engine.js) — nenhum é tocado ou fundido aqui, por Regra de Ouro 4 ("nunca
// apagar dado real ou funcionalidade") e porque cada um mede algo diferente:
//
//   1. Market Data Bus (market-data-bus/quality-engine.js) — score 0-1 por
//      stream de candles (latência/disponibilidade/consistência/
//      estabilidade), classificação própria de 5 estados (EXCELENTE/
//      SAUDAVEL/DEGRADADA/QUARENTENA/DADOS_INSUFICIENTES).
//   2. GMIL (gmil/quality-engine.ts) — weight 0-1 por provedor de contexto
//      global (latência/frescor/confiabilidade), sem classificação
//      discreta própria.
//   3. Research Engine (js/research/data-sufficiency.js) — score 0-100 de
//      cobertura de campos da Evidence, sem classificação discreta própria.
//
// O que ESTE módulo faz: mapeia a saída nativa de cada um para o MESMO
// vocabulário de 4 estados, usando limiares matematicamente equivalentes ao
// corte que o Bus já usa (score>=0.6 => saudável; score>=0.25 => degradado
// mas real; abaixo/null => falha ou dado insuficiente — ver classifyScore
// em market-data-bus/quality-engine.js), aplicados PROPORCIONALMENTE à
// escala nativa de cada domínio. É uma camada de LEITURA sobre 3 fontes de
// verdade que continuam existindo e continuam sendo a autoridade real —
// nunca uma 4ª fonte de verdade nem um recálculo.
export type DataQualityLabel = 'OK' | 'WARNING' | 'FAIL' | 'DADOS_INSUFICIENTES';

// Mesmos breakpoints normalizados 0-1 usados por classifyScore() no Market
// Data Bus (SAUDAVEL >= 0.6, DEGRADADA >= 0.25 = QUARANTINE_THRESHOLD) — só
// o vocabulário de saída muda (4 estados universais em vez dos 5 específicos
// do Bus).
const NORMALIZED_OK_THRESHOLD = 0.6;
const NORMALIZED_WARNING_THRESHOLD = 0.25;

/** Classificador genérico 0-1 — a base matemática compartilhada. null/
 *  não-finito é sempre DADOS_INSUFICIENTES (nunca reinterpretado como 0
 *  "ruim" nem como 1 "bom" — mesmo princípio de honestidade do resto da
 *  base: ausência de medição não é uma medição ruim). */
function classifyNormalized(value: number | null | undefined): DataQualityLabel {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'DADOS_INSUFICIENTES';
  if (value >= NORMALIZED_OK_THRESHOLD) return 'OK';
  if (value >= NORMALIZED_WARNING_THRESHOLD) return 'WARNING';
  return 'FAIL';
}

/** Market Data Bus: a classificação própria (5 estados) já É a fonte da
 *  verdade — só comprime pro vocabulário universal. Nunca reconsulta o
 *  score bruto: a classificação do Bus já decide QUARENTENA por streak de
 *  falha consecutiva (não só por score — ver FAILURE_STREAK_QUARANTINE em
 *  quality-engine.js), recalcular do score perderia essa informação. */
export function classifyBusQuality(classification: string | null | undefined): DataQualityLabel {
  switch (classification) {
    case 'EXCELENTE':
    case 'SAUDAVEL':
      return 'OK';
    case 'DEGRADADA':
      return 'WARNING';
    case 'QUARENTENA':
      return 'FAIL';
    default:
      // Cobre tanto null/undefined (nunca medido) quanto o literal
      // 'DADOS_INSUFICIENTES' que classifyScore() do Bus já pode emitir.
      return 'DADOS_INSUFICIENTES';
  }
}

/** Genérico para qualquer peso 0-1 já normalizado pela mesma convenção
 *  (clamp01) — hoje usado para o weight agregado do GMIL, reutilizável para
 *  qualquer futuro provedor que já pontue na mesma escala. */
export function classifyWeight(weight: number | null | undefined): DataQualityLabel {
  return classifyNormalized(weight);
}

/** Research Engine: score é 0-100 por padrão, mas o teto é recebido
 *  explicitamente (nunca hardcoded) porque computeDataSufficiency já
 *  devolve seu próprio max_score. Normalizado para 0-1 antes de aplicar o
 *  MESMO limiar dos outros dois domínios. */
export function classifySufficiencyScore(
  score: number | null | undefined,
  maxScore: number = 100,
): DataQualityLabel {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'DADOS_INSUFICIENTES';
  if (!Number.isFinite(maxScore) || maxScore <= 0) return 'DADOS_INSUFICIENTES';
  return classifyNormalized(score / maxScore);
}

/** Cor única por rótulo — mesma paleta que TelemetryHealthWidget já usava
 *  ad-hoc para a linha "QUALIDADE DA FONTE (BUS)" (verde=saudável,
 *  amarelo=degradado, vermelho=falha, azul apagado=sem dado). Centralizada
 *  aqui para as 3 leituras (Bus/GMIL/Suficiência) nunca divergirem de cor
 *  para o mesmo rótulo. */
export const DATA_QUALITY_COLOR: Record<DataQualityLabel, string> = {
  OK: 'text-[#00ffaa]',
  WARNING: 'text-[#f0d06f]',
  FAIL: 'text-[#ff0055]',
  DADOS_INSUFICIENTES: 'text-[#8ab4f8]/50',
};
