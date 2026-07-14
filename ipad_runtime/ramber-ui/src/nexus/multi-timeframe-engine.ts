// multi-timeframe-engine.ts — AR10 CYBORG Phase Ω Priority 1: "Adaptive
// Multi-Timeframe Intelligence". Real per-timeframe context for
// 1m/5m/15m/1h/4h/1d — never fabricated, never a second trading decision.
//
// AUDITORIA ANTES DE CONSTRUIR (achado real): Market Structure, Regime
// (tendência+volatilidade), Support/Resistance e RSI já são funções puras
// reais de "me dê candles, devolvo um resultado real" — nenhuma delas tem
// o timeframe fixo internamente, `timeframe` é só metadado de rótulo. Este
// arquivo não inventa matemática nova para nenhuma dessas quatro
// categorias: reaproveita integralmente os mesmos motores graduados que o
// ciclo principal já usa (market-structure-engine.js, regime-engine.js,
// support-resistance-engine.js, computeRSI de lorentzian-classifier.js).
//
// O ÚNICO cálculo novo aqui é o "confidence" por timeframe — e mesmo esse
// reaproveita o MESMO linear opinion pool real já em produção desde a Fase
// F (buildEnsembleConsensus/opinionFromLabel/opinionFromVote, Stone 1961/
// DeGroot 1974) e o MESMO agente de momentum já construído para o
// Conselho (momentumAgentVote) — aplicado a um novo conjunto honesto de
// insumos (a leitura própria deste timeframe), nunca um segundo algoritmo
// de consenso. "Confidence" é massa de opinião real do pool, exatamente
// a mesma semântica honesta do Conselho — NUNCA uma probabilidade
// calibrada (este repositório não tem histórico de acerto/backtest real
// para sustentar essa afirmação honestamente; ver o próprio racional já
// documentado em ensemble-engine.js e support-resistance-engine.js).
//
// HIERARQUIA INVIOLÁVEL (LEI 24, mesma regra do Conselho/Cenários/GMIL):
// isto é confluência/contexto ENTRE timeframes, nunca um segundo motor de
// decisão. O único LONG/SHORT/WAIT real do app continua sendo o Core
// Engine, para o timeframe selecionado pelo Operador no gráfico — estas 6
// linhas respondem só "os outros prazos concordam?", a mesma pergunta que
// a confluência 15m/1H já respondia para UM prazo extra, agora para todos.
//
// Escopo desta Fase Ω v1 (decisão deliberada, documentada, não um
// esquecimento): Volume Profile e Liquidez (SMC) ficam de fora por ora —
// rodar o Volume Profile real (WASM/Worker) 6x a cada ciclo sobrecarregaria
// o Worker sem necessidade para a pergunta central ("os prazos
// concordam?"); é um fast-follow real, não fabricado aqui como
// placeholder. Order Flow por timeframe também fica de fora: o histórico
// real de CVD retido (orderflow-history.ts, ORDERFLOW_HISTORY_CAPACITY)
// cobre só ~8 minutos reais — real o suficiente para 1m/5m/15m, mas
// simplesmente não existe dado real retido para calcular Order Flow
// honesto em 1H/4H/1D. Documentado como limitação real, não fabricado.
import { analyze as analyzeMarketStructureRaw } from '../../../src/research/engines/market-structure-engine.js';
import { analyze as analyzeSupportResistanceRaw } from '../../../src/research/engines/support-resistance-engine.js';
import { classifyMarketRegime as classifyMarketRegimeRaw } from '../../../src/market-regime/index.js';
import { computeRSI } from '../../../src/research/engines/lorentzian-classifier.js';
import { buildEnsembleConsensus, opinionFromLabel, opinionFromVote } from '../../../src/consensus/index.js';
import { momentumAgentVote } from './council';

// Diretriz Mestra §7: lista ampliada com 3m/30m/1w (intervalos nativos da
// Binance Futures — o Bus repassa a string direto; +3 fetches por ciclo de
// 60s, custo real medido e aceitável). 9 prazos, do scalp ao macro semanal.
export const MULTI_TIMEFRAME_LIST = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;
export type MultiTimeframeId = (typeof MULTI_TIMEFRAME_LIST)[number];

export interface MultiTimeframeCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type TimeframeStance = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface TimeframeContext {
  timeframe: MultiTimeframeId;
  status: 'OK' | 'DADOS_INSUFICIENTES';
  reason: string | null;
  structureLabel: 'ESTRUTURA_ALTA' | 'ESTRUTURA_BAIXA' | 'ESTRUTURA_LATERAL' | null;
  regime: string | null;
  regimeDirection: 'ALTA' | 'BAIXA' | null;
  atrPercent: number | null;
  rsi: number | null;
  support1: number | null;
  resistance1: number | null;
  // Massa de opinião real do pool (Stone/DeGroot) — NUNCA probabilidade de
  // mercado calibrada. null enquanto nenhum dos 3 insumos direcionais tem
  // leitura real (fail-closed honesto, nunca 0 fabricado).
  confidence: number | null;
  confidenceStance: TimeframeStance | null;
  candlesUsed: number;
  computedAt: number;
}

function baseInsufficient(timeframe: MultiTimeframeId, reason: string, computedAt: number): TimeframeContext {
  return {
    timeframe,
    status: 'DADOS_INSUFICIENTES',
    reason,
    structureLabel: null,
    regime: null,
    regimeDirection: null,
    atrPercent: null,
    rsi: null,
    support1: null,
    resistance1: null,
    confidence: null,
    confidenceStance: null,
    candlesUsed: 0,
    computedAt,
  };
}

