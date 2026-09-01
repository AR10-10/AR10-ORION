// EnhancedChart_110_Percent.tsx — V18 Sprint 1, Tarefa B: "Destravar o
// Gráfico Institucional". Substitui o SVG feito à mão (que só desenhava as
// últimas N velas com espaçamento igual, sem pan, sem zoom real, sem eixo
// temporal de verdade) por lightweight-charts — pan (handleScroll) e zoom
// (handleScale) nativos da própria lib, nunca reimplementados à mão aqui.
//
// Escopo desta Tarefa B (diretriz explícita: "não tente reescrever o
// sistema inteiro de uma vez"): candles reais com pan/zoom/crosshair
// nativos + S1/R1 e zonas SMC reais como price lines nativas
// (createPriceLine) — sempre sincronizadas com pan/zoom porque são
// primitivas da própria lib, nunca posicionadas manualmente em pixels.
// Isto preserva a garantia já estabelecida nesta sessão ("os overlays do
// gráfico — SMC, S/R, FVG — devem continuar existindo e processando dados
// reais"), só muda COMO são desenhados. Fica como próximo passo (não
// fabricado às pressas aqui): um retângulo real por zona (via Plugin API
// de primitives da lightweight-charts) mostrando também ONDE no tempo a
// zona se formou — por ora, price lines de largura total mostram o
// preço real top/bottom de cada zona ainda não mitigada/varrida, o
// mesmo filtro (!mitigated / !swept) e o mesmo cap de contagem que o
// componente antigo já usava.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  isUTCTimestamp,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type LogicalRange,
  type AutoscaleInfoProvider,
  type MouseEventParams,
} from "lightweight-charts";
import { computeAutoFitPriceRange, isFiniteNum, type AutoFitLevels } from "../nexus/price-range-fit";
import { computeViewportCandles } from "../nexus/chart-viewport";
// V-MAX Fase 1 (superfície visual, fechamento do §3.1): linha de CVD real
// — a série do orderflowHistory (Fase 1.2) com eixo Y próprio nativo.
import { useOrderflowHistory, useVolumeProfileSnapshot, useUnifiedSnapshotStore } from "../store/unified-snapshot-store";
// ZONE_DECAY: Ordem Nº 04 — mesma curva que o plugin já usa isolado,
// reusada aqui para montar o candidato real de MAIN_LIQUIDITY (visual-
// budget.ts), mesmo padrão de BREAK_DECAY logo abaixo.
import { LiquidityZonesPlugin, ZONE_DECAY, type FillableZone, type EqualLevelMark } from "./LiquidityZonesPlugin";
// Ordem "Ciborgue Vivo" §1: anotação temporária de BOS/CHOCH — mesma
// arquitetura de overlay do LiquidityZonesPlugin acima, dado real diferente.
// BREAK_DECAY: achado real de captura de tela (rótulo "CHOC" colidindo com
// a caixa "EMA 21") — o TEXTO migrou para priceAxisLabels abaixo, reusando
// a MESMA config de decaimento do plugin (zero segunda curva).
import { StructureBreakMarkersPlugin, BREAK_DECAY } from "./StructureBreakMarkersPlugin";
import { CandlePatternMarkersPlugin } from "./CandlePatternMarkersPlugin";
import { ageAlpha, type DecayConfig } from "./annotation-decay";
// Achado real de captura de tela do Operador (dezenas de rótulos "SWEEP"
// empilhados — swept é uma flag permanente em LiquidityZone, sem
// decaimento por idade nenhum evento nunca "sumia"). Diretiva formal
// confirmou o horizonte real pedido: 0-50 candles prioridade máxima,
// 50-100 média, 100-200 transparência reduzida, >200 ocultar automático —
// mapeado no MESMO utilitário contínuo já real (annotation-decay.ts::
// ageAlpha) que BOS/CHOCH usa via BREAK_DECAY: fadeStartCandles=50 (fim
// da "prioridade máxima"), expireCandles=200 (o teto pedido), minAlpha
// baixo o bastante pra ficar quase invisível pouco antes de sumir de
// vez. Horizonte maior que BREAK_DECAY (100) de propósito — Sweep é
// referência de S/R que continua útil por mais tempo que uma anotação
// de estrutura recém-rompida.
const SWEEP_DECAY: DecayConfig = { fadeStartCandles: 50, expireCandles: 200, minAlpha: 0.12 };

// Arrays vazios ESTÁVEIS. Achado real ao ligar EQH/EQL neste mesmo plugin:
// o call site fazia `(fairValueGaps ?? [])`, que cria um array NOVO a cada
// render sempre que a prop vem undefined — e o plugin tem um efeito que
// marca o canvas como sujo quando essas props mudam de identidade. Ou seja:
// um redraw por render, para sempre, sem nenhuma zona real na tela.
// Constantes de módulo eliminam isso sem mudar nenhum comportamento
// visível — parte do "deixa o sistema leve" pedido pelo Operador.
/** Linha do crosshair — mesmo matiz `#758696` de sempre, translúcida.
 *  Ver o comentário no bloco `crosshair:` das opções do chart. */
const CROSSHAIR_LINE_COLOR = "rgba(117, 134, 150, 0.42)";

const NO_FILLABLE_ZONES: FillableZone[] = [];
const NO_EQUAL_LEVELS: EqualLevelMark[] = [];
const EMPTY_OBSTACLE_ZONES: { low: number; high: number }[] = [];

// Zoom inteligente (ver efeito de setData): folga real à direita para o
// preço vivo/etiquetas respirarem. O pan/zoom manual do Operador continua
// soberano fora da troca de contexto.
//
// Ordem "FECHAMENTO DO AR10 CYBORG" §5: quantas velas o enquadre mostra
// deixou de ser a constante fixa `SMART_ZOOM_CANDLES = 120` e passou a ser
// `computeViewportCandles` (nexus/chart-viewport.ts, motor puro testado
// por execução real) — 60-200 adaptativo à largura REAL de plotagem e à
// densidade de dados real. Achado que motivou a troca: 120 fixo dava
// ~5,8px por vela no iPad Mini retrato (apertado) e ~14,6px no desktop
// 1920 (esparso, metade da tela virando espaço morto). O motivo de cada
// termo — e por que timeframe/zoom atual deliberadamente NÃO entram —
// vive no cabeçalho daquele módulo, nunca duplicado aqui.
const SMART_ZOOM_RIGHT_PAD_BARS = 6;

// Lapidação por captura real: teto de etiquetas de Sweep no eixo (os
// clusters mais recentes primeiro) — convenção declarada, mesma natureza
// de MAX_INSTITUTIONAL_ZONES. As price lines de todos os clusters vivos
// continuam desenhadas; só a ETIQUETA é seletiva.
const MAX_SWEEP_AXIS_LABELS = 4;
import { OrderFlowHeatmapPlugin } from "./OrderFlowHeatmapPlugin";
// V-MAX Fase 1 (superfície visual): Volume Profile real como overlay de
// barras à direita — dado direto da store (Fase 1.3), ver header do plugin.
import { VolumeProfilePlugin } from "./VolumeProfilePlugin";
// OMEGA CORE V-MAX Fase 8.1: heatmap real de liquidação — mesma
// arquitetura de overlay, ver header do plugin para a divisão de
// responsabilidade com VolumeProfilePlugin (barras à esquerda vs. à
// direita, zero sobreposição visual).
import { LiquidationHeatmapPlugin } from "./LiquidationHeatmapPlugin";
import { MarketSessionBandsPlugin } from "./MarketSessionBandsPlugin";
// Ferramentas Institucionais no canvas (badge do header já existia, §6.48
// — este plugin fecha a lacuna do desenho real): ICT Kill Zones, janela
// estreita dentro de cada sessão, conceito distinto de market-session.ts
// (ver header de kill-zones.ts/KillZoneBandsPlugin.tsx).
import { KillZoneBandsPlugin } from "./KillZoneBandsPlugin";
// Pedido do Operador (captura de indicador de referência "Key Levels"):
// máxima/mínima real de cada sessão como nível horizontal — companion
// function de market-session.ts (computeSessionKeyLevels), mesma partição
// de sessão já real, nunca uma 3ª definição de janelas.
import { SessionKeyLevelsPlugin } from "./SessionKeyLevelsPlugin";
// Achado real do Operador ("etiquetas em cima do valor do ativo"): só a
// sessão CORRENTE entra no sistema anti-colisão do eixo (mesma disciplina
// de S1/R1) — ver priceAxisLabels abaixo.
import { computeSessionKeyLevels } from "../nexus/market-session";
// DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO §4 ("Consolidação de zonas"):
// motor puro + plugin de canvas para a faixa de confluência real entre
// EMA/VWAP/Nexus Line/FVG/Order Block/EQH/EQL — ver header de cada
// arquivo para o raciocínio completo.
import { computeInstitutionalZones, type InstitutionalZoneInput } from "../nexus/institutional-zones";
import { InstitutionalZonePlugin, LABEL_COLOR as INSTITUTIONAL_ZONE_LABEL_COLOR, confluenceWeight } from "./InstitutionalZonePlugin";
import { DepthChartPlugin } from "./DepthChartPlugin";
import { TpoProfilePlugin } from "./TpoProfilePlugin";
import { computeTpoProfile } from "../nexus/tpo-profile";
import { resolveChartUltraWideScale } from "./chart-ultrawide-scale";
import { CHART_NATIVE_CANVAS_Z_INDEX } from "./chart-layer-depth";
import { ZigZagPlugin } from "./ZigZagPlugin";
import { IchimokuPlugin } from "./IchimokuPlugin";
import { DeltaDivergencePlugin } from "./DeltaDivergencePlugin";
import { chartPaletteRgba } from "./canvas-palette";
import { LIQUIDITY_PROXIMITY_PCT } from "../nexus/layer-relevance";
// Ordem Final Autonomia Evolução §1: entry zone as a translucent box —
// the chart-side companion to the price lines below.
import { TradePlanZonePlugin, opacityMultiplierFor } from "./TradePlanZonePlugin";
// Ordem Oficial de Execução Nº 03 ("Implementação Operacional"): primeira
// graduação real de nexus/visual-budget.ts (Diretriz Nº 02 — construído
// isolado/testado na rodada anterior, zero consumidor vivo até agora).
// Resolve competição CRUZADA de destaque entre o Trade Plan (prioridade 1
// real, declarada pela própria Diretriz Nº 02) e as Zonas Institucionais
// (prioridade 2) — as duas categorias do gráfico que já carregavam um
// peso 0..1 real e independente (confluenceWeight/opacityMultiplierFor,
// ambos importados acima, agora reusados aqui sem segunda fórmula).
import { resolveVisualBudget, VISUAL_BUDGET_FLOOR_WEIGHT, type VisualBudgetCandidate } from "../nexus/visual-budget";
// Neural Market Aura (especificação do Operador): corredor de convicção
// real entre entrada e alvo — ver o cabeçalho de NeuralMarketAuraPlugin.tsx
// para a divisão de responsabilidade com TradePlanZonePlugin (zero
// duplicação: aquele desenha a caixa da zona, este desenha o corredor).
import { NeuralMarketAuraPlugin } from "./NeuralMarketAuraPlugin";
import type { AuraReading } from "../nexus/aura-lifecycle";
// Correção de latência (Ordem "Sincronização em Tempo Real"): funde o
// último preço real do ticker WS na vela em formação via series.update() —
// nunca via `data`/setData (isso recomputaria SMC/Fibonacci/VP a cada
// tick). Ver header do módulo para o porquê da separação.
import { patchLastCandleWithLiveTick } from "../nexus/live-candle-sync";
import type { Timeframe } from "../nexus/types";
// Signal Precision order: actionable plan drawn as silk-thread price lines.
import type { TradePlan } from "../nexus/trade-plan";
import { effectiveStopForTargetsHit } from "../nexus/trade-plan";
import type { InstitutionalConfidenceZone } from "../nexus/institutional-score";
import type { ScenarioProjection } from "../nexus/scenario-engine";
import { describeScenarioConfidence, describeScenarioReaction } from "../nexus/scenario-engine";
import type { PremiumDiscountReading } from "../nexus/premium-discount";
import type { HarmonicPatternHit, HarmonicPoint } from "../nexus/harmonic-patterns";
import type { TrianglePatternHit } from "../nexus/triangle-pattern";
import type { HeadShouldersHit } from "../nexus/head-shoulders-pattern";
import type { NexusDecision } from "../nexus/decision-layer";
import { formatEtaRange, formatEtaDuration } from "../nexus/eta-engine";
// Research-driven precision order: VWAP, the institutional-standard
// intraday reference level this system was missing entirely (confirmed
// via a full-codebase grep before writing nexus/vwap.ts).
import { computeSessionVwapSeries } from "../nexus/vwap";
import { computeVwapBands } from "../nexus/vwap-bands";
// Diretriz Camada de Decisão Profissional, item 1 ("linha de EMA real
// marcada automaticamente no gráfico") — ver cabeçalho de nexus/ema.ts
// para a auditoria completa (WASM já calcula EMA, mas só o valor escalar
// final; uma série com um ponto por candle é uma implementação nova
// legítima, mesma fórmula/semente do motor WASM).
import { computeEmaSeries, DEFAULT_EMA_PERIOD } from "../nexus/ema";
// Consolidação Final §26-§29: Nexus Line (linha proprietária de equilíbrio,
// nexus-line.ts) — série computada do MESMO array real de candles (zero
// segunda fonte), estados visuais aplicados via a MESMA histerese
// compartilhada calculada no App (vwap-state.ts).
import { computeNexusLineSeries } from "../nexus/nexus-line";
import type { DirectionalLineState } from "../nexus/vwap-state";
// Ordem "Ciborgue Vivo" §1: BOS/CHOCH real (bos-choch-engine.js via
// engine-bridge.ts's computeBosChoch) — mesmo tipo que StructureBreakMarkersPlugin usa.
import type { StructureBreak, LiquidationEvent, CandlePattern } from "../engine-bridge";
import type { TrapSignal } from "../nexus/trap-detection";
import { clusterSweptPrices } from "../nexus/trap-detection";
// Auditoria do painel do gráfico: "canais de tendência", gap real já
// documentado em rodadas anteriores — ver cabeçalho de
// nexus/trend-channel-engine.ts para a definição real (Linear Regression
// Channel) e a pesquisa que a confirmou.
import { computeTrendChannel, TREND_CHANNEL_DEFAULT_WINDOW, TREND_CHANNEL_STDDEV_MULTIPLIER, type TrendChannelDirection } from "../nexus/trend-channel-engine";
import { shouldCompactLabels } from "./label-compaction";
import { formatTickMark, chartLocale } from "./tick-mark-format";
import { formatZoneMemberList } from "../nexus/zone-member-codes";
import { computeSuperTrend } from "../engine-bridge";
import { splitSuperTrendSeries } from "./supertrend-series";
// Setas de entrada/saída (pedido do Operador: "com as setinhas indicando a
// entrada e saída"). Auditoria confirmou ZERO marcadores em todo o
// repositório antes desta rodada — as etiquetas EN/ST/TP respondem "a que
// PREÇO", nunca "em QUAL MOMENTO".
import { buildPlanMarkers, type PlanMarkerSource } from "./plan-markers";
import { formatPrice, nativePriceDecimals } from "../nexus/price-format";
import type { ChartProfileLaneId } from "./chart-profile-lanes";
import { PriceLabelStackPlugin, type PriceAxisLabel } from "./PriceLabelStackPlugin";

export interface EnhancedChartCandle {
  time: number; // Unix segundos real (Bus/Binance) — nunca sintetizado
  open: number;
  high: number;
  low: number;
  close: number;
  // V-MAX Fase 1.3: já sempre real em App.tsx's chartData (nunca opcional
  // -fabricado) — declarado aqui como opcional só para não quebrar algum
  // outro chamador de teste que ainda monta um EnhancedChartCandle à mão
  // sem volume; o cálculo real de VWAP abaixo trata ausência como 0 velas
  // válidas (fail-closed), nunca uma média fabricada.
  volume?: number;
}

// V-MAX Fase 0.7: ganha `index` (posição real no array de candles onde a
// zona se formou) — necessário para o LiquidityZonesPlugin desenhar a
// borda esquerda real da área colorida; PriceZone (engine-bridge.ts) já
// carrega esse campo, então nenhum dado novo precisa ser calculado.
export interface EnhancedChartZone {
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  index: number;
}

// Achado ao corrigir o defeito da linha âmbar: este tipo carregava só
// price/touches — nem o índice do último toque, que o motor sempre teve.
// Sem índice não existe "trecho", e a única primitiva possível era a price
// line de largura total. Aditivo e fail-closed: os campos novos são
// opcionais, e sem eles a camada simplesmente não desenha (nunca volta a
// atravessar o gráfico).
export interface EnhancedChartLiquidity {
  type: "EQUAL_HIGH" | "EQUAL_LOW";
  price: number;
  touches: number;
  index?: number;
  firstIndex?: number;
  touchIndices?: number[];
}

export interface LevelStrength {
  label: "FORTE" | "FRACA";
  touches: number;
}

// V-MAX Fase 1 (superfície visual): nível de retração real da Matriz de
// Confluência (Fase 1.4) — price+ratio+score reais, passados pelo
// ChartWidget a partir da store (mesmo padrão das zonas SMC).
export interface EnhancedChartFibLevel {
  ratio: number;
  price: number;
  score: number;
}

// Camadas do Gráfico (Finding M, FASE Ω Priority 3 — painel novo aditivo,
// mesmo padrão do Workspace Manager em App.tsx, mas para os overlays do
// CANVAS do gráfico em vez dos widgets do layout). Lista canônica única:
// App.tsx importa este tipo/array para desenhar o painel de toggles, nunca
// redefine os ids à parte. Esconder uma camada DESMONTA o plugin (JSX
// condicional abaixo) em vez de só passar chart=null — um plugin de canvas
// dirty-flag só redesenha quando algo real muda; passar chart=null congela
// o último frame real já pintado (nunca mais limpo), não o esconde. Todas
// ligadas por padrão — o painel nunca esconde nada sem uma ação explícita
// do Operador.
// Auditoria de pendências (achado real: os 7 ids abaixo não tinham NENHUM
// controle de visibilidade — grep confirmou zero "applyOptions({ visible"
// para VWAP/NL/CVD/Fibonacci/Premium-Discount/harmônico/EQH-EQL, ao
// contrário dos 8 ids originais acima): cada um já era uma série/price
// line real (nenhum cálculo novo), só nunca tinha ganhado o mesmo
// interruptor que liquidity_zones/structure_breaks/etc já têm.
export const CHART_LAYER_IDS = [
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
  "liquidation_heatmap",
  // EPC OMEGA FINAL, Etapa 10 (Novas Camadas Institucionais): sweep real
  // (trap-detection.ts, antes sem marca própria — a zona EQH/EQL varrida
  // só sumia da tela) + sessão institucional real (market-session.ts,
  // antes só texto no header).
  "liquidity_sweep",
  "market_sessions",
  // Pedido do Operador ("ferramentas mais precisas"): ICT Kill Zone é um
  // conceito DIFERENTE de sessão de mercado (kill-zones.ts, cabeçalho) —
  // janela estreita/institucional dentro de cada sessão, nunca uma
  // partição contínua das 24h. Mesmo badge já distinto no header
  // (§6.48) — camada própria aqui, nunca dobrada dentro de
  // market_sessions.
  "kill_zones",
  // Pedido do Operador ("Key Levels"): máxima/mínima de cada sessão real
  // como nível horizontal — reaproveita a MESMA partição de market_
  // sessions (computeSessionKeyLevels em market-session.ts), conceito
  // adicional (nível de PREÇO, não de tempo), então camada própria.
  "session_key_levels",
  // DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO §4 ("Consolidação de zonas"):
  // quando EMA/VWAP/Nexus Line/FVG/Order Block/EQH/EQL concordam numa
  // mesma faixa de preço real AGORA (computeInstitutionalZones, nexus/
  // institutional-zones.ts), uma faixa única — nunca substitui o desenho
  // individual de cada ferramenta, só soma o destaque de confluência.
  "institutional_zones",
  // Entrega 40 (Order Book Depth Overlay, gap real nomeado desde a
  // Entrega 35 §4): livro de ofertas REAL (mesmo orderBook que
  // OrderBookWidget já desenha como ladder) como camada de gráfico —
  // barras ancoradas ao preço real de cada nível, nunca um segundo fetch.
  "order_book_depth",
  // Entrega 41 (TPO / Market Profile, gap real nomeado desde a auditoria
  // v16.0 ULTRA §12.2/12.3): perfil TPO real da sessão corrente — POC,
  // Value Area e Initial Balance por CONTAGEM de período (Steidlmayer/
  // CBOT), derivado só de OHLC de candle já carregado, zero fetch novo.
  "tpo_profile",
  // Entrega 47 (pedido direto do Operador): graduação do ZigZag do
  // Laboratório de Evolução (research/engines/zigzag-engine.js, isolado e
  // testado desde a Entrega 35) — pivôs confirmados por deviation%+depth.
  "zigzag",
  // GRADUAÇÃO de supertrend-engine.js (SuperTrend de Olivier Seban): um
  // TRAILING STOP que trilha o preço e trava — conceito que nenhuma camada
  // existente cobria. regime-engine classifica REGIME (ADX/DI),
  // trend-channel ajusta um canal de REGRESSÃO; nenhum dos dois produz um
  // stop que segue o preço e não volta atrás. Camada própria por isso.
  // LEI 24: display only, como VWAP/EMA/Trend Channel.
  "supertrend",
  // Achado 2.5 (Visual Cleanup & Rendering Audit — auditoria pedida
  // diretamente pelo Operador: "tirar os excessos de linha"): o Motor de
  // Cenários (SCENARIO A/B, "Future Path Map", scenario-engine.ts) era a
  // ÚNICA anotação real do gráfico sem NENHUM controle — nem toggle
  // manual, nem regra de relevância automática (grep confirmou zero
  // menção de scenario/cenário em CHART_LAYER_IDS/layer-relevance.ts
  // antes desta rodada) — desenhava sempre que a leitura existisse, sem
  // poder ser desligada nem competir por espaço em modo AUTO como
  // qualquer outra camada. Mesma classe de gap já corrigida antes para
  // VWAP/NL/CVD/Fibonacci/Premium-Discount/harmônico/EQH-EQL (comentário
  // acima).
  "scenario_projection",
  // Padrões de vela japoneses (research/engines/candlestick-patterns.js,
  // graduado na entrega anterior). Pedido direto do Operador: "no gráfico
  // tem que refletir os padrão das vela". O motor já existia e alimentava
  // as peças publicáveis — o GRÁFICO, que é onde ele pediu, era o gap.
  "candle_patterns",
  // Auditoria do ecossistema de indicadores (pedido direto do Operador:
  // "qual ferramenta que está faltando" — pivot-points-engine.js, único gap
  // real não-redundante encontrado). PP/R1-3/S1-3 clássicos do candle
  // diário anterior fechado. Camada própria: fonte diferente (candle
  // diário fixo, não swing fractal) de S1/R1.
  "pivot_points",
  // Ichimoku Kinko Hyo (Hosoda) — última ferramenta clássica ausente da
  // auditoria do ecossistema que sobreviveu ao julgamento de redundância.
  // Camada própria: nenhuma outra projeta nível PARA FRENTE no tempo nem
  // mede equilíbrio por ponto médio de extremos.
  "ichimoku",
  // Divergência de Delta (preço × CVD). Camada própria e não um caso de
  // structure_breaks: aquela lê a ESTRUTURA de preço (BOS/CHOCH); esta
  // compara duas séries independentes (preço e fluxo líquido) e só existe
  // enquanto o CVD retido cobrir velas reais suficientes.
  "delta_divergence",
] as const;
export type ChartLayerId = (typeof CHART_LAYER_IDS)[number];
export type ChartLayerVisibility = Record<ChartLayerId, boolean>;
export const DEFAULT_CHART_LAYER_VISIBILITY: ChartLayerVisibility = {
  liquidity_zones: true,
  structure_breaks: true,
  order_flow_heatmap: true,
  volume_profile: true,
  trade_plan_zone: true,
  neural_market_aura: true,
  ema: true,
  trend_channel: true,
  vwap: true,
  nexus_line: true,
  cvd: true,
  fibonacci: true,
  premium_discount: true,
  harmonics: true,
  equal_highs_lows: true,
  liquidation_heatmap: true,
  liquidity_sweep: true,
  market_sessions: true,
  kill_zones: true,
  session_key_levels: true,
  institutional_zones: true,
  order_book_depth: true,
  tpo_profile: true,
  zigzag: true,
  supertrend: true,
  scenario_projection: true,
  candle_patterns: true,
  pivot_points: true,
  ichimoku: true,
  delta_divergence: true,
};
// NÚCLEO GRAVITACIONAL AUTÔNOMO §1: mesma forma de ChartLayerVisibility
// (Record<ChartLayerId, boolean>), reaproveitada como um flag PARALELO —
// true = camada em modo automático (Relevance Engine decide), false =
// override manual (chartLayerVisibility[id] vale). Default: tudo
// automático, o comportamento novo pedido pela diretiva.
export const DEFAULT_CHART_LAYER_AUTO_MODE: ChartLayerVisibility = {
  liquidity_zones: true,
  structure_breaks: true,
  order_flow_heatmap: true,
  volume_profile: true,
  trade_plan_zone: true,
  neural_market_aura: true,
  ema: true,
  trend_channel: true,
  vwap: true,
  nexus_line: true,
  cvd: true,
  fibonacci: true,
  premium_discount: true,
  harmonics: true,
  equal_highs_lows: true,
  liquidation_heatmap: true,
  liquidity_sweep: true,
  market_sessions: true,
  kill_zones: true,
  session_key_levels: true,
  institutional_zones: true,
  order_book_depth: true,
  tpo_profile: true,
  zigzag: true,
  supertrend: true,
  scenario_projection: true,
  candle_patterns: true,
  pivot_points: true,
  ichimoku: true,
  delta_divergence: true,
};

