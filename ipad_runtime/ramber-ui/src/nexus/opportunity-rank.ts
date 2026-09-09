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
// ── STAGE 2 (2026-09-08, pedido direto do Operador — "qual seria o
// melhor tempo gráfico pra operar", explicitamente comparado por ele à
// arquitetura de recomendação do YouTube/Google/X) ──────────────────────
// Os dois itens abaixo, que a nota original de Stage 1 tinha deixado de
// fora, foram fechados nesta rodada: `compareAssetTimeframes()` e
// `suggestBetterTimeframe()`.
//
// "Melhor timeframe PARA este ativo" deixou de precisar multiplicar
// chamadas REST — a preocupação de custo original era sobre o SCANNER DE
// FUNDO cobrir mais prazos por ciclo (Radar). `compareAssetTimeframes()` é
// outra coisa: lê só o `trackRecordArchive` já persistido (trades que o
// Operador JÁ fez no passado), zero rede nova, chamado sob demanda quando
// o Operador está olhando aquele ativo — o mesmo padrão de custo de
// `computeOpportunityRank`, nunca o do scanner.
//
// Auto-troca do timeframe operacional (a decisão que a nota original de
// Stage 1 disse precisar de autorização explícita e nunca poderia entrar
// de carona): perguntada de verdade ao Operador (`AskUserQuestion`,
// resposta "Só sugere, você confirma") — igual em espírito à exceção
// pontual da Entrega 42, mas categoricamente mais simples: aqui
// `engine.direction`/`CoreSignalBadge` nunca são tocados, nenhuma segunda
// decisão de trading é gerada. `suggestBetterTimeframe()` só devolve QUAL
// prazo tem evidência real melhor; a troca de fato continua sendo o
// MESMO `setChartTimeframe()` de sempre, dado pela mão do Operador — o
// mesmo tipo de botão que o Radar já usa pra trocar de ativo
// (`setSelectedAsset` em `openCandidate()`, App.tsx). Nunca automático,
// nunca silencioso, razão sempre visível (número + estágio da esteira,
// nunca escondido em tooltip).
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
import { MULTI_TIMEFRAME_LIST } from "./multi-timeframe-engine";

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
 * O NÚCLEO real de junção — um símbolo:timeframe contra o Track Record
 * Archive. Função pura, privada: `computeOpportunityRank` (candidatos do
 * Radar) e `compareAssetTimeframes` (um ativo, vários prazos) chamam a
 * MESMA avaliação — zero segunda implementação entre os dois usos.
 */
function evaluateAgainstArchive(
  symbol: string,
  timeframe: string,
  qualityIndex: number | null,
  archive: Record<string, TrackRecordState>,
  now: number,
): OpportunityReading {
  const key = candleKey(symbol, timeframe as Timeframe);
  const entry = archive[key];
  const history = entry && Array.isArray(entry.history) ? entry.history : [];
  const results = history.length > 0 ? simulateTradeCostsBatch(history) : [];

  if (results.length === 0) {
    return { symbol, timeframe, qualityIndex, status: "SEM_HISTORICO", sampleSize: 0, expectancyR: null, governance: null };
  }

  // As MESMAS quatro chamadas do memo de App.tsx para o par ativo —
  // aplicadas aqui a um par arquivado. Zero segunda implementação.
  const shadow = evaluateShadowCalibration(results);
  const walkForward = evaluateWalkForwardCalibration(results);
  const freshness = measureCalibrationFreshness(results, now, timeframe);
  const drift = detectDrift(results);
  const governance = evaluatePromotion(shadow, walkForward, freshness, drift);
  const expectancy = computeExpectancy(results);

  return {
    symbol,
    timeframe,
    qualityIndex,
    status: "HISTORICO_REAL",
    sampleSize: results.length,
    expectancyR: expectancy?.expectancyR ?? null,
    governance,
  };
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
  return lista.map((c) => evaluateAgainstArchive(c.symbol, c.timeframe, c.qualityIndex, arq, now));
}

