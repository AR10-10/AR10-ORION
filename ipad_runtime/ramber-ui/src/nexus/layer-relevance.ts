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
import { resolveTimeframePrecisionOrder, horizonFitReason } from "./timeframe-layer-profile";
import { SHARED_ZONE_HIGHLIGHT_SLOTS } from "./liquidity-significance";
import { FIB_RETRACEMENT_RATIOS } from "./fibonacci-confluence";
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
  // Padrões de vela (candlestick-patterns.js): mesma disciplina — a
  // camada só fica visível em modo automático quando existe padrão real
  // detectado na janela recente, nunca um canvas vazio ligado.
  "candle_patterns",
  // Pedido do Operador ("Key Levels"): máxima/mínima de sessão é uma
  // referência estrutural de S/R — mesma disciplina de liquidity_zones/
  // equal_highs_lows (relevante quando o preço vivo está PERTO de um
  // nível real, nunca sempre-ligado).
  "session_key_levels",
  // DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO §4 ("Consolidação de zonas"):
  // existência real de confluência entre ≥2 fontes independentes
  // (computeInstitutionalZones, nexus/institutional-zones.ts) — mesmo
  // padrão de tpo_profile/zigzag abaixo. Era "nunca sujeito ao gate" até
  // um achado medido mostrar que isso fazia a camada vencer vaga de topo
  // do teto automático mesmo vazia (ver LayerRelevanceInput,
  // institutionalZoneCount).
  "institutional_zones",
  // Entrega 40: mesma condição de order_flow_heatmap logo abaixo — o
  // livro de ofertas real é o MESMO dado para as duas camadas, nunca uma
  // segunda medição.
  "order_book_depth",
  // Entrega 41: TPO/Market Profile — relevante quando a sessão corrente
  // já produz um perfil real (hasTpoProfile).
  "tpo_profile",
  // Entrega 47 (pedido direto do Operador): ZigZag graduado do Laboratório
  // — mesmo padrão de tpo_profile acima (existência real de pivôs
  // suficientes pro motor desenhar uma linha, nunca proximidade).
  "zigzag",
  // GRADUAÇÃO de supertrend-engine.js — mesmo padrão de existência real de
  // tpo_profile/zigzag acima (o motor precisa do aquecimento de Wilder para
  // produzir um único ponto), nunca proximidade ao preço vivo: um trailing
  // stop é útil justamente quando está LONGE do preço.
  "supertrend",
  // Achado 2.5 (Visual Cleanup & Rendering Audit): SCENARIO A/B (Future
  // Path Map, scenario-engine.ts) — mesmo padrão de existência real de
  // tpo_profile/zigzag/fibonacci acima (hasScenario), nunca proximidade.
  "scenario_projection",
  // Auditoria do ecossistema de indicadores (pedido direto do Operador:
  // "qual ferramenta que está faltando"): Pivot Points clássicos, mesmo
  // padrão de existência real de tpo_profile/zigzag/scenario_projection
  // acima (hasPivotPoints), nunca proximidade — um nível diário estático
  // continua útil o dia inteiro.
  "pivot_points",
] as const;
export type RelevanceLayerId = (typeof RELEVANCE_LAYER_IDS)[number];

