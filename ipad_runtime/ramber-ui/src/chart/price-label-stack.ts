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

// ─────────────────────────────────────────────────────────────────────────
// HIERARQUIA VISUAL — achado real de captura de tela do Operador (iPad,
// ZECUSDT 1H ao vivo): 11 etiquetas empilhadas na lateral ESQUERDA
// (ÁSIA H/L, 2× "◆ FVG Alta + Sweep", 2× "⚡ SWEEP ↓", "⚡ SWEEP ZONE ↑
// (3x)", "◆ Sessão Baixa + VWAP + Nexus Line", "◆ Sweep + EQL", "◆ EQL +
// S1"), cobrindo o primeiro terço das velas — TODAS com exatamente o
// mesmo peso visual (caixa sólida opaca + texto escuro). Relato literal:
// "não tô achando... não tem noção pra onde que o ativo vai".
//
// O diagnóstico real NÃO era colisão — resolveLabelStackPositions abaixo
// já garantia zero sobreposição, e de fato nenhuma das 11 se sobrepunha.
// Era AUSÊNCIA DE HIERARQUIA: um sweep de 8 dias atrás gritava exatamente
// tão alto quanto o preço de agora. Onde não há hierarquia, o olho não
// tem por onde começar — e o gráfico deixa de responder à única pergunta
// que importa ("onde o preço está e o que está perto dele").
//
// Três níveis — o mesmo vocabulário que qualquer terminal profissional
// usa no eixo de preço (TradingView/Bookmap/Sierra Chart: a etiqueta do
// preço atual é a âncora, as últimas leituras de indicador vêm logo
// abaixo dela, e anotações estruturais são chips discretos):
//   live    — o preço AGORA. Uma por gráfico. Nunca podada, nunca
//             discreta: é a âncora de leitura de todo o resto.
//   primary — acionável agora: VWAP/NL/EMA (referências recalculadas a
//             cada candle) + EN/ST/TP do plano ativo. Nunca podada — cada
//             uma é uma leitura viva e distinta.
//   context — mapa estrutural/histórico: S1/R1, sessões, sweeps,
//             BOS/CHOCH, zonas institucionais, trend channel. É o único
//             nível que pode ficar discreto E o único sujeito a teto de
//             contagem (era exatamente o que enchia a lateral esquerda).
// O default deriva do `side` que a divisão esquerda/direita já estabelece
// (esquerda = "mapa estrutural", direita = "acionável agora") — então
// nenhum dos ~20 pontos de push precisou declarar o campo, só o preço
// vivo, que é o único que sobe de nível.
export type PriceLabelTier = "live" | "primary" | "context";

export function resolveLabelTier(
  side: "left" | "right" | undefined,
  tier: PriceLabelTier | undefined,
): PriceLabelTier {
  if (tier) return tier;
  return (side ?? "right") === "left" ? "context" : "primary";
}

export interface RelevanceCandidate {
  price: number;
  text: string;
  side?: "left" | "right";
  tier?: PriceLabelTier;
}

/**
 * Escolhe QUAIS etiquetas chegam ao eixo. Função pura, complementar ao
 * resolvedor de posição abaixo: aquele decide ONDE cada etiqueta fica,
 * esta decide QUAIS merecem existir quando há mais contexto do que um
 * humano lê de uma vez.
 *
 * Duas regras, nenhuma delas capaz de apagar dado real:
 *
 * 1. Redundância PURA (mesmo lado + mesmo texto + mesmo preço) sai. É o
 *    único caso em que duas entradas são literalmente indistinguíveis na
 *    tela. Deliberadamente NÃO deduplica por texto igual em preços
 *    diferentes: "⚡ SWEEP ↓" em dois níveis distintos são dois níveis
 *    reais — parecem repetição, mas apagar um seria apagar um preço
 *    (Regra de Ouro 4). Quem resolve esse caso é a regra 2.
 *
 * 2. Teto de contagem SÓ no nível `context`, por PROXIMIDADE real ao
 *    preço de referência (o preço vivo). Critério honesto e já usado em
 *    todo este repositório para decidir relevância estrutural
 *    (unsweptLiquidityNearPrice/hasSessionKeyLevelNearPrice/
 *    layer-relevance.ts): um nível a 6% de distância não influencia a
 *    próxima hora de mercado; um a 0,2% influencia. `live` e `primary`
 *    NUNCA são podados.
 *
 * Fail-closed: sem preço de referência finito (carregamento inicial,
 * antes do primeiro tick real), nunca inventa uma distância — mantém as
 * `maxContextLabels` primeiras na ordem de montagem, resultado
 * determinístico e estável. A ordem relativa original é sempre
 * preservada na saída (o resolvedor de colisão é quem ordena por Y).
 *
 * As etiquetas podadas NUNCA apagam o dado: a LINHA/faixa/marcador de
 * cada nível continua desenhada pelo seu próprio plugin (price lines de
 * Sweep, SessionKeyLevelsPlugin, InstitutionalZonePlugin,
 * StructureBreakMarkersPlugin, S1/R1 nativas) — só o chip de texto
 * flutuante é seletivo, exatamente como MAX_SWEEP_AXIS_LABELS/
 * MAX_KEY_LEVELS_SHOWN/MAX_INSTITUTIONAL_ZONES já fazem cada um no seu
 * domínio.
 */
export function selectRelevantLabels<T extends RelevanceCandidate>(
  labels: readonly T[],
  referencePrice: number | null,
  maxContextLabels: number,
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const l of labels) {
    if (!Number.isFinite(l.price)) continue; // fail-closed: preço não-finito nunca vira etiqueta
    const key = `${l.side ?? "right"}|${l.text}|${l.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(l);
  }

  const isContext = (l: T) => resolveLabelTier(l.side, l.tier) === "context";
  const contextIndices: number[] = [];
  unique.forEach((l, i) => {
    if (isContext(l)) contextIndices.push(i);
  });
  if (contextIndices.length <= maxContextLabels) return unique;

  const ranked = [...contextIndices];
  if (referencePrice !== null && Number.isFinite(referencePrice)) {
    ranked.sort(
      (a, b) =>
        Math.abs(unique[a].price - referencePrice) - Math.abs(unique[b].price - referencePrice),
    );
  }
  const keep = new Set(ranked.slice(0, maxContextLabels));
  return unique.filter((l, i) => !isContext(l) || keep.has(i));
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
