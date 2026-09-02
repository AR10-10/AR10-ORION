// chart-layer-depth.ts — a TERCEIRA dimensão do layout do gráfico.
//
// ACHADO QUE ORIGINOU ESTE MÓDULO (medido, reclamação direta do Operador:
// "o FVG verde fica por baixo da outra camada, aí o azul... as camadas ficam
// atrapalhando a outra; elas sempre têm de realçar"):
//
//   14 dos 15 plugins de canvas NÃO declaravam z-index nenhum. Só
//   PriceLabelStackPlugin tinha (z=5).
//
// Sem z-index, o navegador empilha por ORDEM DE INSERÇÃO NO DOM — ou seja, a
// ordem em que o React monta os componentes. Consequências reais:
//   - a importância de uma camada tem ZERO influência sobre quem fica por cima;
//   - a ordem é acidental e muda se alguém reordenar o JSX;
//   - um PREENCHIMENTO (zona) desenhado depois cobre uma LINHA desenhada antes,
//     e a linha some — que é exatamente o sintoma relatado.
//
// Este repositório já tinha as outras duas dimensões declaradas:
//   chart-profile-lanes.ts      → faixas HORIZONTAIS (x)
//   chart-time-ribbon-lanes.ts  → faixas VERTICAIS (y)
// Faltava a PROFUNDIDADE (z). É o que este arquivo fecha.
//
// A REGRA (convenção profissional de terminal, não invenção): o empilhamento
// segue a OPACIDADE VISUAL do objeto, do mais difuso ao mais preciso.
//
//   1. CAMPO      — preenchimentos amplos e difusos (sessões, kill zones,
//                   heatmaps). Cobrem muita área; se ficassem por cima,
//                   apagariam tudo.
//   2. ZONA       — faixas de preço com borda (FVG/OB, institucional,
//                   premium/discount). Área menor, contorno definido.
//   3. PERFIL     — histogramas de borda (volume, TPO, livro). Vivem na sua
//                   própria faixa lateral, mas precisam ficar acima do campo.
//   4. LINHA      — 1px de precisão (VWAP, EMA, Fibonacci, canal, ZigZag).
//                   Uma linha coberta por preenchimento simplesmente SOME:
//                   nenhuma linha pode ficar abaixo de área pintada.
//   5. EVENTO     — marcas pontuais (BOS/CHOCH, sweep, harmônico). São o
//                   "aconteceu AQUI" — nunca podem ser encobertas.
//   6. PLANO      — Entry/Stop/Target. É a única camada acionável agora.
//   7. ETIQUETA   — texto. Sempre no topo; texto ilegível não é informação.
//
// Regra de Ouro 5 ("Fio de Seda") continua intocada: isto decide QUEM fica na
// frente, nunca a espessura ou o traço de ninguém.

export type ChartDepthTier =
  | "field"
  | "zone"
  | "profile"
  | "line"
  | "event"
  | "plan"
  | "label";

/** Espaçamento de 10 entre camadas: deixa 9 valores livres para um ajuste
 *  fino futuro dentro do mesmo nível sem precisar renumerar tudo. */
const TIER_Z: Record<ChartDepthTier, number> = {
  field: 10,
  zone: 20,
  profile: 30,
  line: 40,
  event: 50,
  plan: 60,
  label: 70,
};

/** Nível de cada camada real do gráfico. A chave é o mesmo id de
 *  CHART_LAYER_IDS — uma fonte, nunca duas listas para sincronizar. */
