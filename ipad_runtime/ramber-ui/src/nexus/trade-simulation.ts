// trade-simulation.ts — Entrega 42 ("Profitability Engine", Parte 1): custo
// real (comissão + slippage + funding) aplicado sobre um TrackedPlan JÁ
// RESOLVIDO (signal-track-record.ts) — nunca uma 2ª simulação de trade a
// partir de candles brutos. O trade JÁ aconteceu de verdade (mesmo preço
// real que resolveu o plano, mesma duração real, mesmo regime real
// carimbado na abertura); esta camada só pergunta "depois de taxas reais,
// esse resultado ainda é positivo?".
//
// Desvio deliberado da arquitetura de um documento externo ("ENTREGA 41:
// PROFITABILITY ENGINE" — cuja numeração colide com a Entrega 41 real
// desta sessão, TPO/Market Profile; renumerado honestamente pra 42 aqui).
// O documento endereçava "Agente 4" (persona fictícia — mesmo padrão já
// pausado 5x nesta sessão) e citava o MESMO hash de commit fabricado
// (`8d9f7g8`, não-hex) do documento "DOCUMENTACAO_FINAL" já comprovado
// falso — confirmado com o Operador via AskUserQuestion antes de
// construir; autorização explícita recebida para a mudança de LEI 24
// (ver evaluateSignalFilter/CoreSignalBadge). O documento pedia um
// HistoricalSignalCollector que reproduz o Core Engine sobre 2 anos de
// histórico multi-ativo via Web Worker + IndexedDB. Auditoria antes de
// construir encontrou 2 problemas reais: (1) este sandbox nunca teve
// egress real pra Binance em toda a sessão — não dá pra buscar 2 anos de
// candles reais aqui pra validar; (2) signal-track-record.ts JÁ rastreia
// o desfecho REAL (nunca simulado) de cada Trade Plan que o Core Engine
// formou, arquivado por symbol:timeframe (trackRecordArchive) — dado mais
// honesto que um replay sintético que teria que reconstruir contexto de
// Conselho/GMIL/fluxo que não existe fora do momento real (mesma honestidade
// já praticada pelo laboratório de backtest estrutural do projeto, que se
// declara "subconjunto estrutural candle-only" pela mesma razão — ver
// research/backtest/ — nunca importado daqui, só citado como precedente).
// Decisão: reusar Track Record como fonte, nunca reconstruir um 2º histórico.
// HistoricalSignalCollector fica documentado como pendência futura honesta.
//
// Custos reais (pesquisa real via WebSearch antes de codar — Disciplina
// item 2 do CLAUDE.md): taker fee Binance USDT-M Futures = 0.05%
// (confirmado 2026, binance.com/en/fee/futureFee — o documento externo
// citava 0.04%, desatualizado). Funding real assentado a cada 8h por
// padrão (confirmado 2026, binance.com — contratos específicos podem
// variar sob condições de mercado). Slippage não tem uma fonte pública
// única — modelado como fração declarada do risco (R) do próprio trade
// (nunca do ATR bruto: ATR-no-momento-do-sinal não é um dado que
// signal-track-record.ts guarda hoje; R já é uma distância estruturalmente
// escalada pela volatilidade real do stop, mesma lógica de todo R-múltiplo
// já usado neste código — ver MFE/MAE em structural-backtest.js).
import type { TrackedPlan } from "./signal-track-record";
import { computeScenarioFingerprint } from "./scenario-fingerprint";

export interface ExecutionCostConfig {
  takerFeeRate: number; // fração, ex.: 0.0005 = 0.05% por lado (entrada OU saída)
  slippageRFraction: number; // fração de R por lado (entrada + saída = 2x isto)
  fundingRatePerSettlement: number; // fração do preço por acerto de funding
  fundingSettlementHours: number; // intervalo real entre acertos
}

// Convenções declaradas (mesmo espírito de LIQUIDITY_PROXIMITY_PCT em
// layer-relevance.ts) — nunca uma medição histórica real desta conta
// (este terminal é READ_ONLY, nunca executou uma ordem real). slippageRFraction
// e fundingRatePerSettlement são estimativas conservadoras documentadas,
// ajustáveis; takerFeeRate e fundingSettlementHours são fatos reais
// verificados (ver header).
export const DEFAULT_EXECUTION_COST_CONFIG: ExecutionCostConfig = {
  takerFeeRate: 0.0005,
  slippageRFraction: 0.02,
  fundingRatePerSettlement: 0.0001,
  fundingSettlementHours: 8,
};