export interface LayerRelevanceInput {
  // Trade Plan real (Conselho ou fallback do Núcleo — já resolvido antes
  // de chegar aqui, este módulo não sabe/não precisa saber qual dos dois).
  tradePlanActive: boolean;
  obstacleZoneCount: number; // chartObstacleZones.length — obstáculos REAIS no caminho do plano ativo
  // Liquidez (EQH/EQL não varridas) — proximidade real ao preço vivo.
  unsweptLiquidityNearPrice: boolean;
  // Achado real (relato do Operador após captura de tela: FVG/Order
  // Blocks somem do gráfico depois de um movimento forte, mesmo com
  // zonas reais ainda não mitigadas): proximidade ao preço vivo é o
  // sinal ERRADO para uma zona ESTRUTURAL — FVG/OB são referência
  // válida até serem mitigadas, não só quando o preço está em cima
  // delas agora (mesma categoria de trend_channel abaixo: propriedade
  // real da própria zona, nunca distância). true quando existe pelo
  // menos 1 FVG ou Order Block real não mitigado, qualquer distância.
  hasUnmitigatedStructuralZone: boolean;
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
  // da faixa de proximidade do preço vivo — usado agora só como sinal de
  // DESTAQUE (emphasis), mesma razão de hasUnmitigatedStructuralZone
  // acima: a grade de retração é referência estrutural válida a partir
  // do swing que a originou, não só quando o preço está em cima dela.
  fibonacciNearPrice: boolean;
  // true quando a Matriz de Confluência tem pelo menos 1 nível real
  // calculado (qualquer distância do preço vivo) — decide relevant;
  // fibonacciNearPrice acima decide só o destaque dentro disso.
  hasFibonacciLevels: boolean;
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
  // TPO / Market Profile (Entrega 41): true quando computeTpoProfile
  // (nexus/tpo-profile.ts) devolve status OK para a sessão corrente —
  // existência real do dado, nunca proximidade. false cobre os 2 casos
  // honestos de DADOS_INSUFICIENTES do motor (sessão sem candle real
  // ainda, ou faixa de preço degenerada). Achado 2.1 da ORDEM DEFINITIVA
  // (MAPEAMENTO_VISUAL_CANVAS_2026-08-17.md): Volume Profile e TPO
  // Profile computam o MESMO conceito (Point of Control/Value Area) por
  // 2 metodologias reais diferentes (volume-no-preço vs. tempo-no-preço)
  // — os dois cálculos continuam intactos (nenhum é apagado, Regra de
  // Ouro 4), mas só um pode ser a representação visual automática por
  // vez. O motor NÃO decide qual metodologia é "melhor" agora (isso
  // seria inventar uma opinião nova) — só resolve QUAL fica em cima por
  // padrão: Volume Profile, porque sua própria relevância já é
  // proximidade real ao preço vivo (mais estreita, mais "agora" — ver
  // volumeProfileNearPrice abaixo), enquanto TPO é gate de mera
  // existência (mais largo, mostraria quase sempre). TPO nunca some do
  // sistema — continua 100% calculado e disponível via toggle manual no
  // Painel de Camadas (§12: "informação secundária permanece acessível
  // por... layers"), só para de disputar automaticamente o mesmo espaço
  // visual do POC/Value Area contra o Volume Profile.
  hasTpoProfile: boolean;
  // ZigZag (Entrega 47): true quando computeZigZag (research/engines/
  // zigzag-engine.js) devolve >=2 pivôs confirmados reais — mesmo limiar
  // mínimo que o próprio ZigZagPlugin usa pra decidir se tem uma linha
  // real pra traçar (existência real, nunca proximidade — mesmo padrão
  // de hasTpoProfile/hasFibonacciLevels acima).
  hasZigZagPivots: boolean;
  /** SuperTrend produziu pelo menos um ponto real (aquecimento de Wilder
   *  cumprido). Existência real, nunca proximidade. */
  hasSuperTrend: boolean;
  // Padrões de vela: pelo menos 1 padrão real detectado na janela recente
  // (candlestick-patterns.js). Existência real, nunca proximidade —
  // mesmo padrão de hasZigZagPivots/hasTpoProfile acima. O motor já é
  // fail-closed (sem estrutura confirmada não emite reversão), então
  // "existe padrão" aqui já significa "existe padrão que passou por todos
  // os gates reais".
  hasCandlePatterns: boolean;
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
  // Key Levels: preço vivo real a menos de LIQUIDITY_PROXIMITY_PCT de
  // alguma máxima/mínima de sessão dentro da mesma janela de exibição real
  // do plugin (MAX_KEY_LEVELS_SHOWN) — mesmo papel estrutural de
  // unsweptLiquidityNearPrice acima.
  hasSessionKeyLevelNearPrice: boolean;
  // "HOMOLOGAÇÃO DA ORDEM Nº 03 / ORGANISMO INTELIGENTE ADAPTATIVO":
  // "contexto operacional" real — o mesmo rótulo de regime já calculado a
  // cada ciclo (regime-engine.js, Wilder ADX/DI + percentil de largura de
  // banda de Bollinger: TENDENCIA_FORTE/TENDENCIA_MODERADA/CONSOLIDACAO/
  // COMPRESSAO/BREAKOUT/DADOS_INSUFICIENTES — engine.marketRegime.regime),
  // nunca um cálculo novo. Regime é CONTEXTO, nunca um gate de decisão
  // (mesma regra do próprio motor) — aqui só influencia QUAL camada
  // estrutural é mais informativa agora, exatamente o papel de todo outro
  // campo deste contrato. null = regime ainda não calculado (amostra
  // insuficiente ou ciclo não OK).
  marketRegime: string | null;
  // Achado 2.5 (Visual Cleanup & Rendering Audit): true quando o Motor de
  // Cenários (scenario-engine.ts) devolve pelo menos 1 alvo real em
  // qualquer um dos 2 caminhos (pathA/pathB) — mesma disciplina de
  // existência real de hasFibonacciLevels/hasZigZagPivots/hasTpoProfile
  // acima, nunca proximidade ao preço vivo (as 2 rotas já cobrem LONG e
  // SHORT simultaneamente, então "perto do preço" não distinguiria nada).
  hasScenario: boolean;
  // CORRIGIDO (achado medido, auditoria "sem utilidade... atrapalhando"):
  // institutional_zones e neural_market_aura eram RELEVANT:TRUE
  // incondicional. O raciocinio original nao estava errado sobre o
  // DESENHO (computeInstitutionalZones devolve [] honesto, a Aura tem
  // fadeAlpha 0) — estava incompleto sobre a DISPUTA: relevant:true
  // incondicional faz a camada entrar SEMPRE na competicao do modo AUTO
  // (resolveAutoLayerVisibility), consumindo 1 das AUTO_LAYER_MAX_
  // SIMULTANEOUS vagas mesmo sem nada real pra mostrar.
  //
  // institutional_zones e' o caso grave: rank 3 em AUTO_LAYER_PRECISION_
  // ORDER, atras so' de trade_plan_zone/structure_breaks. Uma zona vazia
  // (comum — exige >=2 fontes reais em confluencia) ocupava um dos 3
  // lugares mais precisos do teto, empurrando pra fora uma camada com
  // CONTEUDO real de posicao mais baixa (liquidity_zones, volume_profile,
  // equal_highs_lows...). Exatamente "atrapalhando... nao necessario".
  //
  // Mesmo padrao de todo outro campo deste contrato: existencia real,
  // nunca fiacao nova (os dois valores ja sao computados em App.tsx).
  institutionalZoneCount: number; // institutionalZones.length real
  hasAuraSignal: boolean; // auraReading.status === 'OK' && auraReading.plan !== null
  // Auditoria do ecossistema de indicadores (pedido direto do Operador):
  // Pivot Points clássicos — true quando getPivotPoints(symbol) devolve
  // status:'OK' real (candle diário anterior fechado disponível). Existência
  // real, nunca proximidade — mesmo padrão de hasZigZagPivots/hasTpoProfile
  // acima: um nível estático é útil o dia inteiro, não só quando o preço
  // está em cima dele agora.
  hasPivotPoints: boolean;
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
// Organismo Inteligente Adaptativo: os 2 rótulos reais de regime
// (regime-engine.js, REGIMES) que representam momentum CONFIRMADO por
// ADX/DI ou por um escape de compressão real — nunca TENDENCIA_MODERADA
// (ainda ambíguo por design do próprio motor) nem CONSOLIDACAO/
// COMPRESSAO (ausência de tendência). Convenção declarada (mesmo espírito
// dos limiares acima), não uma medição.
export const MARKET_REGIME_TREND_LABELS = new Set(["TENDENCIA_FORTE", "BREAKOUT"]);

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