const LAYER_TIER: Record<string, ChartDepthTier> = {
  // 1. CAMPO — difuso e amplo
  market_sessions: "field",
  kill_zones: "field",
  neural_market_aura: "field",
  order_flow_heatmap: "field",
  liquidation_heatmap: "field",

  // 2. ZONA — faixa de preço com contorno
  liquidity_zones: "zone",
  institutional_zones: "zone",



  // 3. PERFIL — histograma de borda
  volume_profile: "profile",
  tpo_profile: "profile",
  order_book_depth: "profile",

  // 4. LINHA — 1px de precisão, NUNCA abaixo de preenchimento
  ema: "line",
  vwap: "line",
  nexus_line: "line",
  fibonacci: "line",
  trend_channel: "line",
  zigzag: "line",
  // SuperTrend é literalmente um stop de 1px que trilha o preço — mesma
  // camada de profundidade de EMA/VWAP/ZigZag, nunca abaixo de
  // preenchimento.
  supertrend: "line",
  session_key_levels: "line",
  equal_highs_lows: "line",
  // Auditoria do ecossistema de indicadores: até 7 createPriceLine de 1px
  // (PP+R1-3+S1-3) — mesma natureza de session_key_levels/equal_highs_lows
  // logo acima, nunca abaixo de preenchimento.
  pivot_points: "line",
  // CORRIGIDAS de "zone" para "line" (achado ao investigar a pendência de
  // migrar as camadas nativas para canvas próprio). As duas estavam
  // declaradas como ZONA, mas NENHUMA das duas tem plugin de canvas e o
  // desenho inteiro delas é `series.createPriceLine(...)` — ou seja, LINHA
  // horizontal de 1px, nunca uma faixa preenchida. Verificado lendo o
  // código: zero `fillRect`, zero plugin que as referencie.
  //
  // Hoje isso era INERTE (as duas são nativas, então renderizam em
  // CHART_NATIVE_CANVAS_Z_INDEX qualquer que seja o nível declarado) — mas
  // era uma ARMADILHA: a própria recomendação de migrá-las para canvas
  // próprio as colocaria em z=20, abaixo de toda área pintada, refazendo
  // exatamente a violação da regra 4 que acabou de ser corrigida. Consertar
  // a declaração agora é o que torna aquela migração segura de fazer.
  premium_discount: "line",
  scenario_projection: "line",
  // Andrews Pitchfork: 3 retas de 1px. Nivel "line" pelo mesmo criterio que
  // acabou de pegar as duas acima — o que ele desenha e linha, entao um
  // preenchimento por cima o faria sumir.
  andrews_pitchfork: "line",
  // A nuvem (Kumo) é um PREENCHIMENTO amplo — se ficasse no nível "line"
  // cobriria EMA/VWAP/Fibonacci, que são precisão de 1px. Fica em "zone"
  // com as demais faixas de preço; as 3 linhas do Ichimoku descem junto,
  // o que é correto: Ichimoku é contexto de fundo, não medição fina.
  ichimoku: "zone",
  // CVD é fluxo, mas desenha como LINHA de 1px — e linha nunca pode ficar
  // abaixo de preenchimento. Esquecido na 1ª versão deste mapa; pego pelo
  // teste de cobertura 1:1 contra CHART_LAYER_IDS, não pela tela do Operador.
  cvd: "line",

  // 5. EVENTO — "aconteceu aqui"
  structure_breaks: "event",
  // Divergência de Delta: marca pontual entre DOIS swings confirmados —
  // mesma natureza do BOS/CHOCH logo acima ("aconteceu AQUI"), nunca uma
  // zona nem uma linha de referência contínua.
  delta_divergence: "event",
  liquidity_sweep: "event",
  harmonics: "event",
  // Padrão de vela é um EVENTO pontual ("aconteceu nesta vela"), da mesma
  // classe do BOS/CHOCH e do sweep — nunca uma zona nem uma linha.
  candle_patterns: "event",

  // 6. PLANO — o acionável
  trade_plan_zone: "plan",
};

/** z-index real desta camada. Fail-closed: id desconhecido cai em "zone" —
 *  o meio da pilha. Nunca no topo (encobriria o plano e as etiquetas) nem no
 *  fundo (sumiria); uma camada nova mal-cadastrada fica visível e no lugar
 *  errado de forma ÓBVIA, em vez de desaparecer em silêncio. */
export function getChartLayerZIndex(layerId: string): number {
  const tier = LAYER_TIER[layerId] ?? "zone";
  return TIER_Z[tier];
}