/**
 * "Qual o melhor tempo gráfico pra operar ESTE ativo" — a comparação
 * cross-timeframe pedida pelo Operador (§3-§9 do documento original,
 * deliberadamente fora do Stage 1). Mesmo símbolo, um `OpportunityReading`
 * por prazo real da régua — reusa a MESMA `evaluateAgainstArchive` de
 * `computeOpportunityRank`, zero segunda lógica de junção.
 *
 * `qualityIndex` sempre null aqui: é a leitura ESTRUTURAL DO MOMENTO do
 * Radar (confluence.intensity no instante do scan), que só existe para os
 * poucos prazos que o scanner de fundo realmente varre
 * (`RADAR_SCAN_TIMEFRAMES`) — inventar um valor para os demais seria
 * fabricar leitura estrutural que não existe (Regra de Ouro 3).
 *
 * @param timeframes régua real a comparar — default é a MESMA lista
 *   curada de `multi-timeframe-engine.ts` (já usada pelo §10 TIMEFRAME
 *   AGREEMENT), nunca uma segunda enumeração de prazos.
 */
export function compareAssetTimeframes(
  symbol: string,
  archive: Record<string, TrackRecordState> | null | undefined,
  now: number,
  timeframes: readonly string[] = MULTI_TIMEFRAME_LIST,
): OpportunityReading[] {
  const arq = archive ?? {};
  return timeframes.map((tf) => evaluateAgainstArchive(symbol, tf, null, arq, now));
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

/**
 * "Existe um prazo com evidência REAL melhor que o atual, pra este
 * ativo?" — a peça de sugestão pedida pelo Operador ("joga qual o
 * timeframe seria melhor"), nunca uma troca automática (LEI 24/§71: o
 * Operador decidiu explicitamente que o Núcleo continua lendo o prazo que
 * ELE escolhe — isto só sugere, a troca de verdade é o mesmo
 * `setChartTimeframe` de sempre, disparado pela mão do Operador).
 *
 * FAIL-CLOSED, sem limiar novo: só sugere um prazo cujo `governance.stage`
 * já é `ELEGIVEL` — a MESMA esteira CANDIDATE→SHADOW→OOS→VALIDATION de
 * `model-governance.ts`, que já exige amostra real (`MIN_TRADES_FOR_VALID_
 * EXPECTANCY`), comparação real contra o incumbente e ausência de drift.
 * Não é um piso de amostra inventado aqui — é reusar o veredito mais
 * rigoroso que este sistema já sabe calcular. Devolve `null` sempre que
 * não houver nada real para sugerir (nenhum candidato ELEGIVEL, ou o
 * atual já é o melhor ELEGIVEL) — ausência de sugestão é o padrão, nunca
 * uma sugestão fabricada pra preencher a tela.
 *
 * @param current a leitura do prazo JÁ selecionado no gráfico (pode ser
 *   `null` quando o ativo nunca foi aberto neste prazo — trata como "sem
 *   base pra comparar", qualquer ELEGIVEL já é sugestão real).
 * @param all as leituras de `compareAssetTimeframes` para o MESMO ativo.
 */
export function suggestBetterTimeframe(
  current: OpportunityReading | null | undefined,
  all: readonly OpportunityReading[] | null | undefined,
): OpportunityReading | null {
  const lista = Array.isArray(all) ? all : [];
  const currentTimeframe = current?.timeframe ?? null;
  const eligible = lista.filter((r) => r.timeframe !== currentTimeframe && r.governance?.stage === "ELEGIVEL");
  if (eligible.length === 0) return null;

  const best = eligible.reduce((acc, r) => ((r.expectancyR ?? -Infinity) > (acc.expectancyR ?? -Infinity) ? r : acc));

  // Atual também ELEGIVEL: só vale a pena sugerir se a expectativa REAL do
  // alternativo for estritamente melhor — nunca troca por empate/estágio
  // igual sozinho.
  if (current?.governance?.stage === "ELEGIVEL") {
    const currentExp = current.expectancyR ?? -Infinity;
    return (best.expectancyR ?? -Infinity) > currentExp ? best : null;
  }

  // Atual não alcançou ELEGIVEL (ou nem tem par arquivado): qualquer
  // candidato que JÁ alcançou é, por definição, evidência real melhor.
  return best;
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