  // Duas justificativas reais e INDEPENDENTES para um canal de tendência
  // importar agora — nunca a mesma pergunta duas vezes: banda estreita é
  // COMPRESSÃO (coiled, rompimento pendente); regime TENDENCIA_FORTE/
  // BREAKOUT é MOMENTUM já confirmado por ADX/DI (o canal pode estar
  // largo, expandindo COM a tendência). Qualquer uma das duas torna o
  // canal relevante.
  const trendChannelBandwidthTight =
    input.trendChannelBandwidthPct !== null && input.trendChannelBandwidthPct <= TREND_CHANNEL_TIGHT_BANDWIDTH_PCT;
  const trendChannelRegimeConfirmed = input.marketRegime !== null && MARKET_REGIME_TREND_LABELS.has(input.marketRegime);
  const trendChannelRelevant = trendChannelBandwidthTight || trendChannelRegimeConfirmed;

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
  // Nunca `input.trendChannelBandwidthPct!` aqui: bandwidth pode ser
  // legitimamente null quando só o regime confirmou relevância (acima) —
  // um `!` mentiria pro TypeScript e `null <= N` avalia true em JS
  // (null vira 0), acendendo highlight sem nenhum dado real de banda.
  // BREAKOUT (o rótulo mais extremo/acionável do motor) é a única
  // confirmação de regime forte o bastante pra highlight sozinha —
  // TENDENCIA_FORTE já basta pra relevant, não pro extremo do highlight.
  const trendChannelHighlight =
    trendChannelRelevant &&
    ((input.trendChannelBandwidthPct !== null && input.trendChannelBandwidthPct <= TREND_CHANNEL_HIGHLIGHT_BANDWIDTH_PCT) ||
      input.marketRegime === "BREAKOUT");
  const harmonicsHighlight = harmonicsRelevant && input.harmonicBestFitScore! >= HARMONIC_HIGHLIGHT_FIT;

