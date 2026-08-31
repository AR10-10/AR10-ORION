// liquidity-significance.ts — "a liquidez que amostra no gráfico, só
// realmente ela fazer diferença nas alterações... se a liquidez razoável
// pequena que não faz movimento no gráfico" (pedido direto do Operador).
//
// ═══ O QUE ESTAVA ACONTECENDO, MEDIDO ═══
//
// App.tsx desenhava FVG/Order Block/Void pela ordem de chegada
// (`.filter((z, i) => i < 3 || isRealObstacle(z))`) — os 3 mais recentes,
// mais qualquer um no caminho do Trade Plan. NENHUM filtro considerava o
// TAMANHO da própria zona. Um FVG de 3 ticks de largura (ruído de pavio)
// entrava na tela do mesmo jeito que um FVG de 2% do preço (um desequilíbrio
// real que o mercado tende a revisitar com força).
//
// É exatamente a reclamação: liquidez "pequena que não faz movimento" ganhava
// o mesmo peso visual que liquidez que realmente move o preço quando
// revisitada.
//
// ═══ A MEDIDA CERTA: TAMANHO RELATIVO AO ATR, NÃO TAMANHO ABSOLUTO ═══
//
// Um gap de 0,3% é enorme num ativo que anda 0,5% por dia e irrelevante num
// que anda 8%. A pergunta profissional não é "quantos ticks de largura" —
// é "quantas velas típicas de largura", e a "vela típica" já tem nome neste
// repositório: ATR de Wilder (14), a mesma fonte única já unificada em
// decision-distance.ts (src/market-regime/regime-engine.js::atrPercent).
//
// Zero segunda fórmula: este módulo só compara a largura real da zona contra
// o ATR% real já calculado em outro lugar.
//
// ═══ CORREÇÃO DE HONESTIDADE DESTE CABEÇALHO (auditoria posterior) ═══
//
// O parágrafo acima dizia "FVG/Order Block/Void". O filtro real em App.tsx
// sempre chegou a FVG e Order Block — NUNCA a Void. A auditoria confirmou
// que o CÓDIGO está certo e o COMENTÁRIO estava errado, e o motivo é o
// mesmo argumento já feito abaixo para os pools EQH/EQL:
//
//   liquidity-void-engine.js só marca um candle como candidato a void com
//   `range >= VOID_MIN_DISPLACEMENT_RATIO * ATR` (= 1x ATR), e só forma
//   zona com um run de VOID_MIN_RUN_LENGTH (= 2) candles consecutivos. A
//   zona resultante é `max(high) - min(low)` do run, portanto NUNCA menor
//   que o maior candle do run, portanto nunca menor que 1x ATR.
//
// 1x ATR é mais de 8x o piso deste módulo (MIN_ZONE_ATR_FRACTION = 0.12).
// Aplicar o filtro a Voids não removeria zona nenhuma — só duplicaria uma
// regra que já vive, mais forte, dentro do próprio motor. (Os dois ATR não
// são o mesmo cálculo — o motor usa computeAtrPercent de
// lorentzian-classifier.js sobre a própria janela, este módulo recebe o
// atrPercent de regime-engine.js — mas ambos são Wilder 14, e a margem de
// 8x absorve com folga qualquer diferença de janela entre eles.)
//
// A invariante fica travada por teste (liquidity-significance.test.ts):
// se alguém baixar o piso do motor de voids para perto de 0.12x ATR, a
// redundância deixa de ser redundância e o teste avisa.
//
// ═══ POR QUE NÃO FILTREI POOLS DE LIQUIDEZ (EQH/EQL) POR TOQUES ═══
//
// Pesquisei antes de construir (auditoria real, não suposição):
// support-resistance-engine.js já define STRONG_TOUCH_THRESHOLD = 2 para
// rotular S/R como FORTE/FRACA. E fvg-order-block-engine.js::clusterEqualLevels
// exige NO MÍNIMO 2 toques para uma zona sequer ser reconhecida como
// "Equal High/Low" — é a definição do próprio conceito, não um filtro
// adicional. Ou seja: todo pool que chega até a UI JÁ passou pelo piso de
// significância que o repositório usa em todo lugar. Um filtro extra aqui
// não removeria nada real — só duplicaria uma regra que já existe alhures.
// Achado honesto: o problema descrito pelo Operador vive nos GAPS (FVG/OB/
// Void), não nos pools, e é ali que a correção real entra.

