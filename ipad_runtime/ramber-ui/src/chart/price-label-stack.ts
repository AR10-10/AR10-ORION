// price-label-stack.ts — resolve colisão vertical entre rótulos de eixo
// de preço reais (S1/R1/VWAP/NL/EMA/último preço). Achado real de
// captura de tela do Operador (BTC/USDT 1H, preço formando perto de R1):
// cada série/price line nativa da lightweight-charts desenha seu próprio
// rótulo de eixo (o "last value label"), sem NENHUMA consciência das
// outras — quando os preços reais ficam próximos, os rótulos ficam
// empilhados/ilegíveis uns em cima dos outros. A lib não resolve isso
// sozinha (confirmado por leitura da documentação e observação real via
// harness Playwright antes de escrever este arquivo).
//
// Função pura: dado um conjunto de posições Y NATURAIS (já convertidas
// de preço→pixel pela própria lib via priceToCoordinate), agrupa as que
// colidem (mais perto que minGapPx) e redistribui cada grupo CENTRADO na
// média das posições naturais do grupo, espaçadas exatamente minGapPx —
// nunca desloca uma entrada que não colide com nada, e nunca desloca
// mais que o necessário. Preço nunca muda — só a posição vertical do
// RÓTULO pode deslocar; quem consome isto (PriceLabelStackPlugin) desenha
// um conector fino de volta ao preço real quando resolvedY !== naturalY,
// então a informação nunca desaparece, só reorganiza.
export interface PositionedLabel {
  naturalY: number;
}

/**
 * Garantia absoluta: no array devolvido, nenhum par de resolvedY fica a
 * menos de minGapPx um do outro (segunda passada de segurança cobre o
 * caso raro em que centralizar um grupo o empurra pra perto do próximo).
 */
export function resolveLabelStackPositions<T extends PositionedLabel>(
  entries: readonly T[],
  minGapPx: number,
): (T & { resolvedY: number })[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.naturalY - b.naturalY);
  const result: (T & { resolvedY: number })[] = [];

  let clusterStart = 0;
  while (clusterStart < sorted.length) {
    let clusterEnd = clusterStart;
    while (
      clusterEnd + 1 < sorted.length &&
      sorted[clusterEnd + 1].naturalY - sorted[clusterEnd].naturalY < minGapPx
    ) {
      clusterEnd++;
    }
    const cluster = sorted.slice(clusterStart, clusterEnd + 1);
    const center = cluster.reduce((sum, e) => sum + e.naturalY, 0) / cluster.length;
    const k = cluster.length;
    cluster.forEach((entry, i) => {
      const resolvedY = center - ((k - 1) * minGapPx) / 2 + i * minGapPx;
      result.push({ ...entry, resolvedY });
    });
    clusterStart = clusterEnd + 1;
  }

  // Passada de segurança: o resultado acima já fica ~ordenado (clusters
  // processados em ordem, entradas dentro de um cluster em ordem), mas
  // centralizar um grupo pode empurrar sua borda pra dentro do gap do
  // próximo grupo/entrada solta. Cascata final garante a invariante
  // ABSOLUTA pedida ("nunca um objeto em cima do outro") mesmo nesse
  // caso raro — nunca reduz um gap já correto, só corrige violação real.
  for (let i = 1; i < result.length; i++) {
    if (result[i].resolvedY < result[i - 1].resolvedY + minGapPx) {
      result[i] = { ...result[i], resolvedY: result[i - 1].resolvedY + minGapPx };
    }
  }

  return result;
}