  return {
    liquidity_zones: hasObstacle
      ? { relevant: true, emphasis: liquidityHighlight ? "highlight" : "normal", reason: `${input.obstacleZoneCount} obstáculo(s) real(is) no caminho do plano ativo` }
      : input.unsweptLiquidityNearPrice
        ? { relevant: true, emphasis: "normal", reason: `liquidez não varrida a menos de ${fmtPct(LIQUIDITY_PROXIMITY_PCT)} do preço` }
        : input.hasUnmitigatedStructuralZone
          ? { relevant: true, emphasis: "normal", reason: "FVG/Order Block real não mitigado — referência estrutural válida até ser mitigada, mesmo longe do preço vivo agora" }
          : { relevant: false, emphasis: "normal", reason: "nenhuma zona real no caminho do plano, liquidez próxima do preço, nem FVG/Order Block não mitigado" },

    structure_breaks: structureBreakRelevant
      ? { relevant: true, emphasis: structureBreakHighlight ? "highlight" : "normal", reason: "rompimento BOS/CHOCH ainda dentro da janela real de decaimento (annotation-decay.ts)" }
      : { relevant: false, emphasis: "normal", reason: input.structureBreakAlpha === null ? "nenhum rompimento registrado" : "rompimento mais antigo esmaeceu (idade em candles)" },

    order_flow_heatmap: input.hasOrderBook
      ? { relevant: true, emphasis: "normal", reason: "livro de ofertas ao vivo real presente" }
      : { relevant: false, emphasis: "normal", reason: "sem livro de ofertas ao vivo real neste momento" },

    // Entrega 40: mesmo sinal real de order_flow_heatmap acima (mesmo
    // livro, zero segunda medição) — a camada de profundidade só faz
    // sentido mostrar quando há bids/asks reais para desenhar.
    order_book_depth: input.hasOrderBook
      ? { relevant: true, emphasis: "normal", reason: "livro de ofertas ao vivo real presente" }
      : { relevant: false, emphasis: "normal", reason: "sem livro de ofertas ao vivo real neste momento" },

    // Achado 2.1 (ORDEM DEFINITIVA, MAPEAMENTO_VISUAL_CANVAS_2026-08-17.md
    // §Camada 4): TPO Profile e Volume Profile representam o MESMO
    // conceito (Point of Control) — nunca os dois automaticamente ao
    // mesmo tempo. Volume Profile é o canônico por padrão (ver
    // hasTpoProfile acima para o raciocínio completo); TPO deixa de
    // entrar em modo automático, mas continua 100% real e disponível via
    // toggle manual — nenhum cálculo foi removido, só a exibição
    // automática.
    tpo_profile: { relevant: false, emphasis: "normal", reason: input.hasTpoProfile ? "perfil TPO real e disponível (toggle manual) — Volume Profile é o Point of Control canônico automático, evita 2 representações do mesmo conceito ao mesmo tempo" : "sessão sem candle real suficiente ainda para um perfil TPO" },

    // Entrega 47: mesmo papel de tpo_profile acima — existência real de
    // pivôs suficientes, nunca proximidade ao preço vivo.
    zigzag: input.hasZigZagPivots
      ? { relevant: true, emphasis: "normal", reason: "pivôs ZigZag reais suficientes (deviation%+depth) para uma linha de estrutura" }
      : { relevant: false, emphasis: "normal", reason: "menos de 2 pivôs ZigZag confirmados ainda — sem linha real para desenhar" },

    // GRADUAÇÃO de supertrend-engine.js: existência real, nunca
    // proximidade. Um trailing stop é justamente mais informativo quando
    // está LONGE do preço (mostra quanta folga a tendência ainda tem) —
    // aplicar a régua de proximidade aqui esconderia a camada exatamente
    // quando ela mais diz alguma coisa.
    supertrend: input.hasSuperTrend
      ? { relevant: true, emphasis: "normal", reason: "SuperTrend real com aquecimento de Wilder cumprido — o stop que trilha o preço" }
      : { relevant: false, emphasis: "normal", reason: "candles insuficientes para o aquecimento do ATR de Wilder — sem linha real para desenhar" },

    // Padrão de vela é um evento pontual e perecível: só vale a tela
    // enquanto existe um real na janela recente. Sem nenhum, a camada sai
    // sozinha em modo automático em vez de ficar um canvas vazio ligado.
    candle_patterns: input.hasCandlePatterns
      ? { relevant: true, emphasis: "normal", reason: "padrão de vela real detectado na janela recente (com o contexto de tendência que a reversão exige)" }
      : { relevant: false, emphasis: "normal", reason: "nenhum padrão de vela real na janela recente" },

    volume_profile: input.volumeProfileNearPrice
      ? { relevant: true, emphasis: "normal", reason: `preço vivo a menos de ${fmtPct(VOLUME_PROFILE_PROXIMITY_PCT)} de um POC/HVN real` }
      : { relevant: false, emphasis: "normal", reason: "preço vivo longe de qualquer POC/HVN real" },

    // Trade Plan Zone segue a mesma disciplina de existência real de toda
    // outra camada — nunca "sem gate" por ser o núcleo do plano, só por
    // não ter dado (mesmo padrão de tradePlanActive de sempre).
    trade_plan_zone: input.tradePlanActive
      ? { relevant: true, emphasis: "normal", reason: "plano real ativo (Conselho ou fallback do Núcleo)" }
      : { relevant: false, emphasis: "normal", reason: "nenhum plano real ativo agora" },
    // CORRIGIDO: era relevant:true incondicional ("ciclo de vida próprio,
    // nunca sujeito ao gate"). Passou a exigir sinal real da Aura —
    // status OK e um plano geometricamente presente — pela mesma razão de
    // institutional_zones logo abaixo: sem isto, uma Aura "vazia"
    // (DADOS_INSUFICIENTES ou sem plano) ainda vencia vaga no teto do modo
    // automático em troca de nada visível.
    neural_market_aura: input.hasAuraSignal
      ? { relevant: true, emphasis: "normal", reason: "corredor real da Aura ativo (aura-lifecycle.ts)" }
      : { relevant: false, emphasis: "normal", reason: "Aura sem plano real (DADOS_INSUFICIENTES) — nada pra desenhar" },

    ema: emaRelevant
      ? { relevant: true, emphasis: "normal", reason: "referência de tendência central — mantida junto de VWAP/Nexus Line quando alguma leitura é direcional (ou sem leitura real ainda)" }
      : { relevant: false, emphasis: "normal", reason: "VWAP e Nexus Line neutros — sem leitura direcional real agora" },

    trend_channel: trendChannelRelevant
      ? {
          relevant: true,
          emphasis: trendChannelHighlight ? "highlight" : "normal",
          reason:
            trendChannelBandwidthTight && trendChannelRegimeConfirmed
              ? `banda real estreita (${input.trendChannelBandwidthPct!.toFixed(2)}% <= ${TREND_CHANNEL_TIGHT_BANDWIDTH_PCT}%) e regime real ${input.marketRegime} — compressão e momentum confirmados juntos`
              : trendChannelBandwidthTight
                ? `banda real estreita (${input.trendChannelBandwidthPct!.toFixed(2)}% <= ${TREND_CHANNEL_TIGHT_BANDWIDTH_PCT}%) — canal estruturalmente informativo`
                : `regime real ${input.marketRegime} (contexto operacional) — momentum confirmado por ADX/DI mesmo com a banda ainda larga`,
        }
      : { relevant: false, emphasis: "normal", reason: input.trendChannelBandwidthPct === null && input.marketRegime === null ? "sem canal real detectado" : "banda real larga demais e regime sem momentum confirmado — sem contexto estrutural forte agora" },

    vwap: vwapRelevant
      ? { relevant: true, emphasis: "normal", reason: `estado direcional real: ${input.vwapState}` }
      : { relevant: false, emphasis: "normal", reason: input.vwapState === null ? "sem leitura real de VWAP ainda" : "VWAP neutro" },

    nexus_line: nexusLineRelevant
      ? { relevant: true, emphasis: "normal", reason: `estado direcional real: ${input.nexusLineState}` }
      : { relevant: false, emphasis: "normal", reason: input.nexusLineState === null ? "sem leitura real de Nexus Line ainda" : "Nexus Line neutro" },

    cvd: input.orderflowTrendActive
      ? { relevant: true, emphasis: "normal", reason: "tendência real do fluxo (CVD) fortalecendo ou enfraquecendo, não estável" }
      : { relevant: false, emphasis: "normal", reason: "sem tendência real de fluxo detectável (estável ou dado insuficiente)" },

    fibonacci: input.hasFibonacciLevels
      ? {
          relevant: true,
          emphasis: input.fibonacciNearPrice ? "highlight" : "normal",
          reason: input.fibonacciNearPrice
            ? `nível real da Matriz de Confluência a menos de ${fmtPct(FIBONACCI_PROXIMITY_PCT)} do preço`
            : "Matriz de Confluência real calculada — grade de retração válida a partir do swing, mesmo longe do preço vivo agora",
        }
      : { relevant: false, emphasis: "normal", reason: "nenhum nível real de Fibonacci calculado ainda" },

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

    session_key_levels: input.hasSessionKeyLevelNearPrice
      ? { relevant: true, emphasis: "normal", reason: `preço vivo a menos de ${fmtPct(LIQUIDITY_PROXIMITY_PCT)} de uma máxima/mínima real de sessão` }
      : { relevant: false, emphasis: "normal", reason: "nenhum Key Level de sessão real próximo do preço vivo" },

    // Mesmo princípio de neural_market_aura acima: ciclo de vida próprio
    // CORRIGIDO (achado medido): era relevant:true incondicional. A lógica
    // original — "computeInstitutionalZones já devolve [] sem confluência
    // real, então o gate aqui seria redundante" — está certa sobre o
    // DESENHO (uma lista vazia não pinta nada) e errada sobre a DISPUTA:
    // institutional_zones é rank 3 em AUTO_LAYER_PRECISION_ORDER, e
    // relevant:true incondicional a fazia vencer um dos 3 lugares mais
    // precisos do teto do modo automático MESMO VAZIA — empurrando pra
    // fora uma camada de posição mais baixa que tinha conteúdo real. Agora
    // segue o mesmo padrão de hasFibonacciLevels/hasZigZagPivots acima:
    // existência real, nunca proximidade.
    institutional_zones: input.institutionalZoneCount > 0
      ? { relevant: true, emphasis: "normal", reason: `${input.institutionalZoneCount} zona(s) real(is) de confluência institucional` }
      : { relevant: false, emphasis: "normal", reason: "sem confluência real cruzada entre ≥2 fontes ainda — lista de zonas vazia" },

    // Achado 2.5: mesmo papel de tpo_profile/zigzag acima — existência
    // real de pelo menos 1 alvo projetado em qualquer caminho, nunca
    // proximidade ao preço vivo.
    scenario_projection: input.hasScenario
      ? { relevant: true, emphasis: "normal", reason: "Motor de Cenários real com pelo menos 1 alvo projetado (pathA ou pathB)" }
      : { relevant: false, emphasis: "normal", reason: "nenhum alvo real projetado em nenhum dos 2 caminhos do Motor de Cenários" },

    // Auditoria do ecossistema de indicadores: mesmo papel de tpo_profile/
    // zigzag/scenario_projection acima — existência real (candle diário
    // anterior fechado disponível), nunca proximidade ao preço vivo.
    pivot_points: input.hasPivotPoints
      ? { relevant: true, emphasis: "normal", reason: "Pivot Points reais do candle diário anterior fechado" }
      : { relevant: false, emphasis: "normal", reason: "sem candle diário fechado real ainda (dado ainda carregando ou símbolo sem histórico diário suficiente)" },
  };
}