/** Fração mínima de UM ATR que uma zona precisa ter de largura para contar
 *  como "faz diferença". Abaixo disso, é ruído de pavio — a mesma ordem de
 *  grandeza de um movimento que o próprio ATR já descreve como típico do
 *  ativo, então uma zona menor que isso desapareceria dentro do próprio
 *  ruído normal de uma vela. Heurística de mesa (mesma classe de decisão
 *  documentada de TARGET_LABEL_COMPACT_PCT em label-compaction.ts) — nunca
 *  um número mágico sem raciocínio: 12% de um ATR é abaixo de 1/8 de uma
 *  vela típica, o piso onde um profissional já descartaria a zona por
 *  microestrutura, não por tendência real. */
export const MIN_ZONE_ATR_FRACTION = 0.12;

export interface ZoneSignificance {
  status: "OK" | "DADOS_INSUFICIENTES";
  /** Largura real da zona, em unidades de ATR. `null` sem leitura real. */
  widthAtrUnits: number | null;
  /** true = a zona é grande o suficiente para "fazer diferença" real. Sem
   *  ATR real, `significant` é sempre true — fail-closed na AFIRMAÇÃO de
   *  insignificância, nunca na visibilidade: não dá para provar que uma
   *  zona é ruído sem saber o que é normal para este ativo, então na dúvida
   *  ela continua visível (Regra de Ouro 4 — nunca apagar por suposição). */
  significant: boolean;
}

const NO_ATR: ZoneSignificance = { status: "DADOS_INSUFICIENTES", widthAtrUnits: null, significant: true };

/**
 * Significância real de uma zona de preço (FVG/OB/Void), medida contra o
 * ATR real do ativo.
 *
 * Fail-closed nas duas pontas: preço/top/bottom inválidos ou ATR ausente
 * devolvem `significant: true` (nunca esconde por suposição); top < bottom
 * (zona invertida, dado corrompido) também não filtra — o defeito é de
 * dado, não de tamanho, e escondê-la esconderia o sintoma real.
 */
export function computeZoneSignificance(
  top: number | null | undefined,
  bottom: number | null | undefined,
  price: number | null | undefined,
  atrPercent: number | null | undefined,
): ZoneSignificance {
  if (!Number.isFinite(atrPercent) || (atrPercent as number) <= 0) return NO_ATR;
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || !Number.isFinite(price) || (price as number) <= 0) {
    return NO_ATR;
  }
  const width = (top as number) - (bottom as number);
  if (width <= 0) return { status: "OK", widthAtrUnits: 0, significant: true };
  const widthPct = (width / (price as number)) * 100;
  const widthAtrUnits = widthPct / (atrPercent as number);
  return { status: "OK", widthAtrUnits, significant: widthAtrUnits >= MIN_ZONE_ATR_FRACTION };
}

/** Formata a largura em ATR para o tooltip — mesma disciplina de
 *  formatAtrUnits em decision-distance.ts (piso "<0.05×" para nunca
 *  confundir "quase nada" com "zero"). */
export function formatZoneAtrWidth(widthAtrUnits: number | null | undefined): string {
  if (!Number.isFinite(widthAtrUnits)) return "—";
  const u = widthAtrUnits as number;
  if (u === 0) return "0×";
  if (u < 0.05) return "<0.05×";
  return `${u.toFixed(2)}× ATR`;
}

// ═══ ARBITRAGEM CRUZADA ENTRE AS POPULAÇÕES DE BANDA ═══
//
// ACHADO MEDIDO (auditoria do orçamento visual): o filtro acima resolve
// "esta zona é grande o bastante para aparecer?", mas nunca resolveu
// "quantas bandas cabem no gráfico ao todo?". App.tsx dava a CADA população
// de banda de preço um teto PRÓPRIO de 3:
//
//   FVG (3) + Order Block (3) + Void (3) + Breaker (3) + Mitigation (3) = 15
//
// Cinco orçamentos independentes, e nenhum deles sabia da existência dos
// outros quatro. Duas consequências reais, ambas medidas no código:
//
//   1. `LAYER_VISUAL_COST.liquidity_zones` DECLARAVA 3 objetos e recebia até
//      15 — uma subdeclaração de 5x, justamente na camada que mais desenha.
//      O orçamento automático (AUTO_LAYER_MAX_VISUAL_COST = 12) admitia a
//      camada como se ela custasse 3: uma única camada podia estourar
//      sozinha o orçamento do canvas inteiro, o mecanismo anti-poluição
//      derrotado pelo seu maior consumidor. O declarado estava certo; era a
//      realidade que precisava obedecê-lo (ver SHARED_ZONE_HIGHLIGHT_SLOTS).
//
//   2. Um Breaker de 0,2x ATR entrava porque era um dos 3 melhores DA SUA
//      família, enquanto um FVG de 3x ATR ficava de fora por ser o 4º da
//      dele. Sem comparação cruzada, "os 3 melhores de cada" não é o mesmo
//      que "os melhores da tela".
//
// A correção é a mesma disciplina que visual-budget.ts já aplica às
// anotações — orçamento único, disputado por medição real — só que agora
// entre populações de zona. Zero matemática nova: ordena pelo
// `widthAtrUnits` que computeZoneSignificance acima já calcula.

