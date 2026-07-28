// layer-relevance.ts — NÚCLEO GRAVITACIONAL AUTÔNOMO §1/§6/§7 (diretiva do
// Operador, respondida em duas perguntas antes de construir: o Fusion
// Engine fica DISPLAY-ONLY, nunca gera/altera Entry/Stop/Target/Risco —
// LEI 24 intacta; os 15 toggles manuais continuam existindo como override
// real, o padrão novo é só o comportamento AUTOMÁTICO por trás deles).
//
// Motor puro (Laboratório de Evolução: nasce isolado, sem nenhuma ligação
// com App.tsx/ChartWidget até a suíte de testes provar o comportamento).
// Entrada = só sinais JÁ REAIS e JÁ COMPUTADOS em algum lugar do app
// (obstáculos do Trade Plan, decaimento de idade de BOS/CHOCH já real de
// annotation-decay.ts, proximidade a POC/HVN, fitScore de harmônico,
// estado direcional de VWAP/Nexus Line, zona Premium/Discount, tendência
// do fluxo) — zero número fabricado, zero segunda matemática: cada regra
// abaixo só decide um SIM/NÃO de exibição sobre um cálculo que já existia.
// (idade→alpha de BOS/CHOCH é resolvida pelo chamador via ageAlpha/
// annotation-decay.ts antes de chegar aqui — este módulo só recebe o
// alpha já pronto, nunca reimplementa a curva de decaimento.)
import type { DirectionalLineState } from "./vwap-state";
import type { PremiumDiscountZone } from "./premium-discount";

// Mesma lista de 15 ids de EnhancedChart_110_Percent.tsx (CHART_LAYER_IDS)
// — duplicada aqui de propósito para este módulo continuar puro/isolado
// (zero import de chart/EnhancedChart_110_Percent.tsx, que arrasta
// lightweight-charts). A sincronia entre as duas listas é garantida por
// teste (layer-relevance.test.ts), não por import cruzado.
export const RELEVANCE_LAYER_IDS = [
  "liquidity_zones",
  "structure_breaks",
  "order_flow_heatmap",
  "volume_profile",
  "trade_plan_zone",
  "neural_market_aura",
  "ema",
  "trend_channel",
  "vwap",
  "nexus_line",
  "cvd",
  "fibonacci",
  "premium_discount",
  "harmonics",
  "equal_highs_lows",
  // Achado de auditoria (declutter do gráfico, pedido direto do
  // Operador): as 3 camadas institucionais mais recentes (EPC OMEGA
  // FINAL Etapa 10 / OMEGA CORE V-MAX Fase 8.1) nunca entraram no
  // gate de relevância — ficavam sempre visíveis em modo AUTO
  // independente de terem algo real pra mostrar agora, o oposto do
  // resto do painel "Camadas do Gráfico". Mesmo princípio das 15
  // acima: cada regra só decide SIM/NÃO sobre um dado já real.
  "liquidation_heatmap",
  "liquidity_sweep",
  "market_sessions",
  // Ferramentas Institucionais: Kill Zone ICT no canvas (badge do header
  // já existia, §6.48) entra na mesma disciplina — nunca fica visível
  // em modo automático sem ter uma janela institucional real ativa
  // agora, mesma lógica das 3 linhas acima.
  "kill_zones",
] as const;
export type RelevanceLayerId = (typeof RELEVANCE_LAYER_IDS)[number];

