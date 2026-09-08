// opportunity-rank.ts — "ADAPTIVE TIMEFRAME INTELLIGENCE" / "Opportunity
// Recommendation Engine" do Operador — Stage 1, escopo ADITIVO confirmado
// explicitamente (AskUserQuestion, 2 perguntas):
//   1) Sem histórico real => rótulo honesto "SEM HISTÓRICO", NUNCA um
//      backtest sintético.
//   2) Construir SOBRE o que já existe — zero motor duplicado.
//
// ── O QUE ESTE MÓDULO NÃO É ─────────────────────────────────────────────
// Não é um novo "Candidate Generator": radar-qualification.ts +
// radar-universe.ts já geram e ranqueiam candidatos reais — ~28 símbolos
// curados + até 30 MEXC por ciclo, scan a cada 5min, throttle já
// endurecido nesta mesma sessão (FRENTE 1 §2.3). Não é um novo motor de
// shadow/drift/walk-forward/frescor: os quatro já existem, são testados, e
// já são compostos pela esteira CANDIDATE→SHADOW→OOS→VALIDATION→ELEGIVEL
// em model-governance.ts.
//
// Este módulo é só a JUNÇÃO que faltava: o Radar ranqueia por qualidade
// ESTRUTURAL DO MOMENTO (`qualityIndex` = intensity do Corredor de
// Confluência); o Track Record Archive guarda desfecho REAL por
// symbol:timeframe — mas nada olhava os dois lado a lado.
//
// ── O LIMITE HONESTO, DECIDIDO PELO OPERADOR (não escolhido sozinho) ───
// A maioria dos candidatos do Radar nunca foi realmente operada — o
// Operador vê estrutura em dezenas de símbolos por ciclo, mas só abre
// alguns no gráfico. Para os que nunca abriu,
// `trackRecordArchive[symbol:timeframe]` simplesmente não existe: zero
// trade real resolvido, zero evidência histórica honesta. A resposta
// certa é `SEM_HISTORICO` — nunca um backtest sintético, que seria a
// SEGUNDA simulação de trade que trade-simulation.ts já recusou construir
// nesta base (reconstruiria contexto de Conselho/GMIL/fluxo que só existe
// no momento real — ver o cabeçalho daquele módulo).
//
// ── ESCOPO DELIBERADAMENTE FORA DESTA RODADA ────────────────────────────
// "Melhor timeframe PARA este ativo" (comparar 1m/5m/15m/1h do MESMO
// símbolo, §3-§9 do documento do Operador) fica para uma rodada futura:
// cada candidato do Radar hoje carrega UM timeframe só — o mesmo
// selecionado no gráfico no instante do scan. Cobrir vários exigiria
// multiplicar as chamadas REST do scanner, uma decisão de custo real que
// não estava no escopo aprovado aqui.
//
// Auto-troca do timeframe operacional (§28-§29 do documento, hysteresis,
// switch-guard) também fica de fora: mudar o timeframe que o Core Engine
// lê é território de LEI 24/§71 — merece sua própria decisão explícita,
// nunca entrar de carona numa rodada aditiva de exibição.
//
// LEI 24: leitura pura sobre dados já reais. Zero direção, zero decisão,
// zero caminho para engine.direction ou para o Trade Plan.
import type { RadarQualificationResult } from "./radar-qualification";
import type { TrackRecordState } from "./signal-track-record";
import { candleKey } from "./persistence";
import type { Timeframe } from "./types";
import { simulateTradeCostsBatch } from "./trade-simulation";
import { computeExpectancy } from "./expectancy";
import { evaluateShadowCalibration } from "./shadow-calibration";
import { evaluateWalkForwardCalibration } from "./walk-forward-calibration";
import { measureCalibrationFreshness } from "./calibration-freshness";
import { detectDrift } from "./drift-detector";
import { evaluatePromotion, type GovernanceReport, type PromotionStage } from "./model-governance";

export type OpportunityEvidenceStatus = "HISTORICO_REAL" | "SEM_HISTORICO";

export interface OpportunityReading {
  symbol: string;
  timeframe: string;
  /** Passthrough LITERAL do Radar — qualidade estrutural do MOMENTO
   *  (confluence.intensity), nunca recalculada aqui. null quando o
   *  candidato não qualificou (mesma semântica de RadarQualificationResult). */
  qualityIndex: number | null;
  status: OpportunityEvidenceStatus;
  /** Trades REALMENTE resolvidos para este symbol:timeframe. 0 quando
   *  este par nunca foi aberto no gráfico — nunca um backtest preenchendo
   *  o vazio. */
  sampleSize: number;
  /** Média real de netR sobre a amostra. null quando sampleSize é 0 —
   *  nunca 0 fabricado (Regra de Ouro 3: ausência não é "sem expectativa",
   *  é "não medido"). */
  expectancyR: number | null;
  /** A MESMA esteira já composta e testada em model-governance.ts — zero
   *  segunda lógica de portões aqui. null quando sampleSize é 0 (nada para
   *  a esteira avaliar). */
  governance: GovernanceReport | null;
}