/** O nível declarado — exposto para teste e para o painel de camadas poder
 *  explicar ao Operador POR QUE uma camada está na frente da outra. */
export function getChartLayerTier(layerId: string): ChartDepthTier {
  return LAYER_TIER[layerId] ?? "zone";
}

/** z-index do CANVAS NATIVO da lightweight-charts (as velas + tudo que é
 *  desenhado por primitiva da própria lib: `addSeries`, `createPriceLine`,
 *  marcadores).
 *
 *  ── O SEGUNDO ACHADO DESTE MÓDULO, medido ────────────────────────────
 *  Este arquivo declara profundidade para as 30 camadas, mas só as ~18 que
 *  têm canvas PRÓPRIO obedeciam. As outras 7 são desenhadas por primitiva
 *  nativa e vivem todas dentro do `<div ref={containerRef}>` — que era
 *  `absolute inset-0` SEM z-index nenhum, ou seja `z-index: auto`.
 *
 *  Provado em Chromium (não deduzido): um overlay com `z-index: 10` pinta
 *  POR CIMA de um container `z-index: auto` mesmo quando o container vem
 *  DEPOIS no DOM. Ou seja, as 7 camadas nativas ficavam embaixo de TODOS os
 *  overlays — inclusive do nível CAMPO (z=10), que é justamente o mais
 *  difuso e o que cobre mais área.
 *
 *  As 7 nativas ORIGINAIS e o nível declarado de cada uma (já COM a
 *  correção descrita logo abaixo, em CHART_LINE_ONLY_LAYER_IDS):
 *    cvd .................. "line"    supertrend ......... "line"
 *    pivot_points ......... "line"    premium_discount ... "line" *
 *    scenario_projection .. "line" *  harmonics .......... "event"
 *    liquidity_sweep ...... "event"
 *    (*) as duas estavam declaradas "zone" e foram corrigidas — nenhuma
 *        das duas pinta área nenhuma, as duas são só createPriceLine.
 *
 *  CINCO delas são LINHA de 1px — e a regra 4 no topo deste arquivo diz,
 *  com todas as letras, que "nenhuma linha pode ficar abaixo de área
 *  pintada". Era exatamente o sintoma que originou este módulo, resolvido
 *  para metade das camadas e nunca para a outra metade.
 *
 *  ── POR QUE 35, E O QUE ELE NÃO RESOLVE ──────────────────────────────
 *  35 fica entre PERFIL (30) e LINHA (40) — o uso exato do espaçamento de
 *  10 que este arquivo reservou desde o início. Nele:
 *    - as 5 linhas nativas sobem acima de TODA área pintada (campo/zona/
 *      perfil). A regra 4 passa a valer para as 30 camadas, não 23.
 *    - as VELAS sobem junto (compartilham o canvas) e passam a ficar acima
 *      das faixas de fundo — que é o certo: contexto atrás do preço.
 *    - as linhas de canvas (EMA/VWAP/Fibonacci/ZigZag) seguem em 40, acima
 *      das velas; eventos em 50; plano em 60; etiquetas em 70.
 *
 *  harmonics MIGROU PARCIALMENTE (SMC Harmonic Fusion, pedido do Operador):
 *  a seta de confluência institucional (HarmonicConfluenceArrowPlugin) já
 *  tem canvas PRÓPRIO, em `getChartLayerZIndex("harmonics")` = 50 (event) —
 *  correto, fora deste resíduo. O zigue-zague XABCD/Wolfe e a linha PRZ
 *  (EnhancedChart_110_Percent.tsx) continuam nativos (`createPriceLine`/
 *  `addSeries`), então harmonics saiu de CHART_NATIVE_LAYER_IDS (não é mais
 *  "sem canvas próprio nenhum") mas ainda tem UMA perna em 35 — migrar
 *  também o zigue-zague/PRZ fecharia o resíduo por completo; não feito de
 *  carona aqui (mudança maior, players nativos da lib são mais baratos de
 *  desenhar um ziguezague que muda pouco por candle).
 *
 *  RESÍDUO HONESTO, declarado em vez de escondido: as 6 nativas restantes
 *  dividem UM canvas só, então só podem ter UM z. Com 35, liquidity_sweep
 *  (declarada "event", 50) fica abaixo dos eventos de canvas (BOS/CHOCH,
 *  padrões de vela, e agora a seta de harmonics). É UMA camada, não quatro:
 *  as outras três que este parágrafo já listou — premium_discount e
 *  scenario_projection (declaração errada, corrigidas — ver
 *  CHART_LINE_ONLY_LAYER_IDS abaixo) e harmonics (migração parcial, acima)
 *  — já saíram do resíduo real de posicionamento.
 *
 *  Fechar o resíduo restante exige migrar liquidity_sweep (e a perna nativa
 *  remanescente de harmonics) para canvas próprio — mudança maior, não
 *  feita de carona aqui.
 */