export interface LayerRelevanceInput {
  // Trade Plan real (Conselho ou fallback do Núcleo — já resolvido antes
  // de chegar aqui, este módulo não sabe/não precisa saber qual dos dois).
  tradePlanActive: boolean;
  obstacleZoneCount: number; // chartObstacleZones.length — obstáculos REAIS no caminho do plano ativo
  // Liquidez (EQH/EQL não varridas) — proximidade real ao preço vivo.
  unsweptLiquidityNearPrice: boolean;
  // BOS/CHOCH: idade real em candles já convertida no alpha de decaimento
  // que o próprio StructureBreakMarkersPlugin usa para desenhar — mesma
  // fonte, nunca uma segunda curva. null = nenhum rompimento registrado.
  structureBreakAlpha: number | null;
  // Volume Profile: preço vivo dentro da faixa de proximidade real de um
  // POC/HVN já calculado (WASM, quant-worker).
  volumeProfileNearPrice: boolean;
  // Harmônicos: fitScore real (0..1) do melhor padrão vivo — nunca
  // probabilidade (Regra de Ouro 2), só aderência geométrica de razão.
  harmonicBestFitScore: number | null;
  // Fibonacci: pelo menos um nível real da Matriz de Confluência dentro
  // da faixa de proximidade do preço vivo.
  fibonacciNearPrice: boolean;
  // Premium/Discount: zona real do dealing range (null = sem 2 swings
  // opostos confirmados ainda).
  premiumDiscountZone: PremiumDiscountZone | null;
  // Estado direcional real de VWAP/Nexus Line (mesmo DirectionalLineState
  // já usado pelos rótulos do eixo).
  vwapState: DirectionalLineState | null;
  nexusLineState: DirectionalLineState | null;
  // Trend Channel: bandwidth real (largura das bandas OLS/±σ) — canal
  // mais estreito é estruturalmente mais informativo (preço mais
  // "confinado", rompimento mais significativo quando acontece).
  trendChannelBandwidthPct: number | null;
  // Fluxo (CVD/heatmap): tendência real do fluxo (fortalecendo/
  // enfraquecendo), não a leitura instantânea — e presença real de livro
  // de ofertas ao vivo para o heatmap ter dado pra desenhar.
  orderflowTrendActive: boolean;
  hasOrderBook: boolean;
  // Liquidações Forçadas: pelo menos 1 evento real no feed atual — mesma
  // condição que o próprio painel de lista (SecondaryModuleView) já usa
  // para decidir se tem algo real pra mostrar.
  hasRecentLiquidation: boolean;
  // Liquidity Sweep: pelo menos 1 trap real STOP_HUNT_TOPO/FUNDO no
  // momento — mesmo filtro que o canvas (LiquiditySweep no
  // EnhancedChart) já usa para decidir o que desenhar.
  hasRecentLiquiditySweep: boolean;
  // Sessões institucionais: uma transição real de sessão aconteceu
  // dentro da janela recente declarada (mesma computeSessionBoundaries
  // pura que MarketSessionBandsPlugin já usa pra desenhar).
  recentSessionBoundary: boolean;
  // Kill Zone ICT: pelo menos 1 janela institucional real ativa agora —
  // mesma condição (activeKillZones) que o badge do header (§6.48) já usa.
  hasActiveKillZone: boolean;
}

export interface LayerRelevanceResult {
  relevant: boolean;
  reason: string;
  // EPC FINAL §3/§12 ("quando destacar"/"quando reduzir opacidade"): 3º
  // nível opcional sobre um gradiente REAL já presente no input (nunca um
  // sinal novo/fabricado) — "highlight" quando o mesmo sinal que decidiu
  // relevant=true está no seu extremo mais forte. Só as camadas que já
  // carregam um número contínuo real (não um booleano puro) ganham esta
  // distinção; as demais ficam sempre "normal" quando relevantes, honesto
  // por não ter um gradiente real pra medir.
  emphasis: "normal" | "highlight";
}

export type LayerRelevanceReading = Record<RelevanceLayerId, LayerRelevanceResult>;

