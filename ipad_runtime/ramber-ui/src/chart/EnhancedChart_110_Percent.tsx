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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type LogicalRange,
} from "lightweight-charts";
// V-MAX Fase 1 (superfície visual, fechamento do §3.1): linha de CVD real
// — a série do orderflowHistory (Fase 1.2) com eixo Y próprio nativo.
import { useOrderflowHistory, useVolumeProfileSnapshot, useUnifiedSnapshotStore } from "../store/unified-snapshot-store";
// ZONE_DECAY: Ordem Nº 04 — mesma curva que o plugin já usa isolado,
// reusada aqui para montar o candidato real de MAIN_LIQUIDITY (visual-
// budget.ts), mesmo padrão de BREAK_DECAY logo abaixo.
import { LiquidityZonesPlugin, ZONE_DECAY, type FillableZone } from "./LiquidityZonesPlugin";
// Ordem "Ciborgue Vivo" §1: anotação temporária de BOS/CHOCH — mesma
// arquitetura de overlay do LiquidityZonesPlugin acima, dado real diferente.
// BREAK_DECAY: achado real de captura de tela (rótulo "CHOC" colidindo com
// a caixa "EMA 21") — o TEXTO migrou para priceAxisLabels abaixo, reusando
// a MESMA config de decaimento do plugin (zero segunda curva).
import { StructureBreakMarkersPlugin, BREAK_DECAY } from "./StructureBreakMarkersPlugin";
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

// Zoom inteligente (ver efeito de setData): quantas velas recentes o
// enquadre automático mostra na troca de timeframe/símbolo, + folga real à
// direita para o preço vivo/etiquetas respirarem. Convenção declarada de
// leitura confortável (~120 velas ≈ 2h de 1m / 5 dias de 1h numa tela),
// não uma medição — mesmo espírito de todo limiar documentado deste
// arquivo. O pan/zoom manual do Operador continua soberano fora da troca.
const SMART_ZOOM_CANDLES = 120;
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
import { resolveVisualBudget, type VisualBudgetCandidate } from "../nexus/visual-budget";
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
import type { StructureBreak, LiquidationEvent } from "../engine-bridge";
import type { TrapSignal } from "../nexus/trap-detection";
import { clusterSweptPrices } from "../nexus/trap-detection";
// Auditoria do painel do gráfico: "canais de tendência", gap real já
// documentado em rodadas anteriores — ver cabeçalho de
// nexus/trend-channel-engine.ts para a definição real (Linear Regression
// Channel) e a pesquisa que a confirmou.
import { computeTrendChannel, TREND_CHANNEL_DEFAULT_WINDOW, TREND_CHANNEL_STDDEV_MULTIPLIER, type TrendChannelDirection } from "../nexus/trend-channel-engine";
import { shouldCompactLabels } from "./label-compaction";
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

export interface EnhancedChartLiquidity {
  type: "EQUAL_HIGH" | "EQUAL_LOW";
  price: number;
  touches: number;
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
};

interface EnhancedChartProps {
  data: EnhancedChartCandle[];
  support?: number | null;
  resistance?: number | null;
  supportStrength?: LevelStrength | null;
  resistanceStrength?: LevelStrength | null;
  supportBreakouts?: number;
  resistanceBreakouts?: number;
  fairValueGaps?: EnhancedChartZone[];
  orderBlocks?: EnhancedChartZone[];
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
  BULLISH: "rgba(0, 230, 160, 0.75)",
  BEARISH: "rgba(255, 61, 113, 0.75)",
  NEUTRAL: "rgba(255, 235, 190, 0.50)", // branco-dourado (§22 Neutra)
};
const NL_STATE_COLOR: Record<DirectionalLineState, string> = {
  BULLISH: "rgba(0, 230, 160, 0.50)",
  BEARISH: "rgba(255, 61, 113, 0.50)",
  NEUTRAL: "rgba(255, 214, 130, 0.45)",
};

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

