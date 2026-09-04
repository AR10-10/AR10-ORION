// radar-qualification.ts — OMEGA CORE V-MAX Fase 7 ("Radar/OIH, módulo
// único consultivo"): o núcleo puro de qualificação/ranking de UMA
// oportunidade candidata — nunca recalcula mercado, nunca emite LONG/
// SHORT/WAIT (LEI 24). Consulta SÓ leituras já reais de outro lugar
// (TradePlan real, Corredor de Confluência da Fase 5, riskGated do
// Conselho, direção do Core Engine) — a mesma disciplina de "consulta
// snapshot, não recalcula" que a diretiva pede, garantida por design:
// esta função nunca busca candles, nunca chama um motor de estrutura,
// só avalia um candidato já pronto.
//
// Escopo desta v1 (decisão do Operador, resposta explícita a
// AskUserQuestion): o varredor multi-ativo em segundo plano (Workers +
// fila + cache + scan incremental + painel novo no header, substituindo
// o "botão pulsante" citado na diretiva — nenhum dos dois existe hoje
// neste repositório, confirmado por grep antes de escrever qualquer
// código) fica para uma rodada própria e cuidadosa — Regra de Ouro 6
// deste projeto: "mover cálculo pesado pra Worker exige iniciativa
// isolada e cuidadosa, nunca uma mudança apressada junto de outras
// coisas". Este módulo é o núcleo que esse varredor futuro vai chamar,
// uma vez por ativo candidato, quando existir — construído e testado
// agora para não bloquear esse trabalho futuro.
//
// Universo de ativos: a v1 do varredor usava só a lista curada real de
// ipad_runtime/configs/asset-universe.default.json (Binance). ADITIVO
// V-MAX Etapa 9 (MED "Radar Global: concluir completamente" + seção
// MEXC×Binance "separar apenas a camada de Provider"): o varredor em
// App.tsx agora TAMBÉM pagina pelo universo real de contratos MEXC
// (omnibox/mexc-symbols.ts) — este módulo continua agnóstico de onde o
// candidato veio (só lê `provider` como proveniência, nunca decide com
// base nele).
import type { TradePlan } from "./trade-plan";
import type { ConfluenceCorridorReading } from "./confluence-corridor";
import type { MarketDataProviderId } from "../market-data-adapter";

// Mesmo convenção documentada de "oportunidade" já usada em
// institutional-score.ts (DEFAULT_MIN_OPPORTUNITY_SCORE = 60/100 = 0.6)
// — reaproveitada aqui como piso de intensidade do Corredor de
// Confluência para uma oportunidade aparecer no Radar. Convenção, não
// medição (mesma natureza do piso 1:2 de rr-quality.ts).
export const RADAR_MIN_CONFLUENCE_INTENSITY = 0.6;

export type RadarStructureLabel = "ESTRUTURA_ALTA" | "ESTRUTURA_BAIXA" | "ESTRUTURA_LATERAL";

export interface RadarCandidateInput {
  symbol: string;
  timeframe: string;
  // Mesmo vocabulário real de market-structure-engine.js — nunca uma
  // segunda classificação de estrutura.
  structureLabel: RadarStructureLabel | null;
  // Direção ATIVA real do Core Engine — nunca recalculada aqui.
  direction: "LONG" | "SHORT" | null;
  // Trade Plan já real (trade-plan.ts) — null = sem plano válido, filtro
  // reprova (fail-closed). R:R é lido de dentro dele, nunca duplicado
  // como campo separado.
  tradePlan: TradePlan | null;
  // Já real (CouncilDecision.riskGated) — "risk gate CLEAR somente se
  // esse conceito já existir no código" (pedido explícito da diretiva):
  // reusa o campo que já existe, nunca inventa um gate novo.
  riskGated: boolean;
  // Já real (Fase 5, Corredor de Confluência) — zero segunda fórmula de
  // consenso. A ÚNICA fonte do índice de qualidade abaixo.
  confluence: ConfluenceCorridorReading;
  // ADITIVO V-MAX Etapa 9: exchange real que forneceu este candidato —
  // honestidade de proveniência, nunca um critério de qualificação.
  provider: MarketDataProviderId;
}