export interface TradeCostResult {
  status: "TARGET_HIT" | "PARTIAL_HIT" | "STOP_HIT";
  direction: "LONG" | "SHORT";
  entryMid: number;
  riskPoints: number; // R em pontos de preço, sempre > 0
  grossR: number; // resultado real (preço de resolução real), antes de custos
  commissionR: number; // sempre >= 0, sempre subtraído
  slippageR: number; // sempre >= 0, sempre subtraído
  fundingR: number; // sempre >= 0, sempre subtraído (nunca assume funding a favor)
  netR: number; // grossR - commissionR - slippageR - fundingR
  holdingMs: number;
  regime: string | null; // engine.marketRegime.regime carimbado na abertura (pode ser null em registros antigos)
  // Escopo Cirúrgico (Operador, Fase 1): assinatura real do cenário
  // (nexus/scenario-fingerprint.ts) — permite agrupar por família de
  // configuração antes de chamar computeExpectancy(), sem tocar naquele
  // módulo. null quando o contexto de abertura não tem NENHUM dos 4
  // fatores reais (registros anteriores à Entrega 42/Escopo Cirúrgico).
  fingerprint: string | null;
}

/** null quando o plano não resolveu de verdade ainda (OPEN/REPLACED nunca
 *  contam como trade — mesma regra de hitRate() em signal-track-record.ts)
 *  ou quando o risco é degenerado (entry===stop, nunca uma divisão
 *  fabricada). */
export function simulateTradeCosts(
  tracked: TrackedPlan,
  config: ExecutionCostConfig = DEFAULT_EXECUTION_COST_CONFIG,
): TradeCostResult | null {
  if (tracked.status !== "TARGET_HIT" && tracked.status !== "PARTIAL_HIT" && tracked.status !== "STOP_HIT") return null;
  if (tracked.resolvedPrice === null || tracked.resolvedAt === null) return null;

  const plan = tracked.plan;
  const entryMid = (plan.entry.low + plan.entry.high) / 2;
  const riskPoints = Math.abs(entryMid - plan.stop.price);
  if (!(riskPoints > 0)) return null;

  const long = plan.direction === "LONG";
  const pnlPoints = long ? tracked.resolvedPrice - entryMid : entryMid - tracked.resolvedPrice;
  const grossR = pnlPoints / riskPoints;

  const commissionR = (2 * config.takerFeeRate * entryMid) / riskPoints;
  const slippageR = 2 * config.slippageRFraction;

  const holdingMs = tracked.resolvedAt - tracked.openedAt;
  const holdingHours = Math.max(0, holdingMs / 3_600_000);
  const settlementsCrossed = Math.floor(holdingHours / config.fundingSettlementHours);
  const fundingR =
    settlementsCrossed > 0 ? (settlementsCrossed * config.fundingRatePerSettlement * entryMid) / riskPoints : 0;

  const netR = grossR - commissionR - slippageR - fundingR;

  return {
    status: tracked.status,
    direction: plan.direction,
    entryMid,
    riskPoints,
    grossR,
    commissionR,
    slippageR,
    fundingR,
    netR,
    holdingMs,
    regime: tracked.contextAtOpen?.regime ?? null,
    fingerprint: computeScenarioFingerprint(tracked.contextAtOpen),
  };
}

/** Aplica simulateTradeCosts a uma lista real de TrackedPlan, descartando
 *  silenciosamente os que não resolveram (OPEN/REPLACED) — nunca um erro,
 *  já é o comportamento esperado (planos abertos/substituídos não são
 *  trades). */
export function simulateTradeCostsBatch(
  tracked: TrackedPlan[],
  config: ExecutionCostConfig = DEFAULT_EXECUTION_COST_CONFIG,
): TradeCostResult[] {
  const out: TradeCostResult[] = [];
  for (const t of tracked) {
    const r = simulateTradeCosts(t, config);
    if (r) out.push(r);
  }
  return out;
}