/** Massa de opinião real do MESMO pool (Fase F) sobre os 3 insumos
 *  direcionais reais deste timeframe: estrutura (real, fractal), regime
 *  (real, ADX/Bollinger) e momentum (real, RSI de Wilder via o MESMO
 *  momentumAgentVote do Conselho — zero segunda matemática de RSI).
 *  Qualquer insumo sem leitura real simplesmente não vota (mesma regra do
 *  Conselho: ABSTAIN/ausência = excluído do pool, nunca um voto
 *  fabricado). Sem NENHUM insumo real, devolve null honesto — nunca 0. */
function computeTimeframeConfidence(
  structureLabel: TimeframeContext['structureLabel'],
  regimeDirection: TimeframeContext['regimeDirection'],
  rsi: number | null,
): { confidence: number | null; stance: TimeframeStance | null } {
  const members: { id: string; familia: null; opiniao: ReturnType<typeof opinionFromLabel> }[] = [];

  if (structureLabel) {
    // ESTRUTURA_LATERAL é um achado real ("nem HH/HL nem LH/LL"), não uma
    // ausência de dado — vota NEUTRAL de verdade (mesma regra já usada
    // por structureAgentVote no Conselho), nunca é excluído do pool.
    const label = structureLabel === 'ESTRUTURA_ALTA' ? 'ALTA' : structureLabel === 'ESTRUTURA_BAIXA' ? 'BAIXA' : 'LATERAL';
    const opiniao = opinionFromLabel(label);
    if (opiniao) members.push({ id: 'structure', familia: null, opiniao });
  }
  if (regimeDirection) {
    // direction null (CONSOLIDACAO/COMPRESSAO) já significa "ADX real sem
    // força de tendência suficiente para opinar" — abstenção real, não
    // rótulo forçado (diferente da estrutura, aqui null É ausência real).
    const opiniao = opinionFromLabel(regimeDirection);
    if (opiniao) members.push({ id: 'regime', familia: null, opiniao });
  }
  const momentum = momentumAgentVote(rsi);
  if (momentum.stance !== 'ABSTAIN') {
    const opiniao = opinionFromVote(momentum.stance, momentum.confidence ?? 0);
    if (opiniao) members.push({ id: 'momentum', familia: null, opiniao });
  }

  if (members.length === 0) return { confidence: null, stance: null };

  const pool = buildEnsembleConsensus({ members }) as any;
  if (pool.status !== 'OK') return { confidence: null, stance: null };
  const stance: TimeframeStance = pool.direcao === 'ALTA' ? 'LONG' : pool.direcao === 'BAIXA' ? 'SHORT' : 'NEUTRAL';
  return { confidence: pool.forca as number, stance };
}

/** Um timeframe, uma análise real — pura função de candles reais desse
 *  prazo. Nunca lança: qualquer motor real que devolva DADOS_INSUFICIENTES
 *  vira null honesto no campo correspondente, nunca derruba os outros
 *  campos que tiveram leitura real. */
export function analyzeTimeframe(timeframe: MultiTimeframeId, candles: MultiTimeframeCandle[]): TimeframeContext {
  const computedAt = Date.now();
  if (!Array.isArray(candles) || candles.length === 0) {
    return baseInsufficient(timeframe, 'sem_candles_reais_para_este_timeframe', computedAt);
  }

  const structureResult = analyzeMarketStructureRaw({ ohlcv_series: candles, timeframe }) as any;
  const regimeResult = classifyMarketRegimeRaw({ ohlcv_series: candles, timeframe }) as any;
  const srResult = analyzeSupportResistanceRaw({ ohlcv_series: candles, timeframe }) as any;

  const closes = candles.map((c) => c.c);
  const rsiSeries = computeRSI(closes, 14) as number[];
  const lastRsi = rsiSeries[rsiSeries.length - 1];
  const rsi = Number.isFinite(lastRsi) ? (lastRsi as number) : null;

  const structureLabel: TimeframeContext['structureLabel'] = structureResult.status === 'OK' ? structureResult.structure_label : null;
  const regime: string | null = regimeResult.status === 'OK' ? regimeResult.regime : null;
  const regimeDirection: TimeframeContext['regimeDirection'] = regimeResult.status === 'OK' ? regimeResult.direction : null;
  const atrPercent: number | null = regimeResult.status === 'OK' ? regimeResult.evidence.atr_percent : null;
  const support1: number | null = srResult.status === 'OK' && Number.isFinite(srResult.support_1) ? srResult.support_1 : null;
  const resistance1: number | null = srResult.status === 'OK' && Number.isFinite(srResult.resistance_1) ? srResult.resistance_1 : null;

  const { confidence, stance } = computeTimeframeConfidence(structureLabel, regimeDirection, rsi);

  const anyRealReading = structureLabel !== null || regime !== null || support1 !== null || resistance1 !== null || rsi !== null;
  if (!anyRealReading) {
    return baseInsufficient(timeframe, 'nenhum_motor_real_teve_leitura_nesta_janela', computedAt);
  }

  return {
    timeframe,
    status: 'OK',
    reason: null,
    structureLabel,
    regime,
    regimeDirection,
    atrPercent,
    rsi,
    support1,
    resistance1,
    confidence,
    confidenceStance: stance,
    candlesUsed: candles.length,
    computedAt,
  };
}

export type MultiTimeframeMatrix = Record<MultiTimeframeId, TimeframeContext>;