// ============================================================================
// TETO DE SIMULTANEIDADE — "deixa o gráfico mais limpo possível, só com as
// ferramentas mais precisas" (pedido direto do Operador)
// ============================================================================
//
// ACHADO QUE ORIGINOU ISTO (medido, não suposto):
//   1. `layer-relevance.ts` (acima) JÁ esconde camada sem leitura real — esse
//      gate funciona e não é o problema.
//   2. `visual-budget.ts` tem VISUAL_BUDGET_FLOOR_WEIGHT = 0.35 e o comentário
//      explícito "nenhum objeto cai abaixo disto — nunca removido". Ou seja: o
//      orçamento visual NUNCA esconde, só apaga para 35% de opacidade.
//   3. Não existia, em lugar nenhum, um teto de QUANTAS camadas podem estar
//      relevantes AO MESMO TEMPO.
//
// Consequência real: em mercado ativo a maioria das 25 camadas tem leitura
// real simultânea, todas passam no gate de relevância, e o gráfico desenha
// 15+ objetos — vários a 35% de opacidade. Não era "cada camada poluindo": era
// a AUSÊNCIA de competição entre camadas que passaram no gate.
//
// Este é o teto que faltava. Ele NÃO apaga dado (Regra de Ouro 4): a camada
// continua existindo, o motor continua calculando, o toggle manual continua
// mandando mais que ele, e a razão de cada camada suprimida fica legível.
// Ele só decide o que merece a tela AGORA, no modo Automático.