/** Vagas de destaque disputadas por TODAS as populações de banda de preço.
 *
 *  POR QUE 3, E NÃO 15 NEM 5 — a escolha foi medida, não estética:
 *
 *  `LAYER_VISUAL_COST.liquidity_zones` já declarava 3, e todo o orçamento
 *  automático (AUTO_LAYER_MAX_VISUAL_COST = 12, AUTO_LAYER_MAX_SIMULTANEOUS
 *  = 6) foi calibrado em cima desse 3. O defeito nunca foi o número
 *  declarado: era a REALIDADE não bater com ele — cinco populações × 3
 *  vagas próprias = até 15 retângulos.
 *
 *  Havia dois jeitos de fazer os dois números coincidirem. Subir o
 *  declarado até a realidade (5, ou 15) foi TENTADO e medido: com custo 5,
 *  o orçamento de 12 se esgota em 4 camadas em vez de 6 — o Operador
 *  passaria a VER MENOS coisa no modo automático, o oposto do objetivo.
 *
 *  Então a realidade desce até o declarado. Efeito duplo: o pior caso do
 *  canvas cai de 15 bandas para 3, que é o decluttering pedido, e nenhum
 *  outro teto do sistema precisa ser re-sintonizado.
 *
 *  3 vagas para 5 famílias é apertado de propósito — é o "não ficar
 *  poluído, só as marca certeira" que o próprio App.tsx já citava. E
 *  aperta sem esconder nada estrutural: obstáculo real do caminho do Trade
 *  Plan escapa do teto sempre, do lado de quem chama. */
export const SHARED_ZONE_HIGHLIGHT_SLOTS = 3;

/** Só o que este módulo precisa ler — o mesmo subconjunto estrutural que
 *  computeZoneSignificance usa, para Breaker/Mitigation (que não são
 *  PriceZone) entrarem sem cast nem segunda cópia. */
export interface RankableZone {
  top: number;
  bottom: number;
}

/**
 * Escolhe, ENTRE TODAS as populações, as zonas de maior largura real em ATR.
 *
 * Devolve um Set por identidade: quem chama mantém suas próprias listas e só
 * pergunta "esta zona ganhou vaga?", sem reordenar nada e sem que este módulo
 * precise conhecer o formato de cada família.
 *
 * Fail-closed: sem ATR real, `computeZoneSignificance` devolve NO_ATR e
 * nenhuma zona é considerada significativa — o Set volta vazio e quem chama
 * cai na sua própria regra de obstáculo, nunca num destaque fabricado.
 */
export function selectSharedZoneHighlights<T extends RankableZone>(
  populations: ReadonlyArray<ReadonlyArray<T> | null | undefined>,
  price: number | null | undefined,
  atrPercent: number | null | undefined,
  slots: number = SHARED_ZONE_HIGHLIGHT_SLOTS,
): Set<T> {
  const ranked: Array<{ zone: T; width: number }> = [];
  for (const pop of populations) {
    for (const zone of pop ?? []) {
      const sig = computeZoneSignificance(zone.top, zone.bottom, price, atrPercent);
      if (sig.status !== "OK" || !sig.significant) continue;
      ranked.push({ zone, width: sig.widthAtrUnits });
    }
  }
  // Maior largura primeiro. Empate mantém a ordem de chegada (sort estável
  // em ES2019+), que preserva o critério anterior como desempate em vez de
  // trocá-lo por um arbitrário.
  ranked.sort((a, b) => b.width - a.width);
  const limite = Number.isFinite(slots) && slots > 0 ? Math.floor(slots) : SHARED_ZONE_HIGHLIGHT_SLOTS;
  return new Set(ranked.slice(0, limite).map((r) => r.zone));
}