interface EnhancedChartProps {
  data: EnhancedChartCandle[];
  support?: number | null;
  resistance?: number | null;
  supportStrength?: LevelStrength | null;
  resistanceStrength?: LevelStrength | null;
  supportBreakouts?: number;
  resistanceBreakouts?: number;
  // Auditoria do ecossistema de indicadores (pedido direto do Operador:
  // "qual ferramenta que está faltando"): Pivot Points clássicos (Floor
  // Trader), PP/R1-3/S1-3 do candle diário anterior fechado — ver
  // pivot-points-engine.js. Optional/fail-closed: null/ausente desenha
  // nada, igual a todo outro overlay opcional deste componente.
  pivotPoints?: {
    status: "OK" | "DADOS_INSUFICIENTES";
    pp: number | null;
    r1: number | null; r2: number | null; r3: number | null;
    s1: number | null; s2: number | null; s3: number | null;
  } | null;
  fairValueGaps?: EnhancedChartZone[];
  orderBlocks?: EnhancedChartZone[];
  // Pedido do Operador ("ver o que está faltando... pra ele chegar na
  // perfeição"): Liquidity Void (liquidity-void-engine.js) — mesmo shape
  // real de fairValueGaps/orderBlocks, repassado direto ao
  // LiquidityZonesPlugin como um 3º kind ("VOID") de zona preenchida.
  liquidityVoids?: EnhancedChartZone[];
  // GRADUAÇÃO de institutional-blocks.js — Breaker / Mitigation Block.
  // Mesmo shape real EnhancedChartZone: `type` é a direção OPERACIONAL já
  // resolvida pelo motor (o Breaker INVERTE a polaridade do OB original),
  // nunca a polaridade original. Repassado direto ao LiquidityZonesPlugin
  // como dois kinds novos — zero canvas novo, zero arquitetura nova.
  // Planos JÁ REGISTRADOS pelo Track Record (ativo + histórico). Cada seta
  // é um evento real que aconteceu, nunca uma previsão — ver plan-markers.ts.
  planMarkers?: PlanMarkerSource[];
  breakerBlocks?: EnhancedChartZone[];
  mitigationBlocks?: EnhancedChartZone[];
  liquidityZones?: EnhancedChartLiquidity[];
  // Diretriz Restauração/Inteligência Visual §6 ("risco visual... obstáculo
  // estrutural"): quais dessas MESMAS zonas (por low/high real) o Trade
  // Plan ATIVO cruza a caminho de algum alvo — repassado direto ao
  // LiquidityZonesPlugin, que já desenha fairValueGaps/orderBlocks acima;
  // isto só pede ênfase visual nas que importam. Optional/fail-closed:
  // ausente/vazio => desenho idêntico ao de sempre.
  obstacleZones?: { low: number; high: number }[];
  // Ordem "Ciborgue Vivo" §1: rompimento de estrutura real mais recente
  // (BOS/CHOCH). null = nenhum rompimento na amostra, honesto — nunca desenha um palpite.
  structureBreak?: StructureBreak | null;
  // Padrões de vela reais já detectados (engine-bridge computeCandlePatterns).
  // Opcional/fail-closed: ausente/vazio => camada simplesmente não desenha.
  candlePatterns?: CandlePattern[];
  // Evolução Total (fix documentado na Ordem Nº 03 §3): swing high/low
  // fractais mais recentes do ciclo real (analysis-frame.js →
  // engine-bridge.ts) — alimentam APENAS o consolidador de Zonas
  // Institucionais como 11ª fonte pontual; nenhum desenho próprio novo.
  lastSwingHigh?: number | null;
  lastSwingLow?: number | null;
  fibonacciLevels?: EnhancedChartFibLevel[] | null;
  // Correção de latência: o último preço REAL do ticker WS (mesma fonte da
  // barra superior, já na store desde o primeiro tick) e o timeframe ativo
  // — só para o patch cirúrgico da vela em formação abaixo. Opcionais: sem
  // eles o gráfico funciona exatamente como antes (fail-closed, nunca
  // quebra um chamador que ainda não os passa).
  livePrice?: number | null;
  activeTimeframe?: Timeframe;
  // Trade Plan (real structure only): entry zone / stop / target drawn as
  // silk-thread price lines with English labels. Optional and fail-closed:
  // null/absent draws nothing.
  tradePlan?: TradePlan | null;
  // EPC §5/§6 ("Nunca simplesmente esconder essas informações"): quando
  // tradePlan é null, o motivo REAL (mesmo texto/lógica da barra de
  // comando, App.tsx: tradePlanAbsenceReason) — nunca um silêncio que o
  // Operador não consegue distinguir de um bug. null/absent (tradePlan
  // ativo, ou chamador que ainda não passa esta prop) não desenha nada.
  tradePlanAbsenceReason?: string | null;
  // EPC §5/§6 (continuação — relato direto do Operador: "falta aparecer
  // entrada e alvo/alvo2/alvo3 no gráfico"): quando o Trade Plan do
  // Conselho está ausente mas o Core Engine (LEI 24) já tem direção real
  // própria, o STOP/TARGET1/TARGET2 que o Target Tracker (target-
  // tracker.js) já computa a cada ciclo — dado real, só nunca antes
  // desenhado. ENTRY fica de fora de propósito (é o preço vivo, já
  // desenhado nativamente pelo eixo). null/absent (Trade Plan do Conselho
  // presente, Núcleo neutro, ou chamador que ainda não passa esta prop)
  // não desenha nada — nunca substitui o Trade Plan do Conselho quando
  // ele existe.
  engineFallbackLevels?: {
    direction: "LONG" | "SHORT";
    stop: number;
    target1: number;
    target1Strength: { label: "FORTE" | "FRACA"; touches: number } | null;
    // EPC MODO ELITE §4: contagem REAL de obstáculos estruturais no caminho
    // até cada alvo (obstacleZonesInPath, App.tsx) — o Núcleo não tem painel
    // próprio, então o rótulo do gráfico é o único lugar dessa contagem.
    target1ObstacleCount?: number | null;
    target2: number | null;
    target2Strength: { label: "FORTE" | "FRACA"; touches: number } | null;
    target2ObstacleCount?: number | null;
    // Achado de auditoria (Ferramentas Institucionais): extensão de
    // Fibonacci 61.8% sobre a última perna confirmada
    // (support-resistance-engine.js) — mais simples que target1/target2 de
    // propósito: nenhuma força/obstáculo é computada para este nível na
    // fonte, então TP3 é preço puro, sem os mesmos metadados.
    target3?: number | null;
    riskRewardRatio: number | null;
  } | null;
  // Neural Market Aura: visual translation of the SAME real Trade Plan +
  // Signal Track Record + Confluence Engine reading above — never a second
  // trading signal (LEI 24). null/DADOS_INSUFICIENTES draws nothing.
  aura?: AuraReading | null;
  // v2 (Diretriz Complementar §2/§4): how many of tradePlan.targets the
  // AUTHORITATIVE track record (signal-track-record.ts) has actually
  // proven so far — drives the per-target "REACHED" boost and the
  // break-even stop redraw below. Optional/fail-closed: absent => 0, the
  // same as "no real progress yet" (never a fabricated hit).
  targetsHit?: number;
  // Diretriz Complementar §17 ("Projeção Visual Inteligente"): a MESMA
  // Zona de Confiança Institucional já real (§16, institutional-score.ts)
  // — a zona de entrada abaixo lê mais ou menos nítida conforme esta
  // confluência real. Optional/fail-closed: absent/null => peso neutro
  // default (ver TradePlanZonePlugin).
  confidenceZone?: InstitutionalConfidenceZone | null;
  // Camadas do Gráfico (Finding M): per-plugin visibility toggle from the
  // new settings panel. Optional and fail-closed: absent/undefined means
  // every layer stays visible (DEFAULT_CHART_LAYER_VISIBILITY), the exact
  // behavior this component already had before the toggle existed.
  layerVisibility?: ChartLayerVisibility;
  // Diretriz Camada de Decisão Profissional, item 1: período real da EMA
  // exibida, controlado pelo painel Camadas do Gráfico. Optional/fail-
  // closed: ausente => DEFAULT_EMA_PERIOD (21), o mesmo comportamento de
  // sempre para qualquer chamador que ainda não passa esta prop.
  emaPeriod?: number;
  // Auditoria de arquitetura (revisão completa) — paginação histórica
  // real: chamado quando o usuário arrasta perto da borda esquerda dos
  // candles já carregados (ver efeito de subscribeVisibleLogicalRangeChange
  // abaixo). Optional/fail-closed: sem esta prop, o gráfico continua
  // exatamente como antes — janela fixa, sem paginação. App.tsx decide
  // como buscar/mesclar a página nova; este componente só detecta a
  // intenção real do usuário.
  onRequestOlderCandles?: () => void;
  // Auditoria do ecossistema de indicadores: ATR% real do tempo gráfico
  // (regime-engine.js via engine.marketRegime), repassado ao ZigZagPlugin
  // pra escalar o limiar de reversão pelo período — mesmo cálculo que a
  // perna do Fibonacci já usa (engine-bridge.ts, atrScaledZigZagDeviationPct).
  // Optional/fail-closed: null/ausente cai no default clássico do próprio
  // motor (5%), nunca um número fabricado.
  chartAtrPercent?: number | null;
  // §6 "Smart Projection Engine" (Diretriz Complementar): achado real de
  // auditoria — o Motor de Cenários (scenario-engine.ts) já existia,
  // já é 100% honesto (basis: "COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY",
  // alvos = níveis reais já mapeados por outros motores, peso = massa de
  // opinião real do Conselho), e já estava na store — só nunca tinha sido
  // desenhado no gráfico (só texto em widgets). Isto é o que fecha a
  // lacuna real sem fabricar nenhuma "probabilidade estatística" nova, o
  // risco que bloqueou este item por várias sessões. Optional/fail-closed:
  // null/absent desenha nada, igual a tradePlan/aura acima.
  scenario?: ScenarioProjection | null;
  // Refinamento Final §7: dealing range Premium/EQ/Discount real
  // (premium-discount.ts) — 3 linhas fio-de-seda discretas. Fail-closed.
  premiumDiscount?: PremiumDiscountReading | null;
  // Auditoria Final §3: harmônicos RENDERIZADOS — a linha do ponto D do
  // melhor padrão real (fit desc) + EPA quando Wolfe. Fail-closed.
  harmonicHits?: HarmonicPatternHit[] | null;
  // Carta Branca (Reconhecimento de Padrões): as 2 famílias novas que
  // competem com harmonicHits[0] pelo MESMO desenho de "único melhor
  // padrão" — ver o useEffect unificado abaixo. Cada motor já devolve o
  // único melhor hit da janela (não uma lista). Fail-closed.
  trianglePattern?: TrianglePatternHit | null;
  headShouldersPattern?: HeadShouldersHit | null;
  // Auditoria Final §3/§4: a leitura fundida — usada AQUI só para
  // enriquecer os títulos das linhas de alvo com ETA em faixa (a
  // distância % vem do livePrice real). Geometria continua vindo de
  // tradePlan — decision.plan deriva do MESMO objeto, zero divergência.
  decision?: NexusDecision | null;
  // Consolidação Final §22/§29: estado visual das duas linhas de equilíbrio
  // (VWAP e Nexus Line). Calculado no App com a histerese compartilhada
  // (vwap-state.ts) porque precisa de preço vivo + ATR + estado anterior —
  // o gráfico só APLICA cor/etiqueta (a matemática da VWAP fica intocada,
  // §20). Optional/fail-closed: ausente => NEUTRAL (visual de sempre).
  vwapState?: DirectionalLineState | null;
  nexusLineState?: DirectionalLineState | null;
  // OMEGA CORE V-MAX Fase 8.1 ("heatmap real de liquidação"): eventos JÁ
  // reais do feed exchange-wide (App.tsx, startRealLiquidationFeed) +
  // símbolo ativo — LiquidationHeatmapPlugin filtra/bucketiza, este
  // componente nunca recalcula nada. Optional/fail-closed: ausente =>
  // nenhuma barra desenhada, igual a qualquer outra camada opcional acima.
  liquidations?: LiquidationEvent[];
  // EPC OMEGA FINAL, Etapa 10 ("Liquidity Sweep: captura/direção/
  // absorção"): mesmos TrapSignal[] já reais (trap-detection.ts, via
  // useTrapSignalsSnapshot) que os widgets de texto já mostravam — o
  // canvas nunca tinha ganhado sua própria marca no preço exato do sweep.
  // Optional/fail-closed: ausente => nenhuma price line de sweep.
  traps?: TrapSignal[];
  symbol?: string | null;
  // Achado real da AUDITORIA TÉCNICA COMPLETA (item B16): zero
  // subscribeCrosshairMove em todo o código — o header (OhlcReadout,
  // App.tsx) sempre mostrava o ÚLTIMO candle, nunca o candle sob o
  // cursor/dedo. Chamado com o candle real (mesmo objeto de `data`, zero
  // segundo fetch) sob o crosshair, ou null quando o cursor sai da área
  // do gráfico. Optional/fail-closed: ausente => nenhuma assinatura nova,
  // comportamento idêntico a antes desta entrega.
  onHoverCandleChange?: (candle: EnhancedChartCandle | null) => void;
}

// Continuidade §6 (hierarquia visual dos alvos) — Diretriz de Evolução
// Profissional Fase 10 item P: a lógica em si (limiar + decisão de
// compactar) agora vive em label-compaction.ts como função pura testável
// por execução real; este arquivo só importa e usa (Regra de Ouro 4:
// realocar, nunca duplicar).

// §22: paleta institucional de estado + seta discreta. A NL usa a mesma
// paleta com opacidade menor — §29 "nunca competir visualmente com a VWAP".
const LINE_STATE_GLYPH: Record<DirectionalLineState, string> = { BULLISH: "↑", BEARISH: "↓", NEUTRAL: "•" };
// Achado real do Operador ("nome Grandão, um monte de letra... mais
// padrão, mais profissional"): a palavra "ASCENDING"/"DESCENDING" no
// rótulo do Trend Channel destoava do resto do eixo (VWAP/NL já usam
// glifo, nunca a palavra) — mesmo princípio de LINE_STATE_GLYPH acima,
// tipo diferente (TrendChannelDirection tem 3 valores próprios, nunca
// os mesmos de DirectionalLineState). Zero informação perdida: o glifo
// É a mesma direção real, só mais compacto.
const TREND_DIRECTION_GLYPH: Record<TrendChannelDirection, string> = { ASCENDING: "↑", DESCENDING: "↓", FLAT: "→" };
const VWAP_STATE_COLOR: Record<DirectionalLineState, string> = {
  BULLISH: "rgba(8, 153, 129, 0.75)",
  BEARISH: "rgba(242, 54, 69, 0.75)",
  NEUTRAL: "rgba(255, 231, 190, 0.50)", // branco-dourado (§22 Neutra)
};
const NL_STATE_COLOR: Record<DirectionalLineState, string> = {
  BULLISH: "rgba(8, 153, 129, 0.50)",
  BEARISH: "rgba(242, 54, 69, 0.50)",
  NEUTRAL: "rgba(255, 209, 130, 0.45)",
};
// Especificação Visual Profissional v1 (pedido direto do Operador):
// "número inteiro quando possível, decimal só quando necessário" nos
// labels compactos do eixo (V/NL/E{period}). Mesmo limiar já real e
// independentemente convergido em App.tsx (fmtPrice, v.toFixed(v>=1000?0:2))
// — reaproveitado aqui em vez de inventado, aplicado igual aos 3 labels
// (o mockup do documento mostrava decimais só em 1 dos 3 exemplos, mesma
// grandeza — inconsistência de mock-up, não uma regra real; uma única
// regra consistente serve melhor o próprio objetivo do pedido, "mais
// profissional"). Só o TEXTO do label muda — o preço real usado pra
// posicionar a linha/conector nunca perde precisão.
function fmtAxisLabelPrice(v: number): string {
  // Delega à fonte única (nexus/price-format.ts). O corte de ".00" que
  // esta função fazia continua — vira o parâmetro `stripRoundZeros`. O que
  // muda é só ABAIXO de 1, onde as 2 casas fixas escondiam o dígito que o
  // Operador precisa ler (0,0654 aparecia como "0.07").
  return formatPrice(v, true);
}

// Auditoria de arquitetura (revisão completa) — paginação histórica real:
// detecta se `next` é EXATAMENTE `prev` com N candles novos prependados na
// frente (mesmo sufixo, mesma ordem, comparado por `time` — App.tsx sempre
// cria arrays novos, nunca a mesma referência). É o ÚNICO caso em que o
// gráfico precisa deslocar a faixa visível manualmente (ver efeito de
// `data` abaixo) para não "pular" para trás quando o usuário está parado
// perto da borda esquerda logo após uma página antiga chegar. Retorna 0
// para qualquer outro tipo de atualização real (troca de timeframe,
// refresh periódico do topo, primeira carga) — nesses casos o
// comportamento padrão de setData() já preserva pan/zoom corretamente
// (comentário original do efeito abaixo), nenhum deslocamento é
// necessário ou seguro.
export function detectPrependCount(
  prev: EnhancedChartCandle[] | null | undefined,
  next: EnhancedChartCandle[] | null | undefined,
): number {
  if (!prev || !next || prev.length === 0 || next.length <= prev.length) return 0;
  const count = next.length - prev.length;
  for (let i = 0; i < prev.length; i++) {
    if (next[count + i]?.time !== prev[i]?.time) return 0;
  }
  return count;
}

// resolveChartUltraWideScale agora vive em chart-ultrawide-scale.ts
// (achado real, task #341: PriceLabelStackPlugin precisava importar a
// MESMA função, e importar direto daqui criaria um ciclo real — este
// arquivo já importa PriceLabelStackPlugin). Reexportado abaixo (import)
// só para manter os pontos de uso existentes neste arquivo idênticos.

// Mesmo formato de texto que o gráfico antigo já usava para S1/R1 — só a
// primitiva que desenha muda (createPriceLine em vez de <span> em pixel
// fixo), a informação real (força/retest/rompimentos) continua idêntica.
function levelTitle(base: string, strength: LevelStrength | null | undefined, breakouts: number | undefined): string {
  if (!strength) return base;
  return `${base} ${strength.label} ${strength.touches}x/${breakouts ?? 0}x`;
}

// Achado real (Visual Cleanup & Rendering Audit): grep confirmou S1/R1
// como o único par de linhas do gráfico com ZERO integração em
// layer-relevance.ts/visual-budget.ts — desenhava sempre no mesmo alpha
// fixo (0.65), FORTE ou FRACA, sem nenhuma competição visual com o resto
// do painel. supportStrength/resistanceStrength (LevelStrength.touches,
// support-resistance-engine.js) já é o sinal real de força do nível —
// mesmo formato de confluenceWeight() (InstitutionalZonePlugin.tsx):
// clamp entre piso/teto de toques reais, normaliza para 0..1. Piso=1
// (o próprio nível sempre bate em si mesmo — nunca 0 toques reais);
// teto=4, mesma ordem de grandeza do CONFLUENCE_CEIL_SOURCES de zonas
// institucionais. Zero fabricação: nenhum toque novo é contado aqui, só
// reusa strength.touches já computado.
export const S1R1_TOUCH_FLOOR = 1;
export const S1R1_TOUCH_CEIL = 4;

// Exportada (mesmo padrão de detectPrependCount acima): lógica pura de
// fronteira ganha teste de execução real, não só padrão no código-fonte
// (CLAUDE.md).
export function levelStrengthBaseWeight(strength: LevelStrength | null | undefined): number {
  // Força ainda não computada (fail-closed): peso pleno, nunca penaliza
  // um nível real por ausência do cálculo de força, mesmo espírito de
  // "sem dado real suficiente não fabrica uma leitura pior" (Regra de
  // Ouro 3).
  if (!strength) return 1;
  const span = S1R1_TOUCH_CEIL - S1R1_TOUCH_FLOOR;
  const clamped = Math.max(S1R1_TOUCH_FLOOR, Math.min(S1R1_TOUCH_CEIL, strength.touches));
  return span > 0 ? (clamped - S1R1_TOUCH_FLOOR) / span : 1;
}

// Banda real de alpha para S1/R1 — nunca o baseWeight/visualWeight
// aplicado direto como alpha (o mesmo cuidado já documentado em
// InstitutionalZonePlugin.tsx via FILL_ALPHA_MIN/BORDER_ALPHA_MIN):
// Regra de Ouro 4 proíbe um nível real cair a alpha 0 só por perder a
// competição de orçamento visual. Teto = o MESMO 0.65 fixo que S1/R1
// sempre usou antes desta rodada — um nível FORTE sem nenhuma
// competição real fica visualmente IDÊNTICO ao comportamento anterior;
// só níveis fracos/espremidos pelo orçamento ficam mais discretos.
export const S1R1_ALPHA_MIN = 0.35;
export const S1R1_ALPHA_MAX = 0.65;

// Exportada pelo mesmo motivo de levelStrengthBaseWeight acima.
export function levelLineAlpha(visualWeight: number | null): number {
  // Orçamento visual ainda não resolveu este nível (não deveria ocorrer
  // depois da fiação abaixo) — preserva o valor fixo de sempre, nunca
  // fabrica um número novo.
  if (visualWeight === null) return S1R1_ALPHA_MAX;
  const clamped = Math.max(0, Math.min(1, visualWeight));
  return S1R1_ALPHA_MIN + clamped * (S1R1_ALPHA_MAX - S1R1_ALPHA_MIN);
}

// ---------------------------------------------------------------------------
// Achado 2.7 (Visual Cleanup & Rendering Audit, 5ª rodada) — pedido direto do
// Operador: "a Fibonacci tem de ficar diferenciada pra gente saber qual as
// linha dela, como que ela está sendo analisada pro visual".
//
// Estado real antes desta rodada: as 5 linhas (FIB_RETRACEMENT_RATIOS =
// 0.236/0.382/0.5/0.618/0.786, nexus/fibonacci-confluence.ts) desenhavam com
// EXATAMENTE 2 aparências possíveis — alpha 0.55 se `score > 0`, alpha 0.20
// se não. O ratio em si (o que a Fibonacci de fato analisa) não entrava na
// aparência em nenhum ponto. Consequência real e verificável: um 23.6% com
// 1 fonte de confluência aparecia MAIS forte que um 61.8% sem nenhuma — uma
// inversão de leitura, já que a razão áurea é justamente o nível que o
// Operador precisa achar primeiro. E Fibonacci era, junto com o Motor de
// Cenários (Achado 2.5), uma das camadas que nunca competiam por
// nexus/visual-budget.ts — desenhava sempre no mesmo peso independente de
// quantos outros objetos reais disputassem o mesmo espaço.
//
// Peso estrutural por ratio: NÃO é uma probabilidade nem uma taxa de acerto
// (Regra de Ouro 2 — este repositório não tem backtest real que sustentasse
// isso). É só a hierarquia de LEITURA já padrão da ferramenta: 61.8% (a razão
// áurea que dá nome ao método) e 50% (o ponto médio da perna, herdado da Teoria
// de Dow, incluído na lista por convenção e não por Fibonacci) são os níveis de
// decisão; 38.2% (o complemento de 61.8%) é o secundário; 23.6% e 78.6% são as
// bordas rasa/profunda. Fail-closed: qualquer ratio fora da tabela cai no peso
// mais baixo — nunca infla um nível desconhecido.
export const FIB_PRIMARY_RATIOS = [0.5, 0.618] as const;
export const FIB_SECONDARY_STRUCTURAL_WEIGHT = 0.6;
export const FIB_SHALLOW_STRUCTURAL_WEIGHT = 0.3;

export function fibRatioStructuralWeight(ratio: number): number {
  if (!Number.isFinite(ratio)) return FIB_SHALLOW_STRUCTURAL_WEIGHT;
  if ((FIB_PRIMARY_RATIOS as readonly number[]).includes(ratio)) return 1;
  if (ratio === 0.382) return FIB_SECONDARY_STRUCTURAL_WEIGHT;
  return FIB_SHALLOW_STRUCTURAL_WEIGHT;
}

/** Fatia do peso final que vem do papel estrutural do próprio ratio; o
 *  restante vem da confluência REAL já medida (`score`, contagem de fontes
 *  que concordam com aquele preço — nexus/fibonacci-confluence.ts). Os dois
 *  sinais são reais e independentes, então ambos entram: o ratio diz "qual
 *  nível esta ferramenta considera decisivo", o score diz "quantas OUTRAS
 *  ferramentas concordam com este preço". Nenhum dos dois sozinho responde
 *  a pergunta do Operador. */
export const FIB_STRUCTURAL_SHARE = 0.7;
/** Mesmo teto de contagem de fontes já usado por confluenceWeight()/
 *  CONFLUENCE_CEIL_SOURCES nas zonas institucionais — zero segunda escala. */
export const FIB_CONFLUENCE_CEIL = 3;

export function fibRatioBaseWeight(ratio: number, score: number): number {
  const structural = fibRatioStructuralWeight(ratio);
  const rawScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  const confluence = Math.min(1, rawScore / FIB_CONFLUENCE_CEIL);
  const blended = structural * FIB_STRUCTURAL_SHARE + confluence * (1 - FIB_STRUCTURAL_SHARE);
  return Math.max(0, Math.min(1, blended));
}

// Banda real de alpha da Fibonacci. Os DOIS extremos são exatamente os 2
// valores fixos que a camada já usava antes desta rodada (0.20 e 0.55) — o
// que muda é que entre eles agora existe um gradiente real em vez de um
// degrau binário. Ver fibLineAlpha abaixo: a normalização é feita a partir
// do PISO do orçamento visual (VISUAL_BUDGET_FLOOR_WEIGHT), não de 0, para
// que o nível mais fraco possível caia em 0.20 cravado — o mesmo valor de
// sempre. Sem isso o piso de 0.35 do orçamento empurraria o nível mais fraco
// para ~0.32, deixando a camada MAIS carregada que antes, o oposto do pedido.
export const FIB_ALPHA_MIN = 0.2;
export const FIB_ALPHA_MAX = 0.55;

export function fibLineAlpha(visualWeight: number | null): number {
  if (visualWeight === null) return FIB_ALPHA_MAX;
  const clamped = Math.max(VISUAL_BUDGET_FLOOR_WEIGHT, Math.min(1, visualWeight));
  const span = 1 - VISUAL_BUDGET_FLOOR_WEIGHT;
  const t = span > 0 ? (clamped - VISUAL_BUDGET_FLOOR_WEIGHT) / span : 1;
  return FIB_ALPHA_MIN + t * (FIB_ALPHA_MAX - FIB_ALPHA_MIN);
}

/** Um nível primário (razão áurea/ponto médio) sempre merece o número
 *  visível no eixo — é exatamente "qual linha é a da Fibonacci e o que ela
 *  está analisando". Os rasos só ganham etiqueta quando têm confluência
 *  real, o mesmo gate honesto de antes (score 0 é comum e nunca é
 *  fabricado). O teto/anti-colisão do eixo continua sendo quem decide
 *  quantas de fato cabem, por proximidade real ao preço vivo
 *  (chart/price-label-stack.ts) — este predicado só diz quem COMPETE. */
export function fibDeservesAxisLabel(ratio: number, score: number): boolean {
  return (FIB_PRIMARY_RATIOS as readonly number[]).includes(ratio) || score > 0;
}