/** Quantas camadas o modo Automático desenha ao mesmo tempo, no máximo.
 *  Convenção declarada (não medição), calibrada pelo mesmo princípio que a
 *  pesquisa de paleta já aplicou: a leitura simultânea confiável de um humano
 *  fica na casa de meia dúzia de categorias distintas. Acima disso o operador
 *  para de ler e passa a varrer. */
export const AUTO_LAYER_MAX_SIMULTANEOUS = 6;

/** Ordem de PRECISÃO declarada — do mais acionável ao mais contextual.
 *  Convenção documentada, no mesmo espírito de VISUAL_BUDGET_PRIORITY_ORDER
 *  (visual-budget.ts), nunca uma medição. O critério: o que responde "onde
 *  entro/saio AGORA" vem antes do que responde "como está o cenário".
 *  Camada fora desta lista entra por último — nunca some por omissão. */
export const AUTO_LAYER_PRECISION_ORDER: readonly string[] = [
  "trade_plan_zone",      // o plano ativo: entrada/stop/alvo reais
  "structure_breaks",     // CHoCH/BOS: a mudança estrutural em si
  "institutional_zones",  // confluência já consolidada de várias fontes
  "liquidity_zones",      // FVG/OB não mitigados
  "order_book_depth",     // livro real ao vivo
  "volume_profile",       // POC canônico
  "equal_highs_lows",
  "liquidity_sweep",
  // ACHADO MEDIDO (pedido do Operador: "nada que está pra trás"):
  // candle_patterns estava FORA desta lista. O comentário acima promete que
  // "camada fora desta lista entra por último — nunca some por omissão", mas
  // a medição mostrou que, na prática, "por último" era "nunca": com todas as
  // camadas relevantes, ela não aparecia em NENHUM timeframe (1m..1w), porque
  // rank = fim da fila e o teto de 6 já é consumido antes. E o único caminho
  // que a resgataria — `emphasis: "highlight"`, que ordena antes do rank —
  // ela nunca usa: a regra dela emite "normal" nos dois ramos. Resultado: uma
  // camada calculada, com plugin montado e custando 4 do orçamento de 12, que
  // era impossível de ver no modo automático.
  //
  // POSIÇÃO ESCOLHIDA PELO CRITÉRIO JÁ DECLARADO no topo desta lista ("o que
  // responde 'onde entro/saio AGORA' antes do que responde 'como está o
  // cenário'"), nunca por gosto: um padrão de vela é um evento PONTUAL E
  // PERECÍVEL num preço e num instante — a mesma natureza de liquidity_sweep
  // logo acima, e por isso o mesmo grupo. Fica depois das âncoras estruturais
  // (plano, BOS/CHOCH, zonas) e antes das linhas de contexto contínuo
  // (VWAP/EMA/Nexus Line), que respondem "como está", não "agora".
  "candle_patterns",
  "vwap",
  "ema",
  "nexus_line",
  "fibonacci",
  "premium_discount",
  "trend_channel",
  "supertrend",
  "harmonics",
  "zigzag",
  "tpo_profile",
  "cvd",
  "order_flow_heatmap",
  "liquidation_heatmap",
  "session_key_levels",
  // Auditoria do ecossistema de indicadores: rank deliberadamente BAIXO,
  // apesar de ser um nível estrutural real — o custo real é 7 objetos (mais
  // da metade do orçamento de 12), então rankeá-lo alto faria uma única
  // camada nova dominar o teto sempre que relevante, empurrando pra fora
  // âncoras mais acionáveis (plano/BOS/zonas) que já estavam na tela antes
  // dele existir. Mesmo raciocínio já aplicado a candle_patterns acima,
  // na direção oposta (ordem por critério declarado, nunca por gosto).
  "pivot_points",
  "market_sessions",
  "kill_zones",
  "scenario_projection",
  "neural_market_aura",
];

// ============================================================================
// CUSTO VISUAL — o teto passa a contar OBJETOS, não camadas
// ============================================================================
//
// ACHADO MEDIDO (reclamação repetida do Operador: "não ficar vários
// indicadores no mesmo lugar", "está muito pesado"):
//
// O teto acima limitava 6 CAMADAS. Mas camada não é uma unidade de custo —
// elas desenham quantidades muito diferentes:
//
//   vwap            5 séries reais (VWAP + 4 bandas ±σ)
//   trend_channel   3 séries reais (mid + upper + lower)
//   candle_patterns até MAX_PATTERN_MARKERS = 4 marcadores
//   ema             1 série
//
// Contadas por camada, "6" podia significar 6 objetos na tela — ou vinte.
// O peso e a poluição seguem o número de OBJETOS, não o de camadas, e era
// justamente essa unidade que ninguém estava contando.
//
// Este é o mesmo princípio que visual-budget.ts já aplica às anotações
// (orçamento com peso por objeto, nunca contagem crua). Aqui ele passa a
// valer também para as camadas — uma disciplina só nos dois lugares.