// Limiares declarados por convenção (mesmo espírito do piso R:R 1:2 já
// documentado em rr-quality.ts) — nunca uma medição estatística real
// (este repositório não tem backtest para calibrar "proximidade ideal").
// Decisão de design, não fato matemático — documentado como tal.
export const LIQUIDITY_PROXIMITY_PCT = 0.5;
export const VOLUME_PROFILE_PROXIMITY_PCT = 0.35;
export const FIBONACCI_PROXIMITY_PCT = 0.4;
export const HARMONIC_MIN_RELEVANT_FIT = 0.75;
export const TREND_CHANNEL_TIGHT_BANDWIDTH_PCT = 3;
// Mesma curva de decaimento de BOS/CHOCH (StructureBreakMarkersPlugin) —
// reaproveitada aqui só para o limiar "ainda vale a pena mostrar"
// (alpha > 0), zero nova config de decaimento.
export const STRUCTURE_BREAK_RELEVANCE_MIN_ALPHA = 0;
// EPC FINAL §3/§12: limiares de DESTAQUE — mesmo gradiente real que já
// decide relevant=true, só um corte mais exigente dentro dele (convenção
// declarada, não medição — mesmo espírito dos limiares acima).
export const HARMONIC_HIGHLIGHT_FIT = 0.9;
export const TREND_CHANNEL_HIGHLIGHT_BANDWIDTH_PCT = TREND_CHANNEL_TIGHT_BANDWIDTH_PCT / 2;
export const STRUCTURE_BREAK_HIGHLIGHT_MIN_ALPHA = 0.9;
export const LIQUIDITY_HIGHLIGHT_MIN_OBSTACLES = 2;
// Sessões institucionais: janela real declarada de "acabou de mudar de
// sessão" — mesma natureza de convenção documentada, não medição (a
// sessão só transiciona 4x/dia; uma janela pequena mantém a camada
// visível logo após a virada e some depois, em vez de acender/apagar
// só no candle exato da transição).
export const MARKET_SESSION_RECENT_BOUNDARY_CANDLES = 5;

function fmtPct(p: number): string {
  return `${p.toFixed(1)}%`;
}

/** Motor puro: 1 leitura de entrada real -> relevância real por camada.
 *  Nunca lança, nunca depende de estado global, determinístico. */
