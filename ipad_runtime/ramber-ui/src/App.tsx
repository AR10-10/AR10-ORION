import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import { Rnd } from "react-rnd";
// V18 Sprint 1 (Tarefa A): UnifiedGlobalSnapshot — ver header do arquivo
// para por que é uma store ADITIVA (App.tsx continua a única fonte real de
// coleta; um efeito abaixo só espelha o dado já real para dentro dela).
import { useUnifiedSnapshotStore, usePriceSnapshot, useOfflineSnapshot, useDataFreshSnapshot, useVolumeProfileSnapshot, useFibonacciConfluenceSnapshot, useCpiSnapshot, useAffectiveMemorySnapshot, useCouncilSnapshot, useScenarioSnapshot, useTrapSignalsSnapshot, useConsensusRadarSnapshot, useTrustScoreSnapshot, useConnectionsSnapshot, useDerivativesSnapshot, useTradePlanSnapshot, useTrackRecordSnapshot, useMultiTimeframeSnapshot, useHealthSnapshot, useOrderflowHistory, useInstitutionalScoreHistory, usePremiumDiscountSnapshot, useHarmonicPatternsSnapshot, useTrianglePatternSnapshot, useHeadShouldersPatternSnapshot, useInstitutionalZonesSnapshot, useLayerRelevanceSnapshot, useRadarCandidatesSnapshot, useConfluenceCorridorSnapshot, usePaperTradingSnapshot, useExchangeOrderBooks, EMPTY_PRICE } from "./store/unified-snapshot-store";
// NÚCLEO GRAVITACIONAL AUTÔNOMO §1/§6: motor puro de relevância por
// camada — display-only (resposta do Operador: nunca gera/altera Entry/
// Stop/Target/Risco, LEI 24 intacta).
import {
  computeLayerRelevance,
  LIQUIDITY_PROXIMITY_PCT,
  FIBONACCI_PROXIMITY_PCT,
  VOLUME_PROFILE_PROXIMITY_PCT,
  MARKET_SESSION_RECENT_BOUNDARY_CANDLES,
  type LayerRelevanceInput,
  resolveAutoLayerVisibility,
} from "./nexus/layer-relevance";
import { computeConfluenceCorridor } from "./nexus/confluence-corridor";
// OMEGA CORE V-MAX (completar Fase 7, Radar/OIH): universo curado real +
// núcleo puro de qualificação/ranking (Fase 7 v1) + scanner real por
// ativo (engine-bridge.ts) — nenhum dos 3 é reimplementado aqui.
import { extractRadarUniverseSymbols, type AssetUniverseFile } from "./nexus/radar-universe";
import { qualifyRadarCandidate, rankRadarCandidates, describeRadarQualificationReason, type RadarQualificationResult } from "./nexus/radar-qualification";
// ADITIVO V-MAX Etapa 9: universo MEXC real (irmão de binance-symbols.ts,
// já usado pelo SmartOmnibox) — busca dinâmica, nunca uma lista curada
// estática como a Binance acima.
import { fetchMexcUsdtSymbols } from "./omnibox/mexc-symbols";
import assetUniverseDefault from "../../configs/asset-universe.default.json";
import { ageAlpha } from "./chart/annotation-decay";
import { BREAK_DECAY } from "./chart/StructureBreakMarkersPlugin";
import { MAX_KEY_LEVELS_SHOWN } from "./chart/SessionKeyLevelsPlugin";
// Mesmo motor puro que EnhancedChart_110_Percent.tsx já usa para desenhar
// o canal — chamado uma 2ª vez aqui de propósito (função determinística
// sobre os MESMOS candles reais, nunca uma segunda fórmula) porque o
// Relevance Engine roda fora do componente do canvas e precisa da largura
// real da banda.
import { computeTrendChannel, TREND_CHANNEL_DEFAULT_WINDOW, TREND_CHANNEL_STDDEV_MULTIPLIER } from "./nexus/trend-channel-engine";
// Ordem "Ciborgue Vivo" §3: síntese real de autodiagnóstico — mesmos
// sinais do Health Monitor/Data Quality Layer, nunca uma segunda medição.
import { buildDiagnosticReport, formatDiagnosticReportMarkdown } from "./nexus/self-diagnostics";
// ADITIVO V-MAX Etapa 10 (Data Quality Monitor unificado): vocabulário
// único OK/WARNING/FAIL/DADOS_INSUFICIENTES por cima dos 3 motores de
// qualidade reais (Bus/GMIL/Research) — nunca um 4º cálculo, só leitura.
import { classifyBusQuality, classifyWeight, classifySufficiencyScore, DATA_QUALITY_COLOR, type DataQualityLabel } from "./nexus/data-quality-vocabulary";
// Fase Ω Priority 1: tipos + lista canônica dos 6 prazos — mesma fonte que
// engine-bridge.ts usa para orquestrar, nunca uma segunda lista duplicada.
import { MULTI_TIMEFRAME_LIST, type MultiTimeframeId, type TimeframeContext } from "./nexus/multi-timeframe-engine";
// Signal Precision order (phase 4): actionable plan from real structure.
import { buildTradePlan, effectiveStopForTargetsHit, obstacleZonesInPath, type TradePlanStructureZone, type TradePlanLevelInput } from "./nexus/trade-plan";
// Autonomy order: honest signal accuracy — plans tracked against the real
// price, persisted across sessions, felt by the affective memory.
import { rehydrateTrackRecord, hitRate, EMPTY_TRACK_RECORD, type TrackedPlan } from "./nexus/signal-track-record";
import { rehydratePaperTrading, unrealizedPnl, unrealizedPnlPct, paperPositionContext } from "./nexus/paper-trading";
// v16.0 DEFINITIVO §9: primeiro assinante real de ORGANISM.TRACK_RECORD.UPDATED
// (event-bus.ts) — evento já emitido pelo OrganismOrchestrator, sem consumidor
// até esta entrega. Achado da AUDITORIA TÉCNICA COMPLETA (Seção F):
// deriveSweepAlert assina BRAIN.TRAPS.UPDATED, o segundo publicador real já
// existente sem consumidor de alerta (ver header de alert-center.ts).
import { deriveTrackRecordAlert, deriveSweepAlert, sweepIdentity, type AlertEvent } from "./nexus/alert-center";
// V-MAX Fase 0.4: chartTimeframe/CHART_TIMEFRAMES abaixo continuam string
// solta (pré-existente) — este cast é o único ponto de costura com o tipo
// estrito do Nexus, não uma reescrita do tipo legado.
import type { Timeframe } from "./nexus/types";
// V-MAX Fase 0.8: Health Monitor real, ligado direto (ver comentário no
// efeito de boot mais abaixo sobre por que este, diferente do
// CrossExchangeService da Fase 0.5, não fica dormente).
import { getNexusCore } from "./nexus/nexus-core";
import { getHealthMonitor } from "./nexus/health-monitor";
// Ordem "Próxima Evolução do Organismo": o orquestrador traduz cada escrita
// de fatia de saída de motor no UnifiedGlobalSnapshot em um evento tipado no
// bus do Nexus Core — a publicação dos motores é a própria escrita na store,
// nunca um emit() manual espalhado pelos efeitos.
import { getOrganismOrchestrator, getSnapshotForEngine } from "./nexus/organism-orchestrator";
// ORDEM OFICIAL Nº 01 (Autogovernança): traceStages() ganha o primeiro
// consumidor ao vivo — só o Relatório de Autodiagnóstico (TelemetryHealthWidget),
// sob demanda, mesma disciplina de "read-only observer" do próprio módulo.
import { traceStages } from "./nexus/stage-runner";
// Local-First (closes the persistence gap flagged in the audit): candles
// persisted to IndexedDB on every real REST arrival; on boot the chart
// paints instantly from the last REAL session before the network answers.
import { saveCandles, loadCandles, saveTrackRecord, loadTrackRecord, savePaperTrading, loadPaperTrading, compactPersistedCandles, candleKey } from "./nexus/persistence";
// V18 Sprint 1 (Tarefa B): "Destravar o Gráfico Institucional" — substitui
// o SVG feito à mão por lightweight-charts (pan/zoom/crosshair nativos).
import {
  EnhancedChart_110_Percent,
  DEFAULT_CHART_LAYER_VISIBILITY,
  DEFAULT_CHART_LAYER_AUTO_MODE,
  CHART_LAYER_IDS,
  type ChartLayerId,
  type ChartLayerVisibility,
} from "./chart/EnhancedChart_110_Percent";
// Diretriz Camada de Decisão Profissional, item 1: períodos reais expostos
// no painel Camadas do Gráfico — mesma lista canônica que o motor usa,
// nunca reinventada aqui.
import { EMA_PERIODS, DEFAULT_EMA_PERIOD, type EmaPeriod } from "./nexus/ema";
import {
  runRealAnalysisCycle,
  type RealCycleResult,
  startMexcOrderflowFeed,
  type OrderflowSignal,
  type OrderflowConnectorState,
  type OrderflowTick,
  startRealLiquidationFeed,
  type LiquidationEvent,
  computeSmcZones,
  type PriceZone,
  type LiquidityZone,
  getChartCandles,
  getOlderChartCandles,
  computeRealVolumeProfile,
  computeRealFibonacciConfluence,
  computeRealTrustScore,
  type ConfluenceSource,
  buildMultiTimeframeContext,
  computeBosChoch,
  computeLiquidityVoids,
  computeZigZag,
  scanRadarCandidate,
} from "./engine-bridge";
// V-MAX Fase 1.3: recorte de sessão UTC real para o Volume Profile (função
// pura — a matemática pesada roda no WASM do quant-worker).
import { filterSessionCandles, bucketMidPrice } from "./nexus/volume-profile";
// V-MAX Fase 1 item 4: Conselho Multi-Agente (7 agentes puros + Meta-Agent
// que delega a agregação ao linear opinion pool real da Fase F).
import { buildCouncilDecision, RSI_OVERBOUGHT, RSI_OVERSOLD, type CouncilDecision } from "./nexus/council";
// Ordem Nº 04 (§4, "consolidar camadas existentes... engine signals"):
// achado real de auditoria — engine-signal-contract.ts existia desde EPC
// OMEGA FINAL Parte 1 sem NENHUM consumidor real (zero import fora do
// próprio arquivo). CouncilWidget abaixo é o primeiro consumidor real —
// reforma a leitura ad hoc de council.votes para passar pelo contrato
// único, sem duplicar UI nem criar um segundo painel.
import { deriveEngineSignalsFromCouncil, deriveEngineSignalsFromInstitutionalZones } from "./nexus/engine-signal-contract";
// Carta Branca: consumidor real do Evidence Fusion Engine — SYSTEM_HANDBOOK
// §6.72/§6.74/§6.76 classificaram isto como "iniciativa de arquitetura
// própria" por 3 rodadas seguidas; agora tem seu primeiro consumidor vivo.
import { fuseEvidence, type EvidenceFusionSourceGroup } from "./nexus/evidence-fusion";
import { computeConsensusRadar, type ConsensusRadarCategory } from "./nexus/consensus-radar";
// MomentumAgent order ("chegando à perfeição"): RSI de Wilder, o mesmo
// exato computeRSI já real/exportado como feature interna do
// classificador k-NN — reaproveitado aqui integral (zero segunda
// matemática de RSI). Mesmo padrão de import relativo já usado por
// engine-bridge.ts para este mesmo arquivo legado.
import { computeRSI } from "../../src/research/engines/lorentzian-classifier.js";
// Diretriz Final de Integração Total: graduação real do MACD (EPC OMEGA
// FINAL) — motor já construído/testado, este é o primeiro consumidor
// real ao vivo.
import { computeMacdSeries, latestMacd } from "./nexus/macd";
// V-MAX Fase 2: cenários Path A/B (níveis reais + massa de opinião real do
// conselho) e armadilhas por corroboração de eventos reais.
import { buildScenarioProjection, formatScenarioPathLabel, type ScenarioLevel } from "./nexus/scenario-engine";
import { detectInstitutionalTraps } from "./nexus/trap-detection";
// Phase Ω Priority 2 ("Probability Engine" no pedido original do Operador —
// entregue honestamente como Confluence/Conviction Engine, ver o cabeçalho
// de confluence-engine.ts para o racional completo). Reaplica o MESMO pool
// linear real (Fase F) um nível acima, sobre os 3 subsistemas de opinião já
// reais e independentes (Ensemble/Council/Multi-Timeframe) — nunca uma
// probabilidade calibrada, nunca um segundo motor de decisão (LEI 24).
import { buildConvictionReading } from "./nexus/confluence-engine";
// Neural Market Aura (especificação do Operador, ver o cabeçalho de
// nexus/aura-lifecycle.ts para o racional completo de escopo/honestidade).
import { computeAuraReading, TIMEFRAME_MS, DISSOLVE_CONFIG } from "./nexus/aura-lifecycle";
import { computeChartIntegrity, type ChartIntegrityStatus } from "./nexus/chart-integrity";
// Entrega 40: mesmo book já desenhado pelo ladder abaixo — Bid/Ask Ratio e
// Imbalance são leituras derivadas puras dos MESMOS bids/asks, zero
// segunda assinatura de WebSocket (ver cabeçalho de nexus/order-book-depth.ts).
import { computeBidAskRatio, computeImbalance } from "./nexus/order-book-depth";
// Entrega 41: mesmo motor real do TpoProfilePlugin, usado aqui só pra
// derivar o sinal de relevância hasTpoProfile (ver relevanceInput abaixo).
import { computeTpoProfile } from "./nexus/tpo-profile";
// Entrega 42 ("Profitability Engine"): custo real sobre o Track Record JÁ
// resolvido (nunca um replay sintético) + expectativa/FilterEngine. LEI 24
// (exceção pontual autorizada pelo Operador) — ver comentário no ponto de
// uso (expectancyFilter) e em CoreSignalBadge.
import { simulateTradeCostsBatch } from "./nexus/trade-simulation";
import { evaluateSignalFilter, MIN_TRADES_FOR_VALID_EXPECTANCY, type FilterResult } from "./nexus/expectancy";
import { computeDecisionDistance, formatDecisionDistance, describeDecisionDistance, type DecisionDistanceReading } from "./nexus/decision-distance";
import { resolveFloatingWidgetOrigin } from "./nexus/floating-widget-origin";
// Escopo Cirúrgico (Operador, Fase 3 — Calibração de Probabilidade):
// councilVotesToModelVotes/regimeModelVote/fuseModelVotes/alignFusedConfidence
// (Fase 2, primeiro consumidor real) formam o score orientado à direção do
// plano; calibrateConfidence (Fase 3) o transforma em probabilidade
// calibrada só quando a amostra real sustenta isso — ver header dos dois
// arquivos para a auditoria completa.
import { councilVotesToModelVotes, regimeModelVote, fuseModelVotes, alignFusedConfidence } from "./nexus/model-fusion";
import { calibrateConfidence, type CalibrationResult } from "./nexus/platt-calibration";
import { computeOrganismHealth, type OrganismHealthVerdict } from "./nexus/organism-health";
// Diretriz Complementar (Nexus Predictive Engine) §3: ETA dinâmica por
// alvo — ATR real × Efficiency Ratio de Kaufman sobre os closes reais do
// gráfico; estimativa recomputada a cada ciclo, nunca uma garantia (ver
// cabeçalho de nexus/eta-engine.ts para a metodologia e os desvios
// documentados).
import { computeTargetEtas, formatEtaDuration, formatEtaRange } from "./nexus/eta-engine";
// Diretriz V-MAX de Refinamento Institucional (itens 5/6): Score Geral
// 0-100 (contrato de apresentação sobre a confluência real — zero segunda
// matemática de consenso) + Assistente Operacional (frases curtas, sempre
// tradução de leitura real, LEI 24 — ver cabeçalhos dos dois módulos).
import { computeInstitutionalScore, institutionalConfidenceZone, computeConvictionTrend } from "./nexus/institutional-score";
// Diretriz Complementar §18 ("tendência de força do fluxo"): motor puro
// real que reduz a MESMA série de CVD já retida (orderflow-history.ts,
// já consumida pelo heatmap) numa tendência — zero segunda fonte.
import { computeOrderflowTrend } from "./nexus/orderflow-history";
// Diretriz Complementar §7 ("Inteligência Temporal"): vocabulário real de
// contexto por timeframe — nunca uma medição, ver cabeçalho do módulo.
import { timeframeProfile } from "./nexus/timeframe-profile";
import { buildAssistantMessages } from "./nexus/operation-assistant";
import { computePremiumDiscount } from "./nexus/premium-discount";
import { detectHarmonicPatterns, MIN_FIT_SCORE } from "./nexus/harmonic-patterns";
// Carta Branca (Reconhecimento de Padrões): Triângulo e Ombro-Cabeça-Ombro —
// mesma disciplina de harmonic-patterns.ts (fail-closed, fitScore nunca
// probabilidade), motores isolados graduados agora ao pipeline real.
import { detectTrianglePattern } from "./nexus/triangle-pattern";
import { detectHeadAndShoulders } from "./nexus/head-shoulders-pattern";
// Consolidação Final §20-§30: estados da VWAP (matemática intocada, §20) +
// Nexus Line proprietária + confluência informativa — módulos puros novos.
import { computeSessionVwapSeries, latestVwap } from "./nexus/vwap";
import { computeVwapContext, type VwapContext, type DirectionalLineState } from "./nexus/vwap-state";
import { computeNexusLineSeries, latestNexusLine, nexusLineState, nexusConfluenceVerdict } from "./nexus/nexus-line";
// Evolução Integrativa §7: Operational Readability Layer — NexusDecision
// vira apresentação num módulo puro nomeado (zero matemática de direção).
import {
  buildNarrativeSummary,
  buildOperationalSummary,
  deriveBiasLabel,
  deriveConfluenceState,
  deriveEntryState,
  deriveOutcomeLabel,
  deriveRiskState,
  deriveSetupState,
  obstacleSuffix,
  type NexusOutcomeLabel,
} from "./nexus/operational-readability";
// Ordem "Market Analysis & Publication Engine": camada de apresentação/
// publicação PURA sobre o NexusDecision já real (zero cérebro novo, LEI 24
// intacta) — ver cabeçalho de nexus/market-analysis.ts para o racional
// completo. buildMarketAnalysis monta a mesma fotografia consumida pelas
// 3 vistas (Painel/X/Story); formatMarketAnalysisForX e PUBLIC_BIAS_LABEL
// são a ÚNICA tradução pública (vocabulário §9), reusada tal e qual em
// qualquer superfície publicável — nunca uma segunda redação por vista.
import { buildMarketAnalysis, formatMarketAnalysisForX, type MarketAnalysis } from "./nexus/market-analysis";
// Ordem "AR10 PUBLICATION STUDIO": camada de EXPORTAÇÃO sobre a mesma
// MarketAnalysis acima — 4 formatos publicáveis (Análise/Story/X/Card)
// desenhados em canvas puro, zero segunda inteligência (ver cabeçalho de
// publication/types.ts para o contrato completo).
import { renderPublicationAssets, revokePublicationAssets } from "./publication/generate";
import {
  PUBLICATION_FORMAT_SPECS,
  type PublicationAsset,
  type PublicationCandle,
  type PublicationFormat,
  type PublicationSnapshot,
} from "./publication/types";
// Fecho da pendência "R:R mínimo": piso DECLARADO 1:2 (ver rr-quality.ts),
// display-only — anota, nunca esconde/bloqueia um plano real (LEI 24).
import { rrFloorSuffix } from "./nexus/rr-quality";
import { marketSessionFromUtc, computeSessionBoundaries, computeSessionKeyLevels } from "./nexus/market-session";
// Ferramentas Institucionais (ADITIVO V-MAX/MED, prioridade #1): ICT Kill
// Zones — janela ESTREITA de alta probabilidade dentro da sessão, nunca
// uma 2ª partição de 24h (ver header de kill-zones.ts).
import { activeKillZones } from "./nexus/kill-zones";
import { computeHeatScore } from "./nexus/heat-score";
import { buildNexusDecision, type NexusDecision } from "./nexus/decision-layer";
// Evolução Incremental da Inteligência Central, Fase 1→2: primeiro
// consumidor real de unified-presentation.ts (nasceu isolado/testado,
// graduado aqui como badge ADITIVO — nunca substitui os badges reais
// existentes, Regra de Ouro 4).
import { computePresentationState } from "./nexus/unified-presentation";
// V-MAX Fase 1.2: "trade grande" real (percentil da amostra observada, ver
// header do arquivo) — nunca um limiar fixo inventado aqui na UI.
import {
  ingestTradesForLargeDetection,
  EMPTY_THRESHOLD_STATE,
  type OrderflowThresholdState,
  type OrderflowTrade,
} from "./nexus/orderflow-history";
// Fase F (V15): Comitê de Validação — linear opinion pool puro
// (src/consensus/). Importado pela CAMADA DE EXIBIÇÃO, não por
// engine-bridge.ts — o comitê consome contexto GMIL, e a LEI 04 proíbe
// GMIL de cruzar para o lado do Core Engine.
import {
  buildEnsembleConsensus,
  opinionFromLabel,
  opinionFromLean,
  opinionFromVote,
} from "../../src/consensus/index.js";
// Fase H (V15): Risk Engine — dimensionamento Risk/ATR com capping de
// Kelly fracionado (src/risk/). Consumidor terminal composto na camada de
// exibição (como o Comitê da Fase F): recebe números já computados pelos
// domínios reais, nunca toca o sinal do Core Engine.
import { buildRiskSuggestion } from "../../src/risk/index.js";
// Fase J (Cap. 17): classificadores puros de saúde do sistema — a UI só
// exibe; medições vêm de APIs reais (rAF, cronômetro do ciclo) e o que a
// plataforma não expõe (memória no Safari, CPU/GPU em qualquer navegador)
// é declarado, nunca fabricado.
import { classifyFps, classifyCycleLatency, memoryUsedMB, wasmVariantLabel } from "../../src/telemetry/index.js";
import { APP_SEAL } from "./version";
// llm-bridge.ts (and the @mlc-ai/web-llm package it imports) is loaded via
// dynamic import() only inside NeuralCoreWidget's activation handler below
// — never a static top-level import here. A static import would pull
// WebLLM's runtime code into the SAME bundle every visitor downloads on
// boot, defeating the entire point of this being opt-in. `import type`
// is erased at compile time (zero runtime/bundle cost either way).
import type { MLCEngineInterface } from "@mlc-ai/web-llm";
// synthetic-reading.ts is a tiny pure rule-based module (no @mlc-ai/web-llm
// dependency) — safe to import statically so a real tactical reading is
// available even before the optional LLM is ever activated.
import { buildSyntheticReading } from "./synthetic-reading";
import type { TacticalContextInput } from "./llm-bridge";
// IRON-VOICE layer (src/voice/) — decoupled: these modules never import
// from App; the App pushes real-state snapshots INTO them. TTS/STT are the
// browser's own speechSynthesis/webkitSpeechRecognition (feature-detected,
// fail-closed), so this static import costs a few KB, no model, no network.
import { voiceEngine } from "./voice/voice-engine";
import { computeAlerts } from "./voice/voice-dispatcher";
import type { TerminalSnapshot } from "./voice/voice-intents";
import { VoiceControlWidget } from "./voice/VoiceControlWidget";
// GMIL (Global Market Intelligence Layer, src/gmil/) — Providers →
// Normalizers → Event Bus → Consensus Engine, decoupled from the Core
// Engine on purpose: no module in engine-bridge.ts imports anything from
// gmil/, and nothing here ever writes into `engine`/`realCycle`. GMIL is
// read here purely as consultive context (LEI 01).
import { useGmilSnapshot } from "./gmil/use-gmil-snapshot";
import { gmilBus } from "./gmil/event-bus";
import { describeProviderHealthChange } from "./gmil/gmil-voice-alerts";
import { computeConsensus, type ConsensusInput } from "./gmil/consensus-engine";
// Overhaul Cross-Market (Missão 2): Smart Omnibox — busca categorizada
// multi-mercado (cripto/meme reais via Binance + taxonomia TradFi
// hardcoded para conexão futura) e o Empty State fail-closed que ela
// exige quando um ativo TradFi é escolhido (diretriz 4).
import { SmartOmnibox } from "./omnibox/SmartOmnibox";
import { TradFiEmptyState } from "./omnibox/TradFiEmptyState";
import { TRADFI_ASSETS, type TradFiAsset } from "./omnibox/tradfi-assets";
// Ordem Market Data Fabric, Fase 1: findByLegacyTradFiAssetSymbol conecta
// o TradFiAsset escolhido acima (ex. 'SPX') ao Instrument Registry
// TradFi/CME real (ex. CME_ES) SEM duplicar o catálogo/seletor já
// existente — 14 dos 17 ativos legados agora resolvem para um contrato
// real (9 futuros CME + 5 ações NASDAQ); o resto continua honesto em
// TradFiEmptyState (ver notes de cada
// InstrumentDefinition mapeada em instrument-registry.js). TradFiRealChart
// é deliberadamente minimalista (candlestick real, zero overlay do
// Institutional Chart Engine, zero Core Engine — LEI 24 intacta).
import { findByLegacyTradFiAssetSymbol } from "../../src/market-data-bus/index.js";
import { TradFiRealChart } from "./omnibox/TradFiRealChart";
// Master Panel handoff (Multi-Source Market Data Fusion, escopo reduzido a
// UMA fonte adicional real por decisão do Operador): Bybit USDT-M Perpétuo
// como segundo dado real e independente, comparado só contra o markPrice
// que a Binance já devolve em fetchDerivatives abaixo — nunca uma segunda
// fonte do Core Engine/Risk Engine (essa trava é da Fase G/Diretriz 2).
import { fetchBybitPerpTicker, compareCrossExchange, type CrossExchangeCheck } from "./cross-exchange/bybit-futures";
// Ponta Solta 1 (Auditoria do Ecossistema): leitura real do livro L2 por
// corretora que a store já capturava e ninguém lia.
import { computeCrossExchangeBook, describeCrossExchangeBook } from "./nexus/cross-exchange-book";
import { computeReversalReading, describeReversalReading } from "./nexus/reversal-detector";
// Terceira fonte real (pedido do Operador: "puxa dados públicos de
// qualquer outra corretora"): OKX Perpétuo, mesmo papel e mesma trava
// fail-closed da Bybit acima — ver header de okx-futures.ts.
import { fetchOkxPerpTicker } from "./cross-exchange/okx-futures";
// EPC FINAL §27 (Aditivo de Automação Total): MEXC Futures, 4ª fonte real
// de cross-check — resposta do Operador, secundária/mais completa, nunca
// substitui a Binance como fonte primária.
import { fetchMexcFuturesPerpTicker } from "./cross-exchange/mexc-futures";
import {
  LayoutDashboard,
  BarChart2,
  Activity,
  Scan,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Crosshair,
  Wifi,
  Disc,
  X,
  ShieldCheck,
  Power,
  Globe,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Pin,
  PanelLeft,
  PanelRight,
  Zap,
  Newspaper,
  Bell,
  Mic,
  MicOff,
  Layers,
  Radar as RadarIcon,
  Share2,
  Copy,
  Check,
  Download,
  Wallet,
  SlidersHorizontal,
} from "lucide-react";

export const WidgetContext = createContext<any>(null);

// ─────────────────────────────────────────────────────────────────────────────
// FAIL_CLOSED display layer.
//
// Constitution: READ_ONLY / FAIL_CLOSED. A null datum is NEVER promoted to a
// fabricated number — it renders the muted "—" / "AGUARDANDO" placeholder. There
// is no mock data, no synthetic trade levels, no inflated confidence, no fake
// open position, no Math.random() anywhere in this file. Signal/entry/target/
// stop come from engine-bridge.ts, which calls the SAME real WASM engine and
// research pipeline ipad_runtime/js/app.js uses (js/worker-client.js +
// js/real-data/analysis-frame.js + js/research/research-engine.js/
// target-tracker.js/trade-setup-matrix.js) — not a second implementation.
// Fase B (Market Data Bus): candles reach both this file (getChartCandles)
// and engine-bridge.ts through src/market-data-bus/ — neither calls
// js/real-data/binance-public.js directly anymore; only the Bus's own
// connector (binance-candle-connector.js) does. Live price/orderbook still
// come from this file's own direct Binance WS (same real public endpoint
// either way) — deliberately out of Fase B's first pass, see engine-bridge.ts.
// ─────────────────────────────────────────────────────────────────────────────
const DASH = "—";
const AWAIT = "AWAITING";

const num = (v: any): v is number => typeof v === "number" && Number.isFinite(v);

// Verified directly against market-structure-engine.js: ESTRUTURA_ALTA/
// ESTRUTURA_BAIXA/ESTRUTURA_LATERAL are the only 3 raw values it ever
// returns. Shared by the primary (15m) and higher-timeframe (1H) structure
// reads (V11.5 §2 multi-timeframe context) so both use one mapping.
const cleanStructureLabel = (raw: string | null | undefined): "ALTA" | "BAIXA" | "LATERAL" | null =>
  raw === "ESTRUTURA_ALTA" ? "ALTA" : raw === "ESTRUTURA_BAIXA" ? "BAIXA" : raw === "ESTRUTURA_LATERAL" ? "LATERAL" : null;

// Confiança do k-NN Lorentziano (0..1 real) como percentual inteiro — chamada
// tanto pelo badge inline do AssistantOrb quanto pelo tacticalInput do
// NeuralCoreWidget, que antes recomputavam a mesma conta a partir do mesmo
// realCycle.lorentzian.confidence (achado da auditoria de Sincronização
// Global). null quando não há leitura Lorentziana válida nesta sessão.
const lorentzianConfidencePct = (lorentzian: { ok: boolean; confidence?: number | null } | null | undefined): number | null =>
  lorentzian?.ok ? Math.round((lorentzian.confidence ?? 0) * 100) : null;

// Institutional quick-list (V11 §5) — os 5 favoritos de atalho na barra;
// deixaram de ser o universo INTEIRO de escolha com o Smart Omnibox
// (Overhaul Cross-Market, Missão 2), que lista qualquer ticker USDT real
// da Binance (cripto/meme) e a taxonomia TradFi hardcoded. Trocar de
// ativo continua re-apontando cada feed real (klines, derivativos, WS
// ticker/depth, order flow, ciclo do motor) para o novo símbolo;
// engine-bridge.ts's runRealAnalysisCycle/startMexcOrderflowFeed já
// aceitam qualquer símbolo (string), então isto reusa o mesmo caminho —
// nunca um segundo código.
// EPC FINAL §27 (Aditivo de Automação Total, resposta do Operador —
// expandir a lista curada antes de descoberta automática completa):
// achado real relevante — esta lista SEMPRE foi só os atalhos de 1 toque
// (comentário acima), nunca o universo de escolha; o Smart Omnibox já
// busca ao vivo QUALQUER par USDT real da Binance (fetchBinanceUsdtSymbols,
// omnibox/binance-symbols.ts), então "compatibilidade universal" já
// existia antes desta expansão. O que muda aqui é só o conjunto de
// atalhos: 7 pares reais adicionados, todos líquidos e listados tanto na
// Binance USDT-M Futures (fonte primária) quanto na MEXC Futures
// (cross-check, mexc-futures.ts) — nunca um par exótico de baixa liquidez.
const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT", "TON", "TRX"] as const;
type AssetSymbol = string;

// ─── Diretriz Evolução Contínua §3/§4: restauração de sessão Local-First ───
// A "memória de curto prazo" da UI que precisa sobreviver a refresh/fechar
// o PWA/reiniciar o iPad: ativo, timeframe e modo de mercado. Os DADOS já
// persistem por mecanismos próprios (candles via saveCandles, track record
// via nexus/persistence.ts IndexedDB) — isto restaura só o PONTO DE VISTA
// do Operador, para a tela reabrir exatamente onde parou. localStorage
// (síncrono) de propósito: precisa estar pronto ANTES do primeiro render
// para os inicializadores preguiçosos — IndexedDB é assíncrono demais para
// esse papel específico. Validação estrita: timeframe fora da lista real
// ou JSON corrompido => padrões de sempre (fail-closed, nunca quebra boot).
const SESSION_STATE_KEY = "ar10cyborg_session_v1";
const VALID_TIMEFRAMES = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "1w", "1M", "1H", "2H", "4H", "6H", "8H", "12H", "1D", "1W"]);

interface RestoredSession {
  asset: string;
  timeframe: string;
  marketMode: "CRYPTO" | "TRADFI";
  tradFiAsset: TradFiAsset | null;
  // Auditoria Final §6: configurações reais do Operador — visibilidade
  // das camadas do gráfico e período da EMA — também sobrevivem a
  // refresh/fechar o PWA. Validação por chave conhecida/valor da lista.
  chartLayers: ChartLayerVisibility;
  // NÚCLEO GRAVITACIONAL AUTÔNOMO §1: campo NOVO e aditivo — chave
  // ausente em sessões antigas (persistidas antes desta rodada) cai no
  // default automático de propósito (mesmo raciocínio de
  // DEFAULT_CHART_LAYER_VISIBILITY acima: nunca inventar um estado, só
  // que aqui o estado honesto de "nunca escolhido antes" É o automático,
  // não precisa de bump de versão da chave — chartLayers continua com a
  // MESMA forma/significado de sempre).
  chartLayerAutoMode: ChartLayerVisibility;
  emaPeriod: EmaPeriod;
}

function readRestoredSession(): RestoredSession {
  const fallback: RestoredSession = { asset: "BTC", timeframe: "15m", marketMode: "CRYPTO", tradFiAsset: null, chartLayers: DEFAULT_CHART_LAYER_VISIBILITY, chartLayerAutoMode: DEFAULT_CHART_LAYER_AUTO_MODE, emaPeriod: DEFAULT_EMA_PERIOD };
  try {
    const raw = window.localStorage.getItem(SESSION_STATE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const asset = typeof parsed?.asset === "string" && /^[A-Z0-9]{2,12}$/.test(parsed.asset) ? parsed.asset : fallback.asset;
    const timeframe = typeof parsed?.timeframe === "string" && VALID_TIMEFRAMES.has(parsed.timeframe) ? parsed.timeframe : fallback.timeframe;
    const marketMode = parsed?.marketMode === "TRADFI" ? "TRADFI" as const : "CRYPTO" as const;
    const tradFiAsset =
      marketMode === "TRADFI" && typeof parsed?.tradFiSymbol === "string"
        ? (TRADFI_ASSETS.find((a) => a.symbol === parsed.tradFiSymbol) ?? null)
        : null;
    // Camadas: só chaves conhecidas entram; ausentes ficam no default ON
    // (§2 Ativação Completa: nada nasce desligado — o restore respeita a
    // ESCOLHA do Operador, nunca inventa um estado).
    const chartLayers: ChartLayerVisibility = { ...DEFAULT_CHART_LAYER_VISIBILITY };
    if (parsed?.chartLayers && typeof parsed.chartLayers === "object") {
      for (const key of Object.keys(chartLayers) as ChartLayerId[]) {
        if (typeof parsed.chartLayers[key] === "boolean") chartLayers[key] = parsed.chartLayers[key];
      }
    }
    const chartLayerAutoMode: ChartLayerVisibility = { ...DEFAULT_CHART_LAYER_AUTO_MODE };
    if (parsed?.chartLayerAutoMode && typeof parsed.chartLayerAutoMode === "object") {
      for (const key of Object.keys(chartLayerAutoMode) as ChartLayerId[]) {
        if (typeof parsed.chartLayerAutoMode[key] === "boolean") chartLayerAutoMode[key] = parsed.chartLayerAutoMode[key];
      }
    }
    const emaPeriod: EmaPeriod = (EMA_PERIODS as readonly number[]).includes(parsed?.emaPeriod)
      ? (parsed.emaPeriod as EmaPeriod)
      : DEFAULT_EMA_PERIOD;
    // Modo TRADFI sem ativo TradFi restaurável degrada para CRYPTO — nunca
    // um cockpit em modo macro apontando para o nada.
    if (marketMode === "TRADFI" && !tradFiAsset) return { ...fallback, asset, timeframe, chartLayers, chartLayerAutoMode, emaPeriod };
    return { asset, timeframe, marketMode, tradFiAsset, chartLayers, chartLayerAutoMode, emaPeriod };
  } catch {
    return fallback;
  }
}
// Lido UMA vez no module-load (antes do primeiro render do App) — os
// inicializadores preguiçosos dos useState abaixo consomem este objeto.
const restoredSession = readRestoredSession();

function persistSessionState(s: { asset: string; timeframe: string; marketMode: string; tradFiSymbol: string | null; chartLayers: ChartLayerVisibility; chartLayerAutoMode: ChartLayerVisibility; emaPeriod: number }): void {
  try {
    window.localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(s));
  } catch {
    // storage cheio/indisponível (Safari private mode): sessão simplesmente
    // não persiste — nunca um erro visível por causa de uma conveniência.
  }
}

// V18.1 (pedido do Operador: "o gráfico tá com poucas velas... a gente
// olhar o passado também"): 200 velas reais por busca — 4x a janela
// anterior (50), casando com a capacidade padrão do ring buffer do
// Market Data Bus (DEFAULT_CAPACITY = 200, candle-ring-buffer.js), então
// nenhum candle real é descartado no caminho. O limite da própria
// Binance é 1500/request; subir além de 200 exigiria também subir a
// capacidade do buffer da chave compartilhada com o ciclo de análise —
// mudança de Bus, não deste consumidor.
const CHART_CANDLE_LIMIT = 200;

// Auditoria de arquitetura (revisão completa) — paginação histórica real:
// getOlderChartCandles (engine-bridge.ts) busca DIRETO do conector, nunca
// pelo Bus (ver comentário daquela função) — então este teto é só desta
// tela, não da chave compartilhada symbol:timeframe acima. Página do mesmo
// tamanho da carga inicial (consistência); teto 10x maior que a janela
// inicial preserva o mesmo espírito de "RAM previsível no iPad" do
// CandleRingBuffer, só que numa magnitude que já entrega história real
// útil (arrastar bem para trás) sem crescer sem limite.
const CHART_HISTORY_PAGE_SIZE = 200;
const MAX_CHART_HISTORY = 2000;

// Histerese real da zona de entrada do Trade Plan (achado real de
// auditoria, FASE Ω Priority 3, Finding K): sem isso, o preço oscilando
// bem na borda de [entry.low, entry.high] dispara "Preço real na região
// ideal de entrada" (voice-dispatcher.ts, regra 7) a cada transição
// false->true — uma borda "respirando" por poucos segundos gera vários
// alertas de voz repetidos para o MESMO toque real. Margem = fração do
// próprio range real da zona (auto-escalada ao ativo/preço — nunca um
// delta de preço fixo, que faria sentido para BTC e nenhum sentido para um
// ativo de US$ 0,001); só se aplica quando JÁ dentro (soltar exige sair
// além da margem) — a primeira entrada real continua exata, sem atraso.
const ENTRY_ZONE_HYSTERESIS_FACTOR = 0.25;

// OMEGA CORE V-MAX (completar Fase 7, Radar/OIH): universo curado
// computado UMA vez no módulo — configs/asset-universe.default.json é um
// import estático (não muda em runtime), recomputar a cada render/efeito
// seria custo sem propósito. Só os 3 grupos CRYPTO reais (a função já
// filtra o grupo EQUITY — ver radar-universe.ts).
const RADAR_UNIVERSE_SYMBOLS = extractRadarUniverseSymbols(assetUniverseDefault as AssetUniverseFile);
// O Market Data Bus dedupa POR chave symbol:timeframe mas não tem
// nenhum throttle ENTRE chaves diferentes (ver header do bus.js) — um
// scan do universo inteiro sem seu próprio limite de concorrência
// martelaria a REST da Binance ao mesmo tempo que o ciclo do ativo
// selecionado. 3 candidatos por lote + 2s de respiro: ~35 ativos varridos
// em ~25s, nunca competindo por throughput com o ciclo de 30s do ativo
// ao vivo nem com o de 60s do multi-timeframe. Regra de Ouro 6: 100%
// fetch assíncrono, zero cálculo síncrono pesado no Main Thread.
const RADAR_SCAN_BATCH_SIZE = 3;
const RADAR_SCAN_BATCH_DELAY_MS = 2000;
// Ciclo completo a cada 5min — bem mais lento que o ciclo do ativo
// selecionado e o multi-timeframe: o Radar é contexto de descoberta em
// segundo plano, nunca o caminho crítico do sinal (LEI 24).
const RADAR_SCAN_FULL_CYCLE_MS = 5 * 60_000;

// ADITIVO V-MAX Etapa 9 (MED "Radar Global: concluir completamente" +
// seção MEXC×Binance "separar apenas a camada de Provider, nunca
// duplicar o restante da arquitetura"): a MEXC pode ter centenas de
// contratos USDT-M, MUITO além dos ~30 da lista curada Binance —
// escanear TODOS a cada ciclo de 5min estouraria a janela (mesma
// matemática do comentário de RADAR_SCAN_BATCH_SIZE acima: 3/lote/2s
// não escala para centenas sem inflar a duração do ciclo muito além do
// timer que o dispara de novo). RADAR_MEXC_PAGE_SIZE limita cada ciclo
// a uma FATIA real do universo (mesma ordem de grandeza do universo
// curado Binance) — o cursor (radarMexcCursorRef) avança e recomeça do
// início ao esgotar a lista, então o universo INTEIRO é coberto ao
// longo de várias passagens, nunca perdido, nunca escaneado de uma vez
// só. Mesmo timer/batch/delay já existentes — zero segundo loop.
const RADAR_MEXC_PAGE_SIZE = 30;

// OMEGA CORE V-MAX (Fase 8.1, heatmap real de liquidação): teto de
// retenção do feed exchange-wide de liquidações — ver comentário no
// efeito de startRealLiquidationFeed para o racional completo (o
// heatmap filtra por símbolo, então precisa de mais história do que a
// lista "Forced Liquidations" sozinha exigia).
const LIQUIDATION_RETENTION_CAP = 500;

export type ChartCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };

// Funde o refresh periódico (`fresh`, sempre "os CHART_CANDLE_LIMIT mais
// recentes") de volta no array que pode já ter sido estendido para trás
// por paginação — nunca um replace cego, que apagaria história real que o
// usuário já carregou arrastando. Tudo em `existing` estritamente MAIS
// ANTIGO que o primeiro candle de `fresh` é preservado; a partir dali,
// `fresh` é autoritativo (pega qualquer correção real da vela em
// formação). Sem paginação nenhuma ainda, existing.length <= fresh.length
// e isto se comporta identico a um replace — zero mudança de
// comportamento no caso comum.
export function mergeFreshTail(existing: ChartCandle[], fresh: ChartCandle[]): ChartCandle[] {
  if (existing.length === 0 || fresh.length === 0) return fresh;
  const freshOldestTime = fresh[0].time;
  const olderPart = existing.filter((c) => c.time < freshOldestTime);
  if (olderPart.length === 0) return fresh;
  const merged = olderPart.concat(fresh);
  return merged.length > MAX_CHART_HISTORY ? merged.slice(merged.length - MAX_CHART_HISTORY) : merged;
}

const fmt = (v: number | null | undefined, d = 2) =>
  num(v)
    ? v.toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : DASH;

const fmtInt = (v: number | null | undefined) =>
  num(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : DASH;

const fmtSignedPct = (v: number | null | undefined, d = 2) =>
  num(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(d)}%` : DASH;

type Direction = "LONG" | "SHORT" | null;

interface PriceState {
  price: number | null;
  delta: number | null;
  deltaPct: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  direction: Direction;
}

interface DerivativesState {
  fundingRate: number | null; // real, Binance futures premiumIndex
  openInterest: number | null; // real, Binance futures openInterest (BTC)
  // v16.0 ULTRA §15.4: razão global de contas long/short, Binance futures
  // globalLongShortAccountRatio (público, keyless, período 5m). >1 = mais
  // contas long que short; <1 = mais short. Posicionamento agregado, nunca
  // um sinal de entrada.
  longShortRatio: number | null;
}

interface Level {
  price: number;
  size: number;
}

export default function App() {
  const [priceData, setPriceData] = useState<PriceState | null>(null);
  // Master Panel handoff: cross-check real Binance-vs-Bybit — puramente
  // informativo (nunca gate o Core Engine), atualizado na mesma cadência de
  // fetchDerivatives abaixo. INDISPONIVEL até o primeiro ciclo real.
  const [crossExchangeCheck, setCrossExchangeCheck] = useState<CrossExchangeCheck>({
    ok: false,
    priceDeltaPct: null,
    consensus: "INDISPONIVEL",
  });
  // Mesmo papel do crossExchangeCheck acima, para a OKX (terceira fonte).
  const [okxCrossExchangeCheck, setOkxCrossExchangeCheck] = useState<CrossExchangeCheck>({
    ok: false,
    priceDeltaPct: null,
    consensus: "INDISPONIVEL",
  });
  // EPC FINAL §27 (Aditivo de Automação Total): MEXC Futures, 4ª fonte de
  // cross-check real (resposta do Operador — secundária, nunca substitui
  // a Binance como fonte primária do ciclo do Core Engine).
  const [mexcCrossExchangeCheck, setMexcCrossExchangeCheck] = useState<CrossExchangeCheck>({
    ok: false,
    priceDeltaPct: null,
    consensus: "INDISPONIVEL",
  });
  const [derivatives, setDerivatives] = useState<DerivativesState>({
    fundingRate: null,
    openInterest: null,
    longShortRatio: null,
  });
  // V-MAX Fase 1.3: `volume` real por candle (o `v` que o Bus sempre
  // carregou, agora repassado por getChartCandles) — insumo do Volume
  // Profile. Todas as fontes reais de chartData vêm de getChartCandles,
  // então o campo é sempre real, nunca opcional-fabricado.
  const [chartData, setChartData] = useState<
    { time: number; open: number; high: number; low: number; close: number; volume: number }[]
  >([]);
  // Auditoria de estabilização (P1 — "apenas 15m responde corretamente"):
  // causa raiz real era dupla — getChartCandles() tinha '15m' fixo em
  // engine-bridge.ts (corrigido acima) e o seletor de timeframe no
  // ChartWidget era puramente decorativo (<span>, sem onClick, "15M"
  // sempre marcado ativo por um literal fixo). chartTimeframeRef existe
  // porque fetchSymbolData roda dentro de um efeito cujas deps são só
  // [bootGeneration, selectedAsset] (WS/boot — nunca deve reiniciar só
  // porque o timeframe mudou); o ref deixa o tick periódico de 30s sempre
  // ler o timeframe ATUAL sem precisar recriar esse efeito nem
  // reconectar o WebSocket.
  const [chartTimeframe, setChartTimeframe] = useState(() => restoredSession.timeframe);
  const chartTimeframeRef = useRef(chartTimeframe);
  useEffect(() => {
    chartTimeframeRef.current = chartTimeframe;
  }, [chartTimeframe]);
  const [orderBook, setOrderBook] = useState<{ bids: Level[]; asks: Level[] }>({
    bids: [],
    asks: [],
  });
  // V11.1 LEI 22 (Temporal Synchronization): timestamp real de quando cada
  // fonte foi vista pela última vez, para telemetria honesta de idade — não
  // um clock único forçado sobre tudo (WS tica a cada ~1s, o ciclo do motor
  // a cada 30s; cada fonte tem sua própria cadência real e não faz sentido
  // fingir que todas compartilham um relógio, só reportar a idade de cada
  // uma com honestidade).
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<number | null>(null);
  const [orderBookUpdatedAt, setOrderBookUpdatedAt] = useState<number | null>(null);
  const [scannerData, setScannerData] = useState<any[]>([]);
  const [bootAt] = useState(() => Date.now());
  const [wsLive, setWsLive] = useState(false);
  const [activeTab, setActiveTab] = useState("DASHBOARD");
  // V16 Workspace Manager panel (Pinned/Docked/Collapsed/Hidden/Floating
  // per secondary module) — opened from the SideBar's footer button.
  const [workspaceManagerOpen, setWorkspaceManagerOpen] = useState(false);
  // Camadas do Gráfico (Finding M, FASE Ω Priority 3) — mesmo padrão do
  // Workspace Manager acima, mas para os overlays do CANVAS do gráfico
  // (LiquidityZones/StructureBreaks/OrderFlowHeatmap/VolumeProfile/
  // TradePlanZone/NeuralMarketAura/EMA/TrendChannel — 8 desde a Auditoria
  // do painel do gráfico). Painel novo e aditivo: todas as
  // camadas continuam ligadas por padrão (DEFAULT_CHART_LAYER_VISIBILITY),
  // nada muda no comportamento existente até o Operador desligar algo.
  const [chartLayersOpen, setChartLayersOpen] = useState(false);
  // OMEGA CORE V-MAX (completar Fase 7, Radar/OIH): mesmo padrão de painel
  // dos dois acima — um toggle simples, ícone dedicado na SideBar, painel
  // fixed/centered. Lista só candidatos JÁ qualificados (radarCandidates,
  // fatia §4 CÉREBRO da store) — este flag controla só a VISIBILIDADE do
  // painel, nunca o próprio scan em segundo plano (que roda independente
  // do painel estar aberto, mesmo espírito do Workspace Manager).
  const [radarPanelOpen, setRadarPanelOpen] = useState(false);
  // Ordem "Market Analysis & Publication Engine" §2: mesmo padrão exato dos
  // 3 painéis acima (toggle simples, botão dedicado na SideBar, painel
  // fixed/centered) — a única novidade é o conteúdo (camada de publicação),
  // nunca um mecanismo de painel diferente.
  const [marketAnalysisOpen, setMarketAnalysisOpen] = useState(false);
  // v16.0 PRO MAX §9.1/§9.4: mesmo padrão exato dos painéis acima (toggle
  // simples, botão dedicado na SideBar, painel fixed/centered).
  const [paperTradingOpen, setPaperTradingOpen] = useState(false);
  // v16.0 DEFINITIVO §9: fila de toasts — sempre-visível, sem toggle (as
  // notificações aparecem por conta própria quando uma transição real
  // acontece). Efêmera por natureza (auto-dismiss em 5s): não entra na
  // store Local-First, não sobrevive a um reload — persistir um toast já
  // expirado seria uma confusão, não uma feature.
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [chartLayerVisibility, setChartLayerVisibility] = useState<ChartLayerVisibility>(() => restoredSession.chartLayers);
  // NÚCLEO GRAVITACIONAL AUTÔNOMO §1/§7 (resposta do Operador à pergunta
  // de escopo: os 20 toggles manuais continuam existindo como OVERRIDE
  // real, o padrão novo é o comportamento automático por trás deles).
  // Estrutura paralela, NUNCA uma reforma do tipo existente
  // (ChartLayerVisibility continua Record<ChartLayerId, boolean>, zero
  // migração, zero risco de regressão nos toggles que já funcionavam):
  // true = "automático" (o Relevance Engine decide agora), false =
  // "manual" (chartLayerVisibility[id] vale, exatamente como sempre
  // valeu). Default: tudo automático — é o comportamento novo pedido
  // ("eliminar a necessidade de ativar"), sem apagar o boolean antigo.
  const [chartLayerAutoMode, setChartLayerAutoMode] = useState<ChartLayerVisibility>(() => restoredSession.chartLayerAutoMode);
  const toggleChartLayer = useCallback((id: ChartLayerId) => {
    // Clicar no toggle individual é um ato explícito de override manual —
    // sai do automático nesse exato momento (resposta do Operador: toggle
    // manual sempre vence quando usado).
    setChartLayerAutoMode((prev) => ({ ...prev, [id]: false }));
    setChartLayerVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  // Reset explícito: devolve 1 camada ao comportamento automático (o
  // Operador muda de ideia sobre um override específico, sem precisar
  // resetar as outras).
  const resetChartLayerToAuto = useCallback((id: ChartLayerId) => {
    setChartLayerAutoMode((prev) => ({ ...prev, [id]: true }));
  }, []);
  // Diretriz de Evolução Autônoma Integral §11 ("MODO OPERACIONAL... E:
  // MODO AUDITORIA"), achado real de auditoria: o painel só tinha toggle
  // individual por camada — nenhum atalho para as 2 leituras reais que o
  // Operador de fato alterna entre si. Parâmetro declarado (convenção,
  // nunca medição — mesmo espírito do piso R:R): as 3 camadas que
  // desenham o PLANO em si (trade_plan_zone/neural_market_aura) e a
  // direção de tendência mais lida "de relance" (ema) — mapeiam
  // diretamente às prioridades visuais 1-6 da diretriz (direção/entrada/
  // invalidação/TP1-3); as outras 5 (estrutura/contexto, prioridades
  // 7-8) ficam ligadas só no Modo Auditoria. Puramente aditivo: nenhuma
  // camada é removida, o cálculo de todas continua ativo — só a exibição
  // muda, e o toggle individual continua funcionando normalmente depois.
  // Diretriz Suprema de Evolução Integrativa §8 ("Modo Inteligência"):
  // achado real de auditoria — só existiam 2 presets (Operacional/
  // Auditoria); a diretriz pede um 3º para análise profunda sem o ruído
  // do plano ativo. Mesmo mecanismo aditivo dos outros dois — nenhuma
  // camada nova, nenhum cálculo novo, só uma pré-seleção a mais.
  // NÚCLEO GRAVITACIONAL AUTÔNOMO §1/§7: um preset é curadoria manual
  // deliberada (mesma categoria do toggle individual) — aplicar
  // operational/audit/intelligence também sai do automático em todas as
  // camadas, para o resultado do preset nunca ser silenciosamente
  // sobrescrito pelo Relevance Engine. "automatic" é o 4º preset novo: a
  // única ação que devolve TODAS as camadas ao comportamento automático
  // de uma vez (o reset por camada individual, resetChartLayerToAuto,
  // continua existindo para ajustes finos).
  const applyChartLayerPreset = useCallback((preset: "operational" | "audit" | "intelligence" | "automatic") => {
    if (preset === "automatic") {
      setChartLayerAutoMode(
        CHART_LAYER_IDS.reduce((acc, id) => {
          acc[id] = true;
          return acc;
        }, {} as ChartLayerVisibility),
      );
      return;
    }
    setChartLayerAutoMode(
      CHART_LAYER_IDS.reduce((acc, id) => {
        acc[id] = false;
        return acc;
      }, {} as ChartLayerVisibility),
    );
    if (preset === "audit") {
      setChartLayerVisibility(DEFAULT_CHART_LAYER_VISIBILITY);
      return;
    }
    const activeSet = preset === "intelligence" ? CHART_LAYERS_INTELLIGENCE_PRESET : CHART_LAYERS_OPERATIONAL_PRESET;
    setChartLayerVisibility(
      CHART_LAYER_IDS.reduce((acc, id) => {
        acc[id] = activeSet.has(id);
        return acc;
      }, {} as ChartLayerVisibility),
    );
  }, []);
  // Diretriz Camada de Decisão Profissional, item 1: período real da EMA,
  // controlado no mesmo painel Camadas do Gráfico — um único período
  // ativo por vez (não uma pilha de linhas), mesmo padrão de "um controle
  // por camada" já usado ali.
  const [emaPeriod, setEmaPeriod] = useState<EmaPeriod>(() => restoredSession.emaPeriod);
  // V16.1 correção crítica (Protocolo TradingView e Gavetas Ocultas):
  // Market Intelligence (esquerda) / Core Intelligence (direita) são
  // gavetas fechadas por padrão — o Gráfico reina sozinho no boot.
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  // Painel Properties 320px (pedido do Operador, "painel e o visual...
  // nada repetido"): 3ª gaveta, mesmo mecanismo exato de esquerda/direita
  // (position:absolute, translateX, fechada por padrão) — ocupa o MESMO
  // slot visual da direita (.terminal-right/.terminal-properties
  // compartilham right:0 em index.css), nunca as duas ao mesmo tempo
  // (mutual exclusion abaixo cobre os 3 pares agora, não só 1).
  const [propertiesDrawerOpen, setPropertiesDrawerOpen] = useState(false);
  // Fase M.1 (Navigation Rail + Overlay Drawers): "Nunca permitir múltiplos
  // Drawers abertos simultaneamente. Somente um módulo poderá permanecer
  // aberto" — abrir uma gaveta fecha as outras; re-clicar no mesmo ícone da
  // régua fecha (toggle), como pedido em "Fechamento automático quando:
  // clicar novamente no ícone".
  const toggleLeftDrawer = useCallback(() => {
    setRightDrawerOpen(false);
    setPropertiesDrawerOpen(false);
    setLeftDrawerOpen((v) => !v);
  }, []);
  const toggleRightDrawer = useCallback(() => {
    setLeftDrawerOpen(false);
    setPropertiesDrawerOpen(false);
    setRightDrawerOpen((v) => !v);
  }, []);
  const togglePropertiesDrawer = useCallback(() => {
    setLeftDrawerOpen(false);
    setRightDrawerOpen(false);
    setPropertiesDrawerOpen((v) => !v);
  }, []);
  // "Fechamento automático quando:... pressionar ESC (Desktop)". Estado
  // funcional (v ? false : v) em vez de useCallback-com-dependência: o
  // listener nunca precisa ser re-registrado quando uma gaveta abre/fecha.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setLeftDrawerOpen((v) => (v ? false : v));
      setRightDrawerOpen((v) => (v ? false : v));
      setPropertiesDrawerOpen((v) => (v ? false : v));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // The currently analyzed asset. Included in the SAME effect dependency
  // arrays as bootGeneration below — switching it tears down and re-opens
  // the market-data WS/REST, engine cycle, and order-flow feed exactly like
  // a manual "RESTART SYSTEM" does, just scoped to the new symbol
  // instead of the same one.
  //
  // Diretriz Evolução Contínua §3/§4 ("o sistema nunca foi fechado"):
  // ativo/timeframe/modo são hidratados da ÚLTIMA sessão real
  // (localStorage, mesmo mecanismo do portão de acesso; os candles em si
  // já persistem Local-First via saveCandles desde antes). Inicializador
  // preguiçoso + try/catch: storage indisponível/corrompido degrada para
  // os padrões de sempre, nunca quebra o boot (fail-closed).
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>(() => restoredSession.asset);

  // Overhaul Cross-Market (Missão 2): o Smart Omnibox também lista a
  // taxonomia TradFi (índices/ações/commodities/forex). Escolher um ativo
  // TradFi NUNCA muda `selectedAsset` (o motor real continua rodando sobre
  // a última cripto real, intocado) — só liga o modo TRADFI, que faz os
  // painéis específicos de CRIPTO (order book/flow/heatmap/Council/
  // Siriform/Regime — mecânica de perpétuo, NAO_APLICAVEL para um futuro
  // CME) mostrarem o Empty State fail-closed em vez de tentar (e falhar)
  // puxar dado da Binance para um símbolo que não é dela (diretriz 4, Modo
  // Fail-Closed). Ordem Market Data Fabric, Fase 1: o GRÁFICO PRINCIPAL
  // não é mais sempre Empty State — resolvedTradFiInstrument abaixo resolve
  // 14 dos 17 ativos legados (9 futuros CME + 5 ações NASDAQ) para um
  // contrato real do Instrument Registry (Yahoo delayed); o resto
  // continua honesto em Empty State.
  const [marketMode, setMarketMode] = useState<"CRYPTO" | "TRADFI">(() => restoredSession.marketMode);
  const [selectedTradFiAsset, setSelectedTradFiAsset] = useState<TradFiAsset | null>(() => restoredSession.tradFiAsset);
  const resolvedTradFiInstrument = useMemo(
    () => (selectedTradFiAsset ? findByLegacyTradFiAssetSymbol(selectedTradFiAsset.symbol) : null),
    [selectedTradFiAsset],
  );

  // Bumping bootGeneration tears down and re-runs every real boot effect
  // below (REST fetch + WS connect, engine cycle, order flow feed,
  // liquidation feed) — a manual "force refresh everything" trigger, not
  // a gate the initial load waits behind (all of those effects already
  // run automatically on mount regardless of this value).
  const [bootGeneration, setBootGeneration] = useState(0);
  // True only after the FIRST attempt AND its retries all fail — never set
  // by the recurring 60s interval calls, which keep their own existing
  // fail-closed behavior (silently try again next tick).
  const [bootRestFailed, setBootRestFailed] = useState(false);
  const handleManualRestart = useCallback(() => {
    setBootRestFailed(false);
    setBootGeneration((g) => g + 1);
  }, []);

  // Real engine cycle (WASM + research pipeline via engine-bridge.ts).
  // 'pending' until the first cycle resolves — the UI must never show a
  // signal/level before the real engine has actually produced one.
  const [realCycle, setRealCycle] = useState<RealCycleResult | null>(null);
  const [engineStatus, setEngineStatus] = useState<"pending" | "ok" | "error">("pending");

  // Real Order Flow Engine (OFI/Absorption/Exhaustion) fed by real MEXC trades
  // (engine-bridge.ts's startMexcOrderflowFeed). "pending" until the first
  // poll cycle reports a state, matching the FAIL_CLOSED rule used everywhere
  // else in this file.
  const [orderflowSignals, setOrderflowSignals] = useState<OrderflowSignal[]>([]);
  // OMEGA CORE V-MAX (Fase 1.1): espelha o MESMO orderflowSignals real (nunca
  // recomputado) para a fatia §3 da store — um useEffect em vez de escrever
  // dentro do updater funcional de setOrderflowSignals acima, porque um
  // updater funcional pode rodar 2x sob StrictMode (dev): um efeito colateral
  // ali dentro emitiria um evento espúrio duplicado no bus.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setOrderflowSignals(orderflowSignals);
  }, [orderflowSignals]);
  const [orderflowState, setOrderflowState] = useState<OrderflowConnectorState | "pending">("pending");
  const [orderflowReason, setOrderflowReason] = useState<string | null>(null);
  // Real Cumulative Volume Delta — running sum of signed real MEXC trade
  // volume since this tab opened (see signal-engine.js). Null until the
  // first real tick batch is ingested.
  const [cvd, setCvd] = useState<number | null>(null);
  // V-MAX Fase 1.2: estado real da amostra de volumes (percentil de "trade
  // grande") e o lote de trades grandes do ciclo de poll EM CURSO — refs,
  // não state, porque nada aqui precisa re-renderizar por conta própria;
  // o consumidor real (OrderFlowHeatmapPlugin) lê da store via
  // useOrderflowHistory, não daqui. onTrades sempre dispara antes de onCvd
  // dentro do MESMO ciclo (garantia real de engine-bridge.ts's
  // startMexcOrderflowFeed), por isso pendingLargeTradesRef está sempre
  // atualizado quando onCvd o consome logo abaixo.
  const orderflowThresholdStateRef = useRef<OrderflowThresholdState>(EMPTY_THRESHOLD_STATE);
  const pendingLargeTradesRef = useRef<OrderflowTrade[]>([]);
  // V-MAX Fase 1.3: cadência do Volume Profile (ver efeito junto a smcZones).
  const volumeProfileLastComputeRef = useRef(0);

  // Real institutional liquidation feed (Binance USDT-M Futures, public —
  // engine-bridge.ts's startRealLiquidationFeed). Capped to the most
  // recent 30 — a real feed of forced-liquidation events, not a polling
  // snapshot, so it can only ever grow via real exchange events.
  const [liquidations, setLiquidations] = useState<LiquidationEvent[]>([]);
  const [liquidationState, setLiquidationState] = useState<"LIVE" | "ERROR" | "pending">("pending");

  // Widget Workspace Manager state (V16): 5 conceptual states — Pinned,
  // Docked, Collapsed, Hidden, Floating — built from 4 orthogonal booleans
  // rather than a single enum, so the existing generic toggleWidget(id, prop)
  // mechanism (and every existing widgets[id].visible/.floating read site)
  // keeps working unmodified:
  //   hidden    = !visible
  //   floating  = visible && floating
  //   collapsed = visible && !floating && collapsed
  //   pinned    = visible && !floating && !collapsed && pinned
  //   docked    = visible && !floating && !collapsed && !pinned
  // V16 Institutional Command Center defaults: Chart (center), Market
  // Direction + Siriform Core summary (left), GMIL/Market Regime/Decision
  // Validation (Consensus+Risk+Data Quality)/System Health (right) are
  // ALWAYS docked — never gear-gated, per the operator's explicit reference
  // layout. Everything else (order book/flow/liquidity heatmap/scanner/
  // exposure/events/neural core/asset heatmap/tactical liquidations) is a
  // secondary tool: defaults to hidden, reachable on demand via the
  // Workspace Manager panel. Persisted to localStorage so a reload never
  // silently drops the dashboard back to a near-empty screen.
  const WIDGET_PREFS_KEY = "ramber_widget_prefs_v2";
  const DEFAULT_WIDGETS: { [key: string]: { visible: boolean; floating: boolean; collapsed: boolean; pinned: boolean } } = {
    chart: { visible: true, floating: false, collapsed: false, pinned: true },
    orderflow: { visible: false, floating: false, collapsed: false, pinned: false },
    heatmap: { visible: false, floating: false, collapsed: false, pinned: false },
    market_direction: { visible: true, floating: false, collapsed: false, pinned: false },
    // Collapsed by default — the compact SiriformCoreCard (right column)
    // always shows the real summary; expanding reveals the full,
    // unmodified AssistantOrb detail (forecast/voice/quick actions) below
    // the 3-column row, never removed, just progressively disclosed.
    se_core: { visible: true, floating: false, collapsed: true, pinned: false },
    orderbook: { visible: false, floating: false, collapsed: false, pinned: false },
    scanner: { visible: false, floating: false, collapsed: false, pinned: false },
    exposure: { visible: false, floating: false, collapsed: false, pinned: false },
    gmil_context: { visible: true, floating: false, collapsed: false, pinned: false },
    events: { visible: false, floating: false, collapsed: false, pinned: false },
    neural_core: { visible: false, floating: false, collapsed: false, pinned: false },
    tactical: { visible: false, floating: false, collapsed: false, pinned: false },
    market_regime: { visible: true, floating: false, collapsed: false, pinned: false },
    system_health: { visible: true, floating: false, collapsed: false, pinned: false },
    asset_heatmap: { visible: false, floating: false, collapsed: false, pinned: false },
    decision_validation: { visible: true, floating: false, collapsed: false, pinned: false },
    // V-MAX Fase 1 (superfície visual): HUD do Conselho Multi-Agente + CPI.
    council: { visible: true, floating: false, collapsed: false, pinned: false },
    // Fase Ω Priority 1: matriz de contexto real por prazo (1m-1D). Ferramenta
    // secundária como scanner/exposure/etc — oculta por padrão, sob demanda
    // via Workspace Manager (mesma disciplina de densidade/zero-scroll já
    // aplicada aos outros painéis analíticos desta lista).
    multi_timeframe: { visible: false, floating: false, collapsed: false, pinned: false },
  };
  const [widgets, setWidgets] = useState<{
    [key: string]: { visible: boolean; floating: boolean; collapsed: boolean; pinned: boolean };
  }>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_PREFS_KEY);
      if (!saved) return DEFAULT_WIDGETS;
      const parsed = JSON.parse(saved);
      // Merge per known key only — saved prefs from an older build must not
      // resurrect widgets that no longer exist (ConfigPanel renders straight
      // from these keys, so a stale entry would show a dead toggle).
      const merged = { ...DEFAULT_WIDGETS };
      for (const key of Object.keys(merged)) {
        if (parsed && typeof parsed[key]?.visible === "boolean") {
          merged[key] = { ...merged[key], ...parsed[key] };
        }
      }
      return merged;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(widgets));
    } catch {
      // Best-effort only — private browsing / quota errors never block the UI.
    }
  }, [widgets]);

  // Stable identity across renders (functional setState form needs no deps) —
  // required so the memoized context value below doesn't churn on every tick.
  const toggleWidget = useCallback((id: string, prop: "visible" | "floating" | "collapsed" | "pinned") => {
    setWidgets((prev) => ({
      ...prev,
      [id]: { ...prev[id], [prop]: !prev[id][prop] },
    }));
  }, []);

  // V16 Workspace Manager: jumps a module directly to one of the 5 named
  // states in one shot — the generic single-boolean toggleWidget above
  // can't express "go straight to Floating from Hidden" (that needs BOTH
  // visible AND floating flipped together), so the panel needs its own
  // explicit setter instead of composing multiple toggleWidget calls.
  const setWidgetWorkspaceState = useCallback(
    (id: string, state: "hidden" | "docked" | "collapsed" | "pinned" | "floating") => {
      setWidgets((prev) => {
        const flags =
          state === "hidden"
            ? { visible: false, floating: false, collapsed: false, pinned: false }
            : state === "docked"
              ? { visible: true, floating: false, collapsed: false, pinned: false }
              : state === "collapsed"
                ? { visible: true, floating: false, collapsed: true, pinned: false }
                : state === "pinned"
                  ? { visible: true, floating: false, collapsed: false, pinned: true }
                  : { visible: true, floating: true, collapsed: false, pinned: false };
        return { ...prev, [id]: { ...prev[id], ...flags } };
      });
    },
    [],
  );

  // Klines: candles do gráfico agora vêm do Market Data Bus (Fase B —
  // getChartCandles em engine-bridge.ts), a MESMA chave symbol:15m que o
  // ciclo de análise (runCycle, abaixo) já pede. Nenhum fetch() direto a
  // api.binance.com/klines é feito por este componente desde a Fase B —
  // antes disso havia dois fetches independentes do mesmo candle real a
  // cada ~30s (achado da Fase A).
  //
  // 24h scanner ticker: ainda um fetch() direto — fora do escopo desta
  // primeira fase do Market Data Bus (não é candle; ver relatório da Fase
  // B). Retorna success/failure so the boot sequence below can retry a
  // transient failure quickly instead of silently waiting for the next 60s
  // tick.
  // isStale (Diretriz de Evolução Geral do Organismo — auditoria de
  // sincronização, achado real): antes desta correção, nem o retry de
  // boot nem o setInterval de 30s abaixo verificavam se o Operador já
  // tinha trocado de ativo ENQUANTO um destes awaits estava em voo — o
  // mesmo padrão que runCycle (efeito do ciclo do motor, mais abaixo)
  // já usa com `cancelled`, só que fetchSymbolData/fetchDerivatives vivem
  // FORA do efeito (deliberado — ver comentário de chartTimeframeRef
  // acima), então a checagem precisa ser passada como parâmetro em vez
  // de vir de uma closure direta sobre a variável do efeito. Sem isto:
  // trocar de BTC pra ETH com uma resposta de BTC ainda em voo faria
  // candles de BTC serem mesclados no chartData do ETH, já resetado,
  // rotulados sob o título errado.
  const fetchSymbolData = async (isStale: () => boolean): Promise<boolean> => {
    try {
      const candles = await getChartCandles(selectedAsset, CHART_CANDLE_LIMIT, chartTimeframeRef.current);
      if (!candles) throw new Error('market_data_bus_sem_candles_validos');
      if (isStale()) return true; // ativo trocou durante o fetch — descarta, nunca aplica dado do ativo errado
      // Auditoria de arquitetura: merge, nunca um replace cego — preserva
      // história real que a paginação (arrastar para trás) já carregou.
      setChartData((prev) => mergeFreshTail(prev, candles));
      // Local-First: persist the real series (fire-and-forget — a storage
      // failure never blocks or delays the live path).
      void saveCandles(selectedAsset, chartTimeframeRef.current as Timeframe, candles).catch(() => {});

      const tickerRes = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT"]`,
      );
      if (!tickerRes.ok) throw new Error(`ticker HTTP ${tickerRes.status}`);
      const tickerData = await tickerRes.json();
      if (isStale()) return true; // 2ª checagem: o ativo pode ter trocado durante ESTE await também
      if (Array.isArray(tickerData)) {
        setScannerData(
          tickerData.map((t) => {
            const change = Number(t.priceChangePercent);
            return {
              p: t.symbol.replace("USDT", "/USDT"),
              s: change > 1 ? "LONG" : change < -1 ? "SHORT" : "NEUTRAL",
              str: Math.min(Math.abs(change) * 20, 100),
              chg: change, // real 24h % — replaces the old Math.random() timestamp
            };
          }),
        );
      }
      return true;
    } catch {
      // FAIL_CLOSED: leave last known real data; never substitute fabricated values.
      return false;
    }
  };

  // REST: real Binance futures funding rate + open interest (public, read-only).
  // isStale: mesmo raciocínio/mesma correção de fetchSymbolData acima —
  // sem isto, dados de derivativos do ativo ANTERIOR (ou pior, um
  // fundingRate/openInterest nulo do catch) podiam sobrescrever o estado
  // já resetado do ativo novo.
  const fetchDerivatives = async (isStale: () => boolean): Promise<boolean> => {
    let binanceOk = false;
    let binanceMarkPrice: number | null = null;
    try {
      const [fundingRes, oiRes] = await Promise.all([
        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${selectedAsset}USDT`),
        fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${selectedAsset}USDT`),
      ]);
      if (!fundingRes.ok || !oiRes.ok) throw new Error(`derivatives HTTP ${fundingRes.status}/${oiRes.status}`);
      const funding = await fundingRes.json();
      const oi = await oiRes.json();
      binanceMarkPrice = num(Number(funding?.markPrice)) ? Number(funding.markPrice) : null;
      if (!isStale()) {
        setDerivatives((prev) => ({
          ...prev,
          fundingRate: num(Number(funding?.lastFundingRate))
            ? Number(funding.lastFundingRate)
            : null,
          openInterest: num(Number(oi?.openInterest))
            ? Number(oi.openInterest)
            : null,
        }));
      }
      binanceOk = true;
    } catch {
      if (!isStale()) setDerivatives((prev) => ({ ...prev, fundingRate: null, openInterest: null }));
    }

    // v16.0 ULTRA §15.4: long/short ratio — endpoint público keyless
    // próprio (globalLongShortAccountRatio), confirmado via WebSearch
    // contra a documentação oficial da Binance (WebFetch direto ao
    // domínio foi bloqueado pelo proxy deste sandbox — mesma limitação de
    // rede de qualquer outro acesso à Binance nesta sessão, nunca
    // verificado ao vivo aqui). Try/catch PRÓPRIO, independente do de
    // funding/OI acima: são 2 requisições a endpoints diferentes: uma
    // falha transitória num nunca deve apagar o outro se ele respondeu
    // com sucesso no mesmo ciclo — por isso o update funcional (prev =>
    // ...), nunca um objeto literal que sobrescreveria o campo do outro
    // fetch por engano numa corrida entre os dois.
    try {
      const lsRes = await fetch(
        `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${selectedAsset}USDT&period=5m&limit=1`,
      );
      if (!lsRes.ok) throw new Error(`long_short HTTP ${lsRes.status}`);
      const lsJson = await lsRes.json();
      const latest = Array.isArray(lsJson) ? lsJson[lsJson.length - 1] : null;
      const ratio = num(Number(latest?.longShortRatio)) ? Number(latest.longShortRatio) : null;
      if (!isStale()) setDerivatives((prev) => ({ ...prev, longShortRatio: ratio }));
    } catch {
      if (!isStale()) setDerivatives((prev) => ({ ...prev, longShortRatio: null }));
    }

    // Master Panel handoff: cross-check Bybit + OKX + MEXC Futures —
    // independente do try/catch acima por design, buscados em paralelo
    // (Zero Latência: uma fonte lenta não atrasa a outra).
    // fetchBybitPerpTicker()/fetchOkxPerpTicker()/fetchMexcFuturesPerpTicker()
    // já são fail-closed internamente (nunca lançam), então uma falha em
    // qualquer uma nunca reverte nem atrasa o resultado real da Binance já
    // processado logo acima.
    const [bybit, okx, mexc] = await Promise.all([
      fetchBybitPerpTicker(selectedAsset),
      fetchOkxPerpTicker(selectedAsset),
      fetchMexcFuturesPerpTicker(selectedAsset),
    ]);
    if (!isStale()) {
      setCrossExchangeCheck(compareCrossExchange(binanceMarkPrice, bybit));
      setOkxCrossExchangeCheck(compareCrossExchange(binanceMarkPrice, okx));
      setMexcCrossExchangeCheck(compareCrossExchange(binanceMarkPrice, mexc));
    }

    return binanceOk;
  };

  // Bounded retry for the ONE-SHOT boot calls above (2s/4s/8s backoff) — the
  // recurring setInterval calls deliberately keep their existing
  // fail-closed "wait for next tick" behavior; this is only for the
  // first attempt, so a transient hiccup on page load doesn't leave the
  // user staring at AGUARDANDO for up to 60s with no visible retry.
  const retryBoot = async (
    fn: () => Promise<boolean>,
    isCancelled: () => boolean,
    attempts = 3,
  ): Promise<boolean> => {
    for (let i = 0; i < attempts; i++) {
      if (isCancelled()) return true; // unmounted/restarted mid-retry — not a failure
      if (await fn()) return true;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, i)));
      }
    }
    return false;
  };

  // Switching the selected asset must clear every display value scoped to
  // the PREVIOUS asset before the new one's feeds connect — otherwise the
  // old asset's price/candles/order book/signal/confidence would sit on
  // screen for a moment mislabeled as the new asset's. Deliberately its own
  // effect, scoped only to [selectedAsset] (not bootGeneration) — a manual
  // "RESTART SYSTEM" on the SAME asset should keep showing last-known-
  // good data while it reconnects, per existing fail-closed behavior; only
  // an actual asset change should blank the screen back to AGUARDANDO.
  useEffect(() => {
    setPriceData(null);
    setChartData([]);
    setOrderBook({ bids: [], asks: [] });
    setOrderflowSignals([]);
    setCvd(0);
    // OMEGA CORE V-MAX (Fase 1.1): a fatia §3 `cvd` da store usa null (não o
    // 0 cosmético acima) — null é o "ainda sem leitura real deste ativo"
    // honesto (Regra de Ouro 3); a soma corrida real no worker de order
    // flow nunca é de fato reiniciada por troca de ativo (ver
    // signal-engine.js), então nem o 0 local nem um null aqui mudam esse
    // comportamento real — só a exibição enquanto o próximo poll não chega.
    // `smc`/`orderflowSignals` não precisam de reset explícito aqui: os
    // useEffect([smcZones])/useEffect([orderflowSignals]) já espelham o
    // valor honesto (zonas vazias / [] local, ambos já zerados acima).
    useUnifiedSnapshotStore.getState().setCvd(null);
    // OMEGA CORE V-MAX (Fase 5): o Corredor de Confluência é derivado de
    // sinais já escopados ao ativo (opinionMass/institutionalScore/MTF/
    // obstáculo) — o próprio useEffect que o computa já reage a
    // engine?.direction/councilFromSnapshot/etc, todos zerados por este
    // mesmo efeito; setConfluenceCorridor(null) aqui só torna a transição
    // explícita e imediata (fail-closed honesto), em vez de esperar o
    // ciclo de re-render do useMemo pra chegar no mesmo null.
    useUnifiedSnapshotStore.getState().setConfluenceCorridor(null);
    setRealCycle(null);
    setEngineStatus("pending");
    setPriceUpdatedAt(null);
    setOrderBookUpdatedAt(null);
    // Diretriz Suprema de Evolução Integrativa §3 (achado real de
    // auditoria): ao contrário dos campos acima, funding/OI e os dois
    // cross-exchange checks NÃO eram resetados aqui — mostravam o valor
    // do ativo ANTERIOR (até 8s de atraso real, o pior caso do retry de
    // fetchDerivatives) enquanto preço/candles/order book já mostravam o
    // novo. Mesmos valores iniciais dos useState acima — o mesmo "estado
    // de carregamento honesto" que o primeiro boot já usa, nunca um dado
    // fabricado do ativo novo.
    setDerivatives({ fundingRate: null, openInterest: null, longShortRatio: null });
    setCrossExchangeCheck({ ok: false, priceDeltaPct: null, consensus: "INDISPONIVEL" });
    setOkxCrossExchangeCheck({ ok: false, priceDeltaPct: null, consensus: "INDISPONIVEL" });
    setMexcCrossExchangeCheck({ ok: false, priceDeltaPct: null, consensus: "INDISPONIVEL" });
    // V-MAX Fase 1.1/1.2: l2History/orderflowHistory na store são séries
    // acumuladas ao longo do tempo (não um valor pontual como os acima) do
    // ativo ANTERIOR — sem isto, o OrderFlowHeatmapPlugin mostraria amostras
    // do ativo antigo sobrepostas ao gráfico do novo por vários minutos.
    useUnifiedSnapshotStore.getState().resetL2History();
    useUnifiedSnapshotStore.getState().resetOrderflowHistory();
    // Diretriz Complementar §18/§4: mesma disciplina — a série do Score
    // Geral do ativo ANTERIOR não pode vazar para a tendência do novo.
    useUnifiedSnapshotStore.getState().resetInstitutionalScoreHistory();
    useUnifiedSnapshotStore.getState().setVolumeProfile(null);
    volumeProfileLastComputeRef.current = 0;
    orderflowThresholdStateRef.current = EMPTY_THRESHOLD_STATE;
    pendingLargeTradesRef.current = [];
    // multiTimeframeContext é buscado só por [selectedAsset] (efeito
    // abaixo) — sem limpar aqui, a Matriz do ativo antigo ficava visível
    // até a primeira leitura real do novo resolver (mesmo padrão de
    // "tela em branco até dado real" já usado acima para
    // price/chartData/orderBook).
    useUnifiedSnapshotStore.getState().setMultiTimeframeContext(null);
    // trackRecord (o agregado hitRate/targetHits/stopHits) NÃO é zerado
    // aqui — tem seu próprio efeito dedicado logo abaixo, que arquiva e
    // restaura por symbol:timeframe em vez de descartar (Diretriz de
    // Evolução Geral do Organismo §6.8, achado real: um reset cego aqui
    // perdia memória de desempenho real ao trocar de aba e voltar).
  }, [selectedAsset]);

  // Diretriz de Evolução Geral do Organismo §6.8 (achado real de
  // auditoria: "memória de decisões" era uma fatia GLOBAL — trocar de
  // ativo OU timeframe zerava hitRate/targetHits/stopHits/history por
  // completo, mesmo que a mesma combinação já tivesse desempenho real
  // medido antes). Efeito PRÓPRIO, dedicado só a isto (nunca misturado
  // com os resets acima, que continuam zerando de verdade o que É
  // pontual por natureza — preço/candles/order book/L2/etc.):
  //   - Ao ENTRAR numa combinação symbol:timeframe: restaura o arquivo
  //     real dela se existir, ou começa vazio se nunca visitada.
  //   - Ao SAIR (cleanup, fecha sobre os valores REAIS desta combinação
  //     — nunca uma ref stale): arquiva o agregado atual, primeiro
  //     fechando um plano ainda ABERTO como REPLACED (reusa
  //     trackPlanTransition(state, null, now), a mesma lógica honesta já
  //     usada por toda troca de plano — nunca resolve em ausência).
  // O plano ATIVO (rastreamento ao vivo do que está na tela agora)
  // continua começando do zero em toda troca — só o AGREGADO histórico
  // (o que realmente importa para medir desempenho real) sobrevive.
  useEffect(() => {
    const key = candleKey(selectedAsset, chartTimeframe as Timeframe);
    const archived = useUnifiedSnapshotStore.getState().trackRecordArchive[key];
    useUnifiedSnapshotStore.getState().hydrateTrackRecord(archived ?? EMPTY_TRACK_RECORD);
    return () => {
      useUnifiedSnapshotStore.getState().archiveTrackRecord(key);
    };
  }, [selectedAsset, chartTimeframe]);

  useEffect(() => {
    let unmounted = false;
    // Fecha sobre o `unmounted` DESTE efeito — retry de boot e o tick de
    // 30/60s abaixo reusam as MESMAS closures, então uma resposta tardia
    // de um ativo já trocado (unmounted true na hora em que o await
    // resolve) nunca aplica dado do ativo errado (ver isStale dentro de
    // fetchSymbolData/fetchDerivatives).
    const fetchSymbolDataGuarded = () => fetchSymbolData(() => unmounted);
    const fetchDerivativesGuarded = () => fetchDerivatives(() => unmounted);
    (async () => {
      const [restOk, derivOk] = await Promise.all([
        retryBoot(fetchSymbolDataGuarded, () => unmounted),
        retryBoot(fetchDerivativesGuarded, () => unmounted),
      ]);
      if (!unmounted) setBootRestFailed(!restOk && !derivOk);
    })();
    // Klines a 30s: mantém o último candle do gráfico em sincronia com o
    // ciclo do motor (mesma cadência). Derivativos (funding/OI) mudam devagar
    // — 60s continua correto para eles.
    const restInterval = setInterval(fetchSymbolDataGuarded, 30000);
    const derivInterval = setInterval(fetchDerivativesGuarded, 60000);

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelayMs = 1000;

    // depth10@100ms can fire up to 10x/s — coalesce into a trailing update
    // capped at ~5/s so the order-book-derived UI (heatmap, flow pressure,
    // market direction) doesn't re-render faster than a mobile Safari
    // browser can usefully paint.
    const ORDER_BOOK_THROTTLE_MS = 200;
    let pendingOrderBook: { bids: Level[]; asks: Level[] } | null = null;
    let orderBookFlushTimer: ReturnType<typeof setTimeout> | null = null;
    const flushOrderBook = () => {
      orderBookFlushTimer = null;
      if (pendingOrderBook) {
        setOrderBook(pendingOrderBook);
        setOrderBookUpdatedAt(Date.now());
      }
    };

    // Only the selected asset gets the millisecond-fresh WS ticker+depth
    // feed — that's the one thing that actually needs sub-second latency
    // (live price, order book). The other 4 assets' scanner summaries come
    // from the 30s REST ticker refresh above, which is plenty fresh for an
    // overview strip and avoids hardcoding a fixed subset of "the other
    // assets" into the WS multiplex (the previous version only special-
    // cased ETH/SOL, silently leaving BNB/XRP scanner rows WS-stale between
    // REST ticks even though they were displayed as if live).
    const wsSymbol = selectedAsset.toLowerCase();
    const tickerStream = `${wsSymbol}usdt@ticker`;
    const depthStream = `${wsSymbol}usdt@depth10@100ms`;

    const connect = () => {
      if (unmounted) return;
      ws = new WebSocket(
        `wss://stream.binance.com:9443/stream?streams=${tickerStream}/${depthStream}`,
      );
      ws.onopen = () => {
        setWsLive(true);
        reconnectDelayMs = 1000;
      };
      ws.onclose = () => {
        setWsLive(false);
        if (unmounted) return;
        reconnectTimer = setTimeout(connect, reconnectDelayMs);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15000);
      };
      ws.onerror = () => ws?.close();

      ws.onmessage = (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return; // malformed frame — drop it, keep the connection alive
        }
        if (msg.stream === tickerStream) {
          const d = msg.data;
          const currentPrice = Number(d.c);
          const open = Number(d.o);
          const delta = currentPrice - open;
          setPriceData({
            price: currentPrice,
            delta,
            deltaPct: Number(d.P),
            high: Number(d.h),
            low: Number(d.l),
            volume: Number(d.v),
            direction: delta >= 0 ? "LONG" : "SHORT",
          });
          setPriceUpdatedAt(Date.now());
        } else if (msg.stream === depthStream) {
          const d = msg.data;
          if (d.bids && d.asks) {
            pendingOrderBook = {
              bids: d.bids
                .slice(0, 8)
                .map((b: string[]) => ({ price: Number(b[0]), size: Number(b[1]) })),
              asks: d.asks
                .slice(0, 8)
                .map((a: string[]) => ({ price: Number(a[0]), size: Number(a[1]) }))
                .reverse(),
            };
            if (!orderBookFlushTimer) {
              orderBookFlushTimer = setTimeout(flushOrderBook, ORDER_BOOK_THROTTLE_MS);
            }
          }
        }
      };
    };
    connect();

    return () => {
      unmounted = true;
      clearInterval(restInterval);
      clearInterval(derivInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (orderBookFlushTimer) clearTimeout(orderBookFlushTimer);
      ws?.close();
    };
  }, [bootGeneration, selectedAsset]);

  // Auditoria de estabilização (P1): trocar de timeframe atualiza os
  // candles do gráfico IMEDIATAMENTE — efeito próprio e deliberadamente
  // desacoplado do grande efeito de boot/WS acima (que só depende de
  // bootGeneration/selectedAsset). Só chartData muda aqui: sem resetar
  // preço/order book/scanner, sem reconectar o WebSocket, sem
  // reinicializar o gráfico ("Sem reload. Sem reinicializar o gráfico",
  // diretriz P1). Se a busca real falhar, o chartData anterior permanece
  // visível (fail-closed honesto — nunca um blank/reset no meio da troca).
  useEffect(() => {
    let cancelled = false;
    getChartCandles(selectedAsset, CHART_CANDLE_LIMIT, chartTimeframe).then((candles) => {
      if (!cancelled && candles) setChartData(candles);
    });
    return () => {
      cancelled = true;
    };
  }, [chartTimeframe, selectedAsset]);

  // Auditoria de arquitetura (revisão completa) — paginação histórica
  // real: "busca em andamento" e "sem mais história" são escopados a uma
  // combinação symbol:timeframe específica (getOlderChartCandles busca
  // exatamente essa chave) — trocar qualquer um dos dois precisa
  // reabilitar os dois refs, senão o operador ficaria travado achando que
  // não há mais história só por ter esgotado num timeframe diferente.
  const isFetchingOlderCandlesRef = useRef(false);
  const noMoreOlderCandlesRef = useRef(false);
  useEffect(() => {
    noMoreOlderCandlesRef.current = false;
  }, [chartTimeframe, selectedAsset]);

  // Chamado pelo gráfico quando o usuário arrasta perto da borda esquerda
  // dos candles já carregados (ver onRequestOlderCandles em
  // EnhancedChart_110_Percent). Busca real, avulsa, direto do conector —
  // nunca pelo Bus (ver getOlderChartCandles). Dedupe por `time` contra o
  // que já está carregado é a rede de segurança final: a própria busca já
  // pede endTime = candle mais antigo carregado menos 1s, então overlap
  // real seria só um achado de borda, nunca o caso comum.
  const handleRequestOlderCandles = useCallback(async () => {
    if (isFetchingOlderCandlesRef.current || noMoreOlderCandlesRef.current) return;
    if (chartData.length === 0) return;
    isFetchingOlderCandlesRef.current = true;
    try {
      const oldestTime = chartData[0].time;
      const older = await getOlderChartCandles(selectedAsset, oldestTime, CHART_HISTORY_PAGE_SIZE, chartTimeframe);
      if (!older || older.length === 0) {
        noMoreOlderCandlesRef.current = true;
        return;
      }
      setChartData((prev) => {
        if (prev.length === 0) return prev;
        const existingTimes = new Set(prev.map((c) => c.time));
        const deduped = older.filter((c) => !existingTimes.has(c.time));
        if (deduped.length === 0) {
          noMoreOlderCandlesRef.current = true;
          return prev;
        }
        const merged = deduped.concat(prev);
        // Corta do lado mais ANTIGO quando estoura o teto — o mais recente
        // nunca é descartado, mesmo lado que mergeFreshTail já protege.
        return merged.length > MAX_CHART_HISTORY ? merged.slice(merged.length - MAX_CHART_HISTORY) : merged;
      });
    } catch {
      // Fail-closed: uma falha transitória só significa "tenta de novo na
      // próxima vez que o usuário arrastar perto da borda" — nunca uma
      // página fabricada.
    } finally {
      isFetchingOlderCandlesRef.current = false;
    }
  }, [selectedAsset, chartTimeframe, chartData]);

  // Real engine cycle — WASM Quant Engine + research pipeline (engine-bridge.ts).
  // 30s cadence: the 15m candle's close evolves continuously, and the target
  // tracker prices its entry/move% off the ticker fetched AT cycle time — a
  // 60s cycle left those numbers up to a minute behind the live WS price in
  // the top bar. 30s halves that worst-case skew for ~4 extra REST weight/min
  // (Binance budget is 1200/min); the k-NN + pipeline cost per cycle is
  // milliseconds. The initial call gets the same bounded retry as the REST
  // fetches above; the recurring interval keeps calling the plain version.
  // Real timestamp of the last successful engine cycle — the "ÚLTIMA
  // ATUALIZAÇÃO" field DCI's Essential Strip requires. Only stamped on a
  // real ok:true resolution, never on a failed/retried attempt.
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  // Fase J (Cap. 17): latência REAL do último ciclo do motor — cronometrada
  // em volta do await, nunca estimada. Só de ciclos ok (falha de rede não é
  // "latência do motor", é falha — e já aparece como engineStatus error).
  const [cycleLatencyMs, setCycleLatencyMs] = useState<number | null>(null);

  // Auditoria de arquitetura (revisão completa): antes desta mudança,
  // runRealAnalysisCycle rodava sempre em 15m internamente, então S1/R1 (e
  // parte do Trade Plan, que os usa como fonte) nunca refletiam o timeframe
  // de fato selecionado no gráfico. chartTimeframe agora entra tanto na
  // chamada quanto nas deps — trocar o timeframe do gráfico dispara um novo
  // ciclo real na hora, em vez de esperar até 30s por um ciclo que ainda
  // ia sair em 15m.
  useEffect(() => {
    let cancelled = false;
    const runCycle = async (): Promise<boolean> => {
      const startedAt = Date.now();
      const result = await runRealAnalysisCycle(selectedAsset, chartTimeframe);
      if (cancelled) return true;
      setRealCycle(result);
      setEngineStatus(result.ok ? "ok" : "error");
      if (result.ok) {
        setLastUpdateAt(Date.now());
        setCycleLatencyMs(Date.now() - startedAt);
      }
      return result.ok;
    };
    retryBoot(runCycle, () => cancelled);
    const engineInterval = setInterval(runCycle, 30000);
    return () => {
      cancelled = true;
      clearInterval(engineInterval);
    };
  }, [bootGeneration, selectedAsset, chartTimeframe]);

  // Fase Ω Priority 1 (Adaptive Multi-Timeframe Intelligence): contexto real
  // independente por prazo (1m/5m/15m/1h/4h/1d) — cadência PRÓPRIA de 60s,
  // mais lenta que o ciclo principal (30s) porque isto é confluência/
  // contexto entre prazos, nunca o caminho crítico do sinal principal (LEI
  // 24: nunca um segundo motor de decisão). Deliberadamente NÃO depende de
  // chartTimeframe: os 6 prazos são computados juntos, sempre, independente
  // de qual está selecionado no gráfico — trocar o prazo exibido não deveria
  // disparar um novo ciclo caro dos outros 5 que não mudaram. Sempre escreve
  // o resultado (mesmo null): mesmo padrão do ciclo principal acima
  // (setRealCycle sempre escreve); na prática o próprio Bus já serve o
  // último candle BOM por chave em vez de ok:false num hiccup transitório
  // (ver header do arquivo), então null só aparece de fato num boot a frio
  // sem rede nenhuma.
  useEffect(() => {
    let cancelled = false;
    const runMultiTimeframeCycle = async (): Promise<boolean> => {
      const matrix = await buildMultiTimeframeContext(selectedAsset);
      if (cancelled) return true;
      useUnifiedSnapshotStore.getState().setMultiTimeframeContext(matrix);
      return matrix !== null;
    };
    retryBoot(runMultiTimeframeCycle, () => cancelled);
    const mtfInterval = setInterval(runMultiTimeframeCycle, 60000);
    return () => {
      cancelled = true;
      clearInterval(mtfInterval);
    };
  }, [bootGeneration, selectedAsset]);

  // ADITIVO V-MAX Etapa 9: universo MEXC real, buscado UMA vez (mesmo
  // espírito do RADAR_UNIVERSE_SYMBOLS estático, mas via rede — não dá
  // pra ser uma constante de módulo). Ref, não state: nenhum componente
  // precisa re-renderizar quando a lista chega, só o próximo tick do
  // scanner precisa lê-la. Falha de rede => [] honesto (mesmo fail-closed
  // de fetchMexcUsdtSymbols) — o scanner simplesmente não tem página MEXC
  // nesse ciclo, tenta de novo no próximo (nunca trava o resto do Radar).
  const radarMexcUniverseRef = useRef<string[]>([]);
  // Cursor real da paginação — avança a cada ciclo, some ao fim da lista
  // e recomeça do início (round-robin honesto, nunca perde um símbolo).
  const radarMexcCursorRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const symbols = await fetchMexcUsdtSymbols();
      if (cancelled) return;
      radarMexcUniverseRef.current = Array.from(new Set(symbols.map((s) => s.baseAsset)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // OMEGA CORE V-MAX (completar Fase 7, Radar/OIH): scanner de fundo real
  // — cadência própria (5min), mais lenta que o ciclo do ativo selecionado
  // (30s) e o multi-timeframe (60s) acima: o Radar é descoberta de
  // contexto, nunca o caminho crítico do sinal (LEI 24). Cada candidato
  // passa por scanRadarCandidate (fetch real + motores puros já
  // existentes, engine-bridge.ts) e depois por qualifyRadarCandidate
  // (núcleo puro, radar-qualification.ts) — este efeito só orquestra LOTE
  // e TIMER, zero motor novo escrito aqui. Depende de chartTimeframe (não
  // uma ref) de propósito: trocar o prazo do gráfico precisa CANCELAR
  // qualquer lote em voo do prazo antigo e recomeçar do zero no prazo
  // novo — mesmo espírito fail-closed da Fase 6 (zero staleness na troca
  // de contexto), mesmo padrão de deps do ciclo principal acima. Exclui
  // sempre o ativo já selecionado: ele já tem seu próprio Conselho/Trade
  // Plan completo rodando à parte — escaneá-lo de novo aqui produziria
  // uma segunda leitura mais fraca do MESMO ativo, redundante por
  // definição.
  //
  // ADITIVO V-MAX Etapa 9: MESMO efeito, MESMO lote/timer — depois de
  // varrer o universo curado Binance (acima), pagina uma FATIA real do
  // universo MEXC (radarMexcUniverseRef) com scanRadarCandidate(symbol,
  // timeframe, 'MEXC') — nunca um segundo loop/timer concorrente (seção
  // MEXC×Binance do MED: "nunca duplicar o restante da arquitetura").
  // Um candidato MEXC e um Binance do mesmo símbolo são leituras reais e
  // independentes (provider fica no resultado) — nunca deduplicados,
  // mesmo princípio já usado pelos cross-checks Bybit/OKX/MEXC.
  useEffect(() => {
    let cancelled = false;
    const runRadarScan = async () => {
      const candidateSymbols = RADAR_UNIVERSE_SYMBOLS.filter((s) => s !== selectedAsset);
      const qualified: RadarQualificationResult[] = [];
      for (let i = 0; i < candidateSymbols.length; i += RADAR_SCAN_BATCH_SIZE) {
        if (cancelled) return;
        const batch = candidateSymbols.slice(i, i + RADAR_SCAN_BATCH_SIZE);
        const scans = await Promise.all(batch.map((symbol) => scanRadarCandidate(symbol, chartTimeframe)));
        if (cancelled) return;
        for (const scan of scans) {
          if (!scan) continue; // fail-closed: rede falhou/candles insuficientes para ESTE candidato — nunca bloqueia o lote inteiro
          qualified.push(qualifyRadarCandidate(scan));
        }
        if (i + RADAR_SCAN_BATCH_SIZE < candidateSymbols.length) {
          await new Promise((resolve) => setTimeout(resolve, RADAR_SCAN_BATCH_DELAY_MS));
        }
      }

      const mexcUniverse = radarMexcUniverseRef.current.filter((s) => s !== selectedAsset);
      if (mexcUniverse.length > 0) {
        const start = radarMexcCursorRef.current % mexcUniverse.length;
        // Round-robin real: pega até RADAR_MEXC_PAGE_SIZE símbolos a
        // partir do cursor, dando a volta na lista sem duplicar dentro
        // da MESMA página (Set por índice, nunca por valor — 2 bases
        // iguais por acaso não colidiriam de propósito).
        const page: string[] = [];
        for (let k = 0; k < Math.min(RADAR_MEXC_PAGE_SIZE, mexcUniverse.length); k++) {
          page.push(mexcUniverse[(start + k) % mexcUniverse.length]);
        }
        radarMexcCursorRef.current = (start + page.length) % mexcUniverse.length;

        for (let i = 0; i < page.length; i += RADAR_SCAN_BATCH_SIZE) {
          if (cancelled) return;
          const batch = page.slice(i, i + RADAR_SCAN_BATCH_SIZE);
          const scans = await Promise.all(batch.map((symbol) => scanRadarCandidate(symbol, chartTimeframe, 'MEXC')));
          if (cancelled) return;
          for (const scan of scans) {
            if (!scan) continue;
            qualified.push(qualifyRadarCandidate(scan));
          }
          if (i + RADAR_SCAN_BATCH_SIZE < page.length) {
            await new Promise((resolve) => setTimeout(resolve, RADAR_SCAN_BATCH_DELAY_MS));
          }
        }
      }

      // Escreve sempre, mesmo lista vazia — mesmo padrão fail-closed do
      // ciclo principal (setRealCycle sempre escreve): um universo sem
      // NENHUM candidato qualificado agora é um resultado real, nunca
      // deixa candidatos de um ciclo/prazo/ativo anterior na tela.
      if (!cancelled) {
        useUnifiedSnapshotStore.getState().setRadarCandidates(rankRadarCandidates(qualified));
      }
    };
    void runRadarScan();
    const radarInterval = setInterval(() => void runRadarScan(), RADAR_SCAN_FULL_CYCLE_MS);
    return () => {
      cancelled = true;
      clearInterval(radarInterval);
    };
  }, [bootGeneration, selectedAsset, chartTimeframe]);

  // Fase J (Cap. 17): FPS REAL da UI via requestAnimationFrame — contagem
  // de frames por janela de 1s. É a medição verdadeira do que o Safari
  // está pintando, não uma constante otimista. O loop é 1 rAF vivo por
  // sessão (custo desprezível) e respeita unmount.
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    let frames = 0;
    let windowStart = performance.now();
    let rafId = 0;
    let alive = true;
    const tick = (now: number) => {
      if (!alive) return;
      frames += 1;
      if (now - windowStart >= 1000) {
        setFps(Math.round((frames * 1000) / (now - windowStart)));
        frames = 0;
        windowStart = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Real MEXC trade poller -> real Order Flow Engine (engine-bridge.ts).
  // Signal list is capped to the most recent 20 — OFI/Absorption/Exhaustion
  // are meant to be rare, not a firehose.
  useEffect(() => {
    const stop = startMexcOrderflowFeed(
      (newSignals) => {
        setOrderflowSignals((prev) => [...newSignals, ...prev].slice(0, 20));
      },
      (state, reason) => {
        setOrderflowState(state);
        setOrderflowReason(reason ?? null);
      },
      (value) => {
        setCvd(value);
        // OMEGA CORE V-MAX (Fase 1.1): mesmo valor real de cvd, mesmo
        // commit — espelhado na fatia §3 `cvd`.
        useUnifiedSnapshotStore.getState().setCvd(value);
        // V-MAX Fase 1.2: onCvd sempre dispara DEPOIS de onTrades dentro do
        // MESMO ciclo de poll (garantia real de engine-bridge.ts) — os
        // trades grandes já calculados abaixo pertencem exatamente a este
        // valor de cvd, nunca um ciclo anterior/posterior.
        useUnifiedSnapshotStore.getState().recordOrderflowHistory({
          time: Date.now(),
          cvd: value,
          largeTrades: pendingLargeTradesRef.current,
        });
        pendingLargeTradesRef.current = [];
      },
      selectedAsset,
      (ticks: OrderflowTick[]) => {
        const trades: OrderflowTrade[] = ticks.map((t) => ({
          time: t.timestamp, price: t.price, volume: t.volume, side: t.side,
        }));
        const { large, nextState } = ingestTradesForLargeDetection(orderflowThresholdStateRef.current, trades);
        orderflowThresholdStateRef.current = nextState;
        pendingLargeTradesRef.current = large;
      },
    );
    return stop;
  }, [bootGeneration, selectedAsset]);

  // Real institutional liquidation feed (Binance USDT-M Futures, public,
  // no key — engine-bridge.ts's startRealLiquidationFeed). Exchange-wide,
  // not BTC-only — large forced liquidations anywhere are the real signal
  // this widget shows.
  //
  // OMEGA CORE V-MAX Fase 8.1: cap subiu de 30 para
  // LIQUIDATION_RETENTION_CAP — o heatmap real (nexus/liquidation-heatmap.ts)
  // filtra este array exchange-wide para SÓ o ativo selecionado, então 30
  // eventos de TODOS os símbolos raramente sobrariam o suficiente
  // (MIN_EVENTS_FOR_HEATMAP) para um único ativo. O feed não tem seed
  // histórico (sem REST equivalente, ver binance-liquidations-stream.js) —
  // reter mais do que já chegou nesta sessão é a única forma real de dar
  // ao heatmap mais densidade, sem fabricar nada. Custo desprezível
  // (objetos pequenos, mesma ordem de grandeza de MAX_CHART_HISTORY). A
  // lista "Forced Liquidations" continua mostrando só os 8 mais recentes
  // (.slice(0,8)), comportamento inalterado.
  useEffect(() => {
    const stop = startRealLiquidationFeed(
      (event) => {
        setLiquidations((prev) => [event, ...prev].slice(0, LIQUIDATION_RETENTION_CAP));
      },
      (state) => setLiquidationState(state),
    );
    return stop;
  }, [bootGeneration]);

  // ───────────────────────────────────────────────────────────────────────────
  // Quantitative engine.
  //   • Flow pressure = real order-book imbalance (local, from the live WS book).
  //   • Signal/entry/target/stop/confidence/support/resistance/market structure
  //     come SOLELY from realCycle (engine-bridge.ts -> the real engine +
  //     research pipeline) — never a SECOND local heuristic computed here.
  //     (Auditoria Mestra 360°, sec. 3: the signal itself is a real SMA/EMA
  //     trend-bias heuristic in research-engine.js, not WASM output — WASM
  //     only computes SMA/EMA/stddev/zscore upstream in analysis-frame.js.)
  //     Null (-> AGUARDANDO) until the real engine's first cycle succeeds.
  //   • No position, no PnL, no leverage, no win-rate. None of those have a real
  //     read-only source, so they do not exist here.
  // ───────────────────────────────────────────────────────────────────────────
  const engine = React.useMemo(() => {
    const buyVolume = orderBook.bids.reduce((a, v) => a + v.size, 0);
    const sellVolume = orderBook.asks.reduce((a, v) => a + v.size, 0);
    const totalVolume = buyVolume + sellVolume;
    const hasBook = totalVolume > 0;

    // Real signed imbalance in [-1, 1]; null when there is no book yet.
    const imbalance = hasBook ? (buyVolume - sellVolume) / totalVolume : null;
    // Real flow-pressure magnitude as a percentage (0..100), honest — not clamped.
    const flowPressure = imbalance === null ? null : Math.abs(imbalance) * 100;
    // Buy/sell share of resting liquidity (real), null when no book.
    const buyPercent = hasBook ? (buyVolume / totalVolume) * 100 : null;
    const sellPercent = hasBook ? (sellVolume / totalVolume) * 100 : null;

    const price = priceData?.price ?? null;
    const delta = priceData?.delta ?? null;
    const deltaPct = priceData?.deltaPct ?? null;

    const cycleOk = realCycle?.ok === true;
    const direction: Direction =
      cycleOk && (realCycle?.signal === "LONG" || realCycle?.signal === "SHORT")
        ? realCycle.signal
        : null;
    const isLong = direction === "LONG";

    const entry = cycleOk ? (realCycle?.entry ?? null) : null;
    const target = cycleOk ? (realCycle?.target1 ?? null) : null;
    const target2 = cycleOk ? (realCycle?.target2 ?? null) : null;
    // Achado de auditoria (Ferramentas Institucionais): extensão de
    // Fibonacci 61.8% sobre a última perna confirmada — já calculada todo
    // ciclo (support-resistance-engine.js) mas descartada antes de sair de
    // engine-bridge.ts. Passthrough puro, mesmo padrão de target/target2.
    const extendedTarget = cycleOk ? (realCycle?.extendedTarget ?? null) : null;
    const stop = cycleOk ? (realCycle?.stop ?? null) : null;
    // V11.5 Fase 6: razão real distância-ao-alvo/distância-à-invalidação
    // (target-tracker.js) e força por confluência de swings do Alvo 2
    // (support-resistance-engine.js) — repassados, nunca recomputados aqui.
    const riskRewardRatio = cycleOk ? (realCycle?.riskRewardRatio ?? null) : null;
    // Protocolo Mestre (Sincronização Global): target1Strength existe desde
    // que o Alvo 1 passou a vir do swing fractal mais próximo (ver
    // analysis-frame.js) — antes só o Alvo 2 tinha essa força reportada.
    const target1Strength = cycleOk ? (realCycle?.target1Strength ?? null) : null;
    const target2Strength = cycleOk ? (realCycle?.target2Strength ?? null) : null;
    const confidence = cycleOk ? (realCycle?.confidence ?? null) : null;
    // EPC MODO ELITE ABSOLUTO §10 (Recuperação de Recursos — inteligência
    // escondida): `condition` é a CONFIRMAÇÃO REAL que o Core Engine exige
    // antes do setup valer (required_confirmation, LONG/SHORT) ou o gatilho
    // de reavaliação (trigger_to_reevaluate, WAIT) — trade-setup-matrix.js/
    // research-engine.js. O engine-bridge já computava e expunha esse campo
    // em realCycle.condition, mas NENHUM consumidor o lia: inteligência real
    // do núcleo, nunca vista pelo Operador. Passthrough puro aqui (mesmo
    // padrão de rationale/marketStructure), agora exibido na Síntese
    // Operacional da aba ANALYSIS. "Se o núcleo calcula, o operador enxerga."
    const condition = cycleOk ? (realCycle?.condition ?? null) : null;
    const marketStructure = cycleOk ? (realCycle?.marketStructure ?? null) : null;
    // Clean label for marketStructure's raw internal string, computed once
    // here instead of re-derived by every consumer (AssistantOrb's
    // ESTRUTURA row, MarketRegimeWidget's TENDÊNCIA row). Values verified
    // directly against src/research/engines/market-structure-engine.js —
    // ESTRUTURA_ALTA/ESTRUTURA_BAIXA/ESTRUTURA_LATERAL are the only 3 it
    // ever returns.
    const marketStructureLabel = cleanStructureLabel(marketStructure);

    // V11.5 §2 (contexto multitemporal): estrutura real do timeframe maior
    // (1H), mesma engine graduada, cacheada em engine-bridge.ts. Confluência
    // é só uma comparação honesta dos dois rótulos reais — nunca um sinal
    // novo, nunca escrita de volta no Core Engine.
    const htfMarketStructureLabel = cycleOk ? cleanStructureLabel(realCycle?.htfMarketStructure) : null;
    const htfTimeframe = cycleOk ? (realCycle?.htfTimeframe ?? null) : null;
    // Protocolo Mestre (achado de auditoria): idade real do cache HTF —
    // fetchedAt já existia em engine-bridge.ts mas nunca saía dele, então a
    // UI não tinha como saber se a estrutura de 1H era de agora ou de
    // ~5min atrás (HTF_REFRESH_MS). Mesma telemetria honesta de preço/
    // livro/ciclo (LEI 22), agora completa para a 4ª fonte real.
    const htfUpdatedAt = cycleOk ? (realCycle?.htfUpdatedAt ?? null) : null;
    const timeframeConfluence: "CONFLUENTE" | "DIVERGENTE" | null =
      marketStructureLabel && htfMarketStructureLabel && marketStructureLabel !== "LATERAL" && htfMarketStructureLabel !== "LATERAL"
        ? marketStructureLabel === htfMarketStructureLabel
          ? "CONFLUENTE"
          : "DIVERGENTE"
        : null;

    const support = cycleOk ? (realCycle?.support ?? null) : null;
    const resistance = cycleOk ? (realCycle?.resistance ?? null) : null;
    // V16 §3: força real por confluência de swings (mesmo computeLevelStrength
    // de target1Strength/target2Strength) — passthrough puro de realCycle.
    const supportStrength = cycleOk ? (realCycle?.supportStrength ?? null) : null;
    const resistanceStrength = cycleOk ? (realCycle?.resistanceStrength ?? null) : null;

    // V16 §3 (Chart Engine institucional — "Rejected"/"Breakouts" por nível):
    // nenhum motor existente conta rompimentos reais de um nível, então isto
    // é um cálculo NOVO — mas puramente honesto: conta closes REAIS da MESMA
    // janela de candles (chartData) que o support-resistance-engine já
    // analisou, além (rompeu) ou aquém (não rompeu) do nível. "Rejeitados" =
    // toques reais (supportStrength/resistanceStrength.touches) menos
    // rompimentos reais — nunca um número inventado, nunca uma probabilidade.
    const countBreakouts = (level: number | null, kind: "support" | "resistance"): number =>
      num(level) && chartData && chartData.length > 0
        ? chartData.reduce(
            (n: number, c: any) => n + ((kind === "resistance" ? c.close > level : c.close < level) ? 1 : 0),
            0,
          )
        : 0;
    const resistanceBreakouts = resistanceStrength ? countBreakouts(resistance, "resistance") : 0;
    const supportBreakouts = supportStrength ? countBreakouts(support, "support") : 0;

    // Real % move from entry to the real target (not a profit promise).
    const moveToTargetPct =
      entry !== null && target !== null && entry !== 0
        ? Math.abs(((target - entry) / entry) * 100)
        : null;

    // Real, already-computed Order Flow Imbalance from the actual Signal
    // Engine (src/orderflow/signal-engine.js), reused for the institutional
    // consensus index (V11.5 Fase 5) — not recomputed, not a second source.
    // An OFI reading is an EVENT (fires only when the imbalance crosses a
    // real threshold), not a continuous stream, so a stale/missing signal
    // means "no data" (null), never a fabricated neutral 0.
    const FLOW_SIGNAL_MAX_AGE_MS = 5 * 60_000;
    const latestOfi = orderflowSignals.find((s) => s.type === "OFI") ?? null;
    const flowImbalance =
      latestOfi &&
      Date.now() - latestOfi.timestamp <= FLOW_SIGNAL_MAX_AGE_MS &&
      typeof latestOfi.metadata?.imbalance === "number"
        ? Math.max(-1, Math.min(1, latestOfi.metadata.imbalance))
        : null;

    return {
      buyVolume,
      sellVolume,
      totalVolume,
      hasBook,
      imbalance,
      flowPressure,
      buyPercent,
      sellPercent,
      price,
      delta,
      deltaPct,
      direction,
      isLong,
      entry,
      target,
      target2,
      extendedTarget,
      stop,
      riskRewardRatio,
      target1Strength,
      target2Strength,
      confidence,
      condition,
      marketStructure,
      marketStructureLabel,
      support,
      resistance,
      supportStrength,
      resistanceStrength,
      supportBreakouts,
      resistanceBreakouts,
      moveToTargetPct,
      flowImbalance,
      htfMarketStructureLabel,
      htfTimeframe,
      htfUpdatedAt,
      timeframeConfluence,
      // Fase D (Market Regime Engine): classificação oficial de regime,
      // computada em engine-bridge.ts sobre os mesmos candles do Bus do
      // ciclo — puro passthrough aqui, nunca recomputado na UI.
      marketRegime: cycleOk ? (realCycle?.marketRegime ?? null) : null,
      // Os 3 números que DECIDEM `direction` logo acima. Passthrough puro
      // (mesma disciplina de marketRegime), para o Medidor de Distância à
      // Decisão poder medir a fronteira REAL do Núcleo em vez de estimá-la.
      // `price` já está no objeto, mas é o preço do ticker ao vivo; a
      // fronteira do Núcleo usa o ÚLTIMO FECHAMENTO da mesma série de onde
      // saem SMA/EMA (js/real-data/analysis-frame.js) — comparar o ticker
      // contra uma SMA de fechamentos daria uma distância sutilmente errada,
      // então `lastClose` vem separado, da mesma fonte que a SMA.
      lastClose: cycleOk ? (realCycle?.lastPrice ?? null) : null,
      sma: cycleOk ? (realCycle?.sma ?? null) : null,
      ema: cycleOk ? (realCycle?.ema ?? null) : null,
    };
  }, [priceData, orderBook, realCycle, chartData, orderflowSignals]);

  // Medidor de Distância à Decisão (pedido direto do Operador: "tem que ter a
  // opção do quanto por cento que falta pra long e pra short... tudo isso tem
  // que acompanhar lá em cima no cabeçalho"). Motor puro
  // (nexus/decision-distance.ts) sobre os 3 números REAIS que o Core Engine
  // usa — nunca uma segunda decisão, nunca uma probabilidade (Regra de Ouro
  // 2): é distância medida até o limiar, e o texto exibido diz isso.
  const decisionDistance = useMemo(
    () => computeDecisionDistance({ lastPrice: engine.lastClose, sma: engine.sma, ema: engine.ema }),
    [engine.lastClose, engine.sma, engine.ema],
  );

  // V11.5 Fase 5 — Consensus Engine: um ÚNICO hook subscrito ao GMIL aqui em
  // App() (antes cada consumidor — EssentialStrip, GmilContextWidget —
  // chamava useGmilSnapshot() por conta própria, 2 assinaturas redundantes
  // ao mesmo singleton). O índice institucional combina os 3 provedores
  // externos do GMIL com 2 dimensões locais REAIS já computadas acima —
  // liquidez (engine.imbalance, do livro de ofertas ao vivo) e fluxo
  // (engine.flowImbalance, do Signal Engine real) — reutilizando a MESMA
  // função pura computeConsensus (LEI 04), não uma segunda matemática de
  // consenso. Continua 100% consultivo: nenhum destes valores é lido por
  // engine-bridge.ts nem altera realCycle/engine.direction/confidence.
  // Fase E: além dos provedores, o snapshot agora traz os 4 vieses da
  // Constituição (context-aggregator.ts) — passthrough puro para a UI.
  const gmilSnapshot = useGmilSnapshot();
  const { providers: gmilProviders, biases: gmilBiases } = gmilSnapshot;
  // Diretriz Final de Integração Total ("nenhum módulo permaneça
  // parcialmente conectado sem justificativa"): o MESMO snapshot que já
  // alimenta os widgets acima também ganha uma fatia real no organismo
  // central (unified-snapshot-store §4) — zero segunda assinatura, zero
  // segunda leitura do gmilOrchestrator, só um espelho para que um
  // assinante futuro do bus (getSnapshotForEngine()) também veja este
  // contexto. engine-bridge.ts continua sem nenhum import de gmil/
  // (core-engine-boundary.test.ts trava isso).
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setGmil(gmilSnapshot);
  }, [gmilSnapshot]);
  const institutionalConsensus = useMemo(() => {
    const localInputs: ConsensusInput[] = [
      { providerId: "liquidez_livro_ofertas", lean: engine.imbalance, weight: engine.hasBook ? 1 : 0 },
      { providerId: "fluxo_ofi", lean: engine.flowImbalance, weight: engine.flowImbalance !== null ? 1 : 0 },
    ];
    const providerInputs: ConsensusInput[] = gmilProviders.map((p) => ({
      providerId: p.id,
      lean: p.lastReading?.ok ? (p.lastReading.lean ?? null) : null,
      weight: p.weight,
    }));
    return computeConsensus([...providerInputs, ...localInputs]);
  }, [gmilProviders, engine.imbalance, engine.hasBook, engine.flowImbalance]);

  // Fase F (V15): Comitê de Validação — Ensemble Probabilístico (linear
  // opinion pool, src/consensus/). Composto AQUI na camada de exibição,
  // como o institutionalConsensus acima (V11.5 Fase 5), porque é o único
  // lugar onde as leituras locais (ciclo real, CVD) e o contexto GMIL
  // coexistem sem violar a LEI 04 — engine-bridge.ts continua sem nenhum
  // import de gmil/. Consumidor oficial da matriz de pesos da Fase D
  // (regime vigente) e do peso de qualidade da Fase C (amortecedor de
  // força). 100% consultivo: nada aqui é lido de volta pelo Core Engine
  // nem altera engine.direction/confidence.
  const ensembleConsensus = useMemo(() => {
    const lorentzian = realCycle?.lorentzian;
    const members = [
      {
        id: "lorentzian_knn",
        familia: "momentum",
        opiniao: lorentzian?.ok
          ? opinionFromVote(lorentzian.classification ?? null, lorentzian.confidence ?? NaN)
          : null,
      },
      // id timeframe-aware (achado real de auditoria, FASE Ω Priority 3):
      // engine.marketStructureLabel roda contra o chartTimeframe REAL
      // selecionado (runRealAnalysisCycle(selectedAsset, chartTimeframe)),
      // não contra 15m fixo — o id "estrutura_15m" antigo era honesto só
      // enquanto o padrão do gráfico era 15m. estrutura_1h continua fixo
      // de propósito: HTF_INTERVAL em engine-bridge.ts é '1h' hardcoded,
      // independente do chartTimeframe (o "H" de Higher-TimeFrame real).
      { id: `estrutura_${chartTimeframe}`, familia: "momentum", opiniao: opinionFromLabel(engine.marketStructureLabel) },
      { id: "estrutura_1h", familia: "momentum", opiniao: opinionFromLabel(engine.htfMarketStructureLabel) },
      {
        id: "cvd_fluxo",
        familia: "fluxo_ordens",
        opiniao: num(cvd) && cvd !== 0 ? opinionFromLabel(cvd > 0 ? "ALTA" : "BAIXA") : null,
      },
      // GMIL: membro externo sem família local — o peso interno dele já
      // vem quality-ponderado na origem (consensus-engine do GMIL); o
      // regime local não modula leitura de contexto global.
      { id: "gmil_contexto", familia: null, opiniao: opinionFromLean(gmilBiases?.contextScore?.score ?? null) },
    ];
    return buildEnsembleConsensus({
      members,
      regime: engine.marketRegime?.regime ?? null,
      dataQualityWeight: realCycle?.dataQuality?.weight ?? null,
    });
  }, [realCycle, engine.marketStructureLabel, engine.htfMarketStructureLabel, engine.marketRegime, cvd, gmilBiases, chartTimeframe]);

  // IRON-VOICE: espelho somente-leitura do estado real para a camada de voz
  // (src/voice/). Mesmos campos que a UI renderiza — nenhum valor novo é
  // computado aqui, só repassado.
  // Ordem "Ciborgue Vivo" §1/§2: BOS/CHOCH sobre o MESMO array de candles
  // do gráfico que smcZones (abaixo) também usa (mesmo motivo: `index` só
  // faz sentido alinhado ao array que o caller desenha). Reaproveita
  // fractal-swings.js + o structure_label de market-structure-engine.js
  // por baixo — zero segunda detecção de swing/estrutura. Declarado ANTES
  // de voiceSnapshot (abaixo) porque alimenta o alerta real de rompimento
  // de estrutura ali dentro.
  const bosChoch = useMemo(
    () => (chartData && chartData.length > 0 ? computeBosChoch(chartData) : { break: null, structureLabel: null }),
    [chartData],
  );

  // ORDEM DO OPERADOR ("não deixa nada no laboratório, ativa tudo"): o
  // Detector de Reversão sai do Laboratório de Evolução AQUI — e sai como
  // ALERTA, nunca como decisão.
  //
  // POR QUE ALERTA E NÃO DECISÃO: o Operador autorizou ativar "o que estiver
  // dando acima de 70/90%". Para este detector esse número NÃO EXISTE ainda —
  // a rede do ambiente de desenvolvimento bloqueia as corretoras e a medição
  // real (tools/measure-reversal-lead.mjs) nunca rodou sobre mercado. Ativar
  // como decisão alegando um percentual seria inventá-lo (Regra de Ouro 1/2).
  // Como ALERTA ele não precisa de percentual nenhum, porque não muda nada:
  // só mostra ao Operador que a estrutura virou contra o sinal vigente.
  //
  // LEI 24 INTACTA: engine.direction não é lido de volta nem mutado aqui.
  // A adaptação de forma é explícita porque computeBosChoch (engine-bridge)
  // já normaliza o motor cru — devolve break/structureLabel null quando o
  // motor não rodou OK, então structureLabel !== null É o "status OK" real
  // desta fronteira. Sem esta linha o detector receberia status undefined e
  // ficaria em DADOS_INSUFICIENTES para sempre: uma feature morta silenciosa.
  const reversalAlert = useMemo(
    () =>
      computeReversalReading({
        bosChoch: {
          status: bosChoch.structureLabel !== null ? "OK" : "DADOS_INSUFICIENTES",
          break: bosChoch.break as any,
        },
        superTrend: null, // SuperTrend ainda não é calculado no ciclo do gráfico — denominador honesto (1 detector), nunca um segundo inventado.
        lastIndex: chartData && chartData.length > 0 ? chartData.length - 1 : -1,
        coreDirection:
          engine?.direction === "LONG" || engine?.direction === "SHORT" ? engine.direction : null,
      }),
    [bosChoch, chartData, engine?.direction],
  );

  // Pedido do Operador ("ver o que está faltando... pra ele chegar na
  // perfeição"): Liquidity Void (SMC/ICT) sobre o MESMO array de candles
  // do gráfico (mesmo motivo de bosChoch/smcZones: `index` alinhado ao
  // array que o caller desenha) — precisa de `volume` real por candle,
  // que chartData sempre carrega (ver comentário no useState acima).
  const liquidityVoids = useMemo<PriceZone[]>(
    () => (chartData && chartData.length > 0 ? computeLiquidityVoids(chartData) : []),
    [chartData],
  );

  // voiceSnapshot/criticalPulse/voiceEngine.init() moved below trackRecordSlice
  // (Signal Track Record) and convictionReading — Neural Market Aura's voice
  // events need tradePlanStatus/inEntryZone/convictionVerdict, and those only
  // exist once those two slices are declared (mesmo risco de Temporal Dead
  // Zone já resolvido antes para bosChoch: nunca referenciar um const antes
  // da própria declaração léxica).

  // Real SMC zones (FVG/Order Blocks/Liquidity) — lifted here (rather than
  // computed locally inside ChartWidget) so the Neural Core widget's
  // tactical-context prompt uses the exact same real counts the chart
  // itself renders, not a second independent computation.
  const smcZones = useMemo(
    () =>
      chartData && chartData.length > 0
        ? computeSmcZones(chartData)
        : { fairValueGaps: [], orderBlocks: [], liquidityZones: [] },
    [chartData],
  );
  // OMEGA CORE V-MAX (Fase 1.1, "matar a segunda verdade"): espelha o MESMO
  // smcZones real (nunca uma segunda computação) para a fatia §3 `smc` da
  // store — gateway novo para getSnapshotForEngine()/bus, sem tirar
  // nenhum consumidor existente de WidgetContext (aditivo, não substitui).
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setSmc(smcZones);
  }, [smcZones]);

  // Hoisted (Diretriz Restauração/Inteligência Visual §6): as MESMAS zonas
  // reais (OB/FVG não mitigadas) que o efeito de buildTradePlan abaixo já
  // montava inline — agora reaproveitadas também pelo destaque de
  // obstáculos no gráfico (chartObstacleZones, perto do JSX do chart) sem
  // recomputar a mesma transformação duas vezes.
  const tradePlanStructureZones = useMemo<TradePlanStructureZone[]>(() => {
    const zones: TradePlanStructureZone[] = [];
    smcZones.orderBlocks.filter((z) => !z.mitigated).forEach((z) => {
      zones.push({ low: z.bottom, high: z.top, kind: `OB_${z.type}` });
    });
    smcZones.fairValueGaps.filter((z) => !z.mitigated).forEach((z) => {
      zones.push({ low: z.bottom, high: z.top, kind: `FVG_${z.type}` });
    });
    return zones;
  }, [smcZones]);

  // V-MAX Fase 1.3: Volume Profile real (WASM no quant-worker) sobre os
  // MESMOS candles reais que o chart exibe — zero rede nova. Cadência
  // limitada a 1 cálculo por 5s (o candle vivo muda a cada tick de WS;
  // recomputar o perfil inteiro por tick seria spam de postMessage sem
  // ganho visual — mesma natureza da cadência de amostragem do l2-history).
  // Fail-Closed: qualquer falha => setVolumeProfile(null), nunca perfil velho
  // de outro ativo (o efeito de troca de ativo também zera).
  useEffect(() => {
    if (!chartData || chartData.length === 0) return;
    const now = Date.now();
    if (now - volumeProfileLastComputeRef.current < 5_000) return;
    volumeProfileLastComputeRef.current = now;
    let stale = false;
    (async () => {
      const [fixedRange, session] = await Promise.all([
        computeRealVolumeProfile(chartData),
        computeRealVolumeProfile(filterSessionCandles(chartData)),
      ]);
      if (stale) return;
      useUnifiedSnapshotStore.getState().setVolumeProfile({ fixedRange, session });
    })();
    return () => { stale = true; };
  }, [chartData]);

  // V-MAX Fase 1.4: Matriz de Confluência Fibonacci (agente transversal) —
  // cruza a retração real da última perna confirmada (mesma perna da
  // extensão 61.8% do motor de S/R, mesmo findSwings compartilhado) contra
  // TODAS as fontes reais de nível que os outros motores já produzem nesta
  // árvore: S1/R1 reais, zonas SMC vivas (FVG/OB não-mitigadas como FAIXA
  // real, EQH/EQL não-varridas) e POC/HVN do Volume Profile (Fase 1.3).
  // Zero rede nova, zero segunda matemática — só leitura transversal.
  // Camada de análise/exibição: nunca alimenta o Core Engine (LEI 24).
  const volumeProfileSnapshot = useVolumeProfileSnapshot();
  useEffect(() => {
    if (!chartData || chartData.length === 0) {
      useUnifiedSnapshotStore.getState().setFibonacciConfluence(null);
      return;
    }
    const sources: ConfluenceSource[] = [];
    const point = (kind: string, price: number | null | undefined) => {
      if (typeof price === "number" && Number.isFinite(price)) {
        sources.push({ kind, priceLow: price, priceHigh: price });
      }
    };
    point("SR_SUPPORT_1", engine?.support);
    point("SR_RESISTANCE_1", engine?.resistance);
    smcZones.fairValueGaps.filter((z) => !z.mitigated).forEach((z) => {
      sources.push({ kind: `FVG_${z.type}`, priceLow: z.bottom, priceHigh: z.top });
    });
    smcZones.orderBlocks.filter((z) => !z.mitigated).forEach((z) => {
      sources.push({ kind: `OB_${z.type}`, priceLow: z.bottom, priceHigh: z.top });
    });
    smcZones.liquidityZones.filter((z) => !z.swept).forEach((z) => {
      point(z.type === "EQUAL_HIGH" ? "EQH" : "EQL", z.price);
    });
    const vp = volumeProfileSnapshot?.fixedRange;
    if (vp) {
      point("VP_POC", vp.pocPrice);
      vp.hvnIndices.forEach((i) => {
        point("VP_HVN", bucketMidPrice(i, vp.rangeMin, vp.rangeMax, vp.bucketCount));
      });
    }
    useUnifiedSnapshotStore.getState().setFibonacciConfluence(
      computeRealFibonacciConfluence(chartData, sources),
    );
  // Achado real de auditoria (sincronização/performance): `engine` inteiro
  // troca de referência a cada tick de livro/preço (5-6x/s) porque agrupa
  // campos rápidos com os poucos campos LENTOS que este efeito realmente lê
  // (support/resistance, só mudam no ciclo real do motor, ~30s) — dependia
  // do objeto inteiro e recomputava/escrevia na store nessa cadência rápida
  // por nada. Estreitado aos 2 campos reais lidos acima (mesmo padrão já
  // usado por ensembleConsensus/consensusRadar/auraReading neste arquivo).
  }, [chartData, smcZones, engine?.support, engine?.resistance, volumeProfileSnapshot]);

  // Refinamento Final §7 (Premium/Discount) + §8 (harmônicos): os dois
  // motores novos leem a MESMA série real do gráfico (chartData) e escrevem
  // cada um a sua fatia — mesma disciplina store-mediated dos efeitos
  // acima. O preço de referência do P/D é o último CLOSE real da série
  // (cadência de 30s), deliberadamente NÃO o tick de 1s do WebSocket:
  // recomputar zona/swings a cada tick escreveria na store 60x/min por um
  // dado que só muda de verdade quando um candle fecha ou um swing novo
  // confirma (Main Thread sagrada). Camada de análise (LEI 24): nunca
  // alimenta o Core Engine.
  useEffect(() => {
    const st = useUnifiedSnapshotStore.getState();
    if (!chartData || chartData.length === 0) {
      st.setPremiumDiscount(null);
      st.setHarmonicPatterns([]);
      st.setTrianglePattern(null);
      st.setHeadShouldersPattern(null);
      return;
    }
    const lastClose = chartData[chartData.length - 1]?.close ?? null;
    st.setPremiumDiscount(computePremiumDiscount({ candles: chartData, price: lastClose }));
    st.setHarmonicPatterns(detectHarmonicPatterns({ candles: chartData }));
    // Carta Branca: mesma série real (chartData), mesma cadência de 30s
    // (candle fechado) — zero segunda assinatura de dado, zero tick de 1s
    // recomputando geometria de padrão à toa (Main Thread sagrada).
    st.setTrianglePattern(detectTrianglePattern({ candles: chartData }));
    st.setHeadShouldersPattern(detectHeadAndShoulders({ candles: chartData }));
  }, [chartData]);

  // Refinamento Final §10 (Inteligência Temporal, "sem reaproveitar
  // cálculos antigos"): a série do Score Geral que alimenta a tendência de
  // convicção é escopada ao PAR ativo+timeframe — trocar só o timeframe já
  // muda o regime da leitura (S/R, estrutura e classificação temporal são
  // timeframe-aware), então misturar amostras de 15m com 1H na mesma média
  // móvel produziria uma "tendência" de nada real. O reset por troca de
  // ATIVO já existia (efeito [selectedAsset] acima); este cobre o eixo que
  // faltava. Idempotente quando os dois disparam juntos.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().resetInstitutionalScoreHistory();
    // trackRecord não é zerado aqui — arquivado/restaurado por
    // symbol:timeframe no efeito dedicado logo acima (§6.8).
    //
    // Achados reais (Diretriz de Evolução Autônoma Integral, auditoria de
    // staleness de overlays — troca de ATIVO já é imune por desmontar o
    // gráfico inteiro quando chartData vira []; troca de TIMEFRAME não
    // desmonta nada, então precisa dos resets abaixo):
    // 1. S1/R1 (createPriceLine em EnhancedChart_110_Percent.tsx) vêm de
    //    engine.support/resistance, derivados de realCycle — só
    //    resetado na troca de ATIVO, nunca na de timeframe. Como
    //    runRealAnalysisCycle (efeito próprio, já reage a chartTimeframe)
    //    é assíncrono, as linhas S1/R1 do timeframe ANTERIOR ficavam
    //    penduradas sobre os candles do novo timeframe até o ciclo novo
    //    resolver — um nível estrutural de 15m rotulado como se fosse
    //    válido no 4h, não só "um pouco velho": errado para o contexto
    //    novo. Diferente da decisão P1 (chartData permanece visível de
    //    propósito, mesmo timeframe, só levemente atrasado) — aqui o
    //    dado é de OUTRO regime, então o fail-closed correto é limpar,
    //    não reter.
    setRealCycle(null);
    setEngineStatus("pending");
    // 2. VolumeProfilePlugin: o throttle de 5s (volumeProfileLastComputeRef)
    //    só era zerado na troca de ativo — trocar de timeframe dentro
    //    dessa janela mantinha o histograma/POC do timeframe anterior
    //    desenhado sobre os candles novos por até 5s.
    useUnifiedSnapshotStore.getState().setVolumeProfile(null);
    volumeProfileLastComputeRef.current = 0;
  }, [chartTimeframe]);

  // Diretriz Evolução Contínua §3/§4: cada mudança real do ponto de vista
  // do Operador (ativo/timeframe/modo) é persistida na hora — reabrir o
  // PWA/refresh restaura exatamente onde parou (readRestoredSession no
  // module-load + inicializadores preguiçosos dos useState).
  useEffect(() => {
    persistSessionState({
      asset: selectedAsset,
      timeframe: chartTimeframe,
      marketMode,
      tradFiSymbol: selectedTradFiAsset?.symbol ?? null,
      chartLayers: chartLayerVisibility,
      chartLayerAutoMode,
      emaPeriod,
    });
  }, [selectedAsset, chartTimeframe, marketMode, selectedTradFiAsset, chartLayerVisibility, chartLayerAutoMode, emaPeriod]);

  // V-MAX Fase 1 item 4: Conselho Multi-Agente. Cada insumo abaixo é dado
  // REAL já coletado por este componente ou pela store — o conselho é um
  // consumidor transversal puro, nunca uma segunda fonte de dados. O
  // FibonacciAgent lê a matriz da Fase 1.4 (que já carrega POC/HVN do WASM
  // Quant Core — o cruzamento transversal da diretriz). Camada de análise:
  // jamais alimenta o Core Engine (LEI 24).
  const fibonacciMatrix = useFibonacciConfluenceSnapshot();
  const councilOffline = useOfflineSnapshot();
  const councilDataFresh = useDataFreshSnapshot();
  // MomentumAgent order: RSI de Wilder real (computeRSI, mesma função já
  // usada como feature do classificador k-NN) sobre os closes reais já
  // carregados para o gráfico — computado uma vez aqui, nunca recalculado
  // pelo agente. NaN (período mínimo ainda não atingido) vira null
  // honesto; o agente trata isso como ABSTAIN, nunca um zero fabricado.
  const currentRsi = useMemo(() => {
    if (chartData.length === 0) return null;
    const series = computeRSI(chartData.map((c: { close: number }) => c.close), 14);
    const last = series[series.length - 1];
    return Number.isFinite(last) ? (last as number) : null;
  }, [chartData]);
  // Diretriz Final de Integração Total ("habilitar recursos já
  // implementados, mas ainda não conectados ao fluxo principal"):
  // nexus/macd.ts (EPC OMEGA FINAL) foi construído e testado, mas ficou
  // isolado — este é o wiring real, mesmo padrão exato de currentRsi
  // acima (useMemo sobre os MESMOS closes reais de chartData, computado
  // uma vez aqui). Display-only puro (LEI 24): não participa da votação
  // do Conselho, é só uma leitura a mais no painel.
  const currentMacd = useMemo(() => {
    if (chartData.length === 0) return null;
    const series = computeMacdSeries(chartData.map((c: { time: number; close: number }) => ({ time: c.time, close: c.close })));
    return latestMacd(series);
  }, [chartData]);
  useEffect(() => {
    const price = typeof priceData?.price === "number" ? priceData.price : null;
    // EPC §5/§6 (achado real de auditoria, prioridade máxima): este
    // efeito recomputa a cada tick real de preço (priceData nas deps
    // abaixo) — sem histerese no stance publicado, o Conselho piscava
    // LONG/SHORT↔NEUTRAL perto de qualquer fronteira de decisão, criando
    // e destruindo o Trade Plan repetidamente (ver council.ts,
    // councilStanceWithHysteresis). prevStance lido direto da store
    // (getState() síncrono, sempre fresco — nunca uma closure velha) ANTES
    // de escrever a nova leitura.
    const prevStance = useUnifiedSnapshotStore.getState().council?.stance ?? "NEUTRAL";
    const decision = buildCouncilDecision({
      price,
      liquidityZones: smcZones.liquidityZones,
      structure15: engine?.marketStructureLabel ?? null,
      structure1h: engine?.htfMarketStructureLabel ?? null,
      cvd,
      orderflowSignals,
      offline: councilOffline,
      isDataFresh: councilDataFresh,
      engineStatus,
      fibonacci: fibonacciMatrix,
      rsi: currentRsi,
    }, Date.now(), prevStance);
    useUnifiedSnapshotStore.getState().setCouncil(decision);
  // Mesmo achado de auditoria do efeito Fibonacci acima: só marketStructureLabel/
  // htfMarketStructureLabel (rótulos lentos do ciclo real do motor) entram
  // na decisão — `engine` inteiro como dependência recomputava o Conselho
  // (e sobrescrevia a store) a cada tick de livro/preço, não só quando a
  // estrutura real mudava.
  }, [priceData, smcZones, engine?.marketStructureLabel, engine?.htfMarketStructureLabel, cvd, orderflowSignals, councilOffline, councilDataFresh, engineStatus, fibonacciMatrix, currentRsi]);

  // V-MAX Fase 2 (Motor de Cenários) — reescrito pela Ordem "Próxima
  // Evolução do Organismo": zero comunicação direta motor→motor. Antes, o
  // conselho entregava a variável `decision` em mãos ao Motor de Cenários no
  // MESMO efeito; agora o conselho só ESCREVE `council` no
  // UnifiedGlobalSnapshot, e este efeito é acordado pela própria fatia
  // (useCouncilSnapshot) e relê a decisão da store — toda interação passa
  // pela camada central. O mesmo write dispara BRAIN.COUNCIL.UPDATED no bus
  // (via OrganismOrchestrator) para qualquer futuro assinante, sem que o
  // conselho saiba que ele existe. Custo honesto: um commit de re-render a
  // mais entre decisão e projeção (<1 frame) — o preço da mediação.
  //
  // Níveis: os MESMOS níveis reais que os motores já mapearam — nenhum alvo
  // projetado/inventado; pesos = massa de opinião real do conselho lido da
  // store (nunca probabilidade). Preço/fib/VP também lidos das fatias reais
  // da store (mediação completa); smcZones/engine (S/R) são insumos
  // pré-store do coletor único (App) — ver docs/ORGANISM_DATA_FLOW.md.
  const councilFromSnapshot = useCouncilSnapshot();
  const priceFromSnapshot = usePriceSnapshot();

  // Phase Ω Priority 2 (Confluence/Conviction Engine): levantado para cá
  // (antes vivia só dentro de DecisionValidationWidget) porque a Neural
  // Market Aura (ChartWidget) agora precisa da MESMA leitura real —
  // calculada uma vez aqui, compartilhada via contextValue, nunca
  // recomputada duas vezes a partir dos mesmos insumos reais.
  const multiTimeframeForConviction = useMultiTimeframeSnapshot();
  const trustScoreForConviction = useTrustScoreSnapshot();
  const convictionReading = useMemo(
    () =>
      buildConvictionReading({
        coreDirection: engine?.direction ?? null,
        ensembleConsensus: ensembleConsensus?.status === "OK" ? { status: ensembleConsensus.status, direcao: ensembleConsensus.direcao, forca: ensembleConsensus.forca, forca_ajustada: ensembleConsensus.forca_ajustada ?? null } : null,
        council: councilFromSnapshot ?? null,
        multiTimeframe: multiTimeframeForConviction ?? null,
        trustScore: trustScoreForConviction?.score ?? null,
      }),
    [engine?.direction, ensembleConsensus, councilFromSnapshot, multiTimeframeForConviction, trustScoreForConviction],
  );

  useEffect(() => {
    const levels: ScenarioLevel[] = [];
    if (typeof engine?.support === "number" && Number.isFinite(engine.support)) {
      levels.push({ price: engine.support, sourceKind: "SR_SUPPORT_1" });
    }
    if (typeof engine?.resistance === "number" && Number.isFinite(engine.resistance)) {
      levels.push({ price: engine.resistance, sourceKind: "SR_RESISTANCE_1" });
    }
    smcZones.liquidityZones.filter((z) => !z.swept).forEach((z) => {
      levels.push({ price: z.price, sourceKind: z.type === "EQUAL_HIGH" ? "EQH" : "EQL" });
    });
    (fibonacciMatrix?.levels ?? []).filter((l) => l.score > 0).forEach((l) => {
      levels.push({ price: l.price, sourceKind: `FIB_${(l.ratio * 100).toFixed(1)}` });
    });
    const vpForScenario = volumeProfileSnapshot?.fixedRange;
    if (vpForScenario) {
      levels.push({ price: vpForScenario.pocPrice, sourceKind: "VP_POC" });
      vpForScenario.hvnIndices.forEach((i) => {
        levels.push({ price: bucketMidPrice(i, vpForScenario.rangeMin, vpForScenario.rangeMax, vpForScenario.bucketCount), sourceKind: "VP_HVN" });
      });
    }
    useUnifiedSnapshotStore.getState().setScenario(
      buildScenarioProjection(priceFromSnapshot.price, levels, councilFromSnapshot),
    );
  // Mesmo achado de auditoria: só support/resistance (lentos) entram nos
  // níveis do cenário — `engine` inteiro recomputava a projeção a cada
  // tick de livro/preço em vez de só quando S/R real do motor mudava.
  }, [councilFromSnapshot, priceFromSnapshot, smcZones, engine?.support, engine?.resistance, fibonacciMatrix, volumeProfileSnapshot]);

  // Diretriz Complementar §8 ("Radar de Consenso"): mesma disciplina do
  // efeito de Cenários acima — zero comunicação direta motor→motor, este
  // efeito relê o Conselho da própria store (councilFromSnapshot) e só
  // acrescenta 2 leituras reais que o Conselho não vota: bandwidthPercentile
  // (regime real, nunca antes lido aqui — achado real de auditoria, dado
  // morto até este commit) e a magnitude do GMIL
  // (|institutionalConsensus.score|, sinal descartado de propósito — ver
  // consensus-radar.ts para o porquê). "Risk Engine" fica de fora: não
  // existe magnitude contínua real para essa categoria em lugar nenhum do
  // código (fabricar uma violaria a Regra de Ouro 1).
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setConsensusRadar(
      computeConsensusRadar({
        council: councilFromSnapshot ?? null,
        bandwidthPercentile: engine?.marketRegime?.bandwidthPercentile ?? null,
        gmilScore: institutionalConsensus.score,
      }),
    );
  }, [councilFromSnapshot, engine?.marketRegime, institutionalConsensus]);

  // Signal Precision order (phase 4): actionable Trade Plan — when the
  // Council reads LONG/SHORT, derive entry zone / stop / target from REAL
  // structure only (unmitigated Order Blocks + FVGs, S1/R1, liquidity
  // pools as targets, Fibonacci confluence, Volume Profile POC/HVN).
  // Store-mediated like the scenario effect above: council read from the
  // snapshot slice, plan written to its own slice, published on the bus by
  // the orchestrator (BRAIN.TRADE_PLAN.UPDATED). Advisory only — this
  // terminal never routes orders (permanent read-only design).
  useEffect(() => {
    const zones = tradePlanStructureZones;
    const planLevels: TradePlanLevelInput[] = [];
    const level = (kind: string, price: number | null | undefined) => {
      if (typeof price === "number" && Number.isFinite(price)) planLevels.push({ price, kind });
    };
    level("SR_SUPPORT_1", engine?.support);
    level("SR_RESISTANCE_1", engine?.resistance);
    smcZones.liquidityZones.filter((z) => !z.swept).forEach((z) => {
      level(z.type === "EQUAL_HIGH" ? "EQH" : "EQL", z.price);
    });
    (fibonacciMatrix?.levels ?? []).filter((l) => l.score > 0).forEach((l) => {
      level(`FIB_${(l.ratio * 100).toFixed(1)}`, l.price);
    });
    const vpForPlan = volumeProfileSnapshot?.fixedRange;
    if (vpForPlan) {
      level("VP_POC", vpForPlan.pocPrice);
      vpForPlan.hvnIndices.forEach((i) => {
        level("VP_HVN", bucketMidPrice(i, vpForPlan.rangeMin, vpForPlan.rangeMax, vpForPlan.bucketCount));
      });
    }
    useUnifiedSnapshotStore.getState().setTradePlan(
      buildTradePlan({
        stance: councilFromSnapshot?.stance ?? null,
        riskGated: councilFromSnapshot?.riskGated ?? true,
        price: priceFromSnapshot.price,
        zones,
        levels: planLevels,
      }),
    );
  // Mesmo achado de auditoria: só support/resistance (lentos) entram nos
  // níveis do plano — `engine` inteiro recomputava/reescrevia o Trade Plan
  // a cada tick de livro/preço, disparando remoção/recriação desnecessária
  // das price-lines reais no gráfico (EnhancedChart_110_Percent.tsx).
  }, [councilFromSnapshot, priceFromSnapshot, tradePlanStructureZones, engine?.support, engine?.resistance, fibonacciMatrix, volumeProfileSnapshot]);

  // Autonomy order — honest signal accuracy. Store-mediated chain:
  // (1) the tradePlan slice feeds the tracker (same-value re-derivations
  //     are no-ops inside the pure engine — zero spurious transitions);
  // (2) every real price tick evaluates the open plan (first touch:
  //     target vs stop; conservative on gaps);
  // (3) a real resolution becomes a PERCEPTION event in the affective
  //     memory (the CPI now feels whether the reading was right) and the
  //     record is persisted (Local-First — accuracy accumulates across
  //     sessions);
  // (4) boot hydrates the persisted record fail-closed (an OPEN plan from
  //     a dead session is counted superseded, never resolved in absentia).
  const trackedPlan = useTradePlanSnapshot();
  useEffect(() => {
    useUnifiedSnapshotStore.getState().trackPlanTransition(trackedPlan);
  }, [trackedPlan]);
  useEffect(() => {
    if (typeof priceFromSnapshot.price === "number") {
      useUnifiedSnapshotStore.getState().trackPriceTick(priceFromSnapshot.price);
    }
  }, [priceFromSnapshot]);
  const trackRecordSlice = useTrackRecordSnapshot();
  const paperTradingSlice = usePaperTradingSnapshot();
  // Diretriz Complementar §18: mesma série real de CVD já retida na store
  // (o heatmap já consome este exato hook) — zero fetch novo, zero segunda
  // série.
  const orderflowHistoryForTrend = useOrderflowHistory();
  // Diretriz Complementar §18/§4 ("Conviction Engine"): mesma série real do
  // Score Geral já retida na store — zero segunda fonte.
  const institutionalScoreHistory = useInstitutionalScoreHistory();
  const prevTrackRecordRef = useRef(trackRecordSlice);
  useEffect(() => {
    const prev = prevTrackRecordRef.current;
    prevTrackRecordRef.current = trackRecordSlice;
    if (prev === trackRecordSlice) return;
    const last = trackRecordSlice.history[trackRecordSlice.history.length - 1];
    const prevLen = prev.history.length;
    if (trackRecordSlice.history.length > prevLen && last) {
      if (last.status === "TARGET_HIT") {
        useUnifiedSnapshotStore.getState().recordAffectiveEvent("PLAN_TARGET_HIT");
      } else if (last.status === "STOP_HIT") {
        useUnifiedSnapshotStore.getState().recordAffectiveEvent("PLAN_STOP_HIT");
      }
    }
    void saveTrackRecord(trackRecordSlice).catch(() => {});
  }, [trackRecordSlice]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await loadTrackRecord().catch(() => null);
      if (cancelled || raw === null) return;
      useUnifiedSnapshotStore.getState().hydrateTrackRecord(rehydrateTrackRecord(raw));
    })();
    // Consolidação Operacional §5: envelhecimento/compactação do cache de
    // candles roda UMA vez por boot, fire-and-forget — nunca no caminho
    // quente, nunca bloqueia a hidratação acima (stores independentes).
    void compactPersistedCandles().catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // v16.0 PRO MAX §9.1/§9.4: mesmo padrão exato de persistência do track
  // record acima (best-effort save-on-change + hydrate no boot) — a
  // posição/histórico simulados sobrevivem a reloads pelo mesmo motivo
  // (memória real acumulada, Local-First). Zero automação aqui: este
  // efeito só PERSISTE o que já mudou por um clique do Operador, nunca
  // decide abrir/fechar nada sozinho.
  useEffect(() => {
    void savePaperTrading(paperTradingSlice).catch(() => {});
  }, [paperTradingSlice]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await loadPaperTrading().catch(() => null);
      if (cancelled || raw === null) return;
      useUnifiedSnapshotStore.getState().hydratePaperTrading(rehydratePaperTrading(raw));
    })();
    return () => { cancelled = true; };
  }, []);

  // Neural Market Aura ("Comunicação por Voz"): as MESMAS 4 leituras reais
  // já rastreadas acima (trackRecordSlice) e a MESMA convictionReading
  // compartilhada via contextValue — zero segunda fonte de verdade.
  const lastResolvedPlan = trackRecordSlice.history[trackRecordSlice.history.length - 1] ?? null;

  // inEntryZone com histerese real (ENTRY_ZONE_HYSTERESIS_FACTOR, topo do
  // arquivo) — lê o valor travado do commit ANTERIOR (inEntryZoneLatchRef),
  // nunca mutado durante o próprio render (evita o desvio clássico de
  // acumular estado dentro de um useMemo sob StrictMode/render descartado);
  // a escrita real acontece só depois, no useEffect logo abaixo.
  const inEntryZoneLatchRef = useRef(false);
  const rawEntryLow = trackRecordSlice.active?.plan.entry.low ?? null;
  const rawEntryHigh = trackRecordSlice.active?.plan.entry.high ?? null;
  const livePriceForZone =
    typeof priceFromSnapshot.price === 'number' && Number.isFinite(priceFromSnapshot.price) ? priceFromSnapshot.price : null;
  const inEntryZoneNow = useMemo(() => {
    if (trackRecordSlice.active === null || rawEntryLow === null || rawEntryHigh === null || livePriceForZone === null) return false;
    const wasIn = inEntryZoneLatchRef.current;
    const margin = (rawEntryHigh - rawEntryLow) * ENTRY_ZONE_HYSTERESIS_FACTOR;
    const low = wasIn ? rawEntryLow - margin : rawEntryLow;
    const high = wasIn ? rawEntryHigh + margin : rawEntryHigh;
    return livePriceForZone >= low && livePriceForZone <= high;
  }, [trackRecordSlice.active, rawEntryLow, rawEntryHigh, livePriceForZone]);
  useEffect(() => {
    inEntryZoneLatchRef.current = inEntryZoneNow;
  }, [inEntryZoneNow]);

  // Diretriz Complementar (Nexus Predictive Engine) §3: ETA dinâmica por
  // alvo do plano RASTREADO (mesmo trackRecordSlice autoritativo do resto
  // desta cadeia) — closes reais do gráfico + ATR real do Market Regime +
  // preço real + duração real da barra. Recomputada continuamente conforme
  // novas velas/ticks chegam (deps abaixo), exatamente o "nunca são fixas"
  // da diretriz. Mesmo padrão do currentRsi (useMemo sobre chartData).
  const etaReading = useMemo(
    () =>
      computeTargetEtas({
        plan: trackRecordSlice.active?.plan ?? null,
        targetsHit: trackRecordSlice.active?.targetsHit ?? 0,
        livePrice: livePriceForZone,
        atrPercent: engine?.marketRegime?.atrPercent ?? null,
        closes: chartData.map((c: { close: number }) => c.close),
        timeframeMs: TIMEFRAME_MS[chartTimeframe as string] ?? TIMEFRAME_MS["15m"],
      }),
    [trackRecordSlice.active, livePriceForZone, engine?.marketRegime, chartData, chartTimeframe],
  );

  // ── Consolidação Final §20-§30: VWAP (estados/distância) + Nexus Line ──
  // A MATEMÁTICA da VWAP fica intocada (§20): computeSessionVwapSeries é a
  // MESMA função pura que o gráfico desenha, avaliada sobre o MESMO
  // chartData canônico — aqui só o último valor real, para header/estado.
  const vwapNow = useMemo(() => latestVwap(computeSessionVwapSeries(chartData)), [chartData]);
  const nexusLineNow = useMemo(() => latestNexusLine(computeNexusLineSeries(chartData)), [chartData]);
  // Estados com histerese real (§22 "nunca trocar de estado a cada
  // candle"): a transição depende do estado ANTERIOR — useState + efeito
  // com updater funcional, nunca useMemo (mesma lição do inEntryZone).
  const [vwapCtx, setVwapCtx] = useState<VwapContext | null>(null);
  const [nlState, setNlState] = useState<DirectionalLineState>("NEUTRAL");
  const atrAbsForLines = etaReading.atrAbsolute;
  useEffect(() => {
    setVwapCtx((prev) => computeVwapContext(prev?.state ?? "NEUTRAL", livePriceForZone, vwapNow, atrAbsForLines));
    setNlState((prev) => nexusLineState(prev, livePriceForZone, nexusLineNow, atrAbsForLines));
  }, [livePriceForZone, vwapNow, nexusLineNow, atrAbsForLines]);

  // Diretriz V-MAX (itens 5/6): Score Geral + Assistente — computados UMA
  // vez aqui (mesmo padrão de convictionReading, que ambos reaproveitam),
  // compartilhados via contextValue. Declarados DEPOIS de convictionReading/
  // councilFromSnapshot/inEntryZoneNow (mesmo cuidado de TDZ já aplicado a
  // voiceSnapshot/bosChoch).
  const institutionalScore = useMemo(
    () =>
      computeInstitutionalScore({
        engineStatus,
        coreDirection: engine?.direction ?? null,
        conviction: convictionReading,
        riskGated: councilFromSnapshot?.riskGated ?? false,
      }),
    [engineStatus, engine?.direction, convictionReading, councilFromSnapshot],
  );
  // Entrega 42 ("Profitability Engine"): expectativa real (R-múltiplo após
  // comissão+slippage+funding) sobre o Track Record JÁ resolvido deste
  // symbol:timeframe (trackRecordSlice.history) — nunca um replay sintético
  // (ver cabeçalho de nexus/trade-simulation.ts para a auditoria completa
  // do porquê). LEI 24 — exceção pontual autorizada pelo Operador (ver
  // CLAUDE.md, seção "LEI 24"): CoreSignalBadge usa
  // expectancyFilter.show para decidir entre a direção real do Núcleo e
  // NEUTRO quando a expectativa líquida histórica é negativa. O Núcleo em
  // si (engine.direction) NUNCA é mutado por este cálculo — a supressão é
  // só de apresentação, computada aqui e consumida no badge/ExpectancyCard.
  // Fase 3: fatorado de dentro do useMemo abaixo para ser compartilhado com
  // calibrationResult sem recomputar simulateTradeCostsBatch uma 2ª vez
  // sobre o mesmo trackRecordSlice.history (zero segunda fonte).
  const trackRecordResults = useMemo(() => simulateTradeCostsBatch(trackRecordSlice.history), [trackRecordSlice.history]);
  const expectancyFilter: FilterResult = useMemo(
    () => evaluateSignalFilter(trackRecordResults),
    [trackRecordResults],
  );
  // Escopo Cirúrgico (Operador, Fase 3): leitura ATUAL da fusão de modelos
  // (Fase 2), orientada à direção do plano rastreado agora — councilFromSnapshot.votes
  // já é a MESMA CouncilDecision deste ciclo (zero segunda chamada aos
  // agentes), engine.marketRegime.direction/adx já são reais e já fluem
  // pela bridge (engine-bridge.ts) mas nunca tinham consumidor até aqui.
  // Recalculada a cada render: serve tanto para o carimbo único de abertura
  // (abaixo) quanto para "o que a calibração diria se um trade fosse aberto
  // agora" (ExpectancyCard). null sem plano ativo ou sem nenhum modelo com
  // voto real — fail-closed, nunca um score fabricado.
  const liveModelAgreement = useMemo(() => {
    const direction = trackRecordSlice.active?.plan.direction ?? null;
    if (direction === null) return null;
    const modelVotes = [
      ...councilVotesToModelVotes(councilFromSnapshot?.votes ?? []),
      regimeModelVote(engine?.marketRegime?.direction ?? null, engine?.marketRegime?.adx ?? null),
    ];
    return alignFusedConfidence(fuseModelVotes(modelVotes), direction);
  }, [trackRecordSlice.active, councilFromSnapshot, engine?.marketRegime]);
  // Platt scaling (Platt 1999, pesquisado via WebSearch antes de
  // implementar — ver header de nexus/platt-calibration.ts) sobre o MESMO
  // Track Record real de expectancyFilter — nunca uma 2ª amostra.
  const calibrationResult: CalibrationResult = useMemo(
    () => calibrateConfidence(liveModelAgreement, trackRecordResults),
    [liveModelAgreement, trackRecordResults],
  );

  // Fase H (V15): sugestão de dimensionamento — % do equity e % de risco,
  // NUNCA valor monetário (o sistema não conhece o capital do operador).
  // Fail-closed por construção: qualquer insumo ausente/não-finito, comitê
  // dividido ou contrário ao sinal => 0%. A UI exibe o selo obrigatório ao
  // lado dos números. Consultivo: nada aqui é lido de volta pelo Core.
  //
  // Fase L (diretriz 1 — correção de governança do achado da Fase K): o
  // Kelly fracionado consome a força AJUSTADA pela qualidade da fonte
  // (forca_ajustada = forca × peso do Bus da Fase C), nunca mais a força
  // bruta. Consequência deliberada: fonte em quarentena (peso 0) ou nunca
  // medida (peso null) => força 0/null => sugestão 0% — a qualidade da
  // rede agora impacta o lote final, fail-closed de ponta a ponta.
  //
  // Entrega 44: declarado DEPOIS de expectancyFilter (relocado de perto do
  // Comitê, nada entre as duas posições antigas lia riskSuggestion) para
  // consumir a taxa de acerto REAL já computada ali (nexus/expectancy.ts,
  // ≥30 trades reais resolvidos deste symbol:timeframe) — risk-engine.js
  // usa essa taxa no lugar do p₀=0.5 assumido quando a amostra existe,
  // mesmo comportamento de antes quando não existe (ver header de
  // risk-engine.js). Nenhum motor novo: mesma fórmula, insumo mais
  // honesto quando disponível.
  const riskSuggestion = useMemo(
    () =>
      buildRiskSuggestion({
        signal: engine.direction === "LONG" || engine.direction === "SHORT" ? engine.direction : null,
        entry: engine.entry,
        stop: engine.stop,
        atrPercent: engine.marketRegime?.atrPercent ?? null,
        riskRewardRatio: engine.riskRewardRatio,
        ensembleDirection: ensembleConsensus?.status === "OK" ? ensembleConsensus.direcao : null,
        ensembleForca: ensembleConsensus?.status === "OK" ? ensembleConsensus.forca_ajustada : null,
        realWinRate: expectancyFilter.stats?.winRate ?? null,
        realWinRateSampleSize: expectancyFilter.stats?.totalTrades ?? null,
      }),
    [
      engine.direction,
      engine.entry,
      engine.stop,
      engine.marketRegime,
      engine.riskRewardRatio,
      ensembleConsensus,
      expectancyFilter,
    ],
  );
  // Achado da auditoria de evolução (docs/AUDITORIA_UNIFICACAO_VOZ.md §4
  // item 2): riskSuggestion já era computado real acima mas nunca ganhava
  // fatia própria na store — mesmo padrão passthrough de nexusDecision
  // (App.tsx, poucas linhas abaixo): zero segundo cálculo, só espelha a
  // MESMA referência já resolvida para que o organismo (voz/GMIL/futuros
  // consumidores) possa lê-la sem reimplementar buildRiskSuggestion.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setRiskSuggestion(riskSuggestion);
  }, [riskSuggestion]);
  // Cockpit de Leitura §11 ("ETA previsto / ETA realizado" + contexto):
  // carimbo ÚNICO do contexto real de abertura no plano ativo. O guard do
  // stampOpenContext puro garante que só o PRIMEIRO ciclo com leituras do
  // plano recém-aberto escreve (etaReading deste render já deriva do
  // active novo — mesma árvore de render); depois disso, toda re-execução
  // devolve o estado original (memória nunca reescreve o histórico).
  useEffect(() => {
    const active = trackRecordSlice.active;
    if (!active || active.contextAtOpen !== undefined) return;
    const nextEta = etaReading.status === "OK" ? (etaReading.etas[active.targetsHit] ?? null) : null;
    useUnifiedSnapshotStore.getState().stampPlanOpenContext({
      etaMsAtOpen: nextEta?.ms ?? null,
      etaMsMinAtOpen: nextEta?.msMin ?? null,
      vwapState: vwapCtx?.state ?? null,
      nexusLineState: nlState,
      score: institutionalScore?.score ?? null,
      // Entrega 42: mesmo engine.marketRegime.regime já lido em vários
      // outros pontos deste arquivo (relevanceInput, Trade Plan Zone) —
      // zero segunda classificação.
      regime: engine?.marketRegime?.regime ?? null,
      // Escopo Cirúrgico (Fase 1, ScenarioFingerprint): mesmo
      // engine.marketStructureLabel já lido pelo header/Relevance Engine
      // — zero segunda classificação.
      structureLabel: engine?.marketStructureLabel ?? null,
      // Escopo Cirúrgico (Fase 3, Calibração de Probabilidade): mesmo
      // liveModelAgreement computado acima neste render (o plano recém-
      // aberto que este efeito está carimbando é o MESMO que liveModelAgreement
      // já leu via trackRecordSlice.active) — zero segunda fusão.
      modelAgreement: liveModelAgreement,
    });
  }, [
    trackRecordSlice.active,
    etaReading,
    vwapCtx,
    nlState,
    institutionalScore,
    engine?.marketRegime,
    engine?.marketStructureLabel,
    liveModelAgreement,
  ]);

  // Diretriz Complementar §18/§4 ("Conviction Engine"): registra na store a
  // amostra REAL do Score Geral a cada ciclo em que ele existe (WAIT/
  // DADOS_INSUFICIENTES nunca — pontuar o nada seria fabricação). Efeito,
  // não useMemo: é uma escrita real na store, não uma derivação pura.
  useEffect(() => {
    if (institutionalScore.score !== null) {
      useUnifiedSnapshotStore.getState().recordInstitutionalScore(institutionalScore.score);
    }
  }, [institutionalScore]);
  // EPC OMEGA FINAL Parte 1 ("Meta Engine", achado de auditoria): a leitura
  // INTEIRA (não só o número da série histórica acima) ganha fatia própria
  // no organismo — mesmo padrão já usado por confluenceCorridor logo
  // abaixo, zero segunda leitura.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setInstitutionalScoreReading(institutionalScore);
  }, [institutionalScore]);
  // Diretriz Complementar §16 ("Zona de Confiança Institucional"): banda
  // pura de apresentação sobre o mesmo institutionalScore acima — zero
  // segunda fonte, zero matemática nova (ver institutional-score.ts).
  const confidenceZone = useMemo(() => institutionalConfidenceZone(institutionalScore.score), [institutionalScore]);
  // OMEGA CORE V-MAX Fase 5 (Fusion §5, "Corredor de Confluência" — task
  // já escopada e aprovada pelo Operador numa rodada anterior, mesma ideia
  // visual do "Centro Gravitacional" da diretriz nova): organizador de
  // contexto puro que cruza a leitura JÁ real do Conviction Engine
  // (convictionReading, já computado acima — nunca uma segunda pool de
  // ensemble/council/multi-timeframe) com obstáculos reais no caminho até
  // o alvo mais próximo do Trade Plan (trackedPlan é o MESMO
  // useTradePlanSnapshot() que chartTradePlan em ChartWidget, zero segunda
  // leitura). Correção de auditoria (completar Fase 7, ver
  // confluence-corridor.ts): a v1 lia opinionMass/institutionalScore/
  // multiTimeframe em paralelo, mas institutionalScore já É uma cópia
  // reescalada de convictionReading.conviction — dupla contagem corrigida
  // consumindo convictionReading INTEIRO como componente único. Display-
  // only (LEI 24): direction/obstacleCount chegam já decididos em outro
  // lugar, nunca recalculados aqui.
  const confluenceCorridor = useMemo(
    () =>
      computeConfluenceCorridor({
        direction: engine?.direction ?? null,
        conviction: convictionReading,
        activeObstacleCount: trackedPlan?.targets?.[0]?.obstacleCount ?? null,
      }),
    [engine?.direction, convictionReading, trackedPlan],
  );
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setConfluenceCorridor(confluenceCorridor);
  }, [confluenceCorridor]);
  // Diretriz Complementar §18: tendência real de força do fluxo — mesma
  // série de CVD já retida, reduzida a FORTALECENDO/ENFRAQUECENDO/ESTAVEL.
  const orderflowTrend = useMemo(() => computeOrderflowTrend(orderflowHistoryForTrend), [orderflowHistoryForTrend]);
  // Diretriz Complementar §18/§4 ("Conviction Engine"): tendência real do
  // Score Geral (média recente vs. anterior da MESMA série acima).
  const convictionTrend = useMemo(() => computeConvictionTrend(institutionalScoreHistory), [institutionalScoreHistory]);
  // Diretriz Mestra §1/§12 ("Heat Score"): intensidade de ATIVIDADE real
  // — 3 magnitudes já medidas (percentil de volatilidade do regime, |Δ24h|
  // do ticker, liquidações na janela viva), média simples, fail-closed com
  // <2 componentes. NUNCA probabilidade nem direção (heat-score.ts).
  const heatReading = useMemo(
    () =>
      computeHeatScore({
        bandwidthPercentile: engine?.marketRegime?.bandwidthPercentile ?? null,
        deltaPct: priceData?.deltaPct ?? null,
        recentLiquidationCount: liquidations?.length ?? null,
      }),
    [engine?.marketRegime, priceData?.deltaPct, liquidations],
  );
  // EPC OMEGA FINAL Parte 1: mesmo motivo/mesmo padrão do efeito de
  // institutionalScore acima — Heat Score nunca tinha fatia própria.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setHeatScoreReading(heatReading);
  }, [heatReading]);

  const assistantMessages = useMemo(
    () =>
      buildAssistantMessages({
        engineStatus,
        coreDirection: engine?.direction ?? null,
        structureLabel: engine?.marketStructureLabel ?? null,
        conviction: convictionReading,
        scoreReading: institutionalScore,
        council: councilFromSnapshot ?? null,
        inEntryZone: inEntryZoneNow,
        orderflowTrend,
      }),
    [engineStatus, engine?.direction, engine?.marketStructureLabel, convictionReading, institutionalScore, councilFromSnapshot, inEntryZoneNow, orderflowTrend],
  );

  // Diretriz Final ("Fusão da Inteligência Operacional"): o Nexus Decision
  // Layer como leitura ÚNICA — funde as leituras já computadas acima num
  // só contrato (decision-layer.ts). LEI 24 preservada por construção:
  // operation é passthrough do Core Engine; nada aqui decide, pondera ou
  // bloqueia. Toda a matemática continua nos motores — este objeto é a
  // resposta consolidada que a UI (e futuras camadas: voz, replay) leem
  // de UMA vez em vez de recompor de 5 fatias.
  // V2: zona P/D real para a justificativa estruturada (mesma fatia que o
  // gráfico e o strip já leem).
  const pdForDecision = usePremiumDiscountSnapshot();
  const nexusDecision = useMemo(
    () =>
      buildNexusDecision({
        coreDirection: engine?.direction ?? null,
        coreConfidence: engine?.confidence ?? null,
        plan: trackedPlan,
        targetsHit: trackRecordSlice.active?.targetsHit ?? 0,
        etaReading,
        score: institutionalScore?.score ?? null,
        scoreZoneLabel: confidenceZone?.label ?? null,
        scoreTrend: convictionTrend?.status === "OK" ? (convictionTrend.trend ?? null) : null,
        councilStance: councilFromSnapshot?.stance ?? null,
        councilRiskGated: councilFromSnapshot ? (councilFromSnapshot.riskGated ?? false) : null,
        assistantMessage:
          assistantMessages && assistantMessages.length > 0
            ? { text: assistantMessages[0].text, basis: assistantMessages[0].basis }
            : null,
        // ── V2 (§3/§4) ──
        inEntryZone: inEntryZoneNow ?? null,
        // ENCERRADO olha a última resolução REAL (alvo/stop) — REPLACED é
        // troca de plano, não encerramento de leitura.
        lastResolvedAt: (() => {
          for (let i = trackRecordSlice.history.length - 1; i >= 0; i--) {
            const h = trackRecordSlice.history[i];
            if (h.status !== "REPLACED") return h.resolvedAt;
          }
          return null;
        })(),
        councilVotes:
          councilFromSnapshot?.votes?.map((v: { agent: string; stance: string; rationale: string }) => ({
            agent: v.agent,
            stance: v.stance,
            rationale: v.rationale,
          })) ?? null,
        convictionMembers:
          convictionReading?.members?.map((m: { id: string; agreesWithCore: boolean | null; detail: string }) => ({
            id: m.id,
            agreesWithCore: m.agreesWithCore,
            detail: m.detail,
          })) ?? null,
        heatTier: heatReading?.status === "OK" ? heatReading.tier : null,
        premiumDiscountZone: pdForDecision?.zone ?? null,
        // Cockpit de Leitura §4: os equilíbrios entram na justificativa
        // estruturada (conflito nomeado e visível, nunca um bloqueio).
        vwapState: vwapCtx?.state ?? null,
        nexusLineState: nlState,
      }),
    [engine?.direction, engine?.confidence, trackedPlan, trackRecordSlice, etaReading, institutionalScore, confidenceZone, convictionTrend, councilFromSnapshot, assistantMessages, inEntryZoneNow, convictionReading, heatReading, pdForDecision, vwapCtx, nlState],
  );
  // EPC OMEGA FINAL Parte 1 ("Meta Engine", achado de auditoria): o
  // contrato único do Nexus Decision Layer ganha fatia própria no
  // organismo — hoje só existia como useMemo local, invisível para
  // qualquer assinante do bus (getSnapshotForEngine). operation continua
  // passthrough literal do Core Engine (decision-layer.ts) — esta escrita
  // não muda o que o contrato significa, só onde ele mora.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setNexusDecision(nexusDecision);
  }, [nexusDecision]);

  // Consolidação Final §30: confluência VWAP × Nexus Line × Decision Layer
  // — veredito INFORMATIVO ("informar conflito estrutural"); LEI 24: nunca
  // altera/bloqueia a operação, que segue passthrough do Core Engine.
  const nexusConfluence = useMemo(
    () => nexusConfluenceVerdict(vwapCtx?.state ?? "NEUTRAL", nlState, nexusDecision?.operation ?? null),
    [vwapCtx, nlState, nexusDecision],
  );

  // Evolução Incremental da Inteligência Central, Fase 1→2: mesmo padrão
  // informativo de nexusConfluence acima, generalizado para os pares que
  // unified-presentation.ts (Fase 1, isolado/testado) já resolve —
  // Regime×Structure e Risk×Conselho. LEI 24: só informa, nunca altera o
  // Núcleo. Adapta engine.marketRegime (shape achatado do App) para o
  // RegimeReading real, e engine.marketStructureLabel (já limpo por
  // cleanStructureLabel) de volta ao vocabulário ESTRUTURA_* do motor.
  const displayConflicts = useMemo(
    () =>
      computePresentationState({
        decision: nexusDecision,
        council: councilFromSnapshot,
        regime: engine?.marketRegime
          ? { status: "OK", regime: engine.marketRegime.regime, direction: engine.marketRegime.direction }
          : null,
        aura: null,
        structureLabel:
          engine?.marketStructureLabel === "ALTA"
            ? "ESTRUTURA_ALTA"
            : engine?.marketStructureLabel === "BAIXA"
              ? "ESTRUTURA_BAIXA"
              : engine?.marketStructureLabel === "LATERAL"
                ? "ESTRUTURA_LATERAL"
                : null,
        riskStatus: riskSuggestion?.status ?? null,
      }).displayConflicts,
    [nexusDecision, councilFromSnapshot, engine?.marketRegime, engine?.marketStructureLabel, riskSuggestion],
  );

  // Achado real de auditoria (sincronização/performance): este objeto era
  // um literal recriado em TODO render (referência nova sempre) e usado
  // como dependência do useMemo de voiceSnapshot logo abaixo — na prática
  // desativava aquela memoização (objeto novo sempre "!=" o anterior, então
  // o useMemo recomputava em todo render, não só nas transições reais de
  // Trade Plan). useMemo real aqui, com os insumos reais que efetivamente
  // compõem o objeto (trackRecordSlice/lastResolvedPlan já são referências
  // estáveis da store — só trocam quando o dado real por trás muda).
  const auraVoiceInputs = useMemo(
    () => ({
      tradePlanOpenKey: trackRecordSlice.active ? `${trackRecordSlice.active.plan.direction}:${trackRecordSlice.active.openedAt}` : null,
      tradePlanDirection: trackRecordSlice.active?.plan.direction ?? null,
      tradePlanResolutionKey: lastResolvedPlan ? `${lastResolvedPlan.status}:${lastResolvedPlan.resolvedAt}` : null,
      tradePlanResolutionStatus: lastResolvedPlan && lastResolvedPlan.status !== 'OPEN' ? lastResolvedPlan.status : null,
      // v2 (Diretriz Complementar §2/§4): progresso real de alvo enquanto o
      // plano continua ABERTO — chave muda a cada alvo real adicional
      // provado, nunca na abertura do plano (targetsHit começa em 0 nesse
      // instante, então a chave é idêntica à anterior e o consumidor não
      // dispara nada).
      tradePlanTargetProgressKey: trackRecordSlice.active
        ? `${trackRecordSlice.active.plan.direction}:${trackRecordSlice.active.openedAt}:${trackRecordSlice.active.targetsHit}`
        : null,
      tradePlanTargetsHit: trackRecordSlice.active?.targetsHit ?? 0,
      inEntryZone: inEntryZoneNow,
      convictionVerdict: convictionReading.status === 'OK' ? convictionReading.verdict : null,
    }),
    [trackRecordSlice, lastResolvedPlan, inEntryZoneNow, convictionReading],
  );

  const voiceSnapshot = useMemo<TerminalSnapshot>(
    () => ({
      direction: engine.direction,
      confidence: engine.confidence,
      marketStructure: engine.marketStructure,
      entry: engine.entry,
      target: engine.target,
      stop: engine.stop,
      support: engine.support,
      resistance: engine.resistance,
      rationale: realCycle?.ok ? (realCycle.rationale ?? null) : null,
      engineStatus,
      engineReason: realCycle?.reason ?? null,
      lorentzianOk: realCycle?.lorentzian?.ok === true,
      lorentzianClassification: realCycle?.lorentzian?.classification ?? null,
      lorentzianConfidence: realCycle?.lorentzian?.confidence ?? null,
      lorentzianSampleSize: realCycle?.lorentzian?.sampleSize ?? null,
      lastPrice: priceData?.price ?? null,
      cvd,
      recentOrderflowTypes: orderflowSignals.slice(0, 10).map((s) => s.type),
      orderflowState,
      recentLiquidationCount: liquidations.length,
      liquidationState,
      wsLive,
      forecast: realCycle?.ok && realCycle.forecast ? realCycle.forecast : [],
      structureBreakKey: bosChoch.break ? `${bosChoch.break.type}:${bosChoch.break.index}` : null,
      structureBreakType: bosChoch.break?.type ?? null,
      structureBreakDirection: bosChoch.break?.direction ?? null,
      ...auraVoiceInputs,
    }),
    [engine, realCycle, engineStatus, priceData, cvd, orderflowSignals, orderflowState, liquidations, liquidationState, wsLive, bosChoch, auraVoiceInputs],
  );

  // Alertas executivos falados: computeAlerts é pura e só reage a TRANSIÇÕES
  // reais (prev vs next) — nunca repete o mesmo estado. Fila do voice-engine
  // é assíncrona por natureza: nada aqui bloqueia render/WS/WebGPU.
  //
  // DCI Focus Layer (item 8): a MESMA lista de alertas dirige o pulso visual
  // — nenhuma segunda detecção de transição é criada. Um alerta de prioridade
  // CRITICAL/ALERT (vetor confirmado/invalidado, motor caiu, liquidação nova,
  // divergência, absorção) acende `criticalPulse` por ~2.5s: a barra de
  // comando ganha um anel de brilho e a coluna de decisão um halo. O antigo
  // opacity-40 no resto da tela foi removido — em screenshot real do iPad a
  // tela inteira parecia "apagada" com só a barra viva (feedback direto do
  // operador); destaque agora é só aditivo, nunca subtrativo.
  const [criticalPulse, setCriticalPulse] = useState(false);
  const prevVoiceSnapshotRef = useRef<TerminalSnapshot | null>(null);
  useEffect(() => {
    const alerts = computeAlerts(prevVoiceSnapshotRef.current, voiceSnapshot);
    alerts.forEach((a) => voiceEngine.speak(a.text, a.priority));
    // Ordem "Ciborgue Vivo" §3: mesma detecção de transição já usada pelos
    // alertas acima (prev.structureBreakKey !== next.structureBreakKey =
    // rompimento REAL novo, não o mesmo evento ainda vivo na tela). Só
    // alimenta a memória afetiva quando o Core Engine tem uma posição
    // direcional ativa (LONG/SHORT) — sem posição, o rompimento é
    // informação neutra de mercado, não experiência do organismo (ver
    // header de affective-memory.ts).
    const prevSnapshot = prevVoiceSnapshotRef.current;
    if (
      voiceSnapshot.structureBreakKey &&
      voiceSnapshot.structureBreakKey !== prevSnapshot?.structureBreakKey &&
      voiceSnapshot.direction
    ) {
      const confirms = voiceSnapshot.structureBreakDirection === (voiceSnapshot.direction === "LONG" ? "ALTA" : "BAIXA");
      useUnifiedSnapshotStore.getState().recordAffectiveEvent(
        confirms ? "STRUCTURE_BREAK_CONFIRMS_SIGNAL" : "STRUCTURE_BREAK_CONTRADICTS_SIGNAL",
      );
    }
    prevVoiceSnapshotRef.current = voiceSnapshot;
    if (alerts.some((a) => a.priority === "CRITICAL" || a.priority === "ALERT")) {
      setCriticalPulse(true);
      const t = setTimeout(() => setCriticalPulse(false), 2500);
      return () => clearTimeout(t);
    }
  }, [voiceSnapshot]);

  useEffect(() => {
    voiceEngine.init();
  }, []);

  // V-MAX Fase 2 (armadilhas institucionais): corroboração de eventos
  // REAIS — sweeps consumados (flag swept do motor SMC) + sinais reais de
  // ABSORPTION/EXHAUSTION na janela. Lista vazia = estado honesto comum.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setTrapSignals(
      detectInstitutionalTraps({
        liquidityZones: smcZones.liquidityZones,
        orderflowSignals,
        now: Date.now(),
      }),
    );
  }, [smcZones, orderflowSignals]);

  // V-MAX Fase 1 item 5: eventos afetivos REAIS — só TRANSIÇÕES
  // verdadeiras de estado operacional viram evento (refs guardam o estado
  // anterior; um render sem mudança nunca ingere nada). A memória decai
  // na própria ingestão (lazy, ver nexus/affective-memory.ts) — zero
  // trabalho periódico na main thread.
  const prevEngineStatusRef = useRef(engineStatus);
  useEffect(() => {
    const prev = prevEngineStatusRef.current;
    prevEngineStatusRef.current = engineStatus;
    if (prev !== "error" && engineStatus === "error") {
      useUnifiedSnapshotStore.getState().recordAffectiveEvent("ENGINE_CYCLE_ERROR");
    }
  }, [engineStatus]);
  const prevLastUpdateRef = useRef(lastUpdateAt);
  useEffect(() => {
    const prev = prevLastUpdateRef.current;
    prevLastUpdateRef.current = lastUpdateAt;
    // lastUpdateAt só muda quando um ciclo real completa — cada ciclo ok é
    // um reward real (o organismo percebeu o mercado com sucesso).
    if (lastUpdateAt !== null && lastUpdateAt !== prev && engineStatus === "ok") {
      useUnifiedSnapshotStore.getState().recordAffectiveEvent("ENGINE_CYCLE_OK");
    }
  }, [lastUpdateAt, engineStatus]);
  const prevWsLiveRef = useRef(wsLive);
  useEffect(() => {
    const prev = prevWsLiveRef.current;
    prevWsLiveRef.current = wsLive;
    if (prev === wsLive) return;
    useUnifiedSnapshotStore.getState().recordAffectiveEvent(wsLive ? "FEED_WS_UP" : "FEED_WS_DOWN");
  }, [wsLive]);
  const prevDataFreshRef = useRef(councilDataFresh);
  useEffect(() => {
    const prev = prevDataFreshRef.current;
    prevDataFreshRef.current = councilDataFresh;
    if (prev === councilDataFresh) return;
    useUnifiedSnapshotStore.getState().recordAffectiveEvent(councilDataFresh ? "DATA_FRESH_AGAIN" : "DATA_STALE");
  }, [councilDataFresh]);
  const prevOrderflowStateRef = useRef(orderflowState);
  useEffect(() => {
    const prev = prevOrderflowStateRef.current;
    prevOrderflowStateRef.current = orderflowState;
    if (prev !== "ERROR" && orderflowState === "ERROR") {
      useUnifiedSnapshotStore.getState().recordAffectiveEvent("ORDERFLOW_FEED_ERROR");
    }
  }, [orderflowState]);

  // V-MAX Fase 2 (TrustScoreEngine): amostras 100% reais —
  //   gaps  = intervalos reais entre chegadas de preço (priceUpdatedAt é o
  //           carimbo real de cada atualização; o ring guarda os últimos 60
  //           deltas, ~zero custo);
  //   bps   = divergências reais Binance×Bybit/OKX quando os cross-checks
  //           estão ok (|Δ%|×100).
  // Cômputo no WASM do quant-worker (Main Thread sagrada), cadência de 5s
  // (mesma janela de legibilidade do Volume Profile), FAIL_CLOSED null.
  const priceGapsRef = useRef<number[]>([]);
  const prevPriceUpdatedAtRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevPriceUpdatedAtRef.current;
    prevPriceUpdatedAtRef.current = priceUpdatedAt ?? null;
    if (typeof priceUpdatedAt === "number" && typeof prev === "number" && priceUpdatedAt > prev) {
      const ring = priceGapsRef.current;
      ring.push(priceUpdatedAt - prev);
      if (ring.length > 60) ring.splice(0, ring.length - 60);
    }
  }, [priceUpdatedAt]);
  const trustLastComputeRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - trustLastComputeRef.current < 5_000) return;
    if (priceGapsRef.current.length < 2) return;
    trustLastComputeRef.current = now;
    const divergences: number[] = [];
    if (crossExchangeCheck.ok && typeof crossExchangeCheck.priceDeltaPct === "number") {
      divergences.push(Math.abs(crossExchangeCheck.priceDeltaPct) * 100);
    }
    if (okxCrossExchangeCheck.ok && typeof okxCrossExchangeCheck.priceDeltaPct === "number") {
      divergences.push(Math.abs(okxCrossExchangeCheck.priceDeltaPct) * 100);
    }
    if (mexcCrossExchangeCheck.ok && typeof mexcCrossExchangeCheck.priceDeltaPct === "number") {
      divergences.push(Math.abs(mexcCrossExchangeCheck.priceDeltaPct) * 100);
    }
    let stale = false;
    (async () => {
      const score = await computeRealTrustScore([...priceGapsRef.current], divergences);
      if (!stale) useUnifiedSnapshotStore.getState().setTrustScore(score);
    })();
    return () => { stale = true; };
  }, [priceUpdatedAt, crossExchangeCheck, okxCrossExchangeCheck, mexcCrossExchangeCheck]);

  // V18 Sprint 1 (Tarefa A): espelha o dado real já coletado por App.tsx
  // para dentro da UnifiedGlobalSnapshot store (Zustand+Immer) — nenhuma
  // rede nova disparada aqui, só sincronização. Cada efeito só escreve
  // quando a fatia real correspondente muda, então um consumidor via
  // seletor atômico (usePriceSnapshot, useCoreSnapshot, ...) só
  // re-renderiza quando aquela fatia específica de fato mudou.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setSymbol(selectedAsset);
  }, [selectedAsset]);
  // Achado real de auditoria (DIRETRIZES AVANÇADAS, sincronização — bug
  // HIGH confirmado): o guard `if (priceData)` parecia um null-check
  // inofensivo, mas SUPRIMIA o próprio reset — ao trocar de ativo,
  // priceData volta a null (efeito acima, [selectedAsset]) para limpar a
  // tela, mas esta linha silenciosamente PULAVA a escrita em vez de
  // repassar o reset, deixando store.price com o ÚLTIMO PREÇO REAL DO
  // ATIVO ANTERIOR até o WS do novo ativo reconectar (até a próxima
  // virada de rede, não de render). Efeito visível real: o painel de
  // Derivativos mostrava o preço do ativo velho junto do rótulo do ativo
  // novo, e o gráfico (livePrice = usePriceSnapshot()) estendia a vela
  // mais recente do ativo novo com o preço do ativo velho
  // (patchLastCandleWithLiveTick não valida magnitude/símbolo — um pavio
  // falso persistia até o próximo resync REST). orderBook/derivatives
  // logo abaixo nunca tiveram este bug: seus valores de reset já são
  // objetos verdadeiros ({bids:[],asks:[]}/{fundingRate:null,...}), então
  // sempre passavam pelo guard `if`. price não tinha um guard — agora
  // sempre repassa o estado real (reset incluso), igual aos vizinhos.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setPrice(priceData ?? EMPTY_PRICE);
  }, [priceData]);
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setOrderBook(orderBook);
  }, [orderBook]);
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setDerivatives(derivatives);
  }, [derivatives]);
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setCore({
      engineStatus,
      direction: engine?.direction ?? null,
      confidence: engine?.confidence ?? null,
      lastUpdateAt,
      cycleLatencyMs,
    });
  }, [engineStatus, engine, lastUpdateAt, cycleLatencyMs]);
  // V-MAX Fase 0.8: Health Monitor real — puramente aditivo (só mede e
  // escreve na store, nunca troca nem atrasa nenhum caminho de dado real
  // já existente), então liga direto aqui, diferente do CrossExchangeService
  // (Fase 0.5, deliberadamente ainda dormente — ver relatório da Fase 0).
  // start()/stop() do HealthMonitor já são idempotentes por conta própria,
  // então isto sobrevive ao mount→unmount→remount do React StrictMode em
  // dev sem depender do array de hooks do NexusCore (getNexusCore() aqui
  // só fornece o Event Bus tipado compartilhado, mesmo singleton de
  // sempre).
  // Local-First instant paint: while the first REST answer is in flight,
  // show the last REAL candles persisted for this symbol/timeframe (a
  // previous session's genuine data — the freshness telemetry already
  // reports age honestly). The functional setState guard means a faster
  // network answer always wins; rows without a real volume field (older
  // format) are discarded, never defaulted (fail-closed, zero mocks).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persisted = await loadCandles(selectedAsset, chartTimeframeRef.current as Timeframe).catch(() => null);
      if (cancelled || !persisted || persisted.length === 0) return;
      if (!persisted.every((c: any) => Number.isFinite(c.volume))) return;
      setChartData((prev) => (prev.length > 0 ? prev : (persisted as typeof prev)));
    })();
    return () => { cancelled = true; };
  }, [bootGeneration, selectedAsset]);

  useEffect(() => {
    const core = getNexusCore();
    core.start();
    // Ordem "Próxima Evolução do Organismo": o orquestrador liga ANTES do
    // Health Monitor — assim a primeira escrita real de qualquer motor já
    // encontra o tradutor escrita→evento vivo. start()/stop() idempotentes,
    // mesmo padrão StrictMode-safe do monitor.
    const orchestrator = getOrganismOrchestrator(core.bus);
    orchestrator.start();
    const monitor = getHealthMonitor(core.bus);
    monitor.start();
    return () => {
      monitor.stop();
      orchestrator.stop();
    };
  }, []);
  // v16.0 DEFINITIVO §9 ("Sistema de Sobrevivência"): assina o mesmo bus do
  // orquestrador acima para o único evento com publicador real hoje
  // (ORGANISM.TRACK_RECORD.UPDATED — "uma transição real, um evento",
  // organism-orchestrator.ts). chartIntegrity/organismHealth ainda são
  // computados por render dentro do SystemHealthWidget, sem fatia própria
  // na store nem publicador no bus — alertar sobre eles fica para quando
  // ganharem um (ver Próximos passos), nunca uma segunda medição aqui.
  // O watermark começa no ÚLTIMO registro já persistido (nunca `null` cru)
  // para que histórico reidratado de uma sessão anterior nunca dispare um
  // alerta fantasma no boot.
  const lastTrackRecordEntryRef = useRef<TrackedPlan | null>(
    useUnifiedSnapshotStore.getState().trackRecord.history.at(-1) ?? null,
  );
  useEffect(() => {
    const core = getNexusCore();
    return core.bus.on("ORGANISM.TRACK_RECORD.UPDATED", ({ record }) => {
      const alert = deriveTrackRecordAlert(lastTrackRecordEntryRef.current, record);
      lastTrackRecordEntryRef.current = record.history.at(-1) ?? lastTrackRecordEntryRef.current;
      if (!alert) return;
      // §9.2: máximo 5 toasts simultâneos, auto-dismiss em 5s.
      setAlerts((prev) => [...prev, alert].slice(-5));
      setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id)), 5000);
    });
  }, []);
  // Achado da AUDITORIA TÉCNICA COMPLETA (Seção F): Liquidity Sweep já
  // tinha publicador real (BRAIN.TRAPS.UPDATED, mesma fatia trapSignals que
  // CouncilWidget/canvas já leem) mas nunca alertava — só era desenhado.
  // Watermark seeded com os sweeps JÁ presentes no boot (mesmo cuidado do
  // Track Record acima: histórico reidratado nunca dispara alerta
  // fantasma) — sweepIdentity é a identidade REAL e estável (candle+preço
  // do nível varrido), nunca `trap.at` (recarimbado a cada recomputo).
  const seenSweepIdsRef = useRef<Set<string>>(
    new Set(
      useUnifiedSnapshotStore.getState().trapSignals.flatMap((t) =>
        t.kind === "STOP_HUNT_TOPO" || t.kind === "STOP_HUNT_FUNDO" ? t.sweptLevels.map(sweepIdentity) : [],
      ),
    ),
  );
  useEffect(() => {
    const core = getNexusCore();
    return core.bus.on("BRAIN.TRAPS.UPDATED", ({ traps }) => {
      const alert = deriveSweepAlert(seenSweepIdsRef.current, traps);
      if (!alert) return;
      setAlerts((prev) => [...prev, alert].slice(-5));
      setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id)), 5000);
      // Achado da auditoria de evolução: a voz já existe e já narra
      // eventos institucionais parecidos (liquidação, absorção — ambos
      // ALERT em voice-dispatcher.ts), mas nunca lia daqui — o Sweep era
      // só toast. `speech` é a sentença natural do MESMO evento (nunca
      // title/message, pontuados pra leitura visual). ALERT (não INFO):
      // mesma prioridade que voice-dispatcher.ts já usa pra liquidação/
      // absorção, o precedente mais próximo de "evento institucional real
      // que vale interromper a fila de voz".
      if (alert.speech) voiceEngine.speak(alert.speech, "ALERT");
    });
  }, []);
  // V-MAX Fase 0.4: mesmo princípio de espelhamento acima, para as novas
  // fatias do UnifiedGlobalSnapshot (Blueprint §2.3) — nenhuma delas dispara
  // rede nova, todas espelham dado que os efeitos de WS/REST já reais logo
  // acima (linha ~600) coletam.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setActiveTimeframe(chartTimeframe as Timeframe);
  }, [chartTimeframe]);
  useEffect(() => {
    if (chartData && chartData.length > 0) {
      useUnifiedSnapshotStore.getState().setCandles(selectedAsset, chartTimeframe as Timeframe, chartData);
    }
  }, [chartData, selectedAsset, chartTimeframe]);
  useEffect(() => {
    // orderBookUpdatedAt (não orderBook.updatedAt, que só existe DEPOIS de
    // passar pela store) é o sinal real de "já chegou um livro de verdade"
    // — antes do primeiro update real, fica honestamente null (nunca um
    // L2Snapshot fabricado com bids/asks vazios fingindo ser um livro real).
    useUnifiedSnapshotStore.getState().setExchangeOrderBook(
      "BINANCE",
      orderBookUpdatedAt ? { bids: orderBook.bids, asks: orderBook.asks, updatedAt: orderBookUpdatedAt } : null,
    );
    // V-MAX Fase 1.1: MESMO evento real acima também vira uma amostra no
    // histórico L2 (pré-requisito do OrderFlowHeatmapPlugin) — nunca uma
    // segunda assinatura de WS, só um segundo consumidor do mesmo dado
    // real já throttled a 200ms. sampleL2History decide sozinho (função
    // pura em l2-history.ts) se já passou tempo suficiente para reter.
    if (orderBookUpdatedAt) {
      useUnifiedSnapshotStore.getState().sampleL2History("BINANCE", {
        time: orderBookUpdatedAt,
        bids: orderBook.bids,
        asks: orderBook.asks,
      });
    }
  }, [orderBook, orderBookUpdatedAt]);
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setConnectionState("BINANCE", wsLive ? "LIVE" : "OFFLINE");
  }, [wsLive]);
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setConnectionState("BYBIT", crossExchangeCheck.ok ? "LIVE" : "DEGRADED");
  }, [crossExchangeCheck]);
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setConnectionState("OKX", okxCrossExchangeCheck.ok ? "LIVE" : "DEGRADED");
  }, [okxCrossExchangeCheck]);
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setConnectionState("MEXC", mexcCrossExchangeCheck.ok ? "LIVE" : "DEGRADED");
  }, [mexcCrossExchangeCheck]);
  // V-MAX Fase 1.2 (achado real durante a auditoria para o
  // OrderFlowHeatmapPlugin): `fps` acima (Fase J, "FPS REAL da UI") é a
  // ÚNICA medição real de frame rate desta árvore — o Health Monitor
  // (Fase 0.8) foi corrigido para espelhar isto em vez de amostrar de
  // novo por conta própria (zero repetição).
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setUiFps(fps);
  }, [fps]);

  // Stable reference — prevents every context consumer (TopBar, all Widgets,
  // AssistantOrb, MarketDirectionWidget...) from re-rendering on renders
  // that don't actually change any of these values.
  const contextValue = useMemo(
    () => ({
      widgets,
      toggleWidget,
      reversalAlert,
      setWidgetWorkspaceState,
      workspaceManagerOpen,
      setWorkspaceManagerOpen,
      chartLayersOpen,
      setChartLayersOpen,
      radarPanelOpen,
      setRadarPanelOpen,
      marketAnalysisOpen,
      setMarketAnalysisOpen,
      paperTradingOpen,
      setPaperTradingOpen,
      chartLayerVisibility,
      toggleChartLayer,
      applyChartLayerPreset,
      chartLayerAutoMode,
      resetChartLayerToAuto,
      emaPeriod,
      setEmaPeriod,
      leftDrawerOpen,
      toggleLeftDrawer,
      rightDrawerOpen,
      toggleRightDrawer,
      propertiesDrawerOpen,
      togglePropertiesDrawer,
      chartTimeframe,
      setChartTimeframe,
      engine,
      smcZones,
      tradePlanStructureZones,
      bosChoch,
      liquidityVoids,
      bootAt,
      engineStatus,
      realCycle,
      orderflowSignals,
      orderflowState,
      orderflowReason,
      cvd,
      liquidations,
      liquidationState,
      bootRestFailed,
      handleManualRestart,
      voiceSnapshot,
      lastUpdateAt,
      criticalPulse,
      selectedAsset,
      setSelectedAsset,
      marketMode,
      setMarketMode,
      selectedTradFiAsset,
      setSelectedTradFiAsset,
      scannerData,
      gmilProviders,
      gmilBiases,
      institutionalConsensus,
      ensembleConsensus,
      convictionReading,
      institutionalScore,
      expectancyFilter,
      calibrationResult,
      decisionDistance,
      confidenceZone,
      orderflowTrend,
      convictionTrend,
      assistantMessages,
      heatReading,
      nexusDecision,
      vwapCtx,
      nlState,
      nexusConfluence,
      displayConflicts,
      etaReading,
      riskSuggestion,
      cycleLatencyMs,
      fps,
      priceUpdatedAt,
      orderBookUpdatedAt,
      crossExchangeCheck,
      okxCrossExchangeCheck,
      mexcCrossExchangeCheck,
      currentRsi,
      currentMacd,
    }),
    [widgets, toggleWidget, reversalAlert,
      setWidgetWorkspaceState,
      workspaceManagerOpen,
      chartLayersOpen,
      radarPanelOpen,
      marketAnalysisOpen,
      paperTradingOpen,
      chartLayerVisibility,
      chartLayerAutoMode,
      emaPeriod,
      leftDrawerOpen,
      toggleLeftDrawer,
      rightDrawerOpen,
      toggleRightDrawer,
      propertiesDrawerOpen,
      togglePropertiesDrawer,
      chartTimeframe,
      engine,
      smcZones,
      tradePlanStructureZones,
      bosChoch,
      liquidityVoids,
      bootAt,
      engineStatus,
      realCycle,
      orderflowSignals,
      orderflowState,
      orderflowReason,
      cvd,
      liquidations,
      liquidationState,
      bootRestFailed,
      handleManualRestart,
      voiceSnapshot,
      lastUpdateAt,
      criticalPulse,
      selectedAsset,
      marketMode,
      selectedTradFiAsset,
      scannerData,
      gmilProviders,
      gmilBiases,
      institutionalConsensus,
      ensembleConsensus,
      convictionReading,
      institutionalScore,
      expectancyFilter,
      calibrationResult,
      decisionDistance,
      confidenceZone,
      orderflowTrend,
      convictionTrend,
      assistantMessages,
      heatReading,
      nexusDecision,
      vwapCtx,
      nlState,
      nexusConfluence,
      displayConflicts,
      etaReading,
      riskSuggestion,
      cycleLatencyMs,
      fps,
      priceUpdatedAt,
      orderBookUpdatedAt,
      crossExchangeCheck,
      okxCrossExchangeCheck,
      mexcCrossExchangeCheck,
      currentRsi,
      currentMacd,
    ],
  );

  return (
    <WidgetContext.Provider value={contextValue}>
      {/* pt-safe/pb-safe: em PWA standalone no iPad (viewport-fit=cover) a
          status bar translúcida pinta por cima do topo e o home indicator
          invadiria o rodapé — confirmado em screenshot real do dispositivo
          (barra de comando cortada em pé e deitado). Em navegador comum
          env() é 0 e nada muda. */}
      <div className="flex flex-col h-[100dvh] pt-safe pb-safe bg-[#020610] text-[#a0f0ff] font-mono overflow-hidden selection:bg-[#00f0ff30]">
        <TopBar data={priceData} />
        {bootRestFailed && (
          <div className="shrink-0 bg-[#ff005515] border-b border-[#ff005550] px-4 py-2 flex items-center justify-between gap-3">
            <span className="text-[0.55rem] sm:text-[0.6rem] tracking-[0.15em] text-[#ff0055] font-bold uppercase">
              Falha ao conectar aos feeds reais (Binance) após 3 tentativas — verifique a rede.
            </span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 px-3 py-1.5 rounded border border-[#ff0055] bg-[#ff005520] text-[#ff0055] font-black tracking-[0.15em] text-[0.55rem] uppercase active:bg-[#ff005535]"
            >
              RESTART SYSTEM
            </button>
          </div>
        )}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <SideBar activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="flex flex-col flex-1 p-2 gap-2 min-h-0 overflow-hidden relative">
            {activeTab === "DASHBOARD" ? (
              <>
                {/* DCI Essential Strip (item 1) agora vive DENTRO da barra de
                    comando unificada (TopBar) — uma barra só com toda a
                    informação de decisão, visível em todas as abas, zero
                    repetição de preço/símbolo/feed pelo resto da tela. */}

                {/* V16.1 correção crítica (Protocolo TradingView e Gavetas
                    Ocultas): o Operador rejeitou a V16 original — 3
                    colunas sempre visíveis espremiam o Gráfico. Esquerda
                    "Market Intelligence" e direita "Core Intelligence"
                    agora são GAVETAS fechadas por padrão
                    (leftDrawerOpen/rightDrawerOpen, false no boot),
                    sobrepostas (.terminal-left/.terminal-right,
                    position:absolute em index.css) ao Gráfico — nunca
                    dividem espaço de flexbox com ele, então o
                    Institutional Chart Engine ocupa ~100% da largura por
                    padrão, em qualquer viewport. Dois botões discretos
                    nas bordas (PanelLeft/PanelRight) abrem/fecham cada
                    gaveta; clicar no backdrop translúcido também fecha —
                    devolvendo o espaço total ao gráfico imediatamente
                    (position:absolute é excluído do algoritmo de flex do
                    pai, então fechar a gaveta nunca precisa de reflow).
                    Só os módulos VERDADEIRAMENTE secundários (Order Book/
                    Order Flow/Heatmap de liquidez/Scanner/Exposição/
                    Eventos/Núcleo Neural/Heatmap de ativos) vivem, à
                    parte, no Workspace Manager (Pinned/Docked/Collapsed/
                    Hidden/Floating — ver WorkspaceManagerPanel). */}
                {/* Lapidação Visual (DIRETRIZ 1 — "o gráfico é o
                    protagonista: maximizar a área útil"): medição real com
                    Playwright mostrou o painel do gráfico recuado 68px de
                    cada lado num viewport de 1180 — 56px são as réguas de
                    navegação (funcionais, ficam), mas os 12px restantes eram
                    DOIS acolchoamentos aninhados fazendo o mesmo trabalho: o
                    `p-2` do container-coluna logo acima E este `p-1`. O
                    externo já dá o respiro entre cabeçalho/grade/rodapé;
                    este só duplicava o recuo. Removido — a moldura e o
                    espaçamento entre painéis (`gap-2`) continuam intactos,
                    o gráfico só deixa de pagar a margem duas vezes. */}
                <div className="terminal-grid flex-1 min-h-0 overflow-y-auto min-[1120px]:overflow-hidden scrollbar-hide">
                  <div className="terminal-row min-h-0">
                    {/* MAIN — o Gráfico é o coração da operação; sozinho em
                        .terminal-main, sem colunas fixas disputando
                        espaço, o Institutional Chart Engine domina quase
                        100% da área visual por padrão. */}
                    <div className="terminal-main min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-2">
                      {widgets.chart.visible &&
                        (marketMode === "TRADFI" ? (
                          resolvedTradFiInstrument ? (
                            // Ordem Market Data Fabric, Fase 1: candle REAL
                            // (delayed, Yahoo) — só para os 9 ativos legados
                            // com mapeamento seguro (ver instrument-registry.js).
                            // chartTimeframe reaproveitado (mesmo seletor de
                            // timeframe que o modo cripto já usa).
                            <TradFiRealChart instrument={resolvedTradFiInstrument} timeframe={chartTimeframe} />
                          ) : (
                            <TradFiEmptyState
                              assetLabel={`${selectedTradFiAsset?.symbol ?? ""} · ${selectedTradFiAsset?.name ?? ""}`}
                            />
                          )
                        ) : (
                          <ChartWidget chartData={chartData} onRequestOlderCandles={handleRequestOlderCandles} priceData={priceData} />
                        ))}
                    </div>

                    {/* Backdrop — clicar fora de qualquer gaveta aberta a
                        fecha; um único elemento cobre a área do cockpit
                        (nunca a TopBar/FooterBar) para as duas gavetas. */}
                    <div
                      className={`terminal-drawer-backdrop ${leftDrawerOpen || rightDrawerOpen || propertiesDrawerOpen ? "drawer-open" : ""}`}
                      onClick={() => {
                        setLeftDrawerOpen(false);
                        setRightDrawerOpen(false);
                        setPropertiesDrawerOpen(false);
                      }}
                    />

                    {/* Fase M.1 (Navigation Rail + Overlay Drawers): as
                        antigas alças soltas na borda do gráfico saíram —
                        cada régua de navegação (SideBar à esquerda,
                        RightRail à direita) já tem seu próprio ícone
                        dedicado (PanelLeft/PanelRight) que abre a gaveta
                        correspondente, um único mecanismo de acesso em
                        vez de dois. A própria gaveta mantém seu X no
                        cabeçalho + fecha ao clicar fora/ESC. */}

                    {/* LEFT (gaveta) — Market Intelligence: Vetor de
                        Mercado (livro real) + Bias/Convicção/Zonas/Gestão
                        de Risco. */}
                    <div
                      className={`terminal-left flex flex-col gap-2 ${leftDrawerOpen ? "drawer-open" : ""}`}
                    >
                      <div className="flex items-center justify-between shrink-0 pb-1 border-b border-[#00f0ff15]">
                        <span className="text-[0.5rem] font-bold tracking-[0.2em] uppercase text-[#00f0ff]">
                          Market Intelligence
                        </span>
                        <div
                          className="text-[#8ab4f8]/50 hover:text-[#ff0055] px-1 py-0.5 rounded cursor-pointer"
                          onClick={() => setLeftDrawerOpen(false)}
                        >
                          <X size={12} />
                        </div>
                      </div>
                      {marketMode === "TRADFI" ? (
                        <TradFiEmptyState compact assetLabel="MARKET INTELLIGENCE" />
                      ) : (
                        <>
                          <MarketDirectionWidget />
                          <MarketBiasDecisionCard />
                        </>
                      )}
                    </div>

                    {/* RIGHT (gaveta) — Core Intelligence: Siriform Core
                        (resumo compacto, detalhe completo sob demanda na
                        strip abaixo) + GMIL + Regime + Comitê de
                        Consenso/Risk Engine/Data Quality
                        (DecisionValidationWidget já cobre os 3) + Saúde
                        do Sistema. */}
                    <div
                      className={`terminal-right flex flex-col gap-2 ${rightDrawerOpen ? "drawer-open" : ""}`}
                    >
                      <div className="flex items-center justify-between shrink-0 pb-1 border-b border-[#00f0ff15]">
                        <span className="text-[0.5rem] font-bold tracking-[0.2em] uppercase text-[#00f0ff]">
                          Core Intelligence
                        </span>
                        <div
                          className="text-[#8ab4f8]/50 hover:text-[#ff0055] px-1 py-0.5 rounded cursor-pointer"
                          onClick={() => setRightDrawerOpen(false)}
                        >
                          <X size={12} />
                        </div>
                      </div>
                      {/* Fusão visual: sequência reorganizada para bater com
                          a ordem da imagem de referência — Siriform → GMIL
                          → Regime/Consenso/Risk Engine → Saúde do Sistema
                          (antes GMIL vinha por último). GmilContextWidget
                          continua FORA de qualquer ternário de marketMode —
                          é contexto macro global, sempre real
                          independente do ativo selecionado (mesmo
                          comportamento de sempre, só a posição mudou). */}
                      {marketMode !== "TRADFI" && <NarrativeSummaryCard />}
                      {marketMode === "TRADFI" ? (
                        <TradFiEmptyState compact assetLabel="SIRIFORM CORE" />
                      ) : (
                        widgets.se_core.visible && <SiriformCoreCard />
                      )}
                      {/* v16.0 PRO Fase 1: destino real dos itens que saíram
                          da TopBar (Score/Heat/VWAP/Kill Zone) — mesmo
                          gate CRYPTO-only da origem (institutional-score.ts,
                          heat-score.ts, vwap-bands.ts e kill-zones.ts não
                          têm leitura real em modo TRADFI). */}
                      {marketMode === "TRADFI" ? (
                        <TradFiEmptyState compact assetLabel="SCORE & CONTEXTO" />
                      ) : (
                        <ScoreContextCard />
                      )}
                      {/* Entrega 42: mesmo gate CRYPTO-only de ScoreContextCard
                          acima — Track Record/expectancy não têm leitura real
                          em modo TRADFI (Core Engine só emite LONG/SHORT/WAIT
                          para cripto nesta base). */}
                      {marketMode === "TRADFI" ? (
                        <TradFiEmptyState compact assetLabel="MOTOR DE LUCRATIVIDADE" />
                      ) : (
                        <ExpectancyCard />
                      )}
                      <GmilContextWidget />
                      {marketMode === "TRADFI" ? (
                        <TradFiEmptyState compact assetLabel="REGIME · COMITÊ DE DECISÃO" />
                      ) : (
                        (widgets.market_regime.visible || widgets.decision_validation.visible) && (
                          <>
                            <MarketRegimeWidget />
                            <DecisionValidationWidget />
                          </>
                        )
                      )}
                      {/* V-MAX Fase 1 (superfície visual): HUD do Conselho
                          Multi-Agente + CPI — dados reais da store (item 4/5),
                          logo abaixo do comitê de validação (mesma família de
                          leitura consultiva, LEI 24). Só em modo cripto: os
                          agentes leem feeds cripto reais. */}
                      {marketMode !== "TRADFI" && widgets.council?.visible && <CouncilWidget />}
                      <TelemetryHealthWidget />
                    </div>

                    {/* RIGHT (gaveta) — Properties: Layer Manager docado (o
                        MESMO conteúdo real de ChartLayersPanel, extraído
                        para ChartLayersPanelContent e reusado aqui byte-a-
                        byte — zero segunda implementação) + atalho para
                        Configurações. Ocupa o MESMO slot visual de
                        .terminal-right (right:0 em index.css) — nunca as
                        duas abertas ao mesmo tempo (mutual exclusion em
                        toggleLeftDrawer/toggleRightDrawer/
                        togglePropertiesDrawer acima). Risk/Alerts ficaram
                        FORA de propósito (pedido do Operador: "nada
                        repetido") — já têm aba própria e mais completa em
                        SecondaryModuleView (RISK: Position Sizing/Trust
                        Score/CPI/Track Record/Traps; ALERTS: Order Flow/
                        Liquidations/Traps); reduplicar aqui, mesmo que só
                        os 2 números de riskSuggestion, seria exatamente a
                        "camada duplicada" que este painel existe pra
                        eliminar. */}
                    <div
                      className={`terminal-properties flex flex-col gap-2 ${propertiesDrawerOpen ? "drawer-open" : ""}`}
                    >
                      <div className="flex items-center justify-between shrink-0 pb-1 border-b border-[#00f0ff15]">
                        <span className="text-[0.5rem] font-bold tracking-[0.2em] uppercase text-[#00f0ff]">
                          Properties
                        </span>
                        <div
                          className="text-[#8ab4f8]/50 hover:text-[#ff0055] px-1 py-0.5 rounded cursor-pointer"
                          onClick={() => setPropertiesDrawerOpen(false)}
                        >
                          <X size={12} />
                        </div>
                      </div>
                      <PropertiesPanelBody
                        onOpenSettings={() => {
                          setActiveTab("SETTINGS");
                          setPropertiesDrawerOpen(false);
                        }}
                      />
                    </div>
                  </div>

                  {/* STRIP — conteúdo sob demanda (Progressive Disclosure,
                      Workspace Manager §2): detalhe completo do Siriform
                      Core quando expandido (mesmo AssistantOrb rico de
                      sempre, intocado) e qualquer módulo secundário que o
                      operador tenha ancorado (Docked/Pinned/Collapsed) via
                      Workspace Manager. Fica com altura zero — sem espaço
                      morto — quando nada está expandido/ancorado. */}
                  {(!widgets.se_core.collapsed ||
                    widgets.orderbook.visible ||
                    widgets.orderflow.visible ||
                    widgets.heatmap.visible ||
                    widgets.scanner.visible ||
                    widgets.exposure.visible ||
                    widgets.events.visible ||
                    widgets.neural_core.visible ||
                    widgets.asset_heatmap.visible ||
                    widgets.multi_timeframe.visible) && (
                    <div className="terminal-strip shrink-0 flex flex-col gap-2 max-h-[46dvh] min-[1120px]:max-h-[38dvh] overflow-y-auto scrollbar-hide">
                      {!widgets.se_core.collapsed &&
                        (marketMode === "TRADFI" ? (
                          <TradFiEmptyState compact assetLabel="SIRIFORM CORE · DETALHE COMPLETO" />
                        ) : (
                          <AssistantOrb inCenter={true} />
                        ))}
                      {(widgets.orderbook.visible || widgets.orderflow.visible || widgets.heatmap.visible) && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide h-[200px] min-[1120px]:h-[168px] shrink-0">
                          {widgets.orderbook.visible && (
                            <div className="min-w-[260px] flex-1 flex flex-col">
                              {marketMode === "TRADFI" ? (
                                <TradFiEmptyState compact assetLabel="ORDER BOOK" />
                              ) : (
                                <OrderBookWidget data={priceData} book={orderBook} />
                              )}
                            </div>
                          )}
                          {widgets.orderflow.visible && (
                            <div className="min-w-[240px] flex-1 flex flex-col">
                              {marketMode === "TRADFI" ? (
                                <TradFiEmptyState compact assetLabel="ORDER FLOW" />
                              ) : (
                                <OrderFlowWidget />
                              )}
                            </div>
                          )}
                          {widgets.heatmap.visible && (
                            <div className="min-w-[240px] flex-1 flex flex-col">
                              {marketMode === "TRADFI" ? (
                                <TradFiEmptyState compact assetLabel="LIQUIDITY MAP" />
                              ) : (
                                <HeatmapWidget book={orderBook} data={priceData} />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {(widgets.scanner.visible ||
                        widgets.exposure.visible ||
                        widgets.events.visible ||
                        widgets.neural_core.visible ||
                        widgets.asset_heatmap.visible ||
                        widgets.multi_timeframe.visible) && (
                        <div className="flex flex-col gap-2">
                          {widgets.asset_heatmap.visible && <AssetHeatmapWidget />}
                          {widgets.multi_timeframe.visible && <MultiTimeframeMatrixWidget />}
                          {widgets.scanner.visible && <ScannerWidget data={scannerData} />}
                          {widgets.exposure.visible && <ExposureWidget />}
                          {widgets.events.visible && <EventsWidget />}
                          {widgets.neural_core.visible && <NeuralCoreWidget />}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <BottomPanels />
              </>
            ) : activeTab === "SETTINGS" ? (
              <ConfigPanel />
            ) : (
              <SecondaryModuleView tab={activeTab} />
            )}
          </div>
          <RightRail />
        </div>
        <FooterBar />
        <WorkspaceManagerPanel />
        <ChartLayersPanel />
        <RadarPanel />
        <MarketAnalysisPanel priceData={priceData} chartData={chartData} />
        <PaperTradingPanel priceData={priceData} />
        <AlertToastStack alerts={alerts} onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))} />
      </div>
    </WidgetContext.Provider>
  );
}

// --- CONFIGURATION PANEL ---
// Official module names — exactly the titles each widget renders on the
// dashboard, so SETTINGS and the cockpit never disagree about what a
// module is called (no raw internal keys like "se_core" shown to the user).
const WIDGET_LABELS: { [key: string]: string } = {
  // Auditoria de estabilização (P8): rótulo estava desatualizado desde a
  // V15.1 GOD TIER, que tornou o gráfico exclusivamente Futuros/Perpétuo
  // (engine-bridge.ts, sem fallback para Spot) — "SPOT" aqui contradizia
  // a própria fonte real usada (collectBinanceFuturesKlines). O título
  // exibido no próprio Widget do gráfico já deriva corretamente de
  // realCycle.instrumentType; só este rótulo do painel de Configuração
  // (nome "oficial" do módulo) estava com o texto antigo.
  chart: "CHART · BINANCE FUTURES",
  orderflow: "ORDER FLOW · REAL BOOK",
  heatmap: "LIQUIDITY MAP · REAL DEPTH",
  market_direction: "VETOR DE MERCADO",
  se_core: "NÚCLEO DE INTELIGÊNCIA S.E.",
  orderbook: "ORDER BOOK",
  scanner: "QUANT SCANNER · REAL 24H",
  exposure: "EXPOSURE · READ-ONLY",
  gmil_context: "GLOBAL CONTEXT · GMIL",
  events: "EVENT TELEMETRY",
  neural_core: "NÚCLEO NEURAL · LLAMA 3 (LOCAL) + SÍNTESE",
  tactical: "INSTITUTIONAL LIQUIDATIONS · REAL",
  market_regime: "MARKET REGIME",
  asset_heatmap: "HEATMAP · ASSETS",
  decision_validation: "VALIDAÇÃO MULTI-CAMADA",
  system_health: "SYSTEM HEALTH",
  council: "MULTI-AGENT COUNCIL",
  multi_timeframe: "MULTI-TIMEFRAME MATRIX",
};

function ConfigPanel() {
  const { widgets, toggleWidget } = useContext(WidgetContext);
  return (
    <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 max-w-4xl mx-auto w-full">
      <div className="text-2xl font-black text-[#00f0ff] drop-shadow-[0_0_10px_#00f0ff] tracking-[0.2em] mb-4">
        CONFIGURAÇÃO DO SISTEMA
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(widgets).map(([id, state]: [string, any]) => (
          <div
            key={id}
            className="cyber-panel p-4 flex flex-col gap-3 bg-[#010205]"
          >
            <span className="font-bold text-white tracking-widest uppercase">
              {WIDGET_LABELS[id] ?? id}
            </span>
            <div className="flex justify-between items-center bg-[#010308] p-2 rounded border border-[#00f0ff20]">
              <span className="text-xs text-[#8ab4f8]">VISIBILIDADE</span>
              <button
                onClick={() => toggleWidget(id, "visible")}
                className={`text-xs px-3 py-1 font-bold rounded ${state.visible ? "bg-[#00ffaa20] text-[#00ffaa] border border-[#00ffaa50]" : "bg-[#ff005520] text-[#ff0055] border border-[#ff005550]"}`}
              >
                {state.visible ? "VISÍVEL" : "OCULTO"}
              </button>
            </div>
            <div className="flex justify-between items-center bg-[#010308] p-2 rounded border border-[#00f0ff20]">
              <span className="text-xs text-[#8ab4f8]">MODO FLUTUANTE (REDIMENSIONÁVEL)</span>
              <button
                onClick={() => toggleWidget(id, "floating")}
                className={`text-xs px-3 py-1 font-bold rounded ${state.floating ? "bg-[#00f0ff20] text-[#00f0ff] border border-[#00f0ff50]" : "bg-transparent text-[#8ab4f8]/50 border border-[#8ab4f8]/30 hover:text-white"}`}
              >
                {state.floating ? "ATIVO" : "INATIVO"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- V16 WORKSPACE MANAGER (§2) — the single entry point (SideBar footer
// button) for the Pinned/Docked/Collapsed/Hidden/Floating states of every
// TRULY secondary module. Chart and the always-docked left/right V16
// columns (Market Direction/Decision, Siriform Core summary, GMIL, Market
// Regime, Decision Validation, System Health) are deliberately absent from
// this list — they're part of the fixed default view per the operator's
// spec, not optional tools. Reuses setWidgetWorkspaceState (App(), one
// setState per state jump) so picking "Floating" from "Hidden" flips both
// the visible AND floating flags atomically, never a stale in-between.
const WORKSPACE_MANAGER_MODULES: { id: string; label: string }[] = [
  { id: "orderbook", label: "ORDER BOOK" },
  { id: "orderflow", label: "FLUXO DE ORDENS" },
  { id: "heatmap", label: "LIQUIDITY MAP" },
  { id: "scanner", label: "QUANT SCANNER · 24H" },
  { id: "exposure", label: "EXPOSIÇÃO" },
  { id: "events", label: "EVENT TELEMETRY" },
  { id: "neural_core", label: "NÚCLEO NEURAL · LLAMA 3" },
  { id: "asset_heatmap", label: "HEATMAP · ASSETS" },
  { id: "tactical", label: "LIQUIDAÇÕES INSTITUCIONAIS" },
  { id: "multi_timeframe", label: "MULTI-TIMEFRAME MATRIX" },
];
// Única fonte de verdade para "este widget pode ser fechado": os painéis
// ALWAYS-docked (chart/gmil_context/market_regime/system_health/
// decision_validation/council, comentário da linha ~448) não têm entrada
// aqui de propósito — nunca eram pra ter botão de fechar, e como não há
// caminho de volta pelo Workspace Manager, fechar um deles era permanente
// (só localStorage manual recuperava). Widget() usa este mesmo Set para
// decidir se mostra o "X", então a lista nunca pode dessincronizar dela.
const WORKSPACE_MANAGER_MODULE_IDS = new Set(WORKSPACE_MANAGER_MODULES.map((m) => m.id));
const WORKSPACE_STATES = ["hidden", "docked", "collapsed", "pinned", "floating"] as const;
type WorkspaceState = (typeof WORKSPACE_STATES)[number];

function widgetWorkspaceState(st: { visible: boolean; floating: boolean; collapsed: boolean; pinned: boolean } | undefined): WorkspaceState {
  if (!st || !st.visible) return "hidden";
  if (st.floating) return "floating";
  if (st.collapsed) return "collapsed";
  if (st.pinned) return "pinned";
  return "docked";
}

function WorkspaceManagerPanel() {
  const { widgets, workspaceManagerOpen, setWorkspaceManagerOpen, setWidgetWorkspaceState } =
    useContext(WidgetContext) || {};
  if (!workspaceManagerOpen) return null;

  return (
    <div
      className="!fixed !inset-0 !z-[1001] bg-[#010308]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setWorkspaceManagerOpen?.(false)}
    >
      <div
        className="cyber-panel w-full max-w-2xl max-h-[80dvh] flex flex-col bg-[#010308]/98"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cyber-header flex items-center justify-between">
          <span className="font-bold tracking-[0.2em]">WORKSPACE MANAGER</span>
          <div
            className="text-[#8ab4f8]/50 hover:text-[#00f0ff] px-1 py-0.5 rounded cursor-pointer"
            onClick={() => setWorkspaceManagerOpen?.(false)}
          >
            <X size={14} />
          </div>
        </div>
        <div className="p-3 flex flex-col gap-2 overflow-y-auto scrollbar-hide">
          <span className="text-[0.5rem] text-[#8ab4f8]/70 tracking-[0.15em] uppercase">
            Módulos secundários — Progressive Disclosure: escondidos por padrão, disponíveis sob demanda
          </span>
          {WORKSPACE_MANAGER_MODULES.map(({ id, label }) => {
            const current = widgetWorkspaceState(widgets?.[id]);
            return (
              <div
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 bg-[#010205] border border-[#00f0ff15] rounded-lg px-3 py-2"
              >
                <span className="text-[0.55rem] font-bold tracking-widest text-white">{label}</span>
                <div className="flex gap-1 flex-wrap">
                  {WORKSPACE_STATES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setWidgetWorkspaceState?.(id, s)}
                      className={`flex items-center gap-0.5 text-[0.4rem] px-1.5 py-1 rounded border font-bold uppercase tracking-wider ${
                        current === s
                          ? "border-[#00f0ff] bg-[#00f0ff20] text-[#00f0ff]"
                          : "border-[#8ab4f8]/20 text-[#8ab4f8]/50 hover:text-[#8ab4f8]"
                      }`}
                    >
                      {s === "pinned" && <Pin size={9} />}
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- CAMADAS DO GRÁFICO (Finding M, FASE Ω Priority 3) — painel novo e
// aditivo, mesmo padrão exato do Workspace Manager acima (mesmo overlay
// modal, mesma lista de linhas com um controle por item), só que para os 6
// overlays do CANVAS do gráfico em vez dos widgets do layout. Toggle
// simples ligado/desligado (não 5 estados como o Workspace Manager — uma
// camada de canvas só faz sentido visível ou invisível, não "flutuante").
// Diretriz de Evolução Autônoma Integral §11 — as camadas do Modo
// Operacional: as que desenham o PLANO em si (entrada/stop/TPs, o
// corredor de convicção que reforça visualmente o mesmo plano) mais a
// direção de tendência mais lida "de relance" — prioridades visuais 1-6
// da diretriz (direção/entrada/invalidação/TP1-3). As outras 5 camadas
// (estrutura/contexto, prioridades 7-8: FVG/OB, BOS/CHOCH, heatmap,
// volume profile, trend channel) só aparecem no Modo Auditoria.
const CHART_LAYERS_OPERATIONAL_PRESET = new Set<ChartLayerId>(["trade_plan_zone", "neural_market_aura", "ema"]);
// Diretriz Suprema de Evolução Integrativa §8 ("Modo Inteligência"): o
// COMPLEMENTO do Operacional — todas as camadas de leitura
// estrutural/contexto (FVG/OB, BOS/CHOCH, heatmap de liquidez, volume
// profile, trend channel) mais EMA (mesma direção de tendência "de
// relance" que já ajuda o Operacional), SEM as duas camadas que só fazem
// sentido quando existe um plano ATIVO (trade_plan_zone/neural_market_
// aura) — análise profunda do mercado, não do plano em si.
// Auditoria de pendências: os 7 novos toggles (VWAP/Nexus Line/CVD/
// Fibonacci/Premium-Discount/harmônico/EQH-EQL) são TODOS leitura de
// mercado/estrutura — nenhum é específico do plano ativo — então entram
// aqui pela mesma lógica, nunca no Operacional (que fica deliberadamente
// enxuto).
const CHART_LAYERS_INTELLIGENCE_PRESET = new Set<ChartLayerId>([
  "liquidity_zones",
  "structure_breaks",
  "order_flow_heatmap",
  "volume_profile",
  "ema",
  "trend_channel",
  "vwap",
  "nexus_line",
  "cvd",
  "fibonacci",
  "premium_discount",
  "harmonics",
  "equal_highs_lows",
  // OMEGA CORE V-MAX Fase 8.1: mesma lógica — densidade de liquidações
  // reais é leitura de mercado/estrutura, nunca específica do plano
  // ativo, então entra aqui, nunca no Operacional.
  "liquidation_heatmap",
  // EPC OMEGA FINAL Etapa 10: sweep de liquidez e sessão institucional são
  // igualmente leitura de mercado/estrutura, nunca específicas do plano
  // ativo — mesma lógica acima.
  "liquidity_sweep",
  "market_sessions",
  // Ferramentas Institucionais: Kill Zone ICT é a mesma família de
  // contexto temporal de market_sessions acima — leitura de mercado,
  // nunca específica do plano ativo.
  "kill_zones",
  // Pedido do Operador ("Key Levels"): máxima/mínima de sessão é leitura
  // estrutural de mercado (mesmo papel de S1/R1 acima), nunca específica
  // do plano ativo.
  "session_key_levels",
  // DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO §4: confluência real entre
  // ferramentas de ESTRUTURA/MERCADO (EMA/VWAP/FVG/OB/liquidez) — mesma
  // categoria das demais acima, nunca específica do plano ativo.
  "institutional_zones",
]);

const CHART_LAYER_PANEL_MODULES: { id: ChartLayerId; label: string }[] = [
  { id: "liquidity_zones", label: "FVG / ORDER BLOCKS" },
  { id: "structure_breaks", label: "BOS / CHOCH" },
  { id: "order_flow_heatmap", label: "LIQUIDITY HEATMAP" },
  { id: "volume_profile", label: "VOLUME PROFILE" },
  { id: "trade_plan_zone", label: "TRADE PLAN ZONE" },
  { id: "neural_market_aura", label: "NEURAL MARKET AURA" },
  { id: "ema", label: "EMA" },
  { id: "trend_channel", label: "TREND CHANNEL" },
  { id: "vwap", label: "VWAP" },
  { id: "nexus_line", label: "NEXUS LINE" },
  { id: "cvd", label: "CVD" },
  { id: "fibonacci", label: "FIBONACCI" },
  { id: "premium_discount", label: "PREMIUM / DISCOUNT" },
  // Carta Branca: o id interno "harmonics" continua o mesmo (zero migração
  // de preferência salva do Operador — mesma disciplina de versionamento
  // aditivo já usada em toda a store), mas o rótulo visível agora cobre as
  // 3 famílias reais que competem pelo MESMO desenho no canvas (harmônico
  // XABCD/Wolfe, Triângulo, Ombro-Cabeça-Ombro — ver EnhancedChart_110_
  // Percent.tsx, useEffect do padrão vencedor).
  { id: "harmonics", label: "PADRÕES GRÁFICOS" },
  { id: "equal_highs_lows", label: "EQH / EQL" },
  // OMEGA CORE V-MAX Fase 8.1: rótulo deliberadamente "LIQUIDAÇÕES
  // FORÇADAS" (mesmo termo já usado no painel de lista real, "Forced
  // Liquidations") — nunca "LIQUIDATION HEATMAP", que colidiria
  // visualmente com "LIQUIDITY HEATMAP" (order_flow_heatmap, 2 linhas
  // acima) e confundiria qual camada o Operador está ligando/desligando.
  { id: "liquidation_heatmap", label: "LIQUIDAÇÕES FORÇADAS" },
  // EPC OMEGA FINAL Etapa 10 (Novas Camadas Institucionais).
  { id: "liquidity_sweep", label: "LIQUIDITY SWEEP" },
  { id: "market_sessions", label: "SESSÕES (ÁSIA/LONDRES/NY)" },
  // Ferramentas Institucionais: badge do header já existia (§6.48), esta
  // linha liga o canvas (KillZoneBandsPlugin) ao painel de camadas.
  { id: "kill_zones", label: "KILL ZONES (ICT)" },
  // Pedido do Operador ("Key Levels"): máxima/mínima real de cada sessão
  // como nível horizontal (SessionKeyLevelsPlugin).
  { id: "session_key_levels", label: "KEY LEVELS (SESSÕES)" },
  // DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO §4: faixa real de confluência
  // entre >=2 ferramentas independentes (InstitutionalZonePlugin).
  { id: "institutional_zones", label: "ZONA INSTITUCIONAL" },
  // Entrega 40: livro de ofertas real (DepthChartPlugin) como camada de
  // gráfico — gap nomeado desde a Entrega 35 §4.
  { id: "order_book_depth", label: "PROFUNDIDADE DO LIVRO" },
  // Entrega 41: perfil TPO real da sessão corrente (Steidlmayer/CBOT) —
  // gap real nomeado desde a auditoria v16.0 ULTRA §12.2/12.3.
  { id: "tpo_profile", label: "PERFIL TPO" },
  // Entrega 47 (pedido direto do Operador): ZigZag graduado do Laboratório
  // de Evolução (research/engines/zigzag-engine.js, isolado e testado
  // desde a Entrega 35) — pivôs confirmados por deviation%+depth.
  { id: "zigzag", label: "ZIGZAG" },
  // Achado 2.5 (Visual Cleanup & Rendering Audit): SCENARIO A/B ("Future
  // Path Map", scenario-engine.ts) ganha o mesmo toggle/relevância que
  // toda outra camada real já tinha — era a única sem nenhum dos dois.
  { id: "scenario_projection", label: "CENÁRIOS (FUTURE PATH MAP)" },
];

// Extraído de ChartLayersPanel (painel Properties 320px, pedido do
// Operador): o dropdown ancorado na SideBar E o novo painel docado em
// .terminal-properties precisam do MESMO conteúdo real (presets + toggle
// por camada + seletor de EMA) — casca (overlay flutuante vs. gaveta fixa)
// muda, a lógica/JSX de dentro é uma única implementação real, nunca
// duas. Lê o mesmo WidgetContext que ChartLayersPanel lia antes, menos os
// 2 campos que agora ficam só no wrapper (chartLayersOpen/setChartLayersOpen).
function ChartLayersPanelContent() {
  const {
    chartLayerVisibility,
    toggleChartLayer,
    applyChartLayerPreset,
    chartLayerAutoMode,
    resetChartLayerToAuto,
    emaPeriod,
    setEmaPeriod,
  } = useContext(WidgetContext) || {};
  const layerRelevance = useLayerRelevanceSnapshot();
  // "HOMOLOGAÇÃO DA ORDEM Nº 03": estado puramente local de disclosure do
  // painel (nunca persistido/sessão real) — recolhido por padrão a cada
  // vez que o painel abre, mesma filosofia de "operador não administra
  // modos" (a seção manual não fica "grudada" aberta de uma sessão pra
  // outra por acidente).
  const [advancedPresetsOpen, setAdvancedPresetsOpen] = useState(false);
  const visibility = chartLayerVisibility ?? DEFAULT_CHART_LAYER_VISIBILITY;
  const autoMode = chartLayerAutoMode ?? DEFAULT_CHART_LAYER_AUTO_MODE;
  // Highlight real (não decorativo): compara o estado atual byte-a-byte
  // contra os dois presets — só acende quando bate exatamente, nunca um
  // "quase" fingido de correspondência. NÚCLEO GRAVITACIONAL AUTÔNOMO §1:
  // os 3 presets manuais exigem TODAS as 21 camadas fora do automático —
  // uma camada em modo automático que coincidentemente bate com o preset
  // agora não é a mesma coisa que o Operador ter escolhido esse preset.
  const allManual = CHART_LAYER_IDS.every((id) => autoMode[id] === false);
  const isOperationalPreset = allManual && CHART_LAYER_IDS.every((id) => visibility[id] === CHART_LAYERS_OPERATIONAL_PRESET.has(id));
  const isAuditPreset = allManual && CHART_LAYER_IDS.every((id) => visibility[id] === true);
  const isIntelligencePreset = allManual && CHART_LAYER_IDS.every((id) => visibility[id] === CHART_LAYERS_INTELLIGENCE_PRESET.has(id));
  const isAutomaticPreset = CHART_LAYER_IDS.every((id) => autoMode[id] === true);

  return (
    <div className="p-3 flex flex-col gap-2 overflow-y-auto scrollbar-hide">
      {/* "HOMOLOGAÇÃO DA ORDEM Nº 03 / ORGANISMO INTELIGENTE ADAPTATIVO":
          "o operador não deve administrar modos... deve receber uma
          leitura pronta e contextualizada". Reorganizado, NUNCA apagado
          (Regra de Ouro 4 — funcionalidade real preservada por
          inteiro): os 4 presets e o toggle individual abaixo continuam
          existindo e funcionando byte-a-byte como antes; só a
          PRIORIDADE VISUAL mudou — Automático é agora a única ação
          primária sempre visível (o estado adaptativo real: Relevance
          Engine + Visual Budget, já ligados ao vivo), e os 3 presets
          manuais viram uma seção secundária, recolhida por padrão, para
          quem especificamente precisa de uma leitura manual pontual
          (ex.: Preset Auditoria para revisão profunda). Decisão de design
          deliberada, não a exclusão literal pedida pela diretriz — ver
          docs/RELATORIO_HOMOLOGACAO_03_ORGANISMO_ADAPTATIVO.md §3 para
          o raciocínio completo. */}
      <button
        type="button"
        onClick={() => applyChartLayerPreset?.("automatic")}
        title="Cada camada aparece só quando tem relevância estatística real agora (Relevance Engine) + competição real de destaque entre camadas (Visual Budget) — nunca precisa ser administrado manualmente."
        className={`w-full flex flex-col items-center gap-0.5 py-2.5 rounded border-2 font-bold uppercase tracking-wider transition-colors ${
          isAutomaticPreset
            ? "border-[#00ffaa] bg-[#00ffaa15] text-[#00ffaa]"
            : "border-[#8ab4f8]/30 text-[#8ab4f8]/70 hover:text-[#8ab4f8] hover:border-[#8ab4f8]/50"
        }`}
      >
        <span className="text-[0.55rem] tracking-[0.2em]">AR10 CYBORG · Estado Inteligente Adaptativo</span>
        <span className="text-[0.38rem] font-normal normal-case tracking-normal opacity-80">
          {isAutomaticPreset ? "ativo agora — leitura pronta, sem modo pra administrar" : "clique para voltar ao estado adaptativo padrão"}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setAdvancedPresetsOpen((v) => !v)}
        className="text-[0.4rem] text-[#8ab4f8]/50 hover:text-[#8ab4f8] tracking-[0.15em] uppercase text-left flex items-center gap-1"
      >
        <span>{advancedPresetsOpen ? "▾" : "▸"}</span>
        <span>Predefinições manuais (avançado)</span>
      </button>
      {advancedPresetsOpen && (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => applyChartLayerPreset?.("operational")}
            className={`flex-1 text-[0.42rem] py-1.5 rounded border font-bold uppercase tracking-wider ${
              isOperationalPreset
                ? "border-[#00f0ff] bg-[#00f0ff20] text-[#00f0ff]"
                : "border-[#8ab4f8]/20 text-[#8ab4f8]/60 hover:text-[#8ab4f8]"
            }`}
          >
            Preset Operacional
          </button>
          <button
            type="button"
            onClick={() => applyChartLayerPreset?.("intelligence")}
            className={`flex-1 text-[0.42rem] py-1.5 rounded border font-bold uppercase tracking-wider ${
              isIntelligencePreset
                ? "border-[#00f0ff] bg-[#00f0ff20] text-[#00f0ff]"
                : "border-[#8ab4f8]/20 text-[#8ab4f8]/60 hover:text-[#8ab4f8]"
            }`}
          >
            Preset Inteligência
          </button>
          <button
            type="button"
            onClick={() => applyChartLayerPreset?.("audit")}
            className={`flex-1 text-[0.42rem] py-1.5 rounded border font-bold uppercase tracking-wider ${
              isAuditPreset
                ? "border-[#00f0ff] bg-[#00f0ff20] text-[#00f0ff]"
                : "border-[#8ab4f8]/20 text-[#8ab4f8]/60 hover:text-[#8ab4f8]"
            }`}
          >
            Preset Auditoria
          </button>
        </div>
      )}
      <span className="text-[0.5rem] text-[#8ab4f8]/70 tracking-[0.15em] uppercase">
        Overlays reais do canvas — esconder uma camada nunca altera o dado, só a exibição
      </span>
      {CHART_LAYER_PANEL_MODULES.map(({ id, label }) => {
        // NÚCLEO GRAVITACIONAL AUTÔNOMO §1/§7: em modo automático, o
        // estado real vem do Relevance Engine (nunca do boolean manual,
        // que só é o valor efetivo quando o Operador assumiu controle
        // — mesma resolução que effectiveChartLayerVisibility já faz
        // pro canvas, aqui só pra exibir corretamente no painel).
        const isAuto = autoMode[id];
        const relevance = layerRelevance?.[id] ?? null;
        const on = isAuto ? (relevance?.relevant ?? true) : visibility[id];
        return (
          <div
            key={id}
            className="flex flex-col gap-1.5 bg-[#010205] border border-[#00f0ff15] rounded-lg px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.55rem] font-bold tracking-widest text-white">{label}</span>
              <div className="flex items-center gap-1">
                {isAuto && (
                  // EPC FINAL §3/§12 ("quando destacar"): emphasis real
                  // (só existe onde há um gradiente real no sinal, ver
                  // layer-relevance.ts) some no texto do badge — nunca
                  // um efeito visual novo sem motivo real por trás.
                  <span
                    className={`text-[0.38rem] px-1.5 py-1 rounded border font-bold uppercase tracking-wider ${
                      relevance?.emphasis === "highlight"
                        ? "border-[#00ffaa] bg-[#00ffaa20] text-[#00ffaa]"
                        : "border-[#00ffaa]/40 text-[#00ffaa]/80"
                    }`}
                    title={relevance?.reason ?? "Relevance Engine ainda sem leitura real neste ciclo."}
                  >
                    auto{relevance?.emphasis === "highlight" ? " · destaque" : ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggleChartLayer?.(id)}
                  title={isAuto ? "Clicar assume controle manual desta camada (override real)." : "Override manual ativo."}
                  className={`text-[0.4rem] px-2 py-1 rounded border font-bold uppercase tracking-wider ${
                    on
                      ? "border-[#00f0ff] bg-[#00f0ff20] text-[#00f0ff]"
                      : "border-[#8ab4f8]/20 text-[#8ab4f8]/50 hover:text-[#8ab4f8]"
                  }`}
                >
                  {on ? "visível" : "oculta"}
                </button>
                {!isAuto && (
                  <button
                    type="button"
                    onClick={() => resetChartLayerToAuto?.(id)}
                    title="Devolver esta camada ao comportamento automático (Relevance Engine decide)."
                    className="text-[0.38rem] px-1.5 py-1 rounded border border-[#8ab4f8]/20 text-[#8ab4f8]/50 hover:text-[#00ffaa] hover:border-[#00ffaa]/40 font-bold uppercase tracking-wider"
                  >
                    ⟲ auto
                  </button>
                )}
              </div>
            </div>
            {/* Diretriz Camada de Decisão Profissional, item 1: período
                real da EMA — um único controle, os 4 períodos padrão da
                indústria (nexus/ema.ts), nunca uma lista arbitrária. */}
            {id === "ema" && (
              <div className="flex items-center gap-1">
                {EMA_PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEmaPeriod?.(p)}
                    className={`flex-1 text-[0.4rem] py-1 rounded border font-bold tracking-wider ${
                      emaPeriod === p
                        ? "border-[#00f0ff] bg-[#00f0ff20] text-[#00f0ff]"
                        : "border-[#8ab4f8]/20 text-[#8ab4f8]/50 hover:text-[#8ab4f8]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChartLayersPanel() {
  const { chartLayersOpen, setChartLayersOpen } = useContext(WidgetContext) || {};
  if (!chartLayersOpen) return null;
  // v16.0 DEFINITIVO §5.3 ("Layer Manager — UI"): dropdown compacto
  // ancorado no ícone real que já abre este painel (SideBar, "Camadas do
  // Gráfico") — nunca mais um modal de tela cheia. O click-catcher
  // invisível substitui o antigo backdrop escurecido — um dropdown
  // compacto não deve escurecer a tela inteira atrás dele, só fechar ao
  // clicar fora. Conteúdo real (presets/toggle/EMA) vive em
  // ChartLayersPanelContent — este componente é só a casca do dropdown.
  return (
    <>
      <div className="!fixed !inset-0 !z-[1000]" onClick={() => setChartLayersOpen?.(false)} />
      <div
        className="!fixed !z-[1001] left-14 md:left-16 bottom-36 w-60 max-w-[85vw] max-h-[70dvh] cyber-panel flex flex-col bg-[#010308]/98"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cyber-header flex items-center justify-between">
          <span className="font-bold tracking-[0.2em]">CAMADAS DO GRÁFICO</span>
          <div
            className="text-[#8ab4f8]/50 hover:text-[#00f0ff] px-1 py-0.5 rounded cursor-pointer"
            onClick={() => setChartLayersOpen?.(false)}
          >
            <X size={14} />
          </div>
        </div>
        <ChartLayersPanelContent />
      </div>
    </>
  );
}

// Painel Properties 320px (pedido do Operador — ver .terminal-properties em
// App()): corpo real do painel docado, mesmo ChartLayersPanelContent do
// dropdown acima (zero segunda implementação) + atalho para Configurações.
// Risk/Alerts deliberadamente FORA (ver comentário real em .terminal-
// properties): já têm aba própria e mais completa em SecondaryModuleView.
function PropertiesPanelBody({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <>
      <ChartLayersPanelContent />
      <button
        type="button"
        onClick={onOpenSettings}
        title="Ir para Configurações do Sistema (aba SETTINGS)"
        className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 rounded border border-[#8ab4f8]/20 text-[#8ab4f8]/70 hover:text-[#00f0ff] hover:border-[#00f0ff]/40 text-[0.45rem] font-bold uppercase tracking-wider transition-colors"
      >
        <span>Configurações do Sistema</span>
        <Settings size={12} />
      </button>
    </>
  );
}

// OMEGA CORE V-MAX (completar Fase 7, Radar/OIH — "módulo único
// consultivo"): painel de header no MESMO padrão de ChartLayersPanel logo
// acima (overlay fixed/centered, mesmo shell cyber-panel/cyber-header) —
// só consome radarCandidates (fatia §4 CÉREBRO, já filtrada/ranqueada por
// rankRadarCandidates no efeito de scan de App()); este componente NUNCA
// recalcula nada, só lê e exibe (LEI 24, "consulta snapshot, não
// recalcula"). Título visível "OPORTUNIDADES" (nunca "Radar" sozinho): o
// cockpit já tem "RADAR DE CONSENSO" (CouncilWidget) e uma aba "SCANNER"
// (heurística de %-change de 24h, ScannerWidget) — um terceiro rótulo com
// a mesma palavra confundiria qual painel está aberto.
function RadarPanel() {
  const { radarPanelOpen, setRadarPanelOpen, setSelectedAsset, setMarketMode, setSelectedTradFiAsset } =
    useContext(WidgetContext) || {};
  const candidates = useRadarCandidatesSnapshot();
  if (!radarPanelOpen) return null;

  // Mesmo mecanismo real do SmartOmnibox (onSelectCrypto) — trocar
  // selectedAsset sozinho já dispara o efeito de boot/WS + o efeito de
  // fetch de candles (deps [chartTimeframe, selectedAsset]); "centralizar
  // gráfico" (diretiva) não precisa de nenhum helper à parte. Timeframe
  // recomendado: esse conceito não existe em nenhum motor real do
  // organismo hoje — a diretiva já previu esse caso ("senão timeframe
  // atual"), e é honestamente o MESMO prazo em que o candidato foi
  // escaneado (o efeito de scan usa chartTimeframe), então nunca há
  // descompasso entre o que foi avaliado e o que o gráfico mostra a
  // seguir.
  const openCandidate = (symbol: string) => {
    setMarketMode?.("CRYPTO");
    setSelectedTradFiAsset?.(null);
    setSelectedAsset?.(symbol);
    setRadarPanelOpen?.(false);
  };

  return (
    <div
      className="!fixed !inset-0 !z-[1001] bg-[#010308]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setRadarPanelOpen?.(false)}
    >
      <div
        className="cyber-panel w-full max-w-md max-h-[80dvh] flex flex-col bg-[#010308]/98"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cyber-header flex items-center justify-between">
          <span className="font-bold tracking-[0.2em]">OPORTUNIDADES</span>
          <div
            className="text-[#8ab4f8]/50 hover:text-[#00f0ff] px-1 py-0.5 rounded cursor-pointer"
            onClick={() => setRadarPanelOpen?.(false)}
          >
            <X size={14} />
          </div>
        </div>
        <div className="p-3 flex flex-col gap-2 overflow-y-auto scrollbar-hide">
          <span className="text-[0.5rem] text-[#8ab4f8]/70 tracking-[0.15em] uppercase">
            Radar/OIH — varredura real em segundo plano (Binance + MEXC): direção por Regime de Mercado real (ADX), nunca o Núcleo do ativo selecionado — que continua sendo o único emissor real de LONG/SHORT/WAIT do gráfico (LEI 24). Só lista quem já tem estrutura confirmada, Trade Plan real e confluência suficiente.
          </span>
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
              <RadarIcon size={22} className="text-[#8ab4f8]/30" />
              <span className="text-[0.5rem] text-[#8ab4f8]/50 tracking-[0.1em] uppercase">
                Nenhuma oportunidade validada agora
              </span>
              <span className="text-[0.42rem] text-[#8ab4f8]/35 max-w-[220px]">
                O organismo varre o universo curado (Binance) + o universo real da MEXC em segundo plano — volte em alguns minutos, ou aguarde o próximo ciclo automático.
              </span>
            </div>
          ) : (
            candidates.map((c) => {
              const isLong = c.direction === "LONG";
              return (
                <button
                  key={`${c.provider}:${c.symbol}:${c.timeframe}`}
                  type="button"
                  onClick={() => openCandidate(c.symbol)}
                  title={describeRadarQualificationReason(c.reason)}
                  className="flex items-center justify-between gap-2 bg-[#010205] border border-[#00f0ff15] hover:border-[#00f0ff40] rounded-lg px-3 py-2 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isLong ? (
                      <ArrowUpRight size={14} className="text-[#00ffaa] shrink-0" />
                    ) : (
                      <ArrowDownRight size={14} className="text-[#ff0055] shrink-0" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-[0.6rem] font-bold tracking-wider text-white">{c.symbol}</span>
                      <span
                        className="text-[0.4rem] text-[#8ab4f8]/50 uppercase tracking-wider"
                        title="Exchange real que forneceu este candle/estrutura — um candidato MEXC e um Binance do mesmo símbolo são leituras independentes, nunca a mesma verdade."
                      >
                        {c.timeframe} · {c.provider}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-[0.6rem] font-black font-mono tabular-nums ${isLong ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
                      title="Intensidade real do Corredor de Confluência (0-100%) — nunca probabilidade de acerto."
                    >
                      {c.qualityIndex !== null ? `${(c.qualityIndex * 100).toFixed(0)}%` : DASH}
                    </span>
                    <span className="text-[0.4rem] text-[#8ab4f8]/50 uppercase tracking-wider">
                      {c.riskRewardRatio !== null ? `R:R 1:${c.riskRewardRatio.toFixed(2)}` : DASH}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Ordem "Market Analysis & Publication Engine": preço formatado com a MESMA
// regra já repetida em outros pontos do painel (StructureLevelsStrip etc.)
// — convenção de exibição da UI, deliberadamente separada do fmtPrice
// privado de nexus/market-analysis.ts (que formata para o TEXTO de X, um
// alvo de renderização diferente).
function fmtPrice(v: number): string {
  return v.toFixed(v >= 1000 ? 0 : 2);
}

function MarketAnalysisPainelTab({ analysis }: { analysis: MarketAnalysis }) {
  return (
    <div className="flex flex-col gap-2">
      <ModulePanel title="Leitura">
        <ModuleStat
          label="Viés"
          value={analysis.bias}
          tone={analysis.bias === "LONG_BIAS" ? "long" : analysis.bias === "SHORT_BIAS" ? "short" : "neutral"}
        />
        {analysis.regimeLabel && <ModuleStat label="Regime" value={analysis.regimeLabel} />}
        {analysis.structureLabel && <ModuleStat label="Estrutura" value={analysis.structureLabel} />}
        <ModuleStat label="Confluência" value={analysis.confluence} />
        <ModuleStat
          label="Decisão"
          value={analysis.outcome}
          tone={analysis.outcome === "LONG" ? "long" : analysis.outcome === "SHORT" ? "short" : "neutral"}
        />
        {analysis.risk && (
          <ModuleStat
            label="Risco"
            value={`${analysis.risk.state} — ${analysis.risk.basis}`}
            tone={analysis.risk.state === "ACEITÁVEL" ? "long" : "short"}
          />
        )}
        {analysis.confidenceLabel && <ModuleStat label="Confiança" value={analysis.confidenceLabel} />}
        {analysis.score !== null && <ModuleStat label="Score" value={`${analysis.score}`} />}
      </ModulePanel>

      {analysis.zoneOfInterest && (
        <ModulePanel title="Zona de Interesse">
          <ModuleStat
            label={analysis.zoneOfInterest.label}
            value={`${fmtPrice(analysis.zoneOfInterest.price)} · ${analysis.zoneOfInterest.touches}x`}
          />
        </ModulePanel>
      )}

      {analysis.plan ? (
        <ModulePanel title="Plano">
          <ModuleStat label="Entry" value={`${fmtPrice(analysis.plan.entryLow)}–${fmtPrice(analysis.plan.entryHigh)}`} />
          <ModuleStat label="Stop" value={fmtPrice(analysis.plan.invalidationPrice)} tone="short" />
          {analysis.plan.targets.map((t) => (
            <ModuleStat
              key={t.index}
              label={`Alvo ${t.index + 1}`}
              value={`${fmtPrice(t.price)}${t.riskReward !== null ? ` · R:R 1:${t.riskReward.toFixed(2)}` : ""}${t.reached ? " · ATINGIDO" : ""}`}
              tone="long"
            />
          ))}
        </ModulePanel>
      ) : analysis.corePlan ? (
        // Ordem "Correção Definitiva do Market Analysis / Social Card" §5:
        // MESMA extensão da aba Publicação — o Conselho está neutro, mas o
        // Núcleo (LEI 24) já tem direção e stop/target reais agora (o
        // mesmo fallback que o gráfico ao vivo já desenha). Nunca
        // apresentado como se fosse um plano do Conselho.
        <ModulePanel title="Plano (Núcleo)">
          {analysis.planGapLabel && <ModuleStat label="Conselho" value={analysis.planGapLabel} />}
          <ModuleStat label="Stop" value={fmtPrice(analysis.corePlan.stop)} tone="short" />
          {[analysis.corePlan.target1, analysis.corePlan.target2, analysis.corePlan.target3]
            .filter((v): v is number => v !== null)
            .map((price, i) => (
              <ModuleStat
                key={i}
                label={`Alvo ${i + 1}`}
                value={`${fmtPrice(price)}${i === 0 && analysis.corePlan!.riskRewardRatio !== null ? ` · R:R 1:${analysis.corePlan!.riskRewardRatio!.toFixed(2)}` : ""}`}
                tone="long"
              />
            ))}
        </ModulePanel>
      ) : (
        analysis.planGapLabel && (
          <ModulePanel title="Plano">
            <ModuleStat label="Status" value={analysis.planGapLabel} />
          </ModulePanel>
        )
      )}

      {analysis.retest && (
        <ModulePanel title="Reteste">
          <ModuleStat label="Zona" value={`${fmtPrice(analysis.retest.low)}–${fmtPrice(analysis.retest.high)}`} />
          <span className="text-[0.42rem] text-[#8ab4f8]/50">
            {analysis.retest.condition} ({analysis.retest.context})
          </span>
        </ModulePanel>
      )}
    </div>
  );
}

// Ordem "AR10 PUBLICATION STUDIO": substitui as antigas abas X (texto) e
// STORY (prévia DOM, screenshot manual) da Ordem anterior por UMA aba só,
// "Publicação" — Regra de Ouro 4 (realocar, nunca apagar): a legenda de
// texto para X sobrevive integralmente (mesma formatMarketAnalysisForX,
// mesmo botão Copiar) ao lado da imagem real; a prévia de Story vira a
// peça PNG de verdade em vez de exigir screenshot manual (§3/§7 da nova
// Ordem: "não depender de screenshot manual"). §1: as 4 peças nascem do
// MESMO snapshot já congelado que o painel recebe por prop — este
// componente nunca chama buildMarketAnalysis/motor nenhum, só desenha.
function MarketAnalysisPublicationTab({ snapshot }: { snapshot: PublicationSnapshot }) {
  const [assets, setAssets] = useState<PublicationAsset[] | null>(null);
  const [genState, setGenState] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [activeFormat, setActiveFormat] = useState<PublicationFormat>("ANALYSIS");
  const [shareState, setShareState] = useState<"idle" | "sharing" | "unsupported">("idle");
  const [captionCopyState, setCaptionCopyState] = useState<"idle" | "copied" | "failed">("idle");

  // Object URLs vivem só enquanto esta sessão de publicação existe —
  // liberados ao desmontar (painel fechado) ou antes de um novo lote
  // (regeração), nunca acumulados.
  useEffect(() => {
    return () => {
      setAssets((prev) => {
        if (prev) revokePublicationAssets(prev);
        return prev;
      });
    };
  }, []);

  const handleGenerate = async () => {
    setGenState("generating");
    const next = await renderPublicationAssets(snapshot);
    setAssets((prev) => {
      if (prev) revokePublicationAssets(prev);
      return next;
    });
    if (next.length > 0) {
      setActiveFormat(next[0].format);
      setGenState("ready");
    } else {
      setGenState("failed");
    }
  };

  const downloadAsset = (asset: PublicationAsset) => {
    const a = document.createElement("a");
    a.href = asset.objectUrl;
    a.download = asset.filename;
    a.click();
  };

  const downloadAll = () => {
    if (!assets) return;
    // Disparados a partir do MESMO gesto do Operador (onClick síncrono),
    // só espaçados pra não colidir no navegador — nunca um novo gesto por
    // arquivo.
    assets.forEach((a, i) => setTimeout(() => downloadAsset(a), i * 200));
  };

  const shareAll = async () => {
    if (!assets) return;
    const files = assets.map((a) => new File([a.blob], a.filename, { type: "image/png" }));
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data?: ShareData) => Promise<void> };
    if (!nav.share || !nav.canShare || !nav.canShare({ files })) {
      setShareState("unsupported");
      setTimeout(() => setShareState("idle"), 2600);
      return;
    }
    setShareState("sharing");
    try {
      await nav.share({ files, title: `${snapshot.analysis.symbol} · ${snapshot.analysis.timeframe.toUpperCase()}`, text: "Análise gerada pelo AR10 CYBORG" });
    } catch {
      // AbortError (Operador cancelou a folha de compartilhamento nativa)
      // cai aqui também — cancelar não é uma falha, nunca reporta erro.
    }
    setShareState("idle");
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(formatMarketAnalysisForX(snapshot.analysis));
      setCaptionCopyState("copied");
    } catch {
      setCaptionCopyState("failed");
    }
    setTimeout(() => setCaptionCopyState("idle"), 2000);
  };

  const active = assets?.find((a) => a.format === activeFormat) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={genState === "generating"}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-[#00f0ff60] bg-[#00f0ff1a] text-[#00f0ff] text-[0.6rem] font-black tracking-[0.2em] uppercase cursor-pointer hover:bg-[#00f0ff2a] disabled:opacity-50 disabled:cursor-wait"
      >
        <Share2 size={13} />
        {genState === "generating" ? "Gerando as 4 peças…" : "Gerar Publicação"}
      </button>

      {genState === "failed" && (
        <span className="text-[0.45rem] text-[#ff0055] text-center uppercase tracking-wide">
          DADOS INSUFICIENTES — sem candles reais suficientes para gerar as peças com gráfico agora.
        </span>
      )}

      {genState === "ready" && assets && assets.length > 0 && (
        <>
          <div className="flex gap-1 flex-wrap justify-center">
            {assets.map((a) => (
              <button
                key={a.format}
                type="button"
                onClick={() => setActiveFormat(a.format)}
                className={`px-2 py-1 rounded text-[0.42rem] font-black tracking-[0.1em] uppercase cursor-pointer transition-colors ${
                  activeFormat === a.format
                    ? "bg-[#00f0ff1a] text-[#00f0ff] border border-[#00f0ff40]"
                    : "text-[#8ab4f8]/50 border border-transparent hover:text-[#8ab4f8]"
                }`}
              >
                {PUBLICATION_FORMAT_SPECS[a.format].label}
              </button>
            ))}
          </div>

          {active && (
            <div className="flex flex-col items-center gap-1.5">
              <img
                src={active.objectUrl}
                alt={PUBLICATION_FORMAT_SPECS[active.format].label}
                className="max-w-full rounded border border-[#00f0ff20]"
                style={{ maxHeight: 300 }}
              />
              <button
                type="button"
                onClick={() => downloadAsset(active)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#00f0ff40] bg-[#00f0ff1a] text-[#00f0ff] text-[0.48rem] font-black tracking-[0.15em] uppercase cursor-pointer hover:bg-[#00f0ff2a]"
              >
                <Download size={12} />
                Baixar {PUBLICATION_FORMAT_SPECS[active.format].label}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-[0.42rem] text-[#8ab4f8]/50 uppercase tracking-[0.1em]">Legenda sugerida para X</span>
            <pre className="whitespace-pre-wrap break-words text-[0.46rem] leading-relaxed text-[#a0f0ff] bg-[#010205] border border-[#00f0ff15] rounded p-2 font-mono">
              {formatMarketAnalysisForX(snapshot.analysis)}
            </pre>
            <button
              type="button"
              onClick={handleCopyCaption}
              className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#00f0ff40] bg-[#00f0ff1a] text-[#00f0ff] text-[0.48rem] font-black tracking-[0.15em] uppercase cursor-pointer hover:bg-[#00f0ff2a]"
            >
              {captionCopyState === "copied" ? <Check size={12} /> : <Copy size={12} />}
              {captionCopyState === "copied" ? "Copiado" : captionCopyState === "failed" ? "Falhou — copie manualmente" : "Copiar legenda"}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadAll}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-[#8ab4f840] text-[#8ab4f8] text-[0.5rem] font-black tracking-[0.15em] uppercase cursor-pointer hover:border-[#8ab4f870]"
            >
              <Download size={12} />
              Baixar Todas
            </button>
            <button
              type="button"
              onClick={shareAll}
              disabled={shareState === "sharing"}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-[#8ab4f840] text-[#8ab4f8] text-[0.5rem] font-black tracking-[0.15em] uppercase cursor-pointer hover:border-[#8ab4f870] disabled:opacity-50"
            >
              <Share2 size={12} />
              {shareState === "sharing" ? "Compartilhando…" : "Compartilhar"}
            </button>
          </div>
          {shareState === "unsupported" && (
            <span className="text-[0.42rem] text-[#8ab4f8]/50 text-center">
              Compartilhamento nativo não disponível neste navegador — use Baixar Todas.
            </span>
          )}
        </>
      )}
    </div>
  );
}

// Ordem "Market Analysis & Publication Engine": camada de apresentação/
// publicação sobre o NexusDecision já real — mesmo shell modal do
// RadarPanel acima (fixed inset-0 + cyber-panel centralizado). §12
// sincronia: o snapshot congela no INSTANTE em que o painel abre (useEffect
// com dependência única `marketAnalysisOpen`) — Painel/X/Story sempre leem
// a MESMA fotografia durante toda a sessão de publicação, mesmo que
// preço/decisão reais sigam mudando por trás enquanto o painel está aberto
// (o Operador pode demorar para escolher o texto/print certo; a leitura
// não pode mudar debaixo dele no meio disso). Fail-closed (§6):
// buildMarketAnalysis já devolve null sem leitura real do Core Engine —
// este componente só traduz esse null em "DADOS INSUFICIENTES" visível,
// nunca uma leitura parcial fabricada. priceData chega por PROP (nunca via
// Context) — mesmo padrão fixado pela Ordem "Unificação da Inteligência
// Operacional" (commit f74c533): o preço ao vivo tem exatamente 1 caminho
// de distribuição real (o state raiz de App()), nunca um espelho.
function MarketAnalysisPanel({ priceData, chartData }: { priceData: PriceState | null; chartData: PublicationCandle[] }) {
  const { marketAnalysisOpen, setMarketAnalysisOpen, selectedAsset, chartTimeframe, nexusDecision, engine, cvd } =
    useContext(WidgetContext) || {};
  const [tab, setTab] = useState<"PAINEL" | "PUBLICACAO">("PAINEL");
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  // Ordem "AR10 PUBLICATION STUDIO" §1: candles/preço vivo congelados no
  // MESMO instante e pelo MESMO gatilho que `analysis` — as 4 peças
  // publicáveis (aba Publicação) precisam do gráfico real, e ele só pode
  // vir do exato mesmo momento da leitura, nunca de um tick mais novo
  // capturado só no clique de "Gerar Publicação" (isso divergiria da
  // leitura já mostrada na aba Painel durante a mesma sessão do painel).
  const [frozenCandles, setFrozenCandles] = useState<PublicationCandle[]>([]);
  const [frozenLivePrice, setFrozenLivePrice] = useState<number | null>(null);

  useEffect(() => {
    if (!marketAnalysisOpen) return;
    const regime = engine?.marketRegime ?? null;
    const regimeDisplay = regime ? REGIME_DISPLAY[regime.regime] : null;
    const livePriceNow = typeof priceData?.price === "number" ? priceData.price : null;
    setAnalysis(
      buildMarketAnalysis({
        symbol: selectedAsset ?? "",
        timeframe: chartTimeframe ?? "",
        decision: nexusDecision ?? null,
        regimeLabel: regimeDisplay ? `${regimeDisplay.label}${regime!.direction ? ` ${regime!.direction}` : ""}` : null,
        structureLabel: engine?.marketStructureLabel ?? null,
        support: engine?.support ?? null,
        supportStrength: engine?.supportStrength ?? null,
        resistance: engine?.resistance ?? null,
        resistanceStrength: engine?.resistanceStrength ?? null,
        livePrice: livePriceNow,
        // Evolução Final §11 ("leitura consolidada"): MESMA derivação de
        // fluxo que NarrativeSummaryCard já usa (nexus/market-analysis.ts
        // repassa direto pra buildNarrativeSummary) — zero segunda fórmula.
        flow: num(cvd) && cvd !== 0 ? (cvd! > 0 ? "COMPRADOR" : "VENDEDOR") : null,
        // Ordem "Correção Definitiva" §5: OS MESMOS campos brutos de
        // `engine` que engineFallbackLevels (abaixo, ChartWidget) já lê
        // para desenhar o fallback do Núcleo no gráfico ao vivo — cru de
        // propósito, buildMarketAnalysis valida (finito/direção real)
        // internamente, mesmo padrão de support/resistance acima. Nunca
        // uma segunda leitura de campo (mesmos nomes: engine?.target é
        // target1, engine?.extendedTarget é target3 — achado de nomenclatura
        // já documentado em engineFallbackLevels).
        coreFallback: {
          direction: engine?.direction ?? null,
          stop: engine?.stop ?? null,
          target1: engine?.target ?? null,
          target2: engine?.target2 ?? null,
          target3: engine?.extendedTarget ?? null,
          riskRewardRatio: engine?.riskRewardRatio ?? null,
        },
      }),
    );
    setFrozenCandles(chartData);
    setFrozenLivePrice(livePriceNow);
    setTab("PAINEL");
    // Deps propositalmente estreito: SÓ marketAnalysisOpen. Reabrir o
    // painel é o único gatilho para uma fotografia nova — enquanto o
    // painel segue aberto, ticks reais de preço/decisão/candle no fundo
    // NUNCA reescrevem o que já foi gerado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketAnalysisOpen]);

  if (!marketAnalysisOpen) return null;
  const close = () => setMarketAnalysisOpen?.(false);

  return (
    <div
      className="!fixed !inset-0 !z-[1001] bg-[#010308]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        className="cyber-panel w-full max-w-lg max-h-[92dvh] flex flex-col bg-[#010308]/98"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cyber-header flex items-center justify-between">
          <span className="font-bold tracking-[0.2em]">ANÁLISE DE MERCADO</span>
          <div
            className="text-[#8ab4f8]/50 hover:text-[#00f0ff] px-1 py-0.5 rounded cursor-pointer"
            onClick={close}
          >
            <X size={14} />
          </div>
        </div>
        <div className="p-3 flex flex-col gap-2 overflow-y-auto scrollbar-hide">
          {!analysis ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
              <Share2 size={22} className="text-[#8ab4f8]/30" />
              <span className="text-[0.5rem] text-[#8ab4f8]/50 tracking-[0.1em] uppercase">DADOS INSUFICIENTES</span>
              <span className="text-[0.42rem] text-[#8ab4f8]/35 max-w-[260px]">
                O Núcleo ainda não tem leitura real suficiente para {selectedAsset || "este ativo"} agora — nenhum
                cenário publicável até que exista viés/estrutura reais.
              </span>
            </div>
          ) : (
            <>
              <span className="text-[0.42rem] text-[#8ab4f8]/50 tracking-[0.1em] uppercase">
                {analysis.symbol} · {analysis.timeframe.toUpperCase()} · fotografia congelada há {ageLabelOf(analysis.generatedAt)}
              </span>
              <span className="text-[0.4rem] text-[#8ab4f8]/35 leading-tight">
                Gerado sob demanda pelo Operador — esta tela nunca publica sozinha; copiar/capturar é sempre uma ação sua.
              </span>
              <div className="flex gap-1 border-b border-[#00f0ff15] pb-2">
                {(["PAINEL", "PUBLICACAO"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`px-2 py-1 rounded text-[0.45rem] font-black tracking-[0.15em] uppercase cursor-pointer transition-colors ${
                      tab === t
                        ? "bg-[#00f0ff1a] text-[#00f0ff] border border-[#00f0ff40]"
                        : "text-[#8ab4f8]/50 border border-transparent hover:text-[#8ab4f8]"
                    }`}
                  >
                    {t === "PAINEL" ? "PAINEL" : "PUBLICAÇÃO"}
                  </button>
                ))}
              </div>

              {tab === "PAINEL" && <MarketAnalysisPainelTab analysis={analysis} />}
              {tab === "PUBLICACAO" && (
                <MarketAnalysisPublicationTab snapshot={{ analysis, candles: frozenCandles, livePrice: frozenLivePrice }} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// v16.0 PRO MAX §9.1/§9.4 ("Paper Trading"): posição simulada MANUAL —
// decisão explícita do Operador (AskUserQuestion, resposta literal "Só
// painel manual, sem automação"): ZERO automação. Nenhum useEffect aqui
// chama openPaperPosition/closePaperPosition — as duas únicas chamadas
// reais vivem nos onClick abaixo, sempre em resposta a um clique real.
// P&L é aritmética real sobre o MESMO priceData ao vivo que o resto do
// terminal usa (PROP, nunca Context — mesmo padrão fixado por
// MarketAnalysisPanel acima); nunca toca exchange real, nunca guarda
// credencial, nunca envia ordem (nexus/paper-trading.ts).
function PaperTradingPanel({ priceData }: { priceData: PriceState | null }) {
  const { paperTradingOpen, setPaperTradingOpen } = useContext(WidgetContext) || {};
  const tradePlan = useTradePlanSnapshot();
  const paperTrading = usePaperTradingSnapshot();
  const [sizeInput, setSizeInput] = useState("100");

  if (!paperTradingOpen) return null;
  const close = () => setPaperTradingOpen?.(false);
  const livePrice = typeof priceData?.price === "number" ? priceData.price : null;
  const position = paperTrading.position;

  const pnl = position && livePrice !== null ? unrealizedPnl(position, livePrice) : null;
  const pnlPct = position && livePrice !== null ? unrealizedPnlPct(position, livePrice) : null;
  const ctx = position && livePrice !== null ? paperPositionContext(position, livePrice) : null;

  const handleOpen = () => {
    const size = Number(sizeInput);
    if (!tradePlan || !Number.isFinite(size) || size <= 0) return;
    useUnifiedSnapshotStore.getState().openPaperPosition(tradePlan, size);
  };
  // SEMPRE um clique do Operador — reason só documenta qual leitura ele
  // reconheceu (perto do alvo/stop) ao decidir fechar, nunca uma decisão
  // automática do motor (ver header do arquivo nexus/paper-trading.ts).
  const handleClose = () => {
    if (!position || livePrice === null) return;
    const reason: "TARGET" | "STOP" | "MANUAL" = ctx?.nearTarget ? "TARGET" : ctx?.nearStop ? "STOP" : "MANUAL";
    useUnifiedSnapshotStore.getState().closePaperPosition(livePrice, reason);
  };

  return (
    <div
      className="!fixed !inset-0 !z-[1001] bg-[#010308]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        className="cyber-panel w-full max-w-sm max-h-[92dvh] flex flex-col bg-[#010308]/98"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cyber-header flex items-center justify-between">
          <span className="font-bold tracking-[0.2em]">PAPER TRADING</span>
          <button type="button" onClick={close} aria-label="Fechar" className="text-[#8ab4f8]/60 hover:text-[#00f0ff]">
            <X size={16} />
          </button>
        </div>
        <div className="p-3 overflow-y-auto flex-1 space-y-3 text-[0.7rem]">
          {!position ? (
            <>
              {!tradePlan ? (
                <div className="text-[#8ab4f8]/50 text-center py-4">DADOS INSUFICIENTES — sem Trade Plan ativo agora.</div>
              ) : (
                <div className="cyber-panel bg-black/30 p-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#8ab4f8]/50">Direção</span>
                    <span className={tradePlan.direction === "LONG" ? "text-[#00ffaa]" : "text-[#ff4d6d]"}>{tradePlan.direction}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8ab4f8]/50">Entrada</span>
                    <span>{fmt((tradePlan.entry.low + tradePlan.entry.high) / 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8ab4f8]/50">Stop</span>
                    <span>{fmt(tradePlan.stop.price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8ab4f8]/50">Alvo 1</span>
                    <span>{fmt(tradePlan.targets[0]?.price)}</span>
                  </div>
                </div>
              )}
              <label className="flex items-center justify-between gap-2">
                <span className="text-[#8ab4f8]/50">Tamanho (USDT)</span>
                <input
                  type="number"
                  min="0"
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  className="w-24 bg-black/40 border border-[#8ab4f8]/20 rounded px-2 py-1 text-right text-[#e8f4ff]"
                />
              </label>
              <button
                type="button"
                onClick={handleOpen}
                disabled={!tradePlan || !(Number(sizeInput) > 0)}
                className="w-full py-2 rounded bg-[#00f0ff]/15 border border-[#00f0ff]/40 text-[#00f0ff] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ABRIR POSIÇÃO SIMULADA
              </button>
            </>
          ) : (
            <>
              <div className="cyber-panel bg-black/30 p-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8ab4f8]/50">Direção</span>
                  <span className={position.direction === "LONG" ? "text-[#00ffaa]" : "text-[#ff4d6d]"}>{position.direction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8ab4f8]/50">Entrada</span>
                  <span>{fmt(position.entryPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8ab4f8]/50">Tamanho</span>
                  <span>{fmt(position.sizeUsdt, 0)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8ab4f8]/50">Preço atual</span>
                  <span>{livePrice !== null ? fmt(livePrice) : "—"}</span>
                </div>
              </div>
              <div className="cyber-panel bg-black/30 p-2 text-center">
                <div className="text-[#8ab4f8]/50 mb-1">P&amp;L NÃO REALIZADO</div>
                <div className={`text-lg font-bold ${pnl !== null && pnl >= 0 ? "text-[#00ffaa]" : "text-[#ff4d6d]"}`}>
                  {pnl !== null ? `${pnl >= 0 ? "+" : ""}${fmt(pnl, 2)} USDT` : "DADOS INSUFICIENTES"}
                </div>
                {pnlPct !== null && <div className="text-[#8ab4f8]/40">{fmtSignedPct(pnlPct)}</div>}
              </div>
              {ctx && (ctx.nearTarget || ctx.nearStop) && (
                <div className={`text-center ${ctx.nearTarget ? "text-[#00ffaa]" : "text-[#ff4d6d]"}`}>
                  {ctx.nearTarget ? "Perto do Alvo 1 — considere fechar" : "Perto do Stop — considere fechar"}
                </div>
              )}
              <button
                type="button"
                onClick={handleClose}
                disabled={livePrice === null}
                className="w-full py-2 rounded bg-[#ff4d6d]/15 border border-[#ff4d6d]/40 text-[#ff4d6d] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                FECHAR POSIÇÃO AGORA
              </button>
            </>
          )}
          {paperTrading.history.length > 0 && (
            <div className="pt-2 border-t border-[#8ab4f8]/10">
              <div className="text-[#8ab4f8]/40 mb-1">HISTÓRICO ({paperTrading.history.length})</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {[...paperTrading.history].reverse().slice(0, 20).map((rec, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-[#8ab4f8]/50">{rec.direction} · {rec.closeReason}</span>
                    <span className={rec.realizedPnl !== null && rec.realizedPnl >= 0 ? "text-[#00ffaa]" : "text-[#ff4d6d]"}>
                      {rec.realizedPnl !== null ? `${rec.realizedPnl >= 0 ? "+" : ""}${fmt(rec.realizedPnl, 2)}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// v16.0 DEFINITIVO §9.2: pilha de toasts, canto inferior direito, máx 5
// simultâneos (fila mais antiga cai primeiro — ver o `.slice(-5)` em
// App()). Puramente apresentacional: recebe `alerts` já prontos e um
// `onDismiss`, nunca lê a store nem o bus diretamente — mesma separação
// já usada por MarketAnalysisPanel/PaperTradingPanel (props vindas de
// App(), painel só desenha).
const ALERT_TONE_STYLE: Record<AlertEvent["tone"], { hex: string; border: string; text: string }> = {
  success: { hex: "#00ffaa", border: "border-l-[#00ffaa]", text: "text-[#00ffaa]" },
  info: { hex: "#00f0ff", border: "border-l-[#00f0ff]", text: "text-[#00f0ff]" },
  danger: { hex: "#ff0055", border: "border-l-[#ff0055]", text: "text-[#ff0055]" },
};

function AlertToastStack({ alerts, onDismiss }: { alerts: AlertEvent[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) return null;
  return (
    <div className="!fixed !z-[1200] bottom-3 right-3 flex flex-col gap-1.5 w-64 max-w-[85vw] pointer-events-none">
      {alerts.map((a) => {
        const tone = ALERT_TONE_STYLE[a.tone];
        return (
          <div
            key={a.id}
            className={`animate-fade-in pointer-events-auto cyber-panel !bg-[#010308]/95 border-l-2 ${tone.border} rounded px-2.5 py-2 relative overflow-hidden`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={`text-[0.55rem] font-black tracking-wide ${tone.text}`}>{a.title}</div>
                <div className="text-[0.48rem] text-[#8ab4f8]/80 mt-0.5 leading-snug">{a.message}</div>
              </div>
              <button
                type="button"
                aria-label="Fechar alerta"
                onClick={() => onDismiss(a.id)}
                className="text-[#8ab4f8]/50 active:text-[#8ab4f8] text-[0.6rem] leading-none shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="alert-toast-progress absolute left-0 bottom-0 h-[2px]" style={{ backgroundColor: tone.hex }} />
          </div>
        );
      })}
    </div>
  );
}

// --- RIGHT COLUMN: SIRIFORM CORE (V16 §1/§3) — compact real-status summary
// docked in the right column by default (se_core.collapsed: true). Never a
// second computation: engineStatus/direction/confidence/lorentzian all come
// straight from the SAME `engine`/`realCycle` the full AssistantOrb detail
// reads. "Expandir" flips the exact same `se_core.collapsed` flag the
// Workspace Manager panel controls — the full, unmodified AssistantOrb
// (forecast/voice/quick actions, nothing removed) renders below the
// 3-column row when expanded (see the DASHBOARD strip in App()).
// Ordem "Lapidação, Sincronia e Experiência do Operador" §6 ("Inteligência
// Narrativa") + §5 (painéis devem responder "por que o sistema está
// comprado?"): buildNarrativeSummary() já existe e já é testado
// (operational-readability.ts) — este componente só a exibe como TEXTO
// VISÍVEL, nunca um tooltip. Achado real de auditoria que motivou isto:
// o único lugar que já sintetizava BIAS/SETUP/ENTRY/RISCO/CONFLUÊNCIA em
// linguagem (buildOperationalSummary) só chegava ao Operador via
// `title=` no CoreSignalBadge — e o comentário do próprio badge documenta
// que tooltips nativos nunca aparecem em toque no iPad Safari (a
// plataforma-alvo real). Primeiro card da gaveta "Core Intelligence"
// (antes de SiriformCoreCard) — mesma leitura consolidada que o Operador
// já tinha matematicamente, agora genuinamente visível. Zero segunda
// leitura: reusa o MESMO nexusDecision que CoreSignalBadge já consome.
function NarrativeSummaryCard() {
  const { nexusDecision, engine, cvd } = useContext(WidgetContext) || {};
  // Entrega 26 Prioridade 8: contexto de mercado REAL repassado à narrativa
  // — regime pelo MESMO REGIME_DISPLAY do painel MARKET REGIME, fluxo pelo
  // MESMO sinal de CVD. Zero cálculo aqui: só leitura do que já existe.
  const regime = engine?.marketRegime ?? null;
  const regimeDisplay = regime ? REGIME_DISPLAY[regime.regime] : null;
  const narrative = buildNarrativeSummary(nexusDecision ?? null, {
    regimeLabel: regimeDisplay
      ? `${regimeDisplay.label}${regime!.direction ? ` ${regime!.direction}` : ""}`
      : null,
    flow: num(cvd) && cvd !== 0 ? (cvd! > 0 ? "COMPRADOR" : "VENDEDOR") : null,
  });
  return (
    <div className="cyber-panel shrink-0 flex flex-col gap-1.5 p-3">
      <span className="font-bold tracking-[0.2em] text-[0.55rem] uppercase text-[#00f0ff]">
        LEITURA CONSOLIDADA
      </span>
      {/* Lapidação Visual (DIRETRIZ 7): #c8d4e6 era um cinza-azulado de uso
          único em toda a árvore — trocado pela cor de texto base real do app
          (#a0f0ff, a mesma do container raiz), levemente suavizada para
          leitura prolongada de prosa. Zero cor nova. */}
      <p className="text-[0.65rem] leading-relaxed text-[#a0f0ff]/85">{narrative}</p>
    </div>
  );
}

function SiriformCoreCard() {
  const { engine, engineStatus, realCycle, widgets, toggleWidget, nexusDecision } = useContext(WidgetContext) || {};
  const direction: Direction = engine?.direction ?? null;
  // Continuidade (sincronização BIAS≠ENTRY): mesmo qualificador real já
  // testado (OUTCOME_QUALIFIER/deriveOutcomeLabel) — concatenado ao valor
  // do MiniStat "Sinal" porque o componente reutilizável só aceita string
  // (nunca uma segunda versão do MiniStat só para isto).
  const sinalOutcome = nexusDecision ? deriveOutcomeLabel(nexusDecision) : null;
  const sinalOutcomeQualifier = sinalOutcome ? (OUTCOME_QUALIFIER[sinalOutcome] ?? null) : null;
  const sinalValue = direction ? (sinalOutcomeQualifier ? `${direction} · ${sinalOutcomeQualifier}` : direction) : AWAIT;
  const collapsed = widgets?.se_core?.collapsed ?? true;
  const statusLabel = engineStatus === "pending" ? AWAIT : engineStatus === "ok" ? "SYNCED" : "FAILED";
  const statusColor =
    engineStatus === "pending" ? "text-[#f0d06f]" : engineStatus === "ok" ? "text-[#00ffaa]" : "text-[#ff0055]";
  const dirColor =
    direction === "LONG" ? "text-[#00ffaa]" : direction === "SHORT" ? "text-[#ff0055]" : "text-[#8ab4f8]/60";
  const lorentzian = realCycle?.lorentzian?.ok ? realCycle.lorentzian : null;
  const lorentzianLabel = lorentzian
    ? `${lorentzian.classification} · ${lorentzianConfidencePct(lorentzian)}%`
    : AWAIT;
  // Fusão visual (imagem de referência): anel de sincronização — nunca um
  // número inventado. 100% só quando o ciclo real do próprio engineStatus
  // (a MESMA variável que já orienta statusLabel acima) está "ok"; 0%
  // quando falhou; "pending" fica com o anel indeterminado (animate-spin),
  // nunca uma % fabricada enquanto o primeiro ciclo real ainda não voltou.
  const syncPct = engineStatus === "ok" ? 100 : engineStatus === "error" ? 0 : null;
  const syncColor = syncPct === 100 ? "#00ffaa" : syncPct === 0 ? "#ff0055" : "#f0d06f";

  return (
    <div className="cyber-panel shrink-0 flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="font-bold tracking-[0.2em] text-[0.55rem] uppercase text-[#00f0ff]">
          SIRIFORM INTELLIGENCE CORE
        </span>
        <button
          type="button"
          onClick={() => toggleWidget?.("se_core", "collapsed")}
          className="text-[0.4rem] tracking-[0.1em] font-bold uppercase text-[#8ab4f8] hover:text-[#00f0ff] px-1.5 py-0.5 rounded border border-[#8ab4f8]/20 shrink-0"
        >
          {collapsed ? "EXPANDIR" : "RECOLHER"}
        </button>
      </div>
      <div className="flex items-center justify-center py-1">
        <div
          className={`relative w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${syncPct === null ? "animate-spin [animation-duration:2.5s]" : ""}`}
          style={{
            background:
              syncPct === null
                ? `conic-gradient(${syncColor} 0% 25%, rgba(138,180,248,0.12) 25% 100%)`
                : `conic-gradient(${syncColor} ${syncPct}%, rgba(138,180,248,0.12) ${syncPct}% 100%)`,
          }}
        >
          <div className="absolute inset-[3px] rounded-full bg-[#010308] flex flex-col items-center justify-center">
            <span
              className={`text-[0.6rem] font-black ${syncPct === null ? "animate-spin [animation-duration:2.5s] [animation-direction:reverse]" : ""}`}
              style={{ color: syncColor }}
            >
              {syncPct === null ? "···" : `${syncPct}%`}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <MiniStat label="Analysis Cycle" value={statusLabel} color={statusColor} />
        <MiniStat label="Sinal" value={sinalValue} color={dirColor} />
        <MiniStat label="k-NN Lorentz." value={lorentzianLabel} color="text-[#8ab4f8]" />
        <MiniStat
          label="Estrutura (15m)"
          value={engine?.marketStructureLabel ?? AWAIT}
          color="text-[#8ab4f8]"
        />
      </div>
    </div>
  );
}

// v16.0 PRO Fase 1 ("Header Minimalista"): destino real dos 5 itens que
// saíram da barra sempre-visível — Score Institucional (+ tendência de
// Conviction), Heat Score, cartão VWAP, mensagem do Assistente e Kill
// Zone ICT. Mesmos dados reais, mesmas fórmulas (institutional-score.ts/
// heat-score.ts/vwap-bands.ts/operation-assistant.ts/kill-zones.ts), zero
// segunda leitura — só um novo lugar para ler, self-contained como os
// outros cards desta gaveta (SiriformCoreCard, GmilContextWidget). O
// tooltip de cada MiniStat carrega o mesmo detalhe que a TopBar já
// mostrava.
function ScoreContextCard() {
  const { institutionalScore, confidenceZone, convictionTrend, assistantMessages, heatReading, vwapCtx, nlState, nexusConfluence } =
    useContext(WidgetContext) || {};
  const killZones = activeKillZones(new Date());

  const scoreValue =
    institutionalScore?.score !== null && institutionalScore?.score !== undefined
      ? `${confidenceZone ? `${confidenceZone.emoji} ` : ""}${institutionalScore.score}%${
          convictionTrend?.status === "OK" && convictionTrend.trend
            ? ` ${convictionTrend.trend === "FORTALECENDO" ? "▲" : convictionTrend.trend === "ENFRAQUECENDO" ? "▼" : "▬"}`
            : ""
        }`
      : DASH;
  const scoreColor = confidenceZone === null ? "text-[#8ab4f8]/40" : confidenceZone.colorClass;
  const scoreTitle =
    institutionalScore?.score !== null && institutionalScore?.score !== undefined
      ? `Score real de confluência entre subsistemas (0-100), exibido como percentual — nunca probabilidade de acerto. Zona: ${confidenceZone?.label ?? DASH}. ${
          convictionTrend?.status === "OK" && convictionTrend.trend
            ? `Tendência: ${convictionTrend.trend} (média recente ${convictionTrend.recentAverage!.toFixed(1)} vs. anterior ${convictionTrend.priorAverage!.toFixed(1)}).`
            : "Histórico real ainda insuficiente para uma tendência honesta."
        }`
      : "Sem oportunidade direcional a pontuar agora (Core Engine em WAIT ou dados insuficientes).";

  const heatValue = heatReading?.status === "OK" ? `${heatReading.score}/100 · ${heatReading.tier}` : DASH;
  const heatColor =
    heatReading?.status !== "OK"
      ? "text-[#8ab4f8]/40"
      : heatReading.tier === "EXTREMO"
        ? "text-[#ff0055]"
        : heatReading.tier === "QUENTE"
          ? "text-[#f0d06f]"
          : heatReading.tier === "MORNO"
            ? "text-[#a0f0ff]"
            : "text-[#8ab4f8]/70";
  const heatTitle =
    heatReading?.status === "OK"
      ? `Heat ${heatReading.score}/100 (${heatReading.tier}) — intensidade de ATIVIDADE real: ${heatReading.components.map((c: { id: string; value01: number }) => `${c.id} ${(c.value01 * 100).toFixed(0)}%`).join(" · ")}. Nunca probabilidade, nunca direção.`
      : "Heat Score aguardando ao menos 2 componentes reais medidas (volatilidade/Δ24h/liquidações).";

  const vwapStateLabel = vwapCtx
    ? vwapCtx.state === "BULLISH"
      ? "COMPRADOR"
      : vwapCtx.state === "BEARISH"
        ? "VENDEDOR"
        : "NEUTRA"
    : "INSUFICIENTES";
  // Diretriz "Lapidação, Sincronia e Experiência do Operador" (achado já
  // documentado nesta base): tooltip nativo (title=) nunca aparece em
  // toque no iPad Safari, a plataforma-alvo real — por isso vwapStateLabel
  // precisa estar no VALOR visível, nunca só escondido no tooltip
  // (vwapTitle repete o mesmo rótulo como reforço para mouse/trackpad,
  // nunca como única fonte).
  const vwapValue = vwapCtx
    ? `${fmt(vwapCtx.vwap, vwapCtx.vwap >= 1000 ? 0 : 2)} ${vwapCtx.state === "BULLISH" ? "↑" : vwapCtx.state === "BEARISH" ? "↓" : "•"} ${fmtSignedPct(vwapCtx.distancePct)} · ${vwapStateLabel}`
    : "DADOS INSUFICIENTES";
  const vwapColor = !vwapCtx
    ? "text-[#8ab4f8]/40"
    : vwapCtx.state === "BULLISH"
      ? "text-[#00ffaa]"
      : vwapCtx.state === "BEARISH"
        ? "text-[#ff0055]"
        : "text-[#f0d06f]";
  const vwapTitle = vwapCtx
    ? `Preço ${vwapCtx.side === "ACIMA" ? "acima" : vwapCtx.side === "ABAIXO" ? "abaixo" : "na linha"} da VWAP: ${vwapCtx.distancePct >= 0 ? "+" : ""}${vwapCtx.distancePct.toFixed(2)}% (${vwapCtx.distanceAbs >= 0 ? "+" : ""}${vwapCtx.distanceAbs.toFixed(2)} abs). Estado ${vwapCtx.state} (${vwapStateLabel}) com histerese real. Nexus Line: ${nlState}. ${
        nexusConfluence === "ALINHADA"
          ? "Confluência VWAP×NL×Decisão: ALINHADA."
          : nexusConfluence === "CONFLITO_ESTRUTURAL"
            ? "CONFLITO ESTRUTURAL VWAP/NL/Decisão — informativo, nunca altera a operação (LEI 24)."
            : "Sem veredito de confluência (leitura incompleta ou AGUARDAR)."
      }`
    : "VWAP aguardando volume real da sessão UTC (fail-closed, nunca um valor fabricado).";
  // §30 (confluência VWAP×NL×Decisão): sufixo ✓/⚠ visível no RÓTULO — a
  // mesma posição/semântica de sempre, mas title= não aparece em toque no
  // iPad Safari (achado já documentado nesta base), então o veredito
  // precisa estar no texto sempre visível, não só no tooltip acima.
  const vwapLabel = nexusConfluence ? `VWAP ${nexusConfluence === "ALINHADA" ? "✓" : "⚠"}` : "VWAP";

  return (
    <div className="cyber-panel shrink-0 flex flex-col gap-2 p-3">
      <span className="font-bold tracking-[0.2em] text-[0.55rem] uppercase text-[#00f0ff]">
        SCORE &amp; CONTEXTO
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        <MiniStat label="Score Institucional" value={scoreValue} color={scoreColor} title={scoreTitle} />
        <MiniStat label="Heat Score" value={heatValue} color={heatColor} title={heatTitle} />
        <MiniStat label={vwapLabel} value={vwapValue} color={vwapColor} title={vwapTitle} />
      </div>
      {/* Diretriz V-MAX item 6: Assistente Operacional — a frase curta mais
          prioritária, sempre tradução de leitura real (LEI 24, ver
          operation-assistant.ts). O tooltip carrega a base real
          verificável ("nunca recomendação sem justificativa"). */}
      {assistantMessages && assistantMessages.length > 0 && (
        <div
          className="flex flex-col bg-[#010308] px-2 py-1.5 rounded border border-[#8ab4f8]/10"
          title={assistantMessages.map((m: { text: string; basis: string }) => `${m.text} — ${m.basis}`).join("\n")}
        >
          <span className="text-[0.4rem] text-[#8ab4f8]/60 font-bold tracking-widest uppercase">Assistente</span>
          <span
            className={`text-[0.55rem] font-bold tracking-wider uppercase ${
              assistantMessages[0].tone === "POSITIVE"
                ? "text-[#00ffaa]"
                : assistantMessages[0].tone === "RISK"
                  ? "text-[#ff0055]"
                  : assistantMessages[0].tone === "CAUTION"
                    ? "text-[#f0d06f]"
                    : "text-[#8ab4f8]/80"
            }`}
          >
            {assistantMessages[0].text}
          </span>
        </div>
      )}
      {killZones.active.length > 0 && (
        <div
          title="Kill Zone ICT ativa agora — janela estreita onde a atividade institucional (varredura de liquidez) historicamente se concentra. Janela fixa em UTC, aproximação de DST — nunca finge mais precisão do que existe."
          className="flex items-center gap-1.5 bg-[#010308] px-2 py-1.5 rounded border border-[#ffb02030]"
        >
          <Crosshair size={11} className="text-[#ffb020] shrink-0" />
          <span className="text-[0.5rem] font-black uppercase tracking-wider text-[#ffb020]">
            Kill Zone · {killZones.active.map((z) => z.label.replace("Kill Zone · ", "")).join(" + ")}
          </span>
        </div>
      )}
    </div>
  );
}

// Entrega 42 ("Profitability Engine"): expectativa real (após custos) do
// Track Record deste symbol:timeframe — mesmo expectancyFilter computado
// uma vez em App() e compartilhado via contextValue (ver comentário no
// ponto de cálculo). Mesmo padrão visual de ScoreContextCard acima
// (cyber-panel + MiniStat), sempre visível junto dele — a explicação de
// POR QUE o CoreSignalBadge pode mostrar NEUTRO precisa estar tão visível
// quanto o próprio badge (LEI 24: supressão nunca é silenciosa).
function ExpectancyCard() {
  const { expectancyFilter, calibrationResult }: { expectancyFilter?: FilterResult; calibrationResult?: CalibrationResult } =
    useContext(WidgetContext) || {};
  const stats = expectancyFilter?.stats ?? null;

  const badgeColor =
    expectancyFilter?.badge === "green"
      ? "text-[#00ffaa]"
      : expectancyFilter?.badge === "cyan"
        ? "text-[#a0f0ff]"
        : expectancyFilter?.badge === "amber"
          ? "text-[#f0d06f]"
          : expectancyFilter?.badge === "red"
            ? "text-[#ff0055]"
            : "text-[#8ab4f8]/40";

  const expectancyValue = stats ? `${stats.expectancyR >= 0 ? "+" : ""}${stats.expectancyR.toFixed(2)}R` : DASH;
  const winRateValue = stats ? `${(stats.winRate * 100).toFixed(0)}%` : DASH;
  const sharpeValue = stats && stats.sharpeRatio !== null ? stats.sharpeRatio.toFixed(2) : DASH;
  const maxDdValue = stats ? `${stats.maxDrawdownR.toFixed(2)}R` : DASH;
  const costValue = stats
    ? `${(stats.commissionImpactR + stats.slippageImpactR + stats.fundingImpactR).toFixed(3)}R`
    : DASH;
  const sampleValue = stats ? `${stats.totalTrades}` : "0";

  const expectancyTitle =
    "Expectativa real por trade (R-múltiplo) após comissão+slippage+funding reais sobre o Track Record JÁ resolvido — nunca hitRate isolado (Regra de Ouro 2: taxa de acerto alta com R:R ruim ainda perde dinheiro).";
  const sampleTitle = `Trades reais resolvidos rastreados neste symbol:timeframe. Amostra mínima de ${MIN_TRADES_FOR_VALID_EXPECTANCY} para uma leitura de expectativa válida — abaixo disso o badge fica neutro e o Núcleo nunca é suprimido (ausência de prova não é prova de inviabilidade).`;

  // Escopo Cirúrgico (Operador, Fase 3 — Calibração de Probabilidade):
  // "probabilidade" aqui só aparece quando REALMENTE calibrada (Platt 1999)
  // contra o Track Record real deste symbol:timeframe, com amostra
  // suficiente e tamanho sempre visível — exatamente a exceção honesta à
  // Regra de Ouro 2 (confiança nunca é probabilidade fabricada; isto não é
  // fabricado, é ajustado a outcomes reais, com o "n" sempre exposto).
  const calibratedValue =
    calibrationResult?.calibrated && calibrationResult.probability !== null ? `${calibrationResult.probability}%` : DASH;
  const calibratedTitle =
    "Probabilidade calibrada (Platt Scaling, Platt 1999) do score de fusão de modelos atual (SMC+Order Flow+Regime, orientado à direção do plano) contra o Track Record REAL deste symbol:timeframe — alvos suavizados (nunca 0/1 crus), nunca reivindica mais certeza do que a amostra sustenta.";

  return (
    <div className="cyber-panel shrink-0 flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold tracking-[0.2em] text-[0.55rem] uppercase text-[#00f0ff]">
          MOTOR DE LUCRATIVIDADE
        </span>
        <span className={`text-[0.45rem] font-black uppercase tracking-wide ${badgeColor}`}>
          {expectancyFilter?.label ?? DASH}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <MiniStat label="Expectativa" value={expectancyValue} color={badgeColor} title={expectancyTitle} />
        <MiniStat label="Amostra" value={sampleValue} color="text-[#8ab4f8]/70" title={sampleTitle} />
        <MiniStat label="Taxa de Acerto" value={winRateValue} color="text-[#8ab4f8]" title="Proporção real de trades resolvidos com resultado líquido positivo (já após custos)." />
        <MiniStat label="Sharpe" value={sharpeValue} color="text-[#8ab4f8]" title="Média/desvio padrão real do netR da amostra — traço nunca aparece quando o desvio padrão é zero (divisão fabricada nunca acontece aqui)." />
        <MiniStat label="Drawdown Máx." value={maxDdValue} color="text-[#8ab4f8]" title="Maior queda real pico-a-vale da curva de equity acumulada (soma de netR, ordem cronológica real)." />
        <MiniStat label="Custo Médio" value={costValue} color="text-[#8ab4f8]/70" title="Comissão + slippage + funding médios reais por trade, em R (taker fee e intervalo de funding verificados via pesquisa real; slippage é fração declarada do risco, nunca medida)." />
        <MiniStat
          label="Prob. Calibrada"
          value={calibratedValue}
          color={calibrationResult?.calibrated ? "text-[#00ffaa]" : "text-[#8ab4f8]/40"}
          title={calibratedTitle}
        />
      </div>
      {calibrationResult && !calibrationResult.calibrated && calibrationResult.reason && (
        <span className="text-[0.42rem] text-[#8ab4f8]/60 leading-tight">{calibrationResult.reason}</span>
      )}
      {/* LEI 24 — exceção pontual autorizada pelo Operador (ver CLAUDE.md,
          seção "LEI 24"): quando expectancyFilter.show é false, o
          CoreSignalBadge substitui a direção real do Núcleo por NEUTRO.
          Esta linha é a explicação SEMPRE visível dessa supressão — nunca
          silenciosa, nunca só no tooltip do badge. */}
      {expectancyFilter?.show === false && (
        <div className="flex items-start gap-1.5 bg-[#ff00550f] border border-[#ff005530] rounded px-2 py-1.5">
          <span className="text-[0.42rem] text-[#ff0055] leading-tight">
            Expectativa líquida real negativa nesta amostra — badge principal exibe NEUTRO no lugar da direção real do Núcleo (LEI 24, exceção autorizada pelo Operador). O Núcleo em si não foi alterado.
          </span>
        </div>
      )}
      {expectancyFilter?.warning && (
        <span className="text-[0.42rem] text-[#f0d06f]/80 leading-tight">{expectancyFilter.warning}</span>
      )}
    </div>
  );
}

// --- ASSISTANT ORB / S.E. CORE (center hero, detalhe completo — expandido
// sob demanda a partir do SiriformCoreCard acima) ---
const ASSISTANT_MESSAGES = [
  "NÚCLEO EM MODO LEITURA (READ_ONLY).",
  "SINCRONIZANDO FLUXO DE ORDENS REAL...",
  "MAPEANDO ESTRUTURA DE PREÇO (SWINGS REAIS).",
  "SEM EXECUÇÃO DE ORDEM — APENAS ANÁLISE.",
];

function AssistantOrb({ inCenter = false }: { inCenter?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const { widgets, engine, engineStatus, realCycle, voiceSnapshot, handleManualRestart, nexusDecision } =
    useContext(WidgetContext) || {};

  if (widgets && inCenter && !widgets.se_core?.visible) return null;

  const direction: Direction = engine?.direction ?? null;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  // Continuidade (sincronização BIAS≠ENTRY, último dos 4 lugares
  // auditados): mesmo deriveOutcomeLabel/OUTCOME_QUALIFIER real e testado.
  const orbOutcome = nexusDecision ? deriveOutcomeLabel(nexusDecision) : null;
  const orbOutcomeQualifier = orbOutcome ? (OUTCOME_QUALIFIER[orbOutcome] ?? null) : null;
  const entry: number | null = engine?.entry ?? null;
  const target: number | null = engine?.target ?? null;
  const stop: number | null = engine?.stop ?? null;
  const flowPressure: number | null = engine?.flowPressure ?? null;
  const moveToTargetPct: number | null = engine?.moveToTargetPct ?? null;
  const riskRewardRatio: number | null = engine?.riskRewardRatio ?? null;
  const target1Strength: { label: "FORTE" | "FRACA"; touches: number } | null = engine?.target1Strength ?? null;
  const target2Strength: { label: "FORTE" | "FRACA"; touches: number } | null = engine?.target2Strength ?? null;

  const dirLabel = isLong ? "LONG" : isShort ? "SHORT" : AWAIT;
  const dirColor = isLong
    ? "text-[#00ffaa]"
    : isShort
      ? "text-[#ff0055]"
      : "text-[#8ab4f8]/60";

  // Quick Action buttons are real UI gated by the real engine's confluence
  // state — but this terminal has no exchange API key and no order-send
  // path anywhere in the codebase (READ_ONLY/FAIL_CLOSED by design, not by
  // an unfinished feature). Tapping never places an order; it always
  // surfaces that fact instead of silently doing nothing or faking a
  // success.
  const handleAction = (label: string) => {
    setActionFeedback(`${label} · EXECUÇÃO DESABILITADA (READ_ONLY)`);
  };
  useEffect(() => {
    if (!actionFeedback) return;
    const t = setTimeout(() => setActionFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [actionFeedback]);

  useEffect(() => {
    if ((hovered || inCenter) && !inputValue) {
      const t = setInterval(() => {
        setMsgIdx((prev) => (prev + 1) % ASSISTANT_MESSAGES.length);
      }, 3500);
      return () => clearInterval(t);
    } else {
      setMsgIdx(0);
    }
  }, [hovered, inCenter, inputValue]);

  if (inCenter) {
    return (
      <div className="flex-1 shrink-0 flex flex-col items-center justify-between relative min-h-[500px] min-[1120px]:min-h-0 overflow-y-auto overscroll-contain scrollbar-hide z-0 group py-4 bg-[#010308]/72 backdrop-blur-3xl border border-[#00f0ff]/15 rounded-2xl shadow-[inset_0_0_90px_rgba(0,240,255,0.06),0_10px_40px_rgba(0,0,0,0.7)] w-full max-w-4xl mx-auto">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px]"></div>

        <div className="absolute top-3 left-0 right-0 flex justify-center opacity-50 text-[0.55rem] tracking-[0.4em] font-bold text-[#00f0ff] z-10">
          NÚCLEO DE INTELIGÊNCIA S.E.
        </div>

        <div
          className={`mt-6 [@media(max-height:1050px)]:mt-2 w-full px-4 sm:px-6 transition-all duration-700 ${hovered ? "opacity-20 blur-[2px]" : "opacity-100 blur-0"} z-10`}
        >
          <div className="flex flex-col gap-4 [@media(max-height:1050px)]:gap-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#00f0ff20] pb-2 gap-2 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className={`tracking-[0.2em] font-black whitespace-nowrap ${direction ? "text-base sm:text-lg" : "text-[0.6rem] sm:text-xs"} ${dirColor}`}
                >
                  VETOR {dirLabel}
                </span>
                <span className="text-[0.5rem] sm:text-[0.55rem] tracking-[0.2em] text-[#8ab4f8] font-bold uppercase opacity-80 mt-1 sm:mt-0">
                  (ESTRUTURA REAL)
                </span>
                {orbOutcomeQualifier && (
                  <span className="text-[0.5rem] sm:text-[0.55rem] tracking-[0.2em] text-[#8ab4f8]/70 font-bold uppercase mt-1 sm:mt-0">
                    · {orbOutcomeQualifier}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 bg-[#00ffaa10] px-3 py-1 rounded border border-[#00ffaa30]">
                <Wifi size={12} className="animate-pulse text-[#00ffaa]" />
                <span className="text-[0.5rem] sm:text-[0.55rem] tracking-[0.2em] text-[#00ffaa] font-bold">
                  DADOS REAIS · READ-ONLY
                </span>
              </div>
            </div>

            {/* Real engine status — honest state of the real-data + WASM +
                research pipeline cycle (engine-bridge.ts). Never implies a
                signal exists before the real engine has actually produced
                one.
                Auditoria Mestra 360° (secao 3): rotulo mudou de "WASM ENGINE"
                para "ANALYSIS CYCLE" — este indicador reporta o estado do
                CICLO INTEIRO (sonda Binance + init WASM + pipeline de
                pesquisa), nao so' do WASM; o WASM em si so' calcula SMA/EMA/
                stddev/zscore dentro desse ciclo, nunca o sinal LONG/SHORT
                mostrado (ver tacticalInput acima). */}
            <div className="flex items-center gap-2 mt-2 z-10">
              <div
                className={`w-1.5 h-1.5 rounded-full ${engineStatus === "ok" ? "bg-[#00ffaa] animate-pulse" : engineStatus === "error" ? "bg-[#ff0055]" : "bg-[#f0d06f] animate-pulse"}`}
              ></div>
              {engineStatus === "pending" ? (
                <span className="flex items-center gap-1.5 text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase text-[#f0d06f]">
                  CICLO DE ANÁLISE ·
                  <span className="skeleton-shimmer h-[0.6em] w-16 rounded-sm" />
                </span>
              ) : (
                <span
                  className={`text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase ${engineStatus === "ok" ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
                >
                  CICLO DE ANÁLISE ·{" "}
                  {engineStatus === "ok" ? "CONECTADO" : `FALHOU (${realCycle?.reason || DASH})`}
                </span>
              )}
              {engine.confidence && (
                <span className="text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase text-[#8ab4f8] border border-[#8ab4f8]/30 px-1.5 py-0.5 rounded">
                  CONFIANÇA {engine.confidence}
                </span>
              )}
              {/* Sinal de confluência INDEPENDENTE (k-NN Lorentziano sobre
                  features reais) — nunca substitui nem é substituído pelo
                  VETOR da Heurística de Tendência acima (SMA/EMA real, não
                  WASM — ver tacticalInput); amostra pequena (~60-90 pontos,
                  candles desta sessão) é reportada, nunca escondida. */}
              {realCycle?.lorentzian?.ok && (
                <span
                  className={`text-[0.45rem] sm:text-[0.5rem] tracking-[0.2em] font-bold uppercase border px-1.5 py-0.5 rounded ${
                    realCycle.lorentzian.classification === "LONG"
                      ? "text-[#00ffaa] border-[#00ffaa30]"
                      : realCycle.lorentzian.classification === "SHORT"
                        ? "text-[#ff0055] border-[#ff005530]"
                        : "text-[#8ab4f8] border-[#8ab4f8]/30"
                  }`}
                  title={`Amostra: ${realCycle.lorentzian.sampleSize} pontos históricos`}
                >
                  k-NN LORENTZ. {realCycle.lorentzian.classification} ·{" "}
                  {lorentzianConfidencePct(realCycle.lorentzian)}% (n=
                  {realCycle.lorentzian.sampleSize})
                </span>
              )}
            </div>

            <div className="flex flex-col mt-2 sm:mt-4 gap-4 [@media(max-height:1050px)]:mt-1 [@media(max-height:1050px)]:gap-2">
              {/* Structural levels — real distinct numbers once a direction
                  exists. Below that, a SINGLE waiting message: showing four
                  separate "AGUARDANDO" cards here (on top of the "VETOR
                  AGUARDANDO" headline above) repeated the same fact five
                  times on one screen for no informational gain. */}
              {direction ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <LevelCard
                    label="Entrada (Spot)"
                    value={entry}
                    accent="#00f0ff"
                    tag="REF"
                  />
                  <LevelCard
                    label={isShort ? "Target 1 · Support" : "Target 1 · Resistance"}
                    value={target}
                    accent="#00ffaa"
                    // Protocolo Mestre (Sincronização Global): Alvo 1 agora vem
                    // do swing fractal mais próximo (não mais o mínimo/máximo
                    // bruto da janela — ver analysis-frame.js), então também
                    // ganha o mesmo badge de força por confluência real que o
                    // Alvo 2 já tinha (V11.5 Fase 6).
                    tag={target1Strength?.label ?? "REAL"}
                  />
                  <LevelCard
                    label="Target 2 · Extension"
                    value={engine.target2}
                    accent="#00ffaa"
                    // V11.5 Fase 6: quando o motor confirma força por
                    // confluência real de swings, o badge mostra isso em vez
                    // do genérico "REAL" — mesmo espaço visual, mais
                    // informação (nunca uma probabilidade, ver
                    // support-resistance-engine.js).
                    tag={target2Strength?.label ?? "REAL"}
                    dim={!num(engine.target2)}
                  />
                  <LevelCard
                    label={isShort ? "Stop · Resistência" : "Stop · Suporte"}
                    value={stop}
                    accent="#ff0055"
                    tag="REAL"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-[#8ab4f8]/20 bg-[#8ab4f8]/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f0d06f] animate-pulse shrink-0"></div>
                  <span className="text-[0.5rem] sm:text-[0.55rem] tracking-[0.15em] text-[#8ab4f8] font-bold uppercase">
                    Motor real aguardando confirmação direcional para Entrada/Alvos/Stop — níveis estruturais brutos já disponíveis abaixo
                  </span>
                </div>
              )}

              {/* Previsão multi-horizonte REAL: o mesmo k-NN Lorentziano
                  re-rotulado para 4/8/16 velas (15m ≈ 1h/2h/4h). Leitura
                  probabilística com amostra declarada por horizonte — um
                  horizonte sem amostra vira chip apagado, nunca um número
                  inventado. Nunca gera ordem: READ_ONLY. */}
              {realCycle?.forecast && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.5rem] text-[#8ab4f8] tracking-[0.25em] font-bold uppercase flex items-center gap-2">
                    <Activity size={11} /> PREVISÃO MULTI-HORIZONTE (k-NN REAL)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {realCycle.forecast.map((f: any) => (
                      <div
                        key={f.horizonBars}
                        className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 ${
                          !f.ok
                            ? "border-[#8ab4f8]/10 opacity-40"
                            : f.classification === "LONG"
                              ? "border-[#00ffaa30] bg-[#00ffaa08]"
                              : f.classification === "SHORT"
                                ? "border-[#ff005530] bg-[#ff005508]"
                                : "border-[#8ab4f8]/20 bg-[#8ab4f8]/5"
                        }`}
                        title={f.ok ? `Amostra real: ${f.sampleSize} pontos` : f.reason}
                      >
                        <span className="text-[0.5rem] tracking-[0.15em] text-[#8ab4f8] font-black uppercase">
                          {f.horizonBars / 4}H
                        </span>
                        <span className="text-[0.4rem] tracking-[0.15em] text-[#8ab4f8]/50 uppercase">
                          {f.horizonBars} velas (15m)
                        </span>
                        <span
                          className={`text-[0.6rem] font-black tracking-[0.1em] ${
                            !f.ok
                              ? "text-[#8ab4f8]/40"
                              : f.classification === "LONG"
                                ? "text-[#00ffaa]"
                                : f.classification === "SHORT"
                                  ? "text-[#ff0055]"
                                  : "text-[#8ab4f8]"
                          }`}
                        >
                          {f.ok ? f.classification : AWAIT}
                        </span>
                        <span className="text-[0.45rem] text-[#8ab4f8]/60 font-mono">
                          {f.ok ? `${Math.round((f.confidence ?? 0) * 100)}% · n=${f.sampleSize}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Honest flow / move metrics — no PnL, no leverage, no win-rate. */}
              <div className="flex flex-col lg:flex-row gap-2 sm:gap-4">
                <div className="bg-gradient-to-br from-[#00f0ff10] to-[#00ffaa10] border border-[#00f0ff30] p-4 rounded-xl flex flex-col relative overflow-hidden flex-[1.2] justify-center items-center text-center transition-colors duration-500 shadow-[inset_0_0_30px_rgba(0,240,255,0.05)]">
                  <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#00f0ff10] to-transparent pointer-events-none"></div>
                  <span className="text-[0.6rem] text-[#a0f0ff] tracking-[0.25em] mb-2 font-bold uppercase z-10 flex items-center gap-2">
                    <Activity size={12} className="text-[#00f0ff]" /> MOVE ATÉ ALVO
                    ESTRUTURAL
                  </span>
                  <div className="flex items-center gap-3 z-10 mb-2">
                    <span className="text-3xl text-white font-black font-mono tracking-tight drop-shadow-[0_0_12px_rgba(0,240,255,0.5)]">
                      {num(moveToTargetPct) ? `${moveToTargetPct.toFixed(2)}%` : DASH}
                    </span>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-[#00f0ff] border-[#00f0ff50] bg-[#00f0ff10] text-[0.6rem] font-bold border px-2 py-0.5 rounded">
                        PRESSÃO {num(flowPressure) ? `${flowPressure.toFixed(1)}%` : DASH}
                      </span>
                      {/* V11.5 Fase 6: razão real distância-ao-alvo/distância-
                          à-invalidação (target-tracker.js) — nunca uma
                          probabilidade de acerto, ver comentário na fonte. */}
                      {num(riskRewardRatio) && (
                        <span className="text-[#f0d06f] border border-[#f0d06f]/40 bg-[#f0d06f]/10 text-[0.55rem] font-bold px-2 py-0.5 rounded">
                          R:R {riskRewardRatio.toFixed(2)}
                        </span>
                      )}
                      <span className="text-[#8ab4f8] border border-[#8ab4f8]/30 bg-[#8ab4f8]/5 text-[0.55rem] font-bold px-2 py-0.5 rounded">
                        SEM ALAVANCAGEM
                      </span>
                    </div>
                  </div>
                  <div className="w-full flex justify-between items-center text-[0.55rem] mt-2 border-t border-[#00f0ff20] pt-2 z-10 font-mono text-[#8ab4f8]">
                    <span>ENTRADA: {fmt(entry)}</span>
                    <span>ALVO: {fmt(target)}</span>
                    <span className="text-[#ff0055]">STOP: {fmt(stop)}</span>
                  </div>
                </div>

                <div className="bg-[#010205] p-3 rounded-xl border border-[#8ab4f8] flex flex-col flex-1 relative overflow-hidden shadow-[inset_0_0_15px_rgba(138,180,248,0.1)]">
                  <span className="text-[0.55rem] text-[#8ab4f8] tracking-[0.2em] mb-3 font-bold uppercase flex items-center gap-2">
                    <Activity size={12} /> NÍVEIS ESTRUTURAIS (MOTOR REAL)
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#00ffaa20]">
                      <span className="text-[0.5rem] text-[#00ffaa]/80 font-bold tracking-widest">
                        RESISTÊNCIA
                      </span>
                      <span className="text-[0.55rem] text-white font-mono">
                        {fmt(engine?.resistance ?? null)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#ff005520]">
                      <span className="text-[0.5rem] text-[#ff0055]/80 font-bold tracking-widest">
                        SUPORTE
                      </span>
                      <span className="text-[0.55rem] text-white font-mono">
                        {fmt(engine?.support ?? null)}
                      </span>
                    </div>
                    {engine?.marketStructureLabel && (
                      <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#00f0ff20]">
                        <span className="text-[0.5rem] text-[#00f0ff]/80 font-bold tracking-widest">
                          ESTRUTURA
                        </span>
                        <span className="text-[0.55rem] text-white font-mono">
                          {engine.marketStructureLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ação Rápida — real touch-friendly UI, gated by the real
                  engine's confluence state, but this terminal has no
                  exchange API key and no order-send path anywhere in the
                  codebase: READ_ONLY/FAIL_CLOSED by permanent design.
                  Tapping always surfaces that instead of placing an order
                  or faking success. */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[0.55rem] text-[#8ab4f8] tracking-[0.2em] font-bold uppercase flex items-center gap-2">
                    <Target size={12} /> AÇÃO RÁPIDA
                  </span>
                  {actionFeedback && (
                    <span className="text-[0.45rem] tracking-[0.15em] text-[#f0d06f] font-bold uppercase animate-fade-in">
                      {actionFeedback}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={!isLong}
                    onClick={() => handleAction("LONG")}
                    className={`py-3 rounded-lg border font-black tracking-[0.15em] text-[0.6rem] uppercase flex items-center justify-center gap-1.5 transition-colors ${isLong ? "border-[#00ffaa60] bg-[#00ffaa15] text-[#00ffaa] active:bg-[#00ffaa25]" : "border-[#8ab4f8]/15 bg-transparent text-[#8ab4f8]/30 cursor-not-allowed"}`}
                  >
                    <ArrowUpRight size={14} /> LONG
                  </button>
                  <button
                    type="button"
                    disabled={!isShort}
                    onClick={() => handleAction("SHORT")}
                    className={`py-3 rounded-lg border font-black tracking-[0.15em] text-[0.6rem] uppercase flex items-center justify-center gap-1.5 transition-colors ${isShort ? "border-[#ff005560] bg-[#ff005515] text-[#ff0055] active:bg-[#ff005525]" : "border-[#8ab4f8]/15 bg-transparent text-[#8ab4f8]/30 cursor-not-allowed"}`}
                  >
                    <ArrowDownRight size={14} /> SHORT
                  </button>
                  <button
                    type="button"
                    disabled
                    className="py-3 rounded-lg border border-[#8ab4f8]/15 bg-transparent text-[#8ab4f8]/30 cursor-not-allowed font-black tracking-[0.15em] text-[0.6rem] uppercase flex items-center justify-center gap-1.5"
                  >
                    <X size={14} /> CLOSE
                  </button>
                </div>
                <span className="text-[0.45rem] tracking-[0.15em] text-[#8ab4f8]/40 uppercase font-bold text-center">
                  Sem posição ao vivo · execução desabilitada por projeto (READ_ONLY)
                </span>
              </div>

              {/* IRON-VOICE fundido no núcleo — a voz É parte do S.E., não um
                  painel separado: mesmos dados, mesmo card, mesmo organismo. */}
              {voiceSnapshot && (
                <div className="flex flex-col gap-2 border-t border-[#00f0ff15] pt-3">
                  <span className="text-[0.55rem] text-[#8ab4f8] tracking-[0.2em] font-bold uppercase flex items-center gap-2">
                    <Wifi size={12} /> VOZ DO NÚCLEO · IRON-VOICE
                  </span>
                  <VoiceControlWidget snapshot={voiceSnapshot} onRefresh={handleManualRestart} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* S.E. central orb */}
        <div className="flex-1 flex items-center justify-center relative w-full mt-4 pb-8 min-h-[300px] [@media(max-height:1050px)]:min-h-[130px] [@media(max-height:1050px)]:pb-2 [@media(max-height:1050px)]:mt-1 overflow-hidden">
          <div className="absolute w-[360px] h-[360px] [@media(max-height:1050px)]:w-[150px] [@media(max-height:1050px)]:h-[150px] rounded-full border border-[#00f0ff1a] animate-[spin_30s_linear_infinite] pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#00f0ff] rounded-full shadow-[0_0_15px_#00f0ff]"></div>
          </div>
          <div className="absolute w-[280px] h-[280px] [@media(max-height:1050px)]:w-[115px] [@media(max-height:1050px)]:h-[115px] rounded-full border border-[#00f0ff15] animate-[spin_20s_linear_infinite_reverse] pointer-events-none">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#00ffaa] rounded-full shadow-[0_0_10px_#00ffaa]"></div>
          </div>

          <div
            className={`relative z-10 flex flex-col items-center justify-center transition-all duration-700 ease-out ${hovered ? "scale-105" : "scale-100"}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
              if (!inputValue) setHovered(false);
            }}
          >
            <div
              className={`absolute w-64 h-64 [@media(max-height:1050px)]:w-28 [@media(max-height:1050px)]:h-28 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.25)_0%,transparent_70%)] blur-2xl transition-all duration-1000 ${hovered ? "opacity-100 scale-125 animate-[pulse_2s_ease-in-out_infinite]" : "opacity-50 scale-100 animate-[pulse_4s_ease-in-out_infinite]"}`}
            ></div>

            <div
              className={`relative w-32 h-32 [@media(max-height:1050px)]:w-16 [@media(max-height:1050px)]:h-16 rounded-full border-[3px] border-[#00f0ff60] bg-[#010205] flex items-center justify-center shadow-[0_0_50px_rgba(0,240,255,0.4)] transition-all duration-500 overflow-hidden cursor-pointer ${hovered ? "w-[450px] h-[120px] max-w-[90vw] rounded-2xl border-[#00f0ff] shadow-[0_0_60px_#00f0ff] bg-[#00f0ff0a] backdrop-blur-2xl" : ""}`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hovered ? "opacity-0 pointer-events-none" : "opacity-100"}`}
              >
                <div className="w-24 h-24 rounded-full bg-[#00f0ff] opacity-10 animate-ping"></div>
                <div className="w-16 h-16 rounded-full bg-[#00f0ff] opacity-20 animate-pulse absolute"></div>
                <div className="absolute w-6 h-6 rounded-full bg-white shadow-[0_0_20px_#fff,0_0_40px_#00f0ff]"></div>
              </div>

              <div
                className={`absolute inset-0 flex flex-col justify-center px-4 sm:px-8 transition-opacity duration-700 delay-100 ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#00f0ff] shadow-[0_0_30px_#00f0ff] animate-pulse shrink-0 flex items-center justify-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full"></div>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[0.5rem] sm:text-[0.55rem] text-[#8ab4f8] tracking-[0.2em] font-bold uppercase mb-[2px]">
                      S.E. · NÚCLEO READ-ONLY
                    </span>
                    <span className="text-[0.6rem] sm:text-[0.7rem] text-white font-bold tracking-[0.1em] truncate animate-fade-in drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]">
                      {ASSISTANT_MESSAGES[msgIdx]}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 sm:gap-4 items-center mt-3 sm:mt-4 bg-[#010205]/60 px-3 py-2 sm:px-4 sm:py-2 rounded-lg border border-[#00f0ff40]">
                  <input
                    type="text"
                    placeholder="NOTA DE ANÁLISE (LOCAL)..."
                    className="flex-1 bg-transparent border-none outline-none text-[0.6rem] sm:text-[0.65rem] text-white font-bold tracking-widest placeholder-[#00f0ff50]"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setInputValue("");
                        setHovered(false);
                      }
                    }}
                  />
                  <div className="flex gap-[2px] sm:gap-[4px] items-end h-4 sm:h-5 shrink-0">
                    {[40, 70, 30, 80, 55, 90, 45, 65].map((h, i) => (
                      <div
                        key={i}
                        className="w-[2px] sm:w-[3px] bg-[#00f0ff]/40 rounded-full"
                        style={{ height: `${h}%` }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full px-4 sm:px-8 text-center z-10 mt-auto pb-4 [@media(max-height:1050px)]:pb-1 shrink-0">
          <div className="inline-block bg-[#010205] border border-[#00f0ff20] px-4 py-2 [@media(max-height:1050px)]:py-1 [@media(max-height:1050px)]:px-2 rounded-lg text-[0.5rem] sm:text-[0.55rem] text-[#8ab4f8]/80 leading-relaxed text-justify max-w-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <strong className="text-[#00f0ff]">POLÍTICA DO ECOSSISTEMA:</strong>{" "}
            opera em{" "}
            <span className="text-[#00ffaa] font-bold">
              modo somente-leitura (READ_ONLY / FAIL_CLOSED)
            </span>
            . Nenhum valor é simulado: todo número vem de feed público real ou
            aparece como{" "}
            <span className="text-[#00f0ff] font-bold">AGUARDANDO</span>. Sem
            ordens, sem chaves de API, sem posição ao vivo.
          </div>
        </div>
      </div>
    );
  }

  // Único ponto de montagem é o centro do cockpit (inCenter) — a antiga
  // variante FAB flutuante nunca era montada e foi removida como código
  // morto na consolidação RC1.
  return null;
}

const LevelCard = React.memo(function LevelCard({
  label,
  value,
  accent,
  tag,
  dim,
}: {
  label: string;
  value: number | null;
  accent: string;
  tag: string;
  dim?: boolean;
}) {
  const has = num(value);
  return (
    <div
      className="p-2 sm:p-3 rounded-lg border flex flex-col relative overflow-hidden transition-colors"
      style={{
        background: `${accent}08`,
        borderColor: `${accent}20`,
        opacity: dim || !has ? 0.55 : 1,
      }}
    >
      <div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ background: accent }}
      ></div>
      <div className="flex justify-between items-center pl-1 sm:pl-2 w-full">
        <span
          className="text-[0.5rem] sm:text-[0.55rem] tracking-[0.2em] font-bold uppercase"
          style={{ color: `${accent}cc` }}
        >
          {label}
        </span>
        <span
          className="text-[0.5rem] font-bold border px-1 rounded"
          style={{ color: accent, borderColor: `${accent}30`, background: `${accent}10` }}
        >
          {tag}
        </span>
      </div>
      <div className="flex items-end mt-1 pl-1 sm:pl-2">
        <span
          className="text-base sm:text-lg font-black font-mono tracking-tight"
          style={{ color: has ? "#ffffff" : "rgba(255,255,255,0.25)" }}
        >
          {has ? fmt(value) : AWAIT}
        </span>
      </div>
    </div>
  );
});

// --- NÚCLEO + VOZ (V18.1, fusão aprovada pelo Operador) ---
// O núcleo vivia escondido: o AssistantOrb rico ("bolinha circulando" +
// IRON-VOICE) só renderiza quando o card Siriform está expandido (se_core
// começa collapsed). Esta é a fusão pedida — um orb compacto SEMPRE
// visível na barra de comando, ao lado do botão de energia ("lá onde tem
// o botãozinho de ligar no cantinho"), fundindo as duas coisas reais que
// já existem: o estado do núcleo (engineStatus — a MESMA variável do
// SiriformCoreCard/AssistantOrb, mapeamento V18 §1.2: verde-azulado=ok,
// âmbar=aguardando, vermelho suave=falha) e o controle de voz
// (voiceEngine, o MESMO gesto real de ligar/desligar do
// VoiceControlWidget — que continua intacto no painel expandido: a fusão
// não remove nada, "perder nada"). O push-to-talk continua exclusivo do
// VoiceControlWidget de propósito: dois pontos de captura simultâneos
// duplicariam o handler de resultado do reconhecimento (fala respondida
// duas vezes) — um risco real, não uma economia.
function NucleoVoiceOrb() {
  const { engineStatus } = useContext(WidgetContext) || {};
  const [voiceStatus, setVoiceStatus] = useState(() => voiceEngine.getStatus());
  useEffect(() => voiceEngine.onStatus(setVoiceStatus), []);

  // V-MAX Fase 0.9 (Blueprint §3.4 "NucleoVoiceOrb 100% reativo" / §5.1
  // "Offline: offline=true, Orb STALE/âmbar"): honestidade além do
  // engineStatus isolado. offline (navigator.onLine real, Fase 0.4) e
  // isDataFresh (Health Monitor real, Fase 0.8) agora existem — o orb
  // nunca mostra "SYNCED" (teal) se a conexão caiu ou se os dados
  // que alimentam o ciclo pararam de chegar, mesmo que o ÚLTIMO ciclo
  // completado tenha sido "ok". "pending" (aguardando o primeiro ciclo,
  // boot) é distinto de "desatualizado" (já teve ciclo ok, mas os dados
  // reais pararam de chegar depois) — checado nessa ordem para nunca
  // confundir os dois.
  const offline = useOfflineSnapshot();
  const isDataFresh = useDataFreshSnapshot();
  const stale = engineStatus === "ok" && !isDataFresh;
  // V-MAX Fase 1 item 5: CPI real (memória afetiva Reward/Pain com
  // decaimento, nexus/affective-memory.ts) alimentado ao orb via a store —
  // exibido no title. Deliberadamente NÃO altera a cor: a cor é o estado
  // operacional INSTANTÂNEO (offline/erro/pending/stale, hierarquia
  // fail-closed da Fase 0.9); o CPI é MEMÓRIA da sessão — deixá-lo pintar
  // o orb de verde mascararia um estado degradado atual (proibido).
  const cpi = useCpiSnapshot();
  const cpiLabel = cpi === null ? DASH : `${Math.round(cpi * 100)}%`;

  let coreColor: string;
  let coreLabel: string;
  if (offline) {
    coreColor = "#f0d06f"; coreLabel = "OFFLINE";
  } else if (engineStatus === "error") {
    coreColor = "#ff0055"; coreLabel = "FAILED";
  } else if (engineStatus === "pending") {
    coreColor = "#f0d06f"; coreLabel = AWAIT;
  } else if (stale) {
    coreColor = "#f0d06f"; coreLabel = "DESATUALIZADO";
  } else {
    coreColor = "#00ffaa"; coreLabel = "SYNCED";
  }
  const ttsSupported = voiceStatus.supported;

  // Mesmo gesto real do VoiceControlWidget: ligar a voz É a interação de
  // usuário que o iOS exige para liberar áudio; a confirmação falada é o
  // teste audível real.
  const handleToggleVoice = () => {
    if (!ttsSupported) return;
    const next = !voiceStatus.enabled;
    voiceEngine.setEnabled(next);
    if (next) voiceEngine.speak("Voz operacional. Modo somente leitura.", "INFO");
  };

  // v16.0 PRO Fase 1 ("Orbs de Núcleo/Voz... botão discreto no canto, não
  // orb visual pesado"): mesma cor 100% real (coreColor, derivada de
  // offline/engineStatus/stale acima, ZERO mudança de lógica), agora um
  // círculo plano pequeno (28px, mesma escala do badge de ativo à
  // esquerda da barra) — sem gradiente radial, sem halo em camadas, sem
  // anel orbital girando. O estado real continua 100% legível (cor da
  // borda/ícone + tooltip); só o peso visual foi removido.
  return (
    <button
      type="button"
      onClick={handleToggleVoice}
      title={`Núcleo S.E. · ${coreLabel} · CPI ${cpiLabel} · Voz ${!ttsSupported ? "INDISPONÍVEL" : voiceStatus.enabled ? "ATIVA" : "DESLIGADA"} (toque para alternar)`}
      className="ml-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-colors active:scale-95 shrink-0 border"
      style={{
        borderColor: `${coreColor}55`,
        backgroundColor: `${coreColor}15`,
      }}
    >
      {ttsSupported && voiceStatus.enabled ? (
        <Mic size={13} className={voiceStatus.speaking ? "animate-pulse" : ""} style={{ color: coreColor }} />
      ) : (
        <MicOff size={13} className="text-[#8ab4f8]/50" />
      )}
    </button>
  );
}

// Trade Plan strip (Autonomy order, priority 1): the critical numbers -
// signal, entry, stop, target - live in the command bar, delicate and
// tabular. Fail-closed: no coherent plan renders nothing (the bar stays
// clean instead of showing a placeholder). Subtle structure-break alert:
// when the live price crosses the plan's stop or target, the strip's tone
// shifts (red STOP BREACHED / green TARGET REACHED) - pure display
// derivation from real values already on screen, no new engine.
// Shared label-over-value chip for the command bar's trade-context strips
// (TradePlanTopStrip, StructureLevelsStrip below) — lifted to module scope
// once a second consumer needed the exact same visual language, rather
// than duplicating the JSX a second time. Classes are always passed as
// complete literal strings (never concatenated with a variable) — the
// Tailwind JIT scanner only generates CSS for tokens that appear by
// extenso in the source.
function BarField({
  label,
  value,
  labelClass,
  valueClass,
  hitClass,
  hit,
  title,
}: {
  label: string;
  value: string;
  labelClass: string;
  valueClass: string;
  hitClass?: string;
  hit?: boolean;
  title?: string;
}) {
  return (
    <div className="flex flex-col justify-center leading-none px-1.5" title={title}>
      <span className={`text-[0.4rem] tracking-[0.15em] font-bold uppercase whitespace-nowrap ${labelClass}`}>{label}</span>
      <span className={`text-[0.62rem] font-bold font-mono tabular-nums whitespace-nowrap ${hit && hitClass ? hitClass : valueClass}`}>
        {value}
      </span>
    </div>
  );
}

// EPC §5/§6 ("Nunca simplesmente esconder essas informações" — o motivo
// real da ausência de Trade Plan deve aparecer, não só a barra sumir):
// extraído da barra de comando (TradePlanTopStrip abaixo) pra ser
// reaproveitado também no CANVAS do gráfico (ChartWidget) — mesma lógica
// real, zero segunda implementação (Regra de Ouro 4). Cobre os 4 motivos
// reais possíveis, na mesma ordem de checagem de trade-plan.ts: sem
// Conselho ainda, risco travado, Conselho neutro/sem quórum (com ou sem
// o Núcleo já direcional — a divergência LEI 24 entre Núcleo e Conselho é
// real e honesta, nunca "corrigida" escondendo um dos dois lados), ou
// Conselho direcional mas sem estrutura real mapeável.
// Achado 2.4 (Visual Cleanup & Rendering Audit — pedido do Operador:
// "quando bater o alvo, automaticamente tentar analisar outro
// parâmetro"): investigação real confirmou que o Core Engine
// (setInterval 30s) e o Trade Plan (buildTradePlan, re-derivado a cada
// ciclo estrutural) já continuam reavaliando sozinhos, sem nenhum atraso
// — signal-track-record.ts:281-283 zera `active` no MESMO tick que prova
// o último alvo. O gap real nunca foi de dado, foi de APRESENTAÇÃO: sem
// plano ativo, tradePlanAbsenceReason() sempre mostrava um dos 4 motivos
// genéricos abaixo — idêntico a "nunca houve plano nesta sessão", mesmo
// no instante seguinte a um alvo real validado. Esta função cobre essa
// janela, reusando a MESMA convenção real que a Neural Market Aura já
// usa para "por quanto tempo uma resolução ainda é relevante mostrar"
// (DISSOLVE_CONFIG, aura-lifecycle.ts, agora exportado) — zero limiar
// novo inventado, zero segunda leitura do histórico (mesmo
// trackRecord.history que a Aura e o toast de alerta já leem). Só
// TARGET_HIT/PARTIAL_HIT entram aqui (Regra de Ouro 4: são validações
// reais dignas de "o sistema já seguiu em frente"); STOP_HIT continua
// caindo nos 4 motivos genéricos abaixo — uma perda limpa não é uma
// "resolução para anunciar", e re-explicar por que o Conselho está
// neutro/travado agora é mais honesto do que insistir no stop antigo.
function recentResolutionReason(
  lastResolvedPlan: TrackedPlan | null,
  nowMs: number,
  timeframeMs: number,
): { reason: string; tooltip: string } | null {
  if (!lastResolvedPlan) return null;
  if (lastResolvedPlan.status !== "TARGET_HIT" && lastResolvedPlan.status !== "PARTIAL_HIT") return null;
  if (lastResolvedPlan.resolvedAt === null || !Number.isFinite(timeframeMs) || timeframeMs <= 0) return null;
  const ageBars = (nowMs - lastResolvedPlan.resolvedAt) / timeframeMs;
  if (ageBars >= DISSOLVE_CONFIG.expireCandles) return null;
  if (lastResolvedPlan.status === "TARGET_HIT") {
    return {
      reason: "Alvo atingido · reanalisando",
      tooltip: "O último plano completou todos os alvos reais (ladder inteiro validado). O Core Engine e o Conselho já seguem reavaliando a estrutura ao vivo, no mesmo ciclo de sempre, para o próximo plano real — nunca um placeholder parado no alvo antigo.",
    };
  }
  return {
    reason: "Alvo parcial · reanalisando",
    tooltip: "O último plano validou pelo menos um alvo real antes do preço devolver ao stop já ajustado (ganho parcial honesto, nunca contado como perda). O Core Engine e o Conselho já seguem reavaliando a estrutura ao vivo para o próximo plano real.",
  };
}

function tradePlanAbsenceReason(
  council: CouncilDecision | null,
  coreDir: "LONG" | "SHORT" | null,
  recentResolution?: { reason: string; tooltip: string } | null,
): { reason: string; tooltip: string } {
  if (recentResolution) return recentResolution;
  if (!council) {
    return {
      reason: "Aguardando Conselho",
      tooltip: "O Conselho Multi-Agente ainda não computou nenhuma leitura nesta sessão — sem base real para um plano ainda.",
    };
  }
  if (council.riskGated) {
    return {
      reason: "Conselho travado (risco)",
      tooltip: "O RiskAgent absteve por dado degradado e travou o Conselho (fail-closed) — nenhum plano acionável enquanto durar.",
    };
  }
  if (council.stance === "NEUTRAL" || council.stance === "ABSTAIN") {
    return coreDir
      ? {
          reason: `Núcleo ${coreDir}, Conselho neutro`,
          tooltip: `O Core Engine (LEI 24, única decisão real de LONG/SHORT/WAIT) lê ${coreDir}, mas o Conselho Multi-Agente — mais conservador, soma várias fontes independentes — está neutro ou sem quórum direcional. O Trade Plan usa a base do Conselho, não a do Núcleo diretamente; por isso Entry/Stop/Target não aparecem agora mesmo com o Núcleo direcional. Nunca um plano fabricado sem essa base.`,
        }
      : {
          reason: "Conselho neutro",
          tooltip: "O Conselho Multi-Agente está neutro ou sem quórum direcional — sem base real para Entry/Stop/Target agora.",
        };
  }
  return {
    reason: `Conselho ${council.stance}, sem estrutura`,
    tooltip: `O Conselho lê ${council.stance}, mas nenhuma estrutura real mapeada (Order Blocks, FVGs, S/R, Fibonacci, Volume Profile) forma uma entrada/invalidação/alvo coerentes agora — nunca um plano fabricado sem base real.`,
  };
}

function TradePlanTopStrip({ livePrice }: { livePrice: number | null }) {
  const plan = useTradePlanSnapshot();
  // v2 (Diretriz Complementar §2/§4): a barra compacta mostra o PRÓXIMO
  // alvo real ainda não provado (autoritativo — mesmo ratchet real que
  // signal-track-record.ts mantém, nunca um "hit" re-derivado só da
  // livePrice instantânea, que voltaria a "false" se o preço recuar depois
  // de já ter tocado o nível). "Sem excesso de informações" (Diretriz §7):
  // 1 número aqui, o painel Trade Plan (ModulePanel) mostra a escada
  // inteira.
  const trackRecord = useTrackRecordSnapshot();
  const { convictionReading, etaReading, engine, chartTimeframe } = useContext(WidgetContext) || {};
  const council = useCouncilSnapshot();
  // Refinamento Final §7 ("integradas ao Trade Plan"): leitura real de
  // Premium/Discount da store — display-only, qualifica a QUALIDADE da
  // zona de entrada do plano (comprar em Discount / vender em Premium é a
  // convenção SMC), nunca bloqueia nem altera o plano (LEI 24).
  const premiumDiscount = usePremiumDiscountSnapshot();
  if (!plan) {
    // Achado real desta sessão (relato do Operador: "Entry/Target não
    // aparece"): trade-plan.ts trava o plano pela leitura do CONSELHO
    // (stance/riskGated — "No plan without a directional stance"), NUNCA
    // pela direção própria do Core Engine (o badge herói acima usa
    // engine?.direction). As duas leituras podem divergir de forma real
    // e honesta — o Núcleo pode indicar LONG/SHORT enquanto o Conselho
    // (mais conservador: soma 7 agentes, trava por risco degradado) ainda
    // não confirma. Esta barra antes desaparecia por completo (return
    // null silencioso) nesse estado — o Operador não tinha como distinguir
    // "bug" de "nenhum plano acionável agora". Correção: NUNCA trocar qual
    // sinal trava o Trade Plan (território de LEI 24 — decisão do
    // Operador, não uma correção de bug) — só tornar o null honesto e
    // visível, com o motivo real. EPC §5/§6: a derivação em si agora vive
    // em tradePlanAbsenceReason (módulo), reaproveitada também pelo
    // CANVAS do gráfico — zero segunda implementação.
    const coreDir = engine?.direction ?? null;
    const lastResolved = trackRecord.history[trackRecord.history.length - 1] ?? null;
    const timeframeMs = TIMEFRAME_MS[chartTimeframe as string] ?? TIMEFRAME_MS["15m"];
    const recentResolution = recentResolutionReason(lastResolved, Date.now(), timeframeMs);
    const { reason, tooltip } = tradePlanAbsenceReason(council, coreDir, recentResolution);
    return (
      <div className="flex items-stretch pr-2 md:pr-3 border-r border-[#00f0ff20] whitespace-nowrap" title={tooltip}>
        <BarField label="Trade Plan" value={reason} labelClass="text-[#8ab4f8]/50" valueClass="text-[#8ab4f8]/70" />
      </div>
    );
  }
  const targetsHit = trackRecord.active?.targetsHit ?? 0;
  const activeTargetIndex = Math.min(targetsHit, plan.targets.length - 1);
  const activeTarget = plan.targets[activeTargetIndex];
  const breakEvenActive = targetsHit > 0;
  const effectiveStopPrice = effectiveStopForTargetsHit(plan, targetsHit);
  const long = plan.direction === "LONG";
  const p = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : null;
  const targetHit = activeTargetIndex < targetsHit; // true once the ladder already proved this rung (authoritative, never re-derived)
  const stopHit = p !== null && !targetHit && (long ? p <= effectiveStopPrice : p >= effectiveStopPrice);
  const f = (v: number) => v.toFixed(v >= 1000 ? 0 : 2);
  // Diretriz Complementar §3/§7: ETA dinâmica real do alvo ATIVO — mesma
  // leitura única computada em App() (contexto), nunca recalculada aqui.
  // null honesto (sem progresso direcional/ATR/horizonte) => campo ausente.
  const activeEta = etaReading?.status === "OK" ? (etaReading.etas[activeTargetIndex] ?? null) : null;
  // Diretriz Mestra §6: faixa [mínimo, provável] do mesmo modelo real —
  // "12–20m" em vez de um único número (formatEtaRange, eta-engine.ts).
  const etaLabel = activeEta && !targetHit ? formatEtaRange(activeEta.msMin ?? null, activeEta.ms) : null;
  // Bandeira de divergência real (achado real de auditoria, FASE Ω Priority
  // 3): o Confluence Engine (Phase Ω Priority 2) já calcula, todo ciclo, se
  // os 3 subsistemas independentes concordam com a direção ATIVA do Core
  // Engine — reaproveitado aqui, nunca recomputado (LEI 24: puro display,
  // nunca altera plan/engine.direction). Só compara quando a leitura é
  // sobre a MESMA direção do plano aberto: se o Core Engine já mudou de
  // direção desde a abertura do plano, coreDirection !== plan.direction e
  // a comparação seria enganosa — nesse caso, honestamente, nenhuma
  // bandeira (o plano em si já está desatualizado, outro problema).
  const convictionForThisPlan =
    convictionReading && convictionReading.status === "OK" && convictionReading.coreDirection === plan.direction
      ? convictionReading
      : null;
  const diverging = convictionForThisPlan !== null && convictionForThisPlan.verdict !== "CONFIRMS";
  const entryLabel = plan.entry.low === plan.entry.high ? f(plan.entry.low) : `${f(plan.entry.low)}–${f(plan.entry.high)}`;
  // Redesenho radical (modelo do Operador): "E/S/T" mono cramped viram
  // rótulos limpos em inglês (Entry Zone/Target/Stop) — label pequeno
  // acima, valor tabular abaixo — só a apresentação muda, a detecção real
  // de targetHit/stopHit é idêntica.
  // Geometria real medida (Playwright + CSS compilado): Entry/Target/Stop/
  // R:R + Support/Resistance juntos NÃO cabem numa única linha 1 em iPad
  // portrait (768-834px) sem voltar a abreviações cramped — por isso este
  // grupo agora mora na linha 2 da barra (flex-wrap, ver TopBar), nunca
  // escondido: iPad portrait é um viewport-alvo real desta sessão.
  return (
    <div
      className={`flex items-stretch pr-2 md:pr-3 border-r border-[#00f0ff20] whitespace-nowrap transition-colors duration-500 ${
        targetHit ? "drop-shadow-[0_0_8px_rgba(0,255,170,0.35)]" : stopHit ? "drop-shadow-[0_0_8px_rgba(255,0,85,0.35)]" : ""
      }`}
      title="Trade Plan - real structure only (advisory, read-only terminal). Entry/Stop/Target are real levels mapped by the engines."
    >
      <BarField label="Entry Zone" value={entryLabel} labelClass="text-[#f0d06f]/70" valueClass="text-[#f0d06f]/90" />
      <BarField
        label={plan.targets.length > 1 ? `Target ${activeTargetIndex + 1}/${plan.targets.length}` : "Target"}
        value={f(activeTarget.price)}
        labelClass="text-[#00ffaa]/70"
        valueClass="text-[#00ffaa]/90"
        hitClass="text-[#00ffaa] drop-shadow-[0_0_5px_currentColor]"
        hit={targetHit}
      />
      <BarField
        label={targetsHit >= 2 ? `Stop (Alvo ${targetsHit - 1})` : breakEvenActive ? "Stop (B/E)" : "Stop"}
        value={f(effectiveStopPrice)}
        labelClass="text-[#ff0055]/70"
        valueClass="text-[#ff0055]/90"
        hitClass="text-[#ff0055] drop-shadow-[0_0_5px_currentColor]"
        hit={stopHit}
      />
      {plan.riskRewardRatios[activeTargetIndex] !== null && (
        <BarField label="R : R" value={`1:${plan.riskRewardRatios[activeTargetIndex]!.toFixed(2)}`} labelClass="text-[#8ab4f8]/60" valueClass="text-[#8ab4f8]/80" />
      )}
      {/* Diretriz Complementar §3/§7: "Tempo estimado até Alvo 1" no
          cabeçalho — estimativa dinâmica real (nunca garantia, §8); o
          tooltip carrega a base verificável (distância/ATR/ER reais). */}
      {etaLabel && (
        <BarField
          label="ETA"
          value={etaLabel}
          labelClass="text-[#8ab4f8]/60"
          valueClass="text-[#8ab4f8]/80"
          title={`${activeEta!.basis}. Recalculada continuamente — nunca afirma que o mercado "vai" atingir o alvo (§8).`}
        />
      )}
      {/* Refinamento Final §7: em qual terço do dealing range real a ENTRADA
          do plano está — Discount favorece LONG, Premium favorece SHORT
          (convenção SMC). Contexto display-only: o plano em si nunca é
          alterado/bloqueado por esta leitura (LEI 24). */}
      {premiumDiscount && (() => {
        const entryMid = (plan.entry.low + plan.entry.high) / 2;
        const span = premiumDiscount.rangeHigh.price - premiumDiscount.rangeLow.price;
        const entryPct = ((entryMid - premiumDiscount.rangeLow.price) * 100) / span;
        const entryZone = entryPct > 55 ? "PREMIUM" : entryPct < 45 ? "DISCOUNT" : "EQ";
        const favored = (long && entryZone === "DISCOUNT") || (!long && entryZone === "PREMIUM");
        return (
          <BarField
            label="Zona"
            value={`${entryZone}${favored ? " ✓" : ""}`}
            labelClass="text-[#b026ff]/60"
            valueClass={favored ? "text-[#00ffaa]/90" : entryZone === "EQ" ? "text-[#8ab4f8]/70" : "text-[#f0d06f]/90"}
            title={`Premium/Discount do dealing range real (últimos swings fractais confirmados: ${f(premiumDiscount.rangeLow.price)}–${f(premiumDiscount.rangeHigh.price)}, equilíbrio ${f(premiumDiscount.equilibrium)}). Entrada do plano em ${entryPct.toFixed(0)}% do range — ${favored ? `${entryZone} favorece ${plan.direction} (convenção SMC)` : entryZone === "EQ" ? "região de equilíbrio, sem vantagem de zona" : `${entryZone} NÃO é a zona classicamente favorável para ${plan.direction}`}. Contexto display-only (LEI 24).`}
          />
        );
      })()}
      {targetHit && <span className="self-center text-[0.48rem] font-black tracking-widest text-[#00ffaa] pl-1">TARGET REACHED</span>}
      {stopHit && <span className="self-center text-[0.48rem] font-black tracking-widest text-[#ff0055] pl-1">STOP BREACHED</span>}
      {!targetHit && !stopHit && diverging && (
        <span
          className="self-center text-[0.48rem] font-black tracking-widest text-[#f0d06f] pl-1"
          title={`Confluência real (Confluence Engine): ${convictionForThisPlan!.agreeingCount}/${convictionForThisPlan!.totalReadable} subsistemas concordam com ${plan.direction} agora — verdict ${convictionForThisPlan!.verdict}. Nunca altera o plano (LEI 24), só contexto.`}
        >
          CONVICTION {convictionForThisPlan!.verdict}
        </span>
      )}
    </div>
  );
}

// Support/Resistance in the always-visible bar (Operador feedback: seeing
// S1/R1 shouldn't require opening the ANALYSIS drawer). Deliberately a
// SEPARATE component from TradePlanTopStrip, not folded into it: S1/R1
// are Core Engine structural facts (real support-resistance-engine swing/
// pivot math, available whenever the engine has run) — independent of
// whether a coherent multi-agent Trade Plan currently exists (that needs
// council alignment + a clear risk gate on top). Same real fields already
// computed once in the `engine` useMemo and already fed to the chart's
// price lines (support/resistance/supportStrength/resistanceStrength/
// supportBreakouts/resistanceBreakouts) — zero new computation. Per Zero
// Repetição, the ANALYSIS "Market Structure" panel's own S1/R1 rows were
// removed in the same change (see SecondaryModuleView) — this bar is now
// their one and only home.
function StructureLevelsStrip() {
  const { engine } = useContext(WidgetContext) || {};
  const support: number | null = engine?.support ?? null;
  const resistance: number | null = engine?.resistance ?? null;
  if (support === null && resistance === null) return null;
  const f = (v: number) => v.toFixed(v >= 1000 ? 0 : 2);
  const strengthNote = (strength: { label: string; touches: number } | null | undefined, breakouts: number | undefined) =>
    strength ? ` · ${strength.label} ${strength.touches}x/${breakouts ?? 0}x` : "";
  return (
    <div
      className="flex items-stretch whitespace-nowrap"
      title="Core Engine structure (real support-resistance-engine swing/pivot levels) — independent of the advisory Trade Plan above."
    >
      {support !== null && (
        <BarField
          label="Support"
          value={f(support)}
          labelClass="text-[#00ffaa]/70"
          valueClass="text-[#00ffaa]/90"
          title={`Support (S1)${strengthNote(engine?.supportStrength, engine?.supportBreakouts)}`}
        />
      )}
      {resistance !== null && (
        <BarField
          label="Resistance"
          value={f(resistance)}
          labelClass="text-[#ff0055]/70"
          valueClass="text-[#ff0055]/90"
          title={`Resistance (R1)${strengthNote(engine?.resistanceStrength, engine?.resistanceBreakouts)}`}
        />
      )}
    </div>
  );
}

// Ordem "Entrega 26" Prioridade 4 ("O Operador deve conseguir responder em
// menos de 2 segundos: tendência? força? risco? liquidez? contexto? SEM
// ABRIR GAVETAS"): a Entrega 25 identificou exatamente esta lacuna — as
// leituras consolidadas viviam só dentro das gavetas fechadas por padrão —
// e a deixou registrada no backlog aguardando um gatilho explícito do
// Operador. Esta Ordem é esse gatilho, por escrito.
//
// Zero cálculo novo (regra explícita desta Ordem: "não recalcular dados na
// interface"): os 4 campos são leituras que os motores JÁ produzem e que
// hoje só aparecem dentro de painéis/gavetas —
//   REGIME      -> engine.marketRegime (regime-engine.js, ADX/DI), mesmo
//                  REGIME_DISPLAY que MarketRegimeWidget usa (zero segundo
//                  vocabulário de rótulo);
//   FLUXO       -> sinal do CVD real, MESMA regra de MarketRegimeWidget
//                  (>0 comprador, <0 vendedor) — a leitura de "liquidez/
//                  pressão" que a Ordem pede;
//   RISCO       -> deriveRiskState(nexusDecision) (operational-readability),
//                  o mesmo já exibido no painel Trade Plan;
//   CONFLUÊNCIA -> deriveConfluenceState(nexusDecision), idem.
// Deliberadamente FORA daqui, por já estarem sempre visíveis na linha 1
// (evitar a redundância que as Prioridades 1/9 desta mesma Ordem pedem
// para eliminar): direção LONG/SHORT (CoreSignalBadge) e o percentual de
// confluência institucional (badge de score).
//
// Fail-closed campo a campo: cada BarField só existe quando o valor real
// existe; sem nenhum valor real, a faixa inteira some (altura zero), nunca
// uma fileira de trações fabricados.
function ContextReadStrip() {
  const { engine, cvd, nexusDecision, displayConflicts } = useContext(WidgetContext) || {};
  const regime = engine?.marketRegime ?? null;
  const regimeDisplay = regime ? REGIME_DISPLAY[regime.regime] : null;
  const risk = nexusDecision ? deriveRiskState(nexusDecision) : null;
  const confluence = nexusDecision ? deriveConfluenceState(nexusDecision) : null;
  const flowReal = num(cvd) && cvd !== 0;
  // Evolução Incremental da Inteligência Central, Fase 2 (aditivo): badge
  // NOVO, nunca substitui os 4 acima — só aparece quando há um conflito
  // real nomeado (unified-presentation.ts/conflict-detector.ts). LEI 24:
  // informativo, nunca altera o Núcleo.
  const conflicts: Array<{ motorA: string; motorB: string; severity: string }> = displayConflicts ?? [];
  const topConflict = conflicts[0] ?? null;

  if (!regimeDisplay && !flowReal && !risk && !confluence && !topConflict) return null;

  // Classes SEMPRE literais completas (mesma nota do BarField acima: o
  // scanner JIT do Tailwind só gera CSS para tokens que aparecem por
  // extenso no fonte) — por isso mapas literais, nunca concatenação.
  const RISK_TONE: Record<string, string> = {
    "ACEITÁVEL": "text-[#00ffaa]/90",
    ELEVADO: "text-[#f0d06f]/90",
    "INVÁLIDO": "text-[#ff0055]/90",
  };
  const CONFLUENCE_TONE: Record<string, string> = {
    ALINHADA: "text-[#00ffaa]/90",
    MISTA: "text-[#f0d06f]/90",
    CONFLITANTE: "text-[#ff0055]/90",
    INSUFICIENTE: "text-[#8ab4f8]/70",
  };
  const CONFLICT_TONE: Record<string, string> = {
    CRITICO: "text-[#ff0055]/90",
    ALTO: "text-[#f0d06f]/90",
    MEDIO: "text-[#8ab4f8]/70",
  };

  return (
    <div className="flex items-stretch whitespace-nowrap">
      {regimeDisplay && (
        <BarField
          label="Regime"
          value={`${regimeDisplay.label}${regime!.direction ? ` ${regime!.direction}` : ""}`}
          labelClass="text-[#8ab4f8]/50"
          valueClass={
            regime!.direction === "ALTA"
              ? "text-[#00ffaa]/90"
              : regime!.direction === "BAIXA"
                ? "text-[#ff0055]/90"
                : "text-[#8ab4f8]/90"
          }
          title="Regime de mercado real (ADX/DI + percentil de banda, regime-engine) — o mesmo já exibido no painel MARKET REGIME, aqui sempre visível."
        />
      )}
      {flowReal && (
        <BarField
          label="Fluxo"
          value={cvd! > 0 ? "COMPRADOR" : "VENDEDOR"}
          labelClass="text-[#8ab4f8]/50"
          valueClass={cvd! > 0 ? "text-[#00ffaa]/90" : "text-[#ff0055]/90"}
          title="Pressão real de fluxo pelo sinal do CVD acumulado — mesma leitura do painel MARKET REGIME, nunca um segundo cálculo."
        />
      )}
      {risk && (
        <BarField
          label="Risco"
          value={risk.state}
          labelClass="text-[#8ab4f8]/50"
          valueClass={RISK_TONE[risk.state] ?? "text-[#8ab4f8]/90"}
          title={`Risco: ${risk.state} — ${risk.basis}. Leitura real da Operational Readability Layer, idêntica à do painel Trade Plan.`}
        />
      )}
      {confluence && (
        <BarField
          label="Confluência"
          value={confluence}
          labelClass="text-[#8ab4f8]/50"
          valueClass={CONFLUENCE_TONE[confluence] ?? "text-[#8ab4f8]/90"}
          title="Alinhamento real entre direção, estrutura e timing (Operational Readability Layer) — confluência, nunca probabilidade."
        />
      )}
      {topConflict && (
        <BarField
          label="Conflitos"
          value={conflicts.length > 1 ? `${topConflict.motorA}×${topConflict.motorB} +${conflicts.length - 1}` : `${topConflict.motorA}×${topConflict.motorB}`}
          labelClass="text-[#8ab4f8]/50"
          valueClass={CONFLICT_TONE[topConflict.severity] ?? "text-[#8ab4f8]/90"}
          title={`Divergência real entre motores (unified-presentation.ts) — informativo, nunca altera o Núcleo (LEI 24). ${conflicts.map((c) => `${c.motorA}×${c.motorB}: ${c.severity}`).join(" · ")}`}
        />
      )}
    </div>
  );
}

// Core Engine signal — the ONE number that matters (research: fintech
// dashboards should "lead with the single figure the user checks", not
// bury it among secondary chips). Solid-filled pill = engine of record,
// deliberately distinct from TradePlanTopStrip's outlined pill (the
// Council's advisory overlay, LEI 24: never gates the Core Engine) — the
// visual weight itself communicates which is primary and which is
// supporting detail, without extra copy.
// Redesenho radical (modelo do Operador): o pill pequeno vira um bloco
// hero de duas linhas — direção grande (rivaliza o preço em tamanho) com
// "Confidence" por extenso embaixo, dentro da altura fixa de 46px da
// barra (Zero Scroll permanece intacto: cresce a hierarquia visual, nunca
// a barra). Continua sendo a ÚNICA leitura do Core Engine em toda a tela.
//
// Auditoria Final de Integração (BIAS→SETUP→ENTRY→PLANO): qualificador
// VISÍVEL do subtítulo — releitura pura de deriveOutcomeLabel (nenhuma
// matemática nova), nunca do `direction` grande acima (que continua
// passthrough literal do Núcleo, LEI 24 intocada). Fecha a lacuna real
// encontrada: o mesmo raciocínio BIAS≠ENTRY só existia dentro do
// title=fusedTitle (tooltip nativo — nunca aparece em toque no iPad).
const OUTCOME_QUALIFIER: Partial<Record<NexusOutcomeLabel, string>> = {
  LONG: "PLANO ATIVO",
  SHORT: "PLANO ATIVO",
  "AGUARDAR LONG": "AGUARDANDO ENTRADA",
  "AGUARDAR SHORT": "AGUARDANDO ENTRADA",
  OBSERVAR: "SEM ESTRUTURA",
  // "SEM OPERAÇÃO" fica de fora de propósito: nada de notável a qualificar.
};

function CoreSignalBadge({
  direction,
  confidence,
  decision,
  expectancyFilter,
}: {
  direction: "LONG" | "SHORT" | null;
  confidence: string | null;
  // Diretriz Final (Nexus Decision Layer): a leitura ÚNICA fundida — usada
  // aqui SÓ para o tooltip do elemento herói contar o raciocínio completo
  // num toque (Operação/Confiança/Entrada/Stop/TPs/ETA/R:R/Motivo), sem um
  // pixel novo na tela (§6 da própria diretriz: fusão nunca vira poluição).
  decision?: NexusDecision | null;
  // Entrega 42 — LEI 24, exceção pontual autorizada pelo Operador (ver
  // CLAUDE.md, seção "LEI 24"). Ver bloco "suppressed" abaixo para o único
  // ponto real onde essa exceção é aplicada.
  expectancyFilter?: FilterResult | null;
}) {
  const rawIsLong = direction === "LONG";
  const rawIsShort = direction === "SHORT";
  // LEI 24 — exceção pontual autorizada pelo Operador: quando existe uma
  // direção real do Núcleo (LONG/SHORT) E expectancyFilter.show é false
  // (expectativa líquida real negativa sobre o Track Record deste
  // symbol:timeframe, amostra >= MIN_TRADES_FOR_VALID_EXPECTANCY), o badge
  // exibe NEUTRO em vez da direção real — SÓ na apresentação: `direction`
  // continua sendo o passthrough literal de engine.direction (o Núcleo em
  // si nunca é mutado, nunca recebe um segundo emissor de decisão). Esta é
  // a ÚNICA leitura deste flag no componente inteiro — todo o resto do
  // badge (tom, corpo grande, subtítulo) deriva de `effectiveDirection`
  // computado aqui, nunca de `direction` bruto de novo.
  const suppressed = (rawIsLong || rawIsShort) && expectancyFilter?.show === false;
  const effectiveDirection: "LONG" | "SHORT" | null = suppressed ? null : direction;
  const isLong = effectiveDirection === "LONG";
  const isShort = effectiveDirection === "SHORT";
  // Evolução Integrativa §7: a montagem multi-linha foi REALOCADA para a
  // Operational Readability Layer (nexus/operational-readability.ts) —
  // camada nomeada, pura e com execução real de teste. Conteúdo idêntico;
  // o badge só exibe (§7: consumidores nunca reinterpretam).
  const fusedTitle = (
    suppressed
      ? [
          `NEUTRO (exibição) — Núcleo real: ${direction}. Expectativa líquida real negativa neste Track Record (${expectancyFilter!.label}${expectancyFilter!.stats ? `, ${expectancyFilter!.stats.expectancyR >= 0 ? "+" : ""}${expectancyFilter!.stats.expectancyR.toFixed(2)}R sobre ${expectancyFilter!.stats.totalTrades} trades reais` : ""}). LEI 24, exceção autorizada pelo Operador — ver MOTOR DE LUCRATIVIDADE. O Núcleo em si não foi alterado.`,
          ...buildOperationalSummary(decision),
        ]
      : buildOperationalSummary(decision)
  ).join("\n");
  // Auditoria Final de Integração (achado real): title=fusedTitle é um
  // tooltip nativo — nunca aparece em toque/tap no iPad Safari (a
  // plataforma-alvo real deste app, CLAUDE.md "60 FPS em iPad Safari").
  // Sem esta linha, BIAS/SETUP/ENTRY ficavam matematicamente corretos mas
  // 100% inacessíveis na tela real do Operador: o texto grande
  // (`effectiveDirection`) é o passthrough literal do Núcleo (LEI 24, nunca
  // alterado aqui — exceto pela exceção pontual `suppressed` acima), mas
  // sozinho ele não distinguia "LONG com entrada confirmada" de "LONG só
  // como viés" — exatamente o "LONG + entrada forçada" que a Diretriz
  // BIAS≠ENTRY pediu para nunca comunicar. O qualificador abaixo é uma
  // RELOCAÇÃO do mesmo rótulo já real e testado (deriveOutcomeLabel), só
  // visível agora sem precisar de hover — nenhuma matemática nova.
  const outcome = decision ? deriveOutcomeLabel(decision) : null;
  const outcomeQualifier: string | null = suppressed
    ? null
    : outcome
      ? OUTCOME_QUALIFIER[outcome] ?? null
      : null;
  const textTone = isLong
    ? "text-[#00ffaa] drop-shadow-[0_0_10px_rgba(0,255,170,0.65)]"
    : isShort
      ? "text-[#ff0055] drop-shadow-[0_0_10px_rgba(255,0,85,0.65)]"
      : "text-[#8ab4f8]/50";
  const boxTone = isLong
    ? "bg-[#00ffaa0f] border-[#00ffaa40]"
    : isShort
      ? "bg-[#ff00550f] border-[#ff005540]"
      : "bg-[#8ab4f808] border-[#8ab4f825]";
  return (
    <div
      className={`flex flex-col items-center justify-center leading-none h-[38px] px-3 md:px-4 rounded-lg border mr-2 md:mr-3 shrink-0 ${boxTone}`}
      title={fusedTitle}
    >
      <span className={`text-sm md:text-base font-black tracking-wider ${textTone}`}>
        {suppressed ? "NEUTRO" : (effectiveDirection ?? AWAIT)}
      </span>
      {/* Lapidação Visual (DIRETRIZ 2 — "sempre que dois elementos
          transmitirem praticamente a mesma informação, manter apenas o
          melhor"): sem direção real E sem confiança real E sem qualificador,
          este subtítulo renderizava literalmente o MESMO "AGUARDANDO" já
          escrito em corpo grande logo acima — duas linhas para um único bit
          ("ainda não há leitura"), visível em toda captura do estado
          fail-closed. A condição é deliberadamente ESTREITA — exige que a
          linha grande também esteja em AGUARDANDO (direction null): com uma
          direção real na tela, "AGUARDANDO" no subtítulo deixa de ser eco e
          passa a ser informação de verdade ("direção existe, confiança
          ainda não"), então continua aparecendo. Nada é escondido: no caso
          suprimido a ausência já está dita, em corpo maior, um pixel acima.
          A altura fixa (h-[38px]) mantém o cabeçalho sem salto de layout. */}
      {(suppressed || direction || confidence || outcomeQualifier) && (
      <span className="text-[0.4rem] md:text-[0.45rem] font-bold text-[#8ab4f8]/60 tracking-[0.18em] uppercase mt-[1px] whitespace-nowrap">
        {/* V2 §3: o estado operacional único no subtítulo do MESMO badge —
            header alimentado pelo contrato sem um elemento novo. Auditoria
            Final de Integração: o qualificador BIAS≠ENTRY (PLANO ATIVO /
            AGUARDANDO ENTRADA / SEM ESTRUTURA) substitui o operationalState
            cru — o mesmo dado real continua na linha 1 do tooltip
            ("Estado: ..."), aqui vira a síntese que o Operador reconhece
            sem abrir o tooltip. LEI 24 (suppressed): a mesma linha vira a
            explicação SEMPRE VISÍVEL da supressão (nunca só no tooltip,
            mesmo achado real de "title= nunca aparece em toque no iPad
            Safari" citado acima) — rótulo real do FilterEngine, nunca um
            texto fixo genérico. */}
        {/* Achado real (captura do Operador, janela ~1000px lógicos): a
            região central rolável corta o badge na borda sem indício — o
            subtítulo "CONFIDENCE · MEDIUM · AGUARDANDO ENTRADA" morria em
            "AGUARDAN". O prefixo "Confidence · " era decorativo (o rótulo
            "Confiança:" já vive na linha própria do tooltip) — removê-lo
            faz o pior caso real caber na janela real medida (~30 chars).
            Os DOIS valores reais permanecem: o rótulo categórico do motor
            e o qualificador BIAS≠ENTRY. */}
        {suppressed ? `${expectancyFilter!.label} · SUPRIMIDO` : (confidence ?? AWAIT)}
        {!suppressed && outcomeQualifier ? ` · ${outcomeQualifier}` : ""}
      </span>
      )}
    </div>
  );
}

// --- TOP BAR ---
// DecisionDistanceBadge — "tem que ter a opção do quanto por cento que falta
// pra long e pra short, tudo isso tem que acompanhar lá em cima no cabeçalho"
// (Operador, pedido literal, ao lado do botão do microfone).
//
// O QUE ESTE BADGE NÃO É: uma probabilidade. Não existe backtest real neste
// repositório que sustente "72% de chance de subir" (CLAUDE.md, Regra de Ouro
// 2), então esse número não é exibido nem inventado.
//
// O QUE ELE É: a DISTÂNCIA REAL até o limiar que faria o Core Engine emitir
// LONG (ou SHORT). O limiar não é opinião — é a desigualdade literal de
// trendBias() (js/research/research-engine.js), rastreada de ponta a ponta:
// preço vs SMA e EMA vs SMA. Ver nexus/decision-distance.ts para a
// derivação completa e a limitação declarada (a fronteira se move a cada
// candle novo).
//
// LEI 24 intacta: isto é display-only. Nenhum número daqui volta para o Core
// Engine, nenhum suprime ou altera engine.direction — é a MESMA fronteira do
// Núcleo, lida de fora, nunca uma segunda decisão.
function DecisionDistanceSide({
  label,
  reading,
  which,
}: {
  label: string;
  reading: DecisionDistanceReading;
  which: "long" | "short";
}) {
  const side = which === "long" ? reading.long : reading.short;
  const satisfied = side !== null && side.gapPercent === 0;
  const tone = which === "long" ? "#00ffaa" : "#ff0055";
  return (
    <span
      title={describeDecisionDistance(reading, which)}
      className="flex items-baseline gap-1 whitespace-nowrap"
    >
      <span className="ar10-t-micro font-bold tracking-wider" style={{ color: `${tone}99` }}>
        {label}
      </span>
      <span
        className="ar10-t-label font-black font-mono tabular-nums"
        // Lado já satisfeito acende cheio; o lado que falta fica atenuado.
        // Cor sozinha nunca carrega o significado (o número já diz "0%") —
        // é reforço, não o canal único.
        style={{ color: satisfied ? tone : `${tone}80` }}
      >
        {side === null ? "—" : formatDecisionDistance(side.gapPercent)}
      </span>
    </span>
  );
}

function DecisionDistanceBadge() {
  const { decisionDistance } = useContext(WidgetContext) || {};
  const reading: DecisionDistanceReading | null = decisionDistance ?? null;
  // Fail-closed (Regra de Ouro 3): sem os 3 números reais do Núcleo, o badge
  // não aparece com "0%" nem com um travessão mudo — some, exatamente como o
  // chip de instrumento faz quando não há tipo real. Um "0%" aqui seria a
  // pior leitura possível: o Operador entenderia "está colado no limiar".
  if (!reading || reading.status !== "OK") return null;
  return (
    <div
      className="hidden lg:flex items-center gap-2.5 h-7 px-2.5 rounded-full border border-[#8ab4f825] bg-[#8ab4f808] shrink-0"
      title="Distância real até cada limiar de decisão do Núcleo (preço vs SMA e EMA vs SMA — a mesma desigualdade que emite LONG/SHORT). É distância medida agora, nunca uma probabilidade de acerto."
    >
      <DecisionDistanceSide label="TO LONG" reading={reading} which="long" />
      <span className="w-px h-3.5 bg-[#8ab4f825]" />
      <DecisionDistanceSide label="TO SHORT" reading={reading} which="short" />
    </div>
  );
}

function TopBar({ data }: { data?: PriceState | null }) {
  const {
    handleManualRestart,
    selectedAsset,
    setSelectedAsset,
    criticalPulse,
    marketMode,
    setMarketMode,
    selectedTradFiAsset,
    setSelectedTradFiAsset,
    realCycle,
    engine,
    chartTimeframe,
    cycleLatencyMs,
    voiceSnapshot,
    nexusDecision,
    expectancyFilter,
  } = useContext(WidgetContext) || {};
  // Diretriz Final — Polimento Visual e Sincronização Global §4
  // ("Sincronizar Agora... exibir discretamente o status da
  // sincronização"): price.updatedAt já é o timestamp real do último tick
  // de mercado aceito pela store (setPrice, unified-snapshot-store.ts) —
  // reaproveitado aqui como a leitura mais honesta de "há quanto tempo o
  // organismo está realmente sincronizado", zero conceito novo inventado
  // (o botão abaixo já dispara handleManualRestart, que já reconecta REST+
  // WS+ciclo do motor+feeds — "sincronizador global" já real desde antes
  // desta rodada, só faltava o status visível).
  const syncPriceSnapshot = usePriceSnapshot();
  // Refinamento Final §1 ("Sessão Atual"): derivação pura do relógio UTC
  // real (market-session.ts). Computada no render — a TopBar re-renderiza
  // ao menos 1x/s pelo tick de preço, então o rótulo nunca fica >1s
  // desatualizado sem precisar de um timer próprio.
  const marketSession = marketSessionFromUtc(new Date());
  // Ferramentas Institucionais: janela de kill zone real agora (0, 1 ou 2
  // — Nova York e Fechamento de Londres se sobrepõem de propósito, ver
  // kill-zones.ts). Mesmo princípio de computação no render que
  // marketSession já usa acima (TopBar re-renderiza >=1x/s pelo tick de
  // preço — nunca fica desatualizado sem precisar de timer próprio).
  // v16.0 PRO Fase 1: Kill Zone ICT saiu da TopBar — activeKillZones()
  // agora só é chamada dentro de ScoreContextCard (gaveta Core
  // Intelligence), mesmo padrão self-contained dos outros cards da gaveta.
  const wsLiveNow: boolean = voiceSnapshot?.wsLive === true;
  // Overhaul Cross-Market (Diretriz 2): o rótulo do mercado é passthrough
  // REAL de realCycle.instrumentType (mesmo padrão de wasmVariant) — nunca
  // uma string fixa. Antes de qualquer ciclo bem-sucedido (ou se o fetch
  // de futuros falhar), fica AGUARDANDO honesto em vez de afirmar
  // "Futures/Perp" sem ter recebido dado real nenhum.
  // Lapidação Visual (PRIORIDADE 2 — "badges redundantes / textos
  // repetidos"): sonda real do cabeçalho encontrou "AGUARDANDO" escrito
  // DUAS vezes na mesma linha — aqui e no CoreSignalBadge, em corpo bem
  // maior. Pior: é erro de categoria, porque este chip responde "QUAL
  // instrumento?" (Futures/Perp vs Spot) e não "qual o estado do dado?" —
  // pergunta que o badge grande e o selo "MOTOR EM FALHA" já respondem.
  // Sem tipo real de instrumento ainda, não há nada a dizer sobre o
  // instrumento: o chip vira null e some (fail-closed intacto — nunca
  // afirma "Futures/Perp" sem dado real, que era a razão original do
  // fallback).
  const cryptoMarketLabel: string | null =
    realCycle?.instrumentType === "crypto_futures"
      ? "Futures/Perp"
      : realCycle?.instrumentType === "crypto_spot"
        ? "Spot"
        : null;
  const isPos = (data?.deltaPct ?? 0) >= 0;

  return (
    // Barra de comando — redesenho radical (modelo do Operador, imagem de
    // referência interpretada como direção, não como template literal):
    // UMA única linha densa, hierarquia clara de leitura em vez de "tudo do
    // mesmo tamanho". Ativo → preço (única ocorrência na tela) → o sinal do
    // Core Engine em escala hero (CoreSignalBadge — "o UM número que
    // importa", pesquisa de dashboards fintech) → Trade Plan em rótulos
    // limpos em inglês → núcleo/voz como orbe brilhante no canto. HIGH/LOW/
    // VOL, funding, open interest, os deltas cross-exchange e a faixa de
    // decisão inteira (Liquidez/Risco/Contexto Global/Sistema/Dados/Última
    // Att.) saíram da barra sempre-visível — nada foi apagado, tudo real
    // continua acessível nas abas MERCADOS e ANÁLISES (SecondaryModuleView).
    // O pulso crítico (DCI) acende o anel da barra inteira.
    <div
      className={`shrink-0 z-20 bg-[#010308]/95 backdrop-blur-xl border-b transition-[border-color,box-shadow] duration-500 ${
        criticalPulse
          ? "border-[#00f0ff] shadow-[0_0_24px_rgba(0,240,255,0.35)]"
          : "border-[#00f0ff25] shadow-[0_2px_15px_rgba(0,0,0,0.5)]"
      }`}
    >
      <div className="h-[46px] flex items-center justify-between gap-2 px-3 lg:px-5">
        <div className="flex gap-2 md:gap-3 h-full items-center min-w-0">
          {/* Diretriz V-MAX §11 + pedido direto do Operador ("não precisa
              ficar no meio"): identidade do ativo e o controle real de
              troca de ativo agora são UM único cluster no INÍCIO da barra,
              não dois segmentos separados (ícone+nome estático de um
              lado, seletor sanduichado do outro). O texto estático
              "BTC/USDT" saiu — era informação duplicada, o gatilho do
              Omnibox já mostra o mesmo símbolo real selecionado
              (`${selectedAsset}USDT`), então mantê-lo seria repetir o
              óbvio às custas de espaço horizontal (pedido explícito:
              "deixa só o necessário"). A tag de mercado (Futures/Spot/
              Macro) continua 100% real (mesma expressão de sempre,
              cryptoMarketLabel), só que agora ao lado do gatilho em vez
              de dentro do nome estático removido.
              Achado real de captura de tela (pedido explícito do
              Operador): a fileira de 12 botões de atalho (ASSETS.map)
              que morava aqui era 100% redundante com o próprio gatilho do
              Omnibox logo ao lado — os dois disparam exatamente a mesma
              transição de estado (setMarketMode/setSelectedTradFiAsset/
              setSelectedAsset), só que o Omnibox já busca QUALQUER par
              real da Binance, não só os 12 fixos. Com os 12 botões
              expandidos (rodada anterior), a fileira "comia" o espaço da
              barra e cortava/escondia o preço/variação ao vivo em telas
              reais — removida por inteiro (zero capacidade perdida,
              Regra de Ouro 4: o Omnibox já cobre o mesmo caminho real, com
              mais alcance). Só o badge do ativo ATUAL (ícone) permanece
              no canto, exatamente como o Operador pediu ("só fica o
              primeiro ativo no canto"). ASSETS continua real e em uso em
              outro lugar (AssetHeatmapWidget) — nunca removido, só
              realocado para onde ainda faz sentido. */}
          <div className="flex items-center gap-1.5 pr-2 md:pr-3 border-r border-[#00f0ff20] h-[70%] shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                marketMode === "TRADFI"
                  ? "bg-[#b026ff20] border border-[#b026ff40] shadow-[0_0_10px_rgba(176,38,255,0.25)]"
                  : selectedAsset === "BTC"
                    ? "bg-[#f7931a] shadow-[0_0_10px_rgba(247,147,26,0.4)]"
                    : "bg-[#00f0ff20] border border-[#00f0ff40] shadow-[0_0_10px_rgba(0,240,255,0.2)]"
              }`}
            >
              <span className="text-white font-bold text-xs">
                {marketMode === "TRADFI"
                  ? (selectedTradFiAsset?.symbol?.[0] ?? "?")
                  : selectedAsset === "BTC"
                    ? "₿"
                    : selectedAsset?.[0]}
              </span>
            </div>
            {/* Diretriz V-MAX item 7 ("Header Profissional"): o gatilho vira
                "SÍMBOLO ▼" com o ativo REAL selecionado — não mais um campo
                de busca genérico ocupando espaço; a busca continua inteira
                dentro do dropdown do próprio Omnibox. */}
            <SmartOmnibox
              selectedLabel={marketMode === "TRADFI" ? (selectedTradFiAsset?.symbol ?? "Buscar ativo") : `${selectedAsset}USDT`}
              onSelectCrypto={(baseAsset: string) => {
                setMarketMode?.("CRYPTO");
                setSelectedTradFiAsset?.(null);
                setSelectedAsset?.(baseAsset);
              }}
              onSelectTradFi={(asset: TradFiAsset) => {
                setMarketMode?.("TRADFI");
                setSelectedTradFiAsset?.(asset);
              }}
            />
            {(marketMode === "TRADFI" || cryptoMarketLabel) && (
              <span
                className={`text-[0.5rem] px-1 py-0.5 rounded uppercase tracking-wider whitespace-nowrap shrink-0 ${
                  marketMode === "TRADFI" ? "bg-[#b026ff20] text-[#b026ff]" : "bg-[#00f0ff20] text-[#00f0ff]"
                }`}
              >
                {marketMode === "TRADFI" ? "Macro" : cryptoMarketLabel}
              </span>
            )}
            {/* Refinamento Final §1 ("Timeframe" no header): chip DISPLAY-ONLY
                do timeframe realmente selecionado — a troca continua no
                seletor interativo do painel do gráfico (um único controle,
                zero duplicação de controle; aqui é leitura rápida <5s). */}
            {marketMode === "CRYPTO" && chartTimeframe && (
              <span
                title="Timeframe ativo do gráfico e de toda a análise timeframe-aware (S/R, estrutura, classificação temporal). Troque no seletor do próprio gráfico."
                className="text-[0.5rem] px-1 py-0.5 rounded uppercase tracking-wider whitespace-nowrap shrink-0 bg-[#8ab4f815] text-[#8ab4f8] border border-[#8ab4f825] font-bold"
              >
                {chartTimeframe}
              </span>
            )}
            {/* Diretriz Mestra §12 ("TENDÊNCIA"): a MESMA leitura real de
                estrutura do Core Engine já usada em toda parte
                (marketStructureLabel do timeframe ativo) — display-only,
                zero segunda classificação. */}
            {marketMode === "CRYPTO" && engine?.marketStructureLabel && (
              <span
                title={`Estrutura real do timeframe ativo (${chartTimeframe ?? ""}) — mesma leitura do Market Structure Engine exibida em ANALYSIS.`}
                className={`text-[0.5rem] px-1 py-0.5 rounded uppercase tracking-wider whitespace-nowrap shrink-0 font-bold border ${
                  engine.marketStructureLabel === "ALTA"
                    ? "bg-[#00ffaa12] text-[#00ffaa] border-[#00ffaa30]"
                    : engine.marketStructureLabel === "BAIXA"
                      ? "bg-[#ff005512] text-[#ff0055] border-[#ff005530]"
                      : "bg-[#8ab4f812] text-[#8ab4f8]/80 border-[#8ab4f825]"
                }`}
              >
                {engine.marketStructureLabel}
              </span>
            )}
          </div>

          {/* Correção da colisão REAL vista na primeira foto ao vivo do
              Operador (janela Retina ~1133px CSS COM dados): os chips
              populados excediam a largura, o flex ENCOLHIA o cartão VWAP
              (whitespace-nowrap vaza do box encolhido) e os orbs eram
              pintados por cima do texto. Só se manifesta com dados reais —
              por isso a auditoria no sandbox vazio dava CLEAN. A regra §5
              do header ("compactação progressiva; overflow controlado;
              NENHUM elemento cobre outro"): os chips centrais vivem numa
              região com [&>*]:shrink-0 (nenhum chip encolhe => nenhum
              texto vaza sobre vizinho) e overflow-x rolável de scrollbar
              oculta (nada coberto, nada cortado, zero scroll de página —
              o overflow é interno à faixa). Omnibox fica FORA (o dropdown
              absoluto seria clipado por um scroll container); orbs/power
              ancorados à direita, nunca cobertos. */}
          <div className="flex gap-2 md:gap-3 items-center h-full flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
          {/* O preço — única ocorrência em toda a interface. Em modo
              TRADFI não existe fonte real ligada (fail-closed, Missão 2
              diretriz 4): mostra o rótulo honesto em vez de um preço de
              cripto sem nenhuma relação com o ativo selecionado. */}
          {marketMode === "TRADFI" ? (
            <div className="flex items-center gap-1.5 pr-2 md:pr-3 border-r border-[#00f0ff20] whitespace-nowrap">
              <span className="text-[0.55rem] font-bold text-[#8ab4f8]/50 uppercase tracking-wider">
                {AWAIT} · Macro API
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5 pr-2 md:pr-3 border-r border-[#00f0ff20] whitespace-nowrap">
              <span
                className={`text-base md:text-lg font-black font-mono tracking-tight drop-shadow-[0_0_6px_currentColor] ${
                  isPos ? "text-[#00ffaa]" : "text-[#ff0055]"
                }`}
              >
                {fmt(data?.price ?? null)}
              </span>
              <span
                className={`text-[0.55rem] font-bold tabular-nums ${isPos ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
              >
                {fmtSignedPct(data?.deltaPct ?? null)}
              </span>
            </div>
          )}

          {marketMode === "CRYPTO" && (
            <CoreSignalBadge
              direction={engine?.direction ?? null}
              confidence={engine?.confidence ?? null}
              decision={nexusDecision ?? null}
              expectancyFilter={expectancyFilter ?? null}
            />
          )}

          {/* v16.0 PRO Fase 1 ("Header Minimalista"): Score institucional,
              Heat Score, cartão VWAP e a mensagem do Assistente saíram da
              barra sempre-visível — mesmos dados reais, zero cálculo
              perdido (Regra de Ouro 4), agora na gaveta "Core Intelligence"
              (ScoreContextCard, ao lado do Siriform Core) em vez de
              competir com o único sinal que precisa ser lido em <5s (o
              CoreSignalBadge acima). Achado real ao verificar (nunca
              suposto): AssistantOrb, a única outra superfície nesta
              gaveta com "Assistente" no nome, NÃO consome o assistantMessages
              real (operation-assistant.ts) — usa uma rotação decorativa
              própria (ASSISTANT_MESSAGES, texto fixo tipo "NÚCLEO EM MODO
              LEITURA"). O resumo real com base verificável (tooltip)
              teria ficado sem nenhuma casa — corrigido: ScoreContextCard
              agora exibe a MESMA leitura real que a TopBar mostrava.
              CoreSignalBadge continua na barra: é o único emissor real de
              LONG/SHORT/WAIT (LEI 24), a leitura mais essencial de todas —
              a lista de 6 itens do prompt v16.0 não o menciona por nome,
              tratado aqui como omissão do documento, não como pedido de
              remoção (removê-lo esvaziaria o propósito do terminal). */}
        </div>

        <div className="flex gap-1 md:gap-2 h-full items-center justify-end shrink-0">
          {/* Refinamento Final §1: cluster de estado operacional — Status
              LIVE (wsLive REAL do WebSocket de preço, mesma leitura que o
              voiceSnapshot já carrega — zero segunda fonte), Latência do
              ciclo real do motor (cycleLatencyMs, o mesmo número do painel
              de telemetria) e Sessão de mercado atual (market-session.ts,
              relógio UTC real; o tooltip divulga a aproximação DST).
              hidden md: em telas menores que iPad portrait o tooltip do
              SystemStatusBadge continua carregando a latência — nada some,
              só compacta. */}
          {marketMode === "CRYPTO" && (
            <div className="hidden md:flex items-center gap-2 h-7 px-2 rounded-full border border-[#8ab4f825] bg-[#8ab4f808] whitespace-nowrap shrink-0">
              <span
                title={wsLiveNow ? "Feed WebSocket de preço/livro conectado (tempo real)" : "Feed WebSocket desconectado — reconexão automática em andamento"}
                className={`flex items-center gap-1 text-[0.5rem] font-bold tracking-wider ${wsLiveNow ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full bg-current ${wsLiveNow ? "animate-pulse" : ""}`} />
                {wsLiveNow ? "LIVE" : "OFF"}
              </span>
              <span
                title="Latência real do último ciclo do Core Engine (mesma métrica do painel de telemetria)."
                className="text-[0.5rem] font-mono tabular-nums text-[#8ab4f8]/70"
              >
                {typeof cycleLatencyMs === "number" && Number.isFinite(cycleLatencyMs) ? `${Math.round(cycleLatencyMs)}ms` : DASH}
              </span>
              {marketSession && (
                <span
                  title={`Sessão global de mercado agora (relógio UTC real): ${marketSession.windowUtc}. Cripto negocia 24/7 — a sessão é contexto de liquidez, não um horário de abertura.`}
                  className="text-[0.5rem] font-bold uppercase tracking-wider text-[#8ab4f8]/70"
                >
                  {marketSession.label}
                </span>
              )}
            </div>
          )}
          {/* v16.0 PRO Fase 1: Kill Zone ICT saiu da barra sempre-visível
              (item explícito da lista "REMOVER do header") — mesma leitura
              real (activeKillZones), agora só na gaveta Core Intelligence
              (ScoreContextCard). Zero cálculo perdido, Regra de Ouro 4. */}
          {/* Ordem "Ciborgue Vivo" §2: indicador compacto de risco/saúde
              sempre visível, sem abrir aba nenhuma — pedido explícito do
              Operador. Só reaparece aqui o que o redesenho radical abaixo
              tinha deliberadamente removido da hero line (não desfaz essa
              decisão: cabe num badge minúsculo, não em números crus). */}
          </div>

          {/* Âncora direita fixa (§5 do header): estado do sistema + orbs +
              power NUNCA entram na região rolável — jamais cobertos, jamais
              fora do alcance. */}
          <div className="flex items-center gap-2 md:gap-3 h-full shrink-0">
          {/* Medidor de Distância à Decisão — o pedido literal do Operador:
              "% que falta pra long e pra short, lá em cima no cabeçalho",
              ao lado do orbe/microfone. Fica na âncora DIREITA FIXA (§5 do
              header), a região que nunca entra no scroll horizontal — este
              é um número de leitura contínua, jamais pode ficar fora do
              alcance por causa de largura de tela. */}
          {marketMode === "CRYPTO" && <DecisionDistanceBadge />}
          {marketMode === "CRYPTO" && <SystemStatusBadge />}
          {/* V18.1: núcleo + voz sempre visíveis no cantinho, ao lado do
              botão de energia — ver header de NucleoVoiceOrb. Redesenho
              radical (modelo do Operador): HIGH/LOW/VOL, funding, open
              interest, deltas cross-exchange e SESSÃO saíram da barra
              sempre-visível — nada foi apagado, os valores reais continuam
              na aba MERCADOS (ver SecondaryModuleView), só a sessão de
              uptime foi julgada chrome de baixo valor e não relocada. */}
          <NucleoVoiceOrb />
          <button
            type="button"
            onClick={handleManualRestart}
            title={`Sincronizar Agora — recarrega dados de mercado, motores, feeds em tempo real e cache. Última leitura real: ${syncPriceSnapshot.updatedAt === null ? "aguardando conexão" : `há ${ageLabelOf(syncPriceSnapshot.updatedAt)}`}.`}
            /* Entrega 26 Prioridade 6 ("eliminar movimentos desnecessários...
               transições quase imperceptíveis"): este botão pulsava
               PERMANENTEMENTE, independente de qualquer estado — movimento
               constante carregando zero informação, no canto mais estável
               da barra. Todas as demais animações do app foram auditadas e
               MANTIDAS: cada uma é condicional a um estado real (ponto de
               conexão ao vivo, microfone falando, ciclo em andamento) e
               portanto informa algo. Só esta era ruído puro. Hover/active
               continuam dando o feedback de interação. */
            className="ml-1 w-8 h-8 rounded-full border border-[#00f0ff40] bg-[#00f0ff08] flex items-center justify-center text-[#00f0ff] hover:bg-[#00f0ff20] active:scale-95 transition-all shadow-[0_0_10px_rgba(0,240,255,0.15)]"
          >
            <Power size={14} />
          </button>
          </div>
        </div>
      </div>

      {/* Linha 2 — Trade Plan (Entry/Target/Stop/R:R real, OU — desde o
          achado real "Entry/Target não aparece" — um motivo honesto do
          Conselho/Núcleo quando ainda não há plano acionável; nunca mais
          um return null silencioso) e S1/R1 do Core Engine
          (StructureLevelsStrip, esse sim ainda retorna null sem dado, altura
          zero até o primeiro ciclo real). Motivo de existir separada da
          linha 1 (medido via Playwright, não suposto): Entry/Target/Stop/
          R:R + Support/Resistance juntos não cabem numa única linha em
          iPad portrait (768-834px) sem voltar a abreviações cramped —
          flex-wrap aqui deixa o conjunto quebrar de forma legível em vez de
          escondido atrás de uma aba ou cortado. */}
      {marketMode === "CRYPTO" && (
        <div className="flex flex-wrap items-center gap-y-1 px-3 lg:px-5 pb-1.5">
          <TradePlanTopStrip livePrice={data?.price ?? null} />
          <StructureLevelsStrip />
          {/* Entrega 26 Prioridade 4: a leitura de contexto (regime/fluxo/
              risco/confluência) passa a viver AQUI, na mesma linha sempre
              visível — antes exigia abrir a gaveta "Core Intelligence". */}
          <ContextReadStrip />
        </div>
      )}
    </div>
  );
}

// Ordem "Ciborgue Vivo" §2 ("métricas de risco atuais... status do sistema
// / saúde do núcleo... sem abrir abas"): indicador compacto, sempre
// visível. Reaproveita as MESMAS classificações reais já usadas por
// TelemetryHealthWidget (classifyFps/classifyCycleLatency,
// dataQuality.classification) e o MESMO riskSuggestion do Risk Engine
// (Fase H) já usado por DecisionValidationWidget — zero segunda
// classificação, zero número novo. Detalhe completo só no tooltip
// (title=), nunca números crus competindo com a hero line — a mesma
// disciplina de densidade do redesenho radical (comentário acima) segue
// valendo, isto é aditivo (~24px), não uma reversão dele.
//
// "Drawdown/exposição" reais não existem sem execução real (FAIL_CLOSED
// permanente — ver ExposureWidget: nenhuma posição ao vivo é sequer
// possível neste sistema). O substituto honesto é o risco SUGERIDO real
// do Risk Engine para o Trade Plan atual — nunca um número de posição
// fabricado para preencher o espaço.
function SystemStatusBadge() {
  const { realCycle, fps, cycleLatencyMs, riskSuggestion } = useContext(WidgetContext) || {};
  const offline = useOfflineSnapshot();
  const isDataFresh = useDataFreshSnapshot();

  const quality = realCycle?.dataQuality?.classification ?? null;
  const fpsClass = classifyFps(fps);
  const cycleClass = classifyCycleLatency(cycleLatencyMs);
  const hasAnyReading = quality !== null || fpsClass !== null || cycleClass !== null;

  const critical = offline || (hasAnyReading && !isDataFresh) || quality === "QUARENTENA" || fpsClass === "CRITICO" || cycleClass === "LENTO";
  const warn = !critical && (quality === "DEGRADADA" || fpsClass === "ACEITAVEL");

  const colorClass = !hasAnyReading
    ? "text-[#8ab4f8]/40 bg-[#8ab4f8]/10 border-[#8ab4f8]/30"
    : critical
      ? "text-[#ff0055] bg-[#ff005515] border-[#ff005550]"
      : warn
        ? "text-[#f0d06f] bg-[#f0d06f15] border-[#f0d06f50]"
        : "text-[#00ffaa] bg-[#00ffaa15] border-[#00ffaa50]";

  const riskLabel = riskSuggestion?.status === "OK" ? `${riskSuggestion.effective_risk_pct.toFixed(1)}%` : null;

  const tooltip = [
    `Sistema: ${offline ? "OFFLINE" : isDataFresh ? "dados frescos" : "dados obsoletos"}`,
    `Qualidade da fonte: ${quality ?? AWAIT}`,
    `FPS: ${fpsClass ?? AWAIT}`,
    `Latência do ciclo: ${cycleClass ?? AWAIT}`,
    riskSuggestion?.status === "OK"
      ? `Risco sugerido (Risk Engine): ${riskSuggestion.effective_risk_pct.toFixed(2)}% · posição ${riskSuggestion.suggested_position_pct.toFixed(1)}% equity`
      : "Risco sugerido: sem Trade Plan real ativo agora",
  ].join(" · ");

  return (
    <div
      title={tooltip}
      className={`hidden sm:flex items-center gap-1 h-7 px-2 rounded-full border text-[0.5rem] font-bold tracking-wider whitespace-nowrap shrink-0 ${colorClass}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      {riskLabel ? <span className="font-mono">{riskLabel}</span> : null}
    </div>
  );
}
// --- NAV RAIL BUTTON (Fase M.1: Navigation Rail + Overlay Drawers) ---
// Botão-ícone compartilhado pelas duas réguas verticais (SideBar à
// esquerda, RightRail à direita) — mesmo toque/estado ativo, só o lado
// do indicador espelha (edge = borda mais próxima da tela). "Sem
// textos" por diretriz: o rótulo vira tooltip via title, nunca um
// <span> visível — Zero Repetição de estilo entre as duas réguas.
function NavRailButton({
  icon: Icon,
  label,
  active,
  onClick,
  edge = "left",
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  edge?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex items-center justify-center w-full py-2.5 shrink-0 cursor-pointer transition-colors relative ${active ? "text-[#00f0ff] bg-gradient-to-r from-[#00f0ff1a] to-transparent" : "text-[#8ab4f8]/50 hover:text-[#8ab4f8]"}`}
    >
      {active && (
        <div
          className={`absolute top-0 bottom-0 w-[2px] bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] ${edge === "right" ? "right-0" : "left-0"}`}
        ></div>
      )}
      <Icon size={17} className="relative z-10" />
    </button>
  );
}

// --- SIDE BAR (Fase M.1: LEFT Navigation Rail) ---
function SideBar({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
}) {
  const { setWorkspaceManagerOpen, setChartLayersOpen, setRadarPanelOpen, setMarketAnalysisOpen, setPaperTradingOpen, leftDrawerOpen, toggleLeftDrawer } = useContext(WidgetContext) || {};
  // OMEGA CORE V-MAX (completar Fase 7): contagem real do próprio snapshot
  // — nunca um badge decorativo. "Substitui o botão pulsante" (diretiva):
  // um número real (0 quando não há nada) é honesto; uma animação
  // pulsante sugeriria urgência que a lista pode não ter.
  const radarCandidateCount = useRadarCandidatesSnapshot().length;
  // Language migration order: nav ids/labels moved to English (standard
  // professional trading terminology). Every id now routes to a DEDICATED
  // view fed by real data (SecondaryModuleView) — the old shared generic
  // waiting placeholder no longer exists. DASHBOARD/SETTINGS keep their
  // own behavior (activeTab ternary in App()); labels render only as
  // tooltips (NavRailButton), never visible text on the rail (Fase M.1).
  const items: { icon: any; id: string; label: string }[] = [
    { icon: LayoutDashboard, id: "DASHBOARD", label: "COCKPIT" },
    { icon: BarChart2, id: "MARKETS", label: "MARKETS" },
    { icon: Activity, id: "ANALYSIS", label: "ANALYSIS" },
    { icon: ShieldCheck, id: "RISK", label: "RISK" },
    { icon: Zap, id: "EXECUTION", label: "EXECUTION" },
    { icon: Scan, id: "SCANNER", label: "SCANNER" },
    { icon: Newspaper, id: "NEWS", label: "NEWS" },
    { icon: Bell, id: "ALERTS", label: "ALERTS" },
    { icon: Settings, id: "SETTINGS", label: "SETTINGS" },
  ];
  return (
    <div className="w-12 md:w-14 border-r border-[#00f0ff20] bg-[#010308]/95 flex flex-col items-center py-3 gap-1 shrink-0 z-10 overflow-y-auto scrollbar-hide backdrop-blur-md">
      <div className="relative mb-2">
        <Target className="text-[#00f0ff] opacity-90" size={20} strokeWidth={1.5} />
        <div className="absolute inset-0 border border-[#00f0ff] rounded-full animate-ping opacity-30"></div>
      </div>
      {items.map((item) => (
        <NavRailButton
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={activeTab === item.id}
          onClick={() => setActiveTab(item.id)}
        />
      ))}
      {/* Fase M.1: Market Intelligence entra na régua esquerda — mesmo
          lado da gaveta .terminal-left que ela abre (o ícone e a gaveta
          deslizam do mesmo lado da tela). Substitui a alça solta que
          existia na borda do gráfico: um único mecanismo de acesso. */}
      <div className="w-full border-t border-[#00f0ff15] mt-1 pt-1">
        <NavRailButton
          icon={PanelLeft}
          label="Market Intelligence"
          active={!!leftDrawerOpen}
          onClick={() => toggleLeftDrawer?.()}
        />
      </div>
      {/* V16 Workspace Manager entry point — a single, discoverable way in
          to the Pinned/Docked/Collapsed/Hidden/Floating controls for every
          secondary module, instead of a gear icon per module. Pinned to
          the bottom (mt-auto) like the reference layout's footer link. */}
      <button
        type="button"
        onClick={() => setWorkspaceManagerOpen?.((v: boolean) => !v)}
        title="Workspace Manager"
        aria-label="Workspace Manager"
        className="mt-auto flex items-center justify-center w-full py-2.5 cursor-pointer transition-colors text-[#8ab4f8]/50 hover:text-[#00f0ff] shrink-0"
      >
        <LayoutGrid size={17} className="relative z-10" />
      </button>
      {/* Camadas do Gráfico (Finding M) — segundo entry point no mesmo
          rodapé, mesmo padrão do Workspace Manager acima (toggle de
          visibilidade em vez de estado de widget). */}
      <button
        type="button"
        onClick={() => setChartLayersOpen?.((v: boolean) => !v)}
        title="Camadas do Gráfico"
        aria-label="Camadas do Gráfico"
        className="flex items-center justify-center w-full py-2.5 cursor-pointer transition-colors text-[#8ab4f8]/50 hover:text-[#00f0ff] shrink-0"
      >
        <Layers size={17} className="relative z-10" />
      </button>
      {/* OMEGA CORE V-MAX (completar Fase 7, Radar/OIH) — terceiro entry
          point no mesmo rodapé, mesmo padrão dos dois acima. Rótulo
          visível "Oportunidades" (nunca "Radar"): o cockpit já tem um
          widget real chamado "RADAR DE CONSENSO" (CouncilWidget) e uma aba
          "SCANNER" com heurística de %-change de 24h (ScannerWidget) —
          nenhum dos dois é este módulo; um terceiro rótulo com a mesma
          palavra confundiria o Operador sobre qual painel está abrindo. */}
      <button
        type="button"
        onClick={() => setRadarPanelOpen?.((v: boolean) => !v)}
        title="Radar / OIH — Oportunidades já validadas pelo organismo"
        aria-label="Radar / OIH — Oportunidades já validadas pelo organismo"
        className="relative flex items-center justify-center w-full py-2.5 cursor-pointer transition-colors text-[#8ab4f8]/50 hover:text-[#00f0ff] shrink-0"
      >
        <RadarIcon size={17} className="relative z-10" />
        {radarCandidateCount > 0 && (
          <span className="absolute top-1 right-1.5 min-w-[13px] h-[13px] px-[2px] rounded-full bg-[#00ffaa] text-[#010308] text-[0.4rem] font-bold flex items-center justify-center leading-none">
            {radarCandidateCount}
          </span>
        )}
      </button>
      {/* Ordem "Market Analysis & Publication Engine" §2: "ação simples,
          discreta e fácil de encontrar" — quarto botão no mesmo rodapé,
          mesmo padrão dos três acima (toggle de visibilidade do painel).
          Ícone de compartilhamento (não um dos glifos já usados pelas 9
          abas + 3 gavetas) porque a ação é literalmente gerar conteúdo
          publicável, nunca uma view de dado a mais. */}
      <button
        type="button"
        onClick={() => setMarketAnalysisOpen?.((v: boolean) => !v)}
        title="Análise de Mercado — gerar leitura publicável (Painel/X/Story)"
        aria-label="Análise de Mercado — gerar leitura publicável (Painel/X/Story)"
        className="flex items-center justify-center w-full py-2.5 cursor-pointer transition-colors text-[#8ab4f8]/50 hover:text-[#00f0ff] shrink-0"
      >
        <Share2 size={17} className="relative z-10" />
      </button>
      {/* v16.0 PRO MAX §9.1/§9.4 ("Paper Trading"): quinto botão no mesmo
          rodapé, mesmo padrão dos quatro acima. Posição simulada MANUAL —
          decisão do Operador via AskUserQuestion: zero automação, o painel
          só existe para o Operador abrir/fechar por conta própria. */}
      <button
        type="button"
        onClick={() => setPaperTradingOpen?.((v: boolean) => !v)}
        title="Paper Trading — posição simulada manual (P&L ao vivo, sem automação)"
        aria-label="Paper Trading — posição simulada manual (P&L ao vivo, sem automação)"
        className="flex items-center justify-center w-full py-2.5 cursor-pointer transition-colors text-[#8ab4f8]/50 hover:text-[#00f0ff] shrink-0"
      >
        <Wallet size={17} className="relative z-10" />
      </button>
    </div>
  );
}

// --- RIGHT RAIL (Fase M.1: Navigation Rail + Overlay Drawers) ---
// Espelho da SideBar à direita — mesma régua fina, dois ícones reais: Core
// Intelligence (Siriform/GMIL/Regime/Validação/Saúde, o mesmo conteúdo que
// já existia atrás da alça antiga) e Properties (painel Properties 320px,
// pedido do Operador — Layer Manager docado). Cada um abre um conteúdo
// genuinamente diferente — nunca a mesma informação fragmentada em duas
// gavetas vazias só para "parecer completa" (isso violaria zero
// fabricação, nenhum dado novo apareceria do nada sem ganhar nada em
// troca). Mutual exclusion (App(), toggleRightDrawer/
// togglePropertiesDrawer) garante que só uma gaveta fica aberta por vez,
// mesmo com 2 entry points nesta régua.
function RightRail() {
  const { rightDrawerOpen, toggleRightDrawer, propertiesDrawerOpen, togglePropertiesDrawer } = useContext(WidgetContext) || {};
  return (
    <div className="w-12 md:w-14 border-l border-[#00f0ff20] bg-[#010308]/95 flex flex-col items-center py-3 gap-1 shrink-0 z-10 overflow-y-auto scrollbar-hide backdrop-blur-md">
      <NavRailButton
        icon={PanelRight}
        label="Core Intelligence"
        active={!!rightDrawerOpen}
        onClick={() => toggleRightDrawer?.()}
        edge="right"
      />
      {/* Painel Properties 320px (pedido do Operador): mesmo padrão do
          botão acima, mesmo slot visual (.terminal-properties), ícone
          distinto (SlidersHorizontal) para nunca confundir com o de
          "Camadas do Gráfico" (Layers) da SideBar — chrome diferente
          (dropdown transitório vs. painel docado), mesmo conteúdo real
          por baixo (ChartLayersPanelContent). */}
      <NavRailButton
        icon={SlidersHorizontal}
        label="Properties"
        active={!!propertiesDrawerOpen}
        onClick={() => togglePropertiesDrawer?.()}
        edge="right"
      />
    </div>
  );
}

// --- WIDGET ERROR BOUNDARY ---
// A single widget's render can throw on a real but unanticipated data shape
// (e.g. an exchange response schema change) — this must never take down the
// rest of the cockpit. Error boundaries have no hook equivalent; a class
// component is the only way React supports catching render errors.
interface WidgetErrorBoundaryState {
  hasError: boolean;
}
class WidgetErrorBoundary extends React.Component<
  { title?: string; children: React.ReactNode },
  WidgetErrorBoundaryState
> {
  constructor(props: { title?: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-1 text-center px-2">
          <span className="text-[0.5rem] tracking-[0.15em] text-[#ff0055] font-bold uppercase">
            {this.props.title || "PAINEL"} · ERRO DE RENDERIZAÇÃO
          </span>
          <span className="text-[0.45rem] text-[#8ab4f8]/50">
            Os demais painéis continuam ativos.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- WIDGET WRAPPER ---
function Widget({ id, children, title, className = "", flex = "flex-1", extraHeader }: any) {
  const { widgets, toggleWidget } = useContext(WidgetContext) || {};
  const [maximized, setMaximized] = useState(false);
  // Collapse is a persisted Workspace Manager state (V16) for any widget
  // with an id — a reload or a toggle from the Workspace Manager panel must
  // agree with the header's own "_" control. Widgets with no id (e.g. the
  // always-on left/right V16 cards) fall back to local-only state, same as
  // before this change.
  const [localMinimized, setLocalMinimized] = useState(false);

  const widgetState = id && widgets ? widgets[id] : null;
  if (widgetState && !widgetState.visible) return null;

  const minimized = widgetState ? widgetState.collapsed : localMinimized;
  const setMinimized = (next: boolean) => {
    if (widgetState) {
      if (next !== widgetState.collapsed) toggleWidget(id, "collapsed");
    } else {
      setLocalMinimized(next);
    }
  };

  const isFloating = widgetState && widgetState.floating;

  const renderHeader = (isFloatMode = false) => (
    // flex-wrap: em Slide Over/Split View estreito (≤375px) o grupo de
    // controles (extraHeader + minimizar/fechar) quebra para a linha de
    // baixo em vez de estourar a borda direita do painel.
    <div
      className="cyber-header cursor-pointer select-none flex flex-wrap items-center justify-between gap-y-1"
      onDoubleClick={(e) => {
        if (!isFloatMode) {
          e.stopPropagation();
          setMaximized(!maximized);
        }
      }}
    >
      <span className="font-bold tracking-[0.2em] min-w-0">{title}</span>
      <div className="flex gap-2 items-center max-w-full flex-wrap">
        {extraHeader && <div className="min-w-0">{extraHeader}</div>}
        <div className="flex gap-1">
          {!maximized && !isFloatMode && (
            <div
              className="text-[#8ab4f8]/50 hover:text-[#00f0ff] px-1 py-0.5 rounded cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setMinimized(true);
              }}
              title="Minimizar"
            >
              _
            </div>
          )}
          {/* Visible expand/restore toggle — previously the ONLY way to
              maximize a panel was an undocumented double-click on the
              header, with zero visual affordance. This makes the exact
              same existing `maximized` mechanism discoverable. */}
          {!isFloatMode && (
            <div
              className={`px-1 py-0.5 rounded cursor-pointer ${maximized ? "text-[#00f0ff] bg-[#00f0ff10] border border-[#00f0ff30]" : "text-[#8ab4f8]/50 hover:text-[#00f0ff]"}`}
              onClick={(e) => {
                e.stopPropagation();
                setMaximized(!maximized);
              }}
              title={maximized ? "Restaurar" : "Tela cheia"}
            >
              {maximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </div>
          )}
          {widgetState && WORKSPACE_MANAGER_MODULE_IDS.has(id) && (
            <div
              className="text-[#ff0055]/50 hover:text-[#ff0055] px-1 py-0.5 rounded cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                toggleWidget(id, "visible");
              }}
            >
              <X size={12} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isFloating) {
    return (
      <Rnd
        /* "dá uma olhada no que tem atrapalhando o campo de visão do
           operador... nada pode atrapalhar" (Operador). Medido: era
           `{ x: 100, y: 100 }` LITERAL — todo painel flutuante nascia no
           MESMO pixel, em cima do canto superior esquerdo do gráfico (onde
           vivem a faixa de sessões e o aviso do Trade Plan), e dois
           flutuantes abertos ficavam perfeitamente empilhados, o de baixo
           invisível. Agora nasce ancorado no canto de MENOR densidade de
           informação, escalonado por id, com a barra de comando e a régua
           esquerda como zonas proibidas — ver nexus/floating-widget-origin.ts.
           Continua 100% arrastável: isto é o ponto de partida, não uma
           prisão. */
        default={resolveFloatingWidgetOrigin(
          id,
          typeof window !== "undefined" ? window.innerWidth : NaN,
          typeof window !== "undefined" ? window.innerHeight : NaN,
        )}
        minWidth={250}
        minHeight={200}
        bounds="window"
        dragHandleClassName="cyber-header"
        style={{ zIndex: 1000 }}
      >
        <div
          className={`cyber-panel w-full h-full flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.2)] bg-[#010308]/95 backdrop-blur-xl ${className}`}
        >
          {title && renderHeader(true)}
          <div className="flex-1 min-h-0 relative p-2 overflow-hidden flex flex-col z-10">
            <WidgetErrorBoundary title={title}>{children}</WidgetErrorBoundary>
          </div>
        </div>
      </Rnd>
    );
  }

  if (minimized) {
    return (
      <div
        className={`cyber-panel shrink-0 h-[32px] transition-all cursor-pointer hover:bg-[#00f0ff10] border-[#00f0ff30] opacity-70 hover:opacity-100 ${className}`}
        onClick={() => setMinimized(false)}
      >
        <div className="cyber-header border-none h-full bg-transparent flex items-center justify-between">
          <span className="font-bold tracking-[0.2em]">{title}</span>
          <div className="text-[#00f0ff] font-bold px-2 hover:text-white">[]</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        maximized
          ? // `!` (important) is required on position/inset/z-index here:
            // .cyber-panel's own `position: relative` rule (index.css) is
            // textually AFTER Tailwind's generated utilities in the compiled
            // stylesheet (it follows @import "tailwindcss" in the same
            // file), so a plain `fixed` utility loses the cascade to it —
            // confirmed via getComputedStyle: without `!`, this panel
            // computed position:relative and stayed pinned at its normal
            // in-flow size instead of covering the viewport. This is why
            // "maximize" silently never worked at all, hidden or not.
            `!fixed !inset-2 md:!inset-8 !z-50 cyber-panel flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.2)] bg-[#010308]/95 backdrop-blur-xl`
          : // min-h-0 is scoped to the landscape 3-column breakpoint on purpose:
            // that layout gives each column a real h-full + overflow-y-auto
            // container, and min-h-0 is what lets flex-grow actually
            // distribute that fixed height among a column's widgets. Below
            // 1120px the columns stack with no bounded parent height (by
            // design — the whole page scrolls instead), so forcing min-h-0
            // there collapsed every widget toward its header (confirmed:
            // chart panel measured 113px/9% of viewport in iPad Air
            // portrait). The content wrapper just below is `overflow-hidden`
            // though, which per spec disables flexbox's automatic
            // content-based minimum size entirely (not just "sets it to
            // 0" — the browser doesn't crawl into overflow:hidden content
            // at all), so plain min-height:auto alone doesn't recover a
            // usable size here the way it did for the three column divs.
            // A real, explicit floor is required; 180px is a sane default
            // for compact list/ticker widgets, callers needing more (the
            // chart) pass a larger min-h-[Npx] via their own `flex` prop,
            // which wins over this default (same mechanism already proven
            // by NeuralCoreWidget's min-h-[160px]).
            `cyber-panel ${flex} ${className} min-h-[180px] min-[1120px]:min-h-0 transition-all`
      }
    >
      {title && renderHeader(false)}
      <div
        className="flex-1 min-h-0 relative p-2 overflow-hidden flex flex-col z-10"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <WidgetErrorBoundary title={title}>{children}</WidgetErrorBoundary>
      </div>
    </div>
  );
}

// --- CHART WIDGET ---
// Auditoria de estabilização (P1): os 14 timeframes pedidos mapeiam 1:1
// para intervalos REAIS aceitos pela API pública de klines de Futuros da
// Binance (o mesmo endpoint que collectBinanceFuturesKlines já usa) —
// nenhum valor inventado. `value` é o que chega à URL real (convenção da
// própria Binance: "m" minúsculo = minuto, "M" maiúsculo = mês); `label`
// segue a notação como pedida na diretriz, para nunca confundir "1m" com
// "1M" — ambiguidade real que o seletor antigo (decorativo, sempre "1M"
// de exibição para "1 minuto") tinha.
const CHART_TIMEFRAMES: { value: string; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "3m", label: "3m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1H" },
  { value: "2h", label: "2H" },
  { value: "4h", label: "4H" },
  { value: "6h", label: "6H" },
  { value: "8h", label: "8H" },
  { value: "12h", label: "12H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1M", label: "1M" },
];

// --- SECONDARY MODULE VIEWS (Multi-Source Order, deliverable 3 + language
// migration start) --------------------------------------------------------
// Every top-nav module now routes REAL data the terminal already collects
// (WidgetContext + UnifiedGlobalSnapshot atomic selectors) instead of the
// old shared "waiting for real data source" placeholder. Zero new network
// calls and zero recomputation here — pure routing of existing real state.
// Panels with no real source behind them say exactly that (fail-closed):
// NEWS has no real feed connected, and EXECUTION is permanently read-only
// by design. All labels in English (professional trading terminology), per
// the language-migration order.

function ModulePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="cyber-panel bg-[#010308]/60 rounded p-2 flex flex-col gap-1 min-w-0">
      <span className="text-[0.5rem] tracking-[0.25em] font-black text-[#00f0ff] uppercase">{title}</span>
      {children}
    </div>
  );
}

function ModuleStat({ label, value, tone }: { label: string; value: string; tone?: "long" | "short" | "neutral" }) {
  const color = tone === "long" ? "text-[#00ffaa]" : tone === "short" ? "text-[#ff0055]" : "text-[#8ab4f8]";
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-[0.45rem] text-[#8ab4f8]/60 font-bold tracking-wide uppercase">{label}</span>
      <span className={`text-[0.5rem] font-mono font-black ${color}`}>{value}</span>
    </div>
  );
}

const MODULE_EMPTY = "AWAITING REAL DATA"; // honest fail-closed value, never a fabricated number

function SecondaryModuleView({ tab }: { tab: string }) {
  const ctx = useContext(WidgetContext) || {};
  const {
    scannerData,
    riskSuggestion,
    orderflowSignals,
    liquidations,
    liquidationState,
    engine,
    engineStatus,
    selectedAsset,
    gmilProviders,
    voiceSnapshot,
    lastUpdateAt,
    institutionalConsensus,
    crossExchangeCheck,
    okxCrossExchangeCheck,
    mexcCrossExchangeCheck,
    chartTimeframe,
    etaReading,
    // Consolidação Final §21-§30: leituras VWAP/NL/confluência (App-level,
    // mesma fonte do header e do gráfico — zero recomputação aqui).
    vwapCtx,
    nlState,
    nexusConfluence,
    // Evolução Integrativa §6: o contrato fundido para a Síntese
    // Operacional da aba ANALYSIS — mesma fonte única do badge (LEI 24).
    nexusDecision,
  } = ctx as any;
  const connections = useConnectionsSnapshot();
  const derivatives = useDerivativesSnapshot();
  const council = useCouncilSnapshot();
  const scenario = useScenarioSnapshot();
  const traps = useTrapSignalsSnapshot();
  const trustScore = useTrustScoreSnapshot();
  const cpi = useCpiSnapshot();
  const fibMatrix = useFibonacciConfluenceSnapshot();
  const volumeProfile = useVolumeProfileSnapshot();
  const price = usePriceSnapshot();
  const tradePlan = useTradePlanSnapshot();
  const trackRecord = useTrackRecordSnapshot();
  // Refinamento Final §7/§8 — mesmas fatias reais desenhadas no gráfico.
  const harmonicHits = useHarmonicPatternsSnapshot();
  // Carta Branca — mesmas fatias reais desenhadas no gráfico (Triângulo e
  // Ombro-Cabeça-Ombro), mesma disciplina de harmonicHits acima.
  const trianglePattern = useTrianglePatternSnapshot();
  const headShouldersPattern = useHeadShouldersPatternSnapshot();
  const premiumDiscountView = usePremiumDiscountSnapshot();

  const pct = (v: number | null | undefined, digits = 0) =>
    typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : MODULE_EMPTY;
  const num = (v: number | null | undefined, digits = 2) =>
    typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : MODULE_EMPTY;
  const time = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour12: false });

  const scannerTable = (
    <ModulePanel title={`24H Market Overview · Binance (real)`}>
      {Array.isArray(scannerData) && scannerData.length > 0 ? (
        scannerData.map((row: any) => (
          <div key={row.p} className="flex justify-between items-center gap-2">
            <span className="text-[0.48rem] font-mono text-[#8ab4f8]">{row.p}</span>
            <span className={`text-[0.48rem] font-mono font-black ${row.s === "LONG" ? "text-[#00ffaa]" : row.s === "SHORT" ? "text-[#ff0055]" : "text-[#8ab4f8]/70"}`}>
              {row.s} · {typeof row.chg === "number" ? `${row.chg >= 0 ? "+" : ""}${row.chg.toFixed(2)}%` : MODULE_EMPTY} · strength {Math.round(row.str)}
            </span>
          </div>
        ))
      ) : (
        <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">{MODULE_EMPTY}</span>
      )}
    </ModulePanel>
  );

  let body: React.ReactNode;
  if (tab === "MARKETS") {
    const EXCHANGES: Array<"BINANCE" | "BYBIT" | "OKX" | "MEXC"> = ["BINANCE", "BYBIT", "OKX", "MEXC"];
    body = (
      <>
        <ModulePanel title="Data Sources · Connection State (real)">
          {EXCHANGES.map((ex) => {
            const state = connections[ex] ?? "IDLE";
            return <ModuleStat key={ex} label={ex} value={state} tone={state === "LIVE" ? "long" : state === "DEGRADED" || state === "OFFLINE" ? "short" : "neutral"} />;
          })}
          <span className="text-[0.42rem] text-[#8ab4f8]/40 leading-tight">
            IDLE = source connected on demand; the primary Binance Futures WebSocket feed drives the cockpit and is shown on the top bar.
          </span>
        </ModulePanel>
        <ModulePanel title={`Derivatives · ${selectedAsset ?? ""}/USDT Perpetual (real)`}>
          <ModuleStat label="Last Price" value={num(price.price)} tone={price.direction === "LONG" ? "long" : price.direction === "SHORT" ? "short" : "neutral"} />
          <ModuleStat label="24H High" value={num(price.high)} />
          <ModuleStat label="24H Low" value={num(price.low)} />
          <ModuleStat label="24H Volume" value={typeof price.volume === "number" ? Math.round(price.volume).toLocaleString("en-US") : MODULE_EMPTY} />
          <ModuleStat label="Funding Rate" value={typeof derivatives.fundingRate === "number" ? `${(derivatives.fundingRate * 100).toFixed(4)}%` : MODULE_EMPTY} />
          <ModuleStat label="Open Interest" value={num(derivatives.openInterest, 0)} />
          <ModuleStat label="Long/Short Ratio" value={num(derivatives.longShortRatio)} />
        </ModulePanel>
        {/* Master Panel handoff (Multi-Source Market Data Fusion): cross-
            check real Binance-vs-Bybit/OKX — puramente informativo, nunca
            um sinal. AWAITING REAL DATA honesto antes do primeiro ciclo
            real ou se a fonte não responder (mesmo padrão MODULE_EMPTY do
            resto desta view). Relocado da barra sempre-visível — mesmo
            cálculo real, zero recomputo. */}
        <ModulePanel title="Cross-Exchange Consensus (real, advisory only)">
          <ModuleStat
            label="Bybit Δ"
            value={
              crossExchangeCheck?.consensus === "INDISPONIVEL" || crossExchangeCheck?.priceDeltaPct == null
                ? MODULE_EMPTY
                : `${crossExchangeCheck.priceDeltaPct.toFixed(3)}%`
            }
            tone={crossExchangeCheck?.consensus === "ALINHADO" ? "long" : crossExchangeCheck?.consensus === "DIVERGENTE" ? "short" : "neutral"}
          />
          <ModuleStat
            label="OKX Δ"
            value={
              okxCrossExchangeCheck?.consensus === "INDISPONIVEL" || okxCrossExchangeCheck?.priceDeltaPct == null
                ? MODULE_EMPTY
                : `${okxCrossExchangeCheck.priceDeltaPct.toFixed(3)}%`
            }
            tone={okxCrossExchangeCheck?.consensus === "ALINHADO" ? "long" : okxCrossExchangeCheck?.consensus === "DIVERGENTE" ? "short" : "neutral"}
          />
          {/* EPC FINAL §27 (Aditivo de Automação Total): MEXC Futures, 4ª
              fonte real — mesmo padrão Bybit/OKX, fairPrice (mark) vs
              markPrice da Binance. */}
          <ModuleStat
            label="MEXC Δ"
            value={
              mexcCrossExchangeCheck?.consensus === "INDISPONIVEL" || mexcCrossExchangeCheck?.priceDeltaPct == null
                ? MODULE_EMPTY
                : `${mexcCrossExchangeCheck.priceDeltaPct.toFixed(3)}%`
            }
            tone={mexcCrossExchangeCheck?.consensus === "ALINHADO" ? "long" : mexcCrossExchangeCheck?.consensus === "DIVERGENTE" ? "short" : "neutral"}
          />
        </ModulePanel>
        {scannerTable}
      </>
    );
  } else if (tab === "ANALYSIS") {
    const fibLevels = (fibMatrix?.levels ?? []).filter((l: any) => l.score > 0).slice(0, 4);
    const vp = volumeProfile?.fixedRange;
    // Decision Context — relocated from the always-visible bar (same real
    // computations, English labels). `num` here is the LOCAL string
    // formatter defined above (shadows the module-level boolean guard), so
    // finiteness is checked directly instead of relying on it as a boolean.
    const buyPercent = engine?.buyPercent;
    const hasLiquidity = typeof buyPercent === "number" && Number.isFinite(buyPercent);
    const direction: Direction = engine?.direction ?? null;
    const hasEnginePrice = typeof engine?.price === "number" && Number.isFinite(engine.price) && engine.price !== 0;
    const hasStop = typeof engine?.stop === "number" && Number.isFinite(engine.stop);
    const stopDistPct = direction && hasStop && hasEnginePrice ? Math.abs(((engine.price - engine.stop) / engine.price) * 100) : null;
    const liqCount = voiceSnapshot?.recentLiquidationCount ?? 0;
    const feedsUp = [
      voiceSnapshot?.wsLive,
      voiceSnapshot?.orderflowState === "LIVE",
      voiceSnapshot?.liquidationState === "LIVE",
      engineStatus === "ok",
    ].filter(Boolean).length;
    const gmilConsensus = institutionalConsensus ?? { score: null, sampleSize: 0, contributingProviders: [] };
    // Evolução Integrativa §6: os 6 eixos do modelo de síntese auditável,
    // derivados do MESMO NexusDecision do badge (derive* puros — zero
    // recomputação, LEI 24). Vive AQUI (lista vertical, visível em toque no
    // iPad) porque o tooltip do badge não aparece em tap — a mesma lição da
    // Auditoria Final de Integração.
    const synthRisk = nexusDecision ? deriveRiskState(nexusDecision) : null;
    body = (
      <>
        <ModulePanel title="Síntese Operacional · 6 eixos auditáveis (mesma fonte do badge)">
          {nexusDecision ? (
            <>
              <ModuleStat
                label="Direção (BIAS)"
                value={deriveBiasLabel(nexusDecision)}
                tone={deriveBiasLabel(nexusDecision) === "LONG_BIAS" ? "long" : deriveBiasLabel(nexusDecision) === "SHORT_BIAS" ? "short" : "neutral"}
              />
              <ModuleStat label="Estrutura (SETUP)" value={deriveSetupState(nexusDecision)} />
              <ModuleStat label="Timing (ENTRY)" value={deriveEntryState(nexusDecision)} />
              {synthRisk && (
                <ModuleStat
                  label="Risco"
                  value={`${synthRisk.state} — ${synthRisk.basis}`}
                  tone={synthRisk.state === "ACEITÁVEL" ? "long" : "short"}
                />
              )}
              <ModuleStat label="Confluência" value={deriveConfluenceState(nexusDecision)} />
              <ModuleStat
                label="Decisão"
                value={deriveOutcomeLabel(nexusDecision)}
                tone={deriveOutcomeLabel(nexusDecision) === "LONG" ? "long" : deriveOutcomeLabel(nexusDecision) === "SHORT" ? "short" : "neutral"}
              />
              {/* EPC MODO ELITE ABSOLUTO §10 (Recuperação de Recursos): a
                  CONFIRMAÇÃO real que o Core Engine exige antes do setup valer
                  (required_confirmation, LONG/SHORT) ou o gatilho de
                  reavaliação (WAIT) — engine.condition, computado pelo
                  engine-bridge desde sempre mas nunca exibido a ninguém.
                  Inteligência real do núcleo, agora visível. Só quando há
                  string real (fail-closed: DADOS_INSUFICIENTES/null some). */}
              {typeof engine?.condition === "string" && engine.condition.length > 0 && engine.condition !== "DADOS_INSUFICIENTES" && (
                <ModuleStat label="Confirmação exigida (Núcleo)" value={engine.condition} />
              )}
            </>
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">
              AWAITING FIRST REAL CYCLE — synthesis derives from the fused NexusDecision contract (fail-closed)
            </span>
          )}
        </ModulePanel>
        <ModulePanel title="Trade Plan · real structure only (advisory, read-only)">
          {tradePlan ? (
            <>
              {/* Diretriz Complementar §7 ("Inteligência Temporal"): rótulo
                  real de contexto do timeframe ativo — nunca uma medição,
                  ver nexus/timeframe-profile.ts. */}
              {timeframeProfile(chartTimeframe as string) && (
                <ModuleStat
                  label="Perfil do Timeframe"
                  value={`${timeframeProfile(chartTimeframe as string)!.style} · ETA típico: ${timeframeProfile(chartTimeframe as string)!.etaHorizon}`}
                />
              )}
              <ModuleStat label="Direction" value={tradePlan.direction} tone={tradePlan.direction === "LONG" ? "long" : "short"} />
              <ModuleStat label="Entry Zone" value={`${tradePlan.entry.low.toFixed(0)}–${tradePlan.entry.high.toFixed(0)} (${tradePlan.entry.basis})`} />
              <ModuleStat label="Stop" value={`${tradePlan.stop.price.toFixed(0)} (${tradePlan.stop.basis})`} tone="short" />
              {/* v2 (Diretriz Complementar §2): a escada real inteira — 1 a
                  MAX_TARGETS alvos, nunca truncada a um só. §3: cada alvo
                  restante carrega a ETA dinâmica real quando estimável
                  (nunca um número fabricado sem progresso direcional). */}
              {tradePlan.targets.map((target, i) => (
                <ModuleStat
                  key={i}
                  label={tradePlan.targets.length > 1 ? `Target ${i + 1}` : "Target"}
                  value={`${target.price.toFixed(0)} (${target.basis})${typeof price.price === "number" && Number.isFinite(price.price) && price.price > 0 ? ` · ${(Math.abs(target.price - price.price) / price.price * 100).toFixed(2)}%` : ""}${tradePlan.riskRewardRatios[i] !== null ? ` · 1:${tradePlan.riskRewardRatios[i]!.toFixed(2)}${rrFloorSuffix(tradePlan.riskRewardRatios[i])}` : ""}${etaReading?.status === "OK" && etaReading.etas[i] ? ` · ${formatEtaRange(etaReading.etas[i].msMin ?? null, etaReading.etas[i].ms) ?? ""}` : ""}${obstacleSuffix(target.obstacleCount)}`}
                  tone="long"
                />
              ))}
            </>
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">
              NO COHERENT PLAN — requires a directional Council stance, a clear risk gate and real structure on both sides (fail-closed)
            </span>
          )}
        </ModulePanel>
        <ModulePanel title="Decision Context · Liquidity, Risk & System (real)">
          <ModuleStat
            label="Order Book Liquidity"
            value={hasLiquidity ? `BID ${Math.round(buyPercent!)}%` : MODULE_EMPTY}
            tone={hasLiquidity ? (buyPercent! >= 50 ? "long" : "short") : "neutral"}
          />
          <ModuleStat
            label="Risk"
            value={stopDistPct !== null ? `STOP ${stopDistPct.toFixed(2)}%` : liqCount > 0 ? `${liqCount} LIQUIDATIONS` : MODULE_EMPTY}
            tone={liqCount > 0 && stopDistPct === null ? "short" : "neutral"}
          />
          <ModuleStat label="Global Context (GMIL)" value={formatConsensusScore(gmilConsensus.score)} />
          <ModuleStat
            label="System"
            value={engineStatus === "ok" ? "OK" : engineStatus === "pending" ? "STARTING" : "FAILED"}
            tone={engineStatus === "ok" ? "long" : engineStatus === "pending" ? "neutral" : "short"}
          />
          <ModuleStat label="Data Feeds" value={`${feedsUp}/4`} tone={feedsUp === 4 ? "long" : feedsUp >= 2 ? "neutral" : "short"} />
          <ModuleStat label="Last Update" value={lastUpdateAt ? time(lastUpdateAt) : MODULE_EMPTY} />
        </ModulePanel>
        <ModulePanel title="Multi-Agent Council (real votes)">
          <ModuleStat label="Stance" value={council ? council.stance : MODULE_EMPTY} tone={council?.stance === "LONG" ? "long" : council?.stance === "SHORT" ? "short" : "neutral"} />
          <ModuleStat label="Agreement" value={council?.agreement !== null && council ? pct(council.agreement) : MODULE_EMPTY} />
          {/* EPC MODO ELITE (Recuperação de Inteligência Oculta §2): a
              DISTRIBUIÇÃO real do pool linear (Stone/DeGroot) — L/S/N — já
              alimenta o Scenario Engine (pesa os caminhos), mas nunca era
              mostrada como número. Agreement é só o escalar de coesão
              derivado dela (não revela a FORMA da divisão: onde o
              não-consenso senta). Massa de OPINIÃO do comitê, NUNCA
              probabilidade de mercado (mesma honestidade de todo o pool).
              Fail-closed: abstido (opinionMass null) → MODULE_EMPTY. */}
          <ModuleStat
            label="Opinion Mass (L/S/N)"
            value={council?.opinionMass ? `L ${Math.round(council.opinionMass.long * 100)} · S ${Math.round(council.opinionMass.short * 100)} · N ${Math.round(council.opinionMass.neutral * 100)}` : MODULE_EMPTY}
          />
          <ModuleStat label="Quorum" value={council ? `${council.quorum}/6` : MODULE_EMPTY} />
          <ModuleStat label="Risk Gate" value={council ? (council.riskGated ? "LOCKED (fail-closed)" : "CLEAR") : MODULE_EMPTY} tone={council?.riskGated ? "short" : "long"} />
        </ModulePanel>
        <ModulePanel title="Scenario Paths · council opinion mass, never market probability">
          <ModuleStat label="Path A" value={scenario ? formatScenarioPathLabel(scenario.pathA) : MODULE_EMPTY} tone={scenario?.pathA.direction === "LONG" ? "long" : "short"} />
          <ModuleStat label="Path B" value={scenario ? formatScenarioPathLabel(scenario.pathB) : MODULE_EMPTY} tone={scenario?.pathB.direction === "LONG" ? "long" : "short"} />
        </ModulePanel>
        {/* Support S1/Resistance R1 used to live here too — moved out per
            Zero Repetição once the always-visible bar's StructureLevelsStrip
            became their one and only home (Operador feedback: seeing S1/R1
            shouldn't require opening this tab). Chart-timeframe/1H structure
            labels are a different datum (trend classification, not a price
            level) and stay here — they have no other home on screen.
            Label reads the real active chartTimeframe (achado real de
            auditoria, FASE Ω Priority 3): o rótulo dizia "15m Structure"
            fixo mesmo quando engine.marketStructureLabel já respondia a
            qualquer timeframe selecionado no gráfico — 1H continua fixo de
            propósito (HTF_INTERVAL hardcoded em engine-bridge.ts). */}
        <ModulePanel title="Market Structure (real engine labels)">
          <ModuleStat label={`${chartTimeframe ?? "15m"} Structure`} value={engine?.marketStructureLabel ?? MODULE_EMPTY} />
          <ModuleStat label="1H Structure" value={engine?.htfMarketStructureLabel ?? MODULE_EMPTY} />
        </ModulePanel>
        <ModulePanel title="Fibonacci Confluence (real retracement × real levels)">
          {fibLevels.length > 0 ? (
            fibLevels.map((l: any) => (
              <ModuleStat key={l.ratio} label={`${(l.ratio * 100).toFixed(1)}% @ ${l.price.toFixed(0)}`} value={`${l.score} confluent source${l.score === 1 ? "" : "s"}`} />
            ))
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">NO CONFLUENT LEVEL IN THIS WINDOW (honest result)</span>
          )}
        </ModulePanel>
        {/* Refinamento Final §8 + Carta Branca (Reconhecimento de Padrões):
            todas as famílias de padrão geométrico real detectadas sobre os
            MESMOS swings fractais compartilhados — harmônicos XABCD/Wolfe
            (harmonic-patterns.ts), Triângulo (triangle-pattern.ts) e
            Ombro-Cabeça-Ombro (head-shoulders-pattern.ts). "fit" é
            ADERÊNCIA GEOMÉTRICA de cada motor (razão Fibonacci/R² do
            trendline/simetria de ombros) — nunca probabilidade de acerto
            (Regra de Ouro 2; o título diz isso). Painel único ("não é
            excesso demais", feedback do Operador): cada família soma no
            máximo 1-3 linhas honestas, nunca um painel próprio por família.
            Lista vazia é o estado honesto comum: padrões completos e
            frescos são raros por construção. */}
        <ModulePanel title="Chart Patterns · geometric fit, never probability">
          {harmonicHits.length > 0 || trianglePattern || headShouldersPattern ? (
            <>
              {harmonicHits.map((h, i) => (
                <ModuleStat
                  key={`harmonic-${i}`}
                  label={`${h.pattern} ${h.direction}`}
                  value={`PRZ @ ${h.points.D.price.toFixed(0)} · fit ${(h.fitScore * 100).toFixed(0)}%`}
                  tone={h.direction === "BULLISH" ? "long" : "short"}
                />
              ))}
              {trianglePattern && (
                <ModuleStat
                  label={`${trianglePattern.kind} TRIANGLE`}
                  value={`${trianglePattern.apexIndex !== null ? `Apex ahead · fit` : `Apex behind · fit`} ${(trianglePattern.fitScore * 100).toFixed(0)}%`}
                  tone={trianglePattern.direction === "BULLISH" ? "long" : trianglePattern.direction === "BEARISH" ? "short" : "neutral"}
                />
              )}
              {headShouldersPattern && (
                <ModuleStat
                  label={headShouldersPattern.kind === "REGULAR" ? "HEAD & SHOULDERS" : "INVERSE H&S"}
                  value={`Neckline @ ${headShouldersPattern.necklineAtLastCandle.toFixed(0)} · fit ${(headShouldersPattern.fitScore * 100).toFixed(0)}%`}
                  tone={headShouldersPattern.direction === "BULLISH" ? "long" : "short"}
                />
              )}
            </>
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">
              NO FRESH GEOMETRIC PATTERN ≥ {(MIN_FIT_SCORE * 100).toFixed(0)}% FIT (honest result)
            </span>
          )}
        </ModulePanel>
        {/* Refinamento Final §7: o dealing range real Premium/EQ/Discount —
            o mesmo desenhado no gráfico e usado como contexto do Trade Plan. */}
        <ModulePanel title="Premium / Discount (real dealing range)">
          {premiumDiscountView ? (
            <>
              <ModuleStat label="Zone (last close)" value={premiumDiscountView.zone} tone={premiumDiscountView.zone === "DISCOUNT" ? "long" : premiumDiscountView.zone === "PREMIUM" ? "short" : "neutral"} />
              <ModuleStat label="Range" value={`${premiumDiscountView.rangeLow.price.toFixed(0)} – ${premiumDiscountView.rangeHigh.price.toFixed(0)}`} />
              <ModuleStat label="Equilibrium (50%)" value={premiumDiscountView.equilibrium.toFixed(0)} />
              <ModuleStat label="Price position" value={`${premiumDiscountView.pricePositionPct.toFixed(0)}% of range`} />
            </>
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">NO CONFIRMED DEALING RANGE YET (needs one swing high + one swing low, fail-closed)</span>
          )}
        </ModulePanel>
        <ModulePanel title="Volume Profile (WASM, real)">
          <ModuleStat label="Point of Control" value={vp ? vp.pocPrice.toFixed(0) : MODULE_EMPTY} />
          <ModuleStat label="High-Volume Nodes" value={vp ? String(vp.hvnIndices.length) : MODULE_EMPTY} />
          <ModuleStat label="Low-Volume Nodes" value={vp ? String(vp.lvnIndices.length) : MODULE_EMPTY} />
        </ModulePanel>
        {/* Consolidação Final §21-§30: VWAP (estado + distância, matemática
            intocada) × Nexus Line (equilíbrio proprietário, pesos 0.5/0.5
            documentados) × confluência informativa — mesmas leituras do
            header/gráfico, nunca uma segunda computação. */}
        <ModulePanel title="VWAP × Nexus Line (equilíbrios reais + confluência informativa)">
          <ModuleStat
            label="VWAP (estado c/ histerese)"
            value={vwapCtx ? `${vwapCtx.state} · ${vwapCtx.distancePct >= 0 ? "+" : ""}${vwapCtx.distancePct.toFixed(2)}% do preço` : MODULE_EMPTY}
            tone={vwapCtx?.state === "BULLISH" ? "long" : vwapCtx?.state === "BEARISH" ? "short" : "neutral"}
          />
          <ModuleStat
            label="Nexus Line (NL)"
            value={nlState ?? MODULE_EMPTY}
            tone={nlState === "BULLISH" ? "long" : nlState === "BEARISH" ? "short" : "neutral"}
          />
          <ModuleStat
            label="Confluência VWAP×NL×Decisão"
            value={nexusConfluence ?? "SEM VEREDITO (leitura incompleta ou AGUARDAR)"}
            tone={nexusConfluence === "ALINHADA" ? "long" : nexusConfluence === "CONFLITO_ESTRUTURAL" ? "short" : "neutral"}
          />
          <span className="text-[0.42rem] text-[#8ab4f8]/40 leading-tight">
            Informativo (LEI 24): confluência nunca altera nem bloqueia a operação do Core Engine.
          </span>
        </ModulePanel>
      </>
    );
  } else if (tab === "RISK") {
    body = (
      <>
        <ModulePanel title="Position Sizing · Risk Engine (real, advisory only)">
          <ModuleStat label="Suggested Position" value={riskSuggestion ? `${riskSuggestion.suggested_position_pct.toFixed(1)}% equity` : MODULE_EMPTY} />
          <ModuleStat label="Effective Risk" value={riskSuggestion ? `${riskSuggestion.effective_risk_pct.toFixed(2)}%` : MODULE_EMPTY} />
          <span className="text-[0.42rem] text-[#8ab4f8]/40 leading-tight">
            Advisory only — order execution is permanently disabled in this terminal (read-only by design).
          </span>
        </ModulePanel>
        <ModulePanel title="Data Trust Score (WASM, real cadence + cross-exchange convergence)">
          <ModuleStat label="Composite Score" value={trustScore ? pct(trustScore.score) : MODULE_EMPTY} tone={trustScore && trustScore.score >= 0.7 ? "long" : trustScore ? "short" : "neutral"} />
          <ModuleStat label="Cadence Regularity" value={trustScore ? pct(trustScore.cadenceRegularity) : MODULE_EMPTY} />
          <ModuleStat label="Cross-Exchange Convergence" value={trustScore?.crossExchangeConvergence !== null && trustScore ? pct(trustScore.crossExchangeConvergence) : "NOT MEASURED (honest)"} />
        </ModulePanel>
        <ModulePanel title="Perception Index (CPI · reward/pain memory, real transitions)">
          <ModuleStat label="CPI" value={cpi !== null ? pct(cpi) : MODULE_EMPTY} tone={cpi !== null && cpi >= 0.5 ? "long" : cpi !== null ? "short" : "neutral"} />
        </ModulePanel>
        <ModulePanel title="Signal Track Record (real first-touch outcomes, persisted)">
          <ModuleStat label="Open Plan" value={trackRecord.active ? `${trackRecord.active.plan.direction} since ${new Date(trackRecord.active.openedAt).toLocaleTimeString("en-US", { hour12: false })}` : "NONE"} />
          <ModuleStat label="Target Hits" value={String(trackRecord.targetHits)} tone="long" />
          {/* Cockpit de Leitura §11: ETA previsto (carimbado na abertura) ×
              realizado (resolvedAt − openedAt, fatos já registrados) do
              último plano RESOLVIDO com carimbo — dash honesto sem ambos. */}
          {(() => {
            for (let i = trackRecord.history.length - 1; i >= 0; i--) {
              const h = trackRecord.history[i];
              if (h.status === "REPLACED" || h.resolvedAt === null) continue;
              const previsto = h.contextAtOpen ? formatEtaRange(h.contextAtOpen.etaMsMinAtOpen, h.contextAtOpen.etaMsAtOpen) : null;
              const realizado = formatEtaDuration(h.resolvedAt - h.openedAt);
              return (
                <ModuleStat
                  label="ETA previsto × realizado (último resolvido)"
                  value={previsto && realizado ? `${previsto} × ${realizado}` : MODULE_EMPTY}
                />
              );
            }
            return null;
          })()}
          <ModuleStat label="Stop Hits" value={String(trackRecord.stopHits)} tone="short" />
          {/* Achado real de auditoria: hitRate(trackRecord) era chamada 4x
              inline na mesma expressão JSX pelo mesmo trackRecord real —
              mesmo padrão já corrigido e documentado alhures neste arquivo
              (ver comentário de lorentzianConfidencePct). IIFE calcula uma
              vez, zero mudança de comportamento/valor exibido. */}
          {(() => {
            const currentHitRate = hitRate(trackRecord);
            return (
              <ModuleStat
                label="Hit Rate"
                value={currentHitRate !== null ? pct(currentHitRate) : "NO RESOLVED PLAN YET (honest)"}
                tone={currentHitRate !== null && currentHitRate >= 0.5 ? "long" : currentHitRate !== null ? "short" : "neutral"}
              />
            );
          })()}
          <ModuleStat label="Superseded" value={String(trackRecord.replaced)} />
          <span className="text-[0.42rem] text-[#8ab4f8]/40 leading-tight">
            First-touch evaluation, conservative on gaps (stop wins). Superseded plans never count as wins or losses.
          </span>
        </ModulePanel>
        <ModulePanel title="Institutional Traps (real corroborated events)">
          {traps.length > 0 ? (
            traps.map((t: any, i: number) => (
              <ModuleStat key={`${t.kind}-${i}`} label={`${t.kind} · ${time(t.at)}`} value={pct(t.confidence)} tone="short" />
            ))
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">NO TRAP DETECTED IN THIS WINDOW (honest result)</span>
          )}
        </ModulePanel>
      </>
    );
  } else if (tab === "SCANNER") {
    body = scannerTable;
  } else if (tab === "ALERTS") {
    body = (
      <>
        <ModulePanel title="Order Flow Signals (real MEXC trades)">
          {Array.isArray(orderflowSignals) && orderflowSignals.length > 0 ? (
            orderflowSignals.slice(0, 8).map((s: any, i: number) => (
              <ModuleStat key={`${s.type}-${s.timestamp}-${i}`} label={`${s.type} @ ${num(s.price)}`} value={`${pct(s.confidence)} · ${time(s.timestamp)}`} />
            ))
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">NO ACTIVE SIGNAL (honest result)</span>
          )}
        </ModulePanel>
        <ModulePanel title={`Forced Liquidations · Binance Futures (real feed${liquidationState === "LIVE" ? ", LIVE" : liquidationState === "ERROR" ? ", ERROR" : ""})`}>
          {Array.isArray(liquidations) && liquidations.length > 0 ? (
            liquidations.slice(0, 8).map((l: any, i: number) => (
              <ModuleStat key={`${l.timestamp}-${i}`} label={`${l.side === "LONG_LIQUIDATED" ? "LONG LIQ" : "SHORT LIQ"} @ ${num(l.price)}`} value={`$${Math.round(l.notionalUsd).toLocaleString("en-US")} · ${time(l.timestamp)}`} tone={l.side === "LONG_LIQUIDATED" ? "short" : "long"} />
            ))
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">NO LIQUIDATION RECEIVED YET (real feed, event-driven)</span>
          )}
        </ModulePanel>
        <ModulePanel title="Trap Alerts (real corroborated events)">
          {traps.length > 0 ? (
            traps.map((t: any, i: number) => (
              <ModuleStat key={`${t.kind}-${i}`} label={`${t.kind} · ${time(t.at)}`} value={pct(t.confidence)} tone="short" />
            ))
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">NO TRAP DETECTED IN THIS WINDOW (honest result)</span>
          )}
        </ModulePanel>
      </>
    );
  } else if (tab === "NEWS") {
    body = (
      <>
        <ModulePanel title="News Feed">
          <span className="text-[0.48rem] text-[#8ab4f8]/60 leading-relaxed">
            NO REAL NEWS FEED CONNECTED. This terminal never fabricates headlines — this panel stays
            empty (fail-closed) until a real news source is integrated.
          </span>
        </ModulePanel>
        <ModulePanel title="Market Context Providers · GMIL (real)">
          {Array.isArray(gmilProviders) && gmilProviders.length > 0 ? (
            gmilProviders.map((p: any) => (
              <ModuleStat key={p.id} label={p.id} value={`${p.circuitState ?? MODULE_EMPTY} · weight ${pct(p.weight)}`} tone={p.circuitState === "OPEN" ? "short" : p.weight > 0.6 ? "long" : "neutral"} />
            ))
          ) : (
            <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest">{MODULE_EMPTY}</span>
          )}
        </ModulePanel>
      </>
    );
  } else {
    // EXECUTION — permanently empty by design, not "waiting".
    body = (
      <ModulePanel title="Order Execution">
        <span className="text-[0.48rem] text-[#8ab4f8]/60 leading-relaxed">
          ORDER EXECUTION IS PERMANENTLY DISABLED. This terminal is read-only by design (fail-closed):
          no exchange API keys, no order-routing code paths exist in this codebase. Long/Short readings,
          Entry/Target/Stop levels and position sizing shown anywhere in this terminal are analytical
          output only — never live orders.
        </span>
      </ModulePanel>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="tracking-[0.3em] font-black text-sm text-[#00f0ff] uppercase">{tab}</span>
        <span className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest uppercase">real data only · fail-closed</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">{body}</div>
    </div>
  );
}

// Ordem "Lapidação Visual Final" §7 — leitura O/H/L/C do candle real mais
// recente. Puramente exibição: lê os campos crus do MESMO array que o
// gráfico desenha, nunca deriva nada (variação/percentual seriam cálculo
// novo na UI, que a §6 da própria Ordem proíbe — e a Ordem pede
// literalmente "O / H / L / C", não a variação). Fail-closed: sem candle
// real com os 4 campos O/H/L/C finitos, devolve null e some — nunca um
// traço ou zero fabricado ocupando espaço no cabeçalho do gráfico.
//
// Especificação Visual Profissional v1 (pedido direto do Operador): V
// (volume) somado como 5º campo, mesma disciplina — `candle.volume` é o
// MESMO dado real que já alimenta Footprint/Volume Profile/Liquidity
// Void neste app (zero segundo cálculo), nunca `volume × preço` (isso
// SIM seria um cálculo novo — Regra de Ouro 1/4). Rótulo fica "V", nunca
// "$V" ou qualquer prefixo de moeda: a unidade real de `volume` neste
// app é o ATIVO-BASE (engine-bridge.ts: `unit: 'base_asset'`, ex. BTC),
// não notional em USD — um prefixo de dólar aqui seria uma alegação
// falsa sobre o próprio dado. Opcional/aditivo: candles sem `volume`
// finito continuam mostrando só O/H/L/C, como sempre (fail-closed por
// campo, não all-or-nothing).
// Cores por campo (paleta v1): O neutro, H verde, L vermelho, C branco
// (o mais recente/acionável), V ciano — mesma família semântica já
// usada no resto do gráfico (verde/vermelho = alta/baixa, ciano = EMA/
// referência técnica).
function fmtVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}
function OhlcReadout({
  candles,
  hoverCandle,
}: {
  candles?: Array<{ open?: number; high?: number; low?: number; close?: number; volume?: number }>;
  // Achado real da AUDITORIA TÉCNICA COMPLETA (item B16): candle real sob o
  // cursor/dedo (EnhancedChart_110_Percent's onHoverCandleChange, via
  // subscribeCrosshairMove nativo da lib). null/absent = cursor fora do
  // gráfico ou chamador que ainda não passa a prop — cai no último candle
  // real, o comportamento de sempre (fail-closed, nunca um estado novo
  // quebra um caso que já funcionava).
  hoverCandle?: { open?: number; high?: number; low?: number; close?: number; volume?: number } | null;
}) {
  const last = Array.isArray(candles) && candles.length > 0 ? candles[candles.length - 1] : null;
  const isHover = !!hoverCandle;
  const shown = hoverCandle ?? last;
  if (!shown) return null;
  const fields: Array<[string, number | undefined, string]> = [
    ["O", shown.open, "text-[#888888]"],
    ["H", shown.high, "text-[#22c55e]"],
    ["L", shown.low, "text-[#ef4444]"],
    ["C", shown.close, "text-[#e5e5e5] font-semibold"],
  ];
  if (!fields.every(([, v]) => num(v))) return null;
  const hasVolume = num(shown.volume);
  return (
    <div
      className={`hidden lg:flex items-center gap-1.5 mr-2 font-mono whitespace-nowrap shrink-0 ${isHover ? "border-b border-[#00f0ff60]" : ""}`}
      title={
        isHover
          ? "Abertura/Máxima/Mínima/Fechamento/Volume do candle sob o cursor — mesmo array que o gráfico desenha, nunca um segundo cálculo. Volume em unidade do ativo-base, nunca notional USD."
          : "Abertura/Máxima/Mínima/Fechamento/Volume do candle real mais recente, do mesmo array que o gráfico desenha — nunca um segundo cálculo. Volume em unidade do ativo-base, nunca notional USD."
      }
    >
      {isHover && <Crosshair size={9} className="text-[#00f0ff]" strokeWidth={2} />}
      {fields.map(([k, v, color]) => (
        <span key={k} className={color}>
          <span className="text-[#8ab4f8]/40">{k}</span> {fmt(v)}
        </span>
      ))}
      {hasVolume && (
        <span className="text-[#06b6d4]">
          <span className="text-[#8ab4f8]/40">V</span> {fmtVolume(shown.volume as number)}
        </span>
      )}
    </div>
  );
}

function ChartWidget({ chartData, onRequestOlderCandles, priceData }: any) {
  // Real Fair Value Gaps / Order Blocks / Liquidity zones — computed once
  // in App() (see contextValue) against this exact candle array, shared
  // with the Neural Core widget's tactical-context prompt so both use the
  // same real counts rather than two independent computations. V18 Sprint
  // 1 (Tarefa B): EnhancedChart_110_Percent (lightweight-charts) lê o
  // dado REAL sem janela/offset manual — pan/zoom nativos da própria lib
  // navegam o histórico completo já carregado, então o remapeamento de
  // índice que o zoom "fatiado" antigo exigia deixou de existir.
  const { smcZones, tradePlanStructureZones, bosChoch, liquidityVoids, selectedAsset, engine, chartTimeframe, setChartTimeframe, chartLayerVisibility, chartLayerAutoMode, emaPeriod, confidenceZone, nexusDecision, vwapCtx, nlState, orderflowTrend, liquidations } = useContext(WidgetContext) || {};
  // OMEGA CORE V-MAX Fase 5 (Corredor de Confluência): a Neural Market
  // Aura lia direto convictionReading (só o pool de 3 subsistemas) para a
  // largura do corredor — mesma leitura que confluenceCorridor.intensity
  // já é, agora TAMBÉM ciente de obstáculos estruturais reais no caminho
  // até o alvo (Fase 5, confluence-corridor.ts). Seletor direto da store
  // (mesmo padrão de useLayerRelevanceSnapshot já usado neste componente),
  // nunca uma segunda leitura via WidgetContext para o mesmo dado.
  const confluenceCorridor = useConfluenceCorridorSnapshot();
  // EPC OMEGA FINAL, Etapa 10 ("Liquidity Sweep"): mesma store que
  // AssistantOrb/CouncilWidget já leem (nexus/trap-detection.ts) — o
  // gráfico nunca tinha assinado esta fatia, então o sweep real nunca
  // ganhava sua própria price line (só existia como texto em outros
  // painéis). Zero segunda coleta/cálculo.
  const traps = useTrapSignalsSnapshot();
  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();
  // Achado real da AUDITORIA TÉCNICA COMPLETA (item B16): candle sob o
  // cursor/dedo, alimentado por EnhancedChart_110_Percent's
  // onHoverCandleChange (subscribeCrosshairMove nativo da lib — zero mouse
  // tracking manual aqui). null = cursor fora do gráfico; OhlcReadout cai
  // de volta no último candle real, o comportamento de sempre.
  const [hoveredCandle, setHoveredCandle] = useState<{ time: number; open: number; high: number; low: number; close: number; volume?: number } | null>(null);
  // Correção de latência REAL (achado de auditoria — Ordem "Unificação da
  // Inteligência Operacional" §4: "preço de uma atualização com níveis de
  // outra... um painel atualizado e outro atrasado"): esta leitura vinha
  // do hook de preço da store, um espelho Zustand que um useEffect
  // (`[priceData]`) em App() escreve — sempre UM commit de render DEPOIS
  // da barra
  // superior, que lê `priceData` direto por prop (síncrono com o próprio
  // tick de WS). Gap documentado no header de EnhancedChart_110_Percent.tsx
  // desde a captura real que o achou ("~30s de defasagem possível"),
  // registrado como pendência e nunca fechado até agora. `priceData`
  // chega aqui como prop — mesmo valor, mesmo commit que a TopBar já usa,
  // zero segunda coleta de rede — então o preço do gráfico e o da barra
  // superior agora vêm sempre do mesmo render, nunca mais um atrás do
  // outro. useMemo por valor (não pela referência sempre-nova que
  // setPrice() cria a cada tick, mesmo quando só delta/volume mudam):
  // os dois useMemo abaixo que dependem de `livePrice` só recomputam
  // quando o NÚMERO do preço muda de verdade — igual ou melhor que a
  // referência do Zustand, nunca pior.
  const livePrice = useMemo(() => ({ price: priceData?.price ?? null }), [priceData?.price]);
  // Signal Precision order: the same real Trade Plan slice the ANALYSIS
  // view shows, now drawn on the chart as silk-thread price lines.
  const chartTradePlan = useTradePlanSnapshot();
  // EPC §5/§6 ("Nunca simplesmente esconder essas informações"): sem
  // plano ativo, o CANVAS agora explica o motivo real — mesma função pura
  // já usada pela barra de comando (tradePlanAbsenceReason, módulo acima),
  // nunca uma segunda leitura/lógica. useCouncilSnapshot() é o MESMO hook
  // Zustand que TradePlanTopStrip já usa — zero prop-drilling novo.
  const councilForChart = useCouncilSnapshot();
  // Achado 2.4: mesmo hook/mesma leitura de histórico que TradePlanTopStrip
  // já usa (useTrackRecordSnapshot) — zero segunda fonte para "qual foi o
  // último plano resolvido".
  const trackRecordForChart = useTrackRecordSnapshot();
  const lastResolvedPlanForChart = trackRecordForChart.history[trackRecordForChart.history.length - 1] ?? null;
  const chartTradePlanAbsenceReason = chartTradePlan
    ? null
    : tradePlanAbsenceReason(
        councilForChart,
        engine?.direction ?? null,
        recentResolutionReason(lastResolvedPlanForChart, Date.now(), TIMEFRAME_MS[chartTimeframe as string] ?? TIMEFRAME_MS["15m"]),
      ).reason;
  // EPC §5/§6 (continuação — relato direto do Operador: "falta aparecer
  // entrada e alvo/alvo2/alvo3 no gráfico"): o Core Engine (LEI 24, único
  // emissor real de LONG/SHORT/WAIT) já computa seu PRÓPRIO stop/target1/
  // target2/R:R a cada ciclo real — Target Tracker (target-tracker.js,
  // rota_a_long/rota_b_short), alimentado por support_1/2 e resistance_1/2
  // do support-resistance-engine.js (motor graduado, já rodando). Esse
  // dado real já alimenta os painéis ANALYSIS/RISK há sessões, mas NUNCA
  // era desenhado no canvas — só o Trade Plan do Conselho (mais raro: 4
  // portões honestos em cascata, trade-plan.ts) chegava ao gráfico. Isto é
  // aditivo puro (Regra de Ouro 4): quando o Conselho ainda não confirma
  // (chartTradePlan null) mas o Núcleo já tem direção real, o canvas
  // finalmente mostra o que o Núcleo sabe — mesmo texto final do EPC ("Se
  // o núcleo sabe, o operador também deve saber"). NUNCA substitui/altera
  // o Trade Plan do Conselho quando ele existe (LEI 24 intacta: o Núcleo
  // continua sendo só o Núcleo, isto não é uma 2ª "trade plan" oficial).
  // ENTRY fica de fora de propósito: o "entry" do Núcleo é tracker.
  // current_price — o PRÓPRIO preço vivo, já desenhado nativamente pelo
  // eixo (lightweight-charts) — uma 2ª linha ali seria redundante, nunca
  // informação nova (contra "nada cobrindo a visão", achado de sessão
  // anterior).
  const engineFallbackLevels = useMemo(() => {
    if (chartTradePlan) return null;
    const dir = engine?.direction;
    if (dir !== "LONG" && dir !== "SHORT") return null;
    const stop = engine?.stop;
    // Achado real (relato direto do Operador: "mesmo em qualquer timeframe
    // tinha que aparecer" — nunca apareceu, em nenhum). Bug real, não
    // atraso de deploy: o objeto `engine` (useMemo acima, ~linha 1505)
    // expõe o alvo 1 bruto sob o nome `target` (a variável local que virou
    // esse nome no return — só `target1Strength`, o METADADO de força,
    // manteve o sufixo "1"). `engine?.target1` nunca existiu — sempre
    // `undefined`, então este gate fail-closed retornava null 100% do
    // tempo, disfarçado de "sem dado real" quando na verdade era "nome de
    // campo errado". Corrigido para o nome real do campo.
    const target1 = engine?.target;
    if (typeof stop !== "number" || !Number.isFinite(stop)) return null;
    if (typeof target1 !== "number" || !Number.isFinite(target1)) return null;
    const target2 = typeof engine?.target2 === "number" && Number.isFinite(engine.target2) ? engine.target2 : null;
    // Achado de auditoria (Ferramentas Institucionais): extensão de
    // Fibonacci 61.8% — mesmo passthrough de target/target2, nenhum
    // cálculo novo. target-tracker.js não computa força/obstáculos para
    // este nível (só existe em support-resistance-engine.js), então TP3
    // é mais simples que TP1/TP2: só o preço, sem strength/obstacleCount.
    const target3 = typeof engine?.extendedTarget === "number" && Number.isFinite(engine.extendedTarget) ? engine.extendedTarget : null;
    // EPC §5 ("obstáculos estruturais... em qualquer ativo e qualquer
    // timeframe"): a entrada real do Núcleo é o preço atual
    // (tracker.current_price, exposto como engine.entry) — o mesmo ponto de
    // referência que chartObstacleZones usa abaixo para contar as zonas
    // estruturais REAIS no caminho até cada alvo do Núcleo. null quando o
    // ciclo não tem entrada real (fail-closed).
    const entry = typeof engine?.entry === "number" && Number.isFinite(engine.entry) ? engine.entry : null;
    // EPC MODO ELITE §4 ("Obstáculos estruturais" na lista do Trade Plan
    // permanente): contagem REAL por alvo, via a MESMA obstacleZonesInPath
    // (trade-plan.ts) que o plano do Conselho usa — zero segundo cálculo.
    // O Núcleo, diferente do Conselho, NÃO tem painel próprio (ANALYSIS),
    // então o rótulo do gráfico é o único lugar onde essa contagem chega ao
    // Operador — por isso entra aqui (o rótulo do Conselho não mostra ⚠N
    // porque o painel dele já mostra). null quando falta entrada real.
    const structZones = tradePlanStructureZones ?? [];
    const obstacleCountTo = (targetPrice: number | null): number | null =>
      entry !== null && targetPrice !== null && Number.isFinite(targetPrice)
        ? obstacleZonesInPath(structZones, { low: entry, high: entry, basis: "" }, targetPrice, dir === "LONG").length
        : null;
    return {
      direction: dir,
      entry,
      stop,
      target1,
      target1Strength: engine?.target1Strength ?? null,
      target1ObstacleCount: obstacleCountTo(target1),
      target2,
      target2Strength: engine?.target2Strength ?? null,
      target2ObstacleCount: obstacleCountTo(target2),
      target3,
      riskRewardRatio: typeof engine?.riskRewardRatio === "number" && Number.isFinite(engine.riskRewardRatio) ? engine.riskRewardRatio : null,
    };
  }, [chartTradePlan, tradePlanStructureZones, engine?.direction, engine?.entry, engine?.stop, engine?.target, engine?.target2, engine?.extendedTarget, engine?.target1Strength, engine?.target2Strength, engine?.riskRewardRatio]);
  // Diretriz Restauração/Inteligência Visual §6 ("risco visual... obstáculo
  // estrutural"): união das zonas REAIS (tradePlanStructureZones, as MESMAS
  // que já geram targets[i].obstacleCount acima na store) que ficam no
  // caminho entrada→algum alvo do plano ATIVO — o LiquidityZonesPlugin usa
  // isto só para destacar a borda das zonas que já desenha, nunca uma zona
  // nova. Vazio sem plano ativo (fail-closed, zero mudança visual de hoje).
  const chartObstacleZones = useMemo(() => {
    if (!tradePlanStructureZones) return [];
    const seen = new Map<string, { low: number; high: number }>();
    // Reusa a MESMA função pura obstacleZonesInPath (trade-plan.ts) — uma
    // única definição de "zona estrutural no caminho entrada→alvo", nunca
    // um segundo cálculo. Fonte da entrada+alvos varia (plano do Conselho
    // OU fallback do Núcleo), a matemática é idêntica.
    const collect = (entryZone: { low: number; high: number }, targetPrices: number[], long: boolean) => {
      for (const price of targetPrices) {
        if (!Number.isFinite(price)) continue;
        for (const z of obstacleZonesInPath(tradePlanStructureZones, { ...entryZone, basis: "" }, price, long)) {
          seen.set(`${z.low}:${z.high}`, { low: z.low, high: z.high });
        }
      }
    };
    if (chartTradePlan) {
      collect(chartTradePlan.entry, chartTradePlan.targets.map((t) => t.price), chartTradePlan.direction === "LONG");
    } else if (engineFallbackLevels && engineFallbackLevels.entry !== null) {
      // EPC §5: o fallback do Núcleo é o caso MAIS comum (o Conselho é mais
      // conservador/raro) — antes desta evolução, o Operador via as linhas
      // STOP/TARGET do Núcleo mas NUNCA a ênfase de obstáculo estrutural no
      // caminho, exatamente o que o §5 pede "em qualquer ativo/timeframe".
      // A entrada do Núcleo é o preço atual (zona de largura zero); os alvos
      // são target1/target2 reais. Mesma ênfase visual (⚠, LiquidityZonesPlugin)
      // que o plano do Conselho já tinha.
      const e = engineFallbackLevels.entry;
      const targets = [engineFallbackLevels.target1, engineFallbackLevels.target2].filter(
        (x): x is number => typeof x === "number" && Number.isFinite(x),
      );
      collect({ low: e, high: e }, targets, engineFallbackLevels.direction === "LONG");
    }
    return [...seen.values()];
  }, [chartTradePlan, tradePlanStructureZones, engineFallbackLevels]);
  // Neural Market Aura: mesmo TrackRecordState real que o Signal Track
  // Record já mantém (useTrackRecordSnapshot, mesmo hook usado pelo efeito
  // de rastreamento em App()) — zero segunda fonte de verdade sobre o
  // ciclo de vida do plano.
  const auraTrackRecord = useTrackRecordSnapshot();
  const auraReading = useMemo(
    () =>
      computeAuraReading({
        trackRecord: auraTrackRecord,
        livePrice: livePrice.price,
        // Fase 5: confluenceCorridor.intensity já É a mesma leitura de
        // convicção (convictionAdjusted ?? conviction) que este campo lia
        // antes, AGORA também descontada por obstáculos estruturais reais
        // no caminho até o alvo — o corredor da Aura fica mais largo
        // (menos concentrado) quando o caminho está obstruído, mesmo com
        // convicção alta, em vez de ignorar essa informação real.
        conviction: confluenceCorridor?.status === "OK" ? confluenceCorridor.intensity : null,
        atrPercent: engine?.marketRegime?.atrPercent ?? null,
        timeframeMs: TIMEFRAME_MS[chartTimeframe as string] ?? TIMEFRAME_MS["15m"],
      }),
    [auraTrackRecord, livePrice, confluenceCorridor, engine?.marketRegime, chartTimeframe],
  );

  // Auditoria de pendências (reconciliação real): o .slice(0,3) abaixo é
  // só decluttering visual do conjunto GERAL de zonas não mitigadas — mas
  // chartObstacleZones/obstacleCount (acima/trade-plan.ts) usam o
  // conjunto COMPLETO, sem teto algum. Sem a união abaixo, um obstáculo
  // REAL do plano ativo podia cair fora dos 3 mais recentes e nunca
  // aparecer desenhado/destacado (⚠, LiquidityZonesPlugin) no gráfico —
  // mesmo sendo citado no texto do alvo ("TP2 · obstáculo x2"): a
  // informação existia, mas ficava invisível para o Operador conferir
  // onde ela está. isObstacle casa por low/high real (mesma identidade
  // que LiquidityZonesPlugin já usa internamente), nunca por índice.
  const isRealObstacle = (z: PriceZone) => chartObstacleZones.some((o) => o.low === z.bottom && o.high === z.top);
  const unmitigatedFvgsAll = (smcZones?.fairValueGaps ?? []).filter((z: PriceZone) => !z.mitigated);
  const unmitigatedBlocksAll = (smcZones?.orderBlocks ?? []).filter((z: PriceZone) => !z.mitigated);
  const unmitigatedFvgs = unmitigatedFvgsAll.filter((z, i) => i < 3 || isRealObstacle(z));
  const unmitigatedBlocks = unmitigatedBlocksAll.filter((z, i) => i < 3 || isRealObstacle(z));
  const unsweptLiquidity = (smcZones?.liquidityZones ?? []).filter((z: LiquidityZone) => !z.swept).slice(0, 4);
  // Liquidity Void (liquidity-void-engine.js): MESMA disciplina real de
  // FVG/Order Block acima — só zonas ainda NÃO mitigadas (preço nunca
  // voltou a preencher o vazio; uma vez preenchido, o void deixou de ser
  // uma referência real) e mesmo teto de decluttering de 3, com a mesma
  // união de obstáculos reais do plano ativo (um void que o plano cruza
  // nunca fica invisível por causa do teto).
  const unmitigatedVoids = (liquidityVoids ?? [])
    .filter((z: PriceZone) => !z.mitigated)
    .filter((z: PriceZone, i: number) => i < 3 || isRealObstacle(z));
  // V-MAX Fase 1 (superfície visual): níveis reais da Matriz de Confluência
  // (Fase 1.4) — mesma store que os agentes leem, só mapeada para o formato
  // do chart (price/ratio/score reais, nada recalculado aqui).
  const fibonacciMatrix = useFibonacciConfluenceSnapshot();
  const fibonacciLevels = fibonacciMatrix
    ? fibonacciMatrix.levels.map((l) => ({ ratio: l.ratio, price: l.price, score: l.score }))
    : null;
  // §6 "Smart Projection Engine": mesma leitura real do Motor de Cenários
  // já usada pelo CouncilWidget/SecondaryModuleView (texto) — aqui vira as
  // 2 price lines reais Path A/B no gráfico (ver comentário da prop
  // `scenario` em EnhancedChart_110_Percent.tsx). Zero segunda fonte.
  const chartScenario = useScenarioSnapshot();
  // Refinamento Final §7: dealing range Premium/EQ/Discount real para as 3
  // linhas de contexto do gráfico (mesma fatia lida pelo Trade Plan strip).
  const chartPremiumDiscount = usePremiumDiscountSnapshot();
  // Auditoria Final §3: melhor padrão harmônico real renderizado no
  // gráfico (mesma fatia da store lida pela aba ANALYSIS).
  const chartHarmonics = useHarmonicPatternsSnapshot();
  // Carta Branca: mesmas fatias reais (Triângulo/Ombro-Cabeça-Ombro) que o
  // painel ANALYSIS lê — 2º consumidor da MESMA computação em App.tsx,
  // zero segunda detecção de padrão.
  const chartTrianglePattern = useTrianglePatternSnapshot();
  const chartHeadShoulders = useHeadShouldersPatternSnapshot();

  // NÚCLEO GRAVITACIONAL AUTÔNOMO §1/§6/§7 — Fase 1 (respostas do
  // Operador: display-only, LEI 24 intacta; toggles manuais continuam
  // como override). Mesma leitura real do Volume Profile já usada pela
  // Matriz de Confluência Fibonacci em App() — 2º consumidor do MESMO
  // seletor Zustand, zero segunda computação.
  const volumeProfileSnapshot = useVolumeProfileSnapshot();
  const trendChannelForRelevance = useMemo(
    () => computeTrendChannel((chartData ?? []).map((c: any) => ({ time: c.time, close: c.close })), TREND_CHANNEL_DEFAULT_WINDOW),
    [chartData],
  );
  const relevanceInput: LayerRelevanceInput = useMemo(() => {
    const p = typeof livePrice.price === "number" && Number.isFinite(livePrice.price) ? livePrice.price : null;
    const withinPct = (target: number, pct: number) => p !== null && p > 0 && (Math.abs(target - p) * 100) / p <= pct;
    const liquidityZones: LiquidityZone[] = smcZones?.liquidityZones ?? [];
    const unsweptLiquidityNearPrice = liquidityZones.some((z) => !z.swept && withinPct(z.price, LIQUIDITY_PROXIMITY_PCT));
    // Achado real (relato do Operador após captura de tela — FVG/Order
    // Blocks somem do gráfico depois de um movimento forte): existência
    // real, qualquer distância do preço — proximidade fica só como sinal
    // de destaque em outras camadas (Liquidity/Volume Profile), nunca
    // como gate único para uma zona ESTRUTURAL que continua válida até
    // ser mitigada.
    const hasUnmitigatedStructuralZone =
      (smcZones?.fairValueGaps ?? []).some((z: PriceZone) => !z.mitigated) ||
      (smcZones?.orderBlocks ?? []).some((z: PriceZone) => !z.mitigated);
    const fibLevels = fibonacciMatrix?.levels ?? [];
    const fibonacciNearPrice = fibLevels.some((l) => withinPct(l.price, FIBONACCI_PROXIMITY_PCT));
    const hasFibonacciLevels = fibLevels.length > 0;
    const vp = volumeProfileSnapshot?.fixedRange;
    const volumeProfileNearPrice = !vp
      ? false
      : withinPct(vp.pocPrice, VOLUME_PROFILE_PROXIMITY_PCT) ||
        vp.hvnIndices.some((i) => withinPct(bucketMidPrice(i, vp.rangeMin, vp.rangeMax, vp.bucketCount), VOLUME_PROFILE_PROXIMITY_PCT));
    const brk = bosChoch?.break ?? null;
    const structureBreakAlpha =
      brk && Array.isArray(chartData) ? ageAlpha(chartData.length - 1 - brk.index, BREAK_DECAY) : null;
    const trendChannelBandwidthPct =
      trendChannelForRelevance && trendChannelForRelevance.mid.length > 0
        ? (2 * TREND_CHANNEL_STDDEV_MULTIPLIER * trendChannelForRelevance.stdDev * 100) /
          trendChannelForRelevance.mid[trendChannelForRelevance.mid.length - 1].value
        : null;
    // Sessões institucionais: mesma computeSessionBoundaries pura que
    // MarketSessionBandsPlugin já usa pra desenhar — só a transição MAIS
    // RECENTE importa aqui (idade em candles até o último candle vivo).
    const sessionBoundaries = Array.isArray(chartData) ? computeSessionBoundaries(chartData) : [];
    const lastSessionBoundary = sessionBoundaries.length > 0 ? sessionBoundaries[sessionBoundaries.length - 1] : null;
    const recentSessionBoundary =
      lastSessionBoundary !== null && Array.isArray(chartData) && chartData.length > 0
        ? chartData.length - 1 - lastSessionBoundary.index < MARKET_SESSION_RECENT_BOUNDARY_CANDLES
        : false;
    // Kill Zone ICT: mesma condição/mesma função (activeKillZones) que o
    // badge do header (TopBar, §6.48) já usa — computado no render, nunca
    // um segundo timer (este useMemo já reroda >=1x/s via livePrice nas
    // deps abaixo, mesmo princípio de marketSession na TopBar).
    const hasActiveKillZone = (activeKillZones(new Date())?.active.length ?? 0) > 0;
    // "Key Levels" (pedido do Operador): mesma janela real de exibição do
    // plugin (MAX_KEY_LEVELS_SHOWN) — nunca marca relevante por causa de um
    // nível antigo que nem está desenhado na tela. Mesmo limiar de
    // proximidade já usado por liquidez/EQH-EQL (papel estrutural idêntico:
    // extremo de sessão é uma referência de S/R real).
    const sessionKeyLevels = Array.isArray(chartData) ? computeSessionKeyLevels(chartData) : [];
    const recentSessionKeyLevels = sessionKeyLevels.slice(-MAX_KEY_LEVELS_SHOWN);
    const hasSessionKeyLevelNearPrice = recentSessionKeyLevels.some(
      (l) => withinPct(l.high, LIQUIDITY_PROXIMITY_PCT) || withinPct(l.low, LIQUIDITY_PROXIMITY_PCT),
    );
    // Entrega 41: existência real do perfil TPO da sessão corrente — só
    // pra relevância (mesmo espírito de sessionKeyLevels acima); o
    // TpoProfilePlugin computa o mesmo motor de novo, com cache por
    // referência, pra desenhar (mesmo padrão real já usado por
    // SessionKeyLevelsPlugin — função pura barata, zero fetch).
    const hasTpoProfile = Array.isArray(chartData) && computeTpoProfile(chartData).status === "OK";
    // Entrega 47: mesmo padrão de hasTpoProfile acima — função pura barata
    // (zero fetch), recomputada aqui só pra relevância; o ZigZagPlugin
    // computa o mesmo motor de novo com cache por referência pra desenhar
    // (mesmo princípio já usado por TpoProfilePlugin/SessionKeyLevelsPlugin).
    // Mesmo limiar mínimo (>=2 pivôs) que o próprio plugin usa pra decidir
    // se tem uma linha real pra traçar — nunca marca relevante sem ter
    // nada real pra mostrar.
    const hasZigZagPivots = Array.isArray(chartData) && computeZigZag(chartData).length >= 2;
    // Achado 2.5: existência real de pelo menos 1 alvo projetado em
    // qualquer um dos 2 caminhos do Motor de Cenários — mesma leitura
    // (chartScenario) que EnhancedChart_110_Percent já recebe pra
    // desenhar, zero segundo cálculo.
    const hasScenario = Boolean(
      chartScenario && (chartScenario.pathA.targets.length > 0 || chartScenario.pathB.targets.length > 0),
    );
    return {
      tradePlanActive: Boolean(chartTradePlan) || Boolean(engineFallbackLevels),
      obstacleZoneCount: chartObstacleZones.length,
      unsweptLiquidityNearPrice,
      hasUnmitigatedStructuralZone,
      structureBreakAlpha,
      volumeProfileNearPrice,
      harmonicBestFitScore: chartHarmonics && chartHarmonics.length > 0 ? chartHarmonics[0].fitScore : null,
      fibonacciNearPrice,
      hasFibonacciLevels,
      premiumDiscountZone: chartPremiumDiscount?.zone ?? null,
      vwapState: vwapCtx?.state ?? null,
      nexusLineState: nlState ?? null,
      trendChannelBandwidthPct,
      orderflowTrendActive: orderflowTrend?.status === "OK" && orderflowTrend.trend !== "ESTAVEL",
      hasOrderBook: Boolean(engine?.hasBook),
      hasTpoProfile,
      hasZigZagPivots,
      hasRecentLiquidation: Array.isArray(liquidations) && liquidations.length > 0,
      hasRecentLiquiditySweep: (traps ?? []).some((t) => t.kind === "STOP_HUNT_TOPO" || t.kind === "STOP_HUNT_FUNDO"),
      recentSessionBoundary,
      hasActiveKillZone,
      hasSessionKeyLevelNearPrice,
      // "HOMOLOGAÇÃO DA ORDEM Nº 03 / ORGANISMO INTELIGENTE ADAPTATIVO":
      // contexto operacional real — mesmo engine.marketRegime já usado
      // por Risk Engine/Confluência/Radar em vários pontos deste arquivo,
      // zero segundo cálculo.
      marketRegime: engine?.marketRegime?.regime ?? null,
      hasScenario,
    };
  }, [livePrice, smcZones, fibonacciMatrix, volumeProfileSnapshot, bosChoch, chartData, trendChannelForRelevance, chartTradePlan, engineFallbackLevels, chartObstacleZones, chartHarmonics, chartPremiumDiscount, vwapCtx, nlState, orderflowTrend, engine?.hasBook, liquidations, traps, engine?.marketRegime, chartScenario]);
  const layerRelevance = useMemo(() => computeLayerRelevance(relevanceInput), [relevanceInput]);
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setLayerRelevance(layerRelevance);
  }, [layerRelevance]);
  // Visibilidade EFETIVA: por camada, 'auto' consulta a leitura real acima;
  // manual usa exatamente o boolean que sempre existiu (chartLayerVisibility
  // — zero mudança de comportamento para quem nunca mexeu no automático).
  // EnhancedChart_110_Percent recebe só este resultado já resolvido — nunca
  // precisa saber o que é automático ou manual (Regra de Ouro 4: zero
  // segunda implementação do "visible ou não" dentro do componente do canvas).
  // Competição real entre as camadas que passaram no gate de relevância —
  // resolve QUAIS merecem a tela agora (motor puro, auto-layer-cap.test.ts).
  // Camadas fora do modo automático entram como "forçadas": decisão humana
  // explícita nunca é suprimida por heurística, e não gasta o orçamento.
  const autoDecision = useMemo(() => {
    const autoMode: ChartLayerVisibility = chartLayerAutoMode ?? DEFAULT_CHART_LAYER_AUTO_MODE;
    const manual: ChartLayerVisibility = chartLayerVisibility ?? DEFAULT_CHART_LAYER_VISIBILITY;
    const forced = CHART_LAYER_IDS.filter((id) => !autoMode[id] && manual[id]);
    return resolveAutoLayerVisibility(layerRelevance ?? {}, forced);
  }, [layerRelevance, chartLayerAutoMode, chartLayerVisibility]);

  const effectiveChartLayerVisibility: ChartLayerVisibility = useMemo(() => {
    const autoMode: ChartLayerVisibility = chartLayerAutoMode ?? DEFAULT_CHART_LAYER_AUTO_MODE;
    const manual: ChartLayerVisibility = chartLayerVisibility ?? DEFAULT_CHART_LAYER_VISIBILITY;
    return CHART_LAYER_IDS.reduce((acc, id) => {
      // Achado real (crash em runtime, Fase 8.1): computeLayerRelevance só
      // cobria 15 das 18 camadas reais — uma camada nova em modo automático
      // sem cobertura (liquidation_heatmap/liquidity_sweep/market_sessions,
      // fechado no declutter do gráfico) fazia layerRelevance[id] vir
      // undefined, e ".relevant" quebrava o render inteiro. As 21 camadas
      // já têm regra própria agora (layer-relevance.test.ts prova 1:1 com
      // CHART_LAYER_IDS, institutional_zones incluída desde o nascimento
      // da camada, mesma disciplina de kill_zones/session_key_levels
      // antes dela), mas o fallback (`relevance?.relevant
      // ?? true`) fica como defesa
      // contra uma camada FUTURA esquecida — nunca derruba o app mesmo se
      // layer-relevance.ts ficar defasado de novo.
      // TETO DE SIMULTANEIDADE (pedido do Operador: "gráfico mais limpo
      // possível, só com as ferramentas mais precisas"). Antes desta linha,
      // uma camada em modo automático desenhava sempre que tivesse leitura
      // real — e em mercado ativo a maioria das 25 tem leitura real ao mesmo
      // tempo. O gate de relevância nunca foi o problema; a AUSÊNCIA de
      // competição entre as que passavam no gate era.
      // `autoDecision` só existe para camada em modo automático; o toggle
      // manual continua decidindo sozinho, exatamente como antes.
      acc[id] = autoMode[id] ? (autoDecision[id]?.show ?? layerRelevance[id]?.relevant ?? true) : manual[id];
      return acc;
    }, {} as ChartLayerVisibility);
  }, [chartLayerAutoMode, chartLayerVisibility, layerRelevance, autoDecision]);

  return (
    <Widget
      id="chart"
      // Lapidação Visual (DIRETRIZ 2 — "não repetir informação"): o prefixo
      // "GRÁFICO · " rotulava o óbvio (o maior elemento da tela, cheio de
      // candles) e o par já aparece no seletor de ativo da barra superior.
      // Nenhuma plataforma de referência escreve "CHART" no cabeçalho do
      // gráfico — elas usam essa linha para a identidade do instrumento.
      // Mantido só o par, que identifica o painel quando ele está
      // minimizado/listado no Workspace Manager.
      title={`${selectedAsset ?? ""}/USDT`}
      flex="flex-[1.8] min-h-[320px]"
      extraHeader={
        <div className="flex items-center gap-1 text-[0.45rem]">
          {/* Ordem "Lapidação Visual Final" §7 (OHLC): leitura compacta do
              candle REAL mais recente do MESMO array que o gráfico desenha
              (chartData, prop direta) — zero cálculo novo, zero segunda
              fonte: são os 4 campos crus do candle, não uma derivação.
              Sincronizado por construção com símbolo/timeframe (§10): quando
              chartTimeframe muda, chartData é refetchado e este bloco lê o
              novo array, nunca um snapshot próprio. Fail-closed (§7): sem
              candle real, não renderiza nada — nunca um O/H/L/C fabricado.
              Discreto de propósito (§7 "sem competir com preço"): mesmo
              0.45rem do seletor de timeframe irmão, rótulos a 40% de opacidade,
              escondido abaixo de lg para não espremer o seletor no iPad Mini. */}
          <OhlcReadout candles={chartData} hoverCandle={hoveredCandle} />
          {/* Auditoria de estabilização (P1): antes disto, esta linha era
              só <span> sem onClick — nunca respondia a toque nenhum, e
              "15M" ficava marcado ativo por um literal fixo
              (tf === "15M") independente do que o gráfico realmente
              mostrava. Agora é o chartTimeframe real (App(), contexto),
              a mesma variável que fetchSymbolData/o efeito de troca de
              timeframe usam — nunca dessincroniza da UI. overflow-x-auto
              porque 14 opções reais não cabem numa linha só em telas
              estreitas; é rolagem esperada de um seletor real (mesmo
              padrão de qualquer terminal profissional), não uma barra de
              rolagem indesejada de layout quebrado. */}
          {/* "aquela barrinha está muito pequena, a gente não dá nem pra ver"
              (Operador, item citado nominalmente). Medido: este seletor —
              um CONTROLE INTERATIVO de 14 opções — herdava o text-[0.45rem]
              do container acima, ou seja 7.2px. Não é compacto, é ilegível,
              e num iPad é também um alvo de toque abaixo do mínimo usável.
              Agora usa .ar10-t-body (12px→13.5px, piso 12px em QUALQUER
              tela; ver a escala em index.css) e o padding acompanha, para o
              alvo de toque crescer junto com o texto — texto maior em botão
              apertado seria meia correção. A largura máxima sobe na mesma
              proporção do corpo (160→220 / 260→340) para o número de opções
              visíveis não CAIR por causa da fonte maior; acima de 14 opções
              a rolagem horizontal continua, como em qualquer terminal real. */}
          <div className="ar10-t-body flex items-center gap-0.5 max-w-[220px] sm:max-w-[340px] overflow-x-auto scrollbar-hide shrink-0">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={(e) => {
                  stopBubble(e);
                  setChartTimeframe?.(tf.value);
                }}
                onDoubleClick={stopBubble}
                title={
                  timeframeProfile(tf.value)
                    ? `Timeframe ${tf.label} · ${timeframeProfile(tf.value)!.style} · ETA típico: ${timeframeProfile(tf.value)!.etaHorizon}`
                    : `Timeframe ${tf.label}`
                }
                className={`shrink-0 px-1.5 py-1 rounded transition-colors ${chartTimeframe === tf.value ? "bg-[#00f0ff20] text-[#00f0ff] font-bold border border-[#00f0ff40]" : "text-[#8ab4f8]/60 hover:text-[#8ab4f8]"}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {/* Zero repetição (protocolo §2): o antigo overlay com símbolo/preço
          gigante/variação/HIGH/VOL duplicava — em dobro ou triplo — dados que
          agora têm ocorrência única na barra de comando unificada. Removido
          por inteiro; o espaço vertical recuperado (~50px) vai para as velas
          (prioridade do gráfico, V11 §7). O título do Widget carrega o
          símbolo, necessário quando o gráfico está maximizado cobrindo a
          barra; a tag de último preço no eixo é parte intrínseca do gráfico
          (lightweight-charts desenha o próprio last-price label). */}
      <div className="flex-1 mt-1 relative min-h-0">
        {chartData && chartData.length > 0 ? (
          <EnhancedChart_110_Percent
            data={chartData}
            onHoverCandleChange={setHoveredCandle}
            support={engine?.support ?? null}
            resistance={engine?.resistance ?? null}
            supportStrength={engine?.supportStrength ?? null}
            resistanceStrength={engine?.resistanceStrength ?? null}
            supportBreakouts={engine?.supportBreakouts ?? 0}
            resistanceBreakouts={engine?.resistanceBreakouts ?? 0}
            fairValueGaps={unmitigatedFvgs}
            orderBlocks={unmitigatedBlocks}
            liquidityVoids={unmitigatedVoids}
            obstacleZones={chartObstacleZones}
            liquidityZones={unsweptLiquidity}
            structureBreak={bosChoch?.break ?? null}
            lastSwingHigh={engine?.lastSwingHigh ?? null}
            lastSwingLow={engine?.lastSwingLow ?? null}
            fibonacciLevels={fibonacciLevels}
            livePrice={livePrice.price}
            activeTimeframe={chartTimeframe as Timeframe}
            tradePlan={chartTradePlan}
            tradePlanAbsenceReason={chartTradePlanAbsenceReason}
            engineFallbackLevels={engineFallbackLevels}
            aura={auraReading}
            targetsHit={auraTrackRecord.active?.targetsHit ?? 0}
            confidenceZone={confidenceZone ?? null}
            scenario={chartScenario ?? null}
            premiumDiscount={chartPremiumDiscount ?? null}
            harmonicHits={chartHarmonics}
            trianglePattern={chartTrianglePattern}
            headShouldersPattern={chartHeadShoulders}
            decision={nexusDecision ?? null}
            vwapState={vwapCtx?.state ?? null}
            nexusLineState={nlState ?? null}
            liquidations={liquidations ?? []}
            traps={traps ?? []}
            symbol={selectedAsset ?? null}
            layerVisibility={effectiveChartLayerVisibility}
            emaPeriod={emaPeriod}
            onRequestOlderCandles={onRequestOlderCandles}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
            {AWAIT} CANDLES…
          </div>
        )}
      </div>
    </Widget>
  );
}

// --- ORDER FLOW WIDGET ---
function OrderFlowWidget() {
  const { engine, orderflowState, orderflowReason, orderflowSignals, cvd } =
    useContext(WidgetContext) || {};
  const buyPercent: number | null = engine?.buyPercent ?? null;
  const sellPercent: number | null = engine?.sellPercent ?? null;
  const delta: number | null = engine?.delta ?? null;
  const imbalance: number | null = engine?.imbalance ?? null;
  const cvdValue: number | null = num(cvd) ? cvd : null;

  const signals: OrderflowSignal[] = orderflowSignals ?? [];
  const ofState: string = orderflowState ?? "pending";
  const ofColor =
    ofState === "LIVE" ? "text-[#00ffaa]" : ofState === "ERROR" ? "text-[#ff0055]" : "text-[#f0d06f]";
  const signalColor = (t: string) =>
    t === "EXHAUSTION" ? "text-[#ff0055]" : t === "ABSORPTION" ? "text-[#f0d06f]" : "text-[#00ffaa]";

  return (
    <Widget id="orderflow" title="ORDER FLOW · REAL BOOK" flex="flex-[0.85] min-h-[110px]">
      <div className="flex flex-col h-full justify-between gap-1 py-1">
        <div className="flex justify-between items-center px-1">
          <FlowMetric
            label="DELTA 24H"
            value={num(delta) ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}` : DASH}
            color={num(delta) && delta >= 0 ? "text-[#00ffaa]" : "text-[#ff0055]"}
          />
          <FlowMetric
            label="BID"
            value={num(buyPercent) ? `${buyPercent.toFixed(1)}%` : DASH}
            color="text-[#00ffaa]"
          />
          <FlowMetric
            label="ASK"
            value={num(sellPercent) ? `${sellPercent.toFixed(1)}%` : DASH}
            color="text-[#ff0055]"
          />
          <FlowMetric
            label="DESEQ."
            value={num(imbalance) ? `${imbalance >= 0 ? "+" : ""}${(imbalance * 100).toFixed(1)}%` : DASH}
            color={num(imbalance) && imbalance >= 0 ? "text-[#00ffaa]" : "text-[#ff0055]"}
          />
          <FlowMetric
            label="SESSION CVD"
            value={cvdValue !== null ? `${cvdValue >= 0 ? "+" : ""}${cvdValue.toFixed(2)}` : DASH}
            color={cvdValue !== null && cvdValue >= 0 ? "text-[#00ffaa]" : "text-[#ff0055]"}
          />
        </div>

        <div className="w-full h-4 mt-1 flex relative bg-[#010308] border border-[#00f0ff15] rounded overflow-hidden shadow-[inset_0_0_10px_rgba(0,240,255,0.05)]">
          <div
            className="h-full bg-gradient-to-r from-[#00ffaa10] to-[#00ffaa60] border-r border-[#00ffaa] relative overflow-hidden transition-[background-color,opacity] duration-500"
            style={{ width: `${num(buyPercent) ? buyPercent : 50}%` }}
          ></div>
          <div
            className="h-full bg-gradient-to-l from-[#ff005510] to-[#ff005560] border-l border-[#ff0055] relative overflow-hidden transition-[background-color,opacity] duration-500"
            style={{ width: `${num(sellPercent) ? sellPercent : 50}%` }}
          ></div>
        </div>

        {/* Real Order Flow Engine (OFI/Absorption/Exhaustion) fed by real
            MEXC trades — engine-bridge.ts's startMexcOrderflowFeed(). */}
        <div className="flex items-center gap-1.5 px-1 mt-1">
          <div
            className={`w-1.5 h-1.5 rounded-full ${ofState === "LIVE" ? "bg-[#00ffaa] animate-pulse" : ofState === "ERROR" ? "bg-[#ff0055]" : "bg-[#f0d06f] animate-pulse"}`}
          ></div>
          <span className={`text-[0.45rem] tracking-[0.15em] font-bold uppercase ${ofColor}`}>
            MEXC ORDERFLOW ·{" "}
            {ofState === "LIVE" ? "LIVE" : ofState === "ERROR" ? `FALHOU (${orderflowReason || DASH})` : "AGUARDANDO"}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-1">
          {signals.length === 0 ? (
            <div className="text-[0.45rem] text-[#8ab4f8]/40 tracking-widest py-1">
              {AWAIT} SINAL REAL…
            </div>
          ) : (
            signals.slice(0, 4).map((s, i) => (
              <div key={i} className="flex justify-between items-center text-[0.42rem] py-[1px]">
                <span className={`font-bold tracking-wider ${signalColor(s.type)}`}>{s.type}</span>
                <span className="text-[#a0f0ff]/80 font-mono">{fmt(s.price)}</span>
                <span className="text-[#8ab4f8]/60 font-mono">
                  {num(s.confidence) ? `${(s.confidence * 100).toFixed(0)}%` : DASH}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Widget>
  );
}
interface FlowMetricProps {
  label: string;
  value: string | number;
  color: string;
}
const FlowMetric = React.memo(function FlowMetric({ label, value, color }: FlowMetricProps) {
  return (
    <div className="flex flex-col items-center xl:items-start">
      <span className="text-[0.45rem] text-[#8ab4f8] uppercase tracking-[0.1em] mb-[2px]">
        {label}
      </span>
      <span className={`text-[0.6rem] font-bold ${color}`}>{value}</span>
    </div>
  );
});

// --- HEATMAP WIDGET (deterministic mapping of REAL depth — no Math.random) ---
function HeatmapWidget({ book, data }: any) {
  const [filter, setFilter] = useState("ALL");
  const mid = num(data?.price) ? data.price : null;

  const bids: Level[] = book?.bids ?? [];
  const asks: Level[] = book?.asks ?? [];
  const maxSize = Math.max(1, ...bids.map((b) => b.size), ...asks.map((a) => a.size));
  const hasDepth = bids.length > 0 || asks.length > 0;

  return (
    <Widget
      id="heatmap"
      title="LIQUIDITY MAP · REAL DEPTH"
      flex="flex-1 min-h-[160px]"
      extraHeader={
        <div className="flex gap-1 text-[0.45rem]">
          {["ALL", "BIDS", "ASKS"].map((f) => (
            <span
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1.5 py-[1px] rounded cursor-pointer transition-all ${filter === f ? "bg-[#00f0ff20] text-[#00f0ff] border border-[#00f0ff40] shadow-[0_0_5px_rgba(0,240,255,0.3)]" : "text-slate-500 hover:text-[#00f0ff] hover:bg-[#00f0ff0a]"}`}
            >
              {f}
            </span>
          ))}
        </div>
      }
    >
      <div className="w-full h-full relative pr-10 pb-3 min-h-0">
        <div className="absolute inset-0 right-10 bottom-3 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:8px_8px] border border-[#00f0ff1a] overflow-hidden rounded-[2px] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
          {!hasDepth && (
            <div className="absolute inset-0 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
              {AWAIT} PROFUNDIDADE…
            </div>
          )}

          {/* Asks: deterministic bars in the upper half, width ∝ real size. */}
          {filter !== "BIDS" &&
            asks.map((a, idx) => {
              const rel = a.size / maxSize;
              return (
                <div
                  key={`a${idx}`}
                  className="absolute right-0 mix-blend-screen transition-[background-color,opacity] duration-500"
                  style={{
                    top: `${Math.max(2, 46 - idx * 5.5)}%`,
                    height: "4%",
                    width: `${Math.max(4, rel * 90)}%`,
                    backgroundColor: rel > 0.66 ? "#ff0055" : "#00f0ff",
                    opacity: 0.25 + rel * 0.6,
                    boxShadow: rel > 0.7 ? `0 0 ${rel * 10}px #ff0055` : "none",
                  }}
                ></div>
              );
            })}

          {/* Current price line */}
          <div className="absolute top-[48%] left-0 right-0 h-[1px] bg-white shadow-[0_0_8px_#fff] opacity-80 z-20"></div>

          {/* Bids: deterministic bars in the lower half. */}
          {filter !== "ASKS" &&
            bids.map((b, idx) => {
              const rel = b.size / maxSize;
              return (
                <div
                  key={`b${idx}`}
                  className="absolute right-0 mix-blend-screen transition-[background-color,opacity] duration-500"
                  style={{
                    top: `${Math.min(94, 52 + idx * 5.5)}%`,
                    height: "4%",
                    width: `${Math.max(4, rel * 90)}%`,
                    backgroundColor: rel > 0.66 ? "#00ffaa" : "#00f0ff",
                    opacity: 0.25 + rel * 0.6,
                    boxShadow: rel > 0.7 ? `0 0 ${rel * 10}px #00ffaa` : "none",
                  }}
                ></div>
              );
            })}
        </div>

        {/* Real price scale from real top-of-book. */}
        <div className="absolute right-0 top-0 bottom-3 flex flex-col justify-between text-[0.45rem] text-[#8ab4f8]/60 items-end z-10 font-bold font-mono">
          <span className="text-[#ff0055]">{asks.length ? fmtInt(asks[0].price) : DASH}</span>
          <span className="text-[#ff0055]/70">
            {asks.length ? fmtInt(asks[Math.floor(asks.length / 2)].price) : DASH}
          </span>
          <span className="text-white drop-shadow-[0_0_4px_#fff]">{num(mid) ? fmtInt(mid) : DASH}</span>
          <span className="text-[#00ffaa]/70">
            {bids.length ? fmtInt(bids[Math.floor(bids.length / 2)].price) : DASH}
          </span>
          <span className="text-[#00ffaa]">{bids.length ? fmtInt(bids[bids.length - 1].price) : DASH}</span>
        </div>
      </div>
    </Widget>
  );
}

// --- MIDDLE COLUMN: DIRECTION ---
function MarketDirectionWidget() {
  const { widgets, engine, nexusDecision } = useContext(WidgetContext) || {};
  if (widgets && !widgets.market_direction.visible) return null;

  const buyPercent: number | null = engine?.buyPercent ?? null;
  const sellPercent: number | null = engine?.sellPercent ?? null;
  const direction: Direction = engine?.direction ?? null;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  // Continuidade (sincronização BIAS≠ENTRY, 3º/4º lugar): mesmo
  // deriveOutcomeLabel/OUTCOME_QUALIFIER já real e testado — reusado, nunca
  // uma segunda lógica. Só renderiza quando existe (fail-closed): o widget
  // nunca cresce sem um motivo real (SEM OPERAÇÃO deliberadamente sem
  // entrada na tabela).
  const vectorOutcome = nexusDecision ? deriveOutcomeLabel(nexusDecision) : null;
  const vectorOutcomeQualifier = vectorOutcome ? (OUTCOME_QUALIFIER[vectorOutcome] ?? null) : null;

  const vectorLabel = isLong ? "Long Dominance" : isShort ? "Short Dominance" : AWAIT;
  const vectorColor = isLong
    ? "text-[#00ffaa] drop-shadow-[0_0_10px_rgba(0,255,170,0.8)]"
    : isShort
      ? "text-[#ff0055] drop-shadow-[0_0_10px_rgba(255,0,85,0.8)]"
      : "text-[#8ab4f8]/60";
  const glowColor = isLong
    ? "bg-[#00ffaa] shadow-[0_0_8px_#00ffaa]"
    : isShort
      ? "bg-[#ff0055] shadow-[0_0_8px_#ff0055]"
      : "bg-[#8ab4f8]/50";

  // Fusão visual — achado real do Operador (captura de tela de
  // dispositivo real, gaveta Market Intelligence aberta): este card foi
  // desenhado originalmente para dividir uma coluna larga de 3 colunas
  // (max-w-[600px], números text-3xl, ícones de 24px) — dentro da gaveta
  // estreita (~320px) isso ficava desproporcional/pouco profissional.
  // Compactado para uma faixa única e densa (mesmos 3 dados reais, só
  // menores) — cabe inteira sem quebrar linha mesmo na largura mínima da
  // gaveta.
  return (
    <div className="cyber-panel shrink-0 flex items-center justify-between gap-1.5 px-2.5 py-2">
      <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
        <span className="text-[0.4rem] text-[#00ffaa]/80 tracking-[0.15em] font-bold uppercase">
          Pressão Bid
        </span>
        <div className="flex items-center gap-1 text-sm font-black text-[#00ffaa]">
          <ArrowUpRight size={12} strokeWidth={3} />
          {num(buyPercent) ? Math.round(buyPercent) : DASH}
          <span className="text-[0.6rem]">%</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-0.5 px-1 shrink-0">
        <span className="text-[0.35rem] text-[#8ab4f8]/70 tracking-[0.15em] uppercase font-bold whitespace-nowrap">
          Vetor
        </span>
        <span className={`text-[0.6rem] font-black tracking-wide uppercase whitespace-nowrap ${vectorColor}`}>
          {vectorLabel}
        </span>
        <div className="flex items-center gap-1">
          <div className={`w-1 h-1 rounded-full animate-pulse ${glowColor}`}></div>
          <span className="text-[0.32rem] uppercase tracking-widest font-bold text-[#8ab4f8]/60">
            Livro Real
          </span>
        </div>
        {vectorOutcomeQualifier && (
          <span className="text-[0.3rem] uppercase tracking-widest font-bold text-[#8ab4f8]/50 whitespace-nowrap">
            {vectorOutcomeQualifier}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
        <span className="text-[0.4rem] text-[#ff0055]/80 tracking-[0.15em] font-bold uppercase">
          Pressão Ask
        </span>
        <div className="flex items-center gap-1 text-sm font-bold text-[#ff0055]">
          {num(sellPercent) ? Math.round(sellPercent) : DASH}
          <span className="text-[0.6rem]">%</span>
          <ArrowDownRight size={12} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}

// --- LEFT COLUMN: MARKET BIAS / DECISION (V16 §4, Long/Short Decision
// Module evolution) — a compact institutional view (bias/convicção/
// entrada/invalidação/alvos/R:R/tamanho sugerido/status da decisão)
// instead of a bare LONG/SHORT button. Every number here is a real
// passthrough from `engine`/`riskSuggestion` (already computed elsewhere
// in this file, see contextValue) — nothing is recomputed or invented.
function MiniStat({ label, value, color, title }: { label: string; value: string; color: string; title?: string }) {
  return (
    <div className="flex flex-col bg-[#010308] px-2 py-1.5 rounded border border-[#8ab4f8]/10 min-w-0" title={title}>
      <span className="text-[0.4rem] text-[#8ab4f8]/60 font-bold tracking-widest uppercase truncate">{label}</span>
      <span className={`text-[0.55rem] font-mono font-black truncate ${color}`}>{value}</span>
    </div>
  );
}

function MarketBiasDecisionCard() {
  const { engine, riskSuggestion, ensembleConsensus, nexusDecision } = useContext(WidgetContext) || {};
  const direction: Direction = engine?.direction ?? null;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const dirLabelColor = isLong ? "text-[#00ffaa]" : isShort ? "text-[#ff0055]" : "text-[#8ab4f8]/60";
  // Continuidade (auditoria de sincronização, mesmo achado do badge herói):
  // "Sinal Institucional" mostrava só o `direction` cru do Núcleo — o
  // mesmo "LONG + entrada forçada" que a Diretriz BIAS≠ENTRY pediu para
  // nunca comunicar sozinho. Mesmo qualificador real já testado
  // (OUTCOME_QUALIFIER, deriveOutcomeLabel), zero matemática nova — só
  // relocado para este segundo lugar que também é uma verdade de "DIREÇÃO"
  // dedicada (não um detalhe entre outros, como nos cards de contexto).
  const biasOutcome = nexusDecision ? deriveOutcomeLabel(nexusDecision) : null;
  const biasOutcomeQualifier = biasOutcome ? (OUTCOME_QUALIFIER[biasOutcome] ?? null) : null;
  const entry: number | null = engine?.entry ?? null;
  const target: number | null = engine?.target ?? null;
  const target2: number | null = engine?.target2 ?? null;
  const stop: number | null = engine?.stop ?? null;
  const riskRewardRatio: number | null = engine?.riskRewardRatio ?? null;
  const target1Strength: { label: "FORTE" | "FRACA"; touches: number } | null = engine?.target1Strength ?? null;
  const target2Strength: { label: "FORTE" | "FRACA"; touches: number } | null = engine?.target2Strength ?? null;
  // engine.confidence is the Core Engine's own real categorical read
  // (ALTA/MÉDIA/BAIXA, see engine-bridge.ts's RealCycleResult.confidence:
  // string|null) — never a fabricated percentage. AGUARDANDO honestly
  // before the first cycle succeeds.
  const confidenceLabel = engine?.confidence ?? AWAIT;

  const riskOk = riskSuggestion?.status === "OK";
  const riskLabel = riskOk
    ? `${riskSuggestion.suggested_position_pct.toFixed(1)}% eq · risk ${riskSuggestion.effective_risk_pct.toFixed(2)}%`
    : "0% · sem sugestão";

  // V16 §4: Decision Status (WAIT/CONFIRM/EXECUTE) — an honest confluence
  // read across two ALREADY-real, independent signals (never a new score
  // invented for this card): the Core Engine's own direction+Risk Engine
  // sizing, and the secondary Ensemble Committee's direction (GMIL +
  // local logics, src/consensus/). EXECUTE only when both agree AND the
  // Risk Engine actually produced a non-zero suggestion; CONFIRM when the
  // Core Engine has a signal but the committee hasn't confirmed it yet;
  // WAIT otherwise. Purely an analytical label — same LEI 24 rule as
  // DecisionValidationWidget: display only, never gates or auto-fires
  // anything (this terminal has no order-send path at all, READ_ONLY).
  const ensembleOk = ensembleConsensus?.status === "OK";
  const ensembleAgrees =
    ensembleOk &&
    ((isLong && ensembleConsensus.direcao === "ALTA") || (isShort && ensembleConsensus.direcao === "BAIXA"));
  const decisionStatus: "WAIT" | "CONFIRM" | "EXECUTE" =
    !direction || !riskOk || riskSuggestion.suggested_position_pct <= 0
      ? "WAIT"
      : ensembleAgrees
        ? "EXECUTE"
        : "CONFIRM";
  const decisionClass =
    decisionStatus === "WAIT"
      ? "text-[#f0d06f] border-[#f0d06f]/40 bg-[#f0d06f]/10"
      : decisionStatus === "CONFIRM"
        ? "text-[#00f0ff] border-[#00f0ff]/40 bg-[#00f0ff]/10"
        : isShort
          ? "text-[#ff0055] border-[#ff0055]/40 bg-[#ff0055]/10"
          : "text-[#00ffaa] border-[#00ffaa]/40 bg-[#00ffaa]/10";

  // Fusão visual (imagem de referência): a imagem mostra "DIREÇÃO" e
  // "POSITION MANAGEMENT" como 2 cards empilhados, não 1 — dividido aqui
  // por puro reagrupamento visual, os MESMOS campos reais de antes,
  // nenhum dado novo. Omite deliberadamente o slider de alavancagem e o
  // slider de quantidade em BTC + o botão verde de execução assistida da
  // imagem: este terminal é READ_ONLY por decisão permanente (sem chave
  // de API, sem caminho de envio de ordem em lugar nenhum do código) e já tinha,
  // antes desta sessão, substituído um antigo widget de "posição ao
  // vivo" fabricada por um aviso honesto — reintroduzir uma UI de
  // quantidade/alavancagem repetiria exatamente o padrão já rejeitado.
  return (
    <>
      <div className="cyber-panel shrink-0 flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="font-bold tracking-[0.2em] text-[0.55rem] uppercase text-[#00f0ff]">DIRECTION</span>
          <span
            className={`text-[0.45rem] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded border ${decisionClass}`}
            title="Rótulo analítico — nunca aciona ordens (READ_ONLY)"
          >
            {decisionStatus}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div className={`text-center py-1.5 rounded border text-[0.5rem] font-black tracking-widest ${isLong ? "border-[#00ffaa60] bg-[#00ffaa15] text-[#00ffaa]" : "border-[#8ab4f8]/15 text-[#8ab4f8]/30"}`}>
            LONG
          </div>
          <div className={`text-center py-1.5 rounded border text-[0.5rem] font-black tracking-widest ${!direction ? "border-[#8ab4f8]/40 bg-[#8ab4f8]/10 text-[#8ab4f8]" : "border-[#8ab4f8]/15 text-[#8ab4f8]/30"}`}>
            NEUTRO
          </div>
          <div className={`text-center py-1.5 rounded border text-[0.5rem] font-black tracking-widest ${isShort ? "border-[#ff005560] bg-[#ff005515] text-[#ff0055]" : "border-[#8ab4f8]/15 text-[#8ab4f8]/30"}`}>
            SHORT
          </div>
        </div>

        <span className="text-[0.45rem] text-[#8ab4f8]/60 tracking-[0.15em] font-bold uppercase">
          Sinal Institucional
        </span>
        <span className={`text-[0.75rem] font-black tracking-wide -mt-1 ${dirLabelColor}`}>
          {direction ?? AWAIT}
          {biasOutcomeQualifier && (
            <span className="ml-1.5 text-[0.4rem] font-bold tracking-[0.1em] text-[#8ab4f8]/60 uppercase align-middle">
              {biasOutcomeQualifier}
            </span>
          )}
        </span>

        <MiniStat label="Confiança (Core Engine)" value={confidenceLabel} color="text-[#8ab4f8]" />
      </div>

      <div className="cyber-panel shrink-0 flex flex-col gap-2 p-3">
        <span className="font-bold tracking-[0.2em] text-[0.55rem] uppercase text-[#00f0ff]">
          POSITION MANAGEMENT
        </span>

        {direction ? (
          <div className="grid grid-cols-2 gap-1.5">
            {/* Achado real de auditoria (DIRETRIZES AVANÇADAS, censo
                visual): Entrada usava ciano aqui, mas âmbar/dourado
                (#f0d06f = rgba(240,208,111,…)) em TODO o resto do app —
                linha de preço de entrada e caixa de zona no gráfico
                (EnhancedChart_110_Percent.tsx/TradePlanZonePlugin.tsx),
                mesmo tom já usado por VWAP neutro/Heat Score aqui na
                própria HUD. Stop/Alvo já batiam com o gráfico (vermelho/
                verde) — só Entrada destoava. */}
            <LevelCard label="Entrada" value={entry} accent="#f0d06f" tag="REF" />
            <LevelCard label="Invalidação" value={stop} accent="#ff0055" tag="REAL" />
            <LevelCard
              label="Alvo 1"
              value={target}
              accent="#00ffaa"
              tag={target1Strength?.label ?? "REAL"}
            />
            <LevelCard
              label="Alvo 2"
              value={target2}
              accent="#00ffaa"
              tag={target2Strength?.label ?? "REAL"}
              dim={!num(target2)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#8ab4f8]/20 bg-[#8ab4f8]/5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f0d06f] animate-pulse shrink-0"></div>
            <span className="text-[0.45rem] tracking-[0.1em] text-[#8ab4f8] font-bold uppercase leading-relaxed">
              Motor real aguardando confirmação direcional — zonas de entrada/alvos/stop aparecem aqui assim que houver sinal.
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {num(riskRewardRatio) && (
            <span className="text-[#f0d06f] border border-[#f0d06f]/40 bg-[#f0d06f]/10 text-[0.5rem] font-bold px-2 py-0.5 rounded">
              R:R {riskRewardRatio.toFixed(2)}
            </span>
          )}
          <span className={`text-[0.5rem] font-bold px-2 py-0.5 rounded border ${riskOk ? "text-[#00f0ff] border-[#00f0ff]/40 bg-[#00f0ff]/10" : "text-[#8ab4f8]/50 border-[#8ab4f8]/20"}`}>
            TAMANHO SUGERIDO · {riskLabel}
          </span>
        </div>

        <span className="text-[0.4rem] text-[#f0d06f]/80 font-bold tracking-widest">
          ALGORITHMIC SUGGESTION · NOT FINANCIAL ADVICE · NO LIVE EXECUTION (READ_ONLY)
        </span>
      </div>
    </>
  );
}

// --- RIGHT COLUMN: ORDER BOOK ---
function OrderBookWidget({ data, book }: any) {
  const mid = num(data?.price) ? data.price : null;
  const asks: Level[] = book?.asks ?? [];
  const bids: Level[] = book?.bids ?? [];
  const hasBook = asks.length > 0 || bids.length > 0;
  // Entrega 40: derivações puras sobre o MESMO book acima — nunca uma
  // segunda leitura (ver cabeçalho de nexus/order-book-depth.ts).
  const bidAskRatio = computeBidAskRatio(bids, asks);
  const imbalance = computeImbalance(bids, asks);

  let accumAsk = 0;
  let accumBid = 0;

  return (
    <Widget id="orderbook" title="ORDER BOOK" flex="flex-1">
      <div className="flex flex-col h-full text-[0.5rem] justify-between pb-1 min-h-0">
        <div className="flex justify-between text-[#8ab4f8] mb-1 px-1 pb-1 tracking-widest uppercase border-b border-[#00f0ff1a] shrink-0 font-bold">
          <span className="w-1/3">PREÇO (USDT)</span>
          <span className="w-1/3 text-right">SIZE</span>
          <span className="w-1/3 text-right">TOTAL</span>
        </div>

        {!hasBook ? (
          <div className="flex-1 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
            {AWAIT} LIVRO…
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-[1px] relative flex-1 min-h-0 overflow-hidden justify-end">
              {asks.slice(0, 7).map((a, i) => {
                accumAsk += a.size;
                return (
                  <div key={`a${i}`} className="flex justify-between px-1 py-[1px] relative z-10 group cursor-pointer">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#ff00551a] z-[-1]"
                      style={{ width: `${Math.min((accumAsk / 8) * 100, 100)}%` }}
                    ></div>
                    <span className="text-[#ff0055] w-1/3 font-bold group-hover:text-white transition-colors">
                      {a.price.toFixed(2)}
                    </span>
                    <span className="text-[#a0f0ff]/80 w-1/3 text-right">{a.size.toFixed(3)}</span>
                    <span className="text-[#a0f0ff]/50 w-1/3 text-right">{accumAsk.toFixed(3)}</span>
                  </div>
                );
              })}
            </div>

            <div className="text-center text-base font-black text-[#00ffaa] py-1 drop-shadow-[0_0_8px_rgba(0,255,170,0.6)] my-[2px] bg-[#00ffaa08] border-y border-[#00ffaa20] shrink-0">
              {fmt(mid)}
            </div>

            <div className="flex flex-col gap-[1px] relative flex-1 min-h-0 overflow-hidden justify-start">
              {bids.slice(0, 7).map((b, i) => {
                accumBid += b.size;
                return (
                  <div key={`b${i}`} className="flex justify-between px-1 py-[1px] relative z-10 group cursor-pointer">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#00ffaa1a] z-[-1]"
                      style={{ width: `${Math.min((accumBid / 8) * 100, 100)}%` }}
                    ></div>
                    <span className="text-[#00ffaa] w-1/3 font-bold group-hover:text-white transition-colors">
                      {b.price.toFixed(2)}
                    </span>
                    <span className="text-[#a0f0ff]/80 w-1/3 text-right">{b.size.toFixed(3)}</span>
                    <span className="text-[#a0f0ff]/50 w-1/3 text-right">{accumBid.toFixed(3)}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center px-1 pt-1 mt-[2px] border-t border-[#00f0ff1a] shrink-0 gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[0.42rem] text-[#8ab4f8]/60 font-bold tracking-wide uppercase">RATIO B/A</span>
                <span
                  className={`text-[0.5rem] font-mono font-black ${bidAskRatio === null ? "text-[#8ab4f8]/40" : bidAskRatio >= 1 ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
                >
                  {fmt(bidAskRatio, 2)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[0.42rem] text-[#8ab4f8]/60 font-bold tracking-wide uppercase">IMBALANCE</span>
                <span
                  className={`text-[0.5rem] font-mono font-black ${imbalance === null ? "text-[#8ab4f8]/40" : imbalance >= 0 ? "text-[#00ffaa]" : "text-[#ff0055]"}`}
                >
                  {fmtSignedPct(imbalance === null ? null : imbalance * 100, 0)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </Widget>
  );
}

// --- RIGHT COLUMN: SCANNER ---
function ScannerWidget({ data }: { data: any[] }) {
  const pairs = data && data.length > 0 ? data.slice(0, 5) : [];
  return (
    <Widget id="scanner" title="QUANT SCANNER · REAL 24H" flex="flex-1">
      <div className="flex flex-col h-full text-[0.5rem]">
        <div className="flex justify-between text-[#8ab4f8] mb-1.5 px-1 pb-1 tracking-widest uppercase border-b border-[#00f0ff1a] font-bold shrink-0">
          <span className="w-[30%]">PAR</span>
          <span className="w-[25%]">VETOR</span>
          <span className="w-[25%] text-center">FORÇA</span>
          <span className="w-[20%] text-right">24H</span>
        </div>
        {pairs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
            {AWAIT}…
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-1 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            {pairs.map((p) => (
              <div key={p.p} className="flex justify-between items-center px-1">
                <span className="text-[#a0f0ff] w-[30%] font-bold">{p.p}</span>
                <span
                  className={`w-[25%] font-bold tracking-wider ${p.s === "LONG" ? "text-[#00ffaa] drop-shadow-[0_0_3px_rgba(0,255,170,0.8)]" : p.s === "SHORT" ? "text-[#ff0055] drop-shadow-[0_0_3px_rgba(255,0,85,0.8)]" : "text-[#8ab4f8]/50"}`}
                >
                  {p.s}
                </span>
                <div className="w-[25%] flex items-center justify-center px-1">
                  <div className="w-full h-1 bg-[#010308] rounded-full overflow-hidden border border-[#00f0ff20]">
                    <div
                      className={`h-full ${p.s === "LONG" ? "bg-[#00ffaa] shadow-[0_0_4px_#00ffaa]" : p.s === "SHORT" ? "bg-[#ff0055] shadow-[0_0_4px_#ff0055]" : "bg-[#8ab4f8]/50"}`}
                      style={{ width: `${p.str}%` }}
                    ></div>
                  </div>
                </div>
                <span
                  className={`w-[20%] text-right font-bold ${num(p.chg) && p.chg >= 0 ? "text-[#00ffaa]/80" : "text-[#ff0055]/80"}`}
                >
                  {fmtSignedPct(p.chg, 1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Widget>
  );
}

// --- RIGHT COLUMN: EXPOSURE (READ-ONLY — replaces the fake live position) ---
function ExposureWidget() {
  return (
    <Widget id="exposure" title="EXPOSURE · READ-ONLY" flex="flex-[0.7] min-h-[120px]">
      <div className="flex flex-col h-full items-center justify-center gap-3 p-3 text-center">
        <div className="w-10 h-10 rounded-full border border-[#00ffaa40] bg-[#00ffaa08] flex items-center justify-center shadow-[0_0_15px_rgba(0,255,170,0.15)]">
          <ShieldCheck size={20} className="text-[#00ffaa]" />
        </div>
        <span className="text-[0.6rem] font-black tracking-[0.2em] text-[#00ffaa] uppercase">
          Sem posição ao vivo
        </span>
        <span className="text-[0.5rem] text-[#8ab4f8]/70 leading-relaxed max-w-[230px]">
          Terminal em modo <span className="text-[#00f0ff] font-bold">FAIL_CLOSED</span>.
          Nenhuma chave de API, nenhuma ordem, nenhuma execução. Posições reais só
          aparecem quando um conector autorizado e auditado for conectado.
        </span>
        <span className="text-[0.45rem] tracking-[0.25em] text-[#8ab4f8]/40 uppercase font-bold border border-[#8ab4f8]/15 px-2 py-0.5 rounded">
          execução desabilitada por projeto
        </span>
      </div>
    </Widget>
  );
}

// --- RIGHT COLUMN: EVENTS — fed by the real GMIL event bus (LEI 02: "todo
// módulo distribui eventos"). Previously a permanently-empty placeholder;
// GMIL's provider readings/health transitions are exactly the kind of real,
// timestamped telemetry this panel always meant to show.
interface GmilLogEntry {
  id: string;
  timestamp: number;
  text: string;
  tone: "ok" | "warn" | "error";
}

const fmtClock = (ts: number) =>
  new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function EventsWidget() {
  const [log, setLog] = useState<GmilLogEntry[]>([]);

  useEffect(() => {
    const pushEntry = (entry: GmilLogEntry) => {
      setLog((prev) => [entry, ...prev].slice(0, 8));
    };
    const offReading = gmilBus.on<{ providerId: string; result: { ok: boolean; reason?: string } }>(
      "PROVIDER_READING",
      (event) => {
        const { providerId, result } = event.payload;
        pushEntry({
          id: `r-${event.timestamp}-${providerId}`,
          timestamp: event.timestamp,
          text: result.ok ? `${providerId} · leitura real recebida` : `${providerId} · falhou (${result.reason ?? "erro"})`,
          tone: result.ok ? "ok" : "warn",
        });
      },
    );
    const offHealth = gmilBus.on<{ providerId: string; from: string; to: string }>(
      "PROVIDER_HEALTH_CHANGED",
      (event) => {
        const { providerId, from, to } = event.payload;
        pushEntry({
          id: `h-${event.timestamp}-${providerId}`,
          timestamp: event.timestamp,
          text: `${providerId} · circuito ${from} → ${to}`,
          tone: to === "OPEN" ? "error" : "ok",
        });
        const spoken = describeProviderHealthChange(providerId, from as any, to as any);
        if (spoken) voiceEngine.speak(spoken, "ALERT");
      },
    );
    return () => {
      offReading();
      offHealth();
    };
  }, []);

  return (
    <Widget id="events" title="EVENT TELEMETRY" flex="flex-[0.8] min-h-[110px]">
      {log.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold">
          {AWAIT} EVENTOS REAIS…
        </div>
      ) : (
        <div className="flex flex-col gap-1 h-full overflow-y-auto scrollbar-hide px-1 py-1">
          {log.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-[0.45rem] font-mono">
              <span className="text-[#8ab4f8]/50 shrink-0">{fmtClock(entry.timestamp)}</span>
              <span
                className={`shrink-0 w-1 h-1 rounded-full ${
                  entry.tone === "ok" ? "bg-[#00ffaa]" : entry.tone === "warn" ? "bg-[#f0d06f]" : "bg-[#ff0055]"
                }`}
              ></span>
              <span className="text-[#a0f0ff]/80 truncate">{entry.text}</span>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// --- RIGHT COLUMN: GMIL · CONTEXTO GLOBAL ---
// LEI 04: um único GLOBAL CONSENSUS SCORE, sempre rotulado como contexto
// consultivo — nunca lido por engine-bridge.ts, nunca um "sinal". LEI 05:
// cada provedor mostra seu peso de qualidade em tempo real; um provedor
// degradado perde peso automaticamente e o consenso reflete isso sozinho.
// V11.5 Fase 5: `consensus` vem de App() já ampliado (3 provedores externos
// + liquidez + fluxo reais) — mesma fonte que a faixa essencial usa, então
// os dois nunca podem mostrar números diferentes sob o mesmo rótulo.
function GmilContextWidget() {
  // Fase J (diretriz 2, ZERO REPETIÇÃO): o número do consenso global mora
  // EXCLUSIVAMENTE no painel "Decision Context" da aba ANALYSIS (relocado
  // da antiga barra operacional no redesenho radical do comando) — o
  // cabeçalho duplicado que este painel exibia foi removido; aqui ficam só
  // os conteúdos únicos deste painel (vieses por categoria + provedores).
  const { gmilProviders, gmilBiases } = useContext(WidgetContext) || {};
  const providers = gmilProviders ?? [];

  // Fase E (V15 Cap. 6): os 3 vieses por categoria do context-aggregator.
  // Categoria sem provedor ativo (MACRO hoje) => score null => AGUARDANDO —
  // o gancho é visível e honesto, nunca um neutro fabricado.
  const biasCells: Array<{ label: string; score: number | null }> = [
    { label: "INST", score: gmilBiases?.institutionalBias?.score ?? null },
    { label: "MACRO", score: gmilBiases?.macroBias?.score ?? null },
    { label: "LIQ", score: gmilBiases?.liquidityBias?.score ?? null },
  ];
  const biasColor = (score: number | null) =>
    score === null
      ? "text-[#8ab4f8]/50"
      : score > 0.1
        ? "text-[#00ffaa]"
        : score < -0.1
          ? "text-[#ff0055]"
          : "text-[#8ab4f8]";


  return (
    <Widget
      id="gmil_context"
      title="GLOBAL CONTEXT · GMIL"
      flex="flex-[0.9] min-h-[190px]"
      extraHeader={<Globe size={12} className="text-[#00f0ff60]" />}
    >
      {/* overflow-y-auto: this panel now shares its column with 2 more
          widgets than when it was built (Market Regime + Asset Heatmap),
          and flex-grow can shrink it below its 2-providers' natural
          content height in landscape mode — without this, a crowded
          column would silently clip provider rows with no way to reach
          them (confirmed on MarketRegimeWidget in this same audit pass). */}
      <div className="flex flex-col gap-1.5 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        {/* Fase J: o cabeçalho "CONSENSO GLOBAL" que morava aqui foi
            removido — o número já vive no painel Decision Context (aba
            ANALYSIS), e a regra de Zero Repetição da Fase J proíbe o mesmo
            indicador em dois painéis. */}
        {/* Fase E: vieses por categoria (V15 Cap. 6) — INST (derivativos/
            on-chain), MACRO (sem fonte keyless ainda: AGUARDANDO honesto),
            LIQ (agregados de mercado). */}
        <div className="grid grid-cols-3 gap-1">
          {biasCells.map((b) => (
            <div key={b.label} className="flex flex-col items-center bg-[#010308] px-1 py-1 rounded border border-[#8ab4f8]/10">
              <span className="text-[0.4rem] text-[#8ab4f8]/60 font-bold tracking-widest">VIÉS {b.label}</span>
              <span className={`text-[0.55rem] font-mono font-black ${biasColor(b.score)}`}>
                {formatConsensusScore(b.score)}
              </span>
            </div>
          ))}
        </div>
        {providers.map((p) => {
          const value = p.lastReading?.ok ? p.lastReading.fields : null;
          const summary =
            p.id === "coingecko_global" && value
              ? `BTC ${typeof value.btcDominancePct === "number" ? value.btcDominancePct.toFixed(1) : DASH}% · ETH ${typeof value.ethDominancePct === "number" ? value.ethDominancePct.toFixed(1) : DASH}%`
              : p.id === "fear_greed_index" && value
                ? `${value.classification ?? DASH} (${value.value ?? DASH})`
                : p.id === "trending_coins" && value
                  ? typeof value.topSymbols === "string" && value.topSymbols
                    ? value.topSymbols
                    : DASH
                  : p.id === "derivatives_positioning" && value
                    ? `fund ${typeof value.fundingRate === "number" ? (value.fundingRate * 100).toFixed(4) : DASH}% · basis ${typeof value.basisPct === "number" ? value.basisPct.toFixed(3) : DASH}%`
                    : p.circuitState === "OPEN"
                      ? "circuito aberto"
                      : AWAIT;
          const dotColor =
            p.circuitState === "OPEN" ? "bg-[#ff0055]" : p.weight > 0.6 ? "bg-[#00ffaa]" : "bg-[#f0d06f]";
          // Data Quality (V11 §12): disponibilidade/latência/peso/última
          // atualização por provedor — reaproveita os mesmos campos que a
          // linha acima já busca (circuitState/lastLatencyMs/weight/
          // lastSuccessAt já existem em ProviderRuntimeSnapshot), então isto
          // é uma segunda LINHA da mesma lista existente, não um painel
          // duplicado listando os mesmos 2 provedores de novo.
          const ageLabel = ageLabelOf(p.lastSuccessAt ?? null);
          const latencyLabel = num(p.lastLatencyMs) ? `${Math.round(p.lastLatencyMs)}ms` : AWAIT;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-0.5 bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
            >
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide truncate">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}></span>
                  {p.label}
                </span>
                <span className="text-[0.45rem] text-white font-mono shrink-0 ml-1">{summary}</span>
              </div>
              <div className="flex justify-between items-center text-[0.4rem] text-[#8ab4f8]/40 font-mono pl-3">
                <span>{p.circuitState} · {latencyLabel} · att. há {ageLabel}</span>
                <span>peso {Math.round(p.weight * 100)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}

// --- MARKET REGIME (V11 §13) ---
// Every field is a passthrough or trivial derivation of state already
// computed in the `engine` useMemo — nothing new is fetched or invented.
//
// Self-audit finding (this charter's "mínima redundância de informações",
// already stated once before in V11 §9): this widget originally had 6
// rows, but Liquidez/Risco/Macro were EXACT duplicates of EssentialStrip's
// always-visible chips — same source field, same formula, same rounding —
// with Macro additionally repeated a THIRD time in GmilContextWidget's own
// "CONSENSO GLOBAL" row a few pixels away in the same column. Pruned to
// the 3 fields with no existing representation anywhere else: Tendência
// (engine.marketStructureLabel — the SAME clean label AssistantOrb's
// ESTRUTURA row now also uses, computed once in the engine useMemo, not
// re-derived here), Momentum (CVD's direction as a label — CVD's raw
// number is shown in OrderFlowWidget, but not this label), Volatilidade
// (genuinely new).
// Fase D: rótulos de exibição do vocabulário fechado do Market Regime
// Engine (src/market-regime/regime-engine.js REGIMES) — só tradução visual,
// a classificação em si nunca é recomputada aqui.
const REGIME_DISPLAY: Record<string, { label: string; color: string }> = {
  TENDENCIA_FORTE: { label: "TEND. FORTE", color: "text-[#00ffaa]" },
  TENDENCIA_MODERADA: { label: "TEND. MODERADA", color: "text-[#8ab4f8]" },
  CONSOLIDACAO: { label: "CONSOLIDAÇÃO", color: "text-[#8ab4f8]" },
  COMPRESSAO: { label: "COMPRESSÃO", color: "text-[#f0d06f]" },
  BREAKOUT: { label: "BREAKOUT", color: "text-[#f0d06f]" },
};

function MarketRegimeWidget() {
  const { engine, cvd, currentRsi, currentMacd, chartTimeframe, orderflowTrend } = useContext(WidgetContext) || {};

  // Fase D: linha oficial do Market Regime Engine (ADX/DI + percentil de
  // banda, ver src/market-regime/). Direção colore o rótulo composto;
  // regimes sem direção (consolidação/compressão) usam a cor do tipo.
  const regime = engine?.marketRegime ?? null;
  const regimeDisplay = regime ? REGIME_DISPLAY[regime.regime] : null;
  // Fase J (diretriz 4): idade REAL do regime vigente — changedAt vem do
  // RegimeHistory (quando a transição de verdade aconteceu), não do último
  // ciclo. Mora AQUI, na linha oficial do regime (zero repetição).
  const regimeLabel = regimeDisplay
    ? `${regimeDisplay.label}${regime.direction ? ` · ${regime.direction}` : ""}${num(regime.changedAt) ? ` · há ${ageLabelOf(regime.changedAt)}` : ""}`
    : AWAIT;
  const regimeColor = !regimeDisplay
    ? "text-[#8ab4f8]"
    : regime.direction === "ALTA"
      ? "text-[#00ffaa]"
      : regime.direction === "BAIXA"
        ? "text-[#ff0055]"
        : regimeDisplay.color;

  const trendLabel = engine?.marketStructureLabel ?? AWAIT;
  const trendColor =
    engine?.marketStructureLabel === "ALTA"
      ? "text-[#00ffaa]"
      : engine?.marketStructureLabel === "BAIXA"
        ? "text-[#ff0055]"
        : "text-[#8ab4f8]";

  const momentumLabel = !num(cvd) || cvd === 0 ? AWAIT : cvd > 0 ? "COMPRADOR" : "VENDEDOR";
  const momentumColor = !num(cvd) || cvd === 0 ? "text-[#8ab4f8]" : cvd > 0 ? "text-[#00ffaa]" : "text-[#ff0055]";

  // Diretriz Complementar §18 ("tendência de força do fluxo"): a
  // INCLINAÇÃO real do CVD (metade recente vs. anterior da janela retida),
  // não a leitura instantânea acima — uma pergunta diferente ("a pressão
  // está ganhando ou perdendo força?"). null honesto (AWAIT) com histórico
  // curto demais, nunca uma tendência fabricada.
  const flowTrendLabel =
    orderflowTrend?.status === "OK" && orderflowTrend.trend
      ? orderflowTrend.trend === "FORTALECENDO"
        ? "FORTALECENDO"
        : orderflowTrend.trend === "ENFRAQUECENDO"
          ? "ENFRAQUECENDO"
          : "ESTÁVEL"
      : AWAIT;
  const flowTrendColor =
    orderflowTrend?.status !== "OK" || !orderflowTrend.trend
      ? "text-[#8ab4f8]"
      : orderflowTrend.trend === "FORTALECENDO"
        ? "text-[#00ffaa]"
        : orderflowTrend.trend === "ENFRAQUECENDO"
          ? "text-[#ff0055]"
          : "text-[#8ab4f8]";

  // MomentumAgent order: mesmo RSI de Wilder real já votado pelo Conselho
  // (currentRsi, computado uma vez em App() — zero segunda matemática).
  // Mesma leitura clássica de exaustão do agente — RSI_OVERBOUGHT/
  // RSI_OVERSOLD importados de council.ts (achado real de auditoria: este
  // gauge reimplementava 70/30 como literais soltos, um segundo lugar que
  // silenciosamente desincronizaria da cor se o limiar real do voto do
  // Conselho um dia mudasse), cores espelham a semântica de stance do voto.
  const rsiLabel = num(currentRsi) ? currentRsi.toFixed(1) : AWAIT;
  const rsiColor = !num(currentRsi)
    ? "text-[#8ab4f8]"
    : currentRsi >= RSI_OVERBOUGHT
      ? "text-[#ff0055]"
      : currentRsi <= RSI_OVERSOLD
        ? "text-[#00ffaa]"
        : "text-[#8ab4f8]";

  // Diretriz Final de Integração Total: graduação real do MACD
  // (nexus/macd.ts, EPC OMEGA FINAL) — mesmo padrão de rsiLabel/rsiColor
  // acima. Histograma > 0 (linha rápida cruzou acima da linha de sinal)
  // lê como momentum comprador, < 0 como vendedor — mesma paleta
  // direcional teal/rosa já usada em toda a UI (nunca uma cor nova).
  const macdLabel = num(currentMacd?.histogram) ? currentMacd.histogram.toFixed(1) : AWAIT;
  const macdColor = !num(currentMacd?.histogram)
    ? "text-[#8ab4f8]"
    : currentMacd.histogram > 0
      ? "text-[#00ffaa]"
      : currentMacd.histogram < 0
        ? "text-[#ff0055]"
        : "text-[#8ab4f8]";

  // ORDEM DE AUDITORIA FINAL §3/§4 (achado real): esta row recomputava um
  // proxy PRÓPRIO (média ingênua de (high-low)/close, sem gaps) quando o
  // Market Regime Engine (regime-engine.js) já calcula o ATR% REAL (true
  // range com gaps, período de Wilder) como regime.evidence.atr_percent —
  // já repassado em engine.marketRegime.atrPercent, já insumo real do Risk
  // Engine e já o mesmo número mostrado no tooltip do Multi-Timeframe
  // Matrix para os OUTROS 5 prazos. Duas fórmulas diferentes reivindicando
  // "volatilidade" para o MESMO prazo era uma duplicação real (cálculo
  // redundante) — corrigido para ler a única fonte real (Single Source of
  // Truth), a mesma que eta-engine.ts e aura-lifecycle.ts já consomem.
  const volPct = num(engine?.marketRegime?.atrPercent) ? engine.marketRegime.atrPercent : null;
  const volLabel = volPct === null ? AWAIT : `${volPct.toFixed(2)}%`;
  const volColor = volPct === null ? "text-[#8ab4f8]" : volPct > 1.5 ? "text-[#ff0055]" : volPct > 0.6 ? "text-[#f0d06f]" : "text-[#00ffaa]";

  // V11.5 §2 (contexto multitemporal): compara a estrutura do timeframe
  // selecionado (acima) com a de 1H, real, cacheada em engine-bridge.ts —
  // não uma duplicata da linha TENDÊNCIA, é uma pergunta diferente ("os
  // dois prazos concordam?").
  const htfLabel = engine?.htfMarketStructureLabel ?? AWAIT;
  const confluenceLabel =
    engine?.timeframeConfluence ?? (engine?.htfMarketStructureLabel ? "LATERAL/MISTO" : AWAIT);
  const confluenceColor =
    engine?.timeframeConfluence === "CONFLUENTE"
      ? "text-[#00ffaa]"
      : engine?.timeframeConfluence === "DIVERGENTE"
        ? "text-[#f0d06f]"
        : "text-[#8ab4f8]";

  const Row = ({ label, value, valueClass }: { label: string; value: string; valueClass: string }) => (
    <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10">
      <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">{label}</span>
      <span className={`text-[0.5rem] font-mono font-black ${valueClass}`}>{value}</span>
    </div>
  );

  return (
    <Widget id="market_regime" title="MARKET REGIME" flex="flex-[0.9] min-h-[190px]">
      {/* overflow-y-auto here is a hard requirement, not decoration: in
          landscape mode min-[1120px]:min-h-0 lets flex-grow shrink this
          panel below its natural content height when the column gets
          crowded (confirmed via measurement: shrank to 74px with 6+
          sibling widgets competing for the same column, clipping 2 of 3
          rows with no way to reach them). ScannerWidget already uses this
          exact pattern for the same reason. */}
      <div className="flex flex-col gap-1.5 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        <Row label="REGIME (MOTOR OFICIAL)" value={regimeLabel} valueClass={regimeColor} />
        <Row label={`TENDÊNCIA (ESTRUTURA ${chartTimeframe?.toUpperCase() ?? "15M"})`} value={trendLabel} valueClass={trendColor} />
        <Row label={`ESTRUTURA ${engine?.htfTimeframe?.toUpperCase() ?? "1H"}`} value={htfLabel} valueClass="text-[#8ab4f8]" />
        <Row label="MULTI-TF CONFLUENCE" value={confluenceLabel} valueClass={confluenceColor} />
        <Row label="MOMENTUM (CVD)" value={momentumLabel} valueClass={momentumColor} />
        <Row label="TENDÊNCIA DO FLUXO" value={flowTrendLabel} valueClass={flowTrendColor} />
        <Row label="RSI (14)" value={rsiLabel} valueClass={rsiColor} />
        <Row label="MACD (12,26,9)" value={macdLabel} valueClass={macdColor} />
        <Row label="VOLATILIDADE (ATR%)" value={volLabel} valueClass={volColor} />
      </div>
    </Widget>
  );
}

// --- CONSELHO MULTI-AGENTE (V-MAX Fase 1 item 4 — superfície visual) ---
// HUD do debate real: 7 votos (postura/confiança/racional) + decisão do
// Meta-Agent + CPI da memória afetiva. Tudo lido da store
// (useCouncilSnapshot/useCpiSnapshot) — os MESMOS objetos que os efeitos
// de App() gravam; este componente só exibe, nunca recomputa (LEI 24:
// camada de exibição, jamais toca o Core Engine).
const COUNCIL_STANCE_COLOR: Record<string, string> = {
  LONG: "text-[#00ffaa]",
  SHORT: "text-[#ff0055]",
  NEUTRAL: "text-[#8ab4f8]",
  ABSTAIN: "text-[#f0d06f]",
};
const COUNCIL_AGENT_LABEL: Record<string, string> = {
  LIQUIDITY: "LIQUIDEZ",
  STRUCTURE: "ESTRUTURA",
  ORDERFLOW: "ORDER FLOW",
  RISK: "RISCO",
  MANIPULATION: "MANIPULAÇÃO",
  FIBONACCI: "FIBONACCI",
  MOMENTUM: "MOMENTUM (RSI)",
};
// Diretriz Complementar §8 ("Radar de Consenso") — rótulos das 6 categorias
// reais de consensus-radar.ts. Estrutura/Liquidez/Fluxo/Momentum aqui são o
// MESMO rótulo do Conselho acima de propósito (mesmo dado, visão resumida).
const CONSENSUS_RADAR_LABEL: Record<ConsensusRadarCategory, string> = {
  ESTRUTURA: "ESTRUTURA",
  LIQUIDEZ: "LIQUIDEZ",
  FLUXO: "FLUXO",
  MOMENTUM: "MOMENTUM",
  VOLATILIDADE: "VOLATILIDADE",
  GMIL: "GMIL (GLOBAL)",
};

function CouncilWidget() {
  const council = useCouncilSnapshot();
  // Ordem Nº 04 (§4): forma única real (EngineSignal) sobre os MESMOS votos
  // de `council.votes` — deriveEngineSignalsFromCouncil só reempacota,
  // nunca recalcula (LEI 24 intacta). Mesma ordem/comprimento de
  // `council.votes` sempre (decision.votes.map em engine-signal-
  // contract.ts) — pareável por índice abaixo, zero parsing de `id`.
  const engineSignals = useMemo(() => deriveEngineSignalsFromCouncil(council), [council]);
  // Carta Branca (Evidence Fusion Engine): 2ª fonte real e independente
  // (zero voto de agente envolvido) — mesma fatia da store que o gráfico
  // já publica (institutionalZones), zero segundo cálculo. fuseEvidence
  // NUNCA produz direção/score — só estatística real de cobertura/volume
  // (ver cabeçalho de nexus/evidence-fusion.ts).
  const institutionalZones = useInstitutionalZonesSnapshot();
  const institutionalSignals = useMemo(
    () => deriveEngineSignalsFromInstitutionalZones(institutionalZones),
    [institutionalZones],
  );
  // Ordem Consolidação Final (Prioridade 3, "medir relevância"): mesma
  // fatia real que o painel de camadas já usa (useLayerRelevanceSnapshot,
  // linha ~3782) — zero segundo cálculo. Zonas Institucionais mapeia 1:1
  // para a camada real "institutional_zones"; Conselho não é uma camada de
  // gráfico togglable, então recebe null honesto (não um valor fabricado).
  const layerRelevance = useLayerRelevanceSnapshot();
  // Ordem Fechamento (§3, "Evidence Fusion... barramento inteligente do
  // ecossistema"): useMemo (não só o cálculo puro) porque o resultado
  // agora também é PUBLICADO na store logo abaixo — sem isto, uma nova
  // referência a cada render de CouncilWidget dispararia setEvidenceFusion
  // (e o produce/freeze do Immer) em todo tick, mesmo quando council/
  // institutionalZones/layerRelevance não mudaram de verdade.
  const evidenceFusion = useMemo(
    () =>
      fuseEvidence([
        { source: "Conselho", signals: engineSignals, relevance: null },
        {
          source: "Zonas Institucionais",
          signals: institutionalSignals,
          relevance: layerRelevance?.institutional_zones ?? null,
        },
      ] satisfies EvidenceFusionSourceGroup[]),
    [engineSignals, institutionalSignals, layerRelevance],
  );
  // Publica a MESMA leitura já computada acima (zero segundo cálculo) na
  // store, mesmo padrão de institutionalZones/layerRelevance — agora
  // qualquer consumidor futuro (self-diagnostics.ts é o primeiro) lê via
  // useEvidenceFusionSnapshot()/getSnapshotForEngine() em vez de recomputar.
  useEffect(() => {
    useUnifiedSnapshotStore.getState().setEvidenceFusion(evidenceFusion);
  }, [evidenceFusion]);
  const cpi = useCpiSnapshot();
  // Achado de auditoria: reward/pain/eventCount reais já são alimentados
  // por 8 call sites reais de recordAffectiveEvent (App.tsx) mas só o
  // ratio derivado (cpi) era exibido — nenhum consumidor distinguia "CPI
  // 50% com 2 eventos" de "CPI 50% com 200 eventos". Mesmo padrão do
  // TRUST SCORE logo abaixo (componentes reais no tooltip).
  const affectiveMemory = useAffectiveMemorySnapshot();
  // V-MAX Fase 2: cenários Path A/B e armadilhas reais — mesma store.
  const scenario = useScenarioSnapshot();
  const traps = useTrapSignalsSnapshot();
  const trustScore = useTrustScoreSnapshot();
  // Diretriz Complementar §8: mesma store, fatia própria (ver consensus-radar.ts).
  const consensusRadar = useConsensusRadarSnapshot();

  const stance = council?.stance ?? null;
  const stanceLabel = stance ?? AWAIT;
  const stanceColor = stance ? COUNCIL_STANCE_COLOR[stance] : "text-[#8ab4f8]";
  // agreement é massa de opinião do comitê (Fase F) — NUNCA probabilidade
  // de mercado; o rótulo "coesão" diz o que o número realmente é.
  const agreementLabel = council?.agreement !== null && council?.agreement !== undefined
    ? `${Math.round(council.agreement * 100)}%`
    : DASH;
  // Achado real de auditoria: este cpiLabel usava AWAIT ("AWAITING", 9
  // caracteres) enquanto agreementLabel (mesma linha de layout — fatia
  // percentual compacta, font-mono tiny) usa DASH, e a OUTRA leitura real
  // do mesmo CPI em NucleoVoiceOrb também já usa DASH — DASH alinhado aqui
  // por consistência visual real, zero mudança de dado.
  const cpiLabel = cpi === null ? DASH : `${Math.round(cpi * 100)}%`;
  const cpiColor = cpi === null ? "text-[#8ab4f8]" : cpi >= 0.7 ? "text-[#00ffaa]" : cpi >= 0.4 ? "text-[#f0d06f]" : "text-[#ff0055]";

  return (
    <Widget id="council" title="MULTI-AGENT COUNCIL" flex="flex-[1] min-h-[210px]">
      <div className="flex flex-col gap-1 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#00f0ff20]">
          {/* Achado real de auditoria (DIRETRIZES AVANÇADAS, consistência
              de decisão — LEI 24): esta linha dizia só "DECISÃO", sem
              tooltip, ao contrário das linhas-irmãs deste mesmo widget
              (ex.: SCENARIO A/B logo abaixo, que já explicita "never
              market probability"). O Conselho pode divergir do Core
              Engine por um ciclo real (decision-layer.ts documenta isso
              de propósito) — um relance rápido aqui podia confundir o
              voto do Conselho com a decisão real única do sistema. */}
          <span
            className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide"
            title="Voto do Multi-Agent Council — confluência/contexto real, nunca a decisão do sistema. A única decisão real (LONG/SHORT/WAIT) vem do Core Engine (LEI 24); o Conselho pode divergir por um ciclo real."
          >
            VOTO DO CONSELHO{council?.riskGated ? " · TRAVADO (RISCO)" : ""}
          </span>
          <span className={`text-[0.55rem] font-mono font-black ${stanceColor}`}>
            {stanceLabel}
            {council && council.quorum > 0 ? (
              <span className="text-[#8ab4f8]/60 font-normal"> · coesão {agreementLabel} · quórum {council.quorum}/6</span>
            ) : null}
          </span>
        </div>
        {/* Diretriz Complementar §8 ("Radar de Consenso"): as 6 magnitudes
            reais lado a lado para leitura num relance. Estrutura/Liquidez/
            Fluxo/Momentum são os MESMOS 4 votos do Conselho detalhados
            abaixo — nunca uma segunda fonte. Volatilidade (bandwidth
            percentile do regime) e GMIL (|institutionalConsensus.score|)
            são leituras reais que o Conselho não vota. "Risk Engine" fica
            de fora de propósito: nenhuma magnitude contínua real existe
            para essa categoria neste sistema (ver consensus-radar.ts) —
            omissão honesta, não um buraco silencioso. Barras estáticas,
            sem animação (Clareza Visual + 60fps): só o preenchimento muda
            de largura quando o dado real muda. */}
        <div className="flex flex-col gap-0.5 bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10">
          <span className="text-[0.4rem] text-[#8ab4f8]/50 font-bold tracking-[0.2em]">RADAR DE CONSENSO</span>
          {consensusRadar ? (
            consensusRadar.spokes.map((spoke) => (
              <div key={spoke.category} className="flex items-center gap-1.5">
                <span className="text-[0.4rem] text-[#8ab4f8]/60 font-bold tracking-wide w-[54px] shrink-0">
                  {CONSENSUS_RADAR_LABEL[spoke.category]}
                </span>
                <div className="flex-1 h-1 bg-[#00131a] rounded-full overflow-hidden border border-[#00f0ff15]">
                  {spoke.value !== null && (
                    <div
                      className="h-full bg-[#00f0ff] shadow-[0_0_4px_#00f0ff]"
                      style={{ width: `${Math.round(spoke.value * 100)}%` }}
                    />
                  )}
                </div>
                <span className="text-[0.4rem] font-mono text-[#8ab4f8]/70 w-[22px] text-right shrink-0">
                  {spoke.value !== null ? `${Math.round(spoke.value * 100)}%` : AWAIT}
                </span>
              </div>
            ))
          ) : (
            <span className="text-[0.4rem] text-[#8ab4f8]/40 text-center py-1">{AWAIT}</span>
          )}
        </div>
        {(council?.votes ?? []).map((v, i) => {
          // Ordem Nº 04: signal.weight real (engine-signal-contract.ts,
          // espelha aggregateCouncil/council.ts:429-431 — RISK nunca é
          // direcional, ABSTAIN nunca tem opinião real) diz se este voto
          // especificamente ENTROU no linear opinion pool (Stone 1961/
          // DeGroot 1974) que formou VOTO DO CONSELHO acima. Informação já
          // real e computada hoje (riskGated/quorum), nunca antes exibida
          // POR VOTO — só o efeito agregado (quórum N/6) aparecia.
          const inPool = engineSignals[i]?.weight !== null && engineSignals[i]?.weight !== undefined;
          return (
            <div
              key={v.agent}
              className="flex flex-col bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
              title={v.evidence.length > 0 ? v.evidence.join(" · ") : v.rationale}
            >
              <div className="flex justify-between items-center">
                <span className={`text-[0.45rem] font-bold tracking-wide ${inPool ? "text-[#8ab4f8]/70" : "text-[#8ab4f8]/40"}`}>
                  {COUNCIL_AGENT_LABEL[v.agent] ?? v.agent}
                  {!inPool && (
                    <span
                      className="text-[0.38rem] font-normal italic text-[#8ab4f8]/40"
                      title="Fora do pool linear real do Conselho: RISK é um portão fail-closed (nunca uma opinião direcional); ABSTAIN é ausência real de opinião nesta janela. Nenhum dos dois entra na massa de opinião que forma VOTO DO CONSELHO."
                    >
                      {" "}· fora do pool
                    </span>
                  )}
                </span>
                <span className={`text-[0.5rem] font-mono font-black ${COUNCIL_STANCE_COLOR[v.stance]}`}>
                  {v.stance}
                  {v.confidence !== null ? <span className="text-[#8ab4f8]/60 font-normal"> {Math.round(v.confidence * 100)}%</span> : null}
                </span>
              </div>
              <span className="text-[0.42rem] text-[#8ab4f8]/50 leading-tight truncate">{v.rationale}</span>
            </div>
          );
        })}
        {!council && (
          <div className="flex items-center justify-center text-[0.5rem] tracking-[0.25em] text-[#8ab4f8]/40 font-bold py-3">
            {AWAIT}
          </div>
        )}
        {/* V-MAX Fase 2 — Path A/B: alvos são níveis REAIS dos motores;
            "opinião" é massa do comitê (Fase F), rotulada como tal — o
            title inteiro do bloco repete a natureza do número para nunca
            ser lido como probabilidade de mercado. */}
        {scenario && (
          <div
            className="flex flex-col gap-0.5 bg-[#010308] px-2 py-1 rounded border border-[#00f0ff15]"
            title="Weights = Council opinion mass (committee) — NEVER market probability. Targets = next real levels mapped by the engines."
          >
            <div className="flex justify-between items-center">
              <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">SCENARIO A</span>
              <span className={`text-[0.48rem] font-mono font-black ${scenario.pathA.direction === "LONG" ? "text-[#00ffaa]" : "text-[#ff0055]"}`}>
                {formatScenarioPathLabel(scenario.pathA)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">SCENARIO B</span>
              <span className={`text-[0.48rem] font-mono font-black ${scenario.pathB.direction === "LONG" ? "text-[#00ffaa]" : "text-[#ff0055]"}`}>
                {formatScenarioPathLabel(scenario.pathB)}
              </span>
            </div>
          </div>
        )}
        {/* V-MAX Fase 2 — armadilhas por corroboração de eventos reais;
            nenhuma linha quando não há evento (honesto, não vazio-triste). */}
        {traps.length > 0 && (
          <div className="flex flex-col gap-0.5 bg-[#010308] px-2 py-1 rounded border border-[#ff005530]">
            {traps.map((t) => (
              <div key={t.kind} className="flex justify-between items-center" title={t.evidence.join(" · ")}>
                <span className="text-[0.45rem] text-[#ff0055]/80 font-bold tracking-wide">TRAP · {t.kind.replace(/_/g, " ")}</span>
                <span className="text-[0.5rem] font-mono font-black text-[#ff0055]">{Math.round(t.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        )}
        <div
          className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
          title={
            affectiveMemory.eventCount > 0
              ? `Reward ${affectiveMemory.reward.toFixed(2)} · Pain ${affectiveMemory.pain.toFixed(2)} · ${affectiveMemory.eventCount} eventos reais desde o boot`
              : "Nenhum evento afetivo real registrado ainda nesta sessão"
          }
        >
          <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">CPI · MEMÓRIA AFETIVA</span>
          <span className={`text-[0.5rem] font-mono font-black ${cpiColor}`}>{cpiLabel}</span>
        </div>
        {/* V-MAX Fase 2 — TrustScore da FONTE (WASM): cadência real +
            convergência cross-exchange; componentes reais no tooltip. */}
        <div
          className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
          title={trustScore
            ? `Cadência ${Math.round(trustScore.cadenceRegularity * 100)}% (${trustScore.gapCount} gaps reais)${trustScore.crossExchangeConvergence !== null ? ` · Convergência ${Math.round(trustScore.crossExchangeConvergence * 100)}% (${trustScore.divergenceCount} exchanges)` : " · convergência não medida"}`
            : "Awaiting real cadence samples"}
        >
          <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">TRUST SCORE · FONTE</span>
          <span className={`text-[0.5rem] font-mono font-black ${trustScore === null ? "text-[#8ab4f8]" : trustScore.score >= 0.7 ? "text-[#00ffaa]" : trustScore.score >= 0.4 ? "text-[#f0d06f]" : "text-[#ff0055]"}`}>
            {trustScore === null ? AWAIT : `${Math.round(trustScore.score * 100)}%`}
          </span>
        </div>
        {/* Carta Branca (Evidence Fusion Engine): primeiro consumidor real
            de engine-signal-contract.ts — SYSTEM_HANDBOOK §6.72/§6.74/§6.76
            chamavam isto de "iniciativa de arquitetura própria" por 3
            rodadas seguidas, nunca construído até agora. Cor SEMPRE neutra
            de propósito (nunca verde/vermelho): é o único jeito visual de
            garantir, num relance, que isto nunca é lido como um sinal
            direcional — mesma disciplina de SCENARIO A/B acima, que usa a
            cor real do LONG/SHORT porque É uma leitura direcional; esta
            linha nunca é. */}
        <div
          className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
          title={
            evidenceFusion.totalSignals > 0
              ? `${evidenceFusion.bySource.map((b) => `${b.source}: ${b.valid}/${b.total} válidos${b.meanWeight !== null ? ` · peso médio ${Math.round(b.meanWeight * 100)}%` : ""}${b.relevance ? ` · ${b.relevance.relevant ? "relevante agora" : "fora de relevância agora"}` : ""}`).join(" · ")} · Confiança média (só válidos): ${evidenceFusion.meanConfidence !== null ? `${Math.round(evidenceFusion.meanConfidence * 100)}%` : "sem amostra real"} · Consenso de peso entre fontes: ${evidenceFusion.weightConsensus !== null ? `${Math.round(evidenceFusion.weightConsensus * 100)}%` : "sem amostra real (menos de 2 pesos)"} · Cobertura do contrato de 10 campos: ${Object.values(evidenceFusion.fieldCoverage).filter((v) => v > 0).length}/10 instrumentados — estatística real de cobertura/volume, NUNCA uma direção ou score combinado (LEI 24)`
              : "Nenhuma fonte real montada ainda (Conselho sem quórum e/ou zero Zona Institucional confluente agora)"
          }
        >
          <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">EVIDENCE FUSION · coverage, never a score</span>
          <span className="text-[0.5rem] font-mono font-black text-[#8ab4f8]">
            {evidenceFusion.totalSignals > 0
              ? `${evidenceFusion.validSignals}/${evidenceFusion.totalSignals} válidos · ${Object.values(evidenceFusion.fieldCoverage).filter((v) => v > 0).length}/10 campos${evidenceFusion.weightConsensus !== null ? ` · consenso ${Math.round(evidenceFusion.weightConsensus * 100)}%` : ""}`
              : AWAIT}
          </span>
        </div>
      </div>
    </Widget>
  );
}

// --- MULTI-TIMEFRAME MATRIX (Fase Ω Priority 1) ---
// Contexto real independente por prazo (1m/5m/15m/1h/4h/1d) — display only,
// LEI 24: confluência/contexto entre prazos, nunca um segundo motor de
// decisão (o único LONG/SHORT/WAIT real continua sendo o Core Engine, para
// o timeframe selecionado no gráfico). "Confidence" é massa de opinião real
// do MESMO linear opinion pool do Conselho (ver multi-timeframe-engine.ts)
// — NUNCA uma probabilidade calibrada, mesmo rótulo honesto usado em toda
// parte deste app (agreement do Conselho, CPI, TrustScore).
const MTF_ROW_LABEL: Record<MultiTimeframeId, string> = {
  "1m": "1M", "3m": "3M", "5m": "5M", "15m": "15M", "30m": "30M", "1h": "1H", "4h": "4H", "1d": "1D", "1w": "1W",
};
const MTF_STANCE_COLOR: Record<string, string> = {
  LONG: "text-[#00ffaa]",
  SHORT: "text-[#ff0055]",
  NEUTRAL: "text-[#8ab4f8]",
};

function MultiTimeframeMatrixWidget() {
  const matrix = useMultiTimeframeSnapshot();

  const rows = MULTI_TIMEFRAME_LIST.map((tf) => ({ tf, ctx: matrix?.[tf] ?? null }));
  // Confluência real = contagem honesta de quantos dos prazos COM leitura
  // real concordam — nunca uma média ponderada por "probabilidade", só uma
  // soma de rótulos reais (mesmo espírito do quórum do Conselho).
  const readRows = rows
    .map((r) => r.ctx)
    .filter((c): c is TimeframeContext => !!c && c.status === "OK" && c.confidenceStance !== null);
  const longCount = readRows.filter((c) => c.confidenceStance === "LONG").length;
  const shortCount = readRows.filter((c) => c.confidenceStance === "SHORT").length;
  const neutralCount = readRows.length - longCount - shortCount;
  const confluenceLabel =
    readRows.length === 0
      ? AWAIT
      : longCount === readRows.length
      ? `${readRows.length}/${readRows.length} LONG`
      : shortCount === readRows.length
      ? `${readRows.length}/${readRows.length} SHORT`
      : `MISTO · ${longCount}L/${shortCount}S/${neutralCount}N`;
  const confluenceColor =
    readRows.length === 0
      ? "text-[#8ab4f8]"
      : longCount === readRows.length
      ? "text-[#00ffaa]"
      : shortCount === readRows.length
      ? "text-[#ff0055]"
      : "text-[#f0d06f]";

  return (
    <Widget id="multi_timeframe" title="MULTI-TIMEFRAME MATRIX" flex="flex-1">
      <div className="flex flex-col gap-1 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        <div
          className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#00f0ff20]"
          title="Contagem real de quantos dos 6 prazos (com leitura real) concordam — NUNCA uma probabilidade calibrada (este repositório não tem backtest para sustentar essa afirmação honestamente)."
        >
          <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">CONFLUÊNCIA · 6 PRAZOS</span>
          <span className={`text-[0.55rem] font-mono font-black ${confluenceColor}`}>{confluenceLabel}</span>
        </div>
        {rows.map(({ tf, ctx }) => {
          const insufficient = !ctx || ctx.status !== "OK";
          const stance = ctx?.confidenceStance ?? null;
          const stanceColor = stance ? MTF_STANCE_COLOR[stance] : "text-[#8ab4f8]";
          const structureShort = ctx?.structureLabel ? ctx.structureLabel.replace("ESTRUTURA_", "") : null;
          const tooltip = insufficient
            ? `${MTF_ROW_LABEL[tf]}: ${ctx?.reason ?? "sem_dados_reais"}`
            : [
                ctx.regime ? `Regime ${ctx.regime}` : null,
                ctx.rsi !== null ? `RSI ${ctx.rsi.toFixed(1)}` : null,
                ctx.support1 !== null ? `S1 ${ctx.support1.toFixed(0)}` : null,
                ctx.resistance1 !== null ? `R1 ${ctx.resistance1.toFixed(0)}` : null,
                ctx.atrPercent !== null ? `ATR ${ctx.atrPercent.toFixed(2)}%` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "sem métrica adicional real nesta janela";
          return (
            <div
              key={tf}
              className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
              title={tooltip}
            >
              <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide w-7 shrink-0">
                {MTF_ROW_LABEL[tf]}
              </span>
              <span className="text-[0.42rem] text-[#8ab4f8]/50 flex-1 text-center truncate px-1">
                {insufficient ? AWAIT : structureShort ?? "—"}
              </span>
              <span className={`text-[0.5rem] font-mono font-black shrink-0 ${stanceColor}`}>
                {insufficient ? "—" : stance ?? "—"}
                {!insufficient && ctx?.confidence !== null && ctx?.confidence !== undefined ? (
                  <span className="text-[#8ab4f8]/60 font-normal"> {Math.round(ctx.confidence * 100)}%</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}

// --- SYSTEM HEALTH (Fase J / V15 Cap. 17) ---
// Telemetria de sistema com medições REAIS: qualidade da fonte do Bus
// (Fase C), variante WASM carregada (Fase I), latência cronometrada do
// ciclo, FPS via rAF e memória JS SÓ onde a plataforma expõe API
// (Chromium; Safari => SEM_API declarado, nunca um número fabricado).
// ZERO REPETIÇÃO: nenhum destes indicadores aparece em outro painel —
// regime/vieses/comitê/risco moram nos painéis das suas fases.
// ADITIVO V-MAX Etapa 17 (Chart Integrity Engine): vocabulário/cor
// próprios (mapeados para a MESMA paleta DATA_QUALITY_COLOR já usada
// pelas outras linhas deste painel — nunca uma 2ª paleta), rótulo curto
// para caber na largura do Row.
const CHART_INTEGRITY_LABEL: Record<ChartIntegrityStatus, string> = {
  SYNCED: "SINCRONIZADO",
  SYMBOL_MISMATCH: "DESSINCRONIZADO",
  STALE_DATA: "DADO ATRASADO",
  DADOS_INSUFICIENTES: "AGUARDANDO",
};
const CHART_INTEGRITY_QUALITY: Record<ChartIntegrityStatus, DataQualityLabel> = {
  SYNCED: "OK",
  STALE_DATA: "WARNING",
  SYMBOL_MISMATCH: "FAIL",
  DADOS_INSUFICIENTES: "DADOS_INSUFICIENTES",
};

// ADITIVO V-MAX Etapa 19 (Organism Health): mesmo padrão de par rótulo+cor
// das 2 constantes acima — nunca uma 3ª paleta, sempre a mesma
// DATA_QUALITY_COLOR de 4 estados.
const ORGANISM_HEALTH_LABEL: Record<OrganismHealthVerdict, string> = {
  OK: "SAUDÁVEL",
  WARN: "ATENÇÃO",
  CRITICAL: "CRÍTICO",
  AGUARDANDO: "AGUARDANDO",
};
const ORGANISM_HEALTH_QUALITY: Record<OrganismHealthVerdict, DataQualityLabel> = {
  OK: "OK",
  WARN: "WARNING",
  CRITICAL: "FAIL",
  AGUARDANDO: "DADOS_INSUFICIENTES",
};

function TelemetryHealthWidget() {
  const { engine, realCycle, cycleLatencyMs, fps, chartTimeframe, engineStatus, gmilProviders, selectedAsset } = useContext(WidgetContext) || {};
  // Ordem "Ciborgue Vivo" §3: mesmos sinais reais já lidos abaixo para as
  // Rows existentes, mais os que só o relatório precisa (offline/frescor/
  // conexões por exchange) — zero segunda medição, só uma segunda síntese
  // sob demanda (nunca recomputada a cada render, só ao clicar).
  const offline = useOfflineSnapshot();
  const isDataFresh = useDataFreshSnapshot();
  const health = useHealthSnapshot();
  const connections = useConnectionsSnapshot();
  const [diagnosticReport, setDiagnosticReport] = useState<ReturnType<typeof buildDiagnosticReport> | null>(null);

  const quality = realCycle?.dataQuality ?? null;
  const qualityLabel = quality
    ? `${quality.classification}${num(quality.weight) ? ` · peso ${(quality.weight * 100).toFixed(0)}%` : ""}`
    : AWAIT;
  // Nomeado (em vez de inline) para que Organism Health (Etapa 19) reuse a
  // MESMA classificação da Row abaixo — zero segunda medição divergente.
  const busQualityState = classifyBusQuality(quality?.classification ?? null);
  const qualityColor = DATA_QUALITY_COLOR[busQualityState];

  // ADITIVO V-MAX Etapa 10 (achado de auditoria): data-sufficiency.js já
  // computa um score real 0-100 de cobertura de campos EM TODO ciclo
  // (js/research/data-sufficiency.js via research-engine.js), mas antes
  // desta mudança só era usado internamente para rebaixar `confidence` —
  // nunca chegava à UI, então o Operador via a confiança rebaixada sem
  // conseguir ver POR QUÊ. Puro passthrough (engine-bridge.ts), nada
  // recomputado aqui.
  const sufficiency = realCycle?.dataSufficiency ?? null;
  const sufficiencyLabel = sufficiency ? `${sufficiency.score}/${sufficiency.max_score}` : AWAIT;
  const sufficiencyState = classifySufficiencyScore(sufficiency?.score ?? null, sufficiency?.max_score ?? 100);
  const sufficiencyColor = DATA_QUALITY_COLOR[sufficiencyState];

  // ADITIVO V-MAX Etapa 10 (achado de auditoria): GmilOrchestrator.getSnapshot()
  // já computa um weight 0-1 real por provedor (mesmo computeQuality de
  // gmil/quality-engine.ts que o consensus-engine usa para amortecer peso),
  // mas nenhum consumidor sintetizava isso numa leitura única de saúde do
  // GMIL — cada widget só lia providers individualmente. Média real do
  // weight sobre os provedores que já tentaram ao menos 1 fetch real
  // (lastReading !== null); provedor que ainda não rodou nem entra na
  // média (não é "ruim", é "ainda não medido" — mesmo princípio de
  // honestidade do resto da base). Mesmo padrão de agregação já usado por
  // DecisionValidationWidget (contributingGmil) — nenhuma segunda
  // assinatura de useGmilSnapshot(), só leitura do mesmo gmilProviders via
  // WidgetContext.
  const gmilList = gmilProviders ?? [];
  const gmilAttempted = gmilList.filter((p: any) => p?.lastReading != null);
  const gmilAvgWeight = gmilAttempted.length
    ? gmilAttempted.reduce((sum: number, p: any) => sum + p.weight, 0) / gmilAttempted.length
    : null;
  const gmilLabel = gmilAvgWeight !== null
    ? `${(gmilAvgWeight * 100).toFixed(0)}% · ${gmilAttempted.length}/${gmilList.length} fontes`
    : AWAIT;
  const gmilQualityState = classifyWeight(gmilAvgWeight);
  const gmilColor = DATA_QUALITY_COLOR[gmilQualityState];

  // ADITIVO V-MAX Etapa 17 (Chart Integrity Engine, achado de auditoria):
  // o `cancelled` do efeito que dispara runRealAnalysisCycle já evita a
  // pior forma de desync (ciclo velho sobrescrevendo a seleção nova), mas
  // nada tornava isso um invariante VISÍVEL/verificável — se um refactor
  // futuro quebrasse essa guarda, nenhum sinal avisaria o Operador. Puro
  // passthrough dos mesmos campos que já chegam via realCycle/WidgetContext.
  const chartIntegrity = computeChartIntegrity({
    selectedSymbol: selectedAsset ?? null,
    selectedTimeframe: chartTimeframe ?? null,
    cycleSymbol: realCycle?.symbol ?? null,
    cycleTimeframe: realCycle?.timeframe ?? null,
    candleAgeMs: realCycle?.candleAgeMs ?? null,
  });
  const chartIntegrityColor = DATA_QUALITY_COLOR[CHART_INTEGRITY_QUALITY[chartIntegrity.status]];

  const variant = wasmVariantLabel(realCycle?.wasmVariant ?? null);
  const fpsClass = classifyFps(fps);
  const fpsColor = fpsClass === "FLUIDO" ? "text-[#00ffaa]" : fpsClass === "ACEITAVEL" ? "text-[#f0d06f]" : fpsClass === "CRITICO" ? "text-[#ff0055]" : "text-[#8ab4f8]/50";
  const cycleClass = classifyCycleLatency(cycleLatencyMs);
  const cycleColor = cycleClass === "RAPIDO" ? "text-[#00ffaa]" : cycleClass === "OK" ? "text-[#f0d06f]" : cycleClass === "LENTO" ? "text-[#ff0055]" : "text-[#8ab4f8]/50";
  const memMB = typeof performance !== "undefined" ? memoryUsedMB(performance as any) : null;

  // ADITIVO V-MAX Etapa 19 (Organism Health, achado de auditoria): as 8
  // Rows abaixo já eram cada uma um sinal real de saúde, mas nenhuma
  // resumia isso num veredito único e SEMPRE VISÍVEL — o Operador só via
  // "tudo bem" ao ler linha por linha, ou clicando em GERAR RELATÓRIO DE
  // AUTODIAGNÓSTICO (self-diagnostics.ts, sob demanda). Puro reduce dos
  // MESMOS estados já nomeados acima — zero segunda medição.
  const organismHealth = computeOrganismHealth({
    offline,
    workersAlive: health.workersAlive,
    busQuality: busQualityState,
    sufficiencyQuality: sufficiencyState,
    gmilQuality: gmilQualityState,
    chartIntegrityQuality: CHART_INTEGRITY_QUALITY[chartIntegrity.status],
    fpsClass,
    cycleClass,
  });
  const organismHealthColor = DATA_QUALITY_COLOR[ORGANISM_HEALTH_QUALITY[organismHealth.verdict]];

  const Row = ({ label, value, valueClass }: { label: string; value: string; valueClass: string }) => (
    <div className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10">
      <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">{label}</span>
      <span className={`text-[0.5rem] font-mono font-black ${valueClass}`}>{value}</span>
    </div>
  );

  return (
    <Widget id="system_health" title="SYSTEM HEALTH" flex="flex-[0.8] min-h-[170px]">
      <div className="flex flex-col gap-1.5 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        {/* ADITIVO V-MAX Etapa 19 (Organism Health): veredito agregado
            SEMPRE VISÍVEL, primeira linha do painel de propósito — as
            Rows abaixo continuam existindo intactas para quem quer o
            detalhe por sinal; esta é só a leitura de 1 olhar. Sufixo com
            o sinal responsável só aparece quando o veredito não é OK
            (nunca verboso quando está tudo bem). */}
        <Row
          label="SAÚDE DO ORGANISMO"
          value={
            organismHealth.verdict === "OK"
              ? ORGANISM_HEALTH_LABEL[organismHealth.verdict]
              : `${ORGANISM_HEALTH_LABEL[organismHealth.verdict]} · ${organismHealth.worstSignal}`
          }
          valueClass={organismHealthColor}
        />
        <Row label="QUALIDADE DA FONTE (BUS)" value={qualityLabel} valueClass={qualityColor} />
        <Row label="SUFICIÊNCIA DE DADOS" value={sufficiencyLabel} valueClass={sufficiencyColor} />
        <Row label="QUALIDADE GMIL (CONTEXTO)" value={gmilLabel} valueClass={gmilColor} />
        <Row label="INTEGRIDADE DO GRÁFICO" value={CHART_INTEGRITY_LABEL[chartIntegrity.status]} valueClass={chartIntegrityColor} />
        <Row label="WASM ENGINE" value={variant ?? AWAIT} valueClass={variant === "SIMD128" ? "text-[#00ffaa]" : "text-[#8ab4f8]"} />
        <Row
          label={`LATÊNCIA DO CICLO (${chartTimeframe?.toUpperCase() ?? "15M"})`}
          value={num(cycleLatencyMs) ? `${cycleLatencyMs}ms${cycleClass ? ` · ${cycleClass}` : ""}` : AWAIT}
          valueClass={cycleColor}
        />
        <Row label="FPS (UI REAL)" value={num(fps) ? `${fps}${fpsClass ? ` · ${fpsClass}` : ""}` : AWAIT} valueClass={fpsColor} />
        <Row
          label="MEMÓRIA JS"
          value={memMB !== null ? `${memMB.toFixed(0)} MB` : "SEM_API (Safari não expõe)"}
          valueClass={memMB !== null ? "text-[#8ab4f8]" : "text-[#8ab4f8]/40"}
        />
        {/* Fase L (diretriz 3): selo de versão — confirmação FÍSICA de qual
            build está servido (inclusive do precache offline do service
            worker, cujo nome de cache deriva desta mesma constante).
            Aparece UMA vez em toda a UI (zero repetição). */}
        <Row label="BUILD" value={APP_SEAL} valueClass="text-[#00f0ff]" />
        {/* Ordem "Ciborgue Vivo" §3 ("gerar relatórios claros para nós"):
            síntese sob demanda dos MESMOS sinais reais já mostrados acima
            (mais offline/frescor/conexões por exchange) — nunca uma
            segunda medição, só um relatório legível quando o Operador
            pede. Autocorreção real já existe nas camadas de dado
            (reconexão de WS, fail-closed do Bus) — este botão só torna o
            estado real visível, não substitui nem duplica aquilo. */}
        <button
          type="button"
          onClick={() => {
            // ORDEM Nº 01: mesma visão versionada/read-only que os motores
            // reais já usam (getSnapshotForEngine, organism-orchestrator.ts)
            // — este botão é um OBSERVADOR externo (como o próprio stage-
            // runner.ts se descreve), nunca um motor, então lê sob demanda
            // em vez de assinar.
            const engineView = getSnapshotForEngine();
            // Ordem Fechamento (§3): MESMA fórmula já usada pelo painel
            // "EVIDENCE FUSION" do CouncilWidget (N campos com pelo menos 1
            // montador real / 10) — zero segunda medição, só lida daqui via
            // a visão versionada em vez de recomputar fuseEvidence.
            const evidenceFusion = engineView.snapshot.evidenceFusion;
            const evidenceFusionFieldCoverage = evidenceFusion
              ? Object.values(evidenceFusion.fieldCoverage).filter((v) => v > 0).length / 10
              : null;
            setDiagnosticReport(
              buildDiagnosticReport({
                offline,
                isDataFresh,
                health,
                engineStatus: engineStatus ?? "pending",
                engineReason: realCycle?.reason ?? null,
                dataQualityClassification: quality?.classification ?? null,
                connections,
                stageTrace: traceStages(engineView.snapshot, engineView.seq),
                evidenceFusionFieldCoverage,
              }),
            );
          }}
          className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#00f0ff30] hover:bg-[#00f0ff10] transition-colors text-left"
        >
          <span className="text-[0.45rem] text-[#00f0ff] font-bold tracking-wide">GERAR RELATÓRIO DE AUTODIAGNÓSTICO</span>
          <span className="text-[0.5rem] font-mono font-black text-[#00f0ff]">▶</span>
        </button>
        {diagnosticReport && (
          <div
            className={`flex flex-col gap-1 px-2 py-1.5 rounded border ${
              diagnosticReport.overallSeverity === "CRITICAL"
                ? "border-[#ff005550] bg-[#ff005508]"
                : diagnosticReport.overallSeverity === "WARN"
                  ? "border-[#f0d06f50] bg-[#f0d06f08]"
                  : "border-[#00ffaa50] bg-[#00ffaa08]"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">
                SEVERIDADE GERAL
              </span>
              <span
                className={`text-[0.5rem] font-mono font-black ${
                  diagnosticReport.overallSeverity === "CRITICAL"
                    ? "text-[#ff0055]"
                    : diagnosticReport.overallSeverity === "WARN"
                      ? "text-[#f0d06f]"
                      : "text-[#00ffaa]"
                }`}
              >
                {diagnosticReport.overallSeverity}
              </span>
            </div>
            <pre className="text-[0.42rem] text-[#8ab4f8]/80 leading-relaxed whitespace-pre-wrap font-mono max-h-[160px] overflow-y-auto scrollbar-hide">
              {formatDiagnosticReportMarkdown(diagnosticReport)}
            </pre>
          </div>
        )}
        {/* engine é lido só para o gate de visibilidade herdado do Widget —
            nenhuma leitura de mercado é exibida aqui (zero repetição). */}
        {engine ? null : null}
      </div>
    </Widget>
  );
}

// --- ASSET HEATMAP (V11 §14) ---
// Reuses scannerData as-is — the SAME 24h-ticker REST call every viewer of
// the Quant Scanner already relies on, fetched once every 30s in App(). No
// new API call, no new provider, no second source of truth for the same 5
// symbols.
function AssetHeatmapWidget() {
  const { scannerData } = useContext(WidgetContext) || {};
  const rows: any[] = Array.isArray(scannerData) ? scannerData : [];

  return (
    <Widget id="asset_heatmap" title="HEATMAP · ASSETS" flex="flex-[0.7] min-h-[150px]">
      <div className="grid grid-cols-5 gap-1 h-full min-h-0 items-stretch px-1 py-1 overflow-y-auto scrollbar-hide">
        {ASSETS.map((a) => {
          const row = rows.find((r) => r.p === `${a}/USDT`);
          const dir: string | null = row?.s ?? null;
          const chg: number | null = num(row?.chg) ? row.chg : null;
          const bg =
            dir === "LONG"
              ? "bg-[#00ffaa15] border-[#00ffaa40] text-[#00ffaa]"
              : dir === "SHORT"
                ? "bg-[#ff005515] border-[#ff005540] text-[#ff0055]"
                : "bg-[#8ab4f810] border-[#8ab4f830] text-[#8ab4f8]";
          return (
            <div
              key={a}
              className={`flex flex-col items-center justify-center gap-0.5 rounded border ${bg}`}
            >
              <span className="text-[0.45rem] font-black tracking-wider">{a}</span>
              <span className="text-[0.4rem] font-mono">{chg !== null ? fmtSignedPct(chg) : AWAIT}</span>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}

// --- DECISION VALIDATION (V11.1 LEI 24) ---
// IMPORTANTE: isto é um painel de CONFLUÊNCIA/TRANSPARÊNCIA, não um portão.
// A LEI 24 pede para "validar" liquidez/volatilidade/consenso/fluxo/
// estrutura/multi-timeframe/etc. "antes do Core Engine emitir LONG/SHORT" —
// mas implementar isso literalmente (suprimir ou adiar o sinal se alguma
// checagem falhar) violaria a restrição permanente e repetida em TODO
// protocolo desta sessão, incluindo a própria LEI 27 deste protocolo:
// "O Core Engine permanece absolutamente preservado" e "nenhuma fonte pode
// alterar a decisão do Core Engine". A leitura que reconcilia as duas coisas
// sem contradição: este painel mostra, para o sinal que o Core Engine JÁ
// emitiu, quais das dimensões reais estão disponíveis agora — puro contexto
// exibido, nunca um gatilho. O operador vê a confluência; a decisão em si
// nunca é atrasada, escondida ou alterada por esta camada.
//
// Cada linha reflete DISPONIBILIDADE de um dado real já computado em outro
// lugar desta sessão (engine useMemo / institutionalConsensus / GMIL) — zero
// fetch novo, zero cálculo duplicado. Achado de auditoria (Ferramentas
// Institucionais): "Consenso entre corretoras" estava hardcoded como
// NÃO_APLICÁVEL com um comentário desatualizado ("só uma fonte real de
// preço") — o app já tem 3 checagens cross-exchange reais (Bybit/OKX/MEXC
// vs. Binance) alimentando trustScore.crossExchangeConvergence, já exibido
// em 2 outros widgets (Decision Context, TRUST SCORE do Council). Corrigido
// para ler o mesmo valor real via useTrustScoreSnapshot(), zero cálculo
// novo. "Integridade dos dados" não vira uma
// linha aqui de propósito — já é o campo "Data Feeds n/4" do painel Decision
// Context (aba ANALYSIS, relocado da antiga barra operacional); repetir o
// mesmo cálculo aqui seria a exata duplicação que a LEI 25 (Self Audit) pede
// para eliminar, não para criar.
// Idade legível de um timestamp real — chamada por GmilContextWidget (idade
// de cada provedor) e aqui (idade de preço/livro/ciclo/HTF/GMIL), em vez de
// cada widget reimplementar a mesma conta (achado da auditoria de
// Sincronização Global: antes disso, GmilContextWidget tinha sua própria
// cópia inline idêntica em vez de chamar esta função, apesar do comentário
// já dizer que reaproveitava — LEI 25).
function ageLabelOf(updatedAt: number | null): string {
  if (updatedAt === null) return AWAIT;
  const ageSec = Math.round((Date.now() - updatedAt) / 1000);
  return ageSec < 60 ? `${ageSec}s` : `${Math.round(ageSec / 60)}min`;
}

// Rótulo do Consensus Score (-1..1 -> string com sinal, ex.: "+42"/"-17") —
// chamado pelo painel Decision Context (aba ANALYSIS) e por GmilContextWidget,
// que antes calculavam o mesmo formato duas vezes a partir do mesmo
// institutionalConsensus.score (mesmo achado de duplicação da auditoria de
// Sincronização Global).
function formatConsensusScore(score: number | null): string {
  if (score === null) return AWAIT;
  // Achado real de auditoria: score>=0 ? "+" : "" combinado com
  // .toFixed(0) produzia o literal "-0" pra qualquer score real pequeno e
  // negativo (ex.: -0.001) — o sinal era decidido ANTES do arredondamento.
  // Arredondar primeiro e decidir o sinal do valor JÁ arredondado (mesmo
  // padrão Math.round(x*100) do resto do arquivo) elimina o "-0" por
  // construção: JS nunca serializa -0 como "-0" via interpolação de
  // template literal (só .toFixed/.toString(radix) fazem isso).
  const rounded = Math.round(score * 100);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function DecisionValidationWidget() {
  const { engine, institutionalConsensus, ensembleConsensus, convictionReading: convictionReadingFromContext, riskSuggestion, gmilProviders, priceUpdatedAt, orderBookUpdatedAt, lastUpdateAt, chartTimeframe } =
    useContext(WidgetContext) || {};
  // Achado de auditoria: mesmo hook já usado por 2 outros widgets
  // (Decision Context, TRUST SCORE do Council) — trustScore.crossExchangeConvergence
  // é o dado real que faltava aqui para a linha "Consenso Entre Corretoras"
  // deixar de ser um NÃO_APLICÁVEL hardcoded.
  const trustScore = useTrustScoreSnapshot();

  // Ponta Solta 1 (Auditoria do Ecossistema, 2ª passada) — ordem do Operador
  // "habilitar tudo, principalmente das corretoras, das fontes de dados todas".
  //
  // A fatia `orderBooks` da store era WRITE-ONLY: 3 escritores reais gravavam
  // o livro L2 de cada corretora a cada tick (App.tsx:3395,
  // cross-exchange-service.ts BINANCE e MEXC) e o único leitor exposto
  // (`useExchangeOrderBooks`) NUNCA era importado. O livro de 3 praças era
  // capturado e descartado — feature construída até a metade, sendo que a
  // captura é justamente a parte cara (rede, parsing, memória).
  //
  // Esta é a leitura que faltava. `crossExchangeConvergence` (linha abaixo)
  // compara PREÇO DE MARCA entre corretoras; esta compara o LIVRO real —
  // melhor bid/ask de cada praça, spread consolidado cruzando praças (negativo
  // = desalinhamento real) e desvio contra a mediana. São perguntas
  // diferentes sobre o mesmo tema, não duplicação.
  //
  // LEI 24: display only, contexto de execução — nunca vira decisão.
  const { reversalAlert } = useContext(WidgetContext) || {};
  // Cor pela GRAVIDADE real: reversão CONTRA o sinal vigente é o caso que o
  // Operador precisa ver na hora; a favor é confirmação; sem leitura é cinza.
  const reversalColor =
    reversalAlert?.status !== "OK"
      ? "text-[#8ab4f8]/50"
      : reversalAlert.contradictsCore === true
        ? "text-[#f23645]"
        : "text-[#089981]";

  const exchangeBooks = useExchangeOrderBooks();
  const crossBook = useMemo(
    () => computeCrossExchangeBook(exchangeBooks, Date.now()),
    [exchangeBooks],
  );
  const crossBookLabel = describeCrossExchangeBook(crossBook);
  // Cor segue o que o dado REALMENTE diz, nunca um verde otimista:
  // praças desalinhadas (spread consolidado negativo) é um achado que merece
  // destaque de atenção, não a mesma cor de "tudo normal".
  const crossBookColor =
    crossBook.status !== "OK"
      ? "text-[#8ab4f8]/50"
      : (crossBook.consolidatedSpread ?? 0) < 0
        ? "text-[#f0d06f]"
        : "text-[#00ffaa]";

  // Fase H: sugestão de dimensionamento (% equity / % risco). Fail-closed:
  // SEM_SUGESTAO exibe 0% com o motivo real. O selo é PERMANENTE e
  // incondicional (diretriz 3 da ordem de ignição).
  const riskOk = riskSuggestion?.status === "OK";
  const riskLabel = riskOk
    ? `${riskSuggestion.suggested_position_pct.toFixed(1)}% eq · risk ${riskSuggestion.effective_risk_pct.toFixed(2)}%`
    : "0% · sem sugestão";
  const riskColor = riskOk ? "text-[#00f0ff]" : "text-[#8ab4f8]/50";

  // Phase Ω Priority 2: Motor de Confluência Cruzada — quantos dos 3
  // subsistemas independentes (Ensemble/Council/Multi-Timeframe) concordam
  // com a direção real que o Core Engine JÁ emitiu. Read-only por
  // construção (LEI 24): nunca lido de volta por engine.direction.
  // Levantada para App() (ver contextValue) porque a Neural Market Aura
  // (ChartWidget) agora consome a MESMA leitura real — zero segundo
  // cálculo a partir dos mesmos insumos.
  const convictionReading = convictionReadingFromContext ?? buildConvictionReading({
    coreDirection: null, ensembleConsensus: null, council: null, multiTimeframe: null, trustScore: null,
  });
  const convictionColor =
    convictionReading.status !== "OK"
      ? "text-[#8ab4f8]/50"
      : convictionReading.verdict === "CONFIRMS"
        ? "text-[#00ffaa]"
        : convictionReading.verdict === "CONTRADICTS"
          ? "text-[#ff0055]"
          : "text-[#f0d06f]";
  const convictionLabel =
    convictionReading.status !== "OK"
      ? (convictionReading.reason === "core_engine_sem_direcao_ativa_no_momento_(WAIT)" ? "SEM DIREÇÃO ATIVA (WAIT)" : AWAIT)
      : `${convictionReading.verdict} · ${convictionReading.agreeingCount}/${convictionReading.totalReadable} · força ${(convictionReading.conviction! * 100).toFixed(0)}%${
          num(convictionReading.convictionAdjusted) ? ` (aj. ${(convictionReading.convictionAdjusted! * 100).toFixed(0)}%)` : ""
        }`;

  // Fase F: Comitê de Validação (linear opinion pool, src/consensus/).
  // Direção + força do comitê das lógicas SECUNDÁRIAS — rótulo deixa
  // explícito que é o comitê, nunca o sinal do Core Engine.
  const ensembleOk = ensembleConsensus?.status === "OK";
  const ensembleLabel = ensembleOk
    ? `${ensembleConsensus.direcao} · força ${(ensembleConsensus.forca * 100).toFixed(0)}%${
        num(ensembleConsensus.forca_ajustada) ? ` (aj. ${(ensembleConsensus.forca_ajustada * 100).toFixed(0)}%)` : ""
      }`
    : AWAIT;
  const ensembleColor = !ensembleOk
    ? "text-[#8ab4f8]/50"
    : ensembleConsensus.direcao === "ALTA"
      ? "text-[#00ffaa]"
      : ensembleConsensus.direcao === "BAIXA"
        ? "text-[#ff0055]"
        : "text-[#8ab4f8]";

  const checks: { label: string; available: boolean | null }[] = [
    { label: "Liquidez (Livro de Ofertas)", available: !!engine?.hasBook },
    { label: "Volatilidade (ATR%)", available: num(engine?.marketRegime?.atrPercent) },
    { label: "Contexto Global (Consenso)", available: num(institutionalConsensus?.score) },
    { label: "Consenso Entre Corretoras", available: num(trustScore?.crossExchangeConvergence) },
    { label: "Fluxo Institucional (OFI)", available: num(engine?.flowImbalance) },
    { label: "Structural Target Strength", available: !!engine?.target2Strength },
    { label: "Estrutura de Mercado", available: !!engine?.marketStructureLabel },
    { label: `Multi-Timeframe (${chartTimeframe?.toUpperCase() ?? "15M"}/${engine?.htfTimeframe?.toUpperCase() ?? "1H"})`, available: !!engine?.timeframeConfluence },
    {
      label: "Qualidade das Fontes (GMIL)",
      available: Array.isArray(gmilProviders) && gmilProviders.some((p: any) => p.weight > 0),
    },
    { label: "Confidence Score (Core Engine)", available: !!engine?.confidence },
  ];
  const availableCount = checks.filter((c) => c.available === true).length;
  const applicableCount = checks.filter((c) => c.available !== null).length;

  // V11.1 LEI 22 (Temporal Synchronization): idade real de cada fonte, não
  // um clock único fingido — cada uma tem sua própria cadência (WS ~1s,
  // livro ~1s throttled, ciclo do motor 15m a cada 30s). Telemetria honesta,
  // nunca um valor inventado quando a fonte ainda não respondeu.
  // Protocolo Mestre (achado de auditoria de sincronização): HTF e GMIL/
  // Consenso eram as 2 fontes reais SEM telemetria de idade aqui — o
  // "Ciclo do Motor" cobria o sinal de 15m, mas a estrutura de 1H (cache
  // próprio, HTF_REFRESH_MS=5min) e o consenso GMIL (3 provedores, cadência
  // 90-180s cada) podiam estar mais velhos do que o operador percebia.
  // GMIL usa o provedor CONTRIBUINTE mais velho (weight>0), não uma média —
  // o consenso só é tão fresco quanto sua fonte mais atrasada.
  const contributingGmil = (gmilProviders ?? []).filter(
    (p: any) => p.weight > 0 && num(p.lastSuccessAt),
  );
  const gmilOldestSuccessAt = contributingGmil.length
    ? Math.min(...contributingGmil.map((p: any) => p.lastSuccessAt))
    : null;

  const syncRows: { label: string; ageLabel: string }[] = [
    { label: "Preço (WS)", ageLabel: ageLabelOf(priceUpdatedAt) },
    { label: "Livro de Ofertas", ageLabel: ageLabelOf(orderBookUpdatedAt) },
    { label: `Ciclo do Motor (${chartTimeframe?.toUpperCase() ?? "15M"})`, ageLabel: ageLabelOf(lastUpdateAt) },
    { label: `Estrutura ${engine?.htfTimeframe?.toUpperCase() ?? "1H"}`, ageLabel: ageLabelOf(engine?.htfUpdatedAt ?? null) },
    { label: "Contexto Global (GMIL)", ageLabel: ageLabelOf(gmilOldestSuccessAt) },
  ];

  return (
    <Widget id="decision_validation" title="VALIDAÇÃO MULTI-CAMADA" flex="flex-[1.3] min-h-[280px]">
      <div className="flex flex-col gap-1 px-1 py-1 h-full min-h-0 overflow-y-auto scrollbar-hide">
        <div className="flex justify-between items-center bg-[#010308] px-2 py-1.5 rounded border border-[#00f0ff20] shrink-0">
          <span className="text-[0.45rem] text-[#8ab4f8]/80 font-bold tracking-widest">
            CONFLUÊNCIA · CONTEXTO DO SINAL ATUAL
          </span>
          <span className="text-[0.55rem] font-mono font-black text-[#00f0ff]">
            {availableCount}/{applicableCount}
          </span>
        </div>
        {/* Fase F: leitura agregada do comitê (n = membros com leitura real
            nesta janela). Consultivo — nunca o sinal do Core Engine. */}
        <div className="flex justify-between items-center bg-[#010308] px-2 py-1.5 rounded border border-[#00f0ff20] shrink-0">
          <span className="text-[0.45rem] accent-consensus font-bold tracking-widest">
            COMITÊ (ENSEMBLE) · CONSULTIVO
            {ensembleOk && (
              <span className="text-[#8ab4f8]/40"> n={ensembleConsensus.membros.length}</span>
            )}
          </span>
          <span className={`text-[0.55rem] font-mono font-black ${ensembleColor}`}>{ensembleLabel}</span>
        </div>
        {/* Phase Ω Priority 2: Motor de Confluência Cruzada — quantos dos 3
            subsistemas independentes (Ensemble/Council/Multi-Timeframe)
            concordam com a direção que o Core Engine JÁ emitiu. Nunca uma
            probabilidade calibrada (mesma honestidade do Comitê acima) —
            "força" é massa real de opinião ALINHADA, não chance de acerto. */}
        <div
          className="flex justify-between items-center bg-[#010308] px-2 py-1.5 rounded border border-[#00f0ff20] shrink-0"
          title="Motor de Confluência Cruzada: concordância real entre Ensemble, Comitê e Matriz Multi-Timeframe com a direção já emitida pelo Core Engine. Nunca probabilidade de acerto de mercado."
        >
          {/* Lapidação Visual (DIRETRIZ 7 — consistência): este rótulo usava
              o hex solto #c07dff, um quase-duplicado feito à mão do
              .accent-consensus (#c86bff) que o index.css já define e
              documenta como "púrpura marca a leitura do Comitê/GMIL (opinião
              agregada)" — exatamente o que "confluência cruzada entre 3
              subsistemas" É. Passa a usar a classe nomeada: zero cor nova,
              mesma semântica declarada dos irmãos accent-risk/accent-consensus
              deste mesmo cartão. */}
          <span className="text-[0.45rem] accent-consensus font-bold tracking-widest">
            CONFLUÊNCIA CRUZADA · 3 SUBSISTEMAS
          </span>
          <span className={`text-[0.55rem] font-mono font-black ${convictionColor}`}>{convictionLabel}</span>
        </div>
        {/* Fase H: Risk Engine — % do equity e % de risco (nunca valor
            monetário). O selo abaixo é OBRIGATÓRIO e permanente (ordem de
            ignição da Fase H, diretriz 3) — presente mesmo em 0%. */}
        <div className="flex flex-col gap-0.5 bg-[#010308] px-2 py-1.5 rounded border border-[#00f0ff20] shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-[0.45rem] accent-risk font-bold tracking-widest">TAMANHO SUGERIDO (RISK ENGINE)</span>
            <span className={`text-[0.55rem] font-mono font-black ${riskColor}`}>{riskLabel}</span>
          </div>
          <span className="text-[0.4rem] text-[#f0d06f]/80 font-bold tracking-widest">
            SUGESTÃO ALGORÍTMICA · NÃO É CONSELHO FINANCEIRO
          </span>
        </div>
        {/* Ponta Solta 1: leitura real do LIVRO entre praças. Card próprio
            (mesmo padrão dos irmãos ricos acima: Comitê, Confluência Cruzada,
            Risk Engine) em vez de uma linha binária ✓/aguardando — a
            informação que importa aqui é ONDE está o melhor preço e se as
            praças estão alinhadas, nunca só "existe livro". Fora da contagem
            de confluência de propósito: contexto de execução, não uma
            camada de opinião sobre a direção (LEI 24). */}
        <div
          className="flex flex-col gap-0.5 bg-[#010308] px-2 py-1.5 rounded border border-[#00f0ff20] shrink-0"
          title="Compara o livro L2 real já capturado de cada corretora: melhor bid e melhor ask ATRAVÉS das praças, spread consolidado (negativo = praças desalinhadas) e desvio contra a mediana dos meio-preços. Contexto de execução para o Operador — nunca uma decisão de trading."
        >
          <span className="text-[0.45rem] text-[#8ab4f8]/80 font-bold tracking-widest">
            LIVRO ENTRE PRAÇAS · EXECUÇÃO
          </span>
          <span className={`text-[0.5rem] font-mono font-black ${crossBookColor} break-words`}>
            {crossBookLabel}
          </span>
        </div>
        {/* ORDEM DO OPERADOR ("não deixa nada no laboratório"): Detector de
            Reversão graduado — como ALERTA, nunca como decisão. Não existe
            percentual medido para ele (a medição real nunca rodou, ver
            tools/measure-reversal-lead.mjs), e alertar não precisa de
            percentual: só informa que a estrutura virou. LEI 24 intacta —
            o Núcleo continua decidindo sozinho, do mesmo jeito. */}
        <div
          className="flex flex-col gap-0.5 bg-[#010308] px-2 py-1.5 rounded border border-[#00f0ff20] shrink-0"
          title="Reversão estrutural real (CHoCH — primeiro rompimento CONTRA a estrutura vigente; BOS/continuação nunca conta aqui). É AVISO, não decisão: o Core Engine continua sendo o único emissor de LONG/SHORT/WAIT (LEI 24). Nunca é probabilidade de acerto."
        >
          <span className="text-[0.45rem] text-[#8ab4f8]/80 font-bold tracking-widest">
            REVERSÃO ESTRUTURAL · AVISO
          </span>
          <span className={`text-[0.5rem] font-mono font-black ${reversalColor} break-words`}>
            {reversalAlert ? describeReversalReading(reversalAlert) : AWAIT}
          </span>
        </div>
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
          >
            <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">{c.label}</span>
            <span
              className={`text-[0.5rem] font-mono font-black ${
                c.available === null
                  ? "text-[#8ab4f8]/40"
                  : c.available
                    ? "text-[#00ffaa]"
                    : "text-[#f0d06f]"
              }`}
            >
              {c.available === null ? "NÃO_APLICÁVEL" : c.available ? "✓ REAL" : AWAIT}
            </span>
          </div>
        ))}

        <div className="h-px bg-[#8ab4f8]/10 shrink-0 my-0.5" />
        <span className="text-[0.4rem] text-[#8ab4f8]/50 font-bold tracking-widest shrink-0 px-0.5">
          SINCRONIZAÇÃO · IDADE DAS FONTES
        </span>
        {syncRows.map((r) => (
          <div
            key={r.label}
            className="flex justify-between items-center bg-[#010308] px-2 py-1 rounded border border-[#8ab4f8]/10"
          >
            <span className="text-[0.45rem] text-[#8ab4f8]/70 font-bold tracking-wide">{r.label}</span>
            <span className="text-[0.5rem] font-mono font-black text-[#8ab4f8]">{r.ageLabel}</span>
          </div>
        ))}
      </div>
    </Widget>
  );
}

// --- NEURAL CORE (local Llama 3 via WebLLM/WebGPU) ---
// Entirely opt-in and isolated: nothing in this widget runs until the user
// explicitly taps ATIVAR. Before that, zero network requests, zero WebGPU
// usage, zero effect on the rest of the app's instant boot. The model
// itself and @mlc-ai/web-llm's runtime are loaded via a lazy import()
// inside handleActivate — see the comment on the App.tsx import block
// above for why a static import would have defeated this entirely.
type NeuralCoreStatus = "idle" | "loading" | "ready" | "generating" | "error";

function NeuralCoreWidget() {
  const { engine, realCycle, smcZones, cvd, orderflowSignals } = useContext(WidgetContext) || {};
  const [status, setStatus] = useState<NeuralCoreStatus>("idle");
  const [loadProgress, setLoadProgress] = useState<{
    progress: number;
    text: string;
    modelId: string;
    tier: number;
    tierCount: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reading, setReading] = useState<string>("");
  // V11.5 Fase 7: qual dos 3 níveis reais (8B/3B/1B) efetivamente carregou —
  // a orquestração em llm-bridge.ts pode ter caído para um nível mais leve
  // se o primeiro falhou (ex.: teto de memória do iPad), e a UI mostra qual
  // foi de verdade, nunca assume o nível pedido original.
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const engineRef = useRef<MLCEngineInterface | null>(null);
  // Auditoria Mestra 360° (secao 6): referencia crua do Worker por tras do
  // engine — engine.unload() libera o modelo/pesos mas nao encerra a thread
  // do Worker (nao documentado como fazendo isso), entao ela precisa ser
  // finalizada separadamente ao desmontar o widget.
  const workerRef = useRef<Worker | null>(null);

  // Trivial, import-free feature check — deciding whether to even OFFER
  // the option must not itself trigger loading the WebLLM bundle.
  const gpuSupported = typeof navigator !== "undefined" && "gpu" in (navigator as any);

  // Built once, shared by the LLM path (handleGenerate) and the synthetic
  // fallback below — both read the exact same real fields, so the two
  // readings can never disagree about what the underlying data actually is.
  //
  // Auditoria Mestra 360° (secao 3): renomeado de wasmSignal/wasmConfidence
  // para heuristicSignal/heuristicConfidence — engine.direction/confidence
  // vem da heuristica de tendencia SMA/EMA em research-engine.js (via
  // trade-setup-matrix.js), NAO do WASM. O WASM (cyborg_quant_core.wasm)
  // so' calcula SMA/EMA/stddev/zscore em analysis-frame.js; nunca produz
  // LONG/SHORT/WAIT diretamente. O rotulo antigo implicava uma origem
  // errada, mesmo sendo funcionalmente inofensivo.
  const tacticalInput = useMemo<TacticalContextInput>(
    () => ({
      heuristicSignal: engine?.direction ?? null,
      heuristicConfidence: engine?.confidence ?? null,
      marketStructure: engine?.marketStructure ?? null,
      support: engine?.support ?? null,
      resistance: engine?.resistance ?? null,
      lorentzianClassification: realCycle?.lorentzian?.ok ? realCycle.lorentzian.classification ?? null : null,
      lorentzianConfidencePct: lorentzianConfidencePct(realCycle?.lorentzian),
      lorentzianSampleSize: realCycle?.lorentzian?.ok ? realCycle.lorentzian.sampleSize ?? null : null,
      unmitigatedFvgCount: (smcZones?.fairValueGaps ?? []).filter((z: PriceZone) => !z.mitigated).length,
      unmitigatedOrderBlockCount: (smcZones?.orderBlocks ?? []).filter((z: PriceZone) => !z.mitigated).length,
      unsweptLiquidityZoneCount: (smcZones?.liquidityZones ?? []).filter((z: LiquidityZone) => !z.swept).length,
      cvd: cvd ?? null,
      recentOrderflowSignalTypes: (orderflowSignals ?? []).slice(0, 5).map((s: OrderflowSignal) => s.type),
    }),
    [engine, realCycle, smcZones, cvd, orderflowSignals],
  );

  // Always on, zero cost, zero download — a rule-based reading of the same
  // real signals, available the instant data exists regardless of whether
  // the (optional, ~5GB) LLM has ever been activated.
  const syntheticReading = useMemo(() => buildSyntheticReading(tacticalInput), [tacticalInput]);

  // Encerra o par engine+worker atual, se houver. Chamado ao desmontar o
  // widget (efeito abaixo) — o unload() é best-effort porque o que garante
  // liberar a thread é o terminate() do Worker, não a promessa do engine.
  const teardownEngine = () => {
    engineRef.current?.unload().catch(() => {});
    workerRef.current?.terminate();
    engineRef.current = null;
    workerRef.current = null;
  };

  useEffect(() => {
    return () => teardownEngine();
  }, []);

  const handleActivate = async () => {
    if (!gpuSupported) {
      setStatus("error");
      setErrorMsg("WebGPU indisponível neste navegador — núcleo neural requer WebGPU.");
      return;
    }
    setStatus("loading");
    setErrorMsg(null);
    try {
      const { createLocalLlmEngine } = await import("./llm-bridge");
      const result = await createLocalLlmEngine((report) => setLoadProgress(report));
      if (!result.ok) {
        setStatus("error");
        setErrorMsg(result.reason);
        return;
      }
      engineRef.current = result.engine;
      workerRef.current = result.worker;
      setActiveModelId(result.modelId);
      setStatus("ready");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(`falha_inesperada: ${err?.message || err}`);
    }
  };

  const handleGenerate = async () => {
    if (!engineRef.current) return;
    setStatus("generating");
    setReading("");
    setErrorMsg(null);
    try {
      const { buildTacticalContext, streamTacticalReading } = await import("./llm-bridge");
      const context = buildTacticalContext(tacticalInput);
      const result = await streamTacticalReading(engineRef.current, context, (textSoFar) => setReading(textSoFar));
      if (!result.ok) {
        setErrorMsg(result.reason);
      }
      setStatus("ready");
    } catch (err: any) {
      setStatus("ready");
      setErrorMsg(`falha_inesperada: ${err?.message || err}`);
    }
  };

  return (
    <Widget id="neural_core" title="NÚCLEO NEURAL · LLAMA 3 (LOCAL) + SÍNTESE" flex="flex-[1.1] min-h-[160px]">
      <div className="flex flex-col h-full gap-2 p-1 text-[0.5rem]">
        <span className="text-[0.45rem] text-[#8ab4f8]/50 leading-relaxed">
          Leitura sintética abaixo é cálculo determinístico, sempre ativa, sem download. LLM
          local opcional (WebGPU, {" "}navegador — nenhum dado sai deste dispositivo) adiciona
          síntese em linguagem natural; modelo grande (~5GB) baixado só quando ativado.
        </span>

        <div className="flex flex-col gap-1 shrink-0">
          <span className="text-[0.45rem] font-bold tracking-[0.15em] text-[#8ab4f8] uppercase">
            Leitura Sintética · cálculo, sem IA
          </span>
          <div className="bg-[#010308] border border-[#8ab4f8]/15 rounded p-2 text-[#a0f0ff] leading-relaxed">
            {syntheticReading}
          </div>
        </div>

        <div className="h-px bg-[#8ab4f8]/10 shrink-0" />

        <span className="text-[0.45rem] font-bold tracking-[0.15em] text-[#00f0ff]/70 uppercase shrink-0">
          Leitura por IA generativa (opcional)
        </span>

        {status === "idle" && (
          <button
            type="button"
            onClick={handleActivate}
            disabled={!gpuSupported}
            className={`mt-1 py-2 rounded-lg border font-black tracking-[0.15em] text-[0.55rem] uppercase transition-colors ${gpuSupported ? "border-[#00f0ff60] bg-[#00f0ff15] text-[#00f0ff] active:bg-[#00f0ff25]" : "border-[#8ab4f8]/15 text-[#8ab4f8]/30 cursor-not-allowed"}`}
          >
            {gpuSupported ? "ACTIVATE NEURAL CORE" : "WEBGPU INDISPONÍVEL"}
          </button>
        )}

        {status === "loading" && (
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-[0.45rem] tracking-[0.15em] text-[#f0d06f] font-bold uppercase animate-pulse">
              Injetando pesos da Meta…
              {loadProgress && ` (nível ${loadProgress.tier}/${loadProgress.tierCount})`}
            </span>
            <div className="w-full h-1.5 bg-[#010308] border border-[#f0d06f]/30 rounded overflow-hidden">
              <div
                className="h-full bg-[#f0d06f] transition-all duration-300"
                style={{ width: `${Math.round((loadProgress?.progress ?? 0) * 100)}%` }}
              />
            </div>
            <span className="text-[0.45rem] text-[#8ab4f8]/50 truncate">
              {loadProgress?.modelId ?? "…"} {loadProgress?.text ? `· ${loadProgress.text}` : ""}
            </span>
            {/* V11.5 Fase 7: se o nível 1 (8B) já falhou nesta ativação e a
                orquestração está tentando um nível mais leve, isso fica
                visível aqui — nunca um retry silencioso do mesmo modelo. */}
            {loadProgress && loadProgress.tier > 1 && (
              <span className="text-[0.42rem] text-[#f0d06f]/70 uppercase tracking-[0.1em]">
                Nível anterior indisponível neste dispositivo — tentando modelo mais leve.
              </span>
            )}
          </div>
        )}

        {(status === "ready" || status === "generating") && (
          <>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={status === "generating"}
              className="mt-1 py-1.5 rounded-lg border border-[#00ffaa60] bg-[#00ffaa15] text-[#00ffaa] active:bg-[#00ffaa25] font-black tracking-[0.15em] text-[0.5rem] uppercase disabled:opacity-50"
            >
              {status === "generating" ? "GERANDO…" : "GENERATE TACTICAL READ"}
            </button>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide bg-[#010308] border border-[#00f0ff15] rounded p-2 text-[#a0f0ff] leading-relaxed">
              {reading || (
                <span className="text-[#8ab4f8]/40 uppercase tracking-[0.2em]">
                  {status === "generating" ? "GERANDO…" : `${AWAIT} — TOQUE EM GENERATE TACTICAL READ`}
                </span>
              )}
            </div>
            <span className="text-[0.42rem] text-[#8ab4f8]/40 uppercase tracking-[0.15em]">
              {activeModelId ?? "Llama (local)"} · leitura analítica, não é ordem — decisão sempre
              humana.
            </span>
          </>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-[0.45rem] tracking-[0.15em] text-[#ff0055] font-bold uppercase">
              {errorMsg || "FALHA DESCONHECIDA"}
            </span>
            <span className="text-[0.42rem] text-[#8ab4f8]/50 leading-relaxed">
              A leitura sintética acima continua funcionando normalmente — só a síntese por IA
              generativa não carregou neste navegador.
            </span>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="py-1.5 rounded-lg border border-[#8ab4f8]/30 text-[#8ab4f8] text-[0.5rem] font-bold uppercase tracking-[0.15em]"
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        )}
      </div>
    </Widget>
  );
}

// --- BOTTOM PANELS ---
// EFIP prune: this strip once held five panels; four were permanently-empty
// boxes (gauges hardwired to null, a "stream" with no possible source, an
// execution log for an app that will never execute, a playback relic from
// the pre-React runtime). Only the real liquidation feed earned its place.
function BottomPanels() {
  const { widgets, liquidations, liquidationState } = useContext(WidgetContext) || {};
  // Without this guard, the 95px bar and its edge-fade overlays below still
  // render even when the widget inside returns null — an empty dark strip
  // floating with nothing under it. Not visible by default.
  if (!widgets?.tactical?.visible) return null;

  return (
    <div className="relative shrink-0 w-full mb-1">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#010205] to-transparent z-20 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#010205] to-transparent z-20 pointer-events-none"></div>

      <div className="h-[95px] flex gap-2 w-full pb-1 overflow-x-auto overflow-y-hidden scrollbar-hide snap-x pt-1 px-4">
        <Widget id="tactical" title="INSTITUTIONAL LIQUIDATIONS · REAL" className="min-w-[320px] snap-start" flex="flex-[1.8]" extraHeader={<Activity size={12} className="text-[#ff005560]" />}>
          {liquidations && liquidations.length > 0 ? (
            <div className="flex flex-col justify-center h-full gap-1 px-1">
              {liquidations.slice(0, 2).map((liq: LiquidationEvent, i: number) => {
                const isLongLiq = liq.side === "LONG_LIQUIDATED";
                const color = isLongLiq ? "text-[#ff0055]" : "text-[#00ffaa]";
                return (
                  <div key={`${liq.timestamp}-${i}`} className="flex justify-between items-center text-[0.45rem] gap-2">
                    <span className={`font-bold tracking-wider whitespace-nowrap ${color}`}>
                      {isLongLiq ? "LONG LIQUIDADA" : "SHORT LIQUIDADA"}
                    </span>
                    <span className="text-[#a0f0ff]/80 font-mono">{liq.symbol}</span>
                    <span className="text-[#8ab4f8]/70 font-mono whitespace-nowrap">
                      ${(liq.notionalUsd / 1000).toFixed(0)}k
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[0.55rem] tracking-[0.3em] text-[#8ab4f8]/40 font-bold text-center px-2">
              {liquidationState === "ERROR" ? "FEED UNAVAILABLE" : `${AWAIT} LIQUIDAÇÃO REAL…`}
            </div>
          )}
        </Widget>

      </div>
    </div>
  );
}

// --- FOOTER BAR ---
// Owns its own clock tick locally so the 1s interval never re-renders the
// rest of the tree (App/TopBar/all Widgets) — only this 24px bar updates.
function FooterBar() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Base da tela no mesmo padrão luminoso do topo (protocolo §3): borda,
  // texto e indicadores subiram de intensidade + um glow sutil para cima,
  // espelhando a sombra que a barra de comando projeta para baixo.
  return (
    <div className="h-[24px] border-t border-[#00f0ff35] shadow-[0_-2px_14px_rgba(0,240,255,0.08)] flex items-center justify-between px-3 bg-[#010308] shrink-0 text-[0.45rem] tracking-[0.2em] text-[#8ab4f8]/80 font-bold uppercase">
      <div className="flex gap-3">
        <span className="text-[#00f0ff] drop-shadow-[0_0_5px_#00f0ff]">AR10 CYBORG</span>
        <span className="hidden md:inline">|</span>
        <span className="hidden md:inline">TERMINAL READ-ONLY</span>
        <span className="hidden lg:inline">|</span>
        {/* Auditoria do painel do gráfico: o logo de atribuição PADRÃO da
            lightweight-charts (canto do próprio canvas, "powered by
            TradingView") foi desligado abaixo (attributionLogo: false) por
            destoar do terminal proprietário AR10 CYBORG — mas a licença
            Apache-2.0 da biblioteca exige manter um link real para
            tradingview.com em algum lugar visível ao usuário quando esse
            logo é desligado (texto real da própria lib, ver typings.d.ts).
            Este link relocaliza essa obrigação real para a barra de rodapé
            — nunca a remove (Regra de Ouro 4: realocar, nunca apagar). */}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          title="Biblioteca de gráfico: TradingView Lightweight Charts™"
          className="hidden lg:inline text-[#8ab4f8]/45 hover:text-[#8ab4f8]/80"
        >
          TRADINGVIEW
        </a>
      </div>

      <div className="flex gap-2 hidden lg:flex items-center text-[#8ab4f8]/60">
        <span>DADOS REAIS</span>{" "}
        <div className="w-1 h-1 rounded-full bg-[#00f0ff]/70 shadow-[0_0_4px_rgba(0,240,255,0.6)]"></div>
        <span>FAIL-CLOSED</span>{" "}
        <div className="w-1 h-1 rounded-full bg-[#00f0ff]/70 shadow-[0_0_4px_rgba(0,240,255,0.6)]"></div>
        <span>SEM ORDENS</span>{" "}
        <div className="w-1 h-1 rounded-full bg-[#00f0ff]/70 shadow-[0_0_4px_rgba(0,240,255,0.6)]"></div>
        <span>SEM CHAVES</span>
      </div>

      <div className="flex gap-3 items-center">
        <span className="text-[#a0f0ff]/90">{time.toLocaleTimeString("en-US", { hour12: false })}</span>
        <div className="flex gap-1.5 ml-1 text-[#00f0ff]/80">
          <Disc size={10} />
          <Wifi size={10} />
          <Activity size={10} />
        </div>
      </div>
    </div>
  );
}