export interface RadarQualificationResult {
  symbol: string;
  timeframe: string;
  qualifies: boolean;
  reason: string;
  direction: "LONG" | "SHORT" | null;
  // Índice interno de qualidade (0-1) — é a MESMA leitura `intensity` do
  // Corredor de Confluência (Fase 5), nunca uma segunda heurística.
  // NUNCA rotulado/exposto como probabilidade (Regra de Ouro 2). null
  // quando não qualifica.
  qualityIndex: number | null;
  riskRewardRatio: number | null;
  computedAt: number;
  // ADITIVO V-MAX Etapa 9: mesmo campo de proveniência, passthrough até
  // a UI — um candidato BTC via MEXC e um BTC via Binance são leituras
  // reais e independentes, nunca a mesma "verdade" por terem o mesmo
  // ticker (mesmo princípio já usado pelos cross-checks Bybit/OKX).
  provider: MarketDataProviderId;
}

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Único código-motivo real que hoje chega à UI (rankRadarCandidates só
// deixa passar qualifies=true, e este é o único caminho que retorna
// qualifies: true) — nomeado para nunca duplicar o literal em dois
// lugares (Single Source of Truth).
export const RADAR_QUALIFIES_REASON =
  "estrutura_confirmada_trade_plan_valido_risco_liberado_confluencia_suficiente";

/** Diretriz Final — Lapidação Visual §6 ("apresentar justificativas
 *  objetivas para cada oportunidade"): traduz o código-motivo (sempre
 *  honesto, nunca fabricado — é o mesmo `reason` já retornado por
 *  qualifyRadarCandidate acima) para uma frase curta legível. Só o caso
 *  que qualifica tem tradução dedicada porque é o único que a UI hoje
 *  mostra; qualquer outro código (os `reject()` acima, hoje nunca
 *  renderizados) cai num fallback honesto — o próprio código com "_"
 *  trocado por espaço — nunca uma frase inventada para um motivo sem
 *  tradução dedicada. */
export function describeRadarQualificationReason(reason: string): string {
  if (reason === RADAR_QUALIFIES_REASON) {
    return "Estrutura confirmada · Trade Plan válido · risco liberado pelo Conselho · confluência suficiente";
  }
  return reason.replace(/_/g, " ");
}

/** Avalia UM candidato real contra o filtro mínimo da diretiva — puro,
 *  read-only, zero rede/motor. Chamado uma vez por ativo pelo varredor
 *  futuro (fora do escopo desta v1). */
export function qualifyRadarCandidate(input: RadarCandidateInput, now: number = Date.now()): RadarQualificationResult {
  const base = {
    symbol: input.symbol,
    timeframe: input.timeframe,
    direction: input.direction,
    riskRewardRatio: input.tradePlan?.riskRewardRatios[0] ?? null,
    computedAt: now,
    provider: input.provider,
  };
  const reject = (reason: string): RadarQualificationResult => ({ ...base, qualifies: false, reason, qualityIndex: null });

  if (input.direction !== "LONG" && input.direction !== "SHORT") {
    return reject("sem_direcao_ativa_do_core_engine");
  }
  if (input.structureLabel !== "ESTRUTURA_ALTA" && input.structureLabel !== "ESTRUTURA_BAIXA") {
    return reject("estrutura_nao_confirmada_ou_lateral");
  }
  if (!input.tradePlan) {
    return reject("sem_trade_plan_valido");
  }
  if (input.riskGated) {
    return reject("risk_gate_travado_pelo_conselho");
  }
  if (input.confluence.status !== "OK" || !fin(input.confluence.intensity)) {
    return reject("confluencia_real_indisponivel_nesta_janela");
  }
  if ((input.confluence.intensity as number) < RADAR_MIN_CONFLUENCE_INTENSITY) {
    return reject(`confluencia_abaixo_do_piso_${RADAR_MIN_CONFLUENCE_INTENSITY}`);
  }

  return {
    ...base,
    qualifies: true,
    reason: RADAR_QUALIFIES_REASON,
    qualityIndex: input.confluence.intensity,
  };
}

/** Ordena só os candidatos que QUALIFICAM, por qualityIndex desc — nunca
 *  inventa ordem para quem não qualifica ("só lista oportunidades
 *  realmente validadas"). Puro, sem I/O. */
export function rankRadarCandidates(results: RadarQualificationResult[]): RadarQualificationResult[] {
  return results
    .filter((r) => r.qualifies && fin(r.qualityIndex))
    .sort((a, b) => (b.qualityIndex as number) - (a.qualityIndex as number));
}