export function computeLayerRelevance(input: LayerRelevanceInput): LayerRelevanceReading {
  const hasObstacle = input.tradePlanActive && input.obstacleZoneCount > 0;

  const structureBreakRelevant =
    input.structureBreakAlpha !== null && input.structureBreakAlpha > STRUCTURE_BREAK_RELEVANCE_MIN_ALPHA;

  const harmonicsRelevant =
    input.harmonicBestFitScore !== null && input.harmonicBestFitScore >= HARMONIC_MIN_RELEVANT_FIT;

  const trendChannelRelevant =
    input.trendChannelBandwidthPct !== null && input.trendChannelBandwidthPct <= TREND_CHANNEL_TIGHT_BANDWIDTH_PCT;

  const vwapRelevant = input.vwapState !== null && input.vwapState !== "NEUTRAL";
  const nexusLineRelevant = input.nexusLineState !== null && input.nexusLineState !== "NEUTRAL";
  // EMA como referência central: acompanha VWAP/Nexus Line quando algum
  // dos dois é direcional, OU fica visível por padrão quando NENHUM dos
  // dois ainda tem leitura real (fail-open intencional — EMA é o
  // indicador mais barato/universal do conjunto; nunca esconder a única
  // referência de tendência disponível só porque as outras duas ainda
  // não têm dado real).
  const noDirectionalReadingYet = input.vwapState === null && input.nexusLineState === null;
  const emaRelevant = vwapRelevant || nexusLineRelevant || noDirectionalReadingYet;

  const premiumDiscountRelevant = input.premiumDiscountZone !== null && input.premiumDiscountZone !== "EQUILIBRIUM";

  const liquidityHighlight = input.tradePlanActive && input.obstacleZoneCount >= LIQUIDITY_HIGHLIGHT_MIN_OBSTACLES;
  const structureBreakHighlight = structureBreakRelevant && input.structureBreakAlpha! >= STRUCTURE_BREAK_HIGHLIGHT_MIN_ALPHA;
  const trendChannelHighlight = trendChannelRelevant && input.trendChannelBandwidthPct! <= TREND_CHANNEL_HIGHLIGHT_BANDWIDTH_PCT;
  const harmonicsHighlight = harmonicsRelevant && input.harmonicBestFitScore! >= HARMONIC_HIGHLIGHT_FIT;

  return {
    liquidity_zones: hasObstacle
      ? { relevant: true, emphasis: liquidityHighlight ? "highlight" : "normal", reason: `${input.obstacleZoneCount} obstáculo(s) real(is) no caminho do plano ativo` }
      : input.unsweptLiquidityNearPrice
        ? { relevant: true, emphasis: "normal", reason: `liquidez não varrida a menos de ${fmtPct(LIQUIDITY_PROXIMITY_PCT)} do preço` }
        : { relevant: false, emphasis: "normal", reason: "nenhuma zona real no caminho do plano nem liquidez próxima do preço" },

    structure_breaks: structureBreakRelevant
      ? { relevant: true, emphasis: structureBreakHighlight ? "highlight" : "normal", reason: "rompimento BOS/CHOCH ainda dentro da janela real de decaimento (annotation-decay.ts)" }
      : { relevant: false, emphasis: "normal", reason: input.structureBreakAlpha === null ? "nenhum rompimento registrado" : "rompimento mais antigo esmaeceu (idade em candles)" },

    order_flow_heatmap: input.hasOrderBook
      ? { relevant: true, emphasis: "normal", reason: "livro de ofertas ao vivo real presente" }
      : { relevant: false, emphasis: "normal", reason: "sem livro de ofertas ao vivo real neste momento" },

    volume_profile: input.volumeProfileNearPrice
      ? { relevant: true, emphasis: "normal", reason: `preço vivo a menos de ${fmtPct(VOLUME_PROFILE_PROXIMITY_PCT)} de um POC/HVN real` }
      : { relevant: false, emphasis: "normal", reason: "preço vivo longe de qualquer POC/HVN real" },

    // Trade Plan Zone e Neural Market Aura são o núcleo do plano em si —
    // a diretiva pede menos POLUIÇÃO, não menos PLANO: seguem sua própria
    // lógica de ciclo de vida real (trade-plan.ts / aura-lifecycle.ts),
    // nunca ficam sujeitas ao gate de relevância (ficariam sem sentido
    // como "camada opcional" quando são o próprio resultado da decisão).
    trade_plan_zone: input.tradePlanActive
      ? { relevant: true, emphasis: "normal", reason: "plano real ativo (Conselho ou fallback do Núcleo) — nunca sujeito ao gate de relevância" }
      : { relevant: false, emphasis: "normal", reason: "nenhum plano real ativo agora" },
    neural_market_aura: { relevant: true, emphasis: "normal", reason: "ciclo de vida próprio (aura-lifecycle.ts) — nunca sujeito ao gate de relevância" },

    ema: emaRelevant
      ? { relevant: true, emphasis: "normal", reason: "referência de tendência central — mantida junto de VWAP/Nexus Line quando alguma leitura é direcional (ou sem leitura real ainda)" }
      : { relevant: false, emphasis: "normal", reason: "VWAP e Nexus Line neutros — sem leitura direcional real agora" },

    trend_channel: trendChannelRelevant
      ? { relevant: true, emphasis: trendChannelHighlight ? "highlight" : "normal", reason: `banda real estreita (${input.trendChannelBandwidthPct!.toFixed(2)}% <= ${TREND_CHANNEL_TIGHT_BANDWIDTH_PCT}%) — canal estruturalmente informativo` }
      : { relevant: false, emphasis: "normal", reason: input.trendChannelBandwidthPct === null ? "sem canal real detectado" : "banda real larga demais para ser um contexto estrutural forte agora" },

    vwap: vwapRelevant
      ? { relevant: true, emphasis: "normal", reason: `estado direcional real: ${input.vwapState}` }
      : { relevant: false, emphasis: "normal", reason: input.vwapState === null ? "sem leitura real de VWAP ainda" : "VWAP neutro" },

    nexus_line: nexusLineRelevant
      ? { relevant: true, emphasis: "normal", reason: `estado direcional real: ${input.nexusLineState}` }
      : { relevant: false, emphasis: "normal", reason: input.nexusLineState === null ? "sem leitura real de Nexus Line ainda" : "Nexus Line neutro" },

    cvd: input.orderflowTrendActive
      ? { relevant: true, emphasis: "normal", reason: "tendência real do fluxo (CVD) fortalecendo ou enfraquecendo, não estável" }
      : { relevant: false, emphasis: "normal", reason: "sem tendência real de fluxo detectável (estável ou dado insuficiente)" },

    fibonacci: input.fibonacciNearPrice
      ? { relevant: true, emphasis: "normal", reason: `nível real da Matriz de Confluência a menos de ${fmtPct(FIBONACCI_PROXIMITY_PCT)} do preço` }
      : { relevant: false, emphasis: "normal", reason: "nenhum nível real de Fibonacci próximo do preço vivo" },

    premium_discount: premiumDiscountRelevant
      ? { relevant: true, emphasis: "normal", reason: `zona real ${input.premiumDiscountZone} (fora do equilíbrio)` }
      : { relevant: false, emphasis: "normal", reason: input.premiumDiscountZone === null ? "sem dealing range real confirmado ainda" : "preço na zona de equilíbrio (EQUILIBRIUM) — sem vantagem de zona real" },

    harmonics: harmonicsRelevant
      ? { relevant: true, emphasis: harmonicsHighlight ? "highlight" : "normal", reason: `fitScore real ${(input.harmonicBestFitScore! * 100).toFixed(0)}% >= limiar de relevância (${(HARMONIC_MIN_RELEVANT_FIT * 100).toFixed(0)}%)` }
      : { relevant: false, emphasis: "normal", reason: input.harmonicBestFitScore === null ? "nenhum padrão harmônico real vivo" : "padrão real abaixo do limiar de relevância" },

    equal_highs_lows: input.unsweptLiquidityNearPrice
      ? { relevant: true, emphasis: "normal", reason: `EQH/EQL real não varrida a menos de ${fmtPct(LIQUIDITY_PROXIMITY_PCT)} do preço` }
      : { relevant: false, emphasis: "normal", reason: "nenhuma EQH/EQL real não varrida próxima do preço" },

    liquidation_heatmap: input.hasRecentLiquidation
      ? { relevant: true, emphasis: "normal", reason: "evento(s) real(is) de liquidação forçada no feed atual" }
      : { relevant: false, emphasis: "normal", reason: "nenhuma liquidação forçada real no feed atual" },

    liquidity_sweep: input.hasRecentLiquiditySweep
      ? { relevant: true, emphasis: "normal", reason: "sweep de liquidez real (STOP_HUNT) detectado agora" }
      : { relevant: false, emphasis: "normal", reason: "nenhum sweep de liquidez real detectado agora" },

    market_sessions: input.recentSessionBoundary
      ? { relevant: true, emphasis: "normal", reason: `transição real de sessão dentro dos últimos ${MARKET_SESSION_RECENT_BOUNDARY_CANDLES} candles` }
      : { relevant: false, emphasis: "normal", reason: "nenhuma transição de sessão recente — sessão vigente estável" },

    kill_zones: input.hasActiveKillZone
      ? { relevant: true, emphasis: "normal", reason: "janela institucional ICT real ativa agora (kill-zones.ts)" }
      : { relevant: false, emphasis: "normal", reason: "nenhuma kill zone ICT ativa neste momento" },
  };
}
