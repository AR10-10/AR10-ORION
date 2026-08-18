// label-compaction.ts — Continuidade §6 (hierarquia visual dos alvos):
// função pura extraída de EnhancedChart_110_Percent.tsx para ganhar
// execução REAL de teste (Diretriz de Evolução Profissional, Fase 10,
// item P: "TP1/TP2/TP3 próximos sem colisão visual"). Comportamento
// IDÊNTICO ao que já vivia inline — zero mudança de lógica, só um nome e
// um teste próprio (Regra de Ouro 4: realocar, nunca reescrever).
//
// Quando dois níveis adjacentes do plano (stop efetivo + alvos) ficam a
// menos deste limiar (% do preço médio do par) um do outro, os rótulos de
// TODOS os alvos entram no modo compacto — label + distância + ETA, sem
// basis/R:R (que continuam no Trade Plan strip e nos painéis). As LINHAS
// permanecem ancoradas no preço real: o preço matemático nunca muda para
// caber a etiqueta.
export const TARGET_LABEL_COMPACT_PCT = 0.35;

/**
 * true quando QUALQUER par de níveis ADJACENTES (já ordenados) está mais
 * perto que TARGET_LABEL_COMPACT_PCT% do seu próprio ponto médio — nunca
 * desloca preço, só decide o FORMATO do rótulo.
 */
export function shouldCompactLabels(levels: number[], thresholdPct: number = TARGET_LABEL_COMPACT_PCT): boolean {
  // ACHADO DO RAIO-X (armadilha latente, não bug ao vivo): o parâmetro se
  // chamava `sortedLevels` e a função CONFIAVA nisso. Com entrada fora de
  // ordem, `price - anterior` fica NEGATIVO e a comparação `< thresholdPct`
  // passa a ser trivialmente verdadeira — a função responderia "compacta
  // tudo" sempre, em silêncio, sem nenhum erro. O único chamador real
  // (EnhancedChart_110_Percent.tsx) ordena antes, então nada quebrava hoje;
  // mas um segundo chamador futuro cairia direto na armadilha, e o sintoma
  // (rótulos compactos sem motivo) não apontaria para cá.
  //
  // A função passa a garantir a própria pré-condição: cópia ordenada, O(n log n)
  // sobre no máximo 5 níveis (stop + 3-4 alvos). Idempotente para quem já
  // ordena — zero mudança de comportamento no caminho real.
  const sortedLevels = [...levels].sort((a, b) => a - b);
  return sortedLevels.some((price, i) => {
    if (i === 0) return false;
    const ref = (price + sortedLevels[i - 1]) / 2;
    return ref > 0 && ((price - sortedLevels[i - 1]) * 100) / ref < thresholdPct;
  });
}
