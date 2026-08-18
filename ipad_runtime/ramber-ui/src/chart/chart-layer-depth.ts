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
  premium_discount: "zone",
  scenario_projection: "zone",

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
  session_key_levels: "line",
  equal_highs_lows: "line",
  // CVD é fluxo, mas desenha como LINHA de 1px — e linha nunca pode ficar
  // abaixo de preenchimento. Esquecido na 1ª versão deste mapa; pego pelo
  // teste de cobertura 1:1 contra CHART_LAYER_IDS, não pela tela do Operador.
  cvd: "line",

  // 5. EVENTO — "aconteceu aqui"
  structure_breaks: "event",
  liquidity_sweep: "event",
  harmonics: "event",

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

/** z-index das etiquetas de preço. Constante própria porque o
 *  PriceLabelStackPlugin já tinha z=5 hardcoded ANTES deste módulo existir —
 *  e aquele 5 é justamente o sintoma: era o único que sabia que precisava
 *  ficar por cima, sem nenhum sistema por trás. */
export const CHART_LABEL_Z_INDEX = TIER_Z.label;

/** Todos os ids cadastrados — o teste usa para provar cobertura 1:1 com
 *  CHART_LAYER_IDS (nenhuma camada real fica sem profundidade declarada). */
export const CHART_DEPTH_REGISTERED_IDS: readonly string[] = Object.keys(LAYER_TIER);