export const CHART_NATIVE_CANVAS_Z_INDEX = TIER_Z.profile + 5;

/** Camadas cujo desenho inteiro é LINHA de 1px — verificado lendo o código
 *  de cada uma nesta sessão, nunca presumido pelo nome:
 *
 *    premium_discount ..... 3x createPriceLine (topo/equilíbrio/fundo)
 *    scenario_projection .. createPriceLine por alvo projetado
 *    liquidity_sweep ...... 1 createPriceLine por cluster real de sweep
 *    cvd .................. série de linha própria no seu painel
 *    supertrend ........... 2 séries de linha (up/down)
 *    pivot_points ......... até 7 createPriceLine (PP + R1-3 + S1-3)
 *
 *  A REGRA que esta lista trava é a regra 4 no topo deste arquivo, dita como
 *  predicado testável: nenhuma delas pode ficar num nível que PINTA ÁREA
 *  (campo/zona/perfil), porque uma linha de 1px coberta por preenchimento
 *  simplesmente some. Foi assim que `premium_discount` e
 *  `scenario_projection` foram pegas declaradas como "zone".
 *
 *  A lista é o conjunto VERIFICADO, não um censo do arquivo inteiro: para
 *  somar uma camada aqui, confirme antes que o desenho dela não tem
 *  `fillRect`/faixa — e que ela não ganhou um plugin de canvas depois. */
export const CHART_LINE_ONLY_LAYER_IDS: readonly string[] = [
  "premium_discount",
  "scenario_projection",
  "liquidity_sweep",
  "cvd",
  "supertrend",
  "pivot_points",
  "andrews_pitchfork",
];

/** Níveis que PINTAM ÁREA — o conjunto proibido para as camadas acima. */
export const CHART_FILL_TIERS: readonly ChartDepthTier[] = ["field", "zone", "profile"];

/** As camadas desenhadas por primitiva NATIVA da lib (sem canvas próprio),
 *  e por isso presas todas ao mesmo z. Exportado para o teste provar que a
 *  lista bate com a realidade — se alguém migrar uma delas para canvas
 *  próprio, tem de sair daqui no mesmo commit. */
export const CHART_NATIVE_LAYER_IDS: readonly string[] = [
  "cvd",
  "supertrend",
  "pivot_points",
  "premium_discount",
  "scenario_projection",
  "liquidity_sweep",
];

/** z-index das etiquetas de preço. Constante própria porque o
 *  PriceLabelStackPlugin já tinha z=5 hardcoded ANTES deste módulo existir —
 *  e aquele 5 é justamente o sintoma: era o único que sabia que precisava
 *  ficar por cima, sem nenhum sistema por trás. */
export const CHART_LABEL_Z_INDEX = TIER_Z.label;

/** Todos os ids cadastrados — o teste usa para provar cobertura 1:1 com
 *  CHART_LAYER_IDS (nenhuma camada real fica sem profundidade declarada). */
export const CHART_DEPTH_REGISTERED_IDS: readonly string[] = Object.keys(LAYER_TIER);