/** Quantos objetos visuais distintos cada camada desenha.
 *
 *  CONTADO NO CÓDIGO (não estimado): vwap = 5 séries (`addSeries` do VWAP
 *  mais as 4 bandas), trend_channel = 3 séries, candle_patterns =
 *  MAX_PATTERN_MARKERS. As demais são DECLARADAS — a ordem de grandeza do
 *  que a camada põe na tela, na mesma natureza de convenção declarada dos
 *  limiares de expectancy.ts. Camada ausente custa 1: nunca custa zero
 *  (nada é de graça) e nunca é penalizada por omissão. */
export const LAYER_VISUAL_COST: Readonly<Record<string, number>> = {
  // Contados no código
  vwap: 5,
  trend_channel: 3,
  candle_patterns: 4,
  // CORRIGIDO (achado medido): estava DECLARADO como 3 e o valor real
  // chegava a 15 — cinco populações de banda (FVG, Order Block, Void,
  // Breaker, Mitigation) com um teto próprio de 3 cada, nenhuma sabendo
  // das outras. Uma subdeclaração de 5x justamente na camada que mais
  // desenha, num orçamento total de 12: ela sozinha podia estourar o
  // canvas inteiro. Agora as cinco disputam UM orçamento
  // (selectSharedZoneHighlights, liquidity-significance.ts), então este
  // número virou CONTADO — é literalmente o mesmo teto, importado da
  // fonte, nunca uma segunda constante que pode divergir em silêncio.
  liquidity_zones: SHARED_ZONE_HIGHLIGHT_SLOTS,
  // CORRIGIDO na mesma cacada do liquidity_zones acima — o mesmo defeito
  // aparecia em mais tres linhas desta tabela, e as tres agora sao CONTADAS
  // em vez de estimadas:
  //
  //   fibonacci  — declarava 3, desenha 5. O grafico faz
  //     `fibonacciLevels.forEach` SEM filtro, e o proprio comentario de la
  //     diz "sem nenhuma linha desaparecer (piso real)": as 5 razoes sempre
  //     entram, so' a opacidade varia. Agora vem da fonte
  //     (FIB_RETRACEMENT_RATIOS.length), entao acrescentar uma razao nova
  //     ajusta o custo sozinho — nao da' pra divergir de novo em silencio.
  fibonacci: FIB_RETRACEMENT_RATIOS.length,
  trade_plan_zone: 3,
  equal_highs_lows: 2,
  structure_breaks: 2,
  premium_discount: 2,
  institutional_zones: 2,
  session_key_levels: 2,
  liquidity_sweep: 2,
  scenario_projection: 2,
  // Declarados — camadas de objeto único (uma linha, um perfil, um mapa)
  ema: 1,
  nexus_line: 1,
  cvd: 1,
  volume_profile: 1,
  tpo_profile: 1,
  order_book_depth: 1,
  //   harmonics — declarava 1, e este eu PIOREI. A unidade desta tabela é o
  //     objeto que o OLHO vê (ver a justificativa do supertrend logo
  //     abaixo: 2 séries que a lib desenha como um traço só custam 1).
  //     Antes, só UMA família de padrão desenhava por vez, então o pior
  //     caso era o ziguezague + a neckline do OCO = 2 figuras. Ao tirar o
  //     Triângulo da disputa — para ele parar de sumir do gráfico —, o pior
  //     caso simultâneo virou ziguezague + neckline + o Triângulo (suas 2
  //     retas convergentes são UMA figura, não duas) = 3.
  //     Corrigir a etiqueta é parte da mesma mudança, não um extra: eu subi
  //     o custo real e a declaração tinha de acompanhar.
  harmonics: 3,
  zigzag: 1,
  // Duas LineSeries nativas (uma por sentido de tendência) — mas a lib
  // desenha um único traço contínuo na tela, então o custo de LEITURA é 1,
  // igual a qualquer outra linha.
  supertrend: 1,
  order_flow_heatmap: 1,
  liquidation_heatmap: 1,
  market_sessions: 1,
  kill_zones: 1,
  neural_market_aura: 1,
  // Auditoria do ecossistema de indicadores: CONTADO no código, não
  // estimado (mesma disciplina desta tabela) — createPriceLine é chamado
  // até 7 vezes (PP+R1-3+S1-3), cada linha um objeto que o olho vê
  // separadamente (7 alturas de preço distintas, não um traço contínuo
  // como supertrend). Honesto mesmo sendo um custo alto: mentir pra caber
  // no orçamento seria repetir o defeito que este arquivo já corrigiu 3x.
  pivot_points: 7,
};

/** Custo real de uma camada. Fail-closed: desconhecida custa 1 — entra na
 *  competição em pé de igualdade, nunca é excluída por não estar na tabela. */
export function layerVisualCost(id: string): number {
  const c = LAYER_VISUAL_COST[id];
  return Number.isFinite(c) && (c as number) > 0 ? (c as number) : 1;
}

/** Orçamento de OBJETOS que o modo Automático pode pôr na tela.
 *
 *  Convenção declarada, nunca medição. Calibrada com a tabela de custo na
 *  mão: as camadas do topo da ordem de precisão somam 12 objetos em ~6
 *  camadas, então a intenção original do teto (meia dúzia de leituras
 *  simultâneas) é preservada — o que muda é o PIOR caso, que era ~20
 *  objetos e agora não passa de 12.
 *
 *  Calibrei em 12 e não em 10 de propósito: 10 derrubava a contagem típica
 *  de 6 para 4 camadas, uma mudança grande demais para entregar sem poder
 *  verificar na tela. Se o Operador quiser mais enxuto, é UM número, num
 *  lugar só, com teste que o acompanha. */