// MEMOIZADO — achado medido (o Operador relatou "está muito pesado"):
//
// App.tsx é UM componente de ~12.000 linhas, e o livro de ofertas atualiza
// a 5×/s (ORDER_BOOK_THROTTLE_MS = 200). Sem memo, cada um desses ticks
// re-reconciliava este componente inteiro — o mais pesado do app, com 16
// plugins de canvas como filhos — cinco vezes por segundo, mesmo quando
// nenhuma prop que ele lê tinha mudado.
//
// Medição que autorizou a mudança: das 40 props do call site, ZERO cria
// array ou objeto novo inline — todas são primitivos ou identificadores
// estáveis (fatias da store, useMemo, setState). É exatamente a condição
// em que a comparação rasa do memo funciona: num tick de livro que não
// muda nada do gráfico, ele passa e o subárvore inteira é pulada.
//
// Só a implementação vira privada; o nome exportado continua idêntico
// (chamadores e testes não mudam).
function EnhancedChart_110_PercentImpl({
  data,
  support,
  resistance,
  supportStrength,
  resistanceStrength,
  supportBreakouts,
  resistanceBreakouts,
  pivotPoints,
  fairValueGaps,
  orderBlocks,
  liquidityVoids,
  planMarkers,
  breakerBlocks,
  mitigationBlocks,
  liquidityZones,
  obstacleZones,
  structureBreak,
  candlePatterns,
  lastSwingHigh,
  lastSwingLow,
  fibonacciLevels,
  livePrice,
  activeTimeframe,
  tradePlan,
  tradePlanAbsenceReason,
  engineFallbackLevels,
  aura,
  targetsHit,
  confidenceZone,
  scenario,
  premiumDiscount,
  harmonicHits,
  trianglePattern,
  headShouldersPattern,
  decision,
  vwapState,
  nexusLineState,
  liquidations,
  traps,
  symbol,
  layerVisibility,
  emaPeriod,
  onRequestOlderCandles,
  onHoverCandleChange,
  chartAtrPercent,
}: EnhancedChartProps) {
  const visibility = layerVisibility ?? DEFAULT_CHART_LAYER_VISIBILITY;
  // Quais lanes de perfil estão REALMENTE na tela agora.
  //
  // Achado de captura real (ZEC 15m/1H/4H, reclamação direta do Operador:
  // "o livro de liquidez institucional fica atrapalhando... encavalado por
  // cima da outra"): a geometria das lanes era ESTÁTICA — cada plugin
  // reservava espaço para as outras duas mesmo quando elas estavam
  // ocultas. Com VP e TPO fora, a lane do livro ainda começava a 30% da
  // borda e desenhava no meio das velas, com o espaço reservado à direita
  // dela VAZIO. Passar o conjunto ativo faz uma lane sozinha encostar no
  // eixo, como sempre deveria ter feito.
  const activeProfileLanes = useMemo<ChartProfileLaneId[]>(() => {
    const out: ChartProfileLaneId[] = [];
    if (visibility.volume_profile) out.push("volume_profile");
    if (visibility.tpo_profile) out.push("tpo_profile");
    if (visibility.order_book_depth) out.push("order_book_depth");
    return out;
  }, [visibility.volume_profile, visibility.tpo_profile, visibility.order_book_depth]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // PRECISÃO DO EIXO DE PREÇO — defeito visto em captura real (WLFI/USDT 1H,
  // ativo a ~0,06).
  //
  // A lightweight-charts assume `priceFormat: { precision: 2, minMove: 0.01 }`
  // quando ninguém configura — e ninguém configurava. Resultado na tela: TODO
  // nível entre 0,055 e 0,061 virava "0.06". O eixo inteiro, o rótulo do
  // crosshair e o do último preço mostravam o mesmo número para preços
  // diferentes, enquanto o painel ao lado exibia SUPPORT 0.05598 e
  // RESISTÊNCIA 0.061 corretamente — a régua adaptativa (nexus/price-format.ts)
  // já tinha chegado nos painéis, mas o eixo NATIVO não passa por ela.
  //
  // A precisão vem da MAGNITUDE real da série, pela mesma função que os
  // painéis usam (priceDecimals) — zero segunda régua. Recalculada quando a
  // série muda: trocar de ativo troca a magnitude, e a precisão tem de
  // acompanhar.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !data || data.length === 0) return;
    // Último close real como referência de magnitude — é o preço que o
    // Operador está lendo agora. Fail-closed: sem close finito, não mexe
    // (mantém o que a lib já tinha, nunca fabrica precisão).
    const last = data[data.length - 1];
    const ref = typeof last?.close === "number" && Number.isFinite(last.close) ? last.close : null;
    if (ref === null) return;
    const precision = nativePriceDecimals(ref);
    series.applyOptions({
      priceFormat: { type: "price", precision, minMove: Math.pow(10, -precision) },
    });
  }, [data]);
  // Evolução Final §5 ("Enquadramento Automático" / Smart Auto-Fit): lido
  // pelo autoscaleInfoProvider da série principal abaixo. Precisa ser ref
  // (não estado/prop direto) porque a série nasce no efeito de montagem
  // única (deps `[]`, ver createChart abaixo) — o callback não pode fechar
  // sobre tradePlan/engineFallbackLevels/livePrice mudando a cada render.
  // Mantido sincronizado por um efeito leve próprio (ver perto do efeito de
  // price lines do Trade Plan, abaixo). Vazio = autoscale nativo da lib,
  // sem nenhuma mudança de comportamento (fail-closed: sem plano ativo,
  // zero intervenção).
  const autoFitLevelsRef = useRef<AutoFitLevels>({
    entryLow: null,
    entryHigh: null,
    stopPrice: null,
    targetPrices: [],
    livePrice: null,
  });
  const supportLineRef = useRef<IPriceLine | null>(null);
  const resistanceLineRef = useRef<IPriceLine | null>(null);
  const zoneLinesRef = useRef<IPriceLine[]>([]);
  // Auditoria do ecossistema de indicadores: 7 linhas reais (PP+R1-3+S1-3),
  // ref PRÓPRIA em array — mesmo padrão de zoneLinesRef acima, ciclo de
  // limpeza/redesenho independente de S1/R1 (fontes diferentes: candle
  // diário fechado vs. swing fractal).
  const pivotLinesRef = useRef<IPriceLine[]>([]);
  // EPC OMEGA FINAL, Etapa 10: price lines do sweep real (TrapSignal.
  // sweptPrices) — ref PRÓPRIA, nunca reusa zoneLinesRef (ciclos de
  // limpeza/redesenho independentes, mesma separação que support/
  // resistance já têm entre si).
  const sweepLinesRef = useRef<IPriceLine[]>([]);
  const fibLinesRef = useRef<IPriceLine[]>([]);
  const tradePlanLinesRef = useRef<IPriceLine[]>([]);
  // EPC §5/§6 (continuação): linhas do fallback do Core Engine
  // (engineFallbackLevels) — refs PRÓPRIAS, nunca reaproveita
  // tradePlanLinesRef/stopLineRef/targetLinesArrayRef acima. Os dois
  // efeitos nunca desenham ao mesmo tempo na prática (engineFallbackLevels
  // já vem null de App.tsx quando tradePlan existe), mas manter refs
  // separadas evita acoplar dois efeitos independentes por um cleanup
  // compartilhado.
  const engineFallbackLinesRef = useRef<IPriceLine[]>([]);
  const scenarioLinesRef = useRef<IPriceLine[]>([]);
  const premiumDiscountLinesRef = useRef<IPriceLine[]>([]);
  const harmonicLinesRef = useRef<IPriceLine[]>([]);
  // Continuidade (pendência honesta já documentada em 3 PRs anteriores:
  // "polilinha XABCD/Wolfe no canvas — hoje só a linha do ponto D"): a
  // FIGURA GEOMÉTRICA COMPLETA do melhor padrão real, não só a PRZ. Série
  // NATIVA (mesmo padrão de EMA/Nexus Line/Trend Channel) — X/A/B/C/D já
  // vêm em ordem temporal por construção do próprio motor (cada ponto é um
  // swing fractal mais recente que o anterior), então uma LineSeries comum
  // com esses pontos plotados em ordem de tempo desenha exatamente o
  // zigue-zague clássico, zero overlay de canvas novo.
  const harmonicPolylineRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Carta Branca (Reconhecimento de Padrões): mesmo padrão nativo acima,
  // reaproveitado para as 2 famílias novas que competem pelo MESMO desenho
  // de "único melhor padrão" (ver o useEffect unificado abaixo). O
  // outline zigue-zague do Ombro-Cabeça-Ombro (LS→neckline1→Head→
  // neckline2→RS) é geometricamente idêntico a um XABCD — reusa
  // harmonicPolylineRef diretamente, zero série nova. O Triângulo NÃO é um
  // zigue-zague (2 retas paralelas/convergentes avançando no MESMO
  // intervalo de tempo, não pontos sequenciais) — precisa de 2 séries
  // dedicadas; a extrapolação da neckline do H&S também é uma reta
  // separada do outline (index do 1º ponto → índice do último candle),
  // então ganha sua própria série.
  const triangleResistanceLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const triangleSupportLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const necklineExtensionLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Named refs to the stop/target lines specifically (a subset of
  // tradePlanLinesRef above) — lets the hit-boost effect below update
  // color/title in place via applyOptions() instead of tearing down and
  // recreating all trade-plan lines on every live-price tick (which would
  // churn the chart at WebSocket cadence for what is only a color change).
  const stopLineRef = useRef<IPriceLine | null>(null);
  // v2 (Diretriz Complementar §2): até MAX_TARGETS linhas reais, uma por
  // plan.targets[i] — nunca uma única linha fixa como no contrato v1.
  const targetLinesArrayRef = useRef<IPriceLine[]>([]);
  const cvdSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Research-driven precision order: VWAP as a native line series on the
  // SAME price scale as the candles (unlike cvdSeriesRef, which needs its
  // own scale because CVD is signed volume, not price) — it overlays
  // directly at the correct real price level.
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Pedido do Operador ("ferramentas mais precisas"): VWAP Standard
  // Deviation Bands — pesquisa real confirmada (TradingView/Sierra Chart/
  // TrendSpider/MultiCharts documentam a MESMA fórmula, ver
  // nexus/vwap-bands.ts). 4 séries nativas (upper1/lower1/upper2/lower2),
  // mesma convenção do Trend Channel logo abaixo (banda = leitura única
  // por opacidade, nunca 4 rótulos concorrentes na borda de preço).
  // Nasce/some junto do toggle VWAP existente — nunca uma 19ª camada:
  // as bandas são a MESMA ferramenta, não um conceito novo e separado.
  const vwapBandUpper1Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapBandLower1Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapBandUpper2Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapBandLower2Ref = useRef<ISeriesApi<"Line"> | null>(null);
  // Diretriz Camada de Decisão Profissional, item 1: EMA na MESMA escala
  // de preço das velas (é um preço médio real, como VWAP) — cor própria,
  // nunca reaproveitando a paleta semântica (verde/vermelho=direção,
  // âmbar=zona de entrada, roxo=liquidez EQH/EQL).
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  // GRADUAÇÃO de supertrend-engine.js. DUAS séries nativas, não uma: a
  // lightweight-charts não colore segmentos diferentes de uma mesma
  // LineSeries. Uma série desenha os trechos de tendência de ALTA e a
  // outra os de BAIXA, cada uma com buracos (whitespace) onde a outra
  // manda — é assim que a linha muda de cor no ponto exato do flip sem
  // perder um único candle de história.
  const planMarkersRef = useRef<ReturnType<typeof createSeriesMarkers> | null>(null);
  const supertrendUpRef = useRef<ISeriesApi<"Line"> | null>(null);
  const supertrendDownRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Consolidação Final §26-§29: Nexus Line na MESMA escala de preço (é um
  // nível de equilíbrio real, como VWAP/EMA) — nunca uma segunda escala.
  const nexusLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Auditoria do painel do gráfico: Linear Regression Channel real (mesma
  // escala de preço das velas) — 3 séries nativas (mid/upper/lower), cor
  // única em tons de opacidade (convenção padrão da indústria para este
  // indicador: um canal é UMA leitura, não três linhas concorrentes).
  // lastValueVisible/priceLineVisible desligados nas três (ver useEffect
  // de criação abaixo): o valor se lê pela POSIÇÃO do canal no gráfico,
  // nunca por mais três rótulos empilhados na borda de preço já disputada
  // por CHOCH/VWAP/NL/EMA — clareza visual (Regra de Ouro/"gráfico limpo")
  // antes de qualquer indicador novo.
  const trendChannelMidRef = useRef<ISeriesApi<"Line"> | null>(null);
  const trendChannelUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const trendChannelLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Espelha chartRef/seriesRef em state só para o LiquidityZonesPlugin
  // montar assim que o chart existe de verdade — refs sozinhas não
  // disparam re-render, então o plugin ficaria esperando por uma
  // atualização de `data` não relacionada para "descobrir" o chart pronto.
  const [chartReady, setChartReady] = useState<{ chart: IChartApi; series: ISeriesApi<"Candlestick"> } | null>(null);
  // Diretriz Restauração/Inteligência Visual (achado real de auditoria):
  // "Achados da captura real do Operador" (commit anterior) apagou o title
  // das 3 séries do Trend Channel porque a lib desenha title no EIXO mesmo
  // com lastValueVisible:false — remoção válida (eixo nativo poluído), mas
  // a identidade do canal ficou sem NENHUM destino visual, violando "se a
  // informação antiga era útil, reabilitar de forma mais profissional".
  // Diretriz de Refinamento Visual §5 (revisão desta leitura): um <div>
  // solto no canto superior não é "tratar o Trend Channel como camada do
  // eixo de preço" — a identidade volta para a lateral via
  // priceAxisLabels/PriceLabelStackPlugin abaixo, o MESMO sistema
  // anti-colisão de R1/NL/VWAP/EMA/S1 (nunca o title/last-value-label
  // NATIVO da lib, que é a fonte real da poluição original). midPrice é o
  // preço real ancorado (ponta da linha mid) que alimenta esse rótulo.
  const [trendChannelInfo, setTrendChannelInfo] = useState<{ direction: TrendChannelDirection; windowSize: number; midPrice: number } | null>(null);
  // Achado real de captura de tela do Operador (BTC/USDT 1H, preço
  // formando perto de R1): os "last value label"/"axis label" NATIVOS de
  // VWAP/NL/EMA/S1/R1/último preço não têm nenhuma consciência uns dos
  // outros — quando os preços reais ficam próximos, colidem/empilham.
  // Estes 3 valores (a PONTA real de cada série já computada nos efeitos
  // abaixo — zero cálculo novo) alimentam PriceLabelStackPlugin, que
  // resolve a posição vertical de TODOS os rótulos de uma vez (ver
  // price-label-stack.ts) — os "last value label"/"axis label" nativos
  // são desligados logo abaixo (lastValueVisible/axisLabelVisible:false)
  // e substituídos por esse overlay.
  const [vwapLastValue, setVwapLastValue] = useState<number | null>(null);
  const [nlLastValue, setNlLastValue] = useState<number | null>(null);
  const [emaLastValue, setEmaLastValue] = useState<number | null>(null);

  // Cria o chart UMA vez por montagem — nunca recriado por troca de
  // timeframe/dado (isso destruiria o estado de pan/zoom do operador a
  // cada atualização, exatamente o "reload"/"reinicializar o gráfico" que
  // a diretriz proíbe). autoSize:true usa o ResizeObserver interno da
  // própria lib — sem media query manual, sem listener de resize próprio.
  useEffect(() => {
    if (!containerRef.current) return;
    const initialScale = resolveChartUltraWideScale(window.innerWidth);
    const chart = createChart(containerRef.current, {
      layout: {
        // AR10_ESPECIFICACAO_VISUAL_PIXEL_PERFECT.md (documento do
        // Operador, confirmado via AskUserQuestion — "Convergir para o
        // visual TradingView/NinjaTrader"): continua "transparent", não o
        // #0B0E14 sólido do documento — body{background-color:#000000}
        // (index.css) já é opaco e idêntico pixel a pixel atrás do canvas;
        // trocar pra #0B0E14 introduziria uma costura visível contra o
        // "fundo preto puro" do v16.0 PRO (convergir pro visual
        // profissional é ZERO costura, não uma cor isolada nova — os
        // próprios TradingView/NinjaTrader não têm essa costura).
        background: { type: ColorType.Solid, color: "transparent" },
        // Reverte DELIBERADAMENTE a Especificação Técnica v1.0 §A.4.5/
        // §A.4.6 (9px #888888, citada abaixo no histórico) — decisão mais
        // recente e explícita do Operador, registrada aqui para nunca
        // parecer uma regressão silenciosa. fontFamily continua monospace:
        // o documento pede 'Inter'/sans-serif, mas isso é identidade
        // tipográfica do terminal inteiro (login/header/todo o resto),
        // fora do escopo confirmado ("fonte maior", nunca "trocar a
        // família") — trocar exigiria uma decisão própria, não incluída
        // aqui.
        textColor: "#787B86",
        fontFamily: "ui-monospace, monospace",
        fontSize: initialScale.fontSize,
        // Auditoria do painel do gráfico (achado real): a lib desenha por
        // padrão o logo "powered by TradingView" sobre o próprio canvas —
        // destoa do terminal proprietário AR10 CYBORG. A licença Apache-2.0
        // permite desligar ("attributionLogo: false") DESDE QUE o link real
        // para tradingview.com continue visível em outro lugar da tela —
        // ver FooterBar em App.tsx, que agora carrega essa obrigação real
        // (nunca uma remoção silenciosa da atribuição exigida).
        attributionLogo: false,
      },
      // AR10_ESPECIFICACAO_VISUAL_PIXEL_PERFECT.md §4 (confirmado pelo
      // Operador): reverte DELIBERADAMENTE o grid "quase invisível" da
      // Especificação Técnica v1.0 §A.4.2 (rgba(255,255,255,0.02/0.03) —
      // histórico preservado no commit anterior) por valores mais visíveis
      // porém ainda sutis (cor+opacidade exatas da coluna "AR10 Meta" do
      // documento) — mesma ressalva de decisão-mais-recente do bloco
      // acima.
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.3)" },
        horzLines: { color: "rgba(42, 46, 57, 0.4)" },
      },
      // Diretriz Mestra §2 ("Magnetismo OHLC / Snap em candles"): Magnet
      // gruda o crosshair no valor da série (o close do candle) — snap
      // real da própria lightweight-charts, zero implementação paralela.
      // AR10_ESPECIFICACAO_VISUAL_PIXEL_PERFECT.md §7: antes só `mode`
      // estava configurado (lib usava seus próprios defaults pra linha/
      // cor/rótulo) — vertLine/horzLine explícitos com cor real da coluna
      // "AR10 Meta" e labelBackgroundColor (campo real de
      // CrosshairLineOptions, confirmado contra os typings da lib antes de
      // usar). DESVIO deliberado do documento: ele pede um estilo
      // tracejado pro crosshair — recusado (nome do enum evitado de
      // propósito neste comentário: um grep textual simples pela lib
      // inteira contra qualquer estilo não-sólido, ver testes, não
      // distingue código de comentário). Regra de Ouro 5 do CLAUDE.md
      // ("Fio de Seda": toda linha é 1px sólida, "zero exceção") é regra
      // não-negociável do repositório, testada no arquivo inteiro
      // (v16-institutional-command-center.test.ts: "TODAS as price lines
      // são sólidas... nunca pontilhadas/tracejadas") — a confirmação do
      // Operador foi sobre convergir visualmente, nunca sobre abrir uma
      // exceção explícita a essa regra específica (nunca perguntada). Um
      // crosshair SÓLIDO ainda é uma melhoria real sobre o default mínimo
      // de antes (só `mode`).
      // Pedido direto do Operador: "aquela linha que a gente coisa com o
      // mouse, ela também tem que ficar bem levezinha".
      //
      // A largura já era 1 (o mínimo real da lib — Fio de Seda, Regra de
      // Ouro 5), então a única alavanca restante era a PRESENÇA da cor:
      // `#758696` opaco é um cinza-azulado claro sobre um fundo quase
      // preto, e a linha do cursor competia com as próprias velas. Mesmo
      // matiz, agora translúcida — continua achável na hora de medir um
      // nível, e para de disputar atenção com o dado.
      //
      // Os RÓTULOS do crosshair (eixo de preço/tempo) mantêm o fundo opaco
      // de propósito: é neles que se lê o número, e um rótulo translúcido
      // sobre velas seria ilegível — leveza na linha, nunca no número.
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: CROSSHAIR_LINE_COLOR, width: 1, style: LineStyle.Solid, labelBackgroundColor: "#131722" },
        horzLine: { color: CROSSHAIR_LINE_COLOR, width: 1, style: LineStyle.Solid, labelBackgroundColor: "#131722" },
      },
      // AR10_ESPECIFICACAO_VISUAL_PIXEL_PERFECT.md §5 (Regra de Ouro 5 do
      // documento: escala nunca colapsa pra menos que 65px, mesmo com
      // preço de 6 dígitos) + §1 (respiro real no topo/base do range
      // visível): minimumWidth/scaleMargins nunca tinham valor explícito
      // aqui antes (dependiam só do default da lib: minimumWidth 0,
      // scaleMargins {top:0.2,bottom:0.1} — uma lacuna real, não uma
      // reversão de nada). borderColor "#2B2B43" é literalmente o próprio
      // default da lib E o valor pedido pelo documento — mesma coisa.
      rightPriceScale: {
        borderColor: "#2B2B43",
        minimumWidth: initialScale.minimumWidth,
        scaleMargins: { top: 0.15, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "#2B2B43",
        timeVisible: true,
        secondsVisible: false,
        // Diretriz Mestra §2 ("Scroll para projeções futuras"): respiro à
        // direita da última vela — as price lines de plano/cenário/P-D
        // continuam legíveis na região futura; o operador pode arrastar
        // mais além (fixRightEdge segue no padrão false da lib). Intocado
        // por AR10_ESPECIFICACAO_VISUAL_PIXEL_PERFECT.md: o "48px" do
        // documento mede pixels; rightOffset mede LARGURAS DE BARRA (a
        // própria unidade da lib) — grandezas diferentes, e este valor já
        // tem razão própria documentada, não é uma lacuna real.
        rightOffset: initialScale.rightOffset,
        // Achado real da auditoria "AUDITORIA VISUAL CIRÚRGICA" (P14): sem
        // formatter próprio, a lib cai no formato padrão do locale — em
        // pt-BR isso inclui abreviação com ponto solto ("ago.") na virada
        // de mês, inconsistente com o resto da régua (só dígitos). Time é
        // um union real da lib (UTCTimestamp | BusinessDay | string, ver
        // typings.d.ts) — isUTCTimestamp() é o guard real que a própria
        // lib exporta, nunca um cast ingênuo pra number. Este app só
        // alimenta UTCTimestamp numérico (candles reais, sempre em
        // segundos); o `return null` no ramo BusinessDay/string nunca
        // executa na prática, mas devolve ao formato padrão da lib em vez
        // de fabricar uma data — fail-closed honesto pro tipo que o
        // contrato real da lib ainda exige tratar.
        // O segundo parâmetro (granularidade da marca) era descartado, e
        // por isso um gráfico de 30m mostrava "16 AGO" quatro vezes
        // seguidas: quatro HORÁRIOS do mesmo dia, com a hora jogada fora
        // (defeito visto em captura real do Operador, ZEC/USDT 30m). Agora
        // ele é honrado — a lógica vive em tick-mark-format.ts, onde dá
        // para testar; aqui só resta o guard de tipo da lib.
        tickMarkFormatter: (time, tickMarkType, locale) => {
          if (!isUTCTimestamp(time)) return null;
          return formatTickMark(time, tickMarkType, locale);
        },
      },
      // Defeito encontrado ao RODAR a verificação visual com Playwright (não
      // em revisão de código): o navegador do ambiente reporta o locale
      // POSIX `en-US@posix`, e `Intl` rejeita essa forma com RangeError. O
      // stack real mostrou que quem lançava era o formatador PADRÃO da
      // própria lightweight-charts — e a exceção acontece DENTRO do ciclo de
      // pintura, então ela abortava a pintura inteira: a captura saiu com
      // ZERO velas na tela, e o sintoma ("as velas sumiram") não apontaria
      // para o locale em lugar nenhum.
      //
      // Sanear só dentro do nosso `tickMarkFormatter` não bastaria: ele
      // devolve `null` no ramo BusinessDay/string, o que entrega o controle
      // de volta ao formatador padrão que lança, e a lib usa o mesmo locale
      // no rótulo de tempo do crosshair, fora do nosso formatter. Validar
      // aqui protege a lib inteira de uma vez. Ver chartLocale().
      localization: { locale: chartLocale() },
      // Diretriz explícita do Sprint 1: pan/zoom real e nativo — nunca
      // hand-rolled. handleScroll cobre arrastar (mouse + touch);
      // handleScale cobre roda do mouse + pinça (iPad).
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      // AR10_ESPECIFICACAO_VISUAL_PIXEL_PERFECT.md §8.1 (confirmado pelo
      // Operador): paleta de candle da coluna "AR10 Meta" — reverte
      // deliberadamente o verde/magenta neon (#089981/#f23645) usado em
      // muitos outros componentes deste app fora do gráfico (badges,
      // MiniStat etc.) — essa reconciliação mais ampla fica de fora do
      // escopo (documento é especificação do GRÁFICO, não um reskin do
      // app inteiro).
      upColor: "#089981",
      downColor: "#F23645",
      borderVisible: false,
      wickUpColor: "#089981",
      wickDownColor: "#F23645",
      priceLineVisible: true,
      // Achado real de captura de tela do Operador (BTC/USDT 1H): o
      // "last value label" nativo (antes lastValueVisible:true) colidia
      // com R1/VWAP/NL quando os preços reais ficam próximos — a lib não
      // tem nenhuma consciência cross-série da posição de cada rótulo.
      // Desligado aqui, substituído por PriceLabelStackPlugin (ver JSX
      // abaixo), que resolve a posição de TODOS os rótulos de uma vez
      // (price-label-stack.ts) e nunca perde a informação — só reorganiza
      // quando preciso. A LINHA horizontal de referência (priceLineVisible
      // acima) continua exatamente igual, só o rótulo/tag muda de dono.
      lastValueVisible: false,
      // Achado real via verificação com harness Playwright (V-MAX Fase
      // 0.7): sem este campo, a lib desenha essa linha automática de
      // último preço tracejada por padrão — quebra silenciosa da Regra de
      // Ouro 2 (Fio de Seda) que nenhum grep no código-fonte pegaria,
      // porque a causa é uma OMISSÃO, não um valor errado escrito aqui.
      priceLineStyle: LineStyle.Solid,
      // Evolução Final §5 ("Enquadramento Automático"): estica o autoscale
      // NATIVO da lib (baseImplementation — o mesmo fit-nos-candles-
      // visíveis de sempre) só o suficiente para caber Entry/Stop/Target do
      // plano ATIVO (autoFitLevelsRef, mantido por efeito próprio abaixo).
      // MESMO núcleo puro do mini-gráfico de exportação
      // (nexus/price-range-fit.ts) — zero segunda fórmula. Sem plano ativo
      // (ref vazia): devolve a faixa nativa sem tocar em nada (fail-closed).
      // paddingRatio fica em 0 aqui de propósito — o scaleMargins nativo da
      // rightPriceScale (default da lib) já cuida do respiro visual; somar
      // os dois dobraria o padding.
      autoscaleInfoProvider: ((baseImplementation: () => ReturnType<AutoscaleInfoProvider>) => {
        const base = baseImplementation();
        if (!base || !base.priceRange) return base;
        const levels = autoFitLevelsRef.current;
        const hasActivePlan =
          isFiniteNum(levels.entryLow) ||
          isFiniteNum(levels.entryHigh) ||
          isFiniteNum(levels.stopPrice) ||
          levels.targetPrices.length > 0;
        if (!hasActivePlan) return base;
        const fitted = computeAutoFitPriceRange(
          { min: base.priceRange.minValue, max: base.priceRange.maxValue },
          levels,
        );
        return {
          priceRange: { minValue: fitted.min, maxValue: fitted.max },
          margins: base.margins,
        };
      }) as AutoscaleInfoProvider,
    });
    // V-MAX Fase 1 (fechamento do §3.1): linha de CVD como série NATIVA em
    // escala de preço PRÓPRIA ('cvd', overlay) — CVD é volume assinado, não
    // preço; partilhar a escala das velas o achataria em ruído. Banda
    // inferior (20%) via scaleMargins. Fio de seda: lineWidth 1, sólida.
    // Cor neutra da família de texto (#8ab4f8) — o SINAL do CVD já é
    // exibido com cor semântica no Order Flow widget; aqui a informação é
    // a FORMA da série (fluxo acumulado), não um veredito colorido.
    const cvdSeries = chart.addSeries(LineSeries, {
      priceScaleId: "cvd",
      color: "rgba(138, 180, 248, 0.85)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    chart.priceScale("cvd").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    cvdSeriesRef.current = cvdSeries;
    // Research-driven precision order: VWAP on the MAIN price scale (no
    // priceScaleId override — it shares the candles' own axis, unlike
    // CVD, since it IS a real price). Neutral off-white, low opacity: a
    // pure reference level, deliberately not competing with the
    // directional/semantic palette (green=bullish, red=bearish, amber=
    // entry) used everywhere else on this chart. Fio de seda: lineWidth
    // 1, solid.
    const vwapSeries = chart.addSeries(LineSeries, {
      color: "rgba(255, 255, 255, 0.45)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      // Achado real de captura de tela (ver comentário na criação da
      // série de candles acima): rótulo nativo desligado, substituído
      // por PriceLabelStackPlugin — nunca mais colide com R1/NL/preço.
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      // Achado real via harness Playwright (Diretriz de Refinamento Visual
      // §5/§6): title:"" aqui — MESMO achado/MESMA correção do Trend
      // Channel abaixo (a lib desenha `title` no eixo mesmo com
      // lastValueVisible:false). O efeito de estado logo adiante
      // (applyOptions ao mudar vwapState) também para de tocar em title —
      // a identidade "VWAP" já vem inteira do priceAxisLabels/
      // PriceLabelStackPlugin, nunca duplicada por um título nativo solto
      // na posição NATURAL (sem resolução de colisão) da série.
      title: "",
    });
    vwapSeriesRef.current = vwapSeries;
    // Bandas de desvio-padrão: mesma cor-base neutra da VWAP (branco), só
    // mais translúcida — reaproveita o "papel" já existente de VWAP em vez
    // de introduzir mais uma cor no gráfico (achado real da auditoria de
    // consolidação de cores: 9 eixos semânticos já reaproveitam a mesma
    // paleta, uma banda derivada da própria VWAP usar o tom da própria
    // VWAP é o caso honesto, não uma colisão nova). 1σ mais visível que
    // 2σ, mesma relação de opacidade do Trend Channel mid/banda.
    const vwapBandSeriesOptions = {
      lineWidth: 1 as const,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "",
    };
    const vwapBandUpper1 = chart.addSeries(LineSeries, { ...vwapBandSeriesOptions, color: "rgba(255, 255, 255, 0.22)" });
    const vwapBandLower1 = chart.addSeries(LineSeries, { ...vwapBandSeriesOptions, color: "rgba(255, 255, 255, 0.22)" });
    const vwapBandUpper2 = chart.addSeries(LineSeries, { ...vwapBandSeriesOptions, color: "rgba(255, 255, 255, 0.10)" });
    const vwapBandLower2 = chart.addSeries(LineSeries, { ...vwapBandSeriesOptions, color: "rgba(255, 255, 255, 0.10)" });
    vwapBandUpper1Ref.current = vwapBandUpper1;
    vwapBandLower1Ref.current = vwapBandLower1;
    vwapBandUpper2Ref.current = vwapBandUpper2;
    vwapBandLower2Ref.current = vwapBandLower2;
    // Diretriz Camada de Decisão Profissional, item 1: EMA como série
    // nativa na escala principal — cor distinta, nunca competindo com a
    // paleta direcional/semântica já em uso (ver comentário no ref
    // acima). Fio de seda: lineWidth 1, sólida. Especificação Visual
    // Profissional v1: ciano #06b6d4 (era azul rgba(66,165,245,...)).
    const emaSeries = chart.addSeries(LineSeries, {
      color: "rgba(6, 85, 212, 0.85)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      // Mesmo achado/mesma correção do VWAP acima.
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "",
    });
    emaSeriesRef.current = emaSeries;

    // SuperTrend: verde/vermelho da MESMA família já usada para
    // alta/baixa em todo o gráfico (FVG/OB/sessão) — a linha diz "o stop
    // que trilha está embaixo (alta)" ou "está em cima (baixa)", que é
    // exatamente a mesma semântica de direção. Fio de Seda: 1px sólida.
    // Sem rótulo de eixo (lastValueVisible false): o eixo já está disputado
    // por VWAP/NL/EMA/CHOCH e a linha se lê pela posição.
    const supertrendUp = chart.addSeries(LineSeries, {
      color: "rgba(8, 153, 129, 0.70)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "",
    });
    const supertrendDown = chart.addSeries(LineSeries, {
      color: "rgba(242, 54, 69, 0.70)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "",
    });
    supertrendUpRef.current = supertrendUp;
    supertrendDownRef.current = supertrendDown;
    // Consolidação Final §29: Nexus Line — "extremamente fina, elegante,
    // suavizada" = fio de seda (1px sólida, obrigatório de qualquer forma)
    // em branco-dourado neutro mais discreto que a VWAP; a cor de estado
    // real é aplicada pelo efeito de vwapState/nexusLineState abaixo.
    const nexusLineSeries = chart.addSeries(LineSeries, {
      color: NL_STATE_COLOR.NEUTRAL,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      // Mesmo achado/mesma correção do VWAP acima.
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "",
    });
    nexusLineSeriesRef.current = nexusLineSeries;
    // Auditoria do painel do gráfico: Linear Regression Channel — cor
    // única (slate, tom neutro não usado por nenhum outro overlay: verde/
    // vermelho=direção, âmbar=zona de entrada, roxo=harmônicos/EQH-EQL,
    // azul-material=EMA, branco=VWAP), banda mais translúcida que o
    // centro. lastValueVisible/priceLineVisible desligados nas três — ver
    // comentário no ref acima (zero rótulo novo na borda de preço).
    // Achado real (captura do Operador, BTC 1H ao vivo): a lib desenha o
    // `title` no eixo MESMO com lastValueVisible:false — três etiquetas
    // "TREND" apareceram num eixo já disputado por R1/NL/EMA/VWAP/preço.
    // title:"" nas três: a identidade do canal é a cor/geometria slate
    // única, exatamente como o desenho original prometia.
    const trendChannelSeriesOptions = {
      lineWidth: 1 as const,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    };
    const trendChannelMid = chart.addSeries(LineSeries, {
      ...trendChannelSeriesOptions,
      color: "rgba(148, 163, 184, 0.55)",
      title: "",
    });
    const trendChannelUpper = chart.addSeries(LineSeries, {
      ...trendChannelSeriesOptions,
      color: "rgba(148, 163, 184, 0.28)",
      title: "",
    });
    const trendChannelLower = chart.addSeries(LineSeries, {
      ...trendChannelSeriesOptions,
      color: "rgba(148, 163, 184, 0.28)",
      title: "",
    });
    trendChannelMidRef.current = trendChannelMid;
    trendChannelUpperRef.current = trendChannelUpper;
    trendChannelLowerRef.current = trendChannelLower;
    // Continuidade: figura XABCD/Wolfe completa — mesma cor roxa da PRZ já
    // existente (acento do Conselho/opinião agregada), um pouco mais forte
    // no TRAÇO em si (a PRZ continua a leitura de preço mais importante).
    // Zero rótulo de eixo/último valor: a forma da polilinha já comunica o
    // padrão, um rótulo repetiria a mesma informação do title da PRZ.
    // Auditoria de pendências (achado real via harness Playwright): o
    // title:"XABCD" acima presumia que lastValueVisible:false já bastava
    // pra suprimir o rótulo — MESMO achado/MESMA correção do Trend
    // Channel/VWAP/NL/EMA (a lib desenha `title` no eixo mesmo assim). O
    // texto ficava flutuando na posição NATURAL da polilinha (sem nenhuma
    // resolução de colisão), exatamente a poluição que o comentário
    // original queria evitar. title:"" agora — zero informação perdida
    // (o próprio comentário original já argumentava que o rótulo era
    // redundante com o title da PRZ).
    const harmonicPolyline = chart.addSeries(LineSeries, {
      color: "rgba(167, 139, 250, 0.55)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "",
    });
    harmonicPolylineRef.current = harmonicPolyline;
    // Carta Branca: mesma cor de acento roxo do padrão geométrico (harmonic
    // Polyline acima) — as 3 famílias são uma ÚNICA linguagem visual
    // ("padrão gráfico detectado"), nunca 3 paletas competindo por atenção.
    const triangleLineOptions = {
      color: "rgba(167, 139, 250, 0.55)",
      lineWidth: 1 as const,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "",
    };
    triangleResistanceLineRef.current = chart.addSeries(LineSeries, triangleLineOptions);
    triangleSupportLineRef.current = chart.addSeries(LineSeries, triangleLineOptions);
    necklineExtensionLineRef.current = chart.addSeries(LineSeries, triangleLineOptions);
    chartRef.current = chart;
    seriesRef.current = series;
    setChartReady({ chart, series });
    // Ordem ULTRA LED/UltraWide/4K: os 3 valores acima (fontSize/
    // minimumWidth/rightOffset) precisam se atualizar se o Operador
    // redimensionar a janela ou mover pra outro monitor DEPOIS do mount —
    // o chart em si só é criado uma vez (comentário no topo deste
    // efeito), então essas 3 options nunca reagiriam sozinhas. Debounce
    // simples (150ms) e só chama applyOptions quando o breakpoint REAL
    // muda, nunca em todo pixel de resize.
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentScale = initialScale;
    const handleUltraWideResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const nextScale = resolveChartUltraWideScale(window.innerWidth);
        if (
          nextScale.fontSize === currentScale.fontSize &&
          nextScale.minimumWidth === currentScale.minimumWidth &&
          nextScale.rightOffset === currentScale.rightOffset
        ) {
          return;
        }
        currentScale = nextScale;
        chart.applyOptions({
          layout: { fontSize: nextScale.fontSize },
          rightPriceScale: { minimumWidth: nextScale.minimumWidth },
          timeScale: { rightOffset: nextScale.rightOffset },
        });
      }, 150);
    };
    window.addEventListener("resize", handleUltraWideResize);
    return () => {
      window.removeEventListener("resize", handleUltraWideResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      supportLineRef.current = null;
      resistanceLineRef.current = null;
      zoneLinesRef.current = [];
      sweepLinesRef.current = [];
      fibLinesRef.current = [];
      tradePlanLinesRef.current = [];
      scenarioLinesRef.current = [];
      premiumDiscountLinesRef.current = [];
      harmonicLinesRef.current = [];
      cvdSeriesRef.current = null;
      vwapSeriesRef.current = null;
      vwapBandUpper1Ref.current = null;
      vwapBandLower1Ref.current = null;
      vwapBandUpper2Ref.current = null;
      vwapBandLower2Ref.current = null;
      emaSeriesRef.current = null;
      supertrendUpRef.current = null;
      supertrendDownRef.current = null;
      planMarkersRef.current = null;
      nexusLineSeriesRef.current = null;
      trendChannelMidRef.current = null;
      trendChannelUpperRef.current = null;
      trendChannelLowerRef.current = null;
      harmonicPolylineRef.current = null;
      triangleResistanceLineRef.current = null;
      triangleSupportLineRef.current = null;
      necklineExtensionLineRef.current = null;
      setChartReady(null);
    };
  }, []);

  // Atualiza a série EXISTENTE com o candle real — nunca recria o chart.
  // Isto é o que satisfaz "transição suave entre timeframes (sem
  // recarregar tudo)": trocar chartTimeframe em App.tsx só troca o
  // conteúdo de `data`, este efeito só chama setData() na mesma série, e o
  // pan/zoom/crosshair do operador nunca são resetados por isso.
  //
  // Auditoria de arquitetura (revisão completa) — paginação histórica
  // real: a EXCEÇÃO a essa regra é um prepend real (detectPrependCount >
  // 0, ver função acima). Nesse caso específico, TODO índice de barra já
  // visível desloca (candles novos entraram na frente), então a faixa
  // visível REAL (mesma faixa em índice de tempo) teria mudado sob os pés
  // do usuário — captura a faixa antes, aplica o mesmo deslocamento
  // depois. Para qualquer outro tipo de atualização, prependedCount é 0 e
  // este bloco não faz nada — comportamento idêntico ao de sempre.
  const prevChartDataRef = useRef<EnhancedChartCandle[]>([]);
  // Zoom inteligente (pedido direto do Operador: "quando a gente mudar por
  // tempo... um zoom inteligente que fica bom na tela, pra gente não estar
  // puxando o zoom"): ao trocar timeframe/símbolo, a PRÓXIMA carga real de
  // candles enquadra automaticamente as últimas N velas, com N vindo de
  // computeViewportCandles (adaptativo à tela real — ver §5 no topo).
  // Flag pendente consumida no efeito de setData abaixo — nunca dispara em
  // tick/vela nova (o pan/zoom manual do Operador continua soberano fora
  // da troca de contexto), e nunca enquadra dado velho: só depois que os
  // candles do NOVO timeframe/símbolo realmente chegaram.
  const smartZoomPendingRef = useRef(true); // true no mount: 1º enquadre real também é automático.
  useEffect(() => {
    smartZoomPendingRef.current = true;
  }, [activeTimeframe, symbol]);
  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;
    const formatted = data
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
      .map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    const prependedCount = detectPrependCount(prevChartDataRef.current, data);
    const savedRange = prependedCount > 0 ? chartRef.current?.timeScale().getVisibleLogicalRange() ?? null : null;
    seriesRef.current.setData(formatted);
    if (smartZoomPendingRef.current && formatted.length > 0 && chartRef.current) {
      smartZoomPendingRef.current = false;
      // Ordem "FECHAMENTO" §5: janela adaptativa real (60-200) em vez da
      // constante fixa. `timeScale().width()` é a largura REAL da área de
      // plotagem (já exclui o gutter do eixo de preço) — a mesma medida
      // que decide a densidade de pixels por vela que o Operador enxerga.
      const candles = computeViewportCandles({
        widthPx: chartRef.current.timeScale().width(),
        availableCandles: formatted.length,
      });
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: Math.max(0, formatted.length - candles),
        to: formatted.length - 1 + SMART_ZOOM_RIGHT_PAD_BARS,
      });
    } else if (prependedCount > 0 && savedRange && chartRef.current) {
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: savedRange.from + prependedCount,
        to: savedRange.to + prependedCount,
      });
    }
    prevChartDataRef.current = data;
  }, [data]);

  // Ordem "Lapidação Visual Final + Nova Linguagem de Gráfico" §8/§9
  // (RECENTRALIZAR): mesmo enquadre real do "zoom inteligente" acima
  // (computeViewportCandles/SMART_ZOOM_RIGHT_PAD_BARS) — zero segunda fórmula
  // — só que disparado por toque do Operador em vez de automático na
  // troca de timeframe/símbolo. §9 ("preferir uma ação única"): uma única
  // chamada resolve as duas metades pedidas (recentralizar preço E
  // restaurar escala) porque setVisibleLogicalRange já faz as duas ao
  // mesmo tempo por construção — não existe, nesta lib, um "recentralizar
  // sem tocar no zoom" que fizesse sentido separado. Toca só o
  // timeScale() (pan/zoom); símbolo, timeframe e todo dado real
  // permanecem intocados — nunca recarrega nada.
  //
  // Ordem "FECHAMENTO DO AR10 CYBORG" §6 ("BOTÃO DE RECUPERAÇÃO VISUAL"):
  // este botão já era exatamente a ação pedida — recupera o enquadramento,
  // preserva timeframe/ativo/dados, nunca apaga histórico (só toca
  // timeScale()). O que mudou aqui foi a JANELA que ele restaura: passou a
  // ser a mesma janela adaptativa real do zoom inteligente acima
  // (computeViewportCandles), nunca uma segunda fórmula — "voltar para uma
  // visualização ótima" agora significa a mesma visualização ótima em
  // qualquer tela, não 120 velas fixas em todas.
  const recenterChart = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !data || data.length === 0) return;
    const candles = computeViewportCandles({
      widthPx: chart.timeScale().width(),
      availableCandles: data.length,
    });
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, data.length - candles),
      to: data.length - 1 + SMART_ZOOM_RIGHT_PAD_BARS,
    });
  }, [data]);

  // Correção de latência (barra superior ↔ gráfico): patch cirúrgico da
  // vela em formação a cada tick real do ticker WS, via series.update() —
  // API nativa da lib pra atualização incremental de UMA barra, nunca um
  // segundo setData(). Deliberadamente ISOLADO do efeito acima: não lê nem
  // escreve `data` como referência de re-render, só o último elemento já
  // renderizado — SMC/Fibonacci/Volume Profile (que dependem de `data` lá
  // em cima, em App.tsx) nunca recomputam por causa de um tick de preço,
  // só quando uma vela REAL nova/fechada chega do REST/kline.
  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;
    if (typeof livePrice !== "number" || !activeTimeframe) return;
    const patched = patchLastCandleWithLiveTick(data[data.length - 1], activeTimeframe, livePrice);
    if (!patched) return;
    seriesRef.current.update({ time: patched.time as UTCTimestamp, open: patched.open, high: patched.high, low: patched.low, close: patched.close });
  }, [livePrice, activeTimeframe, data]);

  // Auditoria de arquitetura (revisão completa) — paginação histórica
  // real: achado da auditoria de Chart Engine — não existia NENHUM
  // caminho para carregar mais história ao arrastar para trás (borda dura
  // assim que os candles carregados terminavam). Dispara
  // onRequestOlderCandles quando a borda ESQUERDA da faixa visível chega
  // perto do candle mais antigo já carregado — App.tsx decide como
  // buscar/mesclar/limitar a página nova (fetch real, dedupe, teto de
  // memória); este componente só detecta a intenção real do usuário (ele
  // parou de arrastar perto da borda), nunca decide o que fazer com isso.
  // EDGE_BARS é medido em barras (índice lógico), não em pixels — a mesma
  // margem funciona igual em qualquer nível de zoom. `requested` é
  // reamarrado (não um ref de módulo) a cada nova assinatura: uma vez
  // disparado, só dispara de novo depois que a faixa se afasta da borda —
  // o que acontece sozinho após um prepend bem-sucedido (a faixa é
  // deslocada pelo efeito de `data` acima), ou quando o usuário rola para
  // longe manualmente. Uma falha real (sem mais história, ou erro
  // transitório de rede) nunca entra num loop de novas tentativas.
  useEffect(() => {
    if (!chartReady || !onRequestOlderCandles) return;
    const EDGE_BARS = 20;
    let requested = false;
    const handler = (range: LogicalRange | null) => {
      if (!range || !data || data.length === 0) return;
      if (range.from > EDGE_BARS) {
        requested = false;
        return;
      }
      if (requested) return;
      requested = true;
      onRequestOlderCandles();
    };
    chartReady.chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      chartReady.chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
    };
  }, [chartReady, onRequestOlderCandles, data]);

  // Achado real da AUDITORIA TÉCNICA COMPLETA (item B16): zero
  // subscribeCrosshairMove em todo o código — o header sempre mostrava o
  // ÚLTIMO candle, nunca o candle sob o cursor/dedo. subscribeCrosshairMove
  // é API nativa da própria lightweight-charts (zero mouse-tracking
  // manual); o candle completo (O/H/L/C/V) sai do MESMO array `data` já
  // desenhado, por busca do `time` real que o evento devolve — nunca um
  // segundo fetch ou cálculo. param.time vem undefined quando o cursor sai
  // da área do gráfico (mouse leave nativo da lib): null explícito,
  // volta ao último candle real no chamador — nunca um valor congelado.
  //
  // DEFEITO DE DESEMPENHO MEDIDO AQUI (relato do Operador: "aquela linha
  // que a gente coisa com mouse tem que ficar bem levezinha... não pode ter
  // delay com a sincronização"). A versão anterior deste handler era:
  //
  //     const hovered = data.find((c) => c.time === hoveredTime);
  //     onHoverCandleChange(hovered ?? null);
  //
  // Três custos reais empilhados, todos por EVENTO de crosshair (que dispara
  // na taxa do ponteiro — dezenas por segundo no trackpad, contínuo durante
  // um arraste com o dedo no iPad):
  //
  //   1. VARREDURA LINEAR do array inteiro de candles a cada evento. Com
  //      várias centenas de candles reais, é um scan completo por movimento
  //      de um pixel.
  //   2. `onHoverCandleChange` chamado SEMPRE, mesmo quando o candle sob o
  //      cursor não mudou. Mover o mouse dentro da MESMA coluna de candle
  //      disparava um setState no App (um único componente de ~12.000
  //      linhas) a cada evento — reconciliação da árvore inteira para
  //      mostrar exatamente os mesmos números.
  //   3. `data` no array de dependências: a assinatura era desfeita e
  //      refeita a cada atualização de candle, ou seja a cada tick.
  //
  // Correções, na ordem do impacto: índice O(1) por tempo (Map construído
  // uma vez por mudança de `data`, nunca por evento); guarda de identidade
  // que só notifica quando o candle REALMENTE mudou; e a assinatura passa a
  // viver só enquanto o chart existe, lendo `data` por ref.
  //
  // Nenhuma informação se perde: o mesmo candle real, do mesmo array já
  // desenhado, chega ao mesmo consumidor. Só param as chamadas redundantes.
  const hoverDataRef = useRef<{ index: Map<number, EnhancedChartCandle>; ultimoTime: number | null }>({
    index: new Map(),
    ultimoTime: null,
  });

  useEffect(() => {
    const index = new Map<number, EnhancedChartCandle>();
    for (const c of data) index.set(c.time, c);
    hoverDataRef.current.index = index;
    // O candle sob o cursor pode ter mudado de conteúdo sem mudar de tempo
    // (o candle ao vivo recebe ticks): invalida a guarda para o próximo
    // evento reemitir com o objeto novo.
    hoverDataRef.current.ultimoTime = null;
  }, [data]);

  useEffect(() => {
    if (!chartReady || !onHoverCandleChange) return;
    const handler = (param: MouseEventParams) => {
      const estado = hoverDataRef.current;
      if (param.time === undefined) {
        if (estado.ultimoTime === null) return; // já estava fora — nada a notificar.
        estado.ultimoTime = null;
        onHoverCandleChange(null);
        return;
      }
      const hoveredTime = Number(param.time);
      if (hoveredTime === estado.ultimoTime) return; // mesmo candle: zero trabalho.
      estado.ultimoTime = hoveredTime;
      onHoverCandleChange(estado.index.get(hoveredTime) ?? null);
    };
    chartReady.chart.subscribeCrosshairMove(handler);
    return () => {
      chartReady.chart.unsubscribeCrosshairMove(handler);
    };
  }, [chartReady, onHoverCandleChange]);

  // Liquidez (Equal High/Low): NÃO desenha mais aqui.
  //
  // DEFEITO RELATADO (Operador, sobre a tela real): "aquela linha amarela —
  // antigamente elas não atravessavam o gráfico todo, ela só marcava um
  // pedaço da linha, não ficava grandona, marcava quantas vezes ela testou
  // naquela mesma zona".
  //
  // CAUSA: `createPriceLine` SEMPRE atravessa o gráfico inteiro — a lib não
  // tem parâmetro de início/fim. E o `title` que carregava a contagem
  // ("EQH x3") nunca foi renderizado no painel de velas. A informação real
  // existia no dado e morria na primitiva escolhida.
  //
  // MIGRADO para o LiquidityZonesPlugin (mesmo canvas que FVG/OB/VOID já
  // usam — zero canvas novo, zero segundo loop de rAF), onde o trecho real
  // entre o primeiro e o último toque pode ser desenhado com a contagem.
  // Mesma cor âmbar, mesmo dado, mesmo filtro !swept de sempre — só a
  // primitiva muda, exatamente como já havia acontecido com as price lines
  // top/bottom de FVG/OB na Fase 0.7.
  //
  // O ref de limpeza continua existindo e sendo esvaziado: se qualquer
  // rodada futura voltar a criar price lines aqui, elas continuam sendo
  // removidas corretamente.
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    zoneLinesRef.current.forEach((line) => series.removePriceLine(line));
    zoneLinesRef.current = [];
  }, [liquidityZones, visibility.equal_highs_lows]);

  // EPC OMEGA FINAL, Etapa 10 ("Liquidity Sweep: captura/direção/
  // absorção"): auditoria da Etapa 1 encontrou trap-detection.ts real e já
  // corroborando sweeps (STOP_HUNT_TOPO/FUNDO), mas a zona EQH/EQL varrida
  // simplesmente some do bloco acima (filtro !swept) sem deixar rastro do
  // momento do sweep — mesmo mecanismo de price line, cor âmbar própria
  // (nunca usada por EQH/EQL roxo nem OB/FVG verde/vermelho), preço real
  // de TrapSignal.sweptLevels (zero recálculo, mesmo dado que a zona já
  // tinha antes de sumir).
  //
  // v3 (achado real de captura de tela do Operador — dezenas de rótulos
  // "SWEEP" empilhados cobrindo o gráfico inteiro): `swept` em
  // LiquidityZone é uma flag PERMANENTE — sem decaimento por idade, todo
  // sweep da história inteira carregada virava um rótulo pra sempre.
  // Mesma disciplina JÁ REAL de BOS/CHOCH (annotation-decay.ts::ageAlpha
  // + BREAK_DECAY, ver useMemo de priceAxisLabels abaixo) — zero segunda
  // técnica de decaimento inventada, só um SWEEP_DECAY próprio porque o
  // Operador pediu um horizonte maior pra Sweep (~200 candles) do que
  // BOS/CHOCH já usa (100 candles — evento estrutural mais rápido de
  // ficar obsoleto). `data.length` entra nas deps porque a IDADE muda a
  // cada candle novo, não só quando `traps` muda.
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    sweepLinesRef.current.forEach((line) => series.removePriceLine(line));
    sweepLinesRef.current = [];
    if (!visibility.liquidity_sweep) return;

    // Achado real do Operador (captura de tela: "SWEEP ZONE (2x)" com 2
    // linhas separadas por trás dela): este efeito desenhava 1 price line
    // POR NÍVEL BRUTO (t.sweptLevels.forEach), enquanto priceAxisLabels
    // abaixo já deduplicava+clusterizava (seenSweepPrices + clusterSweptPrices)
    // pra desenhar 1 rótulo por cluster real — um cluster "(2x)" tinha 1
    // caixa de texto mas 2 linhas nativas quase idênticas empilhadas por
    // baixo, o mismatch real que lia como poluição/duplicação. Mesma
    // deduplicação (Set global de preço, mesmo espírito de dedup entre
    // traps distintos) + MESMO clusterSweptPrices/LIQUIDITY_PROXIMITY_PCT
    // do bloco de rótulos — zero segunda regra: 1 cluster real = 1 linha.
    const seenSweepPrices = new Set<number>();
    (traps ?? []).forEach((t) => {
      if (t.kind !== "STOP_HUNT_TOPO" && t.kind !== "STOP_HUNT_FUNDO") return;
      const uniqueLevels = t.sweptLevels.filter((l) => Number.isFinite(l.price) && !seenSweepPrices.has(l.price));
      uniqueLevels.forEach((l) => seenSweepPrices.add(l.price));
      for (const cluster of clusterSweptPrices(uniqueLevels, LIQUIDITY_PROXIMITY_PCT)) {
        const age = data.length - 1 - cluster.latestIndex;
        const alpha = ageAlpha(age, SWEEP_DECAY);
        if (alpha <= 0) continue; // expirado (>200 candles) — some da TELA, dado real intacto em trap-detection.ts.
        sweepLinesRef.current.push(
          series.createPriceLine({
            price: cluster.avgPrice,
            // Lapidação institucional: H33 laranja — era H45 (255,191,0), a
            // 2° do pico do Liquidation Heatmap (LiquidationHeatmapPlugin.tsx
            // PEAK_LABEL_COLOR). Mesma luminosidade/saturação/alpha a 2° de
            // matiz = mesma cor a olho nu. Sweep fica no lado mais laranja
            // (evento pontual já ocorrido), heatmap no lado mais amarelo
            // (pico ao vivo, recalculado a cada tick) — mesma dupla,
            // diferenciação real (ver comentário completo lá). Alpha final
            // multiplicado pelo decaimento real por idade (0.85 é o teto
            // na freshest, nunca um valor fixo).
            color: `rgba(255, 162, 0, ${(alpha * 0.85).toFixed(3)})`,
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: false,
            // Achado real do Operador ("linha amarela que eu não sei o que
            // significa") — causa raiz confirmada no código-fonte real da
            // lib (custom-price-line-price-axis-view.ts,
            // _updateRendererData): quando axisLabelVisible é false, o
            // método retorna ANTES de setar visible=true pro título — ou
            // seja, este `title` nunca foi desenhado em lugar NENHUM (nem
            // eixo, nem painel), sempre foi metadado inerte. O problema
            // real não era colisão de texto — era ausência TOTAL de rótulo
            // legível pra esta linha âmbar. O texto real agora vive em
            // priceAxisLabels (useMemo abaixo), mesmo preço/mesma cor,
            // dentro do sistema anti-colisão real — mesma migração já
            // aplicada a BOS/CHOCH, mas aqui fechando uma ausência, não uma
            // sobreposição. title vazio aqui só documenta que este campo
            // nunca teve efeito visual — remover não muda nada renderizado.
            title: "",
          }),
        );
      }
    });
  }, [traps, visibility.liquidity_sweep, data.length]);

  // V-MAX Fase 1 (fechamento do §3.1): alimenta a série de CVD com o
  // histórico REAL da store (mesmo orderflowHistory do heatmap — um dado,
  // dois consumidores, zero segunda coleta). time real em ms → segundos da
  // lib com dedupe manter-o-último por segundo (a cadência real do poller é
  // ~4s, então colisões são raras; o guarda existe porque a lib exige tempos
  // estritamente ascendentes). Histórico vazio => série vazia honesta.
  const orderflowHistory = useOrderflowHistory();
  useEffect(() => {
    if (!cvdSeriesRef.current) return;
    const bySecond = new Map<number, number>();
    for (const entry of orderflowHistory) {
      bySecond.set(Math.floor(entry.time / 1000), entry.cvd);
    }
    cvdSeriesRef.current.setData(
      [...bySecond.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, cvd]) => ({ time: t as UTCTimestamp, value: cvd })),
    );
  }, [orderflowHistory]);

  // Research-driven precision order: VWAP, computed straight from the
  // same real candle array driving the whole chart (chartData already
  // carries real per-candle volume, V-MAX Fase 1.3) — zero new fetch,
  // zero second data source. UTC-day-anchored (see nexus/vwap.ts header
  // for why); an empty result (no candle in the current UTC day, or a
  // day with zero real volume) sets an empty series — never a fabricated
  // flat line.
  useEffect(() => {
    if (!vwapSeriesRef.current) return;
    const series = computeSessionVwapSeries(data);
    vwapSeriesRef.current.setData(series.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    setVwapLastValue(series.length > 0 ? series[series.length - 1].value : null);
    // Bandas de desvio-padrão: MESMO array real, MESMO efeito que a VWAP —
    // nunca uma segunda leitura de candles, nunca a chance de a banda
    // dessincronizar da própria linha que ela envolve (mesmo raciocínio já
    // usado pela Nexus Line logo abaixo). computeVwapBands já reusa
    // computeSessionVwapSeries por dentro (nexus/vwap-bands.ts) — zero
    // segunda fórmula de VWAP.
    if (vwapBandUpper1Ref.current && vwapBandLower1Ref.current && vwapBandUpper2Ref.current && vwapBandLower2Ref.current) {
      const bands = computeVwapBands(data);
      vwapBandUpper1Ref.current.setData(bands.map((p) => ({ time: p.time as UTCTimestamp, value: p.upper1 })));
      vwapBandLower1Ref.current.setData(bands.map((p) => ({ time: p.time as UTCTimestamp, value: p.lower1 })));
      vwapBandUpper2Ref.current.setData(bands.map((p) => ({ time: p.time as UTCTimestamp, value: p.upper2 })));
      vwapBandLower2Ref.current.setData(bands.map((p) => ({ time: p.time as UTCTimestamp, value: p.lower2 })));
    }
    // Consolidação Final §26-§28: a Nexus Line nasce do MESMO array real,
    // no MESMO efeito — os dois equilíbrios nunca dessincronizam por
    // construção. Série vazia (sem range confirmado/sem VWAP) => nada.
    if (nexusLineSeriesRef.current) {
      const nl = computeNexusLineSeries(data);
      nexusLineSeriesRef.current.setData(nl.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      setNlLastValue(nl.length > 0 ? nl[nl.length - 1].value : null);
    }
  }, [data]);

  // Consolidação Final §21-§22 (VWAP) e §29 (NL): estados visuais aplicados
  // in place via applyOptions — cor institucional real (a MATEMÁTICA das
  // séries acima fica intocada, §20; a histerese, §22 "nunca trocar de
  // estado a cada candle", já aconteceu no App). Diretriz de Refinamento
  // Visual §5/§6 (achado real via harness Playwright): este efeito ANTES
  // também escrevia `title` a cada mudança de estado — reintroduzia a
  // MESMA poluição de eixo que o Trend Channel corrigiu (a lib desenha
  // title na posição NATURAL da série, sem nenhuma consciência da
  // resolução de colisão do PriceLabelStackPlugin, e por isso volta e
  // meia colidia com S1/R1/EMA vizinhos). O glifo de estado (↑/↓/•) já
  // chega ao Operador via priceAxisLabels (`VWAP ${glifo} ${valor}` /
  // `NL ${glifo} ${valor}`, useMemo abaixo) — nunca duas fontes da mesma
  // informação.
  useEffect(() => {
    if (!vwapSeriesRef.current) return;
    const s: DirectionalLineState = vwapState ?? "NEUTRAL";
    vwapSeriesRef.current.applyOptions({ color: VWAP_STATE_COLOR[s] });
  }, [vwapState]);
  useEffect(() => {
    if (!nexusLineSeriesRef.current) return;
    const s: DirectionalLineState = nexusLineState ?? "NEUTRAL";
    nexusLineSeriesRef.current.applyOptions({ color: NL_STATE_COLOR[s] });
  }, [nexusLineState]);

  // Diretriz Camada de Decisão Profissional, item 1: EMA recomputada do
  // MESMO array real de candles (zero segunda fonte de dado), sempre que
  // o histórico ou o período selecionado no painel Camadas do Gráfico
  // mudar. O período real ("EMA 21") chega ao Operador via priceAxisLabels
  // (useMemo abaixo, fonte: activeEmaPeriod) — nunca via `title` nativo da
  // série (mesmo achado/mesma correção de VWAP/NL acima e Trend Channel
  // abaixo: title:"" na criação, nunca reescrito aqui, para não reabrir a
  // poluição de eixo na posição NATURAL/sem-colisão da série).
  const activeEmaPeriod = emaPeriod ?? DEFAULT_EMA_PERIOD;
  useEffect(() => {
    if (!emaSeriesRef.current) return;
    const series = computeEmaSeries(
      data.map((c) => ({ time: c.time, close: c.close })),
      activeEmaPeriod,
    );
    emaSeriesRef.current.setData(series.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    setEmaLastValue(series.length > 0 ? series[series.length - 1].value : null);
  }, [data, activeEmaPeriod]);

  // Camadas do Gráfico (Finding M): esconder a camada "ema" nunca altera
  // o dado real já computado acima — só a exibição, via applyOptions
  // nativo da própria lib (mais barato que recriar a série).
  useEffect(() => {
    if (!emaSeriesRef.current) return;
    emaSeriesRef.current.applyOptions({ visible: visibility.ema });
  }, [visibility.ema]);

  // Auditoria de pendências (mesmo padrão do EMA acima): VWAP/Nexus Line/
  // CVD ganham o mesmo interruptor real — o cálculo/setData de cada uma
  // continua intocado nos efeitos próprios (nada recomputa ao esconder),
  // só a exibição muda via applyOptions nativo.
  useEffect(() => {
    if (!vwapSeriesRef.current) return;
    vwapSeriesRef.current.applyOptions({ visible: visibility.vwap });
  }, [visibility.vwap]);
  // Bandas seguem o MESMO interruptor da VWAP (nunca uma 19ª camada
  // separada) — a ferramenta é uma só, a banda é parte dela.
  useEffect(() => {
    if (!vwapBandUpper1Ref.current || !vwapBandLower1Ref.current || !vwapBandUpper2Ref.current || !vwapBandLower2Ref.current) return;
    vwapBandUpper1Ref.current.applyOptions({ visible: visibility.vwap });
    vwapBandLower1Ref.current.applyOptions({ visible: visibility.vwap });
    vwapBandUpper2Ref.current.applyOptions({ visible: visibility.vwap });
    vwapBandLower2Ref.current.applyOptions({ visible: visibility.vwap });
  }, [visibility.vwap]);
  useEffect(() => {
    if (!nexusLineSeriesRef.current) return;
    nexusLineSeriesRef.current.applyOptions({ visible: visibility.nexus_line });
  }, [visibility.nexus_line]);
  useEffect(() => {
    if (!cvdSeriesRef.current) return;
    cvdSeriesRef.current.applyOptions({ visible: visibility.cvd });
  }, [visibility.cvd]);

  // DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO §4 ("Consolidação de zonas"):
  // zero prop nova de App.tsx — todo insumo já existe DENTRO deste
  // componente (emaLastValue/vwapLastValue/nlLastValue, calculados acima
  // do MESMO array `data`; fairValueGaps/orderBlocks/liquidityZones já
  // chegam pré-filtrados — unmitigated/unswept — como props, mesmo padrão
  // de App.tsx:6830-6834). computeInstitutionalZones é puro; o useMemo só
  // evita reclusterizar a cada render sem mudança real de insumo.
  //
  // Diretriz Consolidação/Auditoria/Evolução §6 (achado real da auditoria
  // de unificação de confluência): support/resistance (S1/R1) já são props
  // deste componente há muito tempo (usadas pelas price lines nativas
  // linha ~1044/1063 acima) — mesmo princípio "zero prop nova" continua
  // valendo, só passam a alimentar também o consolidador de zonas.
  // EPC OMEGA FINAL Parte 2 §7 (Confluência Visual): 3 fontes reais que
  // faltavam para os pares que a diretiva nomeia (Volume Profile+S/R,
  // Session Key Level+Liquidez, FVG+Sweep) — zero segundo cálculo em
  // todas as três:
  //  - POC: mesma fatia da store que VolumeProfilePlugin já lê
  //    (useVolumeProfileSnapshot, Fixed Range só, mesma razão documentada
  //    no plugin para não somar o perfil de Sessão).
  //  - Session Key Level: MESMO computeSessionKeyLevels(data) que
  //    SessionKeyLevelsPlugin já usa; só a ocorrência mais recente entra
  //    aqui — as anteriores já esmaecem no próprio plugin, confluência
  //    "agora" não faz sentido com um nível quase apagado.
  //  - Sweeps: MESMO clusterSweptPrices+SWEEP_DECAY+ageAlpha já usado
  //    pelo efeito de price line do sweep logo acima — só clusters ainda
  //    vivos (alpha>0) entram, nunca um sweep já esquecido na tela.
  const volumeProfile = useVolumeProfileSnapshot();
  // Achado real da auditoria "Estratégia de Evolução Elite" (2026-08-16,
  // task #341): POC (Volume Profile E TPO Profile), Value Area High/Low e
  // Initial Balance High/Low — 5 linhas de preço reais desenhadas por
  // VolumeProfilePlugin/TpoProfilePlugin — nunca ganharam rótulo legível
  // no eixo, diferente de S1/R1/EMA/VWAP. VP já expõe pocPrice pronto via
  // volumeProfile.fixedRange (zero cálculo novo, mesma leitura da store
  // que a confluência de institutional-zones já usa acima). TPO não tem
  // equivalente na store — TpoProfilePlugin computa e cacheia
  // internamente, local ao componente (nunca compartilhado). Recomputar
  // aqui é uma 2ª chamada real da MESMA função pura sobre a MESMA `data`
  // (não uma segunda implementação) — computeTpoProfile é síncrono e
  // barato (bucketing de OHLC já carregado, zero fetch/Worker, mesmo
  // raciocínio já documentado no cabeçalho do próprio tpo-profile.ts),
  // então o custo real de rodar 2x por mudança de `data` (não por frame)
  // é desprezível — bem diferente da classe de "Worker sobrecarregado"
  // que motivou excluir Volume Profile do Multi-Timeframe Matrix.
  const tpoProfileForLabels = useMemo(() => {
    const reading = computeTpoProfile(data);
    return reading.status === "OK" ? reading.result : null;
  }, [data]);
  const freshestSessionKeyLevel = useMemo(() => {
    const levels = computeSessionKeyLevels(data);
    const latest = levels[levels.length - 1];
    return latest ? { high: latest.high, low: latest.low } : null;
  }, [data]);
  // Fonte ÚNICA da leitura do SuperTrend: o desenho (efeito abaixo) e a
  // confluência (institutionalZoneInput) leem o MESMO memo. Antes de a
  // camada entrar na Zona Institucional isto era uma chamada solta dentro
  // do efeito; deixá-la lá e adicionar uma segunda chamada para a
  // confluência seria exatamente o "computar duas vezes" que a Regra de
  // Ouro 4 proíbe.
  const superTrendPoints = useMemo(() => computeSuperTrend(data), [data]);
  /** Último valor real da linha — membro PONTUAL da confluência, mesmo
   *  papel de emaLastValue/vwapLastValue. */
  const superTrendLastLine = useMemo(() => {
    const last = superTrendPoints[superTrendPoints.length - 1];
    return last && Number.isFinite(last.line) ? last.line : null;
  }, [superTrendPoints]);
  const institutionalBlockMembers = useMemo(
    () => [
      ...(breakerBlocks ?? []).map((b) => ({ kind: "BREAKER" as const, top: b.top, bottom: b.bottom })),
      ...(mitigationBlocks ?? []).map((b) => ({ kind: "MITIGATION" as const, top: b.top, bottom: b.bottom })),
    ],
    [breakerBlocks, mitigationBlocks],
  );

  const institutionalZoneSweeps = useMemo(() => {
    const seen = new Set<number>();
    const out: { price: number }[] = [];
    (traps ?? []).forEach((t) => {
      if (t.kind !== "STOP_HUNT_TOPO" && t.kind !== "STOP_HUNT_FUNDO") return;
      const uniqueLevels = t.sweptLevels.filter((l) => Number.isFinite(l.price) && !seen.has(l.price));
      uniqueLevels.forEach((l) => seen.add(l.price));
      for (const cluster of clusterSweptPrices(uniqueLevels, LIQUIDITY_PROXIMITY_PCT)) {
        const age = data.length - 1 - cluster.latestIndex;
        if (ageAlpha(age, SWEEP_DECAY) <= 0) continue;
        out.push({ price: cluster.avgPrice });
      }
    });
    return out;
  }, [traps, data.length]);
  const institutionalZoneInput = useMemo<InstitutionalZoneInput>(
    () => ({
      ema: emaLastValue !== null ? { period: activeEmaPeriod, value: emaLastValue } : null,
      vwap: vwapLastValue,
      nexusLine: nlLastValue,
      fairValueGaps: fairValueGaps ?? [],
      orderBlocks: orderBlocks ?? [],
      liquidityZones: liquidityZones ?? [],
      support: support ?? null,
      resistance: resistance ?? null,
      volumeProfilePoc: volumeProfile?.fixedRange?.pocPrice ?? null,
      sessionKeyLevel: freshestSessionKeyLevel,
      liquiditySweeps: institutionalZoneSweeps,
      // Evolução Total: 11ª fonte real (fix documentado na Ordem Nº 03 §3)
      // — mesmo padrão pontual de ema/vwap/nexusLine, fail-closed (null =
      // membro omitido pelo próprio motor).
      lastSwingHigh: lastSwingHigh ?? null,
      lastSwingLow: lastSwingLow ?? null,
      // ACHADO DE AUDITORIA desta rodada: as duas camadas graduadas
      // (SuperTrend e Breaker/Mitigation) chegavam ao canvas mas NÃO
      // alimentavam este consolidador — mesma classe de lacuna de fiação já
      // corrigida antes para S1/R1. O efeito era o contrário do pedido do
      // Operador: um SuperTrend parado exatamente sobre VWAP+OB é uma
      // ferramenta independente A MAIS concordando ali, e a contagem "4F"
      // saía menor que a realidade.
      //
      // São exatamente as MESMAS leituras já desenhadas (superTrendLastLine
      // vem da mesma `superTrendPoints`, os blocos vêm da mesma prop já
      // filtrada pelo App) — zero segundo cálculo.
      superTrendLine: superTrendLastLine,
      institutionalBlocks: institutionalBlockMembers,
    }),
    [emaLastValue, activeEmaPeriod, vwapLastValue, nlLastValue, fairValueGaps, orderBlocks, liquidityZones, support, resistance, volumeProfile, freshestSessionKeyLevel, institutionalZoneSweeps, lastSwingHigh, lastSwingLow, superTrendLastLine, institutionalBlockMembers],
  );
  const institutionalZones = useMemo(() => computeInstitutionalZones(institutionalZoneInput), [institutionalZoneInput]);
  // Carta Branca (Evidence Fusion Engine): achado real de auditoria — este
  // array já era computado aqui há várias rodadas só para o gráfico, sem
  // NENHUMA fatia própria na store (ao contrário de todo outro motor real
  // deste app). Publica o MESMO array já resolvido acima (zero segundo
  // cálculo) para que CouncilWidget/qualquer consumidor futuro leiam a
  // idêntica leitura — mesmo espírito de "computada uma vez, lida por
  // QUALQUER outro consumidor" já documentado para layerRelevance.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setInstitutionalZones(institutionalZones);
  }, [institutionalZones]);

  // Ordem Nº 03: candidatos reais para a competição cruzada de destaque —
  // só as 2 categorias cujo peso PRÓPRIO já existia antes desta rodada
  // (zero peso fabricado). Gated pela MESMA visibility que decide se cada
  // plugin sequer é montado — uma camada desligada não deve "gastar"
  // orçamento visual competindo por algo que não é desenhado.
  const hasTradePlanZone =
    visibility.trade_plan_zone &&
    tradePlan != null &&
    Number.isFinite(tradePlan.entry.low) &&
    Number.isFinite(tradePlan.entry.high) &&
    tradePlan.entry.low !== tradePlan.entry.high;
  // Evolução Visual (continuidade da Ordem Nº 03): 3ª categoria real —
  // STRUCTURE (BOS/CHOCH). MESMA fórmula já usada pelo priceAxisLabels do
  // rótulo BOS/CHOCH (age = candles desde o rompimento, ageAlpha real via
  // BREAK_DECAY) — zero segunda curva de decaimento, só um segundo
  // consumidor do mesmo cálculo puro.
  const structureBreakBaseWeight = useMemo(() => {
    if (!visibility.structure_breaks || !structureBreak) return null;
    const point = data[structureBreak.index];
    if (!point) return null;
    const age = data.length - 1 - structureBreak.index;
    const alpha = ageAlpha(age, BREAK_DECAY);
    return alpha > 0 ? alpha : null;
  }, [visibility.structure_breaks, structureBreak, data]);
  // Ordem Nº 04 (§4/§5): 4ª categoria real — MAIN_LIQUIDITY (FVG/Order
  // Blocks não-obstáculo, LiquidityZonesPlugin.tsx). MESMA fórmula exata
  // que o plugin já usa isolado (ZONE_DECAY, exportado de lá — zero
  // segunda curva). Zonas que SÃO obstáculo real do caminho do plano
  // ativo ficam DE FORA da competição de propósito (null aqui, nunca
  // viram candidato): a garantia de alpha=1 sempre que bloqueiam o
  // caminho (Diretriz Restauração/Inteligência Visual §6) é mais forte
  // que a prioridade declarada do orçamento — reduzir um obstáculo real
  // por competição visual esconderia risco real do Operador.
  const mainLiquidityCandidates = useMemo(() => {
    if (!visibility.liquidity_zones) return { fvg: [] as (number | null)[], ob: [] as (number | null)[] };
    const obstacles = obstacleZones ?? [];
    const isObstacle = (zone: EnhancedChartZone) => obstacles.some((o) => o.low === zone.bottom && o.high === zone.top);
    const baseWeightOf = (zone: EnhancedChartZone) => {
      if (isObstacle(zone)) return null;
      const age = data.length - 1 - zone.index;
      const alpha = ageAlpha(age, ZONE_DECAY);
      return alpha > 0 ? alpha : null;
    };
    return {
      fvg: (fairValueGaps ?? []).map(baseWeightOf),
      ob: (orderBlocks ?? []).map(baseWeightOf),
    };
  }, [visibility.liquidity_zones, fairValueGaps, orderBlocks, obstacleZones, data]);
  const visualBudgetResults = useMemo(() => {
    const candidates: VisualBudgetCandidate[] = [];
    if (visibility.institutional_zones) {
      institutionalZones.forEach((zone, i) => {
        candidates.push({ id: `zone-${i}`, category: "INSTITUTIONAL_ZONE", baseWeight: confluenceWeight(zone.distinctSourceCount) });
      });
    }
    if (hasTradePlanZone) {
      candidates.push({ id: "trade-plan", category: "TRADE_PLAN", baseWeight: opacityMultiplierFor(confidenceZone ?? null) });
    }
    if (structureBreakBaseWeight !== null) {
      candidates.push({ id: "structure-break", category: "STRUCTURE", baseWeight: structureBreakBaseWeight });
    }
    // Achado 2.3 (Visual Cleanup & Rendering Audit): S1/R1 nunca competiam
    // por orçamento visual — entram como STRUCTURE (mesma categoria/
    // prioridade do BOS/CHOCH acima: contexto estrutural, nunca a decisão
    // real do Core Engine, LEI 24) só quando a linha de fato vai ser
    // desenhada (mesmo gate Number.isFinite dos 2 useEffect abaixo).
    if (Number.isFinite(support)) {
      candidates.push({ id: "s1", category: "STRUCTURE", baseWeight: levelStrengthBaseWeight(supportStrength) });
    }
    if (Number.isFinite(resistance)) {
      candidates.push({ id: "r1", category: "STRUCTURE", baseWeight: levelStrengthBaseWeight(resistanceStrength) });
    }
    // Achado 2.7: Fibonacci entra na MESMA competição, como STRUCTURE (é
    // mapa estrutural de retração, exatamente como S1/R1 e BOS/CHOCH acima —
    // nunca a decisão real do Core Engine, LEI 24). O peso real de cada
    // nível vem do ratio + da confluência já medida (fibRatioBaseWeight), e
    // o id carrega o índice para o efeito da linha reencontrar o seu peso
    // resolvido — mesmo padrão de `zone-${i}`/`liquidity-fvg-${i}`.
    if (visibility.fibonacci) {
      (fibonacciLevels ?? []).forEach((level, i) => {
        if (!Number.isFinite(level.price)) return;
        candidates.push({ id: `fib-${i}`, category: "STRUCTURE", baseWeight: fibRatioBaseWeight(level.ratio, level.score) });
      });
    }
    mainLiquidityCandidates.fvg.forEach((w, i) => {
      if (w !== null) candidates.push({ id: `liquidity-fvg-${i}`, category: "MAIN_LIQUIDITY", baseWeight: w });
    });
    mainLiquidityCandidates.ob.forEach((w, i) => {
      if (w !== null) candidates.push({ id: `liquidity-ob-${i}`, category: "MAIN_LIQUIDITY", baseWeight: w });
    });
    return resolveVisualBudget(candidates);
  }, [
    visibility.institutional_zones,
    institutionalZones,
    hasTradePlanZone,
    confidenceZone,
    structureBreakBaseWeight,
    support,
    resistance,
    supportStrength,
    resistanceStrength,
    visibility.fibonacci,
    fibonacciLevels,
    mainLiquidityCandidates,
  ]);
  const institutionalZoneVisualWeights = useMemo(() => {
    const byId = new Map(visualBudgetResults.map((r) => [r.id, r.visualWeight]));
    return institutionalZones.map((_, i) => byId.get(`zone-${i}`));
  }, [visualBudgetResults, institutionalZones]);
  const tradePlanVisualWeight = useMemo(
    () => visualBudgetResults.find((r) => r.id === "trade-plan")?.visualWeight ?? null,
    [visualBudgetResults],
  );
  const structureBreakVisualWeight = useMemo(
    () => visualBudgetResults.find((r) => r.id === "structure-break")?.visualWeight ?? null,
    [visualBudgetResults],
  );
  const supportVisualWeight = useMemo(
    () => visualBudgetResults.find((r) => r.id === "s1")?.visualWeight ?? null,
    [visualBudgetResults],
  );
  const resistanceVisualWeight = useMemo(
    () => visualBudgetResults.find((r) => r.id === "r1")?.visualWeight ?? null,
    [visualBudgetResults],
  );
  // Achado 2.7: peso real resolvido por NÍVEL de Fibonacci — mesmo padrão
  // por índice de institutionalZoneVisualWeights acima. `undefined` só
  // ocorre quando o nível nem entrou como candidato (preço não finito ou
  // camada desligada); fibLineAlpha trata isso como "sem competição".
  const fibonacciVisualWeights = useMemo(() => {
    const byId = new Map(visualBudgetResults.map((r) => [r.id, r.visualWeight]));
    return (fibonacciLevels ?? []).map((_, i) => byId.get(`fib-${i}`) ?? null);
  }, [visualBudgetResults, fibonacciLevels]);

  // S1/R1 reais — o MESMO engine.support/resistance que os outros widgets
  // já exibem, aqui como price lines nativas (createPriceLine), nunca uma
  // linha desenhada à mão em cima do canvas.
  //
  // "Fio de seda" (pedido explícito do Operador): TODAS as linhas de
  // marcação deste gráfico são SÓLIDAS e finas (lineWidth 1, o mínimo da
  // lib) — nunca pontilhadas/tracejadas. A hierarquia visual entre S1/R1
  // (nível primário) e as zonas SMC (contexto) vem da OPACIDADE da cor,
  // não do estilo do traço: S1/R1 mais presentes, zonas mais translúcidas.
  // Posicionado aqui (depois de supportVisualWeight/resistanceVisualWeight,
  // não mais logo após o efeito de crosshair) porque o Achado 2.3 (Visual
  // Cleanup & Rendering Audit) passou a depender do peso real resolvido
  // pelo orçamento visual — TDZ do TypeScript exige a leitura depois da
  // declaração; zero mudança de comportamento, só de posição no arquivo.
  useEffect(() => {
    if (!seriesRef.current) return;
    if (supportLineRef.current) {
      seriesRef.current.removePriceLine(supportLineRef.current);
      supportLineRef.current = null;
    }
    if (Number.isFinite(support)) {
      supportLineRef.current = seriesRef.current.createPriceLine({
        price: support as number,
        // Especificação Visual Profissional v1 (pedido direto do
        // Operador): S/R unificados em âmbar #f59e0b — "âmbar único para
        // todos os níveis", mesma família de EQH/EQL abaixo. Distinto do
        // caso FVG (pergunta direta ao Operador: mantido verde/vermelho
        // por um pedido V18.2 anterior e explícito) — S1/R1 nunca teve
        // essa mesma exigência de preservação de cor.
        // Achado 2.3: alpha agora segue o peso real resolvido pela
        // competição de orçamento visual (força do nível × concorrência
        // com Trade Plan/Zonas/Estrutura), nunca mais um 0.65 fixo — teto
        // igual ao valor fixo de sempre (zero regressão no caso FORTE sem
        // competição), piso 0.35 (Regra de Ouro 4, nunca desaparece).
        color: `rgba(245, 158, 11, ${levelLineAlpha(supportVisualWeight).toFixed(3)})`,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        // Mesmo achado/mesma correção da série de candles acima — o tag
        // nativo do eixo colidia com VWAP/NL/preço quando os valores
        // reais ficam próximos; PriceLabelStackPlugin assume o rótulo.
        axisLabelVisible: false,
        title: levelTitle("S1", supportStrength, supportBreakouts),
      });
    }
  }, [support, supportStrength, supportBreakouts, supportVisualWeight]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (resistanceLineRef.current) {
      seriesRef.current.removePriceLine(resistanceLineRef.current);
      resistanceLineRef.current = null;
    }
    if (Number.isFinite(resistance)) {
      resistanceLineRef.current = seriesRef.current.createPriceLine({
        price: resistance as number,
        // Especificação Visual Profissional v1: mesmo âmbar unificado de S1.
        // Achado 2.3: mesmo peso real resolvido do S1 acima (levelLineAlpha).
        color: `rgba(245, 158, 11, ${levelLineAlpha(resistanceVisualWeight).toFixed(3)})`,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        // Mesmo achado/mesma correção do S1 acima.
        axisLabelVisible: false,
        title: levelTitle("R1", resistanceStrength, resistanceBreakouts),
      });
    }
  }, [resistance, resistanceStrength, resistanceBreakouts, resistanceVisualWeight]);

  // Auditoria do ecossistema de indicadores (pedido direto do Operador:
  // "qual ferramenta que está faltando" — Pivot Points era o único gap real
  // não-redundante encontrado). Mesma técnica de S1/R1 acima (createPriceLine
  // nativo, remove-then-create), mas em ref PRÓPRIA (pivotLinesRef): fonte de
  // dado diferente (candle diário fechado, não swing fractal), ciclo de
  // redesenho independente. Títulos "PVT " prefixados de propósito — sem o
  // prefixo, "R1"/"S1" colidiria visualmente com o R1/S1 de swing já
  // desenhado acima, dois níveis DIFERENTES soando como o mesmo rótulo.
  useEffect(() => {
    if (!seriesRef.current) return;
    for (const line of pivotLinesRef.current) seriesRef.current.removePriceLine(line);
    pivotLinesRef.current = [];
    if (!visibility.pivot_points || pivotPoints?.status !== "OK") return;

    // Família "attention" (canvas-palette.ts) — mesma cor de S1/R1: os dois
    // são, conceitualmente, a MESMA categoria (nível de suporte/resistência
    // a observar), só com fórmulas diferentes. PP ganha um pouco mais de
    // peso (é a âncora); R2/R3/S2/S3 ficam mais discretos — mesmo princípio
    // de hierarquia por opacidade já usado em todo o resto do canvas, nunca
    // uma cor nova (travado por tests/canvas-palette.test.ts).
    const levels: Array<[string, number | null, number]> = [
      ["PVT R3", pivotPoints.r3, 0.22],
      ["PVT R2", pivotPoints.r2, 0.26],
      ["PVT R1", pivotPoints.r1, 0.32],
      ["PVT PP", pivotPoints.pp, 0.4],
      ["PVT S1", pivotPoints.s1, 0.32],
      ["PVT S2", pivotPoints.s2, 0.26],
      ["PVT S3", pivotPoints.s3, 0.22],
    ];
    for (const [title, price, alpha] of levels) {
      if (!Number.isFinite(price)) continue;
      pivotLinesRef.current.push(
        seriesRef.current.createPriceLine({
          price: price as number,
          color: chartPaletteRgba("attention", alpha),
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title,
        }),
      );
    }
  }, [pivotPoints, visibility.pivot_points]);

  const mainLiquidityVisualWeights = useMemo(() => {
    const byId = new Map(visualBudgetResults.map((r) => [r.id, r.visualWeight]));
    return {
      fvg: (fairValueGaps ?? []).map((_, i) => byId.get(`liquidity-fvg-${i}`)),
      ob: (orderBlocks ?? []).map((_, i) => byId.get(`liquidity-ob-${i}`)),
    };
  }, [visualBudgetResults, fairValueGaps, orderBlocks]);

  // Pools de liquidez que o LiquidityZonesPlugin consegue desenhar como
  // TRECHO real. Fail-closed explícito: sem `index` (dado de uma versão
  // anterior do motor, ainda em cache) a zona é descartada do canvas em vez
  // de virar de novo uma linha de largura total — o defeito que o Operador
  // relatou. O painel lateral continua listando a zona normalmente; isto
  // decide apenas o que o canvas pinta.
  const equalLevelMarks = useMemo<EqualLevelMark[]>(
    () =>
      (liquidityZones ?? [])
        .filter((z) => Number.isFinite(z.price) && Number.isFinite(z.index))
        .map((z) => ({
          type: z.type,
          price: z.price,
          touches: z.touches,
          index: z.index as number,
          firstIndex: z.firstIndex,
          touchIndices: z.touchIndices,
        })),
    [liquidityZones],
  );

  // Auditoria do painel do gráfico: Linear Regression Channel real sobre a
  // MESMA `data` de candles (zero segunda fonte de dado) — mesmo padrão do
  // efeito de EMA acima. null (histórico insuficiente) => setData([]) nas
  // três séries, nunca uma linha fabricada sobre janela vazia.
  useEffect(() => {
    if (!trendChannelMidRef.current || !trendChannelUpperRef.current || !trendChannelLowerRef.current) return;
    const reading = computeTrendChannel(
      data.map((c) => ({ time: c.time, close: c.close })),
      TREND_CHANNEL_DEFAULT_WINDOW,
    );
    trendChannelMidRef.current.setData((reading?.mid ?? []).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    trendChannelUpperRef.current.setData((reading?.upper ?? []).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    trendChannelLowerRef.current.setData((reading?.lower ?? []).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    const midTail = reading && reading.mid.length > 0 ? reading.mid[reading.mid.length - 1].value : null;
    setTrendChannelInfo(reading && midTail !== null ? { direction: reading.direction, windowSize: reading.windowSize, midPrice: midTail } : null);
  }, [data]);

  // SuperTrend real sobre o MESMO array de candles do gráfico (zero segunda
  // fonte de dado, mesmo padrão da EMA acima). A leitura é recomputada
  // inteira a cada mudança de `data` — o motor é O(n) e o travamento das
  // bandas é recursivo desde o início da série, então não existe versão
  // incremental honesta que dê o mesmo resultado.
  //
  // As DUAS séries recebem a série COMPLETA de tempos; onde a tendência é
  // a outra, o ponto entra como whitespace (`{ time }` sem `value`). Sem
  // isso a lib interpolaria uma reta ligando os trechos e desenharia um
  // stop que nunca existiu.
  //
  // O ponto do FLIP entra nas DUAS séries de propósito: é o mesmo preço, e
  // sem ele haveria um buraco de 1 candle exatamente no instante que mais
  // importa ler.
  useEffect(() => {
    if (!supertrendUpRef.current || !supertrendDownRef.current) return;
    const pontos = superTrendPoints;
    if (pontos.length === 0) {
      // Fail-closed: sem aquecimento real de Wilder, nada é desenhado —
      // nunca uma linha extrapolada sobre janela insuficiente.
      supertrendUpRef.current.setData([]);
      supertrendDownRef.current.setData([]);
      return;
    }
    // A separação em duas séries com whitespace é a única parte não-óbvia
    // deste desenho — vive em supertrend-series.ts, com execução real de
    // teste, e é a MESMA função que o harness de verificação visual usa
    // (nunca uma cópia que pudesse divergir do app).
    const { up, down } = splitSuperTrendSeries<UTCTimestamp>(
      pontos,
      (i) => (data[i] ? (data[i].time as UTCTimestamp) : undefined),
    );
    supertrendUpRef.current.setData(up);
    supertrendDownRef.current.setData(down);
  }, [data, superTrendPoints]);

  // SETAS DE ENTRADA E SAÍDA — pedido direto do Operador ("com as setinhas
  // indicando a entrada e saída, todo no gráfico").
  //
  // Marcador nativo da própria lib (createSeriesMarkers), nunca um canvas
  // novo: a seta precisa ficar ancorada na VELA, e a primitiva da lib já
  // resolve isso em pan/zoom sem nenhum loop de rAF a mais.
  //
  // Acompanha `trade_plan_zone` de propósito, sem interruptor próprio: o
  // Operador pediu explicitamente MENOS modos, e as setas são o registro do
  // mesmo plano que essa camada já representa. Mesma decisão já tomada para
  // Liquidity Void (que acompanha liquidity_zones).
  useEffect(() => {
    if (!seriesRef.current) return;
    const markers = visibility.trade_plan_zone ? buildPlanMarkers(planMarkers ?? [], data) : [];
    if (planMarkersRef.current) {
      planMarkersRef.current.setMarkers(markers);
      return;
    }
    // Só cria o plugin quando existe a primeira seta real — nunca anexa uma
    // primitiva vazia à série por precaução.
    if (markers.length === 0) return;
    planMarkersRef.current = createSeriesMarkers(seriesRef.current, markers);
  }, [planMarkers, data, visibility.trade_plan_zone]);

  // Camadas do Gráfico: mesmo padrão de "ema" — esconder alterna visible
  // nas séries nativas, nunca desmonta/recomputa.
  useEffect(() => {
    if (!supertrendUpRef.current || !supertrendDownRef.current) return;
    supertrendUpRef.current.applyOptions({ visible: visibility.supertrend });
    supertrendDownRef.current.applyOptions({ visible: visibility.supertrend });
  }, [visibility.supertrend]);

  // Camadas do Gráfico: mesmo padrão de "ema" — esconder alterna visible
  // nas três séries nativas, nunca desmonta/recomputa.
  useEffect(() => {
    if (!trendChannelMidRef.current || !trendChannelUpperRef.current || !trendChannelLowerRef.current) return;
    trendChannelMidRef.current.applyOptions({ visible: visibility.trend_channel });
    trendChannelUpperRef.current.applyOptions({ visible: visibility.trend_channel });
    trendChannelLowerRef.current.applyOptions({ visible: visibility.trend_channel });
  }, [visibility.trend_channel]);

  // V-MAX Fase 1 (superfície visual): níveis reais da Matriz de Confluência
  // Fibonacci como price lines nativas — "fio de seda" (1px sólida, nunca
  // pontilhada); a hierarquia entre níveis vem da OPACIDADE pela confluência
  // real (score ≥ 1 fonte => mais presente), nunca do estilo do traço.
  // Título carrega ratio + score reais ("FIB 61.8% ×2"). Auditoria de
  // pendências: ganha visibility.fibonacci (mesmo fail-closed de "sem
  // camada visível, zero linhas" das outras price lines deste arquivo).
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    fibLinesRef.current.forEach((line) => series.removePriceLine(line));
    fibLinesRef.current = [];
    if (!visibility.fibonacci) return;

    (fibonacciLevels ?? []).forEach((level, i) => {
      if (!Number.isFinite(level.price)) return;
      fibLinesRef.current.push(
        series.createPriceLine({
          price: level.price,
          // Achado 2.7: a opacidade deixou de ser um degrau binário
          // (0.55/0.20 por `score > 0`) e virou o peso real resolvido —
          // ratio (papel estrutural) + confluência medida + competição de
          // orçamento visual. É isto que faz a razão áurea se destacar das
          // retrações rasas sem nenhuma linha desaparecer (piso real).
          color: `rgba(0, 98, 255, ${fibLineAlpha(fibonacciVisualWeights[i] ?? null).toFixed(3)})`,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title: `FIB ${(level.ratio * 100).toFixed(1)}%${level.score > 0 ? ` ×${level.score}` : ""}`,
        }),
      );
    });
  }, [fibonacciLevels, visibility.fibonacci, fibonacciVisualWeights]);

  // §6 "Smart Projection Engine" (achado real de auditoria, ver comentário
  // da prop `scenario` acima): as 2 rotas reais do Motor de Cenários
  // (Path A/B) como price lines nativas — mesmo padrão das linhas Fibonacci
  // acima, "fio de seda" (1px sólida, nunca pontilhada).
  //
  // Diretriz Restauração/Inteligência Visual §3 ("a projeção deve ser
  // visualmente diferente daquilo que já foi confirmado... nunca misturar
  // passado/presente/futuro"): achado real ao VERIFICAR com um harness
  // Playwright isolado — o título (`title` abaixo) só aparece via
  // axisLabelVisible:true ou uma legenda de hover que este gráfico não
  // tem; com axisLabelVisible:false (linha abaixo, deliberado para não
  // repetir a poluição de eixo que "Achados da captura real do Operador"
  // já corrigiu no Trend Channel), o texto "PROJEÇÃO"/"SCENARIO A/B" NUNCA
  // chega à tela — cor é o ÚNICO sinal que o operador realmente vê. A
  // convenção anterior (verde/vermelho = MESMA cor do LONG/SHORT real)
  // deixava uma projeção INDISTINGUÍVEL de estrutura já confirmada a
  // olho nu. Agora usa uma cor própria (lavanda), na mesma família de
  // "isto é leitura estatística/de contexto, não um nível real" do Trend
  // Channel (slate) — nunca compartilhada com nenhum outro overlay
  // (verde/vermelho=direção real, âmbar=zona de entrada, roxo=harmônicos/
  // EQH-EQL, azul-material=EMA, branco=VWAP, slate=Trend Channel, ciano=
  // Fibonacci). Direção continua legível pela POSIÇÃO real (Path acima do
  // preço = LONG, abaixo = SHORT) — a mesma leitura que Fibonacci/S1/R1
  // já pedem do operador sem cor direcional própria.
  // Deliberadamente mais discretas que o Trade Plan ATIVO (teto de opacidade
  // mais baixo, sem rótulo no eixo de preço): isto é confluência/contexto
  // do Conselho, nunca uma segunda decisão de trading (LEI 24) — o alvo
  // REAL do plano ativo continua a linha com mais peso visual na tela.
  // Opacidade escala linearmente pela opinionWeight REAL (0..1, nunca uma
  // probabilidade — o próprio scenario.basis documenta isso); piso honesto
  // mesmo quando o peso é null (conselho travado/ausente) para nunca
  // esconder um alvo real só porque a confiança numérica não existe ainda.
  //
  // v2 (Diretriz Suprema de Evolução Integrativa §5/§6, "Future Path
  // Map"): scenario-engine.ts agora expõe até MAX_SCENARIO_TARGETS níveis
  // reais por caminho (não só o mais próximo) + `invalidation`. Os alvos
  // extras desenham aqui, mais apagados quanto mais longe (TARGET_ALPHA_
  // FALLOFF) — a mesma lógica de "o mais próximo pesa mais" já usada em
  // outros lugares deste gráfico. `invalidation` DELIBERADAMENTE não
  // ganha uma linha própria: por construção do motor, a invalidação de um
  // caminho é sempre exatamente o alvo mais próximo do caminho OPOSTO
  // (scenario-engine.ts: `longPath.invalidation = below[0] = shortPath.
  // targets[0]`) — desenhá-la de novo aqui seria uma segunda linha no
  // MESMO preço já real na tela, a "linha fantasma"/redundância que a
  // diretriz pede para nunca criar. A informação continua real e
  // auditável (contrato + formatScenarioPathLabel, "· inv NNNN" nos
  // painéis de texto), só não duplica geometria já desenhada.
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    scenarioLinesRef.current.forEach((line) => series.removePriceLine(line));
    scenarioLinesRef.current = [];
    if (!scenario || !visibility.scenario_projection) return;

    const alphaOf = (weight: number | null): number => {
      const floor = 0.12;
      const ceiling = 0.55; // sempre abaixo do 0.75 real do Trade Plan ativo
      if (weight === null || !Number.isFinite(weight)) return floor;
      return floor + Math.max(0, Math.min(1, weight)) * (ceiling - floor);
    };
    // Índice 0 = alvo mais próximo (peso cheio); cada alvo mais distante
    // na mesma rota pesa menos — mesmo espírito do "hierarquia visual dos
    // alvos" já usado no Trade Plan real (label-compaction.ts), aqui só
    // por opacidade (cor/traço continuam intocados, Regra de Ouro 5).
    const TARGET_ALPHA_FALLOFF = [1, 0.65, 0.4];

    // Lavanda dedicada — nunca a mesma cor de nenhum nível real já
    // desenhado (ver comentário acima). Única para as duas rotas: a
    // direção já é legível pela posição real acima/abaixo do preço.
    const PROJECTION_RGB = "186, 168, 255";

    ([
      { path: scenario.pathA, label: "SCENARIO A" },
      { path: scenario.pathB, label: "SCENARIO B" },
    ] as const).forEach(({ path, label }) => {
      // Diretriz Final — Camada de Cenários Inteligentes §4: confiança
      // qualitativa real (describeScenarioConfidence), nunca mais a
      // porcentagem bruta — mesmo motivo de heatTier (ver header de
      // scenario-engine.ts).
      const confidence = describeScenarioConfidence(path.opinionWeight);
      const weightLabel = confidence !== null ? `opinion ${confidence}` : "opinion n/a";
      path.targets.forEach((target, i) => {
        if (!Number.isFinite(target.price)) return;
        const alpha = alphaOf(path.opinionWeight) * (TARGET_ALPHA_FALLOFF[i] ?? TARGET_ALPHA_FALLOFF[TARGET_ALPHA_FALLOFF.length - 1]);
        // §3 ("Pontos de Reteste... sempre derivados de cálculos reais"):
        // classificação honesta do tipo de reação esperada, derivada só
        // do sourceKind que este nível já carrega — zero motor novo.
        const reaction = describeScenarioReaction(target.sourceKind);
        scenarioLinesRef.current.push(
          series.createPriceLine({
            price: target.price,
            color: `rgba(${PROJECTION_RGB}, ${alpha.toFixed(2)})`,
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: false,
            // Prefixo explícito "PROJEÇÃO": metadado real (title da
            // própria lib), correto e auditável mesmo hoje sem UI de
            // hover/legenda que o exiba — a diferenciação que o OPERADOR
            // realmente vê é a cor lavanda dedicada + a opacidade
            // decrescente por rank, não este texto (ver comentário no
            // topo do efeito).
            title: `PROJEÇÃO · ${label} · ${path.direction} · TP${i + 1} · ${target.sourceKind} (${reaction}) · ${weightLabel}`,
          }),
        );
      });
    });
  }, [scenario, visibility.scenario_projection]);

  // Refinamento Final §7 (Premium/Discount zones): as 3 fronteiras REAIS do
  // dealing range atual (último swing high confirmado, equilíbrio 50%,
  // último swing low confirmado — premium-discount.ts, mesmo findSwings
  // compartilhado dos motores). Fio de seda (1px sólida), MAIS discretas que
  // Scenario e Trade Plan (contexto de zona, não alvo): opacidade fixa
  // baixa, sem rótulo de eixo. Fail-closed: sem leitura real, zero linhas.
  // Auditoria de pendências: ganha visibility.premium_discount, mesmo
  // fail-closed acima (early-return antes de desenhar).
  //
  // Achado real (Visual Cleanup & Rendering Audit, "ORDEM DEFINITIVA..."):
  // premium-discount.ts e fibonacci-confluence.ts (engine-bridge.ts:786)
  // partem do MESMO par de swing (último swing high + último swing low
  // fractal, via findSwings compartilhado) — não é coincidência, é a MESMA
  // definição de perna. Equilibrium (50% do dealing range) e o nível FIB
  // 50.0% (FIB_RETRACEMENT_RATIOS inclui 0.5) são matematicamente o MESMO
  // preço sempre que os dois motores computam com sucesso ao mesmo tempo —
  // 1 conceito ("meio da perna"), 2 linhas nativas reais simultâneas por
  // padrão (os dois layers vêm `true` em DEFAULT_CHART_LAYER_VISIBILITY).
  // Regra nova do Operador: múltiplos produtores podem calcular (os dois
  // continuam 100% intactos — zero mudança em premium-discount.ts/
  // fibonacci-confluence.ts, zero mudança em premiumDiscount.equilibrium
  // usado alhures em App.tsx para % de posição na faixa), mas o CANVAS só
  // pode ter UMA linha por conceito. FIB 50% já é estritamente mais rica
  // nesse ponto (carrega confluência real — quantas fontes independentes
  // caem ali, "×N" no título) que a linha de Equilibrium sozinha, então
  // vira a representação canônica: Equilibrium só desenha quando Fibonacci
  // não vai desenhar o mesmo ponto agora (invisível, sem matriz válida, ou
  // sem o nível 0.5 nela — fail-closed, nunca assume). rangeHigh/rangeLow
  // continuam sempre desenhados por este motor: Fibonacci nunca traça uma
  // linha em 0%/100% (FIB_RETRACEMENT_RATIOS não inclui os extremos), então
  // não há sobreposição real nesses dois pontos.
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    premiumDiscountLinesRef.current.forEach((line) => series.removePriceLine(line));
    premiumDiscountLinesRef.current = [];
    if (!premiumDiscount || !visibility.premium_discount) return;
    const mkPd = (price: number, color: string, title: string) => {
      if (!Number.isFinite(price)) return;
      premiumDiscountLinesRef.current.push(
        series.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title,
        }),
      );
    };
    const fibAlreadyDrawsEquilibrium =
      visibility.fibonacci && (fibonacciLevels ?? []).some((l) => l.ratio === 0.5 && Number.isFinite(l.price));
    mkPd(premiumDiscount.rangeHigh.price, "rgba(242, 54, 69, 0.30)", "Premium · topo do range");
    if (!fibAlreadyDrawsEquilibrium) {
      mkPd(premiumDiscount.equilibrium, "rgba(138, 180, 248, 0.30)", "Equilibrium · 50%");
    }
    mkPd(premiumDiscount.rangeLow.price, "rgba(8, 153, 129, 0.30)", "Discount · fundo do range");
  }, [premiumDiscount, visibility.premium_discount, visibility.fibonacci, fibonacciLevels]);

  // Auditoria Final §3 ("caso esteja calculado mas não desenhado, ativar
  // renderização") + Carta Branca (Reconhecimento de Padrões): agora TRÊS
  // famílias de padrão geométrico competem pelo mesmo desenho — harmônicos
  // XABCD/Wolfe (harmonic-patterns.ts), Triângulo (triangle-pattern.ts) e
  // Ombro-Cabeça-Ombro (head-shoulders-pattern.ts). Cada motor já entrega
  // seu próprio melhor hit (harmonicHits vem pré-ordenado por fit desc;
  // trianglePattern/headShouldersPattern já são o único melhor da janela);
  // o vencedor ÚNICO entre as 3 famílias é o de maior fitScore — mesma
  // disciplina de "só o melhor vai pro canvas, o resto fica no painel"
  // já usada pelo harmônico sozinho antes desta rodada (visual budget:
  // silk-thread, zero 3 geometrias competindo pela mesma área). Comparar
  // fitScore entre motores DIFERENTES é uma heurística declarada (cada um
  // mede aderência de um jeito distinto — razão Fibonacci/R² de trendline/
  // simetria de ombros), nunca uma medição única calibrada; empate resolve
  // pela ordem de checagem abaixo (harmônico > triângulo > H&S), arbitrária
  // mas determinística. Púrpura (acento do Conselho/opinião agregada) em
  // toda a família — uma ÚNICA linguagem visual, nunca 3 paletas
  // competindo por atenção; fio de seda; título carrega o fit com o rótulo
  // honesto — aderência, nunca probabilidade. Fail-closed: sem padrão
  // algum, zero linhas. Ganha visibility.harmonics (rótulo do painel
  // ampliado para "PADRÕES GRÁFICOS", App.tsx) — early-return antes de
  // desenhar qualquer price line/polilinha nova.
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    harmonicLinesRef.current.forEach((line) => series.removePriceLine(line));
    harmonicLinesRef.current = [];
    // Limpa TODAS as geometrias das 3 famílias ANTES de decidir o vencedor
    // — sem padrão real agora (ou trocou de vencedor), zero figura antiga
    // lingerindo na tela (mesmo fail-closed das price lines desta função).
    harmonicPolylineRef.current?.setData([]);
    triangleResistanceLineRef.current?.setData([]);
    triangleSupportLineRef.current?.setData([]);
    necklineExtensionLineRef.current?.setData([]);
    if (!visibility.harmonics) return;

    const harmonicTop = harmonicHits && harmonicHits.length > 0 ? harmonicHits[0] : null;
    const harmonicValid = harmonicTop && Number.isFinite(harmonicTop.points.D.price) ? harmonicTop : null;
    // Só as famílias de MESMA geometria competem entre si. Harmônico e H&S
    // são ambos uma POLILINHA em ziguezague por pivôs alternados, desenhada
    // na mesma região — duas delas juntas viram rabisco, então continua
    // valendo "só o melhor vai pro canvas".
    //
    // O Triângulo saiu desta disputa (pedido do Operador: "adiciona
    // triângulo, tá faltando"), por dois motivos reais e não por
    // preferência:
    //
    // 1. GEOMETRIA DIFERENTE — são 2 retas convergindo sobre o MESMO
    //    intervalo de tempo, não uma polilinha por pivôs. Isso já estava
    //    reconhecido no próprio código, que lhe deu 2 séries dedicadas em
    //    vez de reusar harmonicPolylineRef. O argumento "3 geometrias
    //    competindo pela mesma área" nunca se aplicou a ele: ele não
    //    disputa a área do ziguezague, ocupa o envelope do range.
    // 2. ESCALAS INCOMPARÁVEIS — o desempate era por fitScore entre motores
    //    diferentes, e o comentário original já admitia que cada um mede
    //    aderência de um jeito distinto (razão Fibonacci × R² de reta ×
    //    simetria de ombros). O triângulo podia perder por ter R² numa
    //    escala mais dura, não por ser um padrão pior — e aí sumia do
    //    gráfico mesmo sendo real.
    //
    // Teto visual continua 2 figuras (um ziguezague + o triângulo), nunca
    // 3, e a família inteira mantém a MESMA linguagem visual púrpura.
    const candidates: Array<{ family: "HARMONIC" | "HEAD_SHOULDERS"; fitScore: number }> = [];
    if (harmonicValid) candidates.push({ family: "HARMONIC", fitScore: harmonicValid.fitScore });
    if (headShouldersPattern) candidates.push({ family: "HEAD_SHOULDERS", fitScore: headShouldersPattern.fitScore });
    // Fail-closed: sem ziguezague E sem triângulo, zero linhas.
    if (candidates.length === 0 && !trianglePattern) return;
    let winner: { family: "HARMONIC" | "HEAD_SHOULDERS"; fitScore: number } | null = candidates[0] ?? null;
    for (const c of candidates.slice(1)) {
      if (winner && c.fitScore > winner.fitScore) winner = c;
    }

    const mkH = (price: number, title: string) => {
      if (!Number.isFinite(price)) return;
      harmonicLinesRef.current.push(
        series.createPriceLine({
          price,
          color: "rgba(167, 139, 250, 0.40)",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title,
        }),
      );
    };
    // Mesma técnica de zigue-zague em ordem de tempo para QUALQUER família
    // cuja figura seja uma sequência de pivôs alternados (harmônico e H&S
    // — o Triângulo NÃO é: são 2 retas avançando no MESMO intervalo de
    // tempo, tratado à parte abaixo). Tempo estritamente crescente é
    // exigência real da lib, nunca uma segunda regra de ordenação
    // inventada; pontos undefined (AB=CD honestamente não tem X) são
    // filtrados, nunca fabricados para "completar" a figura.
    const drawZigzagOutline = (points: Array<HarmonicPoint | undefined>) => {
      const polylinePoints = points
        .filter((p): p is HarmonicPoint => p !== undefined)
        .map((p) => {
          const candle = data[p.index];
          return candle && Number.isFinite(p.price) ? { time: candle.time as UTCTimestamp, value: p.price } : null;
        })
        .filter((p): p is { time: UTCTimestamp; value: number } => p !== null)
        .sort((a, b) => a.time - b.time)
        .filter((p, i, arr) => i === 0 || p.time !== arr[i - 1].time);
      if (polylinePoints.length >= 2) harmonicPolylineRef.current?.setData(polylinePoints);
    };

    if (winner?.family === "HARMONIC" && harmonicValid) {
      const top = harmonicValid;
      drawZigzagOutline([top.points.X, top.points.A, top.points.B, top.points.C, top.points.D]);
      // Consolidação Final §6 (terminologia profissional): o ponto de
      // reversão esperado é a PRZ — Potential Reversal Zone (D nos XABCD/
      // AB=CD; ponto 5 na Wolfe). EPC §4 ("apenas as iniciais... menor
      // poluição"): direção BULLISH/BEARISH vira glifo ↑/↓ (mesmo
      // vocabulário de FVG/OB/VWAP/NL) e o disclaimer "(aderência, nunca
      // probabilidade)" sai do rótulo flutuante — já vive, íntegro, no
      // título do painel Chart Patterns ("geometric fit, never
      // probability", App.tsx) — mesma disciplina de zero-repetição do
      // "(Núcleo)".
      const hDirGlyph = top.direction === "BULLISH" ? "↑" : "↓";
      mkH(top.points.D.price, `${top.pattern} ${hDirGlyph} PRZ ${(top.fitScore * 100).toFixed(0)}%`);
      if (top.pattern === "WOLFE" && typeof top.epaPrice === "number" && Number.isFinite(top.epaPrice)) {
        // §6: ETA canônica da Wolfe = ápice da cunha (cruzamento real
        // 1→3 × 2→4, etaIndex do motor). Convertida em tempo pelo
        // intervalo REAL entre as duas últimas barras carregadas — nunca
        // um mapa de timeframe paralelo. Sem ápice à frente => só a EPA,
        // sem ETA.
        const barSec = data.length >= 2 ? data[data.length - 1].time - data[data.length - 2].time : null;
        const remainingBars = typeof top.etaIndex === "number" ? top.etaIndex - (data.length - 1) : null;
        const etaLabel =
          barSec !== null && remainingBars !== null && remainingBars > 0
            ? formatEtaDuration(remainingBars * barSec * 1000)
            : null;
        // EPC §4: EPA já é a sigla profissional (Estimated Price at
        // Apex); "(linha 1→4 real)"/"(ápice da cunha)" eram descrições,
        // não dado — removidas do rótulo flutuante (o significado da
        // EPA/ETA da Wolfe continua documentado em harmonic-patterns.ts).
        mkH(top.epaPrice, `WOLFE EPA${etaLabel ? ` · ETA ${etaLabel}` : ""}`);
      }
    } else if (winner?.family === "HEAD_SHOULDERS" && headShouldersPattern) {
      const hs = headShouldersPattern;
      // Outline real LS→neckline1→Cabeça→neckline2→RS — geometricamente o
      // MESMO zigue-zague de um XABCD (5 pivôs em ordem de tempo crescente
      // por construção do motor), reusa a função acima sem nenhuma segunda
      // implementação.
      drawZigzagOutline([hs.leftShoulder, hs.neckline1, hs.head, hs.neckline2, hs.rightShoulder]);
      // Neckline real extrapolada — reta separada do outline (pode ter
      // slope diferente do segmento RS→neckline2), do 1º ponto real até o
      // último candle carregado, exatamente o valor já exposto em
      // necklineAtLastCandle.
      const necklineStartCandle = data[hs.neckline1.index];
      const lastCandle = data[data.length - 1];
      if (necklineStartCandle && lastCandle && Number.isFinite(hs.necklineAtLastCandle) && necklineStartCandle.time < lastCandle.time) {
        necklineExtensionLineRef.current?.setData([
          { time: necklineStartCandle.time as UTCTimestamp, value: hs.neckline1.price },
          { time: lastCandle.time as UTCTimestamp, value: hs.necklineAtLastCandle },
        ]);
      }
      const hsDirGlyph = hs.direction === "BULLISH" ? "↑" : "↓";
      mkH(hs.necklineAtLastCandle, `${hs.kind === "REGULAR" ? "H&S" : "INV H&S"} ${hsDirGlyph} NECKLINE ${(hs.fitScore * 100).toFixed(0)}%`);
    }

    // TRIÂNGULO — desenha sempre que o motor o encontrou, independente de
    // qual ziguezague venceu acima (justificativa completa na seleção de
    // candidatos). Fail-closed preservado: sem padrão real, as séries
    // dedicadas já foram esvaziadas no topo deste efeito.
    if (trianglePattern) {
      // Carta Branca: as 2 retas reais (mínimos quadrados) do triângulo —
      // avaliadas na PRÓPRIA reta ajustada (nunca no preço bruto do toque,
      // mesmo quando R²<1) do 1º toque real até o último candle carregado,
      // exatamente o mesmo valor já exposto em resistanceAtLastCandle/
      // supportAtLastCandle. Duas retas simultâneas no MESMO intervalo de
      // tempo — geometria diferente do zigue-zague acima, por isso 2
      // séries dedicadas em vez de reusar harmonicPolylineRef.
      const lastIndex = data.length - 1;
      const lastCandle = data[lastIndex];
      const firstRes = trianglePattern.resistancePoints[0];
      const firstSup = trianglePattern.supportPoints[0];
      const resCandle = firstRes ? data[firstRes.index] : null;
      const supCandle = firstSup ? data[firstSup.index] : null;
      if (resCandle && lastCandle && Number.isFinite(trianglePattern.resistanceAtLastCandle) && resCandle.time < lastCandle.time) {
        triangleResistanceLineRef.current?.setData([
          { time: resCandle.time as UTCTimestamp, value: trianglePattern.resistanceSlope * firstRes.index + trianglePattern.resistanceIntercept },
          { time: lastCandle.time as UTCTimestamp, value: trianglePattern.resistanceAtLastCandle },
        ]);
      }
      if (supCandle && lastCandle && Number.isFinite(trianglePattern.supportAtLastCandle) && supCandle.time < lastCandle.time) {
        triangleSupportLineRef.current?.setData([
          { time: supCandle.time as UTCTimestamp, value: trianglePattern.supportSlope * firstSup.index + trianglePattern.supportIntercept },
          { time: lastCandle.time as UTCTimestamp, value: trianglePattern.supportAtLastCandle },
        ]);
      }
      // Ápice real: no cruzamento das 2 retas, resistência e suporte valem
      // o MESMO preço por definição geométrica — número honesto mesmo sem
      // um candle futuro pra plotar o ponto (mesma técnica de EPA/ETA da
      // Wolfe: preço real conhecido agora, tempo mostrado via ETA em texto).
      if (trianglePattern.apexIndex !== null) {
        const apexPrice = trianglePattern.resistanceSlope * trianglePattern.apexIndex + trianglePattern.resistanceIntercept;
        const barSec = data.length >= 2 ? data[data.length - 1].time - data[data.length - 2].time : null;
        const remainingBars = trianglePattern.apexIndex - lastIndex;
        const etaLabel = barSec !== null && remainingBars > 0 ? formatEtaDuration(remainingBars * barSec * 1000) : null;
        const dirGlyph = trianglePattern.direction === "BULLISH" ? "↑" : trianglePattern.direction === "BEARISH" ? "↓" : "↔";
        mkH(apexPrice, `${trianglePattern.kind} ${dirGlyph} APEX ${(trianglePattern.fitScore * 100).toFixed(0)}%${etaLabel ? ` · ETA ${etaLabel}` : ""}`);
      }
    }
  }, [harmonicHits, trianglePattern, headShouldersPattern, data, visibility.harmonics]);

  // Evolução Final §5: mantém autoFitLevelsRef (lido pelo
  // autoscaleInfoProvider da série, efeito de montagem única acima)
  // sincronizado com o plano REAL ativo. MESMA prioridade Conselho > Núcleo
  // já estabelecida no useMemo de priceAxisLabels abaixo (nunca os dois ao
  // mesmo tempo — engineFallbackLevels já vem null quando tradePlan
  // existe). ENTRY fica de fora do fallback do Núcleo de propósito (mesma
  // razão do useMemo: é o preço vivo, já coberto por livePrice abaixo).
  useEffect(() => {
    const p = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : null;
    if (tradePlan) {
      autoFitLevelsRef.current = {
        entryLow: tradePlan.entry.low,
        entryHigh: tradePlan.entry.high,
        stopPrice: tradePlan.stop.price,
        targetPrices: tradePlan.targets.map((t) => t.price),
        livePrice: p,
      };
    } else if (engineFallbackLevels) {
      autoFitLevelsRef.current = {
        entryLow: null,
        entryHigh: null,
        stopPrice: engineFallbackLevels.stop,
        targetPrices: [engineFallbackLevels.target1, engineFallbackLevels.target2, engineFallbackLevels.target3].filter(
          isFiniteNum,
        ),
        livePrice: p,
      };
    } else {
      autoFitLevelsRef.current = { entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [], livePrice: p };
    }
  }, [tradePlan, engineFallbackLevels, livePrice]);

  // Signal Precision order: the Trade Plan drawn on the chart — subtle,
  // silk-thread annotations (1px solid, never dashed; hierarchy only via
  // color/opacity). Entry zone = two lines bounding the real structure
  // (one line when the zone is a zero-width level); Stop and Target lines.
  // Fail-closed: no plan, no lines.
  //
  // "bater o olho profissional" (pendência honesta do turno anterior): os
  // RÓTULOS de ENTRY/STOP/TARGET migraram para priceAxisLabels — o MESMO
  // sistema anti-colisão de S1/R1/VWAP/NL/EMA/último preço/Trend Channel.
  // Antes eram os ÚNICOS rótulos ainda no eixo NATIVO da lib
  // (axisLabelVisible:true), sem NENHUMA consciência da posição dos
  // outros; podiam sobrepor exatamente quando um plano ativo tem níveis
  // perto de S1/R1/VWAP (o pior caso que o Operador mais precisa ler
  // limpo). axisLabelVisible:false aqui: a LINHA horizontal continua
  // desenhada (mesmo padrão de S1/R1), só o tag de eixo muda de dono.
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    tradePlanLinesRef.current.forEach((line) => series.removePriceLine(line));
    tradePlanLinesRef.current = [];
    stopLineRef.current = null;
    targetLinesArrayRef.current = [];
    if (!tradePlan) return;

    const mk = (price: number, color: string) => {
      if (!Number.isFinite(price)) return null;
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: false,
        title: "",
      });
      tradePlanLinesRef.current.push(line);
      return line;
    };
    const entryColor = "rgba(240, 193, 111, 0.75)"; // amber — the acceptance zone
    if (tradePlan.entry.low === tradePlan.entry.high) {
      mk(tradePlan.entry.low, entryColor);
    } else {
      mk(tradePlan.entry.high, entryColor);
      mk(tradePlan.entry.low, "rgba(240, 193, 111, 0.45)");
    }
    // Achado real de 6 screenshots do Operador (iPad + Desktop, BTC/ZEC):
    // stop/targets/preço vivo ainda no par neon universal (#f23645/
    // #089981, canvas-palette.ts) — o MESMO par que candles/grid/crosshair
    // já deixaram pra trás na Fase 1 (convergência TradingView aprovada
    // pelo Operador). canvas-palette.ts documenta que esse par é
    // deliberado em ~10 arquivos (BOS/CHOCH, FVG/OB, sweep, sessões) —
    // este não é esse caso: aqui é especificamente o Trade Plan/preço
    // vivo, o mesmo recorte estreito que a Fase 1 já abriu (só o que 3
    // documentos + screenshots reais evidenciaram, nunca um reskin do
    // app inteiro). #F23645/#089981 = MESMA cor real de down/up já usada
    // pelas velas — alinhamento, não uma 3ª paleta nova.
    stopLineRef.current = mk(tradePlan.stop.price, "rgba(242, 54, 69, 0.75)");
    // v2 (Diretriz Complementar §2): uma linha por alvo real (1 a
    // MAX_TARGETS) — nunca uma linha única fixa.
    tradePlan.targets.forEach((target) => {
      const line = mk(target.price, "rgba(8, 153, 129, 0.75)");
      if (line) targetLinesArrayRef.current.push(line);
    });
  }, [tradePlan]);

  // EPC §5/§6 (continuação — relato direto do Operador: "falta aparecer
  // entrada e alvo/alvo2/alvo3 no gráfico"): STOP/TARGET1/TARGET2 do Core
  // Engine (LEI 24) quando o Trade Plan do Conselho ainda não confirma.
  // Mesmo padrão Fio de Seda (lineWidth:1 solid) das linhas acima — cores
  // mais apagadas (alpha menor) sinalizam honestamente "fonte diferente,
  // mais provisória" sem quebrar a Regra de Ouro 5 (zero linha tracejada).
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    engineFallbackLinesRef.current.forEach((line) => series.removePriceLine(line));
    engineFallbackLinesRef.current = [];
    if (!engineFallbackLevels) return;

    const mk = (price: number, color: string) => {
      if (!Number.isFinite(price)) return null;
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: false,
        title: "",
      });
      engineFallbackLinesRef.current.push(line);
      return line;
    };
    mk(engineFallbackLevels.stop, "rgba(242, 54, 69, 0.5)");
    mk(engineFallbackLevels.target1, "rgba(8, 153, 129, 0.5)");
    if (engineFallbackLevels.target2 !== null) mk(engineFallbackLevels.target2, "rgba(8, 153, 129, 0.35)");
    if (engineFallbackLevels.target3 != null) mk(engineFallbackLevels.target3, "rgba(8, 153, 129, 0.2)");
  }, [engineFallbackLevels]);

  // Ordem Final Autonomia Evolução §1 + Diretriz Complementar §2/§4:
  // "alertas visuais sutis quando o preço romper estrutura relevante" — the
  // chart-side counterpart to the command bar's TARGET REACHED/STOP
  // BREACHED tone shift (TradePlanTopStrip in App.tsx). Deliberately a
  // SEPARATE, lightweight effect: applyOptions() nudges color/title on the
  // lines already created above in place — it never removes/recreates the
  // trade-plan lines on every WebSocket tick the way the [tradePlan]
  // effect above does on a real plan change. Regra de Ouro 2 ("fio de
  // seda"): hierarchy stays color/opacity-only — lineWidth and lineStyle
  // are never touched here.
  //
  // v2: "REACHED" is driven by the AUTHORITATIVE targetsHit prop (the real
  // ratchet from signal-track-record.ts), never re-derived from the
  // instantaneous livePrice alone — a target once proven stays marked
  // REACHED even if price later pulls back below it (re-deriving from
  // livePrice would flip the marker back off, which is dishonest: the
  // level WAS touched). The stop line itself ratchets forward the instant
  // targetsHit > 0 — break-even after the 1st real target, then the
  // PREVIOUS target's price after each subsequent one (§18 "trailing stop
  // além do break-even") — via effectiveStopForTargetsHit(), the SAME
  // single real source the track record uses internally, never a second
  // formula here. "Quando o cenário muda, o desenho muda" (Diretriz
  // Complementar §5).
  // Este efeito agora cuida SÓ da geometria/cor da LINHA horizontal: o
  // stop RATCHEA de posição (break-even → trailing) via
  // effectiveStopForTargetsHit e brilha quando o preço vivo rompe; cada
  // alvo brilha quando ATINGIDO (targetsHit autoritativo, nunca
  // re-derivado do livePrice instantâneo). O RÓTULO (texto ENTRY/STOP/
  // TARGET + REACHED/BREACHED + distância %/ETA/compactação) vive em
  // priceAxisLabels (useMemo abaixo, mesmo sistema anti-colisão dos
  // demais níveis) — computado das MESMAS funções puras e MESMOS inputs
  // reais, então linha e rótulo nunca divergem. applyOptions() atualiza a
  // linha JÁ criada acima, nunca a recria a cada tick (Regra de Ouro 6:
  // caminho quente do gráfico). Hierarquia só por cor/opacidade (Regra de
  // Ouro 2) — lineWidth/lineStyle nunca tocados aqui.
  useEffect(() => {
    if (!tradePlan) return;
    const hits = targetsHit ?? 0;
    const effectiveStopPrice = effectiveStopForTargetsHit(tradePlan, hits);
    const p = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : null;
    const long = tradePlan.direction === "LONG";
    const stopHitNow = p !== null && (long ? p <= effectiveStopPrice : p >= effectiveStopPrice);
    stopLineRef.current?.applyOptions({
      price: effectiveStopPrice,
      color: stopHitNow ? "rgba(242, 54, 69, 1)" : "rgba(242, 54, 69, 0.75)",
    });
    tradePlan.targets.forEach((_target, i) => {
      const line = targetLinesArrayRef.current[i];
      if (!line) return;
      const reached = i < hits;
      line.applyOptions({
        color: reached ? "rgba(8, 153, 129, 1)" : "rgba(8, 153, 129, 0.75)",
      });
    });
  }, [tradePlan, livePrice, targetsHit]);

  // Evolução Profunda §8/§9: auditoria confirmou que a ordem de montagem
  // abaixo (cada plugin comentado individualmente desde suas próprias
  // diretrizes) já corresponde, na prática, aos 4 níveis de prioridade
  // visual pedidos — nenhuma sobreposição real encontrada, então a ordem
  // NÃO foi alterada (§12: "preservar o que já está provado"). Mapa
  // documentado aqui pela primeira vez, para a leitura ficar explícita:
  //   Nível 1 (PRINCIPAL) — velas + VWAP/EMA/Nexus Line: séries NATIVAS do
  //     lightweight-charts (não plugins deste array), vivem no próprio
  //     pane do gráfico — sempre acima de qualquer plugin em div overlay.
  //   Nível 2 (RISCO) — TradePlanZonePlugin (entrada/stop/TPs): montado
  //     POR ÚLTIMO neste array de propósito (comentário original abaixo),
  //     portanto o overlay-div mais acima de todos os outros.
  //   Nível 3 (CONTEXTO) — LiquidityZonesPlugin (FVG/OB), VolumeProfilePlugin,
  //     StructureBreakMarkersPlugin: estrutura/S-R/liquidez, no meio da pilha.
  //   Nível 4 (AUXILIAR) — OrderFlowHeatmapPlugin: montado PRIMEIRO
  //     (comentário original abaixo) — fica atrás das velas de propósito, o
  //     mesmo padrão institucional (Bookmap-style) já documentado; Neural
  //     Market Aura também é Nível 4 (gradiente de fundo, nunca compete
  //     visualmente — ver comentário próprio abaixo).
  // Harmônicos/Wolfe/ETA/Heat/Score vivem como price lines/títulos no
  // próprio pane nativo (fio de seda), não neste array de plugins.
  //
  // Nível 0 (NOVO, acima de tudo — achado real de captura de tela do
  // Operador): PriceLabelStackPlugin. Os rótulos de S1/R1/VWAP/NL/EMA/
  // último preço eram "last value label"/"axis label" NATIVOS — sempre
  // acima de qualquer plugin em div overlay, por definição do Nível 1
  // documentado acima. Ao substituí-los por um overlay próprio (única
  // forma de resolver colisão entre eles — a lib não tem essa
  // consciência cross-série), o overlay precisa ficar acima de TODOS os
  // outros plugins (inclusive TradePlanZonePlugin, Nível 2) pra manter a
  // MESMA garantia de "sempre legível" que os rótulos nativos já tinham.
  // useMemo (não construído direto no corpo do render): mesma disciplina
  // de dirty-flag do resto do gráfico — PriceLabelStackPlugin só reagenda
  // um redraw real quando a referência de `labels` muda, então uma nova
  // array a cada render (por um re-render não relacionado, ex.:
  // harmonicHits mudando) nunca deveria disparar um redraw à toa.
  // Pedido do Operador ("Key Levels"): a sessão CORRENTE real (sempre a
  // última de computeSessionKeyLevels quando `data` não está vazio —
  // closed:false por construção) alimenta o rótulo de eixo abaixo. Mesmo
  // princípio de "recomputa só quando data muda de verdade" que
  // SessionKeyLevelsPlugin já usa via cache por referência — aqui é um
  // useMemo React puro e simples porque não roda dentro de um loop rAF.
  const currentSessionKeyLevel = useMemo(() => {
    if (data.length === 0) return null;
    const levels = computeSessionKeyLevels(data);
    return levels.length > 0 ? levels[levels.length - 1] : null;
  }, [data]);

  const priceAxisLabels = useMemo<PriceAxisLabel[]>(() => {
    const out: PriceAxisLabel[] = [];
    // Achado real do Operador ("tá ficando só numa lateral direita...
    // qual forma mais inteligente... mais profissional"): pesquisa real
    // (Lightweight Charts documenta price scales nativas nos dois lados;
    // TradingView Supercharts permite até 8) confirma que dividir rótulos
    // entre os dois lados é prática profissional real. Critério de
    // divisão, pensado como um trader pensaria: lado DIREITO (onde o olho
    // já rastreia o preço ao vivo) = "o que eu ajo AGORA" — VWAP/NL/EMA
    // (referências dinâmicas, recalculadas a cada candle) + ENTRY/STOP/
    // TARGET (o plano ativo, Conselho ou Núcleo). Lado ESQUERDO = "o mapa
    // estrutural" — S1/R1 (limites da faixa atual, mudam devagar), Trend
    // Channel (contexto de tendência) e BOS/CHOCH (evento HISTÓRICO, já
    // esmaecendo com a idade — o menos urgente de todos, candidato ideal
    // pro lado secundário). Resultado real: o lado direito cai de até 12
    // caixas possíveis para até 8 — redução real de densidade, não só
    // estética.
    // Carta Branca ("etiquetas laterais... só mostrar a precisão maciça"):
    // achado real de auditoria — este rótulo aparecia sempre que support/
    // resistance era finito, sem checar a própria FORÇA real que
    // computeLevelStrength (support-resistance-engine.js) já calcula
    // (touches conta o próprio nível a si mesmo, então "FRACA" aqui
    // significa literalmente "nenhum OUTRO swing independente confirmou
    // esta zona ainda" — o caso genuinamente menos preciso). Gate real
    // agora: só FORTE (>=2 toques independentes, STRONG_TOUCH_THRESHOLD)
    // ganha etiqueta no eixo — "precisão maciça" de verdade, não presença.
    // Regra de Ouro 4: a LINHA nativa (useEffect acima, supportLineRef/
    // resistanceLineRef) e o valor real de support/resistance (usado pelo
    // Core Engine/StructureLevelsStrip/etc.) continuam INTOCADOS — só a
    // etiqueta flutuante do eixo fica mais rigorosa, nunca o dado.
    // Ordem "FECHAMENTO DO AR10 CYBORG" §3 (hierarquia de 3 níveis): o
    // NOME do nível + o VALOR são Nível 1 ("essencial"); força/toques/
    // rompimentos são Nível 2 ("qualidade") — mesma informação real, peso
    // visual menor. levelTitle() continua sendo a fonte única desse texto
    // (zero segunda formatação): só o que era prefixo do primário virou
    // segmento secundário, via a mesma função.
    if (Number.isFinite(support) && supportStrength?.label === "FORTE") {
      out.push({
        price: support as number,
        text: `S1 ${fmtAxisLabelPrice(support as number)}`,
        secondaryText: levelTitle("", supportStrength, supportBreakouts).trim() || undefined,
        // Achado 2.3: mesma cor real da LINHA (useEffect acima) — nunca
        // uma segunda leitura de alpha, o rótulo só reflete o peso já
        // resolvido pelo orçamento visual.
        color: `rgba(245, 158, 11, ${levelLineAlpha(supportVisualWeight).toFixed(3)})`,
        side: "left",
      });
    }
    if (Number.isFinite(resistance) && resistanceStrength?.label === "FORTE") {
      out.push({
        price: resistance as number,
        text: `R1 ${fmtAxisLabelPrice(resistance as number)}`,
        secondaryText: levelTitle("", resistanceStrength, resistanceBreakouts).trim() || undefined,
        color: `rgba(245, 158, 11, ${levelLineAlpha(resistanceVisualWeight).toFixed(3)})`,
        side: "left",
      });
    }
    // Auditoria de pendências (achado real via harness Playwright): as 3
    // linhas abaixo já escondiam a SÉRIE nativa (applyOptions visible)
    // quando a camada era desligada, mas a ETIQUETA do eixo (aqui) nunca
    // checava o mesmo visibility — esconder VWAP/NL/EMA no painel deixava
    // a série invisível, mas a caixa "VWAP • 63951.81"/"NL • .../"EMA 21
    // ..." continuava aparecendo no eixo como se nada tivesse mudado.
    if (visibility.vwap && vwapLastValue !== null && Number.isFinite(vwapLastValue)) {
      const s: DirectionalLineState = vwapState ?? "NEUTRAL";
      out.push({ price: vwapLastValue, text: `V ${LINE_STATE_GLYPH[s]}${fmtAxisLabelPrice(vwapLastValue)}`, color: VWAP_STATE_COLOR[s] });
    }
    if (visibility.nexus_line && nlLastValue !== null && Number.isFinite(nlLastValue)) {
      const s: DirectionalLineState = nexusLineState ?? "NEUTRAL";
      out.push({ price: nlLastValue, text: `NL ${LINE_STATE_GLYPH[s]}${fmtAxisLabelPrice(nlLastValue)}`, color: NL_STATE_COLOR[s] });
    }
    if (visibility.ema && emaLastValue !== null && Number.isFinite(emaLastValue)) {
      out.push({ price: emaLastValue, text: `E${activeEmaPeriod} ${fmtAxisLabelPrice(emaLastValue)}`, color: "rgba(6, 85, 212, 0.85)" });
    }
    const lastCandle = data.length > 0 ? data[data.length - 1] : null;
    if (lastCandle && Number.isFinite(lastCandle.close)) {
      // Achado real de captura de tela do Operador (BTC/USDT 1H ao vivo):
      // este rótulo (antes sempre lastCandle.close) ficava atrás do preço
      // real — patchLastCandleWithLiveTick (live-candle-sync.ts) só
      // atualiza a vela RENDERIZADA via series.update() (deliberado:
      // SMC/Fibonacci/Volume Profile não podem recomputar a cada tick de
      // preço), nunca escreve de volta no array `data`. A barra superior
      // seguia ao vivo enquanto este rótulo congelava no último
      // REST/kline — dois números diferentes reivindicando "o preço
      // atual" ao mesmo tempo (~30s de defasagem possível, o intervalo
      // real do poll REST). livePrice já chega como prop (mesma fonte do
      // patch da vela acima) — preferido aqui, com fallback pro close da
      // vela só quando ainda não existe nenhum tick real (fail-closed,
      // carregamento inicial).
      //
      // Gap FECHADO (Ordem "Unificação da Inteligência Operacional" §4):
      // até aqui, TopBar lia `priceData` (estado React direto, App.tsx)
      // por prop, enquanto `livePrice` vinha de `usePriceSnapshot()`, um
      // espelho Zustand do MESMO `priceData` escrito um commit de render
      // DEPOIS (App.tsx, efeito `[priceData]`) — dois caminhos com timing
      // diferente para o mesmo dado real. ChartWidget (App.tsx) agora
      // recebe `priceData` como prop e deriva `livePrice` dele
      // diretamente (useMemo por valor, zero segundo hop) — TopBar e este
      // rótulo vêm sempre do mesmo commit de render agora.
      const displayPrice = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : lastCandle.close;
      out.push({
        price: displayPrice,
        text: fmtAxisLabelPrice(displayPrice),
        color: displayPrice >= lastCandle.open ? "#089981" : "#F23645",
        // ÚNICA etiqueta do eixo que declara tier explicitamente (todo o
        // resto deriva do side): é a âncora de leitura do gráfico —
        // maior, em negrito, com anel fino, nunca podada — e também a
        // referência de proximidade que decide QUAIS níveis estruturais
        // valem um chip agora (ver selectRelevantLabels em
        // price-label-stack.ts). Achado real de captura do Operador: sem
        // essa âncora, 11 etiquetas de mesmo peso deixavam o gráfico sem
        // ponto de partida para o olho.
        tier: "live",
      });
    }
    // Diretriz de Refinamento Visual §5: o Trend Channel volta a ser uma
    // camada identificável do eixo de preço — mesmo tratamento de R1/NL/
    // VWAP/EMA/S1 acima, mesmo sistema anti-colisão (nunca mais um <div>
    // solto competindo com o cabeçalho ou flutuando sem relação com
    // nenhum nível real). Respeita visibility.trend_channel como sempre
    // (a camada continua controlável no painel); ancorado na PONTA real
    // da linha mid (o mesmo preço que a própria linha termina).
    if (visibility.trend_channel && trendChannelInfo) {
      out.push({
        price: trendChannelInfo.midPrice,
        // Achado real do Operador: ASCENDING/DESCENDING (9-10 letras) vira
        // ↑/↓ — mesmo padrão de VWAP/NL. OLS/janela/σ continuam intactos:
        // é a ÚNICA leitura visível deles em todo o app (grep confirma),
        // remover seria apagar dado real (Regra de Ouro 4), não simplificar.
        // Ordem "FECHAMENTO" §3: era a etiqueta MAIS LARGA do eixo inteiro
        // (~34 caracteres num único peso). Nível 1 = nome + direção +
        // valor; Nível 2 = os PARÂMETROS DO MÉTODO (janela OLS, σ), que
        // são exatamente "informação complementar" na hierarquia da Ordem
        // — continuam visíveis, agora em fonte menor.
        text: `TREND ${TREND_DIRECTION_GLYPH[trendChannelInfo.direction]} ${fmtAxisLabelPrice(trendChannelInfo.midPrice)}`,
        secondaryText: `OLS ${trendChannelInfo.windowSize} ±${TREND_CHANNEL_STDDEV_MULTIPLIER}σ`,
        color: "rgba(148, 163, 184, 0.55)",
        side: "left",
      });
    }
    // Achado real, task #341 (auditoria "Estratégia de Evolução Elite"):
    // POC (Volume Profile e TPO Profile), Value Area High/Low e Initial
    // Balance High/Low nunca tinham rótulo de preço legível — só a
    // LINHA colorida, sem número, diferente de todo outro nível real
    // deste eixo. Mesma família visual de S1/R1/Trend Channel acima
    // (side:"left", mapa estrutural, nunca "acionável agora"). Cores
    // reutilizadas exatamente das próprias linhas que cada plugin já
    // desenha (Regra de Ouro: nunca uma cor nova) — VPOC/TPOC
    // deliberadamente distintos (nunca ambos "POC") porque as duas linhas
    // agora coexistem na mesma lane desde a correção de colisão desta
    // sessão (chart-profile-lanes.ts) e um rótulo ambíguo seria pior que
    // nenhum rótulo.
    if (visibility.volume_profile && Number.isFinite(volumeProfile?.fixedRange?.pocPrice)) {
      out.push({
        price: volumeProfile!.fixedRange!.pocPrice,
        text: `VPOC ${fmtAxisLabelPrice(volumeProfile!.fixedRange!.pocPrice)}`,
        color: "rgba(236, 81, 205, 0.75)", // mesma cor de POC_LINE em VolumeProfilePlugin.tsx
        side: "left",
      });
    }
    if (visibility.tpo_profile && tpoProfileForLabels) {
      out.push({
        price: tpoProfileForLabels.pocPrice,
        text: `TPOC ${fmtAxisLabelPrice(tpoProfileForLabels.pocPrice)}`,
        color: "rgba(240, 193, 111, 0.85)", // mesma cor de POC_LINE em TpoProfilePlugin.tsx
        side: "left",
      });
      out.push({
        price: tpoProfileForLabels.valueAreaHighPrice,
        text: `VAH ${fmtAxisLabelPrice(tpoProfileForLabels.valueAreaHighPrice)}`,
        // Mesma família azul-neutra já usada pelas barras do TPO
        // (ROW_FILL/ROW_FILL_VALUE_AREA) — nunca existiu como LINHA antes
        // desta etiqueta, então não há um traço prévio pra copiar; reusa
        // a identidade de cor já estabelecida do próprio perfil TPO
        // (deliberadamente NUNCA o cyan do Volume Profile, mesmo
        // raciocínio já documentado no cabeçalho de TpoProfilePlugin.tsx).
        color: "rgba(138, 180, 248, 0.65)",
        side: "left",
      });
      out.push({
        price: tpoProfileForLabels.valueAreaLowPrice,
        text: `VAL ${fmtAxisLabelPrice(tpoProfileForLabels.valueAreaLowPrice)}`,
        color: "rgba(138, 180, 248, 0.65)",
        side: "left",
      });
      // Initial Balance só quando os 2 primeiros períodos já fecharam de
      // verdade (mesmo gate real de TpoProfilePlugin.tsx) — um IB parcial
      // nunca é rotulado como se fosse final.
      if (tpoProfileForLabels.initialBalanceComplete) {
        out.push({
          price: tpoProfileForLabels.initialBalanceHigh,
          text: `IBH ${fmtAxisLabelPrice(tpoProfileForLabels.initialBalanceHigh)}`,
          color: "rgba(242, 54, 69, 0.5)", // mesma cor de IB_HIGH em TpoProfilePlugin.tsx
          side: "left",
        });
        out.push({
          price: tpoProfileForLabels.initialBalanceLow,
          text: `IBL ${fmtAxisLabelPrice(tpoProfileForLabels.initialBalanceLow)}`,
          color: "rgba(8, 153, 129, 0.5)", // mesma cor de IB_LOW em TpoProfilePlugin.tsx
          side: "left",
        });
      }
    }
    // Achado real (Visual Cleanup, pedido do Operador "a Fibonacci... bem
    // detalhada"): as 5 linhas de Fibonacci (acima, useEffect próprio)
    // desenham com axisLabelVisible:false e NUNCA entravam neste array —
    // o `title` nativo ("FIB 61.8% ×2") nunca aparecia em lugar nenhum da
    // tela (nem eixo, nem hover — hover não existe neste app, ver
    // price-label-stack.ts). Mesmo gap de classe já fechado para POC/VAH/
    // VAL/IB (task #341) e WALL (task #285): uma linha de preço real sem
    // nenhum número legível. Gate real (nunca todas as 5 de uma vez —
    // isso inundaria o teto de 3 rótulos de contexto só com Fibonacci):
    // só os níveis com confluência REAL (score > 0, o mesmo score que já
    // decide a opacidade da linha) competem por um rótulo — nível sem
    // nenhuma fonte real de acordo permanece uma linha discreta sem
    // etiqueta, honesto (Regra de Ouro 3: score 0 é comum, nunca fabrica
    // confluência pra caber um rótulo).
    // Achado 2.7 (pedido do Operador "a Fibonacci tem de ficar diferenciada
    // pra gente saber qual as linha dela"): o gate acima deixava os níveis
    // PRIMÁRIOS (61.8% razão áurea / 50% ponto médio) mudos sempre que não
    // tivessem confluência de outra ferramenta — exatamente as 2 linhas que
    // o Operador precisa identificar primeiro ficavam sem número. Agora
    // primário sempre compete por rótulo; raso continua exigindo confluência
    // real (fibDeservesAxisLabel). Quem de fato aparece continua sendo
    // decidido pelo anti-colisão por proximidade ao preço vivo, não aqui.
    if (visibility.fibonacci) {
      (fibonacciLevels ?? []).forEach((level, i) => {
        if (!Number.isFinite(level.price)) return;
        if (!fibDeservesAxisLabel(level.ratio, level.score)) return;
        out.push({
          price: level.price,
          text: `FIB ${(level.ratio * 100).toFixed(1)}%${level.score > 0 ? ` ×${level.score}` : ""}`,
          // Mesmo alpha real da LINHA correspondente (fibLineAlpha sobre o
          // mesmo peso resolvido) — rótulo e linha nunca divergem, mesma
          // disciplina já aplicada a S1/R1 no Achado 2.3.
          color: `rgba(0, 98, 255, ${fibLineAlpha(fibonacciVisualWeights[i] ?? null).toFixed(3)})`,
          side: "left",
        });
      });
    }
    // "bater o olho profissional" (pendência honesta do turno anterior): os
    // rótulos de ENTRY/STOP/TARGET entram no MESMO array/sistema
    // anti-colisão dos demais níveis — nunca mais o eixo NATIVO, que os
    // deixava sobrepor S1/R1/VWAP quando um plano ativo tem níveis
    // próximos. Cores reais já usadas pelas LINHAS acima (âmbar=entrada,
    // vermelho=stop, verde=alvo) — leitura instantânea de ENTRY LONG/SHORT/
    // STOP/TARGET pela cor da caixa. O texto/estado (REACHED/BREACHED,
    // distância %/ETA, compactação) é IDÊNTICO ao que a lib desenhava,
    // computado das MESMAS funções puras (effectiveStopForTargetsHit,
    // shouldCompactLabels, formatEtaRange) e MESMOS inputs reais que o
    // efeito da LINHA acima — linha e rótulo nunca divergem. Fail-closed:
    // sem plano, zero rótulos (early guard de cada push por Number.isFinite).
    // OMEGA CORE V-MAX Fase 4 (§4.2/§4.4 — auditoria "Bate-Olho"): achado
    // real — esta função só existia dentro do bloco engineFallbackLevels
    // abaixo, então o Trade Plan REAL do Conselho nunca mostrava a
    // contagem de obstáculos no rótulo do alvo (só a zona destacada no
    // LiquidityZonesPlugin a exibia). Hoisted para o escopo externo — os
    // DOIS blocos agora reusam a MESMA função, zero duplicação (antes
    // havia uma cópia idêntica só dentro do bloco do fallback).
    const obstacleSuffix = (n: number | null | undefined) => (typeof n === "number" && n > 0 ? ` ⚠ ${n}` : "");
    if (tradePlan) {
      const hits = targetsHit ?? 0;
      const p = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : null;
      const long = tradePlan.direction === "LONG";
      const entryColor = "rgba(240, 193, 111, 0.75)";
      // EPC FINAL §8 ("Objetos Inteligentes"): nomenclatura curta e
      // padronizada pedida explicitamente — EN/ST/TP1/TP2/TP3 nos OBJETOS
      // GRÁFICOS do canvas (aqui). A barra de comando (BarField "Entry
      // Zone"/"Stop"/"Target", App.tsx) NÃO é tocada por este achado: já
      // passou por um "Redesenho radical" anterior — pedido explícito do
      // Operador — trocando "E/S/T" cramped por rótulos legíveis; reverter
      // isso sem pedido novo desfaria uma decisão real já tomada.
      // tier:"critical" (Ordem "Lapidação Visual Final e Sincronia
      // Operacional" §3, Nível A — "AGORA"): EN/ST/TP são o plano ATIVO,
      // não uma referência como VWAP/EMA (Nível B) — precisam da mesma
      // caixa grande/negrito que o preço vivo usa, sem competir peso
      // visual com o resto do eixo direito.
      // Ordem "FECHAMENTO" §3: Nível 1 = "EN + direção" (o que o Operador
      // precisa ler de relance); Nível 2 = o MOTIVO estrutural da entrada
      // (basis) — a Ordem lista "motivo" explicitamente como Nível 2.
      // Zero dado apagado: o basis continua sempre visível, em fonte menor.
      if (tradePlan.entry.low === tradePlan.entry.high) {
        if (Number.isFinite(tradePlan.entry.low)) {
          out.push({ price: tradePlan.entry.low, text: `EN ${tradePlan.direction}`, secondaryText: tradePlan.entry.basis, color: entryColor, tier: "critical" });
        }
      } else {
        if (Number.isFinite(tradePlan.entry.high)) {
          out.push({ price: tradePlan.entry.high, text: `EN ${tradePlan.direction}`, secondaryText: tradePlan.entry.basis, color: entryColor, tier: "critical" });
        }
        if (Number.isFinite(tradePlan.entry.low)) {
          out.push({ price: tradePlan.entry.low, text: "EN", secondaryText: "ZONE LOW", color: entryColor, tier: "critical" });
        }
      }
      // Stop no preço EFETIVO (ratchet real, MESMA função pura do efeito da
      // linha) — BREACHED quando o preço vivo já rompeu (fail-closed:
      // preço não-finito nunca resolve BREACHED).
      const effectiveStopPrice = effectiveStopForTargetsHit(tradePlan, hits);
      if (Number.isFinite(effectiveStopPrice)) {
        const stopHitNow = p !== null && (long ? p <= effectiveStopPrice : p >= effectiveStopPrice);
        // Ordem "Lapidação das Etiquetas TP1/TP2" §3/§4: PRIMÁRIO = só "ST"
        // (a própria etiqueta já diz o que é — o preço no eixo já é o
        // valor); SECUNDÁRIO = motivo/estado, fonte menor — mesma
        // informação, sem competir peso visual com o rótulo em si.
        const stopSecondary = hits >= 2
          ? `TRILHADO (alvo ${hits - 1})`
          : hits > 0
            ? `BREAK-EVEN (real)`
            : tradePlan.stop.basis;
        out.push({
          price: effectiveStopPrice,
          text: "ST",
          secondaryText: stopHitNow ? `${stopSecondary} BREACHED` : stopSecondary,
          color: "rgba(242, 54, 69, 0.75)",
          tier: "critical",
        });
      }
      // Continuidade §6: níveis apertados => rótulos compactos (WIDTH); o
      // resolvedor de colisão já cuida da separação VERTICAL. O stop
      // EFETIVO entra na medição (o ratchet pode encostá-lo num alvo real).
      const levels = [effectiveStopPrice, ...tradePlan.targets.map((t) => t.price)].sort((a, b) => a - b);
      const compactLabels = shouldCompactLabels(levels);
      tradePlan.targets.forEach((target, i) => {
        if (!Number.isFinite(target.price)) return;
        const reached = i < hits;
        const rr = tradePlan.riskRewardRatios[i];
        // EPC FINAL §8: TP1/TP2/TP3 sempre numerado (mesmo com 1 alvo só) —
        // a mesma convenção pedida, sem distinção "singular vs plural".
        // Ordem "Lapidação das Etiquetas TP1/TP2" §3/§4/§11 (achado real
        // de captura: "TP1 FRACA · 0.34% · 1:0.04 · REACHED" ocupava uma
        // faixa horizontal grande sobre as velas — o problema não era o
        // tamanho da fonte, era description/estado com o MESMO peso do
        // rótulo+valor). PRIMÁRIO = label + distância (prioridades 3/4 da
        // Ordem — "onde fica o alvo"); SECUNDÁRIO = basis/R:R/ETA/
        // obstáculo/REACHED (prioridades 5/6 — "descrição/força/status"),
        // sempre presente, nunca apagado — só menor e mais discreto
        // (PriceLabelStackPlugin desenha em fonte reduzida + opacidade
        // menor). compactLabels continua controlando SÓ se basis/R:R
        // entram no secundário (mesma regra de sempre: níveis apertados
        // não cabem o detalhe completo); ETA/obstáculo/REACHED sempre
        // aparecem quando reais, nos dois modos.
        const fusedTarget = decision?.plan?.targets[i];
        const etaLabel =
          fusedTarget && Math.abs(fusedTarget.price - target.price) < Math.max(1e-9, target.price * 1e-9)
            ? formatEtaRange(fusedTarget.etaMsMin, fusedTarget.etaMs)
            : null;
        const secondaryParts = [
          // Pedido do Operador, repetido em duas rodadas com capturas reais:
          // "deixar só as iniciais, não precisa aquela numeração na frente
          // NEM A PORCENTAGEM". A primeira tentativa só desceu a distância
          // para o secundário — e ela continuou aparecendo na tela
          // (TP1 3.14% FRACA 1:0.42 na captura de ZEC 4H). Agora sai do
          // canvas de vez.
          //
          // Regra de Ouro 4 (nunca apagar dado real, só realocar) está
          // satisfeita e já estava ANTES desta mudança: a distância
          // percentual até cada alvo é renderizada no painel do Trade Plan
          // (App.tsx, linha do target: preço, basis, PORCENTAGEM, R:R, ETA
          // e obstáculos). O canvas deixa de repetir o que o painel já diz
          // — o mesmo princípio que tirou o motivo de ausência daqui.
          compactLabels ? null : target.basis,
          compactLabels || rr === null ? null : `1:${rr.toFixed(2)}`,
          etaLabel ? `ETA ${etaLabel}` : null,
          obstacleSuffix(target.obstacleCount).trim() || null,
          reached ? "REACHED" : null,
        ].filter((v): v is string => v !== null);
        out.push({
          price: target.price,
          text: `TP${i + 1}`,
          secondaryText: secondaryParts.length > 0 ? secondaryParts.join(" ") : undefined,
          color: "rgba(8, 153, 129, 0.75)",
          tier: "critical",
        });
      });
    }
    // EPC §5/§6 (continuação): rótulos do fallback do Core Engine — MESMO
    // sistema anti-colisão, "(Núcleo)" no texto deixa explícito que é uma
    // fonte diferente do Trade Plan do Conselho acima (nunca os dois ao
    // mesmo tempo: engineFallbackLevels já vem null quando tradePlan
    // existe). REACHED/BREACHED aqui é derivação simples do preço vivo
    // contra o nível — não usa o ratchet effectiveStopForTargetsHit nem o
    // Track Record autoritativo (signal-track-record.ts), que rastreiam
    // especificamente o Trade Plan do Conselho; misturar os dois
    // conflaria dois planos distintos.
    if (engineFallbackLevels) {
      const longFb = engineFallbackLevels.direction === "LONG";
      const p = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : null;
      // Achado real do Operador ("nome Grandão, um monte de letra... mais
      // padrão, mais profissional"): "(Núcleo)" repetido em CADA rótulo
      // (STOP/TARGET1/TARGET2) era redundante — o overlay do canto
      // superior esquerdo (tradePlanAbsenceReason) já deixa "linhas
      // abaixo são do Núcleo" explícito UMA vez, persistente enquanto o
      // fallback estiver ativo (nunca some sozinho). Removido daqui —
      // zero informação perdida, só zero repetição (Regra de Ouro 4). A
      // distinção visual real continua existindo: cor mais opaca/apagada
      // (0.5/0.35) que o Trade Plan do Conselho (0.75) sempre teve.
      // strengthSuffix também alinhado ao estilo tight de levelTitle()
      // (S1/R1 acima) — espaço, nunca "·", mesmo padrão em todo o eixo.
      const strengthSuffix = (s: { label: "FORTE" | "FRACA"; touches: number } | null) => (s ? ` ${s.label}` : "");
      // EPC MODO ELITE §4 ("Obstáculos estruturais" na lista permanente):
      // sufixo compacto "⚠ N" (mesmo glifo ⚠ da zona destacada no
      // LiquidityZonesPlugin), só quando há obstáculo real no caminho —
      // zero quando livre. obstacleSuffix agora vem do escopo externo
      // (Fase 4: hoisted para ser reusado pelo Trade Plan REAL acima
      // também, ver comentário na declaração).
      // tier:"critical" (Ordem "Lapidação Visual Final e Sincronia
      // Operacional" §3): mesmo Nível A do Trade Plan do Conselho acima —
      // é o plano ATIVO do Operador quando não há um plano do Conselho,
      // não uma referência secundária.
      //
      // A distância percentual até o alvo NÃO é mais desenhada aqui
      // (pedido repetido do Operador, com captura real mostrando
      // "TP1 3.14% FRACA 1:0.42" sobre as velas). Ela continua real e
      // visível no painel do Trade Plan — este canvas parou de repetir o
      // que o painel já diz. `p` segue em escopo porque REACHED depende
      // dele.
      // Ordem "Lapidação das Etiquetas TP1/TP2" §3/§4/§11 (achado real de
      // captura: "TP1 FRACA · 0.34% · 1:0.04 · REACHED" — mesmo problema
      // do Trade Plan do Conselho acima, mesma correção: PRIMÁRIO = label
      // + distância (o essencial pra ler "qual alvo, quão longe"),
      // SECUNDÁRIO = força/R:R/obstáculo/status, em fonte menor via
      // PriceLabelStackPlugin — zero dado apagado, só peso visual menor.
      if (Number.isFinite(engineFallbackLevels.stop)) {
        const breached = p !== null && (longFb ? p <= engineFallbackLevels.stop : p >= engineFallbackLevels.stop);
        out.push({
          price: engineFallbackLevels.stop,
          text: "ST",
          secondaryText: breached ? "BREACHED" : undefined,
          color: "rgba(242, 54, 69, 0.5)",
          tier: "critical",
        });
      }
      // EPC FINAL §8: TP1/TP2 sempre numerado, mesma convenção do Trade
      // Plan do Conselho acima — zero distinção singular/plural no rótulo.
      if (Number.isFinite(engineFallbackLevels.target1)) {
        const reached = p !== null && (longFb ? p >= engineFallbackLevels.target1 : p <= engineFallbackLevels.target1);
        const rr = engineFallbackLevels.riskRewardRatio;
        const secondary1 = [
          // Mesma regra do Trade Plan acima: a porcentagem sai do canvas e
          // permanece no painel.
          strengthSuffix(engineFallbackLevels.target1Strength).trim() || null,
          rr !== null ? `1:${rr.toFixed(2)}` : null,
          obstacleSuffix(engineFallbackLevels.target1ObstacleCount).trim() || null,
          reached ? "REACHED" : null,
        ].filter((v): v is string => v !== null);
        out.push({
          price: engineFallbackLevels.target1,
          text: "TP1",
          secondaryText: secondary1.length > 0 ? secondary1.join(" ") : undefined,
          color: "rgba(8, 153, 129, 0.5)",
          tier: "critical",
        });
      }
      if (engineFallbackLevels.target2 !== null && Number.isFinite(engineFallbackLevels.target2)) {
        const reached = p !== null && (longFb ? p >= engineFallbackLevels.target2 : p <= engineFallbackLevels.target2);
        const secondary2 = [
          strengthSuffix(engineFallbackLevels.target2Strength).trim() || null,
          obstacleSuffix(engineFallbackLevels.target2ObstacleCount).trim() || null,
          reached ? "REACHED" : null,
        ].filter((v): v is string => v !== null);
        out.push({
          price: engineFallbackLevels.target2,
          text: "TP2",
          secondaryText: secondary2.length > 0 ? secondary2.join(" ") : undefined,
          color: "rgba(8, 153, 129, 0.35)",
          tier: "critical",
        });
      }
      // Achado de auditoria (Ferramentas Institucionais): TP3 = extensão
      // de Fibonacci 61.8%, mesma convenção TP1/TP2/TP3 numerada sempre
      // (EPC FINAL §8) — sem strengthSuffix/obstacleSuffix porque a fonte
      // (support-resistance-engine.js) não computa esses metadados para
      // este nível, nunca um valor fabricado só para preencher o rótulo.
      if (engineFallbackLevels.target3 != null && Number.isFinite(engineFallbackLevels.target3)) {
        const reached = p !== null && (longFb ? p >= engineFallbackLevels.target3 : p <= engineFallbackLevels.target3);
        const secondary3 = [reached ? "REACHED" : null].filter(
          (v): v is string => v !== null,
        );
        out.push({
          price: engineFallbackLevels.target3,
          text: "TP3",
          secondaryText: secondary3.length > 0 ? secondary3.join(" ") : undefined,
          color: "rgba(8, 153, 129, 0.2)",
          tier: "critical",
        });
      }
    }
    // Ordem "Ciborgue Vivo" §1 (achado real de captura de tela do
    // Operador: o rótulo "CHOC" desenhado pelo StructureBreakMarkersPlugin
    // colidia com a caixa "EMA 21" — canvas próprio sem consciência dos
    // outros rótulos do eixo). O TEXTO ("BOS"/"CHOCH") migra pra cá — MESMO
    // preço/cor que a LINHA de rompimento (StructureBreakMarkersPlugin
    // continua desenhando-a, intocada) e o MESMO ageAlpha(age, BREAK_DECAY)
    // real que decide quando "esquecer" (idade em candles, nunca relógio
    // de parede) — zero segunda fonte, zero segunda curva de decaimento.
    // alpha<=0 nunca entra: mesma honestidade de "esquecido" do plugin.
    //
    // Evolução Total — 2 correções reais de auditoria neste bloco:
    // (1) gate de visibility.structure_breaks: era a ÚNICA etiqueta do
    //     eixo sem gate (Sweep/Session/Zona Institucional já têm) — a
    //     LINHA sumia com o toggle da camada mas a etiqueta ficava,
    //     um objeto em dois estados divergentes.
    // (2) "um objeto, um peso": o MARCADOR já usa o peso resolvido pelo
    //     orçamento visual (structureBreakVisualWeight) desde a rodada
    //     STRUCTURE — a etiqueta continuava na curva isolada. Agora ambas
    //     usam o MESMO peso resolvido (fallback fail-closed idêntico ao
    //     do plugin quando não há candidato real).
    if (visibility.structure_breaks && structureBreak) {
      const point = data[structureBreak.index];
      if (point) {
        const age = data.length - 1 - structureBreak.index;
        const alpha = structureBreakVisualWeight ?? ageAlpha(age, BREAK_DECAY);
        if (alpha > 0 && Number.isFinite(structureBreak.level)) {
          const bullish = structureBreak.direction === "ALTA";
          out.push({
            price: structureBreak.level,
            text: structureBreak.type,
            color: bullish ? "rgba(8, 153, 129, 0.75)" : "rgba(242, 54, 69, 0.75)",
            alpha,
            side: "left",
          });
        }
      }
    }
    // Achado real do Operador ("aquela linha amarela que eu não sei o que
    // significa" + "as etiquetas não podem ficar em cima do valor do
    // ativo"): a price line nativa de Liquidity Sweep (efeito acima, cor
    // âmbar rgba(255,191,0,...)) tinha `title` só no objeto nativo da lib —
    // a lib desenha esse texto solto no painel, na MESMA coordenada Y do
    // preço varrido (por definição, onde um candle acabou de tocar), sem
    // nenhuma consciência anti-colisão dos outros rótulos. MESMA correção
    // já aplicada a BOS/CHOCH acima: o texto migra pra cá (mesmo preço/cor
    // da linha, que continua sendo desenhada intocada pelo efeito nativo);
    // dedupe por preço porque múltiplos traps podem citar o mesmo pool.
    // side:"left" — evento estrutural/histórico (mesma categoria de S1/R1/
    // Trend Channel/BOS-CHOCH), nunca "o que agir agora".
    // Lapidação institucional (diretiva "agrupar automaticamente eventos
    // repetidos próximos, ex.: 8 SWEEPs consecutivos -> SWEEP ZONE (8
    // eventos)"): achado real, não especulativo — clusterEqualLevels
    // (fvg-order-block-engine.js) já consolida swings BRUTOS em zonas
    // EQH/EQL por ancoragem fixa, mas zonas DISTINTAS (ex. 2 clusters de
    // EQH a 60pts de distância) continuam entradas separadas em
    // liquidityZones; se AMBAS forem varridas na mesma janela,
    // t.sweptLevels carrega os dois níveis próximos, e cada um virava um
    // rótulo próprio aqui. clusterSweptPrices (trap-detection.ts) faz o
    // agrupamento real (mesmo idioma de âncora fixa, mesmo limiar já real
    // de "o que conta como perto" nesta família de dado —
    // LIQUIDITY_PROXIMITY_PCT, já usado por unsweptLiquidityNearPrice/
    // hasSessionKeyLevelNearPrice em App.tsx) — zero limiar novo inventado.
    //
    // v3 (achado real de captura de tela — decaimento por idade): cada
    // cluster carrega `latestIndex` real (a evidência mais recente do
    // grupo); alpha vem do MESMO SWEEP_DECAY/ageAlpha real que a price
    // line nativa usa acima — zero segunda curva de decaimento. Clusters
    // expirados (alpha<=0) nunca entram no eixo, mesma honestidade de
    // "esquecido" já aplicada a BOS/CHOCH.
    if (visibility.liquidity_sweep) {
      const sweepLabelCandidates: { latestIndex: number; label: PriceAxisLabel }[] = [];
      const seenSweepPrices = new Set<number>();
      for (const t of traps ?? []) {
        if (t.kind !== "STOP_HUNT_TOPO" && t.kind !== "STOP_HUNT_FUNDO") continue;
        const uniqueLevels = t.sweptLevels.filter((l) => Number.isFinite(l.price) && !seenSweepPrices.has(l.price));
        uniqueLevels.forEach((l) => seenSweepPrices.add(l.price));

        const arrow = t.kind === "STOP_HUNT_TOPO" ? "↑" : "↓";
        // Lapidação Visual do Gráfico §4 ("marcadores repetidos") — achado
        // de captura real: com 3 sweeps na tela, os 3 chips traziam o MESMO
        // "33%". Não é coincidência: `confidence` é propriedade do TRAP
        // (trap-detection.ts: (1 + corroborações) / 3, calculada uma vez por
        // trap e compartilhada por todos os seus níveis) — nunca do nível
        // individual. Estampá-la em cada etiqueta repete o mesmo número N
        // vezes, não discrimina nada entre elas, alarga cada chip e ainda dá
        // a impressão falsa de N leituras independentes de confiança.
        // Removida da etiqueta do eixo; o valor real continua no painel
        // "Institutional Traps" (App.tsx, pct(t.confidence)), que é onde ele
        // pertence — zero informação perdida (§16 "não diminuir informação
        // por estética"). O que discrimina de fato — direção (↑/↓) e
        // contagem do cluster — permanece.
        for (const cluster of clusterSweptPrices(uniqueLevels, LIQUIDITY_PROXIMITY_PCT)) {
          const age = data.length - 1 - cluster.latestIndex;
          const alpha = ageAlpha(age, SWEEP_DECAY);
          if (alpha <= 0) continue; // expirado (>200 candles) — mesma honestidade de "esquecido" de BOS/CHOCH.
          // Achado real (captura de tela do Operador: "+2 FONTES Sweep + R1"
          // empilhado ao lado de um "⚡ SWEEP ↑" solto — "etiquetas
          // amontoadas"): institutionalZoneSweeps (useMemo acima) alimenta
          // computeInstitutionalZones com o MESMO cluster.avgPrice deste
          // laço. Quando esse preço exato já formou uma Zona Institucional
          // REAL (>=2 fontes distintas concordando, visível agora), o
          // mesmo evento já aparece lá — com MAIS contexto ("N FONTES" +
          // lista de ferramentas, "Sweep" incluso). Manter também o rótulo
          // solto duplicaria a mesma informação em 2 caixas. Gated por
          // visibility.institutional_zones: se a camada de zonas estiver
          // desligada, a zona não é a única representação visível do
          // evento — nunca suprime a última cópia visível (Regra de Ouro 4).
          const alreadyShownInInstitutionalZone =
            visibility.institutional_zones &&
            institutionalZones.some((zone) => zone.members.some((m) => m.sourceKind === "LIQUIDITY_SWEEP" && m.price === cluster.avgPrice));
          if (alreadyShownInInstitutionalZone) continue;
          sweepLabelCandidates.push({
            latestIndex: cluster.latestIndex,
            label: {
              price: cluster.avgPrice,
              // Ordem "FECHAMENTO" §3: as duas variantes convergem para o
              // MESMO primário ("⚡ SWEEP ↑" — evento e direção, Nível 1);
              // a contagem do cluster, que só existe quando há agrupamento
              // real, vira Nível 2. Zero dado perdido: "ZONE 3x" continua
              // dizendo exatamente o que "(3x)" dizia antes.
              text: `⚡ SWEEP ${arrow}`,
              secondaryText: cluster.count > 1 ? `ZONE ${cluster.count}x` : undefined,
              color: "rgba(255, 162, 0, 0.85)", // mesmo tom laranja da price line (ver comentário no efeito acima) — alpha real abaixo controla a opacidade final.
              alpha,
              side: "left",
            },
          });
        }
      }
      // Lapidação por captura real do Operador (coluna esquerda com ~8
      // etiquetas SWEEP simultâneas): o decay de 200 candles no 1H retém
      // ~8 dias — tudo "vivo" ao mesmo tempo. Teto real de contagem
      // (mesma disciplina de MAX_KEY_LEVELS_SHOWN/MAX_INSTITUTIONAL_
      // ZONES): só os MAX_SWEEP_AXIS_LABELS clusters mais RECENTES ganham
      // etiqueta no eixo — as price lines continuam desenhadas para todos
      // (dado intacto, Regra de Ouro 4; só a etiqueta é seletiva).
      sweepLabelCandidates.sort((a, b) => b.latestIndex - a.latestIndex);
      for (const c of sweepLabelCandidates.slice(0, MAX_SWEEP_AXIS_LABELS)) out.push(c.label);
    }
    // Pedido do Operador ("Key Levels"): só a sessão CORRENTE (ainda em
    // andamento, closed:false — sempre a última de computeSessionKeyLevels
    // quando a série não está vazia) entra no eixo anti-colisão, mesma
    // disciplina de S1/R1 (nível estrutural real, side:"left"). As sessões
    // já FECHADAS continuam desenhadas como linha de referência real por
    // SessionKeyLevelsPlugin (canvas), mas sem rótulo flutuante próprio —
    // a mesma correção de fundo do Sweep acima: nunca um texto solto
    // competindo com o preço/candle no meio do gráfico.
    if (visibility.session_key_levels && currentSessionKeyLevel) {
      // Ordem "FECHAMENTO" §3: Nível 1 = o extremo + o preço (o nível
      // acionável); Nível 2 = QUAL sessão o produziu (contexto). Nomes
      // reais chegam a "LONDRES+NY"/"NOVA YORK" (market-session.ts), então
      // demovê-los para a fonte menor é o corte de largura real aqui —
      // sem nenhuma ambiguidade, porque os dois segmentos vivem na MESMA
      // caixa (o operador nunca vê um "H" órfão).
      const labelPrefix = currentSessionKeyLevel.label.toUpperCase();
      // Mesma classe de achado/correção do bloco de Sweep acima
      // ("etiquetas amontoadas" — captura real do Operador): Sessão Alta/
      // Baixa TAMBÉM alimenta institutionalZoneInput.sessionKeyLevel
      // (freshestSessionKeyLevel, MESMO computeSessionKeyLevels(data) —
      // valores bit-idênticos aos de currentSessionKeyLevel). Suprime o
      // rótulo solto só quando o MESMO preço já é membro SESSION_KEY_LEVEL
      // de uma Zona Institucional visível agora — gated por
      // visibility.institutional_zones, nunca suprime a última cópia
      // visível de um nível real (Regra de Ouro 4).
      const highAlreadyShownInInstitutionalZone =
        visibility.institutional_zones &&
        institutionalZones.some((zone) => zone.members.some((m) => m.sourceKind === "SESSION_KEY_LEVEL" && m.price === currentSessionKeyLevel.high));
      const lowAlreadyShownInInstitutionalZone =
        visibility.institutional_zones &&
        institutionalZones.some((zone) => zone.members.some((m) => m.sourceKind === "SESSION_KEY_LEVEL" && m.price === currentSessionKeyLevel.low));
      if (!highAlreadyShownInInstitutionalZone) {
        out.push({
          price: currentSessionKeyLevel.high,
          text: `H ${fmtAxisLabelPrice(currentSessionKeyLevel.high)}`,
          secondaryText: labelPrefix,
          color: "rgba(242, 54, 69, 0.55)",
          side: "left",
        });
      }
      if (!lowAlreadyShownInInstitutionalZone) {
        out.push({
          price: currentSessionKeyLevel.low,
          text: `L ${fmtAxisLabelPrice(currentSessionKeyLevel.low)}`,
          secondaryText: labelPrefix,
          color: "rgba(8, 153, 129, 0.55)",
          side: "left",
        });
      }
    }
    // Diretriz Final — Polimento Visual e Sincronização Global §1/§2
    // (achado real via captura de tela do Operador): o rótulo de texto da
    // Zona Institucional migrou de dentro de InstitutionalZonePlugin (canvas
    // próprio, posição vertical própria) para cá — mesmo sistema anti-
    // colisão de S1/R1/Sweep/Session Key Levels/TREND, único jeito real de
    // garantir que uma zona institucional nunca sobreponha esses rótulos de
    // novo (antes desta correção, os dois desenhavam em canvases
    // independentes sem nenhuma consciência um do outro). price = centro
    // real da zona (mesma referência vertical que o texto já usava dentro
    // do plugin); a FAIXA (fill+borda) continua desenhada por
    // InstitutionalZonePlugin, intocada — só o texto mudou de lugar.
    if (visibility.institutional_zones) {
      institutionalZones.forEach((zone, i) => {
        // Lapidação por captura real ("◆ Sessão Baixa + Sweep + Sweep +
        // EMA21..."): membros com o MESMO label agregam com contagem real
        // ("SWP×2") em vez de repetir o nome — informação idêntica,
        // etiqueta mais curta e precisa.
        //
        // Pedido do Operador sobre "o tamanho das etiquetas": medido nas
        // capturas reais, esta linha chegava a 43 caracteres
        // ("VWAP + FVG Baixa ×2 + Sweep ×2 + Nexus Line") e atravessava as
        // velas na horizontal. A agregação continua idêntica; o que mudou é
        // que cada nome vira seu código curto (zone-member-codes.ts) —
        // mesma quantidade de itens, mesma ordem, mesma contagem, nenhuma
        // ferramenta escondida atrás de um "+N outros" (Regra de Ouro 4:
        // isto é tipografia, nunca poda).
        const toolNames = formatZoneMemberList(zone.members.map((m) => m.label));
        // Evolução Total ("um objeto, um peso"): quando o orçamento visual
        // REDUZIU a ênfase da faixa desta zona (competição real entre
        // camadas), a etiqueta segue a mesma redução — razão entre o peso
        // resolvido e o peso próprio da zona (1 quando não houve
        // competição; nunca zero, resolvedWeight tem piso real de 0.35 no
        // motor). Zero curva nova: só os 2 números já reais.
        const base = confluenceWeight(zone.distinctSourceCount);
        const resolved = institutionalZoneVisualWeights[i];
        const alpha = resolved !== undefined && base > 0 ? Math.min(1, resolved / base) : 1;
        // Ordem "FECHAMENTO" §3: junto com TREND, era a etiqueta mais
        // larga do eixo — "◆ Sessão Baixa + Sweep ×2 + EMA21 + VWAP" passa
        // de 40 caracteres num único peso, atravessando as velas na
        // horizontal. Nível 1 é a FORÇA da confluência (quantas fontes
        // independentes concordam neste preço — a mesma contagem que
        // alimenta confluenceWeight, nunca um número novo); Nível 2 é
        // QUAIS ferramentas. Zero dado apagado: a lista completa continua
        // sempre desenhada, em fonte menor.
        // Especificação Visual Profissional v1 (pedido direto do
        // Operador): "2F OB+EQH" em vez de "◆ 2 FONTES OB Baixa + EQH" —
        // já era 2 pesos visuais (Nível 1/Nível 2 acima), só o texto do
        // Nível 1 compacta mais.
        out.push({
          price: (zone.top + zone.bottom) / 2,
          text: `${zone.distinctSourceCount}F`,
          secondaryText: toolNames,
          color: INSTITUTIONAL_ZONE_LABEL_COLOR,
          alpha,
          side: "left",
        });
      });
    }
    return out;
  }, [support, resistance, supportStrength, resistanceStrength, supportBreakouts, resistanceBreakouts, supportVisualWeight, resistanceVisualWeight, vwapLastValue, vwapState, visibility.vwap, nlLastValue, nexusLineState, visibility.nexus_line, emaLastValue, activeEmaPeriod, visibility.ema, data, visibility.trend_channel, trendChannelInfo, visibility.volume_profile, volumeProfile, visibility.tpo_profile, tpoProfileForLabels, livePrice, tradePlan, targetsHit, decision, engineFallbackLevels, structureBreak, visibility.structure_breaks, structureBreakVisualWeight, traps, visibility.liquidity_sweep, visibility.session_key_levels, currentSessionKeyLevel, visibility.institutional_zones, institutionalZones, institutionalZoneVisualWeights, visibility.fibonacci, fibonacciLevels, fibonacciVisualWeights]);

  return (
    <div className="absolute inset-0">
      {/* V-MAX Fase 1.2: densidade L2 + bolhas de trades grandes, ANTES do
         container do chart de propósito — layout.background do chart é
         transparent (acima), então este heatmap fica REALMENTE atrás das
         velas (não só semi-transparente por cima), o visual institucional
         padrão (Bookmap-style) sem precisar de nenhuma API de camadas da
         lib. */}
      {visibility.order_flow_heatmap && (
        <OrderFlowHeatmapPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          activeLanes={activeProfileLanes}
        />
      )}
      {/* z-index EXPLICITO (chart-layer-depth.ts): este container carrega as
         velas e as 7 camadas desenhadas por primitiva nativa da lib. Sem
         z-index ele era `auto`, e um overlay com z=10 pinta por cima de
         `auto` mesmo vindo antes no DOM (provado em Chromium) — entao as
         linhas nativas de 1px (CVD/SuperTrend/Pivot Points) ficavam embaixo
         de TODA area pintada, violando a regra 4 do proprio modulo. */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ zIndex: CHART_NATIVE_CANVAS_Z_INDEX }}
      />
      {/* EPC §5/§6 ("Nunca simplesmente esconder essas informações"): sem
         Trade Plan ativo, o canto superior esquerdo (vazio desde que o
         Trend Channel migrou pro eixo, Diretriz de Refinamento Visual §5)
         explica o motivo REAL — mesmo texto/lógica da barra de comando
         (App.tsx: tradePlanAbsenceReason), nunca um silêncio que o
         Operador não consegue distinguir de um bug. pointer-events-none:
         nunca captura um gesto de pan/zoom, mesma disciplina de todo
         overlay deste gráfico.
         Continuação EPC §5/§6: quando engineFallbackLevels também existe,
         "SEM TRADE PLAN" sozinho ficaria auto-contraditório — as linhas
         STOP/TARGET (Núcleo) já estão visíveis no canvas. O texto então
         deixa explícito que é só o plano do CONSELHO que está ausente, e
         aponta para as linhas reais já desenhadas — nunca dois sinais
         divergentes sem explicação lado a lado. */}
      {tradePlanAbsenceReason && (
        <div
          // top-7 (era top-2): abre espaço real pra faixa de Market Sessions
          // que agora vive no topo do painel (BAND_HEIGHT_PX=24,
          // MarketSessionBandsPlugin.tsx) — nunca sobrepor 2 textos reais.
          // Achado real de screenshot (Operador): texto sem nenhum fundo
          // lê como flutuando sobre o grid, mesmo sendo HTML (não canvas)
          // — o Operador não distingue os dois mecanismos, só o resultado
          // visual. Fundo/padding/canto discretos abaixo (mesmo raio de
          // canvas-label.ts, CANVAS_LABEL_RADIUS=3, pra família visual
          // consistente com as etiquetas do canvas) — cor/conteúdo/posição
          // inalterados.
          className="absolute left-2 top-7 pointer-events-none select-none font-mono whitespace-nowrap text-[10px] tracking-wide rounded-[3px] px-1.5 py-0.5"
          style={{ color: "rgba(138, 180, 248, 0.75)", background: "rgba(5, 8, 16, 0.75)" }}
        >
          {/* O MOTIVO da ausência não se repete aqui.
              Achado de captura real do Operador (ZEC/USDT 30m): a frase
              "Núcleo LONG, Conselho neutro" aparecia ao MESMO TEMPO na
              faixa TRADE PLAN do cabeçalho e dentro desta etiqueta, no
              gráfico — mesma string, mesma função de origem
              (tradePlanAbsenceReason), duas vezes na tela.

              A faixa do cabeçalho é renderizada sem corte responsivo
              (flex-wrap, sempre presente em modo CRYPTO) e nas MESMAS
              condições desta etiqueta — então o motivo nunca se perde ao
              sair daqui. O que esta etiqueta tem de próprio, e que a faixa
              não pode dizer, é o que as LINHAS DO GRÁFICO são; é só isso
              que ela guarda agora. */}
          {engineFallbackLevels
            ? "SEM PLANO DO CONSELHO · linhas abaixo são do Núcleo"
            : `SEM TRADE PLAN · ${tradePlanAbsenceReason}`}
        </div>
      )}
      {/* Diretriz Final de Lapidação Visual, Parte 2 ("organização das
         camadas"): sessões movidas pra ANTES de Liquidez/Estrutura/Volume
         — cada um dos 3 plugins abaixo já se descrevia como "contexto de
         fundo, nunca compete visualmente com estrutura/liquidez/Trade
         Plan" (ver headers de MarketSessionBandsPlugin/KillZoneBandsPlugin/
         SessionKeyLevelsPlugin), mas viviam montados DEPOIS (por cima, no
         z-stack) das camadas que dizem nunca competir — achado real da
         auditoria de ordem de camadas, corrigido para bater com a própria
         intenção documentada de cada plugin. */}
      {/* EPC OMEGA FINAL, Etapa 10 (Institutional Session Engine), redesenho
         real no ADENDO "Refinamento das Sessões": mesmo array `data` que os
         overlays abaixo já usam — agora consumido via computeSessionKeyLevels
         (faixa fina por segmento, não mais 1 linha de altura total por
         transição via computeSessionBoundaries — ver header do plugin),
         zero prop nova de App.tsx além do que já existe. */}
      {visibility.market_sessions && (
        <MarketSessionBandsPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
        />
      )}
      {/* Ferramentas Institucionais: ICT Kill Zones — janelas estreitas
         real dentro da série de candles (nunca uma partição de 24h como
         MarketSessionBandsPlugin acima), retângulo sombreado real via
         computeKillZoneSpans (kill-zones.ts). */}
      {visibility.kill_zones && (
        <KillZoneBandsPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
        />
      )}
      {/* Pedido do Operador ("Key Levels"): máxima/mínima real de cada
         sessão como nível horizontal — reaproveita a MESMA `data` e a
         MESMA partição de sessão de MarketSessionBandsPlugin acima, via
         computeSessionKeyLevels (market-session.ts). */}
      {visibility.session_key_levels && (
        <SessionKeyLevelsPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
        />
      )}
      {/* V-MAX Fase 0.7: FVG/Order Blocks (bullish|bearish) — mesmo dado real
         de computeSmcZones, já filtrado (!mitigated) e limitado em contagem
         rio acima (App.tsx/ChartWidget), agora como área colorida real
         (Blueprint §3.1 LiquidityZonesPlugin) em vez de duas price lines —
         restaura a cor que o gráfico SVG anterior tinha, sem tirar nenhuma
         cor do gráfico (pedido explícito do Operador). */}
      {(visibility.liquidity_zones || visibility.equal_highs_lows) && (
        <LiquidityZonesPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
          fairValueGaps={visibility.liquidity_zones ? ((fairValueGaps ?? NO_FILLABLE_ZONES) as FillableZone[]) : NO_FILLABLE_ZONES}
          orderBlocks={visibility.liquidity_zones ? ((orderBlocks ?? NO_FILLABLE_ZONES) as FillableZone[]) : NO_FILLABLE_ZONES}
          liquidityVoids={visibility.liquidity_zones ? ((liquidityVoids ?? NO_FILLABLE_ZONES) as FillableZone[]) : NO_FILLABLE_ZONES}
          obstacleZones={obstacleZones ?? EMPTY_OBSTACLE_ZONES}
          fvgVisualWeights={mainLiquidityVisualWeights.fvg}
          obVisualWeights={mainLiquidityVisualWeights.ob}
          equalLevels={visibility.equal_highs_lows ? equalLevelMarks : NO_EQUAL_LEVELS}
          breakerBlocks={visibility.liquidity_zones ? ((breakerBlocks ?? NO_FILLABLE_ZONES) as FillableZone[]) : NO_FILLABLE_ZONES}
          mitigationBlocks={visibility.liquidity_zones ? ((mitigationBlocks ?? NO_FILLABLE_ZONES) as FillableZone[]) : NO_FILLABLE_ZONES}
        />
      )}
      {/* Ordem "Ciborgue Vivo" §1: BOS/CHOCH real, mesma anotação temporária
         que "pensa e esquece" — mesmo array `data` que LiquidityZonesPlugin
         acima já usa, então o índice do rompimento fica alinhado. */}
      {visibility.structure_breaks && (
        <StructureBreakMarkersPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
          structureBreak={structureBreak ?? null}
          visualWeight={structureBreakVisualWeight}
        />
      )}
      {/* Padrões de vela reais (candlestick-patterns.js) — marcador ancorado
         na vela onde o padrão FECHOU, mesmo array `data` dos overlays
         acima (índice alinhado). Display only (LEI 24). */}
      {visibility.candle_patterns && (
        <CandlePatternMarkersPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
          patterns={candlePatterns ?? []}
        />
      )}
      {/* V-MAX Fase 1 (superfície visual): Volume Profile real (Fase 1.3)
         como barras à direita + linha do POC — overlay por cima do chart
         (pointer-events-none), dado direto da store. */}
      {visibility.volume_profile && (
        <VolumeProfilePlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          activeLanes={activeProfileLanes}
        />
      )}
      {/* OMEGA CORE V-MAX Fase 8.1: densidade real de liquidações JÁ
         acontecidas nesta sessão (retrospectivo, nunca preditivo — ver
         header do plugin), barras à ESQUERDA para nunca sobrepor o Volume
         Profile acima (à direita). */}
      {visibility.liquidation_heatmap && (
        <LiquidationHeatmapPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          liquidations={liquidations ?? []}
          symbol={symbol ?? null}
        />
      )}
      {/* DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO §4 ("Consolidação de
         zonas"): faixa real de confluência entre EMA/VWAP/Nexus Line/FVG/
         Order Block/EQH/EQL (institutionalZones, useMemo acima) — mounted
         BEFORE Neural Market Aura/Trade Plan Zone de propósito, para a
         faixa ficar visualmente ATRÁS do que já é o núcleo do plano,
         nunca competindo com ele (mesma hierarquia da diretiva: Trade
         Plan > Confluências). Camada aditiva: nunca substitui o desenho
         individual de cada ferramenta, que continua intacto. Ordem Nº 03:
         essa MESMA hierarquia (Trade Plan > Confluências), antes só
         implícita na ORDEM de montagem, agora também vira um peso visual
         real via visualWeights (visualBudgetResults acima). */}
      {visibility.institutional_zones && (
        <InstitutionalZonePlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          zones={institutionalZones}
          visualWeights={institutionalZoneVisualWeights}
          livePrice={typeof livePrice === "number" ? livePrice : null}
        />
      )}
      {/* Entrega 40: livro de ofertas real como camada de gráfico — gap
         nomeado desde a Entrega 35 §4, mesmo orderBook que OrderBookWidget
         (painel separado) já desenha, zero segundo fetch. */}
      {visibility.order_book_depth && (
        <DepthChartPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          activeLanes={activeProfileLanes}
        />
      )}
      {/* Entrega 41: perfil TPO real da sessão corrente — mesma `data`
         (candles reais) já threadada a SessionKeyLevelsPlugin/
         KillZoneBandsPlugin, zero fetch novo. */}
      {visibility.tpo_profile && (
        <TpoProfilePlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
          activeLanes={activeProfileLanes}
        />
      )}
      {/* Entrega 47: ZigZag graduado do Laboratório (pedido direto do
         Operador) — mesma `data` real, zero fetch novo. Auditoria do
         ecossistema de indicadores: atrPercent escala o limiar de reversão
         pelo tempo gráfico selecionado (mesmo princípio real já aplicado à
         perna do Fibonacci) — sem ele, cai no default clássico do motor. */}
      {visibility.zigzag && (
        <ZigZagPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
          atrPercent={chartAtrPercent}
        />
      )}
      {/* Auditoria do ecossistema de indicadores: Ichimoku Kinko Hyo, a
         segunda (e ultima) ferramenta classica realmente ausente do
         ecossistema. Montado ANTES das camadas de linha fina porque a
         nuvem e preenchimento amplo — a profundidade real vem de
         chart-layer-depth.ts ("zone"), esta ordem so acompanha. Mesma
         `data` real dos demais overlays, zero fetch novo. */}
      {visibility.ichimoku && (
        <IchimokuPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
        />
      )}
      {/* Graduacao de delta-divergence-engine.js (quarentena levantada: a
         retencao de CVD subiu de 120 para 900 amostras, ~1h). Le a serie de
         CVD direto da store (useOrderflowHistory), como o
         OrderFlowHeatmapPlugin ja faz — passar um ring que cresce a cada 4s
         por prop re-renderizaria este componente inteiro por overlay. */}
      {visibility.delta_divergence && (
        <DeltaDivergencePlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
        />
      )}
      {/* Neural Market Aura: the conviction corridor, mounted BEFORE the
         crisp entry-zone box below so the soft gradient stays visually
         underneath it, not competing with it. */}
      {visibility.neural_market_aura && (
        <NeuralMarketAuraPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          aura={aura ?? null}
        />
      )}
      {/* Ordem Final Autonomia Evolução §1 ("caixas semi-transparentes"):
         the Trade Plan's entry zone, mounted last so it stays the topmost
         overlay — it is the most actionable, currently-live information
         on the chart, above the more diagnostic FVG/OB zones. */}
      {visibility.trade_plan_zone && (
        <TradePlanZonePlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          entryLow={tradePlan?.entry.low ?? null}
          entryHigh={tradePlan?.entry.high ?? null}
          confidenceZone={confidenceZone ?? null}
          visualWeight={tradePlanVisualWeight}
        />
      )}
      {/* Nível 0 (ver comentário acima do useMemo de priceAxisLabels):
         montado por último de propósito — precisa ficar acima de TODOS os
         outros overlays, a mesma garantia que os "last value label"/
         "axis label" nativos que ele substitui sempre tiveram. */}
      <PriceLabelStackPlugin
        chart={chartReady?.chart ?? null}
        series={chartReady?.series ?? null}
        labels={priceAxisLabels}
      />
      {/* §8/§9 (RECENTRALIZAR): canto inferior esquerdo — a única área do
         canvas sem eixo nativo de preço nem etiqueta de contexto por
         baixo (eixo nativo fica à direita; PriceLabelStackPlugin já usa
         LEFT_MARGIN_PX mas nunca ocupa a faixa mais baixa da tela nas
         capturas reais auditadas). Mesma linguagem visual de botão
         pequeno já usada em App.tsx (px-1.5 py-1, texto 50% → acento
         cyan no hover) — nenhuma paleta nova. aria-label real (não só
         title): tooltip nativo não aparece em toque no iPad Safari,
         achado já registrado e corrigido em outros controles nesta
         mesma sessão.
         z-10 (achado real via harness Playwright, elementFromPoint no
         próprio centro do botão): os canvases INTERNOS da própria
         lightweight-charts (sem className, geridos pela lib — nenhum dos
         14 overlays deste projeto, todos com pointer-events-none
         confirmado) usam z-index próprio e ficavam ACIMA do botão só por
         não termos nenhum z-index explícito aqui — DOM order sozinha não
         basta contra um z-index explícito da lib. z-10 garante ficar
         acima sem entrar em conflito com nenhum overlay real deste
         projeto (todos pointer-events-none, então nunca competem por
         clique de qualquer forma). */}
      <button
        type="button"
        onClick={recenterChart}
        aria-label="Recentralizar gráfico"
        title="Recentralizar"
        className="absolute bottom-2 left-2 z-10 flex items-center gap-1 px-1.5 py-1 rounded bg-[#050810]/70 border border-[#8ab4f8]/20 text-[#8ab4f8]/60 hover:text-[#00f0ff] hover:border-[#00f0ff40] cursor-pointer pointer-events-auto"
      >
        <Crosshair size={11} />
      </button>
    </div>
  );
}

// O nome público continua sendo este — nenhum chamador ou teste muda.
export const EnhancedChart_110_Percent = memo(EnhancedChart_110_PercentImpl);
