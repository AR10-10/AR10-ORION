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
// Ordem "Lapidação Visual Final e Sincronia Operacional" §3: a captura
// real também mostrou EN/ST/TP (o plano ATIVO, Nível A — "AGORA") com o
// MESMO peso visual de VWAP/EMA/NL (referências recalculadas a cada
// candle, mas não uma decisão — Nível B, "RELEVANTE"). A Ordem pede
// hierarquia de IMPORTÂNCIA além da temporal — dois objetos podem não
// colidir geometricamente e ainda assim competir pela mesma atenção. A
// separação ganhou um quarto nível (`critical`), não uma arquitetura
// nova: mesma família de tratamento sólido de `primary`, só maior/em
// negrito — a mesma dupla (altura+peso da fonte) que `live` já usa,
// SEM o anel (o anel continua exclusivo do preço — a única âncora de
// "agora mesmo" do gráfico; EN/ST/TP são "o plano agora", não "o
// instante agora").
//
// Quatro níveis — o mesmo vocabulário que qualquer terminal profissional
// usa no eixo de preço (TradingView/Bookmap/Sierra Chart: a etiqueta do
// preço atual é a âncora, o plano ativo vem logo abaixo dela em destaque
// quase igual, as últimas leituras de indicador ficam um degrau abaixo,
// e anotações estruturais são chips discretos):
//   live     — o preço AGORA. Uma por gráfico. Nunca podada, nunca
//              discreta: é a âncora de leitura de todo o resto.
//   critical — o plano ATIVO: Entry/Stop/Target (Conselho OU fallback do
//              Núcleo). Nunca podado — é a resposta a "onde entro, onde
//              invalido, onde busco o alvo".
//   primary  — referências vivas: VWAP/NL/EMA (recalculadas a cada
//              candle, mas não uma decisão). Nunca podada.
//   context  — mapa estrutural/histórico: S1/R1, sessões, sweeps,
//              BOS/CHOCH, zonas institucionais, trend channel. É o único
//             nível que pode ficar discreto E o único sujeito a teto de
//             contagem (era exatamente o que enchia a lateral esquerda).
// O default deriva do `side` que a divisão esquerda/direita já estabelece
// (esquerda = "mapa estrutural", direita = "acionável agora") — então a
// maioria dos pontos de push não precisa declarar o campo; só o preço
// vivo (`live`) e o plano ativo (`critical`) sobem de nível
// explicitamente — os dois únicos casos reais em que o default por
// `side` não bastaria.
export type PriceLabelTier = "live" | "critical" | "primary" | "context";

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
 * menos do gap exigido um do outro (segunda passada de segurança cobre o
 * caso raro em que centralizar um grupo o empurra pra perto do próximo).
 *
 * DEFEITO DE GEOMETRIA CORRIGIDO AQUI (pedido do Operador: "cada objeto a
 * distância correta"). O gap era um ESCALAR único, e o chamador o derivava
 * da caixa PEQUENA (18px + 7 de folga = 25). Mas nem toda etiqueta tem a
 * mesma altura: `live` (o preço agora) e `critical` (o plano ativo) usam
 * uma caixa de 21px. Como cada caixa é centrada no seu resolvedY, duas
 * caixas grandes a 25px de distância ficam com 25 − 21 = **4px** entre as
 * bordas, não os 7 declarados — as duas etiquetas mais importantes do
 * gráfico eram justamente as que respiravam menos.
 *
 * `gapBetween` resolve isso de forma exata em vez de aproximada: o gap
 * exigido entre dois vizinhos é `(altura_a + altura_b)/2 + folga`. Não
 * basta usar sempre a caixa maior — isso afastaria demais um par de
 * etiquetas pequenas, e cada pixel de afastamento é um pixel a mais entre
 * a etiqueta e o preço real que ela nomeia.
 *
 * Omitir `gapBetween` mantém EXATAMENTE o comportamento anterior (gap
 * uniforme `minGapPx`) — aditivo e fail-closed.
 */
export function resolveLabelStackPositions<T extends PositionedLabel>(
  entries: readonly T[],
  minGapPx: number,
  gapBetween?: (a: T, b: T) => number,
): (T & { resolvedY: number })[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.naturalY - b.naturalY);
  const result: (T & { resolvedY: number })[] = [];

  // Um gap inválido (NaN, negativo) do chamador nunca vira uma posição
  // inventada: cai no escalar de sempre.
  const gap = (a: T, b: T): number => {
    if (!gapBetween) return minGapPx;
    const g = gapBetween(a, b);
    return Number.isFinite(g) && g > 0 ? g : minGapPx;
  };

  let clusterStart = 0;
  while (clusterStart < sorted.length) {
    let clusterEnd = clusterStart;
    while (
      clusterEnd + 1 < sorted.length &&
      sorted[clusterEnd + 1].naturalY - sorted[clusterEnd].naturalY <
        gap(sorted[clusterEnd], sorted[clusterEnd + 1])
    ) {
      clusterEnd++;
    }
    const cluster = sorted.slice(clusterStart, clusterEnd + 1);
    const center = cluster.reduce((sum, e) => sum + e.naturalY, 0) / cluster.length;
    const k = cluster.length;
    // Posições acumuladas com gaps VARIÁVEIS, depois o bloco inteiro é
    // centrado. Com gap uniforme isto reduz exatamente à fórmula anterior
    // (`i * minGapPx`, span `(k-1) * minGapPx`) — zero mudança de
    // comportamento para quem não passa gapBetween.
    const offsets: number[] = [0];
    for (let i = 1; i < k; i++) offsets.push(offsets[i - 1] + gap(cluster[i - 1], cluster[i]));
    const span = offsets[k - 1];
    cluster.forEach((entry, i) => {
      result.push({ ...entry, resolvedY: center - span / 2 + offsets[i] });
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
    const exigido = gap(result[i - 1], result[i]);
    if (result[i].resolvedY < result[i - 1].resolvedY + exigido) {
      result[i] = { ...result[i], resolvedY: result[i - 1].resolvedY + exigido };
    }
  }

  return result;
}