export const AUTO_LAYER_MAX_VISUAL_COST = 12;

export interface AutoLayerDecision {
  /** Desenha AGORA no modo Automático. */
  show: boolean;
  /** Razão real e legível — nunca "escondido" sem explicação. */
  reason: string;
  /** true só quando a camada TINHA leitura real e perdeu por competição.
   *  Distingue "não há o que mostrar" de "há, mas outra coisa é mais
   *  precisa agora" — dois estados diferentes que não podem virar um só. */
  suppressedByCap: boolean;
}

/**
 * Decide, entre as camadas que JÁ passaram no gate de relevância, quais
 * merecem a tela agora. Puro e determinístico.
 *
 * `forcedOn` são as camadas que o Operador ligou na mão: elas NUNCA são
 * suprimidas por este teto e NÃO consomem o orçamento — decisão humana
 * explícita manda mais que heurística, sempre.
 *
 * Critério de ordenação, nesta ordem:
 *   1. `emphasis === "highlight"` primeiro — é o único gradiente REAL já
 *      presente no resultado (o mesmo sinal que decidiu relevante=true está
 *      no seu extremo). Nunca um peso inventado aqui.
 *   2. ordem de precisão declarada acima.
 */
export function resolveAutoLayerVisibility(
  relevance: Readonly<Record<string, LayerRelevanceResult>>,
  forcedOn: readonly string[] = [],
  cap: number = AUTO_LAYER_MAX_SIMULTANEOUS,
  timeframe: string | null = null,
): Record<string, AutoLayerDecision> {
  const out: Record<string, AutoLayerDecision> = {};
  const forced = new Set(forcedOn);
  const effectiveCap = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : AUTO_LAYER_MAX_SIMULTANEOUS;

  // Pedido do Operador ("o que é necessário pra operar em CADA tempo
  // gráfico"): a ordem de precisão passa a ser resolvida pelo horizonte
  // atual. O critério não é gosto — é COBERTURA REAL DE DADO (ver
  // timeframe-layer-profile.ts: fluxo retido cobre ~8 min; VWAP/sessões são
  // ancoradas ao dia UTC). Fail-closed: `timeframe` ausente ou desconhecido
  // devolve a ordem declarada intacta, byte a byte como antes.
  const ordem = resolveTimeframePrecisionOrder(AUTO_LAYER_PRECISION_ORDER, timeframe);
  const rank = (id: string) => {
    const i = ordem.indexOf(id);
    return i === -1 ? ordem.length : i;
  };

  const competing: string[] = [];
  for (const [id, r] of Object.entries(relevance)) {
    if (forced.has(id)) {
      out[id] = { show: true, reason: "ligada manualmente pelo Operador — teto automático não se aplica", suppressedByCap: false };
      continue;
    }
    if (!r || !r.relevant) {
      out[id] = { show: false, reason: r?.reason ?? "sem leitura real", suppressedByCap: false };
      continue;
    }
    competing.push(id);
  }

  competing.sort((a, b) => {
    const ha = relevance[a].emphasis === "highlight" ? 0 : 1;
    const hb = relevance[b].emphasis === "highlight" ? 0 : 1;
    if (ha !== hb) return ha - hb;
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b); // determinismo total: mesma entrada, mesma saída
  });

  // Duas restrições, ambas ativas — a camada precisa caber nas DUAS:
  //   · contagem  — no máximo `effectiveCap` camadas distintas
  //   · custo     — no máximo AUTO_LAYER_MAX_VISUAL_COST objetos na tela
  //
  // A segunda é a que faltava: sem ela, `vwap` (5 objetos) ocupava o mesmo
  // "slot" que `ema` (1), e seis camadas podiam virar vinte objetos.
  //
  // Uma camada cara que não cabe NÃO trava a fila: as seguintes continuam
  // sendo avaliadas e uma barata pode entrar no espaço que sobrou. Isso é
  // deliberado — o objetivo é encher a tela com o que cabe, não parar no
  // primeiro item grande demais.
  let shown = 0;
  let spent = 0;
  competing.forEach((id) => {
    const cost = layerVisualCost(id);
    if (shown < effectiveCap && spent + cost <= AUTO_LAYER_MAX_VISUAL_COST) {
      out[id] = { show: true, reason: relevance[id].reason, suppressedByCap: false };
      shown += 1;
      spent += cost;
    } else {
      const motivo = shown >= effectiveCap
        ? `${effectiveCap} camadas mais precisas ocupam a tela agora`
        : `desenha ${cost} objetos e o orçamento visual (${AUTO_LAYER_MAX_VISUAL_COST}) já tem ${spent} ocupados`;
      // Quando o HORIZONTE é o que empurrou a camada para trás, a razão
      // real é essa — e ela é muito mais útil ao Operador do que "perdeu a
      // competição". Dizer "o fluxo retido cobre ~8 min e não cobre uma
      // vela de 4h" explica; "cedeu espaço" só constata.
      const porHorizonte = horizonFitReason(id, timeframe);
      out[id] = {
        show: false,
        reason: porHorizonte
          ? `${porHorizonte} — ${motivo} (${relevance[id].reason})`
          : `leitura real presente, mas ${motivo} (${relevance[id].reason})`,
        suppressedByCap: true,
      };
    }
  });

  return out;
}