/**
 * Junta candidatos do Radar (qualidade do momento) com o Track Record
 * Archive (desfecho real, quando existe). Função pura — mesma amostra que
 * já alimenta shadow/walk-forward/drift/frescor para o par ATIVO, agora
 * aplicada a cada candidato que TEM um par arquivado.
 *
 * @param now epoch ms real — usado só para o frescor (measureCalibrationFreshness
 *   já depende do relógio; ver o comentário do memo em App.tsx).
 */
export function computeOpportunityRank(
  candidates: readonly RadarQualificationResult[] | null | undefined,
  archive: Record<string, TrackRecordState> | null | undefined,
  now: number,
): OpportunityReading[] {
  const lista = Array.isArray(candidates) ? candidates : [];
  const arq = archive ?? {};

  return lista.map((c): OpportunityReading => {
    const key = candleKey(c.symbol, c.timeframe as Timeframe);
    const entry = arq[key];
    const history = entry && Array.isArray(entry.history) ? entry.history : [];
    const results = history.length > 0 ? simulateTradeCostsBatch(history) : [];

    if (results.length === 0) {
      return {
        symbol: c.symbol,
        timeframe: c.timeframe,
        qualityIndex: c.qualityIndex,
        status: "SEM_HISTORICO",
        sampleSize: 0,
        expectancyR: null,
        governance: null,
      };
    }

    // As MESMAS quatro chamadas do memo de App.tsx para o par ativo —
    // aplicadas aqui a um par arquivado. Zero segunda implementação.
    const shadow = evaluateShadowCalibration(results);
    const walkForward = evaluateWalkForwardCalibration(results);
    const freshness = measureCalibrationFreshness(results, now, c.timeframe);
    const drift = detectDrift(results);
    const governance = evaluatePromotion(shadow, walkForward, freshness, drift);
    const expectancy = computeExpectancy(results);

    return {
      symbol: c.symbol,
      timeframe: c.timeframe,
      qualityIndex: c.qualityIndex,
      status: "HISTORICO_REAL",
      sampleSize: results.length,
      expectancyR: expectancy?.expectancyR ?? null,
      governance,
    };
  });
}

// Ordem de preferência dos estágios da esteira, mais avançado primeiro.
// Record exaustivo por TIPO (PromotionStage inclui BLOQUEADO, que
// evaluatePromotion nunca produz de fato — ver model-governance.ts) —
// TypeScript exige a chave mesmo assim; nunca alcançada em runtime.
const STAGE_ORDER: Record<PromotionStage, number> = {
  ELEGIVEL: 0,
  VALIDATION: 1,
  OOS: 2,
  SHADOW: 3,
  CANDIDATE: 4,
  BLOQUEADO: 5,
};

/**
 * Ordena leituras para exibição: HISTÓRICO REAL antes de SEM HISTÓRICO
 * (prova sempre vence estrutura sozinha); dentro de cada grupo, estágio
 * mais avançado da esteira primeiro; empate quebra pelo `qualityIndex`
 * PRESENTE do Radar — nunca um critério numérico novo inventado aqui.
 * Devolve uma CÓPIA nova; nunca reordena o array recebido (pureza).
 */
export function rankOpportunities(
  readings: readonly OpportunityReading[] | null | undefined,
): OpportunityReading[] {
  const lista = Array.isArray(readings) ? readings : [];
  return [...lista].sort((a, b) => {
    if (a.status !== b.status) return a.status === "HISTORICO_REAL" ? -1 : 1;
    if (a.governance && b.governance) {
      const diff = STAGE_ORDER[a.governance.stage] - STAGE_ORDER[b.governance.stage];
      if (diff !== 0) return diff;
    }
    return (b.qualityIndex ?? 0) - (a.qualityIndex ?? 0);
  });
}

/** Linha curta para a UI. O `n` viaja sempre junto do número — mesmo
 *  padrão de target-hit-rate.ts/excursion-stats.ts: sem piso de amostra
 *  inventado, o leitor calibra sozinho vendo quantos trades sustentam o
 *  número. */
export function describeOpportunity(r: OpportunityReading): string {
  if (r.status === "SEM_HISTORICO") return "sem histórico";
  const exp = r.expectancyR !== null ? `${r.expectancyR >= 0 ? "+" : ""}${r.expectancyR.toFixed(2)}R` : "s/ expectativa";
  return `${r.governance!.stage} · ${exp} (${r.sampleSize})`;
}