// Mesmo formato de texto que o gráfico antigo já usava para S1/R1 — só a
// primitiva que desenha muda (createPriceLine em vez de <span> em pixel
// fixo), a informação real (força/retest/rompimentos) continua idêntica.
function levelTitle(base: string, strength: LevelStrength | null | undefined, breakouts: number | undefined): string {
  if (!strength) return base;
  return `${base} ${strength.label} ${strength.touches}x/${breakouts ?? 0}x`;
}

export function EnhancedChart_110_Percent({
  data,
  support,
  resistance,
  supportStrength,
  resistanceStrength,
  supportBreakouts,
  resistanceBreakouts,
  fairValueGaps,
  orderBlocks,
  liquidityZones,
  obstacleZones,
  structureBreak,
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
}: EnhancedChartProps) {
  const visibility = layerVisibility ?? DEFAULT_CHART_LAYER_VISIBILITY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const supportLineRef = useRef<IPriceLine | null>(null);
  const resistanceLineRef = useRef<IPriceLine | null>(null);
  const zoneLinesRef = useRef<IPriceLine[]>([]);
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
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8ab4f8",
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
        // Auditoria do painel do gráfico (achado real): a lib desenha por
        // padrão o logo "powered by TradingView" sobre o próprio canvas —
        // destoa do terminal proprietário AR10 CYBORG. A licença Apache-2.0
        // permite desligar ("attributionLogo: false") DESDE QUE o link real
        // para tradingview.com continue visível em outro lugar da tela —
        // ver FooterBar em App.tsx, que agora carrega essa obrigação real
        // (nunca uma remoção silenciosa da atribuição exigida).
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(0, 240, 255, 0.06)" },
        horzLines: { color: "rgba(0, 240, 255, 0.06)" },
      },
      // Diretriz Mestra §2 ("Magnetismo OHLC / Snap em candles"): Magnet
      // gruda o crosshair no valor da série (o close do candle) — snap
      // real da própria lightweight-charts, zero implementação paralela.
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: "rgba(138, 180, 248, 0.15)" },
      timeScale: {
        borderColor: "rgba(138, 180, 248, 0.15)",
        timeVisible: true,
        secondsVisible: false,
        // Diretriz Mestra §2 ("Scroll para projeções futuras"): respiro à
        // direita da última vela — as price lines de plano/cenário/P-D
        // continuam legíveis na região futura; o operador pode arrastar
        // mais além (fixRightEdge segue no padrão false da lib).
        rightOffset: 8,
      },
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
      upColor: "#00ffaa",
      downColor: "#ff0055",
      borderVisible: false,
      wickUpColor: "#00ffaa",
      wickDownColor: "#ff0055",
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
    // nativa na escala principal — azul distinto, nunca competindo com a
    // paleta direcional/semântica já em uso (ver comentário no ref
    // acima). Fio de seda: lineWidth 1, sólida.
    const emaSeries = chart.addSeries(LineSeries, {
      color: "rgba(66, 165, 245, 0.85)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      // Mesmo achado/mesma correção do VWAP acima.
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "",
    });
    emaSeriesRef.current = emaSeries;
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
      color: "rgba(176, 38, 255, 0.55)",
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
      color: "rgba(176, 38, 255, 0.55)",
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
    return () => {
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
  // candles enquadra as últimas SMART_ZOOM_CANDLES velas automaticamente.
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
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: Math.max(0, formatted.length - SMART_ZOOM_CANDLES),
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

  // S1/R1 reais — o MESMO engine.support/resistance que os outros widgets
  // já exibem, aqui como price lines nativas (createPriceLine), nunca uma
  // linha desenhada à mão em cima do canvas.
  //
  // "Fio de seda" (pedido explícito do Operador): TODAS as linhas de
  // marcação deste gráfico são SÓLIDAS e finas (lineWidth 1, o mínimo da
  // lib) — nunca pontilhadas/tracejadas. A hierarquia visual entre S1/R1
  // (nível primário) e as zonas SMC (contexto) vem da OPACIDADE da cor,
  // não do estilo do traço: S1/R1 mais presentes, zonas mais translúcidas.
  useEffect(() => {
    if (!seriesRef.current) return;
    if (supportLineRef.current) {
      seriesRef.current.removePriceLine(supportLineRef.current);
      supportLineRef.current = null;
    }
    if (Number.isFinite(support)) {
      supportLineRef.current = seriesRef.current.createPriceLine({
        price: support as number,
        color: "rgba(0, 255, 170, 0.65)",
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        // Mesmo achado/mesma correção da série de candles acima — o tag
        // nativo do eixo colidia com VWAP/NL/preço quando os valores
        // reais ficam próximos; PriceLabelStackPlugin assume o rótulo.
        axisLabelVisible: false,
        title: levelTitle("S1", supportStrength, supportBreakouts),
      });
    }
  }, [support, supportStrength, supportBreakouts]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (resistanceLineRef.current) {
      seriesRef.current.removePriceLine(resistanceLineRef.current);
      resistanceLineRef.current = null;
    }
    if (Number.isFinite(resistance)) {
      resistanceLineRef.current = seriesRef.current.createPriceLine({
        price: resistance as number,
        color: "rgba(255, 0, 85, 0.65)",
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        // Mesmo achado/mesma correção do S1 acima.
        axisLabelVisible: false,
        title: levelTitle("R1", resistanceStrength, resistanceBreakouts),
      });
    }
  }, [resistance, resistanceStrength, resistanceBreakouts]);

  // Liquidez (Equal High/Low) continua como price line: LiquidityZone
  // (engine-bridge.ts) só carrega um preço único, nunca um top/bottom —
  // não existe uma "área" real para preencher, então uma linha continua
  // sendo a representação honesta (mesmo dado, mesmo filtro !swept de
  // sempre, aplicado rio acima em App.tsx/ChartWidget).
  // Auditoria de pendências: ganha visibility.equal_highs_lows — mesmo
  // fail-closed de "sem camada visível, zero linhas" já usado quando o
  // dado real está ausente (early-return dentro do próprio array vazio).
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    zoneLinesRef.current.forEach((line) => series.removePriceLine(line));
    zoneLinesRef.current = [];
    if (!visibility.equal_highs_lows) return;

    (liquidityZones ?? []).forEach((z) => {
      zoneLinesRef.current.push(
        series.createPriceLine({
          price: z.price,
          // EPC OMEGA FINAL Parte 2 §10 (Paleta de Cores): era H278 quase
          // idêntico ao roxo do Harmônico/acento do Conselho (176,38,255,
          // linhas 887/1612 — "Púrpura, acento do Conselho/opinião
          // agregada"), <1° de distância de matiz — colisão mais apertada
          // que a já corrigida entre Liquidation/Sweep. Azul H223 novo:
          // >40° de qualquer outro matiz já atribuído no app (dourados
          // ~33-50°, teal LONG ~160°, cyan Volume Profile/Fibonacci ~180°,
          // roxo Conselho ~278°, magenta POC ~312°, rosa SHORT ~340°) —
          // mesma luminosidade/peso visual do valor antigo, só o matiz muda.
          color: "rgba(110, 150, 255, 0.45)",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title: `${z.type === "EQUAL_HIGH" ? "EQH" : "EQL"} x${z.touches}`,
        }),
      );
    });
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
            color: `rgba(255, 140, 0, ${(alpha * 0.85).toFixed(3)})`,
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
  const freshestSessionKeyLevel = useMemo(() => {
    const levels = computeSessionKeyLevels(data);
    const latest = levels[levels.length - 1];
    return latest ? { high: latest.high, low: latest.low } : null;
  }, [data]);
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
    }),
    [emaLastValue, activeEmaPeriod, vwapLastValue, nlLastValue, fairValueGaps, orderBlocks, liquidityZones, support, resistance, volumeProfile, freshestSessionKeyLevel, institutionalZoneSweeps, lastSwingHigh, lastSwingLow],
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
    mainLiquidityCandidates.fvg.forEach((w, i) => {
      if (w !== null) candidates.push({ id: `liquidity-fvg-${i}`, category: "MAIN_LIQUIDITY", baseWeight: w });
    });
    mainLiquidityCandidates.ob.forEach((w, i) => {
      if (w !== null) candidates.push({ id: `liquidity-ob-${i}`, category: "MAIN_LIQUIDITY", baseWeight: w });
    });
    return resolveVisualBudget(candidates);
  }, [visibility.institutional_zones, institutionalZones, hasTradePlanZone, confidenceZone, structureBreakBaseWeight, mainLiquidityCandidates]);
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
  const mainLiquidityVisualWeights = useMemo(() => {
    const byId = new Map(visualBudgetResults.map((r) => [r.id, r.visualWeight]));
    return {
      fvg: (fairValueGaps ?? []).map((_, i) => byId.get(`liquidity-fvg-${i}`)),
      ob: (orderBlocks ?? []).map((_, i) => byId.get(`liquidity-ob-${i}`)),
    };
  }, [visualBudgetResults, fairValueGaps, orderBlocks]);

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

    (fibonacciLevels ?? []).forEach((level) => {
      if (!Number.isFinite(level.price)) return;
      fibLinesRef.current.push(
        series.createPriceLine({
          price: level.price,
          color: level.score > 0 ? "rgba(0, 240, 255, 0.55)" : "rgba(0, 240, 255, 0.20)",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title: `FIB ${(level.ratio * 100).toFixed(1)}%${level.score > 0 ? ` ×${level.score}` : ""}`,
        }),
      );
    });
  }, [fibonacciLevels, visibility.fibonacci]);

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
    if (!scenario) return;

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
  }, [scenario]);

  // Refinamento Final §7 (Premium/Discount zones): as 3 fronteiras REAIS do
  // dealing range atual (último swing high confirmado, equilíbrio 50%,
  // último swing low confirmado — premium-discount.ts, mesmo findSwings
  // compartilhado dos motores). Fio de seda (1px sólida), MAIS discretas que
  // Scenario e Trade Plan (contexto de zona, não alvo): opacidade fixa
  // baixa, sem rótulo de eixo. Fail-closed: sem leitura real, zero linhas.
  // Auditoria de pendências: ganha visibility.premium_discount, mesmo
  // fail-closed acima (early-return antes de desenhar).
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
    mkPd(premiumDiscount.rangeHigh.price, "rgba(255, 0, 85, 0.30)", "Premium · topo do range");
    mkPd(premiumDiscount.equilibrium, "rgba(138, 180, 248, 0.30)", "Equilibrium · 50%");
    mkPd(premiumDiscount.rangeLow.price, "rgba(0, 255, 170, 0.30)", "Discount · fundo do range");
  }, [premiumDiscount, visibility.premium_discount]);

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
    const candidates: Array<{ family: "HARMONIC" | "TRIANGLE" | "HEAD_SHOULDERS"; fitScore: number }> = [];
    if (harmonicValid) candidates.push({ family: "HARMONIC", fitScore: harmonicValid.fitScore });
    if (trianglePattern) candidates.push({ family: "TRIANGLE", fitScore: trianglePattern.fitScore });
    if (headShouldersPattern) candidates.push({ family: "HEAD_SHOULDERS", fitScore: headShouldersPattern.fitScore });
    if (candidates.length === 0) return;
    let winner = candidates[0];
    for (const c of candidates.slice(1)) {
      if (c.fitScore > winner.fitScore) winner = c;
    }

    const mkH = (price: number, title: string) => {
      if (!Number.isFinite(price)) return;
      harmonicLinesRef.current.push(
        series.createPriceLine({
          price,
          color: "rgba(176, 38, 255, 0.40)",
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

    if (winner.family === "HARMONIC" && harmonicValid) {
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
    } else if (winner.family === "TRIANGLE" && trianglePattern) {
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
    } else if (winner.family === "HEAD_SHOULDERS" && headShouldersPattern) {
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
  }, [harmonicHits, trianglePattern, headShouldersPattern, data, visibility.harmonics]);

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
    const entryColor = "rgba(240, 208, 111, 0.75)"; // amber — the acceptance zone
    if (tradePlan.entry.low === tradePlan.entry.high) {
      mk(tradePlan.entry.low, entryColor);
    } else {
      mk(tradePlan.entry.high, entryColor);
      mk(tradePlan.entry.low, "rgba(240, 208, 111, 0.45)");
    }
    stopLineRef.current = mk(tradePlan.stop.price, "rgba(255, 0, 85, 0.75)");
    // v2 (Diretriz Complementar §2): uma linha por alvo real (1 a
    // MAX_TARGETS) — nunca uma linha única fixa.
    tradePlan.targets.forEach((target) => {
      const line = mk(target.price, "rgba(0, 255, 170, 0.75)");
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
    mk(engineFallbackLevels.stop, "rgba(255, 0, 85, 0.5)");
    mk(engineFallbackLevels.target1, "rgba(0, 255, 170, 0.5)");
    if (engineFallbackLevels.target2 !== null) mk(engineFallbackLevels.target2, "rgba(0, 255, 170, 0.35)");
    if (engineFallbackLevels.target3 != null) mk(engineFallbackLevels.target3, "rgba(0, 255, 170, 0.2)");
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
      color: stopHitNow ? "rgba(255, 0, 85, 1)" : "rgba(255, 0, 85, 0.75)",
    });
    tradePlan.targets.forEach((_target, i) => {
      const line = targetLinesArrayRef.current[i];
      if (!line) return;
      const reached = i < hits;
      line.applyOptions({
        color: reached ? "rgba(0, 255, 170, 1)" : "rgba(0, 255, 170, 0.75)",
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
    if (Number.isFinite(support) && supportStrength?.label === "FORTE") {
      out.push({
        price: support as number,
        text: `${levelTitle("S1", supportStrength, supportBreakouts)} ${(support as number).toFixed(2)}`,
        color: "rgba(0, 255, 170, 0.65)",
        side: "left",
      });
    }
    if (Number.isFinite(resistance) && resistanceStrength?.label === "FORTE") {
      out.push({
        price: resistance as number,
        text: `${levelTitle("R1", resistanceStrength, resistanceBreakouts)} ${(resistance as number).toFixed(2)}`,
        color: "rgba(255, 0, 85, 0.65)",
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
      out.push({ price: vwapLastValue, text: `VWAP ${LINE_STATE_GLYPH[s]} ${vwapLastValue.toFixed(2)}`, color: VWAP_STATE_COLOR[s] });
    }
    if (visibility.nexus_line && nlLastValue !== null && Number.isFinite(nlLastValue)) {
      const s: DirectionalLineState = nexusLineState ?? "NEUTRAL";
      out.push({ price: nlLastValue, text: `NL ${LINE_STATE_GLYPH[s]} ${nlLastValue.toFixed(2)}`, color: NL_STATE_COLOR[s] });
    }
    if (visibility.ema && emaLastValue !== null && Number.isFinite(emaLastValue)) {
      out.push({ price: emaLastValue, text: `EMA ${activeEmaPeriod} ${emaLastValue.toFixed(2)}`, color: "rgba(66, 165, 245, 0.85)" });
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
      // Correção de comentário (achado real, auditoria de sincronização
      // DIRETRIZES AVANÇADAS): a frase acima dizia que a barra superior
      // usa "o mesmo usePriceSnapshot() que alimenta livePrice aqui" —
      // falso. TopBar lê `priceData` (estado React direto, App.tsx) por
      // prop; `livePrice` aqui vem de `usePriceSnapshot()`, um espelho
      // Zustand do MESMO `priceData` escrito um commit de render depois
      // (App.tsx, efeito `[priceData]`). Ou seja: mesmo dado real na
      // origem, mas dois caminhos com timing diferente — a barra superior
      // é sempre igual ou mais nova que este rótulo, nunca o contrário.
      // Gap estrutural real, ainda não fechado (documentado no backlog);
      // esta nota só corrige a afirmação factual errada, não o gap em si.
      const displayPrice = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : lastCandle.close;
      out.push({
        price: displayPrice,
        text: displayPrice.toFixed(2),
        color: displayPrice >= lastCandle.open ? "#00ffaa" : "#ff0055",
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
        text: `TREND · OLS ${trendChannelInfo.windowSize} · ±${TREND_CHANNEL_STDDEV_MULTIPLIER}σ · ${TREND_DIRECTION_GLYPH[trendChannelInfo.direction]} ${trendChannelInfo.midPrice.toFixed(2)}`,
        color: "rgba(148, 163, 184, 0.55)",
        side: "left",
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
      const entryColor = "rgba(240, 208, 111, 0.75)";
      // EPC FINAL §8 ("Objetos Inteligentes"): nomenclatura curta e
      // padronizada pedida explicitamente — EN/ST/TP1/TP2/TP3 nos OBJETOS
      // GRÁFICOS do canvas (aqui). A barra de comando (BarField "Entry
      // Zone"/"Stop"/"Target", App.tsx) NÃO é tocada por este achado: já
      // passou por um "Redesenho radical" anterior — pedido explícito do
      // Operador — trocando "E/S/T" cramped por rótulos legíveis; reverter
      // isso sem pedido novo desfaria uma decisão real já tomada.
      if (tradePlan.entry.low === tradePlan.entry.high) {
        if (Number.isFinite(tradePlan.entry.low)) {
          out.push({ price: tradePlan.entry.low, text: `EN ${tradePlan.direction} · ${tradePlan.entry.basis}`, color: entryColor });
        }
      } else {
        if (Number.isFinite(tradePlan.entry.high)) {
          out.push({ price: tradePlan.entry.high, text: `EN ${tradePlan.direction} · ${tradePlan.entry.basis}`, color: entryColor });
        }
        if (Number.isFinite(tradePlan.entry.low)) {
          out.push({ price: tradePlan.entry.low, text: "EN ZONE LOW", color: entryColor });
        }
      }
      // Stop no preço EFETIVO (ratchet real, MESMA função pura do efeito da
      // linha) — BREACHED quando o preço vivo já rompeu (fail-closed:
      // preço não-finito nunca resolve BREACHED).
      const effectiveStopPrice = effectiveStopForTargetsHit(tradePlan, hits);
      if (Number.isFinite(effectiveStopPrice)) {
        const stopHitNow = p !== null && (long ? p <= effectiveStopPrice : p >= effectiveStopPrice);
        const stopBase = hits >= 2
          ? `ST · TRILHADO (alvo ${hits - 1})`
          : hits > 0
            ? `ST · BREAK-EVEN (real)`
            : `ST · ${tradePlan.stop.basis}`;
        out.push({ price: effectiveStopPrice, text: stopHitNow ? `${stopBase} · BREACHED` : stopBase, color: "rgba(255, 0, 85, 0.75)" });
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
        const label = `TP${i + 1}`;
        const distPct = p !== null && p > 0 ? ` · ${((Math.abs(target.price - p) * 100) / p).toFixed(2)}%` : "";
        const fusedTarget = decision?.plan?.targets[i];
        const etaLabel =
          fusedTarget && Math.abs(fusedTarget.price - target.price) < Math.max(1e-9, target.price * 1e-9)
            ? formatEtaRange(fusedTarget.etaMsMin, fusedTarget.etaMs)
            : null;
        const base = compactLabels
          ? `${label}${distPct}${etaLabel ? ` · ${etaLabel}` : ""}${obstacleSuffix(target.obstacleCount)}`
          : `${label} · ${target.basis}${rr !== null ? ` · 1:${rr.toFixed(2)}` : ""}${distPct}${etaLabel ? ` · ETA ${etaLabel}` : ""}${obstacleSuffix(target.obstacleCount)}`;
        out.push({ price: target.price, text: reached ? `${base} · REACHED` : base, color: "rgba(0, 255, 170, 0.75)" });
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
      if (Number.isFinite(engineFallbackLevels.stop)) {
        const breached = p !== null && (longFb ? p <= engineFallbackLevels.stop : p >= engineFallbackLevels.stop);
        out.push({
          price: engineFallbackLevels.stop,
          text: breached ? "ST · BREACHED" : "ST",
          color: "rgba(255, 0, 85, 0.5)",
        });
      }
      // EPC FINAL §8: TP1/TP2 sempre numerado, mesma convenção do Trade
      // Plan do Conselho acima — zero distinção singular/plural no rótulo.
      if (Number.isFinite(engineFallbackLevels.target1)) {
        const reached = p !== null && (longFb ? p >= engineFallbackLevels.target1 : p <= engineFallbackLevels.target1);
        const rr = engineFallbackLevels.riskRewardRatio;
        out.push({
          price: engineFallbackLevels.target1,
          text: `TP1${strengthSuffix(engineFallbackLevels.target1Strength)}${rr !== null ? ` · 1:${rr.toFixed(2)}` : ""}${obstacleSuffix(engineFallbackLevels.target1ObstacleCount)}${reached ? " · REACHED" : ""}`,
          color: "rgba(0, 255, 170, 0.5)",
        });
      }
      if (engineFallbackLevels.target2 !== null && Number.isFinite(engineFallbackLevels.target2)) {
        const reached = p !== null && (longFb ? p >= engineFallbackLevels.target2 : p <= engineFallbackLevels.target2);
        out.push({
          price: engineFallbackLevels.target2,
          text: `TP2${strengthSuffix(engineFallbackLevels.target2Strength)}${obstacleSuffix(engineFallbackLevels.target2ObstacleCount)}${reached ? " · REACHED" : ""}`,
          color: "rgba(0, 255, 170, 0.35)",
        });
      }
      // Achado de auditoria (Ferramentas Institucionais): TP3 = extensão
      // de Fibonacci 61.8%, mesma convenção TP1/TP2/TP3 numerada sempre
      // (EPC FINAL §8) — sem strengthSuffix/obstacleSuffix porque a fonte
      // (support-resistance-engine.js) não computa esses metadados para
      // este nível, nunca um valor fabricado só para preencher o rótulo.
      if (engineFallbackLevels.target3 != null && Number.isFinite(engineFallbackLevels.target3)) {
        const reached = p !== null && (longFb ? p >= engineFallbackLevels.target3 : p <= engineFallbackLevels.target3);
        out.push({
          price: engineFallbackLevels.target3,
          text: `TP3${reached ? " · REACHED" : ""}`,
          color: "rgba(0, 255, 170, 0.2)",
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
            color: bullish ? "rgba(0, 255, 170, 0.75)" : "rgba(255, 0, 85, 0.75)",
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
          sweepLabelCandidates.push({
            latestIndex: cluster.latestIndex,
            label: {
              price: cluster.avgPrice,
              text:
                cluster.count === 1
                  ? `⚡ SWEEP ${arrow}`
                  : `⚡ SWEEP ZONE ${arrow} (${cluster.count}x)`,
              color: "rgba(255, 140, 0, 0.85)", // mesmo tom laranja da price line (ver comentário no efeito acima) — alpha real abaixo controla a opacidade final.
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
      const labelPrefix = currentSessionKeyLevel.label.toUpperCase();
      out.push({
        price: currentSessionKeyLevel.high,
        text: `${labelPrefix} H ${currentSessionKeyLevel.high.toFixed(2)}`,
        color: "rgba(255, 0, 85, 0.55)",
        side: "left",
      });
      out.push({
        price: currentSessionKeyLevel.low,
        text: `${labelPrefix} L ${currentSessionKeyLevel.low.toFixed(2)}`,
        color: "rgba(0, 255, 170, 0.55)",
        side: "left",
      });
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
        // ("Sweep ×2") em vez de repetir o nome — informação idêntica,
        // etiqueta mais curta e precisa.
        const labelCounts = new Map<string, number>();
        for (const m of zone.members) labelCounts.set(m.label, (labelCounts.get(m.label) ?? 0) + 1);
        const toolNames = [...labelCounts.entries()].map(([l, n]) => (n > 1 ? `${l} ×${n}` : l)).join(" + ");
        // Evolução Total ("um objeto, um peso"): quando o orçamento visual
        // REDUZIU a ênfase da faixa desta zona (competição real entre
        // camadas), a etiqueta segue a mesma redução — razão entre o peso
        // resolvido e o peso próprio da zona (1 quando não houve
        // competição; nunca zero, resolvedWeight tem piso real de 0.35 no
        // motor). Zero curva nova: só os 2 números já reais.
        const base = confluenceWeight(zone.distinctSourceCount);
        const resolved = institutionalZoneVisualWeights[i];
        const alpha = resolved !== undefined && base > 0 ? Math.min(1, resolved / base) : 1;
        out.push({
          price: (zone.top + zone.bottom) / 2,
          text: `◆ ${toolNames}`,
          color: INSTITUTIONAL_ZONE_LABEL_COLOR,
          alpha,
          side: "left",
        });
      });
    }
    return out;
  }, [support, resistance, supportStrength, resistanceStrength, supportBreakouts, resistanceBreakouts, vwapLastValue, vwapState, visibility.vwap, nlLastValue, nexusLineState, visibility.nexus_line, emaLastValue, activeEmaPeriod, visibility.ema, data, visibility.trend_channel, trendChannelInfo, livePrice, tradePlan, targetsHit, decision, engineFallbackLevels, structureBreak, visibility.structure_breaks, structureBreakVisualWeight, traps, visibility.liquidity_sweep, visibility.session_key_levels, currentSessionKeyLevel, visibility.institutional_zones, institutionalZones, institutionalZoneVisualWeights]);

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
        />
      )}
      <div ref={containerRef} className="absolute inset-0" />
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
          className="absolute left-2 top-7 pointer-events-none select-none font-mono whitespace-nowrap text-[10px] tracking-wide"
          style={{ color: "rgba(138, 180, 248, 0.55)" }}
        >
          {engineFallbackLevels
            ? `SEM PLANO DO CONSELHO · ${tradePlanAbsenceReason} · linhas abaixo são do Núcleo`
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
      {visibility.liquidity_zones && (
        <LiquidityZonesPlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
          data={data}
          fairValueGaps={(fairValueGaps ?? []) as FillableZone[]}
          orderBlocks={(orderBlocks ?? []) as FillableZone[]}
          obstacleZones={obstacleZones ?? []}
          fvgVisualWeights={mainLiquidityVisualWeights.fvg}
          obVisualWeights={mainLiquidityVisualWeights.ob}
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
      {/* V-MAX Fase 1 (superfície visual): Volume Profile real (Fase 1.3)
         como barras à direita + linha do POC — overlay por cima do chart
         (pointer-events-none), dado direto da store. */}
      {visibility.volume_profile && (
        <VolumeProfilePlugin
          chart={chartReady?.chart ?? null}
          series={chartReady?.series ?? null}
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
    </div>
  );
}
